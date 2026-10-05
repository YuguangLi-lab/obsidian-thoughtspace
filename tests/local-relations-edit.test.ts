import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBoard,type Board,type Card,type Edge} from '../src/model';
import {localNeighborhood} from '../src/local-relations';
import {captureLocalRelationEdit,planLocalRelationEdit,LocalRelationEditSaveError,type LocalRelationMutation,type LocalRelationValue} from '../src/local-relations-edit';

const node=(id:string,extra:Partial<Card>={}):Card=>({id,kind:'card',file:`Notes/${id}.md`,x:0,y:0,width:240,height:100,color:'sand',...extra});
const edge=(id:string,from:string,to:string,extra:Partial<Edge>={}):Edge=>({id,from,to,label:'',...extra});
const board=(edges:Edge[]=[]):Board=>({version:3,nodes:['a','b','c','d'].map((id,i)=>node(id,{x:i*400})),edges,viewport:{x:20,y:40,zoom:1}});
const value=(extra:Partial<LocalRelationValue>={}):LocalRelationValue=>({from:'a',to:'b',label:'related',kind:'ordinary',direction:'forward',...extra});
const create=(b:Board,v=value(),centerId='a'):LocalRelationMutation=>({action:'create',centerId,value:v,expected:captureLocalRelationEdit(b,[centerId,v.from,v.to])});
const update=(b:Board,id:string,v=value(),centerId='a'):LocalRelationMutation=>({action:'update',centerId,edgeId:id,value:v,expected:captureLocalRelationEdit(b,[centerId,v.from,v.to],id)});
const remove=(b:Board,id:string,centerId='a'):LocalRelationMutation=>({action:'remove',centerId,edgeId:id,expected:captureLocalRelationEdit(b,[centerId],id)});
function freeze<T>(input:T):T{if(input&&typeof input==='object'){for(const item of Object.values(input))freeze(item);Object.freeze(input);}return input;}
function rejectsUnchanged(b:Board,run:()=>unknown,pattern?:RegExp){const before=JSON.stringify(b);if(pattern)assert.throws(run,pattern);else assert.throws(run);assert.equal(JSON.stringify(b),before);}

for(const kind of ['card','board','section'] as const)for(const relation of ['ordinary','branch'] as const)test(`${kind} endpoints support ${relation} creation without changing geometry or source data`,()=>{
 const b=board();Object.assign(b.nodes[1],{kind,...(kind==='board'?{file:'Boards/Missing.thoughtspace'}:kind==='section'?{file:undefined,title:'Group'}:{file:'Missing/Note.md'})});
 const request=freeze(create(b,value({kind:relation,label:'  关系  '}))),before=JSON.stringify(b);freeze(b);
 const result=planLocalRelationEdit(b,request,'new-edge');assert.equal(result.changed,true);assert.equal(result.edgeId,'new-edge');assert.equal(result.board.nodes,b.nodes);assert.equal(result.board.viewport,b.viewport);assert.equal(JSON.stringify(b),before);assert.equal(result.board.edges[0].label,'关系');assert.equal(result.board.edges[0].kind,relation==='branch'?'branch':undefined);assert.equal(result.board.edges[0].style,undefined);assert.doesNotThrow(()=>parseBoard(JSON.stringify(result.board)));
});

test('commands and snapshots survive JSON transport and accept prototype-like and colon IDs',()=>{
 const b=board();b.nodes[0].id='__proto__';b.nodes[1].id='target:one';const request=create(b,value({from:'__proto__',to:'target:one'}),'__proto__');
 const transported=JSON.parse(JSON.stringify(request)) as LocalRelationMutation;assert.ok(Object.hasOwn(transported.expected.nodes,'__proto__'));assert.equal(planLocalRelationEdit(b,transported,'edge:one').board.edges[0].from,'__proto__');
});

for(const style of ['straight','elbow','curve'] as const)test(`new edges inherit only the board's ${style} default`,()=>{
 const b=board();b.defaultEdgeStyle=style;const result=planLocalRelationEdit(b,create(b),'new-edge');assert.deepEqual(result.board.edges[0],{id:'new-edge',style,from:'a',to:'b',label:'related',direction:'forward'});
});

