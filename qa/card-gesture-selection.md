# Card selection and gesture checks

Run from the repository root after `npm run build`:

```sh
CHROME_EXECUTABLE=/usr/bin/chromium node qa/card-gesture-selection.cjs
```

Set `PLAYWRIGHT_MODULE` to the installed Playwright package if it is outside the
Node module path. `QA_SOURCE`, `QA_CSS` and `QA_OUTPUT` override the source,
stylesheet and output paths. The default report and screenshots are written to
the ignored `dist/card-gesture-selection/` directory. Browser execution needs
local process and socket access; use the supported execution-permission flow if
the command sandbox blocks Chromium.

The fixture extracts the production pointer methods and event bindings and
bundles the production geometry helpers. It uses real Chromium mouse input and
the complete production stylesheet; the Obsidian session and rendering boundary
are substitutes. It does not open a user vault.

Checks cover light and dark themes at 0.5, 1 and 2 times zoom: Shift-dragging a
multi-selection with axis lock, Shift-click toggling without a geometry save,
Shift-resizing one card without losing selected peers, resize handle hit testing,
and releasing outside the stage before pointer capture starts. The next press
must start a fresh gesture, and each geometry edit must commit only once.

Against the previous implementation, 43 of 73 browser checks passed and 30 failed.
After the fix, all 73 passed with no uncaught browser errors. The unit regressions
in `tests/default-marquee.test.ts` also cover cancellation, locked peers,
frame-coalesced out-and-back movement, and release idempotence.

Native desktop rendering and editing were also checked in official Obsidian in
a disposable vault; see [deep-debug.md](deep-debug.md). The complete Shift/zoom
matrix above belongs to this Chromium fixture. Third-party themes and plugins
were outside the native checks.
