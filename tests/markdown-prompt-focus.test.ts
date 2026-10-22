import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

// Execute the real Prompt and button. Only the DOM/Modal focus restoration and
// workspace leaf boundary are substituted; no submit or close logic is copied.
const source=readFileSync(process.env.THOUGHTSPACE_PROMPT_SOURCE||'src/main.ts','utf8');
const start=source.indexOf('function button('),end=source.indexOf('class NotePicker ',start);
assert(start>=0&&end>start);
class Element {
 children:Element[]=[];attrs:Record<string,string>={};value='';text='';disabled=false;focused=false;selected=false;connected=true;parent?:Element;
 onclick?:()=>unknown;onkeydown?:(event:any)=>void;oninput?:()=>void;
 constructor(readonly tag:string,options:any={}){this.value=options.value||'';this.text=options.text||'';this.attrs={...(options.attr||{})};if(options.cls)this.attrs.class=options.cls;}
 createEl(tag:string,options:any={}){const el=new Element(tag,options);el.parent=this;this.children.push(el);return el;}
 createSpan(options:any={}){return this.createEl('span',options);}createDiv(options:any={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 addClass(...names:string[]){this.attrs.class=[this.attrs.class,...names].filter(Boolean).join(' ');}
 empty(){for(const child of this.children){child.parent=undefined;child.connected=false;}this.children=[];this.text='';}
 setText(text:string){this.empty();this.text=text;}setAttribute(name:string,value:string){this.attrs[name]=value;}removeAttribute(name:string){delete this.attrs[name];}
 focus(){this.focused=true;}select(){this.selected=true;}click(){if(!this.disabled)this.onclick?.();}
 get isConnected():boolean{return this.parent?this.parent.isConnected:this.connected;}
 get lastElementChild(){return this.children.at(-1);}get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 all(tag:string):Element[]{return this.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...child.all(tag)]);}
}
type Leaf={id:string;view?:View};
class View {containerEl={isConnected:true};constructor(readonly leaf:Leaf){leaf.view=this;}}
class BoardView extends View {}
class MarkdownView extends View {}
function fixture(submit:(context:any,text:string,choice?:string)=>Promise<void>|void,initial='  New board  ',withChoice=true){
 const invoker:Leaf={id:'Navigator'},target:Leaf={id:'Board'},other:Leaf={id:'Other'},activations:any[][]=[],actions:Promise<unknown>[]=[],errors:unknown[]=[],submits:any[][]=[];
 new View(invoker);new BoardView(target);new MarkdownView(other);let active:Leaf=invoker,activeValue:unknown,override=false;
 const workspace={getActiveViewOfType:(kind:typeof View)=>override?activeValue:active.view instanceof kind?active.view:null,
  setActiveLeaf:(leaf:Leaf,options:unknown)=>{activations.push([leaf,options]);active=leaf;}};
 const app={workspace};let closes=0;
 class Modal {
  containerEl=new Element('container');modalEl=this.containerEl.createEl('modal');titleEl=this.modalEl.createEl('title');contentEl=this.modalEl.createEl('content');closed=false;constructor(readonly app:any){}
  open(){this.containerEl.connected=true;(this as any).onOpen();}close(){closes++;this.closed=true;(this as any).onClose();this.containerEl.connected=false;active=invoker;}
 }
 const act=(run:()=>unknown)=>{try{const pending=Promise.resolve(run());actions.push(pending);void pending.catch(error=>errors.push(error));}catch(error){errors.push(error);}};
 const Prompt=new Function('Modal','View','BoardView','act','setIcon','themeSurface','bindBoardModalViewport',transformSync(source.slice(start,end)+';return Prompt;',{loader:'ts'}).code)(Modal,View,BoardView,act,()=>{},()=>{},()=>()=>{});
 const context={app,invoker,target,other,activate:(leaf:Leaf)=>{active=leaf;},setUnknown:(value:unknown)=>{activeValue=value;override=true;},activations};
 const modal=new Prompt(app,'Name board',initial,async(text:string,choice?:string)=>{submits.push([text,choice]);await submit(context,text,choice);},withChoice?{label:'Board type',value:'board',items:[{value:'board',text:'Board'},{value:'brain',text:'Brain'}]}:undefined);
 modal.open();const input=modal.contentEl.all('input')[0] as Element,save=modal.contentEl.all('button').find((el:Element)=>el.attrs['aria-label']==='确定')! as Element,cancel=modal.contentEl.all('button').find((el:Element)=>el.attrs['aria-label']==='取消')! as Element,select=modal.contentEl.all('select')[0] as Element|undefined,status=modal.contentEl.all('div').find((el:Element)=>el.attrs.role==='status')! as Element;
 const drain=async()=>{await Promise.allSettled(actions);await Promise.resolve();};
 return{...context,modal,input,save,cancel,select,status,submits,errors,drain,active:()=>active,closes:()=>closes};
}

