import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {createHandwritingBoard} from '../src/handwriting-board';
import {createMarkdownBoardDocument} from '../src/board-document';
import {compareBoardConflictVersions,readBoardConflictFile,sameBoardConflictSnapshot,validateBoardConflictOpen,type BoardConflictCompareInput,type BoardConflictCompareSource,type BoardConflictFile} from '../src/board-conflict-compare-model';
import * as comparison from '../src/board-conflict-compare-model';
import type {InkStroke} from '../src/ink-model';

const yaml=(text:string)=>{if(text.includes('bad: [broken'))throw Error('Synthetic invalid YAML');return text.includes('thoughtspace: board')?{thoughtspace:'board'}:{};};
const stroke:InkStroke={id:'ink-1',color:'#315e9b',width:3,points:[[1,2,.5],[20,40,.6],[40,80,.8]]};
function raw(format='md',mutate?:(board:ReturnType<typeof createHandwritingBoard>)=>void){
 const board=createHandwritingBoard();board.ink!.strokes=[structuredClone(stroke)];board.nodes=[{id:'a',kind:'text',text:'original text',x:0,y:0,width:200,height:100,color:'sand'}];mutate?.(board);
 return format==='md'?createMarkdownBoardDocument(board,'Synthetic').replace('thoughtspace: board','thoughtspace: board\nunknown_property:\n  user_value: retained')+'\nOriginal native body\n':JSON.stringify(board,null,2);
}
function source(kind:BoardConflictCompareSource['kind'],text=raw(),extra:Partial<BoardConflictCompareSource>={}):BoardConflictCompareSource{return{kind,path:kind==='recovery'?'Synthetic-恢复草稿.md':'Synthetic.md',extension:'md',source:text,...extra};}
function input(local=raw(),original=raw(),recovery?:BoardConflictCompareSource):BoardConflictCompareInput{return{original:source('original',original),local:source('local',local),...(recovery?{recovery}:{})};}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>resolve=done);return{promise,resolve};}

