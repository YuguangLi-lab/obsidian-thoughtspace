# Editorial UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 ThoughtSpace 全部插件界面打磨到已批准的编辑气质规范：浅色默认暖白纸 `#f8f5ef`、统一变量与组件、插件内样板页，以及各主界面的布局与克制动效，并对照样板页反复自查直到达标。

**Architecture:** 不要另起一套变量。在现有的 `src/interface-style-tokens.ts`、`src/ui-tokens.ts` 和 `src/interface-palettes.ts` 上扩展「基础数值 → 用途变量 → 组件样式」。运行时由 `interfaceStyleRules()` 注入 `--ts-e-*`，作用域仍限制在已有插件根上，并保持日历隔离。静态样式继续写在对应的 `src/*.css`，经 `esbuild.mjs` 嵌入 `styles.css`。画布纸面预设已是 `#f8f5ef`（`paperPresets.cream`）；当前偏黄的是默认 `paper` 界面色板（浅色 sheet `#fffdf8`、paper `#f6f4ee`）以及默认卡片/描边，必须改到与规范一致。若已有进行中的去黄分支，从该分支继续，不要重复做第一项，也不要改已合并的 PR #13。

**Tech Stack:** TypeScript、Obsidian 插件 API、`tsx --test tests/*.test.ts`（`node:test` + `node:assert/strict` + PostCSS）、`npm run build`（`esbuild.mjs` 打包 `main.js` 并把 `src/*.css` 写入 `styles.css`）。

## Global Constraints

- 规范原文：`docs/superpowers/specs/2026-11-11-editorial-ui-design.md`。换布局、改组件、做验收都以它为准。
- 浅色页面底锁定为 `#f8f5ef`；通用背景和描边排除黄、金色倾向（含旧黄 `#f3e9d4` 及同类奶油色、金色默认边）。
- 暖白纸只作为浅色主题默认底；深色使用低饱和中性深灰层次；用户已指定的卡片色、内容背景和画布纸面预设（纯白、象牙、牛皮等）保留。
- 默认界面色板 `paper` 必须改到新的暖白体系；用户显式选择的其他界面色板（`neutral`、`nord`、`catppuccin`、`tokyo`、`ayu`）保留，但其默认值不得带回黄色 chrome。
- 选中用轮廓、勾选或局部标记，不覆盖卡片原色；选中与成功/正确必须是不同表达；对错同时提供文字或图标。
- 普通文字对比度 ≥ 4.5∶1；识别控件和状态所必需的线索 ≥ 3∶1。辅助文字不得套用禁用态淡色。
- 字体继承 Obsidian（继续用 `var(--font-interface)` / 宿主字号），不另引花哨字体；字号用相对单位，支持用户缩放。
- 圆角只使用 4、8、12。动效约 200ms、ease-in-out、无回弹，并尊重 `prefers-reduced-motion`。
- 纸纹继续以内联 PNG data URI 放在 `styles.css` / 其源 CSS 中，只作用于背景层，深色减弱，不得拆成单独文件。
- 样式限定在既有插件根（`.ts-root`、`.ts-writing`、`.ts-ui-modal` 等）内，并保持 `:not(:where(.ts-calendar-plugin,.ts-calendar-plugin *))` 隔离。
- 不改现有功能：入口可达、参数保留、快捷键不变、选择状态不丢、导出逻辑不变。
- 不提供托管分享、插件内模型、独立绘图层或手机应用；不破坏白板格式 v3；不提高最低 Obsidian 版本 1.13.7。
- 在用户明确批准之前，不升版本、不合并、不打标签、不发布。
- 新增的 `src/*.css` 必须在 `esbuild.mjs` 的嵌入名单中注册，然后运行 `npm run build`，保证发布用的 `styles.css` 含有这些规则。
- 测试命令：`npx tsx --test tests/<file>.test.ts`；全量：`npm test`。构建：`npm run build`。

---

## File Structure

