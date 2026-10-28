import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfAnchorRange,pdfTextAnchor,locatePdfText,validPdfExcerpt,type PdfExcerptOrigin} from '../src/pdf-excerpt-anchor';
import {parseBoard as parseCliBoard} from '../tools/board-tool/schema/model';
import {parseBoard,emptyBoard} from '../src/model';
const page='Intro repeated text. Middle repeated text. End.';
const origin=():PdfExcerptOrigin=>({version:1,path:'Sources/Article.pdf',ctime:1,mtime:2,size:300,page:2,endPage:2,quote:'repeated text',color:'green',anchor:pdfTextAnchor(page,28,41)});
test('PDF text anchors distinguish repeated text by original exact page and offsets',()=>{
 const value=origin();assert.equal(page.slice(28,41),value.quote);assert.ok(validPdfExcerpt(value));assert.deepEqual(locatePdfText(value,page),{from:28,to:41});for(const text of [page+'extra',page.replace('Intro','Changed'),page.replace('Middle','Elsewhere'),'repeated text repeated text'])assert.equal(locatePdfText(value,text),undefined);
});
test('PDF provenance round-trips without modifying legacy boards and rejects malformed metadata',()=>{
 const board={...emptyBoard(),version:3 as const,nodes:[{id:'quote',kind:'text' as const,text:'copy',x:0,y:0,width:280,height:100,color:'green' as const,pdfExcerpt:origin()}]};assert.deepEqual(parseBoard(JSON.stringify(board)),board);assert.deepEqual(parseCliBoard(JSON.stringify(board)),board);assert.throws(()=>parseCliBoard(JSON.stringify({...board,nodes:[{...board.nodes[0],pdfExcerpt:{...origin(),page:0}}]})));assert.deepEqual(parseBoard(JSON.stringify(emptyBoard())),emptyBoard());
 for(const patch of [{path:'../private.pdf'},{path:'/private.pdf'},{page:0},{endPage:1},{color:'bogus'},{quote:''},{size:-1},{ctime:NaN},{anchor:{...origin().anchor,to:29}},{anchor:{...origin().anchor,hash:'x'}}])assert.equal(validPdfExcerpt({...origin(),...patch}),false,JSON.stringify(patch));
 assert.throws(()=>pdfTextAnchor(page,-1,4));assert.throws(()=>pdfTextAnchor(page,0,200));
});

test('PDF range starts in the selected text node at an exact boundary, excluding intervening layout',()=>{
 const parts=['Before','Repeated passage','After'],nodes=parts.map(text=>({textContent:text,length:text.length})),page=parts.join(''),origin={version:1 as const,path:'Study.pdf',ctime:1,mtime:2,size:100,page:1,endPage:1,quote:parts[1],color:'green' as const,anchor:pdfTextAnchor(page,parts[0].length,parts[0].length+parts[1].length)};
 const previous=Object.getOwnPropertyDescriptor(globalThis,'NodeFilter');Object.defineProperty(globalThis,'NodeFilter',{value:{SHOW_TEXT:4},configurable:true});let start:unknown,end:unknown;
 const doc={createTreeWalker(){let i=0;return{nextNode:()=>nodes[i++]||null};},createRange(){return{setStart:(node:unknown,offset:number)=>{start=[node,offset];},setEnd:(node:unknown,offset:number)=>{end=[node,offset];}};}};
 try{pdfAnchorRange({ownerDocument:doc} as unknown as HTMLElement,origin);assert.deepEqual(start,[nodes[1],0]);assert.deepEqual(end,[nodes[1],parts[1].length]);}finally{if(previous)Object.defineProperty(globalThis,'NodeFilter',previous);else Reflect.deleteProperty(globalThis,'NodeFilter');}
});
