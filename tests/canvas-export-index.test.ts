import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasExport,clone,emptyBoard,type Board,type Card} from '../src/model';

function fixture(count=1200):Board{
 const b=emptyBoard();b.version=3;
 for(let i=0;i<count;i++)b.nodes.push({id:`n${i}`,kind:'text',text:`**节点 ${i}**\n- [ ] unchanged`,x:i*200,y:i%3*100,width:140,height:80,color:'green'});
 for(let i=0;i<count;i++)b.edges.push({id:`e${i}`,from:`n${i}`,to:`n${(i+1)%count}`,label:`关系 ${i}`,direction:i%2?'both':'none',fromSide:'top'});
 return b;
}
function countIds(b:Board){let reads=0;b.nodes=b.nodes.map(node=>new Proxy(node,{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}));return()=>reads;}

test('Canvas export indexes endpoint IDs at most once while preserving all output rows',()=>{
 const b=fixture(),before=clone(b),reads=countIds(b),out=canvasExport(b),idReads=reads();
 assert(idReads<=b.nodes.length*2,`endpoint lookup must be linear: ${idReads} ID reads`);
 assert.equal(out.nodes.length,b.nodes.length);assert.equal(out.edges.length,b.edges.length);
 assert.deepEqual(out.edges.map(e=>e.id),b.edges.map(e=>e.id));assert.equal(out.edges[0].fromSide,'top');
 assert.equal(out.edges[0].toEnd,'none');assert.equal(out.edges[1].fromEnd,'arrow');assert.equal(out.edges[1].label,'关系 1');
 assert.equal('text' in out.nodes[0]&&out.nodes[0].text,b.nodes[0].text);assert.deepEqual(b,before);
});
test('Canvas endpoint indexing stops after requested early nodes and skips an edgeless board',()=>{
 for(const edges of [0,1]){const b=fixture();b.edges=b.edges.slice(0,edges);const reads=countIds(b);canvasExport(b);
  assert(reads()<=b.nodes.length+3,`early endpoints must not index the rest of the board: ${reads()} ID reads`);
 }
});
test('Canvas endpoint lookup retains the first duplicate ID and is rebuilt after object replacement',()=>{
 const b=fixture(3);b.nodes[0].x=0;b.nodes[1].x=400;b.nodes[1].y=0;
 const duplicate:Card={...b.nodes[0],x:1000};b.nodes.splice(1,0,duplicate);
 b.edges=[{id:'reverse',from:'n1',to:'n0',label:'first match'},{id:'forward',from:'n0',to:'n1',label:''}];
 const out=canvasExport(b);assert.equal(out.edges[0].fromSide,'left');assert.equal(out.edges[1].fromSide,'right');assert.equal(out.nodes.filter(n=>n.id==='n0').length,2);
 b.nodes[0]={...b.nodes[0],x:800};assert.equal(canvasExport(b).edges[1].fromSide,'left');
});
test('Canvas export preserves missing-endpoint failure and leaves source geometry and edges intact',()=>{
 for(const endpoint of ['from','to'] as const){const b=fixture(3);b.edges[1][endpoint]='missing';const before=clone(b);assert.throws(()=>canvasExport(b),TypeError);assert.deepEqual(b,before);}
});
