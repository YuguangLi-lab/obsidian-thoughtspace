import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {releaseEditorResource} from '../src/editor-cleanup';

// Exercise async renderer ownership with a controlled host; no Obsidian runtime in Node.
function fixture(size={width:300,height:180}){
 const jobs:{resolve:()=>void;scope:any}[]=[],holders:any[]=[],applied:any[]=[];
 const probe=()=>({value:'',querySelectorAll:()=>[]});
 const preview={isConnected:true,cloneNode:probe,parentElement:{createDiv:()=>{const holder={removed:false,appendChild:()=>{},remove(){this.removed=true;}};holders.push(holder);return holder;}}};
 class Scope{loaded=false;load(){this.loaded=true;}unload(){this.loaded=false;}}
 const imports:Record<string,unknown>={'./editor-cleanup':{releaseEditorResource},obsidian:{Component:Scope,MarkdownRenderer:{render:(_:unknown,value:string,node:any,_path:string,scope:Scope)=>{node.value=value;return new Promise<void>(resolve=>jobs.push({resolve,scope}));}}},'./excerpt-sources':{excerptPresentation:(body:string)=>({body})},'./rendering':{markdownPreview:(body:string)=>body},'./workspace-tools':{measureNoteCard:()=>size}};
 const module={exports:{} as any};new Function('require','module','exports','window',transformSync(readFileSync('src/inline-card-fit.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name],module,module.exports,{setTimeout,clearTimeout});
 const fit=new module.exports.InlineCardFit({},preview,'note.md',undefined,(size:any)=>applied.push(size));return{fit,jobs,holders,applied};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('stale renderer completion cannot resize the latest draft',async()=>{
 const {fit,jobs,holders,applied}=fixture();fit.schedule('older');const pending=fit.flush();fit.schedule('latest');jobs[0].resolve();await tick();assert.equal(applied.length,0);assert.equal(jobs.length,2);jobs[1].resolve();await pending;assert.deepEqual(applied,[{width:300,height:180}]);assert.ok(holders.every(h=>h.removed));fit.dispose();
});
test('dispose releases render components and detached measurement DOM before renderer resolves',async()=>{
 const {fit,jobs,holders,applied}=fixture();fit.schedule('draft');const pending=fit.flush();assert.equal(jobs[0].scope.loaded,true);fit.dispose();assert.equal(jobs[0].scope.loaded,false);assert.equal(holders[0].removed,true);jobs[0].resolve();await pending;assert.equal(applied.length,0);
});
test('unchanged content avoids a second render and unchanged size avoids a second layout',async()=>{
 const {fit,jobs,applied}=fixture();fit.schedule('one');let pending=fit.flush();jobs[0].resolve();await pending;fit.schedule('one');await fit.flush();assert.equal(jobs.length,1);fit.schedule('two');pending=fit.flush();jobs[1].resolve();await pending;assert.equal(jobs.length,2);assert.equal(applied.length,1);fit.dispose();
});
test('appearance changes invalidate an unchanged draft measurement',async()=>{
 const {fit,jobs,applied}=fixture();fit.schedule('same');let pending=fit.flush();jobs[0].resolve();await pending;
 fit.schedule('same',true);pending=fit.flush();assert.equal(jobs.length,2);jobs[1].resolve();await pending;
 assert.equal(applied.length,1);fit.dispose();
});
test('old font measurement cannot apply after appearance changes during rendering',async()=>{
 const {fit,jobs,applied}=fixture();fit.schedule('same');const pending=fit.flush();fit.schedule('same',true);jobs[0].resolve();await tick();assert.equal(applied.length,0);assert.equal(jobs.length,2);jobs[1].resolve();await pending;assert.equal(applied.length,1);fit.dispose();
});

test('failed measurement scope cleanup still removes its holder and cancels future work',async(t)=>{
 const warnings:unknown[]=[];t.mock.method(console,'warn',(...args:unknown[])=>warnings.push(args));
 const {fit,jobs,holders,applied}=fixture();fit.schedule('draft');const pending=fit.flush();let calls=0;jobs[0].scope.unload=()=>{calls++;throw Error('scope cleanup failed');};fit.schedule('newer');
 fit.dispose();fit.dispose();assert.equal(holders[0].removed,true);assert.equal(fit.timer,undefined);assert.equal(calls,1);assert.equal(warnings.length,1);
 jobs[0].resolve();await pending;assert.equal(calls,1);assert.equal(jobs.length,1);assert.equal(applied.length,0);
});

test('invalid dimensions never leave the async draft measurement boundary',async()=>{for(const size of [{width:300,height:NaN},{width:Infinity,height:180},{width:0,height:180}]){const {fit,jobs,applied}=fixture(size);fit.schedule('draft');const pending=fit.flush();jobs[0].resolve();await pending;assert.equal(applied.length,0);fit.dispose();}});
