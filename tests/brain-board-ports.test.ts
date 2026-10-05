import test from 'node:test';
import assert from 'node:assert/strict';
import {brainPortPositions} from '../src/brain-board-ports';
import type {BrainBoardLayout} from '../src/brain-board-layout';

for(const zoom of [.2,.36,.72,1,1.5,2.5])for(const width of [240,360,600,1200])for(const expanded of [false,true])test(`ports avoid titles and bodies at ${width}px / ${zoom} / expanded=${expanded}`,()=>{
 const nodes:BrainBoardLayout['nodes']=[{id:'center',role:'center' as const,x:600,y:400,width:240,height:72,...(expanded?{previewWidth:420}:{})},{id:'neighbor',role:'children' as const,x:680,y:780,width:200,height:48}];
 const layout:BrainBoardLayout={nodes,width:1600,height:1000,links:[],labels:[],page:0,pages:1,total:1},camera={x:width/2-720*zoom,y:350-436*zoom,zoom};
 const ports=brainPortPositions(layout,camera,{width,height:800}),targets: {x:number;y:number}[]=[];
 for(const port of ports.values()){
  const x=camera.x+(600+port.x)*zoom,y=camera.y+(400+port.y)*zoom;
  assert(x>=2&&x+32<=width-2&&y>=2&&y+32<=798,'full physical target must fit');
  for(const node of nodes){
   const rects=[{x:node.x,y:node.y,width:node.width,height:node.height},...(node.previewWidth?[{x:node.x+node.width/2-node.previewWidth/2,y:node.y+node.height+12,width:node.previewWidth,height:200}]:[])];
   for(const r of rects){const rx=camera.x+r.x*zoom,ry=camera.y+r.y*zoom;assert(!(x<rx+r.width*zoom&&rx<x+32&&y<ry+r.height*zoom&&ry<y+32),'a native title or reading body must remain reachable');}
  }
  for(const r of targets)assert(!(x<r.x+32&&r.x<x+32&&y<r.y+32&&r.y<y+32),'direction targets must be separate');targets.push({x,y});
 }
 if(width>=(expanded?420:240)*zoom+80&&zoom<=1.5)assert.equal(ports.size,4);
});
