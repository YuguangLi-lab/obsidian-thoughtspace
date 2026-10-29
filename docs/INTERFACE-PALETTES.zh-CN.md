# 界面配色与资料库

## 历史与恢复范围

1.3.38 的设置有纸张、暖色杂志、液态玻璃，以及面板材质、强调色、效果开关、界面密度；1.3.39 按当时要求收敛为纸张模式。强调色、密度、白板背景、阅读字号/行宽本来仍在，不能视为本次新增。

界面布局、设置组织、工具栏尺寸和间距沿用 1.3.41。六套共享配色分别提供浅色/深色，可跟随 Obsidian 或仅在插件内指定明暗；原暖白纸张仍是缺少配置时的默认。**没有暖色杂志选项，也不恢复透明/重模糊渲染。** 现有配色、强调色、白板和收集自定义背景不改写。面板材质沿用旧 UI，不再提供改版的画廊或材质控制。

## 参考来源

实际读取官方源码与许可证后，按 ThoughtSpace 的共享语义变量独立适配；不是直接安装第三方主题，也不表示原作者认可本插件。

| 预设 | 来源与参考内容 | 许可 | 适配 |
| --- | --- | --- | --- |
| 暖白纸张 | 项目原始 12 级纸张明暗色阶 | 本项目 | 默认保留历史纸张层次 |
| 中性白灰 | [Primer Primitives](https://github.com/primer/primitives)，base/color/light 与 dark JSON5 | MIT，GitHub Inc. | 中性白灰底色，按钮/边线独立映射 |
| 北境蓝灰 | [Nord](https://github.com/nordtheme/nord)，src/nord.scss 的 Polar Night、Snow Storm、Frost | MIT，Sven Greb | 浅色操作色加深；边线为插件布局适配 |
| 柔雾紫灰 | [Catppuccin Palette](https://github.com/catppuccin/palette)，palette.json 1.8.0 的 Latte/Mocha | MIT，Catppuccin | 基底、文本、表面和紫色操作色映射 |
| 东京暮蓝 | [Tokyo Night](https://github.com/folke/tokyonight.nvim)，Storm 源色与 Day WezTerm 导出 | Apache-2.0 | 浅色表面提亮、辅助文字加深以适合中文 UI |
| 晴空雾蓝 | [Ayu Colors](https://github.com/ayu-theme/ayu-colors)，themes/light.yaml 与 dark.yaml | MIT，Konstantin Pschera | 保留清亮/深蓝灰底色，以语法蓝替代原橙黄强调，增强文字对比 |

Solarized 也已阅读，但其黄米色浅色方案未纳入本轮列表。完整许可证位于 `docs/licenses/` 及随插件包附带的 `THIRD_PARTY_NOTICES.md`。调研只读取静态颜色/文本，没有执行第三方代码或新增依赖。

## 使用与兼容

设置 → 界面使用原生下拉框选择整套配色、明暗、强调色与密度，不使用配色画廊或新增折叠分组。更换整套配色不会改写已有强调色；如需推荐操作色，强调色选择“随配色”。原有合法设置继续读取，偏好导出只含可移植配置。

全插件共享颜色变量；白板纸张/图片、收集背景、卡片内容颜色仍独立。切换配色不重新着色既有对象或原文件，也不改变已验证的旧 UI 尺寸与阴影。

资料库恢复独立窗口的“鸟瞰 / 资料表 / 进度看板”。鸟瞰保留动态卡片盒、组合筛选、正文搜索和定位。空间总览恢复原独立入口及原布局，保留收藏、最近白板、笔记归属、跨白板引用、缺失引用与投递。已有资料集、筛选与资料文件不迁移或删除；之前保存的可选模块字段仍兼容读取，但不再隐藏旧 UI 中的功能。

## 旧 UI 基线核对

1.3.41 发布源码提交 `1c2626a1a500455362c2da2d30dfe4a3f4b65862` 的393个 src/styles文件与工作源码基线逐字节相同。安装前备份的 main.js 和 styles.css 也分别与该基线构建哈希一致。因此恢复按已核实的1.3.41源码进行；保留新增配色数据及受控的颜色映射，不引入另一套布局。
