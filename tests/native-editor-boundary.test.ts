import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as guards from '../src/value-guards';
import * as state from '@codemirror/state';

function fixture(){
 class EditorView {}
 const module={exports:{}},source=readFileSync('src/native-markdown-editor.ts','utf8')+'\nexport {editorConstructor,isNativeEngine};';
 const require=(name:string)=>name==='@codemirror/state'?state:name==='@codemirror/view'?{EditorView}:name==='./value-guards'?guards:{};
 new Function('require','module','exports',transformSync(source,{loader:'ts',format:'cjs'}).code)(require,module,module.exports);
 const api=module.exports as {editorConstructor(app:unknown,parent:unknown):unknown;isNativeEngine(engine:unknown):boolean};
 let removed=0,unloaded=0,created=0;
 class Base {getDynamicExtensions(){return [];}}
 class LiveEditor extends Base {}
 const probe={editable:false,editMode:new LiveEditor(),showEditor(){},unload(){unloaded++;}};
 const parent={createDiv(){return{remove(){removed++;}};}};
 const app={embedRegistry:{embedByExtension:{md(){created++;return probe;}}}};
 return{api,EditorView,Base,probe,parent,app,counts:()=>({removed,unloaded,created})};
}
test('native editor discovery validates the host boundary, releases its probe and caches by app',()=>{
 const f=fixture();assert.equal(f.api.editorConstructor(f.app,f.parent),f.Base);assert.deepEqual(f.counts(),{removed:1,unloaded:1,created:1});
 assert.equal(f.api.editorConstructor(f.app,f.parent),f.Base);assert.deepEqual(f.counts(),{removed:1,unloaded:1,created:1});
});
test('changed or missing host internals fail predictably and release a usable probe',()=>{
 const f=fixture();for(const app of [null,{}, {embedRegistry:{embedByExtension:{md:42}}}])assert.throws(()=>f.api.editorConstructor(app,f.parent),/unavailable/);
 Object.assign(f.probe,{editMode:null});assert.throws(()=>f.api.editorConstructor(f.app,f.parent),/unavailable/);assert.equal(f.counts().unloaded,1);
});
test('native engine validation checks CodeMirror and required editor lifecycle methods',()=>{
 const f=fixture(),engine={cm:new f.EditorView(),editor:{getValue:()=>'',undo(){},redo(){}},load(){},set(){},show(){},unload(){},destroy(){}};
 assert.equal(f.api.isNativeEngine(engine),true);
 for(const bad of [null,{}, {...engine,cm:{}},{...engine,editor:{getValue:()=>''}},{...engine,destroy:undefined}])assert.equal(f.api.isNativeEngine(bad),false);
});