test('editing an exact parallel edge preserves all visual and unrelated fields',()=>{
 const chosen={...edge('two','a','b',{label:'second',style:'elbow',color:'rose',dashed:true,fromSide:'left',toSide:'bottom',direction:'none'}),extension:{keep:true}};
 const b=board([edge('one','a','b',{label:'first'}),chosen,edge('other','c','d',{kind:'branch'})]),before=JSON.stringify(b),request=update(b,'two',value({label:'changed',direction:'both'}));freeze(b);
 const result=planLocalRelationEdit(b,request);assert.equal(JSON.stringify(b),before);assert.equal(result.board.edges[0],b.edges[0]);assert.equal(result.board.edges[2],b.edges[2]);assert.deepEqual(result.board.edges[1],{...chosen,label:'changed',direction:'both'});assert.notEqual(result.board.edges[1],chosen);assert.equal(result.board.nodes,b.nodes);
});

test('deletion removes just the selected parallel edge and leaves endpoints folds and board metadata intact',()=>{
 const b=board([edge('one','a','b'),edge('two','a','b'),edge('third','a','b',{kind:'branch'})]);b.nodes[0].branchFolded=true;b.mode='mindmap';b.mindmapLayout='right';const request=remove(b,'two'),before=JSON.stringify(b);freeze(b);
 const result=planLocalRelationEdit(b,request);assert.deepEqual(result.board.edges.map(e=>e.id),['one','third']);assert.equal(result.board.nodes,b.nodes);assert.equal(result.board.mode,b.mode);assert.equal(result.board.mindmapLayout,b.mindmapLayout);assert.equal(JSON.stringify(b),before);
});

for(const kind of [undefined,'branch'] as const)for(const direction of [undefined,'forward'] as const)test(`untouched ${kind||'ordinary'} ${direction||'implicit'} edge is a no-op`,()=>{
 const b=board([edge('old','a','b',{kind,direction,label:'same'})]);const result=planLocalRelationEdit(b,update(b,'old',value({kind:kind||'ordinary',label:'same'})));assert.equal(result.changed,false);assert.equal(result.board,b);assert.equal(result.board.edges[0],b.edges[0]);
});

for(const label of ['  untouched  ','   ','x'.repeat(250)])test(`unchanged legacy label of ${label.length} characters is preserved without an undo-worthy edit`,()=>{
 const b=board([edge('old','a','b',{label})]),result=planLocalRelationEdit(b,update(b,'old',value({label})));assert.equal(result.changed,false);assert.equal(result.board,b);assert.equal(result.board.edges[0].label,label);
 const changedDirection=planLocalRelationEdit(b,update(b,'old',value({label,direction:'both'})));assert.equal(changedDirection.changed,true);assert.equal(changedDirection.board.edges[0].label,label);
});

test('only actually edited label text is trimmed while untouched visual fields remain intact',()=>{
 const b=board([edge('old','a','b',{label:'  old  ',color:'rose'})]),result=planLocalRelationEdit(b,update(b,'old',value({label:'  new  '})));assert.equal(result.board.edges[0].label,'new');assert.equal(result.board.edges[0].color,'rose');
});

test('ordinary reverse-direction edges are distinct and do not create a family or forbid ordinary cycles',()=>{
 const b=board([edge('ba','b','a'),edge('bc','b','c'),edge('ca','c','a')]),result=planLocalRelationEdit(b,create(b),'ab');assert.equal(result.board.edges.length,4);
 const groups=localNeighborhood(result.board,'a').groups;assert.ok(groups.filter(g=>['parents','children','siblings'].includes(g.kind)).every(g=>!g.total));
});

for(const direction of ['forward','both','none'] as const)test(`repeated ${direction} creation cannot add the same ordered pair`,()=>{
 const b=board([edge('existing','a','b',{direction})]);rejectsUnchanged(b,()=>planLocalRelationEdit(b,create(b,value({direction})),'another'),/已存在/);
});
for(const direction of ['both','none'] as const)test(`reversing a symmetric ${direction} relation cannot bypass duplicate protection`,()=>{
 const b=board([edge('existing','b','a',{direction})]);rejectsUnchanged(b,()=>planLocalRelationEdit(b,create(b,value({direction})),'another'),/已存在/);
});

for(const oldDirection of ['forward','both','none'] as const)for(const newDirection of ['forward','both','none'] as const)test(`ordinary ${oldDirection} → ${newDirection} duplicate detection is invariant under symmetric storage orientation`,()=>{
 for(const reverse of [false,true]){const b=board([edge('existing',reverse?'b':'a',reverse?'a':'b',{direction:oldDirection})]),request=create(b,value({direction:newDirection}));
  if(reverse&&oldDirection==='forward'&&newDirection==='forward')assert.equal(planLocalRelationEdit(b,request,'new').changed,true);else rejectsUnchanged(b,()=>planLocalRelationEdit(b,request,'new'),/已存在/);
 }
});

