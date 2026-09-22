import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
function load(){
 const warnings:unknown[]=[],compile=(path:string,imports:Record<string,unknown>,extra='')=>{const m={exports:{} as any};new Function('require','module','exports','console',transformSync(readFileSync(path,'utf8')+extra,{loader:'ts',format:'cjs'}).code)((n:string)=>imports[n]||{},m,m.exports,{warn:(...args:unknown[])=>warnings.push(args)});return m.exports;};
 const cleanup=compile('src/editor-cleanup.ts',{});return{...compile('src/note-markdown-toolbar.ts',{obsidian:{Component:class{},MarkdownView:class{}},'./editor-cleanup':cleanup},'\nexport {NoteToolbar};'),warnings};
}
function fixture(fail=''){
 const {NoteToolbar,warnings}=load(),b=Object.create(NoteToolbar.prototype),calls:string[]=[];
 const release=(name:string)=>()=>{calls.push(name);if(name===fail)throw Error(name);};
 Object.assign(b,{frame:1,range:{text:'old',from:0,to:3},cleanup:release('toolbar'),host:{ownerDocument:{defaultView:{cancelAnimationFrame:release('frame')}},remove:release('surface')},view:{contentEl:{removeClass:release('layout')}}});return{b,calls,warnings};
}
test('note teardown isolates each failure and continues remaining cleanup once',()=>{for(const name of ['frame','toolbar','surface','layout']){const {b,calls,warnings}=fixture(name);assert.doesNotThrow(()=>b.onunload());b.onunload();assert.deepEqual(calls,['frame','toolbar','surface','layout'],name);assert.equal(warnings.length,1);assert.equal(b.cleanup,undefined);assert.equal(b.frame,undefined);assert.equal(b.range,undefined);}});
test('reentrant note teardown does not invoke old callbacks twice',()=>{const {b,calls}=fixture();b.cleanup=()=>{calls.push('toolbar');b.onunload();};b.onunload();assert.deepEqual(calls,['frame','toolbar','surface','layout']);});
test('failed old callback cannot discard the new note toolbar cleanup',()=>{const {b}=fixture('toolbar');let next=0;b.replaceToolbar(()=>next++);b.onunload();assert.equal(next,1);});
test('late toolbar registration is released without reviving a closed note',()=>{const {b}=fixture();b.onunload();let calls=0;b.replaceToolbar(()=>calls++);assert.equal(calls,1);assert.equal(b.cleanup,undefined);});
test('closed note synchronization is inert',()=>{const {b}=fixture();b.onunload();b.valid=()=>{throw Error('old view accessed');};assert.doesNotThrow(()=>b.sync());});
test('manager continues shutting down other note bindings after one failure',()=>{const {NoteMarkdownToolbars,warnings}=load(),m=Object.create(NoteMarkdownToolbars.prototype),a={},b={},calls:unknown[]=[];Object.assign(m,{running:true,bindings:new Map([[{},a],[{},b]]),removeChild:(binding:unknown)=>{calls.push(binding);if(binding===a)throw Error('first binding');}});assert.doesNotThrow(()=>m.onunload());assert.deepEqual(calls,[a,b]);assert.equal(m.bindings.size,0);assert.equal(m.running,false);assert.equal(warnings.length,1);m.onunload();assert.equal(calls.length,2);});
test('delayed reconciliation after shutdown never consults the workspace',()=>{const {NoteMarkdownToolbars}=load(),m=Object.create(NoteMarkdownToolbars.prototype);Object.assign(m,{running:false,app:{workspace:{getLeavesOfType:()=>{throw Error('stale reconcile');}}}});assert.doesNotThrow(()=>m.reconcile());});
test('late snapshot never reads the editor after a failed cleanup',()=>{const {b}=fixture('toolbar');b.onunload();b.editor={getValue:()=>{throw Error('dead editor');}};assert.deepEqual(b.snapshot(),{text:'',start:0,end:0,busy:true,disabledReason:'编辑器已关闭或切换'});});
test('snapshot also rejects stale file ownership before reading text',()=>{const {b}=fixture();b.file={};b.view.file={};b.editor={getValue:()=>{throw Error('old file read');}};assert.equal(b.snapshot().text,'');assert.equal(b.snapshot().busy,true);});

function notificationFixture(){
 const {NoteToolbar}=load(),b=Object.create(NoteToolbar.prototype),frames:(()=>void)[]=[];let delivered=0;
 Object.assign(b,{host:{isConnected:true,hidden:false,ownerDocument:{defaultView:{requestAnimationFrame:(run:()=>void)=>{frames.push(run);return frames.length;}}}},input:{dispatchEvent:()=>delivered++}});
 return{b,frames,delivered:()=>delivered};
}
test('detached note does not queue formatting reads before manager cleanup',()=>{
 const {b,frames}=notificationFixture();b.host.isConnected=false;b.notify();assert.equal(frames.length,0);
});
test('note detached after scheduling does not deliver its obsolete update',()=>{
 const {b,frames,delivered}=notificationFixture();b.notify();b.host.isConnected=false;frames[0]();assert.equal(delivered(),0);assert.equal(b.frame,undefined);
});
test('reattached note resumes one batched notification without stale work',()=>{
 const {b,frames,delivered}=notificationFixture();b.notify();b.host.isConnected=false;frames[0]();b.host.isConnected=true;for(let n=0;n<40;n++)b.notify();assert.equal(frames.length,2);frames[1]();assert.equal(delivered(),1);
});
