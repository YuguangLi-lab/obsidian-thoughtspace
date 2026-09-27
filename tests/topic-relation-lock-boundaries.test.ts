import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,parseBoard,type Board,type Card} from '../src/model';
import {saveTopicRelation} from '../src/mindmap-branches';

const node=(id:string,locked=false):Card=>({id,kind:'text',text:id,x:0,y:0,width:120,height:80,color:'blue',locked});
const fixture=():Board=>({...emptyBoard(),version:3,nodes:[node('root'),node('old',true),node('next')],edges:[{id:'b1',from:'root',to:'old',kind:'branch',label:''},{id:'b2',from:'root',to:'next',kind:'branch',label:''},{id:'relation',from:'root',to:'old',label:'original'}]});
test('retargeting a topic relationship cannot detach its locked original endpoint',()=>{
 const b=fixture(),before=clone(b);
 assert.throws(()=>saveTopicRelation(b,'root',{id:'relation',target:'next',label:'changed',direction:'forward'}),/解锁/);assert.deepEqual(b,before);
});
test('retargeting after unlocking preserves edge identity and immutable source',()=>{
 const b=fixture();b.nodes[1].locked=false;const before=clone(b),result=saveTopicRelation(b,'root',{id:'relation',target:'next',label:'changed',direction:'both'});
 assert.deepEqual(b,before);assert.deepEqual(result.board.edges.at(-1),{id:'relation',from:'root',to:'next',label:'changed',direction:'both'});assert.deepEqual(parseBoard(JSON.stringify(result.board)),result.board);
});
