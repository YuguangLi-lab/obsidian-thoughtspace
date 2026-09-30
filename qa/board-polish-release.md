# 1.3.25 白板工具栏与状态样式验收

本轮仅调整现有顶部格式栏的展开方式和卡片状态层级；不移动侧边/底部工具、不修改横向材料分类、不修改小地图或增加来源行。媒体草稿恢复、布局与同源引用保留。

## 行为

- 未编辑时参数行默认收起，分类仍常驻。点击分类展开，再次点击同分类或 Esc 收起；Escape 将键盘焦点回到分类。Enter、方向键和原有格式溢出导航保留。
- 单选对象已有顶部编辑按钮时，隐藏该卡片重复的本地编辑按钮（正在获得焦点的按钮保留）；其他悬停卡片仍可就近编辑。多选与连线工具保留。
- 选中使用实线强调环，编辑使用虚线环，悬停使用淡色轮廓；自定义边框与表格无外框行为保留。
- 仅已保存媒体块引用降低嵌入边线和顶层 note callout 底色，不修改源笔记、其他插件或一般 Markdown callout。

## 检查

- 全量 Node 回归 4458 / 4458，通过；TypeScript 和构建通过；lint 0 errors / 118 既有 warnings；7 项 Python 发布脚本测试通过。
- `board-polish-native.cjs`：原生 Obsidian 1.13.7 临时库 20 项检查，涵盖键盘展开/收起/恢复焦点、重复切换、单选多选、实时预览草稿与选区、编辑态、悬停、自定义边框、浅深色和 420 / 320 px 窄窗。
- `board-fallback-native.cjs`：另 2 项检查，临时禁用单个测试 BoardView 的嵌入编辑器能力以触发源码回退，模式切换保留草稿与选区；选中表格保持无外框。宿主 app 引用在构造后立即恢复。
- 选择集合初始化通过真实白板控制器；格式按钮、键盘、悬停与编辑使用实际 DOM 控件。不是完整人工端到端操作覆盖。
- 原生截图实际查看：`dist/board-polish-native/selected-light.png`、`selected-dark.png`、`multiple-light.png`、`multiple-dark.png`、`editing-light.png`、`source-fallback-dark.png`、`narrow-420-dark.png`、`narrow-320-dark.png`。截图为本机 QA 产物，不打包进插件。
- 媒体阶段检查和完整进程重启证据见 [媒体验收](media-draft-recovery.md)，原版性能基线见 [性能报告](performance-results.md)。本轮不重新宣称性能改善。

## 运行与边界

原生脚本使用已安装的 Playwright（可用 `PLAYWRIGHT_MODULE` 指定模块位置），连接本机 CDP 9237；严格核对 vault 路径为工作副本相邻的 `thoughtspace-qa-vault`，只用于独立测试库。未添加运行时依赖。CLI Node 24.13.0；GitHub CI / Release 使用 Node 22。

未测试所有第三方主题、跨操作系统或辅助技术。保留 Obsidian 主题变量和原生控件，但不据此宣称完整屏幕阅读器或 WCAG 审核通过。源码回退通过故障注入验证，不代表当前宿主自然发生过该故障。
