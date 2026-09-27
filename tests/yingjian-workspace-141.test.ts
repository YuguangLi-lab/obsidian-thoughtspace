import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import {isRecord} from '../src/value-guards';
import {isWorkspaceFile} from '../src/workspace';
import {yingjianMoments,yingjianNoteSource,yingjianNotePath,yingjianLink,parseYingjianLink} from '../src/yingjian';
import {playInYingjianPlugin,yingjianPlayerActions,yingjianPlayerConnection} from '../src/yingjian-player-adapter';
const parseYaml=createRequire(import.meta.url)('js-yaml').load;
const source='/课程/示范.mp4',vaultId='abcdef0123456789abcd';
const link=yingjianLink(source,14.25,'课程.md',vaultId),moment=`[00:14](${link})`,header=`---\nsource: ${JSON.stringify(source)}\nvideo-note-id: course\n---\n`;
const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
class TFile{extension='md';stat={mtime:1,size:100};constructor(public path='课程.md'){}get basename(){return this.path.replace(/\.md$/,'');}}
class Element{
 ownerDocument={defaultView:{setTimeout,clearTimeout}};
 children:Element[]=[];value='';text='';disabled=false;scrollTop=0;dataset:Record<string,string>={};isConnected=true;attributes:Record<string,string>={};
 constructor(options:any={}){this.value=options.value||'';this.text=options.text||'';this.attributes=options.attr||{};}
 createEl(_tag:string,options:any={}){const el=new Element(options);this.children.push(el);return el;}createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}empty(){this.children=[];}setText(text:string){this.text=text;}addClass(){}toggleClass(){}querySelectorAll(){return[];}get options(){return this.children;}
}
class Component{events:any[]=[];load(){}registerEvent(event:any){this.events.push(event);}unload(){for(const event of this.events)event.off?.();this.events=[];}}
class Modal{modalEl=new Element();contentEl=new Element();titleEl=new Element();constructor(readonly app:any){}open(){}close(){this.modalEl.isConnected=false;(this as any).onClose?.();}}
const viewSource=readFileSync('src/yingjian-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const viewDeps={App:class{},Component,Modal,Notice:class{},TFile,setIcon:()=>{},parseYaml,themeSurface:()=>{},yingjianNoteSource,yingjianMoments,isWorkspaceFile};
const YingjianModal=new Function(...Object.keys(viewDeps),transformSync(viewSource+'\nreturn YingjianModal;',{loader:'ts'}).code)(...Object.values(viewDeps));
function fixture(raw=header+moment){
 const file=new TFile(),files=new Map<string,TFile>([[file.path,file]]),contents=new Map<TFile,string>([[file,raw]]);const listeners=new Map<string,Function[]>();
 const emitter=(prefix:string)=>({on:(event:string,fn:Function)=>{const key=prefix+event,entries=listeners.get(key)||[];entries.push(fn);listeners.set(key,entries);return{off:()=>listeners.set(key,(listeners.get(key)||[]).filter(f=>f!==fn))};}});
 const app={vault:{...emitter('vault:'),getMarkdownFiles:()=>[...files.values()],getAbstractFileByPath:(path:string)=>files.get(path),read:async(f:TFile)=>contents.get(f)||''},metadataCache:{...emitter('metadata:'),getFileCache:(f:TFile)=>({frontmatter:parseYaml(contents.get(f)?.split('---\n')[1]||'')})}};
 const host={play:async()=>{},open:async()=>{}},modal=new YingjianModal(app,host,()=>{});modal.render=()=>{};Object.assign(modal,{notes:new Element(),query:new Element(),status:new Element(),list:new Element(),error:new Element(),footer:new Element()});
 return{app,host,modal,file,files,contents,listeners,emit:(prefix:string,...args:any[])=>{for(const fn of listeners.get(prefix)||[])fn(...args);}};
}
test('video refresh keeps a selected excerpt when unrelated text moves its source lines',async()=>{
 const f=fixture();await f.modal.load(f.file.path);const before=f.modal.moments[0].id;f.modal.selected.add(before);f.contents.set(f.file,header+'\n新增标题\n\n'+moment);await f.modal.load(f.file.path,true);
 assert.equal(f.modal.selected.size,1);assert.notEqual(f.modal.moments[0].id,before);assert.ok(f.modal.selected.has(f.modal.moments[0].id));
});
test('video refresh never selects unchosen duplicate excerpts or exceeds the selection cap',async()=>{
 const f=fixture(header+Array(60).fill(moment).join('\n'));await f.modal.load(f.file.path);f.modal.selected.add(f.modal.moments[1].id);await f.modal.load(f.file.path,true);
 assert.equal(f.modal.selected.size,1,'refresh must preserve selected occurrence count');assert.ok(f.modal.selected.has(f.modal.moments[1].id),'same duplicate occurrence remains selected');
});
test('replacing a note at the same path never carries selection into a different TFile',async()=>{
 const f=fixture();await f.modal.load(f.file.path);f.modal.selected.add(f.modal.moments[0].id);const replacement=new TFile(f.file.path);f.files.set(f.file.path,replacement);f.contents.set(replacement,header+moment);await f.modal.load(replacement.path,true);
 assert.equal(f.modal.selected.size,0);assert.equal(f.modal.file,replacement);
});
test('live video note parsing accepts Obsidian YAML separators with trailing whitespace',async()=>{
 for(const close of ['---  ','...\t']){const f=fixture(`---\r\nsource: ${JSON.stringify(source)}\r\nvideo-note-id: course\r\n${close}\r\n${moment}`);await f.modal.load(f.file.path);assert.equal(f.modal.moments.length,1);assert.equal(f.modal.error.text,'');}
});
test('an older asynchronous note load cannot overwrite a newer selection',async()=>{
 const f=fixture(),second=new TFile('其他.md');f.files.set(second.path,second);f.contents.set(second,header+moment+' 第二篇');let release!:(raw:string)=>void;
 f.app.vault.read=(file:TFile)=>file===f.file?new Promise<string>(resolve=>release=resolve):Promise.resolve(f.contents.get(file)!);
 const first=f.modal.load(f.file.path);await f.modal.load(second.path);release(header+moment);await first;assert.equal(f.modal.file,second);assert.equal(f.modal.path,second.path);assert.ok(f.modal.raw.endsWith('第二篇'));
});
test('a replaced or edited source is refused after asynchronous validation starts',async()=>{
 for(const replace of [true,false]){const f=fixture();await f.modal.load(f.file.path);let release!:(raw:string)=>void;f.app.vault.read=()=>new Promise<string>(resolve=>release=resolve);const pending=f.modal.validate();if(replace)f.files.set(f.file.path,new TFile(f.file.path));release(replace?header+moment:header+moment+' changed');await assert.rejects(()=>pending,/变化/);}
});
test('refresh requests during an action coalesce and run after that action completes',async()=>{
 const f=fixture();await f.modal.load(f.file.path);f.modal.busy=true;f.modal.queueRefresh(true);f.modal.queueRefresh(false);if(f.modal.refreshTimer)clearTimeout(f.modal.refreshTimer);f.modal.drainRefresh();assert.equal(f.modal.refreshPending,true);
 f.contents.set(f.file,header+moment+' 新正文');f.modal.busy=false;f.modal.drainRefresh();await tick();assert.ok(f.modal.raw.includes('新正文'));assert.equal(f.modal.refreshPending,false);
});
test('rename refresh follows the same source object and closing unregisters live listeners',async()=>{
 const f=fixture();f.modal.onOpen();await tick();f.modal.selected.add(f.modal.moments[0].id);const previous=f.file.path;f.file.path='改名.md';f.files.delete(previous);f.files.set(f.file.path,f.file);f.emit('vault:rename',f.file,previous);if(f.modal.refreshTimer)clearTimeout(f.modal.refreshTimer);f.modal.drainRefresh();await tick();assert.equal(f.modal.path,'改名.md');assert.equal(f.modal.file,f.file);assert.equal(f.modal.selected.size,1);
 f.modal.onClose();assert.ok([...f.listeners.values()].every(list=>!list.length));assert.equal(f.modal.file,undefined);assert.equal(f.modal.selected.size,0);
});

const main=readFileSync('src/main.ts','utf8');
const playback=main.slice(main.indexOf('  async playYingjianTimestamp('),main.indexOf('  async openYingjianLink('));
const playbackDeps={parseYingjianLink,yingjianNotePath,TFile,isWorkspaceFile,isRecord,parseYaml,playInYingjianPlugin,hostPlugin:(app:any)=>app.player};
const Playback=new Function(...Object.keys(playbackDeps),transformSync('class Harness {'+playback+'}\nreturn Harness;',{loader:'ts'}).code)(...Object.values(playbackDeps));
function playbackFixture(){const f=fixture(),calls:any[]=[];const plugin=new Playback();plugin.app={...f.app,player:{videoApi:{version:1,async play(...args:any[]){calls.push(args);}}}};plugin.yingjianVaultId=()=>vaultId;return{...f,plugin,calls};}
test('native whiteboard timestamps deliver exact fractional time and source identity without opening external windows',async()=>{
 const f=playbackFixture();await f.plugin.playYingjianTimestamp(link);assert.deepEqual(f.calls,[[source,14.25,'课程.md',vaultId]]);
});
test('native timestamp playback rejects cross-vault, missing, mismatched and replaced source notes',async()=>{
 const cross=playbackFixture();await assert.rejects(()=>cross.plugin.playYingjianTimestamp(link.replace(vaultId,'11111111111111111111')),/其他仓库/);assert.equal(cross.calls.length,0);
 const missing=playbackFixture();missing.files.clear();await assert.rejects(()=>missing.plugin.playYingjianTimestamp(link),/来源笔记/);
 const changed=playbackFixture();changed.contents.set(changed.file,header.replace(source,'/other.mp4')+moment);await assert.rejects(()=>changed.plugin.playYingjianTimestamp(link),/来源已变化/);
 const replacement=playbackFixture();replacement.app.vault.read=async()=>{replacement.files.set(replacement.file.path,new TFile(replacement.file.path));return header+moment;};await assert.rejects(()=>replacement.plugin.playYingjianTimestamp(link),/来源已变化/);assert.equal(replacement.calls.length,0);
});
test('native bridge failure and bridge unload propagate without a desktop-player fallback',async()=>{
 const f=playbackFixture();f.plugin.app.player.videoApi.play=async()=>{throw Error('播放失败');};await assert.rejects(()=>f.plugin.playYingjianTimestamp(link),/播放失败/);delete f.plugin.app.player;await assert.rejects(()=>f.plugin.playYingjianTimestamp(link),/启用影笺/);
});
test('native playback accepts legal Obsidian frontmatter closing whitespace',async()=>{
 const f=playbackFixture();f.contents.set(f.file,header.replace('\n---\n','\n...  \n')+moment);await f.plugin.playYingjianTimestamp(link);assert.equal(f.calls.length,1);
});
const open=main.slice(main.indexOf('  async openYingjian(initial?'),main.indexOf('  async openExcerptNote('));
test('video import callbacks reject a receiver whose board session changed after opening',async()=>{
 let dialog:any;class Dialog{modalEl={isConnected:true};constructor(_app:any,public host:any,public done:()=>void){dialog=this;}open(){}close(){this.modalEl.isConnected=false;this.done();}}
 const deps={YingjianModal:Dialog,BoardView:class{},yingjianPlayerConnection,yingjianPlayerActions,hostCommands:()=>({listCommands:()=>[]}),hostPlugin:()=>undefined};
 const Harness=new Function(...Object.keys(deps),transformSync('class Harness {'+open+'}\nreturn Harness;',{loader:'ts'}).code)(...Object.values(deps));
 let inserts=0;const owner={file:new TFile('first.thoughtspace'),blocked:false},view={session:owner,closed:false,hasInlineEditor:false,prepareVideoBridge:async()=>{},addNotesFromHub:async()=>++inserts};
 const plugin=new Harness();plugin.app={workspace:{getActiveViewOfType:()=>view}};await plugin.openYingjian();view.session={...owner,file:new TFile('second.thoughtspace')};await assert.rejects(()=>dialog.host.addNote(new TFile('课程.md')),/白板或编辑状态已变化/);assert.equal(inserts,0);
});

test('rapid repeated video workspace entry reuses one modal after asynchronous editor preparation',async()=>{
 const dialogs:any[]=[];class Dialog{modalEl={isConnected:true};constructor(_app:any,public host:any,public done:()=>void){dialogs.push(this);}open(){}close(){this.modalEl.isConnected=false;this.done();}}
 const deps={YingjianModal:Dialog,BoardView:class{},yingjianPlayerConnection,yingjianPlayerActions,hostCommands:()=>({listCommands:()=>[]}),hostPlugin:()=>undefined};
 const Harness=new Function(...Object.keys(deps),transformSync('class Harness {'+open+'}\nreturn Harness;',{loader:'ts'}).code)(...Object.values(deps));
 let release!:()=>void;const pending=new Promise<void>(done=>release=done),owner={file:new TFile('工作台.thoughtspace'),blocked:false},view={session:owner,closed:false,hasInlineEditor:false,prepareVideoBridge:()=>pending};
 const plugin=new Harness();plugin.app={workspace:{getActiveViewOfType:()=>view}};const first=plugin.openYingjian(),second=plugin.openYingjian();release();await Promise.all([first,second]);assert.equal(dialogs.length,1);
});

import {videoCaptureRequest,videoCaptureContent,addVideoCaptureCard,addVideoCaptureObjects} from '../src/video-capture';
import {isYingjianCaptureNote} from '../src/yingjian';
import {emptyBoard} from '../src/model';
const receive=main.slice(main.indexOf('  private async receiveVideoCapture('),main.indexOf('  private yingjianVaultId('));
test('player delivery accepts parsed CRLF capture provenance and preserves card-reference fallback',async()=>{
 const deps={videoCaptureRequest,videoCaptureContent,addVideoCaptureCard,addVideoCaptureObjects,isYingjianCaptureNote,TFile,isWorkspaceFile,parseYaml,clone:structuredClone,BoardView:class{},VIEW:'thoughtspace-board'};
 const Harness=new Function(...Object.keys(deps),transformSync('class Harness {'+receive+'}\nreturn Harness;',{loader:'ts'}).code)(...Object.values(deps));
 const id='12345678-1234-1234-1234-123456789abc',boardFile=new TFile('工作台.thoughtspace'),noteFile=new TFile('记录.md');const files=new Map([[boardFile.path,boardFile],[noteFile.path,noteFile]]);
 const plugin=new Harness(),session={board:emptyBoard(),blocked:false,flush:async()=>{},change:(fn:()=>void)=>fn()};let released=0;
 plugin.app={vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async()=>`---\r\nyingjian-capture-id: '${id}'\r\n...  \r\n正文`},workspace:{getLeavesOfType:()=>[]}};
 plugin.yingjianVaultId=()=>vaultId;plugin.session=async()=>session;plugin.release=async()=>released++;
 await plugin.receiveVideoCapture({id,board:boardFile.path,note:noteFile.path,vaultId});assert.equal(session.board.nodes.length,1);assert.equal(session.board.nodes[0].file,noteFile.path);assert.equal(released,1);
});

