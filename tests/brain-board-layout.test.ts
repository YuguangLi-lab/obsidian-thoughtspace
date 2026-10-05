import test from 'node:test';
import assert from 'node:assert/strict';
import {brainBoardLayout,type BrainBoardLayout,type BrainBoardLayoutNode} from '../src/brain-board-layout';
import {localRelationMatches,type LocalRelationMatches} from '../src/local-relations';
import type {Board,Card,Edge} from '../src/model';

const node=(id:string,patch:Partial<Card>={}):Card=>({id,kind:'card',file:`Notes/${id}.md`,x:42,y:73,width:220,height:120,color:'sand',...patch});
const edge=(id:string,from:string,to:string,patch:Partial<Edge>={}):Edge=>({id,from,to,label:'',...patch});
const board=(nodes:Card[],edges:Edge[]=[]):Board=>({version:3,nodes,edges,viewport:{x:0,y:0,zoom:1}});
const fixture=()=>board(['center','parent','association-1','association-2','sibling-1','sibling-2','child-1','child-2','child-3'].map(id=>node(id)),[
 edge('pc','parent','center',{kind:'branch'}),edge('ps1','parent','sibling-1',{kind:'branch'}),edge('ps2','parent','sibling-2',{kind:'branch'}),
 ...[1,2,3].map(i=>edge('cc'+i,'center','child-'+i,{kind:'branch'})),...[1,2].map(i=>edge('a'+i,'center','association-'+i,{direction:'both'}))
]);
const center=(node:BrainBoardLayoutNode)=>({x:node.x+node.width/2,y:node.y+node.height/2});
const get=(layout:BrainBoardLayout,id:string)=>{const found=layout.nodes.find(node=>node.id===id);assert(found,`missing ${id}`);return found;};
function pathEndpoints(path:string){
 const commands=path.match(/[A-Z][^A-Z]*/g)!,startValues=commands[0].slice(1).trim().split(/\s+/).map(Number),start={x:startValues[0],y:startValues[1]},end={...start};
 for(const command of commands){const values=command.slice(1).trim().split(/\s+/).map(Number);if(command[0]==='H')end.x=values[0];else if(command[0]==='V')end.y=values[0];else{end.x=values.at(-2)!;end.y=values.at(-1)!;}}return{start,end};
}
function checkGeometry(layout:BrainBoardLayout){
 assert(Number.isFinite(layout.width)&&Number.isFinite(layout.height));assert.equal(new Set(layout.nodes.map(node=>node.id)).size,layout.nodes.length);
 for(const node of layout.nodes){for(const value of [node.x,node.y,node.width,node.height])assert(Number.isFinite(value));assert(node.x>=0&&node.y>=0);assert(node.x+node.width<=layout.width&&node.y+node.height<=layout.height);}
 for(let i=0;i<layout.nodes.length;i++)for(const b of layout.nodes.slice(i+1)){const a=layout.nodes[i];assert(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`overlapping ${a.id}/${b.id}`);}
 for(const link of layout.links){assert(layout.nodes.some(node=>node.id===link.from));assert(layout.nodes.some(node=>node.id===link.to));assert(!/NaN|Infinity|undefined/.test(link.path));assert.match(link.path,/^M /);}
 for(const label of layout.labels){assert(Number.isFinite(label.x)&&Number.isFinite(label.y));assert(label.x>=0&&label.x<=layout.width&&label.y>=0&&label.y<=layout.height);}
}

test('approved reference uses a full scene with parents above, children below and shared-parent siblings to the right',()=>{
 const result=brainBoardLayout(localRelationMatches(fixture(),'center'));assert.equal(result.width,1600);assert.equal(result.height,870);assert.equal(result.nodes.length,9);assert.equal(result.total,8);assert.equal(result.pages,1);checkGeometry(result);
 const focal=center(get(result,'center')),parent=center(get(result,'parent'));assert(Math.abs(focal.x-800)<1&&Math.abs(focal.y-413)<1);assert(Math.abs(parent.y-203)<1);
 assert.equal(get(result,'center').width,240);assert.equal(get(result,'center').height,72);
 for(const id of ['association-1','association-2'])assert(center(get(result,id)).x<focal.x);
 for(const id of ['sibling-1','sibling-2'])assert(center(get(result,id)).x>focal.x);
 for(const id of ['child-1','child-2','child-3'])assert(center(get(result,id)).y>focal.y);
 assert.deepEqual(result.labels.map(label=>label.text),['上级','关联','同级','下级']);
 assert.deepEqual(result.links.filter(link=>link.role==='siblings').map(({from,to})=>({from,to})),[{from:'parent',to:'sibling-1'},{from:'parent',to:'sibling-2'}]);
 assert(result.links.filter(link=>link.role==='associated').every(link=>link.dashed));assert(result.links.filter(link=>link.role==='children'||link.role==='parents'||link.role==='siblings').every(link=>!link.dashed));
});

