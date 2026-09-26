# UI redesign 1.0.35

## Delivered

- Direct Edit / Text / Fill / Border mode buttons in the single-row floating toolbar. Narrow panes hide label text only; the same controls keep focus.
- Unified card/text action dock above the object, quieter edge ports and an independent lower-corner resize grip. Transparent fills, native body fonts and content/editor geometry are retained.
- Group headers keep expanded content clear and place folded narrow-group controls on two rows. Child disclosure remains visible.
- More-tools uses category navigation beside a searchable command list. Insert separates materials from structure.
- Focused property controls now reveal locally after split-pane resize. Deliberate manual scrolling is preserved.

## Verification

- Build passed; **2,887/2,887** tests, no failures/skips. Added 12 net behavioral tests over 1.0.34.
- Lint: **0 errors, 82 existing warnings**; no warning increase.
- 7 packaging tests, release metadata check and git diff whitespace check passed.
- Actual Obsidian: card/text mode changes preserve draft and range, Markdown formatting/cancel and appearance undo pass. Editor toolbar remains readable at 9 size/zoom combinations.
- Actual Obsidian foreground window: 10 light/dark size states and 596 visible control-center checks passed.
- Resize defect: before 6/15 focused-control transitions clipped in browser replay; after 0/15. All 15 native Obsidian resize cases also passed without changing board data.
- Browser replay of native DOM and actual production modules: 60 format layouts, 500 Tab checks, 240 arrow checks, 120 select-key checks; 80 palette layouts/1,320 controls; 84 object-layout cases. No remaining measured geometry failures.
- Inspected native light/dark screenshots. Waited for theme transitions before final dark capture.
- Main vault: original 37-node board hash unchanged, settings unchanged except allowed recent timestamp. Demo: 24 pre-existing boards and original source note unchanged.
- Runtime assets match across public source/dist, private development source/dist and both installed vaults (6 copies).
- Test-only theme changes restored, background throttling restored, temporary QA global removed. The demo fixture was retained because an additional text object appeared during inspection; user-added content was preserved.

## Limits

Geometry tests use exported native DOM plus production CSS/handlers and complement native checks; they are not a guarantee for every third-party theme or long-term memory behavior. Native console capture in the main vault was initially unattached, then explicitly attached for final inspection and detached afterward. No new runtime errors were captured during final observation. No GitHub push or Release publication was performed.

## Source changes

- `CHANGELOG.md`
- `README.md`
- `README.zh-CN.md`
- `esbuild.mjs`
- `main.js`
- `manifest.json`
- `package-lock.json`
- `package.json`
- `qa/toolbar-stability-09412.cjs`
- `src/board-polish.css`
- `src/branch-controls.css`
- `src/context-toolbar.css`
- `src/inline-node-editor.css`
- `src/interaction-chrome.css`
- `src/main.ts`
- `src/markdown-toolbar.ts`
- `src/object-chrome.css`
- `src/toolbar-overflow.ts`
- `styles.css`
- `tests/markdown-toolbar.test.ts`
- `tests/text-fill-flow.test.ts`
- `tests/toolbar-overflow.test.ts`
- `versions.json`

## Package

`thoughtspace-1.0.35.zip` SHA-256: `e1bdc79690afa87ecf4c1a10885e6b8a21b37d3c9fd7c2a377249524e79a60b6`
