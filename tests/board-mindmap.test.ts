import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoardMindmapState,validBoardMindmapState,updateBoardMindmapState,remapBoardMindmapState,supportsBoardMindmapTarget,boardMindmapSummary,type BoardMindmapState} from '../src/board-mindmap';
import {assertBoardGeometry,canvasExport,clone,emptyBoard,extractSubboard,History,parseBoard,removeNodes,type Board,type Card} from '../src/model';
import {foldCards,moveSelection} from '../src/board-tools';

const card=(id:string,patch:Partial<Card>={}):Card=>({id,kind:'card',file:id+'.md',x:20,y:40,width:200,height:120,color:'sand',...patch});
const container=(id='map',centerId?:string):Card=>({id,kind:'mindmap',title:'脑图',mindmap:createBoardMindmapState(centerId),x:0,y:0,width:800,height:540,color:'blue'});
const fixture=():Board=>clone({...emptyBoard(),version:3,nodes:[card('a'),card('b'),card('c'),card('section',{kind:'section',title:'真实分组',file:undefined}),card('board',{kind:'board',file:'Child.thoughtspace'}),card('text',{kind:'text',file:undefined,text:'独立文本'}),container()]});
const withState=(state:BoardMindmapState):Board=>({...emptyBoard(),version:3,nodes:[{...container(),mindmap:state}]});