test('directional note links retain their true endpoint direction while sharing the left spatial region',()=>{
 const b=board(['center','in','out'].map(id=>node(id)),[edge('i','in','center'),edge('o','center','out')]),result=brainBoardLayout(localRelationMatches(b,'center'));
 assert.deepEqual(result.links.map(({from,to,role})=>({from,to,role})),[{from:'in',to:'center',role:'incoming'},{from:'center',to:'out',role:'outgoing'}]);
 for(const id of ['in','out'])assert(center(get(result,id)).x<center(get(result,'center')).x);checkGeometry(result);
});

test('one object with several relationship kinds occupies one pill without changing evidence or board geometry',()=>{
 const b=board(['center','target'].map(id=>node(id)),[edge('branch','center','target',{kind:'branch'}),edge('ordinary','target','center'),edge('symmetric','center','target',{direction:'both'})]),matches=localRelationMatches(b,'center'),before=JSON.stringify({b,matches});
 for(const group of matches.groups){for(const item of group.items){Object.freeze(item.edgeIds);Object.freeze(item.viaParentIds);Object.freeze(item);}Object.freeze(group.items);Object.freeze(group);}Object.freeze(matches.groups);Object.freeze(matches);
 const result=brainBoardLayout(matches);assert.equal(result.nodes.length,2);assert.equal(result.total,1);assert.equal(get(result,'target').role,'children');assert.equal(JSON.stringify({b,matches}),before);assert.equal(matches.matched,3);
});

for(const kind of ['card','board','section'] as const)test(`${kind} is supported as the fullcanvas center and relation endpoint`,()=>{
 const b=board([node('center',{kind}),node('child',{kind})],[edge('branch','center','child',{kind:'branch'})]),result=brainBoardLayout(localRelationMatches(b,'center'));
 assert.deepEqual(result.nodes.map(node=>node.id),['center','child']);checkGeometry(result);
});

for(const kind of ['text','image','pdf','audio','video','mindmap'] as const)test(`${kind} never enters the dedicated node projection through normal relations`,()=>{
 const b=board([node('center'),node('unsupported',{kind})],[edge('branch','center','unsupported',{kind:'branch'}),edge('link','center','unsupported')]);
 assert.deepEqual(brainBoardLayout(localRelationMatches(b,'center')).nodes.map(node=>node.id),['center']);assert.equal(brainBoardLayout(localRelationMatches(b,'unsupported')).nodes.length,0);
});

test('removed shared parents never turn sibling evidence into a fabricated center-to-sibling link',()=>{
 const matches=localRelationMatches(fixture(),'center');matches.groups.find(group=>group.kind==='parents')!.items=[];
 const result=brainBoardLayout(matches);assert(get(result,'sibling-1'));assert.equal(result.links.filter(link=>link.role==='siblings').length,0);
 assert(!result.links.some(link=>link.from==='center'&&link.to.startsWith('sibling')));
});

test('invalid family graphs cannot be presented as an inferred hierarchy',()=>{
 const b=fixture();b.edges.push(edge('cycle','center','parent',{kind:'branch'}));const matches=localRelationMatches(b,'center');assert(matches.invalidBranches);
 const result=brainBoardLayout(matches);assert(result.nodes.every(node=>node.role==='center'||node.role==='associated'));assert(result.links.every(link=>link.role==='associated'));
});

