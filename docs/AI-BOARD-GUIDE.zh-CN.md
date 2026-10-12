# 用 AI 生成 ThoughtSpace 白板：第一期

第一期提供在本机执行的 `1.0.0-local` CLI、格式校验快照和自制示例。AI负责输出Board数据，工具校验并创建一个新文件，再由插件打开。格式以[规范](AI-BOARD-FORMAT.zh-CN.md)和工具内schema为准；这是预览接口，尚非稳定SDK。

## 1. 下载后先验证一份示例

在仓库首页选择 **Code → Download ZIP**，完整解压，进入解压后的仓库根目录。准备 **Node 22**；运行工具无需安装依赖或连接账号。

```sh
node tools/dist/thoughtspace-board.mjs validate examples/ai-board/sample-vault/brain-v3.md --vault-root examples/ai-board/sample-vault --json
```

这条命令已在干净副本实跑，预期退出0、`overall: passed`。`sample-vault` 是明确的自制库根，`notes/source.md` 是自制来源。请保留完整样例库，v2示例还会引用 `ordinary-v3.md`。

```sh
node tools/dist/thoughtspace-board.mjs inspect examples/ai-board/sample-vault/handwriting-v3.md --json
```

`inspect` 只读输出对象/笔迹计数与诊断。笔记卡片保存来源路径，原文仍在源笔记。手写数据是世界坐标和压力样本，设备掌拒需另行验收。

## 2. 给 AI 的要求

先选普通、脑图或手写模式，再选Markdown或直接JSON包装。新板使用Board v3；普通省略presentation，脑图为brain，手写为handwriting。只给AI已经核实的库内来源路径；没有来源的内容使用独立text节点。

可复制以下提示，替换主题和已核实来源：

```text
为 ThoughtSpace 新建一个 Board v3。只输出完整 JSON 对象，不加代码围栏。
模式：脑图。主题：自制想法与来源。已核实来源：notes/source.md，相对指定样例库根。
一个想法使用 kind:text、brainIdea:true、非空title和text；来源另用card.file。
必须有nodes、edges、viewport。ID稳定且在各自命名空间唯一，无空白/控制字符。
边端点引用真实节点；父子边kind:branch，from父、to子；关联可direction:both。
不产生分支环、多父级或分支与section合成的环。数值有限，zoom为0.15–2.5。
brain只用规范允许的键，centerId与history当前项一致；展开≤8，固定≤6，history≤40。
只生成这张新板；其他内容用独立text，不伪造来源、引用位置或capture元数据。
```

普通板省略presentation/brain；手写板使用 `presentation: handwriting`、`ink.version:1`、合法笔画。遵守每笔8192点、总65536点、2000笔，以及压力0–1和坐标范围。精确字段和可选扩展见格式规范。

## 3. 创建新文件

先准备一个新的输出目录。工具的父目录必须已存在，文件路径必须未被占用。下例中的 `out/` 是你自行准备的目录。

```sh
node tools/dist/thoughtspace-board.mjs create ordinary out/new-ordinary.md --title "自制普通白板" --json
node tools/dist/thoughtspace-board.mjs create brain out/new-brain.md --title "自制脑图" --json
node tools/dist/thoughtspace-board.mjs create ink out/new-ink.thoughtspace --format legacy --title "自制手写" --json
```

这些命令生成合法空板。使用AI内容时，把AI的直接Board对象保存为 `draft-board.json`：

```sh
node tools/dist/thoughtspace-board.mjs create brain out/new-ai-brain.md --board-json draft-board.json --title "自制AI脑图" --vault-root examples/ai-board/sample-vault --json
```

`draft-board.json` 是生成器输入；插件打开的是生成的 `.md` 或 `.thoughtspace`。最终 `file` 路径相对实际承载它的vault根。把结果放入样例库时保留其来源笔记，不把 `out` 误当来源根。已有输出路径会被拒绝，工具没有overwrite、convert或就地修改命令。

## 4. 解释校验结果

| 退出码 | 资格 |
| --- | --- |
| 0 | 本次报告范围内通过 |
| 2 | format_only：格式通过，引用仍未完整检查 |
| 1 | 格式、引用或文件操作失败 |
| 64 | 命令用法错误 |

报告区分格式、引用、诊断和创建结果。引用状态有 `not_checked/not_applicable/checked/failed`；诊断区分error、normalized和recoverable，给出位置与原因。成功创建可能退出2；应同时查看 `created` 与 `overall`。

明确 `--vault-root` 才检查结构化直接引用的常规文件存在；直接子板会解析一次。正文内联Markdown、子板内部递归引用、远程资源、媒体解码、PDF页码、时间戳、锚点、capture ID和opaque字段中的潜在引用仍在检查边界外。`checkedCount` 表示报告中的有限检查，不能当作整个vault或来源语义已验证。

10份正式样例格式都通过，实际CLI结果是6份passed、4份format_only：普通v3两份正文中的 `[[notes/source]]` 未做语义解析；旧v2两份的子板内部引用未递归检查。这是预期的有限资格，不能把它们说成整板所有引用验证通过。

合法未知字段通常保留，brain/history/brainViewport等严格白名单除外；background、brainColors和阅读检查点存在明确规范化。旧历史指向已删除节点可报告recoverable。请依据报告解释变化，保留原输入。

## 5. 在插件里打开

复制完整自制 `sample-vault` 到独立测试库，并在插件中打开板。手写需要已公开的 **1.3.36-beta.2**；稳定 **1.3.35** 尚不支持手写展示。保存后完整重开，比较ID、来源、opaque字段和完整笔迹压力/坐标；Markdown还要检查YAML、布局前后正文、BOM和换行。

本期工具schema与公共插件src相互隔离。它来自已测试的本地格式读取器；命名脑图阅读位置的额外校验不表示公共beta.2已有相应操作UI。10份样例及3类CLI非空输出已通过公共beta.2实际解析器/包装替换往返；此自动检查没有打开插件UI。此前10份正式样例和3类CLI新板的实际插件打开、Session保存、新PID重开验收使用本地beta.5，资格在[本期记录](../qa/AI-BOARD-PHASE1.md)中单独标明。

既有原生冲突恢复测试中，宿主 `Vault.read` 在Session前去除一个开头BOM。新建Markdown恢复副本按该基线保存，缺少这个BOM；源文件及外部冲突磁盘文件不变，其余正文、YAML、CRLF、封装和完整Board精确。该副本能解析、打开和重开，却不是原始磁盘文件的逐字节克隆。CLI本期只创建新文件，不实现此插件恢复流程。

物理iOS/Android/Pencil、WKWebView、系统IME、完整掌拒和设备性能未验收。第一期没有MCP、网络监听、账号登录、批量事务或自动修改已有白板。

[全部自制示例](../examples/ai-board/README.zh-CN.md) · [格式规范](AI-BOARD-FORMAT.zh-CN.md) · [工具命令与许可](../tools/README.md)
