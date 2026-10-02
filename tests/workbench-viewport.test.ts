import {minimapInsets} from '../src/minimap-avoidance';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {fitViewportInSafeArea} from '../src/viewport-fit';
import type {Card} from '../src/model';

// Exercise the production chrome measurement with a camera fit, rather than
// assuming a toolbar is always on one side of the board.
const source=readFileSync('src/main.ts','utf8');
const start=source.indexOf('  private viewportInsets()'),end=source.indexOf('  fit() ',start);
assert.ok(start>=0&&end>start);
const View=new Function('minimapInsets',transformSync(`return class View{${source.slice(start,end)}}`,{loader:'ts'}).code)(minimapInsets);
const rect=(left:number,top:number,width:number,height:number)=>({left,top,width,height,right:left+width,bottom:top+height});
function fixture(chrome:Record<string,ReturnType<typeof rect>>){
  const view=new View();view.measureMinimap=()=>{};
  view.stage={clientWidth:1000,clientHeight:800,getBoundingClientRect:()=>rect(100,40,1000,800),
    parentElement:{querySelector:(selector:string)=>chrome[selector]?{getClientRects:()=>[chrome[selector]],getBoundingClientRect:()=>chrome[selector],getAttribute:(name:string)=>selector==='.ts-board-rail'&&name==='aria-orientation'?'vertical':null}:null}};
  return view;
}
const nodes:Card[]=[{id:'a',kind:'text',text:'A',x:0,y:0,width:300,height:180,color:'sand'},
  {id:'b',kind:'card',file:'b.md',x:400,y:230,width:300,height:200,color:'sand'}];
function fit(view:any){return fitViewportInSafeArea(nodes,1000,800,view.viewportInsets());}

test('left floating tools reserve their edge and selected objects fit below formatting',()=>{
  const view=fixture({'.ts-board-rail':rect(112,52,50,342),
    '.ts-floating-formatbar':rect(400,52,500,72),'.ts-footer':rect(700,778,384,46)});
  const v=fit(view);
  assert.equal(view.viewportInsets().left,74);
  assert.ok(nodes.every(n=>n.x*v.zoom+v.x>74),'the fitted nodes must clear the left toolbar');
  assert.ok(nodes.every(n=>n.y*v.zoom+v.y>96),'the fitted nodes must be below the contextual format strip');
  assert.ok(nodes.every(n=>(n.y+n.height)*v.zoom+v.y<738),'the fitted nodes must clear the bottom view dock');
  const left=nodes[0].x*v.zoom+v.x,right=(nodes[1].x+nodes[1].width)*v.zoom+v.x;
  assert.ok(Math.abs((left+right)/2-537)<1,'the fit centers within the available canvas');
});
test('hiding selection formatting frees the top while the left tools stay clear',()=>{
  const common={'.ts-board-rail':rect(112,52,50,342)};
  const plain=fixture(common),selected=fixture({...common,'.ts-floating-formatbar':rect(350,168,500,120)});
  assert.ok(fit(plain).zoom>fit(selected).zoom);
  assert.equal(plain.viewportInsets().top,0);
  assert.equal(plain.viewportInsets().left,74);
});
test('hidden floating tools do not reserve canvas space',()=>{
  const view=fixture({});
  assert.equal(view.viewportInsets().left,0);
  assert.equal(view.viewportInsets().top,0);
  assert.equal(view.viewportInsets().bottom,0);
});
test('a short scrolling vertical rail keeps reserving the left edge even when wider than tall',()=>{
  const view=fixture({'.ts-board-rail':rect(112,52,50,32)});
  assert.equal(view.viewportInsets().left,74);
  assert.equal(view.viewportInsets().top,0);
});
