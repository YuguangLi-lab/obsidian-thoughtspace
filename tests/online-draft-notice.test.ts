import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {OnlineDraftStore,type OnlineDraftStorage,type StoredOnlineDraft} from '../src/online-draft-store';

// Execute the actual onload notice callback with an in-memory store and notices.
// No host windows, timers, filesystem writes or UI are created.
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('    let onlineDraftNotice:'),end=source.indexOf('    await onlineDrafts.load();',start);
assert.ok(start>=0&&end>start);
const create=new Function('OnlineDraftStore','OnlineWorkspaceView','Notice','onlineDraftStorage',transformSync('function createNotice(){\n'+source.slice(start,end)+'\nreturn onlineDrafts;}',{loader:'ts',format:'cjs'}).code+'\nreturn createNotice.call(this);');
function fixture(){
 const rows=new Map<string,StoredOnlineDraft>(),created:MockNotice[]=[],cleanup:(()=>void)[]=[];let readFailure=false,writeFailure=true,covered=false,active:MockView|null=null;
 const storage:OnlineDraftStorage={read:async()=>{if(readFailure)throw Error('unreadable records');return [...rows.values()];},replace:async value=>{if(writeFailure)throw Error('quota');rows.set(value.id,value);},remove:async id=>{rows.delete(id);}};
 class MockNotice{hidden=false;constructor(readonly message:string,readonly duration:number){created.push(this);}hide(){this.hidden=true;}}
 class MockView{showDraftStorageFailure(store:OnlineDraftStore,ids:readonly string[]){assert.ok(ids.length);assert.equal(store.state(ids[0]),'error');return covered;}}
 const owner={app:{workspace:{getActiveViewOfType:()=>active}},register:(fn:()=>void)=>cleanup.push(fn)};
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{value:{setTimeout:()=>1,clearTimeout:()=>{}},configurable:true});
 let store:OnlineDraftStore;try{store=create.call(owner,OnlineDraftStore,MockView,MockNotice,storage);}finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
 return{store,created,rows,cleanup,setReadFailure:(value:boolean)=>{readFailure=value;},setWriteFailure:(value:boolean)=>{writeFailure=value;},setInline:(value:boolean)=>{covered=value;active=new MockView();},notices:()=>created.filter(n=>!n.hidden)};
}
const draft=(id='one')=>({id,source:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',note:id+'.md',time:12,text:'retained text',mode:'manual' as const,phase:'editing' as const});
test('background repeated failures replace only their own notice; inline recovery removes same draft notice',async()=>{
 const f=fixture();await f.store.load();f.store.stage(draft());await assert.rejects(f.store.flush());assert.equal(f.notices().length,1);await assert.rejects(f.store.flush());assert.equal(f.notices().length,1);assert.equal(f.created.length,2);
 f.setInline(true);await assert.rejects(f.store.flush());assert.equal(f.notices().length,0);assert.equal(f.rows.size,0);f.cleanup.forEach(fn=>fn());
});
test('active inline feedback does not dismiss a previous load or different draft warning',async()=>{
 const load=fixture();load.setReadFailure(true);await load.store.load();assert.equal(load.notices().length,1);load.setReadFailure(false);load.setInline(true);assert.throws(()=>load.store.stage(draft()));await assert.rejects(load.store.flush());assert.equal(load.notices().length,1,'inline write cannot claim the earlier unreadable-record warning');
 const other=fixture();await other.store.load();other.store.stage(draft('background'));await assert.rejects(other.store.flush());other.setWriteFailure(false);await other.store.flush();other.setWriteFailure(true);other.setInline(true);other.store.stage(draft('active'));await assert.rejects(other.store.flush());assert.equal(other.notices().length,1,'other draft warning is not dismissed by the current draft inline');
});
test('startup unreadable records always notify and a new later failure is still visible',async()=>{
 const f=fixture();f.setInline(true);f.setReadFailure(true);await f.store.load();assert.equal(f.notices().length,1);assert.equal(f.created[0].duration,10000);f.setReadFailure(false);f.setWriteFailure(false);assert.throws(()=>f.store.stage(draft()));await f.store.flush();f.setInline(false);f.setWriteFailure(true);f.store.stage(draft());await assert.rejects(f.store.flush());assert.equal(f.notices().length,1);assert.equal(f.created.length,2);f.cleanup.forEach(fn=>fn());assert.equal(f.notices().length,0);
});
