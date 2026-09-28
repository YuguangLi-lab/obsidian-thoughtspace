# Data access and security

## What the plugin accesses

| Capability | Purpose and controls |
| --- | --- |
| Vault file enumeration and reads | Board navigation, linked Markdown cards, search, PDF previews, and source references. Reading the vault is part of these features. |
| Vault writes | Save boards and edited notes, create drafts and attachments, and generate search indexes. Automatic tag-based filing and empty-folder cleanup are enabled by default: notes inside the configured card folder may move to matching tag folders when their tags change, and unused empty tag folders may be removed. Both options can be disabled in plugin settings. Removing a card from a board keeps its linked note. |
| Plugin settings and layout snapshots | Store preferences and local layout history under the plugin directory. These can contain vault-relative file paths. |
| Clipboard writes | Explicit copy commands export selected content or links. ThoughtSpace does not poll or read the system clipboard. Paste is handled through user-initiated browser/Obsidian events. |
| Remote image loading | A card with an HTTPS image URL loads that image from its host. The request exposes the usual network metadata to that host. Image elements use a no-referrer policy. |
| Optional image uploads | When enabled in settings, new images are sent through the separately installed Fast Image Bed plugin and its configured provider. Disabled by default. Credentials are managed by that plugin, and a local attachment is retained. |
| Local media outside the vault | After you explicitly link an absolute local path or `file://` URL, a small `.tsvideo` or `.tsaudio` file records the source path, size and modification time. The built-in player reads that file from its original location; it does not copy or modify the original media. These references contain local paths, so review them before sharing or syncing to another computer. Missing or changed files require linking again. |
| Media playback and external links | Audio/video playback, timestamp notes and frame capture run inside Obsidian without a separate player plugin. User actions open supported links. Compatible legacy Yingjian timestamp links are resolved to media inside the current vault; a hash of the vault path distinguishes legacy vaults and is not a secret. |

The plugin does not implement telemetry or an analytics service. This does not prevent Obsidian, Markdown embeds, other installed plugins, or an optional service from making their own requests. Community plugins run with Obsidian's privileges; they are not individually sandboxed.

## Validation and compatibility

Board JSON, imported layout snapshots, and saved preferences are checked at their input boundaries. Optional internal Obsidian capabilities are checked before use. Native Markdown editing still depends on an undocumented host interface and falls back to source editing when unavailable.

The project runs the official Obsidian ESLint rules, automated regressions, and TypeScript checks. Some compatibility warnings remain intentional, including APIs used to preserve input-method and editor behavior. CSS compatibility notices are not equivalent to vulnerabilities. Passing checks cannot establish that all bugs or vulnerabilities are absent.

## Build provenance

The tag-triggered release workflow builds with the lockfile and creates GitHub artifact attestations for `main.js`, `manifest.json`, and `styles.css`. Verify downloaded assets using GitHub CLI:

```sh
gh attestation verify main.js --repo YuguangLi-lab/obsidian-thoughtspace
gh attestation verify manifest.json --repo YuguangLi-lab/obsidian-thoughtspace
gh attestation verify styles.css --repo YuguangLi-lab/obsidian-thoughtspace
```

Attestations establish the producing workflow and repository; they do not certify that code is free of defects. Older manually published releases may not have attestations.

## Reporting

For ordinary bugs, open a GitHub issue with the plugin and Obsidian versions, reproduction steps, and a minimal anonymized example. Do not upload your full vault, credentials, or private notes. For a security issue, use GitHub's private vulnerability reporting feature if available; otherwise open an issue requesting a private contact without disclosing sensitive details.
