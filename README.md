# ThoughtSpace 思维白板

为 Obsidian 开发的可视化研究与写作插件。在白板上组织 Markdown 笔记、文本、图片与 PDF，用连线和思维导图展开想法，再将材料整理成文章。

当前版本：**0.97.0**。桌面端插件，最低声明版本 Obsidian 1.6.0；本次原生交互验收使用 1.13.7。

## 主要功能

- 无限白板：平移缩放、连接端点、分组、子白板、整理布局、搜索和小地图。
- 笔记卡片：引用已有 Markdown 文件、原位编辑、独立卡片标题、透明样式和正文自适应。
- 思维导图：模板、自动布局、分支折叠、连续创建主题和键盘导航。
- 阅读摘录：支持笔记与 PDF，摘录保留来源链接，可拖入白板整理。
- 白板写作：组合卡片与分组，生成 Markdown 草稿，保留参考材料。
- Obsidian 联动：文件、标签、属性、链接和编辑工具栏；日历与日记已拆为独立插件，可选安装。

## 安装

1. 在本仓库的 [Releases](https://github.com/YuguangLi-lab/obsidian-thoughtspace/releases/latest) 下载 `thoughtspace-0.97.0.zip`。
2. 解压得到 `thoughtspace` 文件夹，将它放入仓库的 `.obsidian/plugins/` 目录。
3. 在 Obsidian 设置 → 第三方插件中启用 **ThoughtSpace 思维白板**。

也可以下载 Release 中的 `main.js`、`manifest.json` 和 `styles.css`，将这三个文件放到 `.obsidian/plugins/thoughtspace/`。

升级时替换这三个运行文件即可，保留已有 `data.json`。建议先备份自己的仓库。插件尚未通过 Obsidian 社区插件市场分发。

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

## 开发

需要 Node.js 22 和 npm。

```sh
npm ci
npm test
npm run build
python3 scripts/package.py
```

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
