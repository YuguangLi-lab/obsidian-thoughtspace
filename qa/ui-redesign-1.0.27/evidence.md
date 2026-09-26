# ThoughtSpace 1.0.27 — UI redesign verification

## Changes

- Native-theme sidebar: capture, shortcuts, main navigation, search, scope and results; consistent hierarchy and long-title handling.
- Floating format surface: context/category row plus labelled appearance or Markdown controls. Horizontal overflow navigation retained.
- Refined side rail, tool search, view controls and minimap. Runtime ResizeObserver uses actual toolbar/footer heights to avoid overlaps without per-pointer scanning.
- Inline save/cancel/status now live in screen coordinates. Draft editor remains within the original card; ownership, keyboard handling and disposal include both surfaces.
- Short sidebar panes switch to compact shortcuts and, when necessary, a single scrolling surface. No functionality is removed.

## Validation

- TypeScript + production build passed.
- 2,799 / 2,799 automated tests passed, including 7 new editor-chrome regressions.
- ESLint: 0 errors, 80 existing warnings (same count as 1.0.26).
- Package metadata and 7 packaging tests passed. Runtime artifacts match across six source/dist/installed copies.
- Native Obsidian 1.13.7: 50 geometry cases across 320–1200px canvas widths, 280–720px heights, both densities, five selection states. No toolbar escape, rail-format overlap or footer overlap.
- Native editor: 9 combinations of 30%, 100%, 200% zoom and three pane sizes; action targets remain 32px and hit-test correctly. Save, undo, cancel cleanup and focus transfer passed.
- Native appearance/category switching, menu search/Escape, card editing and unchanged source-note checks passed.
- Sidebar DOM+CSS rendering: 24 theme/size combinations, widths180/220/280/360, overall heights300/420/720. 360 sampled control/tree hit checks passed; no horizontal overflow. Low-height sticky-header obstruction fixed.
- Actual unlocked Obsidian screenshots inspected: after-light.png, after-dark.png, after-editing.png. Initial locked-host screenshots were stale and are not acceptance evidence. Theme screenshots wait for color transitions to finish.
- 21 original demo boards are byte-identical. Real vault current 37-node board is byte-identical; preferences differ only by recent-visit time. Both installations load 1.0.27 without captured errors.
- Demo visual fixture was retained because it received an additional table and connection during interactive checking; no potentially user-added content was removed.

## Delivery

- ZIP: dist/thoughtspace-1.0.27.zip
- SHA256: cdbfc2d8517bd99b9bbe48b6346d4b5cc933bc6e830efaa20b7e918fd1c7b578
- Source backup and mirror backup are recorded in baseline.json / delivery.json.
- No GitHub publication in this task.

These checks validate tested layouts and interactions, not every third-party theme or long-running performance.
