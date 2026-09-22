import {test} from 'node:test';import assert from 'node:assert/strict';import {LayoutRefreshQueue,RefreshClock} from '../src/layout-refresh-queue';
function setup(){let id=0,count=0;const frames=new Map<number,()=>void>(),timers=new Map<number,()=>void>();const clock:RefreshClock={frame:fn=>{frames.set(++id,fn);return id;},later:fn=>{timers.set(++id,fn);return id;},cancelFrame:i=>{frames.delete(i);},cancelLater:i=>{timers.delete(i);}};return{queue:new LayoutRefreshQueue(()=>count++,clock),frames,timers,count:()=>count};}
test('preview updates even if animation frames stop firing',()=>{const s=setup();s.queue.schedule();[...s.timers.values()][0]();assert.equal(s.count(),1);assert.equal(s.frames.size,0);assert.equal(s.timers.size,0);});
test('rapid input coalesces without replacing the pending frame',()=>{const s=setup();s.queue.schedule();const first=[...s.frames.values()][0];for(let i=0;i<30;i++)s.queue.schedule();assert.equal(s.frames.size,1);assert.equal(s.timers.size,1);assert.equal([...s.frames.values()][0],first);first();assert.equal(s.count(),1);assert.equal(s.timers.size,0);first();assert.equal(s.count(),1);});
test('flush applies latest preview once and cancels deferred work',()=>{const s=setup();s.queue.schedule();const late=[...s.timers.values()][0];s.queue.flush();s.queue.flush();late();assert.equal(s.count(),1);assert.equal(s.frames.size,0);});
test('closing or cancelling prevents callbacks from redrawing detached UI',()=>{const s=setup();s.queue.schedule();const stale=[...s.timers.values()][0];s.queue.cancel();stale();assert.equal(s.count(),0);assert.equal(s.frames.size,0);assert.equal(s.timers.size,0);});
test('continuous requests cannot postpone the background fallback indefinitely',()=>{
 let now=0,id=0,count=0;const timers=new Map<number,{at:number;run:()=>void}>();
 const q=new LayoutRefreshQueue(()=>count++,{frame:()=>++id,cancelFrame(){},later:(run,ms)=>{timers.set(++id,{at:now+ms,run});return id},cancelLater:i=>{timers.delete(i)}});
 for(let t=0;t<600;t+=20){now=t;for(const [key,timer]of [...timers])if(timer.at<=now){timers.delete(key);timer.run()}q.schedule();}
 assert.ok(count>=4,`only ${count} updates while input continues`);q.cancel();
});
test('a burst allocates one frame and one timer, rather than cancelling and rescheduling each request',()=>{
 let frames=0,timers=0;const q=new LayoutRefreshQueue(()=>{},{frame:()=>++frames,cancelFrame(){},later:()=>++timers,cancelLater(){}});
 for(let i=0;i<200;i++)q.schedule();assert.equal(frames,1);assert.equal(timers,1);q.cancel();
});

test('refresh can schedule the next batch; old callbacks cannot consume it',()=>{let calls=0;const frames:(()=>void)[]=[];const queue=new LayoutRefreshQueue(()=>{calls++;if(calls===1)queue.schedule()},{frame:fn=>{frames.push(fn);return frames.length},cancelFrame(){},later:()=>1,cancelLater(){}});queue.schedule();frames[0]();frames[0]();assert.equal(calls,1);frames[1]();assert.equal(calls,2);queue.cancel();});
