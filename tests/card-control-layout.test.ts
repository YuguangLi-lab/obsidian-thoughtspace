import test from 'node:test';
import assert from 'node:assert/strict';
import {cardControlLayout,type CardControlRect} from '../src/card-control-layout';
import {foldControlObstacles} from '../src/fold-control-obstacles';

const node={x:350,y:300,width:320,height:220};
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
function screen(rect:typeof node,viewport:{x:number;y:number;zoom:number},count:number,width=1200,height=900,dimensions?:{width:number;height:number;topReserve?:number;screenGap?:number;avoid?:ReadonlyArray<CardControlRect>}){
  const layout=cardControlLayout(rect,viewport,width,height,count,dimensions);
  const w=(dimensions?.width??32*count+4)*layout.scale*viewport.zoom,h=(dimensions?.height??36)*layout.scale*viewport.zoom;
  const right=(rect.x+rect.width-layout.right)*viewport.zoom+viewport.x;
  const top=(rect.y+layout.top)*viewport.zoom+viewport.y;
  return {...layout,left:right-w,screenRight:right,screenTop:top,bottom:top+h,w,h};
}
function portDistance(rect:typeof node,viewport:{x:number;y:number;zoom:number},box:ReturnType<typeof screen>){
  const x=(rect.x+rect.width/2)*viewport.zoom+viewport.x,y=rect.y*viewport.zoom+viewport.y;
  return Math.hypot(Math.max(box.left-x,0,x-box.screenRight),Math.max(box.screenTop-y,0,y-box.bottom))/viewport.zoom;
}

for(const zoom of [.5,1,2])test(`toolbar stays screen-sized, above and right-aligned at zoom ${zoom}`,()=>{
  const viewport={x:30,y:40,zoom},box=screen(node,viewport,5,1800,1200);
  close(box.scale,1/zoom);close(box.w,164);close(box.h,36);close(box.right,0);
  close(box.bottom,node.y*zoom+viewport.y-20*zoom);
  assert.ok(portDistance(node,viewport,box)>=20-1e-8);
});

test('action count reserves the actual compact, text and note toolbar widths',()=>{
  for(const [count,width] of [[1,36],[2,68],[3,100],[5,164]]){
    const box=screen(node,{x:0,y:0,zoom:1},count);
    close(box.w,width);close(box.right,0);
  }
});

test('panned cards at either horizontal edge keep controls inside screen gutters',()=>{
  for(const x of [-600,300]){
    const viewport={x,y:0,zoom:1},box=screen(node,viewport,5,800,600);
    assert.ok(box.left>=12);assert.ok(box.screenRight<=788);
    assert.ok(portDistance(node,viewport,box)>=20-1e-8);
  }
});

test('the top reserved area redirects the toolbar away from the top connection port',()=>{
  const rect={...node,x:100,y:65,width:160},viewport={x:0,y:0,zoom:1};
  const box=screen(rect,viewport,5,800,600);
  close(box.screenTop,60);assert.ok(box.left>=12);assert.ok(box.screenRight<=788);
  assert.ok(portDistance(rect,viewport,box)>=20-1e-8);
  assert.ok(box.left>=rect.x+rect.width/2+20||box.screenRight<=rect.x+rect.width/2-20);
});

test('narrow stages use vertical port clearance when horizontal clearance cannot fit',()=>{
  const rect={...node,x:0,y:65,width:180},viewport={x:0,y:0,zoom:1};
  const box=screen(rect,viewport,5,200,400);
  assert.ok(box.left>=12);assert.ok(box.screenRight<=188);assert.ok(box.screenTop>=60);
  assert.ok(portDistance(rect,viewport,box)>=20-1e-8);
});

test('bottom and translated viewport boundaries keep the toolbar visible',()=>{
  const viewport={x:-100,y:249,zoom:.5},box=screen(node,viewport,5,600,400);
  assert.ok(box.screenTop>=60);assert.ok(box.bottom<=388);
  assert.ok(box.left>=12);assert.ok(box.screenRight<=588);
});

test('extreme zoom clamps inverse scale without clipping when space exists',()=>{
  for(const zoom of [.01,.1,4,10]){
    const viewport={x:400-node.x*zoom,y:400-node.y*zoom,zoom};
    const box=screen(node,viewport,5,1600,1000);
    close(box.scale,Math.max(.4,Math.min(2,1/zoom)));
    assert.ok(box.left>=12-1e-8&&box.screenRight<=1588+1e-8);
    assert.ok(box.screenTop>=60-1e-8&&box.bottom<=988+1e-8);
    assert.ok(portDistance(node,viewport,box)>=20-1e-8);
  }
});

