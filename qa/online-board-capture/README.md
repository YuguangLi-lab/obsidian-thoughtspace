# Online Board Capture Layout QA

`run-layout-qa.mjs` bundles the actual player and web-card modules in an isolated
headless Chrome page with the project CSS. The platform, Obsidian DOM helpers and
icons are test fixtures. It never opens real media or uses an account.

The runner checks 640 x 460, 320 x 300 and 200 x 220 cards, plus a dark theme. It
exercises explicit loading, fresh timestamps, screenshots, failed saves and
idempotent retries. It measures visible button bounds, footer/surface overlap
and status placement, and writes `layout-report.json` plus local PNG captures.

This optional harness requires the repository's installed dependencies and
Playwright. From the repository root:

```sh
npm ci
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node qa/online-board-capture/run-layout-qa.mjs
```

The runner defaults to the locally installed Playwright and its Chromium.
Set `PLAYWRIGHT_MODULE` to an existing Playwright module path and/or `CHROME_PATH`
to a browser executable to reuse an external installation. These optional QA
dependencies do not change the plugin package or lockfile.

This is browser UI verification only. Electron webview playback, authentication,
real Bilibili/YouTube behavior and actual cross-origin video frames still need
Obsidian desktop testing.
