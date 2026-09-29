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
// Serialized into a sandboxed official platform frame. This function must stay
// self-contained and never access cookies, network APIs, or platform internals.
/** @param {string} provider @param {string} expectedUrl @param {string} [action] @param {number} [value] @param {string|null} [expectedMedia] @param {{token:string,seekRevision:number}|null} [expectedCapture] */
export async function onlinePageAction(provider, expectedUrl, action = 'read', value = 0, expectedMedia = null, expectedCapture = null) {
  if (location.href !== expectedUrl) throw new Error('页面已切换，请重新确认视频')
  /** @param {Element|null} element */
  const visible = (element) => {
    if (!element) return false
    const rect = element.getBoundingClientRect()
    if (rect.width <= 100 || rect.height <= 50 || rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth || rect.top >= innerHeight) return false
    for (let parent = element, depth = 0; parent && depth < 32; parent = parent.parentElement, depth++) {
      const style = getComputedStyle(parent)
      if (style.display === 'none' || style.visibility === 'hidden' || (style.opacity !== '' && Number(style.opacity) <= .05)) return false
    }
    return true
  }
  if (document.querySelector('.ad-showing')) return { reason: '广告期间请在播放器操作' }
  if (window.frameElement && !visible(window.frameElement)) return { reason: '视频所在框架不可见' }
  const selectors = provider === 'bilibili'
    ? ['.bpx-player-video-wrap video', '.bilibili-player-video video', '#bilibili-player video']
    : provider === 'baidu' ? ['#video-player video', '.video-js video', '.vp-video video'] : ['#movie_player video']
  let videos = [...new Set(selectors.flatMap((selector) => Array.from(/** @type {NodeListOf<HTMLVideoElement>} */(document.querySelectorAll(selector)))))].filter(visible)
  if (!videos.length) videos = Array.from(document.querySelectorAll('video')).filter(visible)
  if (videos.length !== 1) return { reason: videos.length ? '发现多个可见视频，请只保留要记笔记的播放器' : '请先在播放器打开视频并开始播放' }
  const video = videos[0]
  if (video.readyState < 1 || !Number.isFinite(video.duration) || video.duration <= 0 || !Number.isFinite(video.currentTime)) return { reason: '正在等待视频元数据，直播或无限时长媒体暂不支持同步' }
  // The media URL is used only in memory to reject a stale command; never
  // publish it to the notes renderer, logs, or persisted workspace.
  const media = video.currentSrc || video.src
  if (expectedMedia !== null && media !== expectedMedia) throw new Error('播放文件已变化，请等待重新识别')
  /** @type {import('./online-page.mjs').CaptureIdentity|undefined} */
  let capture
  /** @type {import('./online-page.mjs').CapturedVideoFrame|undefined} */
  let frame
  let capturedTime
  if (action === 'capture' || action === 'capture-probe') {
    if (window.frameElement) return { reason: '嵌套播放器暂不支持视频帧截图，请重新加载当前视频' }
    if (video.readyState < 2 || video.seeking || !video.videoWidth || !video.videoHeight || !media) return { reason: '视频画面尚未就绪或正在跳转，请稍后截图' }
    if (video.mediaKeys) return { reason: '当前视频受 DRM 保护，平台不允许读取视频帧截图' }
    // A weakly scoped marker lives only on this video element. It distinguishes
    // element replacement and native seek events, including seek-away-and-back.
    const key = Symbol.for('thoughtspace.online.capture')
    const marked = /** @type {HTMLVideoElement & {[key:symbol]:{token:string,seekRevision:number}}} */(video)
    let marker = marked[key]
    if (!marker) {
      marker = { token: crypto.randomUUID(), seekRevision: 0 }
      Object.defineProperty(video, key, { value: marker })
      video.addEventListener('seeking', () => { marker.seekRevision++ })
    }
    capture = { token: marker.token, seekRevision: marker.seekRevision }
    if (expectedCapture && (marker.token !== expectedCapture.token || marker.seekRevision !== expectedCapture.seekRevision)) return { reason: '视频元素或播放位置已变化，请重新截图' }
    if (action === 'capture') {
      const sourceWidth = video.videoWidth, sourceHeight = video.videoHeight
      if (!Number.isSafeInteger(sourceWidth) || !Number.isSafeInteger(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0 || sourceWidth * sourceHeight > 16000000) return { reason: '视频画面无效或超过 1600 万像素，暂不能截图' }
      // Draw only the decoded media frame. Never read the page compositor or
      // weaken CORS; a protected or cross-origin canvas must fail visibly.
      const scale = Math.min(1, 1920 / Math.max(sourceWidth, sourceHeight))
      const width = Math.max(1, Math.round(sourceWidth * scale)), height = Math.max(1, Math.round(sourceHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      try {
        const context = canvas.getContext('2d')
        if (!context) return { reason: '浏览器无法创建视频帧画布，请稍后重试' }
        const revision = marker.seekRevision
        capturedTime = video.currentTime
        if (!Number.isFinite(capturedTime) || capturedTime < 0 || capturedTime > 864000 || video.seeking || location.href !== expectedUrl || (video.currentSrc || video.src) !== media) return { reason: '截图前视频来源或播放位置已变化，请重新截图' }
        context.drawImage(video, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/png')
        if (location.href !== expectedUrl || (video.currentSrc || video.src) !== media || marker.seekRevision !== revision || video.seeking || !Array.from(document.querySelectorAll('video')).includes(video)) return { reason: '截图期间视频来源或播放位置已变化，请重新截图' }
        if (!dataUrl.startsWith('data:image/png;base64,') || dataUrl.length > Math.ceil(16 * 1024 * 1024 / 3) * 4 + 22) return { reason: '视频帧编码失败或截图超过 16 MB，请重试' }
        frame = { dataUrl, width, height }
      } catch (error) {
        return { reason: error && typeof error === 'object' && 'name' in error && error.name === 'SecurityError' ? '浏览器禁止读取此视频帧：跨域 CORS 或受保护内容不允许截图' : '读取视频帧失败，请等待画面加载；受保护内容无法截图' }
      } finally { canvas.width = 0; canvas.height = 0 }
    }
  }
  if (action === 'toggle') { if (video.paused) await video.play(); else video.pause() }
  if (action === 'pause') video.pause()
  if (action === 'seek') video.currentTime = Math.min(value, video.duration)
  if (action === 'rate') video.playbackRate = value
  return { time: capturedTime ?? video.currentTime, duration: video.duration, paused: video.paused, rate: video.playbackRate, media, ...(capture ? { capture } : {}), ...(frame ? { frame } : {}) }
}
