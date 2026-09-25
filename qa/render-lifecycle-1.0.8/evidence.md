# Card Markdown preview lifecycle

## Observed baseline

The production card callback was extracted through the existing
`tests/preview-reuse-flow.test.ts` fixture and submitted to the real `RenderQueue`.
Four card file reads were deliberately left pending, their preview nodes were
detached, their component scopes were unloaded, and the queue was cleared before
submitting a fresh job.

Observed before the change: `active = 4`, `pending = 1`, `nextStarted = 0`.
The detached reads retained all four shared preview slots indefinitely.

## Change and checks

`src/card-preview.ts` now races file reading and Markdown rendering against scope
cancellation and a 5,000 ms deadline, matching the existing text-preview budget.
Native renderer output has a generation-owned, attached content wrapper so native
Mermaid processing can finish before sizing. The wrapper stays after success to
retain native root scrolling, direction and event listeners; cancellation/error
detach it so late renderer writes cannot affect current content. The child
renderer scope and deadline are released independently of card controls. The
loading decoration is removed before auto-fit callbacks measure the card.

The production-path regression now observes `active = 0`, `pending = 0`, and one
fresh job started after those four cards are unloaded. Resolving the abandoned
reads afterward starts no Markdown renderer and requests no card fitting.

Additional executable regressions cover cancellation during native rendering,
timeouts in both the file-read and renderer phases, late success/failure after a
retry, replacement on the same element, queued cancellation, source extraction,
read-only task inputs, empty tag paragraph cleanup, renderer scope lifetime, and
loading-state removal before auto-fit, connected targets during native processing,
renderer-root attributes/listeners and completed-wrapper replacement. The wrapper
uses no card-preview padding class; its first/last child margins match the former
direct content edges.

Validation completed:

- `npx tsx --test tests/card-preview.test.ts tests/preview-reuse-flow.test.ts tests/text-preview.test.ts`: 52 passed.
- `npx tsc --noEmit`: passed.
- `npx eslint src/card-preview.ts`: passed without diagnostics.

This is a deterministic lifecycle regression check with mocked vault/renderer
boundaries and production queue/preview code. It is not a measured Obsidian FPS
benchmark. A deadline releases the plugin's queue slot; it cannot forcibly abort
third-party renderer work already running in the host.