test('an existing parallel edge remains editable by direction without merging its neighbors',()=>{
 const b=board([edge('old','a','b'),edge('reverse','b','a',{direction:'both'}),edge('parallel','a','b')]);const result=planLocalRelationEdit(b,update(b,'old',value({direction:'both'})));assert.equal(result.board.edges.length,3);assert.equal(result.board.edges[1],b.edges[1]);assert.equal(result.board.edges[2],b.edges[2]);
});

test('rewiring to an occupied ordinary pair is rejected but an unoccupied endpoint is allowed',()=>{
 const b=board([edge('old','a','b'),edge('occupied','a','c')]);rejectsUnchanged(b,()=>planLocalRelationEdit(b,update(b,'old',value({to:'c'}))),/已存在/);const result=planLocalRelationEdit(b,update(b,'old',value({to:'d'})));assert.equal(result.board.edges[0].to,'d');assert.equal(result.board.edges[1],b.edges[1]);
});

test('converting ordinary to branch or branch to ordinary keeps visual fields and explicit semantics',()=>{
 const b=board([edge('old','a','b',{label:'old',style:'straight',dashed:true})]),branch=planLocalRelationEdit(b,update(b,'old',value({kind:'branch'}))).board;assert.equal(branch.edges[0].kind,'branch');assert.equal(branch.edges[0].style,'straight');assert.equal(branch.edges[0].dashed,true);
 const ordinary=planLocalRelationEdit(branch,update(branch,'old',value({direction:'both'}))).board;assert.equal(Object.hasOwn(ordinary.edges[0],'kind'),false);assert.equal(ordinary.edges[0].direction,'both');assert.equal(localNeighborhood(ordinary,'a').groups.find(g=>g.kind==='children')?.total,0);
});

test('converting a branch into an occupied ordinary pair rejects a new duplicate',()=>{
 const b=board([edge('branch','a','b',{kind:'branch'}),edge('ordinary','a','b')]);rejectsUnchanged(b,()=>planLocalRelationEdit(b,update(b,'branch')),/已存在/);
});

test('repeated create update and delete submissions cannot silently replay an old intent',()=>{
 const b=board(),creation=create(b),created=planLocalRelationEdit(b,creation,'new').board;rejectsUnchanged(created,()=>planLocalRelationEdit(created,creation,'new'),/标识/);rejectsUnchanged(created,()=>planLocalRelationEdit(created,creation,'new2'),/已存在/);
 const editing=update(created,'new',value({label:'changed'})),edited=planLocalRelationEdit(created,editing).board;rejectsUnchanged(edited,()=>planLocalRelationEdit(edited,editing),/已被修改/);
 const deleting=remove(edited,'new'),deleted=planLocalRelationEdit(edited,deleting).board;rejectsUnchanged(deleted,()=>planLocalRelationEdit(deleted,deleting),/已删除/);
});

for(const mutation of [{label:'concurrent'},{direction:'both'},{style:'straight'},{from:'c'},{dashed:true}] as Partial<Edge>[])test(`full edge preconditions reject concurrent ${Object.keys(mutation)[0]} changes`,()=>{
 const b=board([edge('old','a','b')]),editing=update(b,'old'),deleting=remove(b,'old');Object.assign(b.edges[0],mutation);rejectsUnchanged(b,()=>planLocalRelationEdit(b,editing),/已被修改/);rejectsUnchanged(b,()=>planLocalRelationEdit(b,deleting),/已被修改/);
});

for(const mutation of [{file:'Renamed/New.md'},{title:'Renamed'},{locked:true},{kind:'board',file:'New.thoughtspace'}] as Partial<Card>[])test(`endpoint preconditions reject concurrent ${Object.keys(mutation)[0]} changes`,()=>{
 const b=board(),request=create(b);Object.assign(b.nodes[1],mutation);rejectsUnchanged(b,()=>planLocalRelationEdit(b,request,'new'),/已变化/);
});

