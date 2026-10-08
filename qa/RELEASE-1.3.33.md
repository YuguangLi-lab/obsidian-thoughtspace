# ThoughtSpace 1.3.33 release verification

The accepted functional source is `3a9de9ea762876573dbfb71cfc0ed304d5d427ed`.
Release preparation changes version metadata and documentation only. The
minimum Obsidian version remains 1.13.7. A Node 22 build must retain these
accepted runtime hashes:

| File | SHA-256 |
| --- | --- |
| `main.js` | `0ca390d8e0f7c57c8976fe8b2f04a69a796d2c20ec71a4b4a05ee87223eacf73` |
| `styles.css` | `db91160037203209e1514813246a1bc2750e1802cb1c06e83c998abdbbd68887` |

The manifest changes to 1.3.33. Package, lockfile, versions mapping and changelog
must agree with the tag. Required local and CI checks are lint, 6,331 TypeScript
tests, seven Python release-script tests, TypeScript compilation, build, a
committed-CSS comparison and ZIP validation. Lint has zero errors and 118
existing warnings.

The accepted functional build was tested in disposable Obsidian 1.14.4 profiles
and synthetic vaults, with mouse and keyboard input, reopen, undo/redo, cancel,
rapid operations and injected save failures. The final bounded supplement
passed 170/170 checks: reuse/association 62, brain actions 45, media focus 20,
settings failure recovery 43. It captured 46 screenshots with no page errors.
These checks were run in separate profiles; they do not exhaust every theme,
input and workspace combination. They are inherited functional evidence, not
new native runs after the version-only preparation.

Reproduction entry points:

- [Six improvements](six-improvements/README.md)
- [Prior controls](whiteboard-controls/README.md)
- [UI surfaces and bounded follow-up](ui-polish/README.md)

The graph performance comparison was between the prior controls build
`d25b4f2c` and the six-improvement build `0b7e322`, using the same synthetic sample
in A-B-B-A order, with 100/500/1000 total nodes and a fixed budget of seven visible nodes,
seven node DOM elements and six relation paths. Stable-refresh p50 fell from
0.8/1.3/1.7 ms to within the approximately 0.1 ms clock resolution. Invalidated
refreshes and deeper obstacle routing remain more expensive in some samples;
RAF and input tails did not consistently improve. No universal FPS claim is
made. Short memory samples without forced GC do not establish leak freedom.
These figures are inherited measurements, not a new 1.3.33 benchmark. The later
UI comparison covered `0b7e322` to `bf430c6`; the final modal accent correction
in `3a9de9e` did not receive a new graph benchmark.

The proposed separate brain pagination row is not implemented. External online
video sites, accounts and real network playback were not validated. A standalone
Calendar plugin was not installed; only its absence hint was checked. PDF
full-text indexing and OCR are outside this release.

The release workflow builds and attests `main.js`, `manifest.json`, `styles.css`,
the versioned ZIP and `SHA256SUMS.txt`. The ZIP allowlist contains only runtime
files and public project documentation. Personal notes, settings, profiles,
logs and screenshots are excluded. After publication, download all five public
assets, check their hashes and ZIP contents, and verify the attestations against
this repository's release workflow and the exact tagged source commit.
