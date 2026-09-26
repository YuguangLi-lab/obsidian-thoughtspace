import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
const source=readFileSync(process.env.SESSION_LOCK_SOURCE||'src/main.ts','utf8');
const start=source.indexOf('class Session {'),end=source.indexOf('\nexport default class ThoughtSpace',start);
let indexed=0,maps=0;
class CountedMap extends Map<string,model.Card> {constructor(entries?:Iterable<readonly [string,model.Card]>|null){super(entries);maps++;indexed+=this.size;}}
const deps={...model,...mindmap,Map:CountedMap,Notice:class{},EXT:'thoughtspace',report:()=>{}};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
function fixture(count=1200){const b=model.emptyBoard();b.version=3;b.nodes=Array.from({length:count},(_,i)=>({id:'n'+i,kind:'text' as const,text:'Keep',x:i*350,y:0,width:320,height:200,color:'sand' as const}));const s=new Session({}, {},JSON.stringify(b));s.persist=()=>{};maps=indexed=0;return s;}
test('unlocked transactions skip the unused full-board lock index',()=>{
 const s=fixture();for(let i=0;i<40;i++)s.change((b:model.Board)=>{b.nodes[0].text=String(i);},model.clone(s.board),false,false);
 assert.equal(maps,0);assert.equal(indexed,0);assert.equal(s.board.nodes[0].text,'39');
});
test('explicit lock operations skip lock restoration scans while retaining validation',()=>{
 const s=fixture();s.board.nodes[0].locked=true;s.change((b:model.Board)=>{b.nodes[0].x=500;},model.clone(s.board),true,false);
 assert.equal(maps,0);assert.equal(indexed,0);assert.equal(s.board.nodes[0].x,500);
 const before=model.clone(s.board);assert.throws(()=>s.change((b:model.Board)=>{b.nodes[0].width=0;},before,true,false),/尺寸无效/);assert.deepEqual(s.board,before);
});
test('locked nodes share one fresh index and retain original geometry and unlock semantics',()=>{
 const s=fixture(3);s.board.nodes[0].locked=true;s.board.nodes[1].locked=true;const before=model.clone(s.board);
 s.change((b:model.Board)=>{b.nodes.reverse();for(const n of b.nodes){n.x+=10;n.width=500;}b.nodes.find(n=>n.id==='n1')!.locked=false;},before,false,false);
 assert.equal(maps,1);assert.equal(indexed,3);const locked=s.board.nodes.find((n:model.Card)=>n.id==='n0');assert.equal(locked.x,before.nodes[0].x);assert.equal(locked.width,before.nodes[0].width);assert.equal(s.board.nodes.find((n:model.Card)=>n.id==='n1').width,500);
 const next=model.clone(s.board);assert.throws(()=>s.change((b:model.Board)=>{b.nodes=b.nodes.filter(n=>n.id!=='n0');},next,false,false),/解锁/);assert.deepEqual(s.board,next);
 s.change((b:model.Board)=>{b.nodes.find(n=>n.id==='n0')!.locked=false;},model.clone(s.board),false,false);
 maps=indexed=0;s.change((b:model.Board)=>{b.nodes[0].x+=1;},model.clone(s.board),false,false);assert.equal(maps,0);
});
