import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

function fixture(){
 let next=0,accepted=0,editorBegins=0;
 const frames=new Map<number,()=>void>(),timers=new Map<number,()=>void>();
 class Style{values=new Map<string,[string,string]>();getPropertyValue(key:string){return this.values.get(key)?.[0]||'';}getPropertyPriority(key:string){return this.values.get(key)?.[1]||'';}setProperty(key:string,value:string,priority=''){this.values.set(key,[value,priority]);}removeProperty(key:string){this.values.delete(key);}}
 class Element extends EventTarget{classes=new Set<string>();hasClass(name:string){return this.classes.has(name);}addClass(name:string){this.classes.add(name);}removeClass(name:string){this.classes.delete(name);}instanceOf(type:unknown){return type===Element;}style=new Style();children:Element[]=[];ownerDocument:any;destination=false;closest(){return this.destination?this:null;}}
 const doc=new EventTarget() as EventTarget & {defaultView:any};
 const win=Object.assign(new EventTarget(),{Element,HTMLElement:Element,requestAnimationFrame:(run:()=>void)=>{frames.set(++next,run);return next;},cancelAnimationFrame:(id:number)=>frames.delete(id),setTimeout:(run:()=>void)=>{timers.set(++next,run);return next;},clearTimeout:(id:number)=>timers.delete(id)});doc.defaultView=win;
 const container=new Element(),child=new Element();container.ownerDocument=doc;container.children.push(child);
 const text=readFileSync('src/database-note-drag.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const api=new Function('Element','CARD_INSERT_MIME','cancelCardInsertDrag','beginCardInsertDrag',transformSync(text+'\nreturn {DatabaseNoteDrag,beginDatabaseNoteDrag,takeDatabaseNoteDrop};',{loader:'ts'}).code)(Element,'application/x-thoughtspace-card-insert',()=>{},(_app:unknown,e:any)=>{editorBegins++;e.dataTransfer.setData('application/x-thoughtspace-card-insert','reviewed-token');});
 const file={path:'Notes/Alpha.md',extension:'md'},app={vault:{getAbstractFileByPath:(path:string)=>path===file.path?file:undefined}};
 const surface=new api.DatabaseNoteDrag(app,container,()=>accepted++);
 function event(type:string,data:Record<string,string>={'text/x-thoughtspace-note':'Notes/Alpha.md'}){const e=new Event(type,{cancelable:true});return Object.assign(e,{dataTransfer:{types:Object.keys(data),setData(key:string,value:string){data[key]=value;this.types=Object.keys(data);},getData:(key:string)=>data[key]||'',effectAllowed:'none'}});}
 const flush=(queue:Map<number,()=>void>)=>{const jobs=[...queue.values()];queue.clear();for(const run of jobs)run();};
 return{...api,app,file,container,child,doc,win,surface,event,frames,timers,frame:()=>flush(frames),task:()=>flush(timers),accepted:()=>accepted,editorBegins:()=>editorBegins,Element};
}

test('library note drag supplies both board reference and the existing editor token',()=>{
 const f=fixture(),file={path:'Notes/Alpha.md',extension:'md'},app={vault:{getAbstractFileByPath:()=>file}},e=f.event('dragstart',{});
 f.beginDatabaseNoteDrag(app,e,file);assert.equal(e.dataTransfer.getData('text/x-thoughtspace-note'),file.path);assert.equal(e.dataTransfer.getData('application/x-thoughtspace-card-insert'),'reviewed-token');assert.equal(e.dataTransfer.effectAllowed,'copy');assert.equal(f.editorBegins(),1);
 const stale=f.event('dragstart',{});f.beginDatabaseNoteDrag({vault:{getAbstractFileByPath:()=>undefined}},stale,file);assert.equal(stale.defaultPrevented,true);assert.deepEqual(stale.dataTransfer.types,[]);
});

test('native source remains mounted during dragstart and cancellation restores exact styles',()=>{
 const f=fixture();f.container.style.setProperty('opacity','.8','important');f.child.style.setProperty('pointer-events','auto','important');f.container.dispatchEvent(f.event('dragstart'));assert.equal(f.container.style.getPropertyValue('opacity'),'.8');f.frame();assert.equal(f.container.hasClass('ts-db-note-dragging'),true);assert.equal(f.container.style.getPropertyValue('opacity'),'.8');assert.equal(f.child.style.getPropertyValue('pointer-events'),'auto');f.doc.dispatchEvent(f.event('dragend'));assert.equal(f.container.style.getPropertyValue('opacity'),'.8');assert.equal(f.container.style.getPropertyPriority('opacity'),'important');assert.equal(f.child.style.getPropertyValue('pointer-events'),'auto');assert.equal(f.child.style.getPropertyPriority('pointer-events'),'important');assert.equal(f.accepted(),0);
});

test('accepted board/editor drop is inspected after target and dragend, then closes exactly once',()=>{
 for(const prevent of [true,false]){const f=fixture();f.container.dispatchEvent(f.event('dragstart'));f.frame();const target=new f.Element();target.destination=true;const drop=f.event('drop');Object.defineProperty(drop,'target',{value:target});f.doc.dispatchEvent(drop);assert.equal(f.accepted(),0);if(prevent)drop.preventDefault();f.doc.dispatchEvent(f.event('dragend'));f.task();assert.equal(f.container.hasClass('ts-db-note-dragging'),false);assert.equal(f.accepted(),prevent?1:0);assert.equal(f.container.style.getPropertyValue('opacity'),'');f.task();assert.equal(f.container.hasClass('ts-db-note-dragging'),false);assert.equal(f.accepted(),prevent?1:0);}
});

test('rejected destination cannot close the modal even if another listener prevents default',()=>{
 const f=fixture();f.container.dispatchEvent(f.event('dragstart'));f.frame();const drop=f.event('drop');drop.preventDefault();Object.defineProperty(drop,'target',{value:new f.Element()});f.doc.dispatchEvent(drop);f.task();assert.equal(f.accepted(),0);assert.equal(f.container.style.getPropertyValue('opacity'),'');
});

test('Escape, blur and disposal restore the surface and cancel pending callbacks',()=>{
 for(const action of ['escape','blur','dispose','before-frame']){const f=fixture();f.container.dispatchEvent(f.event('dragstart'));if(action!=='before-frame')f.frame();if(action==='escape')f.doc.dispatchEvent(Object.assign(new Event('keydown'),{key:'Escape',isComposing:false}));else if(action==='blur')f.win.dispatchEvent(new Event('blur'));else f.surface.dispose();f.frame();f.task();assert.equal(f.container.style.getPropertyValue('opacity'),'');assert.equal(f.accepted(),0);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);}
});