test('paragraph identity and native video source note are part of detached optimistic stamps',()=>{
 const b=board();b.nodes[1].paragraphQuote={path:'Origin.md',subpath:'#Heading',mode:'embed'};b.nodes[1].videoCapture={id:'00000000-0000-0000-0000-000000000000',note:'Capture.md'};
 // These source forms are currently unsupported on cards by parseBoard, but a
 // legacy/imported in-memory object must still fail the stale-source guard first.
 const request=create(b);b.nodes[1].paragraphQuote.subpath='#Changed';rejectsUnchanged(b,()=>planLocalRelationEdit(b,request,'new'),/已变化/);
 b.nodes[1].paragraphQuote.subpath='#Heading';b.nodes[1].videoCapture.note='MovedCapture.md';rejectsUnchanged(b,()=>planLocalRelationEdit(b,request,'new'),/已变化/);
});

test('geometry viewport and unrelated board changes do not invalidate ordinary relationship intent',()=>{
 const b=board(),request=create(b);b.nodes[1].x=777;b.nodes[1].width=320;b.viewport.zoom=.5;b.nodes[3].title='Unrelated';b.edges.push(edge('unrelated','c','d'));const result=planLocalRelationEdit(b,request,'new');assert.equal(result.board.nodes,b.nodes);assert.equal(result.board.viewport,b.viewport);assert.equal(result.board.edges[0],b.edges[0]);
});

for(const action of ['create','update','remove'] as const)test(`${action} rejects locked endpoints even with a current stamp`,()=>{
 const b=board(action==='create'?[]:[edge('old','a','b')]);b.nodes[1].locked=true;const request=action==='create'?create(b):action==='update'?update(b,'old'):remove(b,'old');rejectsUnchanged(b,()=>planLocalRelationEdit(b,request,'new'),/解锁/);
});

test('rewiring checks the old target lock as well as the newly selected target',()=>{
 const b=board([edge('old','a','b')]);b.nodes[1].locked=true;rejectsUnchanged(b,()=>planLocalRelationEdit(b,update(b,'old',value({to:'c'}))),/解锁/);b.nodes[1].locked=false;b.nodes[2].locked=true;rejectsUnchanged(b,()=>planLocalRelationEdit(b,update(b,'old',value({to:'c'}))),/解锁/);
 b.nodes[2].locked=false;b.nodes[3].locked=true;assert.equal(planLocalRelationEdit(b,update(b,'old',value({to:'c'}))).changed,true);
});

for(const kind of ['text','image','pdf','audio','video'] as const)test(`${kind} endpoints are excluded from create update and remove`,()=>{
 const b=board([edge('old','a','b')]),requests=[create(b),update(b,'old'),remove(b,'old')];b.nodes[1].kind=kind;assert.throws(()=>captureLocalRelationEdit(b,['a','b']),/仅支持/);for(const request of requests)rejectsUnchanged(b,()=>planLocalRelationEdit(b,request,'new'),/仅支持/);
});

test('missing or duplicate endpoint identities fail closed even if a stamp was captured',()=>{
 const b=board(),request=create(b);b.nodes.pop();assert.equal(planLocalRelationEdit(b,request,'new').changed,true);b.nodes=b.nodes.filter(n=>n.id!=='b');rejectsUnchanged(b,()=>planLocalRelationEdit(b,request,'new'),/已删除/);
 b.nodes.push(node('b'),node('b'));rejectsUnchanged(b,()=>planLocalRelationEdit(b,request,'new'),/标识冲突/);
});

test('unrelated edges or rewiring away from the current center are rejected',()=>{
 const b=board([edge('other','c','d'),edge('old','a','b')]);rejectsUnchanged(b,()=>planLocalRelationEdit(b,update(b,'other',value())),/当前中心/);rejectsUnchanged(b,()=>planLocalRelationEdit(b,remove(b,'other')),/当前中心/);rejectsUnchanged(b,()=>planLocalRelationEdit(b,update(b,'old',value({from:'c',to:'d'}))),/当前中心/);rejectsUnchanged(b,()=>planLocalRelationEdit(b,create(b,value({from:'c',to:'d'})),'new'),/当前中心/);
});

test('changing ordinary edge orientation preserves the selected edge ID and visual fields',()=>{
 const b=board([edge('old','a','b',{fromSide:'left',toSide:'right'})]),result=planLocalRelationEdit(b,update(b,'old',value({from:'b',to:'a'})));assert.equal(result.edgeId,'old');assert.deepEqual(result.board.edges[0],{id:'old',from:'b',to:'a',label:'related',fromSide:'left',toSide:'right'});
});

