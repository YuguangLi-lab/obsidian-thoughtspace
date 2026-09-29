import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {foldCards} from '../src/board-tools';
import {parseLayoutSnapshot} from '../src/layout-snapshot-data';
import {outlineTree} from '../src/group-organizer';
import {readingTitle} from '../src/reading-desk';
import {cardDisplayTitle} from '../src/card-title-model';

const source=readFileSync('src/main.ts','utf8');
const take=(a:string,b:string)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
function compile(body:string,deps:Record<string,unknown>){return new Function(...Object.keys(deps),transformSync(body,{loader:'ts'}).code)(...Object.values(deps));}
class TFile {extension='thoughtspace';parent={path:''};constructor(public path:string,public basename=path.replace(/\.[^.]+$/,'')){} }
const notices:string[]=[];
const base={...model,...mindmap,reflowReadingContent,foldCards,Notice:class{constructor(message:string){notices.push(message);}},report:()=>{},EXT:'thoughtspace',TFile};
const Session=compile(take('class Session {','\nexport default class ThoughtSpace')+';return Session',base);
const textNode=(id='one'):model.Card=>({id,kind:'text',text:'First',x:0,y:0,width:240,height:160,color:'sand'});
function board(){return {...model.emptyBoard(),version:3 as const,spaceId:'space-140',nodes:[textNode()]};}
function session(){const s=new Session({},new TFile('a.thoughtspace'),JSON.stringify(board()));s.persist=()=>{};return s;}

test('a redundant fold leaves redo available and creates no phantom undo entry',()=>{
 const s=session();s.change((b:model.Board)=>{b.nodes[0].text='Second';});s.undo();
 let emissions=0;s.listeners.add(()=>emissions++);
 s.change((b:model.Board)=>foldCards(b,new Set(['one']),false));
 assert.equal(s.history.undoStack.length,0);assert.equal(s.history.redoStack.length,1);assert.equal(emissions,0);
 s.undo(true);assert.equal(s.board.nodes[0].text,'Second');
});

const KeyView=compile(`class View{${take('  private key(e: KeyboardEvent)','  private matches(')}};return View`,base);
function keyFixture(target:any,key=' ',code='Space',prevented=false){
 let deleted=0,fit=0;const view=new KeyView();Object.assign(view,{selected:new Set(['one']),mode:'select',space:false,plugin:{settings:{}},deleteSelection:()=>deleted++,fit:()=>fit++});
 const event={target,key,code,defaultPrevented:prevented,preventDefault(){this.defaultPrevented=true;},stopPropagation(){}};
 return {view,event,deleted:()=>deleted,fit:()=>fit};
}
test('Space and Delete on toolbar controls do not activate board pan or delete the selection',()=>{
 for(const [key,code]of [[' ','Space'],['Delete','Delete']]){
  const target={closest:(selector:string)=>selector.includes('button')?target:null};const f=keyFixture(target,key,code);f.view.key(f.event);
  assert.equal(f.event.defaultPrevented,false);assert.equal(f.view.space,false);assert.equal(f.deleted(),0);
 }
});
test('events consumed by an inner keyboard handler cannot run canvas commands again',()=>{
 const f=keyFixture({closest:()=>null},'f','KeyF',true);f.view.key(f.event);assert.equal(f.fit(),0);
});
test('canvas shortcuts still pan and delete when the canvas owns the event',()=>{
 const target={closest:()=>null};const f=keyFixture(target);f.view.key(f.event);assert.equal(f.view.space,true);assert.equal(f.event.defaultPrevented,true);
 const d=keyFixture(target,'Delete','Delete');d.view.key(d.event);assert.equal(d.deleted(),1);
});

