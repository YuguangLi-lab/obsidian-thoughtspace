import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CollectionRecovery,type CollectionAttempt,type CollectionDraft,type CollectionProbe,type CollectionRecoveryHost,type CollectionTarget} from '../src/collection-recovery';

const when='2026-10-13T08:00:00.000Z';
const target:CollectionTarget={key:'board-identity-1',title:'研究',groups:[{id:'group',title:'分组'}],groupId:'group'};
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
async function until(check:()=>boolean){for(let i=0;i<300&&!check();i++)await Promise.resolve();assert.ok(check(),'asynchronous checkpoint reached');}
interface File {path:string;id:string;markdown:string;}
interface Journal {version:number;draft:CollectionDraft;attempt?:CollectionAttempt;}
async function fixture(initial:string|null=null){
 let disk=initial,serial=0,creates=0,probes=0,deliveries=0,placements=0,writes=0,current=true;
 const files=new Map<string,File>();
 const control:{readError?:Error;writeFailure?:(value:Journal)=>boolean;writeAfterFailure?:(value:Journal)=>boolean;createGate?:ReturnType<typeof deferred>;deliveryGate?:ReturnType<typeof deferred>;clearGate?:ReturnType<typeof deferred>;createFailure?:'before'|'after';probeResult?:CollectionProbe;deliveryFailure?:'before'|'after';receipt?:{id:string;target:string;saved:boolean};createReentry?:()=>void;prepareReentry?:()=>void}={};
 const host:CollectionRecoveryHost={
  readJournal:async()=>{if(control.readError)throw control.readError;return disk;},
  writeJournal:async serialized=>{writes++;const value=JSON.parse(serialized) as Journal;if(control.writeFailure?.(value))throw Error('disk full');if(!value.attempt&&!value.draft.body)await control.clearGate?.promise;disk=serialized;if(control.writeAfterFailure?.(value))throw Error('write succeeded but response lost');},
  newId:()=>`capture-${++serial}`,now:()=>when,
  prepare:async(draft,identity)=>{control.prepareReentry?.();if(!draft.body.trim()&&!draft.attachments.length)throw Error('请输入正文');return{path:`Notes/${identity.id}.md`,markdown:`capture: ${identity.id}\ncreated: ${identity.createdAt}\n\n${draft.body}\n${draft.attachments.map(item=>`![[${item.path}]]`).join('\n')}`};},
  create:async(saved,live)=>{creates++;assert.ok(live());control.createReentry?.();await control.createGate?.promise;if(control.createFailure==='before')throw Error('create rejected');if(files.has(saved.path))throw Error('path exists');const file={path:saved.path,id:saved.id,markdown:saved.markdown};files.set(file.path,file);if(control.createFailure==='after')throw Error('create response lost');return{path:file.path};},
  probe:async saved=>{probes++;if(control.probeResult)return control.probeResult;const matches=[...files.values()].filter(file=>file.id===saved.id);if(matches.length===1)return{kind:'found',path:matches[0].path};if(matches.length>1||files.has(saved.path))return{kind:'unknown',message:'identity is ambiguous'};return{kind:'absent'};},
  deliver:async(saved,destination,live)=>{deliveries++;assert.ok(live());if(control.deliveryFailure==='before')throw Error('group unavailable');if(control.receipt&&control.receipt.id!==saved.id)throw Error('receipt identity changed');if(!control.receipt){placements++;control.receipt={id:saved.id,target:destination.key,saved:false};}await control.deliveryGate?.promise;if(control.deliveryFailure==='after')throw Error('board save failed');control.receipt.saved=true;},
  deliveryLocked:()=>!!control.receipt&&!control.receipt.saved
 };
 const controller=new CollectionRecovery(host);await controller.ready;
 return{controller,host,control,files,live:()=>current,stop:()=>{current=false;},resume:()=>{current=true;},journal:()=>disk?JSON.parse(disk) as Journal:null,disk:()=>disk,setDisk:(value:string|null)=>{disk=value;},counts:()=>({creates,probes,deliveries,placements,writes}),reopen:async()=>{const next=new CollectionRecovery(host);await next.ready;return next;}};
}
const body='第一条记录\n\n原生 Markdown **保留**\r\n';