function dense(){
 const b=fixture();for(let i=0;i<37;i++){const id='extra-sibling-'+i;b.nodes.push(node(id));b.edges.push(edge('s'+i,'parent',id,{kind:'branch'}));}
 for(let i=0;i<41;i++){const id='extra-child-'+i;b.nodes.push(node(id));b.edges.push(edge('c'+i,'center',id,{kind:'branch'}));}
 for(let i=0;i<43;i++){const id='extra-association-'+i;b.nodes.push(node(id));b.edges.push(edge('a'+i,'center',id,{direction:'none'}));}
 return b;
}
for(const pageSize of [1,2,7,18,20,30])test(`all high-degree neighbors are reachable with page budget ${pageSize} and a real parent on every page`,()=>{
 const matches=localRelationMatches(dense(),'center'),first=brainBoardLayout(matches,{pageSize}),seen=new Set<string>();assert(first.pages>1);assert.equal(first.total,new Set(matches.neighborIds).size);
 for(let page=0;page<first.pages;page++){
  const result=brainBoardLayout(matches,{page,pageSize,width:420,height:560});assert.equal(result.page,page);assert.equal(result.pages,first.pages);assert(result.nodes.length<=pageSize+2);assert(get(result,'parent'));checkGeometry(result);
  for(const node of result.nodes)if(node.role!=='center')seen.add(node.id);
  for(const link of result.links.filter(link=>link.role==='siblings'))assert.equal(link.from,'parent');
 }
 assert.deepEqual([...seen].sort(),[...matches.neighborIds].sort());assert.equal(brainBoardLayout(matches,{page:1e6,pageSize}).page,first.pages-1);
});

for(const width of [320,768,1000,1600,2400])for(const height of [320,650,870,1400])test(`all visible zones remain finite, bounded and separate at ${width}×${height}`,()=>{
 const matches=localRelationMatches(dense(),'center'),layout=brainBoardLayout(matches,{width,height,pageSize:30});checkGeometry(layout);assert(layout.nodes.length<=32);assert(layout.nodes.filter(node=>node.role==='children').length<=4);assert(layout.nodes.filter(node=>node.role==='siblings').length<=6);assert(layout.nodes.filter(node=>['associated','incoming','outgoing'].includes(node.role)).length<=6);
});

test('empty or absent centers return a finite empty scene, not stale layout state',()=>{
 const matches:LocalRelationMatches={groups:[],total:0,matched:0,invalidBranches:false,neighborIds:[]};assert.deepEqual(brainBoardLayout(matches),{width:1600,height:870,nodes:[],links:[],labels:[],page:0,pages:1,total:0});
});

test('invalid camera-size and paging requests clamp safely without editing the source matches',()=>{
 const matches=localRelationMatches(fixture(),'center'),before=JSON.stringify(matches);
 for(const value of [NaN,Infinity,-Infinity,-9999,0,.1,Number.MAX_VALUE]){const result=brainBoardLayout(matches,{width:value,height:value,page:value,pageSize:value});checkGeometry(result);assert(result.nodes.length<=32);assert(result.page>=0&&result.page<result.pages);}
 assert.equal(JSON.stringify(matches),before);
});

for(const height of [650,729,870])test(`sibling paths share one parent turn at scene height ${height} while retaining distinct child turns`,()=>{
 const result=brainBoardLayout(localRelationMatches(fixture(),'center'),{height}),links=result.links.filter(link=>link.role==='siblings');assert.equal(links.length,2);
 assert.equal(links[0].path.split(' V ')[0],links[1].path.split(' V ')[0]);assert.notEqual(links[0].path.split(' V ')[1],links[1].path.split(' V ')[1]);
 for(const link of links){assert.equal(link.from,'parent');assert.match(link.to,/^sibling-/);const target=get(result,link.to);assert(link.path.endsWith(' H '+target.x));}checkGeometry(result);
});

