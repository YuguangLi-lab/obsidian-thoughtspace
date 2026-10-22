import test from 'node:test';
import assert from 'node:assert/strict';
import {foldControlObstacles} from '../src/fold-control-obstacles';
import {cardControlLayout} from '../src/card-control-layout';
const parent={id:'parent',x:400,y:300,width:260,height:200};
for(const zoom of [.5,1,2.5])for(const side of [-1,1])test(`external fold clears nearby child and ports at ${zoom}x side ${side}`,()=>{
 const view={x:800-(parent.x+parent.width/2)*zoom,y:400-parent.y*zoom,zoom};
 const child={id:'child',x:parent.x+side*210,y:parent.y-85,width:180,height:70};
 const avoid=foldControlObstacles(parent,[parent,child],view);
 const layout=cardControlLayout(parent,view,1600,1100,1,{width:36,height:36,screenGap:24,avoid});
 const right=(parent.x+parent.width-layout.right)*zoom+view.x,top=(parent.y+layout.top)*zoom+view.y,size=36*layout.scale*zoom;
 for(const r of avoid)assert.ok(right<=r.x||right-size>=r.x+r.width||top+size<=r.y||top>=r.y+r.height);
 const px=parent.x*zoom+view.x,py=parent.y*zoom+view.y;
 assert.ok(right<=px||right-size>=px+parent.width*zoom||top+size<=py||top>=py+parent.height*zoom);
 assert.ok(right-size>=0&&right<=1600&&top>=0&&top+size<=1100);
});
test('containing group reserves its frame and edge ports while its interior remains usable',()=>{
 const group={id:'group',kind:'section',x:300,y:200,width:600,height:500},view={x:0,y:0,zoom:1};
 const boxes=foldControlObstacles(parent,[parent,group],view);assert.equal(boxes.length,8);
 assert.ok(boxes.slice(0,4).every(r=>r.height===16||r.width===16));
 assert.ok(boxes.every(r=>!overlaps(r,{x:440,y:340,width:80,height:80})),'group interior is not filled by port strips');
 for(const point of [{x:600,y:185},{x:600,y:715},{x:285,y:450},{x:915,y:450}])assert.ok(boxes.some(r=>contains(r,point)),'group edge port remains reserved');
 const before=structuredClone([parent,group]);foldControlObstacles(parent,[parent,group],view);assert.deepEqual([parent,group],before);
});
test('invalid and remote geometry never reserves invisible unrelated space',()=>{
 assert.deepEqual(foldControlObstacles(parent,[parent,{id:'far',x:1e7,y:1e7,width:100,height:100},{id:'bad',x:NaN,y:0,width:100,height:100}],{x:0,y:0,zoom:1}),[]);
 assert.deepEqual(foldControlObstacles(parent,[parent],{x:0,y:0,zoom:0}),[]);
});

const overlaps=(a:{x:number;y:number;width:number;height:number},b:typeof a)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
const contains=(r:{x:number;y:number;width:number;height:number},p:{x:number;y:number})=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;

for(const zoom of [.25,.5,1,2,4])test(`neighbour port corners remain reserved at ${zoom}x without changing model or camera`,()=>{
 const node={id:'selected',x:100,y:300,width:180,height:40},other={id:'neighbour',x:100,y:300-95/zoom,width:Math.max(80,110/zoom),height:Math.max(40,42/zoom)},view={x:170-100*zoom,y:250-300*zoom,zoom};
 const before=structuredClone({node,other,view}),avoid=foldControlObstacles(node,[node,other],view);
 // CSS buttons are 30 px. At these supported zooms the native renderer holds
 // their screen width at 30 below 1x and scales it to 60/120 at 2x/4x.
 const radius=zoom<=1?15:15*zoom,x=other.x*zoom+view.x,y=other.y*zoom+view.y,w=other.width*zoom,h=other.height*zoom;
 for(const [cx,cy]of [[x+w/2,y],[x+w/2,y+h],[x,y+h/2],[x+w,y+h/2]])for(const dx of [-radius,radius])for(const dy of [-radius,radius])assert.ok(avoid.some(r=>contains(r,{x:cx+dx,y:cy+dy})),`uncovered native port corner ${cx+dx},${cy+dy}`);
 assert.deepEqual({node,other,view},before);
});

