# Expansion Clearance Test Build

Local follow-up, 2026-09-29. Base: `c0189f3284cb64453408c66f47bbf70ff7995f11`.
The build includes the earlier online board capture and media URI fixes.
It is not a published release or an installed vault update.

## Behavior

- Expanded freeboard content and later measured growth trigger incremental
  downward clearance with a 24px gap. Unrelated columns and old unrelated
  overlaps are left alone. Shrinking does not pull neighbors back upward.
- Original group membership is captured before resizing. Inner groups grow
  first, outer groups follow, and outside cards remain outside their old groups.
- Folded groups and branches carry their complete hidden material. A locked
  member pins its movement unit; movable content can clear a fixed obstacle.
- Frame-only resizing, intentional group moves, ordinary dragging, and style
  changes do not trigger automatic clearance.
- The production Session runs the repair after native mindmap reflow and before
  persistence. Expansion and asynchronous measurement share one undo step.
- No file format migration, new settings, dependency, or content rewrite.

## Boundaries

- An explicitly manual mindmap retains its internal positions. A configured
  tree is treated as a whole unit against external obstacles.
- Existing locked mindmap trees retain the native rule that ordinary size
  measurement does not rearrange their internal nodes. Newly revealed locked
  nodes that overlap are rejected.
- Shared overlapping groups, configured trees split across spatial groups,
  locked frames without enough room, or moves that would change group ownership
  fail conservatively. Session restores the entire transaction rather than
  moving locked material or silently rebinding membership.
- This is not a global tidy-on-open operation. Previously overlapping content
  can be folded and expanded to trigger clearance for the affected area.
- Real playback and interaction in the user's original Obsidian vault have not
  been tested. Installed Obsidian is 1.11.7; this repository declares 1.13.7 as
  its minimum supported version.

## Verification

- Full suite: 3,955 passed, zero failed or skipped.
- New coverage: 29 pure layout tests, 8 real Session/measurement/persistence
  integration tests, and a deterministic 120-case geometry/lock/membership test.
- A no-op negative control failed on the original overlap symptom and locked
  frame protection. Original independent review reproductions were rerun after
  repair: intentional group transfer, hidden branch material, and cross-group
  tree collisions all passed or rolled back without changing history.
- TypeScript, build, archive-content verification, and whitespace checks passed.
- ESLint: new module passed; checked production files had 0 errors and 47
  existing main-module warnings. Release verifier unit tests: 7 passed.
- Playwright: 4/4 viewport/zoom cases passed at desktop zoom 0.5, 1, 1.5 and
  390px viewport at zoom 0.5. Each reproduces three old content intersections,
  then verifies zero intersections after expansion and additional growth,
  original group membership, fixed unrelated column, and exact undo/redo.

Screenshots: `before-overlap.png`, `after-expansion.png`, and the measured
viewport images. These use synthetic board DOM and content with real layout,
fold, history, connection geometry, and project styles. They are not screenshots
of the user's vault. Mobile checks canvas coordinates, not a separate layout.

Run with Node.js 22 on PATH and the repository dependencies installed:

```sh
node node_modules/tsx/dist/cli.mjs --test tests/expansion-*.test.ts
node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node qa/online-board-capture/run-layout-qa.mjs
node qa/expansion-layout/run.mjs
node esbuild.mjs
python3 scripts/package.py
python3 -m unittest scripts/test_verify_release.py
```

The browser harness uses Playwright and Chromium; see the setup commands in
`../online-board-capture/README.md`. `PLAYWRIGHT_MODULE` and `CHROME_PATH` can
select existing installations. Its synthetic image is produced by
`node qa/online-board-capture/run-layout-qa.mjs`; run that first if the image is
absent. No account, network media, or user vault is needed.

## Package

`dist/thoughtspace-1.3.13-expand-avoid-overlap-test.zip`

SHA-256: `bdc4f68daf32b89fafa0fbb1d709a940e6609f6f1fa4ca3ed3166eba2eae2bdd`

Both prior named test ZIPs were retained unchanged and their hashes rechecked.
At validation time, no installed plugin, note, or setting was changed, and
nothing had been pushed.
Back up runtime files before installation in a compatible test vault. Replace
only `main.js`, `manifest.json`, and `styles.css`; retain `data.json`, playback
state, references, and attachments. Back up the test `.thoughtspace` board before
trying the new layout behavior; undo also restores the original arrangement.