test('shared sibling turns remain independent on opposite sides of the parent height',()=>{
 const b=board(['parent','center',...Array.from({length:6},(_,i)=>'sibling-'+i)].map(id=>node(id)),[edge('pc','parent','center',{kind:'branch'}),...Array.from({length:6},(_,i)=>edge('ps'+i,'parent','sibling-'+i,{kind:'branch'}))]);
 const result=brainBoardLayout(localRelationMatches(b,'center'),{height:870}),parentY=center(get(result,'parent')).y,groups=new Map<number,string[]>();
 for(const link of result.links.filter(link=>link.role==='siblings')){const sign=Math.sign(center(get(result,link.to)).y-parentY),paths=groups.get(sign)||[];paths.push(link.path.split(' V ')[0]);groups.set(sign,paths);}
 // At this viewport there is an upward branch as well as several downward branches.
 assert(groups.has(-1)&&groups.has(1));for(const paths of groups.values())assert.equal(new Set(paths).size,1);assert.notEqual(groups.get(-1)![0],groups.get(1)![0]);checkGeometry(result);
});

function checkExpandedGeometry(layout:BrainBoardLayout,expandedIds:readonly string[]){
 checkGeometry(layout);const expanded=new Set(expandedIds),boxes=layout.nodes.map(node=>{const width=expanded.has(node.id)?node.previewWidth??node.width:node.width;return{id:node.id,x:node.x+node.width/2-width/2,y:node.y,width,height:node.height+(expanded.has(node.id)?212:0)};});
 for(const box of boxes){assert(box.x>=0&&box.y>=0);assert(box.x+box.width<=layout.width&&box.y+box.height<=layout.height,`preview outside scene: ${box.id}`);}
 for(let i=0;i<boxes.length;i++)for(const b of boxes.slice(i+1)){const a=boxes[i];assert(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`preview covers another object: ${a.id}/${b.id}`);}
}

test('no expanded or only unavailable targets preserves the approved projection exactly',()=>{
 const matches=localRelationMatches(fixture(),'center'),plain=brainBoardLayout(matches);
 assert.deepEqual(brainBoardLayout(matches,{expandedIds:[]}),plain);assert.deepEqual(brainBoardLayout(matches,{expandedIds:['removed','text','missing']}),plain);
});

test('center preview reserves a clear lane above children without moving parents or side nodes',()=>{
 const matches=localRelationMatches(fixture(),'center'),plain=brainBoardLayout(matches),expanded=brainBoardLayout(matches,{expandedIds:['center']});
 checkExpandedGeometry(expanded,['center']);for(const node of plain.nodes){const after=get(expanded,node.id);assert.equal(after.x,node.x);assert.equal(after.y,node.y+(node.role==='children'?222:0));}
 const centerBottom=get(expanded,'center').y+72+212;for(const child of expanded.nodes.filter(node=>node.role==='children'))assert(child.y>centerBottom);
});

test('parent preview preserves its pill location and moves the downstream scene together',()=>{
 const matches=localRelationMatches(fixture(),'center'),plain=brainBoardLayout(matches),expanded=brainBoardLayout(matches,{expandedIds:['parent']});
 checkExpandedGeometry(expanded,['parent']);for(const node of plain.nodes){const after=get(expanded,node.id);assert.equal(after.x,node.x);assert.equal(after.y,node.y+(node.role==='parents'?0:222));}
 assert.deepEqual(expanded.links.map(({from,to,role})=>({from,to,role})),plain.links.map(({from,to,role})=>({from,to,role})));
});

for(const width of [420,1600])test(`all preview combinations up to eight expanded reference nodes stay clear at width ${width}`,()=>{
 const b=fixture(),matches=localRelationMatches(b,'center'),before=JSON.stringify({b,matches}),ids=b.nodes.map(node=>node.id),base=brainBoardLayout(matches,{width,height:650});
 for(let mask=0;mask<(1<<ids.length)-1;mask++){
  const expandedIds=ids.filter((_,i)=>mask&(1<<i)),layout=brainBoardLayout(matches,{width,height:650,expandedIds});assert(expandedIds.length<=8);checkExpandedGeometry(layout,expandedIds);
  assert.equal(layout.nodes.length,base.nodes.length);assert.equal(layout.pages,base.pages);assert.deepEqual(layout.links.map(({from,to,role})=>({from,to,role})),base.links.map(({from,to,role})=>({from,to,role})));
 }
 assert.equal(JSON.stringify({b,matches}),before);assert.deepEqual(brainBoardLayout(matches,{width,height:650,expandedIds:[]}),base);
});