test('empty containers have independent bounded state with no inferred center',()=>{
 const a=createBoardMindmapState(),b=createBoardMindmapState();assert.deepEqual(a,{version:1,expandedIds:[],pins:[],history:{entries:[],index:-1}});assert(validBoardMindmapState(a));a.expandedIds.push('id');a.history.entries.push('id');assert.deepEqual(b,createBoardMindmapState());
});
test('a saved center is an ID reference with its own initial history',()=>{
 const state=createBoardMindmapState('node:中心');assert.deepEqual(state,{version:1,centerId:'node:中心',expandedIds:[],pins:[],history:{entries:['node:中心'],index:0}});assert(validBoardMindmapState(state));assert.deepEqual(parseBoard(JSON.stringify(withState(state))),withState(state));
});
test('only existing note, sub-board and group objects can be selected or newly expanded or pinned',()=>{
 const b=fixture();for(const id of ['a','board','section']){
  const state=createBoardMindmapState();assert.equal(updateBoardMindmapState(state,{type:'center',id},b.nodes).centerId,id);assert.deepEqual(updateBoardMindmapState(state,{type:'expand',id},b.nodes).expandedIds,[id]);assert.deepEqual(updateBoardMindmapState(state,{type:'pin',id},b.nodes).pins,[id]);
 }
 for(const kind of ['card','board','section','mindmap','text','image','pdf','audio','video'] as const)assert.equal(supportsBoardMindmapTarget({kind}),['card','board','section'].includes(kind));
 for(const id of ['missing','text','map'])for(const type of ['center','expand','pin'] as const)assert.throws(()=>updateBoardMindmapState(createBoardMindmapState(),{type,id},b.nodes),/已移除或不支持脑图/);
});
test('intent updates never copy or mutate ordinary nodes, source bodies or geometry',()=>{
 const b=fixture(),state=Object.freeze({...createBoardMindmapState('a'),expandedIds:Object.freeze([]),pins:Object.freeze([]),history:Object.freeze({entries:Object.freeze(['a']),index:0})}) as unknown as BoardMindmapState;
 const before=JSON.stringify(b);for(const node of b.nodes)Object.freeze(node);Object.freeze(b.nodes);
 const next=updateBoardMindmapState(state,{type:'center',id:'b'},b.nodes);assert.equal(next.centerId,'b');assert.equal(state.centerId,'a');assert.equal(JSON.stringify(b),before);assert.deepEqual(Object.keys(next).sort(),['centerId','expandedIds','history','pins','version']);
});
test('multiple containers retain independent centers, pins and expanded references after saving',()=>{
 const b=fixture();b.nodes.push(container('second','b'));const first=b.nodes.find(n=>n.id==='map')!,second=b.nodes.at(-1)!;
 first.mindmap=updateBoardMindmapState(first.mindmap!,{type:'center',id:'a'},b.nodes);first.mindmap=updateBoardMindmapState(first.mindmap,{type:'expand',id:'a'},b.nodes);second.mindmap=updateBoardMindmapState(second.mindmap!,{type:'pin',id:'section'},b.nodes);
 const read=parseBoard(JSON.stringify(b));assert.equal(read.nodes.find(n=>n.id==='map')!.mindmap!.centerId,'a');assert.equal(read.nodes.at(-1)!.mindmap!.centerId,'b');assert.deepEqual(first.mindmap.pins,[]);assert.deepEqual(second.mindmap.expandedIds,[]);assert.deepEqual(read,clone(b));
});
test('repeated center and explicit expand or pin commands are no-ops without duplicate IDs',()=>{
 const b=fixture();let state=createBoardMindmapState('a');assert.deepEqual(updateBoardMindmapState(state,{type:'center',id:'a'},b.nodes),state);
 state=updateBoardMindmapState(state,{type:'expand',id:'b',expanded:true},b.nodes);assert.deepEqual(updateBoardMindmapState(state,{type:'expand',id:'b',expanded:true},b.nodes),state);
 state=updateBoardMindmapState(state,{type:'pin',id:'b',pinned:true},b.nodes);assert.deepEqual(updateBoardMindmapState(state,{type:'pin',id:'b',pinned:true},b.nodes),state);
 assert.deepEqual(updateBoardMindmapState(state,{type:'expand',id:'b'},b.nodes).expandedIds,[]);assert.deepEqual(updateBoardMindmapState(state,{type:'pin',id:'b'},b.nodes).pins,[]);
});
test('history navigates backward and forward then trims only the abandoned forward path',()=>{
 const b=fixture();let state=createBoardMindmapState('a');for(const id of ['b','c','a'])state=updateBoardMindmapState(state,{type:'center',id},b.nodes);
 state=updateBoardMindmapState(state,{type:'history',direction:'back'},b.nodes);assert.equal(state.centerId,'c');assert.equal(state.history.index,2);
 const forward=updateBoardMindmapState(state,{type:'history',direction:'forward'},b.nodes);assert.equal(forward.centerId,'a');assert.deepEqual(updateBoardMindmapState(forward,{type:'history',direction:'forward'},b.nodes),forward);
 state=updateBoardMindmapState(state,{type:'center',id:'b'},b.nodes);assert.deepEqual(state.history,{entries:['a','b','c','b'],index:3});assert(validBoardMindmapState(state));
});
test('history caps at 40 entries while retaining repeated nonadjacent visits',()=>{
 const nodes=Array.from({length:45},(_,i)=>card('n'+i));let state=createBoardMindmapState();for(const node of nodes)state=updateBoardMindmapState(state,{type:'center',id:node.id},nodes);
 assert.equal(state.history.entries.length,40);assert.equal(state.history.entries[0],'n5');assert.equal(state.history.index,39);
 for(let i=0;i<50;i++)state=updateBoardMindmapState(state,{type:'history',direction:'back'},nodes);assert.equal(state.centerId,'n5');assert.equal(state.history.index,0);assert(validBoardMindmapState(state));
});
test('expanded and pinned caps reject new additions without silently evicting prior intent',()=>{
 const nodes=Array.from({length:10},(_,i)=>card('n'+i));let expanded=createBoardMindmapState(),pins=createBoardMindmapState();
 for(const node of nodes.slice(0,8))expanded=updateBoardMindmapState(expanded,{type:'expand',id:node.id},nodes);
 for(const node of nodes.slice(0,6))pins=updateBoardMindmapState(pins,{type:'pin',id:node.id},nodes);
 const before=clone({expanded,pins});assert.throws(()=>updateBoardMindmapState(expanded,{type:'expand',id:'n8'},nodes),/最多同时展开 8/);assert.throws(()=>updateBoardMindmapState(pins,{type:'pin',id:'n6'},nodes),/最多固定 6/);assert.deepEqual({expanded,pins},before);
 assert.equal(updateBoardMindmapState(expanded,{type:'expand',id:'n0'},nodes).expandedIds.length,7);assert.equal(updateBoardMindmapState(pins,{type:'pin',id:'n0'},nodes).pins.length,5);
});
test('deleted and changed-kind targets retain their saved references and can be removed explicitly',()=>{
 const b=fixture();let state=createBoardMindmapState('a');state=updateBoardMindmapState(state,{type:'center',id:'b'},b.nodes);state=updateBoardMindmapState(state,{type:'expand',id:'a'},b.nodes);state=updateBoardMindmapState(state,{type:'pin',id:'a'},b.nodes);b.nodes.find(n=>n.id==='map')!.mindmap=state;
 removeNodes(b,new Set(['a']));const parsed=parseBoard(JSON.stringify(b)),saved=parsed.nodes.find(n=>n.id==='map')!.mindmap!;assert.deepEqual(saved,state);
 const back=updateBoardMindmapState(saved,{type:'history',direction:'back'},parsed.nodes);assert.equal(back.centerId,'a');assert(validBoardMindmapState(back));assert.deepEqual(back.expandedIds,['a']);assert.deepEqual(back.pins,['a']);
 assert.deepEqual(updateBoardMindmapState(back,{type:'expand',id:'a',expanded:false},parsed.nodes).expandedIds,[]);assert.deepEqual(updateBoardMindmapState(back,{type:'pin',id:'a',pinned:false},parsed.nodes).pins,[]);
 b.nodes.find(n=>n.id==='b')!.kind='text';b.nodes.find(n=>n.id==='b')!.text='changed';assert.equal(parseBoard(JSON.stringify(b)).nodes.find(n=>n.id==='map')!.mindmap!.centerId,'b');
});
test('source renaming needs no state migration because references use object IDs',()=>{
 const b=fixture();b.nodes.at(-1)!.mindmap=createBoardMindmapState('a');const before=clone(b.nodes.at(-1)!.mindmap);b.nodes[0].file='Notes/Renamed.md';b.nodes[0].title='Renamed';const read=parseBoard(JSON.stringify(b));assert.deepEqual(read.nodes.at(-1)!.mindmap,before);assert.match(boardMindmapSummary(read.nodes.at(-1)!,read.nodes),/Renamed/);
});
test('board history restores container state separately from another container and source content',()=>{
 const b=fixture();b.nodes.push(container('other','b'));const before=clone(b),history=new History();history.push(b);const map=b.nodes.find(n=>n.id==='map')!;map.mindmap=updateBoardMindmapState(map.mindmap!,{type:'center',id:'a'},b.nodes);map.mindmap=updateBoardMindmapState(map.mindmap,{type:'expand',id:'section'},b.nodes);
 const changed=clone(b),undone=history.undo(b)!;assert.deepEqual(undone,before);assert.deepEqual(history.redo(undone),changed);assert.deepEqual(b.nodes.filter(n=>n.id!=='map'),before.nodes.filter(n=>n.id!=='map'));
});

