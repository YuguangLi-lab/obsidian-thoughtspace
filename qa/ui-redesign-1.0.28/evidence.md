# ThoughtSpace 1.0.28 — UI layout verification

## Scope

- Creation rail reduced from twelve permanent buttons to eight, with separate material insertion and extended tool palettes. All prior commands retain an entry.
- Insert palette: eight labelled tiles grouped into notes/materials and structure/relationships. More palette: searchable purpose groups, recent actions, responsive two-column layout.
- Shared disposable palette interaction controller: exclusive opening, outside/activation close, Escape focus restoration, geometry-aware keyboard navigation, local scroll reveal, ARIA relationships.
- Sidebar: compact capture/navigation, baseline tabs, connected tree hierarchy, transparent note rows and two-line long titles. Native interface and body fonts remain distinct.
- Formatting retains its top position, with quieter category emphasis. Opening a tool palette temporarily frees the format space; closing restores the same selection.
- Fixed legacy flex declarations overriding grid, clipped tools in short panes, invisible initial focus after reopening a scrolled palette, and an empty-search clear button ignoring its hidden state.

## Validation

- TypeScript and production build passed; 2,815 automated tests passed (16 new palette behaviors). ESLint: 0 errors, 80 warnings, matching the prior total.
- 7 packaging tests and release metadata validation passed.
- Native Obsidian: 50 layout cases, 9 editor zoom/size cases (save/undo/cancel/focus), 40 palette layout cases across both themes, 540 tool hit targets. No outstanding layout failures.
- Verified actual existing-note picker launch, mutually exclusive palettes, search Escape clear/close, outside close, retained object selection and visible first focus after reopening a scrolled panel. Empty search hides clear; populated search shows it.
- Sidebar cloned DOM/CSS: 24 viewport/theme cases and 8 long-title library cases. No horizontal overflow; short panes retain accessible scrolling.
- Actual unlocked app screenshots inspected: after-light.png, after-dark.png, after-editing.png, after-insert.png, after-tools.png. Light theme restored after checking.
- 22 original demo boards and the fixture source note unchanged. The owned demo fixture remains for preview.
- Real vault: current 37-node board unchanged; settings preserved except recent-visit timestamp. Runtime assets match across six source/dist/install locations.

## Delivery

- Installed 1.0.28 in demo-vault and the real vault; prior plugin files were backed up.
- Local package: dist/thoughtspace-1.0.28.zip
- Package SHA256: b02883614e00129691df5c0a2cf8c484a2f6576a093e81f99369f42ac5ae8d81
- Source backup and development mirror backup are retained under thoughtspace-source-backups.
- No GitHub publication requested or performed.

Coverage describes the tested native version, theme, pane sizes and interactions; it does not assert compatibility with every third-party theme.
