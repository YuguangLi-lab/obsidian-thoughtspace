import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {transformSync} from 'esbuild';

function fixture(platform:unknown,missingHost=false){
 const calls:string[]=[],module={exports:{}};
 new Function('require','module','exports',transformSync(readFileSync('src/platform-runtime.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{
  calls.push(name);if(name==='obsidian'){if(missingHost)throw Error('host unavailable');return{Platform:platform};}
  if(name==='path')return{resolve};throw Error(`Unexpected runtime dependency: ${name}`);
 },module,module.exports);
 return{api:module.exports as typeof import('../src/platform-runtime'),calls};
}

test('importing portable runtime helpers does not evaluate the host or a Node backend',()=>{
 const f=fixture({isDesktop:false});assert.deepEqual(f.calls,[]);
});

test('mobile and unknown hosts refuse desktop paths before loading Node',()=>{
 for(const platform of [{isDesktop:false},{},undefined,{isDesktop:'true'}]){
  const f=fixture(platform);assert.equal(f.api.isDesktopRuntime(),false);
  assert.throws(()=>f.api.requireDesktopRuntime('仓库外媒体'),/仓库外媒体需要桌面版 Obsidian/);
  assert.throws(()=>f.api.desktopPathResolve('/vault','file'),/桌面文件路径需要桌面版 Obsidian/);
  assert.ok(f.calls.every(name=>name==='obsidian'));
 }
 const missing=fixture(undefined,true);assert.equal(missing.api.isDesktopRuntime(),false);assert.throws(()=>missing.api.desktopPathResolve('/vault'),/需要桌面版/);assert.ok(!missing.calls.includes('path'));
});

test('desktop paths preserve the existing Node resolve semantics and load only on demand',()=>{
 const f=fixture({isDesktop:true});assert.equal(f.api.isDesktopRuntime(),true);assert.deepEqual(f.calls,['obsidian']);
 for(const parts of [['/Users/example/../example/研究库'],['/vault','folder','../file'],['relative','/absolute','next']])assert.equal(f.api.desktopPathResolve(...parts),resolve(...parts));
 assert.equal(f.calls.filter(name=>name==='path').length,3);
});
