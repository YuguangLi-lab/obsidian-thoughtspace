import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {releaseEditorResource} from '../src/editor-cleanup';
import {toolbarNavigation} from '../src/toolbar-navigation';
import {allowsReadOnlyKey,isSimpleTopicContinuation} from '../src/inline-editor-keys';

// A small DOM tree drives the shipped constructor and capture/bubble handlers.
// Geometry is intentionally not simulated: the native Obsidian layout check
// separately verifies wrapping and viewport bounds with the actual CSS.
class Element {
 parentElement:Element|null=null;children:Element[]=[];classes=new Set<string>();dataset:Record<string,string>={};attributes=new Map<string,string>();
 listeners=new Map<string,{run:(event:any)=>void;capture:boolean}[]>();style:Record<string,string>={};textContent='';value='';title='';hidden=false;disabled=false;readOnly=false;tabIndex=0;
 selectionStart=0;selectionEnd=0;offsetLeft=0;offsetTop=0;offsetWidth=280;offsetHeight=140;removed=false;
 onclick?:()=>void;onmousedown?:(event:any)=>void;
 classList={toggle:(name:string,on:boolean)=>{if(on)this.classes.add(name);else this.classes.delete(name);return on;}};
 constructor(public tagName:string,public ownerDocument:any,cls=''){for(const name of cls.split(' ').filter(Boolean))this.classes.add(name);}
 addClass(...names:string[]){names.forEach(name=>this.classes.add(name));}removeClass(name:string){this.classes.delete(name);}hasClass(name:string){return this.classes.has(name);}toggleClass(name:string,on:boolean){this.classList.toggle(name,on);}
 createEl(tag:string,options:any={}){const spec=typeof options==='string'?{cls:options}:options,el=new Element(tag.toUpperCase(),this.ownerDocument,spec.cls);el.textContent=spec.text||'';el.value=spec.value||'';for(const [key,value] of Object.entries(spec.attr||{}))el.setAttribute(key,String(value));this.appendChild(el);return el;}
 createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}
 appendChild(el:Element){el.remove();el.removed=false;el.parentElement=this;this.children.push(el);return el;}
 remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(el=>el!==this);this.parentElement=null;}this.removed=true;}
 setText(value:string){this.textContent=value;}setAttribute(key:string,value:string){this.attributes.set(key,value);}getAttribute(key:string){return this.attributes.get(key)??null;}
 contains(el:Element|null):boolean{return el===this||this.children.some(child=>child.contains(el));}
 closest(selector:string):Element|null{for(let el:Element|null=this;el;el=el.parentElement)if(el.matches(selector))return el;return null;}
 matches(selector:string){return selector.split(',').some(part=>part.startsWith('.')?this.classes.has(part.slice(1)):part==='button:not(:disabled)'?this.tagName==='BUTTON'&&!this.disabled:false);}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(el=>[...(el.matches(selector)?[el]:[]),...el.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0]||null;}
 getClientRects(){return this.hidden?[]:[{}];}
 addEventListener(type:string,run:(event:any)=>void,capture=false){const listeners=this.listeners.get(type)||[];listeners.push({run,capture:capture===true});this.listeners.set(type,listeners);}
 removeEventListener(type:string,run:(event:any)=>void){this.listeners.set(type,(this.listeners.get(type)||[]).filter(listener=>listener.run!==run));}
 dispatchEvent(event:any){
  Object.defineProperty(event,'target',{configurable:true,value:this});let stopped=false;
  const stop=event.stopPropagation?.bind(event);event.stopPropagation=()=>{stopped=true;stop?.();};
  const path:Element[]=[];for(let el:Element|null=this;el;el=el.parentElement)path.push(el);
  const send=(el:Element,capture:boolean)=>{for(const listener of el.listeners.get(event.type)||[])if(listener.capture===capture)listener.run(event);};
  for(const el of [...path].reverse()){send(el,true);if(stopped)return !event.defaultPrevented;}
  for(const el of path){send(el,false);if(stopped||!event.bubbles)break;}
  return !event.defaultPrevented;
 }
 focus(){const old=this.ownerDocument.activeElement;this.ownerDocument.activeElement=this;old?.dispatchEvent(new Event('focusout',{bubbles:true}));}
 setSelectionRange(start:number,end:number){this.selectionStart=start;this.selectionEnd=end;}
}

