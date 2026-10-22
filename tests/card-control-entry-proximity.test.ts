import test from 'node:test';import assert from 'node:assert/strict';
import {reserveCardControlDocks,type CardControlDockRequest,type CardControlRect} from '../src/card-control-layout';
import {foldControlObstacles} from '../src/fold-control-obstacles';
const overlap=(a:CardControlRect,b:CardControlRect)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1e-7&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1e-7;
const body=(n:CardControlRect,v:{x:number;y:number;zoom:number})=>({x:n.x*v.zoom+v.x,y:n.y*v.zoom+v.y,width:n.width*v.zoom,height:n.height*v.zoom});
function place(nodes:Array<CardControlRect&{id:string;kind:string}>,v:{x:number;y:number;zoom:number},width:number,height:number,extra:CardControlRect[]=[],priority=2){
 const req:CardControlDockRequest[]=nodes.map(n=>({id:n.id,node:n,count:1,priority,entry:true,dimensions:{width:36,height:36,touchTargets:true,topReserve:60,screenGap:24,avoid:[...extra,...foldControlObstacles(n,nodes,v)]}}));const saved=JSON.stringify({nodes,v,req});
 const pos=reserveCardControlDocks(req,v,width,height);
 assert.equal(JSON.stringify({nodes,v,req}),saved);assert.deepEqual(reserveCardControlDocks(req,v,width,height),pos);
 return nodes.map(n=>{const p=pos.get(n.id)!,b=body(n,v);assert.equal(44*p.scale*v.zoom,44);return{n,b,p,slot:{x:b.x+b.width-p.right*v.zoom-52,y:b.y+p.top*v.zoom,width:52,height:52},request:req.find(r=>r.id===n.id)!};});
}
const nodes=[{id:'idea',kind:'text',x:42,y:48,width:280,height:220},{id:'reading',kind:'card',x:354,y:48,width:300,height:300},{id:'next',kind:'text',x:686,y:48,width:280,height:220},{id:'long',kind:'card',x:42,y:300,width:280,height:220}];
for(const tone of ['light','dark'])for(const size of [{name:'tablet820',w:722,h:1096},{name:'phone390',w:292,h:760}])test(`P actual ${size.name} ${tone}: local below-edge entry moves close without entering body/resize`,()=>{
 const r=place(nodes,{x:0,y:0,zoom:1},size.w,size.h);
 for(const id of size.name==='tablet820'?['reading','long']:['long']){
  const c=r.find(x=>x.n.id===id)!;assert.ok(!c.p.suppressed,id);assert.equal(c.slot.y-(c.b.y+c.b.height),4);
  // P's actual padding-box/border contributes 1 CSS px; original inset is4.
  assert.equal(c.slot.y+5-(c.b.y+c.b.height),9);
  assert.equal(overlap(c.slot,c.b),false);assert.equal(overlap(c.slot,{x:c.b.x+c.b.width-18,y:c.b.y+c.b.height-18,width:36,height:36}),false);
  for(const a of c.request.dimensions.avoid!)assert.equal(overlap(c.slot,a),false);
 }
 if(size.name==='phone390')assert.equal(r.find(x=>x.n.id==='long')!.slot.x,42,'same visible left-side association, no stage-wide relocation');
});
for(const zoom of [.25,.5,1,2])for(const width of [260,384,722])test(`entry at zoom${zoom},stage${width} keeps own ports/resize/neighbours/footer protected`,()=>{
 const n={id:'subject',kind:'card',x:80/zoom,y:180/zoom,width:240,height:180};
 const neighbor={id:'neighbor',kind:'image',x:(80+240*zoom+24)/zoom,y:160/zoom,width:140,height:180};
 const footer={x:0,y:580,width,height:100},r=place([n,neighbor],{x:0,y:0,zoom},width,680,[footer]);
 assert.ok(r.some(c=>!c.p.suppressed),'at least one real slot is exercised, not vacuous suppression');
 for(const c of r){
  if(c.p.suppressed)continue;
  assert.ok(c.slot.x>=12&&c.slot.x+52<=width-12);assert.ok(c.slot.y>=60&&c.slot.y+52<=668);
  assert.equal(overlap(c.slot,c.b),false);assert.equal(overlap(c.slot,footer),false);
  for(const border of [0,1,2,3,4]){
   const cx=c.b.x+c.b.width-border*zoom,cy=c.b.y+c.b.height-border*zoom;
   assert.equal(overlap(c.slot,{x:cx-12,y:cy-12,width:24,height:24}),false,'all supported border positions reserve actual counter-scaled24 resize');
  }
  const gap=Math.max(24,20*zoom);for(const[x,y]of[[c.b.x+c.b.width/2,c.b.y],[c.b.x+c.b.width/2,c.b.y+c.b.height],[c.b.x,c.b.y+c.b.height/2],[c.b.x+c.b.width,c.b.y+c.b.height/2]])assert.equal(overlap(c.slot,{x:x-gap,y:y-gap,width:2*gap,height:2*gap}),false);
  for(const a of c.request.dimensions.avoid!)assert.equal(overlap(c.slot,a),false);
 }
 for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++)if(!r[i].p.suppressed&&!r[j].p.suppressed)assert.equal(overlap(r[i].slot,r[j].slot),false);
});
test('safe farther candidate remains available when every near edge is blocked',()=>{
 const n={id:'x',kind:'card',x:80,y:180,width:240,height:180};
 const strip={x:80,y:360,width:240,height:20};const r=place([n],{x:0,y:0,zoom:1},390,760,[{x:0,y:60,width:390,height:120},{x:0,y:180,width:80,height:180},{x:320,y:180,width:70,height:180},strip])[0];
 assert.ok(!r.p.suppressed);assert.equal(r.slot.y,384);assert.equal(overlap(r.slot,strip),false);
});
test('short viewport never forces a detached entry over body or footer',()=>{
 const footer={x:0,y:174,width:292,height:122};const r=place(nodes,{x:0,y:0,zoom:1},292,296,[footer]);
 for(const c of r)if(!c.p.suppressed){assert.equal(overlap(c.slot,c.b),false);assert.equal(overlap(c.slot,footer),false);}
 assert.ok(r.find(c=>c.n.id==='long')!.p.suppressed);
});
test('same focused entry still uses existing reachable fallback when nearby slots do not fit',()=>{
 const n={id:'tiny',kind:'card',x:80,y:100,width:20,height:20};const r=place([n],{x:0,y:0,zoom:1},260,400,[],0)[0];
 assert.equal(r.p.suppressed,undefined);assert.equal(44*r.p.scale,44);assert.ok(r.slot.x>=0&&r.slot.x+52<=260&&r.slot.y>=60&&r.slot.y+52<=400);
});

