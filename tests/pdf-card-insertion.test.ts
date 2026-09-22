import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';
import {pdfCard,pdfPage,isPdfFile} from '../src/pdf-card';import {emptyBoard,parseBoard} from '../src/model';
const source=readFileSync('src/main.ts','utf8');
test('inserting PDF uses an independent object type without Markdown auto-fit or editor state',()=>{
 const start=source.indexOf('  private addFile('),end=source.indexOf('  private async newCard(',start);
 const View=new Function('uid','pdfCard','pdfPage','isPdfFile',transformSync('class View{'+source.slice(start,end)+'}\nreturn View',{loader:'ts'}).code)(()=> 'pdf-id',pdfCard,pdfPage,isPdfFile);
 const view=new View();view.session={board:emptyBoard()};view.plugin={settings:{defaultCardWidth:320}};view.mutate=(fn:any)=>{fn(view.session.board);parseBoard(JSON.stringify(view.session.board))};
 view.addFile({path:'论文.pdf',extension:'pdf'},{x:500,y:200},2);const node=view.session.board.nodes[0];assert.equal(node.kind,'pdf');assert.equal(node.pdfPage,2);assert.equal(node.autoFit,undefined);assert.equal(node.x,340);assert.equal(view.session.board.version,3);
 assert.throws(()=>view.addFile({path:'script.js',extension:'js'},{x:0,y:0}),/仅支持/);assert.equal(view.session.board.nodes.length,1);
});
test('the insertion picker includes PDFs without widening Markdown-only relink pickers',()=>{
 const start=source.indexOf('class NotePicker extends'),end=source.indexOf('class ReadingSourcePicker',start);
 class Modal{constructor(public app:any){}setPlaceholder(){}}
 const Picker=new Function('FuzzySuggestModal','isWorkspaceFile','isPdfFile',transformSync(source.slice(start,end)+'\nreturn NotePicker',{loader:'ts'}).code)(Modal,()=>true,isPdfFile);
 const md={path:'note.md',extension:'md'},pdf={path:'paper.PDF',extension:'PDF'},image={path:'image.png',extension:'png'},app={vault:{getFiles:()=>[md,pdf,image],getMarkdownFiles:()=>[md]}};
 assert.deepEqual(new Picker(app,()=>{}).getItems(),[md]);assert.deepEqual(new Picker(app,()=>{},'插入',true).getItems(),[md,pdf]);
});
