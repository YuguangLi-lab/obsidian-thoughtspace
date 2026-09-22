import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Board,Card,History,clone,emptyBoard,parseBoard} from '../src/model';
import {geometry,mergeTexts,splitParagraphs,studioDraft} from '../src/board-studio';
import {writingOrder} from '../src/writing';

const node=(id:string,x=0,y=0):Card=>({id,kind:'text',text:id,x,y,width:200,height:100,color:'sand'});
const textBoard=(text:string):Board=>({...emptyBoard(),version:3,nodes:[{...node('text'),text}],edges:[]});
const foldedBoard=():Board=>({...emptyBoard(),version:3,nodes:[
 {...node('root'),branchFolded:true,topic:true},
 {...node('child',300,80),topic:true},
 {...node('grandchild',600,160),topic:true},
 node('outside',900,400)
],edges:[{id:'rc',from:'root',to:'child',kind:'branch',label:''},{id:'cg',from:'child',to:'grandchild',kind:'branch',label:''}]});

test('splitting text preserves indentation and trailing spaces that carry Markdown meaning',()=>{
 const b=textBoard('Introduction  \n\n    const first = 1;\n    const second = 2;  \n\nAfter  ');
 const ids=splitParagraphs(b,new Set(['text']));
 assert.deepEqual(ids.map(id=>b.nodes.find(n=>n.id===id)!.text),[
  'Introduction  ','    const first = 1;\n    const second = 2;  ','After  '
 ]);
 parseBoard(JSON.stringify(b));
});

test('splitting keeps whitespace within fenced code while ignoring empty separator paragraphs',()=>{
 const b=textBoard('\n\nBefore\n\n```text\n  literal\n\n```\n\n\nAfter\n\n');
 const ids=splitParagraphs(b,new Set(['text']));
 assert.deepEqual(ids.map(id=>b.nodes.find(n=>n.id===id)!.text),['Before','```text\n  literal\n\n```','After']);
});

test('exact geometry moves the complete folded tree and undo restores all branch positions',()=>{
 const b=foldedBoard(),before=clone(b),h=new History();
 h.push(b);
 geometry(b,'root',{x:120,y:-40,width:240,height:140});
 for(const id of ['root','child','grandchild']){
  const old=before.nodes.find(n=>n.id===id)!,next=b.nodes.find(n=>n.id===id)!;
  assert.equal(next.x-old.x,120);
  assert.equal(next.y-old.y,-40);
 }
 assert.equal(b.nodes[0].autoSize,false);
 assert.deepEqual(b.nodes.at(-1),before.nodes.at(-1));
 assert.deepEqual(b.edges,before.edges);
 parseBoard(JSON.stringify(b));
 assert.deepEqual(h.undo(b),before);
});

test('exact geometry cannot bypass a locked hidden descendant and changes nothing on rejection',()=>{
 const b=foldedBoard();b.nodes[2].locked=true;const before=clone(b);
 assert.throws(()=>geometry(b,'root',{x:100,y:100,width:300,height:200}),/锁定/);
 assert.deepEqual(b,before);
});

test('a geometry dialog opened before its ancestor folds cannot edit the now hidden child',()=>{
 const b=foldedBoard(),before=clone(b);
 assert.throws(()=>geometry(b,'child',{x:100,y:100,width:300,height:200}),/折叠/);
 assert.deepEqual(b,before);
});

test('exact geometry on an expanded root leaves visible child positions unchanged',()=>{
 const b=foldedBoard();delete b.nodes[0].branchFolded;const others=clone(b.nodes.slice(1));
 geometry(b,'root',{x:100,y:100,width:300,height:200});
 assert.deepEqual(b.nodes.slice(1),others);
});

test('split preserves original input until the validated draft is committed and undoes atomically',()=>{
 const b=textBoard('    first\n\nsecond  '),before=clone(b),h=new History();
 const draft=studioDraft(b,d=>{splitParagraphs(d,new Set(['text']));})!;
 assert.deepEqual(b,before);assert.equal(draft.nodes.length,2);
 h.push(b);assert.deepEqual(h.undo(draft),before);
});