const Host=compile(`class Host{${take('  async saveLayoutSnapshot(','  async showSnapshots(')}${take('  async session(file:','  async boardGraph():')}${take('  hierarchy<T>','  async folder(')}};return Host`,{...base,Session,parseLayoutSnapshot});
function snapshotFixture(){
 const host=new Host(),file=new TFile('a.thoughtspace'),child=new TFile('b.thoughtspace');
 const current=board(),saved=board();saved.nodes[0].text='Historical content';
 const disk=new Map([[file.path,JSON.stringify(current)],[child.path,JSON.stringify({...board(),spaceId:'child'})]]),snapshots=new Map<string,string>([['snapshot.json',JSON.stringify({board:saved,label:'old'})]]);
 const files=new Map([[file.path,file],[child.path,child]]);
 Object.assign(host,{manifest:{id:'thoughtspace'},sessions:new Map(),hierarchyQueue:Promise.resolve(),app:{vault:{configDir:'.obsidian',getAbstractFileByPath:(p:string)=>files.get(p),read:async(f:TFile)=>disk.get(f.path)!,cachedRead:async(f:TFile)=>disk.get(f.path)!,process:async(f:TFile,fn:(s:string)=>string)=>{disk.set(f.path,fn(disk.get(f.path)!));},adapter:{mkdir:async()=>{},write:async(p:string,body:string)=>{snapshots.set(p,body);},read:async(p:string)=>snapshots.get(p)!}}}});
 host.layoutSnapshots=async()=>[{path:'snapshot.json'}];
 host.boardGraph=async()=>({graph:new Map([[file.path,model.boardLinks(await host.readBoard(file))],[child.path,model.boardLinks(await host.readBoard(child))]]),errors:new Set()});
 return {host,file,child,current,saved,disk,snapshots};
}
test('restoring old nested-board links refuses a newly created ancestor cycle',async()=>{
 const f=snapshotFixture();f.saved.nodes.push({...textNode('child'),kind:'board',file:f.child.path});f.snapshots.set('snapshot.json',JSON.stringify({board:f.saved}));
 f.disk.set(f.child.path,JSON.stringify({...board(),nodes:[{...textNode('parent'),kind:'board',file:f.file.path}]}));
 const original=f.disk.get(f.file.path);await assert.rejects(f.host.restoreLayoutSnapshot(f.file,'snapshot.json'),/循环|后代/);assert.equal(f.disk.get(f.file.path),original);
});
test('snapshot restore keeps one authoritative session when another view opens at commit',async()=>{
 const f=snapshotFixture(),s=await f.host.session(f.file),change=s.change.bind(s);let opened:Promise<any>|undefined;
 s.change=(...args:unknown[])=>{opened=f.host.session(f.file);return change(...args);};
 await f.host.restoreLayoutSnapshot(f.file,'snapshot.json');assert.ok(opened);const other=await opened;
 assert.equal(other,s);assert.equal(other.board.nodes[0].text,'Historical content');
});
test('ordinary snapshot restoration remains undoable and preserves note links',async()=>{
 const f=snapshotFixture(),s=await f.host.session(f.file);s.listeners.add(()=>{});await f.host.restoreLayoutSnapshot(f.file,'snapshot.json');
 assert.equal(s.board.nodes[0].text,'Historical content');s.undo();await s.flush();assert.equal(s.board.nodes[0].text,'First');
});

class Element {
 children:Element[]=[];text='';value='';disabled=false;style={setProperty(){}};attrs:Record<string,string>={};run?:()=>void;
 createDiv(opts:any={}){return this.createEl('div',opts);}createSpan(opts:any={}){return this.createEl('span',opts);}
 createEl(_tag:string,opts:any={}){const e=new Element();e.text=opts.text||'';this.children.push(e);return e;}
 setAttribute(k:string,v:string){this.attrs[k]=v;}toggleClass(){}querySelector(){return null;}
}
const outlineMethods=take('  private async buildSidebar(','    if (this.tab === \'boards\')')+'}\n'+take('  private foldText(','  private foldSelection(');
const OutlineView=compile(`class View{${outlineMethods}};return View`,{...base,outlineTree,readingTitle,cardDisplayTitle,button:(parent:Element,text:string,_icon:string,run:()=>void)=>{const el=parent.createEl('button',{text});el.run=run;return el;}});
function outlineFixture(){
 const v=new OutlineView(),b=board();b.nodes=[{...textNode(),kind:'card',title:'A local card title',file:'Original.md'}];const owner={board:b,blocked:false};const file=new TFile('Original.md','Original');
 Object.assign(v,{tab:'outline',session:owner,query:'',outlineKind:'all',outlineCollapsed:new Set(),selected:new Set(),positions:new Map(),app:{vault:{getAbstractFileByPath:()=>file}},renderSidebar:()=>{},mutate:(fn:(b:model.Board)=>void)=>fn(b),requireOwner:(expected=owner)=>{if(v.session!==expected)throw Error('白板已切换');return owner;}});
 const root=new Element();const all=(el:Element):Element[]=>[el,...el.children.flatMap(all)];return {v,b,root,all:()=>all(root)};
}
test('outline displays and searches a card local title instead of silently substituting the filename',async()=>{
 const f=outlineFixture();f.v.query='local card';await f.v.buildSidebar(f.root,1);assert.ok(f.all().some(e=>e.text==='A local card title'));assert.ok(!f.all().some(e=>e.text.startsWith('没有匹配')));
});
test('outline cannot collapse the card containing the active edit draft',async()=>{
 const f=outlineFixture();f.v.inlineId='one';await f.v.buildSidebar(f.root,1);f.all().find(e=>e.text==='折叠卡片')!.run!();assert.equal(f.b.nodes[0].collapsed,undefined);assert.equal(f.b.nodes[0].height,160);
});
test('a stale outline fold does not apply to a different board with the same node id',async()=>{
 const f=outlineFixture();await f.v.buildSidebar(f.root,1);f.v.session={board:board(),blocked:false};assert.throws(()=>f.all().find(e=>e.text==='折叠卡片')!.run!(),/切换/);assert.equal(f.b.nodes[0].collapsed,undefined);
});

