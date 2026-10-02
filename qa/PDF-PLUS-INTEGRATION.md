# PDF++ 真实联动验收

2026-10-02。本报告记录发布前的本地实现与验证；随后按用户授权纳入 1.3.29 独立发布分支。不合并 main，没有修改实际资料库。

## 环境与来源核验

- 工作区：`obsidian-thoughtspace`，分支 `release/1.3.28`，基线提交 `594e3946c51b0901e018568c602aa4f95b553902`。原生验收时 ThoughtSpace manifest 为 **1.3.28**，叠加本轮改动；发布元数据更新为 **1.3.29**，功能代码不变。
- 用户已在独立 `thoughtspace-qa-vault` 安装并启用 **PDF++ 0.40.31**；本轮沿用，未重复安装或改动真实库插件。
- 已核对 [官方目录](https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json) 指向 `RyotaUshio/obsidian-pdf-plus`，以及 [官方 Release 0.40.31](https://github.com/RyotaUshio/obsidian-pdf-plus/releases/tag/0.40.31)。检查时为最新 release。
- manifest/styles 与 Release SHA-256 一致；main.js 去掉 Obsidian 添加的18字节 `nosourcemap` 注释后，与官方资产 SHA-256 一致。完整证据在 `dist/pdf-plus-integration/installation.json`。
- Apple M4 Pro、48 GiB、macOS arm64；Obsidian **运行版 1.13.7**（安装版 1.12.7），Electron 39.8.3 / Chromium 142.0.7444.265。通过 CDP 9237 控制真实 Obsidian，不是浏览器替代 harness。

## 方法

使用标准库构造三页可丢弃 PDF：每页包含可选择文字、一个240×100的蓝色矩形；第二页预置高亮批注 `10R` 与评论批注 `11R`。批注在生成夹具时就已存在，测试期间不编辑 PDF。文件名和路径包含中文、空格及括号；另建独立 Markdown 评论块来源。

从 PDF++ 的实际界面选择第三页 `alpha beta`，在保留用户当前“Quote in callout”格式的情况下，分别取得 wiki 与 Markdown 输出，实际范围均为 `selection=2,20,2,30`。只读保护确认 `enablePDFEdit`、`autoCopy`、`autoPaste`、`autoFocus` 均关闭；点击无颜色的复制控件，捕获它写向 clipboard 的字符串到测试内存，不读取用户剪贴板，不调用 PDF++ 命令/lib API。批注与矩形测试输入使用已知夹具对应的官方链接语法；未测试 PDF++ 的矩形拖拽复制手势。

桥接产品代码只使用 Obsidian 公共打开链接接口。测试读取阅读器 DOM、可见页码、精确高亮文字及原生阅读器临时定位状态作为证据；批注弹窗通过真实点击展开。Obsidian 存在独立设置浮窗，测试在实际承载导入框的窗口确认，再回到白板，未关闭用户其他设置窗口。

## 24 项原生检查通过

- 官方插件已加载、写入/自动复制粘贴关闭。
- wiki 与 Markdown Callout 的原始文本各自保留；从白板实际回源到第3页，只高亮 `alpha beta`。
- 中文、空格、括号及显式来源笔记上下文的相对路径正确；独立 Markdown 块引用不混入 PDF fragment。
- 既有高亮批注精确定位到 `{type: annotation, page: 2, id: 10R}`，评论弹窗显示正确原文。
- 评论批注精确定位到第二页 `11R`，其评论可见。
- 矩形 `rect=72,430,312,530&width=240` 在白板渲染为裁剪图。实际输出1680×700，宽高比2.4；中心像素 `[51,128,204,255]`，与夹具蓝色区域一致。使用 PDF++ 实际输出的图片验证，不假定一定是 canvas。
- 裁剪卡片自动高度保留完整可点击的来源按钮。
- 相同原文重复导入不新增；单步撤销与重做保留内容和原始文本；重开白板恢复引用与裁剪图。
- 通过 Obsidian 改名后，正文矩形嵌入与来源入口同时更新，仍能回到实际第二页；旧文件名无法静默导入。测试后恢复文件名。
- 禁用 PDF++ 后，“仅打开 PDF 页”实际打开原生阅读器第二页；重新启用后无需重新导入，即恢复裁剪及精确文字定位。
- 297个既有及夹具 PDF/Markdown 文件，在上述测试操作期间 SHA-256 保持一致。恢复 QA 日历插件及界面设置后，夹具 PDF 与来源评论笔记再次核验仍完全一致。测试期间暂时卸载独立日历实例，避免新测试夹具触发它自己的日记索引；结束后已恢复。

完整逐项记录：`dist/pdf-plus-integration/results.json`。

## 实测发现并修复的问题

1. **不同复制语法被误去重**：wiki 与 Markdown 规范化后内容相同，原先仅保留第一份原始文本。现在去重同时比较原始文本、来源上下文及当前正文，不同原始语法分别保留。新增回归。
2. **PDF 改名后裁剪失效**：已实际观察到来源 footer 更新而正文 embed 仍指向旧路径，显示找不到文件。现在对 PDF 桥接卡片的可渲染链接同步改名；保留代码/注释示例和原始复制快照。新增改名及字面示例保护回归。
3. **动态裁剪内容挤压来源按钮**：新导入卡片默认自动适应内容高度，实际几何与点击命中检查通过。

涉及 `src/pdf-quote.ts`、`src/board-reference-rename.ts`、`src/main.ts`、`tests/pdf-quote.test.ts`，以及中英文指南。没有修改 PDF++ 源码。

## 最终检查

- `npm test`：**4598/4598** 通过，0失败、0跳过。
- PDF引用与改名重点回归：32项通过。
- `npm run build`：通过，含 `tsc --noEmit`。
- `npm run lint`：0错误、118条既有警告，本轮未新增。
- `git diff --check`：通过。
- 运行脚本：`qa/pdf-plus-integration-native.cjs`；它要求已准备的上述独立库、夹具、实际复制输出及官方插件，不能直接对真实库运行。准备/诊断记录保存在被 Git 忽略的 `dist/pdf-plus-integration/`。

测试脚本曾因复制格式悬停菜单、浮动设置窗口中的对话框、原生 PDF 文字层遮挡底层批注、重复使用历史测试输入及 PDF++ 扩展状态差异失败；这些不记为产品缺陷。尤其原生阅读器禁用 PDF++ 后 `getState()` 不含 `page`，最终页码回退断言使用实际可见的 `.pdf-page-input`，截图确认第2页。

## 截图与记录

均为运行候选代码与官方 PDF++ 后采集的本地截图，已实际查看：

- `dist/pdf-plus-integration/wiki-selection.png` / `markdown-selection.png`：精确高亮 `alpha beta`。
- `dist/pdf-plus-integration/annotation-comment.png`：既有高亮的评论弹窗。
- `dist/pdf-plus-integration/rectangle-enabled.png`：白板矩形裁剪及完整来源按钮。
- `dist/pdf-plus-integration/page-fallback-disabled.png`：禁用 PDF++ 后原生阅读器第二页。
- `copied-formats.json`、`annotation-probe.json`、`rectangle-probe.json`、`rename-probe.json`、`source-hashes-before.json`、`fixture-hashes-before.json`、`final-state.json`、`tests.log`、`lint.log`、`build.log`：对应可核查记录。

PDF++ 最终恢复为启用；PDF 编辑与自动复制/粘贴保持关闭；独立日历插件、主题、窗口尺寸及 Markdown 链接偏好恢复。截图未上传 Library，提供本地路径。

## 边界

已验证当前版本和上述合成夹具，未覆盖所有 PDF 字体、复杂多栏/旋转页面、扫描件/OCR、第三方主题或移动端；没有测试两个白板窗口同时编辑同一数据。CLI 为本机 Node 24.13.0，未另装 Node 22 重跑。没有新增 PDF++ 高亮到白板的自动反向链接。用户仍通过显式粘贴加入白板；原始复制文本是快照，不会随正文编辑或文件改名改写。
