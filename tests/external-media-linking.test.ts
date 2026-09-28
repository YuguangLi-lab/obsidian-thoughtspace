import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {transformSync} from 'esbuild';
import {safeName} from '../src/model';

const main=readFileSync('src/main.ts','utf8'),start=main.indexOf('  async linkExternalMedia('),end=main.indexOf('\n  pickExternalMedia(',start);
assert.ok(start>=0&&end>start);const method=main.slice(start,end);
class TFile {
 stat:{mtime:number;size:number};
 constructor(public path:string,content:string){this.stat={mtime:1,size:Buffer.byteLength(content)};}
}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return{promise,resolve};}
function fixture(){
 const content=JSON.stringify({version:1,source:'file:///outside/course.mp4',mtime:123,size:1024*1024*1024}),reference={kind:'video' as const,extension:'tsvideo' as const,basename:'Course',source:'file:///outside/course.mp4',content};
 const files=new Map<string,TFile>(),texts=new Map<TFile,string>(),creates:{file:TFile;body:string}[]=[],inputs:string[]=[];
 const controls={beforeSource:undefined as (()=>Promise<void>)|undefined,beforeRead:undefined as ((file:TFile)=>Promise<void>)|undefined,beforeValidate:undefined as ((file:TFile)=>Promise<void>)|undefined};
 let reads=0,validations=0,binaryOperations=0;
 const deps={TFile,createHash,safeName,normalizePath:posix.normalize,createExternalMediaReference:async(input:string)=>{inputs.push(input);await controls.beforeSource?.();return reference;}};
 const Plugin=new Function(...Object.keys(deps),transformSync(`class Plugin{${method}};return Plugin`,{loader:'ts'}).code)(...Object.values(deps));
 const plugin=new Plugin(),forbidBinary=()=>{binaryOperations++;throw Error('External media must remain outside the vault');};
 Object.assign(plugin,{mediaClosed:false,settings:{cardFolder:'ThoughtSpace/Cards'},app:{vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async(file:TFile)=>{reads++;await controls.beforeRead?.(file);return texts.get(file)!;},readBinary:forbidBinary,createBinary:forbidBinary}},mediaWorkspace:{validateResource:async(file:TFile)=>{validations++;await controls.beforeValidate?.(file);}},createUnique:async(folder:string,title:string,extension:string,body:string)=>{
  const path=posix.join(folder,safeName(title)+'.'+extension);assert.ok(!files.has(path),'Duplicate linking should reuse its reference');
  const file=new TFile(path,body);files.set(path,file);texts.set(file,body);creates.push({file,body});return file;
 }});
 const link=()=>plugin.linkExternalMedia('/outside/course.mp4','video') as Promise<TFile>;
 return{plugin,reference,files,texts,creates,inputs,controls,link,get reads(){return reads;},get validations(){return validations;},get binaryOperations(){return binaryOperations;}};
}

test('repeated linking reuses the exact vault TFile and writes only the small descriptor',async()=>{
 const f=fixture(),first=await f.link(),second=await f.link();
 assert.ok(first instanceof TFile);assert.equal(first,second);assert.equal(f.files.get(first.path),first);assert.equal(f.creates.length,1);assert.equal(f.binaryOperations,0);
 assert.equal(f.creates[0].body,f.reference.content);assert.ok(Buffer.byteLength(f.creates[0].body)<1000);assert.equal(JSON.parse(f.creates[0].body).size,1024*1024*1024);
 assert.equal(f.validations,2);assert.deepEqual(f.inputs,['/outside/course.mp4','/outside/course.mp4']);
});

test('retargeting a new reference before its verification read cannot return another video',async()=>{
 const f=fixture();f.controls.beforeRead=async file=>{f.texts.set(file,f.reference.content.replace('course.mp4','second.mp4'));};
 let opened=0;await assert.rejects(f.link().then(()=>{opened++;}),/来源已变化/);
 assert.equal(opened,0);assert.equal(f.validations,0);assert.equal(f.creates.length,1);assert.equal(f.binaryOperations,0);
});

for(const mutation of ['retarget','rename','delete'] as const)test(`${mutation} while validating a reused reference rejects its stale result`,async()=>{
 const f=fixture(),file=await f.link(),entered=deferred(),resume=deferred();
 f.controls.beforeValidate=async()=>{entered.resolve();await resume.promise;};let opened=0;
 const pending=f.link().then(()=>{opened++;});await entered.promise;
 if(mutation==='retarget'){f.texts.set(file,f.reference.content.replace('course.mp4','second.mp4'));file.stat.mtime++;}
 if(mutation==='rename'){f.files.delete(file.path);file.path='ThoughtSpace/Cards/renamed.tsvideo';f.files.set(file.path,file);}
 if(mutation==='delete')f.files.delete(file.path);
 resume.resolve();await assert.rejects(pending,/媒体引用已变化/);
 assert.equal(opened,0);assert.equal(f.creates.length,1);assert.equal(f.binaryOperations,0);
});

test('closing the plugin while the external path resolves prevents reference creation and opening',async()=>{
 const f=fixture(),entered=deferred(),resume=deferred();f.controls.beforeSource=async()=>{entered.resolve();await resume.promise;};let opened=0;
 const pending=f.link().then(()=>{opened++;});await entered.promise;f.plugin.mediaClosed=true;resume.resolve();await assert.rejects(pending,/插件已关闭/);
 assert.equal(opened,0);assert.equal(f.creates.length,0);assert.equal(f.reads,0);assert.equal(f.validations,0);
});

test('closing the plugin during resource verification never invokes the opening continuation',async()=>{
 const f=fixture(),entered=deferred(),resume=deferred();f.controls.beforeValidate=async()=>{entered.resolve();await resume.promise;};let opened=0;
 const pending=f.link().then(()=>{opened++;});await entered.promise;f.plugin.mediaClosed=true;resume.resolve();await assert.rejects(pending,/媒体引用已变化/);
 assert.equal(opened,0);assert.equal(f.creates.length,1);assert.equal(f.binaryOperations,0);
});
