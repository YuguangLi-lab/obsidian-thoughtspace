# Mermaid cards — local validation, 2026-11-03

Base: `86ac4b91f6cfc17e2bc5d95f7798c0e7f7ac28de` (1.3.42), verified against the current upstream `main` before delivery. This page records the pre-release feature validation at commit `49a1260`, when release metadata still read 1.3.42. The subsequent 1.3.43 release changes version metadata and notes only; hashes below are historical candidate hashes. See RELEASE-1.3.43.md for the release build.

## Behavior

- Insert content → Mermaid diagram opens source on the left and native preview on the right. Save adds the card; cancel adds nothing.
- A complete standalone Mermaid fence in a text node opens this editor. Mixed Markdown keeps the existing text editor. The persisted node remains `kind: text`; no board format migration is introduced.
- Editing preserves card geometry, appearance and edges. Saves reject stale, removed or locked targets and preserve the draft on failure. Syntax errors remain editable and can be saved as source.
- Native Markdown rendering owns the Mermaid/Pele implementation. Each preview generation releases its component, observer and timer; owner navigation also disposes a modal with a pending save.

## Automated checks

- Node 22.23.3: 10,323 / 10,323 tests passed, including 25 new Mermaid parsing, editor lifecycle and board persistence tests.
- Full command: `node --import tsx --test tests/*.test.ts`. The package script's `tsx` CLI could not open its local IPC socket inside the execution sandbox; this equivalent Node test-runner invocation avoids that socket.
- `npm run build` passed (TypeScript and bundled runtime).
- `npm run lint` passed: 0 errors, 194 existing warnings; new Mermaid modules have no lint warnings.
- `git diff --check` passed.

## Actual Obsidian checks

Actual Obsidian API version: 1.15.0, using the installed 1.15.0 application package and Pele. Native host: macOS, installer 1.8.10 / Electron 34.2.0. A fresh isolated profile and synthetic vault were verified by path and process ID before plugin operations. The existing user vault and profile were not changed. Electron sandboxing was retained.

Final full run: 41 / 41 checks passed. Coverage includes native Pele output; insert entry; two-column editor; rapid input; cancel and Escape; syntax errors, saving invalid drafts, correction and reopening; mouse dragging/resizing/connecting; undo/redo; persisted text kind and geometry; conflict protection; light/dark themes; 620px window; ordinary text source fallback and native live preview; and owner navigation during a failed pending save. No page errors. One expected warning was deliberately triggered to test the existing source-editor fallback.

The full 41-check run used the same final JavaScript with stylesheet `42867f741de73d89a5dd4864ab598e88f321d09e89710e1d4fdb088b6e8fa228`. A subsequent card-only CSS rule hides Pele zoom buttons because card pointer gestures belong to the board; editor previews retain native zoom controls. The final stylesheet passed a separate 10/10-check native run in an actual 300px right sidebar: card output, hidden inert zoom controls, standard edit action, editor bounds, insert palette access, new diagram preview and cancellation. The existing compact toolbar remains in charge when it covers part of the card; editing is reachable through its standard action. No page errors.

Delivery runtime SHA-256:

```text
215e7421320bc4b3d27943f7a05a4690c86af8e7e9b3890355763dfc5beae55e  main.js
d133e50362c164f07dd7c989926f097ee250bcdab164726b6442373b67cb111c  styles.css
c30c4309db83d2815443c09d0b508551c70d0059af404b6b7362537bd8b7390d  manifest.json
```

Raw native reports, screenshots and the isolated test harness are retained with the local delivery, outside the source tree. Test profiles and generated `main.js` are not committed.

## Limits

Physical mobile devices and system IME sequences were not tested. IME guards have automated lifecycle coverage. Mermaid syntax support follows the installed Obsidian renderer. No GitHub push, tag, release or real-vault installation was performed.
