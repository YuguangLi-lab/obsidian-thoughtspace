# ThoughtSpace Whiteboard

[English](README.md) · **简体中文**

在 Obsidian 中收集材料、梳理关系，再编排成文章。笔记、白板和生成的草稿都留在你的仓库中。

**1.3.35 · 桌面端 Obsidian 1.13.7+ · MIT**

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
| 新建普通白板或独立脑图，选择文件格式 | [新建与文件](docs/USER-GUIDE.zh-CN.md#boards) |
| 插入笔记、PDF、图片，编辑卡片与分组 | [白板对象](docs/USER-GUIDE.zh-CN.md#objects) |
| 理清主题与关系，折叠或展开阅读 | [思维导图与独立脑图](docs/USER-GUIDE.zh-CN.md#mind-maps) |
| 读原文、做摘录、找待读材料 | [阅读与来源](docs/USER-GUIDE.zh-CN.md#reading) · [搜索与材料清单](docs/USER-GUIDE.zh-CN.md#search) |
| 看音视频，截图，点击时间戳回到来源 | [音视频](docs/USER-GUIDE.zh-CN.md#audio-video) |
| 编排结构、固定参考、生成草稿 | [白板写作](docs/USER-GUIDE.zh-CN.md#writing) |
| 找命令、设置快捷键或解决保存问题 | [操作设置](docs/USER-GUIDE.zh-CN.md#controls) · [常见问题](docs/USER-GUIDE.zh-CN.md#troubleshooting) |

## 新版的常用入口

- **新建白板或脑图…**：在一个小弹窗选择普通/脑图与旧格式/Markdown；成功创建并打开后记住选择。四条明确格式命令仍可用。
- **原生属性往返**：Markdown 白板使用 Obsidian 原生 Properties 与正文；从普通标题菜单或脑图菜单打开，再从原生页返回同一标签。可绑定 **切换白板与原生属性**。
- **准确的保存提示**：仅查看、原生保存等待和冲突会说明原因；按实际情况定位原生页或打开已经生成的恢复草稿。
- **想法与已有笔记**：**整理成笔记** 可生成新笔记，也可保留想法、正文和原关系并关联已有笔记。节点菜单的 **关联已有笔记…** 直达原生文件选择器，再确认左右关联。
- **继续上次白板**：打开最近有效记录，无有效记录时进入空间总览；恢复已保存状态。
- **四向关系命令**：独立脑图可绑定添加父节点、子节点、左侧关联节点与右侧关联节点的命令，没有默认快捷键。输入、锁定与保存保护继续生效。

详细步骤见[教程](docs/USER-GUIDE.zh-CN.md)；文件结构、格式另存与属性边界见[单文件 Markdown 白板说明](docs/markdown-boards.zh-CN.md)。

## 安装或更新

1. 在 Obsidian 的 **设置 → 第三方插件** 搜索 **ThoughtSpace Whiteboard**，安装并启用；社区目录与 GitHub 版本可能不同步。
2. 手动安装时，从 [Release](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases/latest) 下载 **`main.js`、`manifest.json`、`styles.css`**，放进仓库的 `.obsidian/plugins/thoughtspace/`。使用自定义配置目录时，改为对应目录。
3. 更新只替换这三个运行文件，保留已有 `data.json`；重新加载插件。ZIP 和校验和用于人工下载、解压和核对，Obsidian 不靠它们安装。
4. 打开命令面板，运行 **新建白板或脑图…**。本例选择普通白板与 Markdown，命名“城市降温研究”。

## 文件与保存

原 `.thoughtspace` 白板继续兼容，不会自动迁移。**另存为 Markdown 白板** 创建独立副本，保留原文件和已有链接；Markdown 白板包含真实属性、普通正文与受插件管理的布局区。请勿直接手改布局 JSON。

笔记卡片引用原文件；原位编辑会保存回该笔记。内置文本与布局保存在当前白板中。动态材料清单属于普通白板完整搜索窗口，保存筛选条件、重开重新计算；常用视角只保存相机位置，二者都不是正文备份。

保存保护不会自动合并两份全文或解除只读。未落盘的原生输入在强制退出时可能丢失。四向命令的组合输入防护已有检查，但完整 IME 可信结束流程未由 CDP 确认；不宣称覆盖全部输入法、主题、插件或通用提速。见[保存与恢复说明](docs/USER-GUIDE.zh-CN.md#troubleshooting)、[1.3.35 验证边界](qa/RELEASE-1.3.35.md)和[安全与数据访问](SECURITY.md)。

## 项目

[问题反馈](https://github.com/YuguangLi-lab/obsidian-thoughtspace/issues) · [更新记录](CHANGELOG.md) · [参与开发](CONTRIBUTING.md) · [MIT 许可](LICENSE) · [第三方许可](THIRD_PARTY_NOTICES.md)

设置支持中文和英文，其他界面仍以中文为主。日历/日记集成是可选的独立插件。开发使用 Node.js 22：`npm ci` → `npm run lint` → `npm test` → `npm run build`；发布资产由仓库工作流构建并提供来源证明。
