import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';

const toolbar=postcss.parse(readFileSync('src/context-toolbar.css','utf8'));
const objects=postcss.parse(readFileSync('src/object-chrome.css','utf8'));
function values(root:postcss.Root,match:(selector:string)=>boolean,property:string){
 const found:string[]=[];root.walkRules(rule=>{if(match(rule.selector))rule.walkDecls(property,decl=>{found.push(decl.value);});});return found;
}
function pluginColor(value:string){
 // Standalone Markdown command bars can fall back to the host. A board must
 // prefer its own accent even when a third-party theme uses another pigment.
 return value.includes('var(--ts-accent')&&!/var\(--(?:text-accent|interactive-accent)\)/.test(value.replace(/var\(--ts-accent,\s*var\(--interactive-accent\)\)/g,'var(--ts-accent)'));
}

test('selected format modes and choice menus use the same accent as object selection',()=>{
 for(const [label,match] of [
  ['mode',(selector:string)=>selector.includes('.ts-format-mode-button.is-active')],
  ['batch mode',(selector:string)=>selector.includes('.ts-batch-format-switch')&&selector.includes('.is-active')],
  ['choice',(selector:string)=>selector.includes('.ts-inspector .ts-choice[aria-pressed=true]')],
 ] as const){const colors=values(toolbar,match,'color');assert.ok(colors.length,label);assert.ok(colors.every(pluginColor),`${label}: ${colors.join(', ')}`);}
 const selected=values(objects,s=>s.includes('.ts-node')&&s.includes('.is-selected')&&!s.includes(':not(.is-selected)'),'outline');assert.ok(selected.length);assert.ok(selected.every(pluginColor),selected.join(', '));
});

test('field and folded action keyboard focus prefer the board accent',()=>{
 const fields=values(toolbar,s=>s.includes('.ts-format-field:focus-within'),'border-color');assert.ok(fields.length);assert.ok(fields.every(pluginColor),fields.join(', '));
 const compact=values(objects,s=>s.includes('.ts-compact-actions > button:focus-visible'),'outline');assert.ok(compact.length);assert.ok(compact.every(value=>pluginColor(value)&&/^2px solid /.test(value)),compact.join(', '));
 const active=values(toolbar,()=>true,'--ts-format-active');assert.ok(active.length);assert.ok(active.every(pluginColor),active.join(', '));
});

test('control hover uses the plugin pigment without activating disabled buttons',()=>{
 for(const [root,control] of [
  [toolbar,'.ts-format-mode-button'],[toolbar,'.ts-batch-format-switch'],[toolbar,'.ts-inspector .ts-choice'],
  [objects,'.ts-card-actions'],[objects,'.ts-compact-actions'],[objects,'.ts-image-actions'],[objects,'.ts-fold-actions'],[objects,'.ts-web-actions'],
 ] as const){
  const colors=values(root,s=>s.includes(control)&&s.includes(':hover')&&s.includes(':not(:disabled)'),'color');
  assert.ok(colors.some(pluginColor),`${control} needs an enabled accent hover`);
 }
});

