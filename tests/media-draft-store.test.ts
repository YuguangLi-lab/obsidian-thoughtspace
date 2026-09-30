import test from 'node:test';
import assert from 'node:assert/strict';
import {MediaDraftStore,validStoredMediaDraft,type MediaDraft,type StoredMediaDraft,type MediaDraftStorage} from '../src/media-draft-store';
const clock={setTimeout:()=>1,clearTimeout:()=>{}};
const draft=(id='draft'):MediaDraft=>({id,time:12.25,text:'**未保存**\n摘录',source:{path:'media/clip.mp4',mtime:123,size:456},image:new Blob(['png'],{type:'image/png'})});
class Storage implements MediaDraftStorage {
 rows=new Map<string,StoredMediaDraft>();writes:StoredMediaDraft[]=[];failPut=false;failRemove=false;gate?:Promise<void>;
 async read(){return [...this.rows.values()].map(value=>structuredClone(value));}
 async put(value:StoredMediaDraft){await this.gate;if(this.failPut)throw Error('quota');this.rows.set(value.id,structuredClone(value));this.writes.push(structuredClone(value));}
 async remove(id:string){if(this.failRemove)throw Error('disk');this.rows.delete(id);}
}
const store=(disk:Storage)=>new MediaDraftStore(disk,()=>{},clock);
test('restart retains text, PNG bytes, immutable source, time and save retry lock until explicit activation',async()=>{
 const disk=new Storage(),first=store(disk),d=draft();d.locked=true;first.stage(d);d.text='later mutable edit';await first.flush();
 const next=store(disk);await next.load();assert.equal(next.activeFor(d.source.path),undefined);assert.equal(next.pendingFor(d.source.path),true);
 const restored=next.activate(d.id);assert.equal(restored.text,'**未保存**\n摘录');assert.equal(await restored.image!.text(),'png');assert.equal(restored.time,12.25);assert.equal(restored.locked,true);assert.deepEqual(restored.source,d.source);
 assert.equal(next.activate(d.id),restored);assert.equal(next.pending().length,0);assert.equal(disk.rows.size,1);
});
test('typing coalesces and discard during a pending write cannot resurrect a draft',async()=>{
 const disk=new Storage(),s=store(disk),d=draft();for(let i=0;i<100;i++){d.text=String(i);s.stage(d);}await s.flush();assert.equal(disk.writes.length,1);assert.equal(disk.rows.get(d.id)?.text,'99');
 let release!:()=>void;disk.gate=new Promise(resolve=>release=resolve);d.text='pending';s.stage(d);const flush=s.flush();await Promise.resolve();const remove=s.discard(d.id);release();await Promise.all([flush,remove]);await s.flush();assert.equal(disk.rows.size,0);assert.throws(()=>s.stage(d),/结束/);
 const next=store(disk);await next.load();assert.equal(next.pending().length,0);
});
test('failed autosave preserves prior disk data and retries the newest snapshot and remaining drafts',async()=>{
 const disk=new Storage(),s=store(disk),a=draft('a'),b=draft('b');b.source.path='media/other.mp4';s.stage(a);await s.flush();a.text='new';s.stage(a);s.stage(b);disk.failPut=true;await assert.rejects(s.flush());assert.notEqual(disk.rows.get('a')?.text,'new');
 a.text='newest';s.stage(a);disk.failPut=false;await s.flush();assert.equal(disk.rows.get('a')?.text,'newest');assert.equal(disk.rows.size,2);
});
test('failed discard retains active draft and can be retried without generating a new id',async()=>{
 const disk=new Storage(),s=store(disk),d=draft();s.stage(d);await s.flush();disk.failRemove=true;await assert.rejects(s.discard(d.id));assert.equal(s.activeFor(d.source.path),d);assert.equal(disk.rows.size,1);
 s.stage(d);disk.failRemove=false;await s.discard(d.id);await s.flush();assert.equal(disk.rows.size,0);
});
test('closing without a debounce tick flushes the latest snapshot',async()=>{
 const disk=new Storage(),s=store(disk),d=draft();s.stage(d);await s.dispose();assert.equal(disk.rows.get(d.id)?.text,d.text);assert.throws(()=>s.stage(d));
});
test('unreadable records are reported and preserved, source identities are never repaired silently',async()=>{
 const disk=new Storage(),d=draft(),errors:unknown[]=[];const good={...d,version:1 as const,updatedAt:1};disk.rows.set('good',good);disk.rows.set('bad',{...good,id:'bad',source:{...d.source,path:'../wrong.mp4'}});
 const s=new MediaDraftStore(disk,e=>errors.push(e),clock);await s.load();assert.equal(errors.length,1);assert.equal(s.pending().length,1);assert.equal(disk.rows.size,2);assert.equal(validStoredMediaDraft({...good,image:new Blob(['x'],{type:'text/html'})}),false);
 for(const bad of [{time:NaN},{text:'x'.repeat(20001)},{locked:'yes'},{source:{...d.source,mtime:-1}}])assert.equal(validStoredMediaDraft({...good,...bad}),false);
});

test('an in-flight autosave failure followed by a newer queued flush never replays stale text',async()=>{
 const disk=new Storage(),s=store(disk),d=draft();let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);let calls=0;
 const put=disk.put.bind(disk);disk.put=async value=>{if(calls++===0){await gate;throw Error('first write failed');}await put(value);};
 s.stage(d);const first=s.flush();await Promise.resolve();d.text='newest while write pending';s.stage(d);const second=s.flush();release();await assert.rejects(first);await second;await s.flush();assert.equal(disk.rows.get(d.id)?.text,'newest while write pending');assert.equal(disk.writes.length,1);
});
