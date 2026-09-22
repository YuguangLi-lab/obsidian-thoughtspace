import {test} from 'node:test';import assert from 'node:assert/strict';
import {nearestSide,connectionTarget,duplicateConnection,reconnectEdge} from '../src/connection-flow';import {connectionAnchor,connectionPath} from '../src/connections';import {emptyBoard,Card,parseBoard} from '../src/model';
const n=(id:string,x=0,y=0):Card=>({id,kind:'text',text:id,x,y,width:200,height:120,color:'blue'});
test('target port follows nearest side and screen-space tolerance across zooms',()=>{const a=n('a'),b=n('b',400);assert.equal(nearestSide(a,{x:190,y:60}),'right');for(const zoom of [.15,.5,1,2.5]){assert.deepEqual(connectionTarget([a,b],{x:400-19/zoom,y:60},'a',zoom),{id:'b',side:'left'});assert.equal(connectionTarget([a,b],{x:400-21/zoom,y:60},'a',zoom),undefined);}});
test('sections and source are excluded; topmost hit wins',()=>{assert.equal(connectionTarget([n('a'),{...n('section'),kind:'section'}],{x:30,y:30},'a',1),undefined);assert.equal(connectionTarget([n('a'),n('b')],{x:30,y:30},'source',1)?.id,'b');});
test('automatic and explicit matching ports count as the same connection',()=>{const b={...emptyBoard(),nodes:[n('a'),n('b',400)],edges:[{id:'e',from:'a',to:'b',label:''}]};assert.ok(duplicateConnection(b,{from:'a',to:'b',fromSide:'right',toSide:'left'}));assert.equal(duplicateConnection(b,{from:'a',to:'b',fromSide:'top',toSide:'left'}),false);});
test('reconnecting preserves edge id, label and styling, and serializes',()=>{const b={...emptyBoard(),version:3 as const,nodes:[n('a'),n('b',400),n('c',700)],edges:[{id:'e',from:'a',to:'b',label:'解释',color:'blue' as const,style:'elbow' as const,dashed:true}]};assert.ok(reconnectEdge(b,'e','to','c','top',JSON.stringify(b.edges[0])));assert.equal(b.edges[0].to,'c');assert.equal(b.edges[0].label,'解释');assert.equal(b.edges[0].color,'blue');assert.equal(parseBoard(JSON.stringify(b)).edges[0].toSide,'top');});
test('stale, missing, duplicate and self-loop reconnects never mutate',()=>{const b={...emptyBoard(),nodes:[n('a'),n('b',400),n('c',700)],edges:[{id:'e',from:'a',to:'b',label:''},{id:'f',from:'a',to:'c',label:'',toSide:'left' as const}]},before=JSON.stringify(b),expected=JSON.stringify(b.edges[0]);for(const[id,target,revision]of [['e','a',expected],['e','missing',expected],['gone','b',expected],['e','c',expected],['e','b','stale']])assert.equal(reconnectEdge(b,id,'to',target,'left',revision),false);assert.equal(JSON.stringify(b),before);});
test('rounded elbows respect all 16 port combinations with finite label and exact endpoints',()=>{const a=n('a'),b=n('b',450,300);for(const fromSide of ['top','right','bottom','left'] as const)for(const toSide of ['top','right','bottom','left'] as const){const r=connectionPath(a,b,{style:'elbow',fromSide,toSide});assert.deepEqual(r.from,connectionAnchor(a,fromSide));assert.deepEqual(r.to,connectionAnchor(b,toSide));assert.ok(!/NaN|Infinity/.test(r.path));assert.match(r.path,/ Q /);assert.ok(Number.isFinite(r.label.x)&&Number.isFinite(r.label.y));}});
test('overlapping and coincident anchors do not poison rounded routes',()=>{for(const x of [0,200,210])for(const y of [0,120])assert.ok(!/NaN|Infinity/.test(connectionPath(n('a'),n('b',x,y),{style:'elbow'}).path));});
test('target eligibility skips hidden overlapping objects while preserving topmost order',()=>{
 const nodes=[n('under',400),n('hidden',400)];
 assert.deepEqual(connectionTarget(nodes,{x:400,y:60},'source',1,node=>node.id!=='hidden'),{id:'under',side:'left'});
 assert.equal(connectionTarget(nodes,{x:400,y:60},'source',1,()=>false),undefined);
});
test('target eligibility is only checked for geometric candidates until the first match',()=>{
 const nodes=Array.from({length:1200},(_,i)=>n(String(i),i*400));const calls:string[]=[];
 assert.equal(connectionTarget(nodes,{x:1199*400,y:60},'source',1,node=>{calls.push(node.id);return true;})?.id,'1199');
 assert.deepEqual(calls,['1199']);calls.length=0;
 assert.equal(connectionTarget(nodes,{x:-1000,y:-1000},'source',1,node=>{calls.push(node.id);return true;}),undefined);
 assert.deepEqual(calls,[]);
});
test('a real card hit wins over a nearby higher card snap halo',()=>{
 const nodes=[n('under',0),n('nearby',210)];
 assert.deepEqual(connectionTarget(nodes,{x:195,y:60},'source',1),{id:'under',side:'right'});
});
test('empty-space snapping chooses the closest card and uses z order only for ties',()=>{
 const nodes=[n('near',0),n('far',230)];
 assert.equal(connectionTarget(nodes,{x:212,y:60},'source',1)?.id,'near');
 assert.equal(connectionTarget(nodes,{x:215,y:60},'source',1)?.id,'far');
});
test('snap halos use a twenty screen-pixel radius at corners across zoom levels',()=>{
 const target=n('target',400,200);
 for(const zoom of [.15,.5,1,2.5]){
  assert.equal(connectionTarget([target],{x:400-15/zoom,y:200-15/zoom},'source',zoom),undefined);
  assert.equal(connectionTarget([target],{x:400-12/zoom,y:200-12/zoom},'source',zoom)?.id,'target');
  assert.equal(connectionTarget([target],{x:400-20/zoom,y:260},'source',zoom)?.id,'target');
  assert.equal(connectionTarget([target],{x:400-20.001/zoom,y:260},'source',zoom),undefined);
 }
});
test('ineligible foreground cards do not block the nearest eligible target',()=>{
 const nodes=[n('under',0),n('hidden',0),n('nearby',210)];
 assert.equal(connectionTarget(nodes,{x:195,y:60},'source',1,node=>node.id!=='hidden')?.id,'under');
 assert.equal(connectionTarget(nodes,{x:205,y:60},'source',1,node=>node.id!=='nearby'&&node.id!=='hidden')?.id,'under');
});
test('geometry locking still permits an intentional connection to a locked card',()=>{
 assert.equal(connectionTarget([{...n('locked'),locked:true}],{x:100,y:60},'source',1)?.id,'locked');
});
test('invalid pointer or zoom does not snap to an unrelated object',()=>{
 const nodes=[n('a'),n('b',500)];for(const zoom of [0,-1,NaN,Infinity])assert.equal(connectionTarget(nodes,{x:400,y:60},'source',zoom),undefined);
 for(const point of [{x:NaN,y:60},{x:100,y:Infinity}])assert.equal(connectionTarget(nodes,point,'source',1),undefined);
});
test('straight routing computes only its anchors without unused curve distance work',()=>{
 const original=Math.hypot;let calls=0;Math.hypot=(...values)=>{calls++;return original(...values);};
 try{assert.deepEqual(connectionPath(n('a'),n('b',400),{style:'straight'}),{fromSide:'right',toSide:'left',path:'M 200 60 L 400 60',label:{x:300,y:60},from:{x:200,y:60},to:{x:400,y:60}});assert.equal(calls,0);}
 finally{Math.hypot=original;}
});
