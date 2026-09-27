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
 return{key,setColumns(value:number){columns=value;},get selected(){return selected;},get focused(){return focused;}};
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

test('single-column workspace rail moves up and down through every destination and wraps at its ends',()=>{
 const destinations=['library','boards','tasks','outline'];
 for(const [key,expected] of [
  ['ArrowDown',['boards','tasks','outline','library']],
  ['ArrowUp',['outline','library','boards','tasks']],
 ] as const){
  for(let index=0;index<destinations.length;index++){
   const f=fixture(1),event=f.key(key,index);
   assert.equal(f.selected,expected[index],`${key} from ${destinations[index]}`);
   assert.equal(f.focused,destinations.indexOf(expected[index]));
   assert.equal(event.prevented,true);assert.equal(event.stopped,true);
  }
 }
});
test('single-column rail preserves the existing left/right cycling shortcuts',()=>{
 for(const [key,expected] of [
  ['ArrowRight',['boards','tasks','outline','library']],
  ['ArrowLeft',['outline','library','boards','tasks']],
 ] as const){
  for(let index=0;index<4;index++){
   const f=fixture(1),event=f.key(key,index);
   assert.equal(f.selected,expected[index]);
   assert.equal(f.focused,['library','boards','tasks','outline'].indexOf(expected[index]));
   assert(event.prevented&&event.stopped);
  }
 }
});
test('single-column rail Home and End reach the first and last tabs from any tab',()=>{
 for(let index=0;index<4;index++){
  const f=fixture(1),home=f.key('Home',index);
  assert.equal(f.selected,'library');assert.equal(f.focused,0);assert(home.prevented&&home.stopped);
  const end=f.key('End',index);
  assert.equal(f.selected,'outline');assert.equal(f.focused,3);assert(end.prevented&&end.stopped);
 }
});
test('responsive rail uses current grid columns without reinstalling its keyboard handler',()=>{
 const f=fixture(1);assert.equal(f.key('ArrowDown',1).prevented,true);assert.equal(f.selected,'tasks');
 f.setColumns(4);
 const down=f.key('ArrowDown',2),up=f.key('ArrowUp',2);
 assert.equal(down.prevented,false);assert.equal(down.stopped,false);
 assert.equal(up.prevented,false);assert.equal(up.stopped,false);assert.equal(f.selected,'tasks');
 f.key('ArrowRight',3);assert.equal(f.selected,'library');assert.equal(f.focused,0);
 f.setColumns(1);f.key('ArrowUp',0);assert.equal(f.selected,'outline');assert.equal(f.focused,3);
});
test('single-column rail leaves composition, modifiers, unrelated keys and non-tab targets alone',()=>{
 for(const extra of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{target:{}}]){
  const f=fixture(1),event=f.key('ArrowDown',0,extra);
  assert.equal(event.prevented,false);assert.equal(event.stopped,false);assert.equal(f.selected,'');assert.equal(f.focused,-1);
 }
 for(const key of ['Tab','Enter','Escape','PageDown','a']){
  const f=fixture(1),event=f.key(key);
  assert.equal(event.prevented,false);assert.equal(event.stopped,false);assert.equal(f.selected,'');
 }
});
