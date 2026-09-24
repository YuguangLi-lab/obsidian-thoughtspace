import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import type {Card} from '../src/model';

// Run the production rendering branch including its low-detail early return.
const source=readFileSync(process.env.RESIZE_SOURCE||'src/main.ts','utf8');
const start=source.indexOf('      const childCount=branches.children.get(n.id)');
const end=source.indexOf("      const header = el.createDiv('ts-node-header')",start);
assert.ok(start>=0&&end>start);
const branchModule={exports:{} as typeof import('../src/branch-controls')};
new Function('require','module','exports',transformSync(readFileSync('src/branch-controls.ts','utf8'),{loader:'ts',format:'cjs'}).code)(
 (name:string)=>{assert.equal(name,'obsidian');return{setIcon:()=>{}};},branchModule,branchModule.exports);
const render=new Function('n','el','detail','branches','button','TFile','cardDisplayTitle','childCandidates','renderBranchControls',
 transformSync(`const fileInfo=undefined;for(const node of [n]){${source.slice(start,end)}}`,{loader:'ts'}).code);
class El{
 children:El[]=[];classes=new Set<string>();attrs:Record<string,string>={};classList={toggle:()=>{}};
 constructor(public cls=''){}
 createEl(_tag:string,options:any={}){const el=new El(typeof options==='string'?options:options.cls);el.attrs={...options.attr};this.children.push(el);return el;}
 createDiv(options:any){return this.createEl('div',options);}
 createSpan(options:any){return this.createDiv(options);}
 addClass(cls:string){this.classes.add(cls);}
 setAttribute(name:string,value:string){this.attrs[name]=value;}
 querySelectorAll(selector:string):El[]{return this.children.flatMap(child=>[...(child.cls.split(' ').includes(selector.slice(1))?[child]:[]),...child.querySelectorAll(selector)]);}
}
function controls(kind:Card['kind'],detail:boolean,extra:Partial<Card>={}){
 const n:Card={id:'node',kind,width:280,height:100,x:0,y:0,color:'green',...extra},el=new El();
 const view={session:{blocked:false},addPorts:()=>{},foldBranches:()=>{}};
 const button=(parent:El,_label:string,_icon:string,_run:()=>void,cls:string)=>parent.createDiv(cls);
 render.call(view,n,el,detail,{children:new Map([['node',['child']]])},button,class{},()=> 'Note',new Map(),branchModule.exports.renderBranchControls);
 return el;
}
test('low-detail cards retain one resize handle without mounting a detailed preview',()=>{
 for(const kind of ['card','text','board','image','pdf'] as const){
  const el=controls(kind,false,{branchFolded:true});
  assert.ok(el.classes.has('ts-node-summary'),kind);
  assert.equal(el.children.filter(c=>c.cls==='ts-resize').length,1,kind);
  assert.equal(el.querySelectorAll('.ts-branch-toggle').length,1,kind);
 }
});
test('detailed and summary resize controls stay absent on locked or collapsed objects',()=>{
 for(const detail of [false,true])for(const state of [{locked:true},{collapsed:true}]){
  const el=controls('card',detail,state);
  assert.equal(el.children.filter(c=>c.cls==='ts-resize').length,0);
 }
});
test('branch collapse does not remove the parent resize affordance in either detail mode',()=>{
 for(const detail of [false,true])for(const branchFolded of [false,true]){
  const el=controls('card',detail,{branchFolded});
  assert.equal(el.children.filter(c=>c.cls==='ts-resize').length,1);
 }
});
