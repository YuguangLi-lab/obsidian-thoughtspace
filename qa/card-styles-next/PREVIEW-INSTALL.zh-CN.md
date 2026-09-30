# 卡片样式开发预览

本包基于 ThoughtSpace 1.3.22，新增索引卡和便签卡，并优化六种样式的预览选择器。它是未发布的本地开发包，插件版本字段仍为 1.3.22，不是 GitHub 上的原版安装包。

## 试用

1. 先备份 `.thoughtspace` 白板文件，以及仓库中 `.obsidian/plugins/thoughtspace` 的现有插件文件。推荐先在测试仓库使用。
2. 关闭 Obsidian，将本包 `thoughtspace` 文件夹里的 `main.js`、`manifest.json`、`styles.css` 替换到 `.obsidian/plugins/thoughtspace`。不要删除原有 `data.json`。
3. 重新打开 Obsidian，选中 Markdown 笔记卡片，在顶部“卡片”中选择“索引卡”或“便签卡”。新建卡片的默认样式可在插件外观设置中调整。

需要 Obsidian 1.13.7 或更新版本。本包不会主动修改现有白板外观，也不修改源 Markdown 笔记内容。

## 回退与多设备

使用新样式保存的白板，需要本开发包或后续支持新样式的版本读取。其他设备也应使用支持新样式的版本。回退原版 1.3.22 之前，请先将“索引卡”和“便签卡”切换为透明、实色、彩色标题栏或双线纸笺，并保存白板；也可恢复试用前的备份。

本次尚未上传 GitHub 或创建正式发布。
