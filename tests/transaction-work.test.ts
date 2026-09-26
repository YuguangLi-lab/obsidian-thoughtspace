import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';

const source=readFileSync('src/model.ts','utf8');let indexed=0,sets=0;
class CountedSet<T> extends Set<T>{constructor(values?:Iterable<T>|null){super(values);sets++;indexed+=this.size;}}
const inherit=new Function('Set',transformSync(source.slice(source.indexOf('export function inheritNewEdgeStyle')).replace('export function','function')+';return inheritNewEdgeStyle',{loader:'ts'}).code)(CountedSet) as typeof model.inheritNewEdgeStyle;
function board(){const b=model.emptyBoard();b.version=3;b.defaultEdgeStyle='straight';b.nodes=[{id:'a',kind:'text',text:'Keep',x:0,y:0,width:200,height:120,color:'sand'},{id:'b',kind:'text',text:'Keep',x:400,y:0,width:200,height:120,color:'blue'}];b.edges=Array.from({length:1200},(_,i)=>({id:'e'+i,from:'a',to:'b',label:'Relation '+i,style:'straight'}));return b;}

test('ordinary edits do not rebuild an unchanged edge identity index',()=>{
 const b=board(),before=model.clone(b);sets=indexed=0;
 for(let i=0;i<120;i++){b.nodes[0].text=String(i);b.edges[0].style=i%2?'elbow':'curve';inherit(b,before);}
 assert.equal(sets,0);assert.equal(indexed,0);assert.equal(b.edges[0].style,'elbow');
});
test('edge defaults apply only to new ids after insert, reorder, removal and mixed styles',()=>{
 const b=board(),before=model.clone(b);b.edges=[b.edges[100],{id:'new',from:'b',to:'a',label:'',style:'curve'},...b.edges.slice(0,3).reverse()];b.edges[0].style='elbow';inherit(b,before);assert.equal(b.edges[0].style,'elbow');assert.equal(b.edges[1].style,'straight');
 const current=model.clone(b);b.defaultEdgeStyle='curve';b.edges[1].style='elbow';inherit(b,current);assert.equal(b.edges[1].style,'elbow');
 delete b.defaultEdgeStyle;b.edges.push({id:'other',from:'a',to:'b',label:'',style:'elbow'});inherit(b,current);assert.equal(b.edges.at(-1)!.style,'elbow');
});
test('history trimming measures the live stacks once even when a large edit evicts many entries',()=>{
 let measures=0;class History extends model.History{override get bytes(){measures++;return super.bytes;}}
 const h=new History(8000),b=model.emptyBoard();h.undoStack=Array.from({length:80},()=>JSON.stringify(b));b.nodes=[{id:'n',kind:'text',text:'Large note '.repeat(2000),x:0,y:0,width:200,height:120,color:'sand'}];h.push(b);
 assert.equal(h.undoStack.length,1);assert.equal(h.redoStack.length,0);assert.equal(measures,1);assert.deepEqual(JSON.parse(h.undoStack[0]),b);
});
test('history budgets retain undo and redo order and observe externally changed stack arrays',()=>{
 const h=new model.History(100000,3),b=model.emptyBoard();for(let i=0;i<6;i++){b.viewport.x=i;h.push(b);}assert.deepEqual(h.undoStack.map(s=>JSON.parse(s).viewport.x),[3,4,5]);
 b.viewport.x=6;const a=h.undo(b)!;assert.equal(a.viewport.x,5);const c=h.undo(a)!;assert.equal(c.viewport.x,4);assert.equal(h.redo(c)!.viewport.x,5);
 h.undoStack=[JSON.stringify(b)];h.redoStack=[];assert.equal(h.bytes,h.undoStack[0].length*2);h.redoStack.push(JSON.stringify(c));assert.equal(h.bytes,(h.undoStack[0].length+h.redoStack[0].length)*2);
 const tiny=new model.History(0,0);tiny.push(b);tiny.push(c);assert.equal(tiny.undoStack.length,1);assert.deepEqual(tiny.undo(c),c);
});

const main=readFileSync('src/main.ts','utf8'),start=main.indexOf('class Session {'),end=main.indexOf('\nexport default class ThoughtSpace',start);let clones=0,notices=0;
const deps={...model,...mindmap,clone:<T>(b:T)=>{clones++;return model.clone(b);},Notice:class{constructor(){notices++;}},EXT:'thoughtspace',report:()=>{}};
const Session=new Function(...Object.keys(deps),transformSync(main.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
function session(){const s=new Session({}, {},JSON.stringify(board()));s.persist=()=>{};clones=notices=0;return s;}
test('paused transactions reject before cloning large note and writing payloads',()=>{
 const s=session();s.blocked=true;const prior=model.clone(s.board);let callbacks=0;for(let i=0;i<120;i++)s.change(()=>callbacks++);
 assert.equal(callbacks,0);assert.equal(clones,0);assert.equal(notices,120);assert.deepEqual(s.board,prior);assert.equal(s.history.undoStack.length,0);
});
test('live transactions still take a rollback snapshot and preserve explicit before ownership',()=>{
 const s=session(),prior=model.clone(s.board);assert.throws(()=>s.change((b:model.Board)=>{b.nodes[0].width=NaN;}),/尺寸无效/);assert.equal(clones,1);assert.deepEqual(s.board,prior);assert.equal(s.history.undoStack.length,0);
 const before=model.clone(s.board);s.board.nodes[0].text='Earlier staged content';s.change((b:model.Board)=>{b.nodes[0].text='Committed';},before);assert.equal(clones,1);assert.equal(s.history.undoStack.length,1);assert.deepEqual(s.history.undo(s.board),before);
 s.change((b:model.Board)=>{b.nodes[0].text='No history';},undefined,false,false);assert.equal(clones,2);assert.equal(s.board.nodes[0].text,'No history');
});
