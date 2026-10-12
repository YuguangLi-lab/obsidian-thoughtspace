# ThoughtSpace AI 白板文件格式契约（第一期）

本文对应第一期工具内的格式校验快照：`readBoardDocument`（`tools/board-tool/schema/board-document.ts`）→ `parseBoard` / `parseBoardValue`（`tools/board-tool/schema/model.ts`）。它描述已实现的文件格式及生成边界，供 AI 生成**新文件**和本地校验使用；不代表稳定公开 SDK。插件版本、文件版本、CLI 版本是不同的概念。正式发布状态与测试结果以交付说明为准。

## 1. 五条独立版本轴

| 层级 | 当前可读取版本 | 作用 |
| --- | --- | --- |
| Board 根对象 `version` | `1`、`2`、`3` | 节点种类和部分可选字段的兼容性 |
| Markdown 布局封装 `version` | `1` | 标记区内的包装协议，不是 Board 版本 |
| `brain.version` / 节点 `mindmap.version` | `1` | 本板脑图状态 |
| `ink.version` | `1` | 手写样本集合 |
| 脑图阅读位置对象 `version` | `1` | 命名阅读位置快照 |

第一期生成器默认生成 Board v3。普通白板**省略** `presentation`；没有 `presentation: "ordinary"` 这一合法值。脑图使用 `presentation: "brain"`，手写使用 `presentation: "handwriting"`，两者都要求 Board v3。文件名不能把普通笔记变成白板。

## 2. 两种文件包装

### `.thoughtspace`：直接 Board JSON

文件全部内容是一个 Board 对象，无 Markdown 封装，无 `format` 字段要求。可带一个 UTF-8 BOM。以下是合法的空普通白板：

```json
{"version":3,"nodes":[],"edges":[],"viewport":{"x":60,"y":60,"zoom":1}}
```

### `.md`：原生 Markdown 白板

文件从顶部 YAML 属性区开始（前面仅可有 BOM），YAML 中自身的 `thoughtspace` 键必须解析为字符串 `board`。后面只能出现一对完整、顺序正确的布局标记，标记区内仅一个完整的 `json` 围栏：

````markdown
---
thoughtspace: board
tags: [synthetic]
---

# 自制白板

这里的原生正文不属于布局 JSON。

<!-- thoughtspace-board-layout:start -->
```json
{
  "format": "thoughtspace-board",
  "version": 1,
  "board": {
    "version": 3,
    "nodes": [],
    "edges": [],
    "viewport": {"x": 60, "y": 60, "zoom": 1}
  }
}
```
<!-- thoughtspace-board-layout:end -->

后续正文也不属于布局 JSON。
````

标记文字区分大小写，前后空白可以存在；不要在其他位置再放同样的独立标记行。读取器会扫描整个文件，重复或损坏标记、反向标记、缺失围栏、围栏内非 JSON 均会拒绝。布局区可以使用 LF 或 CRLF。上层封装要求 `format: "thoughtspace-board"`、`version: 1` 和 `board`；不要把 Board v3 写成封装 v3。

插件通过经过验证的文档基线保存布局：Markdown 当前布局字节必须仍等于基线布局；当前 YAML 和布局结构也须有效。仅布局外的 YAML/正文发生变化时，会保留最新布局外字节和封装额外字段。布局本身发生并发变化时拒绝覆盖。`.thoughtspace` 保存要求整份当前文件与原基线相同。JSON 缩进、数值的原始写法、对象键顺序不是字节保留承诺；**布局区外的 Markdown 字节**才是该保存路径的保留范围。BOM、布局换行及未知封装字段的行为有专门例子和测试。

## 3. Board、节点和连线的基本约束

Board 必需 `version`、`nodes` 数组、`edges` 数组、`viewport` 对象。即使专用脑图或手写为空，也不能省略这三个布局字段。坐标、尺寸、缩放须为 JSON 数值且在解码后有限；不要用字符串、`NaN` 或 `Infinity`。

