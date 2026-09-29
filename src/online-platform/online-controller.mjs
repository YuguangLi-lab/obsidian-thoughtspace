/*!
 * Adapted from Yingjian Video Notes v0.43.0 (2026-09-14).
 * Original modules are preserved in projects/yingjian-video-notes.
 * MIT License
 *
 * Copyright (c) 2026 Yingjian contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */
import { allowsOnlineNavigation, onlineVideoIdentity, parseOnlineVideo } from './online-video.mjs'
import { onlinePageAction } from './online-page.mjs'

/** @typedef {import('./online-video.mjs').ParsedOnlineSource} Source */
/** @typedef {import('./online-page.mjs').MediaSnapshot} Snapshot */
/** @typedef {import('./online-page.mjs').CaptureIdentity} Identity */
/** @typedef {import('./online-controller.mjs').PlatformFrame} Frame */
/** @typedef {import('./online-controller.mjs').OnlineState} State */
/** @typedef {{window:import('./online-controller.mjs').PlatformWindow,source:Source,generation:number,pendingSeek:number|null,polling:boolean,capturing:boolean,state:Omit<State,'sourcePath'>,timer:unknown}} Context */

const capturePixels = 16000000, captureBytes = 16 * 1024 * 1024
/** @param {unknown} value @returns {Identity|undefined} */
function captureIdentity(value) {
  if (!value || typeof value !== 'object') return
  const data = /** @type {Record<string,unknown>} */(value)
  if (typeof data.token !== 'string' || !/^[a-f\d-]{36}$/i.test(data.token) || !Number.isSafeInteger(data.seekRevision) || Number(data.seekRevision) < 0) return
  return { token: data.token, seekRevision: Number(data.seekRevision) }
}

const mediaHosts = {
  bilibili: ['www.bilibili.com', 'bilibili.com', 'm.bilibili.com', 'player.bilibili.com'],
  youtube: ['www.youtube.com', 'youtube.com', 'm.youtube.com'],
  baidu: ['pan.baidu.com'],
}
/** @param {Source['provider']} provider @param {string} url */
function trustedFrame(provider, url) {
  try { return allowsOnlineNavigation(provider, url) && mediaHosts[provider].includes(new URL(url).hostname) } catch { return false }
}
/** @template T @param {Promise<T>} operation @returns {Promise<T>} */
async function bounded(operation) {
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let timer
  try {
    /** @type {Promise<never>} */
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('平台页面暂未响应，请稍后重试')), 2500) })
    return await Promise.race([operation, deadline])
  } finally { clearTimeout(timer) }
}

