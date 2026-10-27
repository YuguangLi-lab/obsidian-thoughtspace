import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync('src/writing-view.ts','utf8');
function method(name:string){const start=source.indexOf(' private '+name+'(');assert.ok(start>=0);const end=source.indexOf('\n private ',start+1),onResize=source.indexOf('\n onResize()',start+1);return source.slice(start,Math.min(...[end,onResize].filter(n=>n>=0)));}
const constructorStart=source.indexOf(' constructor('),constructorEnd=source.indexOf('\n getViewType',constructorStart);
const closeStart=source.indexOf(' async onClose(){'),close=source.slice(closeStart,source.lastIndexOf('\n}'));
function fixture(){
 const calls:string[]=[],callbacks=new Set<()=>void>(),late:Array<()=>void>=[],docs=[{id:'main'},{id:'popup'}];
 const native={id:'exact native',resize(){calls.push('native measure');}},input={value:'exact manuscript',selectionStart:2,selectionEnd:6},leaf={id:'same leaf'};
 const root:any={ownerDocument:docs[0],onWindowMigrated(fn:()=>void){callbacks.add(fn);return()=>{calls.push('stop migration');callbacks.delete(fn);};},querySelector:()=>null,empty(){calls.push('empty on close');},removeAttribute(){}};
 class ItemView{contentEl=root;containerEl={removeClass(){}};constructor(public leaf:unknown){}}
 const bind=(name:string)=>(el:any)=>{const id=el.ownerDocument.id;calls.push('bind '+name+' '+id);let stopped=false;late.push(()=>{if(!stopped)calls.push('callback '+name+' '+id);});return()=>{assert.equal(stopped,false,'each binder released once');stopped=true;calls.push('stop '+name+' '+id);};};
 const code='class View extends ItemView{'+source.slice(constructorStart,constructorEnd)+method('refreshOwnerBindings')+method('bindWritingChrome')+method('currentWritingSnapshot')+close+'};return View';
 const View=new Function('ItemView','bindMobileViewport','bindBoardHostInset','bindWritingModeFocus',transformSync(code,{loader:'ts'}).code)(ItemView,bind('viewport'),bind('inset'),bind('mode'));
 const view=new View(leaf,{});Object.assign(view,{closed:false,mode:'write',generation:0,revision:0,articleRun:0,status:{},manuscriptNative:native,manuscriptInput:input,entryInputs:[],pendingFields:new Map(),flushFields(){},disposeEditors(){calls.push('dispose on close');}});
 const trigger={};view.bindWritingChrome(trigger);
 const move=(doc=docs[1])=>{root.ownerDocument=doc;for(const fn of callbacks)fn();};
 return{view,root,docs,calls,callbacks,late,native,input,leaf,trigger,move};
}
test('actual constructor and chrome methods bind each current owner once',()=>{
 const f=fixture();assert.deepEqual(f.calls,['bind viewport main','bind inset main','bind mode main']);f.view.refreshOwnerBindings();assert.equal(f.calls.length,3);assert.equal(f.callbacks.size,1);
});
test('real migration callback releases old owner resources before current bindings',()=>{
 const f=fixture();f.move();assert.deepEqual(f.calls.slice(3),['stop viewport main','bind viewport popup','stop mode main','stop inset main','bind inset popup','bind mode popup']);assert.equal(f.view.manuscriptNative,f.native);assert.equal(f.view.manuscriptInput,f.input);assert.equal(f.view.leaf,f.leaf);assert.deepEqual(f.input,{value:'exact manuscript',selectionStart:2,selectionEnd:6});assert.equal(f.calls.some(c=>/native measure|dispose|empty/.test(c)),false);
});
test('callbacks from released old owner cannot write after migration; current owner may update',()=>{
 const f=fixture(),old=[...f.late];f.move();const before=f.calls.length;old.forEach(fn=>fn());assert.equal(f.calls.length,before);f.late.slice(3).forEach(fn=>fn());assert.deepEqual(f.calls.slice(before),['callback viewport popup','callback inset popup','callback mode popup']);
});
test('move back to original window creates fresh bindings without reusing stale control memory',()=>{
 const f=fixture();f.move();f.move(f.docs[0]);assert.deepEqual(f.calls.slice(-6),['stop viewport popup','bind viewport main','stop mode popup','stop inset popup','bind inset main','bind mode main']);assert.equal(f.view.manuscriptNative,f.native);assert.equal(f.callbacks.size,1);
});
test('host resize owner check can recover when migration notification has not run yet',()=>{
 const f=fixture();f.root.ownerDocument=f.docs[1];f.view.refreshOwnerBindings();assert.deepEqual(f.calls.slice(-3),['stop inset main','bind inset popup','bind mode popup']);const n=f.calls.length;f.move();assert.equal(f.calls.length,n);
});
test('re-render chrome release prevents late old chrome closures from replacing current bindings',()=>{
 const f=fixture(),oldRefresh=f.view.refreshChrome,oldStop=f.view.stopChrome;f.view.bindWritingChrome({});const current=f.view.refreshChrome,n=f.calls.length;oldStop();oldRefresh();assert.equal(f.view.refreshChrome,current);assert.equal(f.calls.length,n);f.move();assert.equal(f.view.refreshChrome,current);
});
test('actual onClose unregisters migration and releases current binders once before editor disposal',async()=>{
 const f=fixture();f.move();const pendingCallback=[...f.callbacks][0];await f.view.onClose();assert.equal(f.callbacks.size,0);assert.equal(f.view.refreshChrome,undefined);const stopIndex=f.calls.indexOf('stop migration'),disposeIndex=f.calls.indexOf('dispose on close');assert.ok(stopIndex>=0&&stopIndex<disposeIndex);assert.deepEqual(f.calls.slice(stopIndex,disposeIndex),['stop migration','stop mode popup','stop inset popup','stop viewport popup']);const n=f.calls.length;pendingCallback();f.view.refreshOwnerBindings();f.late.forEach(fn=>fn());await f.view.onClose();assert.equal(f.calls.length,n);
});
test('transition cleanup removes chrome rebind but leaves view viewport migration available',()=>{
 const f=fixture();f.view.stopChrome();f.view.stopChrome=undefined;assert.equal(f.view.refreshChrome,undefined);f.move();assert.deepEqual(f.calls.slice(-2),['stop viewport main','bind viewport popup']);assert.equal(f.calls.filter(c=>c==='bind mode popup').length,0);
});