const writingBoard=():Board=>({...emptyBoard(),version:3,nodes:[node('a'),node('b',300),node('c',600),node('outside',900)],edges:[],writing:{
 title:'Article',order:['outside','b','c','a'],referenceId:'b',referenceIds:['outside','b','c'],
 options:{outside:{title:'Untouched',note:'Keep this annotation'},b:{title:'First in article',note:'Evidence B',level:3},c:{title:'Later item',note:'Evidence C'}}
}});

test('merging texts redirects writing order and pinned references to the reading-order survivor',()=>{
 const b=writingBoard(),outside=clone(b.writing!.options!.outside);
 const id=mergeTexts(b,new Set(['c','b','a']));
 assert.equal(id,'a');
 assert.deepEqual(b.writing!.order,['outside','a']);
 assert.deepEqual(writingOrder(b),['outside','a']);
 assert.equal(b.writing!.referenceId,'a');
 assert.deepEqual(b.writing!.referenceIds,['outside','a']);
 assert.deepEqual(b.writing!.options!.a,{title:'First in article',note:'Evidence B',level:3});
 assert.deepEqual(b.writing!.options!.outside,outside);
 assert.equal(b.writing!.options!.b,undefined);
 assert.equal(b.writing!.options!.c,undefined);
 parseBoard(JSON.stringify(b));
});

test('merging retains the survivor writing options even if another object appears earlier in the article',()=>{
 const b=writingBoard(),chosen={title:'Explicit A',note:'Keep A',excluded:true};b.writing!.options!.a=clone(chosen);
 mergeTexts(b,new Set(['a','b']));
 assert.deepEqual(b.writing!.options!.a,chosen);
 assert.deepEqual(b.writing!.options!.c,{title:'Later item',note:'Evidence C'});
 assert.deepEqual(b.writing!.order,['outside','a','c']);
});

test('merge leaves unrelated writing fields and reference order unchanged and undoes in one step',()=>{
 const b=writingBoard();b.writing!.referenceIds=['b','outside','a'];b.writing!.manuscript='Existing manuscript';
 b.writing!.draftPath='Draft.md';b.writing!.chapters=[{id:'chapter',title:'Chapter',body:'Keep chapter'}];b.writing!.order.unshift('chapter');
 const before=clone(b),h=new History();h.push(b);mergeTexts(b,new Set(['a','b']));
 assert.deepEqual(b.writing!.referenceIds,['a','outside']);
 assert.equal(b.writing!.manuscript,before.writing!.manuscript);
 assert.equal(b.writing!.draftPath,before.writing!.draftPath);
 assert.deepEqual(b.writing!.chapters,before.writing!.chapters);
 assert.deepEqual(b.writing!.order,['chapter','outside','a','c']);
 assert.deepEqual(h.undo(b),before);
});

test('split expands a writing item at its original article position without pinning its new paragraphs',()=>{
 const b=writingBoard();b.nodes[1].text='First\n\nSecond\n\nThird';const before=clone(b.writing!);
 const ids=splitParagraphs(b,new Set(['b']));
 assert.deepEqual(b.writing!.order,['outside',...ids,'c','a']);
 assert.deepEqual(writingOrder(b),b.writing!.order);
 assert.equal(b.writing!.referenceId,before.referenceId);
 assert.deepEqual(b.writing!.referenceIds,before.referenceIds);
 assert.deepEqual(b.writing!.options,before.options);
 parseBoard(JSON.stringify(b));
});

test('split and merge do not add objects that were not part of the writing outline',()=>{
 const b=writingBoard();b.writing!.order=['outside'];b.writing!.referenceId='outside';b.writing!.referenceIds=['outside'];
 b.nodes[1].text='First\n\nSecond';splitParagraphs(b,new Set(['b']));
 mergeTexts(b,new Set(['a','c']));
 assert.deepEqual(b.writing!.order,['outside']);
 assert.equal(b.writing!.referenceId,'outside');
 assert.deepEqual(b.writing!.referenceIds,['outside']);
});