- Modify: `src/interface-style-tokens.ts` — 浅色/深色基础色板、页面/面板/浮层、三档墨色、装饰/操作描边、字体角色、间距、圆角、动效和纸纹强度变量；继续由 `interfaceStyleRules()` 输出。
- Modify: `src/interface-palettes.ts` — 默认 `paper` 色板与 token 层对齐；更新中文描述「原来的纸张配色」为暖白纸。
- Modify: `src/ui-tokens.ts` — 继续把规则注入到每个宿主 document；如需登记新的根 class（样板页），加到注入名单。
- Modify: `src/visual-system.css`、`src/editorial-dialogs.css` — 共用按钮、输入框、列表项、卡片、弹窗的状态样式。
- Create: `src/component-gallery-view.ts`、`src/component-gallery.css`、`tests/component-gallery-view.test.ts` — 命令打开的组件样板页。
- Modify: `esbuild.mjs` — 注册新 CSS。
- Modify: `src/tool-palette.ts`、`tests/tool-palette.test.ts`，以及工具面板实际所在的 CSS（先在 `src/board-polish.css`、`src/visual-system.css`、`src/rail-tool-search.ts` 中定位）。
- Modify: `src/layout-planner.ts`、`src/layout-planner-view.ts`、`src/layout-planner.css`、`tests/layout-planner.test.ts` — 整理白板。
- Modify: `src/writing-view.ts`、`src/writing-chrome.ts`、`src/workflow.css`、`tests/writing-chrome.test.ts`、`tests/writing-short-pane-css.test.ts` — 写作预览。
- Modify: `src/card-library-view.ts`、`src/card-property-views.ts`、`src/card-styles.css`、`src/card-surfaces.css`、对应测试 — 卡片库与默认卡片表面。
- Modify: `src/board-chrome.ts`、`src/interaction-chrome.css`、`src/canvas-dock.css`、`src/board-polish.css`、`tests/board-chrome.test.ts` — 白板控件层级。
- Modify: `src/settings-view.ts`、`src/settings.css`、导出相关 modal/CSS（`src/board-export.ts` 只改 chrome，不改导出逻辑）、对应测试。
- Modify: `tests/interface-style-tokens.test.ts`、`tests/interface-style-documents.test.ts`、`tests/calendar-style-boundary.test.ts`（应保持通过；若选择器变化则按隔离规则更新）。
- Modify: `docs/INTERFACE-PALETTES.zh-CN.md` — 仅当其中仍把默认 paper 写成旧奶油色时，改成与规范一致。
- 不修改：`src/paper-appearance.ts` 中用户可选的画布预设（`white` / `ivory` / `kraft` / `recycled` / `custom`）；`cream` 已是 `#f8f5ef`。不把纸纹拆出 `styles.css`。

---

### Task 1: 默认 paper 色板改到暖白，清掉黄色默认 chrome

**Files:**
- Modify: `src/interface-style-tokens.ts`
- Modify: `src/interface-palettes.ts`
- Modify: `tests/interface-style-tokens.test.ts`
- Modify: `docs/INTERFACE-PALETTES.zh-CN.md`（若文档仍写旧色值）
- Test: `tests/interface-style-tokens.test.ts`
- 同步检查：`src/card-styles.css`、`src/card-surfaces.css`、`src/card-style.ts` 中未指定颜色的默认卡片填充和金色默认边。用户选过的 `sand` 等色板作为可选色保留，但不得再当「未着色」默认值。

**Interfaces:**
- Consumes: 现有 `interfaceStyleRules(_style, _glassEffects, selected, mode, _surface, accent)`、`paperPalette()`、`interfacePalettes.paper`
- Produces: 浅色 `--ts-e-paper` 为 `#f8f5ef`；`--ts-e-sheet` 与 `--ts-e-wash` 与页面同色相、仅以明度区分，不得偏向 `#f3e9d4`；深色继续用现有低饱和深灰阶，除非对比度不足。`interfacePalettes.paper.light` 与 token 层一致。

- [ ] **Step 1: 先改会锁死旧色板的测试**

把 `tests/interface-style-tokens.test.ts` 里「paper preserves all twelve historical light and dark steps」改成断言新的浅色页面底，并增加「不得出现旧黄/旧奶油默认值」和对比度检查。保留日历隔离、选择器作用域、以及 `paper retains AA text contrast` 这些测试。示例：

```ts
test('light paper page surface is locked warm white and not legacy cream', () => {
  const values = palette('paper', false);
  assert.equal(values['--ts-e-paper'], '#f8f5ef');
  for (const banned of ['#f3e9d4', '#fffdf8', '#f6f4ee', '#eeece4']) {
    assert.notEqual(values['--ts-e-paper'], banned);
    assert.notEqual(values['--ts-e-sheet'], banned);
    assert.notEqual(values['--ts-e-wash'], banned);
  }
  for (const text of ['ink', 'muted', 'editorial']) {
    for (const surface of ['sheet', 'paper', 'wash']) {
      const ratio = contrast(values[`--ts-e-${text}`], values[`--ts-e-${surface}`]);
      assert.ok(ratio >= 4.5, `${text}/${surface}: ${ratio.toFixed(2)}`);
    }
  }
});
```

深色断言继续使用现有已通过 4.5∶1 的中性深灰阶（`#20211e` / `#252620` / `#2c2d27` 这一套），不要无故换成偏黄暖棕。

- [ ] **Step 2: 运行测试，确认旧色板失败**

Run: `npx tsx --test tests/interface-style-tokens.test.ts`

