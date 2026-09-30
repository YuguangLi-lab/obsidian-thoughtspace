# Card Style Preview QA

Base: ThoughtSpace 1.3.22 (`0e34d07`). Development branch: `codex/card-note-ui`.
Date: 2026-09-30. This is an unpublished local preview, not a replacement GitHub release.

## Result

- TypeScript: passed (`tsc --noEmit`).
- Build: passed (`node esbuild.mjs`); generated `styles.css` included.
- Automated suite: 4,215 passed, zero failures or skips.
- Packaging helper tests: 7 passed.
- ESLint: zero errors, 113 warnings; no broad lint cleanup performed.
- `git diff --check`: passed.
- Native Obsidian 1.14.3: 69 assertions passed, plus three pane-metric records. Zero page errors. Thirteen screenshots captured.
- ZIP integrity and exact comparison of packaged runtime files against the tested build: passed.

The native runner creates its own temporary profile and vault, copies the installed Obsidian runtime and local plugin build, and verifies profile/vault isolation. It does not edit the user's vault. Fixtures use production board handlers and real Obsidian DOM; setup selects nodes programmatically, while style choices use Playwright clicks. This is not a physical mouse or mobile-device test. Narrow-pane cases constrain the actual board container to exercise its CSS container queries.

## Covered

- Six style choices, selected state, batch changes, undo/redo, lock guards and style clipboard.
- Index/sticky persistence and actual view reopening.
- Fixed-card preview DOM retained and `scrollTop = 500` unchanged across all decorative styles.
- Native editor instance, draft, cancel behavior and index heading/body geometry.
- Light/dark themes at 0.5x, 1x and 2x; filled folded cards and low-detail summaries.
- Real board panes of 456/420px use three columns; 260px uses two. No choice-label overflow.
- Focused light/dark screenshots visually inspected. A separate browser layout sweep checked 1,854 label measurements across picker widths 172-480px after the 440px breakpoint adjustment.

## Reproduce

```sh
npm test
npm run build
npm run lint
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node qa/card-styles-next/native-run.mjs
```

The native runner requires macOS, an installed Obsidian app with a local versioned runtime, and Playwright. Optional environment overrides: `OBSIDIAN_PATH`, `OBSIDIAN_PROFILE`, and `QA_OUTPUT`. Generated screenshots and `report.json` are in the ignored `dist/card-styles-next` directory by default. Isolated test processes are closed after the run.

## Build Fingerprints

```text
f7798fad3a1e4d8c2cbceaccb5d85554ef5dca02723ee0b4e66b172360808881  main.js
ff362b78964e8ea357da2abe436ed3382df9c0b14701d6d4a74263a1f8e8c0d4  styles.css
c54439a7862c2dc90c3d015ce2defd534295b9b4b63422284fecc3f1cc8ae5d4  manifest.json
b4acb83fa175dfbf7a86404d4e3212d3127ecb22267600a049251864dcf040dc  thoughtspace-1.3.22-card-styles-preview.zip
```

The preview retains manifest version 1.3.22 and has a distinct archive filename. See `PREVIEW-INSTALL.zh-CN.md` for backup, installation, multi-device compatibility and rollback instructions. Earlier versions do not recognize the two new style values; switch them back to an original style before downgrading.
