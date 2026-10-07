# Ordinary whiteboard native QA

This harness opens an isolated desktop Obsidian profile and temporary vault. It
copies the selected build's three runtime files and generates synthetic notes and
boards. It never installs into, edits, or closes the user's existing vault.

Requirements: macOS, desktop Obsidian with an installed `obsidian-*.asar` runtime,
Node.js, and a Playwright module available to Node. Build the plugin first with
`npm ci && npm run build`. Playwright is a QA dependency, not a plugin dependency.

From the repository root:

```sh
QA_OUTPUT="$PWD/dist/native-qa-new-run" \
QA_LABEL=final \
QA_CANDIDATE=1 \
QA_BRAIN=1 \
node qa/ordinary-board-ui-1332/native-run.mjs
```

If Playwright is outside Node's normal module lookup, set `PLAYWRIGHT_MODULE` to
its absolute module path. `QA_OUTPUT` must be absent or empty; every run gets a
new output directory. The harness verifies the profile, vault, and keyboard
window before sending input, and terminates only its own spawned process.

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `QA_PLUGIN_ROOT` | Use a separately built baseline; defaults to this repository. |
| `QA_SKIP_SHOTS=1` | Run checks without screenshots. |
| `QA_ONLY_BRAIN=1` | Limit the run to brain-board checks. |
| `QA_INLINE_ONLY=1` | Run the native long-draft focus, save and fold/unfold regression in isolation. |
| `QA_THEME_SOURCE` | Read-only source directory of a theme containing `manifest.json` and `theme.css`; copies both into the temporary vault. |
| `OBSIDIAN_PATH` | Override the desktop executable path. |
| `OBSIDIAN_PROFILE` | Override the read-only directory used to locate an installed `.asar` runtime. |

The report retains failed checks and exits nonzero on failures. Layout setup uses
fixed synthetic fixtures; drag, resize, wheel, keyboard undo, fold, and style
paste checks send real renderer input. Brain-color checks exercise preview,
cancel, confirmation, undo, default reset, persistence, and scrolling. The
1,200-card timing sample mounts only the viewport/overscan subset; it measures
synchronous renderer calls, not FPS, input latency, or long-term memory use.

截图与报告默认保留在本地 `dist/`，不包含真实笔记。公开验收摘要和选定截图见
[1.3.32 UI report](../ORDINARY-WHITEBOARD-1.3.32.md)。

The independently pinned third-round `4237f23f` runtime has a preserved native red regression in `dist/ordinary-ui-inline-red`: a 1200px unsaved text draft shrinks to its 60px source height when focus moves to formatting controls, while its text survives. This red result is separate from the original scene suite and must remain available beside the repaired full run.
