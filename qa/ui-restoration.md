# Replacement 1.3.24: restore theme colors and compact navigation

The user requested 1.3.23 visuals, retention of useful 1.3.24 fixes, and replacement of the original 1.3.24 release without incrementing its version. Existing 1.3.24 users need to download and reinstall the replacement; an unchanged version does not trigger normal update discovery.

## Changes and boundaries

- Removed the three forced-palette `paper-workbench`, `paper-selection`, and `paper-library` CSS layers. Normal board chrome again uses 1.3.23 colors, layout, theme variables, and Obsidian fonts. Canvas paper textures and chosen card styles remain optional and unchanged.
- Following explicit user clarification, the sidebar now uses the compact horizontal category row at **all** widths. Search and the content list use the full sidebar width, with group preview and arrangement still available.
- Kept 1.3.24 editing, saving, source-validation, session synchronization, pointer, keyboard, scroll, and hover fixes. Short native splits retain local scrolling rather than hiding commands.
- Found and fixed a real narrow-pane regression: changing the formatting band re-centered the creation rail without resizing it, leaving its avoidance rectangle stale. The browser fixture reproduced a card Edit button hidden beneath More. Re-measure the settled rail after the reserve changes.
- Native resizing exposed ResizeObserver delivery warnings. Layout writes now run in coalesced animation frames belonging to the view's window. Closing the view cancels queued work; hidden auto-fit cards still resume measuring when visible.

No vault content, note text, stored card appearance, or theme preferences are migrated by this change.

## Verification on 2026-09-30

| Check | Result | Boundary |
| --- | --- | --- |
| TypeScript / build | Passed | Production bundle and generated CSS |
| ESLint | 0 errors, 118 existing warnings | No additional warnings |
| TypeScript regressions | 4,437 passed | Existing production modules/methods, including deferred fitting and frame cleanup |
| Python release scripts | 7 passed | Public release metadata and asset verification helpers |
| Chromium workbench and sidebar | 841 passed | Production CSS/chrome/pointer/key helpers; Obsidian APIs and content are fixtures |
| Chromium card gestures | 73 passed | Production selection, dragging and resizing methods |
| Native Obsidian 1.13.7 | 101 passed | Actual Folio Atelier theme, fonts, card styles, selected formatting, rail positions and sidebar geometry |

The native inspection covered light/dark, regular, 420px narrow, and 230px short surfaces, restored all temporary DOM/theme/selection state, and verified unchanged board data. Six screenshots were inspected. The final native run captured **no new runtime or ResizeObserver errors**. The card-gesture fixture does not validate every host integration; this is not a claim that every plugin feature or long-term performance was retested.

The browser fixture additionally checks sidebar widths of 200, 280, 304 and 420px at heights of 800 and 320px in both themes, including actual keyboard focus, category activation, full-width list geometry and overflow. Host theme variables are compared directly with descendants. Contrast calculations now correctly parse CSS `color(srgb ...)`; dark/light host accent text is tested with matching accessible host background colors, rather than forcing inconsistent host color pairs.

## Reproduce

```sh
npm ci
npm test
npm run lint
python3 -m unittest discover -s scripts -p 'test_*.py'
npm run build
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_EXECUTABLE=/path/to/chrome node qa/paper-workbench.cjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_EXECUTABLE=/path/to/chrome node qa/card-gesture-selection.cjs
```

For native checks, install this build into an Obsidian vault and open a fixture board containing paper and sticky note cards with the ThoughtSpace sidebar visible. Close active card editors, then run:

```sh
python3 qa/ui-restoration-native.py --vault VAULT_NAME
```

This native script uses the official Obsidian CLI. It reads board data and temporarily changes DOM size, selection and theme classes, restoring them in `finally`. Do not interact with the board during the few-second inspection. Reports and screenshots stay in ignored `dist/` directories.

The original release assets and metadata were backed up locally before replacement. The replacement release must include `main.js`, `manifest.json`, `styles.css`, the ZIP installer and checksums, and must pass anonymous public download verification.
