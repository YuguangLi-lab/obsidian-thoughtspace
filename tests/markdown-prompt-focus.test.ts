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
 children:Element[]=[];value='';disabled=false;focused=false;selected=false;onclick?:()=>unknown;onkeydown?:(event:any)=>void;
 constructor(readonly tag:string,options:any={}){this.value=options.value||'';}
 createEl(tag:string,options:any={}){const el=new Element(tag,options);this.children.push(el);return el;}createSpan(options:any={}){return this.createEl('span',options);}
 addClass(){}empty(){this.children=[];}focus(){this.focused=true;}select(){this.selected=true;}click(){if(!this.disabled)this.onclick?.();}
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
  modalEl=new Element('modal');contentEl=new Element('content');closed=false;constructor(readonly app:any){}
  open(){(this as any).onOpen();}close(){closes++;this.closed=true;(this as any).onClose();active=invoker;}
 }
 const act=(run:()=>unknown)=>{try{const pending=Promise.resolve(run());actions.push(pending);void pending.catch(error=>errors.push(error));}catch(error){errors.push(error);}};
 const Prompt=new Function('Modal','View','BoardView','act','setIcon','themeSurface',transformSync(source.slice(start,end)+';return Prompt;',{loader:'ts'}).code)(Modal,View,BoardView,act,()=>{},()=>{});
 const context={app,invoker,target,other,activate:(leaf:Leaf)=>{active=leaf;},setUnknown:(value:unknown)=>{activeValue=value;override=true;},activations};
 const modal=new Prompt(app,'Name board',initial,async(text:string,choice?:string)=>{submits.push([text,choice]);await submit(context,text,choice);},withChoice?{label:'Board type',value:'board',items:[{value:'board',text:'Board'},{value:'brain',text:'Brain'}]}:undefined);
 modal.open();const input=modal.contentEl.all('input')[0] as Element,save=modal.contentEl.all('button')[0] as Element,select=modal.contentEl.all('select')[0] as Element|undefined;
 const drain=async()=>{await Promise.allSettled(actions);await Promise.resolve();};
 return{...context,modal,input,save,select,submits,errors,drain,active:()=>active,closes:()=>closes};
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
 const f=fixture(context=>context.activate(context.target),'   ');f.save.click();await f.drain();assert.equal(f.closes(),0);assert.deepEqual(f.submits,[]);assert.deepEqual(f.activations,[]);f.modal.close();assert.equal(f.active(),f.invoker);assert.deepEqual(f.submits,[]);assert.deepEqual(f.activations,[]);
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
