# ThoughtSpace Whiteboard

**1.3.37** 将暖色杂志式界面扩展到全插件，改善窄窗操作，完善收集检索与整理，并增加在线视频工作区的本机草稿恢复。详见[更新记录](CHANGELOG.md#1337)及[收集页说明](docs/COLLECTION-WORKSPACE.zh-CN.md)。沿用原生 Markdown、Properties 和保存所有权保护。

**AI 白板工具第一期（`1.0.0-local`，Node 22）**：只读校验/检查，并排他创建普通、脑图或手写新文件。下载仓库 ZIP 后可直接运行已构建工具，无需安装依赖。见[AI指南](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.36/docs/AI-BOARD-GUIDE.zh-CN.md)、[格式规范](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.36/docs/AI-BOARD-FORMAT.zh-CN.md)、[自制示例](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.36/examples/ai-board/README.zh-CN.md)和[工具入口](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.36/tools/README.md)。手写示例可使用 1.3.36 或此前已公开的 1.3.36-beta.2 插件；`format_only`（退出2）明确保留引用未检查状态。

[English](README.md) · **简体中文**

真实 iOS／Android、Pencil、系统移动输入法与软键盘、移动 WebView 尚未验证；桌面尺寸与触控模拟不代表设备性能或完整掌拒。在线恢复依赖本机已完成的暂存，存储失败或未完成写入仍有恢复限制。对应验证记录与下载见 [1.3.37 Release](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases/tag/1.3.37)。

在 Obsidian 中收集材料、梳理关系，再编排成文章。笔记、白板和生成的草稿都留在你的仓库中。

**1.3.37 · Obsidian 1.13.7+ · MIT**

**[安装与更新](docs/USER-GUIDE.zh-CN.md#installation) · [十分钟上手](docs/USER-GUIDE.zh-CN.md#quick-start) · [完整中文教程](docs/USER-GUIDE.zh-CN.md) · [下载最新版](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases/latest)**

## 一条研究与写作路径

### 1. 在白板收集材料

把已有笔记、PDF、图片、音视频放在一起。分组整理证据，记录摘录与想法；引用卡片继续指向来源文件。

![普通白板：城市降温研究的材料、来源笔记与文章结构](https://raw.githubusercontent.com/YuguangLi-lab/obsidian-thoughtspace/main/docs/images/whiteboard-research.png)

### 2. 用脑图梳理关系

围绕当前中心建立父子分支和左右双向关联。想法先留在图里，之后可新建笔记，或保留原想法并关联已有笔记；关系显示层级支持 1–5 层，大图可继续搜索和翻页。

![独立脑图：将遮荫、路面和步行路线组织为关系](https://raw.githubusercontent.com/YuguangLi-lab/obsidian-thoughtspace/main/docs/images/brain-research.png)

### 3. 把材料编排成文章

进入白板写作，拖动卡片、分组与章节确定顺序，固定参考，写作或预览，再生成独立 Markdown 草稿。编排与生成草稿不会自动改写来源笔记。

![白板写作：文章顺序与当前白板材料库](https://raw.githubusercontent.com/YuguangLi-lab/obsidian-thoughtspace/main/docs/images/writing-research.png)

*截图是 1.3.35 在专用合成库中的真实界面；“城市降温研究”是教学示例，不代表实际研究数据。*

## 选择你的入口

| 想做什么 | 教程 |
| --- | --- |
| 新建普通白板、独立脑图或手写白板，选择文件格式 | [新建与文件](docs/USER-GUIDE.zh-CN.md#boards) |
| 随手记录正文，再定位具体白板引用并返回 | [收集页](docs/COLLECTION-WORKSPACE.zh-CN.md) |
| 整笔圈选编辑、导出 SVG、核对恢复版本 | [手写白板](docs/HANDWRITING-IPAD.zh-CN.md) |
| 插入笔记、PDF、图片，编辑卡片与分组 | [白板对象](docs/USER-GUIDE.zh-CN.md#objects) |
| 理清主题与关系，折叠或展开阅读 | [思维导图与独立脑图](docs/USER-GUIDE.zh-CN.md#mind-maps) |
| 读原文、做摘录、找待读材料 | [阅读与来源](docs/USER-GUIDE.zh-CN.md#reading) · [搜索与材料清单](docs/USER-GUIDE.zh-CN.md#search) |
| 看音视频，截图，点击时间戳回到来源 | [音视频](docs/USER-GUIDE.zh-CN.md#audio-video) |
| 编排结构、固定参考、生成草稿 | [白板写作](docs/USER-GUIDE.zh-CN.md#writing) |
| 找命令、设置快捷键或解决保存问题 | [操作设置](docs/USER-GUIDE.zh-CN.md#controls) · [常见问题](docs/USER-GUIDE.zh-CN.md#troubleshooting) |

## 常用入口

- **先记录，后整理**：运行「打开收集」，直接输入正文，点击「记录」或按 ⌘／Ctrl + Enter。原生标签、已有附件和白板／分组投递均可选。投递后仍留在创建时间流；不会自动给旧笔记回填属性。
- **收集与白板往返**：同一笔记有多个引用时选择具体卡片，返回保留筛选和当前会话浏览位置；隐藏记录可临时显露。改名重新核对，过期请求不抢回焦点，主窗口与弹出窗口分别路由。
- **手写与整笔编辑**：新建时选择「手写白板」，使用套索移动、复制或删除整笔，导出 SVG 到已有笔记并保留回链。SVG 是视觉副本，不提供可编辑笔迹回导。保存失败可只读对照磁盘、本地和恢复版本。
- **阅读位置与引用导航**：给脑图阅读位置命名、复制链接，逐张查看同源笔记在各白板／分组的引用，并返回原位置。四向关系操作保持在缩放画布外；可选的簇整理保留内部几何。
- **窄屏与分屏**：白板、媒体、写作、阅读、材料、PDF 与设置按容器和可见键盘区域布局；收集继承当前强调色与密度。编辑器、播放器、草稿及原生输入保持各自归属。
- **原生属性与保存保护**：Markdown 白板保留 Obsidian Properties 和正文；只读、等待原生保存、冲突与恢复入口继续明确显示。已有笔记关联、继续上次白板和四向关系命令仍保留。

详细步骤见[完整教程](docs/USER-GUIDE.zh-CN.md)、[移动适配](docs/MOBILE-ADAPTATION.zh-CN.md)及[单文件 Markdown 白板](docs/markdown-boards.zh-CN.md)。独立 [AI 白板 CLI](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.36/tools/README.md)继续提供只读检查和排他创建；插件不自动调用 AI 服务，本版不新增 npm 或 MCP 发布。

## 安装或更新

1. 在 Obsidian 的 **设置 → 第三方插件** 搜索 **ThoughtSpace Whiteboard**，安装并启用；社区目录与 GitHub 版本可能不同步。
2. 手动安装时，从 [Release](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases/latest) 下载 **`main.js`、`manifest.json`、`styles.css`**，放进仓库的 `.obsidian/plugins/thoughtspace/`。使用自定义配置目录时，改为对应目录。
3. 更新只替换这三个运行文件，保留已有 `data.json`、`collection-drafts/` 及其他插件数据；重新加载插件。ZIP 和校验和用于人工下载、解压和核对，Obsidian 不靠它们安装。
4. 打开命令面板，运行 **新建白板或脑图…**。本例选择普通白板与 Markdown，命名“城市降温研究”。

## 文件与保存

原 `.thoughtspace` 白板继续兼容，不会自动迁移。**另存为 Markdown 白板** 创建独立副本，保留原文件和已有链接；Markdown 白板包含真实属性、普通正文与受插件管理的布局区。请勿直接手改布局 JSON。

笔记卡片引用原文件；原位编辑会保存回该笔记。内置文本与布局保存在当前白板中。动态材料清单属于普通白板完整搜索窗口，保存筛选条件、重开重新计算；常用视角只保存相机位置，二者都不是正文备份。

保存保护不会自动合并两份全文或解除只读。收集检查点可在正常重开后恢复已写入的草稿，其他仅存于内存的输入不因此获得同样保证。手写正常 resize 保留未抬笔草稿，但超过采样预算会拒绝新提交：保留原源文件，并清空被拒草稿。未落盘的原生输入在强制退出时可能丢失。

无 Node 移动探针仅覆盖模块执行与插件构造函数，不含 `onload`、移动 WebView、UI 或存储。真实设备、Pencil、系统移动输入法、完整掌拒及设备性能未验。见[保存与恢复说明](docs/USER-GUIDE.zh-CN.md#troubleshooting)、[1.3.36 验证及发行复核](qa/RELEASE-1.3.36.md)和[安全与数据访问](SECURITY.md)。

## 项目

[问题反馈](https://github.com/YuguangLi-lab/obsidian-thoughtspace/issues) · [更新记录](CHANGELOG.md) · [参与开发](CONTRIBUTING.md) · [MIT 许可](LICENSE) · [第三方许可](THIRD_PARTY_NOTICES.md)

设置支持中文和英文，其他界面仍以中文为主。日历/日记集成是可选的独立插件。开发使用 Node.js 22：`npm ci` → `npm run lint` → `npm test` → `npm run build`；发布资产由仓库工作流构建并提供来源证明。
