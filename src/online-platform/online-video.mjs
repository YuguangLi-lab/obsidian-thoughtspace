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
const names = { bilibili: '哔哩哔哩', youtube: 'YouTube', baidu: '百度网盘' }
/** @param {string} value @param {boolean} [space] */
const hasControls = (value, space = false) => [...value].some(char => char.charCodeAt(0) < (space ? 33 : 32) || char.charCodeAt(0) === 127)
// Validate before WHATWG URL normalization can erase ports, credentials or dot
// segments. The same boundary is used for navigation and redirect Locations.
/** @param {string} input @param {string} [base] */
export function strictOnlineUrl(input, base) {
  if (typeof input !== 'string' || !input || input.length > 4096 || hasControls(input, true) || input.includes('\\') || /%(?![a-f\d]{2})/i.test(input)) throw new Error('平台链接格式无效')
  decodeURIComponent(input) // Reject malformed encoded bytes before URLSearchParams replaces them.
  const absolute = /^https:\/\//i.test(input)
  if (!absolute && (!base || /^[a-z][a-z\d+.-]*:/i.test(input))) throw new Error('只支持完整的 HTTPS 平台链接')
  const authority = /^(?:https:)?\/\/([^/?#]*)/i.exec(input)
  if (authority && (!authority[1] || /[@:%]/.test(authority[1]))) throw new Error('只支持无账号信息和端口的 HTTPS 平台链接')
  const path = (authority ? input.slice(authority[0].length) : input).split(/[?#]/, 1)[0]
  for (const segment of path.split('/')) if (['.', '..'].includes(decodeURIComponent(segment))) throw new Error('平台链接不能包含相对路径片段')
  const url = new URL(input, base)
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('只支持无账号信息的 HTTPS 平台链接')
  return url
}
/** @param {string} input */
function sourceUrl(input) {
  if (typeof input !== 'string' || input.length > 4096 || hasControls(input)) throw new Error('请输入有效的视频链接')
  const text = input.trim(), links = [...text.matchAll(/https:\/\/[^\s<>"，。]+/g)]
  if (links.length > 1) throw new Error('请一次只粘贴一个视频链接')
  return strictOnlineUrl(links[0]?.[0] ?? text)
}
/** @param {string} input @returns {import('./online-video.mjs').ParsedOnlineSource} */
export function parseOnlineVideo(input) {
  const url = sourceUrl(input)
  for (const key of ['v', 'p', 't', 'start', 'surl', 'shareid', 'uk', 'fsid', 'path']) if (url.searchParams.getAll(key).length > 1) throw new Error('视频链接的来源或时间参数重复')
  if (url.searchParams.has('t') && url.searchParams.has('start')) throw new Error('请只保留一个视频开始时间参数')
  let provider, id, canonical
  if (['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) {
    id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.pathname === '/watch'
      ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)\/?$/)?.[1]
    if (!/^[\w-]{11}$/.test(id ?? '')) throw new Error('请粘贴单个 YouTube 视频链接，不是频道或播放列表')
    provider = 'youtube'; canonical = `https://www.youtube.com/watch?v=${id}`
  } else if (['www.bilibili.com', 'bilibili.com', 'm.bilibili.com'].includes(url.hostname)) {
    id = url.pathname.match(/^\/video\/(BV[\w]{10}|av\d+)\/?$/)?.[1]
    if (!id) throw new Error('请粘贴含 BV 或 av 编号的 B 站完整视频链接')
    provider = 'bilibili'; canonical = `https://www.bilibili.com/video/${id}/`
    const page = Number(url.searchParams.get('p') ?? 1)
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new Error('B 站分 P 参数无效')
    if (page > 1) canonical += `?p=${page}`
  } else if (url.hostname === 'b23.tv') {
    throw new Error('请先在浏览器打开 b23.tv 短链接，再复制含 BV 编号的完整地址')
  } else if (url.hostname === 'pan.baidu.com') {
    if (!/^\/s\/[\w-]+\/?$/.test(url.pathname) && !['/share/init', '/share/link', '/disk/main', '/disk/home', '/play/video', '/pfile/video'].includes(url.pathname)) throw new Error('请粘贴百度网盘分享页或视频页面地址')
    provider = 'baidu'; id = '网盘视频'
    const safe = new URL(url.origin + url.pathname)
    // Allowlist navigation fields instead of preserving arbitrary hash tokens.
    for (const key of ['surl', 'shareid', 'uk', 'fsid', 'path']) {
      const value = url.searchParams.get(key)
      if (value) safe.searchParams.set(key, value)
    }
    const fragment = url.hash.slice(1).split('?')
    if (['/video', '/all', '/my', '/home'].includes(fragment[0])) {
      const fields = new URLSearchParams(fragment.slice(1).join('?')), kept = new URLSearchParams()
      for (const key of ['path', 'fsid', 'shareid', 'uk']) if (fields.getAll(key).length > 1) throw new Error('网盘链接的来源参数重复')
      for (const key of ['path', 'fsid', 'shareid', 'uk']) if (fields.get(key)) kept.set(key, fields.get(key))
      safe.hash = fragment[0] + (kept.size ? `?${kept}` : '')
    }
    canonical = safe.href
  } else throw new Error('目前支持哔哩哔哩、YouTube 和百度网盘链接')
  const rawTime = url.searchParams.get('t') ?? url.searchParams.get('start') ?? '0'
  const parts = rawTime.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  const time = /^\d+(?:\.\d+)?$/.test(rawTime) ? Number(rawTime)
    : parts && rawTime ? Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0) : NaN
  if (!Number.isFinite(time) || time < 0 || time > 864000) throw new Error('视频开始时间无效')
  let label = id
  if (provider === 'bilibili') label += ` · P${new URL(canonical).searchParams.get('p') ?? 1}`
  if (provider === 'baidu') {
    const clean = new URL(canonical), hashFields = new URLSearchParams(clean.hash.split('?')[1] ?? '')
    const filePath = clean.searchParams.get('path') ?? hashFields.get('path')
    const fileId = clean.searchParams.get('fsid') ?? hashFields.get('fsid')
    if (filePath) label = filePath.split('/').filter(Boolean).at(-1) ?? id
    else if (fileId) label = `文件 ${fileId}`
  }
  return { path: canonical, mediaUrl: '', name: `${names[provider]} · ${label}`, provider, initialTime: time, kind: 'online' }
}

// A folder/share URL is not a file identity. Never attach its next video to the
// previous video's timestamps merely because the page URL stayed the same.
/** @param {string} input */
export function onlineVideoIdentity(input) {
  const source = parseOnlineVideo(input)
  if (source.provider !== 'baidu') return source.path
  const url = new URL(source.path), [route, query = ''] = url.hash.slice(1).split('?')
  if (!['/play/video', '/pfile/video'].includes(url.pathname) && route !== '/video') return null
  const fields = route === '/video' ? new URLSearchParams(query) : url.searchParams
  if (!fields.get('fsid') && !fields.get('path')) return null
  return source.path
}

/** @param {string} input */
export function isBilibiliShortLink(input) {
  try {
    const url = sourceUrl(input)
    return url.hostname === 'b23.tv' && /^\/[A-Za-z0-9]+\/?$/.test(url.pathname)
  } catch { return false }
}

/** @param {import('./online-video.mjs').OnlineProvider} provider @param {string} input */
export function allowsOnlineNavigation(provider, input) {
  try {
    const url = strictOnlineUrl(input)
    const hosts = {
      youtube: ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'accounts.google.com', 'consent.youtube.com', 'consent.google.com'],
      bilibili: ['www.bilibili.com', 'bilibili.com', 'm.bilibili.com', 'passport.bilibili.com', 'player.bilibili.com'],
      baidu: ['pan.baidu.com', 'passport.baidu.com', 'wappass.baidu.com'],
    }
    return (hosts[provider] ?? []).includes(url.hostname)
  } catch { return false }
}