| 对象 | 必需字段和范围 |
| --- | --- |
| `viewport` | `x`、`y`：有限数；`zoom`：`0.15 ≤ zoom ≤ 2.5` |
| 每个节点 | `id`：非空白字符串，同一 `nodes` 中唯一；`kind`；有限的 `x,y,width,height`；`width ≥ 80`；`color` |
| 节点高度 | `text` 至少 `40`；其他种类至少 `60`；折叠规则另见下文 |
| 每条边 | `id`：非空白字符串，同一 `edges` 中唯一；`from,to`：本板真实节点 ID，不能相同；`label`：字符串（允许空） |

内置颜色枚举为 `sand, blue, green, rose, purple, orange, red, teal, cyan, lime, slate, brown`。节点 `color` 不能直接写 CSS 颜色；支持自定义填色的节点可另用 `fillColor`。

### 节点种类与引用

| Board 版本 | 可用 `kind` |
| --- | --- |
| v1 | `card`、`section` |
| v2 | v1 加 `board` |
| v3 | v2 加 `mindmap`、`text`、`image`、`pdf`、`audio`、`video` |

| `kind` | 附加必需条件 |
| --- | --- |
| `card` | `file` 为库内 `.md` 路径，卡片引用原生笔记，而不是复制笔记正文 |
| `section` | `title` 为字符串；包含关系由节点的完整世界坐标矩形决定，无 `children` 数组 |
| `board` | `file` 为库内 `.thoughtspace` 或 `.md` 路径；实际目标内容仍须另行验证是白板 |
| `text` | `text` 为字符串；独立正文保存在本 Board 中 |
| `mindmap` | `mindmap` 是下文所述合法脑图状态；其他种类不得带 `mindmap` |
| `image` | `file` 为 `.png/.jpg/.jpeg/.gif/.webp/.avif/.bmp` 路径；网络图地址 `imageUrl` 有单独规则 |
| `pdf` | `file` 为 `.pdf` 路径；可选 `pdfPage` 为正的安全整数 |
| `audio`、`video` | `file` 通过实际库内媒体路径/媒体后缀校验；`mediaStart` 使用实际媒体时间校验 |

生成时文件路径须为库内相对路径。基础节点解析器拒绝开头斜线、路径段 `.`/`..` 和反斜线，并按种类检查后缀；这些检查不是完整的文件系统安全证明。CLI的明确根和安全路径检查还会施加额外边界。**格式解析成功只证明存储结构与基础路径语法通过，不证明目标存在、可读取、媒体可解码或子板内容合法。** 第一期开启外部引用检查必须明确给出 `--vault-root`；没有检查的引用不能报告为全部通过。示例统一以 [`sample-vault`](../examples/ai-board/sample-vault/) 为根，笔记路径是 `notes/source.md`，不要替换成真实资料库或虚构文件。

### ID：三种基本命名空间

节点 ID、边 ID、手写笔画 ID 分别在 `nodes`、`edges`、`ink.strokes` 集合内唯一；它们不是同一个全局 ID 集合。`edge.from/to` 只能引用**节点 ID**，不能引用边或笔画。文件路径也不是节点 ID。推荐按 `node-`、`edge-`、`stroke-` 加稳定后缀命名，所有后续引用复用原 ID。

底层普通节点/边校验只要求非空白 ID，并未给所有 ID 统一的256字符上限。脑图状态和阅读位置引用有更严格的标识规则；笔画也有自己的限制。为兼容全部模式，生成时统一使用无控制字符、无两端空白、长度不超过256的稳定字符串。保存视角、选区、阅读位置各自另有局部 ID 集合，不把其 ID 当节点使用。

### 连线与分组：语义取决于字段

v3 边可选：`style: curve|straight|elbow`、`direction: forward|both|none`、`dashed: boolean`、`color` 内置枚举、`fromSide/toSide: top|right|bottom|left`、`kind: "branch"`。这些边样式字段在 v1/v2 中不能使用。

