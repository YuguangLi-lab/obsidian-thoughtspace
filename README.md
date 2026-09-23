# ThoughtSpace Whiteboard

ThoughtSpace is a visual research and writing workspace for Obsidian. Organize linked Markdown notes, text, images, and PDFs on a whiteboard; connect ideas with mind maps and turn grouped material into a Markdown draft. It integrates with vault files, tags, properties, and native editing. The standalone calendar plugin is optional.

**Desktop only · Obsidian 1.13.7 or newer.** Download `thoughtspace-<version>.zip` from [Releases](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases/latest), extract the folder to `.obsidian/plugins/`, and enable **ThoughtSpace Whiteboard** in Community plugins. When upgrading, keep your existing `data.json`.

## 中文说明

为 Obsidian 开发的可视化研究与写作插件。在白板上组织 Markdown 笔记、文本、图片与 PDF，用连线和思维导图展开想法，再将材料整理成文章。

当前开发版本：**0.98.8**（已发布版本请以 Releases 为准）。桌面端插件，需要 Obsidian 1.13.7 或更新版本，最低版本按已有原生交互验收环境声明。

## 主要功能

- 无限白板：平移缩放、连接端点、分组、子白板、整理布局、搜索和小地图。
- 笔记卡片：引用已有 Markdown 文件、原位编辑、独立卡片标题、透明样式和正文自适应。
- 思维导图：模板、自动布局、分支折叠、连续创建主题和键盘导航。
- 阅读摘录：支持笔记与 PDF，摘录保留来源链接，可拖入白板整理。
- 白板写作：组合卡片与分组，生成 Markdown 草稿，保留参考材料。
- Obsidian 联动：文件、标签、属性、链接和编辑工具栏；日历与日记已拆为独立插件，可选安装。

## 安装

1. 在本仓库的 [Releases](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases/latest) 下载 `thoughtspace-<version>.zip`。
2. 解压得到 `thoughtspace` 文件夹，将它放入仓库的 `.obsidian/plugins/` 目录。
3. 在 Obsidian 设置 → 第三方插件中启用 **ThoughtSpace Whiteboard**。

也可以下载 Release 中的 `main.js`、`manifest.json` 和 `styles.css`，将这三个文件放到 `.obsidian/plugins/thoughtspace/`。

升级时替换这三个运行文件即可，保留已有 `data.json`。建议先备份自己的仓库。社区目录的版本同步与 GitHub Release 分开发生，请以各自页面显示的版本为准。

## 白板鼠标操作

- 空白处按住**左键拖动**：平移画布。
- 空白处按住**右键拖动**：框选对象；按住 Shift 可累加选择。
- **右键单击**：打开当前位置的菜单；拖动框选结束后不会额外弹出菜单。
- 卡片上的左键拖动仍用于移动卡片；也可用工具栏的框选工具、空格加左键或中键完成选择和平移。

## 思维导图快捷操作

| 操作 | 效果 |
| --- | --- |
| 点击主题边缘的加号 | 创建已连线的子主题并进入编辑 |
| 从主题拖线到空白处 | 创建子主题并自动排版 |
| Tab | 保存当前主题并添加子主题 |
| Enter | 添加同级主题 |
| Shift+Enter | 编辑时换行 |
| 方向键 | 退出编辑后，切换同一主题树中的可见主题 |
| Shift+Tab | 退出编辑后，返回父主题 |
| F2 | 原位编辑选中的主题 |
| Esc | 取消当前连线或编辑 |

普通白板中的文本不会被强制变为思维导图。导图中孤立的普通卡片保留方向键微调。

## 图片与连线路径

图片和 PDF 卡片按原图或当前页面的实际比例适配尺寸，选中框与连线锚点贴合内容；拖动缩放保持比例。图片不显示文件名栏和装饰边框，PDF 展开时仅显示页面；悬停或键盘聚焦 PDF 时显示浮动翻页与折叠控件，触屏保持控件可见。

侧边 **更多白板工具 → 连线统一为直线** 会修改当前白板全部连线，后续新建连线和导图分支也使用直线。选中一条连线后，顶部 **当前路径应用到全部连线** 可统一为曲线、直线或圆角折线。支持撤销，不改变颜色、箭头和连接关系；不改动其他白板。

## 白板搜索、PDF 和逐层展开

- **原生搜索**：默认自动生成 `ThoughtSpace/白板搜索/` 下的 Markdown 索引。保存后稍候即可用 Obsidian 搜索查找白板文字、卡片标题、分组名称和连线说明；打开搜索结果中的定位链接可返回节点。已有 Markdown 笔记的正文直接搜索原文件。PDF 目前索引文件名和页码，不做全文提取或 OCR。
- 索引不包含位置变化，移动卡片不会重复写入相同内容。重命名或删除白板后自动整理对应索引；手工修改过的索引保留并提示。设置 → 界面与阅读可关闭自动更新；命令面板可运行“重建白板原生搜索索引”。
- **PDF 卡片**：右上角箭头折叠/展开，保留页码和展开前尺寸。点击选中 PDF 卡片后，`PageUp` / `PageDown` 翻页，`Home` / `End` 跳到首页/末页。页面底部仍可点按翻页或输入页码。首次读取页数后才允许向后翻页，编辑输入框时不会拦截这些按键。
- PDF 缩略图限制画布尺寸，并复用最多两个闲置文档、20 秒后清理；超过 32 MiB 的文件不保留文档缓存。折叠和离开画面会取消缩略图渲染。大文件的首次加载仍取决于文档复杂度。
- **连线子节点**：父节点上的减号折叠分支，加号只展开下一层。右键父节点提供“展开下一层”和“展开所有子节点”；`Ctrl/Cmd+Shift+Enter` 切换折叠/逐层展开。普通连线可右键选择“允许折叠（设为父子分支）”；不允许循环或多个父节点。折叠只改变显示，保留节点、连线和笔记文件，支持撤销重做。

## 开发

需要 Node.js 22 和 npm。

```sh
npm ci
npm run lint
npm test
npm run build
python3 scripts/package.py
```

发布前运行官方 `eslint-plugin-obsidianmd` 规则；错误会阻止 CI，建议项保留为警告。社区目录会独立扫描并检查构建结果，本地检查不能替代官方审核。

构建输出为 `main.js`，同时同步插件样式到 `styles.css`。打包脚本将当前版本的安装 ZIP、独立运行文件和校验清单写入 `dist/`。Obsidian 与 CodeMirror 由宿主提供，不打包另一份编辑器。

安装到自己的测试仓库：

```sh
node scripts/install.mjs "/absolute/path/to/your/vault"
```

安装脚本会备份目标仓库已有插件文件，并验证安装后的 SHA-256。

## 验证与兼容性

0.97.0 已通过 1142 项自动测试、34 项 Obsidian 运行时流程检查及 6 项真实鼠标/键盘检查。开发者本机的 5000 节点纯模块基准中，包含草稿历史的连续新增主题 p50 从 37.62 ms 降至 21.58 ms；这不代表包含渲染、保存和其他插件开销的端到端性能保证。

卡片内嵌 Markdown 编辑使用 Obsidian 内部构造接口；不兼容时回退到源码编辑。建议在自己的主题和插件组合中验证。

## 许可证

[MIT](LICENSE)。第三方组件与许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
