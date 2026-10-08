# Isolated six-item native QA

Use Node 22.20.0. Build the candidate, and a frozen d25b4f2c baseline for the same-fixture performance run. The host loader receives main.js/styles.css in memory; no installed plugin files or enabled plugin list are written. A new temporary profile/vault and OS-assigned CDP port are verified. Only the launched PID is terminated. Use an empty QA_OUTPUT; retain failed attempts under separate names.

Required environment: PLAYWRIGHT_MODULE points to an absolute Playwright module. QA_CHECKS=qa/six-improvements/acceptance.mjs runs actual mouse/keyboard feature checks. For performance use QA_AB=1, QA_BASELINE and QA_CANDIDATE absolute build paths; fixed seven-node scene budget, A-B-B-A, keyboard event-to-rAF and trace metrics. The fixtures use synthetic Markdown, valid synthetic PDF and the public Minimal stylesheet. Performance timings are renderer measurements, not hardware latency/FPS claims.

Example: QA_OUTPUT=/absolute/new-output PLAYWRIGHT_MODULE=/absolute/playwright QA_CHECKS=qa/six-improvements/acceptance.mjs node qa/six-improvements/native-run.mjs

Reports include profile/vault, own PID/port, build hashes, checks, raw metrics and real screenshots. Source graph setup uses fixture APIs; interaction intentions use Playwright input. Write failure recovery is intentionally injected into the synthetic session's flush method and restored before continued saving. The final acceptance waits for actual PDF text-layer content and real hover disclosure.
