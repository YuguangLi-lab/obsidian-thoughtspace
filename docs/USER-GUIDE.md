# ThoughtSpace Whiteboard user guide

[English](USER-GUIDE.md) · [中文完整教程](USER-GUIDE.zh-CN.md) · [Project home](../README.md)

This guide covers **ThoughtSpace Whiteboard 1.3.35** for **Obsidian desktop 1.13.7 or newer**. Follow the *Urban cooling research* project below, then use the later sections as a reference. Settings support Chinese and English; most workspace controls currently use Chinese. Their exact Chinese names appear beside the English instructions so you can find them in menus or the command palette. Narrow panes may show icons instead of text; hover for the tooltip.

## Contents

- **Start:** [Install](#installation) · [Guided research project](#quick-start) · [Workspace](#workspace) · [Mouse and keyboard](#controls)
- **Build:** [Cards and Markdown](#cards) · [Import material](#media-import) · [Connections](#connections) · [Groups](#groups) · [Mind maps](#mind-maps) · [Appearance](#appearance)
- **Work:** [Read](#reading) · [Write](#writing) · [Audio/video](#audio-video) · [Properties and search](#obsidian) · [Calendar](#calendar)
- **Maintain:** [Settings](#settings) · [Save and export](#data) · [Troubleshooting](#troubleshooting)

<a id="installation"></a>

## 1. Install or update

### Install from the community directory

1. Open Obsidian **Settings → Community plugins** and browse for **ThoughtSpace Whiteboard**.
2. Install and enable the plugin if it is available in your directory.
3. Open the command palette and search for `ThoughtSpace`.
4. Run **新建白板或脑图…** (New whiteboard), or **创建入门示例白板** (Create a starter example).

The community directory and GitHub releases can update at different times. If the version you need is unavailable in the directory, use the manual method below.

### Install manually from GitHub

1. Open [GitHub Releases](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases).
2. Select a release and download its three runtime assets: `main.js`, `manifest.json`, and `styles.css`.
3. Create `<your-vault>/.obsidian/plugins/thoughtspace/` if necessary.
4. Put all three files directly in that folder, without an extra nested release folder.
5. Restart Obsidian or reload the plugin, then enable **ThoughtSpace Whiteboard** in Community plugins.

Use your vault's actual configuration folder if it differs from `.obsidian`. The GitHub source ZIP is source code; it is not a substitute for the three built release assets.

The release asset named `thoughtspace-<version>.zip` is an alternative download containing the built files and public documentation. Extract it, then put its three runtime files directly in the plugin folder. A nested `thoughtspace-<version>/` directory inside `plugins/thoughtspace/` will not work. `SHA256SUMS.txt` is an optional integrity check for the release assets; it is not an installation file. If checking hashes, compare against that same release's checksum file before installing.

### Update an existing installation

1. Save open edits and media excerpts, and back up the vault, including its plugin configuration folder.
2. Disable ThoughtSpace before replacing its files.
3. Replace **only** `main.js`, `manifest.json`, and `styles.css` with files from the same release.
4. Keep `data.json`, layout snapshots, background images, playback state, and existing vault content.
5. Re-enable the plugin, check the displayed version, and open an existing board to verify it.

For a community installation, you can instead use Obsidian's community-plugin update checker. Local media excerpts have a separate [device-local draft recovery feature](#audio-video), but save them before updating. That recovery feature does not protect arbitrary unsaved Markdown input.

<a id="quick-start"></a>

## 2. Build an Urban cooling research project

Use your own source notes, a research PDF, a street photograph and, optionally, a local interview recording. Example questions below are working prompts, not research findings. You can follow the note-only steps without media.

<a id="boards"></a>

### Choose a board type and file format

1. Run **新建白板或脑图…** (New whiteboard or brain board), or choose it from the sidebar's **新建** (New) menu.
2. Set **白板类型** (Board type) and **文件格式** (File format), name the board `Urban cooling research`, then click **创建** (Create).
3. For this tutorial, choose **普通白板** and **Markdown (.md)**. Wait for the board to open before continuing.

| Board type | File format | Use it for |
| --- | --- | --- |
| **普通白板** (Ordinary whiteboard) | **Markdown (.md)** | Freely arrange evidence with native Obsidian Properties and Markdown in the same board file |
| **脑图白板** (Dedicated brain board) | **Markdown (.md)** | Browse relationships around a changing center, with native Properties in the same file |
| **普通白板** | **旧格式 (.thoughtspace)** (Legacy format) | Continue an existing free-layout workflow in the original board format |
| **脑图白板** | **旧格式 (.thoughtspace)** | Use the same dedicated relationship view in the original format |

On a fresh installation, the unified dialog starts with an ordinary board in legacy format. It remembers choices only after successful creation and opening; existing boards keep their format. The explicit **新建 Markdown 白板**, **新建 Markdown 脑图白板**, **新建旧格式白板** and **新建旧格式脑图白板** commands remain available. A dedicated brain board is different from the ordinary whiteboard's topic-tree templates under **新建思维导图**; [section 9](#mind-maps) explains both.

### Collect and connect evidence

1. Double-click empty canvas, write `Which cooling strategies fit dense neighbourhoods?`, then click **保存** (Save).
2. Choose **插入内容 → 已有笔记** and select your `Tree canopy` source note. Add `Reflective roofs` the same way. These are references to the original notes.
3. Drag your research PDF and street photograph from Obsidian's file explorer onto empty canvas, or use **插入内容 → PDF 卡片 / 图片**. Open the PDF with **右侧阅读 PDF** when you need its original context or selectable text.
4. Click **新建卡片** to make a reusable note named `Cooling comparison`, and write your interpretation. A **文本** frame instead keeps text inside the board.
5. Click **连线** and connect the source material to your comparison. Double-click a line and add a short label such as `evidence for` or `needs checking`.
6. Right-drag empty canvas to select the material, then click **分组框** and name it `Evidence`. Open **整理白板**, review the preview and choose **应用布局** when the proposed arrangement works.

![Ordinary whiteboard: question, source notes and article structure](https://raw.githubusercontent.com/YuguangLi-lab/obsidian-thoughtspace/main/docs/images/whiteboard-research.png)

Actual 1.3.35 UI in a dedicated synthetic tutorial vault; the example illustrates the workflow rather than research findings.

### Explore a question as a brain board

1. Create a second board named `Urban cooling relationships`, choosing **脑图白板** and **Markdown (.md)**.
2. Click **添加知识节点** (Add knowledge node), choose **引用已有笔记** (Reference existing note), select `Tree canopy`, then confirm. The first node becomes the center.
3. Use its bottom **添加子节点** (Add child) control, choose **先记想法** (Record an idea first), and enter `Compare maintenance needs`. Click **确定** (Confirm).
4. Open the idea's node menu → **整理成笔记** (Organize as note). Choose **新建笔记** to give it its own Markdown file, or **保留想法并关联已有笔记** to keep the complete idea and link it to `Cooling comparison`. The latter does not rewrite that note's body.
5. Click another node's title to make it the center. Use **关系显示层级** (Relationship depth) to explore 1–5 hops, and the node's expand action to read its content. **后退** and **最近浏览** return to earlier centers.

![Brain board: two relationship levels, an association and expanded ideas](https://raw.githubusercontent.com/YuguangLi-lab/obsidian-thoughtspace/main/docs/images/brain-research.png)

Actual 1.3.35 UI in a dedicated synthetic tutorial vault; the example illustrates the workflow rather than research findings.

### Add native Properties, then return to the same board

1. On the ordinary Markdown board, choose **原生属性与 Markdown** (Native Properties and Markdown) in the header. On a brain board, use its **脑图菜单**. Both reuse the current tab.
2. In Obsidian's native Properties, add a text property such as `research_stage: collecting` and a tag such as `urban-cooling`. Keep the `thoughtspace: board` declaration.
3. Save with Obsidian's usual command. From the native page's menu, choose **返回白板** (Return to board), or run **切换白板与原生属性** (Switch board and native Properties).
4. If another native page for that file remains open, save and close it first. The board waits for confirmed native saving before it resumes layout editing.

### Keep a source moment and produce a draft

1. If you have an interview recording, open it with **在右侧栏打开媒体播放器**. Click **记下此刻**, write a short excerpt, then **保存摘录**. Click the saved timestamp to return to the source moment. [Section 13](#audio-video) covers screenshots and sending an excerpt to the board.
2. Back on the ordinary research board, open **工作区 → 白板写作模式**. In **编排**, arrange `Evidence`, `Cooling comparison` and a concluding chapter.
3. In **写作**, develop your argument, keeping material in **固定参考**. Check **预览**, then click **生成草稿** to create a separate Markdown manuscript.
4. Wait for **已保存** on the board. Before a major rearrangement, use **工作区 → 快照与导出 → 保存布局快照**. Next time, **继续上次白板** (Resume last board) returns to your latest valid recent board.

![Writing workspace: article arrangement and the material library](https://raw.githubusercontent.com/YuguangLi-lab/obsidian-thoughtspace/main/docs/images/writing-research.png)

Actual 1.3.35 UI in a dedicated synthetic tutorial vault; the example illustrates the workflow rather than research findings.

## 3. Understand what is stored where

| Object or output | Where its content lives | What editing changes |
| --- | --- | --- |
| Whiteboard or dedicated brain board | A Markdown `.md` board or legacy `.thoughtspace` file in the vault | Object positions, connections, local board text, groups and board settings; a Markdown board also has native Properties and body text |
| Markdown card | A linked `.md` file | Editing the card body edits the original note |
| Text frame or brain idea | Inside the current board file, in either format | Local board text; no separate note is created until you choose to make one |
| Table in a text frame | Markdown inside the board file | The board's text content |
| Image, PDF, audio, or video card | A reference to a file or supported image URL | The card's presentation; the source remains separate |
| External local media | A `.tsvideo` or `.tsaudio` reference in the vault | The original media stays outside the vault |
| Generated writing draft | A new `.md` file under `ThoughtSpace/草稿/` | An independent document for continued writing |
| Layout snapshot | Plugin folder's `layout-snapshots/` directory | Restores board data; does not restore linked note bodies |

A note can appear on several boards or more than once on one board. Those cards share the same note body, even when their board titles and appearance differ. Removing a card with **移出白板（保留文件）** removes its board reference and leaves the file in the vault. Board undo likewise does not delete separately created notes or attachments.

Markdown boards declare `thoughtspace: board` in their native Properties and store layout in a marked JSON section. Ordinary Markdown notes remain ordinary notes. Keep the marked layout section intact when editing the native page. If you want a Markdown copy of a legacy board, run **另存为 Markdown 白板**; the source file and links to it remain. See [native Properties and format copies](#obsidian) and the [detailed Markdown board guide](markdown-boards.zh-CN.md).

<a id="workspace"></a>

## 4. Find your way around

### Open the main places

| Entry | Purpose |
| --- | --- |
| **ThoughtSpace 侧边栏** ribbon icon / **打开 ThoughtSpace 侧边栏** command | Browse cards, boards, tasks, and the outline |
| **打开空间总览** command | Browse your knowledge space and boards |
| **继续上次白板** command | Open the latest valid recently visited board, or fall back to the space hub |
| **打开研究工作台** command | Open the research workspace |
| **新建白板或脑图…** / **从模板创建白板** commands | Create a board |
| **新建思维导图** command | Start a mind map with a preset |
| **ThoughtSpace 音视频笔记** ribbon icon | Play and annotate media without opening a board |

Ordinary whiteboards retain Obsidian's title bar. A compact vertical toolbar floats on the left of the canvas for selection, connections, **新建卡片** (New card), text, insertion, grouping and arrangement. The top formatting toolbar appears for the selected objects; its extra style parameters start collapsed. Bottom view controls handle background, grid snapping, zoom, fit and overview, with horizontal scrolling in narrow panes. The sidebar keeps **卡片 / 白板 / 任务 / 大纲** above search. The board header includes undo/redo, search, **常用视角**, focus mode and **工作区**. Dedicated brain boards use their own center navigation, node search and relationship controls instead; they also show save and protection status.

The interface follows Obsidian's theme, including light and dark colors. Paper and image backgrounds are optional. Plugin-control accents do not replace Markdown link, task-checkbox or user-selected node colors.

### Keep large boards navigable

- Click **适应** (Fit) to show visible board content, or **聚焦所选** (Focus selection) to inspect selected objects.
- Toggle **白板总览** (Board overview) for a miniature navigation view.
- Use the sidebar tabs **卡片 / 白板 / 任务 / 大纲** (Cards / Boards / Tasks / Outline).
- The outline follows actual containment within group frames. Collapsing an outline entry only changes navigation.
- Use **常用视角** (Saved views) for named camera positions such as `Sources` and `Draft structure`.
- Saved views can be searched, renamed, updated, reordered, and reopened. They are camera positions, not content backups.
- Double-click the board title, or right-click it and choose **重命名白板**, to rename the board.
- Use **复制白板链接** or an object's location-link action to return to a specific board or item later.

For `Urban cooling research`, save an ordinary-board view named `Evidence` before focusing on the comparison. Alt + Left/Right returns through that view's current navigation trail. The board's last saved camera survives reopening; the temporary free-board navigation trail is cleared when its session changes. Dedicated brain boards save their latest center, camera, expanded nodes, pins, relationship depth and bounded center history. Their **后退 / 前进 / 最近浏览** controls revisit centers; named multiple brain reading positions are not included in 1.3.35.

To continue after closing a project, run **继续上次白板**. It validates recent files, skips missing or damaged candidates and opens the space hub when none remain usable. To choose a different project, open **打开空间总览 → 最近打开** (Space hub → Recently opened). Recent visits and **最近修改** (Recently modified) sorting answer different questions. You can bind the resume command in Obsidian's Hotkeys settings; it has no default shortcut.

<a id="controls"></a>

## 5. Select, move, resize, and configure input

These are the defaults. Your settings under **Settings → ThoughtSpace → 鼠标与键盘** (Mouse and keyboard) take precedence.

| Gesture on the board | Default result |
| --- | --- |
| Left-drag empty space | Pan |
| Right-drag empty space | Draw a selection rectangle; Shift adds to the selection |
| Right-click without dragging | Open the context menu beside the pointer |
| Shift + left-drag empty space | Temporarily select objects |
| Space + left-drag | Temporarily pan |
| Middle-button drag on empty space | Pan |
| Scroll wheel | Zoom around the pointer |
| Drag an object | Move the object |
| Drag its lower-right handle | Resize |
| Double-click text or a note card | Edit its content |
| Double-click empty space | Create and edit board text |

Shift-click a card to add it to or remove it from the selection. Shift-drag a selected card keeps the selection together and moves horizontally or vertically when axis lock is enabled. A lower-right handle resizes only its own card while preserving the other selected cards; Shift-drag preserves its proportions when aspect lock is enabled. Releasing the pointer outside the board also ends the operation.

Click **框选** (Selection) to make left-drag select objects. The mouse presets are **默认方案** (Default), **左键框选** (Left-button selection), and **触控板** (Trackpad). The trackpad preset changes the wheel to pan; in pan mode, Ctrl/Cmd + wheel zooms. Pinch zoom remains available. You can change each mouse button, wheel direction, speed, zoom anchor, and drag threshold independently.

The settings also control alignment guides, Shift axis locking, Shift aspect-ratio locking, and grid spacing. Use **网格吸附** (Grid snapping) in the bottom controls to snap objects when the drag ends. The visual paper or image background does not change snapping behavior. Image and PDF resizing preserves their proportions; text frames can be resized more freely. Right-click **锁定所选** (Lock selection) to protect objects; choose **解锁所选** before editing their geometry again.

### Keyboard reference

Click the canvas first. These keys apply outside text editing and interactive controls unless stated otherwise. `Cmd` is the macOS modifier; use `Ctrl` on Windows/Linux.

| Key | Action |
| --- | --- |
| F | Fit visible content |
| Shift + F | Focus selection |
| F2 | Edit a selected note card or text frame |
| Enter, on a free board | Edit the selected note card or text frame |
| Arrow keys, on a free board | Move selected objects by 1 px by default |
| Shift + arrow keys | Move by 10 px by default |
| Ctrl/Cmd + F | Search the current board |
| Ctrl/Cmd + Z / Ctrl/Cmd + Shift + Z | Undo / redo board changes |
| Delete or Backspace | Remove selected objects from the board |
| Esc | Cancel the current gesture/connection or clear canvas selection and tools |
| Alt + Left / Right | Travel through remembered board views |
| Ctrl/Cmd + Shift + P, on the canvas | Open **白板操作** (Board actions) |

F, Shift + F, F2, and free-board Enter can be disabled with **启用白板快捷按键**. Arrow movement and deletion have their own switches and step settings. For personal shortcuts, open Obsidian's **Hotkeys** settings and search `ThoughtSpace`. The **白板：…** commands expose board actions for custom bindings without assigning new default hotkeys.

### Commands for a dedicated brain board

Click a node's title to make it the brain board's current center first. These commands act on that center. Open Obsidian's command palette, or bind them in **Settings → Hotkeys**. All four have **no default hotkey**:

| Command | Relationship to the current node |
| --- | --- |
| **脑图：添加父节点** | New parent → current node |
| **脑图：添加子节点** | Current node → new child |
| **脑图：添加左侧关联节点** | Current node ↔ associated node, with a left-side placement hint |
| **脑图：添加右侧关联节点** | Current node ↔ associated node, with a right-side placement hint |

Each opens the same source/confirmation dialog as the matching node control. It can record an idea or reference/create a file. Left/right associations are not sibling or parent/child relationships. Commands are unavailable while editing text, composing IME input, saving a creation, or working on a protected/locked target. The focused item must still be valid when the command executes after the palette closes.

Automated composition guards and real keyboard checks exist, but the complete trusted native IME start/commit/end sequence was not confirmed in the 1.3.35 CDP probe. Do not interpret it as verification of every OS input method or keyboard layout; see [the input-validation boundary](../qa/RELEASE-1.3.35.md#完整进程重开与输入边界).

<a id="cards"></a>
<a id="objects"></a>

## 6. Write with cards, text, math, and tables

Select or hover over a card to show its compact action strip: edit, read in the right sidebar, inspect references, toggle content fitting, and collapse. Text cards provide edit, automatic height, and collapse. The fitting button stays highlighted while enabled; switching it off preserves the current size. Buttons remain 28 screen pixels wide at 50%–200% canvas zoom. Obsidian body fonts and the card’s transparent fill are preserved.

**编辑 / 阅读** (Edit / Read) are the primary note-card actions. Folded note and text cards have an expand arrow inside the title strip. For long notes, **继续阅读** scrolls down by part of the visible page and disappears at the end; an empty note offers **写下第一行想法** to open the native inline editor. The top formatting bar separates object/mode selection from its parameters and wraps fields in narrow windows.

### Choose the right kind of text

Use **新建卡片** for an idea that should become a real note, searchable and reusable throughout Obsidian. New card files use the configured card directory, initially `ThoughtSpace/卡片/`. Use **文本** (Text), or double-click empty space, for labels, questions, and local working notes.

1. Double-click a card or text frame to edit.
2. Write Markdown with the native live-preview editor and formatting toolbar.
3. Click **保存** (Save) in the bottom editing bar, or Ctrl/Cmd + Enter. Use **取消本次编辑** or Esc to abandon the current edit. If saving fails, the draft remains editable and the Save action becomes **重试** (Retry); Copy stays available. Narrow panes retain the save status and icon tooltips.
4. For a note card, choose **右侧打开笔记** (Open note on the right) to inspect its actual source file.

Right-click a card and choose **修改卡片标题** (Change card title) to give that board instance its own label. This is separate from renaming the Markdown file. Right-click local text and choose **转换为笔记** (Convert to note) when it becomes worth reusing.

### Try formatted content

Paste this into a text frame:

```markdown
## Urban cooling questions

- Compare canopy and roof interventions in the original evidence.
- [ ] Check whether the measurement conditions are comparable.

> [!note]
> Keep the source and your interpretation distinguishable.

Inline math: $\Delta T = T_{before} - T_{after}$

$$
\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i
$$

| Claim | Evidence | Next step |
| --- | --- | --- |
| Canopy comparison | [[Tree canopy]] | Check measurement context |
```

Headings, lists, links, code, callouts, inline/display math, and tables render in the frame. Task checkboxes in board-text previews are read-only; enter edit mode to change them. If live preview is unavailable in your host, a Markdown source editor is used instead.

Tables fit their content by default. Manual resizing or disabling auto-fit preserves manual dimensions. Table cards display the grid directly, without an outer text frame. Transparent fills and fine cell grid lines distinguish rows and columns in both preview and native editing.

For a fresh table, use **插入内容 → 表格**, right-click empty space and choose **在此添加表格**, or use the editing toolbar's table button. The first header is selected for replacement, without moving your camera. Wide tables can scroll horizontally after you narrow their text frame. Text automatically fits rendered content when auto height is enabled; right-click **关闭自动适应高度** to keep the current size. For linked notes, **自动适应笔记大小** adjusts the card preview to its content.


### Card styles

Select one or more Markdown cards or text boxes and open **卡片** (Card) in the top toolbar to choose **Transparent / Solid / Color title band / Double-line paper / Index / Sticky**. The title band displays the board-specific card title. Use **背景 → 卡片颜色** (Background → Card color) for a preset or custom band color. Double-click the title to edit the card label without renaming the note. Leaving the title unchanged creates no fixed alias. The paper style adds a fine double frame and a decorative paperclip; its background color also tints the paper and the gap between the frame lines. Fixed-size cards keep their reading position when switching styles.

**Index** adds a colored spine and a separate title for structured notes. **Sticky** keeps the content-first layout with a softly tinted surface and a small folded corner. Both follow the background color, preserve custom borders and support dark themes. Previews reflect the selected color when it is shared by all selected cards, and wrap in narrow panels. Mixed-color selections use the theme accent for previews without changing the cards' colors.

Under **Settings → ThoughtSpace → Cards & notes → Default card style** (**卡片与笔记 → 默认卡片样式**), choose the default for new Markdown cards, including notes dragged or inserted onto a board. Existing cards keep their appearance; images, PDFs, web cards and newly created text keep their existing defaults. Styles support board undo, style copy/paste and persistence, while retaining the Markdown draft, fold state and Obsidian body font.

Text boxes can use all six styles without becoming note files. Their color band has no file title. Mixed note/text selections share the picker; locked objects cannot change styles.

**Downgrade compatibility:** Decorative text styles (band, paper, index and sticky) require ThoughtSpace 1.3.26 or later. Version 1.3.25 reports a read error and refuses to open boards containing them; it does not convert them. Before downgrading, use the newer version to switch these text boxes to Transparent or Solid and save. Keep a board backup.

<a id="media-import"></a>

## 7. Bring notes, PDFs, and images onto a board

### Reuse existing vault files

1. Keep a board visible beside the Obsidian file explorer or search results.
2. Drag Markdown notes, PDFs, images, or supported media onto an empty board area.
3. Check the inserted objects and arrange them as needed.

Dragging existing vault files retains their source paths; it does not move those files. Multiple selected notes, including supported mixed-file batches, can be undone as one board operation. Internal-note links can also be dragged onto the board. Use **插入内容 → 已有笔记 / PDF 卡片 / 图片** when a picker is more convenient.

The image menu supports local images and image links. Remote images may contact their host when displayed. The optional image-host integration is disabled by default; enabling it requires the separate supported image-host plugin and its configuration.

### Webpage cards and image-host shortcuts

Choose **插入内容 → 网页卡片** and enter an HTTP(S) URL, or paste/drop a single webpage URL onto the blank board. Cards support connections, resizing and folding. New cards open a 640 × 460 page preview with compact address actions; some websites prohibit embedding, so use **打开网页** instead. Cards show the domain and URL without automatically fetching page titles. Native Canvas export preserves a link node.

The cloud button above an image uploads it through your configured **极速图床** plugin; once hosted, it copies the URL. Local attachments remain available for fallback.

### Read a PDF and keep its source

1. Insert a **PDF 卡片** (PDF card).
2. Use its page controls or right-click **选择 PDF 页码…** to select a page.
3. With the expanded PDF card selected and the canvas focused, use PageUp/PageDown; Home/End navigate to the ends when the page count is known.
4. Choose **右侧阅读 PDF** (Read PDF on the right), or run **在右侧阅读 PDF 并摘录**.
5. Select text in Obsidian's reader, then drag the selection onto an empty board area. The PDF selection toolbar also provides **拖到白板**.
6. Review the excerpt and its source link; click the source when you need to check the original context.

PDF cards are page previews. A scanned PDF needs an existing text layer for text selection; ThoughtSpace does not perform OCR. Folded and offscreen cards release rendering work. Large or complex PDFs can still take time to load initially.

### Paste PDF / PDF++ references

Search **粘贴 PDF / PDF++ 引用** in **白板操作** (Board actions). Paste copied wiki/Markdown links, quoted passages, or rectangular embeds, review the resolved source, and choose **加入白板** (Add to board). One import creates one editable card and one undo step. Repeating identical content focuses the existing card. For relative links copied from a Markdown note, enter that note's full vault path; ambiguous PDF filenames require a path or explicit source-note context.

The source menu offers the original copied text, the full PDF location, and **仅打开 PDF 页** (Open PDF page only). PDF fragments and note block references remain separate. PDF++ is optional: enhanced selections, annotations and rectangular embeds depend on the reader/plugin; page-only navigation remains available. ThoughtSpace uses Obsidian's public link-opening API, never invokes PDF++ copy commands, and does not edit PDFs or source notes. It does not register automatic PDF++ backlinks to board cards. The original clipboard text is retained as provenance in the board, independently of subsequent card edits. Different original clipboard syntax is retained separately; only identical original text, context and content deduplicate. Obsidian renames update rendered links and rectangular embeds while leaving code examples and the original snapshot unchanged. Imported cards initially fit their content height.

### Extract passages from notes

Run **在右侧打开笔记，选字拖入白板**, select a Markdown note, and drag selected text onto empty canvas. The destination preview distinguishes a new excerpt from **追加证据** (Append evidence) when hovering over an eligible note card. Drop on empty space when you want a separate excerpt rather than appending to a target.

For structured imports, run **打开材料工作台** (Open materials workbench). Select a source note, review extracted fragments, choose the pieces to import, and inspect grouping/source-link options before applying. The workbench also has an outline workflow for turning structured material into mind-map topics. Created excerpt notes remain in the vault if you undo their placement on the board.

<a id="reading"></a>

### Read your collected material

Open **工作区 → 打开阅读桌** (Workspace → Open reading desk). Search the material list, filter the board or opening selection, and switch between **内容 / 目录 / 关联** (Content / Headings / Connections). Use the reading-state control, **已读并下一篇** (Mark read and next), and **右侧打开原文** (Open original on the right). Alt + Left/Right switches items while the reading desk owns focus outside editable controls. Changing reading status preserves the current article and scroll position. The reading desk includes notes, text, images and native PDF embeds. PDF reading states are shared with saved material lists; use the native reader for PDF text selection.

<a id="connections"></a>

## 8. Connect ideas, group them, and nest boards

### Add relationships

Click **连线**, select a source and destination, or drag from an object's connection port to another object. Double-click a connection to enter **关系说明** (Relationship description). Selecting a connection exposes its style controls: curved, straight, or elbow paths, direction, and appearance. Use a short label such as `supports`, `contradicts`, or `next step` to explain why two items are connected. Esc cancels an unfinished connection.

Folded content, groups, and branches use a compact title strip up to **180 × 40**. Click its arrow or double-click to expand, preserving the original dimensions. Images also have fold controls above the object and in the context menu. Text, notes, and groups retain border controls; images, PDFs, audio/video, and child boards have no decorative outer frame.

Ordinary relationships and parent/child branches serve different purposes. Use a parent's branch control to **折叠子节点** (Collapse children), **展开下一层** (Expand next level), or **展开所有子节点** (Expand all children). For eligible nodes with outgoing relationships, the node context menu offers **设为子节点并折叠** (Set as children and collapse). Folding a card preview, folding a group, and collapsing a branch are separate actions.

To make an ordinary connection a foldable branch, right-click the line and choose **允许折叠（设为父子分支）**. Cycles and multiple parents are rejected. Ctrl/Cmd + Shift + Enter on the canvas toggles branch folding or the next expansion level.

Drag a connection port to blank space to immediately create text. Hold Alt/Option when releasing to choose text, a table, or an existing Markdown/PDF reference. Keyboard users can focus a port, press Shift+F10, then use arrow keys, Enter or Escape. Canceling the menu or file picker leaves no node or edge. Mind-map quick-child behavior is unchanged.

### Reading expanded content

Expanding content or increasing its measured size moves colliding neighbors down in their existing columns and enlarges their group when needed. The collision check uses visible objects, so empty gaps between mind-map nodes do not push unrelated cards away. Links, transparent backgrounds, and other cards' fold states are retained.

Long note previews scroll inside the card after reaching its height limit. Scrolling at the top or bottom stays inside the preview; Ctrl/Cmd + wheel remains available for canvas zoom. A wide code block can scroll horizontally while the note scrolls vertically.

Expansion and its automatic movement share one undo step. Collapsing reclaims automatically created space and restores neighboring positions and group dimensions. If other cards are still expanded, they keep the room they need. Delayed measurements and auto-sized text edits participate in recovery; reopening retains the latest content dimensions. Recovery data is saved with the board and survives reopening.

Manually moving, resizing, adding or removing objects, or changing relationships establishes your new layout and stops restoration of the old positions. Text-only and color changes preserve valid recovery data. Gaps already created by older versions have no recorded original positions and cannot be safely inferred; undo the old expansion or arrange the board before starting a new expand/collapse cycle. Locked or overlapping groups that cannot retain their membership may reject expansion with an explanatory message. Existing layouts are not automatically rearranged on load.

<a id="groups"></a>

### Build a named group

1. Select several objects and click **分组框**, or right-click and choose **建立命名分组框**.
2. Alternatively, activate the group-frame tool and drag a frame on empty space, then name it.
3. Right-click the frame to rename it, select its contents, or choose **分组框贴合内容** (Fit frame to content).
4. Use **折叠分组 / 展开分组** to reduce or reveal the group's content.
5. Use **工作区 → 分组预览** or **更多白板工具 → 分组总览** to locate groups on a large board.

Double-click empty space inside a group to select its frame, then drag its top, bottom, left or right edge to resize it without moving the contents. The center of each edge remains available for connections, and the bottom-right resize handle is retained. Double-clicking the title still renames the group; double-clicking outside groups still creates text. Unlock a locked frame before resizing.

You can fold the cards, shrink the frame around their visible headers, then open them one at a time. The frame grows as needed and returns to your manually adjusted size when the cards are folded again.

Floating card actions stay visible while you move the pointer across the gap from the card to its toolbar. They close after you leave that area; selection and keyboard focus keep them accessible.

Group membership follows spatial containment. Keep the intended members within the frame. To transfer a selection, use **移入已有分组…** (Move into an existing group), inspect the destination preview, then apply. This preserves relative positions and connections and can enlarge the destination boundary. **移除分组框（保留内容）** removes the frame while keeping its contents.

Select the frame to adjust **分组样式 / 分组背景 / 标题分割线** in the top toolbar. Choose a transparent frame, a preset or custom background color, and a solid, dashed, dotted, or absent title divider to distinguish groups.

### Split a project into subboards

Use **插入内容 → 子白板** (Subboard) to create a child, or **引用白板** (Reference board) to link an existing board. Open the resulting board card with **进入子白板** (Enter subboard). Use the board navigation/sidebar to return to the parent or another board. Circular nesting is rejected; a board cannot recursively contain itself. For selected material, **更多白板工具 → 复用到其他白板** opens a destination and reuse-options workflow. Inspect those options before applying; a reused note reference continues to share the original note body.

An ordinary whiteboard's new/extracted child board inherits its parent's Markdown or legacy format. The dedicated brain relationship dialog's **新建白板** option currently creates a legacy `.thoughtspace` board; it does not inherit the unified creation dialog's format preference. If you need a Markdown child there, create it with **新建白板或脑图…** first, then reference it with **引用子白板**.

<a id="mind-maps"></a>

## 9. Develop ideas with brain boards and topic trees

### Explore a dedicated brain board

Create it with **新建白板或脑图… → 脑图白板**, choosing either file format. **添加知识节点** can reference an existing note or child board, create a note, or create a group. The first supported node becomes the center. On its relationship controls, **先记想法** stores a local idea before you decide whether it needs a note file.

1. Click a node's title to make it the center; this does not rename its source.
2. Use the top/bottom controls to add parents or children. Use left/right controls for bidirectional ordinary associations. Review **节点来源** (Node source) and **目标文件夹** (Destination folder), then **确定**.
3. Open a node's **节点菜单** → **关联已有笔记…** (Associate existing note) to go directly to the native file picker. Choose **左侧 · 双向关联** or **右侧 · 双向关联**, review the target and confirm.
4. Expand a node to read its available content; use its source action to open the original. Fold it again to reclaim reading space. Narrow/low-zoom layouts can put some actions in the node menu.
5. Search with **搜索节点…** or Ctrl/Cmd + K while the brain board owns focus. Increase **关系显示层级** from 1 to 5 hops when you need more context. Large neighborhoods are paged; follow the pager rather than assuming every node is rendered at once.

Parent/child lines are foldable branches. Left/right associations remain ordinary relationships, and sharing a parent is what establishes siblings. More than one relationship between the same pair can remain meaningful; the view retains their semantics. The editor rejects invalid parent cycles and multiple-parent branches rather than deleting raw relationships. Existing invalid branches may be hidden with a message while other usable relationships remain available. **后退 / 前进 / 最近浏览** and pinned nodes help return to earlier context; the current state is stored with this brain board.

### Decide what to do with a brain idea

For `Compare maintenance needs`, open **节点菜单 → 整理成笔记**:

| **节点来源** choice | What happens after **确定** |
| --- | --- |
| **新建笔记** | Creates a Markdown note and changes this same node to reference it, retaining its identity and relationships |
| **保留想法并关联已有笔记** | Keeps the complete original idea and its existing relationships, adds or reuses a note-reference node, and creates a bidirectional association; the target note body is unchanged |

To use the second path, click **选择已有笔记…**, select `Cooling comparison`, check the destination and confirm. The separate **关联已有笔记…** node-menu action is a shorter path when a relationship, rather than conversion, is your goal. An existing ordinary association between those nodes is not duplicated; edit its existing line instead.

Cancel before confirming to keep the current graph. After a save error, **重试保存** retries the pending board transaction; inspect its status before repeating the operation. Board undo restores the original idea or removes the new reference/association. A separately created Markdown note remains in the vault after undo; undo does not delete a source file.

### Build a topic tree on an ordinary whiteboard

Run **新建思维导图**, or choose **插入内容 → 思维导图模板**. Presets include **灵感发散** (Brainstorm), **项目计划** (Project plan), **阅读笔记** (Reading notes), **研究设计** (Research design), **论证结构** (Argument), **复盘改进** (Review), **SWOT 分析**, and **组织分工** (Organization). For a map inside the current board, insert **中心主题** (Center topic). Use **工作区 → 切换为思维导图** to activate mind-map behavior on the board. Ordinary board text is not automatically converted into a topic just because the mode changes.

This is an ordinary board's editable topic tree, with Tab/Enter topic creation and tree-layout tools. It is separate from the dedicated brain board's center-based relationship browsing. Both topic-tree template entries open a new ordinary legacy-format board containing editable text topics. The separate **从模板新建** starter-template flow creates linked Markdown cards and offers a board-format choice.

| Topic action | Result |
| --- | --- |
| Click the topic's plus port | Create a connected child and start editing |
| Drag a topic connection to empty space | Create and arrange a child topic |
| Tab | Save a plain topic edit and add a child |
| Enter | Add a sibling |
| Shift + Enter while editing | Insert a line break |
| Arrow keys outside editing | Navigate visible topics in the same tree |
| Shift + Tab outside editing | Return to the parent |
| F2 | Edit the selected topic |

When editing tables, lists, formulas, or code, Enter and Tab edit the Markdown content. Continuous topic creation applies to ordinary single-line topic text.

### Tune a tree without committing immediately

1. Select a topic and open **更多白板工具 → 导图布局与配色** (Mind-map layout and colors).
2. In **思维导图工作台**, choose the **主题树** (Topic tree) if the board contains several trees.
3. Choose **双向导图 / 向右逻辑图 / 向左逻辑图 / 向下组织图 / 向上组织图**.
4. Adjust **分支间距**, **展开层级**, **分支主题**, and **连线路径**.
5. Use **查看原布局** to compare, then click **应用到白板** (Apply to board).

Enable **自动保持模板布局** to maintain the selected tree's layout as topics change. **一键适配模板** adapts the tree to its template rules. The workbench also supports outline import, find/replace, branch presentation, and Markdown/SVG export for a tree or selected branch. Changes in the workbench remain a preview until applied; unlock protected topics if they prevent rearrangement.

<a id="appearance"></a>

## 10. Arrange and style a board

Alignment guides can show and snap equal gaps between neighboring cards on a shared row or column. Existing edge/center alignment takes priority; Alt temporarily bypasses drag snapping. Normal connection ports remain at least 30 screen pixels across at low zoom.

### Preview an arrangement

1. Click **整理白板** and choose **整理范围**: current selection, loose objects, visible loose objects, or a named group.
2. Choose a grid, row, column, masonry arrangement, or grouping by type, color, reading state, or connected component.
3. Adjust columns, spacing, and optional alignment/distribution controls.
4. For type/color/reading-state/connection grouping, enable **生成命名分组框** if you want frames around the resulting categories.
5. Compare **原布局** (Original) with **整理后** (After arrangement).
6. Decide whether to enable **应用后定位到结果**, then click **应用布局**.

Loose-object scopes preserve content already inside groups. Locked objects and nested groups can restrict a group's rearrangement. Alignment can overlap objects because it preserves their other coordinate; check the preview. Under **保存与复用预设**, save named arrangements for use on other boards.

### Change object appearance and background

Ordinary boards use a compact **插入内容** (Insert) menu; hover an item for its description. Multi-selection uses the shared top toolbar, while individual card actions appear on hover or keyboard focus. Compact folded objects keep their direct expand control. Appearance parameters scroll horizontally in narrow panes, and keyboard focus reveals clipped controls.

Dedicated brain boards have five board-local color overrides: background, node fill, node border, title/relation-label text, and links. Use the top **脑图配色** (Colors) icon for direct access, or open **脑图设置 → 背景与配色 → 脑图配色…** or the bottom **白板背景 → 脑图配色…**. Border color also applies to expanded reading frames; an empty border follows the theme and node fill. The dialog shows a live node/link sample. Preview with a color picker or #RGB/#RRGGBB; empty fields follow the current theme. Cancel or Esc restores saved colors. Confirm and Reset use board history, including undo/redo and reopen. Reset clears only the colors, retaining paper/image background settings; opaque images can cover the selected base color. Low-contrast advice does not replace your choice. Native controls and Markdown body formatting retain their existing colors.

Formatting values start collapsed while not editing: click a category to expand, click it again or press Esc to collapse. The selected card uses the top Edit action; other hovered cards retain their local Edit action. Select a card or text frame and switch the available top toolbar categories between **编辑 / 卡片 / 文字 / 背景 / 边框** (Edit / Card / Text / Fill / Border). Adjust the available card style, font, size, alignment, color, transparent fill, and border options. Switching toolbar modes preserves the current draft and text selection. Use the style copy/paste controls when several items should match. Border controls apply to text frames, note cards, and groups, including mixed selections and pasted styles. Borderless objects do not offer border editing; groups retain background, border, and divider settings.

Open **白板背景** in the bottom controls and choose **点阵 / 网格 / 纯色 / 纸张纹理 / 背景图片**, or use **Settings → ThoughtSpace → Canvas → Canvas background**. For paper, choose **Customize paper** to set paper color and texture strength; presets include cream, white, ivory, kraft, and recycled paper. For an image, choose **Choose image**, import PNG/JPEG/WebP/GIF, and set cover, contain, tile, and opacity. Imported backgrounds are copied into the current vault's plugin folder without a network upload. Panel finish, accent and density are under **Interface**; reading preferences are under **Reading**; new object defaults are under **Cards & notes**.

<a id="settings"></a>

### Settings and preference profiles

Open **Settings → ThoughtSpace Whiteboard** or the workspace settings dialog. The eight categories are **Interface**, **Cards & notes**, **Canvas**, **Mouse & keyboard**, **Reading**, **Files & filing**, **Images & hosting**, and **Preference profiles**. Card style, width, text size and connection defaults are together in **Cards & notes**. Canvas background, minimap, grid spacing, alignment guides and preview controls are in **Canvas**.

Use the language selector at the top to choose **Follow Obsidian**, **简体中文**, or **English**. Automatic mode uses Chinese for a Chinese Obsidian language and English otherwise. This selection covers the settings pages and their paper/background dialogs, not the rest of the plugin's menus or toolbars. It does not translate notes, filenames or paths.

The search field searches all categories. Clear it or select a category to return to the category view. **Interface**, **Cards & notes**, **Canvas**, **Mouse & keyboard**, and **Reading** each have a **Reset this category** control. Confirming resets only that category's preferences, not other categories, existing card styles, notes or files. File-filing actions have a separate confirmation because they move real files.

In **Preference profiles → Export preferences → View & copy**, inspect and copy the JSON. To reuse it, open **Import preferences**, paste the JSON or choose its `.json` file, select **Validate**, then explicitly select **Apply profile**. Editing the JSON requires validation again; merely opening or checking a profile does not apply it.

Profiles contain supported appearance, reading and interaction preferences, not a vault backup. They exclude folder and image paths, favorites, filing and upload settings, credentials, language, and custom paper color/texture values. Custom background images do not travel with a profile: an export using an image omits the background-mode choice, leaving the destination's background unchanged on import. Other omitted settings also stay unchanged. Configure paper details or choose a local background image separately in the destination vault.

<a id="obsidian"></a>

## 11. Find material and manage native properties

### Edit this Markdown board's native Properties

This workflow changes the board file's own Properties and Markdown, rather than a linked card's note. Legacy `.thoughtspace` boards do not have a native Markdown Properties page; create a separate copy with **另存为 Markdown 白板** if you need one.

1. Open `Urban cooling research` as a Markdown board. Use the header action **原生属性与 Markdown**, the board-title menu's same action, or **脑图菜单 → 原生属性与 Markdown** on a dedicated brain board.
2. The same tab becomes Obsidian's native Markdown page. Add or edit Properties using Obsidian's controls. For example, set the text property `research_stage` to `collecting`, add an `urban-cooling` tag, and choose the appropriate native date/number/list type for your own fields.
3. Edit ordinary Markdown above or below the marked layout section if needed. Preserve `thoughtspace: board`, the layout markers and their JSON contents; changing the declaration or damaging the section prevents safe board opening.
4. Save with Obsidian, then open the native page menu → **返回白板**. The command **以白板打开当前 Markdown** also returns it to the board; **切换白板与原生属性** works in either direction and can be bound in Hotkeys.
5. If the return is refused, keep that native page and its input, save/close other native pages for the same file, then retry after saving finishes. Merely closing a tab does not prove its pending save has completed.

Obsidian's default handling of `.md` remains available; an existing board tab may be reused. If the file explorer or Quick switcher opens a board as native Markdown, use the explicit board command or native page's **返回白板** action. ThoughtSpace's board list and location links also open its board presentation. The plugin does not globally replace `.md` views. Properties are available to Obsidian's native search and Bases; native property edits may normalize YAML formatting. Board-layout saves preserve the source outside their own layout region, but do not promise that native Properties editing preserves every YAML comment or space.

### Make a format copy without changing the source

1. Open an editable board and finish pending edits.
2. Run **另存为 Markdown 白板** or **另存为旧格式白板**, or use the board-title menu.
3. Name the copy, confirm and check the opened result. Cancel leaves the source unchanged.

Both formats retain node IDs, relationships and source references. The copy has its own board identity; the original remains and links to it are not redirected. A copy is an alternate board, not a bulk migration of every note or backlink. Detailed format, ownership and repair rules are in the [Markdown board guide](markdown-boards.zh-CN.md).

<a id="search"></a>

### Search locally or through Obsidian

Use the header's **搜索白板**, Ctrl/Cmd + F on the canvas, or **搜索当前白板中的内容**. Choose a result to locate it; inspect its title, excerpt, and source before opening the original. For object filters and a reference check, open **更多白板工具 → 白板操作** and search for **筛选对象** or **白板检查**.

Board search remembers its query, filters, full-text option and active result within the current board session. Other boards have separate state; closing that session releases it. Save a material list when you need persistent criteria.

In an ordinary board's full search dialog, combine keywords, type, group, color and **阅读状态** (Reading status), then expand **材料清单** (Material lists), enter a name and choose **保存查询** (Save query). For a pending PDF list, choose PDF and **待读** (To read). Brain-board search navigates nodes and does not offer these material lists. Lists are saved in their own board file and recompute current results when opened; they contain filter criteria rather than result snapshots or note bodies. Rename or delete with the adjacent buttons; board undo restores a deletion. A deleted group keeps its list empty until you adjust and save a new query. Note, text, image and PDF results have a reading-state control, except locked objects. Failed saves preserve the input and show a retry message.

Native search integration creates Markdown indexes under `ThoughtSpace/白板搜索/`. They cover board text, card titles, group names, and connection labels; location links return to the board. Linked notes are searchable through their original files. PDF indexing covers filenames and page numbers, not full text or OCR. **白板原生搜索** in settings can stop index updates; existing indexes remain. Use **重建白板原生搜索索引** if you need to regenerate them.

### Use properties, a table, a kanban, or Bases

1. Run **打开卡片资料库与看板**, or use the **ThoughtSpace 资料库** ribbon icon.
2. Select **资料范围**: the card directory, current board when available, or the whole vault.
3. Switch between **资料表** (Table) and **进度看板** (Kanban).
4. Filter by title/path/tags, status, priority, due date, or custom fields.
5. Edit properties directly; changes save to the note's native YAML properties. Dragging a kanban card changes its status.

**自定义字段** supports text, number, date, checkbox, and list properties. Removing a displayed column does not delete the underlying note property. Use **保存筛选视图** for a reusable database filter; this is different from a board's saved camera view. **打开 Bases** creates a native `.base` file under `ThoughtSpace/视图/`; enable Obsidian's Bases core feature to use it. For a current-board Base, the file list is a snapshot of that board's scope; property values are read live. Use **导出 CSV** for a tabular export.

Tags are Obsidian-native tags. A note card's **编辑标签** action edits them. **文件与归档** settings control the card directory and tag-based filing, which can move real Markdown files. Filing creates backups and avoids replacing same-name files; file moves are outside board-layout undo.

**自动按标签归档** (Automatic tag filing) is enabled by default and manages notes only inside the configured card directory. Changing tags there can move a note to the matching tag folder; untagged notes go into **未分类**. Turn this off if you want to manage those folders yourself. Inserting a note from another folder does not itself copy or move the note. Database status, priority, and due date use `thoughtspace_status`, `thoughtspace_priority`, and `thoughtspace_due`; a board object's reading state is separate.

<a id="writing"></a>

## 12. Turn collected material into a draft

1. Open a board and choose **工作区 → 白板写作模式**.
2. In **材料库**, search or filter the current board's material; click an item to read it.
3. Switch to **编排** and drag groups/cards into the article order, or choose **新建章节**.
4. Set the article title, chapter titles, heading levels, annotations, and **纳入正文** (Include in body).
5. Switch to **写作** and develop the Markdown manuscript; use a material's plus action to insert content.
6. Keep sources beside the manuscript in **固定参考** (Pinned references).
7. Check **预览**, then click **生成草稿** to create an independent Markdown file.

Chapter titles and annotations affect the article without rewriting the original material. The board stores the working manuscript and arrangement; the generated draft is a separate file. Use **打开上次草稿** to reopen the latest generated output. If you change the outline after writing, use **写作选项 → 从编排重建正文（先另存当前正文）** deliberately: it rebuilds the manuscript after saving the existing body separately. **保留材料来源链接** controls source links in composition.

For the tutorial project, use chapters such as `Question and setting`, `Evidence` and `Trade-offs`. Pin `Tree canopy` while writing the comparison, then use **选段引用** (Select excerpt) to quote the specific passage rather than inserting the whole source. Check that a source link leads back to the relevant note before generating the draft.

### Select references and navigate the manuscript

Use **选段引用** (Select excerpt) in a pinned reference to choose an existing heading/block, a paragraph, or exact text in the read-only source. Quote inserts a static quotation and source line range. Embed follows the source through an existing unique heading or block; it never creates anchors in the original note. Link only inserts the source link. Unanchored selections link to the source file; text-card selections quote literal text and link back to their original board node, so relative links are not silently reinterpreted. Insertion preserves the manuscript selection captured before opening the picker and refuses stale source, manuscript or caret state.

The collapsible manuscript directory reads ATX and single-line Setext headings, separately from the material arrangement. Jump to a chapter, inspect its own-body word count, and mark completion. Unchanged sections keep completion through reordering; editing or renaming resets it. Identical duplicate sections use separate entries and conservatively reset completion if their count changes. Code, properties, quoted and nested-list headings are excluded. Multiline underlined text remains ordinary prose, matching the current Obsidian renderer.

An arrangement-change notice never rewrites your prose. Explicitly rebuild only when ready; the existing manuscript is backed up first. New assembly/rebuild establishes a comparison baseline; appending new material at the manuscript end advances it only if no earlier arrangement changes were outstanding and the arrangement stays unchanged during the read. Older manuscripts without a baseline remain untouched and show an unknown-comparison notice until rebuilt. Source-note automatic synchronization and automatic manuscript merging are not included.

<a id="audio-video"></a>

## 13. Watch or listen and take timestamped notes

### Open one of the three playback placements

Click **ThoughtSpace 音视频笔记**, right-click a vault media file, or run one of these commands:

| Command | Placement |
| --- | --- |
| **在主页面打开媒体播放器** | Main workspace tab |
| **在右侧栏打开媒体播放器** | Right sidebar |
| **在独立窗口打开媒体播放器** | Native Obsidian popout window |

No board or external player plugin is required. A wide local-media workspace places the viewer on the left, **当前草稿** (Current draft) at the upper right and **时间轴** (Timeline) below it. Narrow panes provide **写摘录 / 时间轴** (Write excerpt / Timeline) tabs; switching them preserves your draft and playback. Wide, short windows keep local scrolling within the composer and timeline. Save and pagination controls stay visible while their content scrolls.

Use **布局** (Layout) to adjust **观看区宽度**, or **恢复均衡布局** to reset it. **收起画面** keeps playback controls while giving notes more room; **专注播放** hides the note area. The header's **更多媒体操作** menu selects another media file, changes placement, or sends media to a board.

### Link a large file outside the vault

1. In the media picker or workspace More menu, select **链接仓库外的视频或音频**.
2. Paste the file's complete local path or a `file://` URL, then click **链接文件** (Link file).
3. Play the linked media and record excerpts as usual.

The board media picker offers the same entry. ThoughtSpace stores a small `.tsvideo` or `.tsaudio` reference; it does not copy the original media into the vault. The reference supports playback, seeking, timestamp notes, and video-frame capture. It depends on that computer's path: moving or changing the original file requires linking it again. Relinking creates a new reference; existing excerpts are retained but are not automatically rebound to it. Syncing the vault does not transfer the external media or make its path portable to another computer. This feature links local files, not streaming-service or ordinary web-video URLs.

### Save a timestamp, text, and a screenshot

1. Start playback and find the passage you want to keep.
2. Click **记下此刻** (Capture this moment) to fix the draft's timestamp.
3. Write Markdown in **当前草稿**. For video, use **截取画面** (Capture frame) to attach the current frame.
4. Check the attached image and timestamp.
5. Click **保存摘录** (Save excerpt), or Ctrl/Cmd + Enter inside the composer.
6. Find the saved entry in the timeline and click its time to return to that moment.

Saving creates or appends to a regular Markdown media note. Opening a player alone creates no note. Use **打开 Markdown 笔记** in the timeline header to inspect the file. Search covers all loaded timeline history; **全部 / 文字 / 截图** filters narrow the results. Pages mount up to 50 entries, with **前 50 条 / 后 50 条** navigation. Use **定位当前时间**, **最后一条**, compact/comfortable density, and entry expansion for longer sessions. Local screenshot thumbnails load as needed and can be opened at full size.

For a recorded interview in `Urban cooling research`, save the speaker's description and a timestamp, then send that saved excerpt to the board. Its time/source header lets you return to the recording while reviewing the claim. It is a reference to a moment, not a transcript or automatic finding.

### Playback controls and board integration

Playback includes speed, ±10-second jumps, exact-time seeking, and A–B loops. Advanced options are in the player's More menu; native fullscreen and Picture-in-Picture depend on host support. For vault media, matching `.vtt` or `.srt` subtitles can be loaded from a same-name file alongside the media. For external references, subtitle lookup is in the vault reference directory, not automatically beside the original external video. The same media carries its position, speed, volume, and loop between placements; changing media does not autoplay it. Starting another built-in player pauses the currently playing built-in player.

Use **将媒体加入白板** for the source, or an entry's **将这条摘录送到白板** arrow for an excerpt. The board receives the media source and a native block embed of the saved excerpt, including its screenshot and timestamp. Editing the source note refreshes the embed; adding it again selects the existing reference. Legacy excerpts without a stable block anchor prompt you to open the note instead of silently copying content. You can also use **插入内容 → 视频卡片 / 音频卡片**, or drag media from the vault file list/search. Board media cards can fold, resize, connect, capture timestamps/frames, and open the full workspace in the sidebar.

Excerpt timestamps prefer a matching player on the current board, or an explicitly linked source board that is already open. Explicit node identity or excerpt relationships resolve multiple matches. If the source is ambiguous or unavailable there, the link falls back to the standalone media workspace; it does not silently add a new board player. Unloaded local media retains the requested time and waits for you to click Play.

**Save before switching files or placements:** unsaved drafts block those switches. Local media workspace drafts stage text, PNG, source identity and timestamp separately on this device. After a plugin/app restart, use the notice, source-header recovery button or recovery command to explicitly restore/discard them. Recovery never saves a formal note. Changed sources keep drafts read-only; missing sources allow copying text or downloading images. Staging does not sync or migrate automatically; abrupt termination can lose the last 350 ms or unfinished writes. Online-video drafts are outside this recovery feature. Recent playback state is saved for up to 80 media sources in the plugin's `media-playback.json`; that is separate from your excerpt notes.

Supported extensions include MP4, WebM, MOV, M4V, OGV, MP3, M4A, WAV, OGG, OGA, FLAC, AAC and OPUS; usable codecs depend on Obsidian's embedded browser. Media loads on playback. Offscreen/folded board cards release sources; a standalone workspace can play behind other tabs and releases resources when closed. Dragging media from the computer copies it into the vault and has a 128 MB import limit. Use an external reference for larger files. Legacy Yingjian local timestamps still open media whose exact source resolves inside this vault.

### Record from a supported online video

Choose **Bilibili / YouTube** in the media picker and provide your own valid video URL. An online video card can also be created by pasting its link onto the board. Playback does not require Yingjian. The isolated player presents the video and official controls in a main tab, sidebar or explicitly chosen detached workspace; platform login, regional availability, codecs and playback restrictions still apply.

1. Load the video and check the resolved source. A video or Bilibili-part change requires explicit adoption and does not merge existing notes.
2. In the online workspace's **记录摘录** (Record excerpt) area, click **记下此刻** to fix the synchronized time. If synchronization is unavailable, confirm **手动时间（备用）** (Manual time, fallback).
3. Use **快速截图** (Quick screenshot) when the current frame is accessible, then write your note and click **保存摘录**.
4. Click the saved Markdown timestamp to return to the video, or send the saved frame/excerpt to the board.

The board's online card uses **加载视频 / 记下此刻 / 截取画面** instead. If the source changes, the frame is not ready or the platform prevents frame access, a specific error preserves the current draft. A saved screenshot becomes a PNG attachment and playable Markdown timestamp. Online drafts are not covered by the local-media restart recovery feature above.

<a id="calendar"></a>

## 14. Use calendar and journal integration

Calendar features are supplied by the separate optional **ThoughtSpace 日历与日记** plugin (`thoughtspace-calendar`). Install and enable that plugin before using **工作区 → 日历与日记**, **打开日历**, **打开日历与日记**, or **打开今日日记**. If it is unavailable, ThoughtSpace displays a message explaining that the calendar has moved to the separate plugin. Whiteboards, reading, writing, and the built-in media player do not require it.

<a id="data"></a>

## 15. Save, undo, back up, and export

Board changes save automatically. Ordinary boards show **保存中…** (Saving) and **已保存** (Saved) in the header; dedicated brain boards show pending/protection/error feedback in their existing status area. A linked-note editor, a native Markdown page and a media composer each have their own save workflow. Finish those edits explicitly before closing or updating the plugin.

| Board status or action | What to do |
| --- | --- |
| **保存中…** | Wait for the pending save; this does not yet acknowledge completion |
| **已保存** | The board's save has completed; this is not a claim that every other open editor or media draft is saved |
| **原生 Markdown 已打开 · 白板仅查看** | Use **定位原生页** to find the actual native page, save there, then use **返回白板**; save/close other native pages of that same file first |
| **旧原生页保存尚未确认 · 等待保存完成** | A closed page may still be saving; wait rather than repeatedly reopening or forcing a layout write |
| **原生页面正在交接 · 白板仅查看** / **原生保存已完成 · 正在重新读取白板** | Let the checked handoff and fresh read finish before editing the layout |
| **写入暂停 · 已另存恢复草稿** | Click **打开恢复草稿**, inspect that separate file and preserve it before resolving the original-board conflict |
| **恢复草稿不可用 · 请导出保留布局** or recovery-save failure | Keep the page open, copy visible unsaved content and preserve existing recovery files; general exports do not guarantee preservation of the failed local layout |

The contextual status action locates a real page or opens an actual recovery file. It does not close native editors, discard input, force-unlock the board, merge drafts or overwrite the original.

Use header undo/redo or the canvas shortcuts for board changes, including movement, layout, grouping and local board text. Linked-note editing uses its own editor/file workflow; board undo and snapshots do not roll back note bodies, file moves or cloud uploads.

Before a major rearrangement, open **工作区 → 快照与导出 → 保存布局快照** on an ordinary board. Choose **恢复布局快照…** to restore a checkpoint; the plugin first backs up the current layout. Snapshots are stored in the plugin directory, so include that directory in backups. For a complete project backup, preserve Markdown and legacy board files, referenced notes/media, attachments and plugin data. Back up externally linked media separately; the vault contains only its reference.

| Output | Entry | Use |
| --- | --- | --- |
| Board copy | **快照与导出 → 复制整张白板** | Try an alternate board arrangement; linked files are still shared |
| Markdown outline | **快照与导出 → 导出 Markdown 大纲** | Portable board outline under `ThoughtSpace/导出/` |
| Native-link index | **快照与导出 → 导出原生链接索引** | A Markdown index for native backlinks and graph browsing |
| Native Canvas | **工作区 → 导出 Canvas** | A separate `.canvas` file beside the source board |
| Writing draft | **白板写作模式 → 生成草稿** | Independent Markdown manuscript |
| Mind-map Markdown/SVG | **思维导图工作台 → 导出 Markdown / 导出 SVG** | Share a tree or selected branch |
| Database CSV/Base | **卡片资料库 → 导出 CSV / 打开 Bases** | Reuse structured note properties |

Exports are separate representations, not a complete replacement for the original board and files. Plugin-only behavior such as live media controls and workspace editing should be checked in the target format before sharing. External-media exports preserve player/time links; those links still need ThoughtSpace and access to the original local file.

<a id="troubleshooting"></a>

## 16. Troubleshooting and practical limits

| Symptom | What to check |
| --- | --- |
| Plugin does not appear or enable | Desktop Obsidian 1.13.7+, correct `thoughtspace` folder, and all three assets from one release |
| Double-clicking a Markdown board opens a note | This is Obsidian's normal `.md` view; run **以白板打开当前 Markdown** or use ThoughtSpace's board list |
| Dragging pans when you expected selection | **鼠标与键盘** settings, the active **框选** tool, or Shift + left-drag |
| A shortcut does nothing | Focus the canvas, finish text editing, check quick-key switches and Obsidian hotkey bindings |
| Object will not move, resize, or rearrange | Unlock it; check whether a parent/group or selected descendant is protected |
| A board looks empty | Use **适应**, clear search/object filters, and expand folded groups or branches |
| Text/table has excess space or unusual dimensions | Check auto height/card fitting, manual size, zoom, and whether math has finished rendering |
| Live preview fails | Use the source-editing fallback; inspect theme/plugin compatibility after an Obsidian update |
| A file card cannot find its source | Check whether the source was moved/deleted; restore or reinsert it and use **白板检查** |
| PDF is slow or has no selectable text | Use the native reader; large documents can be slow and scanned pages need a text layer |
| Media will not play | Check the file, codec, local permissions, and external-file path; use a supported local file |
| External-media reference reports a change | Link the moved or changed original again; do not assume a stale reference targets the same source |
| Media placement will not change | Save or deliberately clear the unsaved excerpt first |
| Calendar command reports a missing plugin | Enable the separate **ThoughtSpace 日历与日记** plugin |
| Search misses PDF body text | PDF full-text indexing/OCR is outside ThoughtSpace's board search |
| **继续上次白板** opens a different board or the hub | Missing/damaged recent candidates are skipped; choose a valid board under **最近打开** |
| A brain relationship command does not appear/run | Finish edits and IME composition, close its creation dialog, choose a supported unlocked center and check write protection |
| A template reports partial creation | Check the listed files already created; start a new request deliberately instead of blindly retrying the entire multi-file template |

### Why is the Markdown board only viewable?

An open native Markdown page for the same file, including reading/Properties pages in other windows or deferred restored tabs, protects the file from concurrent layout writes. Use **定位原生页**, save the latest input and return with **返回白板**. If several native pages are open, save and close the others first. Protection can continue after a tab disappears while its old editor finishes pending saves; unknown save state is treated conservatively. The status action does not close those pages for you.

### What should I do with a recovery draft?

Click **打开恢复草稿** and inspect the separate board file before closing the conflicted session. The original external version remains intact. The draft contains your local layout and the previously valid document; it is not guaranteed to merge every latest external property or paragraph. Preserve both versions, decide which layout/content to keep, and resolve that choice explicitly. After preserving the needed data, close all board views for the original and reopen the chosen valid file to resume editing.

If recovery creation also failed, keep the current page open, copy visible unsaved content and preserve any existing recovery files before using a verified backup. Some export entries are unavailable while writing is blocked, and a Markdown outline can read the saved disk version. Do not assume that producing an export preserves the failed local layout, or close/reset the session on that assumption.

### Will force-quitting recover my latest input?

Unsaved native Markdown input can be lost during forced termination, including before its normal save starts or while a save is pending. A File recovery snapshot may contain only an earlier saved baseline. ThoughtSpace does not maintain a cross-process backup of arbitrary native Properties or body drafts and does not merge two native whole-document drafts. Save, wait for confirmed completion and keep regular vault backups. The separate local-media staging feature also has unfinished-write limits; it is not a general Markdown recovery guarantee. See the [1.3.34 recovery boundaries](../qa/RELEASE-1.3.34.md) and [1.3.35 validation limits](../qa/RELEASE-1.3.35.md).

Large boards deliberately simplify distant previews and limit simultaneously detailed content. The reading desk previews at most 80,000 characters of a note and directs notes larger than 2 MB to the original; writing references preview up to 60,000 characters. Always open the original when you need complete source content. Avoid concurrent external edits to the same board while reorganizing it, and let vault sync settle before reopening a conflicting version.

See the [README](../README.md), [changelog](../CHANGELOG.md), and [data access and security notes](../SECURITY.md) for release and compatibility details.
