import test from 'node:test';
import assert from 'node:assert/strict';
import {EdgeLayer} from '../src/edge-layer';
import {emptyBoard,type Card} from '../src/model';
import {connectionPath} from '../src/connections';

class SvgElement {
 children:SvgElement[]=[];parent?:SvgElement;attributes=new Map<string,string>();dataset:Record<string,string>={};textContent='';
 ownerDocument={createElementNS:(_namespace:string,tag:string)=>new SvgElement(tag)};
 style={setProperty:()=>{}};
 classList={toggle:(name:string,on:boolean)=>{const classes=new Set((this.getAttribute('class')||'').split(' ').filter(Boolean));if(on)classes.add(name);else classes.delete(name);this.setAttribute('class',[...classes].join(' '));}};
 constructor(readonly tag:string){}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 setAttribute(key:string,value:string){this.attributes.set(key,value);}
 hasAttribute(key:string){return this.attributes.has(key);}
 removeAttribute(key:string){this.attributes.delete(key);}
 appendChild(child:SvgElement){child.parent=this;this.children.push(child);return child;}
 get nextSibling():SvgElement|null{return this.parent?.children[this.parent.children.indexOf(this)+1]||null;}
 insertBefore(child:SvgElement,next:SvgElement|null){if(child===next)return child;if(child.parent)child.parent.children=child.parent.children.filter(item=>item!==child);const at=next?this.children.indexOf(next):this.children.length;assert.ok(at>=0);this.children.splice(at,0,child);child.parent=this;return child;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;}
}
function fixture(size=1200){
 let ids=0;
 const nodes:Card[]=Array.from({length:size},(_,i)=>({get id(){ids++;return 'n'+i;},kind:'text',text:'Card '+i,color:'sand',x:i<2?i*250:10000+i*200,y:0,width:150,height:100}));
 const board={...emptyBoard(),nodes,edges:[{id:'edge',from:'n0',to:'n1',label:'',style:'straight' as const}]};
 const root=new SvgElement('svg'),layer=new EdgeLayer(root as unknown as SVGSVGElement,'polish',()=>{});
 return{board,root,layer,reads:()=>ids,reset:()=>{ids=0;},render:()=>layer.render(board,1000,700)};
}

test('sparse connections do not index every unrelated card on every camera frame',t=>{
 const f=fixture();f.render();const row=f.root.children[1],path=row.children[0].getAttribute('d');f.reset();
 for(let frame=0;frame<120;frame++){f.board.viewport.x=frame/100;f.render();}
 t.diagnostic(`120 camera frames / 1200 cards / 1 connection: ${f.reads()} node identity reads`);
 assert.ok(f.reads()<=480,`Repeated full-board endpoint indexing: ${f.reads()} reads`);
 assert.equal(f.root.children[1],row);assert.equal(row.children[0].getAttribute('d'),path);
});

test('endpoint reuse observes live replacements, reorders, deletions and changed endpoint IDs',()=>{
 const f=fixture(6);f.render();const row=f.root.children[1],path=row.children[0],original=path.getAttribute('d');
 f.board.nodes[1]={...f.board.nodes[1],x:450};f.render();assert.notEqual(path.getAttribute('d'),original);
 const replacement=path.getAttribute('d');f.board.nodes.reverse();f.render();assert.equal(path.getAttribute('d'),replacement);
 f.board.edges[0].to='n2';f.board.nodes.find(n=>n.id==='n2')!.x=700;f.render();assert.notEqual(path.getAttribute('d'),replacement);
 f.board.nodes=f.board.nodes.filter(n=>n.id!=='n2');f.render();assert.equal(row.parent,undefined);
 f.board.nodes.unshift({id:'n2',kind:'text',text:'replacement',color:'blue',x:700,y:0,width:150,height:100});f.render();assert.equal(f.root.children.length,2);
 f.layer.clear();assert.equal(f.root.children.length,1);f.render();assert.equal(f.root.children.length,2);
});