test('same-board reference remapping follows copied targets while retaining external IDs',()=>{
 const state:BoardMindmapState={version:1,centerId:'a',expandedIds:['a','external'],pins:['external','b'],history:{entries:['a','b','a'],index:2}},before=clone(state),result=remapBoardMindmapState(state,new Map([['a','copy-a'],['b','copy-b']]));
 assert.deepEqual(result,{version:1,centerId:'copy-a',expandedIds:['copy-a','external'],pins:['external','copy-b'],history:{entries:['copy-a','copy-b','copy-a'],index:2}});assert.deepEqual(state,before);assert(validBoardMindmapState(result));
 result.expandedIds.push('new');assert.deepEqual(state.expandedIds,before.expandedIds);
});
test('remapping coalesces duplicate references and adjacent history visits without losing the cursor',()=>{
 const state:BoardMindmapState={version:1,centerId:'b',expandedIds:['a','b','c'],pins:['b','a'],history:{entries:['a','b','c','a'],index:1}},result=remapBoardMindmapState(state,new Map([['a','same'],['b','same']]));
 assert.deepEqual(result,{version:1,centerId:'same',expandedIds:['same','c'],pins:['same'],history:{entries:['same','c','same'],index:0}});assert(validBoardMindmapState(result));assert.deepEqual(remapBoardMindmapState(createBoardMindmapState(),new Map()),createBoardMindmapState());
});
test('caller-provided unavailable IDs preserve cross-board history without binding a colliding target',()=>{
 const state=createBoardMindmapState('a'),result=remapBoardMindmapState(state,new Map([['a','missing:operation-1']]));assert.equal(result.centerId,'missing:operation-1');assert(validBoardMindmapState(result));assert.match(boardMindmapSummary({mindmap:result},[card('a')]),/对象不可用/);assert.equal(state.centerId,'a');
});
test('extracting only a container leaves its source objects in place and its child references explicitly unavailable',()=>{
 const b=fixture(),map=b.nodes.at(-1)!;map.mindmap=updateBoardMindmapState(createBoardMindmapState('a'),{type:'expand',id:'section'},b.nodes);const before=clone(b),history=new History();history.push(b);
 const {parent,child}=extractSubboard(b,new Set(['map']),'Nested.thoughtspace','子白板','portal');assert.deepEqual(b,before);assert.deepEqual(child.nodes.map(n=>n.id),['map']);assert.deepEqual(child.nodes[0].mindmap,map.mindmap);assert.equal(child.nodes[0].mindmap!.centerId,'a');assert.equal(child.nodes.some(n=>n.id==='a'||n.id==='section'),false);
 for(const node of before.nodes.filter(n=>n.id!=='map'))assert.deepEqual(parent.nodes.find(n=>n.id===node.id),node);assert.deepEqual(parseBoard(JSON.stringify(child)),child);assert.deepEqual(parseBoard(JSON.stringify(parent)),parent);assert.match(boardMindmapSummary(child.nodes[0],child.nodes),/中心：对象不可用 · ID a/);assert.deepEqual(history.undo(parent),before);
});
test('extracting a real source with one container preserves other parent containers dangling IDs for undo',()=>{
 const b=fixture();b.nodes.at(-1)!.mindmap=createBoardMindmapState('a');b.nodes.push(container('stay','a'));const before=clone(b),history=new History();history.push(b);
 const {parent,child}=extractSubboard(b,new Set(['map','a']),'Nested.thoughtspace','子白板','portal');assert.deepEqual(child.nodes.map(n=>n.id),['a','map']);assert.equal(child.nodes.find(n=>n.id==='map')!.mindmap!.centerId,'a');assert.equal(parent.nodes.find(n=>n.id==='stay')!.mindmap!.centerId,'a');assert.equal(parent.nodes.some(n=>n.id==='a'),false);assert.deepEqual(parseBoard(JSON.stringify(parent)),parent);assert.match(boardMindmapSummary(parent.nodes.find(n=>n.id==='stay')!,parent.nodes),/对象不可用/);assert.deepEqual(history.undo(parent),before);assert.deepEqual(b,before);
});
test('frozen input states can be remapped without aliasing their arrays',()=>{
 const state=createBoardMindmapState('a');Object.freeze(state.expandedIds);Object.freeze(state.pins);Object.freeze(state.history.entries);Object.freeze(state.history);Object.freeze(state);assert.equal(remapBoardMindmapState(state,new Map([['a','new']])).centerId,'new');assert.throws(()=>remapBoardMindmapState(state,new Map([['a','']])),/标识无效/);
});

