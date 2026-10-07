# Whiteboard content controls

Extends the existing native scene suite with eight content kinds, light/dark
themes, 0.5/1/2 zoom, 420/260 px panes, native menu dismissal, repeated insertion,
keyboard fold/unfold, lock validation, branch independence, undo/redo, reopening,
settings search and selected-object overlap. The ordinary scene and brain-color
checks remain available in the shared harness.

This entry point loads the selected build through the host loader using an
in-memory adapter. It writes no installable plugin files or enabled-plugin list.
The profile and vault are newly generated and verified before UI input; only its
own process is terminated. No existing vault or fixed debugging port is used.

Build with Node 22 and the repository lockfile. Playwright and an installed
desktop Obsidian runtime are required. Generate synthetic media in an empty
local directory (FFmpeg is only a QA dependency):

```sh
mkdir -p dist/control-fixtures
ffmpeg -v error -f lavfi -i 'color=c=0x516e60:s=320x180:d=1' -an -c:v libx264 -pix_fmt yuv420p dist/control-fixtures/fixture.mp4
ffmpeg -v error -f lavfi -i 'sine=frequency=220:duration=1' dist/control-fixtures/fixture.wav
ffmpeg -v error -f lavfi -i 'color=c=0x516e60:s=320x180:d=1' -frames:v 1 dist/control-fixtures/fixture.png
npm ci
npm run build
QA_OUTPUT="$PWD/dist/control-review" \
QA_FIXTURE_DIR="$PWD/dist/control-fixtures" \
QA_CANDIDATE=1 QA_CONTROLS=1 QA_BRAIN=1 \
node qa/whiteboard-controls/native-run.mjs
```

Set `PLAYWRIGHT_MODULE` to an absolute module path if needed. `QA_OUTPUT` must be
empty; preserve failed runs by choosing a different directory for each attempt.
Use `QA_CONTROLS_ONLY=1` to run only the added checks, or `QA_EXTENDED=0` to run
only the shared scene suite. Use `QA_PLUGIN_ROOT` to select a frozen baseline
build; omit `QA_CONTROLS=1` for baseline observation of the new visual criteria.

Reports and screenshots stay local. The 1,200-node sample measures synchronous
render calls with viewport culling and a fixed pointer sequence for drag, pan
and zoom. CDP task/script/layout/style durations and RAF intervals are renderer
measurements; they do not establish hardware input latency, a general FPS
result, simultaneous rendering of every node, or long-term stability.
