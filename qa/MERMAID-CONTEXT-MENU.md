# Mermaid context-menu entry — local validation, 2026-11-03

Base: `330616a5b3a1dc7f0c6e8921c7e87c3f3fdd8680` (published 1.3.43). This records the pre-release implementation at local commit `6c620b7`, whose manifest still read 1.3.43. Release 1.3.44 changes metadata and validation notes only; see RELEASE-1.3.44.md for the release build.

## Change

The blank-canvas native context menu now includes “在此添加 Mermaid 卡片” immediately after the table action. It calls the existing `newMermaid(position)` with the board coordinates captured when the menu opened. The existing source/preview editor, save/cancel behavior, owner guards and text-node storage remain in use. No styles, version metadata, card kinds or renderer code changed.

## Automated checks

- Node 22.23.3: `npm test` passed 10,329 / 10,329 tests.
- Context-menu tests passed 23 / 23, including six added cases covering captured pan/zoom coordinates, entry placement, blocked writes, closing/closed views and stale sessions.
- `npm run lint`: 0 errors, 194 existing warnings.
- `npm run build` and `git diff --check` passed. Generated CSS is unchanged.

## Native checks

Actual Obsidian API 1.15.0 / Pele, macOS host installer 1.8.10 / Electron 34.2.0. Each run used a fresh synthetic vault and profile, verified by path and process ID, with normal Electron sandboxing. An unchanged task-local copy of the installed app allowed native UI automation to target the disposable instance separately from the user's open app.

Actual macOS menu clicks confirmed the new entry alongside the existing actions. Creation, source/preview rendering, cancel, editing via the card menu and standard action, save, tab closure and quick-switch reopening were exercised through native UI input. At 75% zoom with a translated viewport, the new card center matched the recorded right-click world position. Existing-card cancellation preserved its complete data; editing and reopening retained geometry and source.

Light and dark appearance were checked. A real 380px right-sidebar leaf also exposed the entry, opened the full editor, rendered the preview and saved a second card at the clicked position while retaining the first card. Sidebar layout was configured through the app API solely as test setup; menu selection and editing used native input.

The retained snapshots and runtime hashes passed 31 state/provenance checks. The main native run (`native-02`) recorded one exception in the QA-only contextmenu observer after a board tab closed: it referred to the detached previous view. The observer was corrected to resolve the event's current view and skip detached views. A fresh follow-up (`native-03`) repeated native creation, saving, closing/reopening and opening the menu; it completed with no page errors. Product code and runtime bytes were unchanged between these runs. Both owned app processes were stopped.

Runtime SHA-256:

```text
5499963672a49d4ec0a754adc1153d6ceed5f194d10d906a4a3f9ba7ec4b108c  main.js
d133e50362c164f07dd7c989926f097ee250bcdab164726b6442373b67cb111c  styles.css
81d156c89dd9fec4bb212f609faad0d79d6ba21ea2318227dfa247d9121661e1  manifest.json
```

Raw reports, screenshots and test scaffolding are retained locally outside the repository in `qa-mermaid-context-menu`. Synthetic vaults, profiles, the app copy and generated runtime are not committed.

## Scope and limits

This is an unpublished local change on top of 1.3.43; the local package retains that manifest version. No GitHub push, release or real-vault installation was performed. Native checks cover macOS Obsidian 1.15.0; physical mobile devices and other operating systems were not tested for this menu change. The renderer/editor implementation is unchanged from the previously validated Mermaid feature.
