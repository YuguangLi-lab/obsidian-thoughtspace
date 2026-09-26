import {test} from 'node:test';import assert from 'node:assert/strict';
import {nodeFitChanges} from '../src/node-fit-batch';import {Card} from '../src/model';
const text:Card={id:'a',kind:'text',x:0,y:0,width:100,height:80,color:'green',topic:true};
const keys=new Map([['a','current']]);
const fits=new Map([['a',{width:120,height:90,key:'current'}]]);
test('valid auto-fit batches use current nodes without mutating inputs',()=>{assert.deepEqual([...nodeFitChanges([text],fits,keys,new Set())],[['a',{width:120,height:90}]]);assert.equal(text.width,100);});
test('stale, locked, folded, editing and fixed-size nodes produce no changes',()=>{for(const n of [{...text,locked:true},{...text,collapsed:true},{...text,autoSize:false},{...text,kind:'card' as const,autoFit:false}])assert.equal(nodeFitChanges([n],fits,keys,new Set()).size,0);assert.equal(nodeFitChanges([text],fits,new Map([['a','new']]),new Set()).size,0);assert.equal(nodeFitChanges([text],fits,keys,new Set(['a'])).size,0);assert.equal(nodeFitChanges([],fits,keys,new Set()).size,0);});
test('unchanged and subpixel geometry avoids repeated fitting and saving',()=>{for(const width of [100,100.5])assert.equal(nodeFitChanges([text],new Map([['a',{width,height:80,key:'current'}]]),keys,new Set()).size,0);});
test('non-finite and non-positive measurements cannot poison board geometry',()=>{for(const width of [NaN,Infinity,0,-1])assert.equal(nodeFitChanges([text],new Map([['a',{width,height:90,key:'current'}]]),keys,new Set()).size,0);});
test('auto-fit cards apply valid changes while unsupported node kinds stay unchanged',()=>{assert.equal(nodeFitChanges([{...text,kind:'card',autoFit:true}],fits,keys,new Set()).size,1);assert.equal(nodeFitChanges([{...text,kind:'image'}],fits,keys,new Set()).size,1);assert.equal(nodeFitChanges([{...text,kind:'pdf'}],fits,keys,new Set()).size,1);assert.equal(nodeFitChanges([{...text,kind:'section'}],fits,keys,new Set()).size,0);});
test('one hidden zero-layout measurement cannot reject other valid fits in a batch',()=>{
 const hidden:Card={...text,kind:'card',autoFit:true},visible:Card={...text,id:'b'};
 const pending=new Map([['a',{width:2,height:150,key:'current'}],['b',{width:220,height:160,key:'current'}]]),liveKeys=new Map([['a','current'],['b','current']]);
 assert.deepEqual([...nodeFitChanges([hidden,visible],pending,liveKeys,new Set())],[['b',{width:220,height:160}]]);
 for(const size of [{width:79.9,height:150},{width:300,height:59.9}])assert.equal(nodeFitChanges([hidden],new Map([['a',{...size,key:'current'}]]),keys,new Set()).size,0);
 assert.equal(nodeFitChanges([hidden],new Map([['a',{width:80,height:60,key:'current'}]]),keys,new Set()).size,1,'exact schema minimums are valid');
});

test('ordinary text stays fixed by default, including a legacy autoSize flag',()=>{
 for(const autoSize of [undefined,true,false]) assert.equal(nodeFitChanges([{...text,topic:false,autoSize}],fits,keys,new Set()).size,0);
});
test('height-only text fits do not change width and remain eligible after manual width sizing',()=>{
 const n={...text,topic:false,autoSize:false,textAutoHeight:true};
 assert.equal(nodeFitChanges([n],fits,keys,new Set()).size,0,'reject a stale width from a different fit');
 const valid=new Map([['a',{width:n.width,height:220,key:'current'}]]);
 assert.deepEqual([...nodeFitChanges([n],valid,keys,new Set())],[['a',{width:n.width,height:220}]]);
 assert.equal(nodeFitChanges([{...n,textAutoHeight:false}],valid,keys,new Set()).size,0);
});
test('text measurements accept 40 pixels while card and media measurements retain 60',()=>{
 const minimum=new Map([['a',{width:100,height:40,key:'current'}]]);
 for(const n of [text,{...text,topic:false,textAutoHeight:true}])assert.deepEqual([...nodeFitChanges([n],minimum,keys,new Set())],[['a',{width:100,height:40}]]);
 for(const kind of ['card','image','pdf'] as const)assert.equal(nodeFitChanges([{...text,kind,autoFit:true}],minimum,keys,new Set()).size,0);
 assert.equal(nodeFitChanges([text],new Map([['a',{width:100,height:39.9,key:'current'}]]),keys,new Set()).size,0);
});
