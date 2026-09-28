import test from 'node:test';
import assert from 'node:assert/strict';
import {MediaPlayback,cleanMediaPlaybackState,type MediaIdentity} from '../src/media-playback';
import type {MediaCardHandle,MediaCardState} from '../src/media-card-player';
const file=(path='media/A.mp4',mtime=1,size=100):MediaIdentity=>({path,mtime,size});
const state=(time=10):MediaCardState=>({time,rate:1.25,volume:.6});
function handle(onPause=()=>{}){let pauses=0;const api:MediaCardHandle={play(){},seek(){},getState:()=>state(),dispose(){},pause(){pauses++;onPause();}};return{api,pauses:()=>pauses};}

test('playback state preserves an unfinished A point and rejects malformed core fields',()=>{
 assert.deepEqual(cleanMediaPlaybackState({...state(),loopA:2}),{...state(),loopA:2});
 assert.deepEqual(cleanMediaPlaybackState({...state(),loopA:2,loopB:2.25}),{...state(),loopA:2});
 assert.deepEqual(cleanMediaPlaybackState({...state(),loopA:2,loopB:4}),{...state(),loopA:2,loopB:4});
 for(const bad of [null,{},state(-1),{...state(),time:Infinity},{...state(),rate:0},{...state(),volume:2}])assert.equal(cleanMediaPlaybackState(bad),undefined);
});
test('active ownership blocks old pause and late state writes from another same-source instance',()=>{
 const playback=new MediaPlayback(),identity=file();let old!:ReturnType<typeof handle>;
 old=handle(()=>playback.remember(identity,state(3),old.api));const current=handle();
 playback.register(identity,old.api);playback.remember(identity,state(8),old.api);playback.activate(old.api);
 playback.register(identity,current.api);playback.activate(current.api);playback.remember(identity,state(40),current.api);
 playback.remember(identity,state(5),old.api);assert.equal(playback.get(identity)?.time,40);assert.equal(old.pauses(),1);
 playback.activate(handle().api);assert.equal(current.pauses(),0);
});
test('a stale unregister cannot remove a newer registration for the same handle',()=>{
 const playback=new MediaPlayback(),player=handle(),identity=file();const old=playback.register(identity,player.api);
 playback.register(identity,player.api);old();playback.remember(identity,state(42),player.api);assert.equal(playback.get(identity)?.time,42);
 const other=handle();playback.register(file('media/B.mp3'),other.api);playback.activate(other.api);assert.equal(player.pauses(),1);
});
test('replacing a media identity retires old handles and rejects their late progress',()=>{
 const playback=new MediaPlayback(),old=handle(),fresh=handle(),before=file(),after=file('media/A.mp4',2,200);
 playback.register(before,old.api);playback.remember(before,state(80),old.api);
 playback.register(after,fresh.api);playback.remember(after,state(1),fresh.api);playback.activate(old.api);playback.remember(before,state(90),old.api);
 assert.equal(playback.get(after)?.time,1);assert.equal(playback.get(before),undefined);assert.equal(old.pauses(),1);assert.equal(fresh.pauses(),0);
});
test('handoff attempts every pause and stops the requested player if an old decoder cannot pause',()=>{
 const playback=new MediaPlayback(),bad=handle(()=>{throw Error('backend failed');}),good=handle(),requested=handle();
 playback.register(file('bad.mp4'),bad.api);playback.register(file('good.mp3'),good.api);playback.register(file('new.mp4'),requested.api);
 assert.throws(()=>playback.activate(requested.api),/backend/);assert.equal(good.pauses(),1);assert.equal(requested.pauses(),1);
 assert.throws(()=>playback.pauseAll(),/backend/);assert.equal(good.pauses(),2);assert.equal(requested.pauses(),2);
});
test('a nested newer activation cannot be undone by the remainder of an old handoff',()=>{
 const playback=new MediaPlayback();let changed=false;const latest=handle(),old=handle(()=>{if(!changed){changed=true;playback.activate(latest.api);}}),middle=handle();
 playback.register(file('old.mp4'),old.api);playback.register(file('middle.mp4'),middle.api);playback.register(file('latest.mp4'),latest.api);
 playback.activate(middle.api);assert.equal(latest.pauses(),0);assert.equal(middle.pauses(),1);
});
test('rename and removal revoke old writers while retaining only the exact renamed identity',()=>{
 const playback=new MediaPlayback(),oldIdentity=file(),renamed=file('media/renamed.mp4');let player!:ReturnType<typeof handle>;
 player=handle(()=>playback.remember(oldIdentity,state(99),player.api));playback.register(oldIdentity,player.api);playback.remember(oldIdentity,state(12),player.api);
 playback.rename(oldIdentity.path,renamed.path);assert.equal(playback.get(oldIdentity),undefined);assert.equal(playback.get(renamed)?.time,12);assert.equal(player.pauses(),1);
 playback.remember(oldIdentity,state(90),player.api);assert.equal(playback.get(oldIdentity),undefined);
 playback.remove(renamed.path);assert.deepEqual(playback.recent(),[]);
});
test('slow persisted imports cannot overwrite session progress and combined storage stays bounded',()=>{
 let notifications=0;const playback=new MediaPlayback(()=>notifications++,2),a=file('a.mp4'),b=file('b.mp4'),c=file('c.mp4');
 playback.remember(a,state(50));playback.import({version:1,entries:[{...a,state:state(1)},{...b,state:state(2)}]});assert.equal(playback.get(a)?.time,50);
 playback.import({version:1,entries:[{...c,state:state(3)}]});assert.equal(playback.export().entries.length,2);assert.equal(playback.get(a)?.time,50);assert.equal(notifications,1);
 const copy=playback.get(a)!;copy.time=2;const exported=playback.export();exported.entries.find(entry=>entry.path===a.path)!.state.time=999;assert.equal(playback.get(a)?.time,50);
 playback.remember(a,state(50));assert.equal(notifications,1);
});
test('invalid persistence entries and invalid limits cannot create unbounded resume memory',()=>{
 const playback=new MediaPlayback(()=>{},0);for(let index=0;index<81;index++)playback.remember(file(`${index}.mp4`),state(index));assert.equal(playback.export().entries.length,80);
 const clean=new MediaPlayback();clean.import({version:1,entries:[{...file('../escape.mp4'),state:state()},{...file('bad.mp4',-1),state:state()},{...file('good.mp4'),state:state()}]});assert.deepEqual(clean.recent(),['good.mp4']);
});