for(const width of [420,1000,1600])test(`dense paged previews clear following side nodes and child rows at width ${width}`,()=>{
 const matches=localRelationMatches(dense(),'center'),before=JSON.stringify(matches),options={width,height:650,pageSize:30},first=brainBoardLayout(matches,options);
 for(const page of [0,1,first.pages-1]){
  const plain=brainBoardLayout(matches,{...options,page}),ids=plain.nodes.map(node=>node.id),patterns=[ids.slice(0,8),ids.slice(-8),ids.filter((_,i)=>i%2===0).slice(0,8),plain.nodes.filter(node=>node.role==='siblings'||node.role==='associated').map(node=>node.id).slice(0,8)];
  for(const expandedIds of patterns){const layout=brainBoardLayout(matches,{...options,page,expandedIds});checkExpandedGeometry(layout,expandedIds);assert(layout.nodes.length<=32);assert.equal(layout.page,page);assert.equal(layout.pages,first.pages);}
 }
 assert.equal(JSON.stringify(matches),before);
});

test('expanded reading widths respect their actual columns without changing closed pill geometry',()=>{
 const matches=localRelationMatches(fixture(),'center'),plain=brainBoardLayout(matches),ids=plain.nodes.map(node=>node.id).filter(id=>id!=='child-3'),expanded=brainBoardLayout(matches,{expandedIds:ids});
 for(const node of plain.nodes){assert.equal(node.previewWidth,undefined);const after=get(expanded,node.id);assert.equal(after.x,node.x);assert.equal(after.width,node.width);assert.equal(after.height,node.height);assert.equal(after.previewWidth===undefined,!ids.includes(node.id));}
 assert.equal(get(expanded,'center').previewWidth,340);assert.equal(get(expanded,'parent').previewWidth,280);assert.equal(get(expanded,'association-1').previewWidth,280);assert.equal(get(expanded,'sibling-1').previewWidth,280);
 assert.equal(get(expanded,'child-1').previewWidth,212);checkExpandedGeometry(expanded,ids);
 const single=board([node('center'),node('child')],[edge('c','center','child',{kind:'branch'})]),one=brainBoardLayout(localRelationMatches(single,'center'),{expandedIds:['child']});assert.equal(get(one,'child').previewWidth,280);checkExpandedGeometry(one,['child']);
});

test('expanded side reading bodies retain twelve screen pixels of horizontal clearance at a 600px default camera',()=>{
 const matches=localRelationMatches(fixture(),'center'),expandedIds=['center','parent','association-1','association-2','sibling-1','sibling-2','child-1','child-2'],layout=brainBoardLayout(matches,{width:600,height:700,expandedIds}),zoom=Math.max(.72,Math.min(1,600/layout.width,700/layout.height)),offset=(600-layout.width*zoom)/2;
 assert.equal(get(layout,'center').previewWidth,340);assert.equal(get(layout,'association-1').previewWidth,213);assert.equal(get(layout,'sibling-1').previewWidth,213);
 for(const node of layout.nodes){const width=node.previewWidth??node.width,left=offset+(node.x+node.width/2-width/2)*zoom,right=left+width*zoom;assert(left>=12,`${node.id} body clips the left edge: ${left}`);assert(right<=588,`${node.id} body clips the right edge: ${right}`);}
 checkExpandedGeometry(layout,expandedIds);
});

test('expanded reading bodies retain the true directed relation endpoints on pill edges',()=>{
 const b=fixture();b.nodes.push(node('incoming'),node('outgoing'));b.edges.push(edge('in','incoming','center'),edge('out','center','outgoing'));
 const matches=localRelationMatches(b,'center'),expandedIds=['center','parent','association-1','sibling-1','child-1','incoming','outgoing'];
 for(const width of [600,1600]){const layout=brainBoardLayout(matches,{width,expandedIds});checkExpandedGeometry(layout,expandedIds);for(const link of layout.links){
  const from=get(layout,link.from),to=get(layout,link.to),{start,end}=pathEndpoints(link.path);
  const vertical=link.role==='parents'||link.role==='children',right=center(from).x<center(to).x,expectedStart=vertical?{x:center(from).x,y:from.y+from.height}:{x:right?from.x+from.width:from.x,y:center(from).y},expectedEnd=vertical?{x:center(to).x,y:to.y}:{x:right?to.x:to.x+to.width,y:center(to).y};
  for(const key of ['x','y'] as const){assert(Math.abs(start[key]-expectedStart[key])<.01,`${link.from} start ${key}`);assert(Math.abs(end[key]-expectedEnd[key])<.01,`${link.to} end ${key}`);}
 }}
});

