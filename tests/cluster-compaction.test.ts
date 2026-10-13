import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Board,Card,emptyBoard,History,parseBoard} from '../src/model';
import {LayoutOptions,planLayout,planSectionLayout,applyLayout,layoutBounds} from '../src/layout-planner';
import {clusterComponents} from '../src/cluster-compaction';
import {cleanLayoutOptions,cleanLayoutPresets,saveLayoutPreset} from '../src/layout-presets';

const card=(id:string,x:number,y:number,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width:160,height:80,color:'green',...extra});
const options:LayoutOptions={mode:'connections',preserveClusters:true,columns:2,gap:24,sort:'position',anchor:'center'};
const selected=(b:Board)=>new Set(b.nodes.filter(n=>n.kind!=='section').map(n=>n.id));
const fixture=():Board=>({...emptyBoard(),version:3,nodes:[card('a',10,20,{kind:'card',file:'Note.md'}),card('b',250,210,{width:210,color:'blue',paragraphQuote:{path:'Note.md',subpath:'#^a',mode:'embed'}}),card('c',1800,100,{height:160}),card('d',2240,300),card('alone',4000,200)],edges:[{id:'ab',from:'a',to:'b',label:'Evidence',direction:'both',color:'rose',style:'elbow',dashed:true},{id:'cd',from:'c',to:'d',label:'Opposition'}]});
const overlap=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function assertTranslations(before:Board,after:Board,ids:ReadonlySet<string>){
 const originals=new Map(before.nodes.map(n=>[n.id,n])),current=new Map(after.nodes.map(n=>[n.id,n]));
 for(const group of clusterComponents(before,before.nodes.filter(n=>ids.has(n.id)))){let delta:{x:number;y:number}|undefined;for(const id of group){const old=originals.get(id)!,next=current.get(id)!;const d={x:next.x-old.x,y:next.y-old.y};if(!delta)delta=d;assert.ok(Math.abs(d.x-delta.x)<1e-6&&Math.abs(d.y-delta.y)<1e-6);assert.deepEqual({...next,x:old.x,y:old.y},old);}}
 for(const n of before.nodes)if(!ids.has(n.id))assert.deepEqual(current.get(n.id),n);
 assert.deepEqual(after.edges,before.edges);assert.deepEqual(after.viewport,before.viewport);
}

