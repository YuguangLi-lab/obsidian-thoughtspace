import * as cardStyles from '../src/card-style';
import {cardHeadingColors} from '../src/card-style-color';
import {nodeHasBorder,textBlockPadding,textFitsContent} from '../src/text-sizing';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import {reflowAutomaticMindmaps,validateBranches} from '../src/mindmap';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {sectionDisplayNode} from '../src/sections';
import {selectionEdges} from '../src/selection-edges';
import {selectionFormatKey} from '../src/selection-format';
import {inkLabels,textFontFamily} from '../src/text-tools';
import {syncNodeGeometry} from '../src/node-render-key';
import {cardControlLayout} from '../src/card-control-layout';
import {preserveToolbarFocus} from '../src/toolbar-focus';

const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing method range: ${start}`);
  return source.slice(a,b);
}
const methods=take('  private renderSelectionTools(){','  private renderInspector()')
  +take('  private requireOwner(','  async newText(')
  +take('  private positionNode(','  private applyInlineSize(');
const sessionMethods=take('  change(fn:','  persist() {');

// Exercise real toolbar callbacks and history. Only the host DOM, icons, focus,
// and persistence boundary are substitutes; fill edits must never measure text.
type Options={cls?:string;attr?:Record<string,string>;text?:string;type?:string;value?:string};
class Element extends EventTarget {
  children:Element[]=[];classes=new Set<string>();attributes:Record<string,string>={};
  classList={contains:(name:string)=>this.classes.has(name)};dataset:Record<string,string>={};
  parentElement:Element|null=null;ownerDocument:{body:unknown;activeElement:unknown};scrollLeft=0;
  value='';disabled=false;isConnected=true;hidden=false;title='';ariaLabel='';textContent='';
  onchange?:()=>unknown;onclick?:()=>unknown;onmousedown?:(event:{preventDefault():void})=>void;
  properties=new Map<string,string>();
  style={setProperty:(key:string,value:string)=>this.properties.set(key,value),
    getPropertyValue:(key:string)=>this.properties.get(key)||'',
    removeProperty:(key:string)=>this.properties.delete(key)};
  constructor(readonly tagName='div',doc?:Element['ownerDocument']){super();this.ownerDocument=doc||{body:{},activeElement:null};this.ownerDocument.activeElement??=this.ownerDocument.body;}
  createEl(tag:string,options:Options={}){
    const el=new Element(tag,this.ownerDocument);el.parentElement=this;el.value=options.value||'';el.textContent=options.text||'';
    for(const name of (options.cls||'').split(' ').filter(Boolean))el.addClass(name);
    for(const [key,value] of Object.entries(options.attr||{}))el.setAttribute(key,value);
    this.children.push(el);return el;
  }
  createSpan(options?:Options){return this.createEl('span',options);}
  createDiv(options:Options|string={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
  setAttribute(key:string,value:string){this.attributes[key]=value;if(key==='aria-label')this.ariaLabel=value;if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;}
  getAttribute(key:string){return this.attributes[key]??null;}
  append(el:Element){this.children=this.children.filter(child=>child!==el);el.parentElement=this;this.children.push(el);}
  contains(el:unknown):boolean{return el===this||this.children.some(child=>child.contains(el));}
  matches(selector:string){return selector.split(',').some(s=>s===':disabled'?this.disabled:s==='[hidden]'?this.hidden:s==='[aria-label]'?!!this.ariaLabel:s.startsWith('.')?this.classes.has(s.slice(1)):s===this.tagName);}
  focus(_options?:unknown){this.ownerDocument.activeElement=this;}
  addClass(name:string){this.classes.add(name);}
  toggleClass(name:string,on:boolean){if(on)this.classes.add(name);else this.classes.delete(name);}
  querySelectorAll(selector:string):Element[]{
    return this.children.flatMap(el=>[...(el.matches(selector)?[el]:[]),...el.querySelectorAll(selector)]);
  }
  disconnect(){if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;this.isConnected=false;this.children.forEach(el=>el.disconnect());}
  remove(){this.disconnect();if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
  empty(){this.children.forEach(el=>el.disconnect());this.children=[];}
}
const deps={...cardStyles,cardHeadingColors,nodeHasBorder,textBlockPadding,textFitsContent,...model,reflowAutomaticMindmaps,reflowReadingContent,validateBranches,sectionDisplayNode,selectionEdges,selectionFormatKey,inkLabels,textFontFamily,syncNodeGeometry,cardControlLayout,
  preserveToolbarFocus,setIcon:()=>{},Notice:class {},act:(fn:()=>unknown)=>fn(),
  markdownToolbar:(host:Element,editor:{replaceToolbar(dispose?:()=>void):void},disposeOuter?:()=>void)=>{host.createDiv({cls:'ts-markdown-tools'});editor.replaceToolbar(disposeOuter);},
  button:(parent:Element,label:string,_icon:string,callback:()=>unknown,cls?:string)=>{
    const button=parent.createEl('button',{cls,attr:{'aria-label':label}});button.onclick=callback;return button;
  },
  fitTextNode:()=>{throw Error('Background formatting must not resize text');},
};
function compile(body:string){return new Function(...Object.keys(deps),transformSync(body,{loader:'ts'}).code)(...Object.values(deps));}
const View=compile(`class View{${methods}};return View`),Session=compile(`class Session{${sessionMethods}};return Session`);
const text=(id='text',patch:Partial<model.Card>={}):model.Card=>({id,kind:'text',text:'中文 text\nkeeps its content',x:40,y:60,width:300,height:140,color:'rose',fontSize:24,textColor:'slate',borderWidth:2,customBorder:true,...patch});
const labels=['卡片样式','卡片颜色','自定义卡片颜色'] as const;
function fixture(nodes:model.Card[]=[text()],selected=nodes.map(n=>n.id)){
  const view=new View(),owner=new Session(),calls={persist:0,emit:0};
  Object.assign(owner,{board:{...model.emptyBoard(),nodes},history:new model.History(),blocked:false,
    persist(){calls.persist++;},emit(){calls.emit++;view.renderSelectionTools();}});
  Object.assign(view,{session:owner,closed:false,selected:new Set(selected),selectionTools:new Element(),
    batchFormatTarget:'nodes',batchEdgeScope:'internal',plugin:{},contentEl:{}});
  view.renderSelectionTools();
  const control=(label:string):Element=>{
    const found=(view.selectionTools as Element).querySelectorAll('select,input').find(el=>el.ariaLabel===label);
    assert.ok(found,`Missing ${label} control for text selection`);return found;
  };
  function choose(label:string,value:string){const input=control(label);input.value=value;input.onchange!();}
  const modes=()=>(view.selectionTools as Element).querySelectorAll('button').filter(el=>el.dataset.mode);
  const mode=(value:string)=>{const found=modes().find(el=>el.dataset.mode===value);assert.ok(found,`Missing ${value} mode`);return found;};
  const chooseMode=(value:string)=>mode(value).onclick!();
  return {view,owner,calls,control,choose,modes,mode,chooseMode};
}

for(const [label,value] of [['卡片颜色','green'],['自定义卡片颜色','#123abc'],['卡片颜色','none']]){
  test(`text ${label} ${value} clears transparency in one undoable operation`,()=>{
    const f=fixture([text('text',{transparent:true,fillColor:'blue'})]),before=model.clone(f.owner.board);
    f.choose(label,value);
    const expected={...before.nodes[0],fillColor:value};delete expected.transparent;
    assert.deepEqual(f.owner.board.nodes[0],expected);assert.equal(f.calls.persist,1);assert.equal(f.calls.emit,1);
    const after=model.clone(f.owner.board);assert.deepEqual(model.parseBoard(JSON.stringify(after)),after);
    assert.equal(f.control('卡片颜色').value,value);assert.equal(f.control('卡片样式').value,'solid');
    f.owner.undo();assert.deepEqual(f.owner.board,before);
    f.owner.undo(true);assert.deepEqual(f.owner.board,after);
    assert.equal(f.calls.persist,3);
  });
}

test('text transparency toggles retain the chosen custom fill and restore it on undo',()=>{
  const f=fixture([text('text',{fillColor:'#42a0ef'})]),before=model.clone(f.owner.board);
  assert.equal(f.control('自定义卡片颜色').value,'#42a0ef');
  f.choose('卡片样式','transparent');
  assert.deepEqual(f.owner.board.nodes[0],{...before.nodes[0],transparent:true});
  assert.equal(f.control('卡片颜色').value,'#42a0ef');
  f.choose('卡片样式','solid');assert.deepEqual(f.owner.board,{...before,version:3});
  f.owner.undo();assert.equal(f.owner.board.nodes[0].transparent,true);assert.equal(f.owner.board.nodes[0].fillColor,'#42a0ef');
});

test('mixed card/text selection updates both fills, leaving other selected kinds and unselected text intact',()=>{
  const nodes=[text('text',{fillColor:'blue',transparent:true}),text('card',{kind:'card',file:'note.md',fillColor:'rose',transparent:true}),
    text('section',{kind:'section'}),text('image',{kind:'image',file:'photo.png'}),text('outside',{fillColor:'green'})];
  const f=fixture(nodes,['text','card','section','image']),before=model.clone(f.owner.board);
  assert.equal(f.control('卡片颜色').value,'');
  f.choose('自定义卡片颜色','#987abc');
  for(let i=0;i<2;i++){
    const expected={...before.nodes[i],fillColor:'#987abc'};delete expected.transparent;
    assert.deepEqual(f.owner.board.nodes[i],expected);
  }
  assert.deepEqual(f.owner.board.nodes.slice(2),before.nodes.slice(2));assert.equal(f.calls.persist,1);
  f.owner.undo();assert.deepEqual(f.owner.board,before);
});

test('default text exposes background controls without inventing a saved fill',()=>{
  const f=fixture(),before=model.clone(f.owner.board);
  assert.equal(f.control('卡片颜色').value,'none');assert.equal(f.control('卡片样式').value,'solid');
  assert.deepEqual(f.owner.board,before);assert.equal(f.calls.persist,0);
});

for(const state of ['locked','blocked','busy','detached','switched','closed'])test(`text fill callbacks reject ${state} controls`,()=>{
  for(const label of labels){
    const f=fixture([text('text',state==='locked'?{locked:true}:{})]),control=f.control(label);
    if(state==='blocked')f.owner.blocked=true;
    if(state==='busy')f.view.inline={snapshot:()=>({busy:true})};
    if(state==='detached')f.view.selectionTools.empty();
    if(state==='switched')f.view.session={};
    if(state==='closed')f.view.closed=true;
    const before=model.clone(f.owner.board);control.value=label==='卡片样式'?'transparent':label==='卡片颜色'?'blue':'#112233';
    if(['blocked','switched','closed'].includes(state))assert.throws(()=>control.onchange!(),/白板已切换或暂停写入/);
    else assert.doesNotThrow(()=>control.onchange!());
    assert.deepEqual(f.owner.board,before);assert.equal(f.calls.persist,0,label);
  }
});

test('a text locked after toolbar creation cannot acquire a fill or transparency',()=>{
  for(const label of labels){
    const f=fixture(),control=f.control(label);f.owner.board.nodes[0].locked=true;
    const before=model.clone(f.owner.board);control.value=label==='卡片样式'?'transparent':label==='卡片颜色'?'blue':'#112233';
    control.onchange!();assert.deepEqual(model.clone(f.owner.board).nodes,before.nodes);
  }
});

test('positionNode applies and clears text fill and transparency without changing text geometry',()=>{
  const f=fixture(),element=new Element();
  f.view.positionNode(text('text',{fillColor:'blue'}),element);
  assert.equal(element.classes.has('has-card-fill'),true);assert.equal(element.properties.get('--ts-card-fill'),model.cardFillHex.blue);
  assert.equal(element.classes.has('is-transparent'),false);
  f.view.positionNode(text('text',{fillColor:'#abcdef',transparent:true}),element);
  assert.equal(element.properties.get('--ts-card-fill'),'#abcdef');assert.equal(element.classes.has('is-transparent'),true);
  f.view.positionNode(text('text',{fillColor:'none'}),element);
  assert.equal(element.classes.has('has-card-fill'),false);assert.equal(element.properties.has('--ts-card-fill'),false);assert.equal(element.classes.has('is-transparent'),false);
  assert.deepEqual(Object.fromEntries(Object.entries(element.style).filter(([,value])=>typeof value==='string')),
    {left:'40px',top:'60px',width:'300px',height:'140px',borderStyle:'',borderWidth:'2px'});
  assert.equal(element.properties.get('--ts-card-body-size'),'24px');
  assert.equal(element.properties.get('--ts-card-body-font'),textFontFamily(undefined));
});

const section=(id='group',patch:Partial<model.Card>={}):model.Card=>({id,kind:'section',title:'证据',x:0,y:0,width:480,height:300,color:'blue',...patch});
for(const [label,value]of [['分组背景','green'],['自定义分组背景','#784abc'],['标题分割线','dashed']])test(`section ${label} round trips and undoes without moving contents`,()=>{
 const f=fixture([section(),text('inside',{x:60,y:80,width:200,height:100})],['group']),before=model.clone(f.owner.board);
 f.choose(label,value);const after=model.clone(f.owner.board);
 assert.equal(after.nodes[0][label==='标题分割线'?'sectionDivider':'fillColor'],value);
 assert.deepEqual(after.nodes[1],before.nodes[1]);assert.deepEqual(after.viewport,before.viewport);
 assert.deepEqual(model.parseBoard(JSON.stringify(after)),after);assert.equal(f.calls.persist,1);
 f.owner.undo();assert.deepEqual(f.owner.board,before);f.owner.undo(true);assert.deepEqual(f.owner.board,after);
});
test('section transparency retains custom color and default controls preserve legacy data',()=>{
 const f=fixture([section('group',{fillColor:'#abcdef'})]),before=model.clone(f.owner.board);
 assert.equal(f.control('标题分割线').value,'none');assert.equal(f.modes().some(m=>m.dataset.mode==='border'),true);assert.equal(f.calls.persist,0);
 f.choose('分组样式','transparent');assert.equal(f.owner.board.nodes[0].transparent,true);assert.equal(f.owner.board.nodes[0].fillColor,'#abcdef');
 f.choose('分组样式','solid');assert.deepEqual(f.owner.board.nodes[0],before.nodes[0]);
 f.choose('标题分割线','solid');f.choose('标题分割线','none');assert.equal(Object.hasOwn(f.owner.board.nodes[0],'sectionDivider'),false);
 f.choose('分组背景','none');assert.equal(f.owner.board.nodes[0].fillColor,'none');assert.equal(f.owner.board.nodes[0].transparent,undefined);
});

test('batch section appearance changes only selected frames and exposes mixed values',()=>{
 const f=fixture([section('g1',{fillColor:'blue'}),section('g2',{x:600,fillColor:'rose'}),text(),section('outside',{x:1200})],['g1','g2','text']),before=model.clone(f.owner.board);
 assert.equal(f.control('分组背景').value,'');f.choose('自定义分组背景','#123456');
 assert.equal(f.owner.board.nodes[0].fillColor,'#123456');assert.equal(f.owner.board.nodes[1].fillColor,'#123456');assert.deepEqual(f.owner.board.nodes.slice(2),before.nodes.slice(2));
 f.owner.undo();assert.deepEqual(f.owner.board,before);
});
for(const stale of ['locked','selection','detached','invalid'])test(`section appearance rejects ${stale} changes without a transaction`,()=>{
 for(const label of ['分组背景','自定义分组背景','标题分割线']){
  const f=fixture([section()]),control=f.control(label),before=model.clone(f.owner.board);
  if(stale==='locked'){f.owner.board.nodes[0].locked=true;before.nodes[0].locked=true;}
  if(stale==='selection')f.view.selected=new Set(['other']);if(stale==='detached')f.view.selectionTools.empty();
  control.value=stale==='invalid'?'not-a-valid-option':label==='分组背景'?'rose':label==='自定义分组背景'?'#123456':'dashed';control.onchange!();
  assert.deepEqual(f.owner.board,before);assert.equal(f.calls.persist,0);
 }
});
test('section fill and divider remain present in folded display geometry and clear on reset',()=>{
 const f=fixture([section()]),element=new Element(),node=section('group',{fillColor:'green',sectionDivider:'dotted',borderWidth:0});
 f.view.positionNode(node,element);assert.equal(element.properties.get('--ts-card-fill'),model.cardFillHex.green);assert.equal(element.dataset.sectionDivider,'dotted');assert.equal(element.properties.get('--ts-section-divider-width'),'1px');
 f.view.positionNode({...node,sectionFolded:true},element);assert.equal(element.dataset.sectionDivider,'dotted');assert.equal((element.style as any).height,'40px');assert.equal(node.height,300);
 f.view.positionNode(section('group',{transparent:true}),element);assert.equal(element.properties.has('--ts-card-fill'),false);assert.equal(element.classes.has('is-transparent'),true);assert.equal(element.dataset.sectionDivider,'none');
});


test('direct editing modes show one applicable panel and never persist a view-only change',()=>{
 const f=fixture(),before=model.clone(f.owner.board);
 const panels=()=>f.view.selectionTools.children.filter((e:Element)=>e.attributes['data-appearance-panel']);
 assert.deepEqual(panels().filter((e:Element)=>!e.hidden).map((e:Element)=>e.attributes['data-appearance-panel']),['text']);
 assert.deepEqual(f.modes().map(e=>e.dataset.mode),['markdown','text','fill','border']);
 assert.deepEqual(f.modes().map(e=>e.ariaLabel),['编辑 Markdown','文字样式','背景样式','边框样式']);
 for(const tab of ['fill','border','text']){
  f.chooseMode(tab);assert.equal(f.view.appearanceTab,tab);
  assert.deepEqual(f.modes().filter(e=>e.getAttribute('aria-pressed')==='true').map(e=>e.dataset.mode),[tab]);
  assert.deepEqual(panels().filter((e:Element)=>!e.hidden).map((e:Element)=>e.attributes['data-appearance-panel']),[tab]);
 }
 assert.deepEqual(f.owner.board,before);assert.equal(f.calls.persist,0);
});
test('group, image and mixed selections expose only applicable editing modes',()=>{
 for(const [nodes,want] of [[[section()],['fill','border']],[[text('image',{kind:'image',file:'photo.png'})],[]],[[text(),section()],['text','fill','border']]] as [model.Card[],string[]][]){
  const f=fixture(nodes);
  const panels=f.view.selectionTools.children.filter((e:Element)=>e.attributes['data-appearance-panel']&&!e.hidden);
  assert.equal(panels.length,want.length?1:0);if(want.length)assert.equal(panels[0].attributes['data-appearance-panel'],want[0]);
  assert.deepEqual(f.modes().map(e=>e.dataset.mode),want);
  assert.deepEqual(f.modes().filter(e=>e.getAttribute('aria-pressed')==='true').map(e=>e.dataset.mode),[]);
 }
});
test('stale or disabled mode buttons cannot change a new selection or closed board',()=>{
 for(const stale of ['selection','owner','closed','detached','disabled','busy']){
  const f=fixture(),control=f.mode('fill');
  if(stale==='selection')f.view.selected=new Set(['other']);if(stale==='owner')f.view.session={};if(stale==='closed')f.view.closed=true;if(stale==='detached')f.view.selectionTools.empty();
  if(stale==='disabled')control.disabled=true;if(stale==='busy')f.view.inline={snapshot:()=>({busy:true})};
  control.onclick!();assert.equal(f.view.appearanceTab,undefined,stale);assert.equal(f.calls.persist,0);
 }
});
test('appearance values start collapsed and repeated mode activation toggles without persisting',()=>{
 const f=fixture(),host=f.view.selectionTools as Element,before=model.clone(f.owner.board);
 assert.equal(host.classes.has('is-appearance-collapsed'),true);
 assert.equal(f.mode('text').getAttribute('aria-expanded'),'false');
 for(let i=0;i<4;i++){
  const mode=f.mode('text');mode.focus();host.scrollLeft=51;mode.onclick!();
  assert.equal(f.view.appearanceExpanded,i%2===0);
  assert.equal(host.classes.has('is-appearance-collapsed'),i%2!==0);
  assert.equal(f.mode('text').getAttribute('aria-expanded'),String(i%2===0));
  assert.equal(host.ownerDocument.activeElement,f.mode('text'));assert.equal(host.scrollLeft,51);
 }
 assert.deepEqual(f.owner.board,before);assert.equal(f.calls.persist,0);
});
test('an expanded inline appearance mode remains stable on repeated activation',()=>{
 const f=inlineFixture();f.chooseMode('text');const mode=f.mode('text'),before={...f.snapshot};
 mode.focus();mode.onclick!();assert.equal(f.mode('text'),mode);assert.equal(f.view.selectionTools.ownerDocument.activeElement,mode);
 assert.deepEqual(f.snapshot,before);assert.equal(f.commits(),0);
});
test('appearance mode replacement retains keyboard focus on the activated mode and toolbar scroll',()=>{
 const f=fixture(),mode=f.mode('fill'),host=f.view.selectionTools as Element;
 const commandbar=new Element('div',host.ownerDocument);commandbar.addClass('ts-commandbar');commandbar.append(host);commandbar.scrollLeft=137;
 mode.focus();mode.onclick!();
 assert.notEqual(f.mode('fill'),mode);assert.equal(host.ownerDocument.activeElement,f.mode('fill'));assert.equal(commandbar.scrollLeft,137);assert.equal(f.calls.persist,0);
});
test('Markdown mode starts inline editing only for an eligible current node',()=>{
 for(const state of ['current','locked','blocked','selection','detached']){
  const f=fixture(),mode=f.mode('markdown'),starts:string[]=[];f.view.startInlineEdit=(id:string)=>starts.push(id);
  if(state==='locked')f.owner.board.nodes[0].locked=true;if(state==='blocked')f.owner.blocked=true;
  if(state==='selection')f.view.selected.clear();if(state==='detached')f.view.selectionTools.empty();
  mode.onclick!();assert.deepEqual(starts,state==='current'?['text']:[],state);assert.equal(f.calls.persist,0);
 }
});
test('locked or blocked nodes keep appearance inspectable and Markdown unavailable',()=>{
 for(const state of ['locked','blocked']){
  const f=fixture([text('text',state==='locked'?{locked:true}:{})]);
  if(state==='blocked'){f.owner.blocked=true;f.view.renderSelectionTools();}
  assert.equal(f.mode('markdown').disabled,true);assert.equal(f.mode('border').disabled,false);
  f.chooseMode('border');assert.equal(f.mode('border').getAttribute('aria-pressed'),'true');assert.equal(f.control('边框粗细').disabled,true);assert.equal(f.calls.persist,0);
 }
});
function inlineFixture(nodes:model.Card[]=[text()]){
 const f=fixture(nodes),input=new Element('textarea',f.view.selectionTools.ownerDocument),snapshot={text:'alpha beta gamma',start:6,end:10,busy:false};
 let dispose:(()=>void)|undefined,commits=0,reads=0;
 const editor={input,snapshot:()=>{reads++;return {...snapshot};},replaceToolbar(next?:()=>void){dispose?.();dispose=next;},commit(){commits++;}};
 Object.assign(f.view,{inline:editor,inlineId:nodes[0].id,inlineAppearance:false});f.view.renderSelectionTools();
 return{...f,input,snapshot,editor,commits:()=>commits,reads:()=>reads};
}
test('inline keyboard mode changes preserve the draft selection and return to editor only for Markdown',()=>{
 const f=inlineFixture(),before={...f.snapshot},board=model.clone(f.owner.board);assert.equal(f.mode('markdown').getAttribute('aria-pressed'),'true');
 for(const mode of ['fill','border','text']){
  f.mode(mode).focus();f.chooseMode(mode);assert.equal(f.view.inline,f.editor);assert.equal(f.view.inlineAppearance,true);
  assert.equal(f.view.selectionTools.ownerDocument.activeElement,f.mode(mode));assert.deepEqual(f.editor.snapshot(),before);
 }
 f.chooseMode('markdown');assert.equal(f.view.inlineAppearance,false);assert.equal(f.view.selectionTools.ownerDocument.activeElement,f.input);
 assert.equal(f.mode('markdown').getAttribute('aria-pressed'),'true');assert.deepEqual(f.editor.snapshot(),before);assert.deepEqual(f.owner.board,board);assert.equal(f.commits(),0);assert.equal(f.calls.persist,0);
});
test('pointer mode changes keep editor focus and selected text without committing the draft',()=>{
 const f=inlineFixture(),before={...f.snapshot};f.input.focus();
 for(const mode of ['fill','border','text','markdown']){
  const control=f.mode(mode);let prevented=false;control.onmousedown?.({preventDefault(){prevented=true;}});
  if(!prevented)control.focus();control.onclick!();
  assert.equal(f.input.ownerDocument.activeElement,f.input,mode);assert.deepEqual(f.editor.snapshot(),before);assert.equal(f.view.inline,f.editor);
 }
 assert.equal(f.commits(),0);assert.equal(f.calls.persist,0);
});
test('an already selected Markdown mode neither rebuilds nor refocuses the active draft',()=>{
 const f=inlineFixture(),mode=f.mode('markdown');mode.focus();const before={...f.snapshot};mode.onclick!();
 assert.equal(f.mode('markdown'),mode);assert.equal(f.input.ownerDocument.activeElement,mode);assert.deepEqual(f.editor.snapshot(),before);assert.equal(f.commits(),0);
});
test('replaced inline editor cannot be focused by the prior Markdown mode callback',()=>{
 const f=inlineFixture();f.chooseMode('fill');const mode=f.mode('markdown'),replacement={...f.editor,input:new Element('textarea',f.input.ownerDocument)};
 f.view.inline=replacement;mode.focus();mode.onclick!();
 assert.equal(f.view.inline,replacement);assert.equal(f.view.inlineAppearance,true);assert.equal(f.input.ownerDocument.activeElement,mode);assert.equal(f.commits(),0);assert.equal(f.calls.persist,0);
});
test('live busy state blocks mode callbacks before the next toolbar notification',()=>{
 for(const current of ['markdown','fill']){
  const f=inlineFixture();if(current==='fill')f.chooseMode(current);
  const control=f.mode(current==='markdown'?'fill':'markdown'),before={...f.snapshot};f.snapshot.busy=true;
  control.onclick!();assert.equal(f.view.inlineAppearance,current==='fill');assert.equal(f.mode(current).getAttribute('aria-pressed'),'true');
  assert.deepEqual(f.editor.snapshot(),{...before,busy:true});assert.equal(f.commits(),0);assert.equal(f.calls.persist,0);
 }
});
test('draft notifications block busy modes and locked edits while keeping appearance inspection available',()=>{
 for(const current of ['markdown','fill'])for(const reason of ['busy','blocked','locked']){
  const f=inlineFixture();if(current==='fill')f.chooseMode(current);const before={...f.snapshot};
  if(reason==='busy')f.snapshot.busy=true;if(reason==='blocked')f.owner.blocked=true;if(reason==='locked')f.owner.board.nodes[0].locked=true;
  f.input.dispatchEvent(new Event('select'));
  assert.deepEqual(f.modes().filter(mode=>mode.disabled).map(mode=>mode.dataset.mode),reason==='busy'?['markdown','text','fill','border']:['markdown'],`${current} ${reason}`);
  if(current==='fill')assert.ok((f.view.selectionTools as Element).querySelectorAll('select,input').every(control=>control.disabled),`${reason} blocks property edits`);
  if(reason==='busy')f.snapshot.busy=false;if(reason==='blocked')f.owner.blocked=false;if(reason==='locked')delete f.owner.board.nodes[0].locked;
  f.input.dispatchEvent(new Event('select'));assert.ok(f.modes().every(mode=>!mode.disabled),`${current} ${reason} recovered`);
  assert.equal(f.view.inline,f.editor);assert.deepEqual(f.editor.snapshot(),before);assert.equal(f.commits(),0);assert.equal(f.calls.persist,0);
 }
});
test('rebuilt modes leave no callbacks able to change an earlier mode or focus its draft',()=>{
 const f=inlineFixture(),stale=f.mode('fill');f.chooseMode('border');const current=f.mode('border');current.focus();stale.onclick!();
 assert.equal(f.view.appearanceTab,'border');assert.equal(f.mode('border'),current);assert.equal(f.input.ownerDocument.activeElement,current);assert.equal(f.commits(),0);
});
test('switching Markdown and appearance releases old draft subscriptions and final disposal stops all mode updates',()=>{
 const f=inlineFixture(),previous:Element[]=[];
 for(let index=0;index<8;index++){
  previous.push(...f.modes());f.chooseMode(index%2?'markdown':'fill');
 }
 f.snapshot.busy=true;f.input.dispatchEvent(new Event('select'));
 assert.ok(f.modes().every(mode=>mode.disabled));assert.ok(previous.every(mode=>!mode.disabled),'detached controls must not receive new draft state');
 f.editor.replaceToolbar();const reads=f.reads();f.snapshot.busy=false;f.input.dispatchEvent(new Event('select'));
 assert.equal(f.reads(),reads,'disposed modes must stop reading the draft');assert.ok(f.modes().every(mode=>mode.disabled));
 assert.equal(f.commits(),0);assert.equal(f.calls.persist,0);
});
test('custom card color rejects changed selection and invalid values before starting history',()=>{
 for(const stale of ['selection','invalid']){
  const f=fixture(),color=f.control('自定义卡片颜色'),before=model.clone(f.owner.board);
  if(stale==='selection')f.view.selected=new Set(['other']);color.value=stale==='invalid'?'bad':'#abcdef';color.onchange!();
  assert.deepEqual(f.owner.board,before);assert.equal(f.calls.persist,0);
 }
});

for(const kind of ['image','pdf','audio','video','board'] as const)test(`${kind}: no border category or border controls even with legacy overrides`,()=>{
 const f=fixture([text(kind,{kind,customBorder:true,borderWidth:4,borderStyle:'dotted'})]);
 assert.ok(!f.modes().some(m=>m.dataset.mode==='border'));
 assert.ok(!f.view.selectionTools.querySelectorAll('select,input').some((e:Element)=>e.ariaLabel?.startsWith('边框')));
 assert.equal(f.view.selectionTools.classes.has('is-visible'),false);
 assert.equal(f.calls.persist,0);
});
for(const [label,value,key] of [['边框线型','dashed','borderStyle'],['边框粗细','3','borderWidth'],['边框颜色','blue','color']] as const)test(`mixed selection ${label} changes only text and notes`,()=>{
 const nodes=[text('text'),text('card',{kind:'card',file:'note.md'}),...(['image','pdf','audio','video','board'] as const).map(kind=>text(kind,{kind,borderWidth:4,borderStyle:'dotted'}))];
 const f=fixture(nodes),before=model.clone(f.owner.board);f.choose(label,value);
 assert.equal(f.owner.board.nodes[0][key],label==='边框粗细'?3:value);assert.equal(f.owner.board.nodes[1][key],label==='边框粗细'?3:value);
 assert.deepEqual(f.owner.board.nodes.slice(2),before.nodes.slice(2));f.owner.undo();assert.deepEqual(f.owner.board,before);
});
test('stale border callbacks recheck node kind instead of applying borders to converted media',()=>{
 const f=fixture([text()]),control=f.control('边框线型');Object.assign(f.owner.board.nodes[0],{kind:'image',file:'image.png'});
 const before=model.clone(f.owner.board.nodes[0]);control.value='dashed';control.onchange!();assert.deepEqual(f.owner.board.nodes[0],before);
});

for(const [label,value,key] of [['边框线型','dashed','borderStyle'],['边框粗细','3','borderWidth'],['边框颜色','blue','color']] as const)test(`group ${label} changes frame only and undoes`,()=>{
 const f=fixture([section(),text('inside')],['group']),before=model.clone(f.owner.board);
 assert.deepEqual(f.modes().map(m=>m.dataset.mode),['fill','border']);f.choose(label,value);
 assert.equal(f.owner.board.nodes[0][key],label==='边框粗细'?3:value);assert.deepEqual(f.owner.board.nodes[1],before.nodes[1]);
 const el=new Element();f.view.positionNode({...f.owner.board.nodes[0],sectionFolded:true},el);
 assert.equal((el.style as any).borderWidth,label==='边框粗细'?'3px':'');
 f.owner.undo();assert.deepEqual(f.owner.board,before);
});

test('table cards have no outer-frame controls and mixed border changes skip their grid',()=>{
 const table=text('table',{text:'| A | B |\n| --- | --- |\n| 1 | 2 |'}),f=fixture([table]);
 assert.ok(!f.modes().some(m=>m.dataset.mode==='border'));const el=new Element();f.view.positionNode(table,el);assert.equal((el.style as any).borderWidth,'0px');assert.equal(el.classes.has('is-table-card'),true);
 const mixed=fixture([table,text('regular')]),before=model.clone(table);mixed.choose('边框粗细','3');assert.deepEqual(mixed.owner.board.nodes[0],before);assert.equal(mixed.owner.board.nodes[1].borderWidth,3);
});

const note=(id='note',patch:Partial<model.Card>={})=>text(id,{kind:'card',file:`${id}.md`,transparent:true,...patch});
const gallery=(f:ReturnType<typeof fixture>)=>(f.view.selectionTools as Element).querySelectorAll('.ts-card-style-option');
const chooseCardStyle=(f:ReturnType<typeof fixture>,value:cardStyles.CardStyleChoice)=>{
 const control=gallery(f).find(option=>option.dataset.style===value);assert.ok(control,`Missing ${value} card style`);return control;
};
for(const style of ['band','paper','index','sticky'] as const)test(`${style} gallery applies one reversible appearance change without changing source content or geometry`,()=>{
 const f=fixture([note()]),before=model.clone(f.owner.board);
 assert.deepEqual(gallery(f).map(option=>option.dataset.style),['transparent','solid','band','paper','index','sticky']);
 assert.equal(chooseCardStyle(f,'transparent').getAttribute('aria-pressed'),'true');
 chooseCardStyle(f,style).onclick!();
 assert.deepEqual(f.owner.board,{...before,version:3,nodes:[{...before.nodes[0],cardStyle:style}]});
 assert.equal(f.calls.persist,1);assert.equal(chooseCardStyle(f,style).getAttribute('aria-pressed'),'true');
 const after=model.clone(f.owner.board);f.owner.undo();assert.deepEqual(f.owner.board,before);
 f.owner.undo(true);assert.deepEqual(f.owner.board,after);assert.equal(chooseCardStyle(f,style).getAttribute('aria-pressed'),'true');
 chooseCardStyle(f,style).onclick!();assert.equal(f.calls.persist,3,'same style is a no-op after redo');
});
test('mixed card gallery edits only eligible notes and keeps tables media and locked unrelated objects intact',()=>{
 const nodes=[note(),text('table',{text:'| A |\n| --- |\n| 1 |'}),text('image',{kind:'image',file:'image.png'}),section('group',{locked:true})],f=fixture(nodes),before=model.clone(f.owner.board);
 chooseCardStyle(f,'band').onclick!();
 assert.equal(f.owner.board.nodes[0].cardStyle,'band');assert.deepEqual(model.clone(f.owner.board).nodes.slice(1),before.nodes.slice(1));
 assert.equal(f.calls.persist,1);
});
test('card gallery callbacks revalidate locks owner selection attachment and busy drafts',()=>{
 for(const state of ['initial-lock','live-lock','blocked','selection','owner','closed','detached','busy'] as const){
  const f=fixture([note('note',state==='initial-lock'?{locked:true}:{})]),control=chooseCardStyle(f,'band');
  if(state==='live-lock')f.owner.board.nodes[0].locked=true;if(state==='blocked')f.owner.blocked=true;
  if(state==='selection')f.view.selected.clear();if(state==='owner')f.view.session={};if(state==='closed')f.view.closed=true;
  if(state==='detached')f.view.selectionTools.empty();if(state==='busy')f.view.inline={snapshot:()=>({busy:true})};
  const before=model.clone(f.owner.board);
  if(state==='blocked')assert.throws(()=>control.onclick!(),/暂停写入/);else control.onclick!();
  assert.deepEqual(f.owner.board,before,state);assert.equal(f.calls.persist,0,state);
 }
});
for(const style of ['band','paper','index','sticky'] as const)test(`switching to ${style} during inline editing preserves the draft selection and has independent board undo`,()=>{
 const f=inlineFixture([note()]),before={...f.snapshot},board=model.clone(f.owner.board);f.input.focus();f.chooseMode('card');
 const option=chooseCardStyle(f,style);let prevented=false;option.onmousedown?.({preventDefault(){prevented=true;}});assert.equal(prevented,true);
 option.onclick!();assert.equal(f.view.inline,f.editor);assert.deepEqual(f.editor.snapshot(),before);assert.equal(f.commits(),0);
 assert.equal(f.input.ownerDocument.activeElement,f.input);assert.equal(f.owner.board.nodes[0].cardStyle,style);
 f.owner.undo();assert.deepEqual(f.owner.board,board);assert.equal(f.view.inline,f.editor);assert.deepEqual(f.editor.snapshot(),before);
});
test('busy inline notifications disable card gallery choices and enable them again after recovery',()=>{
 const f=inlineFixture([note()]);f.chooseMode('card');assert.equal(gallery(f).length,6);assert.ok(gallery(f).every(option=>!option.disabled));
 f.snapshot.busy=true;f.input.dispatchEvent(new Event('select'));
 assert.ok(gallery(f).every(option=>option.disabled),'visible style choices should agree with the busy editor state');
 f.snapshot.busy=false;f.input.dispatchEvent(new Event('select'));assert.ok(gallery(f).every(option=>!option.disabled));
 assert.equal(f.calls.persist,0);assert.equal(f.commits(),0);
});

test('gallery previews use the shared card color and fall back for mixed colors',()=>{
 for(const [fills,expected] of [[['#227766','#227766'],'#227766'],[['#227766','#cc4477'],'']] as const){
  const f=fixture(fills.map((fillColor,i)=>note(`note-${i}`,{fillColor})));
  const picker=(f.view.selectionTools as Element).querySelectorAll('.ts-card-style-picker')[0];
  assert.equal(picker.style.getPropertyValue('--ts-card-heading-color'),expected);
  assert.ok(gallery(f).every(option=>option.getAttribute('aria-pressed')==='true'||option.getAttribute('aria-pressed')==='false'));
 }
});
