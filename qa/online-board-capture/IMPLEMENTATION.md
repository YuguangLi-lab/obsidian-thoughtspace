# Whiteboard Online Capture Test Build

Base: `c0189f3284cb64453408c66f47bbf70ff7995f11` (1.3.13).
Branch: `codex/online-board-capture`.
This is a local test build, not a published GitHub release. Release version
metadata remains unchanged.

## Behavior

- Bilibili and YouTube web cards have an explicitly loaded, isolated player.
- The card footer exposes timestamp and frame capture without opening a sidebar.
- Timestamps are read fresh from the verified source. Screenshots retain their
  actual frame time and the existing platform capture checks.
- Captures append to regular Markdown media notes and create adjacent board text
  cards with source connections. Images remain ordinary PNG attachments.
- Timestamp links in board previews seek the corresponding source card. Native
  editor links and modifier clicks retain their normal behavior.
- Saving retries reuse the same moment and image. Pending failed captures remain
  in memory only while their card is mounted; they are not crash recovery.
- Source/part changes, stale board owners, locked nodes and closed players are
  checked. A note saved while the board changes is kept without writing another
  board. Unmounting disposes the isolated guest.

## Verification

- TypeScript check: passed.
- Functional suite: 3,902 passed, zero failed or skipped.
- Release verification script unit tests: 7 passed.
- Build and archive-content verification: passed using existing build/package
  scripts; ZIP entries match the built source files.
- Changed production modules: ESLint zero errors; 54 existing-style warnings.
- Browser UI: all four size/theme scenarios passed, with no browser errors,
  overlapping player/footer, horizontal overflow, or out-of-bounds buttons.
  See `layout-report.json` and the repeatable harness in this directory.

Tests include source/part swaps during acquisition, disposal during capture,
failed-save retry, capture-phase click handling and uninterrupted rendering when
capture adds an edge with the board preview limit already saturated.

## Installation And Remaining Acceptance

The test archive is `dist/thoughtspace-1.3.13-online-board-capture-test.zip`.
Its SHA-256 is
`2fbae428a9cf7172cb355f2b7061fd8c5efb032ada45247add4ac051c8790aaa`.

The archive contains a `thoughtspace/` directory. In a compatible test vault,
back up the existing plugin's `main.js`, `manifest.json` and `styles.css`, replace
only those runtime files with this build, and reload the plugin. Preserve
`data.json`, `media-playback.json` and all existing notes and attachments.
The repository requires Obsidian 1.13.7 or newer.

No installed plugin or user vault was changed. Live Electron playback, platform
login/consent, and real Bilibili/YouTube video-frame capture have not been tested
in this environment. Browser QA uses the actual module and CSS with a synthetic
platform, and cannot establish that every online video allows frame capture.
