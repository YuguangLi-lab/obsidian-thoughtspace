import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,clone,parseBoard,setBoardEdgeStyle,inheritNewEdgeStyle,type Edge} from '../src/model';
import {History} from '../src/model';
function board(){return {...emptyBoard(),version:3 as const,nodes:['a','b','c'].map((id,i)=>({id,kind:'text' as const,text:id,x:i*200,y:0,width:160,height:80,color:'blue' as const})),edges:[{id:'ab',from:'a',to:'b',label:'证据',style:'curve',color:'rose',direction:'both',dashed:true},{id:'bc',from:'b',to:'c',label:'子主题',kind:'branch',style:'elbow'}] as Edge[]};}
test('bulk paths cover ordinary and branch edges while preserving relation metadata',()=>{const b=board(),before=clone(b);setBoardEdgeStyle(b,'straight');assert.equal(b.defaultEdgeStyle,'straight');for(const [i,e]of b.edges.entries())assert.deepEqual(e,{...before.edges[i],style:'straight'});assert.deepEqual(parseBoard(JSON.stringify(b)),b);});
test('board path defaults override newly generated mindmap curves but not later per-edge edits',()=>{const b=board();setBoardEdgeStyle(b,'straight');const before=clone(b);b.edges[0].style='elbow';b.edges.push({id:'ac',from:'a',to:'c',label:'',style:'curve'});inheritNewEdgeStyle(b,before);assert.equal(b.edges[0].style,'elbow');assert.equal(b.edges[2].style,'straight');});
test('legacy boards retain original new-edge styles until a board-wide choice is made',()=>{const b=board(),before=clone(b);b.edges.push({id:'ac',from:'a',to:'c',label:'',style:'curve'});inheritNewEdgeStyle(b,before);assert.equal(b.edges[2].style,'curve');assert.equal(b.defaultEdgeStyle,undefined);});
test('bulk style undo restores routes and the future-edge default together',()=>{const b=board(),before=clone(b),history=new History();history.push(before);setBoardEdgeStyle(b,'straight');assert.deepEqual(history.undo(b),before);});
test('invalid stored default path is rejected',()=>{const b=board();assert.throws(()=>parseBoard(JSON.stringify({...b,defaultEdgeStyle:'invalid'})));});
