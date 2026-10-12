# AI 白板自制样例

本目录有10份白板文件，位于独立 [`sample-vault`](sample-vault/) 根下。唯一来源笔记 [`notes/source.md`](sample-vault/notes/source.md) 来自此前的自制准备稿，不含真实用户资料。v2子板引用同库 `ordinary-v3.md`；节点结构化 `file` 引用已经在这个明确的样例根内检查文件存在，子板已用实际白板读取器检查。普通示例text中的 `[[notes/source]]` 保留原样，工具不执行其原生内联链接解析，不将其标为checked。

| Board内容 | 直接JSON包装 | 原生Markdown包装 |
| --- | --- | --- |
| v3普通：分组、独立正文、笔记卡片、普通双向关系 | [ordinary-v3.thoughtspace](sample-vault/ordinary-v3.thoughtspace) | [ordinary-v3.md](sample-vault/ordinary-v3.md) |
| v3脑图：一个想法、原生笔记引用、父子分支、展开/固定/镜头 | [brain-v3.thoughtspace](sample-vault/brain-v3.thoughtspace) | [brain-v3.md](sample-vault/brain-v3.md) |
| v3手写：线条与单点、零/满压力、完整精度坐标 | [handwriting-v3.thoughtspace](sample-vault/handwriting-v3.thoughtspace) | [handwriting-v3.md](sample-vault/handwriting-v3.md) |
| v1兼容：分组与原生笔记卡片 | [legacy-v1.thoughtspace](sample-vault/legacy-v1.thoughtspace) | [legacy-v1.md](sample-vault/legacy-v1.md) |
| v2兼容：原生笔记卡片与同库子板引用 | [legacy-v2.thoughtspace](sample-vault/legacy-v2.thoughtspace) | [legacy-v2.md](sample-vault/legacy-v2.md) |

成对文件解码得到相同Board。不要把 `.md` 封装的 `version:1` 和里面Board的版本混淆；不要把布局区外正文复制成白板节点。普通Markdown样例特意使用UTF-8 BOM + CRLF，其余为LF。

每份包含 `aiExampleOpaque`，节点/边和手写集合/笔画也各有合法未知字段哨兵。Markdown还含 `custom_sentinel` YAML、布局前后正文标记、`aiEnvelopeOpaque`。这些字段用于检查保留边界，不应写进严格白名单的brain/history/viewport结构中。坐标、镜头、笔宽、压力均保留完整JSON数值精度，不取整。

[`EXAMPLES.json`](EXAMPLES.json)列出每份路径、包装/版本、稳定ID、完整预期Board、样本SHA、引用路径与SHA、opaque/YAML/body/envelope预期，以及原始字节SHA/BOM/换行。MD布局范围使用UTF-16文本索引，与实际读取器一致，不是UTF-8字节偏移。`normalizationChanges:[]`表示这些正式输入不依赖清洗才能合法，并非解析器没有其他规范化规则。

生成时的验证：10/10已通过当前实际 `parseBoard` / `readBoardDocument`、真实YAML解码及 `replaceBoardDocumentLayout` →重新读取；结构化引用文件在本自制根内核实。实际CLI加明确样例根校验为6份passed、4份format_only（退出2），10份格式均通过：ordinary-v3两份card.file checked、含内联链接的text条目not_checked；legacy-v2两份的子板能解析但自身含未继续检查的引用，子板条目仍not_checked。这不是格式失效，也不是引用全部已验；没有删掉内容来强求10份overall passed。远程目标、锚点/页码/时间戳、正文语义和opaque字段内引用也不由该检查证明。

原生资格与格式资格分别记录：这10份正式样例及3类真实CLI非空新板，已有本地beta.5实际插件打开→Session保存→新PID重开通过记录；本轮公共beta.2兼容检查通过实际生产解析器/布局替换往返，自动检查没有启动插件UI。清单中 `historicalNative` 明确标注这一基线，`qualification` 标注公共解析器资格；引用未检查状态仍保留。详见 [本期资格](../../qa/AI-BOARD-PHASE1.md)。手写展示需要公开beta.2，稳定1.3.35尚不支持。

演练和QA须复制完整样例库到新独立目录/profile，保持相对路径；仓库这些原始文件是冻结的比较基线，不在原件上操作。格式细节见 [格式契约](../../docs/AI-BOARD-FORMAT.zh-CN.md)，CLI流程见 [AI指南](../../docs/AI-BOARD-GUIDE.zh-CN.md)。