test('successful board creation restores the submitted target after Modal closes back to its Navigator invoker',async()=>{
 const f=fixture(async context=>{await Promise.resolve();context.activate(context.target);});f.save.click();await f.drain();
 assert.equal(f.modal.closed,true);assert.equal(f.closes(),1);assert.equal(f.active(),f.target);assert.deepEqual(f.activations,[[f.target,{focus:true}]]);assert.deepEqual(f.submits,[['New board','board']]);assert.deepEqual(f.errors,[]);
});
test('a successful generic naming action preserves a native Markdown destination through Modal focus restoration',async()=>{
 const f=fixture(context=>context.activate(context.other),'Native note',false);f.save.click();await f.drain();assert.equal(f.active(),f.other);assert.deepEqual(f.activations,[[f.other,{focus:true}]]);assert.deepEqual(f.submits,[['Native note',undefined]]);
});
test('renaming the current leaf does not navigate away or activate a different destination',async()=>{
 const f=fixture(()=>{},'Rename',false);f.activate(f.invoker);f.save.click();await f.drain();assert.equal(f.active(),f.invoker);assert(f.activations.every(([leaf])=>leaf===f.invoker));assert.equal(f.closes(),1);
});
test('a failed submit keeps the dialog and input available without restoring or stealing workspace focus',async()=>{
 const f=fixture(()=>{throw Error('Synthetic write failure');});const input=f.input,select=f.select!;f.save.click();await f.drain();
 assert.equal(f.modal.closed,false);assert.equal(f.closes(),0);assert.equal(f.active(),f.invoker);assert.deepEqual(f.activations,[]);assert.equal(f.save.disabled,false);assert.equal(select.disabled,false);assert.equal(input.value,'  New board  ');assert.match(String(f.errors[0]),/Synthetic write failure/);
});
test('cancel and blank submission close or retain the naming dialog without submitting or navigating',async()=>{
 const f=fixture(context=>context.activate(context.target),'   ');f.save.click();await f.drain();assert.equal(f.closes(),0);assert.deepEqual(f.submits,[]);assert.deepEqual(f.activations,[]);f.cancel.click();assert.equal(f.active(),f.invoker);assert.deepEqual(f.submits,[]);assert.deepEqual(f.activations,[]);
});
for(const invalid of ['null','undefined','bare-value','unrelated-leaf','detached-view']as const)test(`an unknown ${invalid} active source does not become a focus restoration target`,async()=>{
 const f=fixture(context=>{
  if(invalid==='null')context.setUnknown(null);else if(invalid==='undefined')context.setUnknown(undefined);else if(invalid==='bare-value')context.setUnknown({leaf:{id:'unverified'}});
  else if(invalid==='unrelated-leaf'){const stale=new View({id:'stale'});(stale.leaf as Leaf).view=undefined;context.setUnknown(stale);}
  else{context.target.view!.containerEl.isConnected=false;context.activate(context.target);}
 });f.save.click();await f.drain();assert.equal(f.modal.closed,true);assert.equal(f.active(),f.invoker);assert.deepEqual(f.activations,[]);assert.deepEqual(f.errors,[]);
});
test('a pending submit disables repeat Enter/click and restores focus only after the action finishes',async()=>{
 let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});const f=fixture(async context=>{await gate;context.activate(context.target);});
 const press=()=>f.input.onkeydown!({key:'Enter',isComposing:false,keyCode:13,defaultPrevented:false,preventDefault(){}});press();press();f.save.click();assert.equal(f.submits.length,1);assert.equal(f.save.disabled,true);assert.equal(f.select!.disabled,true);assert.equal(f.modal.closed,false);assert.deepEqual(f.activations,[]);
 finish();await f.drain();assert.equal(f.submits.length,1);assert.equal(f.active(),f.target);assert.equal(f.closes(),1);assert.equal(f.save.disabled,false);assert.equal(f.select!.disabled,false);
});


