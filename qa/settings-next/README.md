# Settings Native QA

`native-run.mjs` starts a separate Obsidian process with a temporary profile and
vault. It copies only the current build and creates disposable test notes. It
does not install into, change, or terminate the user's normal Obsidian vault.

## Run

Build `main.js` and `styles.css` first, then:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node qa/settings-next/native-run.mjs
```

Optional environment variables: `OBSIDIAN_PATH`, `OBSIDIAN_PROFILE` (read-only
source of the installed runtime), and `QA_OUTPUT`.

The report, build hashes and screenshots are written to `dist/settings-next/`.
The report includes the temporary profile and vault paths for inspection.

## Coverage

- All eight categories in the real Obsidian plugin settings tab.
- Chinese, English and Follow Obsidian selection, disk persistence and reload.
- Global search, empty results, Escape and clear-search focus.
- Nonstandard saved numeric values, card defaults and category reset confirmation.
- Cross-category preservation, unsaved folder drafts and unchanged existing files.
- Read-only safe JSON export, malformed import rejection, validation invalidation
  after edits, and explicitly applied valid imports.
- English paper and background dialogs, preserving selected user filenames.
- Light and dark themes, both settings languages, native desktop width and
  constrained 640 px / 420 px settings panes. Geometry assertions check clipped
  controls, horizontal overflow and label/control overlap across all categories.

This is desktop runtime validation with DOM-driven actions, not physical mouse,
keyboard or mobile-runtime testing. The unused workspace settings modal has no
production entry point and is not included. Runtime page errors fail the run.

## Accepted Results

On Obsidian 1.14.3, the settings build passed 309 native checks, with no runtime
errors and 15 screenshots covering both languages, themes and pane widths.
The final report records exact runtime hashes. The test confirmed preservation
of existing board and note bytes, private preferences, and folder drafts.

The full project suite passed 4,267 tests; TypeScript, production build and seven
release-script tests passed. ESLint reported no errors and 118 warnings,
including compatibility warnings for the existing imperative settings API.
