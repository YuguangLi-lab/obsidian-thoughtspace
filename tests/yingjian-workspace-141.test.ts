import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve as resolvePath} from 'node:path';
import {transformSync} from 'esbuild';
import {isRecord} from '../src/value-guards';
import {isWorkspaceFile} from '../src/workspace';
import {yingjianMoments,yingjianNoteSource,yingjianNotePath,yingjianLink,parseYingjianLink} from '../src/yingjian';
import {isVaultMediaPath,mediaKind} from '../src/media-source';
import {mediaNoteDocument,mediaNoteSource} from '../src/media-notes';
const parseYaml=createRequire(import.meta.url)('js-yaml').load;
const source='/Vault/课程/示范.mp4',vaultId='abcdef0123456789abcd';
const link=yingjianLink(source,14.25,'课程.md',vaultId),moment=`[00:14](${link})`,header=`---\nsource: ${JSON.stringify(source)}\nvideo-note-id: course\n---\n`;
const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
class TFile{stat={mtime:1,size:100};constructor(public path='课程.md'){}get extension(){return this.path.split('.').at(-1)!;}get basename(){return this.path.replace(/\.[^.]+$/,'');}}
class FileSystemAdapter{constructor(private root='/Vault'){}getBasePath(){return this.root;}}
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
const playback=main.slice(main.indexOf('  private resolveLegacyMedia('),main.indexOf('  async openExcerptNote('));
const playbackDeps={parseYingjianLink,yingjianNotePath,TFile,isWorkspaceFile,isRecord,parseYaml,isVaultMediaPath,mediaKind,FileSystemAdapter,resolvePath,mediaNoteSource,window:{setTimeout:(fn:()=>void)=>setTimeout(fn,0)}};
const Playback=new Function(...Object.keys(playbackDeps),transformSync('class Harness {'+playback+'}\nreturn Harness;',{loader:'ts'}).code)(...Object.values(playbackDeps));
function playbackFixture(){const f=fixture(),calls:any[]=[];const plugin=new Playback(),media=new TFile('课程/示范.mp4');f.files.set(media.path,media);plugin.app=f.app;Object.assign(f.app.vault,{adapter:new FileSystemAdapter(),getName:()=> 'Vault',getFiles:()=>[...f.files.values()]});plugin.openMediaWorkspace=async(...args:any[])=>{calls.push(args);};plugin.yingjianVaultId=()=>vaultId;return{...f,plugin,calls,media};}
test('legacy timestamps open the native workspace at exact fractional time without an external plugin',async()=>{
 const f=playbackFixture();Object.defineProperty(f.plugin.app,'player',{get(){throw Error('external player must not be consulted');}});
 await f.plugin.playYingjianTimestamp(link);assert.deepEqual(f.calls,[[f.media,'tab',14.25]]);
});
test('native timestamp playback rejects cross-vault, missing, mismatched and replaced source notes',async()=>{
 const cross=playbackFixture();await assert.rejects(()=>cross.plugin.playYingjianTimestamp(link.replace(vaultId,'11111111111111111111')),/其他仓库/);assert.equal(cross.calls.length,0);
 const missing=playbackFixture();missing.files.clear();await assert.rejects(()=>missing.plugin.playYingjianTimestamp(link),/来源笔记/);
 const changed=playbackFixture();changed.contents.set(changed.file,header.replace(source,'/other.mp4')+moment);await assert.rejects(()=>changed.plugin.playYingjianTimestamp(link),/来源已变化/);
 const replacement=playbackFixture();replacement.app.vault.read=async()=>{replacement.files.set(replacement.file.path,new TFile(replacement.file.path));return header+moment;};await assert.rejects(()=>replacement.plugin.playYingjianTimestamp(link),/来源已变化/);assert.equal(replacement.calls.length,0);
});
test('native workspace failure propagates without a desktop-player fallback',async()=>{
 const f=playbackFixture();f.plugin.openMediaWorkspace=async()=>{throw Error('播放失败');};await assert.rejects(()=>f.plugin.playYingjianTimestamp(link),/播放失败/);assert.equal(f.calls.length,0);
});
test('native playback accepts legal Obsidian frontmatter closing whitespace',async()=>{
 const f=playbackFixture();f.contents.set(f.file,header.replace('\n---\n','\n...  \n')+moment);await f.plugin.playYingjianTimestamp(link);assert.equal(f.calls.length,1);
});
test('legacy source resolution accepts only exact current-vault file identities',()=>{
 const f=playbackFixture();assert.equal(f.plugin.resolveLegacyMedia(source),f.media);assert.equal(f.plugin.resolveLegacyMedia(f.media.path),f.media);
 for(const value of ['/Elsewhere/课程/示范.mp4','/Vault-other/课程/示范.mp4','/Vault/课程/../课程/示范.mp4','../课程/示范.mp4','示范.mp4','file:///Vault/课程/示范.mp4','https://example.com/示范.mp4'])assert.throws(()=>f.plugin.resolveLegacyMedia(value),/当前仓库/,value);
 const excluded=new TFile('ThoughtSpace-plugin-backups/saved.mp4');f.files.set(excluded.path,excluded);assert.throws(()=>f.plugin.resolveLegacyMedia(excluded.path),/当前仓库/);
 (f.plugin.app.vault as any).adapter={};assert.equal(f.plugin.resolveLegacyMedia(f.media.path),f.media);assert.throws(()=>f.plugin.resolveLegacyMedia(source),/当前仓库/);
});
test('legacy entry opens native media from original or current source notes and opens the library without one',async()=>{
 const f=playbackFixture();await f.plugin.openYingjian(f.file);assert.deepEqual(f.calls,[[f.media,'tab']]);
 f.contents.set(f.file,mediaNoteDocument(f.media.path));await f.plugin.openYingjian(f.file);assert.deepEqual(f.calls[1],[f.media,'tab']);
 await f.plugin.openYingjian();assert.deepEqual(f.calls[2],[]);f.plugin.mediaClosed=true;await f.plugin.openYingjian(f.file);assert.equal(f.calls.length,3);
});
test('legacy source note reads reject replacement, rename, oversize and metadata retargeting',async()=>{
 for(const mode of ['replace','rename','oversize','retarget'] as const){
  const f=playbackFixture();if(mode==='oversize')f.file.stat.size=2*1024*1024+1;
  f.app.vault.read=async()=>{if(mode==='replace')f.files.set(f.file.path,new TFile(f.file.path));if(mode==='rename'){f.files.delete(f.file.path);f.file.path='renamed.md';f.files.set(f.file.path,f.file);}return mode==='retarget'?header.replace(source,'/Elsewhere/课程/示范.mp4'):header+moment;};
  await assert.rejects(()=>f.plugin.openYingjian(f.file));assert.equal(f.calls.length,0,mode);
 }
});
test('legacy entry and timestamp reject a same-object source edit while its old read is pending',async()=>{
 for(const entry of ['open','timestamp'] as const)for(const changed of ['mtime','size'] as const){
  const f=playbackFixture();let release!:(raw:string)=>void;f.app.vault.read=()=>new Promise<string>(resolve=>release=resolve);
  const pending=entry==='open'?f.plugin.openYingjian(f.file):f.plugin.playYingjianTimestamp(link);
  f.file.stat[changed]++;release(header+moment);
  await assert.rejects(()=>pending,/变化/);assert.equal(f.calls.length,0,`${entry} ${changed}`);
 }
});
test('legacy note entry refuses binary media before reading it as Markdown',async()=>{
 const f=playbackFixture();let reads=0;f.app.vault.read=async()=>{reads++;return header+moment;};
 await assert.rejects(()=>f.plugin.openYingjian(f.media));assert.equal(reads,0);assert.equal(f.calls.length,0);
});
test('legacy entry validates vault name, vault hash and note path before the native workspace opens',async()=>{
 const f=playbackFixture();await f.plugin.openYingjianLink({note:f.file.path,vault:'Vault',vaultId});assert.deepEqual(f.calls,[[f.media,'tab']]);
 for(const params of [{note:f.file.path,vault:'other'},{note:f.file.path,vaultId:'00000000000000000000'},{note:'../课程.md'},{note:'media.mp4'}])await assert.rejects(()=>f.plugin.openYingjianLink(params),/无效/);
 assert.equal(f.calls.length,1);
});
test('ambiguous, foreign and missing media timestamp sources cannot fall through to an external player',async()=>{
 for(const href of [link+'&t=15',link+'&video='+encodeURIComponent('/other.mp4'),link+'&extra=x',link+'#other']){const f=playbackFixture();await assert.rejects(()=>f.plugin.playYingjianTimestamp(href),/无效/);assert.equal(f.calls.length,0);}
 const missing=playbackFixture();missing.files.delete(missing.media.path);await assert.rejects(()=>missing.plugin.playYingjianTimestamp(link),/当前仓库/);assert.equal(missing.calls.length,0);
 const external=playbackFixture(),other='/Elsewhere/课程/示范.mp4';external.contents.set(external.file,header.replace(source,other));await assert.rejects(()=>external.plugin.playYingjianTimestamp(yingjianLink(other,2,external.file.path,vaultId)),/当前仓库/);assert.equal(external.calls.length,0);
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

const eventEnd=main.indexOf('    const openStageLink='),eventStart=main.lastIndexOf("    this.registerDomEvent(this.stage,'click',e=>{",eventEnd);
function timestampEventFixture(){
 let handler!:Function,pending:Promise<unknown>|undefined;const plays:any[]=[];
 const register=main.slice(eventStart,eventEnd),deps={act:(action:()=>Promise<unknown>)=>{pending=action();}};
 const bind=new Function(...Object.keys(deps),transformSync('return function(){'+register+'};',{loader:'ts'}).code)(...Object.values(deps));
 let prepared=false;const view={stage:{},app:{},session:{board:{nodes:[{id:'capture',videoCapture:{note:'原始截图记录.md'}}]}},prepareVideoBridge:async()=>{prepared=true;},plugin:{playYingjianTimestamp:async(...args:any[])=>{assert(prepared);plays.push(args);}},registerDomEvent:(_target:any,_event:string,fn:Function)=>handler=fn};bind.call(view);
 let editing=false;const a={getAttribute:()=>link,closest:(selector:string)=>selector==='[data-id]'?{getAttribute:()=> 'capture'}:editing?{}:null};
 const event={button:0,defaultPrevented:false,target:{closest:()=>a},preventDefault(){this.defaultPrevented=true;},stopPropagation(){}};
 return{view,event,plays,editing:()=>editing=true,dispatch:async()=>{handler(event);await pending;}};
}
test('whiteboard timestamp click uses its capture note with no external player installed',async()=>{
 const f=timestampEventFixture();await f.dispatch();assert.equal(f.event.defaultPrevented,true);assert.deepEqual(f.plays,[[link,'原始截图记录.md']]);
});
test('whiteboard timestamp handler leaves editor-owned or already-handled clicks alone',async()=>{
 for(const mode of ['editor','handled','right'] as const){const f=timestampEventFixture();if(mode==='editor')f.editing();if(mode==='handled')f.event.defaultPrevented=true;if(mode==='right')f.event.button=2;await f.dispatch();assert.equal(f.plays.length,0);assert.equal(f.event.defaultPrevented,mode==='handled');}
});


test('renamed capture provenance recovers a stale timestamp URL only after checking the video source',async()=>{
 const f=playbackFixture(),old=f.file.path;f.files.delete(old);f.file.path='改名课程.md';f.files.set(f.file.path,f.file);
 await f.plugin.playYingjianTimestamp(link,f.file.path);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],[f.media,'tab',14.25]);
 f.contents.set(f.file,header.replace(source,'/其他课程.mp4')+moment);await assert.rejects(()=>f.plugin.playYingjianTimestamp(link,f.file.path),/来源已变化/);assert.equal(f.calls.length,1);
});
test('an explicitly unsafe timestamp note path cannot be rescued through card provenance',async()=>{
 const f=playbackFixture(),u=new URL(link);u.searchParams.set('note','../课程.md');await assert.rejects(()=>f.plugin.playYingjianTimestamp(u.toString(),f.file.path),/路径无效/);assert.equal(f.calls.length,0);
});
