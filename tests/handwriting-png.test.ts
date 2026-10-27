import test from 'node:test';
import assert from 'node:assert/strict';
import {HandwritingPngOperation,handwritingPngSize,assertPngBytes,MAX_PNG_PIXELS} from '../src/handwriting-png';
const png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
function fixture(){const files=new Map<string,{path:string}>();let creates=0,reads=0,live=true,fail=false;const control={responseLost:false,corrupt:false,renderGate:undefined as Promise<void>|undefined};const op=new HandwritingPngOperation({current:()=>live,render:async()=>{await control.renderGate;return png;},availablePath:async()=>files.has('Ink.png')?'Ink 1.png':'Ink.png',getFile:p=>files.get(p),create:async(path,bytes)=>{creates++;if(fail)throw Error('disk full');const file={path};files.set(path,file);assert.deepEqual(bytes,png);if(control.responseLost)throw Error('response lost');return file;},read:async()=>{reads++;return control.corrupt?new Uint8Array([0]):png;}});return{op,files,control,counts:()=>({creates,reads}),cancel:()=>{live=false;},fail:()=>{fail=true;}};}
test('PNG sizes enforce side and total pixel budgets for huge and extreme aspect ratios',()=>{
 for(const [w,h]of [[1,1],[300,500],[1e6,1e6],[1e6,1],[1,1e6]]){const size=handwritingPngSize(w,h);assert.ok(size.width<=4096&&size.height<=4096&&size.width*size.height<=MAX_PNG_PIXELS);}
 for(const n of [NaN,Infinity,-1,0])assert.throws(()=>handwritingPngSize(n,10));assert.throws(()=>assertPngBytes(new Uint8Array([1])));
});
test('PNG export creates one exclusive attachment, verifies exact bytes and shares reentrant calls',async()=>{
 const f=fixture(),first=f.op.run();assert.equal(f.op.run(),first);const file=await first;assert.equal(file.path,'Ink.png');await f.op.run();assert.equal(f.counts().creates,1);
});
test('PNG collision uses the next native available name without touching the old file',async()=>{const f=fixture(),old={path:'Ink.png'};f.files.set(old.path,old);assert.equal((await f.op.run()).path,'Ink 1.png');assert.equal(f.files.get(old.path),old);});
test('PNG cancellation before encoding finishes creates no attachment',async()=>{const f=fixture();let resolve!:()=>void;f.control.renderGate=new Promise<void>(r=>resolve=r);const work=f.op.run();f.cancel();resolve();await assert.rejects(work,/取消/);assert.equal(f.counts().creates,0);});
test('PNG response loss blocks automatic retries rather than generating another file',async()=>{const f=fixture();f.control.responseLost=true;await assert.rejects(f.op.run(),/待核对/);await assert.rejects(f.op.run(),/待核对/);assert.equal(f.counts().creates,1);assert.equal(f.files.size,1);});
test('PNG readback corruption retains the attachment and does not claim export success',async()=>{const f=fixture();f.control.corrupt=true;await assert.rejects(f.op.run(),/未确认/);assert.equal(f.files.size,1);f.control.corrupt=false;await f.op.run();assert.equal(f.counts().creates,1);});
