import test from 'node:test';
import assert from 'node:assert/strict';
import {cardControlLayout,cardControlMetrics,formatToolbarTop,reserveCardControlDocks,type CardControlDockRequest,type CardControlRect} from '../src/card-control-layout';

const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
const intersects=(a:CardControlRect,b:CardControlRect)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1e-7&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1e-7;

test('touch docks reserve 44px icon targets while preserving 64px labelled actions',()=>{
  for(const [count,desktop,touch]of [[5,236,284],[4,168,216],[3,136,168],[2,68,100],[1,36,52]]){
    assert.deepEqual(cardControlMetrics(count,desktop,36,true),{width:touch,height:52});
    assert.deepEqual(cardControlMetrics(count,desktop,36,false),{width:desktop,height:36});
  }
});

for(const zoom of [.25,.5,1,2])test(`touch dock clears reading body, ports and rail at ${zoom} zoom`,()=>{
  const node=Object.freeze({x:100,y:300,width:160,height:140}),viewport=Object.freeze({x:60-node.x*zoom,y:280-node.y*zoom,zoom});
  const rail={x:8,y:76,width:54,height:260};
  const layout=cardControlLayout(node,viewport,390,760,5,{width:236,height:36,touchTargets:true,topReserve:76,screenGap:24,avoid:[rail]});
  const right=(node.x+node.width-layout.right)*zoom+viewport.x;
  const dock={x:right-284*layout.scale*zoom,y:(node.y+layout.top)*zoom+viewport.y,width:284*layout.scale*zoom,height:52*layout.scale*zoom};
  close(layout.scale*zoom,1);close(44*layout.scale*zoom,44);close(dock.width,284);close(dock.height,52);
  assert.ok(dock.x>=12-1e-7&&dock.x+dock.width<=378+1e-7);
  assert.ok(dock.y>=76-1e-7&&dock.y+dock.height<=748+1e-7);
  const body={x:60,y:280,width:node.width*zoom,height:node.height*zoom};
  assert.equal(intersects(dock,body),false);assert.equal(intersects(dock,rail),false);
  for(const [x,y]of [[body.x+body.width/2,body.y],[body.x+body.width/2,body.y+body.height],[body.x,body.y+body.height/2],[body.x+body.width,body.y+body.height/2]]){
    assert.equal(intersects(dock,{x:x-24,y:y-24,width:48,height:48}),false);
  }
  assert.equal(node.width,160);assert.equal(node.height,140);
});

test('touch dock takes the remaining vertical gap when a nearby document blocks its first position',()=>{
  const node={x:70,y:300,width:240,height:180},neighbour={x:64,y:200,width:250,height:68},viewport={x:0,y:0,zoom:1};
  const layout=cardControlLayout(node,viewport,390,760,4,{width:168,height:36,touchTargets:true,topReserve:72,screenGap:24,avoid:[neighbour]});
  const dock={x:node.x+node.width-layout.right-216,y:node.y+layout.top,width:216,height:52};
  assert.equal(intersects(dock,node),false);assert.equal(intersects(dock,neighbour),false);
  assert.ok(dock.x>=12&&dock.x+dock.width<=378);assert.ok(dock.y>=72&&dock.y+dock.height<=748);
});

test('touch dimensions remain finite for unavailable or invalid measurements',()=>{
  for(const count of [0,-1,NaN,Infinity])for(const size of [undefined,0,-1,NaN,Infinity]){
    const metrics=cardControlMetrics(count,size,size,true);
    assert.ok(Number.isFinite(metrics.width)&&metrics.width>0);assert.ok(Number.isFinite(metrics.height)&&metrics.height>0);
  }
});