test('hierarchy connectors use a shared straight stem and bounded rounded horizontal turns',()=>{
 for(const width of [600,1600]){const layout=brainBoardLayout(localRelationMatches(fixture(),'center'),{width}),links=layout.links.filter(link=>link.role==='children'),curved=links.filter(link=>center(get(layout,link.to)).x!==center(get(layout,link.from)).x);
  assert.equal(curved.length,2);assert.equal(curved[0].path.split(' Q ')[0],curved[1].path.split(' Q ')[0]);
  for(const link of layout.links.filter(link=>link.role==='parents'||link.role==='children')){const from=get(layout,link.from),to=get(layout,link.to),x1=center(from).x,x2=center(to).x,y1=from.y+from.height,y2=to.y;
   if(x1===x2){assert.match(link.path,/^M [-\d.]+ [-\d.]+ V [-\d.]+$/);continue;}
   assert.match(link.path,/^M .+ V .+ Q .+ H .+ Q .+ V .+$/);assert(!link.path.includes(' C '));const commands=link.path.match(/[A-Z][^A-Z]*/g)!,values=(index:number)=>commands[index].slice(1).trim().split(/\s+/).map(Number),sign=Math.sign(x2-x1),first=values(2),last=values(4),middle=first[1],radius=Math.abs(first[2]-x1);
   assert(radius>0&&radius<=40.01&&radius<=Math.abs(x2-x1)/2+.01);assert(middle>y1&&middle<y2);assert(middle>=(y1+y2)/2-.01);
   assert(Math.abs(values(1)[0]-(middle-radius))<.02);assert(Math.abs(first[0]-x1)<.01);assert(Math.abs(first[2]-(x1+sign*radius))<.01);assert(Math.abs(first[3]-middle)<.01);assert(Math.abs(values(3)[0]-(x2-sign*radius))<.02);assert(Math.abs(last[0]-x2)<.01);assert(Math.abs(last[1]-middle)<.01);assert(Math.abs(last[2]-x2)<.01);assert(Math.abs(last[3]-(middle+radius))<.02);
  }
 }
});

test('hierarchy turns leave room below expanded reading bodies while still starting at the source pill',()=>{
 const expandedIds=['parent','center'],layout=brainBoardLayout(localRelationMatches(fixture(),'center'),{expandedIds});
 for(const link of layout.links.filter(link=>link.role==='parents'||link.role==='children')){const from=get(layout,link.from),to=get(layout,link.to),{start,end}=pathEndpoints(link.path);assert.equal(start.y,Math.round((from.y+from.height)*100)/100);assert.equal(end.y,Math.round(to.y*100)/100);if(center(from).x===center(to).x){assert(!link.path.includes(' Q '));continue;}
  const commands=link.path.match(/[A-Z][^A-Z]*/g)!;assert.equal(commands[1][0],'V');const turnStart=Number(commands[1].slice(1));assert(turnStart>from.y+from.height+212,'Horizontal branches must emerge below the reading body');assert(turnStart<to.y);
 }
 checkExpandedGeometry(layout,expandedIds);
});

test('dense children stay in one row so center links cannot draw a false hierarchy through another child',()=>{
 const matches=localRelationMatches(dense(),'center');
 for(const width of [600,1600])for(const pageSize of [18,30]){const first=brainBoardLayout(matches,{width,pageSize});for(let page=0;page<first.pages;page++){
  const plain=brainBoardLayout(matches,{width,pageSize,page}),expandedIds=plain.nodes.slice(0,8).map(node=>node.id);
  for(const ids of [[],expandedIds]){const layout=brainBoardLayout(matches,{width,pageSize,page,expandedIds:ids}),children=layout.nodes.filter(node=>node.role==='children');assert(children.length<=4);assert(new Set(children.map(node=>node.y)).size<=1,'A rear row would make direct center links look like child-to-child links');checkExpandedGeometry(layout,ids);
   const links=layout.links.filter(link=>link.role==='children');assert.equal(links.length,children.length);
   for(const link of links){assert.equal(link.from,'center');const child=get(layout,link.to),{end}=pathEndpoints(link.path);assert.equal(end.y,child.y);
    // A quadratic stays inside its control-point hull. Every segment is at or
    // above the common child top, so no direct link enters another child pill.
    for(const command of link.path.match(/[A-Z][^A-Z]*/g)!){const values=command.slice(1).trim().split(/\s+/).map(Number),ys=command[0]==='H'?[]:command[0]==='V'?values:values.filter((_,index)=>index%2===1);assert(ys.every(y=>y<=child.y),`${link.to} connector passes behind a child`);}
   }
  }
 }}
});

