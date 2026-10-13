import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandwritingBoard} from '../src/handwriting-board';
import {HandwritingHistory} from '../src/handwriting-history';
import {InkPathCache} from '../src/ink-path-cache';
import {strokePath,type InkStroke} from '../src/ink-model';
import {History,type Board} from '../src/model';
import {applyInkEdit} from '../src/handwriting-ink-edit';

const pen=(id:string,x=10):InkStroke=>({id,color:'#202020',width:3,points:[[x,20,.3333333333333333],[x+10,30,.9999999999999999]]});
function longBoard(){const board=createHandwritingBoard();board.ink.strokes=Array.from({length:8},(_,s)=>({id:`large-${s}`,color:'#202020',width:3,points:Array.from({length:8190},(_,i)=>[s*300+i,Math.sin(i/12)*80,.5+(i%5)/10])}));return board;}
function edit(board:Board,strokes:InkStroke[]):Board{return{...board,ink:{...board.ink!,strokes}};}
const saved=(board:Board)=>JSON.stringify(board);

test('shared long ink fits 80 edits under 8 MiB and generic snapshots keep only two',()=>{
 let board=longBoard(),old=longBoard();const history=new HandwritingHistory(),generic=new History(),initial=saved(board);
 for(let i=0;i<80;i++){
  history.push(board);generic.push(old);
  const strokes=i%2?board.ink.strokes.slice(0,-1):[...board.ink.strokes,pen('small',i)];
  board=edit(board,strokes) as typeof board;old=JSON.parse(saved(board));
  assert(history.bytes<=history.maxBytes);assert(history.retainedSamples<=65520+80);
 }
 assert.equal(history.undoStack.length,80);assert.equal(generic.undoStack.length,2);
 for(let i=0;i<80;i++){const previous=history.undo(board);assert(previous);board=previous as typeof board;assert(history.bytes<=history.maxBytes);}
 assert.equal(saved(board),initial);assert.equal(history.redoStack.length,80);
 for(let i=0;i<80;i++){const next=history.redo(board);assert(next);board=next as typeof board;assert(history.bytes<=history.maxBytes);}
 assert.equal(saved(board),initial);assert.equal(history.undoStack.length,80);
});

test('append undo redo retain all unchanged stroke identities and paths',()=>{
 const before=createHandwritingBoard();before.ink.strokes=[pen('a'),pen('b')];const original=[...before.ink.strokes],history=new HandwritingHistory(),cache=new InkPathCache();
 const paths=original.map(stroke=>cache.get(stroke));history.push(before);const current=edit(before,[...original,pen('c')]);
 const undo=history.undo(current)!;assert.deepEqual(undo,before);assert(original.every((stroke,i)=>undo.ink!.strokes[i]===stroke));
 assert.deepEqual(undo.ink!.strokes.map(stroke=>cache.get(stroke)),paths);assert.equal(cache.encodings,2);assert.equal(cache.hits,2);
 const redo=history.redo(undo)!;assert.deepEqual(redo,current);assert(original.every((stroke,i)=>redo.ink!.strokes[i]===stroke));
 assert.deepEqual(redo.ink!.strokes.slice(0,2).map(stroke=>cache.get(stroke)),paths);assert.equal(cache.encodings,2);
});

test('remove and translate restore exact samples, ordering and unknown metadata',()=>{
 const initial=createHandwritingBoard();initial.ink.strokes=[pen('a'),pen('b'),pen('c')];
 Object.assign(initial,{futureField:{mixed:[1,'文本',{yes:true}]},background:{color:'#eeeeee'}});Object.assign(initial.ink,{futureInk:{revision:4}});Object.assign(initial.ink.strokes[1],{futureStroke:{pressure:'keep'}});
 const history=new HandwritingHistory();history.push(initial);const removed=edit(initial,[initial.ink.strokes[0],initial.ink.strokes[2]]);
 history.push(removed);const translated=edit(removed,[removed.ink!.strokes[0],{...removed.ink!.strokes[1],points:removed.ink!.strokes[1].points.map(([x,y,p])=>[x+.125,y-100,p])}]);
 const first=history.undo(translated)!;assert.deepEqual(first,removed);assert.equal(first.ink!.strokes[0],initial.ink.strokes[0]);
 const second=history.undo(first)!;assert.deepEqual(second,initial);assert.equal(second.ink!.strokes[0],initial.ink.strokes[0]);
 assert(Object.isFrozen(second.ink!.strokes[1]));assert(Object.isFrozen(second.ink!.strokes[1].points[0]));
 const redo1=history.redo(second)!;assert.deepEqual(redo1,removed);const redo2=history.redo(redo1)!;assert.deepEqual(redo2,translated);
 assert.equal(JSON.stringify(redo2.ink!.strokes[1].points),JSON.stringify(translated.ink!.strokes[1].points));
});

test('mutable foreign inputs cannot rewrite older history snapshots',()=>{
 const board=createHandwritingBoard();board.ink.strokes=[pen('same')];const old=saved(board),history=new HandwritingHistory();history.push(board);
 board.ink.strokes[0].points[0][0]=500;board.ink.strokes[0].width=8;history.push(board);
 board.ink.strokes[0].points[0][1]=-100;board.nodes.push({id:'n',kind:'text',text:'later',color:'sand',x:1,y:2,width:100,height:100});
 const previous=history.undo(board)!;assert.equal(previous.ink!.strokes[0].points[0][0],500);assert.equal(previous.ink!.strokes[0].points[0][1],20);assert.equal(previous.ink!.strokes[0].width,8);assert.equal(previous.nodes.length,0);
 const original=history.undo(previous)!;assert.equal(saved(original),old);assert.equal(original.ink!.strokes[0].width,3);
});

