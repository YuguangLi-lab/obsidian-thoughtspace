# Card Interaction Regression Checks

These Chrome probes load the complete production `styles.css`. They do not open
or modify a user vault. Set `PLAYWRIGHT_MODULE` if Playwright is not on the local
module path; set `CHROME_EXECUTABLE` for a non-default browser installation.

```sh
node qa/card-interaction-polish.cjs
node qa/card-hover-fade.cjs
```

Both accept `QA_CSS` and `QA_OUTPUT`. Run the production build first when source
CSS has changed.

## Locked Paper Cards

`card-interaction-polish.cjs` checks 145 assertions across light/dark themes,
normal/compact/summary/editing/custom-border states, and locked/unlocked cards.
It verifies the lock label, paper border, and non-intercepting painted decoration.
It also writes light/dark screenshots.

- Before: 135 passed, 10 failed; every failure was a missing paper lock label.
- After: 145 passed, 0 failed.
- Cause: the paper frame and the shared lock status both used `::after`.
- Fix: reserve `::after` for status and draw the paper frame with `::before`.

## Dismissing Action Docks

`card-hover-fade.cjs` mounts the production hover lifecycle and uses real
Playwright mouse/touch input, not synthetic hover classes. The fixture positions
a dock over a neighboring card to isolate hit testing during dismissal.

- Before: 24 passed, 9 failed. At 0.5x, 1x, and 2x, clicking the neighboring card
  instead invoked the fading dock's Read action.
- After: 33 passed, 0 failed.
- Cause: the dock retained `pointer-events:auto` during its 120 ms fade-out.
- Fix: stop hit testing as soon as the dock is dismissed, while preserving the
  animation. Explicitly visible hover, focus, selection, folded, and touch states
  remain interactive.
- Coverage includes deliberate dock clicks, the first neighboring-card click,
  keyboard focus, selected/folded states, and simulated touchscreen first-tap
  activation. It does not claim that intentionally visible toolbars never overlap
  neighboring nodes.

The same fade interception was separately reproduced in isolated native Obsidian
1.14.3: after `is-control-hover` cleared, the unhovered dock still returned its
Read button from `elementFromPoint` over the neighboring card header. The native
red evidence is in `dist/card-hover-fade-red/report.json`. Chrome fixture coverage
is not a substitute for the broader native board workflow suite or physical
touchscreen/input-method testing.

## Final Build

The final production-CSS runs passed 33/33 and 145/145. Reports are in
`dist/card-hover-fade-final/` and `dist/card-interaction-polish-final/`.

```text
main.js       0be7e0db0ac414f17e032ea4baf6e4e52b06ac21cedb75089b8ef77dd46ea91f
styles.css    df4da27a52e26f3c059053584670625d6ac9316fd87ca7681c2c500a8395ea18
manifest.json 5000fd244ed2dd38be30c8df65c2348c0d85da4e57707a5e50e4900b9f56deea
```
