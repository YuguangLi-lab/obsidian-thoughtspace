import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {clone,emptyBoard,type Board,type Card,type Edge} from '../src/model';
import * as connections from '../src/connections';
import * as flow from '../src/connection-flow';
import * as sections from '../src/sections';

// Run the real connection lifecycle, including conflict validation at release.
// The substitutes provide only the host's DOM and session write boundary.
const source=readFileSync(process.env.CONNECTION_PREVIEW_SOURCE||'src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const methods=take('  private connectionNodes(','  private markerId')+take('  private cancelConnection(','  private createConnection(');
const deps={clone,...connections,...flow,...sections,act:(fn:()=>unknown)=>fn()};
const View=new Function(...Object.keys(deps),transformSync(`return class View{${methods}}`,{loader:'ts'}).code)(...Object.values(deps));
class Element {
 isConnected=true;textContent='';classes=new Set<string>();attributes=new Map<string,string>();paths=0;
 classList={contains:(name:string)=>this.classes.has(name),toggle:(name:string,on:boolean)=>{if(on)this.classes.add(name);else this.classes.delete(name);}};
 addClass(name:string){this.classes.add(name);}removeClass(name:string){this.classes.delete(name);}hasClass(name:string){return this.classes.has(name);}
 setText(value:string){this.textContent=value;}getAttribute(name:string){return this.attributes.get(name)??null;}
 setAttribute(name:string,value:string){if(name==='d')this.paths++;this.attributes.set(name,value);}
 remove(){this.isConnected=false;}
 querySelector(){return undefined;}
}
const node=(id:string,x:number,text=id):Card=>({id,kind:'text',text,x,y:0,width:150,height:100,color:'sand'});
function fixture(size=3){
 const nodes=[node('a',0),node('b',400),node('c',700)],rawEdges:Edge[]=Array.from({length:size},(_,i)=>({id:'e'+i,from:'a',to:'b',label:'edge '+i,style:'curve'}));
 const stats={edgeReads:0,writes:0,updates:0},board:Board={...emptyBoard(),version:3,nodes,edges:[],viewport:{x:0,y:0,zoom:1},defaultEdgeStyle:'straight'};
 const watchEdges=(edges:Edge[])=>{board.edges=new Proxy(edges,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))stats.edgeReads++;return Reflect.get(target,key,receiver);}});};watchEdges(rawEdges);
 const view=new View(),capture=new Set<number>(),stage=Object.assign(new Element(),{focus(){},setPointerCapture:(id:number)=>capture.add(id),hasPointerCapture:(id:number)=>capture.has(id),releasePointerCapture:(id:number)=>capture.delete(id),getBoundingClientRect:()=>({left:0,top:0,right:1000,bottom:800})});
 const owner={board,blocked:false,change(fn:(board:Board)=>void){stats.writes++;fn(board);}};
 Object.assign(view,{session:owner,connectFrom:'a',connectSide:'right',connectionCandidates:nodes,positions:new Map(nodes.map(n=>[n.id,new Element()])),
  plugin:{settings:{defaultEdgeStyle:'curve'}},stage,svg:{createSvg:()=>new Element()},flowHint:new Element(),selected:new Set(),
  linkDrag:{id:1,x:150,y:50,moved:true,owner,edge:{id:'e'+(size-1),end:'to',expected:JSON.stringify(rawEdges[size-1])}},
  setSectionTool(){},syncSelectionTool(){},updateSelection(){stats.updates++;},point:(x:number,y:number)=>({x,y})
 });
 const event=(x=410,y=50)=>({pointerId:1,clientX:x,clientY:y,button:0,preventDefault(){},stopPropagation(){}});
 const preview=(x=410,y=50)=>view.previewConnection(x,y);
 const path=()=>view.linkPreview?.getAttribute('d');
 return{view,board,nodes,rawEdges,stats,watchEdges,event,preview,path,owner,capture};
}
function countTextSplits(run:()=>void){
 const original=String.prototype.split;let characters=0;
 String.prototype.split=function(this:string,separator:unknown,limit?:number){if(separator==='\n')characters+=this.length;return Reflect.apply(original,this,[separator,limit]) as string[];};
 try{run();return characters;}finally{String.prototype.split=original;}
}

test('120 reconnect preview frames locate an edge once and then validate its live slot',t=>{
 const f=fixture(1199);for(let frame=0;frame<120;frame++)f.preview(410+frame/100);
 t.diagnostic(`${f.stats.edgeReads} edge array reads for 120 frames / 1199 edges`);
 assert.ok(f.stats.edgeReads<=1199+240,`unexpected repeated full searches: ${f.stats.edgeReads}`);
 assert.deepEqual(f.view.linkTarget,{id:'b',side:'left'});assert.equal(f.view.linkPreview.paths,1);
 assert.equal(f.stats.writes,0);assert.equal(f.stats.updates,0);
});

test('a large text target supplies at most 24 characters to each hint newline split',t=>{
 const f=fixture();f.nodes[1].text='Title\n'+'long text\n'.repeat(10000);
 const characters=countTextSplits(()=>{for(let frame=0;frame<120;frame++)f.preview(410+frame/100);});
 t.diagnostic(`${characters} newline split input characters / 120 frames`);
 assert.equal(characters,120*24);assert.equal(f.view.flowHint.textContent,'连接至 Title · 松手完成');assert.equal(f.stats.writes,0);
});