test('the naming input has a visible accessible label and blank validation clears when corrected',async()=>{
 const f=fixture(()=>{},'   ',false);
 assert.equal(f.input.attrs['aria-label'],'Name board');assert.equal(f.input.parent?.tag,'label');assert.match(f.input.parent!.textContent,/Name board/);
 f.save.click();await f.drain();assert.equal(f.input.attrs['aria-invalid'],'true');assert.match(f.status.textContent,/填写/);assert.equal(f.status.attrs.role,'status');assert.deepEqual(f.submits,[]);
 f.input.value='Corrected name';f.input.oninput?.();assert.equal(f.input.attrs['aria-invalid'],undefined);assert.equal(f.status.textContent,'');
 f.save.click();await f.drain();assert.deepEqual(f.submits,[['Corrected name',undefined]]);assert.equal(f.closes(),1);
});

test('failed save preserves the draft and exposes one visibly and accessibly named retry',async()=>{
 let attempts=0;const f=fixture(()=>{if(++attempts===1)throw Error('Synthetic retryable failure');});const text=f.input.value,choice=f.select!.value;
 f.save.click();await f.drain();assert.equal(f.input.value,text);assert.equal(f.select!.value,choice);assert.equal(f.input.disabled,false);assert.equal(f.select!.disabled,false);
 assert.equal(f.save.textContent,'重试');assert.equal(f.save.attrs['aria-label'],'重试');assert.equal(f.save.attrs.title,'重试');assert.match(f.status.textContent,/Synthetic retryable failure/);assert.equal(f.closes(),0);assert.deepEqual(f.activations,[]);
 f.save.click();await f.drain();assert.equal(attempts,2);assert.deepEqual(f.submits,[['New board','board'],['New board','board']]);assert.equal(f.closes(),1);
});

test('editing after a failed save resets the visible and accessible action without losing the corrected input',async()=>{
 let fail=true;const f=fixture(()=>{if(fail)throw Error('Fix the title');});f.save.click();await f.drain();
 f.input.value='Changed draft';f.input.oninput?.();assert.equal(f.save.textContent,'确定');assert.equal(f.save.attrs['aria-label'],'确定');assert.equal(f.save.attrs.title,'确定');assert.equal(f.status.textContent,'');assert.equal(f.input.value,'Changed draft');
 fail=false;f.save.click();await f.drain();assert.deepEqual(f.submits.at(-1),['Changed draft','board']);assert.equal(f.closes(),1);
});

test('cancel while saving does not cancel the submitted promise and its late completion cannot close or refocus again',async()=>{
 let finish!:()=>void,writes=0;const gate=new Promise<void>(resolve=>{finish=resolve;});
 const f=fixture(async()=>{await gate;writes++;});f.save.click();assert.equal(f.submits.length,1);assert.equal(f.input.disabled,true);assert.equal(f.save.disabled,true);
 f.cancel.click();assert.equal(f.closes(),1);f.activate(f.other);assert.equal(writes,0);
 finish();await f.drain();assert.equal(writes,1,'closing a dialog cannot undo an already-started caller promise');assert.equal(f.closes(),1);assert.equal(f.active(),f.other);assert.deepEqual(f.activations,[]);assert.equal(f.submits.length,1);
 f.save.click();await f.drain();assert.equal(f.submits.length,1,'a stale detached control cannot submit again');assert.equal(f.closes(),1);
});

test('a rejected pending save after cancel leaves the current page and closed dialog alone',async()=>{
 let reject!:(error:Error)=>void;const gate=new Promise<void>((_resolve,no)=>{reject=no;});const f=fixture(()=>gate);f.save.click();f.cancel.click();f.activate(f.other);
 reject(Error('Late write failure'));await f.drain();assert.equal(f.closes(),1);assert.equal(f.active(),f.other);assert.deepEqual(f.activations,[]);assert.equal(f.modal.contentEl.children.length,0);assert.equal(f.submits.length,1);assert.match(String(f.errors[0]),/Late write failure/);
});

test('a detached dialog cannot restore workspace focus after its pending action completes',async()=>{
 let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});const f=fixture(()=>gate);f.save.click();f.modal.containerEl.connected=false;f.activate(f.other);
 finish();await f.drain();assert.equal(f.active(),f.other);assert.deepEqual(f.activations,[]);assert.equal(f.closes(),0);assert.equal(f.submits.length,1);
});