for(const format of ['md','thoughtspace'])test(`${format}: same source is distinct from same parsed content and is never mutated`,()=>{
 const text=raw(format),fixture={original:source('original',text,{extension:format}),local:source('local',text,{extension:format})},before=JSON.stringify(fixture),result=compareBoardConflictVersions(fixture,yaml);
 assert.equal(result.pairs[0].sameBytes,true);assert.equal(result.pairs[0].sameContent,true);assert.deepEqual(result.sources[0].counts,{nodes:1,edges:0,strokes:1,points:3});assert.equal(JSON.stringify(fixture),before);
 if(format==='thoughtspace'){fixture.local.source=JSON.stringify(JSON.parse(text));const different=compareBoardConflictVersions(fixture,yaml);assert.equal(different.pairs[0].sameBytes,false);assert.equal(different.pairs[0].sameContent,true);}
});
test('same counts still reveal node content, ink point, width and camera changes',()=>{
 const local=raw('md',board=>{board.nodes[0].text='local changed text';board.ink!.strokes[0].points[1]=[21,40,.6];board.ink!.strokes[0].width=5;board.viewport.x=200;});
 const result=compareBoardConflictVersions(input(local),yaml),pair=result.pairs[0];assert.deepEqual(result.sources[0].counts,result.sources[1].counts);assert.equal(pair.sameContent,false);assert.equal(pair.nodes!.modified,1);assert.equal(pair.strokes!.modified,1);
 assert.deepEqual(pair.nodes!.changes[0].fields,[{field:'text',before:'original text',after:'local changed text'}]);assert.ok(pair.strokes!.changes[0].fields.some(change=>change.field.includes('差异点 2')&&change.before==='3 点；[20,40,0.6]'&&change.after==='3 点；[21,40,0.6]'));assert.ok(pair.settings.some(change=>change.field==='viewport'));
});
test('native unknown YAML, body and envelope fields remain visible and byte-exact',()=>{
 const original=raw().replace('"version": 1,\n  "board"','"version": 1,\n  "unknownEnvelope": {"source": "original"},\n  "board"');
 const local=original.replace('user_value: retained','user_value: different').replace('Original native body','Local native body').replace('"source": "original"','"source": "local"');const fixture=input(local,original),before=structuredClone(fixture),pair=compareBoardConflictVersions(fixture,yaml).pairs[0];
 assert.ok(pair.yaml?.before.includes('retained'));assert.ok(pair.yaml?.after.includes('different'));assert.equal(pair.body?.before,'Original native body');assert.equal(pair.body?.after,'Local native body');assert.equal(pair.envelope[0].field,'unknownEnvelope');assert.deepEqual(fixture,before);
});
test('additions, removals, modified edges and shared-ID draw order are counted separately',()=>{
 const original=raw('md',board=>{board.nodes.push({...board.nodes[0],id:'b',text:'b'},{...board.nodes[0],id:'c',text:'c'});board.edges=[{id:'e',from:'a',to:'b',label:'old'}];board.ink!.strokes.push({...structuredClone(stroke),id:'ink-2'});});
 const local=raw('md',board=>{board.nodes.push({...board.nodes[0],id:'b',text:'b'},{...board.nodes[0],id:'new',text:'added'});board.nodes.reverse();board.edges=[{id:'e',from:'a',to:'b',label:'new'}];board.ink!.strokes.push({...structuredClone(stroke),id:'ink-2'});board.ink!.strokes.reverse();});
 const pair=compareBoardConflictVersions(input(local,original),yaml).pairs[0];assert.equal(pair.nodes!.added,1);assert.equal(pair.nodes!.removed,1);assert.equal(pair.nodes!.modified,0);assert.equal(pair.nodes!.orderChanged,true);assert.equal(pair.edges!.modified,1);assert.equal(pair.strokes!.orderChanged,true);
});
for(const invalid of ['bad: [broken','missing-layout','legacy-broken'])test(`unparseable original ${invalid} is unavailable for content counts but keeps exact original text`,()=>{
 const text=invalid==='bad: [broken'?raw().replace('user_value: retained','bad: [broken'):invalid==='legacy-broken'?'{"broken":true}':'---\nthoughtspace: board\n---\nNo layout';
 const fixture=input(raw(),text);if(invalid==='legacy-broken')fixture.original.extension='thoughtspace';const result=compareBoardConflictVersions(fixture,yaml);assert.equal(result.sources[0].status,'invalid');assert.equal(result.sources[0].counts,undefined);assert.equal(result.pairs[0].available,false);assert.equal(fixture.original.source,text);assert.equal(result.sources[1].status,'readable');
});
test('missing or unreadable recovery never disguises the in-memory local version as saved',()=>{
 const fixture=input(raw(),raw(),source('recovery',undefined,{source:undefined,error:'Synthetic recovery storage full'})),result=compareBoardConflictVersions(fixture,yaml);assert.equal(result.sources[1].status,'readable');assert.equal(result.sources[2].status,'unavailable');assert.equal(result.sources[2].counts,undefined);assert.equal(result.pairs[1].available,false);assert.equal(result.pairs[1].error,'Synthetic recovery storage full');assert.equal(compareBoardConflictVersions(input(),yaml).sources.length,2);
});
test('raw unknown board and ink metadata changes survive schema normalization in comparison',()=>{
 const before=raw('thoughtspace'),board=JSON.parse(before);board.userFutureField={preserve:true};board.ink.futurePressure={kind:'custom'};const fixture={original:source('original',before,{extension:'thoughtspace'}),local:source('local',JSON.stringify(board),{extension:'thoughtspace'})};const pair=compareBoardConflictVersions(fixture,yaml).pairs[0];assert.ok(pair.settings.some(change=>change.field==='userFutureField'));assert.ok(pair.settings.some(change=>change.field==='ink.futurePressure'));
});
test('bounded previews retain complete actual difference counts',()=>{
 const text=raw('md',board=>{board.nodes=Array.from({length:1000},(_,index)=>({...board.nodes[0],id:`n${index}`,text:`Text ${index}`}));});
 const local=text.replaceAll('"text": "Text ','"text": "Edited '),result=compareBoardConflictVersions(input(local,text),yaml);assert.equal(result.pairs[0].nodes!.modified,1000);assert.equal(result.pairs[0].nodes!.changes.length,12);assert.equal(result.sources[0].counts!.nodes,1000);
});
test('snapshot equality includes exact bytes, file identity, path, timestamp and recovery presence',()=>{
 const fixture=input(),copy=structuredClone(fixture);assert.equal(sameBoardConflictSnapshot(fixture,copy),true);
 for(const changed of [input(raw().replace('retained','changed')),input(raw(),raw().replace('retained','changed')),input(raw(),raw(),source('recovery'))])assert.equal(sameBoardConflictSnapshot(fixture,changed),false);
 const identity={};fixture.original.identity=identity;copy.original.identity={};assert.equal(sameBoardConflictSnapshot(fixture,copy),false);copy.original.identity=identity;assert.equal(sameBoardConflictSnapshot(fixture,copy),true);copy.original.mtime=1;assert.equal(sameBoardConflictSnapshot(fixture,copy),false);copy.original.mtime=undefined;copy.original.path='renamed.md';assert.equal(sameBoardConflictSnapshot(fixture,copy),false);
});
function vaultFixture(){const file:BoardConflictFile={path:'Synthetic.md',extension:'md',stat:{mtime:100}},files=new Map<string,object>([[file.path,file]]);let disk=raw(),reads=0;const gate=deferred<string>();let paused=false;const vault={getAbstractFileByPath:(path:string)=>files.get(path),read:async()=>{reads++;return paused?gate.promise:disk;}};return{file,files,vault,gate,reads:()=>reads,setDisk:(source:string)=>disk=source,pause:()=>paused=true};}
test('a real file snapshot validates without writing and refuses a changed source',async()=>{
 const f=vaultFixture(),snapshot=await readBoardConflictFile(f.vault,f.file,'original');assert.equal(snapshot.source,raw());assert.equal(snapshot.mtime,100);assert.equal(snapshot.identity,f.file);assert.equal(await validateBoardConflictOpen(f.vault,snapshot,()=>true),true);f.setDisk(raw().replace('retained','changed'));assert.equal(await validateBoardConflictOpen(f.vault,snapshot,()=>true),false);
});
for(const boundary of ['replacement','rename','mtime','removed'])test(`read-time ${boundary} is not returned as the previous file version`,async()=>{
 const f=vaultFixture();f.pause();const pending=readBoardConflictFile(f.vault,f.file,'original');if(boundary==='replacement')f.files.set('Synthetic.md',{path:'Synthetic.md'});else if(boundary==='rename')f.file.path='Other.md';else if(boundary==='mtime')f.file.stat!.mtime=101;else f.files.clear();f.gate.resolve(raw());const result=await pending;assert.equal(result.source,undefined);assert.ok(result.error);assert.equal(result.path,'Synthetic.md');
});
test('replacement before reading and read rejection keep the file unavailable',async()=>{
 const f=vaultFixture();f.files.clear();assert.match((await readBoardConflictFile(f.vault,f.file,'original')).error!,/替换/);assert.equal(f.reads(),0);f.files.set(f.file.path,f.file);const rejected={...f.vault,read:async()=>{throw Error('Synthetic vault offline');}};assert.equal((await readBoardConflictFile(rejected,f.file,'original')).error,'Synthetic vault offline');
});
test('navigation during validation and recovery replacement invalidate open without a write',async()=>{
 const f=vaultFixture(),snapshot=await readBoardConflictFile(f.vault,f.file,'recovery');let current=true;f.pause();const pending=validateBoardConflictOpen(f.vault,snapshot,()=>current);current=false;f.gate.resolve(raw());assert.equal(await pending,false);assert.equal(await validateBoardConflictOpen(f.vault,{...snapshot,kind:'local'},()=>true),false);f.files.set(f.file.path,{...f.file});assert.equal(await validateBoardConflictOpen(f.vault,snapshot,()=>true),false);
});