test('the D native 2x two-action dock clears the neighbour port that intercepted its reading corners',()=>{
 const node={id:'fold-2-2',x:100,y:300,width:180,height:40},other={id:'neighbour',x:100,y:252.5,width:80,height:40},view={x:-30,y:-350,zoom:2};
 const dimensions={width:68,height:36,touchTargets:true,screenGap:24,topReserve:64};
 const project=(avoid:ReturnType<typeof foldControlObstacles>)=>{const p=cardControlLayout(node,view,346,760,2,{...dimensions,avoid});return{x:(node.x+node.width-p.right)*2-30-100,y:(node.y+p.top)*2-350,width:100,height:52};};
 const oldBody={x:162,y:147,width:176,height:96},nativeTopPort={x:220,y:125,width:60,height:60};
 assert.ok(overlaps(project([oldBody]),nativeTopPort),'original body-only reservation reproduces the native transparent-port collision');
 const dock=project(foldControlObstacles(node,[node,other],view));
 for(const port of [nativeTopPort,{x:220,y:205,width:60,height:60},{x:140,y:165,width:60,height:60},{x:300,y:165,width:60,height:60}])assert.equal(overlaps(dock,port),false,'all four real neighbouring port boxes remain clear');
 assert.ok(dock.x>=12&&dock.x+dock.width<=334&&dock.y>=64&&dock.y+dock.height<=748,'complete 44px actions remain inside the stage');
});

test('a tall narrow neighbour does not reserve an artificial strip between disjoint ports',()=>{
 const node={id:'selected',x:100,y:100,width:60,height:60},thin={id:'thin',x:180,y:100,width:10,height:140};
 const avoid=foldControlObstacles(node,[node,thin],{x:0,y:0,zoom:1});
 assert.equal(avoid.some(r=>contains(r,{x:170,y:130})),false,'point clears both the body margin and the separate top/side port targets');
});

for(const count of [80,160])for(const selected of [10,42])test(`dense ${count}-card selection ${selected} clears every mounted on-screen body and port`,()=>{
 const nodes=Array.from({length:count},(_,i)=>({id:String(i),kind:'text',x:60+(i%8)*190,y:180+Math.floor(i/8)*160,width:160,height:100})),node=nodes[selected],view={x:0,y:0,zoom:.5},stage={width:844,height:count===80?1282:1760},before=structuredClone({nodes,view});
 const project=(avoid:ReturnType<typeof foldControlObstacles>)=>{const p=cardControlLayout(node,view,stage.width,stage.height,2,{width:68,height:36,touchTargets:true,screenGap:24,topReserve:64,avoid});return{x:(node.x+node.width-p.right)*.5-100,y:(node.y+p.top)*.5,width:100,height:52};};
 const nativeBounds=nodes.flatMap(n=>{const x=n.x*.5,y=n.y*.5,w=n.width*.5,h=n.height*.5;return[{x,y,width:w,height:h},...[[x+w/2,y],[x+w/2,y+h],[x,y+h/2],[x+w,y+h/2]].map(([cx,cy])=>({x:cx-15,y:cy-15,width:30,height:30}))];});
 assert.ok(nativeBounds.some(r=>overlaps(project(foldControlObstacles(node,nodes,view)),r)),'a local-only obstacle set can move the dock onto a more distant visible row');
 const dock=project(foldControlObstacles(node,nodes,view,stage));
 for(const r of nativeBounds)assert.equal(overlaps(dock,r),false,`dock intersects native bounds ${JSON.stringify(r)}`);
 assert.ok(dock.x>=12&&dock.x+dock.width<=stage.width-12&&dock.y>=64&&dock.y+dock.height<=stage.height-12);
 assert.deepEqual({nodes,view},before,'selection placement cannot move cards or camera');
});

test('stage filtering retains an offscreen neighbour port entering the canvas but excludes distant mounted overscan',()=>{
 const node={id:'selected',x:50,y:100,width:80,height:60},edge={id:'edge',x:-95,y:150,width:80,height:40},far={id:'far',x:3000,y:3000,width:80,height:40},view={x:0,y:0,zoom:1},stage={width:346,height:760};
 const avoid=foldControlObstacles(node,[node,edge,far],view,stage);
 assert.ok(avoid.some(r=>contains(r,{x:0,y:170})),'right port extends into the canvas even though the neighbour body is outside');
 assert.ok(avoid.every(r=>r.x<500&&r.y<1000),'far mounted overscan consumes no visible placement work');
});
