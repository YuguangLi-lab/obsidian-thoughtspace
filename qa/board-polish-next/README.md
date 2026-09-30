# Whiteboard and Card Polish QA

This development round targets existing card and whiteboard interactions. It
does not change note formats, migrate vaults, or publish a GitHub release.

## Checks

- `native-run.mjs`: isolated Obsidian profile and generated vault; real pointer,
  keyboard, and wheel input for drag, resize, undo, cancellation, multi-selection,
  locked cards, reading scroll, camera movement, folding, and narrow panes.
- `../card-editor-polish/native-run.mjs`: native Markdown draft input, formatting,
  save/cancel, write failure and recovery, focus changes, and composition guards.
- `../card-interaction-polish.cjs`: production CSS in Chromium, checking paper
  decoration and lock indicators across themes and card states.
- `../card-hover-fade.cjs`: production CSS and hover lifecycle, using real
  pointer transitions to check that disappearing docks no longer intercept cards.
- `tests/board-perf-polish.test.ts`: deterministic endpoint-index work counts and
  live-node correctness across replacement, reordering, deletion, and dense graphs.

Run from the repository root after `npm run build`:

```sh
node qa/board-polish-next/native-run.mjs
node qa/card-editor-polish/native-run.mjs
node qa/card-interaction-polish.cjs
node qa/card-hover-fade.cjs
npm test
npm run lint
```

Set `PLAYWRIGHT_MODULE` to an installed Playwright module path when it is not
available through normal module resolution. `QA_OUTPUT` selects an output folder.
Native harnesses require a local Obsidian installation; they copy its runtime
read-only into a fresh temporary profile and only create synthetic notes. They
verify the active profile path before testing and terminate only the application
process they started. They also close delayed Settings windows within that
isolated application and verify Obsidian's active keyboard window before input.
Reports and screenshots are ignored build artifacts.

An initial Escape failure was traced to a delayed Settings window retaining the
host keyboard context while Playwright sent events to the board window. A clean
window-ownership comparison against the released build ruled out a product
regression. Experimental Escape-scope changes were removed rather than masking
the harness error.

## Evidence Limits

The camera timing sample measures synchronous renderer work on this machine,
not frame rate, physical input latency, or all supported devices. Work-count
reductions describe the edge layer, not the entire board. Narrow desktop panes
are not mobile Obsidian. Synthetic composition and storage-failure probes do not
replace physical Chinese IME or real disk-failure testing. Native runs use the
locally installed Obsidian runtime, not every supported host version or theme.