Expected: FAIL，因为当前 `paperLight` 仍是 `#fffdf8` / `#f6f4ee` / `#eeece4`。

- [ ] **Step 3: 实现最小色板改动**

在 `src/interface-style-tokens.ts` 把 `paperLight` 重写成以 `#f8f5ef` 为页面底的暖白阶，sheet / wash / line 只做同色相的轻微明度分级。同步修改 `src/interface-palettes.ts` 中 `paper.light` 的 `sheet` / `paper` / `line` / `wash`，并把名称描述从「原来的纸张配色」改为明确的暖白纸（可继续叫「暖白纸张」）。不要改其他 palette id 的色值。

扫描默认卡片表面：未指定颜色的预览卡和新建卡使用 `var(--ts-e-paper)` 与装饰描边 `var(--ts-e-line)`，不要用 `sand` / 金色边当默认。`headingTones.sand` 仅在用户选择 sand 时使用。

- [ ] **Step 4: 再跑 token 测试并抽查默认卡片**

Run: `npx tsx --test tests/interface-style-tokens.test.ts tests/card-style.test.ts tests/card-style-color.test.ts tests/calendar-style-boundary.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/interface-style-tokens.ts src/interface-palettes.ts src/card-styles.css src/card-surfaces.css src/card-style.ts tests/interface-style-tokens.test.ts docs/INTERFACE-PALETTES.zh-CN.md
git commit -m "feat(ui): retarget default paper chrome to warm white #f8f5ef"
```

---

### Task 2: 补全用途变量——表面层次、字号间距、操作描边、动效与纸纹限度

**Files:**
- Modify: `src/interface-style-tokens.ts`
- Modify: `src/ui-tokens.ts`（若要在注入的 shared 块中暴露新变量别名）
- Modify: 纸纹所在的 CSS（先定位 inlined `data:image/png` 或等价纸纹规则；通常在 `styles.css` 的源文件中，可能是 `src/board-polish.css` 或表面样式）。纸纹只挂在背景层，深色用更低的强度（例如降低 opacity），禁止在面板上再叠一层。
- Test: `tests/interface-style-tokens.test.ts`

**Interfaces:**
- Consumes: Task 1 的暖白色板与现有 `--ts-e-paper|sheet|ink|muted|line|wash|edge|shadow|radius`
- Produces: 下列用途变量（名称固定，后续任务只引用它们）：

```ts
// 表面
--ts-e-paper        // 页面底；浅色锁定 #f8f5ef
--ts-e-sheet        // 面板底
--ts-e-overlay      // 浮层底（比面板再亮半级，配合发丝边与 --ts-e-shadow）
--ts-e-wash         // 轻悬停/浅洗
// 墨色
--ts-e-ink          // 标题
--ts-e-body         // 正文；浅于标题、深于辅助，且对比度 ≥ 4.5∶1
--ts-e-muted        // 辅助信息；不得等于禁用态；对比度 ≥ 4.5∶1
// 描边
--ts-e-line         // 装饰描边，可以很淡
--ts-e-control-line // 输入框边界、可点击轮廓；对所在表面对比度 ≥ 3∶1
--ts-e-focus        // 键盘焦点环，≥ 3∶1，且不得与选中、成功同形
--ts-e-selected     // 选中轮廓/标记色，不覆盖卡片填色
--ts-e-danger       // 已有，保留
--ts-e-success      // 成功/正确；必须与 --ts-e-selected 不同
// 字体（相对宿主正文字号）
--ts-e-serif: var(--font-interface);
--ts-e-title-size: 1.25em; --ts-e-title-weight: 600; --ts-e-title-leading: 1.3;
--ts-e-body-size: 1em;     --ts-e-body-weight: 400; --ts-e-body-leading: 1.55;
--ts-e-meta-size: 0.8125em;--ts-e-meta-weight: 400; --ts-e-meta-leading: 1.4;
// 间距（默认像素，实现用相对单位）
--ts-e-space-icon: 6px;      // 图标与文字，4–8
--ts-e-space-control: 10px;  // 控件之间，8–12
--ts-e-space-panel: 16px;    // 面板内距
--ts-e-space-section: 28px;  // 区块之间，24–32
// 圆角（只准这三档）
--ts-e-radius-sm: 4px;  // 小控件与输入框；替换现有 5px 的 --ts-e-control-radius
--ts-e-radius: 8px;     // 按钮与卡片
--ts-e-radius-lg: 12px; // 大型面板或弹窗
// 动效
--ts-e-motion: 200ms;
--ts-e-ease: ease-in-out;
--ts-e-grain-opacity: 浅色默认值与深色更低值
```

同时输出：

```css
@media (prefers-reduced-motion: reduce) {
  /* 在 allRoots 作用域内 */
  --ts-e-motion: 0ms;
}
```

