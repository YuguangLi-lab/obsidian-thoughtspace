import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,type Board} from '../src/model';
import {createBoardReferenceRenamer} from '../src/board-reference-rename';
import {resolveNativeNoteDrop,type NativeNoteDropLookup} from '../src/native-note-drop';
import {databaseBase,type SavedDatabaseView} from '../src/database-custom';

const view:SavedDatabaseView={id:'view',name:'证据资料',source:'vault',layout:'table',filter:{query:'',tag:'#研究',status:'',priority:'',overdue:false,sort:'title',today:'2026-09-27'},conditions:[]};

test('I140-1 renaming generated Markdown provenance preserves literal hash in an existing filename',()=>{
 const old='资料/实验 #1.md',next='归档/实验 #1.md',text='摘录\n\n> 来源：[实验](资料/实验%20%231.md#章节) · 第 2–3 行';
 const board:Board={...emptyBoard(),nodes:[{id:'quote',kind:'text',text,x:0,y:0,width:200,height:80,color:'sand'}]};
 const rewritten=createBoardReferenceRenamer(old,next,[next])(board,'白板.thoughtspace');
 assert.equal(rewritten?.nodes[0].text,'摘录\n\n> 来源：[实验](%E5%BD%92%E6%A1%A3/%E5%AE%9E%E9%AA%8C%20%231.md#章节) · 第 2–3 行');
 assert.equal(board.nodes[0].text,text);
});

test('I140-2 URI drop keeps percent-encoded literal hash and bracket names separate from PDF page fragments',()=>{
 class File{extension:string;constructor(public path:string){this.extension=path.split('.').at(-1)!;}}
 const file=new File('资料/结果 #[1].pdf'),files=new Map([[file.path,file]]);
 const lookup:NativeNoteDropLookup<File>={vaultName:'测试库',isFile:(v):v is File=>v instanceof File,getFile:path=>files.get(path),resolve:path=>files.get(path)};
 for(const page of [1,3]){
  const uri='obsidian://open?file='+encodeURIComponent(file.path)+(page===1?'':'#page=3');
  const result=resolveNativeNoteDrop(lookup,{getData:type=>type==='text/uri-list'?uri:''},null,'board.thoughtspace');
  assert.deepEqual(result,{handled:true,references:[{file,path:file.path,page}]});
 }
});

test('I140-2 legacy URI page suffix supports bracketed filenames and keeps exact names authoritative',()=>{
 class File{extension:string;constructor(public path:string){this.extension=path.split('.').at(-1)!;}}
 const pdf=new File('资料/结果 #[1].pdf'),files=new Map([[pdf.path,pdf]]);
 const lookup:NativeNoteDropLookup<File>={vaultName:'测试库',isFile:(v):v is File=>v instanceof File,getFile:path=>files.get(path),resolve:path=>files.get(path)};
 const drop=(path:string)=>resolveNativeNoteDrop(lookup,{getData:type=>type==='text/uri-list'?'obsidian://open?file='+encodeURIComponent(path):''},null,'board.thoughtspace');
 assert.deepEqual(drop(pdf.path+'#page=3'),{handled:true,references:[{file:pdf,path:pdf.path,page:3}]});
 for(const value of ['0','-2','x','9007199254740992'])assert.deepEqual(drop(pdf.path+'#page='+value),{handled:false,references:[]});
 const exact=new File(pdf.path+'#page=3.md');files.set(exact.path,exact);
 assert.deepEqual(drop(pdf.path+'#page=3'),{handled:true,references:[{file:exact,path:exact.path,page:1}]});
});

test('I140-3 native Bases export preserves exclusions for generated indexes and installation backups',()=>{
 const filters=databaseBase(view,[],'Cards').filters.and;
 for(const folder of ['ThoughtSpace/白板搜索','ThoughtSpace-plugin-backups'])assert.ok(filters.includes(`!file.inFolder(${JSON.stringify(folder)})`),folder);
});

test('I140-4 exported Bases keeps the database exact-tag constraint instead of matching every descendant tag',()=>{
 const filters=databaseBase(view,[],'Cards').filters.and;
 assert.ok(!filters.some(filter=>filter.startsWith('file.hasTag(')),'hasTag includes subtags while the database filter is exact');
 assert.ok(filters.includes('file.tags.filter(value.replace(/^#/, "") == "研究").length > 0'));
});

test('I140-1 escaped Markdown citation destinations follow source renames',()=>{
 const before='folder(one)/note_name.md',after='Archive/note_name.md';
 const text=String.raw`摘录

> 来源：[来源](folder\(one\)/note\_name.md#Heading) · 第 2–3 行`;
 const board:Board={...emptyBoard(),nodes:[{id:'quote',kind:'text',text,x:0,y:0,width:200,height:80,color:'sand'}]};
 const result=createBoardReferenceRenamer(before,after,[after])(board,'boards/Research.thoughtspace');
 assert.equal(result?.nodes[0].text,'摘录\n\n> 来源：[来源](Archive/note_name.md#Heading) · 第 2–3 行');
});

test('I140-1 legacy fully encoded anchors prefer the longest real source filename',()=>{
 const before='a.md#b.md',after='Archive/b.md',text='摘录\n\n> 来源：[来源](a.md%23b.md%23Heading) · 第 2–3 行';
 const board:Board={...emptyBoard(),nodes:[{id:'quote',kind:'text',text,x:0,y:0,width:200,height:80,color:'sand'}]};
 const result=createBoardReferenceRenamer(before,after,['a.md',after])(board,'boards/Research.thoughtspace');
 assert.equal(result?.nodes[0].text,'摘录\n\n> 来源：[来源](Archive/b.md%23Heading) · 第 2–3 行');
});
