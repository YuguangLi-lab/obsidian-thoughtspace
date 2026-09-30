# Historical paper-workbench design and visual checks

> This records the original 1.3.24 design, which was withdrawn at the user’s request. The replacement 1.3.24 restores 1.3.23 visuals and retains the interaction fixes. See [UI restoration checks](ui-restoration.md) for the replacement build.

The redesign gives the board a warm paper workbench while preserving space for
the canvas. It retains Obsidian's existing title bar and adds no full-width
workbench row. A compact vertical tool panel floats on the left of the canvas;
the new-card action is its **＋** button. The top contextual formatting panel
appears only when an object is selected. View controls have a separate dock at the
lower right. Viewport fitting reserves space beside the left tool panel and below
visible formatting controls.
Materials and board creation remain in the existing Obsidian sidebar/ribbon and
workspace or command menus.

The material navigator, empty state, focus outlines, card actions and default
card surfaces share the same palette and visual hierarchy. Light and dark themes
have separate paper colors. Authored fills, transparency and card styles remain
available.

## GitHub design references

These projects informed the placement and grouping of controls. The warm paper
palette and ThoughtSpace layouts are our design; no source code was copied.

| Reference | Pattern applied |
| --- | --- |
| [Excalidraw Island styles](https://github.com/excalidraw/excalidraw/blob/35e854ecf7a1ace3467922965ce07ec1a6f0ea54/packages/excalidraw/components/Island.scss#L2) | Rounded floating panels with restrained shadows and spacing between tool groups; ThoughtSpace places its main panel vertically on the left. |
| [tldraw contextual toolbar](https://github.com/tldraw/tldraw/blob/050cd7235060d8e346098c88e1fae2c8809a51c6/packages/tldraw/src/lib/ui/components/primitives/TldrawUiContextualToolbar.tsx#L18) | A separate floating panel exposes formatting when it applies to selected objects. |
| [tldraw navigation panel](https://github.com/tldraw/tldraw/blob/050cd7235060d8e346098c88e1fae2c8809a51c6/packages/tldraw/src/lib/ui/components/NavigationPanel/DefaultNavigationPanel.tsx#L45) | Give camera and zoom controls their own dock. |
| [tldraw note shape](https://github.com/tldraw/tldraw/blob/050cd7235060d8e346098c88e1fae2c8809a51c6/packages/tldraw/src/lib/shapes/note/NoteShapeUtil.tsx#L364) | Subtle paper depth makes cards legible against the canvas. |

## Build and regression checks

Use Node.js 22 and install the lockfile dependencies before running from the
repository root:

```sh
npm ci
npm run lint
npm test
npm run build
git diff --check
```

The build assembles `styles.css` from the CSS sources, including
`paper-workbench.css`, `paper-selection.css` and `paper-library.css`.
`tests/workbench-viewport.test.ts` checks available canvas space beside the left
tool panel and below visible contextual formatting.

Final regression result: **4,437/4,437 tests passed**. TypeScript checking, build
and `git diff --check` passed. Lint reported zero errors and 118 warnings, the
same warning count as the baseline.

## Chromium fixture

Run after building:

```sh
CHROME_EXECUTABLE=/usr/bin/chromium \
PLAYWRIGHT_MODULE=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright \
node qa/paper-workbench.cjs
```

`PLAYWRIGHT_MODULE` can point to another installed Playwright package. Set
`CHROME_EXECUTABLE` to the Chromium binary available on your machine. Browser
execution needs local process and socket access.

Final Chromium result: **647/647 checks passed**, with no uncaught exceptions.
Its 96 accent and host-text-color contrast checks measured a minimum ratio of
4.82:1 for the primary action labels. The fixture checks
light/dark themes across desktop, narrow, small and short windows. It checks
tool-panel boundaries, overlap, horizontal overflow, actual pointer hit targets,
keyboard navigation, insert/arrange actions, selection formatting, dragging,
resizing, editing entry and empty-state actions.

It extracts workspace chrome from the production `BoardView.onOpen`, uses the
production stylesheet and pointer/tool helpers, and sends real Chromium input.
Obsidian APIs, note previews, formatting contents and persistence are fixtures.
The native checks below validate the desktop host and Markdown editor separately.

Reports and screenshots are generated in the ignored
[`dist/paper-workbench/`](../dist/paper-workbench/) directory. `QA_OUTPUT`,
`QA_SOURCE` and `QA_CSS` override their output, source and stylesheet paths.
The latest run used `QA_OUTPUT=dist/deep-debug-browser`; its
[`report.json`](../dist/deep-debug-browser/report.json) includes the short-menu
and extreme-pane regressions. Additional debugging and persistence checks are
recorded in [`deep-debug.md`](deep-debug.md).
`QA_ONLY_SCREENSHOTS=1` produces screenshots without assertions; it was used for
the previous-layout comparison in
[`dist/paper-workbench-before/`](../dist/paper-workbench-before/).

## Native Obsidian visual and editing checks

This validation uses the official **Obsidian desktop 1.13.7** Linux application,
with the built plugin loaded in a disposable vault. The downloaded AppImage's
SHA-256 matched its official GitHub release digest:
`e0d8e0a611624de8c9c7dcd8a9e648279fb0a0d552faa1312b7e4f3a5fa72663`.

Before running [`paper-workbench-native.cjs`](paper-workbench-native.cjs), start
Obsidian with CDP enabled, activate ThoughtSpace in
`/workspace/.thoughtspace-native/vault`, open the prepared seven-object paper
workbench board, and expose its active `BoardView` as `window.qaView`. The fixture
must contain a plain Markdown card, a text object and a styled Markdown card. The
script checks the vault path before writing and restores the board and linked
note contents afterward. Use the disposable vault rather than personal notes.

In the prepared cloud environment, copy the latest build into the fixture plugin
folder and activate it before running the checks:

```sh
cp main.js styles.css manifest.json /workspace/.thoughtspace-native/vault/.obsidian/plugins/thoughtspace/
node /workspace/.thoughtspace-native/activate-plugin.mjs 'ThoughtSpace/纸张工作台.thoughtspace'
OBSIDIAN_CDP=http://127.0.0.1:9222 node qa/paper-workbench-native.cjs
```

The activation helper and official application are environment setup artifacts,
outside the repository. `OBSIDIAN_CDP` overrides the CDP endpoint; `QA_OUTPUT`
overrides the default `dist/paper-workbench-native` output folder.

Native result: **127/127 checks passed**, with 25 screenshots, no runtime errors
and no unexpected warnings. The final run's individual
assertions, geometry and runtime details are recorded in
[`report.json`](../dist/paper-workbench-native/report.json).

Checks use real host pointer and keyboard input for note/text/multiple selection,
insert and more palettes, keyboard focus, material search, board search, and the
empty-board action. Actual Obsidian CodeMirror editing verifies Markdown save
with Ctrl+Enter, cancellation with Escape, and text-object save. Both themes
check authored fills, transparent cards and card-style preservation. Window
resizing checks tool and editor boundaries. A 320-pixel pane keeps all six card
style labels readable; short panes scroll their controls locally. Card action
buttons remain reachable beside or below the left tool panel. Host APIs supply
theme/window changes, fixture resets and state observations. One explicitly
controlled fallback check temporarily removes and immediately restores the
Markdown embed factory to verify source-text editing; its single expected
warning is recorded separately from normal runtime warnings.

Screenshots in the ignored
[`dist/paper-workbench-native/`](../dist/paper-workbench-native/) folder include
`desktop-light.png`, `desktop-dark.png`, `selected-note.png`, `selected-text.png`,
`multi-selection.png`, `editor.png`, `materials.png`, `search.png`, narrow-window
views and `empty.png`. The final light/dark, selected-card, Markdown editor and
narrow/short-pane screenshots were also inspected visually, together with the
measured geometry and interaction assertions.

The native run covers the default desktop host appearance. Mobile operating
systems, third-party Obsidian themes and other plugins were not tested.