test('saving a note persists fixed identity/source before create and clears only on confirmed success',async()=>{
 const f=await fixture();f.controller.updateDraft({body,tags:'阅读',attachments:[]});let seen:Journal|null=null;
 f.control.createReentry=()=>{seen=f.journal();};const result=await f.controller.submit(f.live);
 assert.equal(result.id,'capture-1');assert.equal(result.createdAt,when);assert.equal(seen!.attempt!.phase,'creating');assert.equal(seen!.attempt!.markdown,f.files.get(result.path)!.markdown);assert.equal(f.controller.snapshot.draft.body,'');assert.equal(f.journal()!.attempt,undefined);assert.equal(f.counts().creates,1);assert.equal(f.counts().deliveries,0);
});
test('repeated and reentrant submit calls share the same promise',async()=>{
 const f=await fixture();f.controller.updateDraft({body});let fromPrepare:Promise<unknown>|undefined,fromCreate:Promise<unknown>|undefined;
 f.control.prepareReentry=()=>{fromPrepare=f.controller.submit(f.live);};f.control.createReentry=()=>{fromCreate=f.controller.submit(f.live);};
 const first=f.controller.submit(f.live);assert.equal(first,f.controller.submit(f.live));await first;assert.equal(first,fromPrepare);assert.equal(first,fromCreate);assert.equal(f.counts().creates,1);
});
test('continuous records get new identities even when their text is identical',async()=>{
 const f=await fixture();f.controller.updateDraft({body});const first=await f.controller.submit();f.controller.updateDraft({body});const next=await f.controller.submit();assert.notEqual(first.id,next.id);assert.equal(f.files.size,2);assert.equal(f.counts().creates,2);
});
test('creating successfully then throwing reuses the proved note instead of creating again',async()=>{
 const f=await fixture();f.controller.updateDraft({body});f.control.createFailure='after';const result=await f.controller.submit();assert.equal(result.id,'capture-1');assert.equal(f.files.size,1);assert.equal(f.counts().creates,1);assert.equal(f.counts().probes,1);assert.equal(f.controller.snapshot.draft.body,'');
});
test('known create rejection keeps editable input; retry preserves intended identity',async()=>{
 const f=await fixture();f.controller.updateDraft({body});f.control.createFailure='before';await assert.rejects(f.controller.submit(),/create rejected/);const saved=f.controller.snapshot.attempt!;assert.equal(saved.phase,'prepared');assert.equal(f.controller.snapshot.locked,false);f.control.createFailure=undefined;const result=await f.controller.submit();assert.equal(result.id,saved.id);assert.equal(f.files.size,1);assert.equal(f.counts().creates,2);
});
test('editing a proved absent attempt starts a new identity without modifying notes',async()=>{
 const f=await fixture();f.controller.updateDraft({body});f.control.createFailure='before';await assert.rejects(f.controller.submit());f.controller.updateDraft({body:'修订'});assert.equal(f.controller.snapshot.attempt,undefined);f.control.createFailure=undefined;const result=await f.controller.submit();assert.equal(result.id,'capture-2');assert.equal(f.files.size,1);
});
test('unknown create outcome blocks content and retargeting and probes every retry',async()=>{
 const f=await fixture();f.controller.updateDraft({body});f.control.createFailure='after';f.control.probeResult={kind:'unknown',message:'read is unavailable'};
 await assert.rejects(f.controller.submit(),/待核对/);assert.equal(f.controller.snapshot.locked,true);assert.equal(f.controller.snapshot.targetLocked,true);assert.throws(()=>f.controller.updateDraft({body:'overwrite'}));assert.throws(()=>f.controller.updateDraft({target}));await assert.rejects(f.controller.submit(),/待核对/);assert.equal(f.counts().creates,1);
 f.control.probeResult=undefined;await f.controller.submit();assert.equal(f.counts().creates,1);assert.equal(f.files.size,1);
});
test('probe throwing after an uncertain create is retained as unknown, never absence',async()=>{
 const f=await fixture();f.controller.updateDraft({body});f.control.createFailure='after';const probe=f.host.probe;f.host.probe=async()=>{throw Error('read failed');};await assert.rejects(f.controller.submit(),/无法确认原笔记/);await assert.rejects(f.controller.submit());assert.equal(f.counts().creates,1);f.host.probe=probe;await f.controller.submit();assert.equal(f.counts().creates,1);
});
test('navigation during create retains late file and never delivers or clears input',async()=>{
 const f=await fixture();f.controller.updateDraft({body,target});f.control.createGate=deferred();const work=f.controller.submit(f.live);await until(()=>f.counts().creates===1);f.stop();f.control.createGate.resolve();await assert.rejects(work,/当前位置已变化/);assert.equal(f.counts().deliveries,0);assert.equal(f.journal()!.attempt!.phase,'created');assert.equal(f.controller.snapshot.draft.body,body);f.resume();await f.controller.submit(f.live);assert.equal(f.counts().creates,1);assert.equal(f.counts().placements,1);
});
test('dispose during create flushes the late file to journal for another controller',async()=>{
 const f=await fixture();f.controller.updateDraft({body});f.control.createGate=deferred();const work=f.controller.submit();await until(()=>f.counts().creates===1);f.controller.dispose();f.control.createGate.resolve();await assert.rejects(work,/收集页已关闭/);const next=await f.reopen();assert.equal(next.snapshot.attempt!.phase,'created');await next.submit();assert.equal(f.counts().creates,1);
});
test('navigation before create after preparation produces no note',async()=>{
 const f=await fixture();f.controller.updateDraft({body});const prepare=f.host.prepare;f.host.prepare=async(draft,identity)=>{const result=await prepare(draft,identity);f.stop();return result;};await assert.rejects(f.controller.submit(f.live),/当前位置已变化/);assert.equal(f.counts().creates,0);assert.equal(f.controller.snapshot.draft.body,body);
});
test('late confirmed delivery is retained as completed and does not repeat on next invocation',async()=>{
 const f=await fixture();f.controller.updateDraft({body,target});f.control.deliveryGate=deferred();const work=f.controller.submit(f.live);await until(()=>f.counts().placements===1);f.stop();f.control.deliveryGate.resolve();await assert.rejects(work,/当前位置已变化/);assert.equal(f.controller.snapshot.attempt!.phase,'completed');assert.equal(f.controller.snapshot.draft.body,body);f.resume();await f.controller.submit(f.live);assert.equal(f.counts().deliveries,1);assert.equal(f.counts().creates,1);
});
test('navigation during final journal clear restores the completed journal and input',async()=>{
 const f=await fixture();f.controller.updateDraft({body});f.control.clearGate=deferred();const work=f.controller.submit(f.live);await until(()=>f.controller.snapshot.attempt?.phase==='completed'&&f.counts().writes>=5);f.stop();f.control.clearGate.resolve();await assert.rejects(work,/当前位置已变化/);assert.equal(f.journal()!.attempt!.phase,'completed');assert.equal(f.journal()!.draft.body,body);f.resume();await f.controller.submit(f.live);assert.equal(f.counts().creates,1);
});
test('failed board save preserves its runtime receipt and locks target until confirmed',async()=>{
 const f=await fixture();f.controller.updateDraft({body,target});f.control.deliveryFailure='after';await assert.rejects(f.controller.submit(),/board save failed/);assert.equal(f.controller.snapshot.targetLocked,true);assert.throws(()=>f.controller.updateDraft({target:undefined}),/等待核对/);assert.throws(()=>f.controller.updateDraft({body:'replacement'}));f.control.deliveryFailure=undefined;await f.controller.submit();assert.equal(f.counts().creates,1);assert.equal(f.counts().placements,1);assert.equal(f.counts().deliveries,2);
});
test('failure before placement allows canceling delivery while preserving the created note',async()=>{
 const f=await fixture();f.controller.updateDraft({body,target});f.control.deliveryFailure='before';await assert.rejects(f.controller.submit(),/group unavailable/);assert.equal(f.controller.snapshot.targetLocked,false);const saved=f.controller.snapshot.attempt!;f.controller.updateDraft({target:undefined});const result=await f.controller.submit();assert.equal(result.id,saved.id);assert.equal(f.counts().creates,1);assert.equal(f.counts().placements,0);
});
test('unavailable delivery implementation can be canceled after note storage',async()=>{
 const f=await fixture();f.host.deliver=undefined;f.controller.updateDraft({body,target});await assert.rejects(f.controller.submit(),/无法向白板投递/);f.controller.updateDraft({target:undefined});await f.controller.submit();assert.equal(f.counts().creates,1);
});
test('draft journal survives controller restart including tags and attachments',async()=>{
 const f=await fixture();f.controller.updateDraft({body,tags:'#阅读 #研究/输入',attachments:[{path:'Images/一张图.png',label:'图'}]});await f.controller.flushDraft();f.controller.dispose();const next=await f.reopen();assert.equal(next.snapshot.draft.body,body);assert.equal(next.snapshot.draft.tags,'#阅读 #研究/输入');assert.deepEqual(next.snapshot.draft.attachments,[{path:'Images/一张图.png',label:'图'}]);assert.equal(next.snapshot.canSubmit,true);next.dispose();
});
test('restored target requires explicit reselection or cancellation before creating a note',async()=>{
 const f=await fixture();f.controller.updateDraft({body,target});await f.controller.flushDraft();f.controller.dispose();const next=await f.reopen();assert.equal(next.snapshot.needsTargetSelection,true);assert.equal(next.snapshot.canSubmit,false);await assert.rejects(next.submit(),/重新选择/);assert.equal(f.counts().creates,0);next.updateDraft({target:undefined});await next.submit();assert.equal(f.counts().creates,1);assert.equal(f.counts().deliveries,0);
});
test('restored in-flight creation locates renamed note and preserves later native edits',async()=>{
 const f=await fixture();f.controller.updateDraft({body});f.control.createFailure='after';f.control.probeResult={kind:'unknown',message:'temporary read failure'};await assert.rejects(f.controller.submit());f.controller.dispose();const file=[...f.files.values()][0];f.files.delete(file.path);file.path='Notes/移动后的记录.md';file.markdown='---\nunknown_native_property: keep\n---\nNative edit';f.files.set(file.path,file);f.control.probeResult=undefined;
 const next=await f.reopen();const result=await next.submit();assert.equal(result.path,file.path);assert.equal(file.markdown,'---\nunknown_native_property: keep\n---\nNative edit');assert.equal(f.counts().creates,1);
});
test('restored creating state with proven absence reuses the same prepared path and ID',async()=>{
 const saved:CollectionAttempt={id:'existing-capture',createdAt:when,path:'Notes/existing-capture.md',markdown:'exact old source',phase:'creating'};
 const f=await fixture(JSON.stringify({version:1,draft:{body,tags:'',attachments:[]},attempt:saved}));const result=await f.controller.submit();assert.equal(result.id,saved.id);assert.equal(result.path,saved.path);assert.equal(f.files.get(saved.path)!.markdown,saved.markdown);assert.equal(f.counts().probes,1);assert.equal(f.counts().creates,1);
});
test('restored creating state does not create when the same path has a different identity',async()=>{
 const saved:CollectionAttempt={id:'old',createdAt:when,path:'Notes/existing.md',markdown:'original source',phase:'creating'};
 const f=await fixture(JSON.stringify({version:1,draft:{body,tags:'',attachments:[]},attempt:saved}));f.files.set(saved.path,{path:saved.path,id:'unrelated',markdown:'never overwrite'});await assert.rejects(f.controller.submit(),/ambiguous/);assert.equal(f.counts().creates,0);assert.equal(f.files.get(saved.path)!.markdown,'never overwrite');
});
test('confirmed created note deleted before retry is not silently recreated',async()=>{
 const f=await fixture();f.controller.updateDraft({body,target});f.control.deliveryFailure='before';await assert.rejects(f.controller.submit());f.files.clear();f.controller.updateDraft({target:undefined});await assert.rejects(f.controller.submit(),/不会重新创建/);assert.equal(f.counts().creates,1);assert.equal(f.controller.snapshot.locked,true);
});
for(const phase of ['prepared','creating','created','completed'] as const)test(`journal write failure at ${phase} retains recoverable input and never duplicates a note`,async()=>{
 const f=await fixture();f.controller.updateDraft({body});f.control.writeFailure=value=>value.attempt?.phase===phase;await assert.rejects(f.controller.submit(),/disk full/);assert.equal(f.controller.snapshot.draft.body,body);const before=f.counts().creates;assert.equal(before,phase==='prepared'||phase==='creating'?0:1);assert.match(f.controller.snapshot.error!,/恢复信息/);f.control.writeFailure=undefined;await f.controller.submit();assert.equal(f.counts().creates,1);assert.equal(f.files.size,1);
});
test('draft write failure is visible and prevents note creation until retry persists it',async()=>{
 const f=await fixture();f.control.writeFailure=()=>true;f.controller.updateDraft({body});await assert.rejects(f.controller.flushDraft(),/disk full/);assert.match(f.controller.snapshot.error!,/恢复信息/);await assert.rejects(f.controller.submit());assert.equal(f.counts().creates,0);f.control.writeFailure=undefined;await f.controller.submit();assert.equal(f.counts().creates,1);
});
test('failure clearing a completed journal cannot clear input or create another note',async()=>{
 const f=await fixture();f.controller.updateDraft({body});f.control.writeFailure=value=>!value.attempt&&!value.draft.body;await assert.rejects(f.controller.submit(),/disk full/);assert.equal(f.controller.snapshot.attempt!.phase,'completed');assert.equal(f.controller.snapshot.draft.body,body);f.control.writeFailure=undefined;await f.controller.submit();assert.equal(f.counts().creates,1);
});
test('a successful empty journal write with lost response remains safe on retry',async()=>{
 const f=await fixture();f.controller.updateDraft({body});f.control.writeAfterFailure=value=>!value.attempt&&!value.draft.body;await assert.rejects(f.controller.submit(),/response lost/);assert.equal(f.controller.snapshot.attempt!.phase,'completed');assert.equal(f.journal()!.draft.body,'');f.control.writeAfterFailure=undefined;await f.controller.submit();assert.equal(f.counts().creates,1);
});
test('corrupt or unsupported journals are not overwritten',async()=>{
 for(const raw of ['{broken','{"version":2,"draft":{}}',JSON.stringify({version:1,draft:{body:'kept',tags:'',attachments:[]},attempt:{id:'old',createdAt:when,path:'../escape.md',markdown:'x',phase:'creating'}})]){
  const f=await fixture(raw);assert.equal(f.controller.snapshot.locked,true);assert.equal(f.controller.snapshot.canSubmit,false);assert.match(f.controller.snapshot.error!,/原文件未改动/);assert.throws(()=>f.controller.updateDraft({body:'replace'}));await assert.rejects(f.controller.submit());assert.equal(f.disk(),raw);assert.equal(f.counts().writes,0);f.controller.dispose();
 }
});
test('read failures expose a recoverable blockage without creating a replacement journal',async()=>{
 const f=await fixture();f.control.readError=Error('read unavailable');const next=await f.reopen();assert.match(next.snapshot.error!,/read unavailable/);await assert.rejects(next.submit());assert.equal(f.counts().writes,0);next.dispose();
});
test('snapshots and target input cannot mutate persisted or in-flight state externally',async()=>{
 const f=await fixture();const selected=structuredClone(target);f.controller.updateDraft({body,target:selected});selected.groups[0].title='external mutation';const snapshot=f.controller.snapshot;snapshot.draft.body='overwritten';snapshot.draft.target!.groups[0].title='other mutation';assert.equal(f.controller.snapshot.draft.body,body);assert.equal(f.controller.snapshot.draft.target!.groups[0].title,'分组');await f.controller.submit();
});
test('subscriber failures do not affect a successful save or other observers',async()=>{
 const f=await fixture();let events=0;const stop=f.controller.subscribe(()=>{events++;});f.controller.updateDraft({body});const stopBad=f.controller.subscribe(snapshot=>{if(snapshot.busy)throw Error('broken view');});await f.controller.submit();assert.ok(events>3);assert.equal(f.files.size,1);stopBad();stop();
});
test('two independent composer journals preserve separate drafts and create different records',async()=>{
 const shared=await fixture();let rightDisk:string|null=null;const right=new CollectionRecovery({...shared.host,readJournal:async()=>rightDisk,writeJournal:async value=>{rightDisk=value;}});await right.ready;
 shared.controller.updateDraft({body:'left'});right.updateDraft({body:'right'});await Promise.all([shared.controller.flushDraft(),right.flushDraft()]);assert.equal(shared.journal()!.draft.body,'left');assert.equal((JSON.parse(rightDisk!) as Journal).draft.body,'right');
 const [a,b]=await Promise.all([shared.controller.submit(),right.submit()]);assert.notEqual(a.id,b.id);assert.equal(shared.files.size,2);assert.equal(shared.files.get(a.path)!.markdown.includes('left'),true);assert.equal(shared.files.get(b.path)!.markdown.includes('right'),true);
});
test('rapid draft changes coalesce into a single flush and disposal retains the last input',async()=>{
 const f=await fixture();for(let i=1;i<=30;i++)f.controller.updateDraft({body:`草稿 ${i}`});await f.controller.flushDraft();assert.equal(f.counts().writes,1);assert.equal(f.journal()!.draft.body,'草稿 30');f.controller.updateDraft({body:'最终输入'});f.controller.dispose();await until(()=>f.journal()?.draft.body==='最终输入');assert.equal(f.journal()!.draft.body,'最终输入');
});