`kind: "branch"` 才表示父子关系：`from` 为父，`to` 为子。每个子节点最多一个分支父级，整个分支必须是无环森林。普通关系边省略 `kind`，可用 `direction: "both"` 表示双向关系；标签、坐标左右上下和端口位置不会自行生成父子或同级语义。

还要检查分支与分组包含关系的**合并环**：若一个节点被分组包含，它不能通过分支链把包含自己的分组收为子级。多个分支和多层分组的间接组合也不能成环。分组间严格矩形包含才是嵌套，重合的同尺寸分组不互相包含。含分组的合法分支数据不等于自动导图排版支持该结构；现有自动排版可能要求使用分组布局。

## 4. 脑图 v3

专用脑图的 Board 必须有 `presentation: "brain"` 和合法 `brain`；普通和手写 Board 不得带 `brain`。脑图容器节点使用同样形状的 `node.mindmap`，它引用本板对象，并非内嵌另一份 Board。

`brain` / `mindmap` 使用严格键白名单：

```json
{
  "version": 1,
  "centerId": "node-idea",
  "expandedIds": ["node-idea"],
  "pins": [],
  "history": {"entries": ["node-idea"], "index": 0},
  "descendantDepth": 2
}
```

仅允许 `version,centerId,expandedIds,pins,history,descendantDepth`。`history` 仅允许 `entries,index`，不能往这里塞任意扩展字段或递归历史快照。

- 标识：非空、无两端空白、长度≤256、无ASCII控制字符或DEL。
- 展开列表最多8个、固定列表最多6个，列表内唯一。
- 历史最多40项；允许隔开后的重复，不允许连续重复；`index` 为合法整数索引，`centerId === entries[index]`。
- 空脑图：省略 `centerId`，`history.entries: []`，`history.index: -1`；展开和固定列表仍必需。
- 可选 `descendantDepth` 为1–5整数；省略表示默认1层。

可作为当前交互中心的对象为 `card`、`board`、`section`，或 `kind: "text", brainIdea: true` 的想法节点。普通独立文本、图片/媒体和脑图容器不是这套中心的可用目标。想法节点要求 Board v3、非空且≤160字符的 `title`、字符串 `text`、不带 `file`；不能在其他节点上写 `brainIdea`。

`brainViewport` 可选，仅限专用脑图，严格允许 `x,y,zoom` 三键，有限数字，缩放0.15–2.5；省略时由脑图视图适应布局。它和必需的普通 `viewport` 是不同镜头状态。

**目标失效是可恢复状态。** `brain.centerId`、展开/固定/历史和阅读位置可能引用已删除的旧节点；当前解析器有意保留这些合法字符串状态，不因缺节点而把整份 Board 判损坏。使用时会显示不可用目标或选择可用退路。AI 新建应引用实际可用节点；校验旧文件时报告 `recoverable`，不能将这类历史引用一律升级为致命错误。

命名阅读位置可选 `brainReadingPositions`（最多50个）。每项严格允许 `version,id,name,centerId,expandedIds,depth,viewport`；`version:1`、局部唯一严格 ID、无两端空白且无控制字符的1–100字符名称、1–5整数深度、最多8个唯一展开 ID、严格的三键镜头。它不保存固定列表或递归历史，不与普通 `savedViews` 混用。恢复时中心已删除会退回可用中心并适应关系图，不强套已失效的精确镜头；失效展开项会过滤。

## 5. 手写 v3：保存真实样本

必须使用 `presentation: "handwriting"`、Board v3，以及 `ink: {"version":1,"strokes":[]}`。其他模式不得带 `ink`。普通 `nodes`、`edges` 和 `viewport` 仍必需；可以为空。点不是 SVG 路径，不是屏幕像素，是持久化的**世界坐标和压力**：

```json
{
  "id": "stroke-line",
  "color": "#2764ab",
  "width": 3.125,
  "points": [[140.12345678901235,180.23456789012346,0],[175.375,155.625,0.25]]
}
```

