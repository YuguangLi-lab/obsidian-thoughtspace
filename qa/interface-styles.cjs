// Synthetic browser surface comparison, not native Obsidian or vault testing.
// Uses production styles.css and designTokens; host APIs, content and layout
// containers are fixtures. Nothing is downloaded, installed or uploaded.
// Required: QA_OUTPUT outside this checkout. Optional: PLAYWRIGHT_MODULE,
// CHROME_EXECUTABLE, QA_CSS, QA_STYLES, QA_SCENES. The last two are comma lists
// for targeted reruns; use a separate QA_OUTPUT to preserve previous evidence.
// Dependencies must already be installed.
// Example: QA_OUTPUT=../qa-interface-styles node qa/interface-styles.cjs
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {inflateSync,deflateSync} = require('node:zlib');

const root = path.resolve(__dirname, '..');
const styles = ['paper', 'editorial', 'glass'];
const themes = ['light', 'dark'];
const sizes = [{width:1440,height:900}, {width:390,height:844}];
const scenes = ['board', 'collection', 'settings', 'dialog'];
const selectedStyles=(process.env.QA_STYLES||styles.join(',')).split(',');
const selectedScenes=(process.env.QA_SCENES||scenes.join(',')).split(',');
assert.ok(selectedStyles.length&&selectedStyles.every(value=>styles.includes(value)),'Unknown QA_STYLES');
assert.ok(selectedScenes.length&&selectedScenes.every(value=>scenes.includes(value)),'Unknown QA_SCENES');
const report = {
  scope:'Synthetic DOM with production CSS and designTokens. Host and note content are fixtures. No native keyboard, persistence, real vault or physical-device claims.',
  safety:{chromiumSandbox:true,network:'all context requests aborted',freshProfile:true,realVault:false},
  matrix:{styles:selectedStyles,scenes:selectedScenes,themes,sizes},checks:[], screenshots:[], errors:[],
};
const hash = value => createHash('sha256').update(value).digest('hex');
const escape = value => String(value).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
function check(name, actual, expected = true) {
  let passed = true;
  try { assert.deepEqual(actual, expected); } catch { passed = false; }
  report.checks.push({name,passed,actual,expected});
}

