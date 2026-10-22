import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/collection-model';
import * as workspace from '../src/workspace';
import type {CollectionRecord} from '../src/collection-view';
import type {CachedMetadata} from 'obsidian';

class TFile {
 stat={mtime:1,size:1,ctime:1};
 constructor(public path:string){}
 get name(){return this.path.split('/').at(-1)!;}
 get extension(){return this.name.split('.').at(-1)!;}
 get basename(){return this.name.replace(/\.[^.]+$/,'');}
}
const dependencies:Record<string,unknown>={
 obsidian:{TFile,parseLinktext:(link:string)=>{const index=link.indexOf('#');return index<0?{path:link,subpath:''}:{path:link.slice(0,index),subpath:link.slice(index)};}},
 './collection-model':model,'./workspace':workspace,
};
const module={exports:{}};
new Function('require','module','exports',transformSync(readFileSync('src/collection-context.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{assert.ok(name in dependencies,`mock ${name}`);return dependencies[name];},module,module.exports);
const {CollectionContext,collectionAttachmentKind}=module.exports as typeof import('../src/collection-context');
type Listener={name:string;callback:(file:TFile)=>void};
function fixture(){
 const files=new Map<string,TFile>(),cache=new Map<TFile,CachedMetadata>(),known=new Map<TFile,model.CollectionIdentity>(),resolvedLinks:Record<string,Record<string,number>>={};
 const listeners:Listener[]=[],destinations=new Map<string,TFile>(),requests:{link:string;source:string}[]=[];
 let nativeReads=0,nativeWrites=0;
 const on=(name:string,callback:(file:TFile)=>void)=>{const ref={name,callback};listeners.push(ref);return ref;};
 const offref=(ref:Listener)=>{const index=listeners.indexOf(ref);if(index>=0)listeners.splice(index,1);};
 const emit=(name:string,file:TFile)=>{for(const listener of [...listeners])if(listener.name===name)listener.callback(file);};
 const app={
  workspace:{containerEl:{ownerDocument:{defaultView:{setTimeout,clearTimeout}}}},
  vault:{configDir:'.obsidian',getAbstractFileByPath:(path:string)=>files.get(path),getMarkdownFiles:()=>[...files.values()].filter(file=>file.extension.toLowerCase()==='md'),
   on:(name:string,callback:(file:TFile)=>void)=>on('vault:'+name,callback),offref,
   read:()=>{nativeReads++;throw Error('body read forbidden');},cachedRead:()=>{nativeReads++;throw Error('body read forbidden');},
   modify:()=>{nativeWrites++;throw Error('write forbidden');},process:()=>{nativeWrites++;throw Error('write forbidden');}},
  metadataCache:{resolvedLinks,getFileCache:(file:TFile)=>cache.get(file)||null,
   getFirstLinkpathDest:(link:string,source:string)=>{requests.push({link,source});return destinations.get(`${source}\0${link}`)||files.get(link)||files.get(link+'.md')||null;},
   on:(name:string,callback:(file:TFile)=>void)=>on('metadata:'+name,callback),offref},
 };
 const library={identityForFile:(file:TFile)=>model.readCollectionIdentity(cache.get(file)?.frontmatter)||known.get(file)};
 const context=new CollectionContext(app as never,library as never);
 const add=(path:string,metadata?:CachedMetadata)=>{const file=new TFile(path);files.set(path,file);if(metadata)cache.set(file,metadata);return file;};
 const record=(n:number,path=`Records/Record-${n}.md`)=>{
  const identity={id:`capture-context-${n}`,createdAt:'2026-10-20T10:00:00.000Z'};
  const file=add(path,{frontmatter:{thoughtspace_capture:identity.id,thoughtspace_created:identity.createdAt}});
  const value:CollectionRecord={...identity,path,title:file.basename,tags:['#研究'],inBoard:false};
  return{file,record:value};
 };
 const references=(file:TFile,links:string[],kind:'links'|'embeds'|'frontmatterLinks'='links')=>{
  const metadata=cache.get(file)||{};Object.assign(metadata,{[kind]:links.map(link=>({link,original:link,position:{start:{line:0,col:0,offset:0},end:{line:0,col:1,offset:1}}}))});cache.set(file,metadata);
 };
 const target=(source:TFile,link:string,destination:TFile)=>destinations.set(`${source.path}\0${link}`,destination);
 return{context,files,cache,known,resolvedLinks,listeners,requests,app,library,add,record,references,target,emit,counts:()=>({nativeReads,nativeWrites})};
}
test('native outgoing links, embeds and frontmatter links are grouped without reading bodies',async()=>{
 const f=fixture(),{file,record}=f.record(1),note=f.add('Notes/原生笔记.md',{}),image=f.add('Attachments/图 1.png');
 f.references(file,['别名#章节','别名#章节','missing note','https://example.com','mailto:a@example.com','//example.com/file','javascript:alert(1)']);
 f.references(file,['图 1.png'],'embeds');f.references(file,['别名#章节'],'frontmatterLinks');
 f.target(file,'别名',note);f.target(file,'图 1.png',image);
 const result=await f.context.inspect(record);
 assert.equal(result.metadataReady,true);assert.deepEqual(result.total,{outgoing:2,incoming:0,attachments:1});
 const native=result.outgoing.find(item=>item.path===note.path)!;
 assert.equal(native.count,3);assert.equal(native.subpath,'#章节');assert.equal(await f.context.resolveTarget(record,native),note);
 assert.equal(result.outgoing.find(item=>item.kind==='missing')?.path,'missing note');
 await assert.rejects(()=>f.context.resolveTarget(record,result.outgoing.find(item=>item.missing)!));
 assert.equal(result.attachments[0].kind,'image');assert.equal(result.attachments[0].title,'图 1.png');
 assert.ok(f.requests.some(request=>request.link==='别名'&&request.source===file.path));
 assert.deepEqual(f.counts(),{nativeReads:0,nativeWrites:0});
 f.context.dispose();
});
test('duplicates with different subpaths remain one file-level destination',async()=>{
 const f=fixture(),{file,record}=f.record(1);f.add('Target.md',{});f.references(file,['Target#One','Target#Two','Target#One']);
 const result=await f.context.inspect(record);assert.equal(result.outgoing.length,1);assert.equal(result.outgoing[0].count,3);assert.equal(result.outgoing[0].subpath,undefined);f.context.dispose();
});
test('incoming links include ordinary notes and collection records but reject stale reverse-index claims',async()=>{
 const f=fixture(),source=f.record(1),incoming=f.record(2),ordinary=f.add('Notes/普通引用.md',{}),stale=f.add('Notes/旧引用.md',{}),pending=f.add('Notes/待索引.md');
 for(const file of [incoming.file,ordinary,pending]){f.resolvedLinks[file.path]={[source.file.path]:1};if(file!==pending)f.references(file,[source.file.path]);}
 f.resolvedLinks[stale.path]={[source.file.path]:9};f.resolvedLinks[source.file.path]={[source.file.path]:1};
 const result=await f.context.inspect(source.record);
 assert.equal(result.total.incoming,2);assert.equal(result.unknown,1);
 assert.equal(result.incoming.find(item=>item.path===incoming.file.path)?.collection?.id,incoming.record.id);
 assert.equal(result.incoming.find(item=>item.path===ordinary.path)?.collection,undefined);
 for(const item of result.incoming)assert.equal((await f.context.resolveTarget(source.record,item)).path,item.path);
 assert.deepEqual(f.counts(),{nativeReads:0,nativeWrites:0});f.context.dispose();
});
test('host-hidden configuration, generated workspace backups and board files never become attachments',async()=>{
 const f=fixture(),source=f.record(1),paths=['.obsidian/secret.json','ThoughtSpace-plugin-backups/a.png','ThoughtSpace/白板搜索/a.png','board.thoughtspace','board.canvas'];
 for(const path of paths)f.add(path);f.references(source.file,paths);
 const result=await f.context.inspect(source.record);assert.deepEqual(result.total,{outgoing:0,incoming:0,attachments:0});
 assert.equal((await f.context.attachments([source.record])).total,0);f.context.dispose();
});
test('attachment kinds cover local files without treating unresolved suffixes as known attachments',async()=>{
 assert.deepEqual(['PNG','pdf','opus','MOV','zip'].map(collectionAttachmentKind),['image','pdf','audio','video','other']);
 const f=fixture(),source=f.record(1),paths=['Files/a.png','Files/b.pdf','Files/c.mp3','Files/d.mp4','Files/e.zip'];
 for(const path of paths)f.add(path);f.add('Other.md',{});f.references(source.file,[...paths,'missing.png','Other.md','https://example.com/a.png']);
 const page=await f.context.attachments([source.record]);
 assert.deepEqual(page.items.map(item=>item.kind),['image','pdf','audio','video','other']);assert.equal(page.total,5);assert.equal(page.unresolved,1);
 assert.ok(page.items.every(item=>item.source.id===source.record.id));
 for(const item of page.items)assert.equal((await f.context.resolveTarget(item.source,item)).path,item.path);
 assert.deepEqual(f.counts(),{nativeReads:0,nativeWrites:0});f.context.dispose();
});
test('attachment browsing paginates per source relationship and supports metadata-only text and kind filtering',async()=>{
 const f=fixture(),records:CollectionRecord[]=[];
 for(let index=0;index<60;index++){const source=f.record(index);records.push(source.record);const path=`Files/${index%2?'audio.mp3':'photo.png'}`;if(!f.files.has(path))f.add(path);f.references(source.file,[path,path]);}
 const page=await f.context.attachments(records,{limit:99,offset:8});assert.equal(page.limit,48);assert.equal(page.items.length,48);assert.equal(page.total,60);assert.equal(page.items[0].source.id,records[8].id);assert.equal(page.items[0].count,2);
 const tail=await f.context.attachments(records,{limit:24,offset:55});assert.equal(tail.items.length,5);
 const pictures=await f.context.attachments(records,{kind:'image',query:'研究 photo'});assert.equal(pictures.total,30);assert.equal(pictures.items.length,24);
 const one=await f.context.attachments(records,{query:'Record-31'});assert.equal(one.total,1);assert.equal(one.items[0].source.id,records[31].id);
 assert.deepEqual(f.counts(),{nativeReads:0,nativeWrites:0});f.context.dispose();
});
test('unavailable source metadata stays unknown and is not reported as no attachments',async()=>{
 const f=fixture(),source=f.record(1);f.known.set(source.file,{id:source.record.id,createdAt:source.record.createdAt});f.cache.delete(source.file);
 const result=await f.context.inspect(source.record);assert.equal(result.metadataReady,false);assert.equal(result.unknown,1);
 const page=await f.context.attachments([source.record]);assert.equal(page.unknown,1);assert.equal(page.total,0);f.context.dispose();
});
test('remembered collection identity never overrides an indexed removal of its properties',async()=>{
 const f=fixture(),source=f.record(1);f.known.set(source.file,{id:source.record.id,createdAt:source.record.createdAt});
 f.cache.set(source.file,{});await assert.rejects(()=>f.context.inspect(source.record),/身份已变化/);
 const page=await f.context.attachments([source.record]);assert.equal(page.unknown,1);assert.equal(page.total,0);f.context.dispose();
});
test('opaque capabilities cannot be forged, copied, moved across services or retained after disposal',async()=>{
 const f=fixture(),source=f.record(1);f.add('Target.md',{});f.references(source.file,['Target.md']);
 const item=(await f.context.inspect(source.record)).outgoing[0];assert.equal(f.context.isCurrent(source.record,item),true);
 assert.equal(f.context.isCurrent(source.record,{...item}),false);
 const other=new CollectionContext(f.app as never,f.library as never);assert.equal(other.isCurrent(source.record,item),false);other.dispose();
 assert.equal(f.listeners.length,7);f.context.dispose();f.context.dispose();assert.equal(f.listeners.length,0);assert.equal(f.context.isCurrent(source.record,item),false);
 await assert.rejects(()=>f.context.resolveTarget(source.record,item));await assert.rejects(()=>f.context.inspect(source.record));await assert.rejects(()=>f.context.attachments([source.record]));
});
for(const target of ['source','destination'] as const)test(`same-path ${target} object replacement invalidates an existing navigation capability`,async()=>{
 const f=fixture(),source=f.record(1),destination=f.add('Target.md',{});f.references(source.file,['Target.md']);
 const item=(await f.context.inspect(source.record)).outgoing[0],file=target==='source'?source.file:destination;
 f.files.set(file.path,new TFile(file.path));
 assert.equal(f.context.isCurrent(source.record,item),false);await assert.rejects(()=>f.context.resolveTarget(source.record,item));f.context.dispose();
});
test('source rename requires refreshed record and produces a fresh capability',async()=>{
 const f=fixture(),source=f.record(1);f.add('Target.md',{});f.references(source.file,['Target.md']);
 const item=(await f.context.inspect(source.record)).outgoing[0],oldPath=source.file.path;
 f.files.delete(oldPath);source.file.path='Records/Renamed.md';f.files.set(source.file.path,source.file);f.emit('vault:rename',source.file);
 assert.equal(f.context.isCurrent(source.record,item),false);await assert.rejects(()=>f.context.inspect(source.record));
 const next={...source.record,path:source.file.path};const refreshed=(await f.context.inspect(next)).outgoing[0];assert.equal(f.context.isCurrent(next,refreshed),true);f.context.dispose();
});
test('destination rename rejects an old chip and refreshed native resolution follows the new path',async()=>{
 const f=fixture(),source=f.record(1),destination=f.add('Target.md',{});f.references(source.file,['Target']);
 const item=(await f.context.inspect(source.record)).outgoing[0];f.files.delete(destination.path);destination.path='Moved.md';f.files.set(destination.path,destination);f.target(source.file,'Target',destination);f.emit('vault:rename',destination);
 assert.equal(f.context.isCurrent(source.record,item),false);const refreshed=(await f.context.inspect(source.record)).outgoing[0];assert.equal(refreshed.path,'Moved.md');assert.equal(await f.context.resolveTarget(source.record,refreshed),destination);f.context.dispose();
});
test('same-stat native source edits block stale cache until the updated metadata arrives',async()=>{
 const f=fixture(),source=f.record(1);f.add('Target.md',{});f.references(source.file,['Target.md']);
 const item=(await f.context.inspect(source.record)).outgoing[0];f.emit('vault:modify',source.file);
 assert.equal(f.context.isCurrent(source.record,item),false);assert.equal((await f.context.inspect(source.record)).metadataReady,false);
 f.references(source.file,[]);f.emit('metadata:changed',source.file);
 assert.equal((await f.context.inspect(source.record)).outgoing.length,0);f.context.dispose();
});
test('removing an outgoing relationship after resolve is caught by the synchronous final guard',async()=>{
 const f=fixture(),source=f.record(1),destination=f.add('Target.md',{});f.references(source.file,['Target.md']);
 const item=(await f.context.inspect(source.record)).outgoing[0];assert.equal(await f.context.resolveTarget(source.record,item),destination);
 f.references(source.file,[]);assert.equal(f.context.isCurrent(source.record,item),false);f.context.dispose();
});
test('changing only a heading target invalidates the old subpath capability',async()=>{
 const f=fixture(),source=f.record(1);f.add('Target.md',{});f.references(source.file,['Target#Old']);
 const item=(await f.context.inspect(source.record)).outgoing[0];f.references(source.file,['Target#New']);
 assert.equal(f.context.isCurrent(source.record,item),false);const next=(await f.context.inspect(source.record)).outgoing[0];assert.equal(next.subpath,'#New');assert.equal(f.context.isCurrent(source.record,next),true);f.context.dispose();
});
test('incoming navigation revalidates both live cached source links and reverse index',async()=>{
 const f=fixture(),source=f.record(1),incoming=f.record(2);f.references(incoming.file,[source.file.path]);f.resolvedLinks[incoming.file.path]={[source.file.path]:1};
 let item=(await f.context.inspect(source.record)).incoming[0];f.references(incoming.file,[]);assert.equal(f.context.isCurrent(source.record,item),false);
 f.references(incoming.file,[source.file.path]);item=(await f.context.inspect(source.record)).incoming[0];delete f.resolvedLinks[incoming.file.path];assert.equal(f.context.isCurrent(source.record,item),false);f.context.dispose();
});
test('large reverse indexes are bounded and reported as incomplete',async()=>{
 const f=fixture(),source=f.record(1);
 for(let index=0;index<10001;index++)f.resolvedLinks[`Other/${index}.md`]={};
 const result=await f.context.inspect(source.record);assert.equal(result.truncated,true);assert.equal(result.incoming.length,0);f.context.dispose();
});
test('duplicate or mutated collection identity prevents returning a verified context',async()=>{
 const f=fixture(),source=f.record(1);f.add('Target.md',{});f.references(source.file,['Target.md']);const item=(await f.context.inspect(source.record)).outgoing[0];
 const copy=f.record(1,'Records/Copy.md');assert.equal(f.context.isCurrent(source.record,item),false);await assert.rejects(()=>f.context.inspect(source.record),/重复/);
 f.files.delete(copy.file.path);f.cache.get(source.file)!.frontmatter!.thoughtspace_created='2026-10-20T11:00:00.000Z';assert.equal(f.context.isCurrent(source.record,item),false);f.context.dispose();
});
test('a changed target collection identity invalidates its cached collection navigation label',async()=>{
 const f=fixture(),source=f.record(1),target=f.record(2);f.references(source.file,[target.file.path]);const item=(await f.context.inspect(source.record)).outgoing[0];
 f.cache.get(target.file)!.frontmatter!.thoughtspace_capture='capture-context-new';assert.equal(f.context.isCurrent(source.record,item),false);f.context.dispose();
});
test('an attachment removed from a record does not authorize a stale gallery open',async()=>{
 const f=fixture(),source=f.record(1);f.add('Files/a.pdf');f.references(source.file,['Files/a.pdf']);const page=await f.context.attachments([source.record]);
 assert.equal(f.context.isCurrent(page.items[0].source,page.items[0]),true);f.references(source.file,[]);assert.equal(f.context.isCurrent(page.items[0].source,page.items[0]),false);f.context.dispose();
});
test('navigation cancellation aborts inspection, browsing and target resolution',async()=>{
 const f=fixture(),source=f.record(1);f.add('Target.md',{});f.references(source.file,['Target.md']);const item=(await f.context.inspect(source.record)).outgoing[0];
 await assert.rejects(()=>f.context.inspect(source.record,()=>false));await assert.rejects(()=>f.context.attachments([source.record],{},()=>false));await assert.rejects(()=>f.context.resolveTarget(source.record,item,()=>false));f.context.dispose();
});
test('a native update during an asynchronous gallery page never returns mixed snapshot totals',async()=>{
 const f=fixture(),records:CollectionRecord[]=[];
 for(let index=0;index<40;index++){const source=f.record(index);records.push(source.record);f.add(`Files/${index}.png`);f.references(source.file,[`Files/${index}.png`]);}
 setTimeout(()=>f.emit('vault:modify',f.files.get(records[0].path)!),0);
 await assert.rejects(()=>f.context.attachments(records),/索引有更新/);f.context.dispose();
});
test('closing the context while a gallery yields cancels its whole result and releases listeners',async()=>{
 const f=fixture(),records:CollectionRecord[]=[];
 for(let index=0;index<40;index++){const source=f.record(index);records.push(source.record);f.add(`Files/${index}.pdf`);f.references(source.file,[`Files/${index}.pdf`]);}
 setTimeout(()=>f.context.dispose(),0);await assert.rejects(()=>f.context.attachments(records),/页面已变化/);assert.equal(f.listeners.length,0);
});
test('per-section rendered context is bounded and accurately marks truncation',async()=>{
 const f=fixture(),source=f.record(1),paths=Array.from({length:120},(_,index)=>`Files/${index}.png`);
 for(const path of paths)f.add(path);f.references(source.file,paths);const context=await f.context.inspect(source.record);
 assert.equal(context.total.attachments,120);assert.equal(context.attachments.length,100);assert.equal(context.truncated,true);f.context.dispose();
});
test('oversized cached reference arrays are bounded and their totals are explicitly incomplete',async()=>{
 const f=fixture(),source=f.record(1);f.add('Files/a.pdf');f.references(source.file,Array.from({length:6000},()=> 'Files/a.pdf'));
 const result=await f.context.inspect(source.record);assert.equal(result.truncated,true);assert.equal(result.attachments[0].count,5000);
 const page=await f.context.attachments([source.record]);assert.equal(page.truncated,true);assert.equal(page.items[0].count,5000);f.context.dispose();
});
for(const options of [{limit:0},{limit:1.2},{offset:-1},{offset:Infinity},{kind:'web'},{query:5}] as const)test(`invalid attachment query is refused: ${JSON.stringify(options)}`,async()=>{
 const f=fixture();await assert.rejects(()=>f.context.attachments([],options as never),/参数无效/);f.context.dispose();
});
