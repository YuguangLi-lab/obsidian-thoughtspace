# 1.3.27 发布前验收

从已发布的 1.3.26（`b4439e9a5a358b05a92a49bea9214881d65a390f`）继续开发，仅安装至独立 `thoughtspace-qa-vault`。发布分支为 `release/1.3.27`，不合并 main、不安装到真实库。此前媒体暂存、紧凑布局、同源引用与白板样式保留。

## 完成范围

- 白板播放器摘录与独立播放器的笔记引用共用时间戳、来源和截图层级；保持原文、图片、链接精确时间及引用关系。
- 点击媒体时间戳优先当前白板中来源匹配的播放器；旧链接可复用已打开的明确来源白板。显式节点或唯一连线关系可消除歧义，否则回退独立播放器。不创建新播放器节点，不主动播放，沿用暂停、延迟加载和已有草稿保护。
- 搜索按白板会话保留关键词、筛选、正文开关、选中结果、分页数量与滚动；全文索引未完成时也保留恢复目标。
- 普通连线起点在低缩放时保持 30 屏幕像素热区。拖动支持横纵等间距提示与吸附，保留边缘/中心优先、轴锁、Alt 绕过及撤销。
- 默认连线拖空白仍直接编辑文本；Alt/Option 松手或聚焦起点后 Shift+F10 打开文本、表格、已有 Markdown/PDF 选择。取消无孤立节点，重复打开只保留一个菜单，重复确认不重复创建。
- 结构与样式未变时复用小地图 SVG，仅更新变化几何；没有改写 Session 持久化、历史、冲突检查或原子写入。

## 最终检查

- `npm test`：**4540 通过，0 失败、0 跳过**。
- `npm run lint`：**0 错误、118 条既有警告**。
- `npm run build`：TypeScript 与构建通过，生成样式已同步。
- 发布脚本 Python 测试：**7 通过**。
- `git diff --check`、1.3.27 版本一致性与安装包文件白名单/完整性检查通过。

原生环境：Apple M4 Pro / 48 GiB / macOS 27、Obsidian 1.13.7、Electron 39.8.3 / Chromium 142。驱动 Node 24.13.0，发布 CI 使用 Node 22。下列为实际 Obsidian 临时库测试，不是浏览器仿制界面：

| 流程 | 结果与范围 |
| --- | --- |
| 五项体验与时间戳 | 26 项通过：搜索重开、25%/50%/100% 起点热区与焦点、等距拖动和撤销、类型菜单和文件选择取消、表格及默认文本、真实点击时间戳、0/0.5/999 秒待定位值、显式播放时长边界、独立播放器重复复用、换源草稿保护 |
| 键盘与菜单 | 最终构建 12 项通过：重复 Shift+F10、三个类型、方向键选择、Enter 创建、480px 暗色与 1440px 浅色菜单可见且不超出窗口、Esc 关闭 |
| 媒体卡片一致性 | 最终构建 28 项通过：三类卡片各两轮折叠展开无重复标题、原生实时编辑与取消、原文和来源笔记不变、无重复节点、窄屏时间戳与来源不重叠、命中/焦点/悬停/完整路径提示 |

26 项流程完成后，仅追加重复菜单关闭及清理修复，随后运行最终 4540 项全量回归、12 项原生菜单检查和 28 项卡片复测。原生验证实际发现重复 Shift+F10 会叠加菜单，修复并补回归；测试选择器因多个已开白板匹配而失败的情况通过限定目标白板解决，没有将其宣称为产品故障。

## 性能结果与边界

方法、数据组成、全部摘要及不利结果见 [保存实验](experience-performance.md)。1.3.24 原始基线仍在 [原始性能报告](performance-results.md)，没有以候选结果覆盖。

同一候选交替 AB/BA、每条件 2 次预热及 10 次采样：10k 小地图阶段 p50 从 354.6 降至 5.5 ms，整次保存 p50 从 2378.3 降至 2170.0 ms；p95 从 2931.0 变为 2948.3 ms，没有改善。1k 两轮没有观察到端到端收益，反而更慢。不宣称所有规模提速或尾延迟改善。实测仅挂载 2 个节点，媒体暂停；包含宿主及辅助插件开销，无强制 GC，样本量有限，未重测拖动 FPS 或端到端输入延迟。

## 本机证据

- `dist/experience-native/results.json`、`keyboard-results.json`；复现脚本 `qa/experience-native.cjs`、`qa/experience-keyboard-native.cjs`。
- `dist/experience-native/equal-spacing.png`、`connection-type-menu.png`、`menu-480-obsidian.png`、`menu-1440-moonstone.png`。
- `dist/media-card-consistency/native-results.json`、`native-check.cjs`；最终截图 `final-light.png`、`final-dark.png`、`final-narrow.png`。
- `dist/experience-save/{before,after,paired}.json`、CPU profiles 与固定合成种子；复现脚本 `qa/experience-save-native.cjs`、`qa/experience-save-paired.cjs`。
- 检查日志 `/tmp/experience-full-tests.log`、`/tmp/experience-final-lint.log`、`/tmp/experience-build.log`。截图及合成库不提交、不进入发行包；Library 上传不可用。

未验证线上平台真实网络播放、移动端、全部第三方主题或任意缩放下的端到端可达性。白板可平移，不自动重排节点以避让所有工具栏。本轮没有重新宣称跨进程草稿恢复验证；1.3.26 的真实进程重启证据与本机暂存边界继续适用：不跨设备同步，可能损失末尾 350ms 输入或未完成写入，未覆盖断电、多进程同库及配额耗尽。

发布的确切提交、CI、tag、公开下载及构建来源证明以本版本 Actions/Release 和最终交付记录为准。
