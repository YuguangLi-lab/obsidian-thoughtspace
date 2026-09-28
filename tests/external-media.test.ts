import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,stat,rm,utimes,mkdir,realpath} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as source from '../src/media-source';
import * as guards from '../src/value-guards';
import {mediaCard,isVaultMediaPath,mediaKind} from '../src/media-source';
import {emptyBoard,parseBoard} from '../src/model';
import {mediaNoteDocument,mediaPlayerUrl,parseMediaPlayerUrl} from '../src/media-notes';

const nodeRequire=createRequire(import.meta.url),mod={exports:{}};
new Function('require','module','exports',transformSync(readFileSync('src/external-media.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{
 if(name==='obsidian')return{Platform:{resourcePathPrefix:'app://runtime-id/'}};
 if(name==='./media-source')return source;
 if(name==='./value-guards')return guards;
 return nodeRequire(name);
},mod,mod.exports);
const api=mod.exports as typeof import('../src/external-media');
async function fixture(t:{after:(fn:()=>Promise<void>)=>void},name='课程 #100%2F (final).mp4'){
 const folder=await mkdtemp(join(tmpdir(),'thoughtspace-external-'));t.after(()=>rm(folder,{recursive:true,force:true}));
 const path=join(await realpath(folder),name);await writeFile(path,'original media bytes');return{folder,path};
}
function vaultReference(content:string,path='References/course.tsvideo'){
 const file={path,stat:{mtime:1,size:Buffer.byteLength(content)}};let raw=content,reads=0;
 const files=new Map([[path,file]]);
 const app={vault:{getAbstractFileByPath:(path:string)=>files.get(path),read:async()=>{reads++;return raw;},getResourcePath:(value:{path:string})=>'vault://'+value.path}};
 return{file,app:app as any,files,get reads(){return reads;},setRaw:(value:string)=>raw=value};
}
test('outside local video becomes a small fixed-fingerprint reference and resolves without reading media bytes',async t=>{
 const f=await fixture(t),created=await api.createExternalMediaReference(f.path),fileStat=await stat(f.path);
 assert.equal(created.kind,'video');assert.equal(created.extension,'tsvideo');assert.equal(created.basename,'课程 #100%2F (final)');assert.equal(created.source,pathToFileURL(f.path).href);
 assert.deepEqual(api.parseExternalMediaReference(created.content,'video'),{version:1,source:created.source,mtime:fileStat.mtimeMs,size:fileStat.size});
 assert.ok(created.content.length<1000);assert.ok(!created.content.includes('original media bytes'));
 const v=vaultReference(created.content);assert.equal(await api.resolveMediaResource(v.app,v.file as any),'app://runtime-id/'+created.source.slice(8));assert.equal(v.reads,1);
});
test('raw absolute paths and encoded file URLs retain literal percent, hashes and Unicode exactly once',async t=>{
 const f=await fixture(t);assert.equal(api.normalizeExternalMediaPath(f.path),f.path);assert.equal(api.normalizeExternalMediaPath(pathToFileURL(f.path).href),f.path);
 assert.equal((await api.createExternalMediaReference(pathToFileURL(f.path).href)).source,pathToFileURL(f.path).href);
 for(const value of ['relative.mp4','../outside.mp4','https://example.org/video.mp4','javascript:alert(1)','file:///tmp/a.mp4#t=12','file:///tmp/a.mp4?x=1','file://server/share/a.mp4','file:///tmp/a%2Fb.mp4','file:///tmp/%ZZ.mp4','/tmp/a\u0000.mp4'])assert.throws(()=>api.normalizeExternalMediaPath(value),Error,value);
});
test('reference parser rejects nonlocal URLs, wrong kind, extra fields, recursion and invalid fingerprints',()=>{
 const valid={version:1,source:'file:///tmp/course.mp4',mtime:1.25,size:5};assert.deepEqual(api.parseExternalMediaReference(JSON.stringify(valid),'video'),valid);
 for(const change of [{version:2},{source:'https://example.org/a.mp4'},{source:'file:///tmp/a.tsvideo'},{source:'file:///tmp/a.html'},{source:'file:///tmp/a.mp4#fragment'},{mtime:-1},{mtime:'1'},{size:0},{size:1.5},{extra:true}])assert.throws(()=>api.parseExternalMediaReference(JSON.stringify({...valid,...change})),Error,JSON.stringify(change));
 assert.throws(()=>api.parseExternalMediaReference(JSON.stringify(valid),'audio'));
 assert.throws(()=>api.parseExternalMediaReference(' '.repeat(20000)+JSON.stringify(valid)));
});
test('missing, directory, mismatched-extension and changed media are refused while references stay intact',async t=>{
 const f=await fixture(t),created=await api.createExternalMediaReference(f.path),v=vaultReference(created.content);
 const wrong=vaultReference(created.content,'References/course.tsaudio');await assert.rejects(async()=>api.resolveMediaResource(wrong.app,wrong.file as any),/类型不匹配/);
 await writeFile(f.path,'replacement');await assert.rejects(async()=>api.resolveMediaResource(v.app,v.file as any),/变化|重新关联/);
 await rm(f.path);await assert.rejects(async()=>api.resolveMediaResource(v.app,v.file as any),/找不到|读取|不存在/);
 await mkdir(f.path);await assert.rejects(api.createExternalMediaReference(f.path),/文件/);assert.equal(v.reads,2);
 await assert.rejects(api.createExternalMediaReference(join(f.folder,'missing.mp4')));
});
test('same-size edits and an async pointer replacement cannot reuse the original media identity',async t=>{
 const f=await fixture(t),created=await api.createExternalMediaReference(f.path),v=vaultReference(created.content),original=await stat(f.path);
 await utimes(f.path,original.atime,new Date(original.mtimeMs+5000));await assert.rejects(async()=>api.resolveMediaResource(v.app,v.file as any),/变化|重新关联/);
 await utimes(f.path,original.atime,new Date(original.mtimeMs));
 v.app.vault.read=async()=>{v.files.delete(v.file.path);return created.content;};await assert.rejects(async()=>api.resolveMediaResource(v.app,v.file as any),/变化|移动|删除/);
});
test('oversized pointers never read and normal vault media stay synchronous',async()=>{
 const v=vaultReference('{}');v.file.stat.size=100000;await assert.rejects(Promise.resolve().then(()=>api.resolveMediaResource(v.app,v.file as any)),/过大|上限/);assert.equal(v.reads,0);
 const file={path:'clips/local.mp4',stat:{mtime:1,size:10}};v.files.set(file.path,file);assert.equal(api.resolveMediaResource(v.app,file as any),'vault://clips/local.mp4');assert.equal(v.reads,0);
});
test('reference files retain real vault paths through boards, notes and time-point protocols',()=>{
 for(const [path,kind] of [['References/course.tsvideo','video'],['References/lecture.tsaudio','audio']] as const){
  assert.equal(mediaKind(path),kind);assert.ok(isVaultMediaPath(path));const card=mediaCard('external',path,50,50,320,12.5),board={...emptyBoard(),version:3 as const,nodes:[card]};assert.deepEqual(parseBoard(JSON.stringify(board)),board);
  const identity={vault:'demo',file:path};assert.ok(mediaNoteDocument(path).includes(path));assert.deepEqual(parseMediaPlayerUrl(mediaPlayerUrl(identity,12.5)),{...identity,time:12.5});
 }
 assert.equal(isVaultMediaPath('/tmp/course.tsvideo'),false);assert.equal(isVaultMediaPath('file:///tmp/course.tsvideo'),false);
});
