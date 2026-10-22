import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {syncCardPortTabStops} from '../src/card-control-context';

const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('    const syncPorts=()=>{'),end=source.indexOf('    this.syncPortTabStops=syncPorts;',start);
assert.ok(start>0&&end>start);
const bind=new Function('root','syncCardPortTabStops',transformSync(source.slice(start,end)+'return syncPorts;',{loader:'ts'}).code);
function fixture(){
 const root={ownerDocument:{activeElement:null as any}},view:any={selected:new Set(['node10']),selectedEdge:undefined,mode:'select',session:{board:{edges:[{id:'edge',from:'node12',to:'node18'}]}},positions:new Map()};
 for(let i=0;i<80;i++){const ports=Array.from({length:4},()=>({tabIndex:0})),card={ports,querySelectorAll:()=>ports,contains:(el:any)=>ports.includes(el)};view.positions.set('node'+i,card);}
 return{root,view,sync:bind.call(view,root,syncCardPortTabStops),eligible:()=>[...view.positions].filter(([,card]:any)=>card.ports.some((port:any)=>port.tabIndex===0)).map(([id]:any)=>id)};
}
test('80 mounted cards expose only selected ports in normal keyboard navigation',()=>{
 const f=fixture();f.sync();assert.deepEqual(f.eligible(),['node10']);assert.equal([...f.view.positions.values()].flatMap((card:any)=>card.ports).filter((port:any)=>port.tabIndex===0).length,4);
});
test('the actually focused card retains ports until focus leaves, without selecting it',()=>{
 const f=fixture();f.root.ownerDocument.activeElement=f.view.positions.get('node30').ports[1];f.sync();assert.deepEqual(f.eligible(),['node10','node30']);assert.deepEqual([...f.view.selected],['node10']);f.root.ownerDocument.activeElement=null;f.sync();assert.deepEqual(f.eligible(),['node10']);
});
test('explicit connect mode preserves every original target, then normal navigation becomes finite again',()=>{
 const f=fixture();f.view.mode='connect';f.sync();assert.equal(f.eligible().length,80);f.view.mode='select';f.sync();assert.deepEqual(f.eligible(),['node10']);
});
test('a selected edge retains both endpoint keyboard routes, and clearing it removes unrelated ports',()=>{
 const f=fixture();f.view.selected.clear();f.view.selectedEdge='edge';f.sync();assert.deepEqual(f.eligible(),['node12','node18']);f.view.selectedEdge=undefined;f.sync();assert.deepEqual(f.eligible(),[]);
});