test('typing across event turns keeps only the latest ordinary draft behind an in-flight write',async()=>{
 const f=await fixture(),gate=deferred(),entered:Journal[]=[],write=f.host.writeJournal;
 f.host.writeJournal=async value=>{entered.push(JSON.parse(value) as Journal);if(entered.length===1)await gate.promise;await write(value);};
 f.controller.updateDraft({body:'already started'});await until(()=>entered.length===1);
 for(let i=1;i<=40;i++){f.controller.updateDraft({body:`pending ${i}`,tags:`tag-${i}`});await Promise.resolve();}
 const flushed=f.controller.flushDraft();assert.equal(entered.length,1);gate.resolve();await flushed;
 assert.deepEqual(entered.map(value=>value.draft.body),['already started','pending 40']);
 assert.equal(f.journal()!.draft.tags,'tag-40');assert.equal(f.counts().creates,0);
});

test('flush follows newer queued typing and waits for its actual adapter completion',async()=>{
 const f=await fixture(),first=deferred(),second=deferred(),entered:Journal[]=[],write=f.host.writeJournal;
 f.host.writeJournal=async value=>{entered.push(JSON.parse(value) as Journal);await(entered.length===1?first:second).promise;await write(value);};
 f.controller.updateDraft({body:'first'});await until(()=>entered.length===1);
 let complete=false;const flushing=f.controller.flushDraft().then(()=>{complete=true;});
 await Promise.resolve();f.controller.updateDraft({body:'typed during flush'});await Promise.resolve();first.resolve();
 await until(()=>entered.length===2);await Promise.resolve();assert.equal(complete,false);
 second.resolve();await flushing;assert.equal(f.journal()!.draft.body,'typed during flush');
});

