# Folio Atelier 3.33.0 · Apple 简洁与液态玻璃

这是主题更新包，适配现有 ThoughtSpace Folio 界面；配套插件仍为 `1.3.35-folio.9`，本包不替换插件程序。插件 1.3.38 的原生界面未在本次验证中覆盖，请保留现用插件，不要因安装主题而降级。

## 切换外观

安装主题并启用 Style Settings 后，进入 **设置 → Style Settings → Folio Atelier → 颜色与界面 → 界面风格**：

- **Folio 经典**：默认选项，保留原有外观。
- **Apple 简洁**：中性灰界面、系统界面字体、柔和边框和分层阴影。
- **液态玻璃**：在菜单、建议列表和白板悬浮工具栏使用背景模糊、边缘高光与半透明材质；正文、媒体内容和卡片主体保持实底。

液态玻璃提供 **柔和磨砂 / 通透高光** 两种质感，模糊强度可在 **8–24 px** 之间调节。开启 **减少透明效果** 可恢复实底；系统要求减少透明度、提高对比度或强制颜色时同样降级。透明度偏高时普通工具栏按钮使用实色文字，避免原有低对比灰字透在画布上。

这些效果是独立编写的 CSS 材质近似，没有动态光学折射、色散或弹性形变，也不透视桌面壁纸。没有引入 SVG 滤镜、React 或鼠标追踪脚本。横向标签页、分栏宽度、左侧栏显隐逻辑和顶层目录配色均沿用现有设置。

## GitHub 参考

- [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react)：观察其边缘折射和色散思路；这类效果依赖额外运行时，本次未移植。
- [shuding/liquid-glass](https://github.com/shuding/liquid-glass)：用于区分 SVG shader 的真实位移效果与 CSS 模糊近似。
- [stefan-imbesi/obsidian-macos-theme](https://github.com/stefan-imbesi/obsidian-macos-theme)：参考多层背景高光、界面材质与减少透明度的处理方式。
- [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials)：参考材质层次与可读性的设计原则。

已查看上述仓库的 README 与实现源码。吸收设计思路，未复制、安装或执行第三方主题/演示代码。Folio 自己的命名、中文选项、插件适配与配色体系保持独立。

## 离线验证

- 44 组外观与降级检查：浅色/深色、640/1180 px，经典外观回归、Apple、磨砂、通透、手动实底、系统降级、无模糊支持、打印与扁平外观。
- 菜单和普通工具栏按钮共 64 个文本对比度样本：在黑/白背景及高光极值模型下，最小约 **7.02:1**。这是选定控件的保守计算，不代表整个界面所有文字均达到该值。
- 三种新外观下共 72 个关系图连线检查，覆盖浅色/深色和 320/600/960 px；来源、详情、固定按钮可命中，键盘焦点与详情开关正常。
- 临时笔记库升级检查：预检无写入、明确配置保留、旧文件备份、并发设置修改时拒绝覆盖。

浏览器预览为自有离线测试页面，关系图使用插件实际渲染代码与框架替身；不等于 Obsidian 原生窗口验收。未连接或修改真实笔记库，未做原生分栏拖拽或真实帧率测试，未自动安装到真实笔记库；本说明记录发布前离线验证范围。

## 安装与恢复

关闭 Obsidian，解压本包并进入其目录，将下面的路径替换为实际笔记库：

```sh
python3 scripts/install.py "/你的笔记库路径" --dry-run
python3 scripts/install.py "/你的笔记库路径"
```

安装器备份旧主题与相关设置，保留明确配置，不自动启用新外观。打开 Obsidian 后按上面的路径切换外观。恢复视觉只需选择 **Folio 经典**；如需回退版本，可在关闭 Obsidian 后恢复安装器输出的备份中的主题文件。

本包包含 `src/` 和 `scripts/build.py`，可运行 `python3 scripts/build.py` 重建 `theme.css`。`SHA256SUMS.json` 为包内文件校验清单，`validation/` 保存检查摘要与报告，`previews/` 为离线示意图。
