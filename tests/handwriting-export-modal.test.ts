import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {HandwritingExportOperation,handwritingExportFilename} from '../src/handwriting-export';

type Options={cls?:string;text?:string;attr?:Record<string,string>};
class Element {
 parent?:Element;children:Element[]=[];attributes:Record<string,string>={};classes=new Set<string>();disabled=false;isConnected=true;visible=true;text='';focuses=0;onclick?:()=>void;
 listeners=new Map<string,Set<(event:any)=>void>>();
 addEventListener(type:string,callback:(event:any)=>void){const listeners=this.listeners.get(type)||new Set();listeners.add(callback);this.listeners.set(type,listeners);}
 removeEventListener(type:string,callback:(event:any)=>void){this.listeners.get(type)?.delete(callback);}
 fire(type:string,event:Record<string,unknown>={}){for(const callback of this.listeners.get(type)||[])callback(event);}
 constructor(public ownerDocument:any,options:Options={}){this.text=options.text||'';this.attributes={...options.attr};for(const cls of (options.cls||'').split(' '))if(cls)this.classes.add(cls);}
 createEl(_tag:string,options:Options={}){const child=new Element(this.ownerDocument,options);child.parent=this;this.children.push(child);return child;}
 createDiv(options:Options|string={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 addClass(cls:string){this.classes.add(cls);}setText(text:string){this.text=text;this.children=[];}empty(){this.text='';this.children=[];}appendChild(child:Element){for(const node of [child,...child.all()])node.ownerDocument=this.ownerDocument;child.parent=this;this.children.push(child);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;this.isConnected=false;}focus(){this.focuses++;this.ownerDocument.activeElement=this;}click(){if(!this.disabled)this.onclick?.();}
 contains(node:Element):boolean{return this===node||this.children.some(child=>child.contains(node));}
 getClientRects(){return this.isConnected&&this.visible?[{}]:[];}
 all():Element[]{return this.children.flatMap(child=>[child,...child.all()]);}
}
class Modal {
 readonly containerEl:Element;readonly modalEl:Element;readonly contentEl:Element;closeCount=0;
 constructor(readonly app:any){this.containerEl=new Element(app.document);this.modalEl=this.containerEl.createDiv();this.contentEl=this.modalEl.createDiv();}
 open(){(this as unknown as {onOpen:()=>void}).onOpen();if(this.app.hostAutofocus!==false)this.modalEl.all().find(element=>element.attributes['data-ink-export-action']&&!element.disabled)?.focus();this.app.afterHostOpen?.(this);}
 close(){this.closeCount++;(this as unknown as {onClose:()=>void}).onClose();this.containerEl.isConnected=false;}
}
const pickers:any[]=[],viewportBindings:{root:Element;disposed:number}[]=[];
const bindBoardModalViewport=(root:Element)=>{const binding={root,disposed:0};viewportBindings.push(binding);return()=>binding.disposed++;};
class FuzzySuggestModal<T> extends Modal {
 constructor(app:any){super(app);pickers.push(this);}setPlaceholder(_placeholder:string){}onOpen(){}onClose(){}
}
const source=readFileSync('src/handwriting-export-modal.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const HandwritingExportModal=new Function('Modal','FuzzySuggestModal','HandwritingExportOperation','handwritingExportFilename','assertBoardEditorOwnership','isWorkspaceFile','themeSurface','bindBoardModalViewport',transformSync(source+'\nreturn HandwritingExportModal;',{loader:'ts'}).code)(Modal,FuzzySuggestModal,HandwritingExportOperation,handwritingExportFilename,(app:any)=>{if(app.owned)throw Error('原生占用');},(file:any)=>!file.path.startsWith('ThoughtSpace-plugin-backups/'),()=>{},bindBoardModalViewport);
const waitFor=async(check:()=>boolean)=>{for(let n=0;n<100&&!check();n++)await new Promise<void>(resolve=>setTimeout(resolve,0));assert.ok(check());};
function fixture(beforeOpen?:(context:{modal:any;host:any;app:any;origin:any;document:any;stop:()=>void})=>void){
 const document:any={defaultView:{closed:false,setTimeout},hasFocus:()=>true},origin:any={defaultView:{closed:false,setTimeout},hasFocus:()=>true};document.body=new Element(document);origin.body=new Element(origin);document.activeElement=document.body;origin.activeElement=origin.body;
 const file={path:'Boards/手写.md',basename:'手写',extension:'md'},note={path:'Notes/Existing.md',basename:'Existing',extension:'md'},other={path:'Notes/Other.md',basename:'Other',extension:'md'},board={path:'Boards/other.md',basename:'other',extension:'md'},backup={path:'ThoughtSpace-plugin-backups/test.md',basename:'test',extension:'md'};
 const files=new Map<string,any>([file,note,other,board,backup].map(value=>[value.path,value])),text=new Map<any,string>([[file,'原板'],[note,'原正文'],[other,'其他正文'],[board,'其他板'],[backup,'backup']]),notices:string[]=[];let current=true,created=0,createCalls=0,writes=0,failWrite=false,gate:Promise<void>|undefined,release!:()=>void;
 const app:any={document,workspace:{containerEl:new Element(document)},owned:false,vault:{getMarkdownFiles:()=>[file,note,other,board,backup],getAbstractFileByPath:(path:string)=>files.get(path),read:async(target:any)=>text.get(target),create:async(path:string,source:string)=>{createCalls++;await gate;const attachment={path,basename:'SVG',extension:'svg'};files.set(path,attachment);text.set(attachment,source);created++;return attachment;},process:async(target:any,change:any)=>{if(failWrite)throw Error('正文保存失败');text.set(target,change(text.get(target)));writes++;}},fileManager:{getAvailablePathForAttachment:async(name:string)=>`Attachments/${name}`,generateMarkdownLink:(target:any)=>`[[${target.path}]]`}};
 const host:any={source:file,ink:{version:1,strokes:[{id:'ink',color:'#222222',width:3,points:[[1,2,.5]]}]},current:()=>current,document:origin,isTargetAllowed:(target:any)=>target!==board,notice:(value:string)=>notices.push(value)};
 const modal=new HandwritingExportModal(app,host);beforeOpen?.({modal,host,app,origin,document,stop:()=>current=false});modal.open();const root=modal.modalEl as Element,find=(action:string)=>root.all().find(el=>el.attributes['data-ink-export-action']===action)!;
 return{modal,host,app,origin,document,note,other,board,backup,text,notices,find,status:root.all().find(el=>el.attributes['data-ink-export-status'])!,target:root.all().find(el=>el.attributes['data-ink-export-target'])!,counts:()=>({created,createCalls,writes}),stop:()=>current=false,fail:()=>failWrite=true,queueCreate:()=>{gate=new Promise<void>(resolve=>release=resolve);return()=>release();},picker:()=>pickers.at(-1)};
}
test('export modal belongs to originating document and picker excludes source, other boards and backups',()=>{
 const f=fixture();assert.equal(f.modal.containerEl.ownerDocument,f.origin);assert.ok(f.modal.modalEl.classes.has('ts-handwriting-export-modal'));assert.equal(f.find('insert').disabled,true);f.find('choose-target').click();const picker=f.picker();assert.deepEqual(picker.getItems().map((file:any)=>file.path),[f.note.path,f.other.path]);picker.close();assert.equal(f.find('choose-target').disabled,false);assert.equal(f.find('insert').disabled,true);
});
test('native picker selects a captured note and duplicate UI clicks insert once then close with clear notice',async()=>{
 const f=fixture();f.find('choose-target').click();f.picker().onChooseItem(f.note);f.picker().close();await waitFor(()=>!f.find('insert').disabled);assert.match(f.target.text,/Existing.md/);f.find('insert').click();f.find('insert').click();assert.equal(f.find('choose-target').disabled,true);assert.equal(f.find('cancel').disabled,false);await waitFor(()=>f.modal.closeCount===1);assert.equal(f.counts().created,1);assert.equal(f.counts().writes,1);assert.match(f.text.get(f.note)!,/^原正文\n\n!\[\[Attachments\/手写-手写.svg\]\]/);assert.match(f.notices[0],/已插入.*Existing.md/);
});
test('native target ownership rejection keeps the modal visible and target unselected without saving any page',async()=>{
 const f=fixture();f.app.owned=true;f.find('choose-target').click();f.picker().onChooseItem(f.note);f.picker().close();await waitFor(()=>f.status.text.includes('保存保护'));assert.equal(f.find('insert').disabled,true);assert.equal(f.counts().created,0);assert.equal(f.counts().writes,0);assert.equal(f.modal.closeCount,0);assert.equal(f.find('cancel').disabled,false);
});
test('a rejected note choice returns focus to the enabled note picker action',async()=>{
 const f=fixture(),before=f.find('choose-target').focuses;f.app.owned=true;f.find('choose-target').click();f.picker().onChooseItem(f.note);f.picker().close();
 await waitFor(()=>!f.find('choose-target').disabled);
 assert.equal(f.find('insert').disabled,true);assert.equal(f.find('insert').focuses,0);assert.equal(f.find('choose-target').focuses,before+1);
});
test('save failure exposes retained attachment and allows a retry while preserving selected note and body',async()=>{
 const f=fixture();f.find('choose-target').click();f.picker().onChooseItem(f.note);f.picker().close();await waitFor(()=>!f.find('insert').disabled);f.fail();f.find('insert').click();await waitFor(()=>f.status.text.includes('SVG 已保留'));assert.equal(f.counts().created,1);assert.equal(f.counts().writes,0);assert.equal(f.text.get(f.note),'原正文');assert.match(f.target.text,/Existing.md/);assert.equal(f.find('insert').disabled,false);assert.equal(f.modal.closeCount,0);
});
test('cancel during pending create closes dialog and reports preserved attachment without late note insert',async()=>{
 const f=fixture(),release=f.queueCreate();f.find('export').click();await waitFor(()=>f.counts().createCalls===1);f.find('cancel').click();release();await waitFor(()=>f.notices.length>0);assert.equal(f.counts().created,1);assert.equal(f.counts().writes,0);assert.equal(f.modal.closeCount,1);assert.match(f.notices[0],/取消.*SVG 已保留/);assert.equal(f.modal.contentEl.children.length,0);
});
test('new navigation prevents an idle modal from choosing a target or creating files',()=>{
 const f=fixture();f.stop();f.find('export').click();f.find('choose-target').click();assert.equal(f.counts().created,0);assert.equal(f.counts().writes,0);f.find('cancel').click();assert.equal(f.modal.closeCount,1);
});
test('the parent lifetime hook runs once even when close is repeated or an async failure settles later',async()=>{
 const f=fixture();let closed=0;f.host.closed=()=>closed++;const release=f.queueCreate();f.find('export').click();await waitFor(()=>f.counts().createCalls===1);f.modal.close();f.modal.close();assert.equal(closed,1);release();await waitFor(()=>f.notices.length>0);assert.equal(closed,1);assert.equal(f.counts().writes,0);
});

test('export and native picker bind their originating centering containers and release each binding exactly once',()=>{
 const f=fixture(),start=viewportBindings.length-1;assert.equal(viewportBindings[start].root,f.modal.containerEl);
 f.find('choose-target').click();const picker=f.picker();assert.equal(picker.containerEl.ownerDocument,f.origin);assert.equal(viewportBindings[start+1].root,picker.containerEl);
 picker.close();picker.close();assert.equal(viewportBindings[start+1].disposed,1);f.modal.close();f.modal.close();assert.equal(viewportBindings[start].disposed,1);
});
test('pointer dismissal reports the last modal contact once and releases its capture listeners',()=>{
 const f=fixture(),closed:any[]=[];f.host.closed=(point:unknown)=>closed.push(point);
 f.modal.containerEl.fire('pointerdown',{clientX:120,clientY:240,pointerType:'mouse'});f.find('cancel').click();f.modal.close();
 assert.deepEqual(closed,[{clientX:120,clientY:240,pointerType:'mouse'}]);assert.equal(f.modal.containerEl.listeners.get('pointerdown')?.size,0);assert.equal(f.modal.containerEl.listeners.get('keydown')?.size,0);
});
test('keyboard dismissal and invalid coordinates do not quarantine a later canvas contact',()=>{
 for(const keyboard of [false,true]){
  const f=fixture(),closed:any[]=[];f.host.closed=(point:unknown)=>closed.push(point);
  f.modal.containerEl.fire('pointerdown',{clientX:keyboard?120:NaN,clientY:240,pointerType:'pen'});
  if(keyboard)f.modal.containerEl.fire('keydown',{key:'Escape'});f.modal.close();assert.deepEqual(closed,[undefined]);
 }
});

test('primary export focus follows the native post-onOpen default focus synchronously',()=>{
 let hostFocus:Element|undefined;
 const f=fixture(({app,origin})=>{app.afterHostOpen=()=>{hostFocus=origin.activeElement;};});
 assert.equal(hostFocus,f.find('choose-target'));
 assert.equal(f.origin.activeElement,f.find('export'));assert.equal(f.find('export').focuses,1);
 assert.deepEqual(f.counts(),{created:0,createCalls:0,writes:0});
});
test('without native autofocus the original trigger or body may yield focus to the primary action',()=>{
 for(const useTrigger of [false,true]){
  const f=fixture(({app,origin})=>{app.hostAutofocus=false;if(useTrigger)new Element(origin).focus();});
  assert.equal(f.origin.activeElement,f.find('export'));assert.equal(f.find('export').focuses,1);
 }
});
test('a new external focus established during native open is never replaced',()=>{
 let external:Element|undefined;
 const f=fixture(({app,origin})=>{new Element(origin).focus();external=new Element(origin);app.afterHostOpen=()=>external!.focus();});
 assert.equal(f.origin.activeElement,external);assert.equal(f.find('export').focuses,0);
});
for(const boundary of ['close','navigation','background','closed-window','different-document','disconnected','hidden','disabled'] as const)test(`native opening ${boundary} cancels primary focus without queued work`,()=>{
 let primary:Element|undefined;
 const f=fixture(({modal,app,origin,document,stop})=>{
  app.afterHostOpen=()=>{
   primary=modal.modalEl.all().find((el:Element)=>el.attributes['data-ink-export-action']==='export');
   if(boundary==='close')modal.close();if(boundary==='navigation')stop();
   if(boundary==='background')origin.hasFocus=()=>false;if(boundary==='closed-window')origin.defaultView.closed=true;
   if(boundary==='different-document')modal.containerEl.ownerDocument=document;
   if(boundary==='disconnected')modal.containerEl.isConnected=false;
   if(boundary==='hidden')modal.modalEl.visible=false;if(boundary==='disabled')primary!.disabled=true;
  };
  // Initial focus must not rely on a later task that can outlive the modal.
  origin.defaultView.setTimeout=()=>{throw Error('unexpected delayed initial focus');};
  origin.defaultView.requestAnimationFrame=()=>{throw Error('unexpected deferred initial focus');};
 });
 assert.ok(primary);assert.equal(primary.focuses,0);assert.deepEqual(f.counts(),{created:0,createCalls:0,writes:0});
});
