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
import { isBilibiliShortLink, parseOnlineVideo, strictOnlineUrl } from './online-video.mjs'

/** @param {string} input @param {import('./online-resolver.mjs').RedirectFetcher} [fetcher] */
export async function resolveOnlineVideo(input, fetcher = globalThis.fetch) {
  if (!isBilibiliShortLink(input)) return parseOnlineVideo(input)
  let url = strictOnlineUrl(input.trim().match(/https:\/\/[^\s<>"，。]+/)?.[0] ?? input.trim())
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    for (let redirects = 0; redirects <= 5; redirects++) {
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['b23.tv', 'www.bilibili.com', 'bilibili.com', 'm.bilibili.com'].includes(url.hostname)) throw new Error('短链接跳转到非 B 站页面，已停止')
      if (url.hostname !== 'b23.tv') return parseOnlineVideo(url.href)
      if (redirects === 5) throw new Error('B 站短链接跳转次数过多')
      const response = await fetcher(url.href, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: controller.signal })
      await response.body?.cancel()
      const location = response.headers.get('location')
      if (![301, 302, 303, 307, 308].includes(response.status) || !location) throw new Error('无法展开 B 站短链接，请复制浏览器中的完整视频地址')
      url = strictOnlineUrl(location, url.href)
    }
    throw new Error('B 站短链接跳转次数过多')
  } catch (error) {
    if (controller.signal.aborted) throw new Error('短链接解析超时，请复制 B 站完整视频地址')
    throw error
  } finally { clearTimeout(timeout) }
}