test('offscreen connections reuse endpoint hints without retaining SVG rows',t=>{
 const f=fixture();f.board.edges[0].from='n1198';f.board.edges[0].to='n1199';f.render();assert.equal(f.root.children.length,1);f.reset();
 for(let frame=0;frame<120;frame++){f.board.viewport.x=frame;f.render();}
 t.diagnostic(`120 offscreen frames: ${f.reads()} node identity reads`);assert.equal(f.reads(),240);assert.equal(f.root.children.length,1);
 f.board.viewport.x=-f.board.nodes[1198].x;f.render();assert.equal(f.root.children.length,2);
});

test('a same-length reorder rebuilds the live endpoint index at most once per frame',()=>{
 const f=fixture();f.board.edges.push({id:'second',from:'n1',to:'n0',label:'',style:'straight'});f.render();f.board.nodes.reverse();f.reset();f.render();
 assert.ok(f.reads()<=1202,`Reorder scanned ${f.reads()} node identities`);
 f.reset();f.render();assert.equal(f.reads(),4);
 for(const edge of f.board.edges){const row=f.root.children.find(child=>child.dataset.edge===edge.id)!;const a=f.board.nodes.find(node=>node.id===edge.from)!,b=f.board.nodes.find(node=>node.id===edge.to)!;assert.equal(row.children[0].getAttribute('d'),connectionPath(a,b,edge).path);}
});

test('dense connections retain one linear identity scan per render and can return to sparse mode',t=>{
 const f=fixture();f.board.edges=Array.from({length:1199},(_,i)=>({id:'e'+i,from:'n'+i,to:'n'+(i+1),label:'',style:'straight' as const}));f.render();f.reset();
 for(let frame=0;frame<120;frame++){f.board.viewport.x=frame/100;f.render();}
 t.diagnostic(`120 dense frames / 1199 connections: ${f.reads()} node identity reads`);assert.equal(f.reads(),144000);
 f.board.edges.splice(1);f.render();f.reset();f.render();assert.equal(f.reads(),2);
});

test('clear and an empty edge list release cached endpoint hints',()=>{
 const f=fixture();f.render();f.layer.clear();f.reset();f.render();assert.equal(f.reads(),1200);
 const edges=f.board.edges;f.board.edges=[];f.render();assert.equal(f.root.children.length,1);f.board.edges=edges;f.reset();f.render();assert.equal(f.reads(),1200);
});

test('missing endpoints are resolved again when a same-length node replacement restores the ID',()=>{
 const f=fixture();f.render();const original=f.board.nodes[1];f.board.nodes[1]={...original,id:'temporary'};f.render();assert.equal(f.root.children.length,1);
 f.board.nodes[4]={...original,x:400};f.render();const row=f.root.children[1];assert.ok(row);assert.equal(row.children[0].getAttribute('d'),connectionPath(f.board.nodes[0],f.board.nodes[4],f.board.edges[0]).path);
});

test('moving endpoints use their live coordinates while unchanged sparse hints stay bounded',t=>{
 const f=fixture();f.render();const row=f.root.children[1],path=row.children[0];f.reset();
 for(let frame=0;frame<120;frame++){f.board.nodes[1].x=250+frame;f.board.nodes[1].y=frame/2;f.render();}
 t.diagnostic(`120 connected drag frames: ${f.reads()} node identity reads`);assert.equal(f.reads(),240);
 assert.equal(f.root.children[1],row);assert.equal(path.getAttribute('d'),connectionPath(f.board.nodes[0],f.board.nodes[1],f.board.edges[0]).path);
});

test('immutable board snapshots and endpoint count changes never retain previous node objects',()=>{
 const f=fixture();f.render();const row=f.root.children[1],path=row.children[0];
 f.board.nodes=f.board.nodes.map(node=>({...node,x:node.x+50,y:node.y+80}));f.render();assert.equal(f.root.children[1],row);
 assert.equal(path.getAttribute('d'),connectionPath(f.board.nodes[0],f.board.nodes[1],f.board.edges[0]).path);
 f.board.nodes.unshift({id:'inserted',kind:'text',text:'new',color:'rose',x:0,y:0,width:100,height:100});f.render();
 assert.equal(path.getAttribute('d'),connectionPath(f.board.nodes[1],f.board.nodes[2],f.board.edges[0]).path);
 f.board.nodes.splice(0,1);f.render();assert.equal(path.getAttribute('d'),connectionPath(f.board.nodes[0],f.board.nodes[1],f.board.edges[0]).path);
});
