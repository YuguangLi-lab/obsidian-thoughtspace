import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('    nav.onkeydown=e=>'),end=source.indexOf('    const searchBox=',start);
assert.ok(start>=0&&end>start,'exercise the actual sidebar tab key handler');
const install=new Function('nav','tabs',transformSync(source.slice(start,end),{loader:'ts'}).code);
function fixture(columns=2){
 const tabs=['library','boards','tasks','outline'];let selected='',focused=-1;
 const buttons=tabs.map((_,i)=>({focus(){focused=i;}})),nav={querySelectorAll:()=>buttons,win:{getComputedStyle:()=>({gridTemplateColumns:Array.from({length:columns},()=> '80px').join(' ')})},onkeydown:undefined as undefined|((e:unknown)=>void)};
 install.call({selectTab:(id:string)=>selected=id},nav,tabs);
 const key=(key:string,index=0,extra:Record<string,unknown>={})=>{const e={key,target:buttons[index],isComposing:false,keyCode:0,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};nav.onkeydown?.(e);return e;};
 return{key,get selected(){return selected;},get focused(){return focused;}};
}
test('two-row workspace tabs navigate vertically within their column and wrap horizontally',()=>{
 const f=fixture();const event=f.key('ArrowDown',1);assert.equal(f.selected,'outline');assert.equal(f.focused,3);assert(event.prevented&&event.stopped);
 f.key('ArrowUp',3);assert.equal(f.selected,'boards');f.key('ArrowLeft',0);assert.equal(f.selected,'outline');f.key('ArrowRight',3);assert.equal(f.selected,'library');
 f.key('End',0);assert.equal(f.selected,'outline');f.key('Home',3);assert.equal(f.selected,'library');
});
test('compact one-row tabs retain horizontal navigation without consuming vertical arrows',()=>{
 const f=fixture(4);assert.equal(f.key('ArrowDown').prevented,false);assert.equal(f.key('ArrowUp').prevented,false);assert.equal(f.selected,'');f.key('ArrowRight');assert.equal(f.selected,'boards');
});
test('tab navigation preserves input composition, modifiers and non-tab targets',()=>{
 for(const extra of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{target:{}}]){const f=fixture();const e=f.key('ArrowDown',0,extra);assert.equal(e.prevented,false);assert.equal(f.selected,'');}
});
