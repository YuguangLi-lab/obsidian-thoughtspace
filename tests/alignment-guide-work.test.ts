import test from 'node:test';
import assert from 'node:assert/strict';
import {alignmentIndex,alignDrag} from '../src/alignment-guides';
import type {Card} from '../src/model';
const node=(id:string,x:number,y:number):Card=>({id,kind:'text',text:id,x,y,width:100,height:80,color:'sand'});

test('an exact first alignment anchor does not search the center and opposite edge again',()=>{
 const nodes=[node('moving',0,0),...Array.from({length:1200},(_,i)=>node('n'+i,i*200,0))],index=alignmentIndex(nodes,new Set(['moving']))!;
 let reads=0;index.y=new Proxy(index.y,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}});
 for(let frame=0;frame<120;frame++){
  const result=alignDrag(index,20+frame,0,1,'x');assert.equal(result.dy,0);assert.deepEqual(result.guides,[{axis:'y',value:0,start:0,end:120+frame}]);
 }
 assert.ok(reads<=120*15,`Read ${reads} anchors for exact matches`);
});

test('exact ties retain the first matching moving anchor and stable target bounds',()=>{
 const first=node('first',500,0),second=node('second',-900,80),index=alignmentIndex([node('moving',0,0),first,second],new Set(['moving']))!;
 const result=alignDrag(index,25,0,1,'x');assert.deepEqual(result,{dx:25,dy:0,guides:[{axis:'y',value:0,start:25,end:600}]});
 first.x=600;assert.deepEqual(alignDrag(index,25,0,1,'x').guides,[{axis:'y',value:0,start:25,end:700}]);
});
