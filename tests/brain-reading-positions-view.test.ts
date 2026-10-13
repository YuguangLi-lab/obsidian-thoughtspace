import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board} from '../src/model';
import {createBoardMindmapState} from '../src/board-mindmap';
import * as positions from '../src/brain-reading-positions';

class El {
 children:El[]=[];parentElement?:El;attributes:Record<string,string>={};dataset:Record<string,string>={};classes=new Set<string>();text='';value='';disabled=false;onclick?:()=>void;oninput?:()=>void;onkeydown?:(event:any)=>void;
 constructor(readonly tag:string,readonly ownerDocument:Doc,options:any={}){if(typeof options==='string')options={cls:options};this.text=options.text||'';this.value=options.value||'';for(const name of (options.cls||'').split(' ').filter(Boolean))this.classes.add(name);for(const[key,value]of Object.entries(options.attr||{}))this.setAttribute(key,String(value));}
 get isConnected():boolean{return this.tag==='BODY'||!!this.parentElement?.isConnected;}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 createEl(tag:string,options:any={}){return this.appendChild(new El(tag.toUpperCase(),this.ownerDocument,options));}createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}
 appendChild(child:El){child.remove();child.parentElement=this;this.children.push(child);return child;}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=undefined;}
 empty(){for(const child of this.children)child.parentElement=undefined;this.children=[];this.text='';}setText(value:string){this.empty();this.text=value;}addClass(value:string){this.classes.add(value);}setAttribute(key:string,value:string){this.attributes[key]=value;if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value;}
 all():El[]{return this.children.flatMap(child=>[child,...child.all()]);}querySelectorAll(selector:string){return this.all().filter(child=>selector==='input'?child.tag==='INPUT':selector==='[data-brain-position-action]'?child.attributes['data-brain-position-action']!==undefined:false);}
 focus(){this.ownerDocument.activeElement=this;}click(){if(!this.disabled)this.onclick?.();}input(value:string){this.value=value;this.oninput?.();}
}
class Doc {
 body=new El('BODY',this);activeElement?:El;frames=new Map<number,()=>void>();sequence=0;
 defaultView={closed:false,requestAnimationFrame:(fn:()=>void)=>{const id=++this.sequence;this.frames.set(id,fn);return id;},cancelAnimationFrame:(id:number)=>this.frames.delete(id)};
 tick(){const frames=[...this.frames.values()];this.frames.clear();frames.forEach(frame=>frame());}
}
class Modal {
 containerEl:El;modalEl:El;contentEl:El;closed=0;
 constructor(app:{document:Doc}){this.containerEl=app.document.body.createDiv();this.modalEl=this.containerEl.createDiv();this.contentEl=this.modalEl.createDiv();}open(){(this as any).onOpen();}close(){this.closed++;(this as any).onClose();this.containerEl.remove();}
}
const source=readFileSync('src/brain-reading-positions-view.ts','utf8').replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'');
const deps={...positions,Modal,uid:()=>crypto.randomUUID(),bindBoardModalViewport:()=>()=>{},themeSurface:(el:El)=>el.addClass('ts-ui-modal')};
const View=new Function(...Object.keys(deps),transformSync(source+'\nreturn BrainReadingPositionsModal;',{loader:'ts'}).code)(...Object.values(deps));
const settle=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
function fixture(initial=true){
 const doc=new Doc(),board:Board={...emptyBoard(),version:3,presentation:'brain',brain:createBoardMindmapState('a'),nodes:[{id:'a',kind:'card',file:'Notes/A.md',title:'中心 A',x:0,y:0,width:100,height:80,color:'blue'}],brainViewport:{x:1.25,y:-5.5,zoom:.37}};
 if(initial)positions.addBrainReadingPosition(board,'r','旧名称',positions.captureBrainReadingPosition(board,board.brainViewport!));
 let valid=true,readOnly=false,key={},path='Brain.md',fail=false,wait:Promise<void>|undefined,watch:()=>void=()=>{},unwatched=0;const edits:any[]=[],restores:any[]=[],copies:string[]=[],returns:any[]=[];
 const host:any={document:doc,snapshot:()=>({board,key,path,readOnly}),current:()=>valid,capture:()=>positions.captureBrainReadingPosition(board,board.brainViewport!),watchInvalidation:(invalidate:()=>void)=>{watch=invalidate;return()=>unwatched++;},
 commit:async(edit:(board:Board)=>void,current:()=>boolean)=>{edits.push(edit);if(wait)await wait;if(!current())throw Error('操作已取消');if(fail)throw Error('保存失败，名称已保留');edit(board);},restore:async(id:string,expected:string,current:()=>boolean)=>{restores.push({id,expected,current});if(wait)await wait;if(current())positions.restoreBrainReadingPosition(board,id,expected);},copyLink:async(id:string,current:()=>boolean)=>{if(current())copies.push(id);},canReturn:()=>returns.length===0,returnOrigin:async(current:()=>boolean)=>{if(current())returns.push(1);}};
 const modal=new View({document:doc},host);modal.open();doc.tick();const root=modal.contentEl as El,input=(label:string)=>root.all().find(el=>el.tag==='INPUT'&&el.attributes['aria-label']===label)!,buttons=(label:string)=>root.all().filter(el=>el.tag==='BUTTON'&&el.textContent===label),button=(label:string)=>buttons(label)[0]!;
 return{doc,board,host,modal,root,input,button,buttons,edits,restores,copies,returns,get unwatched(){return unwatched;},setValid:(value:boolean)=>valid=value,setReadOnly:(value:boolean)=>readOnly=value,replaceOwner:()=>key={},renameFile:()=>path='Moved.md',setFailure:(value:boolean)=>fail=value,hold:(promise:Promise<void>)=>wait=promise,invalidate:()=>watch()};
}
test('manager shows the exact named center/depth/camera separately and save commits once without extra topbar',async()=>{
 const f=fixture(false);assert.match(f.root.textContent,/脑图阅读位置/);assert.match(f.root.textContent,/还没有/);assert.equal(f.doc.activeElement,f.input('新位置名称'));assert(f.button('保存当前位置').disabled);f.input('新位置名称').input('  研究入口  ');f.button('保存当前位置').click();f.button('保存当前位置').click();await settle();assert.equal(f.edits.length,1);assert.equal(f.board.brainReadingPositions![0].name,'研究入口');assert.match(f.root.textContent,/中心 A · 1 层 · 37%/);assert.equal(f.input('新位置名称').value,'');assert(f.modal.modalEl.classes.has('ts-ui-modal'));
});
test('failed creation and rename preserve exact local user drafts and retry without duplicate mutation',async()=>{
 const f=fixture();f.setFailure(true);f.input('新位置名称').input('未丢失的新位置');f.button('保存当前位置').click();await settle();assert.equal(f.input('新位置名称').value,'未丢失的新位置');assert.equal(f.board.brainReadingPositions!.length,1);assert.match(f.root.textContent,/保存失败/);assert(!f.input('新位置名称').disabled);
 f.input('位置名称：旧名称').input('未丢失的重命名');f.button('保存名称').click();await settle();assert.equal(f.input('位置名称：旧名称').value,'未丢失的重命名');assert.equal(f.board.brainReadingPositions![0].name,'旧名称');f.setFailure(false);f.button('保存名称').click();await settle();assert.equal(f.board.brainReadingPositions![0].name,'未丢失的重命名');assert(f.input('位置名称：未丢失的重命名'));
});
test('readonly, stale owner and navigation invalidation disable every mutation while closing remains available',async()=>{
 for(const invalidate of [(f:ReturnType<typeof fixture>)=>f.setReadOnly(true),(f:ReturnType<typeof fixture>)=>f.replaceOwner(),(f:ReturnType<typeof fixture>)=>f.renameFile(),(f:ReturnType<typeof fixture>)=>f.setValid(false),(f:ReturnType<typeof fixture>)=>f.invalidate()]){
  const f=fixture();invalidate(f);f.button('保存名称').click();await settle();assert.equal(f.edits.length,0);assert.equal(f.restores.length,0);assert(f.button('定位').disabled);assert(!f.button('关闭').disabled);f.button('关闭').click();assert.equal(f.unwatched,1);assert.equal(f.doc.frames.size,0);
 }
});
test('navigation away then return never resurrects a retained dialog action',async()=>{
 const f=fixture();f.setValid(false);f.invalidate();f.setValid(true);f.button('定位').click();await settle();assert.equal(f.restores.length,0);assert(f.button('定位').disabled);assert.match(f.root.textContent,/白板或页面已变化/);
});
test('closed or navigated modal invalidates an in-flight confirmation before async commit',async()=>{
 for(const exit of [(f:ReturnType<typeof fixture>)=>f.button('关闭').click(),(f:ReturnType<typeof fixture>)=>{f.setValid(false);f.invalidate();f.setValid(true);}]){
  const f=fixture();let resolve!:()=>void;f.hold(new Promise<void>(done=>resolve=done));f.input('位置名称：旧名称').input('不能迟到写入');f.button('保存名称').click();await settle();assert.equal(f.edits.length,1);exit(f);resolve();await settle();assert.equal(f.board.brainReadingPositions![0].name,'旧名称');
 }
});
test('update, copy and removal use current stable IDs and reviewed stamps without implicit restoration',async()=>{
 const f=fixture();f.button('复制位置链接').click();await settle();assert.deepEqual(f.copies,['r']);assert.equal(f.restores.length,0);f.board.brainViewport={x:500,y:700,zoom:1.25};f.button('用当前位置更新').click();await settle();assert.deepEqual(f.board.brainReadingPositions![0].viewport,f.board.brainViewport);assert.equal(f.restores.length,0);f.button('移除').click();await settle();assert.equal(f.board.brainReadingPositions!.length,0);assert.match(f.root.textContent,/还没有/);
});
test('restore and origin return are explicit single actions and close only the owned modal',async()=>{
 const f=fixture();f.button('定位').click();f.button('定位').click();await settle();assert.equal(f.restores.length,1);assert.equal(f.restores[0].id,'r');assert.equal(f.modal.closed,1);assert.equal(f.unwatched,1);
 const back=fixture();back.button('返回出发位置').click();await settle();assert.deepEqual(back.returns,[1]);assert.equal(back.modal.closed,1);
});
