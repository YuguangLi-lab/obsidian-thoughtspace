import test from 'node:test';import assert from 'node:assert/strict';
import {Board,Card,clone,emptyBoard,parseBoard} from '../src/model';
import {reuseBundle,reusePlan,reuseStamp,rebaseReuseSources} from '../src/board-reuse';
import {createBoardMindmapState} from '../src/board-mindmap';
const node=(id:string,x=0,kind:Card['kind']='text'):Card=>({id,kind,text:id,x,y:60,width:180,height:100,color:'green',autoSize:false});
const fixture=():Board=>({...emptyBoard(),version:3,nodes:[{...node('s',0,'section'),title:'证据组',y:0,width:700,height:500},node('a',40),{...node('b',300,'card'),file:'Notes/共享.md',transparent:true},node('c',900)],edges:[{id:'ab',from:'a',to:'b',label:'支持',style:'elbow',direction:'both',color:'blue',dashed:true},{id:'bc',from:'b',to:'c',label:'外部',kind:'branch'}]});
const options={branches:false,placement:'right' as const,frame:''};let id=0;const uid=()=>`fresh-${++id}`;
test('Reuse groups includes members and retains internal edges, leaving cross-selection edges behind',()=>{const b=fixture(),before=clone(b),bundle=reuseBundle(b,new Set(['s']),false);assert.deepEqual(bundle.nodes.map(n=>n.id),['s','a','b']);assert.equal(bundle.edges.length,1);assert.equal(bundle.externalEdges,1);assert.deepEqual(b,before);});
test('Include branches adds descendants, including folded content when unchecked',()=>{const b=fixture();assert.equal(reuseBundle(b,new Set(['s']),true).nodes.length,4);b.nodes[2].branchFolded=true;assert.equal(reuseBundle(b,new Set(['s']),false).nodes.length,4);});
test('Dangling or empty selections fail without mutation',()=>{assert.throws(()=>reuseBundle(fixture(),new Set()));assert.throws(()=>reuseBundle(fixture(),new Set(['missing'])));});
test('Spatial reuse keeps relative positions, styles, independent ids and shared note path',()=>{const b=fixture(),bundle=reuseBundle(b,new Set(['a','b']),false),target=fixture(),before=clone(target),plan=reusePlan(bundle,target,options,uid);assert.equal(plan.nodes[1].x-plan.nodes[0].x,260);assert.ok(plan.nodes.every(n=>n.x>1080));assert.equal(plan.nodes[1].file,'Notes/共享.md');assert.equal(plan.nodes[1].transparent,true);assert.equal(plan.reusedNotes,1);assert.equal(plan.edges[0].from,plan.nodes[0].id);assert.equal(plan.edges[0].to,plan.nodes[1].id);assert.equal(plan.edges[0].label,'支持');assert.equal(plan.edges[0].dashed,true);assert.equal(plan.edges[0].direction,'both');assert.deepEqual(target,before);assert.doesNotThrow(()=>parseBoard(JSON.stringify({...target,nodes:[...target.nodes,...plan.nodes],edges:[...target.edges,...plan.edges]})));});
test('Below placement and named frame never overlap existing bounds',()=>{const bundle=reuseBundle(fixture(),new Set(['a','b']),false),target=fixture(),plan=reusePlan(bundle,target,{...options,placement:'below',frame:'研究材料'},uid);assert.equal(plan.nodes[0].kind,'section');assert.equal(plan.nodes[0].title,'研究材料');assert.ok(plan.nodes[0].y>=596);assert.ok(plan.nodes[1].y>plan.nodes[0].y);assert.ok(plan.nodes[2].x+plan.nodes[2].width<plan.nodes[0].x+plan.nodes[0].width);});
test('Empty target starts in predictable positive space and preserves locked object state',()=>{const b=fixture();b.nodes[1].locked=true;const plan=reusePlan(reuseBundle(b,new Set(['a']),false),emptyBoard(),options,uid);assert.equal(plan.nodes[0].x,60);assert.equal(plan.nodes[0].y,60);assert.equal(plan.nodes[0].locked,true);});
test('ID collisions and invalid frame lengths fail explicitly',()=>{const b=fixture(),bundle=reuseBundle(b,new Set(['a']),false);assert.throws(()=>reusePlan(bundle,b,options,()=> 'a'));assert.throws(()=>reusePlan(bundle,b,{...options,frame:'a'.repeat(101)},uid));});
test('Stamps ignore camera movement but detect content and geometry changes',()=>{const b=fixture(),stamp=reuseStamp(b);b.viewport.zoom=.5;assert.equal(reuseStamp(b),stamp);b.nodes[1].text='changed';assert.notEqual(reuseStamp(b),stamp);});
test('Rebase excerpt source links only, preserving code literals and CRLF',()=>{const citation='> 来源：[[材料.pdf#page=2]] · PDF 第 2 页',text='正文\r\n'+citation+'\r\n\r\n```md\r\n'+citation+'\r\n```\r\n';const result=rebaseReuseSources(text,()=> '[[资料/材料.pdf#page=2]]');assert.ok(result.includes('> 来源：[[资料/材料.pdf#page=2]]'));assert.ok(result.includes('```md\r\n'+citation));assert.equal(result.split('\r\n').length,text.split('\r\n').length);});
test('Rebase ignores frontmatter and hidden comments',()=>{const line='来源：[[source.md]] · 第 1–2 行',text='---\n'+line+'\n---\n%%\n'+line+'\n%%\n'+line;let count=0;const result=rebaseReuseSources(text,()=>{count++;return '[[full/source.md]]';});assert.equal(count,1);assert.ok(result.endsWith('来源：[[full/source.md]] · 第 1–2 行'));});
test('Large selection remains complete and immutable',()=>{const b:Board={...emptyBoard(),version:3,nodes:Array.from({length:1200},(_,i)=>node('n'+i,i*200)),edges:[]};const bundle=reuseBundle(b,new Set(b.nodes.map(n=>n.id)));const plan=reusePlan(bundle,emptyBoard(),options,uid);assert.equal(plan.nodes.length,1200);assert.equal(new Set(plan.nodes.map(n=>n.id)).size,1200);plan.nodes[0].text='copy';assert.equal(b.nodes[0].text,'n0');assert.equal(bundle.nodes[0].text,'n0');});

