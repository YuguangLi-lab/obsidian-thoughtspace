# ThoughtSpace Whiteboard

**AI board CLI phase 1 (`1.0.0-local`, Node 22)**: validate or inspect a file and exclusively create an ordinary, brain or handwriting board. Download the repository ZIP to run the committed CLI without installing dependencies. Read the [usage guide](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.36/docs/AI-BOARD-GUIDE.zh-CN.md), [format contract](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.36/docs/AI-BOARD-FORMAT.zh-CN.md), [synthetic examples](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.36/examples/ai-board/README.zh-CN.md), and [tool entry](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.36/tools/README.md). Handwriting examples work with 1.3.36 or the previously published 1.3.36-beta.2 plugin; `format_only` (exit 2) keeps unchecked references explicit.

**English** · [简体中文](README.zh-CN.md)

**1.3.36** brings editable handwriting, SVG export, saved reading positions, a collection workspace with board round trips, and a consistent phone/tablet UI. See the [UI guide](docs/UI-REFINEMENT.zh-CN.md), [collection guide](docs/COLLECTION-WORKSPACE.zh-CN.md), [handwriting guide](docs/HANDWRITING-IPAD.zh-CN.md) and [validation summary](qa/RELEASE-1.3.36.md). Local release validation is complete; public build and asset status are available on the [1.3.36 Release](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases/tag/1.3.36). Physical iOS/Android, Pencil, system mobile IME and mobile WebViews remain untested.

Collect material, connect ideas, and shape an article inside Obsidian. Notes, boards, and generated drafts stay in your vault.

**1.3.36 · Obsidian 1.13.7+ · MIT**

