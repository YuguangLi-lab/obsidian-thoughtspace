import {Menu,setIcon} from 'obsidian';

export interface MediaCardState {
  time: number;
  rate: number;
  volume: number;
  loopA?: number;
  loopB?: number;
}

export interface MediaCardTrack {
  src: () => string | Promise<string>;
  label: string;
  language?: string;
}

export interface MediaCardOptions {
  kind: 'audio' | 'video';
  /** Board cards keep native playback controls and one compact excerpt row. */
  controls?: 'board' | 'full';
  /** Host-owned native prompt; returns a close callback for player teardown. */
  requestTime?: (current: string, submit: (value: string) => void) => (() => void);
  title: string;
  /** Resolve local resource paths only after a deliberate playback request. */
  src: () => string;
  initialTime?: number;
  state?: MediaCardState;
  captureEnabled?: boolean;
  onState: (state: MediaCardState) => void;
  onCapture: (time: number) => unknown;
  onCaptureFrame?: (blob: Blob, time: number) => unknown;
  /** Synchronous reservation before PNG encoding; paired release also runs on cancellation. */
  onFrameCaptureState?: (busy: boolean, time: number) => void;
  onOpen: () => unknown;
  onPlay?: () => void;
  onEnded?: () => void;
  /** Background/independent players may keep playing while their host is hidden. */
  suspendWhenHidden?: boolean;
  tracks?: readonly MediaCardTrack[];
  alive: () => boolean;
}

export interface MediaCardHandle {
  dispose(): void;
  seek(time: number): void;
  getState(): MediaCardState;
  /** Call only in response to an explicit user playback request. */
  play(): void;
  /** Suspend playback and release its source; resuming always requires a click. */
  pause(): void;
}

const rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const validRate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0.25 && value <= 4;
let disclosureId = 0;
const finiteTime = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const timestamp = (value: number) => {
  const seconds = Math.floor(finiteTime(value)), minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
};
const preciseTimestamp = (value: number) => {
  const seconds = finiteTime(value), milliseconds = Math.round((seconds % 1) * 1000);
  const fraction = String(milliseconds % 1000).padStart(3, '0').replace(/0+$/, '');
  return timestamp(Math.floor(seconds) + (milliseconds === 1000 ? 1 : 0)) + (fraction ? `.${fraction}` : '');
};
const parseTimestamp = (text: string): number | undefined => {
  const parts = text.trim().split(':');
  if (parts.length > 3 || parts.some((part, i) => !(i === parts.length - 1 ? /^(?:\d+(?:\.\d+)?|\.\d+)$/ : /^\d+$/).test(part))) return;
  const values = parts.map(Number);
  if (values.slice(1).some(value => value >= 60)) return;
  const total = values.reduce((time, part) => time * 60 + part, 0);
  return Number.isFinite(total) && total <= Number.MAX_SAFE_INTEGER ? total : undefined;
};

