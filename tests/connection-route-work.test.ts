import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionPath,connectionSides} from '../src/connections';
import {type Card,type Edge} from '../src/model';

const node=(id:string,x=0,y=0):Card=>({id,kind:'text',text:id,x,y,width:200,height:120,color:'blue'});

test('explicit connection ports do not read geometry to infer unused automatic sides',()=>{
 let reads=0;const watched=(value:Card)=>new Proxy(value,{get(target,key,receiver){if(['x','y','width','height'].includes(String(key)))reads++;return Reflect.get(target,key,receiver);}});
 const a=watched(node('a')),b=watched(node('b',450,300));
 for(let frame=0;frame<120;frame++)assert.deepEqual(connectionSides(a,b,{fromSide:'right',toSide:'left'}),{fromSide:'right',toSide:'left'});
 assert.equal(reads,0,'both explicit ports already determine the route sides');
});

test('an omitted port still follows fresh endpoint geometry while preserving the explicit port',()=>{
 const a=node('a'),b=node('b',450);const edge:Partial<Edge>={fromSide:'top'};
 assert.deepEqual(connectionSides(a,b,edge),{fromSide:'top',toSide:'left'});
 Object.assign(b,{x:0,y:-300});assert.deepEqual(connectionSides(a,b,edge),{fromSide:'top',toSide:'bottom'});
 delete edge.fromSide;edge.toSide='right';assert.deepEqual(connectionSides(a,b,edge),{fromSide:'top',toSide:'right'});
 Object.assign(b,{x:-450,y:0});assert.deepEqual(connectionSides(a,b,edge),{fromSide:'left',toSide:'right'});
});

test('rounded elbows share segment distances between the corners and label placement',()=>{
 const a=node('a'),b=node('b',450,300),original=Math.hypot;let calls=0;
 Math.hypot=(...values)=>{calls++;return original(...values);};
 try{
  for(let frame=0;frame<120;frame++){
   const route=connectionPath(a,b,{style:'elbow',fromSide:'right',toSide:'left'});
   assert.deepEqual(route.from,{x:200,y:60});assert.deepEqual(route.to,{x:450,y:360});assert.deepEqual(route.label,{x:325,y:210});
   assert.equal(route.path,'M 200 60 L 220 60 Q 232 60 244 60 L 313 60 Q 325 60 325 72 L 325 348 Q 325 360 337 360 L 406 360 Q 418 360 430 360 L 450 360');
  }
  assert.equal(calls,120*6,'one stub distance and five adjacent segment distances per six-point route');
 }finally{Math.hypot=original;}
});

test('coincident and zero-sized endpoints keep finite rounded paths without mutating records',()=>{
 const sides=['top','right','bottom','left'] as const;
 for(const width of [0,200])for(const height of [0,120])for(const fromSide of sides)for(const toSide of sides){
  const a={...node('a'),width,height},b={...node('b'),width,height},before=JSON.stringify([a,b]);
  const route=connectionPath(a,b,{style:'elbow',fromSide,toSide});assert.ok(!/NaN|Infinity/.test(route.path));assert.ok(Number.isFinite(route.label.x)&&Number.isFinite(route.label.y));assert.equal(JSON.stringify([a,b]),before);
 }
});
