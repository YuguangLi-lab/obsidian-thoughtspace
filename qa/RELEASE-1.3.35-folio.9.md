# ThoughtSpace 1.3.35-folio.9 / Folio Atelier 3.32.12

Independent prerelease based on 1.3.35, following folio.8. The default-branch stable release remains separate.

Fixes child connectors crossing the center source-action row. Connectors now leave the complete center card boundary. The card unifies title and actions with refined spacing, borders and hover feedback; the theme adds finer rounded connector strokes.

Validation: 7,168 tests pass with zero skips; TypeScript build and changed-file ESLint pass. Six offline light/dark layouts at 320/600/960 px cover default, short title, page two and scrolled lists (24 clearance scenes). Previous relation disclosure, heading, depth and editor interaction checks pass. Seven installer checks cover backups, configuration preservation, rollback, no-op and modified predecessor rejection.

Native Obsidian installation, window interaction and animated UI acceptance remain pending. Offline fixtures use placeholder icons. Previously noted editor-close focus restoration is outside this patch. See [installation and validation](../themes/folio-atelier/README.md).
