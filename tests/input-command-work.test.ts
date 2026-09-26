import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board,type Card} from '../src/model';
import * as mindmap from '../src/mindmap';
import {mindmapParent} from '../src/mindmap-navigation';
import type {BoardInputAction} from '../src/board-input-commands';
const source=readFileSync(process.env.INPUT_COMMAND_SOURCE||'src/main.ts','utf8'),start=source.indexOf('  inputCommandTarget():'),end=source.indexOf('  private setSelectionFold(',start);
let topology=0;
const deps={...mindmap,branchTopology:(b:Board)=>{topology++;return mindmap.branchTopology(b);},branchState:(b:Board)=>{topology++;return mindmap.branchState(b);},mindmapParent,act:(fn:()=>unknown)=>fn()};
const View=new Function(...Object.keys(deps),transformSync(`return class View{${source.slice(start,end)}}`,{loader:'ts'}).code)(...Object.values(deps));
function fixture(kind:Card['kind']='text'){const b=emptyBoard();b.version=3;const nodes:Card[]=Array.from({length:1200},(_,i)=>({id:'n'+i,kind,text:'Topic',x:i*350,y:0,width:300,height:180,color:'sand'}));let reads=0;b.nodes=new Proxy(nodes,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}});const v=new View();Object.assign(v,{session:{board:b,blocked:false},selected:new Set(['n0','n1']),closed:false,contentEl:{ownerDocument:{activeElement:null},contains:()=>false}});topology=0;return{v,b,nodes,reads:()=>reads};}
test('global keyboard command checks skip unrelated selected-node scans',()=>{
 const f=fixture(),target=f.v.inputCommandTarget(),actions:BoardInputAction[]=['newCard','newText','insertNote','selection','connect','fit','reset','undo','redo','newSection','find','tidy','read'];
 for(let i=0;i<120;i++)for(const action of actions)assert.equal(target.canRun(action),true);
 assert.equal(f.reads(),0);
});
test('empty selection does not scan nodes for selection-dependent command eligibility',()=>{
 const f=fixture();f.v.selected.clear();const target=f.v.inputCommandTarget();for(const action of ['focus','duplicate','edit','childTopic','parentTopic','siblingTopic','fold','expand','remove'])assert.equal(target.canRun(action),false);
 assert.equal(f.reads(),0);f.v.selectedEdge='edge';assert.equal(target.canRun('remove'),true);
});
test('mixed unsupported fold targets build at most one live topology and refresh after edits',()=>{
 const f=fixture('image');f.v.selected=new Set(f.nodes.slice(0,100).map(n=>n.id));const target=f.v.inputCommandTarget();assert.equal(target.canRun('fold'),false);assert.equal(topology,1);
 f.b.edges.push({id:'branch',from:'n99',to:'n100',kind:'branch',label:''});assert.equal(target.canRun('fold'),true);assert.equal(topology,2);
 f.nodes[99].locked=true;assert.equal(target.canRun('fold'),false);assert.equal(topology,3);
});
test('command eligibility remains live for blocked, closed, editing, deleted and locked selections',()=>{
 const f=fixture();f.v.selected=new Set(['n0']);f.b.mode='mindmap';const target=f.v.inputCommandTarget();assert.equal(target.canRun('edit'),true);assert.equal(target.canRun('childTopic'),true);f.nodes[0].locked=true;assert.equal(target.canRun('edit'),false);assert.equal(target.canRun('fold'),false);delete f.nodes[0].locked;
 f.nodes.splice(0,1);assert.equal(target.canRun('edit'),false);assert.equal(target.canRun('focus'),false);
 f.v.session.blocked=true;assert.equal(target.canRun('newCard'),false);assert.equal(f.v.inputCommandTarget(),undefined);f.v.session.blocked=false;f.v.inline={};assert.equal(f.v.inputCommandTarget().editing,true);f.v.inline=undefined;f.v.closed=true;assert.equal(target.canRun('undo'),false);assert.equal(f.v.inputCommandTarget(),undefined);
});
