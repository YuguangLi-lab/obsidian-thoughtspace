import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,type Board} from '../src/model';
import {appendTopicOutline} from '../src/mindmap-content';

function fixture(count=1200,automatic=true):Board{
 const b=emptyBoard();b.version=3;
 for(let i=0;i<count;i++)b.nodes.push({id:`n${i}`,kind:'text',text:`Existing ${i}`,x:i*200,y:0,width:160,height:80,color:'green'});
 b.nodes.at(-1)!.mindmapRules={automatic,layout:'right',density:'standard'};return b;
}
function trackFind(run:()=>void){const original=Array.prototype.find;let reads=0;
 Array.prototype.find=function(this:unknown[],predicate:(value:unknown,index:number,array:unknown[])=>unknown,thisArg?:unknown){
  const first=this[0],nodes=!!first&&typeof first==='object'&&'kind'in first&&'x'in first;
  return Reflect.apply(original,this,[(value:unknown,index:number,array:unknown[])=>{if(nodes)reads++;return Reflect.apply(predicate,thisArg,[value,index,array]);}]);
 } as typeof original;
 try{run();}finally{Array.prototype.find=original;}return reads;
}

test('large outline import reads automatic and manual root settings once per command',()=>{
 for(const automatic of [true,false]){const b=fixture(1200,automatic),before=clone(b);let id=0,result!:ReturnType<typeof appendTopicOutline>;
  const items=Array.from({length:1000},(_,i)=>({depth:i%2,text:`Topic ${i}`}));
  const reads=trackFind(()=>{result=appendTopicOutline(b,'n1199',items,()=>`new${++id}`);});
  assert(reads<=b.nodes.length*2,`root lookup must not repeat for every imported topic: ${reads} node visits`);
  assert.equal(result.board.nodes.length,2200);assert.equal(result.selected,'new1999');assert(result.board.nodes.slice(1200).every(n=>n.autoSize===automatic));assert.deepEqual(b,before);
 }
});
test('outline root settings are fresh after toggling automatic layout and across different boards',()=>{
 const b=fixture(3,false),items=[{depth:0,text:'Child'}];let i=0;
 assert.equal(appendTopicOutline(b,'n2',items,()=>`first${++i}`).board.nodes.at(-1)!.autoSize,false);
 b.nodes[2].mindmapRules!.automatic=true;
 assert.equal(appendTopicOutline(b,'n2',items,()=>`second${++i}`).board.nodes.at(-1)!.autoSize,true);
 const other=fixture(3,false);assert.equal(appendTopicOutline(other,'n2',items,()=>`third${++i}`).board.nodes.at(-1)!.autoSize,false);
});
test('invalid first outline item and first ID collision still reject before reading root settings',()=>{
 for(const collision of [false,true]){const b=fixture(),before=clone(b);let ids=0;
  const reads=trackFind(()=>assert.throws(()=>appendTopicOutline(b,'n1199',[{depth:collision?0:2,text:'Bad'}],()=>{ids++;return 'n0';}),collision?/标识冲突/:/层级/));
  assert.equal(reads,b.nodes.length,'only the existing parent lookup precedes these errors');assert.equal(ids,collision?1:0);assert.deepEqual(b,before);
 }
});
