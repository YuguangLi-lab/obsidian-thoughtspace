# 紧凑尺度、小地图避让及 PDF 引用桥接本地验收

日期：2026-10-02。基线：`release/1.3.28`，`594e3946c51b0901e018568c602aa4f95b553902`。原生验收时版本元数据为 1.3.28，叠加本轮改动；随后按用户授权纳入 1.3.29 独立发布分支。未合并 main，也未安装到实际资料库。

## 实现

- 材料工作台、写作和媒体工作区共用舒适/紧凑尺度变量，通过属性刷新保留编辑器、播放器和草稿。格式工具栏密度、媒体记录密度、正文排版和纸张设置独立保留。
- 小地图在拖动或编辑确实覆盖其区域时暂时收起，同一次操作内保持状态以防闪烁；操作结束/取消恢复。用户可临时展开或维持手动隐藏。适应全部/聚焦选区考虑实际占用面积；未增加空闲时的全节点扫描。
- 白板操作中新增“粘贴 PDF / PDF++ 引用”。显式粘贴 wiki/Markdown 链接、引文或矩形嵌入，确认后创建一张可编辑卡片，保留原始复制文本与来源笔记上下文。正文内链接转换为仓库路径，PDF 定位与笔记块引用分别保留。
- 新桥接卡片的来源菜单支持回源、仅打开 PDF 页、复制原始引用和既有同源摘录定位。使用公共 `workspace.openLinkText`，完整原始 fragment 不重新解析编码；既有非桥接摘录默认在右侧阅读的行为保留。未知颜色不会变成 CSS 样式。
- 同名文件无明确来源时阻止导入；限制复制内容/链接数量和定位参数，拒绝危险协议、非法坐标、缺失来源。重复相同内容定位已有卡片；撤销/重做使用既有白板历史。确认时重新核对文件和白板生命周期。
- 不安装或调用 PDF++ 内部 API/复制命令，不改写 PDF 或源笔记，不创建 PDF++ 到白板的自动反向链接。原始引用是快照；文件改名同步更新正文可渲染链接和来源入口，快照仍保留原始文本。

## 文件

密度/避让：`src/workspace-density.ts`、`src/minimap-avoidance.ts`、`src/main.ts`、相关 writing/media/materials 样式与视图、`src/ui-tokens.ts`、`src/settings-view.ts`。

PDF 桥接：`src/pdf-quote.ts`、`src/pdf-quote-view.ts`、`src/main.ts`、`src/model.ts`、`src/workspace-polish.css`。同步生成 `styles.css`，更新 README 与中英文指南。

回归：`tests/minimap-avoidance.test.ts`、`tests/pdf-quote.test.ts`；既有提取方法测试的 host stub 增加新依赖；`qa/density-minimap-native.cjs`、`qa/pdf-quote-native.cjs`。

## 验证结果

- `npm test`：4598/4598 通过，0 失败、0 跳过。
- `npm run build`：通过，包含 `tsc --noEmit`。
- `npm run lint`：0 错误，118 条既有警告；本轮未增加警告。
- `git diff --check`：通过。
- 紧凑尺度/避让：24 项真实 Obsidian 检查通过。写作行高 75.23→67.23px，材料行高 57.30→49.30px；按钮 32→30px，正文保持 16px。覆盖真实拖动、移出边界、松开/Escape、编辑焦点、手动偏好、重新打开、宽窄与深浅色。
- PDF 桥接：27 项真实 Obsidian 检查通过。覆盖菜单发现与初始焦点、键盘提交、同名消歧、非法/缺失链接、去重、单步撤销/重做、实际原生 PDF 页码打开、公共接口完整 fragment、矩形嵌入保留、保存/重开、复制原文、PDF 改名和旧路径缺失、关闭原白板后的过期确认。
- PDF 测试中 294 个既有及测试源 PDF/Markdown 文件的 SHA-256 一致。仅使用独立 `thoughtspace-qa-vault`。为避免创建测试夹具触发独立日历插件的“当日新建笔记”索引，哈希测试时暂时卸载该 QA 日历实例，结束后恢复；之前未隔离的检查确实观察到了 QA 日记索引更新，未把那次检查记为通过。

宿主：Apple M4 Pro，48 GiB，macOS arm64，Obsidian 运行版 1.13.7（安装版 1.12.7），Electron 39.8.3 / Chromium 142.0.7444.265。原生测试通过 CDP 9237 控制 Obsidian，不是 Chromium 页面替代测试。CLI 测试用 Node 24.13.0；贡献指南建议 Node 22，本轮未在另一 CLI Node 版本重复测试。

## 证据与复跑

本地生成物（`dist/` 被 Git 忽略）：

- `dist/density-minimap/results.json`、`measurements.json`；board/writing/media 宽屏浅色、深色及 480px 深色截图，`materials-compact.png`。
- `dist/pdf-quote/results.json`、`environment.json`、`host.json`、`fixture.json`。
- `dist/pdf-quote/import-1440-moonstone.png`、`import-1440-obsidian.png`、`import-480-obsidian.png`、`board-1440-obsidian.png`。最终导入截图已清除通知遮挡，实际查看像素确认。
- `dist/pdf-quote/{tests,lint,build}.log`。

原生脚本要求已运行的独立 QA Obsidian（CDP 9237）、已安装当前候选的 ThoughtSpace，以及既有合成 PDF/媒体夹具。脚本核对库路径，不能用于真实库。Playwright 通过 `PLAYWRIGHT_MODULE` 指定本机已安装模块；不下载安装测试依赖。

## 未验证范围

- 后续用户已在独立 QA 库安装并启用官方 PDF++ 0.40.31，新增24项真实联动检查通过；见 [PDF++ 联动实测报告](PDF-PLUS-INTEGRATION.md)。不同语法去重、改名后裁剪链接和动态卡片高度问题均已修复。
- 第三方主题未安装；仅检查 Obsidian 自带深浅色。未覆盖移动端及真实外置多窗口；入口使用对话框/节点所属文档，不涉及全局剪贴板监听。
- 跨重启媒体草稿恢复属于前序已完成工作，本轮验证密度切换不重建编辑器/播放器；未重复整套重启场景。
- 此轮不含新的性能优化或性能对比结论，不实施另外提出的五个白板 UI 方案。