class Element {
 children:Element[]=[];parent?:Element;textContent='';disabled=false;dataset:Record<string,string>={};classes=new Set<string>();attributes:Record<string,string>={};onclick?:()=>void;
 constructor(public ownerDocument:Doc,readonly tag='div'){}
 get isConnected():boolean{return this.tag==='body'||!!this.parent?.isConnected;}
 appendChild(child:Element){child.remove();child.parent=this;const adopt=(value:Element)=>{value.ownerDocument=this.ownerDocument;for(const nested of value.children)adopt(nested);};adopt(child);this.children.push(child);return child;}
 createEl(tag:string,options:{cls?:string;text?:string;attr?:Record<string,string>}|string={}){const el=new Element(this.ownerDocument,tag);if(typeof options==='string')el.addClass(options);else{if(options.cls)el.addClass(options.cls);el.textContent=options.text||'';for(const [key,value]of Object.entries(options.attr||{}))el.setAttribute(key,value);}this.appendChild(el);return el;}
 createDiv(options?:Parameters<Element['createEl']>[1]){return this.createEl('div',options);}
 createSpan(options?:Parameters<Element['createEl']>[1]){return this.createEl('span',options);}
 addClass(...names:string[]){for(const name of names.flatMap(value=>value.split(' ')))this.classes.add(name);}
 setText(value:string){this.textContent=value;}
 setAttribute(key:string,value:string){this.attributes[key]=value;}
 empty(){for(const child of [...this.children])child.remove();}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;}
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
 querySelectorAll(selector:string){return this.all().filter(element=>element!==this&&element.tag===selector);}
}
class Doc {body=new Element(this,'body');defaultView={closed:false};}
function modalFixture(popout=false,initial=input(),initialReadPaused=false){
 const defaultDoc=new Doc(),sourceDoc=popout?new Doc():defaultDoc;let fixture=initial,current=true,reads=0,closed=0,copies=0,readFailure='',gate=initialReadPaused?deferred<BoardConflictCompareInput>():undefined;const opened:BoardConflictCompareSource[]=[],viewport:Element[]=[],disposals:Element[]=[];
 class Modal {containerEl=defaultDoc.body.createDiv();modalEl=this.containerEl.createDiv();titleEl=this.modalEl.createEl('h2');contentEl=this.modalEl.createDiv();isClosed=false;open(){(this as any).onOpen();}close(){if(this.isClosed)return;this.isClosed=true;(this as any).onClose();this.containerEl.remove();}}
 const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/board-conflict-compare.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{
  if(name==='obsidian')return{Modal,parseYaml:yaml};if(name==='./board-modal-viewport')return{bindBoardModalViewport:(root:Element)=>{viewport.push(root);return()=>disposals.push(root);}};if(name==='./ui-tokens')return{themeSurface:()=>{}};if(name==='./board-conflict-compare-model')return comparison;throw Error(`Unexpected dependency ${name}`);
 },module,module.exports);
 const host={document:sourceDoc as unknown as Document,name:'Synthetic',current:()=>current,read:async()=>{reads++;if(readFailure)throw Error(readFailure);return gate?gate.promise:fixture;},open:async(source:BoardConflictCompareSource)=>{opened.push(source);},copyLocal:()=>copies++,closed:()=>closed++};const modal=new module.exports.BoardConflictCompareModal({},host);modal.open();
 const button=(name:string)=>{const found=modal.modalEl.all().find((el:Element)=>el.tag==='button'&&el.textContent===name);assert.ok(found,name);return found as Element;};
 return{modal,button,opened,viewport,disposals,sourceDoc,reads:()=>reads,copies:()=>copies,closed:()=>closed,set:(value:BoardConflictCompareInput)=>fixture=value,fail:(message:string)=>readFailure=message,invalidate:()=>current=false,pause:()=>{gate??=deferred<BoardConflictCompareInput>();return gate;},text:()=>modal.contentEl.all().map((element:Element)=>element.textContent).join('\n')};
}
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('modal sources are truthful, use owner-window viewport and keep failure copy available',async()=>{
 const f=modalFixture(true);await tick();assert.equal(f.modal.containerEl.ownerDocument,f.sourceDoc);assert.equal(f.viewport[0],f.modal.containerEl);assert.equal(f.viewport[0].ownerDocument,f.sourceDoc);assert.match(f.text(),/未确认已保存至原文件/);assert.match(f.text(),/恢复文件尚未保存/);assert.equal(f.modal.contentEl.all().some((el:Element)=>el.textContent==='打开恢复草稿'),false);f.button('复制本地内容').onclick!();assert.equal(f.copies(),1);assert.equal(f.closed(),1);assert.equal(f.disposals.length,1);assert.equal(f.opened.length,0);
});
test('changed version refreshes visible comparison and requires a second explicit activation',async()=>{
 const f=modalFixture();await tick();f.set(input(raw().replace('retained','local changed')));f.button('打开原文件').onclick!();await tick();assert.equal(f.opened.length,0);assert.match(f.text(),/版本已发生变化/);assert.match(f.text(),/local changed/);f.button('打开原文件').onclick!();await tick();assert.equal(f.opened.length,1);assert.equal(f.closed(),1);
});
test('rapid activation while rereading opens the exact recovery snapshot once',async()=>{
 const f=modalFixture(false,input(raw(),raw(),source('recovery')));await tick();const gate=f.pause(),button=f.button('打开恢复草稿');button.onclick!();button.onclick!();assert.equal(f.reads(),2);assert.equal(button.disabled,true);gate.resolve(input(raw(),raw(),source('recovery')));await tick();assert.equal(f.opened.length,1);assert.equal(f.opened[0].kind,'recovery');assert.equal(f.closed(),1);
});
for(const boundary of ['navigation','window','cancel'])test(`modal ${boundary} during action read prevents late open and late copy`,async()=>{
 const f=modalFixture();await tick();const oldCopy=f.button('复制本地内容').onclick!,gate=f.pause();f.button('打开原文件').onclick!();if(boundary==='navigation')f.invalidate();else if(boundary==='window')f.sourceDoc.defaultView.closed=true;else f.modal.close();gate.resolve(input());await tick();oldCopy();assert.equal(f.opened.length,0);assert.equal(f.copies(),0);if(boundary!=='cancel')f.modal.close();assert.equal(f.closed(),1);assert.equal(f.disposals.length,1);
});
test('recovery read failure never shows made-up source counts and close stays available',async()=>{
 const f=modalFixture(),gate=f.pause();await tick();f.button('重新读取').onclick!();gate.resolve(input(raw(),raw(),source('recovery',raw(),{source:undefined,error:'Backup failed'})));await tick();assert.match(f.text(),/Backup failed/);assert.equal(f.modal.contentEl.all().some((element:Element)=>element.textContent==='打开恢复草稿'),false);f.button('关闭').onclick!();assert.equal(f.closed(),1);
});
test('a failed action reread keeps the current comparison and both files protected',async()=>{
 const f=modalFixture();await tick();f.fail('Synthetic vault unavailable');f.button('打开原文件').onclick!();await tick();assert.equal(f.opened.length,0);assert.match(f.text(),/未打开：Synthetic vault unavailable/);assert.match(f.text(),/节点 1/);f.button('关闭').onclick!();assert.equal(f.closed(),1);
});
test('a saved recovery with older contents is explicitly distinct from the current local version',async()=>{
 const f=modalFixture(false,input(raw().replace('retained','new local'),raw(),source('recovery')));await tick();assert.match(f.text(),/恢复草稿文件与当前本地内容不同/);assert.match(f.text(),/已保存恢复草稿/);assert.match(f.text(),/未确认已保存至原文件/);f.modal.close();
});
test('initial pending read can be explicitly closed without waiting or late display',async()=>{
 const f=modalFixture(false,input(),true),gate=f.pause();assert.equal(f.button('关闭').disabled,false);f.button('关闭').onclick!();gate.resolve(input());await tick();assert.equal(f.closed(),1);assert.equal(f.text(),'');assert.equal(f.opened.length,0);assert.equal(f.disposals.length,1);
});
test('a read detecting file-owner invalidation closes a stale surface and cannot reactivate it',async()=>{
 const f=modalFixture(false,input(),true),gate=f.pause();f.invalidate();gate.resolve(input());await tick();assert.equal(f.closed(),1);assert.equal(f.text(),'');assert.equal(f.opened.length,0);
});
test('safe CSS bounds the viewport and makes action targets at least 44 pixels',()=>{
 const css=readFileSync('src/board-conflict-compare.css','utf8');assert.match(css,/--ts-visible-height/);assert.match(css,/safe-area-inset-bottom/);assert.match(css,/overflow:auto/);assert.match(css,/min-height:44px;min-width:44px/);assert.match(css,/white-space:normal/);
});
