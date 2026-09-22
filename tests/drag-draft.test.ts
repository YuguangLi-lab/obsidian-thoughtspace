import {test} from 'node:test';import assert from 'node:assert/strict';
import {dragStartSnapshot,dragDisplayBoard,dragCommitChanges} from '../src/drag-draft';import {emptyBoard,Card,History,clone} from '../src/model';
const node=(id:string,x=0):Card=>({id,kind:'text',text:id,x,y:0,width:100,height:80,color:'green',autoSize:false});
function setup(){const b=emptyBoard();b.nodes=[node('a'),node('b',300)];const originals=new Map(b.nodes.map(n=>[n.id,{...n}])),drafts=new Map([['a',{...b.nodes[0],x:40,y:30}]]);return{b,originals,drafts};}
test('drag preview cannot leak temporary geometry into serialized board',()=>{const {b,drafts}=setup(),before=JSON.stringify(b),display=dragDisplayBoard(b,drafts);assert.equal(display.nodes[0].x,40);assert.equal(JSON.stringify(b),before);assert.equal(display.nodes[1],b.nodes[1]);});
test('display combines shared note changes with draft geometry',()=>{const {b,drafts}=setup();b.nodes[0].text='New content';b.nodes[0].color='blue';b.nodes[1].text='New B';const display=dragDisplayBoard(b,drafts);assert.equal(display.nodes[0].text,'New content');assert.equal(display.nodes[0].color,'blue');assert.equal(display.nodes[0].x,40);assert.equal(display.nodes[1].text,'New B');});
test('committing geometry preserves other edits and independent undo ordering',()=>{const {b,originals,drafts}=setup(),history=new History();history.push(b);b.nodes[1].text='Changed B';const changes=dragCommitChanges(b,originals,drafts);history.push(b);for(const n of b.nodes)Object.assign(n,changes.get(n.id));assert.equal(b.nodes[0].x,40);const undoDrag=history.undo(b)!;assert.equal(undoDrag.nodes[0].x,0);assert.equal(undoDrag.nodes[1].text,'Changed B');const undoText=history.undo(undoDrag)!;assert.equal(undoText.nodes[0].x,0);assert.equal(undoText.nodes[1].text,'b');});
test('external target move, resize, lock, conversion or removal prevents commit atomically',()=>{for(const change of [(b:any)=>b.nodes[0].x=9,(b:any)=>b.nodes[0].height=90,(b:any)=>b.nodes[0].locked=true,(b:any)=>b.nodes[0].kind='image',(b:any)=>b.nodes.shift()]){const {b,originals,drafts}=setup();change(b);const before=clone(b);assert.throws(()=>dragCommitChanges(b,originals,drafts));assert.deepEqual(b,before);}});
test('resize drafts isolate auto-fit flags and do not overwrite content',()=>{const {b,originals}=setup();b.nodes[0].text='Live';const drafts=new Map([['a',{...b.nodes[0],width:240,height:160,autoSize:false}]]);const display=dragDisplayBoard(b,drafts,true);assert.equal(display.nodes[0].width,240);assert.equal(b.nodes[0].width,100);const patch=dragCommitChanges(b,originals,drafts,true).get('a')!;assert.equal(patch.width,240);assert.equal(patch.text,undefined);assert.equal(patch.x,undefined);});
test('returning to original geometry produces no commit',()=>{const {b,originals}=setup();assert.equal(dragCommitChanges(b,originals,new Map([['a',{...b.nodes[0]}]])).size,0);assert.equal(dragDisplayBoard(b,new Map()),b);});

test('gesture snapshot isolates live geometry, content, branch state and viewport',()=>{
 const b=emptyBoard();b.nodes=[node('a'),node('b',300)];b.nodes[0].branchFolded=true;b.edges=[{id:'e',from:'a',to:'b',label:'Evidence',kind:'branch'}];b.mode='mindmap';b.mindmapDirection='down';
 const saved=dragStartSnapshot(b);b.nodes[0].text='Changed';b.nodes[0].x=25;b.nodes[0].branchFolded=false;b.edges[0].to='a';b.viewport.x=90;
 assert.equal(saved.nodes[0].text,'a');assert.equal(saved.nodes[0].x,0);assert.equal(saved.nodes[0].branchFolded,true);assert.equal(saved.edges[0].to,'b');assert.equal(saved.viewport.x,60);assert.equal(saved.mode,'mindmap');assert.equal(saved.mindmapDirection,'down');
});
test('gesture snapshot keeps all content without serializing unrelated board metadata',()=>{
 const b=emptyBoard();b.nodes=[{...node('a'),text:'Long note '.repeat(10000)}];b.selectionSets=[{id:'s',name:'Saved',ids:['a']}];
 Object.defineProperty(b,'toJSON',{value:()=>{throw Error('Gesture must not serialize the board');}});
 const saved=dragStartSnapshot(b);assert.equal(saved.nodes[0].text,b.nodes[0].text);assert.notEqual(saved.nodes[0],b.nodes[0]);assert.equal(saved.selectionSets,undefined);saved.nodes[0].x=500;assert.equal(b.nodes[0].x,0);
});
