import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {CaptureDeliveryOperation,CaptureCreationUnconfirmedError,newCaptureDraft,captureNoteSource} from '../src/capture-delivery';

type Options={cls?:string;text?:string;attr?:Record<string,string>;value?:string;type?:string};
class Element {
 parent?:Element;children:Element[]=[];attributes:Record<string,string>={};classes=new Set<string>();value='';disabled=false;hidden=false;text='';focuses=0;writes=0;isConnected=true;
 onclick?:()=>void;oninput?:()=>void;onchange?:()=>void;listeners=new Map<string,Set<(event:any)=>void>>();
 constructor(public ownerDocument:any,options:Options={}){this.text=options.text||'';this.value=options.value||'';this.attributes={...options.attr};for(const cls of (options.cls||'').split(' '))if(cls)this.classes.add(cls);}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 createEl(tag:string,options:Options={}){
  const child=new Element(this.ownerDocument,options);
  // Obsidian's createEl applies a value attribute to textarea; that attribute
  // does not initialize its editable value. Inputs retain their usual behavior.
  if(tag.toLowerCase()==='textarea'&&options.value!==undefined){child.attributes.value=options.value;child.value='';}
  child.parent=this;this.children.push(child);return child;
 }
 createDiv(options:Options|string={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}createSpan(options:Options={}){return this.createEl('span',options);}
 addClass(cls:string){this.classes.add(cls);}setText(text:string){this.text=text;this.children=[];this.writes++;}empty(){this.children=[];this.text='';}
 appendChild(child:Element){child.parent=this;child.ownerDocument=this.ownerDocument;this.children.push(child);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;this.isConnected=false;}
 focus(){this.focuses++;}click(){if(!this.disabled&&!this.hidden)this.onclick?.();}all():Element[]{return this.children.flatMap(child=>[child,...child.all()]);}
 addEventListener(type:string,callback:(event:any)=>void){const callbacks=this.listeners.get(type)||new Set();callbacks.add(callback);this.listeners.set(type,callbacks);}removeEventListener(type:string,callback:(event:any)=>void){this.listeners.get(type)?.delete(callback);}fire(type:string,event:any){for(const callback of this.listeners.get(type)||[])callback(event);}
}
class Modal {
 readonly containerEl:Element;readonly modalEl:Element;readonly contentEl:Element;closeCount=0;
 constructor(app:{document:any}){this.containerEl=new Element(app.document);this.modalEl=this.containerEl.createDiv();this.contentEl=this.modalEl.createDiv();}
 open(){(this as unknown as {onOpen:()=>void}).onOpen();}close(){this.closeCount++;(this as unknown as {onClose:()=>void}).onClose();this.containerEl.isConnected=false;}
}
const bindings:{root:Element;disposed:number}[]=[];
const source=readFileSync('src/capture-delivery-modal.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const CaptureDeliveryModal=new Function('Modal','CaptureDeliveryOperation','bindBoardModalViewport','themeSurface',transformSync(source+'\nreturn CaptureDeliveryModal;',{loader:'ts'}).code)(Modal,CaptureDeliveryOperation,(root:Element)=>{const binding={root,disposed:0};bindings.push(binding);return()=>binding.disposed++;},()=>{});
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve(undefined);};
function fixture(){
 const main:any={defaultView:{closed:false}},origin:any={defaultView:{closed:false,requestAnimationFrame:()=>1,cancelAnimationFrame(){}}};main.body=new Element(main);origin.body=new Element(origin);
 const target={path:'Boards/Current.md',valid:true},destination={key:'current',title:'当前研究板',pathSnapshot:target.path,target,groups:[{id:'g',title:'Research'}],groupId:undefined as string|undefined,hint:'当前'},other={...destination,key:'other',title:'另一张白板',groups:[{id:'other-g',title:'Other group'}]};
 const draft=newCaptureDraft<any,any,any>();draft.title='原输入';draft.body='正文\r\n精确保留';draft.destination=destination;
 let current=true,creates=0,placements=0,flushes=0,returns=0,sidebars=0,closed=0,watchDisposed=0,invalidator:()=>void=()=>{},createGate:ReturnType<typeof deferred>|undefined,flushGate:ReturnType<typeof deferred>|undefined,createFailure=false,flushFailure=false,uncertain=false,navigationFailure=false,listGate:ReturnType<typeof deferred<any[]>>|undefined;
 const notices:string[]=[],pickers:any[]=[];
 const host:any={document:origin,draft,current:()=>current,newId:()=>`capture-${creates+1}`,
  validateDestination:(d:any)=>{if(!d.target.valid||d.target.path!==d.pathSnapshot)throw Error('目标已变化');if(d.groupId&&!d.groups.some((g:any)=>g.id===d.groupId))throw Error('分组已变化');},
  createNote:async(input:any,live:()=>boolean)=>{assert.ok(live());creates++;await createGate?.promise;if(uncertain)throw new CaptureCreationUnconfirmedError('创建未确认');if(createFailure)throw Error('无法创建笔记');return{path:'Notes/Captured.md',body:captureNoteSource(input)};},
  validateCreatedFile:(file:any)=>{assert.ok(file.path);},placeReference:()=>{placements++;return{id:'reference'};},flushPlacement:async()=>{flushes++;await flushGate?.promise;if(flushFailure)throw Error('保存失败');},
  destinations:()=>listGate?.promise||Promise.resolve([destination]),
  pickDestination:(live:()=>boolean)=>{const result=deferred<any>(),picker={result:result.promise,resolve:result.resolve,live,closes:0,close(){this.closes++;result.resolve(undefined);}};pickers.push(picker);return picker;},
  returnToOrigin:async(live:()=>boolean)=>{assert.ok(live());returns++;if(navigationFailure)throw Error('返回位置失败');},
  openNote:async(_file:any,live:()=>boolean)=>{assert.ok(live());sidebars++;},notice:(message:string)=>notices.push(message),closed:()=>closed++,watchCurrent:(invalidate:()=>void)=>{invalidator=invalidate;return()=>watchDisposed++;}
 };
 const open=()=>{const modal=new CaptureDeliveryModal({document:main},host);modal.open();const find=(key:string)=>modal.modalEl.all().find((el:Element)=>el.attributes['data-capture-action']===key)!;const control=(key:string)=>modal.modalEl.all().find((el:Element)=>el.attributes[`data-capture-${key}`])!;return{modal,find,control};};
 return{host,draft,target,destination,other,origin,main,notices,pickers,open,counts:()=>({creates,placements,flushes,returns,sidebars,closed,watchDisposed}),stop:()=>{current=false;invalidator();},startCreate:()=>{createGate=deferred();return createGate;},startFlush:()=>{flushGate=deferred();return flushGate;},startList:()=>{listGate=deferred<any[]>();return listGate;},failCreate:(v=true)=>createFailure=v,failFlush:(v=true)=>flushFailure=v,uncertain:()=>uncertain=true,failNavigate:()=>navigationFailure=true};
}
test('capture modal and viewport belong to originating window with a separate fixed footer',async()=>{
 const f=fixture(),ui=f.open();await tick();assert.equal(ui.modal.containerEl.ownerDocument,f.origin);assert.equal(bindings.at(-1)?.root,ui.modal.containerEl);assert.equal(ui.control('title').value,'原输入');assert.equal(ui.control('body').value,'正文\r\n精确保留');assert.ok(ui.modal.modalEl.children.some((child:Element)=>child.classes.has('ts-capture-footer')));assert.ok(!ui.modal.contentEl.children.some((child:Element)=>child.classes.has('ts-capture-footer')));
});
test('close retains editable title/body and group choice for reopening',async()=>{
 const f=fixture(),ui=f.open();await tick();ui.control('title').value='New user input';ui.control('body').value='multi\r\nline\n';ui.control('body').oninput?.();ui.control('group').value='g';ui.control('group').onchange?.();ui.find('cancel').click();const again=f.open();await tick();assert.equal(again.control('title').value,'New user input');assert.equal(again.control('body').value,'multi\r\nline\n');assert.equal(again.control('group').value,'g');assert.equal(f.counts().creates,0);
});
test('restored multi-paragraph body survives title-only editing, reopen and submission',async()=>{
 const f=fixture(),body='第一段正文\r\n\r\n第二段：保留空行与缩进\n  - 条目\n\n';f.draft.body=body;
 const ui=f.open();await tick();ui.control('title').value='只改标题';ui.control('title').oninput?.();assert.equal(f.draft.body,body);ui.find('cancel').click();
 const reopened=f.open();await tick();assert.equal(reopened.control('body').value,body);assert.equal(reopened.control('title').value,'只改标题');reopened.find('submit').click();await tick();assert.equal(f.draft.attempt?.file?.body,`# 只改标题\n\n${body}`);assert.equal(f.counts().creates,1);
});
test('rapid actual button clicks create/deliver/return once and close with retained successful draft',async()=>{
 const f=fixture(),ui=f.open();await tick();ui.find('submit').click();ui.find('submit').click();assert.equal(ui.find('submit').disabled,true);assert.equal(ui.find('cancel').disabled,false);await tick();assert.deepEqual(f.counts(),{creates:1,placements:1,flushes:1,returns:1,sidebars:0,closed:1,watchDisposed:1});assert.equal(f.draft.attempt?.saved,true);assert.match(f.notices[0],/当前研究板/);
});
test('sidebar continuation uses the same save result and is an explicit alternate destination',async()=>{
 const f=fixture(),ui=f.open();await tick();ui.find('sidebar').click();await tick();assert.equal(f.counts().sidebars,1);assert.equal(f.counts().returns,0);assert.equal(f.counts().creates,1);
});
test('canceling the native picker leaves all input/target unchanged',async()=>{
 const f=fixture(),ui=f.open();await tick();ui.find('choose').click();assert.equal(ui.find('submit').disabled,true);f.pickers[0].close();await tick();assert.equal(ui.find('submit').disabled,false);assert.equal(f.draft.destination?.key,'current');assert.equal(ui.control('body').value,'正文\r\n精确保留');assert.equal(f.counts().creates,0);
});
test('native destination selection exposes its groups without changing capture content',async()=>{
 const f=fixture(),ui=f.open();await tick();ui.find('choose').click();f.pickers[0].resolve(f.other);await tick();assert.equal(ui.control('destination').value,'other');assert.ok(ui.control('group').children.some((child:Element)=>child.value==='other-g'));ui.control('group').value='other-g';ui.control('group').onchange?.();assert.equal(f.draft.destination?.groupId,'other-g');assert.equal(f.draft.body,'正文\r\n精确保留');
});
test('closing during native picker closes its owned request and ignores late target result',async()=>{
 const f=fixture(),ui=f.open();await tick();ui.find('choose').click();ui.find('cancel').click();assert.equal(f.pickers[0].closes,1);assert.equal(f.pickers[0].live(),false);f.pickers[0].resolve(f.other);await tick();assert.equal(f.draft.destination?.key,'current');assert.equal(ui.modal.contentEl.children.length,0);
});
test('asynchronous destination refresh cannot replace selected Session identity',async()=>{
 const f=fixture(),gate=f.startList(),ui=f.open();const replacement={...f.destination,target:{path:f.target.path,valid:true}};gate.resolve([replacement,f.other]);await tick();assert.equal(f.draft.destination?.target,f.target);ui.control('destination').value='current';ui.control('destination').onchange?.();assert.equal(f.draft.destination?.target,f.target);
});
test('creation failure keeps input editable and no board/reference/navigation is emitted',async()=>{
 const f=fixture(),ui=f.open();await tick();f.failCreate();ui.find('submit').click();await tick();assert.match(ui.control('status').textContent,/无法创建笔记/);assert.equal(ui.control('title').disabled,false);assert.equal(ui.control('body').disabled,false);assert.equal(ui.control('body').value,'正文\r\n精确保留');assert.equal(f.counts().placements,0);assert.equal(f.counts().returns,0);assert.equal(ui.find('cancel').disabled,false);
});
test('save failure retains note/placement, disables editing/retarget and retries just persistence',async()=>{
 const f=fixture(),ui=f.open();await tick();f.failFlush();ui.find('submit').click();await tick();assert.match(ui.control('status').textContent,/保存失败.*新笔记已保留/);assert.equal(ui.find('submit').textContent,'继续确认投递');assert.equal(ui.control('title').disabled,true);assert.equal(ui.control('destination').disabled,true);assert.equal(ui.find('choose').disabled,true);assert.equal(ui.find('cancel').disabled,false);f.failFlush(false);ui.find('submit').click();await tick();assert.equal(f.counts().creates,1);assert.equal(f.counts().placements,1);assert.equal(f.counts().flushes,2);assert.equal(f.counts().returns,1);
});
test('cancel while creating then reopen waits for retained late result without duplicate note',async()=>{
 const f=fixture(),gate=f.startCreate(),ui=f.open();await tick();ui.find('submit').click();await tick();ui.find('cancel').click();const again=f.open();await tick();assert.equal(again.find('submit').disabled,true);assert.equal(again.control('body').value,'正文\r\n精确保留');gate.resolve(undefined);await tick();assert.equal(again.find('submit').disabled,false);assert.equal(again.control('title').disabled,true);assert.equal(again.control('body').value,'正文\r\n精确保留');assert.match(again.control('status').textContent,/已创建/);assert.match(f.notices[0],/笔记已保留/);again.find('submit').click();await tick();assert.equal(f.counts().creates,1);assert.equal(f.counts().placements,1);assert.equal(f.counts().returns,1);
});
test('navigation invalidation closes the modal monotonically and stops late placement/return',async()=>{
 const f=fixture(),gate=f.startCreate(),ui=f.open();await tick();ui.find('submit').click();await tick();f.stop();gate.resolve(undefined);await tick();assert.equal(ui.modal.closeCount,1);assert.equal(f.counts().placements,0);assert.equal(f.counts().returns,0);assert.ok(f.draft.attempt?.file);assert.equal(f.draft.body,'正文\r\n精确保留');
});
test('late successful save after cancel preserves completion but never returns or opens a note',async()=>{
 const f=fixture(),gate=f.startFlush(),ui=f.open();await tick();ui.find('sidebar').click();await tick();ui.find('cancel').click();gate.resolve(undefined);await tick();assert.equal(f.draft.attempt?.saved,true);assert.equal(f.counts().returns,0);assert.equal(f.counts().sidebars,0);assert.equal(f.counts().placements,1);
});
test('unknown creation outcome visibly blocks duplicate retry while cancellation stays available',async()=>{
 const f=fixture(),ui=f.open();await tick();f.uncertain();ui.find('submit').click();await tick();assert.match(ui.control('status').textContent,/创建未确认/);assert.equal(ui.find('submit').disabled,true);assert.equal(ui.control('title').disabled,true);assert.equal(ui.find('cancel').disabled,false);ui.find('submit').click();assert.equal(f.counts().creates,1);
});
test('reopened uncertain draft keeps its explanation visible instead of silently disabling submit',async()=>{
 const f=fixture(),ui=f.open();await tick();f.uncertain();ui.find('submit').click();await tick();ui.find('cancel').click();const reopened=f.open();await tick();assert.match(reopened.control('status').textContent,/创建未确认.*核对仓库/);assert.equal(reopened.find('submit').disabled,true);assert.equal(reopened.control('body').value,'正文\r\n精确保留');assert.equal(f.counts().creates,1);
});
test('failed return keeps a successful draft with explicit new-capture action; no duplicate create',async()=>{
 const f=fixture(),ui=f.open();await tick();f.failNavigate();ui.find('submit').click();await tick();assert.match(ui.control('status').textContent,/返回位置失败/);assert.equal(ui.find('another').hidden,false);assert.equal(ui.find('submit').textContent,'返回收集前位置');ui.find('another').click();assert.equal(f.draft.title,'');assert.equal(f.draft.body,'');assert.equal(ui.control('title').disabled,false);assert.equal(f.counts().creates,1);
});
test('Ctrl/Cmd+Enter submits once, plain Enter and composing strokes preserve typed text',async()=>{
 const f=fixture(),ui=f.open();await tick();let prevented=0;const event=(extra:any={})=>({key:'Enter',preventDefault:()=>prevented++,...extra});ui.modal.contentEl.fire('keydown',event());ui.modal.contentEl.fire('keydown',event({metaKey:true,isComposing:true}));ui.modal.contentEl.fire('keydown',event({ctrlKey:true,keyCode:229}));assert.equal(f.counts().creates,0);assert.equal(prevented,0);ui.modal.contentEl.fire('keydown',event({metaKey:true}));await tick();assert.equal(f.counts().creates,1);assert.equal(prevented,1);
});
test('repeated close releases viewport, navigation hook and lifecycle exactly once',async()=>{
 const f=fixture(),ui=f.open();await tick();const binding=bindings.at(-1)!;ui.modal.close();ui.modal.close();assert.equal(binding.disposed,1);assert.equal(f.counts().closed,1);assert.equal(f.counts().watchDisposed,1);assert.equal(ui.modal.contentEl.listeners.get('keydown')?.size,0);
});
