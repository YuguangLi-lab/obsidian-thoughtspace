# 1.0.34 — 阅读工作区与知识空间布局

## 改动

- 知识空间侧栏：收集、新建、空间总览和笔记摘录组成统一入口区；收藏/空间下划线导航；整理与分组入口平整排布，保留窄侧栏及短窗滚动策略。
- 阅读桌：左侧搜索、筛选、内容/目录/关联导航；右侧正文独立滚动；上方固定状态、完成与来源操作，下方固定翻篇；原生字体和 Markdown 渲染保留。
- 引用原文：清晰的文件身份、范围及行号，独立正文区域和固定底部返回/链接/嵌入操作。
- 清理 legacy 样式及 workspace-polish、visual-system 中重复阅读选择器，新样式由两个独立 CSS 模块负责；保留其余共享滚动样式。

## 修复和行为验证

阅读队列重建、跨 100 项窗口和翻篇保持键盘焦点；状态修改保留正文 DOM 与滚动位置；窄屏 Tab 定位显露完整按钮；关联跳转聚焦正文；完成最后一项筛选结果后回到搜索；关闭后的旧回调不再写入；组合输入期间不拦截 Alt 方向键。

- TypeScript/esbuild 构建通过。
- 全套 2,875/2,875 测试通过，0 失败/跳过；本轮增加 16 项实际 ReadingDesk 类行为测试。
- ESLint 0 error、82 warning（含既有兼容 API 与规则提示，本轮新增 keyCode 229 输入法兼容检查的弃用提示）。
- 7 项打包脚本测试、Release 元数据检查、git diff --check 通过。
- 阅读桌 144 个 Chromium 响应式状态：6 个宽度 × 3 个高度 × 2 主题 × 2 专注状态 × 2 筛选状态，无横向溢出、焦点裁切及不可访问的筛选项。使用原生 DOM/CSS 快照及最终源码 CSS；真实 Tab 使用源码实际 focusin 注册语句提取执行，修复前红、修复后绿。
- 侧栏 48 个前后对照状态（24 个新版），引用预览 28 个布局组合通过。引用布局预览阶段模拟 MarkdownRenderer/Modal 边界，随后完成原生界面及插入验证。
- 原生 Obsidian 1.13.7：6 个阅读窗口尺寸/主题状态、54 个固定区控件命中检查及队列焦点可见性通过；7 类阅读流程、引用插入/双击保护/返回编辑/取消不改原文件通过。
- 实机浅色/深色阅读桌、引用及白板截图已保存。并非只有合成预览。任意第三方主题及长期运行未作穷尽验证。

## 数据与交付

- demo-vault 原有 24 个白板逐字比较保持不变，夹具已移入可恢复回收区，恢复原白板与主题，后台节流恢复 true，测试全局引用已释放。
- 用户库当前白板保持 37 个节点、已保存、无活动编辑/阻塞；内容哈希不变，设置仅允许最近访问时间变化。
- 源码、开发镜像、两个 dist 与两个已安装插件，共 6 份运行文件 SHA256 一致。
- 实机 dev:errors 和 error console 无捕获错误。未推送 GitHub。

## 证据文件（本地开发 QA 目录）

- reading-final-native.png / reading-dark-native.png：原生阅读桌浅深主题。
- board-final-native.png / reference-native.png：原生白板与引用预览。
- reading-review/REPORT.md、final-matrix.json、keyboard-red-green.json：独立阅读响应式与焦点验证。
- sidebar/REPORT.md、reference/REPORT.md：分项布局报告。
- native-reading.js.result.txt、native-reference.js.result.txt、native-reading-layout.js.result.txt：原生交互和布局结果。
- vault-integrity.json、delivery.json：哈希及安装一致性。

安装包 SHA256：`8429678eb6a297bd1a348c2af1a5018d047e665bb625f94d40e155f68cdce076`。
