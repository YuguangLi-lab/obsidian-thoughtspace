import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,parseBoard} from '../src/model';
import {excerptNoteMarkdown} from '../src/materials';
const source=readFileSync(process.env.CONVERSION_SOURCE||'src/main.ts','utf8');
const start=source.indexOf('  async textToNote('),end=source.indexOf('  async addTopic(',start);
const View=new Function('excerptNoteMarkdown','Notice',transformSync('class View{'+source.slice(start,end)+'}\nreturn View',{loader:'ts'}).code)(excerptNoteMarkdown,class{});
function setup(){
 const board=emptyBoard();board.version=3;board.nodes=[{id:'text',kind:'text',text:'saved text',x:20,y:30,width:240,height:80,color:'sand'}];
 const created:{path:string;content:string}[]=[],opened:unknown[]=[];const view=new View();view.convertingTexts=new Set();
 view.session={board,convertingTexts:new Set(),blocked:false,change:(fn:any)=>{fn(board);parseBoard(JSON.stringify(board));},flush:async()=>{}};
 view.requireOwner=(owner=view.session)=>{if(!owner||view.session!==owner||view.closed||owner.blocked)throw Error('owner changed');return owner};
 view.plugin={settings:{cardFolder:'Notes',autoFileCards:true},createUnique:async(_folder:string,title:string,_ext:string,content:string)=>{const file={path:`Notes/${title}-${created.length}.md`,content};created.push(file);return file},waitNoteTags:async()=>[],openNoteInSidebar:async(file:unknown)=>{opened.push(file)}};
 return{view,board,created,opened};
}
const defer=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>resolve=r);return{promise,resolve}};
test('text conversion includes the current inline draft instead of stale saved text',async()=>{const h=setup();let commits=0;h.view.inline={commit:async()=>{commits++;h.board.nodes[0].text='latest draft';h.view.inline=undefined;return true}};await h.view.textToNote('text','note');assert.equal(commits,1);assert.equal(h.created[0].content,'latest draft');assert.equal(h.board.nodes[0].kind,'card')});
test('conversion stops on an inline save conflict without creating a file',async()=>{const h=setup();h.view.inline={commit:async()=>false};await assert.rejects(h.view.textToNote('text','note'),/冲突/);assert.equal(h.created.length,0);assert.equal(h.board.nodes[0].kind,'text')});
test('locked text cannot be converted or create an orphan note',async()=>{const h=setup();h.board.nodes[0].locked=true;await assert.rejects(h.view.textToNote('text','note'),/锁/);assert.equal(h.created.length,0)});
test('locking text while metadata is pending preserves the text and saved note',async()=>{const h=setup();h.view.plugin.waitNoteTags=async()=>{h.board.nodes[0].locked=true;return []};await assert.rejects(h.view.textToNote('text','note'),/锁|变化/);assert.equal(h.board.nodes[0].kind,'text');assert.equal(h.created.length,1);assert.equal(h.opened.length,0)});
test('repeated conversion while metadata is pending does not create duplicate notes',async()=>{const h=setup(),gate=defer();h.view.plugin.waitNoteTags=()=>gate.promise;const first=h.view.textToNote('text','note');await Promise.resolve();const second=h.view.textToNote('text','note').catch((e:Error)=>e);gate.resolve([]);await first;assert.match(String(await second),/正在转换/);assert.equal(h.created.length,1)});
test('switching boards during inline commit cannot create a note in the previous board',async()=>{const h=setup();h.view.inline={commit:async()=>{h.view.session={board:emptyBoard()};return true}};await assert.rejects(h.view.textToNote('text','note'),/owner/);assert.equal(h.created.length,0)});
test('failed file creation releases the conversion guard for a retry',async()=>{const h=setup(),create=h.view.plugin.createUnique;h.view.plugin.createUnique=async()=>{throw Error('disk failed')};await assert.rejects(h.view.textToNote('text','note'),/disk/);h.view.plugin.createUnique=create;await h.view.textToNote('text','note');assert.equal(h.created.length,1)});
test('editing text during metadata lookup preserves both original object and generated file',async()=>{const h=setup();h.view.plugin.waitNoteTags=async()=>{h.board.nodes[0].text='external edit';return []};await assert.rejects(h.view.textToNote('text','note'),/变化/);assert.equal(h.board.nodes[0].text,'external edit');assert.equal(h.board.nodes[0].kind,'text');assert.equal(h.created[0].content,'saved text')});

test('two views of the same board cannot convert the same text concurrently',async()=>{const h=setup(),other=setup(),gate=defer();other.view.session=h.view.session;other.view.plugin=h.view.plugin;h.view.plugin.waitNoteTags=()=>gate.promise;const first=h.view.textToNote('text','note');await Promise.resolve();const second=other.view.textToNote('text','note').catch((e:Error)=>e);gate.resolve([]);await first;assert.match(String(await second),/正在转换/);assert.equal(h.created.length,1)});
test('conversion without tag filing never waits for the metadata index',async()=>{const h=setup();h.view.plugin.settings.autoFileCards=false;let reads=0;h.view.plugin.waitNoteTags=async()=>{reads++;return []};await h.view.textToNote('text','note');assert.equal(reads,0);assert.equal(h.opened.length,1)});
test('tag filing still resolves tags and uses the final archived note path',async()=>{const h=setup();h.view.plugin.waitNoteTags=async()=>['#research'];h.view.plugin.fileCard=async(file:any,tag:string)=>{assert.equal(tag,'#research');file.path='Archive/note.md'};await h.view.textToNote('text','note');assert.equal(h.board.nodes[0].file,'Archive/note.md')});
test('failed board persistence is not reported as successful conversion',async()=>{const h=setup();h.view.session.flush=async()=>{h.view.session.blocked=true};await assert.rejects(h.view.textToNote('text','note'),/保存|写入/);assert.equal(h.created.length,1);assert.equal(h.opened.length,0);assert.equal(h.view.session.convertingTexts.size,0)});
test('changing views during save does not replace the current reading pane',async()=>{const h=setup();h.view.session.flush=async()=>{h.view.session={board:emptyBoard()}};await h.view.textToNote('text','note');assert.equal(h.opened.length,0);assert.equal(h.created.length,1)});
test('undo during save does not open a note no longer referenced by the text node',async()=>{const h=setup();h.view.session.flush=async()=>{h.board.nodes[0].kind='text';delete h.board.nodes[0].file};await h.view.textToNote('text','note');assert.equal(h.opened.length,0);assert.equal(h.created.length,1)});