const CreateView=compile(`class View{${take('  private async newCard(','  toggleMindmap()')}};return View`,base);
test('new note creation stops if the board changed while the previous inline draft was saving',async()=>{
 const view=new CreateView(),owner={blocked:false};let created=0;
 Object.assign(view,{session:owner,closed:false,requireOwner:(expected=owner)=>{if(view.session!==expected)throw Error('白板已切换');return owner;},inline:{commit:async()=>{view.session={};return true;}},plugin:{settings:{cardFolder:'Cards'},createUnique:async()=>{created++;return new TFile('Cards/Unwanted.md');}}});
 await assert.rejects(view.newCard({x:0,y:0}),/切换/);assert.equal(created,0);
});

test('snapshot restore rechecks child nesting after the automatic backup awaits disk',async()=>{
 const f=snapshotFixture();f.saved.nodes.push({...textNode('child'),kind:'board',file:f.child.path});f.snapshots.set('snapshot.json',JSON.stringify({board:f.saved}));const original=f.disk.get(f.file.path);
 const write=f.host.app.vault.adapter.write;
 f.host.app.vault.adapter.write=async(path:string,body:string)=>{await write(path,body);f.disk.set(f.child.path,JSON.stringify({...board(),nodes:[{...textNode('parent'),kind:'board',file:f.file.path}]}));};
 await assert.rejects(f.host.restoreLayoutSnapshot(f.file,'snapshot.json'),/循环|后代|变化/);assert.equal(f.disk.get(f.file.path),original);
});
test('snapshot reference recovery preserves the saved node type when the same id now has another kind',async()=>{
 const f=snapshotFixture(),oldFile='old.pdf',currentFile='new.md';f.saved.nodes=[{...textNode('one'),kind:'pdf',file:oldFile,pdfPage:7}];f.snapshots.set('snapshot.json',JSON.stringify({board:f.saved}));f.disk.set(f.file.path,JSON.stringify({...board(),nodes:[{...textNode('one'),kind:'card',file:currentFile}]}));
 const get=f.host.app.vault.getAbstractFileByPath;f.host.app.vault.getAbstractFileByPath=(path:string)=>path===currentFile?new TFile(currentFile):get(path);
 await f.host.restoreLayoutSnapshot(f.file,'snapshot.json');const restored=model.parseBoard(f.disk.get(f.file.path)!);assert.equal(restored.nodes[0].kind,'pdf');assert.equal(restored.nodes[0].file,oldFile);assert.equal(restored.nodes[0].pdfPage,7);
});
test('snapshot restoration reports a final persistence conflict instead of successful restore',async()=>{
 const f=snapshotFixture(),s=await f.host.session(f.file);s.listeners.add(()=>{});let recovery=0;f.host.createUnique=async()=>{recovery++;return {path:'recovery.thoughtspace'};};
 const process=f.host.app.vault.process;f.host.app.vault.process=async(file:TFile,fn:(body:string)=>string)=>{f.disk.set(file.path,f.disk.get(file.path)!+' ');return process(file,fn);};
 await assert.rejects(f.host.restoreLayoutSnapshot(f.file,'snapshot.json'),/保存|冲突|失败/);assert.equal(s.blocked,true);assert.equal(recovery,1);
});