非必要运动在后续组件和界面中都使用 `transition: ... var(--ts-e-motion) var(--ts-e-ease)`，不要写回弹曲线。

- [ ] **Step 1: 写失败测试，锁住新变量、对比度和圆角档位**

在 `tests/interface-style-tokens.test.ts` 增加（沿用文件里已有的 `palette()` 和 `contrast()`）：

```ts
test('purpose tokens expose page, panel, overlay, body ink, control line and motion', () => {
  for (const dark of [false, true]) {
    const values = palette('paper', dark);
    for (const key of [
      '--ts-e-paper', '--ts-e-sheet', '--ts-e-overlay', '--ts-e-body',
      '--ts-e-control-line', '--ts-e-focus', '--ts-e-selected', '--ts-e-success',
      '--ts-e-title-size', '--ts-e-body-size', '--ts-e-meta-size',
      '--ts-e-space-icon', '--ts-e-space-control', '--ts-e-space-panel', '--ts-e-space-section',
      '--ts-e-radius-sm', '--ts-e-radius', '--ts-e-radius-lg',
      '--ts-e-motion', '--ts-e-ease', '--ts-e-grain-opacity',
    ]) assert.ok(values[key], `${dark ? 'dark' : 'light'} missing ${key}`);
    assert.equal(values['--ts-e-radius-sm'], '4px');
    assert.equal(values['--ts-e-radius'], '8px');
    assert.equal(values['--ts-e-radius-lg'], '12px');
    assert.equal(values['--ts-e-motion'], '200ms');
    assert.equal(values['--ts-e-ease'], 'ease-in-out');
    if (!dark) assert.equal(values['--ts-e-paper'], '#f8f5ef');
    assert.notEqual(values['--ts-e-selected'], values['--ts-e-success']);
    for (const text of ['ink', 'body', 'muted']) {
      for (const surface of ['paper', 'sheet', 'overlay']) {
        assert.ok(
          contrast(values[`--ts-e-${text}`], values[`--ts-e-${surface}`]) >= 4.5,
          `${text}/${surface}`,
        );
      }
    }
    for (const line of ['control-line', 'focus', 'selected']) {
      assert.ok(contrast(values[`--ts-e-${line}`], values['--ts-e-sheet']) >= 3, line);
    }
  }
});

test('reduced-motion zeroes the duration token inside plugin roots', () => {
  const css = interfaceStyleRules('paper', false);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /--ts-e-motion:\s*0ms/);
});
```

现有测试里 `--text-faint:var(--ts-e-muted)` 若仍把辅助文字映射到过淡的 faint，改为正文/辅助使用 `--ts-e-body` / `--ts-e-muted`，禁用态另用独立变量，不要把 muted 降到低于 4.5∶1。

- [ ] **Step 2: 运行测试，确认新变量尚不存在**

Run: `npx tsx --test tests/interface-style-tokens.test.ts`

Expected: FAIL，缺 `--ts-e-overlay`、`--ts-e-body` 等。

- [ ] **Step 3: 在 `paletteRules()` / `shared` / `paint()` 中写入这些变量**

把 `--ts-e-control-radius:5px` 改为 `var(--ts-e-radius-sm)`（4px）。浅色具体色值按对比度规则计算后写入，不得把黄或金色写进默认表面和装饰边。深色 `--ts-e-overlay` 取比 `--ts-e-sheet` 更高一档的现有深灰。纸纹规则加上「只在背景层」和深色降低 `--ts-e-grain-opacity`。主题继续跟随 `cleanInterfaceMode`（`auto` 时用 `.theme-dark`）。

- [ ] **Step 4: 运行测试**

Run: `npx tsx --test tests/interface-style-tokens.test.ts tests/calendar-style-boundary.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/interface-style-tokens.ts src/ui-tokens.ts tests/interface-style-tokens.test.ts
# 以及实际改过的纸纹 CSS 源文件
git commit -m "feat(ui): add purpose tokens for type, space, motion, and surfaces"
```

---

### Task 3: 共用组件状态规范

**Files:**
- Modify: `src/visual-system.css`
- Modify: `src/editorial-dialogs.css`
- Create: `tests/editorial-components-css.test.ts`
- 若按钮/输入的 class 定义在其他 CSS 中（先搜索 `.ts-button`、`.ts-input`、`.ts-ui-modal`），在原文件改，不要复制一份。

**Interfaces:**
- Consumes: Task 2 的全部 `--ts-e-*` 用途变量
- Produces: 统一状态规则，组件只引用用途变量：

