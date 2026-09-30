import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {excerptNoteMarkdown} from '../src/materials';
import {applyDefaultCardStyle} from '../src/card-style';

// Use the production conversion and save queue: a save acknowledgement must
// produce a document that a newly opened Session can actually parse.
const source=readFileSync(process.env.CONVERSION_SOURCE||'src/main.ts','utf8');
const sessionStart=source.indexOf('class Session {'),sessionEnd=source.indexOf('\nexport default class ThoughtSpace',sessionStart);
const deps={...model,...mindmap,reflowReadingContent,Notice:class{},EXT:'thoughtspace',report:()=>{}};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(sessionStart,sessionEnd)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const conversionStart=source.indexOf('  async textToNote('),conversionEnd=source.indexOf('  async addTopic(',conversionStart);
const View=new Function('excerptNoteMarkdown','applyDefaultCardStyle','Notice',transformSync('class View{'+source.slice(conversionStart,conversionEnd)+'};return View',{loader:'ts'}).code)(excerptNoteMarkdown,applyDefaultCardStyle,class{});

function fixture(extra:Partial<model.Card>){
 const before:model.Board={...model.emptyBoard(),version:3,nodes:[{id:'text',kind:'text',text:'Original paragraph\n\n> 来源：[[Sources/Video.md#^video-t-11111111-2222-3333-4444-555555555555]]',x:20,y:30,width:240,height:80,color:'sand',...extra}]};
 let disk=JSON.stringify(before,null,2);
 const created:{path:string;content:string}[]=[],opened:unknown[]=[];
 const plugin={settings:{cardFolder:'Notes',autoFileCards:false,defaultCardStyle:'paper'},
  app:{vault:{process:async(_file:unknown,edit:(raw:string)=>string)=>{disk=edit(disk);},read:async()=>disk}},
  createUnique:async(_folder:string,title:string,_ext:string,content:string)=>{const file={path:`Notes/${title}.md`,content};created.push(file);return file;},
  openNoteInSidebar:async(file:unknown)=>{opened.push(file);}};
 const file={path:'board.thoughtspace',basename:'board'},session=new Session(plugin,file,disk),view=new View();
 Object.assign(view,{plugin,session,requireOwner:(owner=session)=>{if(view.session!==owner||owner.blocked)throw Error('owner changed');return owner;}});
 return{view,session,created,opened,before,reopen:()=>new Session(plugin,file,disk),disk:()=>disk};
}

for(const expandedHeight of [40,480])test(`converting a folded text with expanded height ${expandedHeight} saves a reopenable folded note and reversible history`,async()=>{
 const f=fixture({collapsed:true,height:72,expandedHeight});
 await f.view.textToNote('text','Converted');
 assert.equal(f.session.status,'已保存');assert.equal(f.session.blocked,false);
 const reopened=f.reopen(),note=reopened.board.nodes[0];
 assert.equal(note.kind,'card');assert.equal(note.collapsed,true);assert.equal(note.height,72);
 assert.equal(note.expandedHeight,Math.max(220,expandedHeight));assert.equal(note.width,280);assert.equal(note.file,f.created[0].path);
 assert.match(f.created[0].content,/Original paragraph/);assert.match(f.created[0].content,/\[\[Sources\/Video\.md#/);
 assert.deepEqual(f.opened,[f.created[0]]);
 f.session.undo();await f.session.flush();assert.deepEqual(f.reopen().board,f.before);
 f.session.undo(true);await f.session.flush();assert.deepEqual(f.reopen().board,reopened.board);
});

test('converting a video capture text removes text-only provenance while keeping its source in the note and undo',async()=>{
 const provenance={id:'11111111-2222-3333-4444-555555555555',note:'Sources/Video.md'},f=fixture({videoCapture:provenance});
 await f.view.textToNote('text','Captured note');
 const reopened=f.reopen(),note=reopened.board.nodes[0];
 assert.equal(note.kind,'card');assert.equal(note.videoCapture,undefined);assert.equal(note.cardStyle,'paper');
 assert.match(f.created[0].content,/\[\[Sources\/Video\.md#/);assert.match(f.created[0].content,/Original paragraph/);
 f.session.undo();await f.session.flush();assert.deepEqual(f.reopen().board.nodes[0].videoCapture,provenance);assert.deepEqual(f.reopen().board,f.before);
 f.session.undo(true);await f.session.flush();assert.deepEqual(f.reopen().board,reopened.board);
});
