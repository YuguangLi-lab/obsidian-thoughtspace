# Brain-board performance, UI and colors — 1.3.31

2026-10-07. The release source starts from public 1.3.30 (`b5d98dd0b660102dc7d0688fe5899e6737443017`). Independent reconstruction with the combined patch and with performance → final UI → color patches produced identical source, tests, styles and dependency metadata: 846 files checked before the version update. The final UI includes the feedback/style correction. No unrelated branch or historical PR was merged.

## Behavior

- Camera inputs retain every delta and changing zoom anchor; DOM presentation is coalesced per frame. Consumer-local, non-inheriting scale/color variables avoid cascading through the whole scene. Unchanged titles and expansion icons retain DOM. Animation reads precede effect writes; normal 480 ms navigation and reduced-motion handling remain.
- Smaller toolbar/footer, clearer long Chinese titles, node/link hierarchy and outward direction hints. Creation and rename fields have visible labels. Explicit Fit reserves room for bottom controls and paging; normal navigation keeps its existing centering.
- **脑图设置 → 背景与配色 → 脑图配色…**, or bottom **白板背景 → 脑图配色…**. Four optional board-local hex colors: background, node fill, text and links. Empty fields follow the live theme. Preview stays local to one view; Cancel/Escape restores saved values. Confirm and Reset use history, save/reopen and undo/redo.
- Reset clears only color overrides, retaining paper/image parameters. Opaque image regions can cover the base color. Low-contrast advice preserves the chosen colors; it is not a complete accessibility guarantee. Native controls and Markdown body formatting retain their own colors.
- Stale ownership, external color changes and write suspension cannot silently overwrite a newer palette. Save failure preserves the original file and recovery draft through the existing Session behavior.

## Release checks

Node 22.20.0, independent `npm ci` from the unchanged dependency lock. `npm run build` includes TypeScript checking. Full `npm test`: 6252 passed, zero failures/cancellations/skips. Lint: zero errors, 118 existing warnings. Seven Python release-script tests passed. Version metadata remains consistent with minimum Obsidian 1.13.7 and desktop-only operation.

The 1.3.31 rebuild passed 38 native regressions, 30 color checks and 9 supplementary checks in a dedicated disposable vault/profile on Obsidian app package 1.14.4, including real mouse/keyboard input, normal/reduced-motion animation, all 1000-node paging, menus, creation/rename, ordinary/embedded boards, save/reopen, color history, concurrent-view isolation, stale requests and actual intercepted save failure. Electron/Chromium stayed at 39.8.3/142.0.7444.265. A first pass loaded bundled 1.12.7; after verifying shutdown, the same owned profile loaded its host-downloaded, signature-verified 1.14.4 update and the full native gate was repeated. The shell still reports 1.12.7; the loaded package path and package metadata establish 1.14.4. Minimum 1.13.7 metadata is unchanged, but that exact app version was not separately exercised.

Default light/dark, wide/narrow windows and narrow panes were recaptured: 77 final release-gate screenshots including two complete 22-scene visual passes and 29 color scenes, with zero recorded renderer errors. Representative screenshots were also visually inspected. Counts complement the checked behaviors; they are not sufficient evidence by themselves. Initial unsupported-host evidence and driver failures (startup readiness, a module probe, and asynchronous theme-save contention) were retained locally; the driver was corrected without production changes. The prior candidate's 86 screenshots and full performance evidence remain local and are not presented as fresh release measurements.

The runtime rebuilt with local dependencies has identical executable bundle text to the final candidate after normalizing only esbuild dependency source-path comments; CSS is byte-identical. Version metadata is deliberately updated to 1.3.31. CI builds and attests the published runtime assets from the release commit; local build hashes are not substitutes for those attestations.

## Performance evidence and limits

Candidate measurements used Apple M4 Pro / 48 GiB, Electron 39.8.3 / Chromium 142.0.7444.265, DPR 2, default dark/light themes and self-authored fixtures. Launcher logs show the original serial sessions loaded bundled Obsidian 1.12.7; the final counterbalanced color follow-up loaded updated Obsidian 1.14.4. The groups within each comparison used the same host, but serial and counterbalanced results must not be treated as one unchanged-host experiment. Stage 698 × 772 CSS px; 1000 total nodes, 48 initial projected/mounted nodes, 38 geometrically visible, 2071 scene descendants. Visibility can include nodes behind a modal. Paging reached all 1000 nodes; these measurements do not describe 1000 simultaneously mounted nodes. Node counts, contents and animation implementation were retained.

The initial performance-only comparison with public 1.3.30 reduced synthetic zoom RAF p95 from 17.0 to 9.0 ms and event-reception-to-next-RAF p95 from 26.8 to 4.8 ms. These are intermediate-candidate results, not an exact final-release comparison. Later UI consumer-variable corrections reduced cumulative style time in their own zoom comparisons, while reception-to-RAF rose; phase-controlled probes found less dispatch lateness and lower planned-input-to-RAF time. Those methods are distinct and do not erase the reception metric increase.

Final color evidence used the corrected UI as baseline. Initial serial measurements showed small increases, including approximately 1.1 ms RAF changes in light zoom and dark depth. A six-round counterbalanced follow-up used all six A/B/C permutations, alternating themes: A = corrected UI default, B = final colors default, C = final colors with a saved palette. Identical per-load warmup and original input sequences; 36 measured samples, with each version appearing twice in each position. Paired differences are within-round candidate minus baseline medians, not differences between independent medians.