| 组件 | 主要 class（若仓库已有则沿用，不要改名） | 必做状态 |
| --- | --- | --- |
| 按钮 | `.ts-button`（主按钮继续 `.mod-cta` / `.ts-primary`） | 悬停、按下、键盘焦点、禁用 |
| 输入框 | 插件内 input/textarea、搜索框 | 边界用 `--ts-e-control-line`，焦点用 `--ts-e-focus`，错误用 `--ts-e-danger` 且错误文案靠近字段 |
| 列表项 | 工具项、材料项、库列表行 | 悬停 `--ts-e-wash`，选中为轮廓或局部标记 |
| 卡片 | 默认表面 `--ts-e-paper` + `--ts-e-line`；选中不覆盖填色 | 选中、禁用 |
| 弹窗 | `.ts-ui-modal` 等已有根 | 浮层底 `--ts-e-overlay`、`--ts-e-shadow`、圆角 `--ts-e-radius-lg`、内距 `--ts-e-space-panel` |
| 空/加载 | 共用简短说明 + 下一步入口；加载保留必要结构 | |

圆角：输入框/小控件 `--ts-e-radius-sm`，按钮/卡片 `--ts-e-radius`，弹窗 `--ts-e-radius-lg`。过渡一律 `var(--ts-e-motion) var(--ts-e-ease)`。

- [ ] **Step 1: 写 CSS 契约测试**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss, { type Rule } from 'postcss';

function parse(...files: string[]) {
  return postcss.parse(files.map(f => readFileSync(f, 'utf8')).join('\n'));
}

