import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {clone,colorNames,emptyBoard,type Board} from '../src/model';
import {patchSelectionEdges,selectionEdges} from '../src/selection-edges';

class Element {
 children:Element[]=[];parent?:Element;attrs:Record<string,string>={};value='';text='';disabled=false;attached=true;title='';onchange?:()=>void;onclick?:()=>void;
 constructor(public tag='div'){}
 get isConnected():boolean{return this.attached&&(!this.parent||this.parent.isConnected);}
 createEl(tag:string,options:any={}):Element{const child=new Element(tag);child.parent=this;child.value=options.value??'';child.text=options.text??'';child.attrs=options.attr??{};this.children.push(child);return child;}
 createDiv(options:any={}):Element{return this.createEl('div',options);}
 createSpan(options:any={}):Element{return this.createEl('span',options);}
 addClass(){}
 empty(){for(const child of this.children)child.attached=false;this.children=[];}
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
}
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  private buildSelectionTools('),end=source.indexOf('  private renderInspector()',start);
const singleStart=source.indexOf('  private buildSingleEdgeTools('),single=singleStart<0?'':source.slice(singleStart,source.indexOf('  private buildBatchEdgeTools(',singleStart));
const compiled=transformSync(`class View {${single}\n${source.slice(start,end)}}\nreturn View;`,{loader:'ts'}).code;
function fixture(){
 const host=new Element(),errors:unknown[]=[],history:Board[]=[],board=emptyBoard();board.version=3;
 board.nodes=['a','b','c'].map((id,i)=>({id,kind:'text',text:id,x:i*240,y:0,width:200,height:120,color:'green'}));
 board.edges=[{id:'ab',from:'a',to:'b',label:'证据',kind:'branch',style:'curve',fromSide:'right',toSide:'left'},{id:'bc',from:'b',to:'c',label:'关联',style:'straight'}];
 const owner={board,blocked:false,change(run:(b:Board)=>void){history.push(clone(this.board));run(this.board);}};
 const button=(parent:Element,label:string,_icon:string,run:()=>void)=>{const el=parent.createEl('button',{attr:{'aria-label':label}});el.onclick=run;return el;};
 let renderEdgeFormatControls:unknown;
 try{const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/edge-format-controls.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>name==='obsidian'?{setIcon:()=>{}}:name==='./model'?{colorNames}:{},module,module.exports);renderEdgeFormatControls=module.exports.renderEdgeFormatControls;}catch{/* Baseline code has no shared controls. */}
 const View=new Function('preserveToolbarFocus','button','colorNames','act','renderEdgeFormatControls','patchSelectionEdges','selectionEdges',compiled)(()=>()=>{},button,colorNames,(run:()=>unknown)=>{try{return run();}catch(error){errors.push(error);}},renderEdgeFormatControls,patchSelectionEdges,selectionEdges);
 const view=new View();Object.assign(view,{session:owner,selectionTools:host,selectedEdge:'ab',selected:new Set(),requireOwner(expected:unknown){if(expected!==view.session)throw Error('owner changed');return owner;},unifyEdgeStyle(){},labelEdge(){},revealNode(){}});
 const rebuild=()=>view.buildSelectionTools();rebuild();
 const control=(label:string)=>{const el=host.all().find(el=>el.tag==='select'&&el.attrs['aria-label']===label);assert.ok(el,label);return el;};
 const change=(el:Element,value:string)=>{el.value=value;el.onchange?.();};
 return{view,owner,host,board,history,errors,control,change,rebuild};
}
test('single edge controls must not edit an old selection while retained in a delayed event',()=>{const f=fixture(),input=f.control('连线颜色');f.view.selectedEdge='bc';f.change(input,'rose');assert.equal(f.history.length,0);assert.equal(f.board.edges[0].color,undefined);});
test('detached single edge controls are inert',()=>{const f=fixture(),input=f.control('连线线型');input.attached=false;f.change(input,'dashed');assert.equal(f.history.length,0);});
test('single and batch styling both protect locked endpoints',()=>{const f=fixture();f.board.nodes[1].locked=true;f.rebuild();assert.equal(f.control('连线路径').disabled,true);f.change(f.control('连线路径'),'straight');assert.equal(f.history.length,0);});
test('single edge edit preserves parent relation, ports and unrelated edges in one transaction',()=>{const f=fixture(),before=clone(f.board);f.change(f.control('连线颜色'),'purple');assert.equal(f.history.length,1);assert.deepEqual(f.history[0],before);assert.deepEqual(f.board.edges[0],{...before.edges[0],color:'purple'});assert.deepEqual(f.board.edges[1],before.edges[1]);});
test('a newly locked endpoint or deleted edge is rechecked on use',()=>{const f=fixture(),input=f.control('连线路径');f.board.nodes[0].locked=true;f.change(input,'straight');assert.equal(f.history.length,0);delete f.board.nodes[0].locked;f.board.edges=f.board.edges.filter(e=>e.id!=='ab');f.change(input,'straight');assert.equal(f.history.length,0);});

test('closing the view invalidates still-connected single-edge controls',()=>{
 const f=fixture(),before=clone(f.board);f.view.closed=true;f.change(f.control('连线颜色'),'rose');assert.deepEqual(f.board,before);assert.equal(f.history.length,0);
 });