// Chrome's lossless screenshots are RGB/RGBA, 8-bit non-interlaced PNGs.
// Decode pixels only for contrast measurements; delivered screenshots are unedited.
function pngPixels(buffer) {
  assert.equal(buffer.subarray(1,4).toString(), 'PNG');
  let width, height, type, bits, interlace; const parts = [];
  for (let offset=8; offset<buffer.length;) {
    const length=buffer.readUInt32BE(offset), name=buffer.toString('ascii',offset+4,offset+8);
    const bytes=buffer.subarray(offset+8,offset+8+length);
    if (name==='IHDR') { width=bytes.readUInt32BE(0); height=bytes.readUInt32BE(4); bits=bytes[8]; type=bytes[9]; interlace=bytes[12]; }
    if (name==='IDAT') parts.push(bytes);
    offset+=length+12;
  }
  assert.equal(bits,8); assert.equal(interlace,0); assert.ok(type===2||type===6,'Only Chrome RGB/RGBA PNG is supported');
  const channels=type===6?4:3, stride=width*channels, raw=inflateSync(Buffer.concat(parts));
  const pixels=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++) {
    const filter=raw[y*(stride+1)], start=y*stride;
    assert.ok(filter<=4,'Unsupported PNG filter');
    for(let x=0;x<stride;x++) {
      const a=x>=channels?pixels[start+x-channels]:0,b=y?pixels[start+x-stride]:0,c=y&&x>=channels?pixels[start+x-stride-channels]:0;
      const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      pixels[start+x]=(raw[y*(stride+1)+1+x]+predictor)&255;
    }
  }
  return {width,height,at(x,y){const i=(Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x)))*channels;return [...pixels.subarray(i,i+3)];}};
}
function contrast(foreground, background) {
  const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const alpha=(foreground[3]??255)/255;
  const composited=foreground.slice(0,3).map((v,i)=>v*alpha+background[i]*(1-alpha));
  const a=luminance(composited),b=luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

// These are host defaults and fixture geometry only. Plugin colors, typography,
// borders, shadows, texture and material come entirely from production styles.
const hostCss = `
*{box-sizing:border-box}html,body{margin:0;min-width:0;width:100%;height:100%}
body{--font-interface:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--font-text:var(--font-interface);--font-monospace:monospace;--font-text-size:16px;--font-ui-small:13px;--font-ui-smaller:12px;--font-ui-medium:14px;--font-ui-large:18px;--size-4-2:8px;--size-4-3:12px;--size-4-4:16px;--radius-s:4px;--radius-m:8px;--input-radius:5px;--input-height:32px;--interactive-accent:#38674d;--interactive-accent-hover:#315a43;--text-on-accent:#fff;--background-primary:#fff;--background-primary-alt:#f6f6f6;--background-secondary:#f1f2f3;--background-secondary-alt:#e9ebed;--background-modifier-border:#c9cdd1;--background-modifier-hover:#0000000a;--background-modifier-cover:#0005;--text-normal:#24272b;--text-muted:#555b63;--text-faint:#68717a;--text-error:#aa2433;--text-accent:#38674d;--text-highlight-bg:#f2e5a0;background:var(--background-secondary);color:var(--text-normal);font:14px/1.5 var(--font-interface)}
body.theme-dark{--background-primary:#24272b;--background-primary-alt:#292d32;--background-secondary:#1b1e22;--background-secondary-alt:#15181c;--background-modifier-border:#5b636e;--background-modifier-hover:#ffffff0c;--text-normal:#edf0f4;--text-muted:#bec6d0;--text-faint:#aab5c0;--text-error:#ff9fa9;--interactive-accent:#a8c6b3;--text-accent:#a8c6b3;--text-on-accent:#192c21}
button,input,select,textarea{font:inherit;color:var(--text-normal)}button,select,input{min-height:32px;border:1px solid var(--background-modifier-border);border-radius:var(--input-radius);background:var(--background-primary);padding:5px 10px}button{cursor:pointer}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--interactive-accent);outline-offset:2px}button.mod-cta{background:var(--interactive-accent);color:var(--text-on-accent)}svg{display:block;flex:none}.svg-icon{width:18px;height:18px}button{display:inline-flex;align-items:center;justify-content:center;gap:6px}h1,h2,h3,p{overflow-wrap:anywhere}.setting-item{display:flex;align-items:center;gap:18px;padding:18px 0;border-top:1px solid var(--background-modifier-border)}.setting-item-info{min-width:0;flex:1}.setting-item-name{font-weight:500}.setting-item-description{font-size:12px;color:var(--text-muted);margin-top:4px}.setting-item-control{display:flex;min-width:0;gap:8px}.modal{background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:12px;padding:24px}.modal-title{font-size:24px;font-weight:600}.modal-content{margin-top:18px}.view-header{display:flex;align-items:center;gap:12px;height:44px;padding:8px 16px}.view-header-title-container{min-width:0;flex:1}.view-actions{display:flex;gap:6px}.clickable-icon{padding:5px;min-width:28px;min-height:28px}
[data-qa-shell]{height:100%;min-width:0;position:relative;z-index:0;overflow:hidden}[data-qa-board]{height:calc(100% - 44px);position:relative;min-width:0}[data-qa-board]>.ts-main{height:100%;width:100%}[data-qa-board] .ts-stage{position:relative;width:100%;height:100%;overflow:hidden}[data-qa-board] .ts-world{position:absolute;inset:0}[data-qa-board] .ts-card{position:absolute;width:300px;height:190px}[data-qa-board] .ts-card:nth-child(1){left:104px;top:98px}[data-qa-board] .ts-card:nth-child(2){left:472px;top:170px}[data-qa-board] .ts-card:nth-child(3){left:840px;top:98px}[data-qa-board] .ts-node-header{min-height:36px}[data-qa-board] .ts-card-preview{padding:14px 16px;line-height:1.7}[data-qa-status]{position:absolute;right:22px;bottom:22px}
[data-qa-collection]{height:100%}[data-qa-settings]{height:100%;width:100%;overflow:auto;margin:auto}[data-qa-settings] .ts-settings-hero{margin-bottom:24px}[data-qa-settings] .ts-settings-tabs{margin-bottom:24px}[data-qa-dialog-backdrop]{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--background-modifier-cover);padding:18px;z-index:6}[data-qa-dialog]{max-width:100%;max-height:calc(100% - 36px);overflow:auto}.modal-button-container{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
[data-qa-sentinels]{position:fixed;left:0;top:-200px;width:300px;pointer-events:none}.qa-host-sentinel,.qa-calendar-sentinel{color:#314159;background:#f1f4f9;border:2px solid #918273;font:15px/1.6 monospace;box-shadow:none;border-radius:3px;letter-spacing:0}
@media(max-width:600px){[data-qa-board] .ts-card{width:300px;height:180px}[data-qa-board] .ts-card:nth-child(1){left:70px;top:100px}[data-qa-board] .ts-card:nth-child(2){left:70px;top:304px}[data-qa-board] .ts-card:nth-child(3){left:70px;top:508px}[data-qa-status]{display:none}[data-qa-dialog-backdrop]{align-items:flex-start;padding:24px 16px}[data-qa-dialog]{padding:20px}}
`;

const icon = name => `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${({plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',pen:'<path d="m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5"/>'})[name]||'<rect x="4" y="4" width="16" height="16" rx="3"/>'}</svg>`;
const label = (text,id) => `<span data-qa-contrast="${id}">${text}</span>`;
const button = (text,id,cls='ts-button',name='plus') => `<button class="${cls}" type="button" aria-label="${text}">${icon(name)}${label(text,id)}</button>`;
const boardButton=(text,id,cls='',name='plus')=>`<button class="ts-button ${cls}" type="button" aria-label="${text}"><span>${icon(name)}</span>${label(text,id)}</button>`;
const headerButton=(text,cls,name)=>`<button class="clickable-icon ts-header-action ${cls}" type="button" aria-label="${text}" title="${text}">${icon(name)}</button>`;
const surface = 'data-surface="paper" data-accent="forest" data-glass="true" data-density="comfortable"';
function boardFixture() {
  const cards=[['让想法留下来','在纸页、白板与卡片之间，记录新的方向。中英文混排：Design system 2026。'],['从收集到连接','看见线索，组织片段，再把零散想法连接成完整的思路。'],['今天的写作','留出清晰的阅读空间，让工具安静地陪伴思考。']];
  // Matches main.ts: native header actions are icon-only; board buttons contain
  // separate icon/label spans; the command palette is a direct child of ts-main.
  return `<div class="workspace-leaf mod-active" data-qa-shell><header class="view-header ts-native-header" ${surface}><div class="view-header-title-container">${label('一间有光的工作室','header')}</div><div class="view-actions">${headerButton('搜索白板','','search')}${headerButton('工作区','ts-workspace-menu-entry','grid')}</div></header>
    <main class="ts-root" ${surface} data-qa-board><div class="ts-main ts-board-layout"><div class="ts-stage" data-background="dots"><div class="ts-world">${cards.map(([title,body],i)=>`<article class="ts-node ts-card"><header class="ts-node-header">${label(title,'card-title-'+i)}</header><div class="ts-card-preview markdown-rendered"><p>${label(body,'card-body-'+i)}</p></div></article>`).join('')}</div></div>
      <nav class="ts-board-rail" aria-label="白板创作工具"><div class="ts-rail-tools"><div class="ts-rail-group" role="group" aria-label="创建内容">${boardButton('新建卡片','new','ts-primary')}${boardButton('文本','write','ts-rail-secondary','pen')}</div><div class="ts-rail-group" role="group" aria-label="组织与工具">${boardButton('工具','tools','ts-tools-entry','dots')}</div></div></nav>
      <section class="ts-rail-popover ts-tools-palette" data-qa-menu hidden role="dialog" aria-label="更多白板工具"><div class="ts-palette-heading"><div class="ts-palette-title"><strong>${label('白板工具','menu-heading')}</strong></div>${boardButton('关闭白板工具','menu-close','ts-icon-button ts-palette-close','dots')}</div>
        <div class="ts-rail-search"><div class="ts-rail-search-field"><span>${icon('search')}</span><input class="ts-rail-search-input" type="search" aria-label="搜索白板工具" placeholder="搜索工具…"></div><div class="ts-rail-search-status">${label('2 项工具','menu-status')}</div></div>
        <nav class="ts-palette-sections" aria-label="工具分类">${boardButton('全部','menu-all','','grid')}${boardButton('整理','menu-organize','','grid')}${boardButton('思维导图','menu-mindmap','','dots')}${boardButton('工作区','menu-workspace','','grid')}</nav>
        <div class="ts-rail-actions"><div class="ts-tool-cluster" role="group" aria-label="组织与整理">${boardButton('插入已有笔记','menu-note','','grid')}${boardButton('整理白板布局','menu-layout','','dots')}</div></div>
      </section><div class="ts-save-status" data-qa-status>${label('已保存 · 3 张卡片','saved')}</div>
    </div></main></div>`;
}
function collectionFixture() {
  return `<div class="view-content ts-collection-content" ${surface} data-qa-collection><main class="ts-collection"><div class="ts-collection-layout"><nav class="ts-collection-nav" aria-label="收集导航"><div class="ts-collection-nav-heading"><h3>${label('我的空间','collection-nav-heading')}</h3></div><div class="ts-collection-scopes">${button('全部收集','collection-all','is-active','grid')}${button('未整理','collection-unfiled','','dots')}</div><label class="ts-collection-search-label"><span>搜索收集</span><input aria-label="搜索收集" placeholder="想法、片段、关键词"></label><div class="ts-collection-nav-tail"><p>${label('每一个片段，都可能成为下一次创作的开始。','collection-nav-note')}</p></div></nav><section class="ts-collection-main"><header class="ts-collection-header"><div class="ts-collection-heading"><span class="ts-collection-eyebrow">${label('THOUGHTSPACE · 收集','collection-eyebrow')}</span><h2>${label('收集灵感','collection-heading')}</h2><span class="ts-collection-subtitle">${label('先记下来，让想法慢慢生长。','collection-subtitle')}</span></div></header><form class="ts-collection-composer"><div class="ts-collection-composer-heading"><span>${label('此刻，想到了什么？','composer-title')}</span><small>${label('仅合成数据','composer-note')}</small></div><label class="ts-collection-body-label"><textarea aria-label="收集内容">光落在书页上，灵感也有了形状。</textarea></label><details class="ts-collection-options"><summary>${label('添加标签与去向','composer-options')}</summary></details><footer class="ts-collection-composer-footer">${button('收集','collect','mod-cta')}</footer></form><div class="ts-collection-feed-heading"><h3>${label('最近的片段','feed-heading')}</h3><span class="ts-collection-feed-status">${label('今天 · 2 条','feed-status')}</span></div><div class="ts-collection-feed"><article class="ts-collection-card"><header class="ts-collection-card-heading"><time>${label('10:24 · 阅读摘录','collection-time')}</time><h3>${label('留白是一种秩序','collection-card-title')}</h3></header><div class="ts-collection-card-body"><p>${label('让信息有呼吸的空间，重要的内容自然会浮现。每段文字、每次停顿，都值得被认真对待。','collection-body')}</p></div><div class="ts-collection-card-tags">${button('#设计思考','collection-tag','','dots')}</div></article></div></section></div></main></div>`;
}
function settingsFixture(style) {
  const row=(title,description,control,id)=>`<div class="setting-item"><div class="setting-item-info"><div class="setting-item-name">${label(title,id)}</div><div class="setting-item-description">${label(description,id+'-description')}</div></div><div class="setting-item-control">${control}</div></div>`;
  const choices=styles.map(value=>`<option value="${value}" ${value===style?'selected':''}>${({paper:'纸张质感（默认）',editorial:'暖色杂志',glass:'macOS 液态玻璃'})[value]}</option>`).join('');
  return `<main class="ts-settings ts-settings-v2" ${surface} data-qa-settings>
    <header class="ts-settings-header"><div class="setting-item setting-item-heading"><div class="setting-item-info"><div class="setting-item-name">${label('ThoughtSpace','settings-title')}</div></div></div></header>
    <div class="setting-item ts-settings-search-row"><div class="setting-item-control"><div class="ts-settings-search"><span>${icon('search')}</span><input type="search" aria-label="搜索全部设置" placeholder="搜索设置…"></div></div></div>
    <div class="ts-settings-layout"><div class="setting-item ts-settings-navigation-row"><div class="setting-item-control"><select class="ts-settings-category-picker" aria-label="设置分类"><option>界面</option><option>卡片与笔记</option></select><nav class="ts-settings-nav" aria-label="设置分类">${boardButton('界面','settings-tab','is-active','grid')}${boardButton('卡片与笔记','settings-cards','','dots')}</nav></div></div>
    <div class="ts-settings-content"><section class="ts-settings-panel"><div class="ts-settings-panel-heading"><div class="setting-item setting-item-heading"><div class="setting-item-info"><div class="setting-item-name">${label('界面','settings-section')}</div></div></div></div>
      ${row('界面风格','纸张质感沿用原版；暖色杂志与液态玻璃提供不同界面。保存后立即应用到所有 ThoughtSpace 窗口，浅深色跟随 Obsidian。',`<select aria-label="界面风格" data-qa-style-select>${choices}</select>`,'style-label')}
      ${row('界面密度','适合当前窗口的舒适间距。','<select aria-label="界面密度"><option>舒适</option><option>紧凑</option></select>','density-label')}
      ${row('透明与模糊效果','控制支持此效果的界面风格；关闭后使用实色面板，保留所选风格。纸张质感始终使用实色。','<input type="checkbox" aria-label="透明效果" checked>','glass-label')}
    </section></div></div><div class="ts-settings-save-status">${label('偏好配置已保存','save-label')}</div><div class="ts-settings-version">ThoughtSpace · 合成预览</div>
  </main>`;
}
function dialogFixture() {
  // Structure and labels mirror BoardCreationModal in board-creation-view.ts.
  return boardFixture()+`<div class="modal-container ts-board-modal-viewport" data-qa-dialog-backdrop><section class="modal ts-prompt-modal ts-board-creation-modal ts-ui-modal" ${surface} data-qa-dialog role="dialog" aria-label="新建白板"><div class="modal-title">${label('新建白板','dialog-title')}</div><div class="modal-content">
    <div class="setting-item"><div class="setting-item-info"><div class="setting-item-name">${label('白板类型','dialog-type-label')}</div></div><div class="setting-item-control"><select aria-label="白板类型"><option>普通白板</option><option>脑图白板</option><option>手写白板</option></select></div></div>
    <p class="ts-board-creation-purpose">${label('把笔记、图片和想法放在同一张画布上。','dialog-description')}</p>
    <label class="ts-board-creation-name"><span>${label('白板名称','dialog-name-label')}</span><input class="ts-wide" type="text" value="新的研究主题" aria-label="白板名称"></label>
    <details class="ts-board-creation-format"><summary>${label('文件格式 · Markdown','dialog-format')}</summary></details>
    <div role="status"></div><div class="modal-button-container"><button type="button">${label('取消','dialog-cancel')}</button><button type="button" class="mod-cta">${label('创建','dialog-create')}</button></div>
  </div></section></div>`;
}
function fixture(scene,style,theme) {
  const html=scene==='board'?boardFixture():scene==='collection'?collectionFixture():scene==='settings'?settingsFixture(style):dialogFixture();
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ThoughtSpace synthetic interface comparison</title><style>${hostCss}</style></head><body class="theme-${theme}">${html}<div data-qa-sentinels><p class="qa-host-sentinel">Host note sentinel</p><div class="ts-calendar-plugin"><div class="ts-root"><p class="qa-calendar-sentinel">Calendar sentinel</p></div></div></div></body></html>`;
}

async function signature(page,selector) {
  return page.locator(selector).evaluateAll(nodes=>nodes.map(node=>{
    const s=getComputedStyle(node);return {...Object.fromEntries(['color','backgroundColor','backgroundImage','borderTopColor','borderTopWidth','borderRadius','fontFamily','fontSize','lineHeight','boxShadow','letterSpacing'].map(key=>[key,s[key]])),...Object.fromEntries(['--ts-e-paper','--ts-e-ink','--ts-ui-1','--ts-ui-12'].map(key=>[key,s.getPropertyValue(key)]))};
  }));
}
async function palette(page) {
  return page.locator('[data-qa-board], [data-qa-collection], [data-qa-settings], [data-qa-dialog]').evaluateAll(nodes=>nodes.map(node=>{
    const s=getComputedStyle(node);return ['--ts-e-paper','--ts-e-sheet','--ts-e-ink','--ts-e-muted','--ts-e-line','--ts-e-editorial','--ts-e-radius','--ts-c-paper','--ts-c-ink','--ts-ui-1','--ts-ui-12'].map(key=>s.getPropertyValue(key).trim());
  }));
}
async function applyStyle(page,style,glassEffects=true) {
  await page.evaluate(({style,glassEffects})=>{
    // Exercise the production Document registry used by instant settings updates.
    window.qaStyleDocuments ??= new window.InterfaceFixture.InterfaceStyleDocuments({interfaceStyle:style,glassEffects});
    window.qaStyleDocuments.register(document);
    window.qaStyleDocuments.update({interfaceStyle:style,glassEffects});
  },{style,glassEffects});
}
async function measureBoardGeometry(page,name) {
  check(name+'/explicit card geometry',await page.locator('[data-qa-board] .ts-card').evaluateAll(nodes=>nodes.every(node=>{
    const r=node.getBoundingClientRect();return r.width>=240&&r.height>=150;
  })));
  check(name+'/card paragraphs have reading width',await page.locator('[data-qa-board] .ts-card-preview').evaluateAll(nodes=>nodes.every(node=>node.clientWidth>=220&&node.scrollWidth<=node.clientWidth+1)));
  check(name+'/native header actions remain icon only',await page.locator('.ts-native-header .ts-header-action').evaluateAll(nodes=>nodes.every(node=>node.querySelector('svg')&&!node.textContent.trim())));
}
async function captureMenu(page,output,metadata) {
  const name=`board-menu/${metadata.theme}/${metadata.width}x${metadata.height}/${metadata.style}`;
  const menu=page.locator('[data-qa-menu]');
  await menu.evaluate(node=>{node.hidden=false;node.querySelector('.ts-palette-sections button').setAttribute('aria-pressed','true');});
  check(name+'/production parent hierarchy',await menu.evaluate(node=>node.parentElement.classList.contains('ts-main')&&!!node.querySelector(':scope > .ts-rail-actions > .ts-tool-cluster')));
  check(name+'/short command labels readable',await menu.locator('.ts-rail-actions button>span:last-child,.ts-palette-sections button>span:last-child').evaluateAll(nodes=>nodes.every(node=>{
    const r=node.getBoundingClientRect(),s=getComputedStyle(node),size=parseFloat(s.fontSize),line=parseFloat(s.lineHeight)||size*1.5;
    return r.width>=Math.min(node.textContent.length,3)*size*.75&&r.height<=line*2.2;
  })));
  check(name+'/menu fits viewport',await menu.evaluate(node=>{const r=node.getBoundingClientRect();return r.width>200&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}));
  const file=`board-menu-${metadata.theme}-${metadata.width}x${metadata.height}-${metadata.style}.png`;
  await page.screenshot({path:path.join(output,file)});
  report.screenshots.push({...metadata,scene:'board-menu',file});
  await measureContrast(page,name);
  await menu.evaluate(node=>{node.hidden=true;});
}
async function measureContrast(page,name) {
  const probes=await page.locator('[data-qa-contrast]').evaluateAll(nodes=>nodes.flatMap(node=>{
    const r=node.getBoundingClientRect(), s=getComputedStyle(node);
    if(r.width<2||r.height<2||r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)return[];
    if(node.closest('[data-qa-dialog-backdrop]')===null&&document.querySelector('[data-qa-dialog-backdrop]'))return[];
    const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    if(!top||(!node.contains(top)&&!top.contains(node)))return[];
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.fillStyle=s.color;ctx.fillRect(0,0,1,1);
    const color=[...ctx.getImageData(0,0,1,1).data];let opacity=1;for(let el=node;el;el=el.parentElement)opacity*=Number(getComputedStyle(el).opacity);color[3]*=opacity;
    const size=parseFloat(s.fontSize),weight=parseInt(s.fontWeight,10)||400;
    return [{id:node.dataset.qaContrast,x:r.x,y:r.y,width:r.width,height:r.height,color,minimum:size>=24||(size>=18.6667&&weight>=700)?3:4.5,oldStyle:node.getAttribute('style')}];
  }));
  await page.locator('[data-qa-contrast]').evaluateAll(nodes=>nodes.forEach(node=>{node.style.setProperty('color','transparent','important');node.style.setProperty('text-shadow','none','important');}));
  const pixels=pngPixels(await page.screenshot());
  await page.locator('[data-qa-contrast]').evaluateAll((nodes,probes)=>nodes.forEach(node=>{
    const original=probes.find(probe=>probe.id===node.dataset.qaContrast)?.oldStyle;
    // Fixture labels have no initial inline paint. Restore hidden/offscreen labels too.
    if(original)node.setAttribute('style',original);else node.removeAttribute('style');
  }),probes);
  check(name+'/visible contrast probes',probes.length>0);
  for(const probe of probes) {
    const points=[.2,.5,.8].flatMap(x=>[.25,.5,.75].map(y=>[Math.floor(probe.x+probe.width*x),Math.floor(probe.y+probe.height*y)]));
    const ratios=points.map(([x,y])=>contrast(probe.color,pixels.at(x,y)));
    const minimum=Math.min(...ratios);
    report.checks.push({name:name+'/contrast/'+probe.id,passed:minimum>=probe.minimum,actual:Number(minimum.toFixed(3)),expected:probe.minimum,method:'foreground CSS color over screenshot pixels with text temporarily transparent; includes composited gradients and transparency'});
  }
}
function writeIndex(output) {
  const groups=new Map();
  for(const screenshot of report.screenshots){const key=`${screenshot.scene} · ${screenshot.theme} · ${screenshot.width} × ${screenshot.height}${screenshot.glassEffects===false?' · no blur':''}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(screenshot);}
  const failures=report.checks.filter(row=>!row.passed);
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ThoughtSpace · 三套界面本地对照</title><style>body{font:15px/1.6 system-ui;margin:32px;color:#222;background:#f4f4f4}h1{font-size:26px}p{max-width:80ch}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0;min-width:0}img{width:100%;height:auto;border:1px solid #aaa}figcaption{font-weight:600;padding:8px 0}a{color:#1856a0}pre{white-space:pre-wrap}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style><h1>ThoughtSpace · 三套界面本地对照</h1><p>合成数据，生产 CSS 与 designTokens；宿主与页面结构为测试 fixture。此预览不代表原生 Obsidian、配置持久化或真机移动设备验收。所有截图保持原始像素。</p><p>${report.checks.length-failures.length} 通过 / ${failures.length} 失败。<a href="report.json">完整本地报告</a></p>${[...groups].map(([key,items])=>`<section><h2>${escape(key)}</h2><div class="grid">${items.map(item=>`<figure><figcaption>${escape(item.style)}</figcaption><a href="${item.file}"><img loading="lazy" src="${item.file}" alt="${escape(key+' '+item.style)}"></a></figure>`).join('')}</div></section>`).join('')}${failures.length?'<h2>需要审查</h2><pre>'+escape(JSON.stringify(failures,null,2))+'</pre>':''}</html>`;
  fs.writeFileSync(path.join(output,'index.html'),html);
}

async function main() {
  if(process.argv.includes('--self-check')) {
    assert.equal(contrast([0,0,0,255],[255,255,255]),21);
    assert.equal(contrast([255,255,255,0],[255,255,255]),1);
    // Hand-authored two-pixel RGB rows exercise every PNG scanline filter.
    const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(2,0);ihdr.writeUInt32BE(5,4);ihdr[8]=8;ihdr[9]=2;
    const chunk=(name,data)=>{const bytes=Buffer.alloc(data.length+12);bytes.writeUInt32BE(data.length);bytes.write(name,4);data.copy(bytes,8);return bytes;};
    const raw=Buffer.from([0,10,20,30,40,50,60, 1,10,20,30,30,30,30, 2,0,0,0,0,0,0, 3,5,10,15,15,15,15, 4,0,0,0,0,0,0]);
    const png=pngPixels(Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
    for(let y=0;y<5;y++){assert.deepEqual(png.at(0,y),[10,20,30]);assert.deepEqual(png.at(1,y),[40,50,60]);}
    for(const style of styles)for(const theme of themes)for(const scene of scenes){const html=fixture(scene,style,theme);assert.ok(html.includes('data-qa-contrast'));assert.ok(html.includes('qa-calendar-sentinel'));assert.ok(!html.includes('undefined'));}
    console.log('Fixture generation, PNG filters and contrast arithmetic passed; no browser was launched.');return;
  }
  assert.ok(process.env.QA_OUTPUT,'Set QA_OUTPUT to a dedicated directory outside this checkout');
  const output=path.resolve(process.env.QA_OUTPUT);
  assert.ok(output!==root&&!output.startsWith(root+path.sep),'Screenshots and reports must be outside the checkout');
  fs.mkdirSync(output,{recursive:true});
  const temporary=fs.mkdtempSync(path.join(output,'isolated-browser-'));
  process.env.TMPDIR=temporary; // Child-process temporary storage only; no system configuration is changed.
  const stylesheet=path.resolve(process.env.QA_CSS||path.join(root,'styles.css'));
  let browser;
  try {
    const {build}=require('esbuild');
    const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
    const css=fs.readFileSync(stylesheet,'utf8');
    report.inputs={stylesheetSha256:hash(css),tokensSha256:hash(fs.readFileSync(path.join(root,'src/interface-style-tokens.ts'))),uiTokensSha256:hash(fs.readFileSync(path.join(root,'src/ui-tokens.ts')))};
    const bundled=await build({absWorkingDir:root,stdin:{contents:"export {designTokens,InterfaceStyleDocuments} from './src/ui-tokens';",resolveDir:root,sourcefile:'interface-fixture.ts',loader:'ts'},bundle:true,write:false,platform:'browser',format:'iife',globalName:'InterfaceFixture',logLevel:'silent'});
    const code=bundled.outputFiles[0].text;
    fs.writeFileSync(path.join(output,'fixture-runtime.js'),code);
    report.phase='launch';
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings'],env:{...process.env,TMPDIR:temporary}});
    report.browserVersion=browser.version();report.phase='matrix';
    for(const size of sizes)for(const theme of themes)for(const scene of selectedScenes) {
      const context=await browser.newContext({viewport:size,deviceScaleFactor:1,colorScheme:theme,hasTouch:size.width<600,isMobile:size.width<600,reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:false});
      await context.route('**/*',route=>route.abort());
      const page=await context.newPage();
      page.on('pageerror',error=>report.errors.push({scene,theme,size,error:String(error)}));
      await page.setContent(fixture(scene,'paper',theme));
      await page.addStyleTag({content:css});await page.addScriptTag({content:code});
      const hostBaseline=await signature(page,'.qa-host-sentinel,.qa-calendar-sentinel');
      const palettes={};
      for(const style of selectedStyles) {
        const name=`${scene}/${theme}/${size.width}x${size.height}/${style}`;
        await applyStyle(page,style);
        await page.locator('[data-qa-style-select]').evaluateAll((nodes,style)=>nodes.forEach(node=>{node.value=style;}),style);
        await page.evaluate(()=>document.fonts.ready);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        check(name+'/host and calendar unchanged',await signature(page,'.qa-host-sentinel,.qa-calendar-sentinel'),hostBaseline);
        check(name+'/one registered token sheet',await page.locator('style[data-thoughtspace-tokens]').count(),1);
        check(name+'/token style selected',await page.locator('style[data-thoughtspace-tokens]').last().getAttribute('data-interface-style'),style);
        check(name+'/document no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        check(name+'/visible fixture roots fit viewport',await page.locator('[data-qa-board],[data-qa-collection],[data-qa-settings],[data-qa-dialog]').evaluateAll(nodes=>nodes.every(node=>{const r=node.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;})));
        check(name+'/style option fits control',await page.locator('[data-qa-style-select]').evaluateAll(nodes=>nodes.every(node=>{const s=getComputedStyle(node),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;const text=node.selectedOptions[0]?.textContent||'';return ctx.measureText(text).width+parseFloat(s.paddingLeft)+parseFloat(s.paddingRight)+16<=node.clientWidth+1;})));
        check(name+'/non-canvas panels no horizontal overflow',await page.locator('.ts-collection-main,[data-qa-settings],[data-qa-dialog]').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1)));
        if(scene==='board'||scene==='dialog')await measureBoardGeometry(page,name);
        if(scene==='dialog')check(name+'/dialog text is above workspace chrome',await page.locator('[data-qa-dialog] [data-qa-contrast]').evaluateAll(nodes=>nodes.every(node=>{const r=node.getBoundingClientRect();return [.1,.5,.9].every(x=>{const top=document.elementFromPoint(r.left+r.width*x,r.top+r.height*.5);return top?.closest('[data-qa-dialog]')===node.closest('[data-qa-dialog]');});})));
        palettes[style]=await palette(page);
        const file=`${scene}-${theme}-${size.width}x${size.height}-${style}.png`;
        await page.screenshot({path:path.join(output,file)});
        report.screenshots.push({file,scene,theme,...size,style,glassEffects:true});
        await measureContrast(page,name);
        if(scene==='board')await captureMenu(page,output,{theme,...size,style,glassEffects:true});
      }
      check(`${scene}/${theme}/${size.width}/selected palettes distinct`,new Set(Object.values(palettes).map(value=>JSON.stringify(value))).size,selectedStyles.length);
      // Late production stylesheet arrival mirrors Obsidian's startup order.
      await page.setContent(fixture(scene,'paper',theme));
      await page.evaluate(()=>{window.qaStyleDocuments?.dispose();delete window.qaStyleDocuments;});
      await page.addScriptTag({content:code});
      for(const style of selectedStyles) {
        await page.locator('style[data-qa-production]').evaluateAll(nodes=>nodes.forEach(node=>node.remove()));
        await applyStyle(page,style);
        const late=await page.addStyleTag({content:css});await late.evaluate(node=>{node.dataset.qaProduction='true';});
        check(`${scene}/${theme}/${size.width}/${style}/stylesheet load order`,await palette(page),palettes[style]);
        for(const legacy of ['soft','paper']) {
          await page.locator('[data-surface]').evaluateAll((nodes,value)=>nodes.forEach(node=>{node.dataset.surface=value;}),legacy);
          check(`${scene}/${theme}/${size.width}/${style}/legacy ${legacy} preserves palette`,await palette(page),palettes[style]);
        }
      }
      if(selectedStyles.includes('glass')){
      await applyStyle(page,'glass',false);
      await page.locator('[data-qa-style-select]').evaluateAll(nodes=>nodes.forEach(node=>{node.value='glass';}));
      await page.locator('input[aria-label="透明效果"]').evaluateAll(nodes=>nodes.forEach(node=>{node.checked=false;}));
      await page.locator('[data-glass]').evaluateAll(nodes=>nodes.forEach(node=>{node.dataset.glass='false';}));
      const fallbackName=`${scene}/${theme}/${size.width}x${size.height}/glass-solid`;
      check(fallbackName+'/no backdrop filters',await page.locator('[data-qa-shell] *,[data-qa-settings],[data-qa-settings] *,[data-qa-collection],[data-qa-collection] *,[data-qa-dialog],[data-qa-dialog] *').evaluateAll(nodes=>nodes.every(node=>['','none'].includes(getComputedStyle(node).backdropFilter))));
      check(fallbackName+'/opaque material backgrounds',await page.locator('.ts-native-header,.ts-rail-popover,[data-qa-dialog],.ts-collection-composer,[data-qa-settings]').evaluateAll(nodes=>nodes.every(node=>{
        const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.fillStyle=getComputedStyle(node).backgroundColor;ctx.fillRect(0,0,1,1);return ctx.getImageData(0,0,1,1).data[3]===255;
      })));
      await measureContrast(page,fallbackName);
      const fallbackFile=`${scene}-${theme}-${size.width}x${size.height}-glass-solid.png`;
      await page.screenshot({path:path.join(output,fallbackFile)});
      report.screenshots.push({file:fallbackFile,scene,theme,...size,style:'glass',glassEffects:false});
      }
      await context.close();
    }
    check('no browser page errors',report.errors,[]);
    report.phase='complete';
  } catch(error) {
    report.errors.push({phase:report.phase||'prepare',error:String(error)});
    report.status=report.phase==='launch'?'browser-launch-blocked':'error';
    // A launch failure ends this operation. Never retry with a disabled sandbox.
    process.exitCode=1;
  } finally {
    if(browser)try{await browser.close();}catch(error){report.errors.push({phase:'cleanup',error:String(error)});report.status='error';process.exitCode=1;}
    report.passed=report.checks.filter(row=>row.passed).length;
    report.failed=report.checks.filter(row=>!row.passed).length;
    if(!report.status)report.status=report.failed?'failed':'passed';
    if(report.failed)process.exitCode=1;
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
    writeIndex(output);
    console.log(JSON.stringify({status:report.status,passed:report.passed,failed:report.failed,screenshots:report.screenshots.length,output}));
    if(report.errors.length)console.error(JSON.stringify(report.errors,null,2));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
