import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import {designTokens} from '../src/ui-tokens';

const visual=postcss.parse(readFileSync('src/visual-system.css','utf8'));
const interaction=postcss.parse(readFileSync('src/interaction-chrome.css','utf8'));
const surfaces=['ts-root','ts-journal','ts-ui-modal','ts-settings','ts-native-header','ts-writing','ts-note-markdown-toolbar','ts-media-workspace','ts-online-workspace','ts-materials-panel','ts-materials-modal'];
const nativeRoots=['markdown-rendered','markdown-preview-view','markdown-source-view','cm-editor','pdf-container','pdf-viewer'];
function declarations(root:postcss.Root,property:string){const result:{selector:string;value:string}[]=[];root.walkRules(rule=>rule.walkDecls(property,decl=>{result.push({selector:rule.selector,value:decl.value});}));return result;}

test('all plugin workspace roots receive light and dark chrome tokens without styling native documents',()=>{
 const line=declarations(visual,'--ts-design-line'),shadow=declarations(visual,'--ts-design-shadow');
 for(const surface of surfaces){assert.ok(line.some(rule=>rule.selector.includes(`.${surface}`)),`${surface} border`);assert.ok(shadow.some(rule=>rule.selector.startsWith('.theme-dark')&&rule.selector.includes(`.${surface}`)),`${surface} dark elevation`);}
 for(const property of ['--ts-ui-control','--ts-ui-gap','--ts-ui-row-pad','--ts-ui-panel-pad','--ts-ui-radius']){
  const rules=declarations(visual,property);for(const surface of surfaces){assert.ok(rules.some(rule=>rule.selector.includes(`.${surface}`)),`${surface} ${property}`);assert.ok(rules.some(rule=>rule.selector.includes(`.${surface}`)&&rule.selector.includes('[data-density="compact"]')),`${surface} compact ${property}`);}
 }
 for(const rule of line)assert.doesNotMatch(rule.selector,/\.markdown-|\.cm-|\.pdf-|(?:^|\s)(?:body|html)(?:$|\s)/);
});

test('dynamic Radix token registration has the same workspace scope and excludes the separate calendar plugin',()=>{
 const style={dataset:{} as Record<string,string>,textContent:''},appended:unknown[]=[];
 const doc={createElement:()=>style,head:{appendChild:(el:unknown)=>appended.push(el)}};
 assert.equal(designTokens(doc as unknown as Document),style);assert.deepEqual(appended,[style]);
 const css=postcss.parse(style.textContent);let themes=0;css.walkRules(rule=>{
  themes++;for(const surface of surfaces)assert.ok(rule.selector.includes(`.${surface}`),`${rule.selector}: ${surface}`);
  assert.ok(rule.selector.includes(':not(:where(.ts-calendar-plugin, .ts-calendar-plugin *))'),'calendar descendants remain independent');
  assert.doesNotMatch(rule.selector,/\.markdown-|\.cm-|\.pdf-/);assert.ok(rule.nodes.every(node=>node.type==='decl'&&node.prop.startsWith('--ts-ui-')));
 });assert.equal(themes,2);
});

test('shared keyboard and motion selectors leave native Markdown, editor and PDF descendants alone',()=>{
 let checked=0;visual.walkRules(rule=>{
  if(!rule.selector.startsWith(':is(')||!/:focus-visible|:is\(button,select\)/.test(rule.selector))return;
  checked++;const selectors=selectorParser().astSync(rule.selector);selectors.each(selector=>{
   const guards:string[]=[];selector.walkPseudos(pseudo=>{if(pseudo.value===':not')guards.push(pseudo.toString());});
   for(const root of nativeRoots)assert.ok(guards.some(guard=>guard.includes(`.${root} *`)),`native ${root}: ${rule.selector}`);
  });
 });assert.ok(checked>=2);
});

test('palette state paint is enabled-only and disabled controls neutralize inherited legacy hover rules',()=>{
 let checked=0;interaction.walkRules(rule=>{
  if(!/:hover|\.is-current|\.is-active|\[aria-pressed=true\]/.test(rule.selector))return;
  if(!rule.nodes.some(node=>node.type==='decl'&&['background','color','border-color','box-shadow'].includes(node.prop)))return;
  checked++;assert.ok(rule.selector.includes(':not(:disabled)'),rule.selector);assert.ok(rule.selector.includes(':not([aria-disabled=true])'),rule.selector);
 });assert.ok(checked>=8);
 const disabled=declarations(interaction,'background').find(rule=>rule.selector.includes('.ts-button:is(:disabled,[aria-disabled=true])'));
 assert.equal(disabled?.value,'transparent');
 const icon=declarations(interaction,'color').find(rule=>rule.selector.includes('.ts-button:is(:disabled,[aria-disabled=true]) > span:first-child'));
 assert.equal(icon?.value,'inherit');
});

test('board elevation references shared tokens and chrome washes preserve accent text contrast',()=>{
 for(const [local,shared]of [['--ts-board-line','--ts-design-line'],['--ts-board-shadow','--ts-design-shadow'],['--ts-board-menu-shadow','--ts-design-overlay-shadow']]){
  const tokens=declarations(interaction,local).filter(rule=>!rule.value.includes('text-muted'));assert.ok(tokens.length);assert.ok(tokens.every(rule=>rule.value===`var(${shared})`),local);
 }
 const palettes=postcss.parse(readFileSync('styles.css','utf8'));
 const luminance=(rgb:number[])=>rgb.map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
 const rgb=(hex:string)=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
 for(const property of ['--ts-design-wash','--ts-design-hover'])for(const rule of declarations(visual,property)){
  const amount=Number(rule.value.match(/var\(--ts-accent,var\(--interactive-accent\)\) (\d+)%/)?.[1]);assert.ok(Number.isFinite(amount),rule.value);
  assert.ok(rule.value.includes('var(--background-primary)'),rule.value);
  for(const dark of [false,true])for(const palette of declarations(palettes,'--ts-accent').filter(palette=>palette.selector.startsWith(dark?'.theme-dark .ts-root':'.ts-root'))){
   const ink=rgb(palette.value),base=rgb(dark?'#1e1e1e':'#ffffff'),wash=ink.map((value,index)=>value*amount/100+base[index]*(1-amount/100));const a=luminance(ink),b=luminance(wash),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   assert.ok(contrast>=4.5,`${property}/${palette.value}/${amount}% contrast ${contrast.toFixed(2)}`);
  }
 }
});