test('closing retains the last queued draft without replaying obsolete pending snapshots',async()=>{
 const f=await fixture(),gate=deferred(),entered:Journal[]=[],write=f.host.writeJournal;
 f.host.writeJournal=async value=>{entered.push(JSON.parse(value) as Journal);if(entered.length===1)await gate.promise;await write(value);};
 f.controller.updateDraft({body:'first'});await until(()=>entered.length===1);
 f.controller.updateDraft({body:'intermediate'});await Promise.resolve();f.controller.updateDraft({body:'closed with this'});f.controller.dispose();
 gate.resolve();await until(()=>f.journal()?.draft.body==='closed with this');
 assert.deepEqual(entered.map(value=>value.draft.body),['first','closed with this']);
});

test('submission preserves every delivery checkpoint after merging queued ordinary drafts',async()=>{
 const f=await fixture(),gate=deferred(),entered:Journal[]=[],write=f.host.writeJournal;
 f.host.writeJournal=async value=>{entered.push(JSON.parse(value) as Journal);if(entered.length===1)await gate.promise;await write(value);};
 f.controller.updateDraft({body:'first',target});await until(()=>entered.length===1);
 for(const body of ['second','third','final']){f.controller.updateDraft({body});await Promise.resolve();}
 const saving=f.controller.submit();gate.resolve();await saving;
 assert.deepEqual(entered.filter(value=>value.attempt).map(value=>value.attempt!.phase),['prepared','creating','created','delivering','completed']);
 assert.deepEqual(entered.filter(value=>!value.attempt).map(value=>value.draft.body),['first','final','']);
 assert.equal(f.counts().creates,1);assert.equal(f.counts().placements,1);
});

test('a failed latest coalesced draft remains visible and a retry saves its full value',async()=>{
 const f=await fixture(),gate=deferred(),entered:Journal[]=[],write=f.host.writeJournal;
 f.host.writeJournal=async value=>{entered.push(JSON.parse(value) as Journal);if(entered.length===1)await gate.promise;await write(value);};
 f.controller.updateDraft({body:'confirmed first'});await until(()=>entered.length===1);
 f.controller.updateDraft({body:'obsolete'});await Promise.resolve();f.controller.updateDraft({body:'latest unsaved',tags:'keep'});
 f.control.writeFailure=value=>value.draft.body==='latest unsaved';const flushing=f.controller.flushDraft();gate.resolve();await assert.rejects(flushing,/disk full/);
 assert.equal(f.journal()!.draft.body,'confirmed first');assert.equal(f.controller.snapshot.draft.body,'latest unsaved');assert.match(f.controller.snapshot.error!,/恢复信息/);
 f.control.writeFailure=undefined;await f.controller.flushDraft();assert.equal(f.journal()!.draft.body,'latest unsaved');assert.equal(f.journal()!.draft.tags,'keep');assert.equal(f.controller.snapshot.error,undefined);
});