test('buttons, fields, and modals use purpose tokens and 4/8/12 radii', () => {
  const css = parse('src/visual-system.css', 'src/editorial-dialogs.css');
  const text = css.toString();
  assert.match(text, /var\(--ts-e-motion\)/);
  assert.match(text, /var\(--ts-e-focus\)/);
  assert.match(text, /var\(--ts-e-control-line\)/);
  assert.match(text, /var\(--ts-e-radius-sm\)/);
  assert.doesNotMatch(text, /border-radius:\s*5px/);
  assert.doesNotMatch(text, /#f3e9d4|#fffdf8|#f6f4ee|#eeece4/);
});
```

- [ ] **Step 2: 运行测试，确认尚未满足**

Run: `npx tsx --test tests/editorial-components-css.test.ts`

Expected: FAIL

- [ ] **Step 3: 把状态规则写入现有组件选择器**

只改插件作用域内的选择器。不要给 `.menu`、`.cm-editor`、卡片内容层或日历插件写无隔离规则。错误信息放在对应字段旁，并带文字或图标 class，不只靠颜色。

- [ ] **Step 4: 运行测试**

Run: `npx tsx --test tests/editorial-components-css.test.ts tests/interface-style-tokens.test.ts tests/calendar-style-boundary.test.ts`

Expected: PASS

- [ ] **Step 5: 如改了 src CSS，运行 `npm run build` 更新 `styles.css`，然后 Commit**

```bash
git add src/visual-system.css src/editorial-dialogs.css tests/editorial-components-css.test.ts styles.css esbuild.mjs
git commit -m "feat(ui): share editorial states for buttons, fields, and dialogs"
```

---

### Task 4: 插件内组件样板页

**Files:**
- Create: `src/component-gallery-view.ts`
- Create: `src/component-gallery.css`
- Create: `tests/component-gallery-view.test.ts`
- Modify: `esbuild.mjs`（把 `component-gallery` 加入 CSS 嵌入名单）
- Modify: 现有命令登记处（搜索 `this.addCommand`；若集中在 `src/main.ts` 则只在同类命令旁添加，不要大拆 `main.ts`）
- Modify: `src/ui-tokens.ts` 的 roots 名单，加入样板页根 class，例如 `.ts-component-gallery`

**Interfaces:**
- Consumes: Task 3 的组件 class 与 Task 2 的变量
- Produces:

```ts
export const COMPONENT_GALLERY_VIEW_TYPE = 'thoughtspace-component-gallery';
export const COMPONENT_GALLERY_COMMAND_ID = 'thoughtspace-open-component-gallery';
// 命令显示名：打开组件样板页
export class ComponentGalleryView /* 沿用仓库现有 ItemView 子类模式 */ {
  // 根节点 class: ts-component-gallery
  // 必须包含：三档文字、既定配色卡片（选中标记与卡片色并存）、
  // 按钮、输入框、列表（悬停/焦点/禁用/错误/空/加载）、
  // 浅色/深色切换（跟随或模拟 Obsidian .theme-dark）、窄/宽容器切换。
}
```

命令打开该视图，不出现在日常白板工具、写作工具条或设置首页。

- [ ] **Step 1: 写视图与命令的失败测试**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENT_GALLERY_COMMAND_ID, COMPONENT_GALLERY_VIEW_TYPE, ComponentGalleryView } from '../src/component-gallery-view';

test('gallery command id is stable and not a daily-entry tool id', () => {
  assert.equal(COMPONENT_GALLERY_COMMAND_ID, 'thoughtspace-open-component-gallery');
  assert.equal(COMPONENT_GALLERY_VIEW_TYPE, 'thoughtspace-component-gallery');
  assert.notEqual(COMPONENT_GALLERY_COMMAND_ID, 'open-tool-palette');
});
```

再补一个 DOM 装配测试（按仓库现有 view 测试的 stub 方式，例如 `tests/settings-view.ts` / `tests/writing-chrome.test.ts` 的模式）：渲染后查询 `.ts-type-title`、`.ts-type-body`、`.ts-type-meta`、带选中标记的色卡、按钮、输入、列表、主题切换和窄宽切换控件都存在。

- [ ] **Step 2: 运行测试，确认模块尚不存在**

Run: `npx tsx --test tests/component-gallery-view.test.ts`

Expected: FAIL（模块无法导入）

- [ ] **Step 3: 实现样板页、CSS、命令登记，并加入 `esbuild.mjs`**

样式全部引用 `--ts-e-*`。窄容器切换应改变样板页自己的容器宽度，而不是整个 OS 窗口，以便验收侧栏/分屏。

- [ ] **Step 4: 运行测试并构建**

Run: `npx tsx --test tests/component-gallery-view.test.ts tests/interface-style-tokens.test.ts && npm run build`

Expected: PASS，且 `styles.css` 含 `component-gallery` 生成块。

- [ ] **Step 5: Commit**

```bash
git add src/component-gallery-view.ts src/component-gallery.css tests/component-gallery-view.test.ts esbuild.mjs styles.css src/ui-tokens.ts src/main.ts
git commit -m "feat(ui): add command-opened component gallery for editorial QA"
```

---

### Task 5: 工具面板布局

**Files:**
- Modify: `src/tool-palette.ts`、`tests/tool-palette.test.ts`
- Modify: 工具面板所在 CSS（定位 `.ts-` 工具搜索/分类/列表的实际文件后修改）
- Test: `tests/tool-palette.test.ts` 与新增或扩展的 CSS 测试

**Interfaces:**
- Consumes: Task 2–3 的变量与组件状态
- Produces: 搜索框、分类标题、列表正文共用左对齐线；组内用 `--ts-e-space-control`，组间用 `--ts-e-space-section`；分类标题用 `--ts-e-title-weight` 和间距区分，不用浓重色块；长列表滚动时搜索入口保持可达（搜索区域不进入滚动容器，或 sticky）；工具项长标题可截断，悬停和键盘焦点下能读到完整名称。不改工具的执行逻辑和快捷键。

- [ ] **Step 1: 写失败测试**

在 `tests/tool-palette.test.ts` 增加：滚动长列表后搜索输入仍存在且不在滚动容器内；截断项具有完整名称（`title` 或等价可访问名）。再在 CSS 测试中断言搜索/分类/列表共享相同 `padding-inline-start` 或共同的对齐变量。

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx tsx --test tests/tool-palette.test.ts`

Expected: FAIL（或新断言失败）

- [ ] **Step 3: 调整 DOM 结构与 CSS**

把滚动范围明确到列表区域。次要分类可以收纳，但入口保留，已生效筛选用摘要或数量提示，折叠后参数不重置。

- [ ] **Step 4: 运行测试并 `npm run build`（若改了 CSS）**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): align tool palette search, groups, and sticky search"
```

---

### Task 6: 整理白板布局

**Files:**
- Modify: `src/layout-planner.ts`、`src/layout-planner-view.ts`、`src/layout-planner.css`
- Test: `tests/layout-planner.test.ts`（及如有的 view CSS 测试）

**Interfaces:**
- Consumes: Task 2–3；默认未着色预览卡来自 Task 1
- Produces: 左栏按控件测定后写入最小/最大宽度变量，右栏占剩余空间并优先保证预览；窄容器先折叠高级参数，再改为上下布局；标签、说明、输入顺序稳定；折叠后参数不重置，已生效选项有摘要或数量提示；预览默认卡使用 `--ts-e-paper` 与 `--ts-e-line`。明确左栏与预览各自的滚动区域，避免整页多层滚动。

- [ ] **Step 1: 写失败测试**

断言：存在 min/max 宽度变量或对应 CSS；窄容器下高级参数可折叠且值保留；预览默认卡背景不是 `#f3e9d4` / `#fffdf8` / `#f6f4ee`。

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx tsx --test tests/layout-planner.test.ts`

- [ ] **Step 3: 实现栏宽、窄布局收纳和默认预览表面**

- [ ] **Step 4: 运行测试并构建**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): refine organize-board columns, density, and default cards"
```

---

### Task 7: 写作预览布局

**Files:**
- Modify: `src/writing-view.ts`、`src/writing-chrome.ts`、`src/workflow.css`
- Test: `tests/writing-chrome.test.ts`、`tests/writing-short-pane-css.test.ts`（现有短面板规则必须继续通过）

**Interfaces:**
- Consumes: Task 2–3
- Produces: 正文居中，阅读宽度上限 `40rem`（按宿主正文字号，约 60–70 字）；窗口变宽时增加两侧留白；工具条保留高频操作；材料库可收起，列表用分隔线和组间留白，不用阴影堆叠；打开工具或材料时尽量保持正文滚动位置；文章标题自然换行，不得单行省略号。已有 `data-writing-short` 短面板行为不得回退。

- [ ] **Step 1: 写失败测试**

在 CSS 测试中断言写作正文/标题容器有 `max-width: 40rem` 且水平居中；文章标题 `white-space` 不是 `nowrap`。在 `tests/writing-chrome.test.ts` 增加：打开材料库后阅读滚动位置保持（按现有滚动测试的 stub 方式）。继续运行 `tests/writing-short-pane-css.test.ts`。

- [ ] **Step 2: 运行测试，确认新断言失败且短面板测试仍通过**

Run: `npx tsx --test tests/writing-chrome.test.ts tests/writing-short-pane-css.test.ts`

- [ ] **Step 3: 调整写作布局 CSS/结构**

材料列表使用 `--ts-e-line` 分隔和 `--ts-e-space-section` 组距。

- [ ] **Step 4: 运行测试并构建**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): give writing preview a centered 40rem measure"
```

---

### Task 8: 卡片库布局与状态

**Files:**
- Modify: `src/card-library-view.ts`、`src/card-library-modal.ts`、`src/card-property-views.ts`
- Modify: 库视图所在 CSS（先定位，可能在 `src/collection-view.css` 或 `src/card-styles.css`）
- Test: `tests/card-library-view.test.ts`、`tests/card-property-views.test.ts`

**Interfaces:**
- Consumes: Task 2–3，以及既有搜索/筛选/选择状态
- Produces: 列表、表格、看板共用文字角色、状态标记和操作命名；密度可随视图调整（复用现有 `workspace-density` 若已适用）；切换视图时保留搜索、筛选与选择；选中标记与卡片固有色并存；表格单元格长标题可截断，但悬停和键盘焦点能读到全文。

- [ ] **Step 1: 写失败测试**

在 `tests/card-library-view.test.ts` 增加：切换 list/table/kanban 后搜索词、筛选和选中 id 仍在；选中行/卡没有把 `background` 改成覆盖固有色的实心色（用轮廓或标记 class）。

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx tsx --test tests/card-library-view.test.ts tests/card-property-views.test.ts`

