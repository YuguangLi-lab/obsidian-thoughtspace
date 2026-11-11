import {ItemView, type WorkspaceLeaf} from 'obsidian';
import {cardFillHex} from './model';

export const COMPONENT_GALLERY_VIEW_TYPE = 'thoughtspace-component-gallery';
export const COMPONENT_GALLERY_COMMAND_ID = 'thoughtspace-open-component-gallery';

/** Command-opened QA page. It is not linked from the board, writing toolbar, or settings. */
export class ComponentGalleryView extends ItemView {
  private theme: 'light' | 'dark' = 'light';
  private width: 'wide' | 'narrow' = 'wide';
  constructor(leaf: WorkspaceLeaf) { super(leaf); }
  getViewType() { return COMPONENT_GALLERY_VIEW_TYPE; }
  getDisplayText() { return '组件样板页'; }
  getIcon() { return 'layout-template'; }
  async onOpen() {
    const body = this.contentEl.ownerDocument.body;
    this.theme = body?.classList?.contains('theme-dark') ? 'dark' : 'light';
    this.render();
  }
  async onClose() { this.contentEl.empty(); }
  private render() {
    const root = this.contentEl;
    root.empty();
    root.addClass('ts-component-gallery');
    root.toggleClass('theme-dark', this.theme === 'dark');
    root.setAttribute('data-theme', this.theme);
    root.setAttribute('data-width', this.width);

    const bar = root.createDiv({cls: 'ts-gallery-toolbar'});
    const theme = bar.createEl('button', {cls: 'ts-button', text: this.theme === 'dark' ? '切换到浅色' : '切换到深色', attr: {type: 'button', 'data-gallery-theme': 'true', 'aria-pressed': this.theme === 'dark' ? 'true' : 'false'}});
    theme.onclick = () => { this.theme = this.theme === 'dark' ? 'light' : 'dark'; this.render(); };
    const width = bar.createEl('button', {cls: 'ts-button', text: this.width === 'narrow' ? '切换到宽容器' : '切换到窄容器', attr: {type: 'button', 'data-gallery-width': 'true', 'aria-pressed': this.width === 'narrow' ? 'true' : 'false'}});
    width.onclick = () => { this.width = this.width === 'narrow' ? 'wide' : 'narrow'; this.render(); };

    const type = this.group(root, '文字', '组标题用墨色和中等字重，说明保持弱化。');
    type.createEl('p', {cls: 'ts-type-title', text: '标题：一张很长的研究笔记标题，用来检查窄容器里的换行'});
    type.createEl('p', {cls: 'ts-type-body', text: '正文按阅读节奏排列。同一组里的控件靠得更近，下一组之前留出明显的停顿。'});
    type.createEl('p', {cls: 'ts-type-meta', text: '辅助信息 · 元数据'});

    const cards = this.group(root, '卡片', '选中只加轮廓和中性色小勾，不改卡片填色。');
    const cardRow = cards.createDiv({cls: 'ts-gallery-cards'});
    this.card(cardRow, '默认纸色', 'var(--ts-e-paper)', 'paper', false);
    this.card(cardRow, '绿色卡片', `var(--ts-fill-green, ${cardFillHex.green})`, 'green', true);
    this.card(cardRow, '米黄卡片', `var(--ts-fill-sand, ${cardFillHex.sand})`, 'sand', true, true);

    const buttons = this.group(root, '按钮', '焦点只加环，不改边框颜色。');
    const row = buttons.createDiv({cls: 'ts-gallery-row'});
    row.createEl('button', {cls: 'ts-button', text: '默认', attr: {type: 'button'}});
    row.createEl('button', {cls: 'ts-button is-hover-sample', text: '悬停', attr: {type: 'button'}});
    row.createEl('button', {cls: 'ts-button is-focus-sample', text: '焦点', attr: {type: 'button'}});
    row.createEl('button', {cls: 'ts-button mod-cta ts-primary', text: '确定', attr: {type: 'button'}});
    row.createEl('button', {cls: 'ts-button mod-cta ts-primary', text: '主按钮禁用', attr: {type: 'button', disabled: 'true'}});
    row.createEl('button', {cls: 'ts-button mod-cta ts-primary is-loading', text: '保存', attr: {type: 'button', 'aria-busy': 'true'}});

    const fields = this.group(root, '输入', '默认和焦点并排。错误与成功是分开的例子。');
    const pair = fields.createDiv({cls: 'ts-gallery-field-pair'});
    const plain = pair.createDiv({cls: 'ts-prompt-field'});
    plain.createEl('span', {cls: 'ts-type-meta', text: '默认'});
    plain.createEl('input', {attr: {type: 'text', value: '研究笔记标题', 'aria-label': '默认输入'}});
    const focused = pair.createDiv({cls: 'ts-prompt-field'});
    focused.createEl('span', {cls: 'ts-type-meta', text: '焦点'});
    focused.createEl('input', {cls: 'is-focus-sample', attr: {type: 'text', value: '正在输入', 'aria-label': '焦点输入'}});
    const errorExample = fields.createDiv({cls: 'ts-gallery-example', attr: {'data-gallery-example': 'error'}});
    errorExample.createEl('p', {cls: 'ts-gallery-example-label', text: '字段错误'});
    const invalid = errorExample.createDiv({cls: 'ts-prompt-field'});
    invalid.createEl('span', {cls: 'ts-type-meta', text: '错误 + 焦点'});
    invalid.createEl('input', {cls: 'is-error is-focus-sample', attr: {type: 'text', value: '不能为空', 'aria-invalid': 'true', 'aria-label': '错误输入'}});
    invalid.createDiv({cls: 'ts-field-error', text: '请填写标题后再继续'});
    const successExample = fields.createDiv({cls: 'ts-gallery-example', attr: {'data-gallery-example': 'success'}});
    successExample.createEl('p', {cls: 'ts-gallery-example-label', text: '保存成功'});
    successExample.createDiv({cls: 'ts-field-success ts-status-success', text: '已保存到当前白板'});

    const lists = this.group(root, '列表', '分隔线保留。选中勾在行尾，可与焦点同时出现。');
    lists.createDiv({cls: 'ts-outline-row', text: '默认 第二章提纲'});
    lists.createDiv({cls: 'ts-outline-row is-hover-sample', text: '悬停，不改行的底色来源'});
    lists.createDiv({cls: 'ts-outline-row is-selected', text: '选中'});
    lists.createDiv({cls: 'ts-outline-row is-selected is-focus-sample', attr: {tabindex: '0'}, text: '选中 + 焦点'});
    lists.createDiv({cls: 'ts-tree-row', text: '一条很长的列表标题，用来检查窄容器里是否还能读完，而不是把旁边的组挤开。'});

    const empty = this.group(root, '空状态', '没有内容时仍使用同一套按钮。');
    const placeholder = empty.createDiv({cls: 'ts-sidebar-empty'});
    placeholder.createDiv({text: '还没有卡片。把材料拖到这里，或新建一张。'});
    placeholder.createEl('button', {cls: 'ts-button', text: '新建卡片', attr: {type: 'button'}});

    const dialogs = this.group(root, '弹窗', '浮层浅于面板，并使用更深的阴影。宽度停在内容，不拉满整页。');
    const stage = dialogs.createDiv({cls: 'ts-gallery-stage'});
    const dialog = stage.createDiv({cls: 'ts-gallery-dialog'});
    dialog.createEl('h3', {cls: 'ts-type-title', text: '新建白板'});
    dialog.createEl('p', {cls: 'ts-type-meta', text: '浮层、大圆角、内距 16px。'});
    const name = dialog.createDiv({cls: 'ts-prompt-field'});
    name.createEl('span', {cls: 'ts-type-meta', text: '名称'});
    name.createEl('input', {attr: {type: 'text', value: '文献综述', 'aria-label': '白板名称'}});
    const actions = dialog.createDiv({cls: 'ts-gallery-row ts-gallery-dialog-actions'});
    actions.createEl('button', {cls: 'ts-button', text: '取消', attr: {type: 'button'}});
    actions.createEl('button', {cls: 'ts-button mod-cta ts-primary', text: '创建', attr: {type: 'button'}});
  }
  private group(root: HTMLElement, title: string, caption: string) {
    const group = root.createDiv({cls: 'ts-gallery-group'});
    group.createEl('h2', {cls: 'ts-gallery-heading', text: title});
    group.createEl('p', {cls: 'ts-gallery-caption ts-type-meta', text: caption});
    return group;
  }
  private card(parent: HTMLElement, label: string, fill: string, tone: 'paper' | 'green' | 'sand', selected: boolean, focus = false) {
    const card = parent.createDiv({cls: `ts-node ts-library-card ts-gallery-card${selected ? ' is-selected' : ''}${focus ? ' is-focus-sample' : ''}`, attr: {...(focus ? {tabindex: '0'} : {}), 'data-fill': tone}});
    card.style.background = fill;
    card.createDiv({cls: 'ts-type-body', text: label});
    card.createDiv({cls: 'ts-type-meta', text: selected ? (focus ? '焦点环与小勾同时在' : '轮廓 + 角标，填色保留') : '未选中'});
  }
}
