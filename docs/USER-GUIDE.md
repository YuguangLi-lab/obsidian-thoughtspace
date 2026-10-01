# ThoughtSpace Whiteboard user guide

[English](USER-GUIDE.md) · [中文完整教程](USER-GUIDE.zh-CN.md) · [Project home](../README.md)

This guide covers **ThoughtSpace Whiteboard 1.3.25** for **Obsidian desktop 1.13.7 or newer**. Settings support Chinese and English; other plugin menus and workspaces remain mainly Chinese. English explanations below include Chinese labels where needed. Button labels may appear as icons in narrow panes; hover over an icon to read its tooltip.

## Contents

- **Start:** [Install](#installation) · [Ten-minute tutorial](#quick-start) · [Workspace](#workspace) · [Mouse and keyboard](#controls)
- **Build:** [Cards and Markdown](#cards) · [Import material](#media-import) · [Connections](#connections) · [Groups](#groups) · [Mind maps](#mind-maps) · [Appearance](#appearance)
- **Work:** [Read](#reading) · [Write](#writing) · [Audio/video](#audio-video) · [Properties and search](#obsidian) · [Calendar](#calendar)
- **Maintain:** [Settings](#settings) · [Save and export](#data) · [Troubleshooting](#troubleshooting)

<a id="installation"></a>

## 1. Install or update

### Install from the community directory

1. Open Obsidian **Settings → Community plugins** and browse for **ThoughtSpace Whiteboard**.
2. Install and enable the plugin if it is available in your directory.
3. Open the command palette and search for `ThoughtSpace`.
4. Run **新建白板** (New whiteboard), or **创建入门示例白板** (Create a starter example).

The community directory and GitHub releases can update at different times. If the version you need is unavailable in the directory, use the manual method below.

### Install manually from GitHub

1. Open [GitHub Releases](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases).
2. Select a release and download its three runtime assets: `main.js`, `manifest.json`, and `styles.css`.
3. Create `<your-vault>/.obsidian/plugins/thoughtspace/` if necessary.
4. Put all three files directly in that folder, without an extra nested release folder.
5. Restart Obsidian or reload the plugin, then enable **ThoughtSpace Whiteboard** in Community plugins.

Use your vault's actual configuration folder if it differs from `.obsidian`. The GitHub source ZIP is source code; it is not a substitute for the three built release assets.

### Update an existing installation

1. Save open edits and media excerpts, and back up the vault, including its plugin configuration folder.
2. Disable ThoughtSpace before replacing its files.
3. Replace **only** `main.js`, `manifest.json`, and `styles.css` with files from the same release.
4. Keep `data.json`, layout snapshots, background images, playback state, and existing vault content.
5. Re-enable the plugin, check the displayed version, and open an existing board to verify it.

For a community installation, you can instead use Obsidian's community-plugin update checker. Unsaved media drafts do not survive a plugin reload or Obsidian restart.

<a id="quick-start"></a>

## 2. Build your first board in ten minutes

This exercise produces a small research board and a reusable Markdown draft.

1. **Minute 0–1:** Run **新建白板** and name it `Reading project`.
2. **Minute 1–2:** Double-click an empty area, type `What question am I trying to answer?`, and finish the edit with the editor's save control.
3. **Minute 2–3:** Choose **插入内容 → 已有笔记** (Insert content → Existing note) and select a Markdown note from your vault.
4. **Minute 3–4:** Click **＋ 新建卡片** (New card) in the left floating toolbar and record your own interpretation. You can set its board title later with **修改卡片标题** in the card's context menu.
5. **Minute 4–5:** Drag the three objects into position; use the lower-right handles to adjust their sizes.
6. **Minute 5–6:** Click **连线** (Connect), then connect the source note to your interpretation. Double-click the line to add a relationship label.
7. **Minute 6–7:** Select the objects with a right-button drag on empty space, then click **分组框** (Group frame) and name the group `Evidence`.
8. **Minute 7–8:** Click **整理白板** (Arrange board), choose a layout, inspect the preview, and click **应用布局** (Apply layout).
9. **Minute 8–9:** Open **工作区 → 白板写作模式** (Workspace → Board writing mode). Use **编排** (Outline) to arrange materials, then **写作** (Write) to develop the text.
10. **Minute 9–10:** Click **生成草稿** (Generate draft). A separate Markdown file opens in Obsidian.

Return to the board, wait for **已保存** (Saved), then use **工作区 → 快照与导出 → 保存布局快照** to save a layout checkpoint.

## 3. Understand what is stored where

| Object or output | Where its content lives | What editing changes |
| --- | --- | --- |
| Whiteboard | A `.thoughtspace` file in the vault | Object positions, connections, board text, groups, and board settings |
| Markdown card | A linked `.md` file | Editing the card body edits the original note |
| Text frame | Inside the `.thoughtspace` file | Local board text; no separate note is created |
| Table in a text frame | Markdown inside the board file | The board's text content |
| Image, PDF, audio, or video card | A reference to a file or supported image URL | The card's presentation; the source remains separate |
| External local media | A `.tsvideo` or `.tsaudio` reference in the vault | The original media stays outside the vault |
| Generated writing draft | A new `.md` file under `ThoughtSpace/草稿/` | An independent document for continued writing |
| Layout snapshot | Plugin folder's `layout-snapshots/` directory | Restores board data; does not restore linked note bodies |

A note can appear on several boards or more than once on one board. Those cards share the same note body, even when their board titles and appearance differ. Removing a card with **移出白板（保留文件）** removes its board reference and leaves the file in the vault. Board undo likewise does not delete separately created notes or attachments.

<a id="workspace"></a>

## 4. Find your way around

### Open the main places

| Entry | Purpose |
| --- | --- |
| **ThoughtSpace 侧边栏** ribbon icon / **打开 ThoughtSpace 侧边栏** command | Browse cards, boards, tasks, and the outline |
| **打开空间总览** command | Browse your knowledge space and boards |
| **打开研究工作台** command | Open the research workspace |
| **新建白板** / **从模板创建白板** commands | Create a board |
| **新建思维导图** command | Start a mind map with a preset |
| **ThoughtSpace 音视频笔记** ribbon icon | Play and annotate media without opening a board |

The interface restores the 1.3.23 layout and inherits Obsidian light, dark, and third-party theme colors. Paper backgrounds remain an optional canvas setting. It retains Obsidian's existing title bar without adding a full workbench row. A compact vertical toolbar floats on the left of the canvas for selection, connections, **＋ 新建卡片** (New card), text, insertion, grouping, and arrangement. The top contextual formatting toolbar appears when an object is selected. Centered view controls at the bottom handle background, grid snapping, zoom, fit, and overview; narrow panes allow horizontal scrolling in that dock. The sidebar keeps Cards / Boards / Tasks / Outline in one row above search so the list uses the full width. Open the material navigator through the **ThoughtSpace 侧边栏** ribbon icon, and create boards through its **新建** (New) menu or the command palette. The native board header includes undo/redo, search, saved views, focus mode, and **工作区** (Workspace). Fit and focus account for the canvas space beside the left toolbar and below any visible formatting panel.

### Keep large boards navigable

- Click **适应** (Fit) to show visible board content, or **聚焦所选** (Focus selection) to inspect selected objects.
- Toggle **白板总览** (Board overview) for a miniature navigation view.
- Use the sidebar tabs **卡片 / 白板 / 任务 / 大纲** (Cards / Boards / Tasks / Outline).
- The outline follows actual containment within group frames. Collapsing an outline entry only changes navigation.
- Use **常用视角** (Saved views) for named camera positions such as `Sources` and `Draft structure`.
- Saved views can be searched, renamed, updated, reordered, and reopened. They are camera positions, not content backups.
- Double-click the board title, or right-click it and choose **重命名白板**, to rename the board.
- Use **复制白板链接** or an object's location-link action to return to a specific board or item later.

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

<a id="cards"></a>

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
## Working hypothesis

- Compare the original evidence.
- [ ] Check the follow-up source.

> [!note]
> Keep the source and your interpretation distinguishable.

Inline math: $E = mc^2$

$$
\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i
$$

| Claim | Evidence | Next step |
| --- | --- | --- |
| A | [[Source note]] | Verify |
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

### Extract passages from notes

Run **在右侧打开笔记，选字拖入白板**, select a Markdown note, and drag selected text onto empty canvas. The destination preview distinguishes a new excerpt from **追加证据** (Append evidence) when hovering over an eligible note card. Drop on empty space when you want a separate excerpt rather than appending to a target.

For structured imports, run **打开材料工作台** (Open materials workbench). Select a source note, review extracted fragments, choose the pieces to import, and inspect grouping/source-link options before applying. The workbench also has an outline workflow for turning structured material into mind-map topics. Created excerpt notes remain in the vault if you undo their placement on the board.

<a id="reading"></a>

### Read your collected material

Open **工作区 → 打开阅读桌** (Workspace → Open reading desk). Search the material list, filter the board or opening selection, and switch between **内容 / 目录 / 关联** (Content / Headings / Connections). Use the reading-state control, **已读并下一篇** (Mark read and next), and **右侧打开原文** (Open original on the right). Alt + Left/Right switches items while the reading desk owns focus outside editable controls. Changing reading status preserves the current article and scroll position. The reading desk is for note/text/image material; use the native reader for PDF text selection.

<a id="connections"></a>

## 8. Connect ideas, group them, and nest boards

### Add relationships

Click **连线**, select a source and destination, or drag from an object's connection port to another object. Double-click a connection to enter **关系说明** (Relationship description). Selecting a connection exposes its style controls: curved, straight, or elbow paths, direction, and appearance. Use a short label such as `supports`, `contradicts`, or `next step` to explain why two items are connected. Esc cancels an unfinished connection.

Folded content, groups, and branches use a compact title strip up to **180 × 40**. Click its arrow or double-click to expand, preserving the original dimensions. Images also have fold controls above the object and in the context menu. Text, notes, and groups retain border controls; images, PDFs, audio/video, and child boards have no decorative outer frame.

Ordinary relationships and parent/child branches serve different purposes. Use a parent's branch control to **折叠子节点** (Collapse children), **展开下一层** (Expand next level), or **展开所有子节点** (Expand all children). For eligible nodes with outgoing relationships, the node context menu offers **设为子节点并折叠** (Set as children and collapse). Folding a card preview, folding a group, and collapsing a branch are separate actions.

To make an ordinary connection a foldable branch, right-click the line and choose **允许折叠（设为父子分支）**. Cycles and multiple parents are rejected. Ctrl/Cmd + Shift + Enter on the canvas toggles branch folding or the next expansion level.

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

<a id="mind-maps"></a>

## 9. Develop a mind map

### Start with a template or a center topic

Run **新建思维导图**, or choose **插入内容 → 思维导图模板**. Presets include **灵感发散** (Brainstorm), **项目计划** (Project plan), **阅读笔记** (Reading notes), **研究设计** (Research design), **论证结构** (Argument), **复盘改进** (Review), **SWOT 分析**, and **组织分工** (Organization). For a map inside the current board, insert **中心主题** (Center topic). Use **工作区 → 切换为思维导图** to activate mind-map behavior on the board. Ordinary board text is not automatically converted into a topic just because the mode changes.

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

### Preview an arrangement

1. Click **整理白板** and choose **整理范围**: current selection, loose objects, visible loose objects, or a named group.
2. Choose a grid, row, column, masonry arrangement, or grouping by type, color, reading state, or connected component.
3. Adjust columns, spacing, and optional alignment/distribution controls.
4. For type/color/reading-state/connection grouping, enable **生成命名分组框** if you want frames around the resulting categories.
5. Compare **原布局** (Original) with **整理后** (After arrangement).
6. Decide whether to enable **应用后定位到结果**, then click **应用布局**.

Loose-object scopes preserve content already inside groups. Locked objects and nested groups can restrict a group's rearrangement. Alignment can overlap objects because it preserves their other coordinate; check the preview. Under **保存与复用预设**, save named arrangements for use on other boards.

### Change object appearance and background

Formatting values start collapsed while not editing: click a category to expand, click it again or press Esc to collapse. The selected card uses the top Edit action; other hovered cards retain their local Edit action. Select a card or text frame and switch the top toolbar between **编辑 / 文字 / 背景 / 边框** (Edit / Text / Fill / Border). Adjust the available font, size, alignment, color, transparent fill, and border options. Switching toolbar modes preserves the current draft and text selection. Use the style copy/paste controls when several items should match. Border controls apply to text frames, note cards, and groups, including mixed selections and pasted styles. Borderless objects do not offer border editing; groups retain background, border, and divider settings.

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

### Search locally or through Obsidian

Use the header's **搜索白板**, Ctrl/Cmd + F on the canvas, or **搜索当前白板中的内容**. Choose a result to locate it; inspect its title, excerpt, and source before opening the original. For object filters and a reference check, open **更多白板工具 → 白板操作** and search for **筛选对象** or **白板检查**.

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

<a id="audio-video"></a>

## 13. Watch or listen and take timestamped notes

### Open one of the three playback placements

Click **ThoughtSpace 音视频笔记**, right-click a vault media file, or run one of these commands:

| Command | Placement |
| --- | --- |
| **在主页面打开媒体播放器** | Main workspace tab |
| **在右侧栏打开媒体播放器** | Right sidebar |
| **在独立窗口打开媒体播放器** | Native Obsidian popout window |

No board or external player plugin is required. In 1.3.8, a wide workspace places the viewer on the left, **写下此刻** (Composer) at the upper right, and **时间轴** (Timeline) below it. Narrow panes provide **写摘录 / 时间轴** tabs; switching them preserves your draft and playback. Wide, short windows keep local scrolling within the composer and timeline. Save and pagination controls stay visible while their content scrolls.

Use **布局** (Layout) to adjust **观看区宽度**, or **恢复均衡布局** to reset it. **收起画面** keeps playback controls while giving notes more room; **专注播放** hides the note area. The header's **更多媒体操作** menu selects another media file, changes placement, or sends media to a board.

### Link a large file outside the vault — new in 1.3.8

1. In the media picker or workspace More menu, select **链接仓库外的视频或音频**.
2. Paste the file's complete local path or a `file://` URL, then click **链接文件** (Link file).
3. Play the linked media and record excerpts as usual.

The board media picker offers the same entry. ThoughtSpace stores a small `.tsvideo` or `.tsaudio` reference; it does not copy the original media into the vault. The reference supports playback, seeking, timestamp notes, and video-frame capture. It depends on that computer's path: moving or changing the original file requires linking it again. Relinking creates a new reference; existing excerpts are retained but are not automatically rebound to it. Syncing the vault does not transfer the external media or make its path portable to another computer. This feature links local files, not streaming-service or ordinary web-video URLs.

### Save a timestamp, text, and a screenshot

1. Start playback and find the passage you want to keep.
2. Click **记下此刻** (Capture this moment) to fix the draft's timestamp.
3. Write Markdown in **写下此刻**. For video, use **截取画面** (Capture frame) to attach the current frame.
4. Check the attached image and timestamp.
5. Click **保存摘录** (Save excerpt), or Ctrl/Cmd + Enter inside the composer.
6. Find the saved entry in the timeline and click its time to return to that moment.

Saving creates or appends to a regular Markdown media note. Opening a player alone creates no note. Use **打开 Markdown 笔记** in the timeline header to inspect the file. Search covers all loaded timeline history; **全部 / 文字 / 截图** filters narrow the results. Pages mount up to 50 entries, with **前 50 条 / 后 50 条** navigation. Use **定位当前时间**, **最后一条**, compact/comfortable density, and entry expansion for longer sessions. Local screenshot thumbnails load as needed and can be opened at full size.

### Playback controls and board integration

Playback includes speed, ±10-second jumps, exact-time seeking, and A–B loops. Advanced options are in the player's More menu; native fullscreen and Picture-in-Picture depend on host support. For vault media, matching `.vtt` or `.srt` subtitles can be loaded from a same-name file alongside the media. For external references, subtitle lookup is in the vault reference directory, not automatically beside the original external video. The same media carries its position, speed, volume, and loop between placements; changing media does not autoplay it. Starting another built-in player pauses the currently playing built-in player.

Use **将媒体加入白板** for the source, or an entry's **将这条摘录送到白板** arrow for an excerpt. The board receives the media source and a native block embed of the saved excerpt, including its screenshot and timestamp. Editing the source note refreshes the embed; adding it again selects the existing reference. Legacy excerpts without a stable block anchor prompt you to open the note instead of silently copying content. You can also use **插入内容 → 视频卡片 / 音频卡片**, or drag media from the vault file list/search. Board media cards can fold, resize, connect, capture timestamps/frames, and open the full workspace in the sidebar.

**Save before switching files or placements:** unsaved drafts block those switches. Local media workspace drafts stage text, PNG, source identity and timestamp separately on this device. After a plugin/app restart, use the notice, source-header recovery button or recovery command to explicitly restore/discard them. Recovery never saves a formal note. Changed sources keep drafts read-only; missing sources allow copying text or downloading images. Staging does not sync or migrate automatically; abrupt termination can lose the last 350 ms or unfinished writes. Online-video drafts are outside this recovery feature. Recent playback state is saved for up to 80 media sources in the plugin's `media-playback.json`; that is separate from your excerpt notes.

Supported extensions include MP4, WebM, MOV, M4V, OGV, MP3, M4A, WAV, OGG, OGA, FLAC, AAC, and OPUS; usable codecs depend on Obsidian's embedded browser. Media loads on playback. Offscreen/folded board cards release sources; a standalone workspace can play behind other tabs and releases resources when closed. Dragging media from the computer copies it into the vault and has a 128 MB import limit. Use an external reference for larger files. Legacy Yingjian local timestamps still open media whose exact source resolves inside this vault. Bilibili and YouTube sources now use their restored online branch without requiring Yingjian: choose **Bilibili / YouTube** in the media picker, or paste a link onto a board and choose **Play**. Video plays directly in an isolated player inside the plugin, showing the video and official controls instead of site navigation, comments and recommendations, in a main tab, right sidebar, or an explicitly selected detached workspace; the note area supports verified playback time, pause, seek, rate and Markdown captures. A video or Bilibili-part change requires explicit adoption and does not merge existing notes. When synchronization is unavailable, confirm a manual timestamp. Platform login, regional availability and playback restrictions still apply; **Capture moment** freezes the current time. **Quick screenshot** captures the current video frame into a draft; saving creates a PNG attachment with a playable Markdown timestamp. Saved frames can be sent to a whiteboard. If the source changes, the frame is not ready, or the platform prevents frame access, the draft is preserved and a specific error is shown.

<a id="calendar"></a>

## 14. Use calendar and journal integration

Calendar features are supplied by the separate optional **ThoughtSpace 日历与日记** plugin (`thoughtspace-calendar`). Install and enable that plugin before using **工作区 → 日历与日记**, **打开日历**, **打开日历与日记**, or **打开今日日记**. If it is unavailable, ThoughtSpace displays a message explaining that the calendar has moved to the separate plugin. Whiteboards, reading, writing, and the built-in media player do not require it.

<a id="data"></a>

## 15. Save, undo, back up, and export

Board changes save automatically. Watch the header for **保存中…** (Saving) and **已保存** (Saved). Use header undo/redo or the canvas shortcuts for board changes, including movement, layout, grouping, and board text. Linked-note editing uses its own editor/file workflow; board undo and snapshots do not roll back note bodies, file moves, or cloud uploads.

Before a major rearrangement, open **工作区 → 快照与导出 → 保存布局快照**. Choose **恢复布局快照…** to restore a checkpoint; the plugin first backs up the current layout. Snapshots are stored in the plugin directory, so include that directory in backups. For a complete project backup, preserve `.thoughtspace` files, referenced notes/media, attachments, and plugin data. Back up externally linked media separately; the vault contains only its reference.

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

If the status says **写入暂停 · 已另存恢复草稿**, keep the recovery file and inspect it before closing anything. The plugin avoids overwriting a board changed by another window or sync tool. Resolve the conflict, then close all views of that board and reopen it to resume writing. If saving or recovery itself fails, preserve available text/exports and restore from a verified backup; do not assume **保存中…** means completion.

Large boards deliberately simplify distant previews and limit simultaneously detailed content. The reading desk previews at most 80,000 characters of a note and directs notes larger than 2 MB to the original; writing references preview up to 60,000 characters. Always open the original when you need complete source content. Avoid concurrent external edits to the same board while reorganizing it, and let vault sync settle before reopening a conflicting version.

See the [README](../README.md), [changelog](../CHANGELOG.md), and [data access and security notes](../SECURITY.md) for release and compatibility details.
