# 媒体草稿、布局与白板引用的本地验收

开发目录为原始 `ec80f89` checkout 的独立副本；此记录最初在发布前完成。实际库未安装此构建。测试只写入相邻 `thoughtspace-qa-vault`，使用独立 Obsidian 配置。

## 行为

- 本机 IndexedDB 按库路径隔离暂存文字、PNG、来源 path/mtime/size、时间和固定 ID；350 ms 合并输入，关闭视图 flush。不会自动生成笔记。
- 重启在工作区布局稳定后显示持久通知，用户打开审核并选择恢复/丢弃；亦可用命令、来源顶栏或保存栏入口打开。来源变化只读；缺失来源仍可复制文字/保存图片。重复恢复不会生成新 ID。
- 正式保存前暂存锁定快照，笔记保存确认后清理；失败保留并可用原 ID 重试，避免清理失败导致重复摘录。
- 左边只有播放器；右上为当前草稿、右下为已保存摘录。默认编辑区占比 40%，布局菜单与可拖动/方向键分隔条调整高度；截图、捕捉、保存均在编辑区。窄窗只切可见性，播放器和编辑器不重建。
- 未处理暂存的提示已移入来源顶栏中间，紧邻“恢复 / 丢弃”入口；宽屏顶栏实测 45 px，320 px 窄窗在顶栏内换行，不再占用播放器下方的独立提示行。
- 手动送到白板时引用原 Markdown 的 `^thoughtspace-media-ID` 块，包含截图和可回播时间；不复制正文、不新增第二篇笔记。重复同一引用选中已有节点。原有无稳定块锚点的旧格式会提示打开原笔记，不静默复制。

## 自动回归与原生验证

测试依照 CONTRIBUTING：lint、全部 unit tests、build 内含 tsc、git diff --check。环境没有 Node 22 CLI，使用现有 Node 24.13.0；Obsidian 内置 Node 22.22.1。

原生脚本通过 CDP 连接实际官方 Obsidian 1.13.7，仅允许固定临时库路径：

- `media-draft-native.cjs`：实际文字输入/PNG 截图，关开视图，插件重载，重复恢复/丢弃，来源变化，实际笔记保存后注入暂存删除失败并重试；准备重启检查。
- `media-draft-restart.cjs`：在终止并重新启动隔离 Obsidian 进程后运行；检查持久通知、显式恢复、原笔记数不变、文字/PNG/来源/时间/ID，及窄窗按钮位置。
- `media-layout-native.cjs`：实际播放器、焦点/选择与草稿保持，宽屏深浅色、420/320/260px 窄窗，原生截图在 `dist/media-draft-native/`。

截图中的蓝色画面是合法的合成测试视频，不是加载失败或真实用户媒体。

## 设计参考

参考信息层级与交互，未复制代码或资产，未添加依赖：

- https://github.com/jemstelos/obsidian-media-notes
- https://github.com/aidenlx/media-extended/tree/v3
- https://github.com/RyotaUshio/obsidian-pdf-plus

## 限制

暂存仅本机，不同步，不是备份；移动库或清理 profile 不自动迁移。突然终止仍可能损失最后 350 ms 或正在进行的截图/写入；没有断电测试。未覆盖移动端、另一操作系统、第三方主题、配额耗尽或多个独立 Obsidian 进程同时打开相同库。在线视频独立工作区本轮未改。截图后的暂停是原有捕捉行为，布局验证在继续播放后进行。

两张用户圈注图 的受支持本机传输失败（第一张重试一次仍失败），开发端未查看其像素；留白调整依据父会话已核实的位置描述以及开发端当前原生截图，不能声称与圈图做过逐像素对照。


最新验证结果：原生重启恢复已比对 PNG 字节、正文、来源、时间、ID，均一致；源文修改后的白板块引用也通过原生更新验证。`reference.json` 包含六项联动检查。回源使用实际渲染 URL 调用本机协议处理器，没有发送系统 URL。Library 标准批量截图上传因本机认证不可用而失败，未生成 Library 附件 ID。

## 最终交付检查（2026-09-30）

- `npm test`：4457 / 4457 通过，失败、跳过均为 0。
- `npm run lint`：0 errors，118 个原有 warnings；`npm run build`（含 `tsc --noEmit`）通过；`git diff --check` 通过。
- 最终构建重新部署仅至临时库，`header-recovery-native.cjs` 三项及 `media-reference-native.cjs` 六项全部再次通过。工作副本与临时库 `main.js` SHA256 均为 `6a5ad256a4faa8e991543ab3928021715e15978b9b55c20ef411611bcf05f155`。
- 原生报告还包含草稿生命周期 11 项、完整进程重启 3 项、布局 7 项、拖动分隔条/短窗口 2 项、输入后立即重载 2 项。全过程仅使用隔离测试库。
- 最终截图在 `dist/media-draft-native/`：`header-recovery-wide.png`、`header-recovery-narrow.png`；视觉展示另有 `media-wide-light.png`、`media-wide-dark.png`、`media-narrow-320-dark.png`。`board-reference-dark.png` 实际为浅色白板截图，文件名不代表最终主题。截图均为实际运行版本的原生窗口截图。
- 原始 checkout 保持干净；本记录中的 4457 项是媒体阶段结果，1.3.25 合并白板调整后为 4458 项，见白板界面验收记录。