const eventStart=main.indexOf("    this.registerDomEvent(this.stage,'click',e=>{\n      if(e.defaultPrevented||e.button!==0||!yingjianPlayerConnection"),eventEnd=main.indexOf('    const openStageLink=',eventStart);
function timestampEventFixture(){
 let handler!:Function,pending:Promise<unknown>|undefined;const plays:any[]=[];
 const register=main.slice(eventStart,eventEnd),deps={yingjianPlayerConnection,hostPlugin:(app:any)=>app.player,act:(action:()=>Promise<unknown>)=>{pending=action();}};
 const bind=new Function(...Object.keys(deps),transformSync('return function(){'+register+'};',{loader:'ts'}).code)(...Object.values(deps));
 const view={stage:{},app:{player:{videoApi:{version:1,play(){}}}},session:{board:{nodes:[{id:'capture',videoCapture:{note:'原始截图记录.md'}}]}},prepareVideoBridge:async()=>{},plugin:{playYingjianTimestamp:async(...args:any[])=>{plays.push(args);}},registerDomEvent:(_target:any,_event:string,fn:Function)=>handler=fn};bind.call(view);
 let editing=false;const a={getAttribute:()=>link,closest:(selector:string)=>selector==='[data-id]'?{getAttribute:()=> 'capture'}:editing?{}:null};
 const event={button:0,defaultPrevented:false,target:{closest:()=>a},preventDefault(){this.defaultPrevented=true;},stopPropagation(){}};
 return{view,event,plays,editing:()=>editing=true,dispatch:async()=>{handler(event);await pending;}};
}
test('whiteboard timestamp click uses its capture note after native bridge preparation',async()=>{
 const f=timestampEventFixture();await f.dispatch();assert.equal(f.event.defaultPrevented,true);assert.deepEqual(f.plays,[[link,'原始截图记录.md']]);
});
test('whiteboard timestamp handler leaves editor-owned or already-handled clicks alone',async()=>{
 for(const mode of ['editor','handled','right','missing'] as const){const f=timestampEventFixture();if(mode==='editor')f.editing();if(mode==='handled')f.event.defaultPrevented=true;if(mode==='right')f.event.button=2;if(mode==='missing')(f.view.app as any).player=undefined;await f.dispatch();assert.equal(f.plays.length,0);assert.equal(f.event.defaultPrevented,mode==='handled');}
});


test('renamed capture provenance recovers a stale timestamp URL only after checking the video source',async()=>{
 const f=playbackFixture(),old=f.file.path;f.files.delete(old);f.file.path='改名课程.md';f.files.set(f.file.path,f.file);
 await f.plugin.playYingjianTimestamp(link,f.file.path);assert.equal(f.calls.length,1);assert.equal(f.calls[0][2],f.file.path);
 f.contents.set(f.file,header.replace(source,'/其他课程.mp4')+moment);await assert.rejects(()=>f.plugin.playYingjianTimestamp(link,f.file.path),/来源已变化/);assert.equal(f.calls.length,1);
});
test('an explicitly unsafe timestamp note path cannot be rescued through card provenance',async()=>{
 const f=playbackFixture(),u=new URL(link);u.searchParams.set('note','../课程.md');await assert.rejects(()=>f.plugin.playYingjianTimestamp(u.toString(),f.file.path),/路径无效/);assert.equal(f.calls.length,0);
});