const invalidIds=['',' ',' bad','bad ','line\nbreak','control'+String.fromCharCode(127),'a'.repeat(257)];
for(const id of invalidIds)test(`invalid bounded ID ${JSON.stringify(id.slice(0,20))} is rejected rather than rewritten`,()=>{
 assert.throws(()=>createBoardMindmapState(id),/标识无效/);assert.equal(validBoardMindmapState({...createBoardMindmapState(),expandedIds:[id]}),false);assert.throws(()=>updateBoardMindmapState(createBoardMindmapState(),{type:'expand',id},fixture().nodes),/标识无效/);
});
const malformed:unknown[]=[null,[],{}, {...createBoardMindmapState(),version:2},{...createBoardMindmapState(),body:'duplicated note body'},
 {...createBoardMindmapState(),expandedIds:['a','a']},{...createBoardMindmapState(),expandedIds:Array.from({length:9},(_,i)=>'n'+i)},
 {...createBoardMindmapState(),pins:Array.from({length:7},(_,i)=>'n'+i)},{...createBoardMindmapState(),pins:['a','a']},
 {...createBoardMindmapState(),centerId:'a'},{...createBoardMindmapState('a'),history:{entries:['b'],index:0}},
 {...createBoardMindmapState('a'),history:{entries:['a','a'],index:1}},{...createBoardMindmapState('a'),history:{entries:['a'],index:-1}},
 {...createBoardMindmapState('a'),history:{entries:['a'],index:1}},{...createBoardMindmapState(),history:{entries:[],index:0}},
 {...createBoardMindmapState('a'),history:{entries:['a'],index:NaN}},{...createBoardMindmapState('a'),history:{entries:['a'],index:Infinity}},
 {...createBoardMindmapState('a'),history:{entries:['a'],index:0.5}},{...createBoardMindmapState('a'),history:{entries:['a'],index:0,body:'copy'}},
 {...createBoardMindmapState('a'),history:{entries:Array.from({length:41},(_,i)=>'n'+i),index:0}}];