test('a tight stage relaxes gutters before introducing unavoidable clipping',()=>{
  const rect={x:20,y:5,width:100,height:40},viewport={x:0,y:0,zoom:1},box=screen(rect,viewport,5,170,50);
  assert.ok(box.left>=0&&box.screenRight<=170);assert.ok(box.screenTop>=0&&box.bottom<=50);
  close(box.scale,1);
});

test('an impossibly small stage balances overflow without changing toolbar scale',()=>{
  const box=screen({x:0,y:0,width:100,height:20},{x:0,y:0,zoom:1},5,100,20);
  close(box.scale,1);close(box.left,100-box.screenRight);close(box.screenTop,20-box.bottom);
});

test('invalid measurements and zero-size stages return finite CSS geometry',()=>{
  for(const zoom of [0,-1,NaN,Infinity,Number.MIN_VALUE,Number.MAX_VALUE]){
    const result=cardControlLayout({x:NaN,y:Infinity,width:-1,height:NaN},{x:NaN,y:Infinity,zoom},0,-10,NaN);
    assert.ok(Object.values(result).every(Number.isFinite));assert.ok(result.scale>=.4&&result.scale<=2);
  }
  const invalid=cardControlLayout(node,{x:0,y:0,zoom:0},1200,900,0);
  const fallback=cardControlLayout(node,{x:0,y:0,zoom:1},1200,900,1);
  assert.deepEqual(invalid,fallback);
});

test('layout is deterministic and leaves node, viewport and projected dimensions unchanged',()=>{
  const rect=Object.freeze({...node,width:180,height:40}),viewport=Object.freeze({x:10,y:20,zoom:.5});
  const first=cardControlLayout(rect,viewport,800,600,2);
  assert.deepEqual(cardControlLayout(rect,viewport,800,600,2),first);
  assert.equal(rect.width,180);assert.equal(rect.height,40);
});

const intersects=(box:ReturnType<typeof screen>,rect:{left:number;right:number;top:number;bottom:number})=>
  box.left<rect.right-1e-8&&box.screenRight>rect.left+1e-8&&box.screenTop<rect.bottom-1e-8&&box.bottom>rect.top+1e-8;

test('top-edge compact controls keep all four 30 px ports and their 5 px margins clear',()=>{
  for(const zoom of [.5,1,2])for(const count of [1,2]){
    const rect={x:100,y:65,width:180,height:40},viewport={x:0,y:65-rect.y*zoom,zoom};
    const box=screen(rect,viewport,count,800,600);
    for(const [x,y] of [[rect.x+rect.width/2,rect.y],[rect.x+rect.width/2,rect.y+rect.height],[rect.x,rect.y+rect.height/2],[rect.x+rect.width,rect.y+rect.height/2]]){
      const px=x*zoom+viewport.x,py=y*zoom+viewport.y,half=20*zoom;
      assert.equal(intersects(box,{left:px-half,right:px+half,top:py-half,bottom:py+half}),false,`port ${x},${y} at zoom ${zoom}, count ${count}`);
    }
  }
});

test('top-edge placement clears the neighboring branch disclosure dock',()=>{
  const rect={x:-50,y:65,width:180,height:40},viewport={x:0,y:0,zoom:1};
  const box=screen(rect,viewport,5,800,600),right=rect.x+rect.width,cy=rect.y+rect.height/2;
  assert.equal(intersects(box,{left:right+19,right:right+141,top:cy-21,bottom:cy+21}),false);
  assert.ok(box.left>=12&&box.screenRight<=788&&box.screenTop>=60&&box.bottom<=588);
});

test('fully offscreen overscan nodes retain their local dock instead of floating at the viewport edge',()=>{
  for(const rect of [
    {...node,x:-500,width:180},{...node,x:900,width:180},
    {...node,y:-100,height:40},{...node,y:700,height:40},
  ]){
    const result=cardControlLayout(rect,{x:0,y:0,zoom:1},800,600,2);
    assert.deepEqual(result,{scale:1,top:-56,right:0});
  }
});