// Runtime dependencies are injected so navigation, stale results and media
// controls can be tested without a live account or real platform permission.
/** @param {import('./online-controller.mjs').ControllerDependencies} dependencies */
export function createOnlineController({ BrowserWindow, session, shell, getHost, every = setInterval, cancel = clearInterval }) {
  /** @type {Context|null} */
  let current = null
  /** @param {Context} context */
  const alive = (context) => current === context && !context.window.isDestroyed()
  /** @param {Context} context @param {Partial<State>} patch */
  const publish = (context, patch) => {
    if (current !== context || (context.window.isDestroyed() && !patch.closed)) return
    context.state = { ...context.state, ...patch }
    const host = getHost()
    if (host && !host.isDestroyed()) host.webContents.send('online:state', { ...context.state, sourcePath: context.source.path })
  }
  /** @param {Context} context */
  const frames = (context) => {
    const main = context.window.webContents.mainFrame
    return (main.framesInSubtree ?? [main]).slice(0, 12).filter((frame) => trustedFrame(context.source.provider, frame.url))
  }
  /** @param {Context} context @returns {Source|null} */
  const pageSource = (context) => {
    const mainUrl = context.window.webContents.getURL()
    if (!trustedFrame(context.source.provider, mainUrl)) return null
    try {
      const main = parseOnlineVideo(mainUrl)
      if (main.provider === context.source.provider && onlineVideoIdentity(main.path)) return main
    } catch { /* Login/folder pages are not media identities. */ }
    if (context.source.provider !== 'baidu') return null
    /** @type {Map<string,Source>} */
    const sources = new Map()
    for (const frame of frames(context)) {
      try {
        const source = parseOnlineVideo(frame.url)
        if (source.provider === 'baidu' && onlineVideoIdentity(source.path)) sources.set(source.path, source)
      } catch { /* Ignore auxiliary frames. */ }
    }
    return sources.size === 1 ? [...sources.values()][0] : null
  }
  // A URL may navigate away and back while an asynchronous sample is in flight.
  // The generation also invalidates reads started before a newer playback intent.
  /** @param {Context} context @param {number} [generation] */
  const matches = (context, generation = context.generation) => {
    try { return alive(context) && context.generation === generation && pageSource(context)?.path === context.source.path }
    catch { return false /* A destroyed/replaced frame cannot validate an old result. */ }
  }
  /** @param {Context} context @param {Frame} frame @param {string} [action] @param {number} [value] @param {string|null} [media] @param {Identity|null} [expectedCapture] @returns {Promise<Partial<Snapshot>&{reason?:string}>} */
  const invoke = async (context, frame, action = 'read', value = 0, media = null, expectedCapture = null) => {
    if (!alive(context) || !trustedFrame(context.source.provider, frame.url)) throw new Error('播放器已切换')
    const args = [context.source.provider, frame.url, action, value, media, expectedCapture]
    const result = await bounded(frame.executeJavaScript(`(${onlinePageAction.toString()})(...${JSON.stringify(args)})`, action !== 'read'))
    if (!result || typeof result !== 'object') return { reason: '平台尚未返回有效的播放状态' }
    const data = /** @type {Record<string,unknown>} */ (result)
    if (typeof data.reason === 'string') return { reason: data.reason }
    const { time, duration, paused, rate, media: currentMedia } = data
    if (typeof time !== 'number' || !Number.isFinite(time) || typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || typeof paused !== 'boolean' || typeof rate !== 'number' || !Number.isFinite(rate) || typeof currentMedia !== 'string') return { reason: '平台尚未返回有效的播放状态' }
    const capturing = action === 'capture' || action === 'capture-probe', capture = capturing ? captureIdentity(data.capture) : undefined
    if (capturing && !capture) return { reason: '视频帧身份无效，请等待播放器重新同步' }
    /** @type {import('./online-page.mjs').CapturedVideoFrame|undefined} */
    let capturedFrame
    if (action === 'capture') {
      if (!data.frame || typeof data.frame !== 'object') return { reason: '平台未提供可读取的视频帧，请检查视频是否受保护' }
      const frameData = /** @type {Record<string,unknown>} */(data.frame)
      if (typeof frameData.width !== 'number' || typeof frameData.height !== 'number' || !Number.isSafeInteger(frameData.width) || !Number.isSafeInteger(frameData.height) || frameData.width <= 0 || frameData.height <= 0 || frameData.width * frameData.height > capturePixels) return { reason: '视频帧无效或超过 1600 万像素' }
      if (typeof frameData.dataUrl !== 'string' || !frameData.dataUrl.startsWith('data:image/png;base64,') || frameData.dataUrl.length > Math.ceil(captureBytes / 3) * 4 + 22) return { reason: '视频帧编码无效或超过 16 MB' }
      capturedFrame = { dataUrl: frameData.dataUrl, width: frameData.width, height: frameData.height }
    }
    return { time, duration, paused, rate, media: currentMedia, ...(capture ? { capture } : {}), ...(capturedFrame ? { frame: capturedFrame } : {}) }
  }
  /** @param {Context} context @returns {Promise<{frame?:Frame,snapshot?:Snapshot,reason?:string}>} */
  const inspect = async (context) => {
    const results = await Promise.all(frames(context).map(async (frame) => {
      try { return { frame, snapshot: await invoke(context, frame) } } catch { return null }
    }))
    const valid = results.filter((result) => result?.snapshot && Number.isFinite(result.snapshot.time) && Number.isFinite(result.snapshot.duration) && result.snapshot.duration > 0)
    const advertisement = results.find((result) => result?.snapshot?.reason === '广告期间请在播放器操作')
    if (advertisement) return { reason: advertisement.snapshot.reason }
    if (valid.length !== 1) return { reason: valid.length ? '发现多个播放器，暂停同步以免记录错视频' : results.find((item) => item?.snapshot?.reason)?.snapshot.reason ?? '请在官方页面登录并打开视频，等待播放器加载' }
    return valid[0]
  }
  /** @param {Context|null} [context] */
  const read = async (context = current) => {
    if (!context || !alive(context)) return
    let page
    try { page = pageSource(context) } catch { publish(context, { available: false, status: 'waiting', error: '页面正在切换，请稍后重试' }); return }
    if (page?.path !== context.source.path) {
      publish(context, { available: false, status: page ? 'source-changed' : 'waiting', candidate: page,
        error: page ? '平台已切换视频或分 P。请为当前视频创建笔记，原笔记不会改动。' : '请先登录并打开具体视频。网盘分享目录不能作为单个文件的播放身份。' })
      return
    }
    if (context.polling) return
    context.polling = true
    const requestedSource = context.source, generation = context.generation
    try {
      const found = await inspect(context)
      if (context.source !== requestedSource || !matches(context, generation)) return
      if (!found.snapshot) { publish(context, { available: false, status: 'waiting', candidate: null, error: found.reason }); return }
      if (context.pendingSeek !== null) {
        const time = context.pendingSeek
        await invoke(context, found.frame, 'seek', time, found.snapshot.media)
        if (context.source !== requestedSource || !matches(context, generation)) return
        if (context.pendingSeek === time) context.pendingSeek = null
        return
      }
      const { time, duration, paused, rate } = found.snapshot
      publish(context, { available: true, closed: false, status: 'synced', candidate: null, time: Math.max(0, time), duration, paused: Boolean(paused), rate: Number.isFinite(rate) ? rate : 1, error: '' })
    } catch (error) {
      if (context.source === requestedSource && matches(context, generation)) publish(context, { available: false, status: 'waiting', error: error instanceof Error ? error.message : '暂时无法同步平台播放器' })
    } finally { context.polling = false }
  }
  const stop = () => {
    const old = current
    if (!old) return
    cancel(old.timer)
    publish(old, { available: false, closed: true, status: 'closed', candidate: null })
    current = null
    if (!old.window.isDestroyed()) old.window.destroy()
  }
  /** @param {string} sourcePath @param {number} time */
  const queueSeek = (sourcePath, time) => {
    if (!Number.isFinite(time) || time < 0 || time > 864000) throw new Error('无效的播放参数')
    const context = current
    if (!context || !alive(context) || context.source.path !== sourcePath) return false
    const page = pageSource(context)
    // Loading/login pages can retain the user's intent. A different concrete
    // video must still be adopted before any command can affect it.
    if (page && page.path !== sourcePath) return false
    context.generation++; context.pendingSeek = time
    publish(context, { available: false, status: 'waiting', error: '' })
    return true
  }
  /** @param {string} sourcePath @param {import('./online-controller.mjs').OnlineAction} action @param {number} [value] */
  const command = async (sourcePath, action, value) => {
    if (action === 'external') { await shell.openExternal(parseOnlineVideo(sourcePath).path); return true }
    const context = current
    if (!context || !alive(context) || context.source.path !== sourcePath) throw new Error('请先打开对应的平台播放窗口')
    const requestedSource = context.source
    let generation = context.generation
    const stillMatches = () => context.source === requestedSource && matches(context, generation)
    if (action === 'focus') { context.window.show(); context.window.focus(); return true }
    if (action === 'reload') {
      context.generation++; publish(context, { available: false, status: 'loading', candidate: null, error: '' });
      context.window.webContents.reload(); return true
    }
    if (!['toggle', 'pause', 'seek', 'rate'].includes(action)) throw new Error('不支持的播放操作')
    if (['seek', 'rate'].includes(action) && (!Number.isFinite(value) || value < (action === 'rate' ? .25 : 0) || value > (action === 'rate' ? 4 : 864000))) throw new Error('无效的播放参数')
    if (!stillMatches()) throw new Error('页面已切换或尚未定位具体文件，请先确认当前视频')
    generation = ++context.generation
    // An explicit seek supersedes a pending resume request immediately, before
    // either lookup completes, so an old poll cannot jump back afterwards.
    if (action === 'seek') context.pendingSeek = null
    const found = await inspect(context)
    if (!stillMatches()) throw new Error('视频已切换，本次操作已取消')
    if (!found.snapshot) throw new Error(found.reason)
    const result = await invoke(context, found.frame, action, value ?? 0, found.snapshot.media)
    if (!stillMatches()) throw new Error('视频已切换，请重新确认')
    if (!result || result.reason) throw new Error(result?.reason ?? '平台未完成操作')
    if (action === 'rate' && Math.abs(result.rate - value) > .01) throw new Error('平台未接受此倍速，请在官方播放器调整')
    if (action === 'seek') context.pendingSeek = null
    void read(context)
    return true
  }
  /** @param {string} expectedSourcePath */
  const adopt = async (expectedSourcePath) => {
    const context = current
    if (!context || !alive(context) || context.source.path !== expectedSourcePath) throw new Error('播放器已切换，请重试')
    const requestedSource = context.source, generation = context.generation
    const source = pageSource(context)
    if (!source) throw new Error('尚未找到可区分文件的视频地址，请在官方页面打开具体视频')
    const found = await inspect(context)
    if (!alive(context) || context.source !== requestedSource || context.generation !== generation || pageSource(context)?.path !== source.path) throw new Error('页面已切换，请重试')
    if (!found.snapshot) throw new Error(found.reason)
    // Explicit adoption does not rename/merge the previous course or reload.
    context.source = source
    context.generation++
    context.pendingSeek = null
    publish(context, { available: false, candidate: null, status: 'waiting', error: '' })
    return { ...source, initialTime: found.snapshot.time }
  }
  /** @param {string} sourcePath @returns {Promise<{bytes:Uint8Array,time:number}>} */
  const capture = async (sourcePath) => {
    const context = current
    if (!context || !alive(context) || context.source.path !== sourcePath) throw new Error('请先打开对应的平台播放窗口')
    if (!context.state.available || context.pendingSeek !== null || !matches(context)) throw new Error('请等待当前视频时间同步后再截图')
    if (context.capturing) throw new Error('截图正在进行，请稍候')
    const requestedSource = context.source, generation = context.generation, contents = context.window.webContents, main = contents.mainFrame
    const ensure = () => {
      if (context.source !== requestedSource || !matches(context, generation) || contents.mainFrame !== main || context.pendingSeek !== null) throw new Error('截图期间视频已切换或跳转，本次截图已取消')
    }
    context.capturing = true
    try {
      ensure()
      const found = await inspect(context)
      ensure()
      if (!found.snapshot) throw new Error(found.reason)
      if (found.frame !== main) throw new Error('嵌套播放器暂不支持视频帧截图，请重新加载当前视频')
      const before = await invoke(context, main, 'capture-probe', 0, found.snapshot.media)
      ensure()
      if (before.reason || !before.capture || before.time === undefined || before.time < 0 || before.time > 864000 || before.time > Number(before.duration) + .1) throw new Error(before.reason || '视频画面尚未就绪，请稍后截图')
      const sampled = Date.now(), identity = before.capture
      const image = await invoke(context, main, 'capture', 0, before.media, identity)
      ensure()
      if (image.reason || !image.frame || !image.capture) throw new Error(image.reason || '平台未提供可读取的视频帧')
      const after = await invoke(context, main, 'capture-probe', 0, before.media, identity)
      ensure()
      const elapsed = Math.max(0, Date.now() - sampled) / 1000
      let prior = before
      for (const snapshot of [image, after]) {
        if (snapshot.reason || !snapshot.capture || snapshot.media !== before.media || JSON.stringify(snapshot.capture) !== JSON.stringify(identity) || Math.abs(Number(snapshot.duration) - Number(before.duration)) > .1) throw new Error(snapshot.reason || '截图期间视频画面或播放位置已变化，请重新截图')
        const advanced = Number(snapshot.time) - Number(prior.time)
        if (!Number.isFinite(advanced) || Number(snapshot.time) < 0 || Number(snapshot.time) > Math.min(864000, Number(snapshot.duration) + .1) || advanced < -.15 || advanced > (prior.paused ? 0 : elapsed * Math.max(Number(prior.rate), Number(snapshot.rate), 1)) + .35) throw new Error('截图期间播放位置已跳转，请重新截图')
        prior = snapshot
      }
      const encoded = image.frame.dataUrl.slice('data:image/png;base64,'.length)
      if (!encoded || encoded.length % 4 || !/^[A-Za-z\d+/]+={0,2}$/.test(encoded)) throw new Error('视频帧 PNG 编码无效')
      const byteLength = encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0)
      if (byteLength > captureBytes) throw new Error('视频帧超过 16 MB，请等待较低分辨率的画面后重试')
      const decoded = atob(encoded), bytes = new Uint8Array(decoded.length)
      for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index)
      if (!(bytes instanceof Uint8Array) || bytes.length < 24 || bytes.length > captureBytes || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) throw new Error('截图无效或超过 16 MB，请等待较低分辨率的画面后重试')
      const png = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), width = png.getUint32(16), height = png.getUint32(20)
      if (!width || !height || width * height > capturePixels) throw new Error('截图超过 1600 万像素，请等待较低分辨率的画面后重试')
      if (width !== image.frame.width || height !== image.frame.height) throw new Error('视频帧 PNG 尺寸与采样画面不一致，请重新截图')
      ensure()
      return { bytes, time: Number(image.time) }
    } finally { context.capturing = false }
  }
  /** @param {string} input @param {number} [time] */
  const open = (input, time = 0) => {
    const source = parseOnlineVideo(input)
    if (!Number.isFinite(time) || time < 0 || time > 864000) throw new Error('时间无效')
    if (current && alive(current) && current.source.path === source.path && matches(current)) {
      current.generation++; current.pendingSeek = time;
      publish(current, { available: false, status: 'waiting', candidate: null, error: '' });
      current.window.show(); current.window.focus(); return source
    }
    stop()
    const partition = `persist:thoughtspace-online-${source.provider}`
    const ses = session.fromPartition(partition)
    ses.setPermissionRequestHandler((_contents, permission, done) => done(permission === 'fullscreen'))
    ses.setPermissionCheckHandler((_contents, permission) => permission === 'fullscreen')
    /** @param {{preventDefault():void}} event */
    const prevent = (event) => event.preventDefault()
    if (!ses.__thoughtspaceOnlineDownloadsDenied) { ses.on('will-download', prevent); ses.__thoughtspaceOnlineDownloadsDenied = true }
    const target = new BrowserWindow({ width: 1060, height: 760, minWidth: 700, minHeight: 480, title: `${source.name} · 在线播放`, backgroundColor: '#17191d',
      webPreferences: { partition, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false } })
    /** @type {Context} */
    const context = { window: target, source, generation: 0, pendingSeek: time, polling: false, capturing: false, state: { available: false, closed: false, time: 0, duration: 0, paused: true }, timer: null }
    current = context
    target.setMenuBarVisibility(false)
    target.webContents.setWindowOpenHandler(({ url }) => {
      if (allowsOnlineNavigation(source.provider, url)) void target.loadURL(url).catch(() => undefined)
      return { action: 'deny' }
    })
    for (const eventName of ['will-navigate', 'will-redirect']) target.webContents.on(eventName, /** @param {{preventDefault():void}} event @param {string} url */ (event, url) => {
      if (!allowsOnlineNavigation(source.provider, url)) { event.preventDefault(); publish(context, { available: false, status: 'blocked', error: '已阻止非平台页面跳转' }) }
    })
    target.webContents.on('will-attach-webview', prevent)
    target.webContents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => {
      if (isMainFrame) { context.generation++; publish(context, { available: false, status: 'loading', candidate: null, error: '' }) }
    })
    target.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) publish(context, { available: false, status: 'error', error: `平台页面加载失败（${code}），请检查网络或使用浏览器打开` })
    })
    target.on('closed', () => { cancel(context.timer); publish(context, { available: false, closed: true, status: 'closed', candidate: null }) })
    publish(context, { status: 'loading', candidate: null, error: '' })
    void target.loadURL(source.path).catch(() => undefined)
    context.timer = every(() => void read(context), 1000)
    return source
  }
  return { open, stop, command, queueSeek, adopt, capture }
}