test('hint truncation preserves empty lines, CRLF, Unicode and title/file precedence',()=>{
 const f=fixture();
 for(const text of ['', '\nsecond line','line\r\nrest','🙂研究主题🙂'.repeat(20),'abcdefghijklmnopqrstuvwx\nrest','first line\n'+'body\n'.repeat(100)]){
  f.nodes[1].text=text;f.preview();assert.equal(f.view.flowHint.textContent,`连接至 ${text.split('\n')[0].slice(0,24)||'对象'} · 松手完成`);
 }
 f.nodes[1].file='folder/文章.md';f.preview();assert.equal(f.view.flowHint.textContent,'连接至 文章 · 松手完成');
 f.nodes[1].title='手动标题';f.preview();assert.equal(f.view.flowHint.textContent,'连接至 手动标题 · 松手完成');
});

test('in-place edge reorder and same-id replacement use current styles and rebuild only changed paths',()=>{
 const f=fixture();f.preview();const edge=f.rawEdges.pop()!;f.rawEdges.unshift(edge);edge.style='elbow';f.preview();
 const expected=(style:Edge['style'])=>connections.connectionPath(f.nodes[0],f.nodes[1],{style,fromSide:'right',toSide:'left'}).path;
 assert.equal(f.path(),expected('elbow'));const reads=f.stats.edgeReads;f.preview();assert.ok(f.stats.edgeReads-reads<=2);
 f.rawEdges[0]={...edge,style:'straight'};f.preview();assert.equal(f.path(),expected('straight'));
 assert.equal(f.view.linkPreview.paths,3);assert.equal(f.stats.writes,0);
});

test('array replacement, deletion and reinsertion never return a stale edge object',()=>{
 const f=fixture();f.preview();const edge={...f.rawEdges[2],style:'elbow' as const};
 f.watchEdges([edge,...f.rawEdges.slice(0,2)]);f.preview();assert.match(f.path(),/ Q /);
 f.board.edges.splice(0,1);f.preview();assert.equal(f.path(),connections.connectionPath(f.nodes[0],f.nodes[1],{style:'straight',fromSide:'right',toSide:'left'}).path);
 f.board.edges.push({...edge,style:'curve'});f.preview();assert.equal(f.path(),connections.connectionPath(f.nodes[0],f.nodes[1],{style:'curve',fromSide:'right',toSide:'left'}).path);
 assert.equal(f.stats.writes,0);
});

test('reconnect release retains optimistic conflict checks after live edits or deletion',()=>{
 for(const change of ['label','style','same-id replacement','deletion','duplicate'] as const){
  const f=fixture();f.preview();
  if(change==='label')f.rawEdges[2].label='external edit';
  else if(change==='style')f.rawEdges[2].style='elbow';
  else if(change==='same-id replacement')f.rawEdges[2]={...f.rawEdges[2],label:'replaced'};
  else if(change==='deletion')f.rawEdges.pop();
  else f.rawEdges.push({id:'duplicate',from:'a',to:'c',label:'',fromSide:'right',toSide:'left'});
  const before=JSON.stringify(f.board);f.view.finishLinkDrag(f.event(710));
  assert.equal(JSON.stringify(f.board),before,change);assert.equal(f.stats.writes,0,change);assert.equal(f.view.linkDrag,undefined);
 }
});

test('valid reconnect after reordering or array replacement commits only the intended edge',()=>{
 for(const replace of [false,true]){
  const f=fixture(),edge=f.rawEdges[2];f.preview();
  if(replace)f.watchEdges([edge,...f.rawEdges.slice(0,2)]);else{f.rawEdges.pop();f.rawEdges.unshift(edge);}
  f.view.finishLinkDrag(f.event(710));
  assert.equal(f.stats.writes,1);const updated=f.board.edges.find(e=>e.id===edge.id)!;
  assert.equal(updated.to,'c');assert.equal(updated.label,edge.label);assert.equal(updated.style,edge.style);
  assert.ok(f.board.edges.filter(e=>e.id!==edge.id).every(e=>e.to==='b'));assert.equal(f.view.selectedEdge,edge.id);
 }
});

test('connection cancellation releases capture and clears gesture-local lookup state',()=>{
 const f=fixture(),edge={id:'e2',end:'to' as const,expected:JSON.stringify(f.rawEdges[2])};
 f.view.linkDrag=undefined;f.view.startLinkDrag(f.event(150),'a','right',edge);assert.equal(f.capture.has(1),true);
 f.preview();f.view.finishLinkDrag(f.event(710),true);
 assert.equal(f.capture.size,0);assert.equal(f.view.linkDrag,undefined);assert.equal(f.view.connectionIndex,undefined);assert.equal(f.stats.writes,0);
});

test('ordinary new connection previews do not scan the board edge collection',()=>{
 const f=fixture(1199);f.view.linkDrag.edge=undefined;
 for(let frame=0;frame<120;frame++)f.preview(410+frame/100);
 assert.equal(f.stats.edgeReads,0);assert.equal(f.view.linkPreview.paths,1);assert.equal(f.stats.writes,0);
});
