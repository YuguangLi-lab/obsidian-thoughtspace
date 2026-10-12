# AI 白板工具第一期的公开范围与资格

公开内容为CLI/API bundle、隔离schema快照、格式规范、AI指南、10份自制白板和来源笔记、定向测试及CI。工具版本为 `1.0.0-local`，要求Node22；版本名中的local表示在本机执行。本期不更改公共插件src、样式、manifest/package版本、已发布beta.2或稳定1.3.35，也不发布新插件Release、npm包或MCP。

## 解析器来源

基于公共main `08e911fb7bb1b96794bf232c356eeab07fbd5d7c` 建立独立整合。工具的43个schema依赖模块中40个与这个公共beta.2字节一致；差异仅为Board模型、文档读取器和脑图阅读位置验证。它们来自第一期已测格式基线，放在工具自己的schema目录；阅读位置仅保留类型与校验，未纳入未公开的位置操作/UI。机器可读哈希见 [schema清单](../tools/board-tool/SCHEMA-SNAPSHOT.json)。这是一份格式快照，不是稳定SDK。

## 检查层次

- 本期工具定向测试覆盖177项解析、错误定位、引用状态、文件安全和CLI行为；完整公共main集成的测试/build/type/lint由Check CI运行，日志保留在对应公开commit的Actions中。
- `npm run board-tool:verify` 实际运行两套读取器：公共beta.2生产解析器与隔离schema。10份正式样例分别解析、布局替换、再读取；逐项比较完整Board、合法opaque字段、Markdown布局前后内容和BOM。另创建三类非空CLI新文件，并用公共beta.2及工具读取器核对；已有目标拒绝且字节不变。
- 同一检查从无node_modules的临时目录运行已打包CLI；源样例未改变。格式10/10通过，CLI资格为6 passed、4 format_only。普通v3两种包装的正文内联链接未解析；v2两种包装的子板内部引用未递归检查。
- 历史原生证据使用本地beta.5：10份正式样例、3类CLI非空板的实际openBoard/Session保存/新PID重开，以及6项非法输入、存储故障和CAS冲突恢复，共19项、832断言、17次新PID重开。它是此前格式基线的实际插件往返证据，不能冒称本轮公共beta.2 UI已重新实测。两次失败原始尝试保留并排除，BOM严格副本假设的失败未隐藏。

源码从仓库可下载；运行已提交的bundle无需npm install。开发与CI使用锁定的既有依赖，嵌入js-yaml 4.3.2的MIT正文已交付。CI构建后比较bundle与已提交字节，防止过期产物。

本轮本机集成实跑：**7355/7355 Node测试**（含177项工具定向测试）、23/23 Python、插件/工具严格类型与构建通过。插件lint 0错误、141项既有警告；工具lint 0错误/0警告。生成的插件三运行文件SHA与既有公开beta.2 Release完全一致。sandbox禁止tsx启动器创建IPC时，本机使用同版本tsx的标准Node加载器运行同一测试集；CI仍执行仓库标准npm test。

## 保留边界

`format_only` 是有限校验结果，退出2；它不是格式失败或未执行原生往返，却仍意味着某些引用未被完整验证。存在性检查不证明正文语义、媒体解码、PDF页码、锚点、时间戳、capture或远程资源有效。

历史测试发现宿主Vault.read会去除一个开头BOM：新建Markdown冲突恢复副本缺少该BOM，但源文件和外部冲突文件保持原样，其余CRLF/YAML/正文/封装及完整Board精确，副本实际能解析、打开、重开。该限制属于插件宿主恢复基线，CLI不会操作已有板或触发该恢复；不能承诺逐字节克隆原始文件。

原始脑图样例镜头可能把中心置于可读区域下方，需要实际“适应画布”调整。物理iOS/Android/Pencil、系统IME、WKWebView、完整掌拒和设备性能尚未验收。

全部示例使用自制数据。公开内容排除私人路径、执行vault/profile、全Git备份、凭证及大QA归档。七个迁移工作树、暂存/未提交状态和所有既有本地交付保留。
