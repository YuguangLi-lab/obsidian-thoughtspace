# External content-fold controls: local verification

This records the first local stage. Final 1.3.26 validation and release scope: [release checks](RELEASE-1.3.26.md).

Base: release/1.3.25, `8d79f2657c1980cdd3643d5dded81e15611ba55b`.
These are subsequent uncommitted local changes. No version/tag/release/default-branch update was made.

## Behavior

- PDF, audio, video, webpage, sub-board and section content-fold buttons use the external card-action dock. Existing note/text/image actions remain available. Compact note/text expansion remains inline as before.
- The preferred external gap is at least 24 screen pixels (or the existing 20 world pixels at larger zoom). Viewport boundaries, floating chrome, ports and nearby mounted node bodies constrain placement.
- Selected, hovered, focused and compact objects avoid nearby nodes. Containing groups reserve their frame rather than their entire interior. This does not change connected-child disclosure semantics or its separate control's location.
- The pointer corridor remains geometry-only; no overlay intercepts children or connection ports.
- A focused content-fold control regains focus on the inverse action after node reconstruction and DOM ordering. Locked controls remain disabled.

Implementation: `src/main.ts`, `src/card-control-layout.ts`, new `src/fold-control-obstacles.ts`, `src/web-card.ts`, `src/object-chrome.css`, generated `styles.css`. Regression coverage: new `tests/fold-control-obstacles.test.ts`, extended `tests/preview-reuse-flow.test.ts`, and DOM/placement fixture updates in node-position, node-resize and online-board-render-key tests.

## Checks

- `npm test`: 4,471 passed, zero failures. Includes 13 additional geometry/focus regressions.
- `npm run build`: passed TypeScript checking and bundle/CSS generation.
- `npm run lint`: zero errors, 118 existing warnings.
- `python3 -m unittest discover -s scripts -p 'test_*.py'`: 7 passed.
- `git diff --check`: passed.

Native host: Apple M4 Pro, 48 GiB, macOS 27.0, Obsidian 1.13.7 in the isolated QA profile/vault. CLI Node 24.13.0. No real notes or real-vault installation changed.

Run `qa/fold-controls-native.cjs` with the locally installed Playwright module supplied by `PLAYWRIGHT_MODULE`. The script requires the exact sibling `thoughtspace-qa-vault` path and CDP port 9237. It creates only synthetic `qa-fold-*` notes/boards and uses existing synthetic `media/fixture.*` files. It installs the local runtime only in that temporary vault.

The final native matrix passed all 54 combinations: text, note, image, PDF, audio, video, sub-board, section and webpage; 50%, 100% and 250% zoom; adjacent children to the left/right. Each combination performs two actual pointer fold/unfold cycles, checks button hit testing and dock/body/child intersections, and asserts connected child geometry remains unchanged and visible. Each setup is flushed and read back through the plugin's board parser.

Additional native checks passed: hover across the external gap, keyboard fold/unfold with restored focus, unselected compact-dock avoidance, node drag, separate connected-child folding/unfolding, direct child selection, locked disabled state, light/dark themes and a 420 CSS-pixel pane. Final screenshots were inspected after capture.

Early test runs exposed a real focus loss when DOM ordering moved a newly focused node; restoration now occurs after that ordering pass. A separate QA fixture error put card-only `autoFit` on other types. That fixture was corrected, and only synthetic boards produced by this script were repaired before the final successful run. These fixture errors are not reported as plugin save bugs.

## Local evidence and limits

- `dist/fold-controls-native/report.json`: 54 case records and additional checks.
- `dist/fold-controls-native/wide-light.png`, `wide-dark.png`, `narrow-dark.png`: actual temporary-vault screenshots.
- Logs: `/tmp/thoughtspace-fold-tests.log`, `/tmp/thoughtspace-fold-build.log`, `/tmp/thoughtspace-fold-lint.log`, `/tmp/thoughtspace-fold-native.log`.

Screenshots remain local because Library upload was unavailable in this environment. Web preview network requests are aborted; this verifies webpage-card controls, not third-party embedded content. This is a Mac desktop check, not mobile or touch validation. Arbitrarily overlapping/full canvases may have no collision-free position; the existing placement algorithm then minimizes overlap. No new large-board performance claim is made. The independent 1.3.24 performance baseline is unchanged.
