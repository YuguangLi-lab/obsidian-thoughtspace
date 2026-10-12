# ThoughtSpace board CLI phase 1

The `1.0.0-local` CLI runs locally with **Node.js 22**. Download this repository with **Code → Download ZIP**, extract it, and open a terminal in the extracted repository root. The committed bundle works without `npm install`, Obsidian installation, or an AI account.

```sh
node tools/dist/thoughtspace-board.mjs --help
node tools/dist/thoughtspace-board.mjs validate examples/ai-board/sample-vault/brain-v3.md --vault-root examples/ai-board/sample-vault --json
```

The second command returns exit **0** / `overall: passed` for the supplied checking scope. The complete synthetic sample vault includes its source note and child board; keep these files together. Handwriting requires the published **1.3.36-beta.2** plugin; stable 1.3.35 does not support that board presentation.

- `validate FILE` and `inspect FILE` only read. `inspect` returns counts and diagnostics, not the whole Board JSON.
- `create ordinary|brain|ink OUTPUT` exclusively creates one new file. An existing path is rejected and the parent directory must already exist. `--board-json FILE` supplies a raw Board object; `--title TEXT` supplies a Markdown heading. `.md` / `.thoughtspace` must agree with `--format markdown|legacy`.
- `--vault-root DIR` checks structured direct local references. Inline Markdown destinations, remote/semantic media targets, and references inside child boards are not resolved. Without sufficient checks, valid format stays `format_only`.
- Exit **0** means passed within the report's scope; **2** means format passed with references still unchecked; **1** means a validation/file error; **64** means usage error. A successful create can exit 2: inspect `created` and `overall` separately.

Use canonical paths; symbolic links are rejected, including the macOS `/tmp` alias. A scratch path under `/private/tmp` must already exist. Source paths inside the Board remain relative to the vault that will contain it.

Read the [AI guide](../docs/AI-BOARD-GUIDE.zh-CN.md), [format contract](../docs/AI-BOARD-FORMAT.zh-CN.md), [examples](../examples/ai-board/README.zh-CN.md), and [validation scope](../qa/AI-BOARD-PHASE1.md).

For development with the locked dependencies, use `npm ci`, `npm run board-tool:typecheck`, `npm run board-tool:lint`, `npm run board-tool:build`, `npm run board-tool:verify`, and `npm run board-tool:test`. CI checks that building reproduces both committed bundles. `board-tool.mjs` is the import-safe API bundle; importing it does not run the CLI.

The isolated [schema snapshot](board-tool/SCHEMA-SNAPSHOT.json) preserves the tested phase-1 parser without changing the public plugin sources. Forty of its 43 source modules match public beta.2 exactly. Three parser/validation modules come from the tested local candidate; unpublished reading-position actions are excluded. This is a format snapshot, not a stable SDK or a release of beta.3/4/5 UI features.

Project code uses the root [MIT license](../LICENSE). The embedded existing js-yaml 4.3.2 dependency uses [MIT](../docs/licenses/js-yaml-LICENSE.txt). The tool provides no MCP service, listener, account login, npm publication, batch transaction, or existing-note editor. Physical mobile devices/Pencil and complete palm rejection remain untested.
