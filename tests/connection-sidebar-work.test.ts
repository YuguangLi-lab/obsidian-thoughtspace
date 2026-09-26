import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {transformSync} from 'esbuild';
import * as connections from '../src/connections';
import * as sections from '../src/sections';
import type {Board,Card} from '../src/model';

const source=process.env.CONNECTION_SIDEBAR_SOURCE||'src';
function load(file:string,deps:Record<string,unknown>={},globals:Record<string,unknown>={}){
 const module={exports:{} as any};new Function('require','module','exports',...Object.keys(globals),transformSync(readFileSync(join(source,file+'.ts'),'utf8'),{loader:'ts',format:'cjs'}).code)((key:string)=>deps[key],module,module.exports,...Object.values(globals));return module.exports;
}
const flow=load('connection-flow',{'./connections':connections,'./sections':sections}),sidebar=load('sidebar-content');
const n=(id:string,x=0,y=0):Card=>({id,kind:'text',text:id,x,y,width:160,height:80,color:'sand'});
const board=(nodes:Card[],edges:Board['edges']):Board=>({version:3,nodes,edges,viewport:{x:0,y:0,zoom:1}});

test('unrelated connection checks do not read every node before rejecting the endpoint pair',t=>{
 let reads=0;const nodes=Array.from({length:1200},(_,i)=>new Proxy(n('n'+i),{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}));
 const b=board(nodes,Array.from({length:1200},(_,i)=>({id:'e'+i,from:'n0',to:'n'+i,label:''})));
 assert.equal(flow.duplicateConnection(b,{from:'n1198',to:'n1199'}),false);t.diagnostic(`unrelated pair: ${reads} node identifiers read`);assert.equal(reads,0);
});

test('many parallel connection candidates compare effective ports without serializing them',t=>{
 let serializations=0;const watched=load('connection-flow',{'./connections':connections,'./sections':sections},{JSON:{...JSON,stringify:(value:unknown)=>{serializations++;return JSON.stringify(value);}}});
 const b=board([n('a'),n('b',400)],Array.from({length:1200},(_,i)=>({id:'e'+i,from:'a',to:'b',label:'',fromSide:'top',toSide:'bottom'})));
 assert.equal(watched.duplicateConnection(b,{from:'a',to:'b',fromSide:'right',toSide:'left'}),false);t.diagnostic(`1200 matching pairs: ${serializations} port serializations`);assert.equal(serializations,0);
 b.edges.push({id:'match',from:'a',to:'b',label:''});assert.equal(watched.duplicateConnection(b,{from:'a',to:'b',fromSide:'right',toSide:'left'}),true);
 assert.equal(watched.duplicateConnection(b,{from:'a',to:'b'},'match'),false);
});

test('duplicate checks preserve first node identity, folded frame ports, missing nodes and direction',()=>{
 const a={...n('a'),kind:'section' as const,sectionFolded:true,height:700},b=n('b',0,150),f=board([a,b,n('a',800)], [{id:'ab',from:'a',to:'b',label:''}]);
 const ports=connections.connectionSides(sections.sectionDisplayNode(a),b,{});
 assert.equal(flow.duplicateConnection(f,{from:'a',to:'b',...ports}),true);assert.equal(flow.duplicateConnection(f,{from:'b',to:'a'}),false);assert.equal(flow.duplicateConnection(f,{from:'a',to:'b'},'ab'),false);
 f.nodes.splice(1,1);assert.equal(flow.duplicateConnection(f,{from:'a',to:'b'}),false);
});

test('reconnect keeps optimistic conflict protection and removes branch kind only on endpoint change',()=>{
 const b=board([n('a'),n('b',400),n('c',600)], [{id:'edge',from:'a',to:'b',label:'full label',kind:'branch',color:'blue',dashed:true}]);
 const before=JSON.stringify(b),stale='stale';assert.equal(flow.reconnectEdge(b,'edge','to','c','top',stale),false);assert.equal(JSON.stringify(b),before);
 assert.equal(flow.reconnectEdge(b,'edge','to','b','top',JSON.stringify(b.edges[0])),true);assert.equal(b.edges[0].kind,'branch');
 assert.equal(flow.reconnectEdge(b,'edge','to','c','top',JSON.stringify(b.edges[0])),true);assert.equal(b.edges[0].kind,undefined);assert.equal(b.edges[0].label,'full label');assert.equal(b.edges[0].dashed,true);
});

function focusFixture(paths:string[],oldPath='A.md'){
 const doc:{activeElement?:Control;defaultView?:unknown}={};let labelReads=0;
 class Control{
  dataset:Record<string,string>;focused=0;
  constructor(path:string,readonly label='预览'){this.dataset={notePath:path};}
  getAttribute(name:string){if(name==='aria-label'){labelReads++;return this.label;}return null;}
  closest(selector:string){return selector.includes('[data-note-path]')?this:null;}
  focus(options:{preventScroll:boolean}){assert.equal(options.preventScroll,true);this.focused++;doc.activeElement=this;}
 }
 doc.defaultView={HTMLElement:Control};const old=new Control(oldPath),controls=paths.map(path=>new Control(path));doc.activeElement=old;
 const host={scrollTop:130,ownerDocument:doc,contains:(value:unknown)=>value===old,replaceChildren(){doc.activeElement=undefined;this.scrollTop=0;},querySelectorAll:()=>controls};
 return{doc,host,controls,reads:()=>labelReads,refresh:()=>sidebar.replaceSidebarContents(host,{childNodes:[]},true)};
}
test('ambiguous sidebar focus stops after the second matching control without choosing the wrong row',t=>{
 const f=focusFixture(['A.md','A.md',...Array.from({length:4000},(_,i)=>`Note ${i}.md`)]);f.refresh();
 assert.equal(f.doc.activeElement,undefined);assert.ok(f.controls.every(item=>!item.focused));assert.equal(f.host.scrollTop,130);t.diagnostic(`ambiguous focus: ${f.reads()} labels read`);assert.equal(f.reads(),3);
});
test('unique sidebar focus still checks the entire replacement and restores its row and scroll',()=>{
 const f=focusFixture(['B.md','A.md','C.md']);f.refresh();assert.equal(f.doc.activeElement,f.controls[1]);assert.equal(f.reads(),4);assert.equal(f.host.scrollTop,130);
 const missing=focusFixture(['B.md']);missing.refresh();assert.equal(missing.doc.activeElement,undefined);assert.equal(missing.host.scrollTop,130);
});
