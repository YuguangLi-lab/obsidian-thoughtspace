import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,type Board} from '../src/model';
import {editTopic} from '../src/mindmap-editor';
import {reflowAutomaticMindmaps} from '../src/mindmap';

function fixture(count=6):Board{
 const b=emptyBoard();b.version=3;
 for(let i=0;i<count;i++){b.nodes.push({id:`n${i}`,kind:'text',text:`**节点 ${i}**`,x:i*200,y:0,width:160,height:80,color:'blue'});if(i)b.edges.push({id:`e${i}`,from:'n0',to:`n${i}`,kind:'branch',label:`branch ${i}`,style:'elbow',dashed:true,color:'orange',fromSide:'right',toSide:'left'});}
 b.nodes[0].mindmapRules={automatic:true,layout:'right',density:'standard'};
 b.edges.splice(1,0,{id:'relation',from:'n1',to:'n2',label:'旁证',direction:'both',style:'straight',color:'purple'});return b;
}

test('100 sibling additions do not filter the existing edge array once per topic',()=>{
 const b=fixture(1200),labels=Array.from({length:100},(_,i)=>`追加 ${i}`),original=Array.prototype.filter;let scans=0,id=0;
 Array.prototype.filter=function(this:unknown[],predicate:(value:unknown,index:number,array:unknown[])=>unknown,thisArg?:unknown){
  const first=this[0],edges=!!first&&typeof first==='object'&&'from'in first&&'to'in first;
  return Reflect.apply(original,this,[(value:unknown,index:number,array:unknown[])=>{if(edges)scans++;return Reflect.apply(predicate,thisArg,[value,index,array]);}]);
 } as typeof original;
 let result:ReturnType<typeof editTopic>;
 try{result=editTopic(b,'n1','sibling',labels,()=>`new${++id}`,{deferAutomaticLayout:true});}finally{Array.prototype.filter=original;}
 assert(scans<4*(b.edges.length+labels.length),`batch insertion must not rebuild every edge array: ${scans} edge filter visits`);
 assert.equal(result.board.nodes.length,b.nodes.length+labels.length);assert.equal(result.selected,'new199');
});
test('batch siblings retain canonical edge order, metadata, callback order and source identities',()=>{
 const b=fixture(),before=clone(b),nodes=b.nodes,edges=b.edges,events:string[]=[];let id=0;
 b.nodes[1].branchFolded=true;before.nodes[1].branchFolded=true;
 const result=editTopic(b,'n1','sibling',[' one ','two','three'],()=>{const next=`new${++id}`;events.push(next);return next;},{deferAutomaticLayout:true,prepareNode:n=>{events.push(n.text!);n.height=150;}});
 assert.deepEqual(events,['new1','one','new2','new3','two','new4','new5','three','new6']);
 assert.deepEqual(result.board.edges.map(e=>e.id),['e1','new2','new4','new6','relation','e2','e3','e4','e5']);
 for(const edge of before.edges)assert.deepEqual(result.board.edges.find(e=>e.id===edge.id),edge);
 assert.equal(result.board.nodes[1].branchFolded,true);assert(result.board.nodes.slice(-3).every(n=>n.height===150));
 assert.deepEqual(b,before);assert.equal(b.nodes,nodes);assert.equal(b.edges,edges);assert.notEqual(result.board.nodes[0],b.nodes[0]);
});
test('batch siblings produce the same immediate and deferred geometry in every automatic layout',()=>{
 for(const layout of ['right','left','up','down','bilateral'] as const){const b=fixture();b.nodes[0].mindmapRules!.layout=layout;let i=0,j=0;
  const direct=editTopic(b,'n1','sibling',['first','second','third'],()=>`new${++i}`,{prepareNode:n=>{n.width=260;n.height=210;}});
  const deferred=editTopic(b,'n1','sibling',['first','second','third'],()=>`new${++j}`,{deferAutomaticLayout:true,prepareNode:n=>{n.width=260;n.height=210;}});
  reflowAutomaticMindmaps(deferred.board,b);assert.deepEqual(deferred,direct);
 }
});
test('batch measurement failure, ID collision and a locked tree do not partially mutate the source',()=>{
 const b=fixture(),before=clone(b);let i=0,measured=0;
 assert.throws(()=>editTopic(b,'n1','sibling',['first','second'],()=>`new${++i}`,{prepareNode:()=>{if(++measured===2)throw Error('measurement failed');}}),/measurement failed/);assert.deepEqual(b,before);
 i=0;assert.throws(()=>editTopic(b,'n1','sibling',['first','second'],()=>++i===3?'n1':`new${i}`),/标识冲突/);assert.deepEqual(b,before);
 b.nodes[2].locked=true;const locked=clone(b);measured=0;assert.throws(()=>editTopic(b,'n1','sibling',['first','second'],undefined,{prepareNode:()=>{measured++;}}),/锁定/);assert.equal(measured,0);assert.deepEqual(b,locked);
});