/** A card owns one decoder at most, and owns none until the user presses Play. */
export function mountMediaCard(host: HTMLElement, options: MediaCardOptions): MediaCardHandle {
  const doc = host.ownerDocument;
  const boardControls = options.controls === 'board';
  let menu: Menu | undefined, closeTimePrompt: (() => void) | undefined;
  let timePromptEpoch = 0;
  let playRequestEpoch = 0;
  let presentationRequestEpoch = 0;
  let disposed = false, visible = true, media: HTMLMediaElement | undefined, pendingSeek = true;
  let loopA = Number.isFinite(options.state?.loopA) && options.state!.loopA! >= 0 ? options.state!.loopA : undefined;
  let loopB = loopA !== undefined && Number.isFinite(options.state?.loopB) && options.state!.loopB! >= loopA + 0.5 ? options.state!.loopB : undefined;
  let metadataReady = false, editingTime = false, subtitleWarning = '';
  let frameTask: { canvas: HTMLCanvasElement; finish: (message?: string) => void } | undefined;
  let presentationTask: { media: HTMLMediaElement } | undefined;
  const mediaTracks: HTMLTrackElement[] = [];
  let state: MediaCardState = {
    time: finiteTime(options.state?.time ?? options.initialTime ?? 0),
    rate: validRate(options.state?.rate) ? options.state.rate : 1,
    volume: Number.isFinite(options.state?.volume) ? Math.max(0, Math.min(1, options.state!.volume)) : 1,
  };
  const removers: (() => void)[] = [], mediaRemovers: (() => void)[] = [];
  const live = () => !disposed && options.alive();
  const ownsPresentation = () => !!media && (doc.pictureInPictureElement === media || doc.fullscreenElement === card || doc.fullscreenElement === media);
  const hiddenSuspends = () => options.suspendWhenHidden !== false && (!visible || doc.visibilityState === 'hidden') && !ownsPresentation();
  const listening = (target: EventTarget, name: string, listener: EventListener, bucket = removers) => {
    target.addEventListener(name, listener);
    bucket.push(() => target.removeEventListener(name, listener));
  };
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const buttonParts = new WeakMap<HTMLButtonElement, {label: HTMLSpanElement; icon: HTMLSpanElement; name: string}>();
  const paintButton = (target: HTMLButtonElement, text: string, icon: string) => {
    let parts = buttonParts.get(target);
    if (!parts) {
      const glyph = element('span', 'ts-media-card__button-icon'), label = element('span', 'ts-media-card__button-label');
      glyph.setAttribute('aria-hidden', 'true');
      target.textContent = '';
      target.append(glyph, label);
      parts = {label, icon: glyph, name: ''};
      buttonParts.set(target, parts);
    }
    if (parts.label.textContent !== text) parts.label.textContent = text;
    if (parts.name !== icon) { setIcon(parts.icon, icon); parts.name = icon; }
  };
  const card = element('div', `ts-av-player ts-av-player--${options.kind}${boardControls ? ' ts-av-player--board' : ''}`);
  card.tabIndex = 0;
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${options.kind === 'audio' ? '音频' : '视频'}播放器：${options.title}`);
  const title = element('div', 'ts-media-card__title', options.title);
  title.title = options.title;
  const stage = element('div', 'ts-media-card__stage');
  const placeholder = element('div', 'ts-media-card__placeholder');
  const playButton = element('button', 'ts-media-card__play', options.kind === 'audio' ? '播放音频' : '播放视频');
  playButton.type = 'button';
  paintButton(playButton, options.kind === 'audio' ? '播放音频' : '播放视频', 'play');
  const hint = element('span', 'ts-media-card__hint', '点击后加载媒体');
  placeholder.append(playButton, hint);
  stage.append(placeholder);
  const loading = boardControls ? element('div', 'ts-media-card__loading') : undefined;
  const loadingLabel = loading ? element('span', 'ts-media-card__loading-label') : undefined;
  if (loading && loadingLabel) {
    const icon = element('span', 'ts-media-card__loading-icon');
    icon.setAttribute('aria-hidden', 'true');
    setIcon(icon, 'loader-circle');
    loading.hidden = true;
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    loading.append(icon, loadingLabel);
    stage.append(loading);
    stage.setAttribute('aria-busy', 'false');
  }
  const setLoading = (message = '') => {
    if (!loading || !loadingLabel) return;
    loadingLabel.textContent = message;
    loading.hidden = !message;
    stage.setAttribute('aria-busy', String(!!message));
  };
  const toolbar = element('div', 'ts-media-card__toolbar');
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', '播放与摘录');
  if (loading && options.kind === 'audio') toolbar.append(loading);
  const position = element('span', 'ts-media-card__position');
  const status = element('div', 'ts-media-card__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  card.append(title, stage, toolbar, status);
  host.append(card);

  const report = (text: string) => { if (live()) status.textContent = text; };
  const readState = (): MediaCardState => ({ ...state, ...(loopA === undefined ? {} : { loopA }), ...(loopB === undefined ? {} : { loopB }) });
  const clampLoop = (duration: number) => {
    const a = loopA, b = loopB;
    if (Number.isFinite(duration) && duration >= 0) {
      if (loopA !== undefined && loopA >= duration) { loopA = undefined; loopB = undefined; }
      else if (loopB !== undefined && loopB > duration) loopB = loopA !== undefined && duration >= loopA + 0.5 ? duration : undefined;
    }
    return a !== loopA || b !== loopB;
  };
  const save = () => {
    if (!live()) return;
    try { options.onState(readState()); }
    catch { report('未能保存播放位置，请稍后重试。'); }
  };
  const snapshot = (current: HTMLMediaElement) => {
    state = {
      // Before metadata, currentTime is the media default, not the queued resume position.
      time: pendingSeek ? state.time : finiteTime(current.currentTime),
      // Resource selection may reset the native rate before metadata is ready.
      rate: metadataReady && Number.isFinite(current.playbackRate) && current.playbackRate > 0 ? current.playbackRate : state.rate,
      volume: Number.isFinite(current.volume) ? Math.min(1, Math.max(0, current.volume)) : state.volume,
    };
  };
  const invoke = (action: () => unknown, failure: string) => {
    if (!live()) return;
    try {
      void Promise.resolve(action()).catch(() => { if (live()) report(failure); });
    } catch { report(failure); }
  };
  const button = (label: string, action: () => void, accessible = label, icon = '') => {
    const result = element('button', 'ts-media-card__button', label);
    result.type = 'button';
    result.title = accessible;
    result.setAttribute('aria-label', accessible);
    if (icon) paintButton(result, label, icon);
    listening(result, 'click', () => { if (live()) action(); });
    toolbar.append(result);
    return result;
  };
  const togglePlayback = button('播放', () => { if (media && !media.paused) media.pause(); else play(); }, '播放', 'play');
  togglePlayback.className += ' ts-media-card__transport-play';
  const seekRelative = (offset: number) => {
    if (media) snapshot(media);
    seek(state.time + offset);
  };
  const backward = button('−10 秒', () => seekRelative(-10), '后退 10 秒', 'rotate-ccw');
  const forward = button('+10 秒', () => seekRelative(10), '前进 10 秒', 'rotate-cw');
  const timeInput = element('input', 'ts-media-card__seek-input');
  timeInput.type = 'text';
  timeInput.inputMode = 'decimal';
  timeInput.maxLength = 24;
  timeInput.placeholder = '00:00';
  timeInput.setAttribute('aria-label', '跳转到时间（秒或时:分:秒）');
  timeInput.title = '例如 90.5、1:30.5 或 1:02:30';
  toolbar.append(timeInput);
  const jump = () => {
    if (!live()) return;
    const time = parseTimestamp(timeInput.value);
    if (time === undefined) {
      timeInput.setAttribute('aria-invalid', 'true');
      report('请输入秒数或时间，例如 90.5、1:30.5 或 1:02:30。');
      return;
    }
    timeInput.removeAttribute('aria-invalid');
    seek(time);
    if (live()) { timeInput.value = preciseTimestamp(state.time); report(`已定位到 ${preciseTimestamp(state.time)}。`); }
  };
  const jumpButton = button('跳转', jump, '跳转', 'corner-down-left');
  listening(timeInput, 'focus', () => { editingTime = true; });
  listening(timeInput, 'blur', () => { editingTime = false; });
  listening(timeInput, 'keydown', event => {
    const key = event as KeyboardEvent;
    if (!live() || key.isComposing || key.keyCode === 229 || key.ctrlKey || key.altKey || key.metaKey) return;
    if (key.key === 'Enter') { key.preventDefault(); jump(); }
    if (key.key === 'Escape') { key.preventDefault(); timeInput.value = preciseTimestamp(state.time); timeInput.removeAttribute('aria-invalid'); }
  });
  const rateLabel = element('label', 'ts-media-card__rate');
  rateLabel.append(element('span', 'ts-media-card__sr-only', '播放速度'));
  const rate = element('select');
  let customRateOption: HTMLOptionElement | undefined;
  rate.setAttribute('aria-label', '播放速度');
  for (const value of rates) {
    const option = element('option', undefined, `${value}×`);
    option.value = String(value);
    rate.append(option);
  }
  rate.value = String(state.rate);
  rateLabel.append(rate);
  toolbar.append(rateLabel);
  const capture = button('记下此刻', () => {
    if (!media || !metadataReady || !live() || options.captureEnabled === false || frameTask) return;
    snapshot(media);
    const time = state.time;
    invoke(() => options.onCapture(time), '未能记录时间点，请重试。');
  }, '记下此刻', 'bookmark-plus');
  capture.className += ' ts-media-card__capture';
  const frameButton = options.kind === 'video' && options.onCaptureFrame
    ? button('截取画面', captureFrame, '截取当前视频画面并记录时间点', 'camera') : undefined;
  if (frameButton) frameButton.className += ' ts-media-card__frame';
  const loop = button('循环 A/B', () => {
    if (!media || !metadataReady || !live()) return;
    snapshot(media);
    if (loopB !== undefined) {
      loopA = undefined;
      loopB = undefined;
      report('已关闭片段循环。');
    } else if (loopA === undefined) {
      loopA = state.time;
      report(`循环起点 ${timestamp(loopA)}，到结束位置后再次点击。`);
    } else if (state.time < loopA + 0.5) {
      report('请在起点之后选择循环终点。');
    } else {
      loopB = state.time;
      seek(loopA);
      report(`循环 ${timestamp(loopA)} 至 ${timestamp(loopB)}，再次点击可关闭。`);
    }
    refresh();
    save();
  }, '循环 A/B', 'repeat-2');
  loop.setAttribute('aria-pressed', 'false');
  const openButton = button('打开', () => invoke(options.onOpen, '未能打开媒体，请检查文件是否仍然存在。'), '打开原始媒体', 'external-link');
  const fullscreen = options.kind === 'video' ? button('全屏', () => present('fullscreen'), '全屏', 'maximize') : undefined;
  const pip = options.kind === 'video' ? button('画中画', () => present('pip'), '画中画', 'picture-in-picture-2') : undefined;
  const group = (className: string, label: string) => {
    const result = element('div', className);
    result.setAttribute('role', 'group');
    result.setAttribute('aria-label', label);
    return result;
  };
  const transport = group('ts-media-card__transport', '播放控制');
  transport.append(togglePlayback, backward, forward, position, rateLabel);
  const captureActions = group('ts-media-card__capture-actions', '摘录操作');
  const more = group('ts-media-card__more', '更多播放选项');
  more.id = `ts-media-options-${++disclosureId}`;
  more.hidden = true;
  const moreButton = button('更多', () => {
    if (boardControls) { showBoardMenu(); return; }
    more.hidden = !more.hidden;
    moreButton.setAttribute('aria-expanded', String(!more.hidden));
    paintButton(moreButton, '更多', more.hidden ? 'chevron-down' : 'chevron-up');
  }, '更多播放选项', boardControls ? 'ellipsis' : 'chevron-down');
  moreButton.className += ' ts-media-card__more-toggle';
  moreButton.setAttribute('aria-expanded', 'false');
  if (boardControls) moreButton.setAttribute('aria-haspopup', 'menu');
  else moreButton.setAttribute('aria-controls', more.id);
  captureActions.append(capture, ...(frameButton ? [frameButton] : []), moreButton);
  const exactJump = group('ts-media-card__exact-jump', '精确跳转');
  exactJump.append(element('span', 'ts-media-card__group-label', '跳转到'), timeInput, jumpButton);
  const extraActions = group('ts-media-card__extra-actions', '循环与显示');
  extraActions.append(loop, ...(fullscreen ? [fullscreen] : []), ...(pip ? [pip] : []), openButton);
  more.append(exactJump, extraActions);
  if (boardControls) toolbar.append(captureActions);
  else toolbar.append(transport, captureActions, more);

  function showBoardMenu() {
    if (!live()) return;
    menu?.hide();
    refresh();
    const next = menu = new Menu().setUseNativeMenu(false).setParentElement(card);
    const action = (title: string, icon: string, target: HTMLButtonElement, checked?: boolean) => {
      next.addItem(item => {
        item.setTitle(title).setIcon(icon).setDisabled(target.disabled).onClick(() => { if (live() && !target.disabled) target.click(); });
        if (checked !== undefined) item.setChecked(checked);
      });
    };
    action('后退 10 秒', 'rotate-ccw', backward);
    action('前进 10 秒', 'rotate-cw', forward);
    if (options.requestTime) next.addItem(item => item.setTitle('跳转到时间…').setIcon('timer').onClick(() => {
      if (!live()) return;
      closeTimePrompt?.();
      const epoch = ++timePromptEpoch;
      if (media) snapshot(media);
      closeTimePrompt = options.requestTime!(preciseTimestamp(state.time), value => {
        if (!live() || epoch !== timePromptEpoch) return;
        const time = parseTimestamp(value);
        if (time === undefined) throw Error('请输入秒数或时间，例如 90.5、1:30.5 或 1:02:30。');
        seek(time);
        timePromptEpoch++;
      });
    }));
    if (frameButton) action('截取当前画面', 'camera', frameButton);
    next.addSeparator();
    action(loopB !== undefined ? '关闭片段循环' : loopA !== undefined ? '设为循环终点' : '设为循环起点', 'repeat-2', loop, loopB !== undefined);
    if (fullscreen) action(doc.fullscreenElement === card ? '退出全屏' : '全屏', 'maximize', fullscreen);
    if (pip) action(doc.pictureInPictureElement === media && !!media ? '退出画中画' : '画中画', 'picture-in-picture-2', pip);
    next.addSeparator();
    action('在独立页面播放', 'external-link', openButton);
    next.onHide(() => { if (menu === next) { menu = undefined; moreButton.setAttribute('aria-expanded', 'false'); } });
    moreButton.setAttribute('aria-expanded', 'true');
    const box = moreButton.getBoundingClientRect();
    next.showAtPosition({x: box.left, y: box.bottom}, doc);
  }

  const validFrame = (current = media): current is HTMLVideoElement => {
    if (!current || options.kind !== 'video' || !metadataReady || pendingSeek || current.seeking || current.error || current.readyState < 2 || !Number.isFinite(current.currentTime)) return false;
    const video = current as HTMLVideoElement;
    return Number.isFinite(video.videoWidth) && video.videoWidth > 0 && Number.isFinite(video.videoHeight) && video.videoHeight > 0;
  };
  const refresh = () => {
    const playing = !!media && !media.paused;
    paintButton(togglePlayback, playing ? '暂停' : '播放', playing ? 'pause' : 'play');
    togglePlayback.setAttribute('aria-label', playing ? '暂停' : '播放');
    togglePlayback.title = playing ? '暂停' : '播放';
    position.textContent = timestamp(state.time);
    position.setAttribute('aria-label', `当前位置 ${timestamp(state.time)}`);
    if (!editingTime && doc.activeElement !== timeInput) timeInput.value = preciseTimestamp(state.time);
    if (rates.includes(state.rate as typeof rates[number])) {
      customRateOption?.remove(); customRateOption = undefined;
    } else if (customRateOption?.value !== String(state.rate)) {
      customRateOption?.remove();
      customRateOption = element('option', undefined, `${state.rate}×`);
      customRateOption.value = String(state.rate);
      rate.append(customRateOption);
    }
    rate.value = String(state.rate);
    capture.disabled = !metadataReady || options.captureEnabled === false || !!frameTask;
    if (frameButton) {
      frameButton.disabled = options.captureEnabled === false || !!frameTask || !validFrame();
      paintButton(frameButton, frameTask ? '正在截图…' : '截取画面', 'camera');
      frameButton.setAttribute('aria-busy', String(!!frameTask));
    }
    backward.disabled = !metadataReady;
    forward.disabled = !metadataReady;
    loop.disabled = !metadataReady;
    paintButton(loop, loopB !== undefined ? '关闭循环' : loopA !== undefined ? '设为 B 点' : '循环 A/B', 'repeat-2');
    loop.setAttribute('aria-pressed', String(loopB !== undefined));
    if (fullscreen) {
      fullscreen.disabled = !metadataReady || !!presentationTask || doc.fullscreenEnabled === false || typeof card.requestFullscreen !== 'function';
      paintButton(fullscreen, doc.fullscreenElement === card ? '退出全屏' : '全屏', doc.fullscreenElement === card ? 'minimize' : 'maximize');
      fullscreen.setAttribute('aria-pressed', String(doc.fullscreenElement === card));
    }
    if (pip) {
      const video = media as HTMLVideoElement | undefined;
      pip.disabled = !!presentationTask || !validFrame() || !doc.pictureInPictureEnabled || typeof video?.requestPictureInPicture !== 'function' || video.disablePictureInPicture;
      paintButton(pip, video && doc.pictureInPictureElement === video ? '退出画中画' : '画中画', 'picture-in-picture-2');
      pip.setAttribute('aria-pressed', String(!!video && doc.pictureInPictureElement === video));
    }
  };
  const exitPresentation = (current: HTMLMediaElement, exitSharedCard = true) => {
    if (doc.pictureInPictureElement === current && typeof doc.exitPictureInPicture === 'function') {
      try { void doc.exitPictureInPicture().catch(() => undefined); } catch { /* Native teardown may already have exited. */ }
    }
    if ((exitSharedCard && doc.fullscreenElement === card || doc.fullscreenElement === current) && typeof doc.exitFullscreen === 'function') {
      try { void doc.exitFullscreen().catch(() => undefined); } catch { /* The host window may already be closed. */ }
    }
  };
  function present(mode: 'fullscreen' | 'pip') {
    const current = media as HTMLVideoElement | undefined;
    if (!live() || !current || !metadataReady || presentationTask) return;
    const isFullscreen = doc.fullscreenElement === card, isPip = doc.pictureInPictureElement === current;
    if (mode === 'fullscreen' && (doc.fullscreenEnabled === false || typeof card.requestFullscreen !== 'function' || isFullscreen && typeof doc.exitFullscreen !== 'function')) return;
    if (mode === 'pip' && (!doc.pictureInPictureEnabled || !validFrame(current) || current.disablePictureInPicture || typeof current.requestPictureInPicture !== 'function' || isPip && typeof doc.exitPictureInPicture !== 'function')) return;
    const task = { media: current }, request = ++presentationRequestEpoch;
    presentationTask = task;
    refresh();
    try {
      const requested = mode === 'fullscreen'
        ? isFullscreen ? doc.exitFullscreen() : card.requestFullscreen()
        : isPip ? doc.exitPictureInPicture() : current.requestPictureInPicture();
      void Promise.resolve(requested).then(() => {
        if (!live() || media !== current) {
          // The card survives decoder replacement: an older request cannot exit
          // a newer fullscreen session after that newer promise has settled.
          exitPresentation(current, request === presentationRequestEpoch || disposed);
          if (!live() && media === current) release();
          return;
        }
      }, () => {
        if (!live()) { if (media === current) release(); return; }
        if (media === current) report(mode === 'fullscreen' ? '此窗口暂时无法进入全屏。' : '此视频暂时无法进入画中画。');
      }).finally(() => {
        if (presentationTask === task) { presentationTask = undefined; if (live()) refresh(); }
      });
    } catch {
      presentationTask = undefined;
      if (live()) { refresh(); report(mode === 'fullscreen' ? '此窗口暂时无法进入全屏。' : '此视频暂时无法进入画中画。'); }
    }
  }
  const freeCanvas = (canvas: HTMLCanvasElement) => { canvas.width = 0; canvas.height = 0; };
  function captureFrame() {
    const current = media;
    if (!live() || options.captureEnabled === false || frameTask || !options.onCaptureFrame || !validFrame(current)) return;
    // Pause and draw in the same event turn: neither encoding nor file writes can
    // move the captured frame's timestamp to a later point in playback.
    try { current.pause(); } catch { report('暂时无法截取画面，请稍后重试。'); return; }
    if (!live() || media !== current || !validFrame(current)) return;
    const time = finiteTime(current.currentTime), canvas = element('canvas');
    const ratio = Math.min(1, 1600 / Math.max(current.videoWidth, current.videoHeight));
    canvas.width = Math.max(1, Math.round(current.videoWidth * ratio));
    canvas.height = Math.max(1, Math.round(current.videoHeight * ratio));
    const task = { canvas, finish: (_message?: string) => {} };
    let notified = false, finished = false;
    const finish = (message?: string) => {
      if (finished) return;
      finished = true;
      freeCanvas(canvas);
      const owned = frameTask === task;
      if (owned) frameTask = undefined;
      try { if (notified) options.onFrameCaptureState?.(false, time); }
      catch { message = '截图状态未能更新，请稍后重试。'; }
      if (owned && !frameTask && live()) { refresh(); if (message) report(message); }
    };
    task.finish = finish;
    frameTask = task;
    refresh();
    report('正在截取当前画面…');
    try {
      notified = true;
      options.onFrameCaptureState?.(true, time);
      if (frameTask !== task || !live() || media !== current) { finish(); return; }
      const context = canvas.getContext('2d');
      if (!context) { finish('暂时无法创建截图，请稍后重试。'); return; }
      context.drawImage(current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        freeCanvas(canvas);
        if (frameTask !== task || !live() || media !== current) {
          finish();
          if (!live() && media === current) release();
          return;
        }
        if (!blob || !blob.size) { finish('未能生成截图，请重新播放此处后再试。'); return; }
        try {
          void Promise.resolve(options.onCaptureFrame!(blob, time)).then(
            () => finish('已截取画面。'),
            () => finish('未能保存截图，请稍后重试。'),
          );
        } catch { finish('未能保存截图，请稍后重试。'); }
      }, 'image/png');
    } catch { finish('此画面暂时无法截取，请重新播放此处后再试。'); }
  }
  /** Clearing src followed by load aborts fetches and releases native decoder state. */
  const release = () => {
    playRequestEpoch++;
    setLoading();
    menu?.hide(); menu = undefined;
    timePromptEpoch++;
    closeTimePrompt?.(); closeTimePrompt = undefined;
    frameTask?.finish();
    const current = media;
    if (!current) return;
    snapshot(current);
    media = undefined;
    metadataReady = false;
    pendingSeek = true;
    for (const remove of mediaRemovers.splice(0)) remove();
    presentationTask = undefined;
    exitPresentation(current);
    for (const track of mediaTracks.splice(0)) { track.removeAttribute('src'); track.remove(); }
    try { current.pause(); } catch { /* A detached media backend may already be closed. */ }
    current.removeAttribute('src');
    try { current.load(); } catch { /* Continue removing the detached element. */ }
    current.remove();
    placeholder.hidden = false;
    refresh();
    save();
  };
  const suspend = () => {
    release();
    if (live()) hint.textContent = state.time > 0 ? `从 ${timestamp(state.time)} 继续 · 点击加载` : '点击后加载媒体';
  };
  function seek(time: number) {
    if (!live() || !Number.isFinite(time)) return;
    const current = media;
    const duration = current?.duration;
    state.time = Number.isFinite(duration) && duration! >= 0 ? Math.min(finiteTime(time), duration!) : finiteTime(time);
    if (loopA !== undefined && loopB !== undefined && (state.time < loopA || state.time >= loopB)) {
      loopA = undefined;
      loopB = undefined;
    }
    pendingSeek = true;
    if (current && metadataReady) {
      try { current.currentTime = state.time; pendingSeek = false; }
      catch { report('此媒体暂时无法跳转，请稍后重试。'); }
    }
    refresh();
    save();
  }
  const failure = (current: HTMLMediaElement, message: string) => {
    if (media !== current) return;
    if (!live()) { release(); return; }
    release();
    report(message);
  };
  const play = () => {
    if (!live() || hiddenSuspends()) return;
    let current = media;
    if (!current) {
      let source: string;
      try { source = options.src(); }
      catch { report('无法读取媒体，请检查文件或来源链接。'); return; }
      if (!live()) return;
      if (!source?.trim()) { report('媒体来源为空，请重新选择文件。'); return; }
      current = element(options.kind);
      media = current;
      const owned = current;
      let endedNotified = false;
      subtitleWarning = '';
      current.className = 'ts-media-card__media';
      current.controls = true;
      current.preload = 'none';
      current.autoplay = false;
      current.setAttribute('aria-label', options.title || (options.kind === 'audio' ? '音频' : '视频'));
      if (options.kind === 'video') current.setAttribute('playsinline', '');
      current.defaultPlaybackRate = state.rate;
      current.playbackRate = state.rate;
      current.volume = state.volume;
      const ownedLive = () => live() && media === owned;
      const ownEvent = (name: string, action: () => void) => listening(owned, name, () => {
        if (!ownedLive()) { if (!live()) release(); return; }
        action();
      }, mediaRemovers);
      if (boardControls) {
        for (const name of ['loadeddata', 'canplay', 'playing', 'seeked']) ownEvent(name, () => {
          if (owned.readyState >= 2 && !owned.seeking) setLoading();
        });
        ownEvent('waiting', () => { if (!owned.paused) setLoading('正在缓冲…'); });
        ownEvent('stalled', () => { if (!owned.paused && owned.readyState < 3) setLoading('正在缓冲…'); });
      }
      ownEvent('loadedmetadata', () => {
        owned.defaultPlaybackRate = state.rate;
        owned.playbackRate = state.rate;
        metadataReady = true;
        clampLoop(owned.duration);
        seek(state.time);
        if (ownedLive()) { report(subtitleWarning); refresh(); }
      });
      ownEvent('durationchange', () => {
        if (!metadataReady) return;
        const changed = clampLoop(owned.duration);
        if (Number.isFinite(owned.duration) && state.time > owned.duration) seek(owned.duration);
        else if (changed) { refresh(); save(); }
      });
      ownEvent('seeking', () => {
        if (boardControls && !owned.paused && owned.readyState < 3) setLoading('正在定位…');
        if (pendingSeek) { refresh(); return; }
        if (loopA !== undefined && loopB !== undefined && (owned.currentTime < loopA || owned.currentTime >= loopB)) {
          loopA = undefined;
          loopB = undefined;
          save();
        }
        refresh();
      });
      for (const name of ['loadeddata', 'canplay', 'seeked', 'resize', 'emptied']) ownEvent(name, refresh);
      ownEvent('timeupdate', () => {
        if (pendingSeek) return;
        snapshot(owned);
        if (loopA !== undefined && loopB !== undefined && state.time >= loopB) seek(loopA);
        else { refresh(); save(); }
      });
      ownEvent('ratechange', () => { snapshot(owned); if (metadataReady && owned.defaultPlaybackRate !== state.rate) owned.defaultPlaybackRate = state.rate; refresh(); save(); });
      ownEvent('volumechange', () => { snapshot(owned); save(); });
      ownEvent('pause', () => { setLoading(); snapshot(owned); refresh(); save(); });
      ownEvent('play', () => {
        if (hiddenSuspends()) { suspend(); return; }
        endedNotified = false;
        try { options.onPlay?.(); }
        catch { suspend(); report('暂时无法切换播放，请重试。'); return; }
        if (!ownedLive()) { if (media === owned) release(); return; }
        refresh();
        report(subtitleWarning);
      });
      ownEvent('ended', () => {
        setLoading();
        if (endedNotified) return;
        if (loopA !== undefined && loopB !== undefined) { seek(loopA); if (ownedLive()) play(); return; }
        endedNotified = true;
        snapshot(owned); refresh(); save();
        if (ownedLive() && options.onEnded) invoke(options.onEnded, '暂时无法继续下一项，请手动播放。');
      });
      for (const name of ['enterpictureinpicture', 'leavepictureinpicture']) ownEvent(name, () => { refresh(); if (hiddenSuspends()) suspend(); });
      ownEvent('error', () => {
        const code = owned.error?.code;
        failure(owned, code === 2 ? '媒体加载失败，请检查网络或文件后重试。'
          : code === 3 ? '此媒体无法解码，可尝试打开原文件。'
          : code === 4 ? '当前播放器不支持此媒体格式，可尝试打开原文件。'
          : '媒体无法播放，请检查来源后重试。');
      });
      stage.append(current);
      placeholder.hidden = true;
      current.src = source;
      if (ownedLive()) setLoading('正在加载媒体…');
      for (const descriptor of options.tracks ?? []) {
        const trackFailed = () => {
          if (!ownedLive()) { if (media === owned) release(); return; }
          subtitleWarning = '字幕暂时无法加载，可继续播放媒体。';
          report(subtitleWarning);
        };
        const attachTrack = (trackSource: string) => {
          if (!ownedLive()) { if (media === owned) release(); return; }
          if (typeof trackSource !== 'string' || !trackSource.trim()) return;
          const track = element('track');
          track.kind = 'subtitles';
          track.label = descriptor.label || `字幕 ${mediaTracks.length + 1}`;
          track.srclang = descriptor.language || 'und';
          track.default = mediaTracks.length === 0;
          listening(track, 'error', trackFailed, mediaRemovers);
          mediaTracks.push(track);
          owned.append(track);
          track.src = trackSource;
        };
        try {
          const result = descriptor.src();
          if (typeof result === 'string') attachTrack(result);
          else void Promise.resolve(result).then(attachTrack).catch(trackFailed);
        } catch { trackFailed(); }
        if (!ownedLive()) { if (media === owned) release(); return; }
      }
      report(subtitleWarning || (boardControls ? '' : '正在加载媒体…'));
    }
    const owned = current, request = ++playRequestEpoch;
    const rejectPlay = (error: unknown) => {
      if (media !== owned) return;
      if (!live()) { release(); return; }
      if (request !== playRequestEpoch) return;
      // Native pause aborts a pending play request without invalidating its source.
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError' && owned.paused && !owned.error) {
        setLoading();
        return;
      }
      failure(owned, '未能开始播放，请再点一次播放，或打开原文件。');
    };
    try {
      void Promise.resolve(owned.play()).then(() => {
        if (!live() || media !== owned) {
          try { owned.pause(); } catch { /* A late play resolution belongs to a released element. */ }
          if (media === owned) release();
        }
      }, rejectPlay);
    } catch (error) { rejectPlay(error); }
  };
  listening(playButton, 'click', play);
  listening(rate, 'change', () => {
    if (!live()) return;
    const value = Number(rate.value);
    if (!validRate(value)) return;
    state.rate = value;
    if (media) { media.playbackRate = value; media.defaultPlaybackRate = value; }
    refresh();
    save();
  });
  // Keep native range/select/touch handling intact while shielding the canvas.
  for (const name of ['click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'wheel', 'keyup']) {
    listening(card, name, event => event.stopPropagation());
  }
  listening(card, 'dragstart', event => { event.stopPropagation(); event.preventDefault(); });
  listening(card, 'keydown', event => {
    event.stopPropagation();
    const key = event as KeyboardEvent, target = key.target as HTMLElement | null;
    if (!live() || key.defaultPrevented || key.isComposing || key.keyCode === 229 || key.altKey || key.ctrlKey || key.metaKey) return;
    if (target?.closest('input, textarea, select, button, a, [contenteditable], audio, video')) return;
    if (key.key === ' ' || key.code === 'Space') {
      key.preventDefault();
      if (key.repeat) return;
      if (media && !media.paused) media.pause();
      else play();
    } else if (key.key === 'ArrowLeft' || key.key === 'ArrowRight') {
      key.preventDefault();
      seekRelative(key.key === 'ArrowLeft' ? -10 : 10);
    }
  });
  listening(doc, 'visibilitychange', () => { if (!live() || hiddenSuspends()) suspend(); });
  listening(doc, 'fullscreenchange', () => { if (live()) { refresh(); if (hiddenSuspends()) suspend(); } });
  // Observe this document's viewport, including Obsidian pop-out windows.
  const Observer = doc.defaultView?.IntersectionObserver;
  const observer = Observer ? new Observer(entries => {
    if (disposed) return;
    for (const entry of entries) if (entry.target === card) {
      visible = entry.isIntersecting;
      if (!live() || hiddenSuspends()) suspend();
    }
  }, { threshold: 0 }) : undefined;
  observer?.observe(card);
  refresh();
  return {
    seek,
    play,
    getState() { if (media && live()) snapshot(media); return readState(); },
    pause: suspend,
    dispose() {
      if (disposed) return;
      release();
      disposed = true;
      observer?.disconnect();
      for (const remove of removers.splice(0)) remove();
      card.remove();
    },
  };
}
