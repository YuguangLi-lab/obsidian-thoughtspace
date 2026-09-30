# ThoughtSpace 1.3.23 安装说明

本版为 ThoughtSpace 1.3.23，包含设置改版和此前的卡片样式、表格修复。需要 Obsidian 1.13.7 或更新版本，仅支持桌面端。

## 本次更新

- 设置分成界面、卡片与笔记、白板、鼠标与键盘、阅读、文件与归档、图片与图床、偏好配置八个分类。
- 设置页顶部可选择简体中文、English 或跟随 Obsidian；纸张和背景图片弹窗也支持中英文。本次不翻译白板菜单、工具栏和独立日历插件。
- 增加跨分类搜索、分类恢复默认确认，以及偏好 JSON 查看、复制、检查和导入。
- 配置仅携带常用外观和操作偏好，不包含笔记、目录、收藏、语言、归档、图床配置、自定义纸张参数或背景图片。图片背景模式也不会随配置导出。
- 保留此前的索引卡、便签卡，以及表格卡片外框和列文字裁切修复。

## 安装与备份

1. 先备份白板文件和整个 `.obsidian/plugins/thoughtspace` 目录，包括原有 `data.json`。建议先在测试仓库试用。
2. 关闭 Obsidian，将本包 `thoughtspace` 文件夹中的 `main.js`、`manifest.json`、`styles.css` 替换到对应仓库的 `.obsidian/plugins/thoughtspace`。不要删除或替换原有 `data.json`。
3. 重新打开 Obsidian，进入设置中的 ThoughtSpace Whiteboard。设置页顶端可切换语言。

本包不自动移动文件，不自动替换已有卡片外观。手动执行“整理已有卡片”仍会移动文件；请先确认仓库备份，白板撤销不能撤销文件移动。

## 回退

关闭 Obsidian 后恢复备份的插件文件；需要恢复旧偏好时，再恢复备份的 `data.json`。如果原版不支持索引卡和便签卡，回退前请先将这些卡片换回透明、实色、色带或纸张样式并保存，或者恢复试用前的白板备份。多设备使用新样式时，各设备需安装支持这些样式的版本。

## English

This is ThoughtSpace 1.3.23. Back up the entire plugin directory, including `data.json`, and your boards before updating. With Obsidian closed, replace only `main.js`, `manifest.json` and `styles.css`; keep the existing `data.json`.

Choose English at the top of the ThoughtSpace settings page. Translation covers settings and appearance dialogs, not the entire plugin. Preference profiles contain portable display and interaction values only, not vault files, paths, favorites, language, filing or hosting configuration, custom paper values, or background images. Restore the backup to roll back.
