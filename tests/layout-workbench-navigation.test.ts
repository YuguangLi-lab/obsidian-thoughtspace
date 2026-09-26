import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

const source=readFileSync('src/layout-planner-view.ts','utf8');
const start=source.indexOf(' private modeNavigation('),end=source.indexOf(' private select<',start);
assert.ok(start>0&&end>start,'exercise the workbench keyboard handler');
const View=new Function('getComputedStyle',transformSync(`class View{${source.slice(start,end)}}return View;`,{loader:'ts'}).code)((el:{columns:number})=>({gridTemplateColumns:Array.from({length:el.columns},()=> '100px').join(' ')}));
function fixture(count:number,columns:number){
 let selected=-1,focused=-1;
 const buttons=Array.from({length:count},(_,index)=>({focus(){focused=index;},click(){selected=index;}}));
 const group={columns,querySelectorAll:()=>buttons,onkeydown:undefined as undefined|((event:unknown)=>void)};
 new View().modeNavigation(group);
 const key=(name:string,index=0,extra:Record<string,unknown>={})=>{const event={key:name,target:buttons[index],altKey:false,ctrlKey:false,metaKey:false,isComposing:false,keyCode:0,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};group.onkeydown?.(event);return event;};
 return{key,get selected(){return selected;},get focused(){return focused;}};
}
test('arrangement keyboard rows follow the responsive grid column count',()=>{
 for(const columns of [2,4]){const f=fixture(8,columns),event=f.key('ArrowDown');assert.equal(f.selected,columns);assert.equal(f.focused,columns);assert.equal(event.prevented,true);assert.equal(event.stopped,true);f.key('ArrowUp',columns);assert.equal(f.selected,0);}
});
test('separate equal-spacing and alignment groups retain wraparound and endpoint navigation',()=>{
 for(const count of [2,6]){const f=fixture(count,count);f.key('ArrowLeft');assert.equal(f.selected,count-1);f.key('ArrowRight',count-1);assert.equal(f.selected,0);f.key('End');assert.equal(f.selected,count-1);f.key('Home',count-1);assert.equal(f.selected,0);}
});
test('composition, modified arrows and unrelated targets never switch a layout',()=>{
 for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{target:{}}]){const f=fixture(8,2),event=f.key('ArrowDown',0,extra);assert.equal(f.selected,-1);assert.equal(event.prevented,false);}
});
