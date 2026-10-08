# Local UI comparison

Run from the repository root with Node 22 and a synthetic fixture directory at
`../qa/fixtures` containing `fixture.png`, `fixture.mp4`, `fixture.wav`, and the
pinned Minimal theme used by the six-item acceptance suite. Each run creates a
fresh profile/vault, uses a system-assigned debugging port, loads build files
in memory, and terminates only its own Obsidian process. Do not point this
harness at a personal vault/profile or an existing debugging port.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
QA_OUTPUT=/new/empty/evidence-directory \
QA_CHECKS=qa/ui-polish/surfaces.mjs \
node qa/six-improvements/native-run.mjs
```

Set `QA_PLUGIN_ROOT` to the frozen six-item build for the before comparison.
Set `QA_UI_EXPECT_SCROLL=0` only for that baseline: its known short-dialog
result region has zero height, so the observation `visible=false` reproduces
the defect rather than claiming the baseline is accessible. Final builds
require `visible=true`. Both variants use the same fixtures and keyboard
focus walker. Media/PDF aspect fitting finishes before geometry is sampled;
final geometry must strictly equal the stable snapshot.

The surface suite uses actual menu clicks, Tab/Enter/Escape, native settings,
and synthetic media playback/Markdown excerpt save. It captures wide/narrow,
short dialogs, long Chinese labels, empty and invalid-input states. A requested
420px native settings window is clamped by Obsidian to 600px; the report stores
the actual size. The frozen media menu uses a macOS system menu and cannot be
captured by the page screenshot, so its compact state is listed as a boundary.

For the final media menu keyboard/lifecycle supplement:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
QA_OUTPUT=/another/new/empty/evidence-directory \
QA_CHECKS=qa/ui-polish/keyboard.mjs \
node qa/six-improvements/native-run.mjs
```

Calendar belongs to a separate plugin and is not installed by this harness.
External online video/account/network behavior is not validated by the empty
online workspace captures. Reports, screenshots and test settings remain local.
