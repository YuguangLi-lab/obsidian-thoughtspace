# External Media Timestamp Link Regression

Local follow-up to `online-board-capture/IMPLEMENTATION.md`, 2026-09-29.
Base commit: `c0189f3284cb64453408c66f47bbf70ff7995f11`.
This test build includes the earlier online board capture implementation.

## Reproduction And Cause

The reported message was `媒体链接无效或属于其他仓库` when following a
timestamp for an external local video. The user's original failing URL was
requested but was not available for this verification.

Synthetic vault and paths containing both spaces and literal plus signs
reproduced the exact message. The old generators used URLSearchParams form
encoding, which writes spaces as `+`. Obsidian's URI callback parser uses
decodeURIComponent per field and leaves those plus signs intact. Consequently
the exact vault check fails, or path lookup fails when only a path has spaces.

The desktop URI parser from the installed launcher ASAR (1.8.10) and the cached
renderer parser (1.11.7) were independently extracted read-only and run with
synthetic inputs. Both confirmed the mismatch and the corrected round trip.
No user notes or installed plugins were modified.

## Fix And Compatibility

- New board, standalone local-player, and online-player links encode spaces as
  `%20`; a genuine plus remains `%2B`. Decoded callbacks are never decoded again.
- Whiteboard preview clicks read the original local-media href in the capture
  phase. This supports legacy links, including embedded Markdown previews,
  without rewriting any existing notes.
- The same-vault, exact source, node, and path checks remain in place. Invalid
  references do not silently switch to another file or vault.
- Legacy links outside whiteboard previews, inside editors, or opened with
  modifier clicks still use native handling and may need to be regenerated.
- The `.tsvideo` / `.tsaudio` file remains the reference; the original media
  stays outside the vault. Moved or changed external files remain subject to
  the existing source validation checks.

## Verification

With the bundled Node binary on PATH:

```sh
node node_modules/tsx/dist/cli.mjs --test tests/media-protocol-encoding.test.ts
node node_modules/tsx/dist/cli.mjs --test tests/local-media-board-link-events.test.ts
node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node esbuild.mjs
python3 scripts/package.py
python3 -m unittest scripts/test_verify_release.py
```

- Encoding tests before fix: 6 failed, 2 passed; after fix: all 8 passed.
- Legacy click tests before fix: 5 failed with the reported message, 2 passed;
  after fix: all 7 passed, including capture-phase dispatch ordering.
- Full functional suite: 3,917 passed, no failures or skipped tests.
- TypeScript, build, archive-content verification, and diff whitespace checks
  passed. Release verification script tests: 7 passed.
- ESLint on the four affected production modules: 0 errors, 47 warnings.
- Independent review found no blocking issue. Production external-reference
  seek routing was also exercised in memory with a synthetic TFile and player.

Real playback in the user's failing vault has not been verified. This environment
has Obsidian 1.11.7; the repository declares a minimum version of 1.13.7.

## Package

`dist/thoughtspace-1.3.13-media-links-fix-test.zip`

SHA-256: `98dc9e62e21a114fbb748e0bdcfe61240fdbfb461ee036299dd05340d3ea286f`

The previous `thoughtspace-1.3.13-online-board-capture-test.zip` was retained
unchanged and its original SHA-256 was verified. Nothing was pushed to GitHub.
For installation in a compatible test vault, back up the installed plugin's
runtime files and replace only `main.js`, `manifest.json`, and `styles.css`.
Keep settings, playback state, reference files, notes, and attachments intact.
