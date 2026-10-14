# Folio Atelier · 纸页工坊

面向 Obsidian 与 ThoughtSpace 的中文主题。主题版本 **3.32.11**，可选插件适配 **1.3.35-folio.8**。

这是基于 ThoughtSpace **1.3.35** 的独立预发布适配。当前插件主线 1.3.36 不属于本安装器的升级来源；不要用本适配覆盖 1.3.36。可以单独安装主题，并在原有插件版本上自行验证兼容性。

## 界面设计

- 中文 Style Settings，九种强调色、阅读与工作区密度设置。
- 横排标签、可配置的边缘工具栏、顶层项目颜色与子目录继承。
- 阅读、写作、材料、媒体及关系视图的协调配色与交互细节。
- 本轮补全长中文标题提示、关系分组数量与折叠标记，修复窄面板操作区、工具浮层及键盘重试焦点。

## 安装主题

从本版本 Releases 下载公开更新包，解压 `Folio Atelier` 目录。

将 `theme.css` 和 `manifest.json` 放入笔记库的 `.obsidian/themes/Folio Atelier/`，在 Obsidian 的“设置 → 外观 → 主题”中选择 Folio Atelier。安装 Style Settings 插件可调整中文选项。

也可在关闭 Obsidian 后，从解压目录运行：

```sh
python3 scripts/install.py "/你的/笔记库路径" --dry-run
```

确认计划后去掉 `--dry-run`。安装器保留原文件备份。

## 可选 ThoughtSpace 适配

完整运行文件位于 `integrations/thoughtspace-folio/`。关闭 Obsidian 或禁用 ThoughtSpace 后先检查：

```sh
python3 scripts/install_thoughtspace_folio_8.py "/你的/笔记库路径" --dry-run
```

该安装器核对版本与完整文件哈希，支持声明的 1.3.35 基线、folio.1 至 folio.7，或对相同 folio.8 无操作；拒绝其他版本或自定义修改。确认计划后去掉 `--dry-run`。

## 开发与验证

```sh
python3 scripts/build.py
```

主题通过本目录 `src/` 的本地 CSS 模块构建，无外部字体或网络样式依赖。完整插件源码与测试在仓库根目录；集成目录内的 30 个文件仅为部分来源快照。

已冻结版本的本地测试：7,168 / 7,168；空间总览 32 个离线场景、232 项检查；关系视图六组布局、48 项检查，含 12 个编辑交叉场景；临时安装检查 121 / 121。[验证摘要](VALIDATION.json)记录资产身份与具体边界。

离线浏览器使用自有数据及框架替代物。当前未完成本版本的 Obsidian 原生安装、分栏交互或完整 UI 验收。宽关系图部分连线仍穿过来源按钮，编辑关闭焦点恢复也待后续改进。

公开包包含运行文件、主题源码、安装器、部分来源与验证摘要。完整本地诊断、应用样式缓存、机器路径和用户配置不随包发布。

## 许可

主题采用 [MIT License](LICENSE)。ThoughtSpace 适配保留其[原许可证](integrations/thoughtspace-folio/LICENSE)。
