import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,History,type Card} from '../src/model';
import {validateBranches} from '../src/mindmap';
import {applyPdfBranch,pdfBranchLanding,pdfBranchStamp} from '../src/pdf-branch-drop';
const node=(id:string,y=0):Card=>({id,kind:'text',text:id,x:0,y,width:200,height:100,color:'purple',topic:true});
function fixture(){const board={...emptyBoard(),version:3 as const,nodes:[node('root'),node('first',200),node('last',400)],edges:[{id:'a',from:'root',to:'first',label:'',kind:'branch' as const},{id:'b',from:'root',to:'last',label:'',kind:'branch' as const}]};return board;}
test('PDF landing previews child, previous sibling and next sibling without mutations',()=>{const b=fixture(),before=clone(b);for(const [y,relation]of [[250,'child'],[201,'before'],[299,'after']]as const){assert.equal(pdfBranchLanding(b,{x:100,y})?.relation,relation);assert.deepEqual(b,before);}assert.equal(pdfBranchLanding(b,{x:1000,y:1000}),undefined);});
test('adding a PDF branch is one undoable insertion with stable sibling edge order',()=>{
 for(const relation of ['child','before','after']as const){const b=fixture(),before=clone(b),history=new History(),quote=node('quote');applyPdfBranch(b,quote,{target:'first',relation,stamp:pdfBranchStamp(b)},'new');assert.equal(b.nodes.length,4);assert.equal(validateBranches(b).get('quote'),relation==='child'?'first':'root');if(relation!=='child')assert.deepEqual(b.edges.map(e=>e.to),relation==='before'?['quote','first','last']:['first','quote','last']);history.push(before);assert.deepEqual(history.undo(b),before);}
});
test('existing reparent preserves descendants, no duplication and exact free geometry',()=>{const b=fixture(),quote=node('quote',500);b.nodes.push(quote);b.edges.push({id:'c',from:'first',to:'quote',label:'',kind:'branch'});const geometry={x:quote.x,y:quote.y};applyPdfBranch(b,quote,{target:'last',relation:'child',stamp:pdfBranchStamp(b)},'unused',true);assert.equal(b.nodes.length,4);assert.equal(b.edges.filter(e=>e.to==='quote').length,1);assert.equal(validateBranches(b).get('quote'),'last');assert.deepEqual({x:quote.x,y:quote.y},geometry);});
test('stale targets, locks and cycles abort without partial insertion or structure loss',()=>{
 const b=fixture(),before=clone(b),stamp=pdfBranchStamp(b);assert.throws(()=>applyPdfBranch(b,b.nodes[0],{target:'first',relation:'child',stamp},'new',true));assert.deepEqual(b,before);b.nodes[1].locked=true;const locked=clone(b);assert.throws(()=>applyPdfBranch(b,node('q'),{target:'first',relation:'child',stamp:pdfBranchStamp(b)},'new'));assert.deepEqual(b,locked);assert.throws(()=>applyPdfBranch(b,node('q'),{target:'first',relation:'child',stamp},'new'));assert.deepEqual(b,locked);
});
