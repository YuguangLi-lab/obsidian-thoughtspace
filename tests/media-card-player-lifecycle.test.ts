import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import type {MediaCardOptions,MediaCardState} from '../src/media-card-player';

class FakeMenuItem {
  title = ''; icon: string | null = null; disabled = false; checked: boolean | null = null;
  callback?: () => unknown;
  setTitle(value: string) { this.title = value; return this; }
  setIcon(value: string | null) { this.icon = value; return this; }
  setDisabled(value: boolean) { this.disabled = value; return this; }
  setChecked(value: boolean | null) { this.checked = value; return this; }
  onClick(callback: () => unknown) { this.callback = callback; return this; }
}
class FakeMenu {
  static instances: FakeMenu[] = [];
  items: FakeMenuItem[] = []; native = true; parent?: FakeElement; doc?: FakeDocument;
  position?: { x: number; y: number }; hidden = true; hideCalls = 0;
  private hideCallback?: () => unknown;
  constructor() { FakeMenu.instances.push(this); }
  setUseNativeMenu(value: boolean) { this.native = value; return this; }
  setParentElement(value: FakeElement) { this.parent = value; return this; }
  addItem(build: (item: FakeMenuItem) => unknown) { const item = new FakeMenuItem(); build(item); this.items.push(item); return this; }
  addSeparator() { return this; }
  onHide(callback: () => unknown) { this.hideCallback = callback; }
  showAtPosition(position: { x: number; y: number }, doc?: FakeDocument) { this.position = position; this.doc = doc; this.hidden = false; return this; }
  hide() { this.hideCalls++; if (!this.hidden) { this.hidden = true; this.hideCallback?.(); } }
  item(title: string) { const item = this.items.find(candidate => candidate.title === title); assert.ok(item, `Missing menu item: ${title}`); return item; }
  choose(title: string) { const item = this.item(title); if (!item.disabled) { this.hide(); return item.callback?.(); } }
}

const compiled=transformSync(readFileSync('src/media-card-player.ts','utf8'),{loader:'ts',format:'cjs'}).code;
const playerModule={exports:{}};
new Function('require','module','exports',compiled)((name:string)=>{
  if(name==='obsidian')return{Menu:FakeMenu,setIcon:(element:{setAttribute:(name:string,value:string)=>void},icon:string)=>element.setAttribute('data-icon',icon)};
  throw Error('Unexpected player dependency: '+name);
},playerModule,playerModule.exports);
const {mountMediaCard}=playerModule.exports as typeof import('../src/media-card-player');

