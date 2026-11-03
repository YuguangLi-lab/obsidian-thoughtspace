# 1.3.43 release validation

The release uses the same implementation validated in local feature commit `49a1260617bbafd1678bacd432fb37cca2a46057`, based on upstream 1.3.42 (`86ac4b91f6cfc17e2bc5d95f7798c0e7f7ac28de`). The prepared release tree differs from that local feature only in release metadata, changelog and validation documentation. GitHub publication may have a different commit identity; the complete tree and downloaded runtime hashes are checked independently.

## Local release gate — 2026-11-03

- Node 22.23.3, clean `npm ci` using the existing lockfile and offline cache.
- `npm test`: 10,323 passed, zero failures.
- Release-script Python tests: 29 passed.
- `npm run lint`: zero errors, 194 existing warnings.
- `npm run build`, board-tool typecheck/lint/build/example verification, generated CLI/CSS checks and `git diff --check` passed.
- Metadata check confirms manifest/package/lockfile/versions.json all describe 1.3.43, with minimum Obsidian 1.13.7.

The rebuilt `main.js` and `styles.css` are byte-identical to the candidate validated in an actual isolated Obsidian 1.15.0 vault. See [native validation details](MERMAID-OBSIDIAN-1.15.md): 41 full functional checks plus 10 final-stylesheet checks in a 300px sidebar. The manifest differs only in its version value. Native host: macOS, installer 1.8.10 / Electron 34.2.0 with the actual Obsidian 1.15.0 application package. No real vault was modified.

```text
215e7421320bc4b3d27943f7a05a4690c86af8e7e9b3890355763dfc5beae55e  main.js
d133e50362c164f07dd7c989926f097ee250bcdab164726b6442373b67cb111c  styles.css
81d156c89dd9fec4bb212f609faad0d79d6ba21ea2318227dfa247d9121661e1  manifest.json
```

GitHub workflow results, published asset downloads, attestations and community scans are separate publication checks and must be verified for the final release commit. Local success does not stand in for those checks. Physical mobile devices and full system IME sequences remain unverified.