const module={exports:{} as any};
new Function('require','module','exports',transformSync(readFileSync('src/inline-node-editor.ts','utf8'),{loader:'ts',format:'cjs'}).code)(
 (name:string)=>name==='obsidian'?{setIcon(){},Notice:class{}}:name==='./editor-cleanup'?{releaseEditorResource}:name==='./toolbar-navigation'?{toolbarNavigation}:name==='./inline-editor-keys'?{allowsReadOnlyKey,isSimpleTopicContinuation}:{},module,module.exports);

function fixture(t:any,inCanvas=true){
 const timers=new Map<number,()=>void>(),frames=new Map<number,()=>void>();let id=0,disconnected=0;
 const doc:any={activeElement:null,defaultView:{setTimeout:(run:()=>void)=>{timers.set(++id,run);return id;},clearTimeout:(key:number)=>timers.delete(key),requestAnimationFrame:(run:()=>void)=>{frames.set(++id,run);return id;},cancelAnimationFrame:(key:number)=>frames.delete(key),navigator:{clipboard:{writeText:async()=>{}}}}};
 const root=doc.body=new Element('DIV',doc,'ts-root'),main=root.createDiv(inCanvas?'ts-main':'unrelated-host'),world=main.createDiv('ts-world'),node=world.createDiv('ts-node');world.style.transform='translate(-900px, -400px) scale(.3)';node.createDiv('ts-text-body');
 const previousStyle=globalThis.getComputedStyle,previousObserver=globalThis.ResizeObserver;
 Object.assign(globalThis,{getComputedStyle:()=>({fontFamily:'Host font',fontSize:'16px',fontWeight:'400',lineHeight:'24px',letterSpacing:'0px',textAlign:'left',paddingTop:'8px',paddingRight:'8px',paddingBottom:'8px',paddingLeft:'8px'}),ResizeObserver:class{observe(){}disconnect(){disconnected++;}}});
 const calls={save:[] as string[],cancel:0,topic:0},options={app:{},value:'Draft',nodeKind:'text',label:'编辑草稿',placeholder:'',markdown:false,resize(){},save:async(value:string)=>{calls.save.push(value);},cancel:()=>{calls.cancel++;},continueTopic:async()=>{calls.topic++;}};
 const editor=new module.exports.InlineNodeEditor(node,options);
 t.after(()=>{editor.dispose();Object.assign(globalThis,{getComputedStyle:previousStyle,ResizeObserver:previousObserver});});
 const flushFocus=()=>{const batch=[...timers.values()];timers.clear();for(const run of batch)run();};
 const chrome=()=>main.querySelector('.ts-inline-chrome'),bar=()=>main.querySelector('.ts-inline-editor-bar');
 const press=(target:Element,key:string,extra:Record<string,unknown>={})=>{const event={type:'keydown',bubbles:true,key,isComposing:false,keyCode:0,defaultPrevented:false,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...extra};target.dispatchEvent(event);return event;};
 return{editor,options,calls,root,main,world,node,doc,chrome,bar,press,flushFocus,timers,frames,disconnected:()=>disconnected};
}

test('editing actions and status leave the transformed world while the draft remains inside its node',t=>{
 const f=fixture(t),chrome=f.chrome();assert.ok(chrome,'screen-space chrome is attached to the owning canvas');
 assert.equal(chrome.parentElement,f.main);assert.equal(f.world.contains(chrome),false);assert.equal(f.node.contains(f.editor.el),true);assert.equal(f.editor.el.contains(f.editor.input),true);
 assert.equal(f.bar()!.parentElement,chrome);assert.equal(f.editor.status.parentElement,chrome);assert.equal(chrome.querySelectorAll('button:not(:disabled)').length,4);
});

