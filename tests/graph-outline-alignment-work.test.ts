import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,type Board,type Card} from '../src/model';
import {outlineTree} from '../src/group-organizer';
import {alignmentIndex,alignDrag} from '../src/alignment-guides';
const node=(id:string,x=0,y=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width:120,height:80,color:'green',...extra});
function groups(){const b:Board={...emptyBoard(),version:3};for(let i=0;i<64;i++){b.nodes.push(node(`g${i}`,i*1200,0,{kind:'section',title:`Group ${i}`,width:1000,height:600}));for(let j=0;j<16;j++)b.nodes.push(node(`m${i}-${j}`,i*1200+30+j%4*200,60+Math.floor(j/4)*120));}return b;}

test('group outline resolves spatial membership without a full group scan per object',()=>{
 const b=groups(),before=clone(b);let reads=0;b.nodes=b.nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(key==='x'||key==='y'||key==='width'||key==='height')reads++;return Reflect.get(target,key,receiver);}}));
 const rows=outlineTree(b),work=reads;assert.ok(work<60000,`${work} geometry reads exceeded the spatial membership budget`);
 assert.equal(rows.length,1088);assert.equal(rows.filter(r=>r.depth===0).length,64);for(const row of rows)if(row.node.kind!=='section')assert.equal(row.parentId,row.node.id.replace(/^m(\d+)-\d+$/,'g$1'));
 assert.deepEqual(b,before);
});

test('outline ownership keeps smallest frames, exact boundaries, equal-area tie order and coincident peers',()=>{
 const b:Board={...emptyBoard(),version:3,nodes:[node('outer',0,0,{kind:'section',width:800,height:700}),node('peer',20,30,{kind:'section',width:500,height:400}),node('inner',20,30,{kind:'section',width:500,height:400}),node('nested',60,80,{kind:'section',width:200,height:180}),node('boundary',60,80,{width:200,height:180}),node('overlap',300,80,{width:120,height:80}),node('loose',1000,1000)]};
 const rows=outlineTree(b),parent=new Map(rows.map(r=>[r.node.id,r.parentId]));assert.equal(parent.get('nested'),'inner');assert.equal(parent.get('boundary'),'nested');assert.equal(parent.get('overlap'),'inner');assert.equal(parent.get('inner'),'outer');assert.equal(parent.get('peer'),'outer');assert.equal(parent.get('loose'),undefined);
 assert.equal(rows.find(r=>r.node.id==='outer')!.descendantCount,5);assert.equal(rows.find(r=>r.node.id==='inner')!.descendantCount,3);
});

test('outline queries preserve matching ancestors, collapsed search expansion and live containment',()=>{
 const b=groups(),before=clone(b),collapsed=new Set(['g10']);assert.equal(outlineTree(b,{collapsed}).some(r=>r.node.id==='m10-3'),false);
 let rows=outlineTree(b,{collapsed,query:'evidence',name:n=>n.id==='m10-3'?'Evidence':n.id});assert.deepEqual(rows.map(r=>[r.node.id,r.matched]),[['g10',false],['m10-3',true]]);
 assert.equal(rows[0].expanded,true);assert.deepEqual(b,before);
 const item=b.nodes.find(n=>n.id==='m10-3')!;item.x=30;item.y=60;rows=outlineTree(b);assert.equal(rows.find(r=>r.node.id===item.id)!.parentId,'g0');
 assert.ok(outlineTree(b,{kind:'image'}).length===0);
});

test('drag alignment does not allocate short point and neighbor arrays for each frame',()=>{
 const nodes=[node('selected',0,0),node('reference',400,200)],index=alignmentIndex(nodes,new Set(['selected']))!,original=Array.prototype[Symbol.iterator];let iterators=0;
 Array.prototype[Symbol.iterator]=(function(this:unknown[]){iterators++;return Reflect.apply(original,this,[]);}) as typeof original;
 try{for(let frame=0;frame<120;frame++)alignDrag(index,200.125+frame*.001,100.375+frame*.001,1);}finally{Array.prototype[Symbol.iterator]=original;}
 assert.equal(iterators,0,`${iterators} temporary-array iterations during drag alignment`);
});

test('alignment retains exact-axis lock, threshold boundary and deterministic equidistant preference',()=>{
 const index=alignmentIndex([node('s'),node('left',-125,0),node('right',125,0)],new Set(['s']))!;
 assert.deepEqual(alignDrag(index,0,0,1),{dx:-5,dy:0,guides:[{axis:'x',value:-5,start:0,end:80},{axis:'y',value:0,start:-125,end:115}]});
 const x=alignDrag(index,0,0,1,'x');assert.equal(x.dx,0);assert.deepEqual(x.guides.map(g=>g.axis),['y']);
 const y=alignDrag(index,0,0,1,'y');assert.equal(y.dy,0);assert.deepEqual(y.guides.map(g=>g.axis),['x']);
 const boundary=alignmentIndex([node('s'),node('ref',126,1000)],new Set(['s']))!;assert.equal(alignDrag(boundary,0,0,1).dx,6);assert.equal(alignDrag(boundary,0,0,1.0001).dx,0);
});