const graph=(id:string,centerId:string):Card=>({...node(id,1000,'mindmap'),title:'板内脑图',text:undefined,mindmap:createBoardMindmapState(centerId)});
test('copying a mindmap alone never pulls its referenced cards into a reuse bundle',()=>{
 const b=fixture();b.nodes.push(graph('graph','b'));const before=structuredClone(b),bundle=reuseBundle(b,new Set(['graph']),false);
 assert.deepEqual(bundle.nodes.map(n=>n.id),['graph']);assert.equal(bundle.edges.length,0);assert.deepEqual(b,before);
});
test('cross-board reuse detaches an external center even when destination has the same node ID',()=>{
 const source=fixture();source.nodes.push(graph('graph','b'));const target=fixture(),before=clone(target),bundle=reuseBundle(source,new Set(['graph']),false),plan=reusePlan(bundle,target,options,uid),state=plan.nodes[0].mindmap!;
 assert.match(state.centerId!,/^missing:/);assert.notEqual(state.centerId,'b');assert.equal(target.nodes.some(n=>n.id===state.centerId),false);assert.equal(plan.nodes.some(n=>n.id===state.centerId),false);
 assert.deepEqual(state.history,{entries:[state.centerId],index:0});assert.equal(bundle.nodes[0].mindmap!.centerId,'b');assert.deepEqual(target,before);
 const reopened=parseBoard(JSON.stringify({...target,nodes:[...target.nodes,...plan.nodes]}));assert.deepEqual(reopened.nodes.at(-1)!.mindmap,state);
});
test('reused mindmaps follow copied targets and detach only targets outside the same bundle',()=>{
 const source=fixture(),g=graph('graph','b');g.mindmap={version:1,centerId:'b',expandedIds:['b','c'],pins:['c','b'],history:{entries:['c','b'],index:1}};source.nodes.push(g);
 const bundle=reuseBundle(source,new Set(['graph','b']),false),before=clone(bundle),plan=reusePlan(bundle,fixture(),options,uid),note=plan.nodes.find(n=>n.kind==='card')!,state=plan.nodes.find(n=>n.kind==='mindmap')!.mindmap!,missing=state.expandedIds[1];
 assert.equal(state.centerId,note.id);assert.deepEqual(state.expandedIds,[note.id,missing]);assert.match(missing,/^missing:/);assert.deepEqual(state.pins,[missing,note.id]);assert.deepEqual(state.history,{entries:[missing,note.id],index:1});assert.equal(note.file,'Notes/共享.md');assert.deepEqual(bundle,before);
});
test('multiple reused containers share the same detached identity for the same external target',()=>{
 const source=fixture();source.nodes.push(graph('g1','b'),graph('g2','b'));source.nodes.at(-1)!.mindmap!.pins=['b','c'];const plan=reusePlan(reuseBundle(source,new Set(['g1','g2']),false),fixture(),options,uid),[first,second]=plan.nodes;
 assert.equal(first.mindmap!.centerId,second.mindmap!.centerId);assert.equal(second.mindmap!.pins[0],first.mindmap!.centerId);assert.notEqual(second.mindmap!.pins[1],first.mindmap!.centerId);
 first.mindmap!.history.entries[0]='changed';assert.notEqual(second.mindmap!.history.entries[0],'changed');
});
test('missing mindmap references stay unavailable through repeated cross-board reuse',()=>{
 const source=fixture();source.nodes.push(graph('graph','b'));const first=reusePlan(reuseBundle(source,new Set(['graph']),false),fixture(),options,uid),nextTarget=fixture();nextTarget.nodes.push({...node(first.nodes[0].mindmap!.centerId!,0,'card'),file:'Notes/Other.md'});
 const second=reusePlan({nodes:first.nodes,edges:[],externalEdges:0},nextTarget,options,uid),center=second.nodes[0].mindmap!.centerId;
 assert.notEqual(center,first.nodes[0].mindmap!.centerId);assert.equal(nextTarget.nodes.some(n=>n.id===center),false);
});
test('unavailable mindmap IDs reject collisions and oversize values without mutating source or target',()=>{
 for(const oversized of [false,true]){const source=fixture();source.nodes.push(graph('graph','b'));const target=fixture();target.nodes.push(node('missing:reserved'));const bundle=reuseBundle(source,new Set(['graph']),false),before=structuredClone({source,target,bundle});let index=0;
  assert.throws(()=>reusePlan(bundle,target,options,()=>++index===1?'copied-graph':oversized?'x'.repeat(250):'reserved'),/脑图引用标识/);assert.deepEqual({source,target,bundle},before);
 }
});
test('detached mindmap references cannot legitimize a malformed edge with an absent endpoint',()=>{
 const bundle={nodes:[graph('graph','external')],edges:[{id:'bad',from:'graph',to:'external',label:''}],externalEdges:0};
 assert.throws(()=>reusePlan(bundle,emptyBoard(),options,uid),/失效对象/);
});