test('focus can traverse the detached action row without saving or leaving the draft',async t=>{
 const f=fixture(t),bar=f.bar()!,actions=bar.querySelectorAll('button:not(:disabled)');
 assert.equal(f.editor.ownsFocus(actions[0]),true);assert.equal(f.editor.ownsFocus(f.editor.input),true);
 actions[0].focus();f.flushFocus();await Promise.resolve();assert.deepEqual(f.calls.save,[]);
 f.press(actions[0],'ArrowRight');f.flushFocus();await Promise.resolve();assert.equal(f.doc.activeElement,actions[1]);assert.deepEqual(f.calls.save,[]);
 const outside=f.main.createEl('button');outside.focus();f.flushFocus();await Promise.resolve();assert.deepEqual(f.calls.save,['Draft']);assert.equal(f.editor.ownsFocus(outside),false);
});

test('screen-space action keys keep save/cancel ownership and cannot create sibling topics',async t=>{
 const f=fixture(t),action=f.bar()!.querySelectorAll('button:not(:disabled)')[0];
 assert.equal(f.press(action,'Enter').defaultPrevented,false);assert.equal(f.calls.topic,0);
 assert.equal(f.press(action,'Escape').defaultPrevented,true);assert.equal(f.calls.cancel,1);
 assert.equal(f.press(action,'Enter',{metaKey:true}).defaultPrevented,true);await Promise.resolve();assert.deepEqual(f.calls.save,['Draft']);
});

test('composition protects detached actions and finishes before keyboard save',async t=>{
 const f=fixture(t),action=f.bar()!.querySelectorAll('button:not(:disabled)')[0];
 f.editor.input.dispatchEvent(new Event('compositionstart'));f.press(action,'Escape');f.press(action,'Enter',{ctrlKey:true});assert.equal(f.calls.cancel,0);assert.deepEqual(f.calls.save,[]);
 assert.equal(f.chrome()!.dataset.state,'composing');f.editor.input.dispatchEvent(new Event('compositionend'));f.press(action,'Enter',{ctrlKey:true});await Promise.resolve();assert.deepEqual(f.calls.save,['Draft']);
});

test('pending saves and errors stay visible in the same owned chrome without discarding the draft',async t=>{
 const f=fixture(t);let reject!:(reason:unknown)=>void;f.options.save=()=>new Promise<void>((_resolve,fail)=>{reject=fail;});
 const pending=f.editor.commit();await Promise.resolve();assert.equal(f.chrome()!.dataset.state,'saving');assert.equal(f.chrome()!.getAttribute('aria-busy'),'true');assert.equal(f.editor.actions[0].disabled,true);assert.equal(f.editor.actions[2].disabled,false);
 reject(Error('Source changed'));assert.equal(await pending,false);assert.equal(f.chrome()!.dataset.state,'error');assert.equal(f.chrome()!.hasClass('has-error'),true);assert.match(f.editor.status.textContent,/Source changed/);assert.equal(f.editor.input.value,'Draft');
 f.editor.actions[0].focus();f.flushFocus();assert.equal(f.editor.saving,false);
});

test('disposing removes only this draft chrome and cancels its local focus/layout work',t=>{
 const f=fixture(t),chrome=f.chrome()!;assert.ok(chrome);const neighbor=f.main.createDiv('another-editor-chrome');
 f.editor.checkFocus();f.editor.scheduleLayout();assert.ok(f.timers.size);assert.ok(f.frames.size);f.editor.dispose();
 assert.equal(chrome.parentElement,null);assert.equal(f.editor.el.parentElement,null);assert.equal(neighbor.parentElement,f.main);assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);assert.equal(f.disconnected(),1);
 f.editor.dispose();assert.equal(f.disconnected(),1);
});

test('a non-canvas fallback keeps its action row owned without requiring a global document lookup',t=>{
 const f=fixture(t,false);assert.equal(f.chrome(),null);assert.equal(f.bar()!.parentElement,f.editor.el);assert.equal(f.editor.ownsFocus(f.bar()),true);
});
