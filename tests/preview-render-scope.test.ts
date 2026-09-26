import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {releaseEditorResource} from '../src/editor-cleanup';

function fixture(){
 class Component {
  loaded=false;children:Component[]=[];cleanups:(()=>unknown)[]=[];
  load(){if(this.loaded)return;this.loaded=true;this.onload();}
  onload(){}
  unload(){if(!this.loaded)return;this.loaded=false;for(const child of this.children.splice(0))child.unload();for(const cleanup of this.cleanups.splice(0))cleanup();}
  addChild<T extends Component>(child:T):T{this.children.push(child);if(this.loaded)child.load();return child;}
  register(cleanup:()=>unknown){this.cleanups.push(cleanup);}
 }
 const module={exports:{} as {PreviewRenderScope:new()=>Component}},deps:Record<string,unknown>={obsidian:{Component},'./editor-cleanup':{releaseEditorResource}};
 new Function('require','module','exports',transformSync(readFileSync('src/preview-render-scope.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>deps[name],module,module.exports);
 return{Component,scope:new module.exports.PreviewRenderScope()};
}

test('native preview scope retains live children and cleanup until its owner closes once',()=>{
 const f=fixture();let cleaned=0,loads=0;class Child extends f.Component{onload(){loads++;this.register(()=>cleaned++);}}
 f.scope.load();const child=f.scope.addChild(new Child());f.scope.register(()=>cleaned++);assert.equal(child.loaded,true);assert.equal(cleaned,0);
 f.scope.unload();assert.equal(child.loaded,false);assert.equal(cleaned,2);f.scope.unload();f.scope.load();assert.equal(f.scope.loaded,false);assert.equal(loads,1);assert.equal(cleaned,2);
});

test('throwing native cleanups do not strand the remaining or late preview resources',t=>{
 const f=fixture(),warnings:unknown[][]=[];t.mock.method(console,'warn',(...values:unknown[])=>warnings.push(values));let cleaned=0;
 f.scope.load();f.scope.register(()=>{throw Error('native cleanup');});f.scope.register(()=>cleaned++);assert.doesNotThrow(()=>f.scope.unload());assert.equal(cleaned,1);
 assert.doesNotThrow(()=>f.scope.register(()=>{throw Error('late cleanup');}));f.scope.register(()=>cleaned++);assert.equal(cleaned,2);assert.equal(warnings.length,2);
});

test('a late child that fails during onload still releases its partially registered resources',t=>{
 const f=fixture();let cleaned=0,warnings=0;t.mock.method(console,'warn',()=>warnings++);class Child extends f.Component{onload(){this.register(()=>cleaned++);throw Error('late child');}}
 f.scope.load();f.scope.unload();const child=new Child();assert.equal(f.scope.addChild(child),child);assert.equal(child.loaded,false);assert.equal(cleaned,1);assert.equal(warnings,1);assert.equal(f.scope.children.length,0);
});