test('preserving mode compacts complete cluster bounds without changing source, relative geometry or metadata',()=>{
 const b=fixture(),before=structuredClone(b),ids=selected(b),p=planLayout(b,ids,options);assert.deepEqual(b,before);assert.equal(p.preservedClusters!.groups.length,3);assert.equal(p.skipped,0);
 const boxes=p.lanes.map(l=>layoutBounds(p.items.filter(n=>l.ids.includes(n.id))));assert.ok(boxes.every((a,i)=>boxes.slice(i+1).every(b=>!overlap(a,b))));
 const oldBounds=layoutBounds(before.nodes),nextBounds=p.bounds;assert.equal(oldBounds.x+oldBounds.width/2,nextBounds.x+nextBounds.width/2);assert.equal(oldBounds.y+oldBounds.height/2,nextBounds.y+nextBounds.height/2);
 applyLayout(b,p);assertTranslations(before,b,ids);assert.ok(layoutBounds(b.nodes).width<oldBounds.width);parseBoard(JSON.stringify(b));
});
test('a connected singleton component changes no geometry; duplicate directions/self edges do not regrid its content',()=>{
 const b=fixture();b.nodes=b.nodes.slice(0,2);b.edges.push({id:'reverse',from:'b',to:'a',label:'same'},{id:'self',from:'a',to:'a',label:''});const before=structuredClone(b),p=planLayout(b,selected(b),options);assert.deepEqual(p.items.map(n=>[n.x,n.y]),before.nodes.map(n=>[n.x,n.y]));applyLayout(b,p);assert.deepEqual(b,before);
});
test('unconnected cards remain individual movable clusters instead of becoming an internally regridded lane',()=>{
 const b=fixture();b.edges=[];const p=planLayout(b,selected(b),{...options,columns:3});assert.equal(p.lanes.length,5);assert.ok(p.lanes.every(l=>l.ids.length===1));assert.equal(p.items[0].y,p.items[1].y);assert.equal(p.items[0].y,p.items[2].y);assert.ok(p.items[3].y>p.items[0].y);
});
test('partial selection ignores paths through outside cards and keeps outside locks, references and incident edges exact',()=>{
 const b=fixture();b.nodes.push(card('outside',300,900,{locked:true,kind:'card',file:'Outside.md'}));b.edges.push({id:'ax',from:'a',to:'outside',label:''},{id:'xc',from:'outside',to:'c',label:''});const ids=new Set(['a','b','c']),before=structuredClone(b),p=planLayout(b,ids,options);assert.deepEqual(p.preservedClusters!.groups.map(g=>[...g].sort()),[['a','b'],['c']]);applyLayout(b,p);assertTranslations(before,b,ids);
});
test('selected locks refuse the whole preserving proposal while old regrid mode still skips locked objects',()=>{
 const b=fixture();b.nodes[1].locked=true;const before=structuredClone(b);assert.throws(()=>planLayout(b,selected(b),options),/选区含锁定对象/);assert.deepEqual(b,before);assert.equal(planLayout(b,selected(b),{...options,preserveClusters:false}).skipped,1);
});
test('incomplete folded ownership cannot expand selection, and fully selected branches translate every descendant exactly once',()=>{
 const b=fixture();b.nodes[0].branchFolded=true;b.nodes.push(card('child',40,-180),card('grandchild',500,-100));b.edges.push({id:'child',from:'a',to:'child',label:'',kind:'branch'},{id:'grandchild',from:'child',to:'grandchild',label:'',kind:'branch'});
 const before=structuredClone(b);for(const ids of [new Set(['a','b']),new Set(['a','b','child']),new Set(['b','child','grandchild'])]){assert.throws(()=>planLayout(b,ids,options),/未完整选中|先展开/);assert.deepEqual(b,before);}
 const ids=selected(b),p=planLayout(b,ids,options);assert.equal(p.ids.length,7);applyLayout(b,p);assertTranslations(before,b,ids);
});
test('a folded root cannot secretly move a locked or section descendant',()=>{
 for(const extra of [{locked:true},{kind:'section' as const,width:300,height:200}]){const b=fixture();b.nodes[0].branchFolded=true;b.nodes.push(card('child',600,400,extra));b.edges.push({id:'child',from:'a',to:'child',kind:'branch',label:''});const before=structuredClone(b);assert.throws(()=>planLayout(b,new Set(['a','b']),options),/未完整选中/);assert.deepEqual(b,before);assert.throws(()=>planLayout(b,new Set(['a','b','child']),options),/锁定|不移动分组框/);assert.deepEqual(b,before);}
});
test('folded section scope and hidden partial members clearly refuse instead of moving unseen content',()=>{
 const b=fixture();b.nodes=b.nodes.slice(0,2);b.nodes.unshift(card('frame',-50,-50,{kind:'section',width:1000,height:900,sectionFolded:true}));const before=structuredClone(b);assert.throws(()=>planLayout(b,new Set(['a','b']),options),/先展开/);assert.throws(()=>planSectionLayout(b,'frame',options),/先展开/);assert.deepEqual(b,before);
});
test('mixed frame selections and locked ancestors refuse while an unlocked inner scope fits atomically',()=>{
 const b=fixture();b.nodes=b.nodes.slice(0,4);b.nodes.unshift(card('outer',-100,-100,{kind:'section',width:8000,height:7000}),card('inner',0,0,{kind:'section',width:6000,height:5000}));const before=structuredClone(b);
 assert.throws(()=>planLayout(b,new Set(['inner','a','b']),options),/不移动分组框/);assert.throws(()=>planSectionLayout(b,'outer',options),/子分组/);assert.deepEqual(b,before);
 const p=planSectionLayout(b,'inner',options),h=new History();h.push(b);applyLayout(b,p);const withoutFrameBefore={...before,nodes:before.nodes.filter(n=>n.id!=='inner')},withoutFrameAfter={...b,nodes:b.nodes.filter(n=>n.id!=='inner')};assertTranslations(withoutFrameBefore,withoutFrameAfter,new Set(['a','b','c','d']));assert.deepEqual(h.undo(b),before);
 b.nodes[0].locked=true;assert.throws(()=>planSectionLayout(b,'inner',options),/锁定分组/);
});
test('a projected membership change is refused before mutation',()=>{
 const b=fixture();b.nodes.unshift(card('frame',0,0,{kind:'section',width:1000,height:1000}));const before=structuredClone(b);assert.throws(()=>planLayout(b,selected(b),options),/改变分组归属/);assert.deepEqual(b,before);
});
test('an explicit innermost frame may refit around preserved clusters but cannot acquire outside objects or escape its parent',()=>{
 const make=():Board=>({...emptyBoard(),version:3,nodes:[card('outer',-100,-100,{kind:'section',width:3000,height:2000}),card('inner',0,0,{kind:'section',width:800,height:400}),card('a',10,20,{width:100}),card('b',200,180,{width:100}),card('c',400,40,{width:100}),card('d',600,180,{width:100})],edges:[{id:'ab',from:'a',to:'b',label:''},{id:'cd',from:'c',to:'d',label:''}]});
 const b=make(),before=structuredClone(b),p=planSectionLayout(b,'inner',{...options,columns:1});assert.ok(p.section!.next.height>b.nodes[1].height);applyLayout(b,p);assertTranslations({...before,nodes:before.nodes.filter(n=>n.id!=='inner')},{...b,nodes:b.nodes.filter(n=>n.id!=='inner')},new Set(['a','b','c','d']));
 for(const mutate of [(b:Board)=>{b.nodes.push(card('obstacle',40,460,{locked:true}));},(b:Board)=>{b.nodes[0].height=550;}]){const b=make();mutate(b);const before=structuredClone(b);assert.throws(()=>planSectionLayout(b,'inner',{...options,columns:1}),/其他对象|超出|分组归属/);assert.deepEqual(b,before);}
});

