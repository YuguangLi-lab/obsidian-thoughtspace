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
test('containing group reserves only its frame so its child can still use external controls',()=>{
 const group={id:'group',kind:'section',x:300,y:200,width:600,height:500},view={x:0,y:0,zoom:1};
 const boxes=foldControlObstacles(parent,[parent,group],view);assert.equal(boxes.length,4);
 assert.ok(boxes.every(r=>r.height===16||r.width===16));
 const before=structuredClone([parent,group]);foldControlObstacles(parent,[parent,group],view);assert.deepEqual([parent,group],before);
});
test('invalid and remote geometry never reserves invisible unrelated space',()=>{
 assert.deepEqual(foldControlObstacles(parent,[parent,{id:'far',x:1e7,y:1e7,width:100,height:100},{id:'bad',x:NaN,y:0,width:100,height:100}],{x:0,y:0,zoom:1}),[]);
 assert.deepEqual(foldControlObstacles(parent,[parent],{x:0,y:0,zoom:0}),[]);
});
