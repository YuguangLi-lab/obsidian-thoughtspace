import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,clone,type Board} from '../src/model';
import * as writing from '../src/writing';
import {writingListData} from '../src/writing-list';

const source=readFileSync('src/writing-view.ts','utf8');
function method(start:string){const a=source.indexOf(start);assert.ok(a>=0,start);const b=source.indexOf('\n private ',a+start.length);return source.slice(a,b<0?source.lastIndexOf('\n}'):b);}
class Element {
 children:Element[]=[];textContent='';scrollTop=42;value='';disabled=false;classes=new Set<string>();
 constructor(public tag='div',public cls=''){}
 createDiv(options:any=''){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 createEl(tag:string,options:any={}){const el=new Element(tag,options.cls||'');el.textContent=options.text||'';this.children.push(el);return el;}
 createSpan(options:any={}){return this.createEl('span',options);}
 setText(text:string){this.textContent=text;}
 empty(){this.children=[];}
 toggleClass(name:string,enabled:boolean){enabled?this.classes.add(name):this.classes.delete(name);}
 setAttribute(){}
}
function fixture(groups=40){
 const board=emptyBoard();board.writing={title:'研究文章',order:[],manuscript:'正文内容'.repeat(75000)};
 for(let i=0;i<groups;i++){
  const x=i*600;board.nodes.push({id:'g'+i,kind:'section',title:'分组 '+i,x,y:0,width:500,height:1000,color:'sand'});board.writing.order.push('g'+i);
  for(let j=0;j<9;j++)board.nodes.push({id:`g${i}-n${j}`,kind:'text',text:'材料 '+j,x:x+20,y:40+j*100,width:100,height:60,color:'slate'});
 }
 return board;
}
function harness(board:Board,extra:Record<string,unknown>={}){
 const counts={boardCopies:0,parts:0};
 const globals={...writing,writingListData,...extra,clone:(value:unknown)=>{if(value===board)counts.boardCopies++;return clone(value);},writingParts:(...args:Parameters<typeof writing.writingParts>)=>{counts.parts++;return writing.writingParts(...args);},setIcon(){},icons:{text:'type',section:'folder'},kinds:{text:'文本',section:'分组'}};
 const code='class View{'+method(' private matching(')+method(' private renderMaterials(')+method(' private renderLists(')+'};return View;';
 const View=new Function(...Object.keys(globals),transformSync(code,{loader:'ts'}).code)(...Object.values(globals));
 const view=Object.assign(new View(),{owner:{board},list:new Element(),outline:new Element(),titleInput:new Element(),contentEl:{ownerDocument:{}},totals:new Element(),query:'',filter:'all',mode:'outline',limit:100,entryDrafts:new Map(),entryToolbars:[],entryEditors:[],expandedGroups:new Set(),state:()=>board.writing,flushFields(){},fitTitle(){},dragRow(){},bindOutlineEntryKeys(){},renderStatus(){},action(parent:Element,label:string,_fn:unknown,_icon?:string,_iconOnly?:boolean,cls=''){return parent.createEl('button',{text:label,cls});}});
 return {view,counts};
}
test('rendering forty group summaries never copies the whole board or manuscript',()=>{
 const board=fixture(),before=JSON.stringify(board),{view,counts}=harness(board);
 view.renderLists();assert.equal(view.outline.children.filter((row:Element)=>row.cls==='ts-writing-entry').length,40);
 assert.equal(view.totals.textContent,'40 个编排项 · 360 份材料');assert.equal(view.list.scrollTop,42);assert.equal(JSON.stringify(board),before);
 assert.equal(counts.boardCopies,0,`whole-board copies: ${counts.boardCopies}; writingParts calls: ${counts.parts}`);
});
test('material and outline refresh share one projection, then rebuild after geometry and exclusion changes',()=>{
 const board=fixture(2);let builds=0;
 const {view}=harness(board,{writingListData:(input:Board)=>{builds++;return writingListData(input);}});
 view.renderLists();assert.equal(builds,1);
 board.nodes.find(node=>node.id==='g0-n0')!.x=10000;
 board.writing!.options={'g0-n1':{excluded:true}};
 view.renderLists();assert.equal(builds,2);assert.equal(view.totals.textContent,'2 个编排项 · 16 份材料');
 const row=view.outline.children[0],main=row.children[0].children[1];
 assert.equal(main.children[0].textContent,'分组章节 · 7 份材料');
 const children=row.children.find((el:Element)=>el.cls==='ts-writing-children')!;
 assert.equal(children.children[0].textContent,'材料 1');assert.ok(children.children[0].classes.has('is-excluded'));
 assert.equal(children.children[1].textContent,'材料 2');
});
test('group summaries match assembly semantics for overlapping, nested, folded and excluded groups',()=>{
 const board=fixture(12),first=board.nodes[0];
 board.nodes.push({...first,id:'outer',width:1200,height:1100,sectionFolded:true},{...first,id:'overlap',x:250,width:800},
  {...first,id:'on-boundary',kind:'image',x:0,y:0,width:500,height:1000},
  {...first,id:'outside',kind:'text',x:490,width:50},
  {...first,id:'non-writing-pdf',kind:'pdf'}, {...first,id:'subboard',kind:'board'});
 board.writing!.order.push('outer','overlap','missing','chapter','g0-n0');
 board.writing!.chapters=[{id:'chapter',title:'Introduction',body:'Chapter body'}];
 board.writing!.options={g0:{excluded:true},'g1-n0':{excluded:true},'g2-n1':{title:'Article alias',note:'Keep me',level:4}};
 const before=JSON.stringify(board),data=writingListData(board),unfiltered={...board,writing:{...board.writing!,options:undefined}};
 assert.deepEqual(data.items,writing.writingItems(board));assert.deepEqual(data.order,writing.writingOrder(board));assert.deepEqual(data.parts,writing.writingParts(board));
 for(const node of board.nodes.filter(n=>n.kind==='section')){
  const summary=data.group(node.id);
  assert.deepEqual(summary.children,writing.writingParts(unfiltered,[node.id]).slice(1).map(part=>part.node),node.id);
  assert.equal(summary.included,Math.max(0,writing.writingParts(board,[node.id]).length-1),node.id);
 }
 assert.equal(data.chapters.get('chapter')?.title,'Introduction');assert.deepEqual(data.group('missing'),{children:[],included:0});
 assert.equal(JSON.stringify(board),before);
});
test('group summaries do not read unrelated manuscript, edges or media payloads',()=>{
 const board=fixture(10);
 Object.defineProperty(board.writing,'manuscript',{get(){throw Error('must not read manuscript');}});
 Object.defineProperty(board,'edges',{get(){throw Error('must not read edges');}});
 board.nodes.push({id:'pdf',kind:'pdf',x:30,y:40,width:100,height:60,color:'sand',get text():string{throw Error('must not read media payload');}});
 const data=writingListData(board);for(let i=0;i<10;i++)assert.equal(data.group('g'+i).included,9);
});
test('fresh projections follow same-object edits, removals, additions and undo without stale members',()=>{
 const board=fixture(10),original=clone(board);
 assert.equal(writingListData(board).group('g0').included,9);
 board.nodes.find(node=>node.id==='g0-n0')!.y=2000;
 board.nodes=board.nodes.filter(node=>node.id!=='g0-n1');
 board.nodes.push({id:'added',kind:'text',text:'New',x:100,y:100,width:80,height:50,color:'sand'});
 board.writing!.options={added:{excluded:true}};
 const edited=writingListData(board);assert.equal(edited.group('g0').children.length,8);assert.equal(edited.group('g0').included,7);assert.ok(edited.byId.has('added'));assert.ok(!edited.byId.has('g0-n1'));
 Object.assign(board,original);const restored=writingListData(board);assert.equal(restored.group('g0').included,9);assert.ok(!restored.byId.has('added'));assert.ok(restored.byId.has('g0-n1'));
});