const staleChanges:{name:string;change:(b:Board)=>void}[]=[
 {name:'selected coordinate',change:b=>{b.nodes[0].x++;}},
 {name:'selected size',change:b=>{b.nodes[0].height++;}},
 {name:'outside coordinate',change:b=>{b.nodes.at(-1)!.y++;}},
 {name:'outside lock',change:b=>{b.nodes.at(-1)!.locked=true;}},
 {name:'outside fold',change:b=>{b.nodes.at(-1)!.branchFolded=true;}},
 {name:'new enclosing frame',change:b=>{b.nodes.push(card('frame',-9000,-9000,{kind:'section',width:20000,height:20000}));}},
 {name:'removed selected node',change:b=>{b.nodes.shift();}},
 {name:'new internal edge',change:b=>{b.edges.push({id:'new',from:'b',to:'c',label:''});}},
 {name:'new crossing edge',change:b=>{b.edges.push({id:'new',from:'a',to:'outside',label:''});}},
 {name:'changed outside edge',change:b=>{b.edges.at(-1)!.to='d';}},
 {name:'changed branch kind',change:b=>{b.edges[0].kind='branch';}},
 {name:'changed edge direction',change:b=>{b.edges[0].direction='none';}},
 {name:'removed edge',change:b=>{b.edges.shift();}},
];
for(const {name,change}of staleChanges)test(`full stale preserving proposal refuses atomically: ${name}`,()=>{
 const b=fixture();b.nodes.push(card('outside',8000,9000));b.edges.push({id:'external',from:'outside',to:'alone',label:''});const p=planLayout(b,new Set(['a','b','c','d','alone']),options);change(b);const before=structuredClone(b);assert.throws(()=>applyLayout(b,p),/已变化/);assert.deepEqual(b,before);
});
test('stale selected source path/title is rejected by the existing layout signature without overwriting source references',()=>{
 for(const change of [(n:Card)=>{n.file='Renamed.md';},(n:Card)=>{n.file='Folder/Note.md';},(n:Card)=>{n.title='New title';}]){const b=fixture(),p=planLayout(b,selected(b),options);change(b.nodes[0]);const before=structuredClone(b);assert.throws(()=>applyLayout(b,p),/已变化/);assert.deepEqual(b,before);}
});
test('tampered internal translation, dimensions or cluster proof cannot partially move earlier clusters',()=>{
 for(const change of [(p:ReturnType<typeof planLayout>)=>{p.items.find(n=>n.id==='d')!.x++;},(p:ReturnType<typeof planLayout>)=>{p.items[0].width++;},(p:ReturnType<typeof planLayout>)=>{p.items[0].x=NaN;},(p:ReturnType<typeof planLayout>)=>{p.preservedClusters!.groups[0].push('c');}]){const b=fixture(),p=planLayout(b,selected(b),options),before=structuredClone(b);change(p);assert.throws(()=>applyLayout(b,p),/预览|变化|无效/);assert.deepEqual(b,before);}
});
test('one history operation restores the entire layout and redo preserves source references and edges',()=>{
 const b=fixture(),before=structuredClone(b),h=new History(),p=planLayout(b,selected(b),options);h.push(b);applyLayout(b,p);const after=structuredClone(b),undone=h.undo(b)!;assert.deepEqual(undone,before);assert.equal(h.undo(undone),undefined);assert.deepEqual(h.redo(undone),after);
});
test('automatic grouping can wrap preserved clusters without splitting hidden ownership or changing original source',()=>{
 const b=fixture();b.nodes[0].branchFolded=true;b.nodes.push(card('child',80,-160));b.edges.push({id:'branch',from:'a',to:'child',label:'',kind:'branch'});const before=structuredClone(b),ids=selected(b),p=planLayout(b,ids,{...options,createSections:true});assert.equal(p.newSections!.length,3);assert.ok(p.newSections!.some(s=>s.ids.includes('a')&&s.ids.includes('b')&&s.ids.includes('child')));applyLayout(b,p);assertTranslations(before,b,ids);parseBoard(JSON.stringify(b));
});
test('presets round-trip the explicit option only for connections; old records keep original behavior',()=>{
 const old={mode:'connections',columns:3,gap:40,sort:'position',anchor:'center'};assert.deepEqual(cleanLayoutOptions(old),old);assert.deepEqual(cleanLayoutOptions({...old,preserveClusters:false}),old);assert.equal(cleanLayoutOptions({...old,preserveClusters:'yes'}),undefined);
 const saved=saveLayoutPreset([],'Keep geometry',options);assert.deepEqual(cleanLayoutPresets(JSON.parse(JSON.stringify(saved))),saved);assert.equal(saved[0].options.preserveClusters,true);assert.equal(cleanLayoutOptions({...options,mode:'grid'})!.preserveClusters,undefined);
 const b=fixture();assert.notDeepEqual(planLayout(b,selected(b),old as LayoutOptions).items.map(n=>[n.x,n.y]),planLayout(b,selected(b),options).items.map(n=>[n.x,n.y]));
});
test('non-connection modes ignore the stored preference without tightening their legacy selection rules',()=>{
 const b=fixture();b.nodes[1].locked=true;const p=planLayout(b,selected(b),{...options,mode:'grid'});assert.equal(p.preservedClusters,undefined);assert.equal(p.skipped,1);assert.throws(()=>planLayout(b,selected(b),{...options,preserveClusters:'bad' as unknown as boolean}),/设置无效/);
});