| Condition | RAF paired difference (ms) | Reception-to-RAF paired difference (ms) |
| --- | ---: | ---: |
| Light, default zoom | +0.05 | 0.00 |
| Light, custom zoom | −0.10 | 0.00 |
| Dark, default depth | −0.20 | −0.60 |
| Dark, custom depth | −0.15 | +0.15 |

The original non-overlapping increases were not stably reproduced. Scheduling/order variation is a plausible interpretation, not proof that every difference is noise. Dark depth retained cumulative style paired increases of +0.66/+0.79 ms for default/custom. One custom depth reception p95 was 25.2 ms (baseline range 19.4–21.8). No observed renderer exceptions or long tasks in those 36 samples. The tested zoom/depth sequences did not trigger center navigation; animationCount was zero, so this is not an active-animation benchmark.

Color preview is not free: 200 input events in the same modal increased cumulative style time from 94.8 to 125.1 ms relative to modal-only updates; reception p95 was 7.9 → 8.2 ms. Refresh count, graph revision, layout/node references and camera remained unchanged. DOM synthesis and RAF callbacks are not GPU FPS or hardware-input-to-pixel latency.

Performance data is reused from the final candidate because production source, CSS and dependency contents are unchanged; this release gate repeats functional/native checks after the version change. It does not claim a new full performance matrix.

## Reproduce with self-authored data

Use Node 22 and a clean checkout:

```sh
npm ci
npm run lint
npm test
python3 -m unittest discover -s scripts -p 'test_*.py'
npm run build
RELEASE_TAG=1.3.31 python3 scripts/check-release.py
python3 scripts/package.py
git diff --check
```

Create fixture files in a new directory; this snippet refuses to reuse an existing one. Import them into a disposable vault/profile with only this plugin, using the same host version and default themes. Never run the native failure scenario against existing notes.

```python
import json
from pathlib import Path
out = Path('synthetic-fixtures')
out.mkdir()
def board(count, fanout, assoc=False):
    return {'version': 3, 'presentation': 'brain',
      'brain': {'version': 1, **({'centerId': '0'} if count else {}),
        'expandedIds': [], 'pins': [], 'descendantDepth': 5,
        'history': {'entries': ['0'] if count else [], 'index': 0 if count else -1}},
      'nodes': [{'id': str(i), 'kind': 'text', 'brainIdea': True,
        'title': 'Synthetic idea ' + str(i), 'text': 'Self-authored fixture ' + str(i),
        'x': i*400, 'y': 0, 'width': 320, 'height': 240, 'color': 'slate'} for i in range(count)],
      'edges': [{'id': 'e'+str(i+1), 'from': str(i//fanout), 'to': str(i+1),
        **({'direction': 'both', 'fromSide': 'left', 'toSide': 'right'} if assoc else {'kind': 'branch'}),
        'label': ''} for i in range(max(0, count-1))],
      'viewport': {'x': 60, 'y': 60, 'zoom': 1}}
for n in (100, 500, 1000):
    for name, fanout, assoc in [('Tree', 4, False), ('Star', n, False), ('Assoc', n, True)]:
        (out/(name+str(n)+'.thoughtspace')).write_text(json.dumps(board(n, fanout, assoc)))
for name, count, assoc in [('Chain', 7, False), ('AssocChain', 7, True), ('Empty', 0, False)]:
    (out/(name+'.thoughtspace')).write_text(json.dumps(board(count, 1, assoc)))
```

Check both chains at depths 1–5; traverse Star1000 paging and search an off-projection node, then return through history. Exercise trusted drag/wheel/zoom, center navigation, reduced motion, rapid switching, source expansion, creation/cancellation/rename, save/reopen and ordinary/embedded boards. Add mixed long Chinese titles for wide/narrow window and pane inspection in both default themes.

Check four color fields, invalid hex, cancel/Escape, confirm, undo/redo, reopen, reset, theme changes, two different boards and two views of the same board. Preview must preserve the other view, node identities, layout, graph revision and camera. Verify paper/image coexistence and retained background parameters. For failure testing, intercept only the disposable board's `vault.process`, throw once, restore it, and compare original bytes and recovery draft. External palette changes and switching the target board must invalidate stale confirmation.

For performance comparisons, align stage dimensions and camera before every run, record total/projected/DOM/visible counts at each step, retain normal animations, warm up once, then time the same 200 pointer/wheel events requested at 4 ms intervals. Record RAF intervals, event reception to next RAF, dispatch lateness and cumulative CDP RecalcStyleDuration separately. Depth uses 1→2→3→4→5. Counterbalance the final color comparison across all six A/B/C orders and report per-run ranges and within-round differences. Do not measure alongside builds, screenshots or other test suites.

## Remaining limits

Historical approximately 103 MB growth, illegal access and deeper relationship crossings remain unresolved. Very low zoom and narrow panes need zooming for reading. Third-party themes, low-end devices, real-note indexing, long-running use and GPU/hardware end-to-end latency were not verified. This change does not establish zero regressions or a universal smoothness guarantee. The community-directory scan remains an independent review; local/CI lint is not its approval.

Local raw evidence, screenshots, vault/profile and logs are retained outside the public source. No user notes, personal paths, credentials or private artifacts are included in this report or the release package.