for(const zoom of [.5,1,2])test(`stable shared reservations keep neighbouring note/text docks separate at ${zoom} zoom`,()=>{
  const viewport={x:0,y:0,zoom},bodies=[{x:43,y:49,width:280,height:220},{x:43,y:301,width:280,height:220}];
  const requests:CardControlDockRequest[]=bodies.map((body,index)=>({id:String(index),node:{x:body.x/zoom,y:body.y/zoom,width:body.width/zoom,height:body.height/zoom},count:index?3:5,priority:2,dimensions:{width:index?136:236,height:36,touchTargets:true,topReserve:60,screenGap:24,avoid:[bodies[1-index],{x:8,y:258,width:54,height:152}]}}));
  const source=JSON.stringify(requests),placements=reserveCardControlDocks(requests,viewport,346,700);
  const rectangles=requests.map(request=>{const p=placements.get(request.id)!,m=cardControlMetrics(request.count,request.dimensions.width,36,true);return{x:(request.node.x+request.node.width-p.right)*zoom-m.width*p.scale*zoom,y:(request.node.y+p.top)*zoom,width:m.width*p.scale*zoom,height:m.height*p.scale*zoom};});
  assert.equal(intersects(rectangles[0],rectangles[1]),false,'the two visible docks reserve different gaps');
  for(const rect of rectangles){for(const body of bodies)assert.equal(intersects(rect,body),false);assert.ok(rect.y>=60&&rect.y+rect.height<=688);}
  assert.deepEqual(reserveCardControlDocks(requests,viewport,346,700),placements,'same requests cannot alternate or push earlier docks');
  assert.equal(JSON.stringify(requests),source,'placement never mutates model or request geometry');
});

test('focus then selection own their stable slot before passive neighbours',()=>{
  const node={x:60,y:180,width:220,height:100},dimensions={width:36,height:36,touchTargets:true,topReserve:60,screenGap:24};
  const requests:CardControlDockRequest[]=[{id:'passive',priority:2,node,count:1,dimensions},{id:'selected',priority:1,node,count:1,dimensions},{id:'focus',priority:0,node,count:1,dimensions}];
  const viewport={x:0,y:0,zoom:1},positions=reserveCardControlDocks(requests,viewport,346,700);
  assert.deepEqual([...positions.keys()],['focus','selected','passive']);
  assert.deepEqual(positions.get('focus'),cardControlLayout(node,viewport,346,700,1,dimensions));
  const rects=[...positions.values()].map(p=>({x:node.x+node.width-p.right-52,y:node.y+p.top,width:52,height:52}));
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert.equal(intersects(rects[i],rects[j]),false);
});

for(const count of [1,2])for(const zoom of [.5,1,2])test(`${count} touch fold slots clear a short folded card, neighbours and ports at ${zoom} zoom`,()=>{
  const node=Object.freeze({x:100,y:300,width:80,height:40}),viewport=Object.freeze({x:170-100*zoom,y:250-300*zoom,zoom});
  const neighbour={x:130,y:160,width:120,height:50},width=count===1?52:100;
  const layout=cardControlLayout(node,viewport,346,680,count,{width:32*count+4,height:36,touchTargets:true,topReserve:70,screenGap:24,avoid:[neighbour]});
  const right=(node.x+node.width-layout.right)*zoom+viewport.x;
  const dock={x:right-width,y:(node.y+layout.top)*zoom+viewport.y,width,height:52};
  const unfold={x:right-48,y:dock.y+4,width:44,height:44};
  const body={x:170,y:250,width:80*zoom,height:40*zoom};
  close(layout.scale*zoom,1);assert.ok(unfold.x>=dock.x&&unfold.x+44<=dock.x+dock.width);
  assert.ok(unfold.y>=dock.y&&unfold.y+44<=dock.y+dock.height);
  assert.equal(intersects(dock,body),false);assert.equal(intersects(dock,neighbour),false);
  for(const [x,y]of [[body.x+body.width/2,body.y],[body.x+body.width/2,body.y+body.height],[body.x,body.y+body.height/2],[body.x+body.width,body.y+body.height/2]])assert.equal(intersects(dock,{x:x-24,y:y-24,width:48,height:48}),false);
  assert.deepEqual(node,{x:100,y:300,width:80,height:40});
});

 test('expanded formatting avoids selected prose without moving the card or camera',()=>{
 const prose=Object.freeze({x:43,y:49,width:280,height:220});
 assert.equal(formatToolbarTop(760,142,80,prose),281);
 assert.equal(formatToolbarTop(760,142,80,{...prose,y:300}),8);
 assert.equal(formatToolbarTop(280,142,80,prose),8,'short leaves retain the reachable top slot when no clear slot exists');
 assert.equal(formatToolbarTop(760,142,80,undefined),8);
 assert.deepEqual(prose,{x:43,y:49,width:280,height:220});
 });
