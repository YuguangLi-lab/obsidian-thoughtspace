# Card Editor Native Regression QA

The fixture runs the built plugin in a separate, temporary Obsidian profile and
vault. It never opens or writes a user's notes. Only its own spawned process is
terminated during cleanup.

## Run

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
QA_OUTPUT=dist/card-editor-polish-final \
node qa/card-editor-polish/native-run.mjs
```

To compare a packaged runtime without rebuilding or replacing the workspace
plugin, set `QA_PLUGIN_ROOT` to a folder containing its three runtime files.
Each report records the Obsidian runtime filename and exact plugin build hashes.

The 2026-09-30 integrated run on Obsidian 1.14.3 passed all 48 checks with zero
renderer errors. Its `main.js` SHA-256 is
`0be7e0db0ac414f17e032ea4baf6e4e52b06ac21cedb75089b8ef77dd46ea91f`.
The scoped save unit tests first failed on the original constructor and then
passed with the fix; the focused unit run passed 53 tests.

## Coverage

The native loop checks real keyboard typing, formatting with undo/redo, Wiki
suggestion Escape priority, search modal Escape without cancelling the draft,
keyboard save/cancel, failed-save retry, continued editing after failure,
click-outside save, rapid card switching, composition boundaries, navigation
recovery, and editor/measurement cleanup.

## Confirmed Save Shortcut Defect

After enforcing the window guard below, a fresh 1.3.23 card still failed to save
with Cmd+Enter. The native host consumed the event before inline DOM capture;
the editor was focused, not busy or composing, and its owner was `activeWindow`.
The short native reproduction is the first edit/save step of the full harness.

The production change registers only Ctrl+Enter and Meta+Enter in a scoped save
handler and releases that scope with its editor. It does not register Escape,
undo, redo, bold or italic. Higher popup scopes retain priority. Those other
shortcuts are exercised with real keyboard input, not calls to formatting or
history methods. Unit tests cover save ownership, pending writes, composition,
popup priority, and cleanup.

Composition events and disk failures are injected at the actual native editor
and Vault boundaries. This verifies lifecycle handling, not a physical Chinese
IME, a full disk, mobile Obsidian, or interoperability with arbitrary third-party
plugins. Real OS-level IME testing remains a manual acceptance item.

## Fixture Focus Guard

Obsidian 1.14 can open settings in a separate native window while enabling a
plugin. That window can remain the host's `activeWindow` even when a test focuses
the main page's editor through JavaScript. Under that invalid setup, Escape was
consumed by the wrong window and Wiki suggestions did not open. These were test
fixture errors, not verified plugin defects.

The fixture now waits for setup to settle, closes settings and any other pages
inside its isolated browser context, focuses the main native window, clicks the
board, and explicitly requires `activeWindow === window` before editing.
The published 1.3.23 runtime then passed both Escape and Wiki-suggestion checks.
The exploratory Escape-scope change and its artificial unit tests were removed;
no Escape or Wiki behavior change is claimed from those false reds. The separate
save-key defect above remained reproducible after this correction.

Search dialogs are located in their actual owning Playwright page so future
host versions with native modal windows remain testable. Temporary keyboard
event probes are not part of the retained harness.