for(const invalid of ['cycle','two parents','duplicate branch'] as const)test(`branch mutation rejects ${invalid} against the entire current board`,()=>{
 const b=board(invalid==='cycle'?[edge('bc','b','c',{kind:'branch'}),edge('ca','c','a',{kind:'branch'})]:[edge('existing',invalid==='two parents'?'c':'a','b',{kind:'branch'})]);rejectsUnchanged(b,()=>planLocalRelationEdit(b,create(b,value({kind:'branch'})),'new'),invalid==='cycle'?/循环/:/父级/);
});

test('ordinary edges through unsupported nodes do not supply inferred branch parents or cycles',()=>{
 const b=board([edge('text-b','c','b'),edge('a-text','a','c')]);Object.assign(b.nodes[2],{kind:'text',file:undefined,text:'independent'});assert.equal(planLocalRelationEdit(b,create(b,value({from:'b',to:'a',kind:'branch'})),'new').changed,true);
});

test('group branch cycle validation uses the latest geometry even when the source stamp stays valid',()=>{
 const b=board();Object.assign(b.nodes[1],{kind:'section',title:'Group',file:undefined,width:500,height:300});const request=create(b,value({kind:'branch'}));assert.equal(planLocalRelationEdit(b,request,'new').changed,true);
 b.nodes[1].x=-20;b.nodes[1].y=-20;rejectsUnchanged(b,()=>planLocalRelationEdit(b,request,'new'),/包含关系不能形成循环/);
});

test('candidate validation catches a branch-group cycle through an external chain',()=>{
 const b=board([edge('bc','b','c',{kind:'branch'})]);Object.assign(b.nodes[2],{kind:'section',title:'Group',file:undefined,x:-20,y:-20,width:300,height:200});rejectsUnchanged(b,()=>planLocalRelationEdit(b,create(b,value({kind:'branch'})),'new'),/包含关系不能形成循环/);
});

test('an exact removal may repair an existing invalid branch without mutating other edges',()=>{
 const b=board([edge('ab','a','b',{kind:'branch'}),edge('ba','b','a',{kind:'branch'})]);const result=planLocalRelationEdit(b,remove(b,'ba'));assert.deepEqual(result.board.edges.map(e=>e.id),['ab']);assert.doesNotThrow(()=>parseBoard(JSON.stringify(result.board)));
});

test('legacy boards upgrade only when a relationship is created or changed',()=>{
 const b=board([edge('old','a','b')]);b.version=1;assert.equal(planLocalRelationEdit(b,update(b,'old',value({label:''}))).board.version,1);assert.equal(planLocalRelationEdit(b,update(b,'old')).board.version,3);assert.equal(planLocalRelationEdit(b,remove(b,'old')).board.version,1);
});

test('invalid value fields self links and oversized labels fail without altering the input',()=>{
 const b=board(),valid=create(b);for(const change of [{from:'a',to:'a'},{label:'x'.repeat(201)},{kind:'unknown'},{direction:'up'},{kind:'branch',direction:'both'},{kind:'branch',direction:'none'},{label:3},{from:null}]){const request={...valid,value:{...value(),...change}} as LocalRelationMutation;rejectsUnchanged(b,()=>planLocalRelationEdit(b,request,'new'));}
 assert.equal(planLocalRelationEdit(b,create(b,value({label:'字'.repeat(200)})),'new').board.edges[0].label.length,200);
});

test('new edge IDs are required and cannot collide with an existing node or edge',()=>{
 const b=board([edge('occupied','c','d')]),request=create(b);for(const id of [undefined,'',' ','a','occupied'])rejectsUnchanged(b,()=>planLocalRelationEdit(b,request,id),/标识/);
});

test('missing stale and malformed preconditions cannot bypass exact identity checks',()=>{
 const b=board([edge('old','a','b')]),request=update(b,'old');for(const expected of [undefined,{nodes:[]},{nodes:{}},{nodes:{a:request.expected.nodes.a}},{...request.expected,edge:undefined}])rejectsUnchanged(b,()=>planLocalRelationEdit(b,{...request,expected} as LocalRelationMutation));
 b.edges.push(edge('old','c','d'));rejectsUnchanged(b,()=>planLocalRelationEdit(b,request),/标识冲突/);
});

test('save failure exposes a typed committed marker without suggesting mutation replay',()=>{
 const error=new LocalRelationEditSaveError('保存失败');assert.ok(error instanceof Error);assert.equal(error.committed,true);assert.equal(error.name,'LocalRelationEditSaveError');assert.equal(error.message,'保存失败');
});
