import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {transformSync} from 'esbuild';

class TFile {
 stat={mtime:1,size:100};
 constructor(public path:string){}
 get basename(){return this.path.split('/').at(-1)!.replace(/\.[^.]+$/,'');}
 get extension(){return this.path.split('.').at(-1)!;}
}
class MobileAdapter {
 getBasePath():string {throw Error('Mobile must not ask for a desktop vault path');}
}

/** The test harness reads source; plugin require calls have no Node fallback. */
function mobileModules(){
 const nodeRequests:string[]=[],cache=new Map<string,{exports:Record<string,unknown>}>();
 const host={TFile,FileSystemAdapter:MobileAdapter,Platform:{isDesktop:false,resourcePathPrefix:'app://mobile/'}};
 const load=(path:string):unknown=>{
  const cached=cache.get(path);if(cached)return cached.exports;
  const module={exports:{} as Record<string,unknown>};cache.set(path,module);
  const code=transformSync(readFileSync(path,'utf8'),{loader:path.endsWith('.mjs')?'js':'ts',format:'cjs'}).code;
  new Function('require','module','exports',code)((name:string)=>{
   if(name==='obsidian')return host;
   if(name.startsWith('.')){
    const base=resolve(dirname(path),name),target=[base,base+'.ts',base+'.mts',base+'.mjs'].find(candidate=>existsSync(candidate));
    assert.ok(target,`Missing local dependency ${name}`);return load(target);
   }
   nodeRequests.push(name);throw Error(`Mobile cannot require ${name}`);
  },module,module.exports);
  return module.exports;
 };
 return {load:(name:string)=>load(resolve('src',name)),nodeRequests};
}

test('mobile import and vault media resolution do not request Node backends',async()=>{
 const modules=mobileModules(),external=modules.load('external-media.ts') as typeof import('../src/external-media');
 const online=modules.load('online-platform.ts') as typeof import('../src/online-platform');
 modules.load('media-workspace-service.ts');
 assert.equal(external.isExternalMediaReference('media/lecture.tsaudio'),true);
 for(const extension of ['mp3','mp4']){
  const file=new TFile('media/local.'+extension),app={vault:{getAbstractFileByPath:()=>file,getResourcePath:()=>`vault://${file.path}`}};
  assert.equal(external.resolveMediaResource(app as any,file as any),`vault://${file.path}`);
 }
 const address='https://www.youtube.com/watch?v=M7lc1UVf-VE&t=62';
 assert.equal(online.parseOnlineSource(address)?.initialTime,62);
 assert.equal((await online.resolveOnlineSource(address)).path,'https://www.youtube.com/watch?v=M7lc1UVf-VE');
 assert.deepEqual(modules.nodeRequests,[]);
});

test('mobile external references fail before reading descriptors or requiring a desktop backend',async()=>{
 const modules=mobileModules(),external=modules.load('external-media.ts') as typeof import('../src/external-media');
 const reference={version:1 as const,source:'file:///desktop/lecture.mp4',mtime:1,size:10},file=new TFile('media/lecture.tsvideo');let reads=0;
 const app={vault:{getAbstractFileByPath:()=>file,read:async()=>{reads++;return JSON.stringify(reference);}}};
 const unsupported=/需要桌面版 Obsidian/;
 assert.throws(()=>external.normalizeExternalMediaPath('/desktop/lecture.mp4'),unsupported);
 assert.throws(()=>external.parseExternalMediaReference(JSON.stringify(reference)),unsupported);
 assert.throws(()=>external.validateExternalMediaReferenceSync(reference),unsupported);
 await assert.rejects(external.createExternalMediaReference('/desktop/lecture.mp4'),unsupported);
 await assert.rejects(external.validateExternalMediaReference(reference),unsupported);
 await assert.rejects(external.readExternalMediaReference(app as any,file as any),unsupported);
 await assert.rejects(async()=>external.resolveMediaResource(app as any,file as any),unsupported);
 assert.equal(reads,0);assert.deepEqual(modules.nodeRequests,[]);
});

test('mobile online redirect resolution and embedded playback fail before Node or Electron loading',async()=>{
 const modules=mobileModules(),online=modules.load('online-platform.ts') as typeof import('../src/online-platform');
 await assert.rejects(online.resolveOnlineSource('https://b23.tv/abc123'),/需要桌面版 Obsidian/);
 const player=new online.OnlinePlatform(()=>{}),path='https://www.youtube.com/watch?v=M7lc1UVf-VE';
 player.mount({isConnected:true} as HTMLElement,path);
 assert.throws(()=>player.open(path),/需要桌面版 Obsidian/);
 await assert.rejects(player.command(path,'external'),/需要桌面版 Obsidian/);
 player.dispose();assert.deepEqual(modules.nodeRequests,[]);
});

for(const extension of ['mp3','mp4'])test(`mobile vault-local ${extension} notes save and reopen without desktop path identities`,async()=>{
 const modules=mobileModules(),{MediaWorkspaceService}=modules.load('media-workspace-service.ts') as typeof import('../src/media-workspace-service');
 const notes=modules.load('media-notes.ts') as typeof import('../src/media-notes');
 const file=new TFile('media/local.'+extension),native=new TFile('notes/native.md'),legacy=new TFile('notes/desktop.md');
 const files=new Map([[file.path,file],[native.path,native],[legacy.path,legacy]]),texts=new Map([
  [native,notes.mediaNoteDocument(file.path)],
  [legacy,'---\nsource: /desktop/'+file.path+'\nvideo-note-id: old-id\n---\nOld desktop note stays intact\n']
 ]),storage=new Map<string,string>();
 for(const [note,text] of texts)note.stat.size=text.length;
 const adapter=Object.assign(new MobileAdapter(),{exists:async(path:string)=>storage.has(path),read:async(path:string)=>storage.get(path)!,write:async(path:string,text:string)=>{storage.set(path,text);}});
 const app={workspace:{getLeavesOfType:()=>[]},vault:{adapter,getName:()=> 'mobile-vault',getAbstractFileByPath:(path:string)=>files.get(path),getMarkdownFiles:()=>[native,legacy],getResourcePath:(source:TFile)=>'vault://'+source.path,
  read:async(note:TFile)=>texts.get(note)!,process:async(note:TFile,change:(raw:string)=>string)=>{const text=change(texts.get(note)!);texts.set(note,text);note.stat.mtime++;note.stat.size=text.length;}
 },metadataCache:{getFileCache:(note:TFile)=>({frontmatter:note===native?{thoughtspace_media:file.path}:{source:'/desktop/'+file.path}})}};
 const service=new MediaWorkspaceService(app as any,'plugin/media-state.json',{createNote:async()=>{throw Error('Existing native note must be reused');},openFile:async()=>{}});
 await service.load();assert.equal(service.resolveResource(file as any),'vault://'+file.path);
 const before=texts.get(legacy),saved=await service.saveMoment(file as any,{id:'mobile-moment',time:12.5,text:'Mobile excerpt'});
 assert.equal(saved.note,native);assert.equal(texts.get(legacy),before);
 const timeline=await service.moments(file as any);
 assert.deepEqual(timeline.entries.map(row=>[row.time,row.text]),[[12.5,'Mobile excerpt']]);
 await service.dispose();assert.ok(storage.has('plugin/media-state.json'));assert.deepEqual(modules.nodeRequests,[]);
});
