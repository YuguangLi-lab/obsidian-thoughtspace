import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {cardFillHex,type Board,type Card} from '../src/model';
import {visibleBranchBoard} from '../src/mindmap';

// Run actual miniature rendering and the closure used by viewportOnly frames.
// DOM calls and stage dimensions are controlled; no browser globals are patched.
const source=readFileSync(process.env.MINIMAP_SOURCE||'src/main.ts','utf8');
const start=source.indexOf('  private mapPreview('),end=source.indexOf('  private async importBoardAttachments(',start);
assert.ok(start>=0&&end>start);
const View=new Function('visibleBranchBoard','cardFillHex',transformSync(`class View{${source.slice(start,end)}};return View`,{loader:'ts'}).code)(visibleBranchBoard,cardFillHex);
interface Options {cls?:string;text?:string;attr?:Record<string,string|number>}
interface Write {element:Element;name:string;value:string}
class Element {
 children:Element[]=[];parent?:Element;classes=new Set<string>();attrs=new Map<string,string>();style:Record<string,string>={};textContent='';onclick?: (event:{clientX:number;clientY:number})=>void;
 classList={add:(name:string)=>this.classes.add(name)};
 constructor(readonly writes:Write[],readonly tag='div',options:Options={}){for(const c of (options.cls||'').split(' ').filter(Boolean))this.classes.add(c);for(const[k,v]of Object.entries(options.attr||{}))this.attrs.set(k,String(v));this.textContent=options.text||'';}
 createSvg(tag:string,options:Options){const child=new Element(this.writes,tag,options);child.parent=this;this.children.push(child);return child;}
 createSpan(options:Options){return this.createSvg('span',options);}
 empty(){for(const child of this.children)child.parent=undefined;this.children=[];}
 toggleClass(name:string,on:boolean){if(on)this.classes.add(name);else this.classes.delete(name);}
 setAttribute(name:string,value:string){this.writes.push({element:this,name,value});this.attrs.set(name,value);}
 getAttribute(name:string){return this.attrs.get(name)||null;}
 getBoundingClientRect(){return {left:100,top:80,width:600,height:272};}
 descendants(cls:string):Element[]{return this.children.flatMap(c=>[...(c.classes.has(cls)?[c]:[]),...c.descendants(cls)]);}
}
const card=(id='n',patch:Partial<Card>={}):Card=>({id,kind:'card',file:`${id}.md`,x:100,y:50,width:200,height:100,color:'sand',...patch});
function fixture(nodes:Card[]=[card()],edges:Board['edges']=[]){
 const writes:Write[]=[],calls={selected:0,width:0,height:0,transform:0,persist:0},size={width:1000,height:700};
 const board:Board={version:3,nodes,edges,viewport:{x:0,y:0,zoom:1}},view=new View(),host=new Element(writes);
 Object.assign(view,{minimap:host,mapKey:'',session:{board,blocked:false,persist(){calls.persist++;}},selected:{has(){calls.selected++;return false;}},plugin:{settings:{showMinimap:true,previewLimit:100}},
  stage:{get clientWidth(){calls.width++;return size.width;},get clientHeight(){calls.height++;return size.height;}},transform(){calls.transform++;}});
 const render=()=>view.renderMinimap(),camera=()=>view.mapViewport?.(),frame=()=>host.descendants('ts-map-viewport')[0],svg=()=>host.descendants('ts-map-svg')[0];
 render();writes.length=0;calls.width=0;calls.height=0;
 return{view,board,host,size,writes,calls,render,camera,frame,svg};
}
const values=(el:Element)=>Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(el.getAttribute(k))]));
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('1200-node miniature renders all nodes without consulting preview selection or limits',()=>{
 const nodes=Array.from({length:1200},(_,i)=>card(String(i),{x:(i%40)*340,y:Math.floor(i/40)*220})),f=fixture(nodes),before=structuredClone(f.board);
 assert.equal(f.host.descendants('ts-map-node').length,1200);assert.equal(f.calls.selected,0,'miniatures have no selected-card detail rendering');
 const svg=f.svg();f.view.plugin.settings.previewLimit=1;f.render();assert.equal(f.svg(),svg);assert.equal(f.calls.selected,0);assert.deepEqual(f.board,before);
});

test('unchanged camera frames and cached full refreshes do not rewrite viewport attributes',()=>{
 const f=fixture(),svg=f.svg(),frame=f.frame();
 for(let i=0;i<120;i++)f.camera();for(let i=0;i<10;i++)f.render();
 assert.equal(f.writes.length,0);assert.equal(f.svg(),svg);assert.equal(f.frame(),frame);assert.equal(f.calls.width,130);assert.equal(f.calls.height,130,'stage size remains live');
});

