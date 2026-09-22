import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as cmState from '@codemirror/state';

function load(file:string,imports:Record<string,unknown>,warnings:unknown[]){
 const module={exports:{} as any};new Function('require','module','exports','console',transformSync(readFileSync(file,'utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name]||(name==='@codemirror/state'?cmState:{}),module,module.exports,{warn:(...args:unknown[])=>warnings.push(args)});return module.exports;
}
function fixture(fail=''){
 const warnings:unknown[]=[],releases:string[]=[],cleanup=load('src/editor-cleanup.ts',{},warnings);
 const {InlineNodeEditor}=load('src/inline-node-editor.ts',{'./editor-cleanup':cleanup},warnings),e=Object.create(InlineNodeEditor.prototype);
 const release=(name:string)=>()=>{releases.push(name);if(name===fail)throw Error('cleanup failure: '+name);};
 Object.assign(e,{input:{value:'正文',readOnly:false},options:{value:'原文',save:async()=>{},dispose:release('measurement')},node:{removeClass:release('outline')},el:{ownerDocument:{defaultView:{cancelAnimationFrame:release('frame'),clearTimeout:release('timer')}},remove:release('surface'),removeClass:()=>{},addClass:()=>{}},observer:{disconnect:release('observer')},native:{dispose:release('native')},toolbarDispose:release('toolbar'),actionNavigationDispose:release('navigation'),layoutFrame:1,focusTimer:2,flushLayout:()=>{},updateState:()=>{},status:{setText:()=>{}}});
 return{e,releases,warnings,cleanup};
}
const resources=['frame','timer','toolbar','navigation','observer','native','measurement','outline','surface'];
test('successful content save remains successful when toolbar cleanup fails',async()=>{
 const {e,releases,warnings}=fixture('toolbar');let saved='';e.options.save=async(value:string)=>{saved=value;e.dispose();};
 assert.equal(await e.commit(),true);assert.equal(saved,'正文');assert.deepEqual(releases,resources);assert.equal(warnings.length,1);assert.equal(e.saving,false);
});
test('each resource failure is isolated and every cleanup is attempted exactly once',()=>{
 for(const name of resources){const {e,releases,warnings}=fixture(name);assert.doesNotThrow(()=>e.dispose());e.dispose();assert.deepEqual(releases,resources,name);assert.equal(warnings.length,1,name);assert.equal(e.layoutFrame,undefined);assert.equal(e.focusTimer,undefined);assert.equal(e.native,undefined);assert.equal(e.toolbarDispose,undefined);}
});
test('reentrant disposal cannot invoke the same disposer twice',()=>{
 const {e,releases}=fixture();e.toolbarDispose=()=>{releases.push('toolbar');e.dispose();};e.dispose();assert.deepEqual(releases,resources);
});
test('a throwing old toolbar does not discard the new toolbar cleanup',()=>{
 const {e,releases,warnings}=fixture('toolbar');let next=0;e.replaceToolbar(()=>next++);assert.equal(next,0);e.dispose();assert.equal(next,1);assert.equal(releases.filter(n=>n==='toolbar').length,1);assert.equal(warnings.length,1);
});
test('late toolbar registration on a disposed draft is immediately released',()=>{
 const {e}=fixture();e.dispose();let calls=0;e.replaceToolbar(()=>calls++);e.dispose();assert.equal(calls,1);assert.equal(e.toolbarDispose,undefined);
});
test('old toolbar can close the draft while replacement is being installed',()=>{
 const {e}=fixture();let next=0;e.toolbarDispose=()=>e.dispose();e.replaceToolbar(()=>next++);assert.equal(next,1);assert.equal(e.toolbarDispose,undefined);
});
test('native teardown still destroys the view and removes its surface after unload failure',()=>{
 const {cleanup,warnings}=fixture(),{NativeMarkdownDraft}=load('src/native-markdown-editor.ts',{'./editor-cleanup':cleanup},warnings),e=new EventTarget();Object.setPrototypeOf(e,NativeMarkdownDraft.prototype);const n=e as any,released:string[]=[];
 Object.assign(n,{ready:true,stopEvents:()=>released.push('events'),engine:{unload:()=>{released.push('unload');throw Error('host unload failure');},destroy:()=>released.push('destroy')},host:{remove:()=>released.push('surface')}});
 n.dispose();n.dispose();assert.deepEqual(released,['events','unload','destroy','surface']);assert.equal(warnings.length,1);
});
test('late native events do not reach disposed editor handlers or its destroyed engine',()=>{
 const {cleanup,warnings}=fixture(),{NativeMarkdownDraft}=load('src/native-markdown-editor.ts',{'./editor-cleanup':cleanup},warnings),e=new EventTarget();Object.setPrototypeOf(e,NativeMarkdownDraft.prototype);const n=e as any;
 Object.assign(n,{ready:true,engine:{cm:{contentDOM:{dispatchEvent:()=>{throw Error('dead engine accessed');}}}},host:{remove:()=>{}}});let delivered=0;n.addEventListener('input',()=>delivered++);n.emit('input');assert.equal(delivered,1);n.dispose();n.emit('input');assert.equal(n.dispatchEvent(new Event('input')),false);assert.equal(n.dispatchEvent(new Event('compositionend')),false);assert.equal(delivered,1);
});
