# Contributing

Use Node.js 22 and `npm ci` to install the versions from the lockfile. Keep fixes focused and explain the behavior before and after the change.

Before submitting a change, run:

```sh
npm run lint
npm test
npm run build
git diff --check
```

Add regression coverage for changes to parsing, saving, editor lifecycle, undo/redo, or pointer interactions. For UI changes, also verify in Obsidian with light and dark themes and a narrow sidebar. Check the native live-preview editor as well as the source-editor fallback when editing code changes. Use a disposable vault for destructive or migration tests.

Do not commit vaults, personal settings, private fixtures, backups, credentials, or generated `main.js`. Generated CSS sections in `styles.css` must match their source files; `npm run build` synchronizes them. Preserve other plugins' and Obsidian's interfaces and keep calendar styles isolated from the standalone calendar plugin.

## Releases

1. Update the version consistently in `manifest.json`, `package.json`, `package-lock.json`, and `versions.json`, and add a changelog entry.
2. Complete regression and native UI checks, then commit the release source.
3. Push a tag exactly matching the manifest version, for example `0.98.11`.
4. The release workflow checks version consistency, runs lint/tests/build, attests the three runtime files, and publishes those files as the GitHub Release assets.
5. Verify the release's attestations and check the community directory's new scan. Local lint results are not a substitute for that independent review.

The local packaging script can produce a ZIP and checksums for testing. They are not uploaded as additional community-plugin release assets.