const actualEntry=(slot:CardControlRect,zoom:number,border:number)=>({x:slot.x+4-border*zoom,y:slot.y+4+border*zoom,width:44,height:44});
const zoom25node={id:'subject',kind:'card',x:32,y:72,width:160,height:140};
test('review exact2.5x border4 top case cannot pass a clear slot while real44 target enters body',()=>{
 const c=place([zoom25node],{x:0,y:0,zoom:2.5},722,800)[0];assert.ok(!c.p.suppressed);
 assert.equal(overlap(actualEntry(c.slot,2.5,4),c.b),false);
 assert.equal(overlap(actualEntry({x:428,y:124,width:52,height:52},2.5,4),c.b),true);
});
test('review exact2.5x border4 footer case rejects old slot-only false clear',()=>{
 const obstacles=[{x:0,y:60,width:722,height:120},{x:480,y:180,width:242,height:350},{x:0,y:180,width:80,height:350},{x:0,y:586,width:722,height:214}];
 const c=place([zoom25node],{x:0,y:0,zoom:2.5},722,800,obstacles)[0];
 const bad={x:404,y:534,width:52,height:52};assert.equal(overlap(bad,obstacles[3]),false);assert.equal(overlap(actualEntry(bad,2.5,4),obstacles[3]),true);
 if(!c.p.suppressed)for(const o of obstacles)assert.equal(overlap(actualEntry(c.slot,2.5,4),o),false);
});
test('all supported actual border projections stay in passive reservations and clear bodies,ports,footer',()=>{
 for(const zoom of [.25,.5,1,2,2.5]){
  const ns=[{...zoom25node,x:100/zoom,y:210/zoom},{id:'next',kind:'video',x:410/zoom,y:240/zoom,width:140,height:180}],v={x:0,y:0,zoom},footer={x:0,y:700,width:1000,height:100};
  const rows=place(ns,v,1000,800,[footer]);assert.ok(rows.some(c=>!c.p.suppressed));
  for(const c of rows)if(!c.p.suppressed)for(const border of [0,1,2,3,4]){
   const a=actualEntry(c.slot,zoom,border);assert.ok(a.x>=12&&a.x+44<=988&&a.y>=60&&a.y+44<=788);
   assert.equal(overlap(a,c.b),false);assert.equal(overlap(a,footer),false);for(const o of c.request.dimensions.avoid!)assert.equal(overlap(a,o),false);
   const gap=Math.max(24,20*zoom);for(const[x,y]of[[c.b.x+c.b.width/2,c.b.y],[c.b.x+c.b.width/2,c.b.y+c.b.height],[c.b.x,c.b.y+c.b.height/2],[c.b.x+c.b.width,c.b.y+c.b.height/2]])assert.equal(overlap(a,{x:x-gap,y:y-gap,width:2*gap,height:2*gap}),false);
   const rcx=c.b.x+c.b.width-border*zoom,rcy=c.b.y+c.b.height-border*zoom;assert.equal(overlap(a,{x:rcx-12,y:rcy-12,width:24,height:24}),false);
   for(const other of rows)if(other!==c&&!other.p.suppressed)for(const otherBorder of [0,1,2,3,4])assert.equal(overlap(a,actualEntry(other.slot,zoom,otherBorder)),false);
  }
 }
});
test('focused entry fallback also reserves the real padding-box projection at2.5x',()=>{
 const blocked={x:0,y:60,width:722,height:590};
 const c=place([zoom25node],{x:0,y:0,zoom:2.5},722,800,[blocked],0)[0];assert.ok(!c.p.suppressed);
 assert.ok(c.slot.y>=650,'all18 local candidates blocked; existing stage-search fallback must run');
 for(const border of [0,1,2,3,4]){const a=actualEntry(c.slot,2.5,border);assert.equal(overlap(a,c.b),false);assert.equal(overlap(a,blocked),false);assert.ok(a.x>=0&&a.x+44<=722&&a.y>=60&&a.y+44<=800);}
});
