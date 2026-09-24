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
class Element {
  children:Element[]=[];classes=new Set<string>();attributes:Record<string,string>={};
  classList={contains:(name:string)=>this.classes.has(name)};dataset:Record<string,string>={};
  value='';disabled=false;isConnected=true;title='';ariaLabel='';
  onchange?:()=>unknown;onclick?:()=>unknown;
  properties=new Map<string,string>();
  style={setProperty:(key:string,value:string)=>this.properties.set(key,value),
    getPropertyValue:(key:string)=>this.properties.get(key)||'',
    removeProperty:(key:string)=>this.properties.delete(key)};
  constructor(readonly tagName='div'){}
  createEl(tag:string,options:Options={}){
    const el=new Element(tag);el.value=options.value||'';
    for(const name of (options.cls||'').split(' ').filter(Boolean))el.addClass(name);
    for(const [key,value] of Object.entries(options.attr||{}))el.setAttribute(key,value);
    this.children.push(el);return el;
  }
  createSpan(options?:Options){return this.createEl('span',options);}
  createDiv(options:Options|string={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
  setAttribute(key:string,value:string){this.attributes[key]=value;if(key==='aria-label')this.ariaLabel=value;}
  addClass(name:string){this.classes.add(name);}
  toggleClass(name:string,on:boolean){if(on)this.classes.add(name);else this.classes.delete(name);}
  querySelectorAll(selector:string):Element[]{
    const tags=selector.split(',');return this.children.flatMap(el=>[...(tags.includes(el.tagName)?[el]:[]),...el.querySelectorAll(selector)]);
  }
  disconnect(){this.isConnected=false;this.children.forEach(el=>el.disconnect());}
  empty(){this.children.forEach(el=>el.disconnect());this.children=[];}
}
const deps={...model,reflowAutomaticMindmaps,validateBranches,sectionDisplayNode,selectionEdges,selectionFormatKey,inkLabels,textFontFamily,syncNodeGeometry,
  preserveToolbarFocus:()=>()=>{},setIcon:()=>{},Notice:class {},act:(fn:()=>unknown)=>fn(),
  button:(parent:Element,label:string,_icon:string,callback:()=>unknown)=>{
    const button=parent.createEl('button',{attr:{'aria-label':label}});button.onclick=callback;return button;
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
  return {view,owner,calls,control,choose};
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
