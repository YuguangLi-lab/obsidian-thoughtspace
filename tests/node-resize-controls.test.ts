import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {mountCardControlHover} from '../src/card-control-hover';
import type {Card} from '../src/model';

// Run the production rendering branch including its low-detail early return.
const source=readFileSync(process.env.RESIZE_SOURCE||'src/main.ts','utf8');
const start=source.indexOf('      const childCount=branches.children.get(n.id)');
const optionsEnd=source.indexOf('\n',start),controlsStart=source.indexOf("      if(n.kind!=='section'",optionsEnd);
const end=source.indexOf("      const header = el.createDiv('ts-node-header')",controlsStart);
assert.ok(start>=0&&optionsEnd>start&&controlsStart>optionsEnd&&end>controlsStart);
const branchModule={exports:{} as typeof import('../src/branch-controls')};
new Function('require','module','exports',transformSync(readFileSync('src/branch-controls.ts','utf8'),{loader:'ts',format:'cjs'}).code)(
 (name:string)=>{assert.equal(name,'obsidian');return{setIcon:()=>{}};},branchModule,branchModule.exports);
const render=new Function('n','el','detail','branches','button','TFile','cardDisplayTitle','childCandidates','renderBranchControls','setIcon','textExcerptPresentation','mountCardControlHover',
 transformSync(`const fileInfo=undefined,restoreFoldFocus=false,scope={register:()=>{}};for(const node of [n]){${source.slice(start,optionsEnd)}${source.slice(controlsStart,end)}}`,{loader:'ts'}).code);
class El{
 mindmapMounts=0;
 ownerDocument={defaultView:null};
 addEventListener(){}removeEventListener(){}
 children:El[]=[];classes=new Set<string>();attrs:Record<string,string>={};classList={toggle:()=>{}};
 constructor(public cls=''){}
 createEl(_tag:string,options:any={}){const el=new El(typeof options==='string'?options:options.cls);el.attrs={...options.attr};this.children.push(el);return el;}
 createDiv(options:any){return this.createEl('div',options);}
 createSpan(options:any){return this.createDiv(options);}
 addClass(cls:string){this.classes.add(cls);}
 toggleClass(cls:string,on:boolean){if(on)this.classes.add(cls);else this.classes.delete(cls);}
 setAttribute(name:string,value:string){this.attrs[name]=value;}
 querySelectorAll(selector:string):El[]{return this.children.flatMap(child=>[...(child.cls.split(' ').includes(selector.slice(1))?[child]:[]),...child.querySelectorAll(selector)]);}
}
function controls(kind:Card['kind'],detail:boolean,extra:Partial<Card>={}){
 const n:Card={id:'node',kind,width:280,height:100,x:0,y:0,color:'green',...extra},el=new El();
 const view={session:{blocked:false},addPorts:()=>{},foldBranches:()=>{},mountBoardMindmap:(node:Card,element:El)=>{assert.equal(node,n);assert.equal(element,el);element.mindmapMounts++;}};
 const button=(parent:El,_label:string,_icon:string,_run:()=>void,cls:string)=>parent.createDiv(cls);
 render.call(view,n,el,detail,{children:new Map([['node',['child']]])},button,class{},()=> 'Note',new Map(),branchModule.exports.renderBranchControls,()=>{},(body:string)=>({body}),mountCardControlHover);
 return el;
}
test('low-detail cards retain one resize handle without mounting a detailed preview',()=>{
 for(const kind of ['card','text','board','image','pdf','audio','video'] as const){
  const el=controls(kind,false);
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
test('compact branch fold suspends resizing and expansion restores the parent resize affordance',()=>{
 for(const detail of [false,true])for(const branchFolded of [false,true]){
  const el=controls('card',detail,{branchFolded});
  assert.equal(el.children.filter(c=>c.cls==='ts-resize').length,branchFolded?0:1);
 }
});
test('mindmap retains its component at every zoom instead of entering the title-only summary branch',()=>{
 for(const detail of [false,true])for(const state of [{},{locked:true},{collapsed:true}]){
  const el=controls('mindmap',detail,state);assert.equal(el.mindmapMounts,1);assert.equal(el.classes.has('ts-node-summary'),false);assert.equal(el.querySelectorAll('.ts-branch-toggle').length,0);assert.equal(el.children.filter(c=>c.cls==='ts-resize').length,('locked'in state||'collapsed'in state)?0:1);
 }
});
