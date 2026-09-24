import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
function fixture(initial=''){
 let value=initial,checks=0,ready=0,disconnects=0,notify!:()=>void;
 const root={isConnected:true,ownerDocument:{documentElement:{}}};
 class Observer {constructor(callback:()=>void){notify=callback;}observe(target:unknown){assert.equal(target,root.ownerDocument.documentElement);}disconnect(){disconnects++;}}
 const module={exports:{} as any};
 new Function('module','exports','MutationObserver','getComputedStyle',transformSync(readFileSync('src/stylesheet-ready.ts','utf8'),{loader:'ts',format:'cjs'}).code)(module,module.exports,Observer,()=>({getPropertyValue:(name:string)=>{checks++;assert.equal(name,'--ts-board-layout-ready');return value;}}));
 return{root,start:()=>module.exports.whenBoardStylesReady(root,()=>ready++),notify:()=>notify(),style:(next:string)=>{value=next;notify();},counts:()=>({checks,ready,disconnects})};
}
test('existing plugin stylesheet allows one immediate measurement and releases its observer',()=>{
 const f=fixture(' 1 ');f.start();assert.deepEqual(f.counts(),{checks:1,ready:1,disconnects:1});f.notify();assert.equal(f.counts().ready,1);assert.equal(f.counts().checks,1);
});
test('unrelated stylesheet changes cannot enable measurement before plugin styles arrive',()=>{
 const f=fixture(),stop=f.start();assert.equal(f.counts().ready,0);f.notify();f.style('0');assert.equal(f.counts().ready,0);f.style('1');assert.equal(f.counts().ready,1);f.notify();stop();assert.equal(f.counts().ready,1);
});
test('closing a waiting view prevents later styles from reviving its measurements',()=>{
 const f=fixture(),stop=f.start();stop();f.style('1');assert.equal(f.counts().ready,0);assert.equal(f.counts().disconnects,1);
});
test('a detached view waits for attachment even when styles are already loaded',()=>{
 const f=fixture('1');f.root.isConnected=false;f.start();assert.equal(f.counts().ready,0);f.root.isConnected=true;f.notify();assert.equal(f.counts().ready,1);
});