for(const zoom of [.5,1,2])test(`custom note, text and compact dock widths stay screen-sized at zoom ${zoom}`,()=>{
  const viewport={x:30,y:40,zoom};
  for(const [count,width] of [[5,236],[3,136],[1,36]]){
    const box=screen(node,viewport,count,1800,1200,{width,height:36,topReserve:126});
    close(box.scale,1/zoom);close(box.w,width);close(box.h,36);close(box.right,0);
    close(box.bottom,node.y*zoom+viewport.y-20*zoom);assert.ok(box.screenTop>=126);
  }
});

test('a 126 px format reserve keeps custom docks below the expanded toolbar at either stage edge',()=>{
  for(const zoom of [.5,1,2])for(const left of [-40,780])for(const [count,width] of [[5,236],[3,136],[1,36]]){
    const viewport={x:left-node.x*zoom,y:130-node.y*zoom,zoom};
    const box=screen(node,viewport,count,800,600,{width,height:36,topReserve:126});
    assert.ok(box.left>=12-1e-8&&box.screenRight<=788+1e-8);
    assert.ok(box.screenTop>=126-1e-8&&box.bottom<=588+1e-8);
    for(const [x,y] of [[node.x+node.width/2,node.y],[node.x+node.width/2,node.y+node.height],[node.x,node.y+node.height/2],[node.x+node.width,node.y+node.height/2]]){
      const px=x*zoom+viewport.x,py=y*zoom+viewport.y,half=20*zoom;
      assert.equal(intersects(box,{left:px-half,right:px+half,top:py-half,bottom:py+half}),false);
    }
  }
});

test('offscreen default positioning uses the custom height at each zoom and ignores the format reserve',()=>{
  const rect={...node,y:-500};
  for(const zoom of [.5,1,2]){
    const result=cardControlLayout(rect,{x:0,y:0,zoom},800,600,5,{width:236,height:52,topReserve:126});
    assert.deepEqual(result,{scale:1/zoom,top:-52/zoom-20,right:0});
  }
});

test('explicit legacy dimensions remain compatible with the original action-count API',()=>{
  for(const count of [1,2,3,5])for(const zoom of [.5,1,2]){
    const viewport={x:0,y:-240,zoom};
    assert.deepEqual(cardControlLayout(node,viewport,800,600,count,{width:32*count+4,height:36,topReserve:60}),cardControlLayout(node,viewport,800,600,count));
  }
});

test('malformed custom dimensions and reserves cannot emit non-finite CSS positions',()=>{
  for(const dimensions of [
    {width:NaN,height:NaN,topReserve:NaN},
    {width:Infinity,height:-Infinity,topReserve:Infinity},
    {width:-236,height:0,topReserve:-126},
    {width:Number.MAX_VALUE,height:Number.MAX_VALUE,topReserve:Number.MAX_VALUE},
  ])for(const zoom of [.5,1,2]){
    for(const rect of [node,{...node,y:-500}]){
      const result=cardControlLayout(rect,{x:0,y:0,zoom},800,600,5,dimensions);
      assert.ok(Object.values(result).every(Number.isFinite),JSON.stringify({dimensions,zoom,result}));
      assert.ok(result.scale>=.4&&result.scale<=2);
    }
  }
});

test('a taller format bar keeps the note dock below its body when vertical clearance is nearer',()=>{
  const rect={x:350,y:100,width:320,height:220};
  const box=screen(rect,{x:0,y:0,zoom:1},5,1000,700,{width:236,height:36,topReserve:126});
  assert.equal(intersects(box,{left:350,right:670,top:100,bottom:320}),false);
  close(box.left,434);close(box.screenTop,340);
  assert.ok(box.screenTop-126<670-434,'the clear vertical position is closer than the available right side');
  assert.ok(box.screenRight<=988&&box.bottom<=688);
});

test('a taller card still uses its nearer side when vertical clearance would be farther',()=>{
  const rect={x:350,y:100,width:320,height:320};
  const box=screen(rect,{x:0,y:0,zoom:1},5,1000,700,{width:236,height:36,topReserve:126});
  close(box.left,670);close(box.screenTop,126);
  assert.equal(intersects(box,{left:350,right:670,top:100,bottom:420}),false);
  assert.ok(670-434<440-126,'the right side remains closer than the clear vertical position');
  assert.ok(box.screenRight<=988&&box.bottom<=688);
});

