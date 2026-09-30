# Whiteboard interaction and persistence debugging

This pass preserves the paper workbench, the vertical tool panel on the left,
and the canvas space gained by removing the added header row. The first pass
repairs eleven confirmed interaction issues. The follow-up covers six additional
classes of saving, source-validation and synchronization races; it does not claim
every plugin feature has been exhaustively tested.

| Trigger | Before | Repair and regression |
| --- | --- | --- |
| Right drag crosses the threshold and returns before its queued frame renders | The final position can turn the drag into a click and open a menu. | Latch the crossed threshold in the real pointer handler. |
| A connection-port drag crosses the threshold and returns in the same batch | Drag intent can be lost, including accidental child creation on mind-map ports. | Latch movement before frame coalescing; test real pointer methods and mind-map creation. |
| A connection drag drops back onto its source node or port | The excluded source is treated as empty canvas and an extra text/topic and edge are created. | Check the final source hit before creating content; retain creation on actual blank canvas. |
| Cancel drawing a group after selecting an edge | The previous edge selection disappears. | Save and restore the edge alongside the marquee's base node selection. |
| Shift with an already horizontal wheel delta | The canvas receives zero movement. | Preserve horizontal input when the vertical delta is zero; retain speed and direction preferences. |
| Ctrl/Command+Enter with focus in the detached format controls | The unsaved draft remains open. | Apply the same editor ownership boundary to its save scope; preserve IME, popup priority and pending-save guards. |
| Escape closes a menu in a short pane | The restored trigger can be outside the shorter left rail. | Reveal focus locally after the footer and measured rail dimensions settle. |
| Short menu headers/search/category rows fill the available height | First/last tools and keyboard-selected results can be clipped or impossible to click. | Scroll the entire short palette and reveal focus after its viewport changes. |
| The remaining canvas is about 98 pixels tall | A zero-height rail or reserved footer space makes tools unreachable. | Keep a minimum rail viewport and temporarily use the footer/minimap space while a short palette is open. |
| Convert folded text into a note | Saving succeeds, but a new Session rejects the folded note's height. | Keep its 72px folded height and place the larger note size in its expanded height. |
| Convert a video-capture text into a note | The text-only provenance field remains on a note card and prevents reopening. | Remove incompatible provenance from the card, retain the Markdown source citation, and preserve undo/redo. |

Every code fix has regression coverage using production methods or modules.
The conversion tests use the actual Session save queue and reopen saved bytes
with a new Session, including undo and redo. The editor and pointer cases were
first reproduced as failing tests before their fixes.

## Follow-up race debugging

| Trigger | Before | Repair and regression |
| --- | --- | --- |
| Close the last whiteboard view and acquire the same file one or two microtasks later | The earlier release removes the session acquired by the new view; later views and external notifications use a different session. | Renew the cached Promise identity without creating another Session or reading again; test actual view subscription and final cleanup. |
| Open card editing while the native Markdown window is already saving | Obsidian's `save()` returns before the running/save-again write completes, so card editing incorrectly reports a newer native edit. | Wait only for a confirmed pending save, for at most one additional second; revalidate the source and native windows throughout. Use the workspace clock so closing a source popout cannot strand the wait. |
| Delete, replace, rename or edit an image during binary reading or upload | An old upload URL can be attached to a changed local source. | Recheck file identity, path, mtime and size before starting upload and before attaching its result; no real external image-host requests are made by the tests. |
| Delete, replace, rename or edit an excerpt source during reading or queued evidence writing | Stale text or a dangling citation can be appended successfully. | Revalidate source identity/path/stamp after reads and at the target note's atomic write boundary; cover Markdown and PDF preparation, reading and queued processing. |
| Pan the canvas while an external whiteboard read is pending | Accepting external content briefly replaces the moving camera with the external viewport. | Accept the external objects and baseline while preserving a camera moved during the read; test actual left/right release and cancellation, final CAS saving and fresh parsing. |
| Middle-button drag on the native Linux canvas | Chromium pastes the primary selection after release and creates an unintended text object; cancelling auxiliary click alone is insufficient. | Cancel release and auxiliary-click defaults only for middle gestures owned by the canvas; retain clipboard shortcuts and editable/link behavior. The native fixture seeds and restores the primary selection and checks exact final object IDs. |

The session ownership and slow native-save failures were also reproduced against
the previous installed build in official Obsidian. The follow-up native fixture
checks shared-view nudge/undo/redo, native middle-button panning while an external
read is gated in both input orders, native Markdown auto-save, card editing and
final file contents. Visual inspection caught the unexpected middle-paste objects;
the fixture now checks object IDs and native paste events explicitly.
The gates delay actual host Vault operations; source and editing methods remain
unchanged. Generated fixture files and any fixture recovery files are audited and
removed after queues settle.