for(let seed=1;seed<=60;seed++)test(`randomized component geometry, outside selection and one-undo invariant ${seed}`,()=>{
 let value=seed;const random=()=>{value=(value*1664525+1013904223)>>>0;return value/2**32;},b=emptyBoard();b.version=3;
 const count=12+Math.floor(random()*45);for(let i=0;i<count;i++)b.nodes.push(card(String(i),Math.floor(random()*4000)-2000,Math.floor(random()*3000)-1500,{width:80+Math.floor(random()*320),height:60+Math.floor(random()*240),fontSize:14+Math.floor(random()*8)}));
 for(let i=0;i<count*2;i++){const from=String(Math.floor(random()*count)),to=String(Math.floor(random()*count));b.edges.push({id:`e${i}`,from,to,label:`source${i}`});}
 const ids=new Set(b.nodes.filter((_n,i)=>i%5!==0).map(n=>n.id)),before=structuredClone(b),h=new History(),p=planLayout(b,ids,{...options,columns:1+Math.floor(random()*8),sort:seed%2?'position':'title',anchor:seed%2?'corner':'center'});assert.deepEqual(b,before);h.push(b);applyLayout(b,p);assertTranslations(before,b,ids);assert.deepEqual(h.undo(b),before);
});

test('1000 nodes/15000 edges stay bounded, deterministic and preserve 500 complete components',()=>{
 const b=emptyBoard();b.version=3;for(let i=0;i<1000;i++)b.nodes.push(card(String(i),i*100,Math.floor(i/2)%7*120,{width:80+i%3*20,height:60+i%4*15}));
 for(let i=0;i<15000;i++){const pair=i%500;b.edges.push({id:`e${i}`,from:String(pair*2),to:String(pair*2+1),label:''});}
 const ids=selected(b),before=structuredClone(b),times:number[]=[];let last!:ReturnType<typeof planLayout>;
 for(let i=0;i<6;i++){const start=performance.now(),p=planLayout(b,ids,{...options,columns:12});times.push(performance.now()-start);if(i)assert.deepEqual(p,last);last=p;}assert.deepEqual(b,before);assert.equal(last.preservedClusters!.groups.length,500);assert.equal(last.items.length,1000);
 const start=performance.now();applyLayout(b,last);const applyMs=performance.now()-start;assertTranslations(before,b,ids);const median=times.sort((a,b)=>a-b)[Math.floor(times.length/2)];assert.ok(median<2000,`planning median ${median}ms exceeds the regression ceiling`);assert.ok(applyMs<2000,`apply ${applyMs}ms exceeds the regression ceiling`);console.info(JSON.stringify({clusterCompaction:{nodes:1000,edges:15000,components:500,retainedRuns:6,planningMedianMs:median,applyMs,scope:'model only; no native/render/disk timing'}}));
});
