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

The bounded follow-up suite covers reuse/note association, brain creation and
rename, media focus, and reversible settings-save failure recovery. Run each
part in a fresh process so previous workspace focus cannot affect the next
part. `QA_SUPPLEMENT_PART` accepts `reuse`, `brain`, `media`, or `settings`.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
QA_OUTPUT=/new/empty/supplement-evidence-directory \
QA_CHECKS=qa/ui-polish/supplement.mjs \
QA_SUPPLEMENT_PART=media \
node qa/six-improvements/native-run.mjs
```

The media supplement uses a synthetic 20-second local video at
`../qa/fixtures/focus.mp4`. Generate it with an existing ffmpeg installation:

```sh
ffmpeg -f lavfi -i color=c=0x527d6b:s=320x180:r=10:d=20 \
-c:v libx264 -pix_fmt yuv420p -an ../qa/fixtures/focus.mp4
```

Settings failure injection replaces only the synthetic plugin instance's
`saveData` method for one matching rejection and restores it in `finally`.
No file permissions change. A native toggle exercises immediate rollback;
native profile-import buttons exercise preserved input and retry in the same
dialog. The macOS system dropdown does not accept this CDP keyboard route;
it is not used as a successful preference interaction. The brain pager layout
and external online/Calendar integrations remain outside this supplement.
