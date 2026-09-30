# Table Outer Frame Regression

Native verification uses the locally installed Obsidian runtime in a new temporary
profile and vault. It copies the real plugin build without modifying the user's
vault, and terminates only the isolated process it launches.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
QA_OUTPUT="$PWD/dist/table-frame-next/green" \
node qa/table-frame-next/native-run.mjs
```

## Verified Results

Runtime: Obsidian 1.14.3. Results are under `dist/table-frame-next`.

- RED: 130 passed, 9 failed. Selected tables had a 1 px green outline;
  editing tables had a 2 px outline. Native table widgets started 16 px left
  of the visible editor, clipping the first column.
- GREEN: 166 passed, 0 failed. Includes the original frame checks plus
  explicit left/right-edge and ordinary-text-frame checks, and actual native cell
  typing, cancel, commit, and disk persistence.
- Light and dark themes cover unselected, selected, fixed-size editing,
  automatic-size editing, and the production `newTable()` flow.
- Grid lines remain present; expanded table node border, shadow, outline,
  default background, and body padding are absent. Ordinary text frames remain.

The counts differ because additional regression checks were added after RED.
The RED and GREEN reports preserve their respective build hashes and DOM metrics.
Both runs used unchanged `main.js` SHA-256
`f7798fad3a1e4d8c2cbceaccb5d85554ef5dca02723ee0b4e66b172360808881`.
GREEN stylesheet SHA-256 is
`960e5eee74027bf9e076658b5a69eb63a99f259abb145b551d9ef8e753ca79b6`.

The separate `gutter-probe/report.json` records a one-variable, in-memory
experiment: changing only the root native editor scroller's `scrollbar-gutter`
from `stable` to `auto` restores its client width from 178 to 193 px, matching
the 192.86 px table. No vertical overflow existed. The remaining 16 px horizontal
overflow was traced to Obsidian's `.table-col-btn` (`aria-label`:
`\u5728\u53f3\u4fa7\u65b0\u589e\u5217`), the native add-column button, rather than the table grid.
Run `node qa/table-frame-next/native-run.mjs --gutter-probe` with a separate
`QA_OUTPUT` directory to capture these diagnostic metrics.

## Scope

This is native Obsidian rendering and editing with deterministic fixture
selection and synthetic Playwright input, not physical keyboard/mouse testing.
The native editor's blank caret-entry lines above and below a table remain.
Its horizontal scrollbar remains available for the native add-column control;
the default table grid itself fits within the visible editing viewport.
Manual node dimensions and saved document contents are
not migrated or rewritten by this CSS fix.
