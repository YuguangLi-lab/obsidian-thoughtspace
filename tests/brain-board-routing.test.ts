import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrainBoard} from '../src/brain-board';
import {brainIdeaNode} from '../src/brain-board-idea';
import {BrainBranchIndex,BrainDescendantPager,BRAIN_RENDER_EDGES,BRAIN_RENDER_NODES} from '../src/brain-board-descendants';
import {brainBoardLayout,brainBoardDescendantLayout,type BrainBoardLayout,type BrainBoardLayoutNode} from '../src/brain-board-layout';
import {localRelationMatches} from '../src/local-relations';
import type {Board} from '../src/model';

function graph(count:number,fanout:number){const board=createBrainBoard('0');for(let i=0;i<count;i++){board.nodes.push(brainIdeaNode(String(i),'想法 '+i));if(i)board.edges.push({id:'e'+i,from:String(Math.floor((i-1)/fanout)),to:String(i),kind:'branch',label:''});}return board;}
function project(board:Board,depth:number,expandedIds:string[]=[],page=0){const pager=new BrainDescendantPager(new BrainBranchIndex(board),'0',depth);for(let i=0;i<page&&pager.current.hasNext;i++)pager.next();return{page:pager.current,layout:brainBoardDescendantLayout(brainBoardLayout(localRelationMatches(board,'0'),{width:1600,expandedIds}),pager.current,expandedIds)};}
type Rect={x:number;y:number;width:number;height:number};
function intersects(path:string,box:Rect){
 const rect={left:box.x-1,right:box.x+box.width+1,top:box.y-1,bottom:box.y+box.height+1};
 const segment=(ax:number,ay:number,bx:number,by:number)=>{let lo=0,hi=1;for(const [a,d,min,max]of [[ax,bx-ax,rect.left,rect.right],[ay,by-ay,rect.top,rect.bottom]]){if(Math.abs(d)<1e-9){if(a<min||a>max)return false;}else{const t1=(min-a)/d,t2=(max-a)/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}}return true;};
 let x=0,y=0;
 for(const command of path.match(/[A-Z][^A-Z]*/g)||[]){const values=command.slice(1).trim().split(/\s+/).map(Number),kind=command[0];if(kind==='M'){[x,y]=values;continue;}
  const endX=kind==='V'?x:kind==='H'?values[0]:values.at(-2)!,endY=kind==='H'?y:kind==='V'?values[0]:values.at(-1)!;
  if(kind==='Q'||kind==='C'){let px=x,py=y;for(let i=1;i<=64;i++){const t=i/64,u=1-t,qx=kind==='Q'?u*u*x+2*u*t*values[0]+t*t*endX:u*u*u*x+3*u*u*t*values[0]+3*u*t*t*values[2]+t*t*t*endX,qy=kind==='Q'?u*u*y+2*u*t*values[1]+t*t*endY:u*u*u*y+3*u*u*t*values[1]+3*u*t*t*values[3]+t*t*t*endY;if(segment(px,py,qx,qy))return true;px=qx;py=qy;}}
  else {assert(kind==='H'||kind==='V');if(segment(x,y,endX,endY))return true;}x=endX;y=endY;
 }return false;
}
function bodies(node:BrainBoardLayoutNode):Rect[]{return[{x:node.x,y:node.y,width:node.width,height:node.height},...(node.previewWidth?[{x:node.x+node.width/2-node.previewWidth/2,y:node.y+node.height+12,width:node.previewWidth,height:200}]:[])];}
function clearLayout(layout:BrainBoardLayout){
 assert(layout.nodes.length<=BRAIN_RENDER_NODES);assert(layout.links.length<=BRAIN_RENDER_EDGES);
 for(const node of layout.nodes)for(const box of bodies(node))assert(box.x>=0&&box.y>=0&&box.x+box.width<=layout.width&&box.y+box.height<=layout.height,`${node.id} outside scene`);
 for(const [i,a]of layout.nodes.entries())for(const b of layout.nodes.slice(i+1))for(const ar of bodies(a))for(const br of bodies(b))assert(!(ar.x<br.x+br.width&&br.x<ar.x+ar.width&&ar.y<br.y+br.height&&br.y<ar.y+ar.height),`${a.id} overlaps ${b.id}`);
 for(const link of layout.links){assert(!/NaN|Infinity/.test(link.path));for(const node of layout.nodes){for(const [i,box]of bodies(node).entries()){if(i===0&&(node.id===link.from||node.id===link.to))continue;assert(!intersects(link.path,box),`${link.from} → ${link.to} crosses ${node.id}${i?' reading body':''}`);}}}
}
function exactEndpoints(board:Board,layout:BrainBoardLayout){
 for(const link of layout.links){const edge=board.edges.find(edge=>link.edgeIds?.includes(edge.id));if(!edge)continue;if(edge.kind==='branch'||edge.direction!=='both'&&edge.direction!=='none'){assert.equal(link.from,edge.from);assert.equal(link.to,edge.to);}const from=layout.nodes.find(node=>node.id===link.from)!,to=layout.nodes.find(node=>node.id===link.to)!,branch=edge.kind==='branch',right=from.x+from.width/2<to.x+to.width/2,expectedStart=branch?{x:from.x+from.width/2,y:from.y+from.height}:{x:right?from.x+from.width:from.x,y:from.y+from.height/2},expectedEnd=branch?{x:to.x+to.width/2,y:to.y}:{x:right?to.x:to.x+to.width,y:to.y+to.height/2};let x=0,y=0;
  for(const [i,command]of (link.path.match(/[A-Z][^A-Z]*/g)||[]).entries()){const values=command.slice(1).trim().split(/\s+/).map(Number);if(command[0]==='M'){[x,y]=values;assert.equal(i,0);assert(Math.abs(x-expectedStart.x)<.011&&Math.abs(y-expectedStart.y)<.011,'Original source pill endpoint');}else if(command[0]==='H')x=values[0];else if(command[0]==='V')y=values[0];else [x,y]=values.slice(-2);}
  assert(Math.abs(x-expectedEnd.x)<.011&&Math.abs(y-expectedEnd.y)<.011,'Original target pill endpoint');
 }
}