test('internal kanban moves and already cancelled dragstart do not expose the background',()=>{
 const f=fixture();f.container.dispatchEvent(f.event('dragstart',{'text/plain':'Notes/Alpha.md'}));f.frame();assert.equal(f.container.style.getPropertyValue('opacity'),'');const e=f.event('dragstart');e.preventDefault();f.container.dispatchEvent(e);f.frame();assert.equal(f.container.style.getPropertyValue('opacity'),'');
});

test('a library moved into another document binds drag cleanup to its current owner',()=>{
 const f=fixture(),other=fixture();f.container.ownerDocument=other.doc;f.container.dispatchEvent(f.event('dragstart'));other.frame();assert.equal(f.container.hasClass('ts-db-note-dragging'),true);assert.equal(f.frames.size,0);other.doc.dispatchEvent(f.event('dragend'));assert.equal(f.container.hasClass('ts-db-note-dragging'),false);assert.equal(f.accepted(),0);
});

test('library board references are single-use and cancelled when the source modal closes',()=>{
 for(const close of [true,false]){const f=fixture(),e=f.event('dragstart',{});f.beginDatabaseNoteDrag(f.app,e,f.file);f.container.dispatchEvent(e);f.frame();if(close)f.surface.dispose();assert.equal(f.takeDatabaseNoteDrop(f.app,e),close?undefined:f.file);assert.equal(f.takeDatabaseNoteDrop(f.app,e),undefined,'No duplicate insertion from replaying one drag');}
});

test('renamed notes and stale tokens cannot fall back to the generic note payload',()=>{
 const f=fixture(),old=f.event('dragstart',{}),next=f.event('dragstart',{});f.beginDatabaseNoteDrag(f.app,old,f.file);f.beginDatabaseNoteDrag(f.app,next,f.file);assert.equal(f.takeDatabaseNoteDrop(f.app,old),undefined);f.file.path='Notes/Renamed.md';assert.equal(f.takeDatabaseNoteDrop(f.app,next),undefined);
});