test('all five hundred direct children remain reachable exactly once across single-row pages',()=>{
 const childIds=Array.from({length:500},(_,index)=>'child-'+index),b=board(['center',...childIds].map(id=>node(id)),childIds.map(id=>edge(id,'center',id,{kind:'branch'}))),matches=localRelationMatches(b,'center'),before=JSON.stringify({b,matches});
 for(const pageSize of [7,18,30]){const first=brainBoardLayout(matches,{pageSize}),seen=new Map<string,number>();assert.equal(first.total,500);assert.equal(first.pages,125);
  for(let page=0;page<first.pages;page++){const layout=brainBoardLayout(matches,{width:600,height:700,pageSize,page}),children=layout.nodes.filter(node=>node.role==='children');assert.equal(layout.page,page);assert.equal(children.length,4);assert.equal(new Set(children.map(node=>node.y)).size,1);assert.equal(layout.nodes.length,5);assert.equal(layout.links.length,4);checkGeometry(layout);for(const child of children)seen.set(child.id,(seen.get(child.id)||0)+1);assert(layout.links.every(link=>link.from==='center'&&link.role==='children'));}
  assert.deepEqual([...seen.keys()].sort(),[...childIds].sort());assert([...seen.values()].every(count=>count===1));assert.equal(brainBoardLayout(matches,{pageSize,page:1000}).page,124);
 }
 assert.equal(JSON.stringify({b,matches}),before);
});

test('expanded side columns keep twelve pixels of clear reading space without adding the original row gap twice',()=>{
 const matches=localRelationMatches(fixture(),'center');
 for(const width of [600,1600]){const plain=brainBoardLayout(matches,{width,height:650}),expandedIds=['association-1','association-2','sibling-1'],layout=brainBoardLayout(matches,{width,height:650,expandedIds});
  for(const [firstId,nextId]of [['association-1','association-2'],['sibling-1','sibling-2']]){const first=get(layout,firstId),next=get(layout,nextId);assert.equal(first.y,get(plain,firstId).y);assert.equal(next.y-(first.y+first.height+212),12,'Only a 12px clear gutter belongs after the reserved reading body');assert.equal(first.x,get(plain,firstId).x);assert.equal(next.x,get(plain,nextId).x);}
  checkExpandedGeometry(layout,expandedIds);
  const other=brainBoardLayout(matches,{width,height:650,expandedIds:['center','child-1']});for(const node of plain.nodes.filter(node=>node.role==='siblings'||node.role==='associated')){assert.equal(get(other,node.id).x,node.x);assert.equal(get(other,node.id).y,node.y);}
  const lower=brainBoardLayout(matches,{width,height:650,expandedIds:['association-2','sibling-2']});for(const id of ['association-1','sibling-1'])assert.deepEqual(get(lower,id),get(plain,id));checkExpandedGeometry(lower,['association-2','sibling-2']);
 }
});

