import {textBlockPadding} from '../src/text-sizing';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import {reflowAutomaticMindmaps,validateBranches} from '../src/mindmap';
import {sectionDisplayNode} from '../src/sections';
import {selectionEdges} from '../src/selection-edges';
import {selectionFormatKey} from '../src/selection-format';
import {inkLabels,textFontFamily} from '../src/text-tools';
import {syncNodeGeometry} from '../src/node-render-key';
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
  empty(){this.children.forEach(el=>el.disconnect());this.children=[];}
}
const deps={textBlockPadding,...model,reflowAutomaticMindmaps,validateBranches,sectionDisplayNode,selectionEdges,selectionFormatKey,inkLabels,textFontFamily,syncNodeGeometry,
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
  assert.equal(element.properties.has('--ts-card-body-size'),false);
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
 assert.equal(f.control('标题分割线').value,'none');assert.equal(f.control('边框线型').value,'dashed');assert.equal(f.calls.persist,0);
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
 f.view.positionNode({...node,sectionFolded:true},element);assert.equal(element.dataset.sectionDivider,'dotted');assert.equal((element.style as any).height,'72px');assert.equal(node.height,300);
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
 for(const [nodes,want] of [[[section()],['fill','border']],[[text('image',{kind:'image',file:'photo.png'})],['border']],[[text(),section()],['text','fill','border']]] as [model.Card[],string[]][]){
  const f=fixture(nodes);
  const panels=f.view.selectionTools.children.filter((e:Element)=>e.attributes['data-appearance-panel']&&!e.hidden);
  assert.equal(panels.length,1);assert.equal(panels[0].attributes['data-appearance-panel'],want[0]);
  assert.deepEqual(f.modes().map(e=>e.dataset.mode),want);
  assert.deepEqual(f.modes().filter(e=>e.getAttribute('aria-pressed')==='true').map(e=>e.dataset.mode),[want[0]]);
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
test('choosing the already visible mode does not rebuild controls or alter focus',()=>{
 const f=fixture(),mode=f.mode('text'),host=f.view.selectionTools as Element;
 mode.focus();host.scrollLeft=51;mode.onclick!();
 assert.equal(f.mode('text'),mode);assert.equal(host.ownerDocument.activeElement,mode);assert.equal(host.scrollLeft,51);
 assert.equal(f.view.appearanceTab,undefined);assert.equal(f.calls.persist,0);
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
function inlineFixture(){
 const f=fixture(),input=new Element('textarea',f.view.selectionTools.ownerDocument),snapshot={text:'alpha beta gamma',start:6,end:10,busy:false};
 let dispose:(()=>void)|undefined,commits=0,reads=0;
 const editor={input,snapshot:()=>{reads++;return {...snapshot};},replaceToolbar(next?:()=>void){dispose?.();dispose=next;},commit(){commits++;}};
 Object.assign(f.view,{inline:editor,inlineId:'text',inlineAppearance:false});f.view.renderSelectionTools();
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