- [ ] **Step 3: 统一三种视图的状态表达，并保住视图切换时的查询状态**

- [ ] **Step 4: 运行测试并构建**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): keep library filters and selection across views"
```

---

### Task 9: 白板控件层级

**Files:**
- Modify: `src/board-chrome.ts`、`src/interaction-chrome.css`、`src/canvas-dock.css`、`src/board-polish.css`（按实际选择器取舍）
- Test: `tests/board-chrome.test.ts`、`tests/board-chrome-obstacle.test.ts`

**Interfaces:**
- Consumes: Task 2–3
- Produces: 缩放、选区、悬浮工具形成固定控件层级，避免挡住当前编辑内容（现有 obstacle 测试应继续有效并补强）；画布内容可自由缩放，工具按钮保持稳定可点尺寸；功能轮廓用 `--ts-e-control-line`，装饰边用 `--ts-e-line`；浅色默认画布为暖白纸面，深色用对应页面底并降低纸纹。不改相机公式、导出逻辑或暂停白板的行为。

- [ ] **Step 1: 写失败测试**

扩展 `tests/board-chrome-obstacle.test.ts` 或 CSS 测试：工具按钮有稳定的 min-width/min-height；装饰边和功能轮廓使用不同变量。运行现有 chrome 测试作为基线。

- [ ] **Step 2: 运行测试**

Run: `npx tsx --test tests/board-chrome.test.ts tests/board-chrome-obstacle.test.ts`

- [ ] **Step 3: 调整控件层级与表面，保持现有不遮挡行为**

- [ ] **Step 4: 运行测试并构建**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): keep board tools readable without covering the edit target"
```

---

### Task 10: 导出与设置分区

**Files:**
- Modify: `src/settings-view.ts`、`src/settings.css`、`src/plugin-settings.ts`（仅样式/分区布局需要时）
- Modify: 导出 modal 的视图与 CSS（例如手写/合集导出 modal；`src/board-export.ts` 只动 chrome，禁止改导出公式、空视图错误或暂停白板策略）
- Test: `tests/settings-controls.test.ts`、`tests/board-export.test.ts` 以及相应 modal 测试

