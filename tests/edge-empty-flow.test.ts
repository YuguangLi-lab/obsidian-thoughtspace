import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as connections from '../src/connections';
import * as rendering from '../src/rendering';
import type {Board,Card} from '../src/model';

const source=readFileSync(process.env.EDGE_EMPTY_SOURCE||'src/edge-layer.ts','utf8');
class SvgDocument {
 writes=0;
 createElementNS(_namespace:string,tag:string){this.writes++;return new SvgElement(this,tag);}
}
class SvgElement {
 children:SvgElement[]=[];parent?:SvgElement;attributes=new Map<string,string>();dataset:Record<string,string>={};textContent='';
 style={setProperty:()=>{this.ownerDocument.writes++;}};
 classList={toggle:(name:string,on:boolean)=>{const classes=new Set((this.getAttribute('class')||'').split(' ').filter(Boolean));if(on)classes.add(name);else classes.delete(name);this.setAttribute('class',[...classes].join(' '));}};
 constructor(readonly ownerDocument:SvgDocument,readonly tag:string){}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 setAttribute(key:string,value:string){this.ownerDocument.writes++;this.attributes.set(key,value);}
 hasAttribute(key:string){return this.attributes.has(key);}
 removeAttribute(key:string){this.ownerDocument.writes++;this.attributes.delete(key);}
 appendChild(child:SvgElement){this.ownerDocument.writes++;child.parent=this;this.children.push(child);return child;}
 remove(){this.ownerDocument.writes++;if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;}
}
function fixture(count=3){
 const stats={nodeReads:0,viewportReads:0},module={exports:{} as any};
 const deps={...rendering,viewportRect:(...args:Parameters<typeof rendering.viewportRect>)=>{stats.viewportReads++;return rendering.viewportRect(...args);}};
 new Function('require','module','exports',transformSync(source,{loader:'ts',format:'cjs'}).code)((name:string)=>name==='./connections'?connections:deps,module,module.exports);
 const doc=new SvgDocument(),root=new SvgElement(doc,'svg'),layer=new module.exports.EdgeLayer(root,'empty-test',()=>{});
 const nodes:Card[]=Array.from({length:count},(_,index)=>({get id(){stats.nodeReads++;return 'n'+index;},kind:'text',text:'正文',color:'sand',x:index*200,y:0,width:100,height:60}));
 const board:Board={version:3,nodes,edges:[],viewport:{x:0,y:0,zoom:1}};
 const render=(selected?:string,focus?:ReadonlySet<string>,batch?:ReadonlySet<string>)=>layer.render(board,1000,800,selected,focus,batch);
 const rows=()=>root.children.filter(child=>child.dataset.edge);
 const row=(id:string)=>{const value=rows().find(child=>child.dataset.edge===id);assert.ok(value);return value;};
 const path=(id:string)=>{const value=row(id).children.find(child=>child.getAttribute('class')?.split(' ').includes('ts-edge'));assert.ok(value);return value;};
 const handles=(id:string)=>row(id).children.find(child=>child.getAttribute('class')==='ts-edge-handles');
 const add=()=>board.edges.push({id:'edge',from:'n0',to:'n1',label:'关系',color:'blue',direction:'both'});
 return{stats,doc,root,layer,board,render,rows,row,path,handles,add};
}

test('120 frames without edges skip all 1200-node indexing and viewport work',t=>{
 const f=fixture(1200),writes=f.doc.writes,defs=f.root.children[0];
 for(let frame=0;frame<120;frame++){
  f.board.viewport={x:frame,y:-frame,zoom:frame%2?.5:1};
  f.render(frame%2?'old-edge':undefined,new Set(['n0']),new Set(['old-edge']));
 }
 t.diagnostic(`120 empty-edge frames / 1200 nodes: ${JSON.stringify(f.stats)}`);
 assert.deepEqual(f.stats,{nodeReads:0,viewportReads:0});assert.equal(f.doc.writes,writes);
 assert.equal(f.root.children[0],defs);assert.equal(f.rows().length,0);
});

test('removing the last edge releases rows once while preserving registered markers',()=>{
 const f=fixture();f.add();f.render('edge');const old=f.row('edge'),defs=f.root.children[0],markers=[...defs.children];
 assert.ok(f.handles('edge'));assert.equal(markers.length,1);
 f.board.edges=[];f.stats.nodeReads=0;f.stats.viewportReads=0;f.render('edge');
 assert.equal(old.parent,undefined);assert.equal(f.rows().length,0);assert.equal(f.root.children[0],defs);assert.deepEqual(defs.children,markers);
 const writes=f.doc.writes;f.render(undefined,undefined,new Set(['edge']));assert.equal(f.doc.writes,writes);
 assert.deepEqual(f.stats,{nodeReads:0,viewportReads:0});
});

test('adding connections after empty frames uses fresh geometry, focus and selection',()=>{
 const f=fixture();f.add();f.render('edge');const old=f.row('edge'),defs=f.root.children[0],marker=defs.children[0];
 f.board.edges=[];f.render();f.board.nodes[1].x=450;f.board.nodes[1].height=130;f.board.viewport.zoom=.5;
 f.add();f.render('edge',new Set(['n0']));assert.notEqual(f.row('edge'),old);assert.equal(defs.children[0],marker);assert.equal(defs.children.length,1);
 assert.equal(f.path('edge').getAttribute('d'),connections.connectionPath(f.board.nodes[0],f.board.nodes[1],f.board.edges[0]).path);
 assert.match(f.row('edge').getAttribute('class')||'',/is-unrelated/);assert.deepEqual(f.handles('edge')?.children.map(child=>child.getAttribute('r')),['12','12']);
 f.render(undefined,new Set(['n0','n1']),new Set(['edge']));assert.equal(f.handles('edge'),undefined);assert.doesNotMatch(f.row('edge').getAttribute('class')||'',/is-unrelated/);assert.match(f.path('edge').getAttribute('class')||'',/is-selected/);
 f.board.edges=[];f.render();f.board.viewport.x=-10000;f.add();f.render('edge');assert.equal(f.rows().length,0);
 f.board.viewport.x=0;f.render('edge');assert.equal(f.rows().length,1);
});

test('an entirely empty board skips indexing and explicit clear still resets definitions',()=>{
 const f=fixture(0);const defs=f.root.children[0];f.render('missing');assert.deepEqual(f.stats,{nodeReads:0,viewportReads:0});assert.equal(f.root.children.length,1);
 f.layer.clear();assert.equal(defs.parent,undefined);assert.notEqual(f.root.children[0],defs);assert.equal(f.root.children[0].children.length,0);
 const populated=fixture();populated.add();populated.render();const oldDefs=populated.root.children[0],oldMarker=oldDefs.children[0];
 populated.board.edges=[];populated.render();populated.layer.clear();assert.equal(oldDefs.parent,undefined);assert.equal(populated.root.children[0].children.length,0);
 populated.add();populated.render();assert.equal(populated.rows().length,1);assert.equal(populated.root.children[0].children.length,1);assert.notEqual(populated.root.children[0].children[0],oldMarker);
});

test('nonempty edges with missing endpoints continue through normal cleanup',()=>{
 const f=fixture();f.add();f.render('edge');const old=f.row('edge');f.board.nodes.splice(1,1);f.stats.nodeReads=0;f.stats.viewportReads=0;
 f.render('edge');assert.equal(old.parent,undefined);assert.equal(f.rows().length,0);assert.deepEqual(f.stats,{nodeReads:2,viewportReads:1});
 f.board.edges[0].to='n2';f.render('edge');assert.equal(f.rows().length,1);assert.ok(f.handles('edge'));
});
