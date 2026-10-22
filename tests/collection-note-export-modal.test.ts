import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import type {CollectionNoteTarget,CollectionNotePreview,CollectionNoteExportReceipt,CollectionNoteExportHistory,CollectionNoteHeading} from '../src/collection-note-export';

type Listener=(event?:unknown)=>void;
class Events {
 listeners=new Map<string,Set<Listener>>();
 addEventListener(name:string,listener:Listener){const values=this.listeners.get(name)||new Set();values.add(listener);this.listeners.set(name,values);}
 removeEventListener(name:string,listener:Listener){this.listeners.get(name)?.delete(listener);}
 emit(name:string,event?:unknown){for(const fn of this.listeners.get(name)||[])fn(event);}
}
class Win extends Events {closed=false;}
type Doc={defaultView:Win;body:El;activeElement?:El};
class El extends Events {
 children:El[]=[];parentElement?:El;attrs:Record<string,string>={};dataset:Record<string,string>={};classes=new Set<string>();
 value='';text='';disabled=false;hidden=false;open=false;
 onclick?:()=>void;oninput?:()=>void;onchange?:()=>void;
 constructor(public ownerDocument:Doc,public tag='div',options:any={}){super();if(typeof options==='string')options={cls:options};this.text=options.text||'';this.value=options.value||'';for(const value of(options.cls||'').split(' ').filter(Boolean))this.classes.add(value);for(const[key,value]of Object.entries(options.attr||{}))this.setAttribute(key,String(value));}
 get isConnected():boolean{return this.tag==='body'||!!this.parentElement?.isConnected;}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 createEl(tag:string,options:any={}){const node=new El(this.ownerDocument,tag,options);this.appendChild(node);if(this.tag==='select'&&this.children.length===1)this.value=node.value;return node;}
 createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}
 appendChild(child:El){child.remove();child.parentElement=this;const adopt=(node:El)=>{node.ownerDocument=this.ownerDocument;for(const descendant of node.children)adopt(descendant);};adopt(child);this.children.push(child);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=undefined;}
 empty(){for(const child of [...this.children])child.remove();this.text='';}
 setText(value:string){this.empty();this.text=value;}
 setAttribute(key:string,value:string){this.attrs[key]=value;if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter:string)=>letter.toUpperCase())]=value;}
 getAttribute(key:string){return this.attrs[key]??null;}
 addClass(...names:string[]){names.forEach(name=>this.classes.add(name));}
 all():El[]{return this.children.flatMap(child=>[child,...child.all()]);}
 matches(selector:string):boolean{
  if(selector.includes(','))return selector.split(',').some(part=>this.matches(part));
  if(selector.startsWith('.'))return this.classes.has(selector.slice(1));
  const attr=/^\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/.exec(selector);
  if(attr)return attr[2]===undefined?attr[1]in this.attrs:this.attrs[attr[1]]===attr[2];
  return selector===this.tag;
 }
 querySelectorAll(selector:string){return this.all().filter(node=>node.matches(selector));}
 querySelector(selector:string){return this.querySelectorAll(selector)[0];}
 click(){if(!this.disabled&&!this.hidden)this.onclick?.();}
}
class Modal {
 containerEl:El;modalEl:El;contentEl:El;closeCount=0;
 constructor(app:{document:Doc}){this.containerEl=new El(app.document);app.document.body.appendChild(this.containerEl);this.modalEl=this.containerEl.createDiv();this.contentEl=this.modalEl.createDiv();}
 open(){(this as any).onOpen();}close(){this.closeCount++;(this as any).onClose();this.containerEl.remove();}
}
let bindings=0,releases=0;
const module={exports:{}};
const dependencies:Record<string,unknown>={obsidian:{Modal},'./board-modal-viewport':{bindBoardModalViewport:()=>{bindings++;return()=>releases++;}},'./ui-tokens':{themeSurface:(el:El,options:any)=>{el.dataset.accent=options.accent;}},'./workspace-density':{applyWorkspaceDensity:(el:El,density:string)=>{el.dataset.density=density;}}};
new Function('require','module','exports',transformSync(readFileSync('src/collection-note-export-modal.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{assert.ok(name in dependencies,name);return dependencies[name];},module,module.exports);
const {CollectionNoteExportModal}=module.exports as {CollectionNoteExportModal:any};
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
type Request<T>={current:()=>boolean;gate:ReturnType<typeof deferred<T>>};
function preview(target:CollectionNoteTarget,id='export-test-1'):CollectionNotePreview {
 return Object.freeze({operationId:id,source:Object.freeze({id:'capture-modal-12345678',createdAt:'2026-10-20T00:00:00.000Z',path:'Inbox/Source.md'}),target:Object.freeze(target),markdown:'<script>literal</script>\n\n![[Files/image.png]]\n\n> 来源：[[Inbox/Source]]',journalPath:`.obsidian/export/${id}.json`});
}
function receipt(status:CollectionNoteExportReceipt['status']='confirmed',id='export-test-1'):CollectionNoteExportReceipt{return{operationId:id,status,targetPath:'Notes/Target.md',journalPath:`.obsidian/export/${id}.json`};}
function fixture(){
 const doc=()=>{const result={defaultView:new Win()} as Doc;result.body=new El(result,'body');return result;};
 const main=doc(),origin=doc();let active=true,closed=0,unwatched=0,invalidated=()=>{};
 const prepares:(Request<CollectionNotePreview>&{target:CollectionNoteTarget})[]=[],commits:(Request<CollectionNoteExportReceipt>&{preview:CollectionNotePreview})[]=[],picks:Request<string|undefined>[]=[];
 const headings:(Request<readonly CollectionNoteHeading[]>&{path:string})[]=[],histories:ReturnType<typeof deferred<{items:readonly CollectionNoteExportHistory[];warning?:string}>>[]=[],inspects:{id:string;gate:ReturnType<typeof deferred<CollectionNoteExportHistory>>}[]=[];
 const opened:(Request<void>&{path:string})[]=[],discarded:CollectionNotePreview[]=[];
 const host={
  current:()=>active,sourceTitle:'<Title> record',sourcePath:'Inbox/Source.md',accent:()=> 'amber',density:()=> 'comfortable',
  pick:(current:()=>boolean)=>{const gate=deferred<string|undefined>();picks.push({current,gate});return gate.promise;},
  headings:(path:string,current:()=>boolean)=>{const gate=deferred<readonly CollectionNoteHeading[]>();headings.push({path,current,gate});return gate.promise;},
  prepare:(target:CollectionNoteTarget,current:()=>boolean)=>{const gate=deferred<CollectionNotePreview>();prepares.push({target,current,gate});return gate.promise;},
  commit:(value:CollectionNotePreview,current:()=>boolean)=>{const gate=deferred<CollectionNoteExportReceipt>();commits.push({preview:value,current,gate});return gate.promise;},
  discard:(value:CollectionNotePreview)=>discarded.push(value),
  history:()=>{const gate=deferred<{items:readonly CollectionNoteExportHistory[];warning?:string}>();histories.push(gate);return gate.promise;},
  inspect:(id:string)=>{const gate=deferred<CollectionNoteExportHistory>();inspects.push({id,gate});return gate.promise;},
  open:(path:string,current:()=>boolean)=>{const gate=deferred<void>();opened.push({path,current,gate});return gate.promise;},
  watchCurrent:(fn:()=>void)=>{invalidated=fn;return()=>unwatched++;},closed:()=>closed++,
 };
 const modal=new CollectionNoteExportModal({document:main},origin,host);
 const action=(name:string)=>modal.modalEl.querySelector(`[data-collection-export-action=${name}]`) as El|undefined;
 const control=(name:string)=>modal.modalEl.querySelector(`[data-collection-export-${name}]`) as El;
 const append=()=>{control('mode').value='append';control('mode').onchange?.();control('path').value='Notes/Target.md';control('path').oninput?.();};
 const prepared=async()=>{action('preview')!.click();const request=prepares.at(-1)!;const value=preview(request.target);request.gate.resolve(value);await tick();return value;};
 return{main,origin,modal,host,prepares,commits,picks,headings,histories,inspects,opened,discarded,action,control,append,prepared,
  counts:()=>({closed,unwatched}),stop:()=>{active=false;invalidated();},inactive:()=>{active=false;}};
}

test('modal stays in owner window, shows literal Markdown and keeps footer outside scrollable content',async()=>{
 const f=fixture(),before=bindings;f.modal.open();assert.equal(f.modal.containerEl.ownerDocument,f.origin);assert.equal(f.modal.modalEl.dataset.accent,'amber');assert.equal(bindings,before+1);
 assert.equal(f.control('mode').value,'new');assert.equal(f.action('pick')!.hidden,true);assert.equal(f.action('cancel')!.parentElement!.parentElement,f.modal.modalEl);
 const p=await f.prepared();assert.equal(f.prepares[0].target.path,'Inbox/Title  record-整理.md');
 assert.equal(f.control('preview').querySelector('pre')!.text,p.markdown);assert.equal(f.modal.modalEl.querySelector('script'),undefined);
 assert.equal(f.action('confirm')!.disabled,false);assert.equal(f.commits.length,0);f.modal.close();
});
for(const field of ['path','mode','heading'] as const)test(`changing ${field} revokes old confirmation and captured event handlers`,async()=>{
 const f=fixture();f.modal.open();const p=await f.prepared(),confirm=f.action('confirm')!;
 if(field==='path'){f.control(field).value='Notes/Changed.md';f.control(field).oninput?.();}
 else{f.control(field).value=field==='mode'?'append':'123:2';f.control(field).onchange?.();}
 assert.equal(f.action('confirm'),undefined);assert.deepEqual(f.discarded,[p]);confirm.onclick!();assert.equal(f.commits.length,0);f.modal.close();
});
test('programmatic path change without an input event cannot authorize stale preview',async()=>{
 const f=fixture();f.modal.open();await f.prepared();f.control('path').value='Notes/Other.md';f.action('confirm')!.onclick!();assert.equal(f.commits.length,0);f.modal.close();
});
test('late preview after input change is discarded without enabling confirm',async()=>{
 const f=fixture();f.modal.open();f.action('preview')!.click();const request=f.prepares[0];f.control('path').value='Notes/New.md';f.control('path').oninput?.();
 assert.equal(request.current(),false);const p=preview(request.target);request.gate.resolve(p);await tick();assert.equal(f.action('confirm'),undefined);assert.deepEqual(f.discarded,[p]);f.modal.close();
});
test('cancel remains available while preview is pending, and late preview is discarded',async()=>{
 const f=fixture();f.modal.open();f.action('preview')!.click();assert.equal(f.action('cancel')!.disabled,false);f.action('cancel')!.click();
 assert.equal(f.prepares[0].current(),false);const p=preview(f.prepares[0].target);f.prepares[0].gate.resolve(p);await tick();assert.deepEqual(f.discarded,[p]);assert.deepEqual(f.counts(),{closed:1,unwatched:1});assert.equal(f.modal.contentEl.children.length,0);
});
test('existing-note picker cancellation keeps current choice and never loads unrelated headings',async()=>{
 const f=fixture();f.modal.open();f.append();f.action('pick')!.click();assert.equal(f.picks.length,1);f.picks[0].gate.resolve(undefined);await tick();
 assert.equal(f.headings.length,0);assert.equal(f.control('path').value,'Notes/Target.md');f.modal.close();
});
test('choosing an existing note loads headings and preserves duplicate offset-level selection',async()=>{
 const f=fixture();f.modal.open();f.append();f.action('pick')!.click();f.picks[0].gate.resolve('Notes/Chosen.md');await tick();assert.equal(f.headings[0].path,'Notes/Chosen.md');
 const items=[{offset:10,level:2,title:'Same'},{offset:80,level:2,title:'Same'}];f.headings[0].gate.resolve(items);await tick();
 assert.equal(f.control('heading').children[1].value,'10:2');assert.match(f.control('heading').children[2].text,/同名标题 2/);
 f.control('heading').value='80:2';f.control('heading').onchange?.();f.action('preview')!.click();
 assert.deepEqual(f.prepares[0].target,{kind:'append',path:'Notes/Chosen.md',heading:{offset:80,level:2}});f.modal.close();
});
test('invalid selected heading never silently falls back to note end',async()=>{
 const f=fixture();f.modal.open();f.append();f.control('heading').value='80:2';f.action('preview')!.click();
 assert.equal(f.prepares.length,0);assert.match(f.control('status').text,/标题已变化/);f.modal.close();
});
test('late headings after navigation cannot re-enable controls or render options',async()=>{
 const f=fixture();f.modal.open();f.append();f.action('headings')!.click();f.stop();assert.equal(f.headings[0].current(),false);
 f.headings[0].gate.resolve([{offset:0,level:1,title:'late'}]);await tick();assert.equal(f.modal.contentEl.children.length,0);assert.equal(f.counts().closed,1);
});
test('confirm consumes preview once under double click and a reused handler after success',async()=>{
 const f=fixture();f.modal.open();const p=await f.prepared(),button=f.action('confirm')!;button.onclick!();button.onclick!();
 assert.equal(f.commits.length,1);assert.equal(f.commits[0].preview,p);assert.equal(f.commits[0].current(),true);assert.equal(f.action('cancel')!.disabled,false);
 f.commits[0].gate.resolve(receipt());await tick();button.onclick!();assert.equal(f.commits.length,1);assert.equal(f.action('confirm'),undefined);assert.match(f.control('status').text,/已确认写入/);f.modal.close();
});
test('cancel during commit revokes callback but late confirmed receipt neither renders nor closes again',async()=>{
 const f=fixture();f.modal.open();const p=await f.prepared();f.action('confirm')!.click();f.action('cancel')!.click();
 assert.equal(f.commits[0].current(),false);assert.deepEqual(f.discarded,[p]);f.commits[0].gate.resolve(receipt());await tick();assert.equal(f.counts().closed,1);assert.equal(f.modal.modalEl.querySelector('[data-collection-export-receipt]'),undefined);
});
test('unknown receipt offers only read-only inspection and cannot invoke preview or commit again',async()=>{
 const f=fixture();f.modal.open();await f.prepared();f.action('confirm')!.click();f.commits[0].gate.resolve(receipt('unknown'));await tick();
 assert.equal(f.action('preview')!.disabled,true);assert.equal(f.action('confirm'),undefined);f.action('preview')!.onclick!();assert.equal(f.prepares.length,1);
 f.action('inspect')!.click();assert.equal(f.inspects.length,1);assert.equal(f.inspects[0].id,'export-test-1');f.inspects[0].gate.resolve({readOnly:true,journal:null,receipt:receipt('confirmed')});await tick();
 assert.equal(f.commits.length,1);assert.equal(f.prepares.length,1);assert.equal(f.action('preview')!.disabled,true);f.modal.close();
});
test('unexpected commit rejection fails closed with visible recovery guidance',async()=>{
 const f=fixture();f.modal.open();await f.prepared();f.action('confirm')!.click();f.commits[0].gate.reject(Error('lost host response'));await tick();
 assert.equal(f.action('preview')!.disabled,true);assert.equal(f.action('confirm'),undefined);assert.match(f.control('status').text,/最近的沉淀记录核对/);f.modal.close();
});
test('history rendering never replaces active preview status or creates write authority',async()=>{
 const f=fixture();f.modal.open();await f.prepared();const status=f.control('status').text,details=f.modal.contentEl.querySelector('details')!;
 details.open=true;details.emit('toggle');f.histories[0].resolve({items:[{readOnly:true,journal:null,receipt:receipt('unknown','export-old')}]});await tick();
 assert.equal(f.control('status').text,status);assert.equal(f.action('confirm')!.disabled,false);assert.equal(f.commits.length,0);assert.equal(f.prepares.length,1);
 f.action('inspect')!.click();f.inspects[0].gate.resolve({readOnly:true,journal:null,blocked:'history only'});await tick();assert.equal(f.control('status').text,status);assert.equal(f.commits.length,0);f.modal.close();
});
test('newest history request wins and late rows created during commit stay disabled',async()=>{
 const f=fixture();f.modal.open();await f.prepared();const details=f.modal.contentEl.querySelector('details')!;details.open=true;details.emit('toggle');details.emit('toggle');
 f.histories[1].resolve({items:[{readOnly:true,journal:null,receipt:receipt('confirmed','export-new')}]});await tick();
 f.histories[0].resolve({items:[{readOnly:true,journal:null,receipt:receipt('unknown','export-stale')}]});await tick();
 assert.equal(f.modal.modalEl.querySelector('[data-collection-export-receipt=export-stale]'),undefined);
 f.action('confirm')!.click();details.emit('toggle');f.histories[2].resolve({items:[{readOnly:true,journal:null,receipt:receipt('confirmed','export-newer')}]});await tick();
 assert.equal(f.action('open')!.disabled,true);assert.equal(f.action('cancel')!.disabled,false);f.modal.close();
});
test('native target opening is guarded against double clicks and closes once after navigation',async()=>{
 const f=fixture();f.modal.open();await f.prepared();f.action('confirm')!.click();f.commits[0].gate.resolve(receipt());await tick();
 const open=f.action('open')!;open.onclick!();open.onclick!();assert.equal(f.opened.length,1);assert.equal(f.opened[0].path,'Notes/Target.md');
 f.inactive();f.opened[0].gate.resolve(undefined);await tick();assert.equal(f.counts().closed,1);
});
test('closing during target opening revokes callback and rejects late display changes',async()=>{
 const f=fixture();f.modal.open();await f.prepared();f.action('confirm')!.click();f.commits[0].gate.resolve(receipt());await tick();
 f.action('open')!.click();f.action('cancel')!.click();assert.equal(f.opened[0].current(),false);f.opened[0].gate.reject(Error('late failure'));await tick();
 assert.equal(f.modal.closeCount,1);assert.equal(f.counts().closed,1);assert.equal(f.modal.contentEl.children.length,0);
});
test('owner unload and repeated close clean up subscriptions, viewport and preview once',async()=>{
 const f=fixture(),before=releases;f.modal.open();const p=await f.prepared();f.origin.defaultView.emit('unload');f.modal.close();f.modal.onClose();
 assert.deepEqual(f.counts(),{closed:1,unwatched:1});assert.equal(releases,before+1);assert.deepEqual(f.discarded,[p]);assert.equal(f.origin.defaultView.listeners.get('unload')!.size,0);
});