test('same endpoints retain branch and association evidence independently of edge order',()=>{
 const board=graph(3,1);board.edges.splice(1,0,{id:'associated',from:'0',to:'1',direction:'both',label:'另一种关系'});const before=JSON.stringify(board),seen=[];
 for(const edges of [board.edges,[...board.edges].reverse()]){const candidate={...board,edges},p=project(candidate,3),links=p.layout.links.filter(link=>link.from==='0'&&link.to==='1');assert.equal(p.layout.hiddenEdges,0);assert.equal(links.length,2);assert(links.some(link=>link.role==='children'&&!link.dashed));assert(links.some(link=>link.role==='associated'&&link.dashed));seen.push(links.map(link=>[link.role,link.dashed]).sort());}
 assert.deepEqual(seen[0],seen[1]);assert.equal(JSON.stringify(board),before);
});
test('all original parallel edge identities survive and direction metadata stays attached',()=>{
 const board=graph(3,1);board.edges.push({id:'parallel',from:'0',to:'1',kind:'branch',label:'第二项证据'},{id:'both',from:'0',to:'1',direction:'both',label:''},{id:'reverse',from:'1',to:'0',direction:'forward',label:''});const p=project(board,3);assert.equal(p.layout.hiddenEdges,0);assert.deepEqual(p.layout.links.flatMap(link=>link.edgeIds||[]).sort(),board.edges.map(edge=>edge.id).sort());assert.equal(p.layout.links.find(link=>link.edgeIds?.includes('both'))?.direction,'both');assert.equal(p.layout.links.find(link=>link.edgeIds?.includes('reverse'))?.direction,'forward');clearLayout(p.layout);exactEndpoints(board,p.layout);
});
test('one-layer cards retain every visible semantic category while keeping one node',()=>{
 const board=graph(3,1);board.edges.push({id:'association',from:'0',to:'1',direction:'both',label:''},{id:'incoming',from:'1',to:'0',direction:'forward',label:''});const layout=brainBoardLayout(localRelationMatches(board,'0'));
 assert.equal(layout.nodes.filter(node=>node.id==='1').length,1);assert.deepEqual(layout.links.map(link=>link.role).sort(),['associated','children','incoming']);
});
test('the first 48-node projection clears the reproduced 3 → 13 / node 5 crossing',()=>{
 const board=graph(100,4),p=project(board,3);assert.equal(p.page.ids.length,48);const link=p.layout.links.find(link=>link.from==='3'&&link.to==='13')!,node=p.layout.nodes.find(node=>node.id==='5')!;assert(link);assert(!intersects(link.path,node),'3 → 13 crosses node 5');clearLayout(p.layout);
});
for(const depth of [3,4,5])for(const page of [0,1,2])test(`continuous subtrees and crossing channels clear depth ${depth}, page ${page}, and reading bodies`,()=>{
 const board=graph(180,4),p=project(board,depth,[],page),expandedIds=p.page.ids.filter((_,i)=>i%7===0).slice(0,8),before=JSON.stringify(board),expanded=project(board,depth,expandedIds,page);
 clearLayout(p.layout);clearLayout(expanded.layout);exactEndpoints(board,p.layout);exactEndpoints(board,expanded.layout);assert.equal(expanded.page.page,p.page.page);assert.equal(expanded.layout.nodes.length,p.layout.nodes.length);assert.deepEqual(expanded.layout.links.map(link=>[link.from,link.to,link.role]),p.layout.links.map(link=>[link.from,link.to,link.role]));assert.equal(JSON.stringify(board),before);
});
test('cycles, multiple parents, reverse and bidirectional associations route their real endpoints',()=>{
 const board=graph(45,3);board.edges.push({id:'cycle',from:'25',to:'0',kind:'branch',label:''},{id:'shared',from:'2',to:'13',kind:'branch',label:''},{id:'both',from:'3',to:'18',direction:'both',label:''},{id:'reverse',from:'27',to:'1',direction:'forward',label:''},{id:'none',from:'14',to:'7',direction:'none',label:''});const before=JSON.stringify(board),p=project(board,5,['0','1','3','14','18']);clearLayout(p.layout);assert.equal(p.layout.hiddenEdges,0);assert.equal(p.layout.links.length,p.page.links.length);for(const link of p.layout.links)assert(board.edges.some(edge=>edge.from===link.from&&edge.to===link.to));assert.equal(JSON.stringify(board),before);
});
test('dense bidirectional side pages and expanded reading bodies stay inside the scene',()=>{
 const board=graph(130,1);board.edges=board.edges.map(edge=>({...edge,kind:undefined,from:'0',direction:'both' as const,fromSide:'right' as const,toSide:'left' as const}));const before=JSON.stringify(board);
 for(const page of [0,1,2]){const p=project(board,5,[],page),ids=p.page.ids.filter((_,i)=>i%6===0).slice(0,8);clearLayout(project(board,5,ids,page).layout);}assert.equal(JSON.stringify(board),before);
});
test('edge-budget overflow is counted by identity without hiding different semantics before the limit',()=>{
 const board=graph(9,2);for(let i=0;i<180;i++)board.edges.push({id:'proof-'+i,from:'0',to:'1',direction:i%2?'both':'forward',label:''});const p=project(board,5);assert.equal(p.layout.links.length,BRAIN_RENDER_EDGES);assert.equal(p.layout.hiddenEdges,board.edges.length-BRAIN_RENDER_EDGES);assert.equal(new Set(p.layout.links.flatMap(link=>link.edgeIds||[])).size,BRAIN_RENDER_EDGES);clearLayout(p.layout);
});
test('mixed discovery paths clear randomized visible projections without losing any within-budget edge',()=>{
 for(let seed=1;seed<=24;seed++){let value=seed;const random=(max:number)=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value%max;},board=graph(62,2+random(6));for(let i=0;i<20;i++){const from=random(62),to=random(62);if(from!==to)board.edges.push({id:'mix-'+i,from:String(from),to:String(to),direction:random(2)?'both':'forward',label:''});}const pager=new BrainDescendantPager(new BrainBranchIndex(board),'0',3+random(3));for(let page=0;page<3;page++){const p=pager.current,ids=p.ids.filter(()=>random(4)===0).slice(0,8),layout=brainBoardDescendantLayout(brainBoardLayout(localRelationMatches(board,'0'),{width:1000+random(1200),expandedIds:ids}),p,ids);clearLayout(layout);exactEndpoints(board,layout);assert.equal(layout.hiddenEdges,p.hiddenEdges,`seed ${seed}: All visible routes exist`);const drawn=new Set(layout.links.flatMap(link=>link.edgeIds||[]));assert(p.links.every(edge=>drawn.has(edge.id)),`seed ${seed}: Original edge identity missing`);if(!p.hasNext)break;pager.next();}}
});