type Listener = (event: FakeEvent) => void;
interface FakeEvent {
  target?: FakeElement;
  defaultPrevented: boolean;
  propagationStopped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
  key?: string;
  code?: string;
  isComposing?: boolean;
  keyCode?: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
}
class Events {
  listeners = new Map<string, Set<Listener>>();
  addEventListener(name: string, listener: Listener) {
    const group = this.listeners.get(name) ?? new Set<Listener>();
    group.add(listener);
    this.listeners.set(name, group);
  }
  removeEventListener(name: string, listener: Listener) { this.listeners.get(name)?.delete(listener); }
  emit(name: string, values: Partial<FakeEvent> = {}) {
    const event: FakeEvent = {
      defaultPrevented: false, propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
      ...values,
    };
    for (const listener of [...this.listeners.get(name) ?? []]) listener(event);
    return event;
  }
  listenerCount() { return [...this.listeners.values()].reduce((count, list) => count + list.size, 0); }
}
class FakeElement extends Events {
  className = ''; id = ''; title = ''; type = ''; value = ''; hidden = false; disabled = false; tabIndex = -1;
  ownText = ''; children: FakeElement[] = []; parent?: FakeElement;
  attributes = new Map<string, string>();
  bounds = { x: 42, y: 76, left: 42, top: 76, right: 138, bottom: 108, width: 96, height: 32 };
  requestFullscreen?: () => Promise<void>;
  constructor(public ownerDocument: FakeDocument, public tagName = 'div') { super(); }
  get textContent(): string { return this.ownText + this.children.map(child => child.textContent).join(''); }
  set textContent(value: string) { this.ownText = value; this.children = []; }
  append(...children: FakeElement[]) { for (const child of children) { child.remove(); child.parent = this; this.children.push(child); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = undefined; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  click() { if (!this.disabled) this.emit('click'); }
  getBoundingClientRect() { return this.bounds; }
  closest(selector: string): FakeElement | null {
    if (selector.split(',').map(item => item.trim()).some(item => item === this.tagName || item === '[contenteditable]' && this.attributes.has('contenteditable'))) return this;
    return this.parent?.closest(selector) ?? null;
  }
  all(): FakeElement[] { return [this, ...this.children.flatMap(child => child.all())]; }
  override emit(name: string, values: Partial<FakeEvent> = {}) {
    if (name === 'focus') this.ownerDocument.activeElement = this;
    if (name === 'blur' && this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = undefined;
    return super.emit(name, { target: this, ...values });
  }
}
class FakeMedia extends FakeElement {
  currentTime = 0; duration = NaN; readyState = 0; playbackRate = 1; defaultPlaybackRate = 1; volume = 1;
  videoWidth = 0; videoHeight = 0; seeking = false;
  controls = false; preload = ''; autoplay = true; paused = true; src = '';
  playCalls = 0; pauseCalls = 0; loadCalls = 0; error?: { code: number };
  playResult: Promise<void> = Promise.resolve();
  disablePictureInPicture = false;
  requestPictureInPicture?: () => Promise<object>;
  play() { this.playCalls++; this.paused = false; this.emit('play'); return this.playResult; }
  pause() { this.pauseCalls++; this.paused = true; this.emit('pause'); }
  load() { this.loadCalls++; }
  override removeAttribute(name: string) { super.removeAttribute(name); if (name === 'src') this.src = ''; }
  metadata(duration = 120) { this.duration = duration; this.readyState = 1; this.emit('loadedmetadata'); }
  frame(width = 1920, height = 1080) { this.videoWidth = width; this.videoHeight = height; this.readyState = 2; this.emit('loadeddata'); }
}
class FakeTrack extends FakeElement {
  src = ''; label = ''; srclang = ''; kind = ''; default = false;
  override removeAttribute(name: string) { super.removeAttribute(name); if (name === 'src') this.src = ''; }
}
class FakeCanvas extends FakeElement {
  width = 0; height = 0; encodedType = ''; encodeCalls = 0;
  drawing?: { width: number; height: number; time: number };
  callback?: (blob: Blob | null) => void;
  getContext() {
    if (this.ownerDocument.missingContext) return null;
    return { drawImage: (media: FakeMedia, _x: number, _y: number, width: number, height: number) => {
      if (this.ownerDocument.drawError) throw Error('private drawing source');
      this.drawing = { width, height, time: media.currentTime };
    } };
  }
  toBlob(callback: (blob: Blob | null) => void, type: string) {
    if (this.ownerDocument.encodeError) throw Error('private encoding source');
    this.encodeCalls++; this.encodedType = type; this.callback = callback;
    if (this.ownerDocument.autoEncode) queueMicrotask(() => callback(new Blob(['png'], { type })));
  }
}
class FakeObserver {
  target?: FakeElement; disconnected = false;
  constructor(private callback: (entries: { target: FakeElement; isIntersecting: boolean }[]) => void) { }
  observe(target: FakeElement) { this.target = target; }
  disconnect() { this.disconnected = true; }
  visibility(visible: boolean) { if (this.target) this.callback([{ target: this.target, isIntersecting: visible }]); }
}
class FakeDocument extends Events {
  visibilityState = 'visible'; elements: FakeElement[] = []; observers: FakeObserver[] = [];
  autoEncode = true; missingContext = false; drawError = false; encodeError = false;
  activeElement?: FakeElement;
  fullscreenEnabled = false; pictureInPictureEnabled = false;
  fullscreenElement?: FakeElement; pictureInPictureElement?: FakeMedia;
  fullscreenExits = 0; pipExits = 0;
  exitFullscreen = async () => { this.fullscreenExits++; this.fullscreenElement = undefined; this.emit('fullscreenchange'); };
  exitPictureInPicture = async () => { this.pipExits++; const previous = this.pictureInPictureElement; this.pictureInPictureElement = undefined; previous?.emit('leavepictureinpicture'); };
  defaultView = { IntersectionObserver: class extends FakeObserver {
    constructor(callback: ConstructorParameters<typeof FakeObserver>[0]) { super(callback); activeDocument.observers.push(this); }
  } };
  createElement(tagName: string) {
    const node = tagName === 'audio' || tagName === 'video' ? new FakeMedia(this, tagName) : tagName === 'canvas' ? new FakeCanvas(this, tagName) : tagName === 'track' ? new FakeTrack(this, tagName) : new FakeElement(this, tagName);
    this.elements.push(node);
    return node;
  }
  medias() { return this.elements.filter((node): node is FakeMedia => node instanceof FakeMedia); }
  canvases() { return this.elements.filter((node): node is FakeCanvas => node instanceof FakeCanvas); }
  tracks() { return this.elements.filter((node): node is FakeTrack => node instanceof FakeTrack); }
}
let activeDocument: FakeDocument;
function fixture(extra: Partial<MediaCardOptions> = {}) {
  const doc = activeDocument = new FakeDocument(), host = new FakeElement(doc);
  let live = true, resolutions = 0, opens = 0;
  const states: MediaCardState[] = [], captures: number[] = [], frames: { blob: Blob; time: number }[] = [];
  const handle = mountMediaCard(host as unknown as HTMLElement, {
    kind: 'video', title: '课程标题', src: () => { resolutions++; return 'app://private/file.mp4'; },
    alive: () => live, onState: state => states.push(state), onCapture: time => captures.push(time),
    onOpen: () => { opens++; }, onCaptureFrame: (blob, time) => frames.push({ blob, time }), ...extra,
  });
  const card = host.children[0];
  const find = (className: string) => card.all().find(node => node.className.split(' ').includes(className))!;
  const button = (text: string) => card.all().find(node => node.tagName === 'button' && node.textContent === text)!;
  const click = (text: string) => button(text).emit('click');
  const play = () => { click(extra.kind === 'audio' ? '播放音频' : '播放视频'); return doc.medias().at(-1)!; };
  const menu = () => { click('更多'); const current = FakeMenu.instances.at(-1); assert.ok(current); assert.equal(current.parent, card); return current; };
  return { doc, host, card, find, button, click, play, menu, handle, states, captures, frames,
    setLive: (value: boolean) => { live = value; }, stats: () => ({ resolutions, opens }) };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred() { let resolve!: () => void, reject!: (reason: unknown) => void; const promise = new Promise<void>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function timeRequests() {
  const requests: { current: string; submit: (value: string) => void; closeCalls: number }[] = [];
  return { requests, requestTime(current: string, submit: (value: string) => void) {
    const request = { current, submit, closeCalls: 0 }; requests.push(request);
    return () => { request.closeCalls++; };
  } };
}

for (const kind of ['audio', 'video'] as const) test(`${kind} creates no media element and resolves no resource until explicit playback`, () => {
  const f = fixture({ kind, initialTime: 12 });
  assert.equal(f.doc.medias().length, 0);
  assert.equal(f.stats().resolutions, 0);
  assert.equal(f.button('记下此刻').disabled, true);
  f.handle.seek(25);
  f.click('打开');
  const select = f.card.all().find(node => node.tagName === 'select')!;
  select.value = '1.5'; select.emit('change');
  assert.equal(f.doc.medias().length, 0);
  assert.equal(f.stats().resolutions, 0);
  const media = f.play();
  assert.equal(media.tagName, kind);
  assert.equal(media.preload, 'none');
  assert.equal(media.autoplay, false);
  assert.equal(media.controls, true);
  assert.equal(media.playCalls, 1);
  assert.equal(f.stats().resolutions, 1);
  media.metadata();
  assert.equal(media.currentTime, 25);
  assert.equal(media.playbackRate, 1.5);
  f.handle.dispose();
});

for (const kind of ['audio', 'video'] as const) test(`board ${kind} keeps loading visible until playable data arrives, independently of ordinary feedback`, () => {
  let status: FakeElement | undefined;
  const statusAtPlay: string[] = [];
  const f = fixture({ kind, controls: 'board', onPlay: () => statusAtPlay.push(status!.textContent) });
  const loading = f.find('ts-media-card__loading'), stage = f.find('ts-media-card__stage');
  status = f.find('ts-media-card__status');
  assert.equal(loading.hidden, true); assert.equal(stage.attributes.get('aria-busy'), 'false');
  assert.equal(loading.parent, kind === 'audio' ? f.find('ts-media-card__toolbar') : stage); assert.equal(loading.attributes.get('role'), 'status'); assert.equal(loading.attributes.get('aria-live'), 'polite');
  assert.equal(f.find('ts-media-card__loading-icon').attributes.get('aria-hidden'), 'true');
  assert.equal(f.find('ts-media-card__loading-icon').attributes.get('data-icon'), 'loader-circle');
  assert.equal(f.doc.medias().length, 0); assert.equal(f.stats().resolutions, 0);
  const media = f.play();
  assert.equal(loading.hidden, false); assert.equal(loading.textContent, '正在加载媒体…'); assert.equal(stage.attributes.get('aria-busy'), 'true');
  assert.deepEqual(statusAtPlay, ['']); assert.equal(status.textContent, '');
  media.metadata();
  for (const name of ['play', 'loadeddata', 'canplay', 'playing']) media.emit(name);
  assert.equal(loading.hidden, false, 'metadata and premature ready events do not finish loading');
  status.textContent = '字幕暂时无法加载，可继续播放媒体。';
  media.readyState = 2; media.emit('loadeddata');
  assert.equal(loading.hidden, true); assert.equal(stage.attributes.get('aria-busy'), 'false');
  assert.equal(status.textContent, '字幕暂时无法加载，可继续播放媒体。');
  assert.equal(f.doc.medias().length, 1); assert.equal(f.stats().resolutions, 1); f.handle.dispose();
});

test('board buffering and seek indicators follow active playback and preserve action feedback', () => {
  const f = fixture({ controls: 'board' }), media = f.play(), loading = f.find('ts-media-card__loading');
  const stage = f.find('ts-media-card__stage'), status = f.find('ts-media-card__status');
  media.metadata(); media.frame(); status.textContent = '已截取画面。';
  media.emit('waiting'); assert.equal(loading.hidden, false); assert.equal(loading.textContent, '正在缓冲…');
  assert.equal(status.textContent, '已截取画面。');
  media.readyState = 3; media.emit('playing'); assert.equal(loading.hidden, true);
  media.emit('stalled'); assert.equal(loading.hidden, true, 'a stalled download with playable data is not buffering');
  media.readyState = 1; media.emit('stalled'); assert.equal(loading.textContent, '正在缓冲…'); assert.equal(loading.hidden, false);
  media.seeking = true; media.emit('seeking'); assert.equal(loading.textContent, '正在定位…');
  media.readyState = 3; media.emit('canplay'); assert.equal(loading.hidden, false, 'a seek still in progress cannot clear the indicator');
  media.seeking = false; media.emit('canplay'); assert.equal(loading.hidden, true); assert.equal(stage.attributes.get('aria-busy'), 'false');
  media.emit('seeking'); assert.equal(loading.hidden, true, 'a seek with playable data needs no loading overlay');
  assert.equal(status.textContent, '已截取画面。'); f.handle.dispose();
});

test('board pause clears loading and paused media cannot reactivate buffering or seeking indicators', () => {
  const f = fixture({ controls: 'board' }), media = f.play(), loading = f.find('ts-media-card__loading');
  media.pause();
  assert.equal(loading.hidden, true); assert.equal(f.find('ts-media-card__stage').attributes.get('aria-busy'), 'false');
  media.readyState = 0;
  for (const name of ['waiting', 'stalled', 'seeking']) media.emit(name);
  assert.equal(loading.hidden, true);
  media.play(); media.emit('waiting'); assert.equal(loading.hidden, false); f.handle.dispose();
});

test('board completed seeking clears its loading indicator when the decoded frame is ready', () => {
  const f = fixture({ controls: 'board' }), media = f.play(), loading = f.find('ts-media-card__loading');
  media.metadata(); media.frame();
  media.readyState = 1; media.seeking = true; media.emit('seeking');
  assert.equal(loading.hidden, false);
  media.readyState = 2; media.emit('loadeddata');
  assert.equal(loading.hidden, false, 'a decoded frame does not finish an in-progress seek');
  media.seeking = false; media.emit('seeked');
  assert.equal(loading.hidden, true);
  assert.equal(f.find('ts-media-card__stage').attributes.get('aria-busy'), 'false');
  f.handle.dispose();
});

test('board playback ending while buffering clears the indicator', () => {
  const f = fixture({ controls: 'board' }), media = f.play(), loading = f.find('ts-media-card__loading');
  media.metadata(); media.frame(); media.emit('waiting');
  assert.equal(loading.hidden, false);
  media.currentTime = media.duration; media.paused = true; media.emit('ended');
  assert.equal(loading.hidden, true); assert.equal(f.find('ts-media-card__stage').attributes.get('aria-busy'), 'false');
  for (const name of ['waiting', 'stalled', 'seeking']) media.emit(name);
  assert.equal(loading.hidden, true); f.handle.dispose();
});

test('released board media cannot restore or clear another decoder loading indicator', () => {
  const f = fixture({ controls: 'board' }), first = f.play(), loading = f.find('ts-media-card__loading');
  f.handle.pause(); assert.equal(loading.hidden, true); assert.equal(first.listenerCount(), 0);
  first.paused = false;
  for (const name of ['waiting', 'stalled', 'seeking']) first.emit(name);
  assert.equal(loading.hidden, true);
  const second = f.play(); assert.equal(loading.hidden, false); assert.notEqual(first, second);
  first.readyState = 4;
  for (const name of ['loadeddata', 'canplay', 'playing', 'pause']) first.emit(name);
  assert.equal(loading.hidden, false); assert.equal(loading.textContent, '正在加载媒体…');
  f.handle.dispose(); assert.equal(loading.hidden, true); assert.equal(f.find('ts-media-card__stage').attributes.get('aria-busy'), 'false');
  second.emit('waiting'); assert.equal(loading.hidden, true); assert.equal(second.listenerCount(), 0);
});

test('board source and playback failures leave only the ordinary error feedback', async () => {
  const missing = fixture({ controls: 'board', src: () => { throw Error('missing source'); } });
  missing.click('播放视频');
  assert.equal(missing.find('ts-media-card__loading').hidden, true); assert.equal(missing.doc.medias().length, 0);
  assert.match(missing.find('ts-media-card__status').textContent, /无法读取媒体/); missing.handle.dispose();
  const f = fixture({ controls: 'board' }), media = f.play();
  media.error = { code: 3 }; media.emit('error');
  assert.equal(f.find('ts-media-card__loading').hidden, true); assert.equal(f.find('ts-media-card__stage').attributes.get('aria-busy'), 'false');
  assert.match(f.find('ts-media-card__status').textContent, /无法解码/); media.emit('waiting');
  assert.equal(f.find('ts-media-card__loading').hidden, true); await tick(); f.handle.dispose();
});

test('full players retain their existing status surface without board loading state', () => {
  const f = fixture({ controls: 'full' }), media = f.play(), status = f.find('ts-media-card__status');
  assert.equal(f.find('ts-media-card__loading'), undefined); assert.equal(f.find('ts-media-card__stage').attributes.has('aria-busy'), false);
  status.textContent = '已截取画面。';
  for (const name of ['waiting', 'stalled', 'seeking', 'playing', 'canplay', 'loadeddata']) media.emit(name);
  assert.equal(status.textContent, '已截取画面。');
  assert.equal(f.find('ts-media-card__loading'), undefined); assert.equal(media.controls, true); f.handle.dispose();
});

test('common playback and capture actions stay outside the initially collapsed advanced options', () => {
  const f = fixture(), transport = f.find('ts-media-card__transport'), capture = f.find('ts-media-card__capture-actions'), more = f.find('ts-media-card__more');
  assert.equal(more.hidden, true); assert.equal(transport.attributes.get('aria-label'), '播放控制'); assert.equal(capture.attributes.get('aria-label'), '摘录操作');
  for (const label of ['播放', '−10 秒', '+10 秒']) assert.ok(transport.all().includes(f.button(label)));
  for (const label of ['记下此刻', '截取画面', '更多']) assert.ok(capture.all().includes(f.button(label)));
  for (const label of ['跳转', '循环 A/B', '全屏', '画中画', '打开']) assert.ok(more.all().includes(f.button(label)));
  assert.equal(f.button('更多').attributes.get('aria-label'), '更多播放选项'); assert.equal(f.button('更多').attributes.get('aria-controls'), more.id);
  assert.equal(f.button('−10 秒').attributes.get('aria-label'), '后退 10 秒'); assert.equal(f.button('截取画面').attributes.get('aria-label'), '截取当前视频画面并记录时间点');
  assert.equal(f.button('打开').attributes.get('aria-label'), '打开原始媒体'); f.handle.dispose();
});

test('expanding advanced options is resource-free and gives every mounted player an independent disclosure', () => {
  const a = fixture(), b = fixture(), toggle = a.button('更多'), more = a.find('ts-media-card__more');
  assert.notEqual(more.id, b.find('ts-media-card__more').id);
  a.click('更多'); assert.equal(more.hidden, false); assert.equal(toggle.attributes.get('aria-expanded'), 'true');
  assert.equal(b.find('ts-media-card__more').hidden, true); assert.equal(a.doc.medias().length, 0); assert.equal(a.stats().resolutions, 0);
  a.click('更多'); assert.equal(more.hidden, true); assert.equal(toggle.attributes.get('aria-expanded'), 'false');
  assert.equal(a.doc.medias().length, 0); a.handle.dispose(); toggle.emit('click'); assert.equal(more.hidden, true); b.handle.dispose();
});

test('advanced disclosure keeps the decoder, position and uncommitted precise-jump input intact', () => {
  const f = fixture(), media = f.play(); media.metadata(); media.currentTime = 24.25; media.emit('timeupdate');
  f.click('更多'); const input = f.find('ts-media-card__seek-input'); input.value = '1:23.456'; input.emit('focus');
  const source = media.src, listeners = media.listenerCount(), plays = media.playCalls, loads = media.loadCalls;
  f.click('更多'); f.click('更多'); media.emit('timeupdate');
  assert.equal(input.value, '1:23.456'); assert.equal(f.doc.medias().length, 1); assert.equal(f.doc.medias()[0], media);
  assert.equal(media.src, source); assert.equal(media.currentTime, 24.25); assert.equal(media.listenerCount(), listeners); assert.equal(media.playCalls, plays); assert.equal(media.loadCalls, loads);
  const event = f.card.emit('keydown', { key: ' ', target: f.button('更多') }); assert.equal(event.propagationStopped, true); assert.equal(event.defaultPrevented, false);
  for (const name of ['pointerdown', 'touchstart', 'touchmove', 'click']) { const pointer = f.card.emit(name, { target: input }); assert.equal(pointer.propagationStopped, true); assert.equal(pointer.defaultPrevented, false); }
  f.handle.dispose();
});

for (const kind of ['audio', 'video'] as const) test(`board ${kind} mounts one capture row and leaves playback controls to native media`, () => {
  const f = fixture({ kind, controls: 'board' }), toolbar = f.find('ts-media-card__toolbar'), capture = f.find('ts-media-card__capture-actions');
  assert.deepEqual(toolbar.children, kind === 'audio' ? [f.find('ts-media-card__loading'), capture] : [capture]);
  assert.deepEqual(capture.children.map(child => child.textContent), kind === 'video' ? ['记下此刻', '截取画面', '更多'] : ['记下此刻', '更多']);
  for (const name of ['ts-media-card__transport', 'ts-media-card__more', 'ts-media-card__seek-input', 'ts-media-card__rate', 'ts-media-card__position']) assert.equal(f.find(name), undefined, name);
  assert.equal(f.card.all().filter(node => node.tagName === 'select' || node.tagName === 'input').length, 0);
  assert.equal(f.button('播放'), undefined); assert.equal(f.button('−10 秒'), undefined); assert.equal(f.button('+10 秒'), undefined);
  assert.equal(f.button('记下此刻').disabled, true); assert.equal(f.doc.medias().length, 0); assert.equal(f.stats().resolutions, 0);
  const menu = f.menu();
  if (kind === 'audio') for (const title of ['全屏', '画中画']) assert.equal(menu.items.some(item => item.title === title), false);
  menu.hide(); f.handle.seek(17.25);
  assert.equal(f.doc.medias().length, 0); assert.equal(f.stats().resolutions, 0);
  const media = f.play(); media.metadata();
  assert.equal(media.controls, true); assert.equal(media.preload, 'none'); assert.equal(media.autoplay, false);
  assert.equal(media.currentTime, 17.25); assert.equal(media.playCalls, 1); assert.equal(f.stats().resolutions, 1);
  f.handle.dispose();
});

test('board menu anchors keyboard clicks to its button and owner document, then reflects native dismissal', () => {
  const f = fixture({ controls: 'board' }), toggle = f.button('更多');
  toggle.bounds = { x: 231, y: 417, left: 231, top: 417, right: 307, bottom: 451, width: 76, height: 34 };
  assert.equal(toggle.attributes.get('aria-haspopup'), 'menu'); assert.equal(toggle.attributes.get('aria-expanded'), 'false');
  toggle.click(); const menu = FakeMenu.instances.at(-1)!;
  assert.equal(menu.native, false); assert.equal(menu.parent, f.card); assert.equal(menu.doc, f.doc);
  assert.equal(menu.position?.x, 231); assert.equal(menu.position?.y, 451); assert.equal(toggle.attributes.get('aria-expanded'), 'true');
  assert.equal(f.doc.medias().length, 0); assert.equal(f.stats().resolutions, 0);
  menu.hide(); assert.equal(toggle.attributes.get('aria-expanded'), 'false');
  const next = f.menu(); assert.notEqual(next, menu); assert.equal(toggle.attributes.get('aria-expanded'), 'true');
  f.handle.dispose(); assert.equal(next.hidden, true); assert.equal(toggle.attributes.get('aria-expanded'), 'false');
});

test('board menu disables unavailable playback actions while opening an independent player without loading', () => {
  const f = fixture({ controls: 'board' }), menu = f.menu();
  for (const title of ['后退 10 秒', '前进 10 秒', '设为循环起点', '全屏', '画中画']) {
    assert.equal(menu.item(title).disabled, true, title); menu.choose(title);
  }
  assert.equal(menu.items.some(item => item.title === '跳转到时间…'), false);
  assert.equal(menu.item('在独立页面播放').disabled, false); menu.choose('在独立页面播放');
  assert.deepEqual(f.stats(), { resolutions: 0, opens: 1 }); assert.equal(f.doc.medias().length, 0);
  f.handle.dispose();
});

test('board menu reuses seek, capture and A/B loop behavior without duplicating transport controls', () => {
  const f = fixture({ controls: 'board' }), media = f.play(); media.metadata(); media.currentTime = 27.125; media.emit('timeupdate');
  let menu = f.menu(); assert.equal(menu.item('后退 10 秒').disabled, false); menu.choose('后退 10 秒'); assert.equal(media.currentTime, 17.125);
  f.menu().choose('前进 10 秒'); assert.equal(media.currentTime, 27.125);
  f.click('记下此刻'); assert.deepEqual(f.captures, [27.125]);
  f.menu().choose('设为循环起点'); assert.equal(f.handle.getState().loopA, 27.125);
  media.currentTime = 32.75; media.emit('timeupdate'); menu = f.menu(); menu.choose('设为循环终点');
  assert.equal(media.currentTime, 27.125); assert.equal(f.handle.getState().loopB, 32.75);
  menu = f.menu(); assert.equal(menu.item('关闭片段循环').checked, true); menu.choose('关闭片段循环');
  assert.equal(f.handle.getState().loopA, undefined); assert.equal(f.handle.getState().loopB, undefined);
  assert.equal(f.doc.medias().length, 1); assert.equal(media.loadCalls, 0); f.handle.dispose();
});

test('board screenshot menu shares decoded-frame, in-flight and teardown guards with the capture button', async () => {
  const title = '截取当前画面';
  for (const options of [{ kind: 'audio' as const }, { onCaptureFrame: undefined }]) {
    const absent = fixture({ controls: 'board', ...options });
    assert.equal(absent.menu().items.some(item => item.title === title), false); absent.handle.dispose();
  }
  const f = fixture({ controls: 'board' }); f.doc.autoEncode = false;
  let menu = f.menu(), action = menu.item(title);
  assert.equal(action.icon, 'camera'); assert.equal(action.disabled, true);
  action.callback!(); assert.equal(f.doc.canvases().length, 0); assert.equal(f.stats().resolutions, 0);
  const media = f.play(); media.metadata();
  assert.equal(f.menu().item(title).disabled, true);
  media.frame(); media.currentTime = 26.234;
  menu = f.menu(); action = menu.item(title); assert.equal(action.disabled, false);
  media.seeking = true; media.emit('seeking'); action.callback!();
  assert.equal(f.doc.canvases().length, 0);
  media.seeking = false; media.emit('seeked'); menu.choose(title);
  assert.equal(media.paused, true); assert.equal(f.doc.canvases().length, 1);
  const canvas = f.doc.canvases()[0];
  assert.deepEqual(canvas.drawing, { width: 1600, height: 900, time: 26.234 });
  assert.equal(canvas.encodedType, 'image/png');
  action.callback!(); assert.equal(f.menu().item(title).disabled, true);
  assert.equal(f.doc.canvases().length, 1);
  media.currentTime = 80; canvas.callback!(new Blob(['png'], { type: 'image/png' })); await tick();
  assert.equal(f.frames.length, 1); assert.equal(f.frames[0].time, 26.234); assert.equal(f.frames[0].blob.type, 'image/png');
  assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
  menu = f.menu(); action = menu.item(title); assert.equal(action.disabled, false); menu.choose(title);
  const cancelled = f.doc.canvases()[1]; f.handle.pause();
  action.callback!(); cancelled.callback!(new Blob(['late'], { type: 'image/png' })); await tick();
  assert.equal(f.doc.canvases().length, 2); assert.equal(f.frames.length, 1);
  assert.equal(cancelled.width, 0); assert.equal(cancelled.height, 0);
  f.handle.dispose(); action.callback!(); assert.equal(f.doc.canvases().length, 2);
});

test('board presentation menu follows native fullscreen and PiP capabilities and rechecks disabled actions', async () => {
  const f = fixture({ controls: 'board' }); f.doc.fullscreenEnabled = true; f.doc.pictureInPictureEnabled = true;
  let fullscreenRequests = 0, pipRequests = 0;
  f.card.requestFullscreen = async () => { fullscreenRequests++; f.doc.fullscreenElement = f.card; f.doc.emit('fullscreenchange'); };
  const media = f.play();
  media.requestPictureInPicture = async () => { pipRequests++; f.doc.pictureInPictureElement = media; media.emit('enterpictureinpicture'); return {}; };
  media.metadata();
  let menu = f.menu(); assert.equal(menu.item('全屏').disabled, false); assert.equal(menu.item('画中画').disabled, true); menu.choose('全屏');
  assert.equal(fullscreenRequests, 1); menu = f.menu(); assert.equal(menu.item('退出全屏').disabled, true);
  menu.item('退出全屏').callback!(); assert.equal(f.doc.fullscreenExits, 0); menu.hide(); await tick();
  f.menu().choose('退出全屏'); await tick(); assert.equal(f.doc.fullscreenElement, undefined); assert.equal(f.doc.fullscreenExits, 1);
  media.frame(); menu = f.menu(); const pip = menu.item('画中画'); assert.equal(pip.disabled, false);
  media.seeking = true; media.emit('seeking'); pip.callback!(); assert.equal(pipRequests, 0); menu.hide();
  media.seeking = false; media.emit('seeked'); f.menu().choose('画中画'); await tick();
  assert.equal(pipRequests, 1); assert.equal(f.doc.pictureInPictureElement, media);
  f.menu().choose('退出画中画'); await tick(); assert.equal(f.doc.pictureInPictureElement, undefined); assert.equal(f.doc.pipExits, 1);
  assert.equal(f.doc.medias().length, 1); assert.equal(media.loadCalls, 0); f.handle.dispose();
});

test('board native rate changes persist across source release and explicit replay', () => {
  const f = fixture({ controls: 'board', state: { time: 8.125, rate: 1.5, volume: .4 } }), first = f.play();
  first.playbackRate = 1; first.emit('ratechange'); assert.equal(f.handle.getState().rate, 1.5);
  first.metadata(); assert.equal(first.playbackRate, 1.5);
  first.currentTime = 12.75; first.playbackRate = 1.75; first.emit('ratechange');
  assert.equal(f.handle.getState().rate, 1.75); assert.equal(first.defaultPlaybackRate, 1.75); assert.equal(f.states.at(-1)?.rate, 1.75);
  f.handle.pause(); const second = f.play(); second.metadata();
  assert.equal(second.playbackRate, 1.75); assert.equal(second.currentTime, 12.75); assert.equal(second.volume, .4);
  assert.equal(f.card.all().some(node => node.tagName === 'select'), false); f.handle.dispose();
});

for (const rate of [.25, 1.75, 2.5, 4]) test(`native ${rate}x playback survives remount and handoff from board to full controls`, () => {
  const first = fixture({ controls: 'board' }), media = first.play(); media.metadata();
  media.currentTime = 26.125; media.playbackRate = rate; media.emit('ratechange'); first.handle.dispose();
  const saved = first.states.at(-1)!; assert.equal(saved.rate, rate);
  for (const controls of ['board', 'full'] as const) {
    const next = fixture({ controls, state: saved });
    assert.equal(next.handle.getState().rate, rate); assert.equal(next.doc.medias().length, 0); assert.equal(next.stats().resolutions, 0);
    if (controls === 'full') {
      const select = next.card.all().find(node => node.tagName === 'select')!;
      assert.equal(select.value, String(rate)); assert.equal(select.children.filter(option => option.value === String(rate)).length, 1);
    }
    const resumed = next.play(); assert.equal(resumed.defaultPlaybackRate, rate); resumed.metadata();
    assert.equal(resumed.playbackRate, rate); assert.equal(resumed.currentTime, 26.125); next.handle.dispose();
  }
});

test('invalid persisted playback rates fall back to normal speed before loading any media', () => {
  for (const rate of [0, NaN, 5, -.5, Infinity, .24, 4.01]) for (const controls of ['board', 'full'] as const) {
    const f = fixture({ controls, state: { time: 7, rate, volume: .5 } });
    assert.equal(f.handle.getState().rate, 1, `${controls}: ${String(rate)}`); assert.equal(f.doc.medias().length, 0);
    if (controls === 'full') assert.equal(f.card.all().find(node => node.tagName === 'select')!.value, '1');
    const media = f.play(); media.metadata(); assert.equal(media.playbackRate, 1); assert.equal(media.defaultPlaybackRate, 1); f.handle.dispose();
  }
});

test('full speed select retains one current custom rate and removes it when a preset is selected', () => {
  const f = fixture({ controls: 'full', state: { time: 0, rate: 2.5, volume: 1 } });
  const select = f.card.all().find(node => node.tagName === 'select')!, values = () => select.children.map(option => option.value);
  const presets = ['0.25', '0.5', '0.75', '1', '1.25', '1.5', '1.75', '2'];
  assert.equal(select.value, '2.5'); assert.deepEqual(values().filter(value => !presets.includes(value)), ['2.5']);
  assert.ok(values().includes('0.25')); assert.ok(values().includes('1.75')); assert.equal(values().length, presets.length + 1);
  const media = f.play(); media.metadata();
  for (const rate of [3, 2.75, 3, 3]) {
    media.playbackRate = rate; media.emit('ratechange');
    assert.equal(select.value, String(rate)); assert.deepEqual(values().filter(value => !presets.includes(value)), [String(rate)]);
    assert.equal(new Set(values()).size, presets.length + 1); assert.equal(values().length, presets.length + 1);
  }
  select.value = '1.75'; select.emit('change');
  assert.equal(media.playbackRate, 1.75); assert.equal(media.defaultPlaybackRate, 1.75); assert.equal(f.handle.getState().rate, 1.75);
  assert.equal(select.value, '1.75'); assert.deepEqual(values(), presets);
  media.playbackRate = 2.5; media.emit('ratechange'); assert.equal(select.value, '2.5'); assert.equal(values().length, presets.length + 1);
  media.playbackRate = .25; media.emit('ratechange'); assert.equal(select.value, '0.25'); assert.deepEqual(values(), presets); f.handle.dispose();
});

test('board keyboard seeking stays available while native controls and menu buttons retain their keys', () => {
  const f = fixture({ controls: 'board' });
  const queued = f.card.emit('keydown', { key: 'ArrowRight' }); assert.equal(queued.defaultPrevented, true); assert.equal(f.handle.getState().time, 10);
  assert.equal(f.doc.medias().length, 0);
  f.card.emit('keydown', { key: ' ', code: 'Space' }); const media = f.doc.medias()[0]; media.metadata();
  assert.equal(media.currentTime, 10); media.currentTime = 32.5;
  f.card.emit('keydown', { key: 'ArrowRight' }); assert.equal(media.currentTime, 42.5);
  f.card.emit('keydown', { key: 'ArrowLeft' }); assert.equal(media.currentTime, 32.5);
  for (const target of [media, f.button('更多')]) {
    const event = f.card.emit('keydown', { key: 'ArrowRight', target });
    assert.equal(event.propagationStopped, true); assert.equal(event.defaultPrevented, false); assert.equal(media.currentTime, 32.5);
  }
  f.handle.dispose();
});

test('board precise jump validates and preserves fractional time without loading the source', () => {
  const dialog = timeRequests(), f = fixture({ controls: 'board', initialTime: 12.345, requestTime: dialog.requestTime });
  f.menu().choose('跳转到时间…'); assert.equal(dialog.requests.length, 1);
  const request = dialog.requests[0]; assert.equal(request.current, '0:12.345');
  for (const text of ['', '-1', '1:60', '1:02:60', 'not a timestamp']) {
    assert.throws(() => request.submit(text)); assert.equal(f.handle.getState().time, 12.345); assert.equal(request.closeCalls, 0);
  }
  request.submit('1:23.456'); assert.equal(f.handle.getState().time, 83.456);
  request.submit('7'); assert.equal(f.handle.getState().time, 83.456);
  assert.equal(f.doc.medias().length, 0); assert.equal(f.stats().resolutions, 0);
  const media = f.play(); media.metadata(90); assert.equal(media.currentTime, 83.456);
  f.menu().choose('跳转到时间…'); const clamped = dialog.requests.at(-1)!; assert.equal(clamped.current, '1:23.456');
  clamped.submit('1000.125'); assert.equal(media.currentTime, 90); assert.equal(f.doc.medias().length, 1); f.handle.dispose();
});

test('reopening a board precise-jump dialog closes the old request and rejects its late submissions', () => {
  const dialog = timeRequests(), f = fixture({ controls: 'board', requestTime: dialog.requestTime }), media = f.play(); media.metadata();
  f.menu().choose('跳转到时间…'); const old = dialog.requests[0];
  f.menu().choose('跳转到时间…'); const current = dialog.requests[1];
  assert.equal(old.closeCalls, 1); const count = f.states.length;
  assert.doesNotThrow(() => old.submit('80')); assert.equal(media.currentTime, 0); assert.equal(f.states.length, count);
  current.submit('37.25'); assert.equal(media.currentTime, 37.25);
  old.submit('95'); assert.equal(media.currentTime, 37.25); f.handle.dispose();
});

for (const stop of ['dispose', 'offscreen', 'hidden', 'stale', 'pause'] as const) test(`board ${stop} closes menu and precise-jump dialog and ignores late callbacks`, () => {
  const dialog = timeRequests(), f = fixture({ controls: 'board', requestTime: dialog.requestTime }), media = f.play(); media.metadata();
  f.menu().choose('跳转到时间…'); const request = dialog.requests[0], menu = f.menu(), open = menu.item('在独立页面播放').callback!;
  if (stop === 'dispose') f.handle.dispose();
  else if (stop === 'offscreen') f.doc.observers[0].visibility(false);
  else if (stop === 'hidden') { f.doc.visibilityState = 'hidden'; f.doc.emit('visibilitychange'); }
  else if (stop === 'stale') { f.setLive(false); media.emit('timeupdate'); }
  else f.handle.pause();
  assert.equal(menu.hidden, true); assert.equal(f.button('更多').attributes.get('aria-expanded'), 'false'); assert.equal(request.closeCalls, 1);
  const count = f.states.length, saved = f.handle.getState().time;
  assert.doesNotThrow(() => request.submit('75')); assert.equal(f.handle.getState().time, saved); assert.equal(f.states.length, count);
  if (stop === 'dispose' || stop === 'stale') { open(); assert.equal(f.stats().opens, 0); }
  assert.equal(media.src, ''); assert.equal(media.loadCalls, 1); f.handle.dispose(); assert.equal(request.closeCalls, 1);
});

test('board pause closes menu and jump requests even before any media has been created', () => {
  const dialog = timeRequests(), f = fixture({ controls: 'board', requestTime: dialog.requestTime });
  f.menu().choose('跳转到时间…'); const request = dialog.requests[0], menu = f.menu();
  f.handle.pause(); assert.equal(menu.hidden, true); assert.equal(request.closeCalls, 1);
  request.submit('45.5'); assert.equal(f.handle.getState().time, 0); assert.equal(f.doc.medias().length, 0); assert.equal(f.stats().resolutions, 0);
  f.handle.dispose();
});

test('released board jump callbacks cannot seek a replacement media element', () => {
  const dialog = timeRequests(), f = fixture({ controls: 'board', requestTime: dialog.requestTime }), first = f.play(); first.metadata();
  f.menu().choose('跳转到时间…'); const old = dialog.requests[0]; f.handle.pause();
  const next = f.play(); next.metadata(); f.menu().choose('跳转到时间…'); const current = dialog.requests[1];
  old.submit('45'); assert.equal(next.currentTime, 0); assert.equal(f.handle.getState().time, 0);
  current.submit('18.625'); assert.equal(next.currentTime, 18.625); assert.equal(first.src, '');
  old.submit('99'); assert.equal(next.currentTime, 18.625); f.handle.dispose();
});

test('the compact playback button loads explicitly and toggles native pause without unloading the decoder', () => {
  const f = fixture({ state: { time: 15, rate: 1.5, volume: .3 } }); f.click('播放'); const media = f.doc.medias()[0]; media.metadata();
  assert.equal(media.controls, true); assert.equal(f.stats().resolutions, 1); assert.equal(f.button('暂停').attributes.get('aria-label'), '暂停');
  f.click('暂停'); assert.equal(media.paused, true); assert.equal(media.loadCalls, 0); assert.notEqual(media.src, ''); assert.equal(media.currentTime, 15);
  f.click('播放'); assert.equal(media.paused, false); assert.equal(f.doc.medias().length, 1); assert.equal(media.playbackRate, 1.5); assert.equal(media.volume, .3);
  f.handle.dispose();
});

for (const controls of ['board', 'full'] as const) for (const offset of [-10, 10]) test(`${controls} relative ${offset}s seek starts at the current native time between timeupdate events`, () => {
  const f = fixture({ controls }), media = f.play();
  media.metadata(); media.currentTime = 20; media.emit('timeupdate');
  media.currentTime = 20.375;
  if (controls === 'board') f.menu().choose(offset < 0 ? '后退 10 秒' : '前进 10 秒');
  else f.click(offset < 0 ? '−10 秒' : '+10 秒');
  assert.equal(media.currentTime, 20.375 + offset);
  assert.equal(f.states.at(-1)?.time, 20.375 + offset);
  f.handle.dispose();
});

test('icons retain their hidden accessibility role when live control labels change', async () => {
  const f = fixture(), media = f.play(); media.metadata(); media.frame();
  const icon = (button: FakeElement) => button.children.find(child => child.className === 'ts-media-card__button-icon')!;
  assert.equal(icon(f.button('暂停')).attributes.get('data-icon'), 'pause'); assert.equal(icon(f.button('暂停')).attributes.get('aria-hidden'), 'true');
  f.click('循环 A/B'); assert.equal(icon(f.button('设为 B 点')).attributes.get('data-icon'), 'repeat-2');
  f.click('截取画面'); assert.equal(icon(f.button('正在截图…')).attributes.get('data-icon'), 'camera'); await tick();
  assert.equal(icon(f.button('截取画面')).attributes.get('data-icon'), 'camera'); assert.equal(icon(f.button('播放')).attributes.get('data-icon'), 'play'); f.handle.dispose();
});

test('metadata restores playback state, then capture uses exact current media time', () => {
  const f = fixture({ state: { time: 41.25, rate: 0.75, volume: 0.3 } }), media = f.play();
  media.emit('timeupdate');
  assert.equal(f.find('ts-media-card__position').textContent, '0:41');
  media.metadata(90);
  assert.equal(media.currentTime, 41.25);
  assert.equal(media.playbackRate, 0.75);
  assert.equal(media.volume, 0.3);
  media.currentTime = 44.567;
  f.click('记下此刻');
  assert.deepEqual(f.captures, [44.567]);
  media.emit('timeupdate');
  assert.equal(f.states.at(-1)?.time, 44.567);
  f.handle.dispose();
});

test('resource loading cannot overwrite a requested rate before metadata, including snapshots and host handoff', () => {
  const f = fixture({ state: { time: 12, rate: 1.5, volume: .8 } }), first = f.play();
  assert.equal(first.defaultPlaybackRate, 1.5); first.playbackRate = 1; first.emit('ratechange'); first.emit('pause'); first.emit('volumechange');
  assert.equal(f.handle.getState().rate, 1.5); assert.equal(f.states.at(-1)?.rate, 1.5); first.metadata();
  assert.equal(first.playbackRate, 1.5); assert.equal(first.defaultPlaybackRate, 1.5);
  first.playbackRate = .75; first.emit('ratechange'); assert.equal(first.defaultPlaybackRate, .75); assert.equal(f.handle.getState().rate, .75);
  f.handle.pause(); const second = f.play(); assert.equal(second.defaultPlaybackRate, .75); second.metadata(); assert.equal(second.playbackRate, .75); f.handle.dispose();
});

test('a rate chosen during loading becomes the new default and survives an early pause', () => {
  const f = fixture(), media = f.play(), select = f.card.all().find(node => node.tagName === 'select')!;
  select.value = '1.5'; select.emit('change'); assert.equal(media.defaultPlaybackRate, 1.5); media.playbackRate = 1; media.emit('ratechange');
  f.handle.pause(); assert.equal(f.handle.getState().rate, 1.5); const next = f.play(); next.metadata(); assert.equal(next.playbackRate, 1.5); f.handle.dispose();
});

test('read-only cards retain playback while disabling timestamp creation', () => {
  const f = fixture({ captureEnabled: false }), media = f.play(); media.metadata();
  assert.equal(f.button('记下此刻').disabled, true);
  f.click('记下此刻'); assert.deepEqual(f.captures, []);
  assert.equal(media.paused, false);
  f.handle.dispose();
});

test('queued and active seeks clamp against metadata, including later shorter duration', () => {
  const f = fixture({ initialTime: 900 }), media = f.play();
  media.metadata(60);
  assert.equal(media.currentTime, 60);
  f.handle.seek(-10); assert.equal(media.currentTime, 0);
  f.handle.seek(42.5); assert.equal(media.currentTime, 42.5);
  f.handle.seek(NaN); assert.equal(media.currentTime, 42.5);
  f.handle.seek(Infinity); assert.equal(media.currentTime, 42.5);
  media.duration = 20; media.emit('durationchange'); assert.equal(media.currentTime, 20);
  f.handle.dispose();
});

test('offscreen release unloads its decoder and only explicit replay restores saved state', async () => {
  const f = fixture(), media = f.play(); media.metadata(); media.currentTime = 31.125; media.playbackRate = 1.25; media.volume = 0.6;
  f.doc.observers[0].visibility(false);
  assert.equal(media.paused, true);
  assert.equal(media.src, '');
  assert.equal(media.loadCalls, 1);
  assert.equal(media.listenerCount(), 0);
  assert.equal(media.parent, undefined);
  assert.deepEqual(f.states.at(-1), { time: 31.125, rate: 1.25, volume: 0.6 });
  f.doc.observers[0].visibility(true); await tick();
  assert.equal(f.doc.medias().length, 1);
  const resumed = f.play(); resumed.metadata();
  assert.equal(resumed.currentTime, 31.125);
  assert.equal(resumed.playbackRate, 1.25);
  assert.equal(resumed.volume, 0.6);
  f.handle.dispose();
  assert.equal(f.doc.observers[0].disconnected, true);
  assert.equal(f.doc.listenerCount(), 0);
  assert.equal(f.host.children.length, 0);
});

test('hidden document and explicit pause release sources without automatically resuming', () => {
  const f = fixture(), media = f.play(); media.metadata(); media.currentTime = 8;
  f.doc.visibilityState = 'hidden'; f.doc.emit('visibilitychange');
  assert.equal(media.src, '');
  assert.equal(media.loadCalls, 1);
  f.play(); assert.equal(f.doc.medias().length, 1);
  f.doc.visibilityState = 'visible'; f.doc.emit('visibilitychange');
  assert.equal(f.doc.medias().length, 1);
  const resumed = f.play(); resumed.metadata(); f.handle.pause();
  assert.equal(resumed.loadCalls, 1);
  assert.equal(resumed.src, '');
  f.handle.dispose();
});

test('DOM recycling resumes from emitted state without retaining old resources', () => {
  const first = fixture(), old = first.play(); old.metadata(); old.currentTime = 52.75; old.playbackRate = 2; old.volume = 0.25;
  first.handle.dispose();
  const second = fixture({ state: first.states.at(-1) }), resumed = second.play(); resumed.metadata();
  assert.deepEqual({ time: resumed.currentTime, rate: resumed.playbackRate, volume: resumed.volume }, { time: 52.75, rate: 2, volume: 0.25 });
  assert.equal(old.src, ''); assert.equal(old.listenerCount(), 0);
  second.handle.dispose();
});

test('native pause aborting a pending board play keeps its decoder and clears loading without an error', async () => {
  const pending = deferred(), f = fixture({ controls: 'board' });
  const originalCreate = f.doc.createElement.bind(f.doc);
  f.doc.createElement = tag => { const node = originalCreate(tag); if (node instanceof FakeMedia) node.playResult = pending.promise; return node; };
  const media = f.play(), source = media.src;
  assert.equal(f.find('ts-media-card__loading').hidden, false);
  media.pause(); pending.reject(Object.assign(Error('interrupted by pause'), { name: 'AbortError' })); await tick();
  assert.equal(media.src, source); assert.equal(media.loadCalls, 0); assert.ok(media.listenerCount() > 0);
  assert.equal(media.parent, f.find('ts-media-card__stage')); assert.equal(media.paused, true);
  assert.equal(f.find('ts-media-card__loading').hidden, true); assert.equal(f.find('ts-media-card__stage').attributes.get('aria-busy'), 'false');
  assert.equal(f.find('ts-media-card__status').textContent, '');
  media.playResult = Promise.resolve(); f.handle.play(); await tick();
  assert.equal(media.paused, false); assert.equal(f.doc.medias().length, 1); assert.equal(f.stats().resolutions, 1); f.handle.dispose();
});

for (const name of ['NotAllowedError', 'NotSupportedError'] as const) test(`paused media still reports a real ${name} play rejection`, async () => {
  const pending = deferred(), f = fixture({ controls: 'board' });
  const originalCreate = f.doc.createElement.bind(f.doc);
  f.doc.createElement = tag => { const node = originalCreate(tag); if (node instanceof FakeMedia) node.playResult = pending.promise; return node; };
  const media = f.play(); media.pause(); pending.reject(Object.assign(Error('private failure details'), { name })); await tick();
  assert.equal(media.src, ''); assert.equal(media.loadCalls, 1); assert.equal(f.find('ts-media-card__loading').hidden, true);
  assert.match(f.find('ts-media-card__status').textContent, /未能开始播放/); assert.doesNotMatch(f.card.textContent, /private failure/); f.handle.dispose();
});

test('AbortError only retains a paused decoder without a native media error', async () => {
  for (const paused of [false, true]) {
    const pending = deferred(), f = fixture({ controls: 'board' });
    const originalCreate = f.doc.createElement.bind(f.doc);
    f.doc.createElement = tag => { const node = originalCreate(tag); if (node instanceof FakeMedia) node.playResult = pending.promise; return node; };
    const media = f.play();
    if (paused) { media.pause(); media.error = { code: 4 }; }
    pending.reject(Object.assign(Error('unexpected abort'), { name: 'AbortError' })); await tick();
    assert.equal(media.src, ''); assert.equal(media.loadCalls, 1); assert.match(f.find('ts-media-card__status').textContent, /未能开始播放/); f.handle.dispose();
  }
});

test('an older play rejection cannot tear down a newer request on the same decoder', async () => {
  const previous = deferred(), latest = deferred(), f = fixture({ controls: 'board' });
  const originalCreate = f.doc.createElement.bind(f.doc);
  f.doc.createElement = tag => { const node = originalCreate(tag); if (node instanceof FakeMedia) node.playResult = previous.promise; return node; };
  const media = f.play(), source = media.src;
  media.pause(); media.playResult = latest.promise; f.handle.play();
  assert.equal(media.playCalls, 2);
  previous.reject(Object.assign(Error('old play request failed'), { name: 'NotAllowedError' })); await tick();
  assert.equal(media.src, source); assert.equal(media.loadCalls, 0); assert.equal(media.paused, false); assert.equal(f.doc.medias().length, 1);
  assert.equal(f.find('ts-media-card__status').textContent, '');
  latest.resolve(); await tick(); assert.equal(media.paused, false); assert.equal(media.src, source); f.handle.dispose();
});

test('late playback promise and stale media events cannot revive a disposed player', async () => {
  const pending = deferred(), f = fixture();
  const originalCreate = f.doc.createElement.bind(f.doc);
  f.doc.createElement = tag => { const node = originalCreate(tag); if (node instanceof FakeMedia) node.playResult = pending.promise; return node; };
  const media = f.play(); f.handle.dispose();
  const count = f.states.length;
  pending.reject(Error('app://private/should-not-leak.mp4'));
  media.emit('loadedmetadata'); media.emit('timeupdate'); await tick();
  assert.equal(f.states.length, count);
  assert.equal(media.loadCalls, 1);
  assert.equal(media.src, '');
  assert.equal(f.host.children.length, 0);
  assert.equal(f.card.listenerCount(), 0);
});

test('late old playback resolution does not pause or mutate a replacement media element', async () => {
  const pending = deferred(), f = fixture();
  const originalCreate = f.doc.createElement.bind(f.doc);
  f.doc.createElement = tag => { const node = originalCreate(tag); if (node instanceof FakeMedia && f.doc.medias().length === 1) node.playResult = pending.promise; return node; };
  const old = f.play(); f.handle.pause(); const current = f.play();
  pending.resolve(); await tick();
  assert.equal(old.src, '');
  assert.equal(current.paused, false);
  assert.equal(current.loadCalls, 0);
  f.handle.dispose();
});

test('a playback rejection after its owner dies still releases native resources', async () => {
  const pending = deferred(), f = fixture();
  const originalCreate = f.doc.createElement.bind(f.doc);
  f.doc.createElement = tag => { const node = originalCreate(tag); if (node instanceof FakeMedia) node.playResult = pending.promise; return node; };
  const media = f.play(); f.setLive(false);
  pending.reject(Error('cancelled')); await tick();
  assert.equal(media.src, ''); assert.equal(media.loadCalls, 1); assert.equal(media.listenerCount(), 0);
  f.handle.dispose();
});

test('dead owners block source resolution, capture, callbacks and keyboard controls', () => {
  const f = fixture(); f.setLive(false); f.play(); f.click('打开'); f.click('截取画面'); f.click('记下此刻'); f.handle.seek(50);
  assert.equal(f.doc.medias().length, 0);
  assert.deepEqual(f.stats(), { resolutions: 0, opens: 0 });
  assert.deepEqual(f.captures, []); assert.deepEqual(f.frames, []); assert.deepEqual(f.states, []);
  f.handle.dispose();
});

test('a now-stale owner releases active media on its next event and saves no stale state', () => {
  const f = fixture(), media = f.play(); media.metadata(); const count = f.states.length;
  f.setLive(false); media.emit('timeupdate');
  assert.equal(media.src, ''); assert.equal(media.loadCalls, 1); assert.equal(f.states.length, count);
  f.handle.dispose();
});

test('keyboard control respects native controls, editable fields, composition and modifiers', () => {
  const f = fixture();
  for (const values of [{ isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
    assert.equal(f.card.emit('keydown', { key: ' ', ...values }).defaultPrevented, false);
  }
  for (const tag of ['input', 'textarea', 'select', 'button', 'audio', 'video']) {
    const target = new FakeElement(f.doc, tag);
    assert.equal(f.card.emit('keydown', { key: ' ', target }).defaultPrevented, false);
  }
  const editable = new FakeElement(f.doc); editable.setAttribute('contenteditable', 'true');
  assert.equal(f.card.emit('keydown', { key: ' ', target: editable }).defaultPrevented, false);
  assert.equal(f.doc.medias().length, 0);
  assert.equal(f.card.emit('keydown', { key: ' ', code: 'Space' }).defaultPrevented, true);
  const media = f.doc.medias()[0]; media.metadata();
  f.card.emit('keydown', { key: 'ArrowRight' }); assert.equal(media.currentTime, 10);
  f.card.emit('keydown', { key: 'ArrowLeft' }); assert.equal(media.currentTime, 0);
  f.card.emit('keydown', { key: ' ' }); assert.equal(media.paused, true);
  assert.equal(f.card.emit('keydown', { key: ' ', repeat: true }).defaultPrevented, true);
  assert.equal(media.playCalls, 1);
  f.handle.dispose();
});

test('pointer/touch events remain native while card actions do not bubble into canvas gestures', () => {
  const f = fixture();
  for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick', 'touchstart', 'touchmove', 'wheel']) {
    const event = f.card.emit(type);
    assert.equal(event.propagationStopped, true, type);
    assert.equal(event.defaultPrevented, false, type);
  }
  const drag = f.card.emit('dragstart'); assert.equal(drag.defaultPrevented, true); assert.equal(drag.propagationStopped, true);
  f.handle.dispose();
});

test('loop A/B repeats a valid segment and ordinary seek can leave it', () => {
  const f = fixture(), media = f.play(); media.metadata(); media.currentTime = 10; f.click('循环 A/B');
  media.currentTime = 10.2; f.click('设为 B 点'); assert.equal(f.button('设为 B 点').attributes.get('aria-pressed'), 'false');
  media.currentTime = 15; f.click('设为 B 点'); assert.equal(media.currentTime, 10);
  media.currentTime = 15; media.emit('timeupdate'); assert.equal(media.currentTime, 10);
  assert.equal(f.button('关闭循环').attributes.get('aria-pressed'), 'true');
  f.handle.seek(25); assert.equal(media.currentTime, 25); assert.equal(f.button('循环 A/B').attributes.get('aria-pressed'), 'false');
  f.handle.dispose();
});

test('native video capture freezes time, pauses playback and encodes a bounded PNG', async () => {
  const f = fixture(), media = f.play(); media.metadata(); media.frame(3840, 2160); media.currentTime = 26.234;
  f.click('截取画面');
  assert.equal(media.paused, true);
  const canvas = f.doc.canvases()[0];
  assert.deepEqual(canvas.drawing, { width: 1600, height: 900, time: 26.234 });
  media.currentTime = 80;
  await tick();
  assert.equal(canvas.encodedType, 'image/png');
  assert.equal(f.frames.length, 1); assert.equal(f.frames[0].time, 26.234); assert.equal(f.frames[0].blob.type, 'image/png');
  assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
  assert.equal(media.paused, true);
  f.handle.dispose();
});

test('audio and hosts without a frame callback expose no screenshot action', () => {
  for (const options of [{ kind: 'audio' as const }, { onCaptureFrame: undefined }]) {
    const f = fixture(options); assert.equal(f.button('截取画面'), undefined); f.handle.dispose();
  }
});

test('screenshots require an actual decoded frame and remain disabled while seeking', () => {
  const f = fixture();
  assert.equal(f.button('截取画面').disabled, true); f.click('截取画面'); assert.equal(f.doc.canvases().length, 0);
  const media = f.play(); media.metadata(); f.click('截取画面'); assert.equal(f.doc.canvases().length, 0);
  media.frame(); assert.equal(f.button('截取画面').disabled, false);
  media.seeking = true; media.emit('seeking'); assert.equal(f.button('截取画面').disabled, true);
  f.click('截取画面'); assert.equal(f.doc.canvases().length, 0);
  media.seeking = false; media.emit('seeked'); assert.equal(f.button('截取画面').disabled, false);
  media.videoWidth = 0; media.emit('resize'); assert.equal(f.button('截取画面').disabled, true);
  f.handle.dispose();
});

test('read-only and errored video cannot produce a frame even through dispatched clicks', () => {
  const readOnly = fixture({ captureEnabled: false }), media = readOnly.play(); media.metadata(); media.frame();
  assert.equal(readOnly.button('截取画面').disabled, true); readOnly.click('截取画面'); assert.equal(readOnly.doc.canvases().length, 0); readOnly.handle.dispose();
  const f = fixture(), bad = f.play(); bad.metadata(); bad.frame(); bad.error = { code: 3 };
  f.click('截取画面'); assert.equal(f.doc.canvases().length, 0); f.handle.dispose();
});

test('small frames retain native size and portrait frames retain aspect ratio', async () => {
  for (const [width, height, outputWidth, outputHeight] of [[640, 360, 640, 360], [1080, 1920, 900, 1600]]) {
    const f = fixture(), media = f.play(); media.metadata(); media.frame(width, height); f.click('截取画面'); await tick();
    assert.deepEqual(f.doc.canvases()[0].drawing, { width: outputWidth, height: outputHeight, time: 0 });
    f.handle.dispose();
  }
});

test('frame encoding and save processing reject duplicate captures and timestamp actions', async () => {
  const save = deferred(); let calls = 0;
  const f = fixture({ onCaptureFrame: async () => { calls++; await save.promise; } }), media = f.play();
  f.doc.autoEncode = false; media.metadata(); media.frame();
  const trigger = f.button('截取画面'); trigger.emit('click'); trigger.emit('click'); f.click('记下此刻');
  assert.equal(f.doc.canvases().length, 1); assert.equal(trigger.disabled, true); assert.equal(trigger.attributes.get('aria-busy'), 'true');
  const canvas = f.doc.canvases()[0]; canvas.callback!(new Blob(['frame'], { type: 'image/png' }));
  trigger.emit('click'); assert.equal(calls, 1); assert.deepEqual(f.captures, []); assert.equal(trigger.disabled, true);
  assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
  save.resolve(); await tick(); assert.equal(trigger.disabled, false); assert.equal(trigger.attributes.get('aria-busy'), 'false');
  f.handle.dispose();
});

test('frame capture reserves its frozen timestamp synchronously and releases only after delivery settles', async () => {
  const transitions: [boolean, number][] = [], save = deferred(); let delivered = 0;
  const f = fixture({ onFrameCaptureState: (busy, time) => transitions.push([busy, time]), onCaptureFrame: async () => { delivered++; await save.promise; } }), media = f.play();
  f.doc.autoEncode = false; media.metadata(); media.frame(); media.currentTime = 17.25; f.click('截取画面');
  assert.equal(transitions.length, 1); assert.equal(transitions[0][0], true); assert.equal(transitions[0][1], 17.25);
  media.currentTime = 50; f.doc.canvases()[0].callback!(new Blob(['png'], { type: 'image/png' })); await tick();
  assert.equal(delivered, 1); assert.equal(transitions.length, 1); save.resolve(); await tick();
  assert.deepEqual(transitions, [[true, 17.25], [false, 17.25]]); f.handle.dispose(); assert.equal(transitions.length, 2);
});

for (const stop of ['dispose', 'offscreen', 'stale', 'pause'] as const) test(`${stop} balances frame reservation exactly once even when encoding later completes`, async () => {
  const transitions: boolean[] = [], f = fixture({ onFrameCaptureState: busy => transitions.push(busy) }), media = f.play();
  f.doc.autoEncode = false; media.metadata(); media.frame(); f.click('截取画面'); const canvas = f.doc.canvases()[0];
  if (stop === 'dispose') f.handle.dispose();
  else if (stop === 'offscreen') f.doc.observers[0].visibility(false);
  else if (stop === 'stale') { f.setLive(false); media.emit('timeupdate'); }
  else f.handle.pause();
  assert.deepEqual(transitions, [true, false]); canvas.callback!(new Blob(['late'], { type: 'image/png' })); await tick(); f.handle.dispose();
  assert.deepEqual(transitions, [true, false]); assert.equal(f.frames.length, 0);
});

test('a rejected synchronous frame reservation cancels encoding and releases its lock without leaking details', () => {
  const transitions: boolean[] = [], f = fixture({ onFrameCaptureState: busy => { transitions.push(busy); if (busy) throw Error('private draft details'); } }), media = f.play();
  media.metadata(); media.frame(); f.click('截取画面');
  assert.deepEqual(transitions, [true, false]); assert.equal(f.doc.canvases()[0].encodeCalls, 0); assert.equal(f.doc.canvases()[0].width, 0);
  assert.equal(f.button('截取画面').disabled, false); assert.match(f.find('ts-media-card__status').textContent, /暂时无法截取/); assert.doesNotMatch(f.card.textContent, /private/); f.handle.dispose();
});

test('all drawing, encoding and delivery failures release the frame reservation', async () => {
  for (const failure of ['context', 'drawing', 'encoding', 'empty', 'saving'] as const) {
    const transitions: boolean[] = [], f = fixture({ onFrameCaptureState: busy => transitions.push(busy), ...(failure === 'saving' ? { onCaptureFrame: async () => { throw Error('cannot save'); } } : {}) }), media = f.play();
    if (failure === 'context') f.doc.missingContext = true;
    if (failure === 'drawing') f.doc.drawError = true;
    if (failure === 'encoding') f.doc.encodeError = true;
    if (failure === 'empty') f.doc.autoEncode = false;
    media.metadata(); media.frame(); f.click('截取画面'); if (failure === 'empty') f.doc.canvases()[0].callback!(null); await tick();
    assert.deepEqual(transitions, [true, false], failure); f.handle.dispose();
  }
});

test('late encoding cannot release the newer capture reservation', async () => {
  const transitions: [boolean, number][] = [], f = fixture({ onFrameCaptureState: (busy, time) => transitions.push([busy, time]) }), media = f.play();
  f.doc.autoEncode = false; media.metadata(); media.frame(); media.currentTime = 3; f.click('截取画面'); const old = f.doc.canvases()[0]; f.handle.pause();
  const next = f.play(); next.metadata(); next.frame(); next.currentTime = 7; f.click('截取画面'); old.callback!(new Blob(['old'])); await tick();
  assert.deepEqual(transitions, [[true, 3], [false, 3], [true, 7]]); f.doc.canvases()[1].callback!(new Blob(['new'])); await tick();
  assert.deepEqual(transitions, [[true, 3], [false, 3], [true, 7], [false, 7]]); f.handle.dispose();
});

for (const stop of ['dispose', 'offscreen', 'stale', 'pause'] as const) test(`${stop} during PNG encoding discards the pending screenshot`, async () => {
  const f = fixture(), media = f.play(); f.doc.autoEncode = false; media.metadata(); media.frame(); f.click('截取画面');
  const canvas = f.doc.canvases()[0];
  if (stop === 'dispose') f.handle.dispose();
  else if (stop === 'offscreen') f.doc.observers[0].visibility(false);
  else if (stop === 'stale') f.setLive(false);
  else f.handle.pause();
  canvas.callback!(new Blob(['frame'], { type: 'image/png' })); await tick();
  assert.deepEqual(f.frames, []); assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
  f.handle.dispose();
});

test('late screenshot callbacks cannot clear the processing state of a replacement capture', async () => {
  const f = fixture(), old = f.play(); f.doc.autoEncode = false; old.metadata(); old.frame(); f.click('截取画面');
  const first = f.doc.canvases()[0]; f.handle.pause();
  const current = f.play(); current.metadata(); current.frame(); f.click('截取画面');
  const trigger = f.button('正在截图…'), second = f.doc.canvases()[1];
  first.callback!(new Blob(['old'], { type: 'image/png' })); await tick();
  assert.deepEqual(f.frames, []); assert.equal(trigger.disabled, true); assert.equal(trigger.attributes.get('aria-busy'), 'true');
  second.callback!(new Blob(['new'], { type: 'image/png' })); await tick();
  assert.equal(f.frames.length, 1); assert.equal(trigger.disabled, false); f.handle.dispose();
});

test('empty encodings, drawing errors and save failures recover without exposing source details', async () => {
  for (const failure of ['context', 'drawing', 'encoding', 'empty', 'saving'] as const) {
    const f = fixture(failure === 'saving' ? { onCaptureFrame: async () => { throw Error('app://private-source'); } } : {}), media = f.play();
    if (failure === 'context') f.doc.missingContext = true;
    if (failure === 'drawing') f.doc.drawError = true;
    if (failure === 'encoding') f.doc.encodeError = true;
    if (failure === 'empty') f.doc.autoEncode = false;
    media.metadata(); media.frame(); f.click('截取画面');
    if (failure === 'empty') f.doc.canvases()[0].callback!(null);
    await tick();
    assert.equal(f.button('截取画面').disabled, false, failure);
    assert.match(f.find('ts-media-card__status').textContent, /暂时无法|未能|无法截取/);
    assert.doesNotMatch(f.card.textContent, /app:|private/);
    assert.equal(f.doc.canvases()[0].width, 0); assert.equal(f.doc.canvases()[0].height, 0);
    f.handle.dispose();
  }
});

test('source, playback and external-action failures show human text without raw URLs', async () => {
  const source = fixture({ src: () => { throw Error('https://secret.example/file.mp4?token=private'); } });
  source.play(); assert.match(source.find('ts-media-card__status').textContent, /无法读取媒体/);
  assert.doesNotMatch(source.card.textContent, /secret|token|https:/); source.handle.dispose();
  const f = fixture({ onOpen: async () => { throw Error('app://secret/file'); } }), media = f.play();
  media.error = { code: 4 }; media.emit('error');
  assert.match(f.find('ts-media-card__status').textContent, /不支持此媒体格式/);
  assert.equal(media.src, ''); assert.equal(media.loadCalls, 1);
  f.click('打开'); await tick(); assert.match(f.find('ts-media-card__status').textContent, /未能打开媒体/);
  assert.doesNotMatch(f.card.textContent, /secret|app:/); f.handle.dispose();
});

test('a failing state sink cannot interrupt decoder and listener cleanup', () => {
  const f = fixture({ onState: () => { throw Error('storage unavailable'); } }), media = f.play(); media.metadata();
  assert.doesNotThrow(() => f.handle.dispose());
  assert.equal(media.src, ''); assert.equal(media.loadCalls, 1); assert.equal(media.listenerCount(), 0);
  assert.equal(f.card.listenerCount(), 0); assert.equal(f.doc.listenerCount(), 0);
});

test('explicit handle playback and snapshots carry exact time and loop state across hosts', () => {
  const first = fixture({ state: { time: 12.345, rate: 1.5, volume: 0.7, loopA: 10, loopB: 20 } });
  assert.equal(first.doc.medias().length, 0);
  const untouched = first.handle.getState(); untouched.time = 100; delete untouched.loopA;
  assert.deepEqual(first.handle.getState(), { time: 12.345, rate: 1.5, volume: 0.7, loopA: 10, loopB: 20 });
  first.handle.play(); const media = first.doc.medias()[0]; media.metadata(); media.currentTime = 13.456;
  const transfer = first.handle.getState();
  assert.deepEqual(transfer, { time: 13.456, rate: 1.5, volume: 0.7, loopA: 10, loopB: 20 });
  first.handle.dispose();
  const second = fixture({ state: transfer }); second.handle.play(); const resumed = second.doc.medias()[0]; resumed.metadata();
  assert.equal(resumed.currentTime, 13.456); assert.equal(second.button('关闭循环').attributes.get('aria-pressed'), 'true');
  second.click('关闭循环'); assert.deepEqual(second.states.at(-1), { time: 13.456, rate: 1.5, volume: 0.7 });
  second.handle.dispose();
});

test('loop state is validated and shortened media cannot retain invalid endpoints', () => {
  for (const loop of [{ loopA: -1, loopB: 5 }, { loopA: NaN, loopB: 20 }, { loopB: 20 }]) {
    const f = fixture({ state: { time: 0, rate: 1, volume: 1, ...loop } });
    assert.equal(f.handle.getState().loopA, undefined); assert.equal(f.handle.getState().loopB, undefined); f.handle.dispose();
  }
  const partial = fixture({ state: { time: 12, rate: 1, volume: 1, loopA: 10, loopB: 10.2 } });
  assert.equal(partial.handle.getState().loopA, 10); assert.equal(partial.handle.getState().loopB, undefined); partial.handle.dispose();
  const shorter = fixture({ state: { time: 12, rate: 1, volume: 1, loopA: 10, loopB: 25 } }), media = shorter.play(); media.metadata(20);
  assert.equal(shorter.handle.getState().loopB, 20);
  media.duration = 15; media.emit('durationchange'); assert.equal(shorter.handle.getState().loopB, 15); assert.equal(shorter.states.at(-1)?.loopB, 15); shorter.handle.dispose();
  const gone = fixture({ state: { time: 12, rate: 1, volume: 1, loopA: 10, loopB: 25 } }); gone.play().metadata(5);
  assert.equal(gone.handle.getState().loopA, undefined); assert.equal(gone.handle.getState().loopB, undefined); gone.handle.dispose();
});

test('loop A selection and native seeking out of a loop emit coordinator state', () => {
  const f = fixture(), media = f.play(); media.metadata(); media.currentTime = 10; f.click('循环 A/B');
  assert.equal(f.states.at(-1)?.loopA, 10); media.currentTime = 20; f.click('设为 B 点');
  assert.equal(f.states.at(-1)?.loopB, 20);
  media.currentTime = 25; media.emit('seeking'); assert.equal(f.states.at(-1)?.loopA, undefined); assert.equal(f.handle.getState().loopB, undefined);
  f.handle.dispose();
});

test('onPlay coordinates one active native player and may dispose a stale player synchronously', () => {
  let starts = 0;
  const first = fixture(), old = first.play(); old.metadata(); old.currentTime = 15.25;
  const second = fixture({ onPlay: () => { starts++; first.handle.pause(); } }); second.handle.play();
  assert.equal(starts, 1); assert.equal(old.src, ''); assert.equal(first.handle.getState().time, 15.25);
  assert.equal(second.doc.medias()[0].paused, false); first.handle.dispose(); second.handle.dispose();
  let stale!: ReturnType<typeof fixture>;
  stale = fixture({ onPlay: () => stale.handle.dispose() }); stale.handle.play();
  assert.equal(stale.doc.medias()[0].src, ''); assert.equal(stale.host.children.length, 0);
});

test('onEnded stores final state once and A/B replay never advances the queue', () => {
  let ended = 0, observedTime = 0;
  const f = fixture({ onEnded: () => { ended++; observedTime = f.handle.getState().time; } }), media = f.play(); media.metadata(80); media.currentTime = 80;
  media.emit('ended'); media.emit('ended'); assert.equal(ended, 1); assert.equal(observedTime, 80); assert.equal(f.states.at(-1)?.time, 80);
  f.handle.play(); media.emit('ended'); assert.equal(ended, 2); f.handle.dispose(); media.emit('ended'); assert.equal(ended, 2);
  const looping = fixture({ state: { time: 10, rate: 1, volume: 1, loopA: 10, loopB: 20 }, onEnded: () => { ended++; } }), loopMedia = looping.play(); loopMedia.metadata(20); loopMedia.currentTime = 20;
  loopMedia.emit('ended'); assert.equal(loopMedia.currentTime, 10); assert.equal(loopMedia.playCalls, 2); assert.equal(ended, 2); looping.handle.dispose();
});

test('failed coordination releases playback and hides callback implementation details', () => {
  const f = fixture({ onPlay: () => { throw Error('app://private'); } }); f.handle.play();
  assert.equal(f.doc.medias()[0].src, ''); assert.match(f.find('ts-media-card__status').textContent, /暂时无法切换播放/);
  assert.doesNotMatch(f.card.textContent, /app:|private/); f.handle.dispose();
});

test('independent audio may keep playing hidden while explicit pause and dead owners still release it', () => {
  const f = fixture({ kind: 'audio', suspendWhenHidden: false }), media = f.play(); media.metadata();
  f.doc.observers[0].visibility(false); f.doc.visibilityState = 'hidden'; f.doc.emit('visibilitychange');
  assert.equal(media.paused, false); assert.notEqual(media.src, ''); assert.equal(media.loadCalls, 0);
  f.handle.pause(); assert.equal(media.src, ''); f.handle.play(); const resumed = f.doc.medias()[1];
  assert.equal(resumed.paused, false); f.setLive(false); f.doc.emit('visibilitychange'); assert.equal(resumed.src, ''); f.handle.dispose();
});

test('native VTT tracks are resolved only after explicit play and released with their owner', () => {
  let calls = 0;
  const f = fixture({ tracks: [
    { src: () => { calls++; return 'app://captions/zh.vtt'; }, label: '中文', language: 'zh-CN' },
    { src: () => { calls++; return 'app://captions/en.vtt'; }, label: 'English', language: 'en' },
  ] });
  assert.equal(calls, 0); assert.equal(f.doc.tracks().length, 0); f.handle.seek(25); assert.equal(calls, 0);
  f.handle.play(); assert.equal(calls, 2);
  const [zh, en] = f.doc.tracks(); assert.equal(zh.kind, 'subtitles'); assert.equal(zh.srclang, 'zh-CN'); assert.equal(zh.label, '中文'); assert.equal(zh.default, true); assert.equal(en.default, false);
  f.handle.pause(); assert.equal(zh.src, ''); assert.equal(en.src, ''); assert.equal(zh.parent, undefined); assert.equal(zh.listenerCount(), 0);
  f.handle.play(); assert.equal(calls, 4); f.handle.dispose(); assert.ok(f.doc.tracks().every(track => !track.src && !track.parent && !track.listenerCount()));
});

test('subtitle failures allow media playback while stale track resolution releases resources', () => {
  const f = fixture({ tracks: [{ src: () => { throw Error('app://secret'); }, label: '字幕' }] }); f.handle.play();
  assert.equal(f.doc.medias()[0].paused, false); assert.match(f.find('ts-media-card__status').textContent, /字幕暂时无法加载/);
  assert.doesNotMatch(f.card.textContent, /app:|secret/); f.handle.dispose();
  let stale!: ReturnType<typeof fixture>;
  stale = fixture({ tracks: [{ src: () => { stale.setLive(false); throw Error('stale'); }, label: '字幕' }] }); stale.handle.play();
  assert.equal(stale.doc.medias()[0].playCalls, 0); assert.equal(stale.doc.medias()[0].src, ''); stale.handle.dispose();
});

test('asynchronous subtitles never delay playback and only attach to their current media owner', async () => {
  let resolve!: (source: string) => void;
  const pending = new Promise<string>(done => { resolve = done; });
  const f = fixture({ tracks: [{ src: () => pending, label: '字幕' }] }), first = f.play();
  assert.equal(first.playCalls, 1); assert.equal(f.doc.tracks().length, 0);
  f.handle.pause(); const current = f.play(); resolve('blob:converted-subtitles'); await tick();
  assert.equal(f.doc.tracks().length, 1); assert.equal(f.doc.tracks()[0].parent, current); assert.equal(first.children.length, 0);
  f.handle.dispose(); assert.equal(f.doc.tracks()[0].src, '');
});

test('late asynchronous subtitle failure cannot change a disposed player or leak its raw error', async () => {
  let reject!: (error: unknown) => void;
  const pending = new Promise<string>((_,fail) => { reject = fail; });
  const f = fixture({ tracks: [{ src: () => pending, label: '字幕' }] }); f.play(); f.handle.dispose();
  reject(Error('app://private-subtitles')); await tick(); assert.equal(f.doc.tracks().length, 0); assert.equal(f.host.children.length, 0);
});

test('precise jumps accept seconds and timestamps without loading media or interrupting input drafts', () => {
  const f = fixture(), input = f.find('ts-media-card__seek-input');
  input.emit('focus'); input.value = '1:02.25'; input.emit('keydown', { key: 'Enter' });
  assert.equal(f.handle.getState().time, 62.25); assert.equal(f.doc.medias().length, 0);
  for (const invalid of ['1:60', '1:60:01', '-5', '1e3', '', '00::10']) {
    input.value = invalid; f.click('跳转'); assert.equal(input.attributes.get('aria-invalid'), 'true'); assert.equal(f.handle.getState().time, 62.25);
  }
  input.value = '1:02:03.125'; f.click('跳转'); assert.equal(f.handle.getState().time, 3723.125);
  const media = f.play(); media.metadata(4000); input.value = '1:3'; media.currentTime = 100; media.emit('timeupdate');
  assert.equal(input.value, '1:3'); input.emit('keydown', { key: 'Escape' }); assert.equal(input.value, '1:40');
  input.value = '150'; input.emit('keydown', { key: 'Enter', isComposing: true }); assert.equal(media.currentTime, 100);
  input.emit('keydown', { key: 'Enter' }); assert.equal(media.currentTime, 150);
  input.emit('blur'); media.currentTime = 151.875; media.emit('timeupdate'); assert.equal(input.value, '2:31.875');
  input.value = '99999'; f.click('跳转'); assert.equal(media.currentTime, 4000); assert.equal(input.value, '1:06:40'); f.handle.dispose();
});

test('native presentation buttons remain disabled when unsupported and are absent for audio', () => {
  const f = fixture(), media = f.play(); media.metadata(); media.frame();
  assert.equal(f.button('全屏').disabled, true); assert.equal(f.button('画中画').disabled, true); f.click('全屏'); f.click('画中画'); f.handle.dispose();
  const audio = fixture({ kind: 'audio' }); assert.equal(audio.button('全屏'), undefined); assert.equal(audio.button('画中画'), undefined); audio.handle.dispose();
});

test('native fullscreen entry and exit use this document and prevent duplicate requests', async () => {
  const f = fixture(); f.doc.fullscreenEnabled = true; let requests = 0;
  f.card.requestFullscreen = async () => { requests++; f.doc.fullscreenElement = f.card; f.doc.emit('fullscreenchange'); };
  const media = f.play(); media.metadata();
  const trigger = f.button('全屏'); assert.equal(trigger.disabled, false); trigger.emit('click'); trigger.emit('click'); await tick();
  assert.equal(requests, 1); assert.equal(f.doc.fullscreenElement, f.card); assert.equal(f.button('退出全屏').attributes.get('aria-pressed'), 'true');
  f.click('退出全屏'); await tick(); assert.equal(f.doc.fullscreenElement, undefined); assert.equal(f.doc.fullscreenExits, 1); f.handle.dispose();
});

test('native PiP keeps playing in the background and suspends on exit when the owner remains hidden', async () => {
  const f = fixture(); f.doc.pictureInPictureEnabled = true; const media = f.play();
  media.requestPictureInPicture = async () => { f.doc.pictureInPictureElement = media; media.emit('enterpictureinpicture'); return {}; };
  media.metadata(); assert.equal(f.button('画中画').disabled, true); media.frame(); assert.equal(f.button('画中画').disabled, false);
  f.click('画中画'); await tick(); f.doc.visibilityState = 'hidden'; f.doc.emit('visibilitychange');
  assert.equal(media.paused, false); assert.notEqual(media.src, '');
  f.click('退出画中画'); await tick(); assert.equal(f.doc.pictureInPictureElement, undefined); assert.equal(media.src, ''); assert.equal(media.loadCalls, 1); f.handle.dispose();
});

test('late native presentation resolution exits the disposed player without keeping its decoder alive', async () => {
  const gate = deferred(), f = fixture(); f.doc.fullscreenEnabled = true;
  f.card.requestFullscreen = async () => { await gate.promise; f.doc.fullscreenElement = f.card; };
  const media = f.play(); media.metadata(); f.click('全屏'); f.handle.dispose(); gate.resolve(); await tick();
  assert.equal(f.doc.fullscreenElement, undefined); assert.equal(f.doc.fullscreenExits, 1); assert.equal(media.src, ''); assert.equal(f.doc.listenerCount(), 0);
});

test('an older fullscreen resolution cannot exit a replacement decoder newer completed fullscreen request', async () => {
  const oldRequest = deferred(), f = fixture(); f.doc.fullscreenEnabled = true;
  let requests = 0;
  f.card.requestFullscreen = async () => {
    if (++requests === 1) await oldRequest.promise;
    f.doc.fullscreenElement = f.card; f.doc.emit('fullscreenchange');
  };
  const first = f.play(); first.metadata(); f.click('全屏');
  f.handle.pause(); const second = f.play(); second.metadata(); f.click('全屏'); await tick();
  assert.equal(f.doc.fullscreenElement === f.card, true); assert.equal(f.doc.fullscreenExits, 0);
  oldRequest.resolve(); await tick();
  assert.equal(f.doc.fullscreenElement === f.card, true);
  assert.equal(f.doc.fullscreenExits, 0); assert.notEqual(second.src, '');
  f.handle.dispose(); assert.equal(f.doc.fullscreenExits, 1);
});

test('native presentation rejection restores usable controls without exposing raw errors', async () => {
  const f = fixture(); f.doc.fullscreenEnabled = true;
  f.card.requestFullscreen = async () => { throw Error('app://private'); };
  const media = f.play(); media.metadata(); f.click('全屏'); await tick();
  assert.equal(f.button('全屏').disabled, false); assert.match(f.find('ts-media-card__status').textContent, /暂时无法进入全屏/); assert.doesNotMatch(f.card.textContent, /app:|private/); f.handle.dispose();
});

test('native presentation rejection after owner invalidation releases its backing media', async () => {
  const gate = deferred(), f = fixture(); f.doc.fullscreenEnabled = true; f.card.requestFullscreen = () => gate.promise;
  const media = f.play(); media.metadata(); f.click('全屏'); f.setLive(false); gate.reject(Error('late rejection')); await tick();
  assert.equal(media.src, ''); assert.equal(media.loadCalls, 1); assert.equal(media.listenerCount(), 0); f.handle.dispose();
});