// Solve the actual quadratic boundary crossings rather than using the broad
// control-point hull, which can report a crossing where the rounded path clears.
function pathIntersectsBox(path:string,box:{x:number;y:number;width:number;height:number}){
 const left=box.x-2,right=box.x+box.width+2,top=box.y-2,bottom=box.y+box.height+2,inside=(x:number,y:number)=>x>=left&&x<=right&&y>=top&&y<=bottom;
 const roots=(start:number,control:number,end:number,boundary:number)=>{const a=start-2*control+end,b=2*(control-start),c=start-boundary;if(Math.abs(a)<1e-9)return Math.abs(b)<1e-9?[]:[-c/b];const d=b*b-4*a*c;return d<0?[]:[(-b+Math.sqrt(d))/(2*a),(-b-Math.sqrt(d))/(2*a)];};
 const at=(start:number,control:number,end:number,t:number)=>(1-t)*(1-t)*start+2*(1-t)*t*control+t*t*end;
 let x=0,y=0;
 for(const command of path.match(/[A-Z][^A-Z]*/g)!){const values=command.slice(1).trim().split(/\s+/).map(Number);
  if(command[0]==='M'){[x,y]=values;continue;}
  const nextX=command[0]==='V'?x:command[0]==='H'?values[0]:values[2],nextY=command[0]==='H'?y:command[0]==='V'?values[0]:values[3];
  if(inside(x,y)||inside(nextX,nextY))return true;
  if(command[0]==='Q'){
   for(const boundary of [left,right])for(const t of roots(x,values[0],nextX,boundary))if(t>=0&&t<=1){const ordinate=at(y,values[1],nextY,t);if(ordinate>=top&&ordinate<=bottom)return true;}
   for(const boundary of [top,bottom])for(const t of roots(y,values[1],nextY,boundary))if(t>=0&&t<=1){const abscissa=at(x,values[0],nextX,t);if(abscissa>=left&&abscissa<=right)return true;}
  }else {assert(command[0]==='V'||command[0]==='H');if(Math.min(x,nextX)<=right&&Math.max(x,nextX)>=left&&Math.min(y,nextY)<=bottom&&Math.max(y,nextY)>=top)return true;}
  x=nextX;y=nextY;
 }
 return false;
}

test('child paths clear every non-endpoint pill and side preview in bounded dense pages',()=>{
 const matches=localRelationMatches(dense(),'center'),before=JSON.stringify(matches);
 for(const width of [600,1440,1600])for(const height of [650,870])for(const pageSize of [18,30]){const first=brainBoardLayout(matches,{width,height,pageSize});
  for(let page=0;page<first.pages;page++){const plain=brainBoardLayout(matches,{width,height,pageSize,page}),patterns=[[],plain.nodes.slice(0,8).map(node=>node.id),plain.nodes.filter(node=>node.role==='associated'||node.role==='siblings').slice(-8).map(node=>node.id)];
   for(const expandedIds of patterns){const layout=brainBoardLayout(matches,{width,height,pageSize,page,expandedIds});checkExpandedGeometry(layout,expandedIds);
    for(const link of layout.links.filter(link=>link.role==='children'))for(const pill of layout.nodes){if(pill.id===link.from||pill.id===link.to)continue;
     assert(!pathIntersectsBox(link.path,pill),`${width}×${height}, page ${page}: ${link.to} crosses ${pill.id}`);
     if(pill.previewWidth&&['associated','incoming','outgoing','siblings'].includes(pill.role))assert(!pathIntersectsBox(link.path,{x:pill.x+pill.width/2-pill.previewWidth/2,y:pill.y+pill.height+12,width:pill.previewWidth,height:200}),`${link.to} crosses ${pill.id} reading body`);
    }
   }
  }
 }
 assert.equal(JSON.stringify(matches),before);
});

test('the uncrowded three-child reference preserves its approved coordinates and true relationships',()=>{
 const layout=brainBoardLayout(localRelationMatches(fixture(),'center'));
 assert.deepEqual(layout.nodes.map(({id,x,y})=>({id,x,y})),[
  {id:'center',x:680,y:377.25},{id:'parent',x:711,y:178.5},{id:'child-1',x:483,y:595.5},{id:'child-2',x:711,y:595.5},{id:'child-3',x:939,y:595.5},
  {id:'association-1',x:243,y:330.75},{id:'association-2',x:243,y:458.75},{id:'sibling-1',x:1179,y:330.75},{id:'sibling-2',x:1179,y:458.75}
 ]);assert.equal(layout.height,870);
 assert.deepEqual(layout.links.filter(link=>link.role==='children').map(({from,to})=>({from,to})),[1,2,3].map(i=>({from:'center',to:'child-'+i})));
 assert.deepEqual(layout.links.filter(link=>link.role==='siblings').map(({from,to})=>({from,to})),[1,2].map(i=>({from:'parent',to:'sibling-'+i})));
});
