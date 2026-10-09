# 1.3.34：单文件 Markdown 白板验证与恢复边界

本次发布增加单文件 Markdown 白板，并修复交接取消的旧路径回退、失败引用重放之后的连续来源更名，以及原生页关闭后仍保存时插件重载失去保护。旧格式继续使用，普通 Markdown 不被全局接管；完整格式和操作见[使用说明](../docs/markdown-boards.zh-CN.md)。此前 1.3.33 的六项脑图/搜索/标题/控件优化保留。

## 构建与可复现回归

原生验收的功能构建基于正式 1.3.33，最终 JavaScript SHA-256 为 `13ddc7858f9ef5d60a7e12999703ea76ae40255634aa27887d1c575db30b13e6`，CSS 为 `db91160037203209e1514813246a1bc2750e1802cb1c06e83c998abdbbd68887`。发行准备另更新 manifest/package/lockfile/versions 的版本、发布文档和安装 ZIP 文档清单，不更改已验收的生产逻辑。独立发行 checkout 的构建已核对 JavaScript/CSS 与这些字节完全一致；manifest 版本更新为 1.3.34，SHA-256 为 `fc1ec00f97507b6e9ecec37851ed8750efedc1ccb781a894b2cdb9f8026ef4ff`，其字节不能说成与旧候选相同。

使用 Node.js 22：

```sh
npm ci
npm run lint
npm test
python3 -m unittest discover -s scripts -p 'test_*.py'
npm run build
RELEASE_TAG=1.3.34 python3 scripts/check-release.py
python3 scripts/package.py
git diff --check
```

最终功能构建的全量 TS 回归为 **6653/6653**，fail/cancel/skip=0；TypeScript/esbuild 通过；官方 ESLint 为 **0 错误、118 条既有警告**；Python 发布检查 **7/7**。没有放宽 lint 规则。原生异常入口的额外 11 项脚本合同检查属于本地 QA，不计入上述 TS 全量，也未连同临时原生工具上传。

源码回归使用仓库相对路径和合成 App/Window/Vault，不依赖用户库。三项可靠性生产回归共有 7+2+14 项：

- [交接取消](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.34/tests/reliability-native-handoff.test.ts)：有效改名后的当前路径、删除、同路径对象替换、转为非 Markdown、排除目录与用户切换页面的边界。
- [连续引用日志](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.34/tests/reliability-reference-journal.test.ts)：首次 A→B 重放失败、原生占用消失之后的 B→C 继续按序持久排队，完成布局写入后才删除记录。
- [编辑器重载](https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/1.3.34/tests/reliability-editor-reload.test.ts)：实际 file/view 的 WeakRef、App 隔离、当前 TFile 身份、clean-live→关闭保存的启动窗口、saveAgain、未知描述符的保守保护及旧计时器/订阅释放。

其他新增回归覆盖 codec、Session、原生所有权、日志事务、路径/搜索路由与白板发现；已有调用路径的 mock 同步更新。生成的 `main.js` 不提交，临时 profile/vault、截图、原始正文报告、本机路径和依赖目录不进入仓库。

## 独立原生验收

Node 22.20.0、Obsidian 1.14.4；runtime asar 只读复制并核对 SHA-256 `146ef8470d8cbb4a6db209bdc19bf2bad13350444186c0fd93c31087b142b92f`。测试串行使用自制合成 vault、新 profile、OS 分配的 CDP 端口与已核验的自有进程，插件只在该实例内存加载。没有操作用户窗口、笔记或真实库设置。

| 分组 | 通过断言 | 范围 |
| --- | ---: | --- |
| 核心 | 108 | 创建、原生 Properties 类型、Search/Bases、取消、撤销重做、多视图保护、损坏修复、新旧另存与停用 |
| 引用 | 85 | 原生关闭后首存、真实 saveAgain 尾存、无白板 Session 的原生页和引用重放 |
| 并发 | 47 | 连续新输入、取消交接、来源/白板更名、交接时更名、一次实际 process 失败后的重试 |
| 双原生窗口 | 18 | 不同窗口的同文件草稿与实际保存顺序；普通 Markdown 对照在同一已加载候选应用内 |
| 外部写入 | 19 | 专用库本地 fs 写入区外/布局，与原生整篇晚存交错 |
| 重载与恢复重名 | 26 | 零 live native leaf 但旧保存仍挂起时重载；连续布局变化，保留原外部文件及已有恢复文件，另存唯一第三份恢复草稿 |
| 材料兼容 | 51 | 九类对象双向另存、取消、快速重复确认、重开、原生标题/块链接、来源字节和引用保持 |
| 正常完整 App 重开 | 38 | 已保存最新正文与 durable journal 后退出，新 PID/端口恢复并由真实命令返回白板重放 |
| 三组候选 SIGKILL | 18+18+16 | 保存完成、实际保存 gate 挂起、无 gate 自然窗口，记录实际恢复或丢失 |
| 三组未加载候选的 SIGKILL 对照 | 18+18+16 | 同一宿主/样本/检查方法，两代均不加载候选 |
| 固定预算交错性能 | 304 | 12 个 ABBA/ACCA/BCCB 区块，预算与提交字节检查 |

15 份报告共 **800 个通过断言**，包含隔离、身份、错误和性能预算，不等于 800 个业务功能。报告没有页面错误；已加载候选的构建哈希一致。测试后检查自有主 PID 与精确 profile 均无残留。截图用于检查实际原生控件和阶段，文件字节、身份、CAS、journal 与保存状态另行核对，未用截图替代磁盘证据。

原生属性类型选择及日期/日期时间控件验证来自核心 108 项；正常重开 38 项的 `qa_datetime` 是原生推断的 Text 行，验证值持久化，不将该样本说成实际日期时间 picker 验收。原生正文链接和 tags 使用宿主主题，插件控件使用插件强调色。

