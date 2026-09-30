import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as cardStyles from '../src/card-style';
import {excerptNoteMarkdown} from '../src/materials';
import {validateBranches} from '../src/mindmap';
import {reflowReadingContent} from '../src/expansion-reading-state';

// Execute production conversion and Session history; substitute only vault I/O.
const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const dependencies={...model,...cardStyles,excerptNoteMarkdown,validateBranches,reflowReadingContent,Notice:class{}};
function compile(code:string){return new Function(...Object.keys(dependencies),transformSync(code,{loader:'ts'}).code)(...Object.values(dependencies));}
const View=compile(`class View{${take('  async textToNote(','  async addTopic(')}${take('  private requireOwner(','  private canCreateBlankText(')}}return View;`);
const Session=compile(`class Session{${take('  change(fn:','  persist() {')}}return Session;`);
function fixture(choice:cardStyles.CardStyleChoice,web=false){
 const node:model.Card={id:'text',kind:'text',text:'Source **Markdown**',x:20,y:30,width:300,height:100,color:'green',...(web?{webUrl:'https://example.com'}:{})};
 const created:{path:string;body:string}[]=[],opened:unknown[]=[];let saved=0;
 const owner=new Session();Object.assign(owner,{board:{...model.emptyBoard(),version:3,nodes:[node]},history:new model.History(),blocked:false,convertingTexts:new Set(),persist(){saved++;model.parseBoard(JSON.stringify(this.board));},emit(){},async flush(){}});
 const view=new View();Object.assign(view,{session:owner,closed:false,plugin:{settings:{defaultCardStyle:choice,cardFolder:'Notes',autoFileCards:false},
  async createUnique(_folder:string,_name:string,_extension:string,body:string){const file={path:'Notes/converted.md',body};created.push(file);return file;},
  async openNoteInSidebar(file:unknown){opened.push(file);}
 }});
 return{view,owner,created,opened,saved:()=>saved};
}
for(const choice of Object.keys(cardStyles.cardStyleChoices) as cardStyles.CardStyleChoice[])for(const web of [false,true])test(`${choice} default applies when ${web?'web text':'plain text'} becomes a note and survives undo redo`,async()=>{
 const f=fixture(choice,web),before=model.clone(f.owner.board);
 await f.view.textToNote('text','converted');
 assert.equal(f.created.length,1);assert.equal(f.created[0].body,excerptNoteMarkdown(before.nodes[0].text!));assert.equal(f.opened.length,1);
 const node=f.owner.board.nodes[0];assert.equal(node.kind,'card');assert.equal(node.file,f.created[0].path);assert.equal(cardStyles.cardStyleChoice(node),choice);
 assert.equal(node.webUrl,undefined);assert.equal(node.text,undefined);assert.deepEqual([node.x,node.y,node.width,node.height],[20,30,300,220]);assert.equal(f.saved(),1);
 const after=model.clone(f.owner.board);assert.deepEqual(model.parseBoard(JSON.stringify(after)),after);
 f.owner.undo();assert.deepEqual(f.owner.board,before);f.owner.undo(true);assert.deepEqual(f.owner.board,after);
 assert.equal(f.created.length,1,'undo and redo only restore board references');
});
test('a locked text conversion cannot create a note or apply the default style',async()=>{
 const f=fixture('paper');f.owner.board.nodes[0].locked=true;const before=model.clone(f.owner.board);
 await assert.rejects(f.view.textToNote('text','converted'),/解锁/);assert.equal(f.created.length,0);assert.deepEqual(f.owner.board,before);
});