test('custom dock placement keeps the scaled body clear at half, normal and double zoom',()=>{
  const rect={x:350,y:100,width:320,height:220};
  // At double zoom the right-aligned dock also clears the bottom port
  // horizontally, so the nearest valid position touches the body's bottom.
  for(const [zoom,expectedTop] of [[.5,220],[1,340],[2,540]]){
    const viewport={x:350-rect.x*zoom,y:100-rect.y*zoom,zoom};
    const box=screen(rect,viewport,5,1000,700,{width:236,height:36,topReserve:126});
    assert.equal(intersects(box,{left:350,right:350+rect.width*zoom,top:100,bottom:100+rect.height*zoom}),false);
    close(box.screenTop,expectedTop);
    assert.ok(box.left>=12&&box.screenRight<=988&&box.bottom<=688);
    for(const [x,y] of [[350+rect.width*zoom/2,100],[350+rect.width*zoom/2,100+rect.height*zoom],[350,100+rect.height*zoom/2],[350+rect.width*zoom,100+rect.height*zoom/2]]){
      assert.equal(intersects(box,{left:x-20*zoom,right:x+20*zoom,top:y-20*zoom,bottom:y+20*zoom}),false);
    }
  }
});

test('when neither side can contain the dock it moves below the body and bottom port',()=>{
  const rect={x:80,y:100,width:160,height:120};
  const box=screen(rect,{x:0,y:0,zoom:1},5,320,600,{width:236,height:36,topReserve:126});
  assert.equal(intersects(box,{left:80,right:240,top:100,bottom:220}),false);
  assert.ok(box.screenTop>=240);assert.ok(box.bottom<=588);
  assert.ok(box.left>=12&&box.screenRight<=308);
});

test('an impossible body/viewport fit minimizes overlap while keeping the dock reachable',()=>{
  const rect={x:20,y:100,width:200,height:100};
  const box=screen(rect,{x:0,y:0,zoom:1},5,240,240,{width:236,height:36,topReserve:126});
  assert.ok(box.left>=0&&box.screenRight<=240&&box.screenTop>=126&&box.bottom<=240);
  const overlapHeight=Math.max(0,Math.min(box.bottom,200)-Math.max(box.screenTop,100));
  assert.ok(overlapHeight>0&&overlapHeight<36,'only the unavoidable bottom strip covers the body');
});

for(const zoom of [.5,1,2])test(`a narrow note dock clears the screen-sized creation rail below it at zoom ${zoom}`,()=>{
  const rect={x:80/zoom,y:100/zoom,width:160/zoom,height:120/zoom},viewport={x:0,y:0,zoom};
  // The caller expands the measured rail by its 6 px interaction margin.
  const rail={x:6,y:60,width:68,height:300},dimensions={width:236,height:36,topReserve:126};
  const before=screen(rect,viewport,5,320,600,dimensions),box=screen(rect,viewport,5,320,600,{...dimensions,avoid:[rail]});
  const obstacle={left:rail.x,right:rail.x+rail.width,top:rail.y,bottom:rail.y+rail.height};
  assert.equal(intersects(before,obstacle),true,'without the chrome obstacle the dock covers the rail');
  assert.ok(obstacle.right+box.w>308,'there is insufficient horizontal room beside the rail');
  assert.equal(intersects(box,obstacle),false);assert.equal(intersects(box,{left:80,right:240,top:100,bottom:220}),false);
  close(box.screenTop,obstacle.bottom);close(box.scale,1/zoom);
  assert.ok(box.left>=12&&box.screenRight<=308&&box.screenTop>=126&&box.bottom<=588,'the complete dock remains reachable');
});

test('a creation rail that does not overlap a normal right-side dock leaves its placement unchanged',()=>{
  const viewport={x:0,y:0,zoom:1},dimensions={width:236,height:36,topReserve:126};
  const rail={x:6,y:60,width:68,height:300};
  assert.deepEqual(cardControlLayout(node,viewport,1200,900,5,{...dimensions,avoid:[rail]}),cardControlLayout(node,viewport,1200,900,5,dimensions));
  assert.deepEqual(cardControlLayout(node,viewport,1200,900,5,{...dimensions,avoid:[]}),cardControlLayout(node,viewport,1200,900,5,dimensions));
});