for(let i=0;i<malformed.length;i++)test(`malformed primary container state ${i+1} rejects board reads instead of dropping new data`,()=>{
 assert.equal(validBoardMindmapState(malformed[i]),false);const b={...emptyBoard(),version:3,nodes:[{...container(),mindmap:malformed[i]}]};assert.throws(()=>parseBoard(JSON.stringify(b)),/脑图容器状态无效/);
});
test('container state is required only on the new kind and is rejected on unrelated kinds',()=>{
 const b=withState(createBoardMindmapState());delete b.nodes[0].mindmap;assert.throws(()=>parseBoard(JSON.stringify(b)),/脑图容器状态无效/);
 for(const node of fixture().nodes.filter(n=>n.kind!=='mindmap')){const board={...emptyBoard(),version:3,nodes:[{...node,mindmap:createBoardMindmapState()}]};assert.throws(()=>parseBoard(JSON.stringify(board)),/脑图容器状态无效/);}
});
test('legacy boards retain exact structure and new containers require board version 3',()=>{
 for(const version of [1,2,3] as const){const b={...emptyBoard(),version,nodes:[card('note')]};assert.deepEqual(parseBoard(JSON.stringify(b)),b);if(version!==3)assert.throws(()=>parseBoard(JSON.stringify({...b,nodes:[container()]})),/节点数据不完整/);}
});
test('new container movement and folding leave overlapping ordinary objects and their geometry unchanged',()=>{
 const b=fixture(),before=clone(b),state=clone(b.nodes.at(-1)!.mindmap);moveSelection(b,new Set(['map']),70,90);assert.deepEqual(b.nodes.slice(0,-1),before.nodes.slice(0,-1));assert.equal(b.nodes.at(-1)!.x,70);assert.equal(b.nodes.at(-1)!.y,90);assert.deepEqual(b.nodes.at(-1)!.mindmap,state);
 const expanded=clone(b);foldCards(b,new Set(['map']),true);assert.equal(b.nodes.at(-1)!.height,72);assert.equal(b.nodes.at(-1)!.expandedHeight,540);assert.equal(b.nodes.at(-1)!.collapsed,true);assert.deepEqual(b.nodes.slice(0,-1),before.nodes.slice(0,-1));assert.deepEqual(parseBoard(JSON.stringify(b)),clone(b));
 foldCards(b,new Set(['map']),true);foldCards(b,new Set(['map']),false);assert.deepEqual(b,expanded);
});
test('locked containers ignore movement and folding while history restores an unlocked outer fold',()=>{
 const b=withState(createBoardMindmapState('missing')),history=new History(),before=clone(b);history.push(b);foldCards(b,new Set(['map']),true);const folded=clone(b);assert.deepEqual(history.undo(b),before);assert.deepEqual(history.redo(before),folded);
 b.nodes[0].locked=true;const locked=clone(b);foldCards(b,new Set(['map']),false);moveSelection(b,new Set(['map']),5,8);assert.deepEqual(b,locked);
});
test('container geometry follows the existing numeric and collapsed-frame invariants',()=>{
 const b=withState(createBoardMindmapState());assert.doesNotThrow(()=>assertBoardGeometry(b));
 for(const change of [{width:79},{height:59},{x:Infinity},{y:NaN}]){const bad=clone(b);Object.assign(bad.nodes[0],change);assert.throws(()=>assertBoardGeometry(bad),/白板尺寸无效/);assert.throws(()=>parseBoard(JSON.stringify(bad)));}
 for(const change of [{collapsed:true},{collapsed:true,height:72,expandedHeight:59},{collapsed:true,height:80,expandedHeight:540},{expandedHeight:540}]){const bad=clone(b);Object.assign(bad.nodes[0],change);assert.throws(()=>parseBoard(JSON.stringify(bad)),/折叠数据不完整/);}
});
test('Canvas exports containers as readable text references without invented files or source body copies',()=>{
 const b=fixture(),map=b.nodes.at(-1)!;map.mindmap={version:1,centerId:'a',expandedIds:['board','gone'],pins:['section'],history:{entries:['a'],index:0}};b.nodes[0].text='private body must not be copied';const before=JSON.stringify(b),out=canvasExport(b),converted=out.nodes.find(n=>n.id==='map')!;
 assert.equal(converted.type,'text');assert.equal('file' in converted,false);assert.equal(JSON.stringify(b),before);const rendered=(converted as {text:string}).text;assert.match(rendered,/中心：a\.md · ID a/);assert.match(rendered,/Child\.thoughtspace/);assert.match(rendered,/真实分组/);assert.match(rendered,/对象不可用 · ID gone/);assert.equal(rendered.includes('private body'),false);assert.equal(rendered.includes('undefined'),false);
 assert.equal(out.nodes.find(n=>n.id==='a')!.type,'file');assert.equal(out.nodes.find(n=>n.id==='section')!.type,'group');
});
test('empty and folded exports remain readable and escape Markdown control characters in metadata',()=>{
 const b=withState(createBoardMindmapState());b.nodes[0].title='title\n# [link](bad)';foldCards(b,new Set(['map']),true);const out=canvasExport(b).nodes[0] as {type:string;text:string;height:number};assert.equal(out.type,'text');assert.equal(out.height,72);assert.match(out.text,/中心：尚未选择/);assert(out.text.includes('title \\# \\[link\\]'));
});
test('existing relation geometry checkpoints survive adding a valid container',()=>{
 const b=fixture();b.nodes[0].autoFit=true;b.relationGeometry={version:1,entries:[{id:'a',shape:'saved-shape',source:{path:'a.md',mtime:1,size:10}}]};const read=parseBoard(JSON.stringify(b));assert.deepEqual(read.relationGeometry,b.relationGeometry);assert.deepEqual(read.nodes.at(-1)!.mindmap,b.nodes.at(-1)!.mindmap);
});
