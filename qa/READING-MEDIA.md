# 阅读层级、媒体引用与文本卡片类型：本地交付

本文保留第一阶段本地验收记录；最终 1.3.26 回归及发布范围见 [发布前验收](RELEASE-1.3.26.md)。

基于 `release/1.3.25` 的 `8d79f2657c1980cdd3643d5dded81e15611ba55b`。
本报告对应后续未提交的本地改动，未更新版本、提交、推送、发布或安装到真实库。此前外置折叠按钮的改动继续保留，详见 `FOLD-CONTROLS.md`。

## 完成行为

- 固定尺寸阅读卡片收紧段落和标题间距，弱化标签等次要信息；不改自动尺寸卡片的布局策略、节点位置、尺寸或原文。
- 媒体引用沿用原生实时 Markdown 嵌入，时间戳和来源组成紧凑信息行。截图保持原比例，原笔记更新后仍同步；来源可打开正式笔记，时间戳沿用既有播放器跳转协议。
- 选中文本框后，可从顶部“卡片”入口选择透明、实色、彩色顶栏、双线纸笺、索引卡、便签卡。仍为文本节点，不转换为文件引用。
- 样式切换保留文字、格式、尺寸、位置、连线、子节点和折叠状态；沿用撤销重做、锁定和混选规则。编辑时不会重建文本编辑器，草稿与选区保留。
- 沿用主题变量和用户设置，未更改横向分类、全局字体或主题。文本彩色顶栏不生成虚假的文件标题。

## 主要文件

- `src/reading-media.css`、`src/media-reference-presentation.ts`、`src/text-preview.ts`：阅读密度及媒体引用呈现。
- `src/card-style.ts`、`src/card-styles.css`、`src/model.ts`、`src/node-render-key.ts`、`src/main.ts`：文本样式选择、持久化与编辑器复用。
- `esbuild.mjs`、生成的 `styles.css`：样式打包。
- `tests/text-card-style.test.ts`、`tests/media-reference-presentation.test.ts` 及相关既有测试：模型、呈现、编辑器复用与选择行为回归。
- `qa/reading-media-native.cjs`：真实 Obsidian 临时库的交互验证。

## 检查结果

- `npm test`：4506 项通过，0 失败。
- `npm run build`：TypeScript 检查与打包通过。
- `npm run lint`：0 错误，118 条既有警告。
- `python3 -m unittest discover -s scripts -p 'test_*.py'`：7 项通过。
- `git diff --check`：通过。

原生环境：Apple M4 Pro、48 GiB、macOS 27.0、Obsidian 1.13.7；CLI Node 24.13.0。仅使用隔离 profile 和 `thoughtspace-qa-vault` 内的合成资料。

原生 26 项检查全部通过：六种文本样式及内容/几何/渲染实例保留、键盘撤销重做、保存关闭重开、文本与笔记混选、锁定禁用、内容与子节点分别折叠、原生及源码编辑草稿与选区保留、来源链接键盘打开、时间戳实际插件处理器跳转、来源更新后去重、横图/竖图/方图比例、320/420 CSS 像素窗格、全部原始内容和连线保留。截图覆盖宽屏浅色/深色、窄屏深色、样式菜单和两种编辑器。

## 证据与重跑条件

- `dist/reading-media-native/report.json`：26 项原生结果及执行范围。
- `dist/reading-media-native/wide-light.png`、`wide-dark.png`：最终宽屏截图。
- `dist/reading-media-native/narrow-320-dark.png`、`narrow-420-dark.png`：最终窄屏截图。
- `dist/reading-media-native/text-types-light.png`：文本卡片六种类型菜单。
- `dist/reading-media-native/editor-native.png`、`editor-fallback.png`：两种编辑模式。
- `/tmp/thoughtspace-reading-{tests,lint,build,python,native}.log`：检查日志。

原生脚本需要现有 `dist/reading-media-native/fixture.json` 对应的临时库合成资料、CDP 9237 和通过 `PLAYWRIGHT_MODULE` 指定的本机 Playwright；它检查库路径，不用于真实库。截图仅留在本机，当前环境没有可用的 Library 上传通路。

## 边界

- 官方 1.3.25 不接受文本节点上的装饰性 `cardStyle` 字段。使用彩色顶栏、双线纸笺、索引卡或便签卡的文本，需要包含本次改动的版本读取；如需退回旧版，先在新版切回透明或实色并保存。本轮只在临时库验证，没有迁移真实资料。
- 时间戳使用实际渲染链接及插件处理器验证；为避免系统将链接发送至另一库，未验证操作系统层的协议派发。
- 窄屏通过画布缩放适配，未自动改变卡片尺寸；截图保留临时环境已有字体和背景设置。早期 before 截图与最终图的宿主设置不同，不作为严格像素对照。
- 未覆盖移动端、触摸操作、所有第三方主题或任意高度密集画布。本轮没有新增性能优化结论，原 1.3.24 性能基线未改动。