test('the desktop card-picker keeps its reading dock nearer its own card when vertical clearance beats a distant side',()=>{
  // Native round1/light-1440-card-picker.png: stage (44,84), card (164,234),
  // format bottom 199, reading button x=865. The old side-first dock at
  // (818,127) stage pixels left that button 401 px past its card's right edge.
  const rect={id:'index',x:80,y:120,width:300,height:240},viewport={x:40,y:30,zoom:1};
  const neighbors=[rect,
    {id:'sticky',x:470,y:140,width:300,height:220},
    {id:'paper',x:470,y:480,width:300,height:200},
    {id:'table',x:80,y:470,width:300,height:170},
  ];
  const avoid=[{x:10,y:237.5,width:62,height:372},...foldControlObstacles(rect,neighbors,viewport)];
  const box=screen(rect,viewport,4,1396,790,{width:168,height:36,topReserve:127,screenGap:24,avoid});
  const preferred={left:252,top:127},oldSide={left:818,top:127};
  // Four px dock padding minus the card's one px border matches the native
  // first button. The old placement fails this assertion with actual=401.
  close(box.left+3-420,-165);
  close(box.left,preferred.left);close(box.screenTop,414);
  assert.ok(Math.hypot(box.left-preferred.left,box.screenTop-preferred.top)<Math.hypot(oldSide.left-preferred.left,oldSide.top-preferred.top));
  const obstacles=[
    {left:120,right:420,top:150,bottom:390},
    ...[[270,150],[270,390],[120,270],[420,270]].map(([x,y])=>({left:x-24,right:x+24,top:y-24,bottom:y+24})),
    {left:439,right:561,top:249,bottom:291},
    ...avoid.map(r=>({left:r.x,right:r.x+r.width,top:r.y,bottom:r.y+r.height})),
  ];
  for(const obstacle of obstacles)assert.equal(intersects(box,obstacle),false,`dock must clear ${JSON.stringify(obstacle)}`);
  assert.ok(box.left>=12&&box.screenRight<=1384&&box.screenTop>=127&&box.bottom<=778,'all actions remain inside the reserved screen area');
});

test('invalid avoidance rectangles are ignored without changing the supplied model or measurements',()=>{
  const rect=Object.freeze({...node}),viewport=Object.freeze({x:0,y:0,zoom:1});
  const avoid=Object.freeze([
    {x:NaN,y:0,width:80,height:400},{x:0,y:Infinity,width:80,height:400},
    {x:0,y:0,width:Infinity,height:400},{x:0,y:0,width:80,height:NaN},
    {x:0,y:0,width:0,height:400},{x:0,y:0,width:80,height:-400},
    {x:Number.MAX_VALUE,y:0,width:Number.MAX_VALUE,height:400},
    {x:0,y:Number.MAX_VALUE,width:80,height:Number.MAX_VALUE},
  ].map(obstacle=>Object.freeze(obstacle)));
  const dimensions=Object.freeze({width:236,height:36,topReserve:126,avoid}),before=structuredClone({rect,viewport,dimensions});
  const placement=cardControlLayout(rect,viewport,1200,900,5,dimensions);
  assert.deepEqual(placement,cardControlLayout(rect,viewport,1200,900,5,{width:236,height:36,topReserve:126}));
  assert.deepEqual({rect,viewport,dimensions},before);
});

test('unavoidable chrome overlap retains a finite minimum-overlap dock inside the stage',()=>{
  const rect={x:20,y:100,width:200,height:100},viewport={x:0,y:0,zoom:1};
  const avoid=[{x:0,y:0,width:240,height:240}];
  const box=screen(rect,viewport,5,240,240,{width:236,height:36,topReserve:126,avoid});
  assert.ok(Object.values(box).every(Number.isFinite));close(box.scale,1);
  assert.ok(box.left>=0&&box.screenRight<=240&&box.screenTop>=126&&box.bottom<=240);
  const overlapHeight=Math.max(0,Math.min(box.bottom,200)-Math.max(box.screenTop,100));
  assert.ok(overlapHeight>0&&overlapHeight<36,'the additional unavoidable obstacle preserves the existing body-overlap fallback');
});

test('offscreen fallback stays local even when canvas chrome avoidance is supplied',()=>{
  const rect={...node,y:-500},viewport={x:0,y:0,zoom:.5};
  const dimensions={width:236,height:52,topReserve:126};
  assert.deepEqual(cardControlLayout(rect,viewport,800,600,5,{...dimensions,avoid:[{x:0,y:0,width:800,height:600}]}),cardControlLayout(rect,viewport,800,600,5,dimensions));
});