test('horizontal and vertical camera movement update only the corresponding frame position',()=>{
 const f=fixture(),frame=f.frame(),before=values(frame),scale=Number(f.host.descendants('ts-map-node')[0].getAttribute('width'))/f.board.nodes[0].width;
 for(let i=1;i<=120;i++){f.board.viewport.x=i;f.camera();}
 assert.equal(f.writes.length,120);assert.ok(f.writes.every(w=>w.element===frame&&w.name==='x'));near(values(frame).x,before.x-120*scale);assert.equal(values(frame).y,before.y);
 f.writes.length=0;for(let i=1;i<=60;i++){f.board.viewport.y=-i;f.camera();}
 assert.equal(f.writes.length,60);assert.ok(f.writes.every(w=>w.name==='y'));near(values(frame).y,before.y+60*scale);assert.equal(values(frame).width,before.width);assert.equal(values(frame).height,before.height);
});

test('zoom and replacement saved views update position and size without rebuilding the miniature',()=>{
 const f=fixture(),svg=f.svg(),frame=f.frame();f.board.viewport={x:80,y:-50,zoom:1};f.camera();const initial=values(frame);f.writes.length=0;
 f.board.viewport.zoom=2;f.camera();const zoomed=values(frame);assert.equal(f.writes.length,4);near(zoomed.width,initial.width/2);near(zoomed.height,initial.height/2);
 f.writes.length=0;f.board.viewport={x:80,y:-50,zoom:1};f.camera();assert.deepEqual(values(frame),initial);assert.equal(f.writes.length,4);assert.equal(f.svg(),svg);
 f.writes.length=0;f.board.viewport={x:80,y:-50,zoom:1};f.camera();assert.equal(f.writes.length,0,'restoring equal numeric values is a no-op');
});

test('sidebar resizing reads live dimensions and changes only the affected viewport dimensions',()=>{
 const f=fixture(),frame=f.frame(),before=values(frame);f.size.width=750;f.camera();
 assert.deepEqual(f.writes.map(w=>w.name),['width']);near(values(frame).width,before.width*.75);assert.equal(values(frame).height,before.height);
 f.writes.length=0;f.size.height=350;f.camera();assert.deepEqual(f.writes.map(w=>w.name),['height']);near(values(frame).height,before.height/2);
 f.writes.length=0;f.camera();assert.equal(f.writes.length,0);assert.equal(f.calls.width,3);assert.equal(f.calls.height,3);
});

test('miniature click centers the requested point using current stage size and respects blocked boards',()=>{
 const f=fixture(),svg=f.svg();f.board.viewport={x:0,y:0,zoom:2};f.size.width=800;f.size.height=500;
 svg.onclick!({clientX:400,clientY:216});near(f.board.viewport.x,0);near(f.board.viewport.y,50);assert.equal(f.calls.transform,1);assert.equal(f.calls.persist,1);
 const before=structuredClone(f.board);f.view.session.blocked=true;svg.onclick!({clientX:110,clientY:90});assert.deepEqual(f.board,before);assert.equal(f.calls.persist,1);
});

test('branch and section folds rebuild visible miniature content and preserve logical geometry',()=>{
 const f=fixture([card('parent'),card('child',{x:500})],[{id:'edge',from:'parent',to:'child',kind:'branch',label:''}]),initial=f.svg();
 f.board.nodes[0].branchFolded=true;f.render();assert.notEqual(f.svg(),initial);assert.equal(f.host.descendants('ts-map-node').length,1);assert.equal(f.host.descendants('ts-map-edge').length,0);
 delete f.board.nodes[0].branchFolded;f.render();assert.equal(f.host.descendants('ts-map-node').length,2);assert.equal(f.host.descendants('ts-map-edge').length,1);
 const section=card('section',{kind:'section',file:undefined,title:'Group',x:0,y:0,width:900,height:600});f.board.nodes.unshift(section);f.render();const before=structuredClone(section);section.sectionFolded=true;f.render();
 assert.equal(f.host.descendants('ts-map-node').length,1);assert.equal(f.host.descendants('ts-map-node')[0].classes.has('ts-map-section'),true);assert.equal(section.width,before.width);assert.equal(section.height,before.height);delete section.sectionFolded;f.render();assert.equal(f.host.descendants('ts-map-node').length,3);
});

test('empty and hidden miniatures release the active viewport callback and rebuild when shown',()=>{
 const f=fixture(),first=f.svg();f.view.plugin.settings.showMinimap=false;f.render();assert.equal(f.host.children.length,0);assert.equal(f.view.mapViewport,undefined);assert.equal(f.view.mapKey,'');
 f.view.plugin.settings.showMinimap=true;f.render();assert.notEqual(f.svg(),first);assert.ok(f.view.mapViewport);f.board.nodes=[];f.render();assert.equal(f.host.classes.has('is-empty'),true);assert.equal(f.frame(),undefined);assert.equal(f.view.mapViewport,undefined);
 f.board.nodes=[card('again')];f.render();assert.equal(f.host.classes.has('is-empty'),false);assert.ok(f.frame());f.writes.length=0;f.camera();assert.equal(f.writes.length,0);
});