| 项目 | 精确限制 |
| --- | --- |
| 笔画数量 | ≤2000；集合允许为空 |
| 每笔点数 | 1–8192；空笔画无效 |
| 整板总点数 | ≤65536 |
| 笔画 ID | 非空白，≤256字符，无ASCII控制字符/DEL，同集合唯一 |
| 颜色 | 六位十六进制 `#RRGGBB`，不接受三位简写 |
| 笔宽 | 有限数，0.5–24 |
| 点 | 恰好 `[x,y,pressure]` 三元素；全为有限数 |
| 坐标 | `abs(x), abs(y) ≤ 1000000` |
| 压力 | 0–1；零压力合法且仍可见 |

超预算或有非法样本时拒绝完整集合，不静默截断、不删除“坏点”后假称成功。渲染路径可能为显示取舍小数，保存样本不会因此按显示精度取整。JSON/JavaScript 使用 IEEE-754 数值；保持已解码的数值精度，不承诺任意长十进制文本逐字或超过安全整数范围的精度。正式示例包含小数、零/满压力及单点笔画；往返比对使用实际样本值和样本 SHA。

## 6. 可选字段：已知校验与扩展保留

生成最小新板可省略以下内容。已有字段应按当前实现处理，不能用“删除所有未知字段”冒充兼容性校验。

| 可选字段 | 当前校验要点 |
| --- | --- |
| 节点 `title,file,text` | 若出现必须是字符串；各节点种类的附加条件仍适用 |
| `collapsed/expandedHeight` | 折叠节点 `height` 必须72，允许种类为card/pdf/board/mindmap/text/audio/video/image，`expandedHeight` 有限且达到该种类高度下限；未折叠不得带expandedHeight |
| 文本样式 | `textColor` 为default或内置色；fontSize12–48；fontFamily default/serif/mono；textAlign left/center/right；autoSize为boolean；textAutoHeight只限text |
| `topic/branchFolded/sectionFolded` | v3布尔值；sectionFolded仅section |
| `mindmapRules` | layout right/left/down/up/bilateral；density compact/standard/relaxed；automatic布尔值；section不能带 |
| `textMaxWidth/preferredWidth` | textMaxWidth仅text，160–720；preferredWidth仅card，220–520 |
| 样式 | transparent/fillColor限card/text/section；fillColor为内置色、none或六位hex；borderWidth为0–4枚举、borderStyle solid/dashed/dotted；locked/customBorder为boolean；autoFit只限card |
| `cardStyle/sectionDivider/review` | cardStyle band/paper/index/sticky仅本地card或text且无webUrl；sectionDivider仅section；review later/reading/done仅card/text/image/pdf |
| Board `mode/mindmapDirection/defaultEdgeStyle` | 仅v3；free/mindmap、right/down/up、curve/straight/elbow |
| Board `mindmapLayout/mindmapDensity` | 仅v3，使用上述layout/density枚举 |
| `spaceId/snapToGrid` | spaceId为1–80字符的ASCII字母数字/连字符；snapToGrid为boolean |
| `savedViews` | ≤50项、局部ID唯一、非空白名称≤100字符、有限镜头/缩放0.15–2.5 |
| `selectionSets` | ≤30项、局部ID唯一、非空白名称≤60字符、每项≤100000个唯一字符串节点ID；缺失引用不由此处强制拒绝 |
| `savedSearches` | 仅v3，使用当前材料清单独立校验器；不由AI猜造复杂查询快照 |
| `writing` | title≤160、order≤100000唯一字符串；manuscript≤1000000；chapters≤500，章节ID唯一且不撞节点ID，标题≤160、正文≤100000；还有独立进度/引用/选项校验，见实际model |
| 引用来源元数据 | paragraphQuote/pdfQuote/videoCapture/webUrl/imageUrl有各自来源、路径、长度或URL校验；生成最小板不伪造这些 provenance |

