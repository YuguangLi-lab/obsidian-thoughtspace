# 1.3.44 release validation

The release includes the blank-canvas Mermaid context-menu entry validated at local feature commit `6c620b738e8ce9c3340717ca211cda7f805d12af`, based on published 1.3.43 (`330616a5b3a1dc7f0c6e8921c7e87c3f3fdd8680`). Release preparation changes only version metadata, changelog and validation notes. The complete published source tree and downloaded runtime are verified independently of commit identity.

## Local release gate — 2026-11-03

- Node 22.23.3 and a clean `npm ci` from the unchanged dependency lockfile using the existing offline cache.
- `npm test`: 10,329 passed, zero failures; release-script Python tests: 29 passed.
- `npm run lint`: zero errors, 194 existing warnings.
- `npm run build`, board-tool typecheck/lint/build/example verification, generated CLI/CSS checks, packaging and `git diff --check` passed.
- Metadata checks confirm 1.3.44 throughout manifest/package/lockfile/versions.json, retaining minimum Obsidian 1.13.7.

The rebuilt JavaScript and stylesheet are byte-identical to those tested in actual Obsidian 1.15.0. The manifest differs only in its version value. See [native validation details](MERMAID-CONTEXT-MENU.md) for native macOS menu interaction, captured right-click coordinates, creation/edit cancellation, persistence, light/dark appearance and an actual 380px right sidebar. The retained evidence passes 31 state/provenance checks. An error in the QA-only observer during the main native run was corrected; a fresh lifecycle follow-up completed without page errors. No real vault was modified.

```text
5499963672a49d4ec0a754adc1153d6ceed5f194d10d906a4a3f9ba7ec4b108c  main.js
d133e50362c164f07dd7c989926f097ee250bcdab164726b6442373b67cb111c  styles.css
292ec3e0945d54849cf0e34f48ff5d725df17361ebeb993b1ec0ff83f455cb22  manifest.json
```

GitHub CI, public downloads, asset attestations and the community directory scan are separate publication checks. Local success is not a substitute for them. Native checks for this menu change cover macOS Obsidian 1.15.0; physical mobile devices and other operating systems were not tested.
