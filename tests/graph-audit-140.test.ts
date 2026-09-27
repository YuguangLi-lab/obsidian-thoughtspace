import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,extractSubboard,parseBoard,type Board,type Card} from '../src/model';
import {layoutMindmap,branchState} from '../src/mindmap';
import {editTopic} from '../src/mindmap-editor';
import {mindmapPlan} from '../src/mindmap-studio';
import {parseTopicOutline} from '../src/mindmap-content';
import {branchMarkdown} from '../src/mindmap-flow';
import {moveSelection,alignSelection} from '../src/board-tools';
import {discloseBranches} from '../src/branch-disclosure';
import {unfoldRelationAncestors} from '../src/graph-navigation';
import {reconnectEdge} from '../src/connection-flow';
const node=(id:string,x=0,y=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width:160,height:80,color:'blue',...extra});
const board=(nodes:Card[],edges:Board['edges']=[]):Board=>({...emptyBoard(),version:3,nodes,edges});
const edge=(from:string,to:string):Board['edges'][number]=>({id:from+'-'+to,from,to,label:'',kind:'branch'});
const ids=()=>{let i=0;return()=>`new-${++i}`;};

test('G01 arranging another manual mind map does not change the first tree direction or density on edit',()=>{
 const original=board([node('r1'),node('c1'),node('r2',2000),node('c2',2200)],[edge('r1','c1'),edge('r2','c2')]);
 const first=mindmapPlan(original,'r1',{layout:'left',density:'compact',depth:'all',rainbow:false}).board;
 const second=mindmapPlan(first,'r2',{layout:'down',density:'relaxed',depth:'all',rainbow:false}).board;
 const result=editTopic(second,'r1','child',['extra'],ids()).board,root=result.nodes.find(n=>n.id==='r1')!,child=result.nodes.find(n=>n.id==='c1')!;
 assert.equal(root.mindmapRules?.layout,'left');assert.equal(root.mindmapRules?.density,'compact');assert.equal(root.mindmapRules?.automatic,false);
 assert.equal(child.x+child.width,root.x-64);assert.deepEqual(result.nodes.filter(n=>['r2','c2'].includes(n.id)),second.nodes.filter(n=>['r2','c2'].includes(n.id)));parseBoard(JSON.stringify(result));
});
test('G02 duplicating a branch keeps its internal evidence relations and does not copy outside links',()=>{
 const b=board([node('root'),node('a'),node('b'),node('outside')],[edge('root','a'),edge('a','b'),{id:'evidence',from:'a',to:'b',label:'supports',style:'elbow',direction:'both',dashed:true,color:'rose'},{id:'out',from:'b',to:'outside',label:'outside'}]);
 const before=clone(b),r=editTopic(b,'a','duplicate',[],ids()),copy=r.selected,leaf=r.board.edges.find(e=>e.kind==='branch'&&e.from===copy)!.to;
 const relation=r.board.edges.find(e=>e.kind!=='branch'&&e.from===copy&&e.to===leaf);assert.ok(relation);assert.deepEqual({...relation,id:'evidence',from:'a',to:'b'},b.edges[2]);assert.equal(r.board.edges.filter(e=>e.to==='outside').length,1);assert.deepEqual(b,before);parseBoard(JSON.stringify(r.board));
});
test('G03 extracted subboard preserves applicable board layout defaults',()=>{
 const b=board([node('root'),node('child',-300)],[edge('root','child')]);Object.assign(b,{mode:'mindmap',mindmapLayout:'left',mindmapDirection:'right',mindmapDensity:'compact',defaultEdgeStyle:'straight',snapToGrid:false});
 const before=clone(b),r=extractSubboard(b,new Set(['root','child']),'child.thoughtspace','Child','portal');
 for(const key of ['mode','mindmapLayout','mindmapDirection','mindmapDensity','defaultEdgeStyle','snapToGrid'] as const)assert.equal(r.child[key],b[key],key);
 layoutMindmap(r.child,'root');assert.ok(r.child.nodes[1].x<r.child.nodes[0].x);assert.deepEqual(b,before);parseBoard(JSON.stringify(r.child));
});
test('G04 PDF branch notes retain selected page including Markdown-reserved filename characters',()=>{
 for(const file of ['Materials/book.pdf','Materials/book #1.pdf']){
  const b=board([node('pdf',0,0,{kind:'pdf',file,pdfPage:17})]);const md=branchMarkdown(b,'pdf');assert.match(md,/#page=17/);assert.ok(!md.includes('book #1.pdf#page'), 'reserved path must be escaped separately from its page fragment');
 }
});
test('G05 Markdown thematic breaks stay in topic body instead of creating phantom children',()=>{
 const rows=parseTopicOutline('# Root\n- Evidence\n\n* * *\n\n- Conclusion');assert.deepEqual(rows.map(n=>[n.depth,n.text]),[[0,'Root'],[1,'Evidence\n\n* * *'],[1,'Conclusion']]);
 for(const separator of ['- - -','_ _ _'])assert.equal(parseTopicOutline('# Root\nbody\n'+separator+'\ncontinued').length,1);
});
test('G06 relation reveal opens enclosing folded groups and linked group ancestors',()=>{
 const b=board([node('parent',-500,0,{branchFolded:true}),node('frame',0,0,{kind:'section',title:'Frame',width:500,height:400,sectionFolded:true}),node('target',50,100),node('other',1000,0,{kind:'section',title:'Other',width:400,height:400,sectionFolded:true})],[edge('parent','frame')]);
 const before=clone(b);assert.ok(branchState(b).hidden.has('target'));assert.equal(unfoldRelationAncestors(b,new Set(['target'])),2);assert.ok(!branchState(b).hidden.has('target'));assert.deepEqual(b.nodes[3],before.nodes[3]);assert.deepEqual(b.edges,before.edges);
});
test('G07 expand all and next level preserve locked descendants fold state',()=>{
 for(const mode of ['all','level'] as const){const b=board([node('root',0,0,{branchFolded:mode==='level'}),node('locked',300,0,{locked:true,branchFolded:mode==='all'}),node('leaf',600)],[edge('root','locked'),edge('locked','leaf')]);
 const locked=clone(b.nodes[1]);discloseBranches(b,new Set(['root']),mode);assert.deepEqual(b.nodes[1],locked,mode);}
});
const nested=()=>board([node('outer',0,0,{kind:'section',title:'Outer',width:700,height:600}),node('inner',60,90,{kind:'section',title:'Inner',width:400,height:360}),node('inside',100,180),node('outside',1500,500)]);
test('G08 dragging an open outer group carries nested frame geometry as well as content',()=>{
 const b=nested(),before=clone(b);moveSelection(b,new Set(['outer']),140,90);for(let i=0;i<3;i++){assert.equal(b.nodes[i].x,before.nodes[i].x+140,b.nodes[i].id);assert.equal(b.nodes[i].y,before.nodes[i].y+90);}assert.deepEqual(b.nodes[3],before.nodes[3]);
});
test('G08 selecting outer plus inner frames aligns as one nested unit without duplicate movement',()=>{
 const b=nested(),before=clone(b);assert.doesNotThrow(()=>alignSelection(b,new Set(['outer','inner','outside']),'top'));for(let i=1;i<3;i++){assert.equal(b.nodes[i].x-b.nodes[0].x,before.nodes[i].x-before.nodes[0].x);assert.equal(b.nodes[i].y-b.nodes[0].y,before.nodes[i].y-before.nodes[0].y);}assert.equal(b.nodes[3].y,0);
});
test('G09 reconnecting a legacy board upgrades format before persisting explicit ports',()=>{
 const b:Board={...emptyBoard(),nodes:[node('a',0,0,{kind:'card',file:'a.md'}),node('b',400,0,{kind:'card',file:'b.md'}),node('c',800,0,{kind:'card',file:'c.md'})],edges:[{id:'e',from:'a',to:'b',label:'edge'}]};
 parseBoard(JSON.stringify(b));assert.equal(reconnectEdge(b,'e','to','c','top',JSON.stringify(b.edges[0])),true);assert.equal(b.version,3);assert.doesNotThrow(()=>parseBoard(JSON.stringify(b)));
});

test('G08 nested frame movement stays reversible and pinned folded contents stay fixed',()=>{
 const b=nested(),before=clone(b);moveSelection(b,new Set(['outer','inner']),90,70);moveSelection(b,new Set(['outer','inner']),-90,-70);assert.deepEqual(b,before);
 b.nodes[1].sectionFolded=true;b.nodes[2].locked=true;const pinned=clone(b.nodes.slice(1));moveSelection(b,new Set(['outer']),100,100);assert.deepEqual(b.nodes.slice(1),pinned);parseBoard(JSON.stringify(b));
});
test('G07 a locked descendant does not prevent independent unlocked branches from expanding',()=>{
 const b=board([node('root',0,0,{branchFolded:true}),node('locked',300,0,{locked:true,branchFolded:true}),node('leaf',600),node('free',300,400,{branchFolded:true}),node('free-leaf',600,400)],[edge('root','locked'),edge('locked','leaf'),edge('root','free'),edge('free','free-leaf')]);
 discloseBranches(b,new Set(['root']),'all');assert.deepEqual([...branchState(b).hidden],['leaf']);assert.equal(b.nodes[1].branchFolded,true);parseBoard(JSON.stringify(b));
});
