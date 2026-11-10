import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {discardHighlightRecovery,finishHighlightSave,highlightJump,highlightMarkdown,parseHighlight,placeHighlightNote,rollbackUnsavedHighlight} from '../src/highlight-note';
import {placeExistingCard} from '../src/card-library-model';
import {clone,emptyBoard,parseBoard,uid} from '../src/model';
import {pdfExcerptDocument,pdfLiteralText} from '../src/materials';
import {excerptPresentation} from '../src/excerpt-sources';

test('a PDF highlight is a Markdown note and the board stores only its path',()=>{
 const body=highlightMarkdown({kind:'pdf',source:'Papers/Shade.pdf',page:2,endPage:3},'林荫降低路面温度。','林荫摘录');
 assert.match(body,/thoughtspace_highlight: pdf/);
 assert.match(body,/thoughtspace_page: 2/);
 assert.match(body,/\[\[Papers\/Shade.pdf#page=2\]\]/);
 const anchor=parseHighlight({thoughtspace_highlight:'pdf',thoughtspace_source:'Papers/Shade.pdf',thoughtspace_page:2,thoughtspace_end_page:3});
 assert.deepEqual(highlightJump(anchor!),{path:'Papers/Shade.pdf',page:2,time:undefined});
 const board=emptyBoard();placeExistingCard(board,'Cards/林荫摘录.md',{x:200,y:120},'a');
 assert.equal(board.nodes[0].kind,'card');assert.equal(board.nodes[0].text,undefined);assert.equal(JSON.stringify(board).includes('林荫降低'),false);
 assert.equal(parseBoard(JSON.stringify(board)).nodes[0].file,'Cards/林荫摘录.md');
});

test('a video highlight keeps the timestamp in the note, not on the board',()=>{
 const body=highlightMarkdown({kind:'video',source:'Media/Walk.mp4',time:12.5},'回到 12 秒。','步行');
 assert.match(body,/thoughtspace_time: 12.5/);
 assert.deepEqual(parseHighlight({thoughtspace_highlight:'video',thoughtspace_source:'Media/Walk.mp4',thoughtspace_time:12.5}),{kind:'video',source:'Media/Walk.mp4',time:12.5});
 assert.equal(parseHighlight({thoughtspace_highlight:'video',thoughtspace_source:'../Walk.mp4',thoughtspace_time:1}),undefined);
 assert.equal(parseHighlight({thoughtspace_highlight:'pdf',thoughtspace_source:'Notes/A.md',thoughtspace_page:1}),undefined);
 const typed=parseHighlight({thoughtspace_highlight:'pdf',thoughtspace_source:'Papers/A.pdf',thoughtspace_page:'2',thoughtspace_end_page:'4'});
 assert.equal(typed?.page,2);assert.equal(typed?.endPage,4);
 assert.equal(parseHighlight({thoughtspace_highlight:'pdf',thoughtspace_source:'Papers/A.pdf',thoughtspace_page:2,thoughtspace_end_page:'1'}),undefined);
 assert.equal(parseHighlight({thoughtspace_highlight:'audio',thoughtspace_source:'Media/A.mp3'}),undefined);
 assert.equal(parseHighlight({thoughtspace_highlight:'pdf',thoughtspace_source:'Papers/A.pdf',thoughtspace_page:'0'}),undefined);
 assert.equal(parseHighlight({thoughtspace_highlight:'audio',thoughtspace_source:'Media/A.mp3',thoughtspace_time:'0'})?.time,0);
 assert.equal(parseHighlight({thoughtspace_highlight:'pdf',thoughtspace_source:'Papers/A.pdf',thoughtspace_page:' 2.0 '})?.page,2);
 assert.equal(parseHighlight({thoughtspace_highlight:'pdf',thoughtspace_source:'Papers/A.pdf',thoughtspace_page:'2.5'}),undefined);
 assert.equal(parseHighlight({thoughtspace_highlight:'video',thoughtspace_source:'Media/A.mp4',thoughtspace_time:' 12.5 '})?.time,12.5);
 assert.equal(parseHighlight({thoughtspace_highlight:'video',thoughtspace_source:'Media/A].mp4',thoughtspace_time:1})?.source,'Media/A].mp4');
 const bracketed=highlightMarkdown({kind:'video',source:'Media/A].mp4',time:1},'正文','标题');
 assert.equal(bracketed.includes('[[Media/A].mp4]]'),false);
 const hashed=highlightMarkdown({kind:'audio',source:'Media/A#1.mp3',time:1},'正文','标题');
 assert.equal(hashed.includes('[[Media/A#1.mp3]]'),false);
 assert.equal(parseHighlight({title:'普通笔记'}),undefined);
 const wrapped=highlightMarkdown({kind:'pdf',source:'Papers/A.pdf',page:1},'正文','第一行\n第二行');
 assert.match(wrapped,/# 第一行 第二行/);
 assert.throws(()=>highlightMarkdown({kind:'pdf',source:'../A.pdf',page:1},'正文','标题'),/来源无效/);
});

test('a highlight note is removed when the board edit does not keep it',async()=>{
 const removed:string[]=[];
 await assert.rejects(placeHighlightNote('Cards/A.md',()=>{throw Error('白板已暂停写入');},()=>false,async()=>{removed.push('Cards/A.md');}),/白板已暂停写入[\s\S]*未放置的高亮笔记已删除/);
 assert.deepEqual(removed,['Cards/A.md']);
 await assert.rejects(placeHighlightNote('Cards/A.md',()=>{},()=>false,async()=>{removed.push('again');}),/没有留下这张高亮笔记的引用[\s\S]*已删除/);
 let placed=false;
 await placeHighlightNote('Cards/A.md',()=>{placed=true;},()=>true,async()=>{throw Error('不应删除');});
 assert.equal(placed,true);
 await assert.rejects(placeHighlightNote('Cards/B.md',()=>{throw Error('布局无效');},()=>false,async()=>{throw Error('回收站不可用');}),/笔记仍保留在 Cards\/B\.md[\s\S]*布局无效[\s\S]*回收站不可用/);
 const board={nodes:[{file:'Cards/C.md'}]};
 await assert.rejects(placeHighlightNote('Cards/C.md',()=>{board.nodes.push({file:'Cards/C.md'});throw Error('保存失败');},()=>board.nodes.some(node=>node.file==='Cards/C.md'),async()=>{throw Error('不应删除已引用的笔记');}),(error:unknown)=>error instanceof Error&&error.message==='保存失败');
});

test('a failed save puts the highlight card back when the note cannot be deleted',async()=>{
 type Nodes={nodes:{file:string}[]};
 const board:Nodes={nodes:[{file:'Cards/A.md'}]},before:Nodes={nodes:[]},history={undoStack:['snapshot'],push(value:Nodes){this.undoStack.push(value.nodes[0]?.file||'empty');}};
 let current:Nodes=board;
 await assert.rejects(rollbackUnsavedHighlight({board,before,history,historyMark:0,notePath:'Cards/A.md',restoreBoard:next=>{current=next;},remove:async()=>{throw Error('回收站不可用');}}),/仍保留在 Cards\/A\.md[\s\S]*回收站不可用/);
 assert.equal(current.nodes[0]?.file,'Cards/A.md');
 assert.deepEqual(history.undoStack,['empty']);
 const removed:string[]=[],saved={undoStack:['snapshot'],push(_value:Nodes){}};
 current={nodes:[{file:'Cards/A.md'}]};
 await assert.rejects(rollbackUnsavedHighlight({board:current,before,history:saved,historyMark:0,notePath:'Cards/A.md',restoreBoard:next=>{current=next;},remove:async()=>{removed.push('Cards/A.md');}}),/未放置的高亮笔记已删除/);
 assert.equal(current.nodes.length,0);assert.deepEqual(removed,['Cards/A.md']);assert.deepEqual(saved.undoStack,[]);
});

class PdfFile {stat={mtime:1,size:4};constructor(public path:string){}get basename(){return this.path.split('/').pop()!.replace(/\.[^.]+$/,'');}}
test('a failed PDF highlight edit deletes the note and a successful one keeps the reference',async()=>{
 const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  async importPdfExcerpt(');assert.ok(start>0);
 const end=/\n  (?:(?:private|public|protected|async|static)\s+)*(?:get\s+)?[A-Za-z_$][\w$]*\(/.exec(source.slice(start+'  async importPdfExcerpt('.length));
 assert.ok(end);const body=source.slice(start,start+'  async importPdfExcerpt('.length+end.index);
 const View=new Function('pdfExcerptDocument','pdfLiteralText','excerptPresentation','highlightMarkdown','placeHighlightNote','finishHighlightSave','rollbackUnsavedHighlight','discardHighlightRecovery','uid','clone','TFile',transformSync(`class View{${body}};return View`,{loader:'ts'}).code)(pdfExcerptDocument,pdfLiteralText,excerptPresentation,highlightMarkdown,placeHighlightNote,finishHighlightSave,rollbackUnsavedHighlight,discardHighlightRecovery,uid,clone,PdfFile);
 const pdf=new PdfFile('Papers/A.pdf'),files=new Map([[pdf.path,pdf]]);
 const owner={board:emptyBoard(),blocked:false,history:{undoStack:[] as string[],push(){}},recoveryFile:undefined as {path:string}|undefined,file:new PdfFile('Boards/A.md'),change(fn:(board:{nodes:{file?:string}[]})=>void){fn(this.board);},async flush(){}};
 const view=new View();
 Object.assign(view,{requireOwner:()=>owner,renderBoard(){},boardReferencesHighlight:()=>false,discardUnplacedHighlight:async(note:PdfFile)=>{files.delete(note.path);},plugin:{settings:{cardFolder:'Cards',defaultCardWidth:320},createUnique:async(_folder:string,title:string,_ext:string,markdown:string)=>{const note=new PdfFile(`Cards/${title}.md`);files.set(note.path,note);return note;}},app:{vault:{getAbstractFileByPath:(path:string)=>files.get(path)}}});
 const origin={version:1 as const,path:pdf.path,ctime:1,mtime:1,size:4,page:2,endPage:2,quote:'林荫',color:'purple' as const};
 const placed=await view.importPdfExcerpt(pdf,'林荫降低路面温度。',2,2,{x:10,y:20},{mtime:1,size:4},origin);
 assert.equal(files.has('Cards/A 第2页.md'),true);assert.equal(owner.board.nodes.some(node=>node.file==='Cards/A 第2页.md'),true);assert.deepEqual(placed.files,['Cards/A 第2页.md']);
 owner.change=()=>{throw Error('白板已暂停写入');};owner.board=emptyBoard();
 await assert.rejects(view.importPdfExcerpt(pdf,'另一段摘录。',3,3,{x:10,y:20},{mtime:1,size:4},origin),/白板已暂停写入[\s\S]*未放置的高亮笔记已删除/);
 assert.equal(files.has('Cards/A 第3页.md'),false);assert.equal(owner.board.nodes.length,0);
 owner.change=(fn:(board:{nodes:{file?:string}[]})=>void)=>{fn(owner.board);};owner.flush=async()=>{owner.blocked=true;owner.recoveryFile={path:'Boards/A-恢复草稿.md'};};
 const recovery='{"nodes":[{"file":"Cards/A 第4页.md"}]}';
 view.app.vault.read=async()=>recovery;view.app.fileManager={trashFile:async(file:PdfFile)=>{files.delete(file.path);}};
 files.set('Boards/A-恢复草稿.md',new PdfFile('Boards/A-恢复草稿.md'));
 await assert.rejects(view.importPdfExcerpt(pdf,'第三段摘录。',4,4,{x:10,y:20},{mtime:1,size:4},origin),/白板未能保存，未放置的高亮笔记已删除/);
 assert.equal(files.has('Cards/A 第4页.md'),false);assert.equal(files.has('Boards/A-恢复草稿.md'),false);
 assert.equal(owner.board.nodes.some(node=>node.file==='Cards/A 第4页.md'),false);
});