test('action accent rules cannot recolor native Markdown links, task boxes or custom node pigments',()=>{
 for(const root of [toolbar,objects])root.walkRules(rule=>{
  const accents=values(postcss.root({nodes:[rule.clone()]}),()=>true,'color').filter(pluginColor);
  if(accents.length)assert.doesNotMatch(rule.selector,/\.ts-text-markdown|\.markdown-preview|\.cm-content|input\[type=["']?checkbox|(?:^|\s)a(?:$|[\s:.])/);
  rule.walkDecls(decl=>{assert.ok(!['--ts-tone','--ts-tint','--ts-brain-node-color','--ts-brain-text-color'].includes(decl.prop),`control CSS must not replace ${decl.prop}`);});
 });
 const native=values(objects,s=>s.startsWith('.workspace-leaf-content[data-type="canvas"]')&&s.includes('.canvas-node.is-selected'),'outline');
 assert.ok(native.some(value=>value.includes('var(--interactive-accent)')),'native Canvas attachments retain their host selection color');
});

const operationSurfaces=[
 'paper-settings','background-image','mindmap-studio','settings','branch-controls','brain-board','board-mindmap',
 'local-relations','canvas-dock','group-organizer','space-hub','reading-workspace','reference-reading','card-surfaces','sidebar-refinement','workflow',
];
test('plugin panel and dialog interaction states never switch to the host pigment',()=>{
 const failures:string[]=[];
 for(const name of operationSurfaces)postcss.parse(readFileSync(`src/${name}.css`,'utf8')).walkRules(rule=>{
  const state=/:hover|:focus|:active|\[aria-(?:pressed|selected|current|expanded)=|\.is-(?:active|selected|focused|current|pinned)|\[data-drop=|\[open\]|\.ts-mm-auto-repair/.test(rule.selector);
  if(!state||/\.ts-reading-prose|\.ts-reference-reading-prose/.test(rule.selector))return;
  rule.walkDecls(decl=>{
   if(/var\(--(?:interactive-accent(?:-hover)?|text-accent)\)/.test(decl.value)&&!pluginColor(decl.value))failures.push(`${name}: ${rule.selector} { ${decl.prop}:${decl.value} }`);
  });
 });
 assert.deepEqual(failures,[]);
});

test('plugin header actions inherit every existing board accent palette in light and dark themes',()=>{
 const board=postcss.parse(readFileSync('styles.css','utf8')),header=postcss.parse(readFileSync('src/canvas-dock.css','utf8'));
 for(const dark of [false,true])for(const accent of ['forest','blue','amber','rose']){
  const condition=(selector:string,root:string)=>selector.startsWith(dark?`.theme-dark ${root}`:root)&&(dark||!selector.includes('.theme-dark'))&&
   (accent==='forest'?!selector.includes('data-accent'):new RegExp(`data-accent=["']?${accent}["']?\\]`).test(selector));
  const original=values(board,s=>condition(s,'.ts-root'),'--ts-accent')[0],actual=values(header,s=>condition(s,'.ts-native-header'),'--ts-accent')[0];
  assert.ok(original,`${dark}/${accent} board`);assert.equal(actual,original,`${dark}/${accent} header`);
 }
});

test('accent text remains readable on control washes for every default light and dark palette',()=>{
 const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const luminance=(color:number[])=>color.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const palettes=postcss.parse(readFileSync('styles.css','utf8'));
 for(const [file,property]of [['context-toolbar','--ts-format-active'],['object-chrome','--ts-object-active'],['sidebar-refinement','--ts-nav-active'],['space-hub','--ts-hub-active'],['reading-workspace','--reader-wash']]){
  const control=postcss.parse(readFileSync(`src/${file}.css`,'utf8')),washes=values(control,()=>true,property);
  for(const dark of [false,true]){
   const inks=values(palettes,s=>s.startsWith(dark?'.theme-dark .ts-root':'.ts-root'),'--ts-accent');
   for(const ink of inks)for(const wash of washes){
    const amount=Number(wash.match(/var\(--ts-accent(?:,\s*var\(--interactive-accent\))?\)\s+(\d+)%/)?.[1]);assert.ok(Number.isFinite(amount)&&amount>0,wash);
    const foreground=rgb(ink),base=rgb(dark?'#1e1e1e':'#ffffff'),background=foreground.map((v,i)=>v*amount/100+base[i]*(1-amount/100)),a=luminance(foreground),b=luminance(background);
    const contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(contrast>=4.5,`${file}/${property}/${ink}/${amount}% has ${contrast.toFixed(2)} contrast`);
   }
  }
 }
});

test('broad plugin focus and hover rules leave native Markdown controls to the host',()=>{
 for(const [file,match]of [
  ['brain-board',(selector:string)=>selector.includes('.ts-brain-shell .clickable-icon:')&&/:hover|:focus-visible/.test(selector)],
  ['local-relations',(selector:string)=>selector.includes('.ts-local-relations button:focus-visible')],
  ['space-hub',(selector:string)=>selector.includes('.ts-space-hub :is(button,input,select,summary):focus-visible')],
  ['reading-workspace',(selector:string)=>selector.includes('.ts-reading-desk :is(button,summary,input,select):focus-visible')],
 ]as const){
  const css=postcss.parse(readFileSync(`src/${file}.css`,'utf8'));let checked=0;css.walkRules(rule=>{if(!match(rule.selector))return;checked++;assert.ok(rule.selector.includes(':not(:where(.markdown-rendered *'),`${file}: ${rule.selector}`);});assert.ok(checked,file);
 }
});