**Interfaces:**
- Consumes: Task 2–3
- Produces: 按任务分区；区块内标签、说明、输入框顺序统一；主操作位置稳定；错误靠近对应字段；加载保留结构；空状态有短说明和明确下一步。`tests/board-export.test.ts` 现有行为必须全部通过。

- [ ] **Step 1: 写失败的布局/错误位置测试，同时先跑现有导出测试作为基线**

Run: `npx tsx --test tests/board-export.test.ts`

Expected: PASS（尚未改逻辑）

然后补设置/导出 chrome 的 CSS 或 DOM 测试：错误节点紧跟对应字段；主按钮位置稳定。

- [ ] **Step 2: 运行新测试，确认失败**

- [ ] **Step 3: 只改分区、间距和错误展示，不改导出逻辑**

- [ ] **Step 4: 运行 `npx tsx --test tests/board-export.test.ts tests/settings-controls.test.ts` 并构建**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): group settings and export chrome without changing export logic"
```

---

### Task 11: 对照样板页做全界面自查并补自动化护栏

**Files:**
- Modify: 自查中发现的具体界面文件
- Test: `tests/interface-style-tokens.test.ts`、`tests/calendar-style-boundary.test.ts`、`tests/editorial-components-css.test.ts`、新增 `tests/editorial-quality-guard.test.ts`

**Interfaces:**
- Consumes: 第 1–10 项的全部产出与设计规范第 6 章验收条件
- Produces: 护栏测试 + 必要的视觉修补。每个主界面都要按浅色、深色、窄容器、长内容、空状态（及适用的加载、错误、焦点、选中与卡片色并存）过一遍样板页标准。功能验收：入口可达、参数保留、快捷键不变、选择状态不丢、导出逻辑不变。

- [ ] **Step 1: 写护栏测试**

```ts
test('default paper chrome has no legacy yellow surfaces', () => {
  const css = interfaceStyleRules('paper', false);
  for (const banned of ['#f3e9d4', '#fffdf8', '#f6f4ee', '#eeece4']) {
    assert.equal(css.includes(`--ts-e-paper:${banned}`), false);
    assert.equal(css.includes(`--ts-e-sheet:${banned}`), false);
  }
});
```

再扫插件 CSS 源文件中作为默认背景/边框出现的禁色（不要误伤用户可选色板、警告语义色或画布象牙/牛皮预设）。日历隔离测试必须通过。

- [ ] **Step 2: 运行护栏、日历和导出基线，列出失败项**

Run: `npx tsx --test tests/editorial-quality-guard.test.ts tests/calendar-style-boundary.test.ts tests/board-export.test.ts tests/interface-style-tokens.test.ts`

- [ ] **Step 3: 逐项修到通过，回到变量或该界面修改，禁止另起一套样式**

对照规范第 1–2 章回看：层次、间距尺度、操作线索、是否再出现黄/金色默认值、动效是否过当、纸纹是否多层叠加。

- [ ] **Step 4: 运行全量测试和构建**

Run: `npm test && npm run build`

Expected: 全量通过（当前主干在 1.3.50 为 10,375 项；本计划会增加测试，总数应大于该值且失败为 0）。`styles.css` 仍含内联纸纹，且没有把纸纹拆成独立文件。

- [ ] **Step 5: Commit**

```bash
git commit -m "test(ui): guard editorial contrast, surfaces, and calendar isolation"
```

不要在此步升版本、合并或发布。把对照样板页的自查结果写进 PR 说明，列出任何故意保留的黄（例如用户可选的 amber 强调色、警告语义色、画布「象牙/牛皮」预设），并说明原因。

---

## Self-review against the spec

- 原则与气质：Task 1–11 全部在现有 editorial token 层上推进，不另起系统。
- 颜色用途、卡片色与状态色分开：Task 1–3、8。
- 深浅主题各自定值、跟随 Obsidian：Task 2。
- 对比度底线与操作线索：Task 2–3、11。
- 字号间距用途、4/8/12 圆角：Task 2–3。
- 布局与密度、滚动责任、容器宽度：Task 5–10。
- 纸纹限度与 200ms / reduced-motion：Task 2、9、11。
- 三层结构与组件状态、空/加载：Task 2–3。
- 组件样板页：Task 4，其后各界面对照它验收。
- 落地顺序：Task 1 → 2–4 → 5–10 → 11，与规范第 4 章一致。
- 三条布局边界（暖白仅浅色默认、长标题分场景、收纳保留入口与摘要）：Task 5–8。
- 各主界面规则：Task 5–10。
- 验收与明确不做：Global Constraints + Task 10–11。