主要 Board/节点/边对象允许未识别属性，合法的未知 JSON 通常随读取和正常保存保留；ink集合/笔画也未实施键白名单。封装额外字段由 `readBoardDocument` 记住并在正常布局替换中保留。**这不意味着所有嵌套对象都允许扩展**：brain、brain.history、brainViewport和命名阅读位置的结构使用严格白名单。

以下是有意的规范化，不是未知数据永久保留承诺：

- `background` 经安全清洗形成完整偏好：无效背景模式回退dots，纸张/图片偏好有默认值，纹理和透明度夹到0–100，颜色转小写，无效/非库内图片路径清空；未知属性不会作为CSS透传。
- `brainColors` 仅保留background/node/border/text/line五个合法hex色，三位hex展开、去空白、转小写；无合法色时移除此字段。
- 不合法的 `readingLayout` / `relationGeometry` 检查点会移除；不要把它们当AI任意扩展槽。
- JSON重复键由标准解码取最后一个；生成时禁止重复键。非有限数、负零、指数溢出/下溢等可能受JSON序列化语义影响，特别是Markdown兼容读取路径。新文件只生成有限、可精确表达的正常数字。

因此验证结果要区分：致命格式错误（不输出新板）、已知规范化（明确列出变化）、可恢复旧引用（保留并提示）、外部引用未检查（仅格式通过）。明确库根只启用有限的结构化引用检查；内联Markdown、远程/语义目标、opaque字段中的潜在引用都不能据此变成checked。直接子板通过文档解析后，若自身仍有已知引用但未继续检查，父板该子板条目也是not_checked。不要承诺任意未知内容在任何编辑/转换/渲染动作中逐字保留。

## 7. 第一阶段的本地工具边界

工具将当前解析器用于新文件生成、格式/引用校验和只读检查；CLI版本不是文件schema版本。实际使用见 [AI 白板指南](AI-BOARD-GUIDE.zh-CN.md)。第一期没有MCP服务、HTTP listener、账号认证、远程控制或批量修改已有文件。生成器不覆盖已有路径，也不提供原板就地改写或格式转换命令。

10份正式自制样例及机器可读清单位于 [examples/ai-board](../examples/ai-board/README.zh-CN.md)。生成时已用实际解析器、真实YAML解码器和文档替换路径检查；原生插件打开→Session保存→新进程重开属于另一个验证层，不能用格式解析成功替代，最终以独立QA记录为准。手机/平板模拟和桌面原生验证也不等于物理iOS/Android/Pencil验收。


公开仓库包含上述独立 `tools/board-tool/schema/` 快照；它来自已测本地格式读取器，43个依赖模块中40个与公共beta.2完全相同。差异只有Board模型、文档读取器、阅读位置验证；阅读位置只保留格式校验，没有引入未公开的位置操作或插件UI。快照清单见 [SCHEMA-SNAPSHOT.json](../tools/board-tool/SCHEMA-SNAPSHOT.json)。公共插件 `src/`、版本、运行文件和Release保持原样。

10份自制样例的既有实际插件打开、Session保存和新PID重开测试使用本地beta.5；它们的公开beta.2解析/包装往返另由 `npm run board-tool:verify` 检查。额外的命名阅读位置校验不表示beta.2已有相应操作入口。生成最小新板可省略这些可选字段。验收资格与限制见 [本期记录](../qa/AI-BOARD-PHASE1.md)。

宿主读取边界：既有隔离测试观察到 `Vault.read` 在Session建立前移除一个开头BOM。新建Markdown冲突恢复副本按该实际读取基线保存，缺少这个BOM；原板及外部冲突磁盘文件保持原样，其余CRLF、YAML、正文、封装及完整Board已精确比较。恢复副本能解析、打开和重开，但不是原始磁盘文件的逐字节克隆。这是插件宿主恢复边界，CLI仅创建新文件，不执行该恢复流程。
