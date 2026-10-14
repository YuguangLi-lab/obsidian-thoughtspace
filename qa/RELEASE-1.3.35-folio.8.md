# ThoughtSpace 1.3.35-folio.8 / Folio Atelier 3.32.11

This is a separate prerelease integration based on ThoughtSpace 1.3.35 (9f6b4b8), not an update to mainline 1.3.36.

Includes project folder-color inheritance, consistent workspace feedback, material/database density, reading/writing focus continuity, keyboard retry focus, and bounded local relation tools. Theme source and installation instructions: [Folio Atelier](../themes/folio-atelier/README.md).

Validation: 7,168 local tests passed, no skips; focused offline Hub checks 32 scenes / 232 gates; local relations six layouts / 48 gates including 12 edit cross-state scenes. Installer fixtures: 121 passed. Lint passed with zero errors. Runtime assets match the frozen, tested local build.

Native installation, Electron/window interaction and full UI acceptance remain pending. Wide child relation paths can still cross the source-action row; editor close focus restoration is not implemented. Test fixtures and framework replacements do not prove native behavior.