## Validation

- Full regression: **4,437/4,437 passed**, with no failures, skips or cancellations.
- Packaging/support scripts: **7/7 Python tests passed**.
- Chromium workbench/short-menu fixture: **647/647 passed**, no uncaught errors.
- Chromium card gesture fixture: **73/73 passed**.
- Native Obsidian deep scenarios: **159/159 passed**, with 22 screenshots, no
  runtime errors and no unexpected plugin warnings. Both explicitly controlled
  source-editor warnings were expected and recorded separately.
- Native paper-workbench regression: **127/127 passed**, with 25 screenshots
  covering light/dark themes, narrow/short panes, selection, editing and search.
  The final native editor and short-menu screenshots were inspected visually,
  as were the final light/dark workbench views.
- Native session/save/primary-selection regression: **42/42 passed**, with one
  screenshot, no runtime errors or plugin warnings. The exact object count and
  native event log confirm both middle-drag sequences create no extra objects.
  All three native scripts use the same installed build. Total native checks:
  **328**.
- TypeScript/build and lint passed; lint retains the baseline's 118 warnings
  and reports zero errors. Generated CSS and the packaged runtime are checked
  against their sources and the native-tested build.

Use Node.js 22 and the lockfile dependencies:

```sh
npm run build
npm run lint
npm test
git diff --check
CHROME_EXECUTABLE=/usr/bin/chromium QA_OUTPUT=dist/deep-debug-browser node qa/paper-workbench.cjs
node qa/card-gesture-selection.cjs
```

The browser fixture uses production chrome, CSS and interaction methods, with
Obsidian services, rendering details and persistence supplied by fixtures.
Its short-menu checks include light/dark themes, real pointer hit targets,
first/last action focus, return to search and Escape returning to the left rail.

The native checks use official Obsidian desktop 1.13.7 and an isolated vault at
`/workspace/.thoughtspace-native/vault`. Reinstall and reactivate the final
build before each script:

```sh
cp main.js styles.css manifest.json /workspace/.thoughtspace-native/vault/.obsidian/plugins/thoughtspace/
node /workspace/.thoughtspace-native/activate-plugin.mjs 'ThoughtSpace/纸张工作台.thoughtspace'
node qa/deep-debug-native.cjs
node /workspace/.thoughtspace-native/activate-plugin.mjs 'ThoughtSpace/纸张工作台.thoughtspace'
node qa/paper-workbench-native.cjs
node /workspace/.thoughtspace-native/activate-plugin.mjs 'ThoughtSpace/纸张工作台.thoughtspace'
node qa/session-native.cjs
```

[`deep-debug-native.cjs`](deep-debug-native.cjs) uses real native pointer and
keyboard input, actual CodeMirror and textarea editing, and actual Markdown
files. Host APIs provide focus, theme/window changes and disposable fixture
setup/restoration. Two controlled missing-API cases temporarily remove and
immediately restore the Markdown embed factory before native editor discovery;
their expected warnings are recorded separately.

For deterministic same-frame regressions, a native no-op animation-frame marker
holds the view's pending pointer batch until real pointer release flushes it.
The pointer handlers and geometry calculations are unchanged. Conversion uses
the real context menu and naming modal. A new native Session reads a separate
copy of the persisted bytes so the existing view's cache cannot hide invalid
data; undo and redo are actual keyboard shortcuts.

Reports include tested build hashes, assertions, geometry, runtime errors and
screenshots in ignored `dist/deep-debug-browser`, `dist/deep-debug-native` and
`dist/paper-workbench-native` and `dist/session-native` directories. Native scenarios restore original
fixture notes and the board, and remove only their registered generated files.
These runs cover the default desktop host appearance; mobile and third-party
themes/plugins were outside this pass.

[`session-native.cjs`](session-native.cjs) uses actual native Session acquisition
and two whiteboard views, keyboard nudge/undo/redo, actual Markdown saving and
real middle-button dragging. Note-specific `vault.modify` and board-specific
`vault.read` gates make pending-save and external-update races repeatable. On
Linux it temporarily seeds the primary selection with known fixture text and
restores the original selection. The input event log records state at capture,
before the canvas handlers; its flags are observations rather than final default
cancellation assertions. The absence of canvas paste and exact final object IDs
verify the platform behavior after handlers run.

The ZIP from `python3 scripts/package.py` is a local test build. No version,
release tag or remote publication is created by these checks.