test('generic board operations fall back safely; oversized snapshots are excluded',()=>{
 const original=createHandwritingBoard();original.nodes.push({id:'n',kind:'text',text:'one',color:'sand',x:1,y:2,width:100,height:100});
 const h=new HandwritingHistory();h.push(original);const current={...original,presentation:undefined,ink:undefined,nodes:original.nodes.map(node=>({...node,text:'two'}))};
 const restored=h.undo(current)!;assert.deepEqual(restored,original);assert.deepEqual(h.redo(restored),JSON.parse(saved(current)));
 const tiny=new HandwritingHistory(256);tiny.push(original);assert.equal(tiny.undoStack.length,0);assert.equal(tiny.bytes,0);assert.equal(tiny.retainedSamples,0);
});

test('redo branch clearing and public stack removal release retained storage',()=>{
 const board=createHandwritingBoard(),h=new HandwritingHistory();h.push(board);const first=edit(board,[pen('a')]);h.push(first);const second=edit(first,[pen('a'),pen('b')]);
 const undo=h.undo(second)!;assert.equal(h.redoStack.length,1);h.push(undo);assert.equal(h.redoStack.length,0);
 h.undoStack.splice(0);assert.equal(h.bytes,0);assert.equal(h.retainedSamples,0);assert.equal(h.retainedStrokes,0);assert.equal(h.undo(second),undefined);
});

test('path cache never confuses identical IDs, point edits, pressure or width',()=>{
 const cache=new InkPathCache(),stroke=pen('same'),first=cache.get(stroke);assert.equal(cache.get(stroke),first);assert.equal(cache.encodings,1);
 for(const mutate of [()=>stroke.points[0][0]+=.125,()=>stroke.points[0][2]=.8,()=>stroke.width=7,()=>stroke.points.push([99,80,.9])]){
  mutate();assert.equal(cache.get(stroke),strokePath(stroke));
 }
 const foreign=pen('same',200);assert.equal(cache.get(foreign),strokePath(foreign));assert.notEqual(cache.get(foreign),first);assert.equal(cache.encodings,6);
});

test('cache obeys independent byte budget and regenerates evicted paths correctly',()=>{
 const cache=new InkPathCache(1500),a=pen('a'),b=pen('b');cache.get(a);cache.get(b);assert(cache.bytes<=cache.maxBytes);
 assert.equal(cache.get(a),strokePath(a));assert(cache.bytes<=cache.maxBytes);cache.clear();assert.equal(cache.bytes,0);
 const zero=new InkPathCache(0);assert.equal(zero.get(a),strokePath(a));assert.equal(zero.bytes,0);assert.equal(zero.get(a),strokePath(a));assert.equal(zero.encodings,2);
});

test('zero edits preserve redo; append input ownership and duplicate history remain independent',()=>{
 const initial=createHandwritingBoard();initial.ink.strokes=[pen('a')];const h=new HandwritingHistory();h.push(initial);
 const foreign=pen('b'),appended={...initial,ink:applyInkEdit(initial.ink,{kind:'append',stroke:foreign})};foreign.points[0][0]=900;
 assert.equal(appended.ink.strokes[1].points[0][0],10);
 const restored=h.undo(appended)!;const token=h.redoStack.at(-1),zero=applyInkEdit(restored.ink!,{kind:'translate',ids:['a'],dx:0,dy:0});
 assert.equal(zero,restored.ink);assert.equal(h.redoStack.at(-1),token);
 const current=h.redo(restored)!;h.push(current);const duplicate={...current,ink:applyInkEdit(current.ink!,{kind:'duplicate',ids:['a'],dx:5,dy:-3,newIds:['copy']})};
 assert.equal(duplicate.ink.strokes[2].id,'copy');assert.notEqual(duplicate.ink.strokes[2].points,current.ink!.strokes[0].points);
 const prior=h.undo(duplicate)!;assert.deepEqual(prior,current);assert.deepEqual(h.redo(prior),duplicate);
});

test('changing long samples trims old versions while the nearest undo and redo stay exact',()=>{
 let board=longBoard();const h=new HandwritingHistory(),states:string[]=[saved(board)];
 for(let i=0;i<12;i++){
  h.push(board);board={...board,ink:applyInkEdit(board.ink,{kind:'translate',ids:['large-0'],dx:.125,dy:-.25})};states.push(saved(board));
  assert(h.bytes<=h.maxBytes);assert(h.bytes>=h.retainedSamples*96);
 }
 assert(h.undoStack.length>1);assert(h.undoStack.length<12);
 const previous=h.undo(board)!;assert.equal(saved(previous),states.at(-2));assert(h.bytes<=h.maxBytes);
 const redone=h.redo(previous)!;assert.equal(saved(redone),states.at(-1));assert(h.bytes<=h.maxBytes);
});

test('shallow freezing does not falsely trust mutable sample tuples',()=>{
 const stroke=pen('mutable-child');Object.freeze(stroke);Object.freeze(stroke.points);
 const cache=new InkPathCache(),before=cache.get(stroke);stroke.points[0][0]=500;
 assert.notEqual(cache.get(stroke),before);assert.equal(cache.get(stroke),strokePath(stroke));assert.equal(cache.encodings,2);
});
