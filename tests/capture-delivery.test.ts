import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CaptureDeliveryOperation,CaptureCreationUnconfirmedError,captureNoteSource,newCaptureDraft,type CaptureDeliveryHost,type CaptureDestination} from '../src/capture-delivery';

interface File {path:string;body:string;}
interface Target {path:string;owner:object;open:boolean;blocked:boolean;groups:Set<string>;references:Map<string,{id:string;file:File;group?:string}>;}
interface Receipt {target:Target;id:string;file:File;}
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve(undefined);};
function fixture(){
 const target:Target={path:'Boards/One.md',owner:{},open:true,blocked:false,groups:new Set(['group']),references:new Map()},files=new Set<File>();
 const destination:CaptureDestination<Target>={key:'one',title:'One',pathSnapshot:target.path,target,groups:[{id:'group',title:'研究分组'}],groupId:'group'};
 const draft=newCaptureDraft<File,Target,Receipt>();draft.title='User title';draft.body='Original body\r\n\n---\nunknown: kept\n';draft.destination=destination;
 let current=true,creates=0,placements=0,flushes=0,serial=0,createGate:ReturnType<typeof deferred>|undefined,flushGate:ReturnType<typeof deferred>|undefined,createFail=false,flushFail=false,uncertain=false;
 const owner=target.owner;
 const validateDestination=(destination:CaptureDestination<Target>)=>{
  if(destination.target!==target||target.owner!==owner||target.path!==destination.pathSnapshot||!target.open)throw Error('目标已关闭、移动或替换');
  if(target.blocked)throw Error('目标保存保护');if(destination.groupId&&!target.groups.has(destination.groupId))throw Error('分组已删除');
 };
 const host:CaptureDeliveryHost<File,Target,Receipt>={
  current:()=>current,newId:()=>`delivery-${++serial}`,validateDestination,
  createNote:async(input,live)=>{creates++;assert.ok(live());await createGate?.promise;if(uncertain)throw new CaptureCreationUnconfirmedError('无法确认创建结果，请核对仓库');if(createFail)throw Error('创建失败');const file={path:`Notes/${input.title}-${serial}.md`,body:captureNoteSource(input)};files.add(file);return file;},
  validateCreatedFile:file=>{if(!files.has(file))throw Error('笔记已删除或替换');},
  placeReference:(file,destination,id,live)=>{assert.ok(live());validateDestination(destination);if(!target.references.has(id)){placements++;target.references.set(id,{id,file,group:destination.groupId});}return{target,id,file};},
  flushPlacement:async(receipt,live)=>{flushes++;assert.ok(live());await flushGate?.promise;if(flushFail)throw Error('白板保存失败');if(receipt.target.blocked)throw Error('白板暂停写入');if(!receipt.target.references.has(receipt.id))throw Error('投递已撤销');}
 };
 const operation=new CaptureDeliveryOperation(draft,host);
 return{operation,draft,host,target,destination,files,counts:()=>({creates,placements,flushes}),stop:()=>{current=false;},resumeHost:()=>{current=true;},failCreate:(value=true)=>{createFail=value;},failFlush:(value=true)=>{flushFail=value;},uncertain:()=>{uncertain=true;},gateCreate:()=>{createGate=deferred();return createGate;},gateFlush:()=>{flushGate=deferred();return flushGate;}};
}
test('capture source preserves body bytes and rejects multiline/control/empty/oversize titles',()=>{
 const body=' leading\r\n\n---\nkey: value\n```';assert.equal(captureNoteSource({title:' 标题 ',body}),`# 标题\n\n${body}\n`);
 for(const title of ['','  ','a\nb','a\rb','a\u0000b','x'.repeat(101)])assert.throws(()=>captureNoteSource({title,body}));
 assert.throws(()=>captureNoteSource({title:'OK',body:'x'.repeat(100001)}));
});
test('normal delivery creates one original note and one group reference with one flush',async()=>{
 const f=fixture(),result=await f.operation.run();assert.deepEqual(f.counts(),{creates:1,placements:1,flushes:1});assert.equal(result.file.body,captureNoteSource(f.draft));assert.equal(result.destination?.groupId,'group');assert.equal(f.operation.completed,true);assert.equal(f.draft.title,'User title');
});
test('rapid repeated submits and reentrant host callbacks share the installed promise',async()=>{
 const f=fixture();let repeated:Promise<unknown>|undefined;const create=f.host.createNote;f.host.createNote=(input,live)=>{repeated=f.operation.run();return create(input,live);};
 const first=f.operation.run(),second=f.operation.run();assert.equal(first,second);await first;assert.equal(repeated,first);assert.equal(f.counts().creates,1);assert.equal(f.counts().placements,1);
});
test('completed submit validates the retained note but never creates or places twice',async()=>{
 const f=fixture(),first=await f.operation.run(),second=await f.operation.run();assert.equal(first.file,second.file);assert.deepEqual(f.counts(),{creates:1,placements:1,flushes:1});
});
test('note-only capture performs no board transaction',async()=>{
 const f=fixture();f.operation.selectDestination();const result=await f.operation.run();assert.equal(result.destination,undefined);assert.deepEqual(f.counts(),{creates:1,placements:0,flushes:0});
});
test('invalid closed target is rejected before creating a note',async()=>{
 const f=fixture();f.target.open=false;await assert.rejects(f.operation.run(),/目标已关闭/);assert.equal(f.counts().creates,0);assert.equal(f.draft.body,'Original body\r\n\n---\nunknown: kept\n');
});
for(const change of ['rename','owner','group','native-lock'] as const)test(`target ${change} during create retains note without a board write`,async()=>{
 const f=fixture(),gate=f.gateCreate(),work=f.operation.run();await tick();
 if(change==='rename')f.target.path='Boards/Renamed.md';if(change==='owner')f.target.owner={};if(change==='group')f.target.groups.clear();if(change==='native-lock')f.target.blocked=true;
 gate.resolve(undefined);await assert.rejects(work,/新笔记已保留/);assert.equal(f.counts().creates,1);assert.equal(f.counts().placements,0);assert.ok(f.draft.attempt?.file);assert.equal(f.operation.contentLocked,true);
});
test('cancel during create retains the late file and permits safe retry from a new invocation',async()=>{
 const f=fixture(),gate=f.gateCreate(),work=f.operation.run();await tick();f.operation.cancel();gate.resolve(undefined);await assert.rejects(work,/输入已保留/);assert.equal(f.counts().placements,0);
 const reopened=new CaptureDeliveryOperation(f.draft,f.host);const result=await reopened.run();assert.equal(result.file,f.draft.attempt?.file);assert.deepEqual(f.counts(),{creates:1,placements:1,flushes:1});
});
test('new invocation waits for canceled earlier work before trying again',async()=>{
 const f=fixture(),gate=f.gateCreate(),first=f.operation.run();await tick();f.operation.cancel();const reopened=new CaptureDeliveryOperation(f.draft,f.host);assert.equal(reopened.run(),first);assert.throws(()=>reopened.setContent('new','body'),/不能覆盖/);gate.resolve(undefined);await assert.rejects(first);await reopened.run();assert.equal(f.counts().creates,1);
});
test('away-and-return invalidation cannot revive an old operation',async()=>{
 const f=fixture(),gate=f.gateCreate(),work=f.operation.run();await tick();f.stop();f.operation.cancel();f.resumeHost();gate.resolve(undefined);await assert.rejects(work,/原位置已变化/);assert.equal(f.counts().placements,0);
});
test('failed flush leaves an idempotent receipt; retry only flushes the same reference',async()=>{
 const f=fixture();f.failFlush();await assert.rejects(f.operation.run(),/白板保存失败.*新笔记已保留/);const note=f.draft.attempt?.file,receipt=f.draft.attempt?.placement;
 assert.equal(f.draft.attempt?.placed,true);assert.equal(f.operation.destinationLocked,true);assert.throws(()=>f.operation.selectDestination(),/投递已提交/);assert.throws(()=>f.operation.setContent('changed','body'),/不能覆盖/);
 f.failFlush(false);await f.operation.run();assert.equal(f.draft.attempt?.file,note);assert.equal(f.draft.attempt?.placement,receipt);assert.deepEqual(f.counts(),{creates:1,placements:1,flushes:2});
});
test('cancel after placement keeps receipt and records successful late persistence without navigation',async()=>{
 const f=fixture(),gate=f.gateFlush(),work=f.operation.run();await tick();assert.equal(f.counts().placements,1);f.operation.cancel();gate.resolve(undefined);await assert.rejects(work,/原位置已变化/);assert.equal(f.draft.attempt?.saved,true);
 await new CaptureDeliveryOperation(f.draft,f.host).run();assert.deepEqual(f.counts(),{creates:1,placements:1,flushes:1});
});
test('cancel and failed late flush preserves incomplete receipt for new invocation',async()=>{
 const f=fixture(),gate=f.gateFlush(),work=f.operation.run();await tick();f.operation.cancel();f.failFlush();gate.resolve(undefined);await assert.rejects(work,/新笔记已保留/);assert.equal(f.draft.attempt?.saved,false);f.failFlush(false);await new CaptureDeliveryOperation(f.draft,f.host).run();assert.equal(f.counts().placements,1);assert.equal(f.counts().flushes,2);
});
test('confirmed create failure retains editable input and retry reuses the intended capture',async()=>{
 const f=fixture();f.failCreate();await assert.rejects(f.operation.run(),/创建失败.*输入已保留/);assert.equal(f.operation.contentLocked,false);const id=f.draft.attempt?.input.id;f.failCreate(false);await f.operation.run();assert.equal(f.draft.attempt?.input.id,id);assert.equal(f.counts().creates,2);assert.equal(f.files.size,1);
});
test('editing after confirmed create rejection resets the unused attempt without losing body',async()=>{
 const f=fixture();f.failCreate();await assert.rejects(f.operation.run());f.operation.setContent('Revised','精确正文\r\n');assert.equal(f.draft.attempt,undefined);f.failCreate(false);const result=await f.operation.run();assert.equal(result.file.body,'# Revised\n\n精确正文\r\n');
});
test('unconfirmed creation outcome blocks blind retry and draft reset',async()=>{
 const f=fixture();f.uncertain();await assert.rejects(f.operation.run(),/核对仓库/);await assert.rejects(f.operation.run(),/核对仓库/);assert.equal(f.counts().creates,1);assert.equal(f.operation.contentLocked,true);assert.throws(()=>f.operation.startAnother(),/先完成或核对/);assert.throws(()=>f.operation.selectDestination(),/投递已提交/);
});
test('target can be changed before placement using the retained new note',async()=>{
 const f=fixture(),gate=f.gateCreate(),work=f.operation.run();await tick();f.target.open=false;gate.resolve(undefined);await assert.rejects(work);const original=f.draft.attempt?.file;f.operation.selectDestination();const result=await f.operation.run();assert.equal(result.file,original);assert.equal(result.destination,undefined);assert.deepEqual(f.counts(),{creates:1,placements:0,flushes:0});
});
test('selected destination snapshots groups so later list mutations cannot retarget silently',()=>{
 const f=fixture();f.operation.selectDestination(f.destination);f.destination.groups[0].title='Changed externally';assert.equal(f.draft.destination?.groups[0].title,'研究分组');assert.notEqual(f.draft.destination,f.destination);
});
test('deleting a created note blocks retry without silently recreating it',async()=>{
 const f=fixture();f.failFlush();await assert.rejects(f.operation.run());f.files.clear();f.failFlush(false);await assert.rejects(f.operation.run(),/笔记已删除/);assert.equal(f.counts().creates,1);assert.equal(f.counts().placements,1);
});
test('rename of created note keeps identity and retry never overwrites native edited body',async()=>{
 const f=fixture();f.failFlush();await assert.rejects(f.operation.run());const note=f.draft.attempt!.file!;note.path='Notes/Native renamed.md';note.body='---\nunknown: native\n---\nNative body edited after capture\n';f.failFlush(false);const result=await f.operation.run();assert.equal(result.file,note);assert.equal(note.body,'---\nunknown: native\n---\nNative body edited after capture\n');assert.equal(f.counts().creates,1);
});
test('blocked flush resolving is not sufficient: host persistence validation must reject',async()=>{
 const f=fixture(),gate=f.gateFlush(),work=f.operation.run();await tick();f.target.blocked=true;gate.resolve(undefined);await assert.rejects(work,/暂停写入/);assert.equal(f.draft.attempt?.saved,false);assert.equal(f.target.references.size,1);
});
test('external undo before save verification is rejected without readding a card',async()=>{
 const f=fixture(),gate=f.gateFlush(),work=f.operation.run();await tick();f.target.references.clear();gate.resolve(undefined);await assert.rejects(work,/投递已撤销/);await assert.rejects(f.operation.run(),/投递已撤销/);assert.equal(f.counts().placements,1);
});
test('start another is explicit and only clears successful content while retaining target',async()=>{
 const f=fixture();await f.operation.run();const destination=f.draft.destination;f.operation.startAnother();assert.equal(f.draft.title,'');assert.equal(f.draft.body,'');assert.equal(f.draft.destination,destination);assert.equal(f.draft.attempt,undefined);f.operation.setContent('Next','new body');await f.operation.run();assert.deepEqual(f.counts(),{creates:2,placements:2,flushes:2});
});
test('staging failure before mutation permits retry and retarget without a duplicate note',async()=>{
 const f=fixture(),place=f.host.placeReference;f.host.placeReference=()=>{throw Error('Cannot stage reference');};await assert.rejects(f.operation.run(),/新笔记已保留/);assert.equal(f.draft.attempt?.placed,false);f.host.placeReference=place;await f.operation.run();assert.deepEqual(f.counts(),{creates:1,placements:1,flushes:1});
});
test('invalid title rejects before destination validation or any storage work',async()=>{
 const f=fixture();f.draft.title='\n';await assert.rejects(f.operation.run(),/单行标题/);assert.equal(f.draft.attempt,undefined);assert.equal(f.counts().creates,0);
});
