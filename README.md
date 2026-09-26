# ThoughtSpace Whiteboard

[English](README.md) · [中文](README.zh-CN.md)

A visual research and writing workspace for Obsidian. Arrange linked Markdown notes, text, images, and PDFs on a whiteboard, connect ideas with mind maps, and turn grouped material into a Markdown draft. Your notes remain files in your vault.

**Desktop only · Obsidian 1.13.7 or newer.**

## Markdown text and tables

Double-click a text frame to edit Markdown with Obsidian's native live preview. Headings, lists, callouts, code, links, `$inline math$`, `$$display math$$` and tables render inside the frame. Automatic sizing measures the rendered content; manually narrowed tables can scroll horizontally.

Use **Table** in the side toolbar, **Add table here** in the empty-canvas context menu, or the table button in the editing toolbar. New tables select the first heading and keep the current camera position. Text stays in the board file; linked note cards continue saving to their original Markdown files. Task checkboxes in text previews are read-only; edit the text to update them.

While editing Markdown tables, lists, math or code in a mind map, Enter and Tab edit the content. Continuous topic creation remains available for plain single-line topics.

## 1.0: Organize and reuse

- **Paper background**: choose the paper icon in the bottom canvas controls or select Paper in settings. Static texture adapts to light and dark themes without changing snapping.

- **Arrange → Create group frames** organizes objects by type, color, reading state or connected component, with a preview before applying. Save reusable layout presets across boards.
- **Move into an existing group** moves a selection together, previews any enlarged boundary and preserves connections and relative positions. Undo restores the previous layout.
- **Hierarchical outline** follows actual group containment. Collapsing navigation leaves the canvas unchanged; searches retain parent paths.
- **Saved views** supports search, position diagrams, renaming, updating, reordering and navigation. It saves camera positions rather than content snapshots.
- **Workspace menu** groups arrangement, group previews, writing, reading, knowledge space and optional calendar entries; existing shortcuts remain available.

Choose cream, white, ivory, kraft or recycled paper in Appearance settings, or customize the paper color and texture strength. You can also import a local PNG, JPEG, WebP or GIF background and adjust cover, contain, tile and opacity. Images are copied into the plugin directory in the current vault; no network upload is used.

## Features

- **Whiteboards:** pan, zoom, connect cards, name groups, nest boards, arrange layouts, and search content.
- **Markdown cards:** insert existing notes, edit in place, use independent card titles, and resize or fold previews.
- **Drag existing notes:** drag from Obsidian’s file explorer, search results, or internal links onto the board. Multi-select notes are arranged together and can be undone as one batch; source files stay in place.
- **Native file workflow:** generated excerpt source links and the last writing draft follow note, PDF, and folder renames. Ambiguous sources are left untouched; Markdown prose and code examples are preserved.
- **Mind maps:** start with presets, add linked topics, navigate with the keyboard, and collapse or expand branches one level at a time.
- **Reading:** display PDF pages, capture excerpts with source links, and organize evidence alongside your notes.
- **Writing:** arrange cards and groups into an outline and export a Markdown draft while keeping references nearby.
- **Obsidian integration:** use vault files, native tags, properties, bookmarks, search, and the Markdown editing toolbar. The calendar and journal integration requires the separate optional calendar plugin.

## Editing and canvas controls

Select a card or text frame to switch directly between **Edit, Text, Fill, and Border** in the floating top toolbar. Switching modes preserves the current draft and selection; narrow panes use labelled icon controls. Preview and fold actions sit above objects, resizing has a separate lower-corner handle, and connected children keep their own disclosure controls.

The side **Insert** panel separates source materials from board structure. **More tools** combines category navigation, search, and recent commands.

## Reading workspace

Open **Workspace → Reading desk** from the board header. Search and filter material in the navigation pane, switch between content, headings and connections, and read in the main document pane. Review status, original-note access and pagination remain visible while the article scrolls. `Alt + Left / Right` switches material; status changes preserve the article and scroll position.

When linking selected text to a note, choose a heading or block and preview the reference before inserting a native link or embed. Reference actions stay at the bottom of the preview.

## Install and update

In Obsidian, open **Settings → Community plugins**, search for **ThoughtSpace Whiteboard**, then install and enable it. Use the community-plugin update checker for updates.

For manual installation, download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases/latest). Put all three files in `<your-vault>/.obsidian/plugins/thoughtspace/`, then enable the plugin. When updating, replace only these three files and keep your existing `data.json` and snapshots. Back up your vault before upgrading.

GitHub releases and the community directory update independently; check the version shown by each service. Release assets are limited to the three files installed by Obsidian. The source build can also generate an installation ZIP locally.

## Whiteboard controls

| Gesture | Action |
| --- | --- |
| Drag with the left button on empty space | Pan the board |
| Drag with the right button on empty space | Select objects; hold Shift to add to the selection |
| Right-click without dragging | Open the context menu beside the pointer |
| Drag a card | Move it |
| Drag the lower-right handle | Resize it |
| Use the branch toggle beside a parent | Collapse children or expand the next level |

The selection tool, Space + left-drag, and middle-button drag provide alternative controls. The branch toggle and resize handle have separate hit areas, including when zoomed out.

## Mind map controls

| Key or action | Result |
| --- | --- |
| Click a topic's plus port | Create a linked child and start editing |
| Drag a connection to empty space | Create and arrange a child topic |
| Tab | Save the topic and add a child |
| Enter | Add a sibling |
| Shift + Enter | Insert a line break while editing |
| Arrow keys outside editing | Navigate visible topics in the same tree |
| Shift + Tab outside editing | Return to the parent |
| F2 | Edit the selected topic |
| Esc | Cancel the current connection or edit |

Ordinary whiteboard text is not automatically converted into mind-map topics.

## Search and PDFs

Native search integration writes Markdown indexes to `ThoughtSpace/白板搜索/`. These indexes include board text, card titles, group names, and connection labels. Follow a result's location link to return to its board. Linked notes remain searchable through their original files. PDF indexing currently covers filenames and page numbers, not PDF full text or OCR. Index generation can be disabled in settings.

Select a PDF card to use **PageUp / PageDown** or **Home / End**. Page navigation and folding are also available on the card. Rendering uses bounded thumbnail sizes, cancels work for folded or offscreen cards, and limits retained PDF documents. First load still depends on document size and complexity.

## Data access and compatibility

ThoughtSpace reads vault files for search, linked cards, and optional integrations, and writes board files, edited notes, generated indexes, and settings. Copy commands write to the clipboard only when invoked. Remote images and the optional image-host integration can contact external services; the image-host option is off by default. See [data access and security](SECURITY.md) for details.

In-place live preview uses an undocumented Obsidian editor interface. If it is unavailable, the plugin falls back to source editing. Test upgrades with your own themes and plugin combination. Automated tests and the directory scorecard are useful checks, not guarantees of compatibility or security.

## Development

Requires Node.js 22 and npm:

```sh
npm ci
npm run lint
npm test
npm run build
python3 scripts/package.py
```

The build produces `main.js` and synchronizes the generated sections of `styles.css`. Packaging creates a ZIP and checksums in `dist/`; it does not include vault content, credentials, or local backups. Obsidian and CodeMirror are supplied by the host application.

See [CONTRIBUTING.md](CONTRIBUTING.md) for testing and release conventions. CI runs the official Obsidian lint rules, tests, and build. The release workflow builds the tagged source and generates GitHub artifact attestations for the runtime assets before publication.

## License

[MIT](LICENSE). Third-party components and licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
