import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,parseBoard,type Board,type Card} from '../src/model';
import {mergeTexts,selectStudio,studioDraft} from '../src/board-studio';
import {foldCards} from '../src/board-tools';
const node=(id:string,x=0,y=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width:200,height:100,color:'blue',...extra});
test('G10 merge accepts folded ordinary texts and retains a valid reversible content fold',()=>{
 const b:Board={...emptyBoard(),version:3,nodes:[node('a',0,0,{height:300}),node('b',300,0,{height:200}),node('outside',1000)],edges:[{id:'out',from:'b',to:'outside',label:'supports'}]};foldCards(b,new Set(['a','b']),true);const before=clone(b);
 const result=studioDraft(b,d=>{mergeTexts(d,new Set(['a','b']));})!;assert.ok(result);assert.deepEqual(b,before);const merged=result.nodes[0];assert.equal(merged.text,'a\n\nb');assert.equal(merged.collapsed,true);assert.equal(merged.height,72);assert.equal(merged.expandedHeight,500);assert.equal(result.edges[0].from,'a');parseBoard(JSON.stringify(result));
 foldCards(result,new Set(['a']),false);assert.equal(result.nodes[0].height,500);assert.equal(result.nodes[0].text,'a\n\nb');parseBoard(JSON.stringify(result));
});
test('G11 select current viewport uses folded group header geometry and excludes hidden contents',()=>{
 const b:Board={...emptyBoard(),version:3,nodes:[node('frame',0,0,{kind:'section',title:'Frame',width:900,height:900,sectionFolded:true}),node('hidden',30,30),node('visible',1000,10)],edges:[]};const before=clone(b);
 assert.deepEqual([...selectStudio(b,new Set(),'viewport',{x:-10,y:-10,width:1300,height:100})],['frame','visible']);assert.deepEqual(b,before);
 assert.deepEqual([...selectStudio(b,new Set(),'viewport',{x:0,y:0,width:300,height:60})],[],'partial header is not enough for frame selection');
});