**[完整中文教程](docs/USER-GUIDE.zh-CN.md) · [Install or update](docs/USER-GUIDE.md#installation) · [Ten-minute start](docs/USER-GUIDE.md#quick-start) · [Complete English guide](docs/USER-GUIDE.md) · [Latest release](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases/latest)**

## From material to a draft

### 1. Collect on a whiteboard

Bring notes, PDFs, images, audio, and video together. Group evidence, keep excerpts and ideas nearby, and retain links to source files.

![Whiteboard with urban cooling research material, linked notes and an article plan](https://raw.githubusercontent.com/YuguangLi-lab/obsidian-thoughtspace/main/docs/images/whiteboard-research.png)

### 2. Connect ideas in a brain board

Build parent/child branches and left/right bidirectional associations around a current center. Keep an idea in the graph, then create a note or link an existing note while preserving the idea. Show 1–5 relationship hops, search, and page through larger graphs.

![Dedicated brain board relating shade, surface materials and walking routes](https://raw.githubusercontent.com/YuguangLi-lab/obsidian-thoughtspace/main/docs/images/brain-research.png)

### 3. Arrange and write

Open the writing workspace, order cards, groups, and chapters, pin references, write or preview, and generate a separate Markdown draft. Arrangement and draft generation do not automatically rewrite source notes.

![Writing workspace with article order and material from the current board](https://raw.githubusercontent.com/YuguangLi-lab/obsidian-thoughtspace/main/docs/images/writing-research.png)

*Actual 1.3.35 interfaces in a dedicated synthetic vault. “Urban cooling research” is a teaching example, not research data.*

## Choose a starting point

| Your goal | Guide |
| --- | --- |
| Create an ordinary, brain or handwriting board and choose its file format | [Boards and files](docs/USER-GUIDE.md#boards) |
| Capture body-first notes and navigate to their exact board references | [Collection workspace](docs/COLLECTION-WORKSPACE.zh-CN.md) |
| Select and edit whole ink strokes, export SVG or compare recovery versions | [Handwriting](docs/HANDWRITING-IPAD.zh-CN.md) |
| Insert notes, PDFs and images; edit cards and groups | [Board objects](docs/USER-GUIDE.md#objects) |
| Organize relationships and fold or expand reading | [Mind maps and brain boards](docs/USER-GUIDE.md#mind-maps) |
| Read sources, take excerpts and find unread material | [Reading](docs/USER-GUIDE.md#reading) · [Search and material lists](docs/USER-GUIDE.md#search) |
| Watch, capture frames and follow timestamps to a source | [Audio and video](docs/USER-GUIDE.md#audio-video) |
| Order an outline, pin references and generate a draft | [Writing](docs/USER-GUIDE.md#writing) |
| Find commands, set hotkeys or resolve saving problems | [Controls](docs/USER-GUIDE.md#controls) · [Troubleshooting](docs/USER-GUIDE.md#troubleshooting) |

## Everyday work in 1.3.36

- **Collect first, organize later.** Open **打开收集**, write the body, and save with ⌘/Ctrl+Enter. Native tags, existing attachments and board/group delivery are optional. Records remain in a creation-time stream after delivery; old notes are not automatically relabeled.
- **Follow a record to each board occurrence and back.** Choose the exact card when a note appears more than once. Return with filters and the current browsing position intact, including a temporary reveal of hidden records. Renames are rechecked; obsolete requests and other windows do not take over focus.
- **Write and edit ink.** Choose **Handwriting board (手写白板)** in the creation dialog. Lasso whole strokes, move, copy or delete them, and export an SVG to an existing note with a backlink. SVG is a visual copy, not an editable-ink import format. Read-only disk/local/recovery comparison helps investigate saving failures.
- **Resume reading and navigate sources.** Name brain reading positions, copy their links, browse each note occurrence across boards/groups, and return to the departure point. Four-direction brain actions remain available outside the zoomed scene. Optional cluster compaction preserves internal geometry.
- **Use smaller screens without changing the content model.** Container layouts, visible-keyboard space and touch controls cover boards, media, writing, reading, materials, PDF and settings. The collection follows the selected accent and density. Editors, players and drafts keep their existing ownership.
- **Keep native Properties and save protection.** Markdown boards retain Obsidian Properties and prose; read-only states, pending native saves and conflicts remain explicit. Existing-note linking, resume-last-board and four relationship commands remain available.

Read the [complete guide](docs/USER-GUIDE.md), [mobile guide](docs/MOBILE-ADAPTATION.zh-CN.md) and [Markdown board guide](docs/markdown-boards.zh-CN.md). The independent [AI board CLI](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.36/tools/README.md) continues to validate/inspect and exclusively create files; it does not add an AI service, npm release or MCP server to the plugin.

## Install or update

1. In Obsidian **Settings → Community plugins**, search for **ThoughtSpace Whiteboard**, install, and enable it. The community directory and GitHub releases can update at different times.
2. For manual installation, download **`main.js`, `manifest.json`, and `styles.css`** from the [Release](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases/latest), and place them in your vault's `.obsidian/plugins/thoughtspace/`. Use the corresponding folder if you have a custom configuration directory.
3. To update, replace only those three runtime files, retain `data.json`, `collection-drafts/` and other plugin data, and reload the plugin. ZIP and checksums are manual download, extraction and verification aids; Obsidian installs the three runtime files.
4. Open the command palette and run **新建白板或脑图…**. For the tutorial, choose an ordinary Markdown board and name it “Urban cooling research”.

## Files and saving

Existing `.thoughtspace` boards remain supported and are not automatically migrated. **另存为 Markdown 白板** creates a separate copy, keeping the original file and existing links. A Markdown board contains real Properties, regular prose, and a plugin-managed layout section. Do not edit the layout JSON directly.

Note cards reference source files; in-place editing saves to that note. Built-in text and layout stay in the current board. Dynamic material lists belong to the ordinary board's full search dialog: they save filters and recalculate when reopened. Saved camera views retain position and zoom. Neither is a prose backup.

Save protection does not automatically merge whole-document copies or unlock read-only content. Collection journals can restore confirmed draft checkpoints across normal reopening; other memory-only drafts do not gain that guarantee. Handwriting preserves an unfinished stroke across normal resize, but a submission exceeding the sample budget is rejected: the source file stays intact and the rejected draft is cleared. Unsaved native input can be lost on forced exit.

The no-Node mobile probe covers module evaluation and plugin construction only, not `onload`, a mobile WebView, UI or storage. Physical devices, Pencil, system mobile IME, complete palm rejection and device performance remain unverified. See [saving and recovery](docs/USER-GUIDE.md#troubleshooting), [1.3.36 validation and release checks](qa/RELEASE-1.3.36.md), and [security and data access](SECURITY.md).

## Project

[Issues](https://github.com/YuguangLi-lab/obsidian-thoughtspace/issues) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE) · [Third-party licenses](THIRD_PARTY_NOTICES.md)

Settings support Chinese and English; most other interfaces remain Chinese. Calendar/journal integration uses an optional separate plugin. Development uses Node.js 22: `npm ci` → `npm run lint` → `npm test` → `npm run build`. The repository workflow builds release assets and provides artifact attestations.