## 强制退出及并发限制

| SIGKILL 前状态 | 候选结果 | 完全未加载候选的宿主对照 |
| --- | --- | --- |
| 真实输入与 Meta+S，native/CM/disk 都等于最新版本，saving/saveAgain=false | 已保存最新属性、正文与布局恢复；本次输入至信号 227 ms | 同结果；207 ms |
| QA gate 仅暂停目标实际 Vault.modify，native/CM/真实待保存 payload=latest，disk=baseline、saving=true | 未保存最新输入丢失，基线保留；218 ms | 同结果；197 ms |
| 无 gate、无显式 save、无杀前截图或等待，真实输入后立即核验并发信号 | 捕获未落盘自然窗口，最新输入丢失、基线保留；16 ms | 同结果；14 ms |

信号只发给已核验 child/generation/profile/vault/Electron Browser PID 的自有主进程，退出信号明确。退出后、新 App 启动前独立读磁盘；新进程 layoutReady 后、候选注入前观察 native/disk，再看注入后的状态。读回到信号仍存在短 TOCTOU 窗口，不宣称原子取样、物理 fsync 或断电完整性；这些是单次观测，不推算保存周期、丢失概率或恢复成功率。

六组实际 File recovery UI 都只找到 baseline 快照，读取快照 textarea 全文和哈希确认不含最新 token；没有强制生成快照、调整周期、复制或点击恢复。**不能把已有快照说成最新未保存输入可以恢复。** 已保存正常重开与已保存强杀的成功不证明未保存强杀恢复。

两个原生编辑器各持整篇不同草稿，普通 Markdown 对照也出现后写覆盖先写。外部字节可能被原生整篇晚存覆盖。本插件拒绝双 owner 交接并保护运行中的原生保存，不能合并宿主两份全文。

弱引用桥仅保持候选此前观察过的 actual file/view，在同一 App、稳定 workspace owner Window 与同一运行时内跨模块重载；不存路径、正文、布局、监听器或计时器，不提供跨进程持久草稿。完全停用期间从未观察的新 writer、Window 迁移与全部宿主版本不在此次保证中。未知 saving/saveAgain 标志继续保守保护，可能维持仅查看；不会调用 getter 或猜测保存已经结束。

布局冲突时，原文件的外部版本保留，恢复草稿包含本地布局和此前有效文档，不自动合并全部外部最新属性/正文。材料兼容样本仅挂载两卡片，离屏图片/PDF/音视频验证引用、格式与字节，没有播放解码。没有真实 Obsidian Sync 账号或网络验收，也未覆盖全部主题、第三方插件、长期运行或低端硬件。窄卡片之间的水平关系标签仍可能局部受遮挡，不宣称通用标签避障。

## 同样本性能

A=正式 1.3.33 JSON（main.js `0ca390d8e0f7c57c8976fe8b2f04a69a796d2c20ec71a4b4a05ee87223eacf73`），B=最终候选 JSON，C=同一最终构建 Markdown。固定 **1000 总节点、6 实际挂载、5 渲染边、994 离屏**，world DOM 239、stage 1396×790。Board fixture SHA-256 `d067ea5e70ead72e475eeca9cd9a940b7857712460ce5b2f22d8e37c62715462`，JSON/Markdown 源字节 311879/336427。

12 块按 ABBA、ACCA、BCCB 交错，每组打开20、保存32、真实拖动12，每次48 moves；session 释放后重新公开打开，没有清除 OS 缓存。下表为 ms，p50 / p95 / max。

| 阶段 | A 正式 JSON | B 候选 JSON | C 候选 Markdown |
| --- | ---: | ---: | ---: |
| 公开打开返回 | 66.5 / 75.5 / 76.3 | 67.5 / 76.0 / 76.3 | 71.4 / 80.5 / 81.7 |
| change+flush 返回 | 21.8 / 25.2 / 29.3 | 21.2 / 23.5 / 27.7 | 24.5 / 28.4 / 31.2 |
| apply 同步 | 1.1 / 1.4 / 1.6 | 1.1 / 1.4 / 1.6 | 1.1 / 1.4 / 1.7 |
| 输入至第二 RAF | 8.4 / 10.2 / 13.0 | 8.4 / 10.3 / 12.7 | 8.4 / 10.2 / 14.3 |

打开/保存动作含宿主流程及协议往返，不等于纯读写时间。每次打开的目标 read 数分别 1/3/4，不能把混合多次读取的中位数说成同阶段加速。Markdown 全 read 尾部 p95 34.6 ms/max36.3 ms；其中有 Session ready 后读取，也有 Session 区间内读取，未用调用栈归因成解析或物理读盘。

保存包括真实 Vault.process Promise 与独立磁盘读回；直接 adapter.write hook 没有可计时调用是观测缺口，不是 I/O 0 ms。192 个测量阶段支持 longtask 观测且无记录，不表示总主线程成本为零。192 份 CPU profile、CDP 堆/DOM 与 RAF/input 数据供本地复核；未强制 GC，瞬时正负堆变化不能证明 retained leak 或无泄漏。一次小样本交错不能建立普遍统计结论。Markdown 仍有额外校验和提交成本，**没有通用提速结论**。

## 发布范围

正式附件由仓库标准 Release workflow 从该版本提交运行 lint/tests/build、版本检查、打包和 GitHub 构建证明；发布后验证公开安装端点的三个运行文件。workflow 还上传安装 ZIP 与 SHA256SUMS，因此保留这两个标准辅助附件，不删除旧 Release 附件。Obsidian 自动安装使用 `main.js`、`manifest.json`、`styles.css` 三个运行文件；源码上传和 Release 不会自动安装到任何用户库。
