import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard, type Board} from '../src/model';
import {selectionEdges} from '../src/selection-edges';

// Execute the real selection update; only the DOM/host rendering boundary is replaced.
const source=readFileSync('src/main.ts','utf8');
const start=source.indexOf('  private updateSelection()'),end=source.indexOf('  private key(',start);
assert.ok(start>=0&&end>start);
const View=new Function('selectionEdges',transformSync(`class View{${source.slice(start,end)}};return View`,{loader:'ts'}).code)(selectionEdges);
class Element {
  classes=new Set<string>();writes=0;dataset:Record<string,string>={};
  classList={contains:(name:string)=>this.classes.has(name),toggle:(name:string,on:boolean)=>this.toggleClass(name,on)};
  constructor(readonly edge?:string){}
  getAttribute(name:string){return name==='data-edge'?this.edge:null;}
  toggleClass(name:string,on:boolean){this.writes++;if(on)this.classes.add(name);else this.classes.delete(name);}
}
function fixture(size=4){
  const board:Board=emptyBoard();
  board.nodes=Array.from({length:size},(_,i)=>({id:`n${i}`,kind:'card',file:`n${i}.md`,x:i*200,y:0,width:180,height:120,color:'sand'}));
  board.edges=board.nodes.slice(1).map((node,i)=>({id:`e${i}`,from:`n${i}`,to:node.id,label:''}));
  const positions=new Map(board.nodes.map(n=>[n.id,new Element()])),outlines=board.nodes.map(n=>{const el=new Element();el.dataset.outlineId=n.id;return el;}),edges=board.edges.map(edge=>new Element(edge.id));
  const calls={controls:0,inspector:0,render:0},view=new View();
  Object.assign(view,{session:{board,blocked:false},positions,selected:new Set(),svg:{querySelectorAll:()=>edges},sidebar:{querySelectorAll:()=>outlines},batchFormatTarget:'nodes',batchEdgeScope:'internal',
    syncCanvasControls(){calls.controls++;},renderInspector(){calls.inspector++;},scheduleRender(){calls.render++;}});
  const writes=()=>({nodes:[...positions.values()].reduce((n,el)=>n+el.writes,0),outlines:outlines.reduce((n,el)=>n+el.writes,0),edges:edges.reduce((n,el)=>n+el.writes,0)});
  const reset=()=>{for(const el of [...positions.values(),...outlines,...edges])el.writes=0;};
  const highlighted=()=>edges.filter(el=>el.classes.has('is-selected')).map(el=>el.edge);
  return{board,view,positions,outlines,edges,calls,writes,reset,highlighted};
}

test('growing a 1200-card marquee updates only newly selected nodes and outline rows',()=>{
  const f=fixture(1200);f.view.marquee={};const before=structuredClone(f.board);
  for(let i=0;i<120;i++){f.view.selected.add(`n${i}`);f.view.updateSelection();}
  assert.deepEqual(f.writes(),{nodes:120,outlines:120,edges:0});
  assert.equal(f.calls.inspector,0);assert.equal(f.calls.render,0);
  assert.equal([...f.positions.values()].filter(el=>el.classes.has('is-selected')).length,120);
  assert.deepEqual(f.board,before);
});

test('stable selection performs no style writes while non-marquee controls still refresh',()=>{
  const f=fixture();f.view.selected=new Set(['n0','n1']);f.view.updateSelection();f.reset();
  for(let i=0;i<120;i++)f.view.updateSelection();
  assert.deepEqual(f.writes(),{nodes:0,outlines:0,edges:0});
  assert.equal(f.calls.inspector,121);assert.equal(f.calls.render,121);assert.equal(f.calls.controls,121);
});

test('deselection and remounted nodes use current DOM classes without a stale membership cache',()=>{
  const f=fixture();f.view.selected=new Set(['n0','n1']);f.view.updateSelection();f.reset();
  const fresh=new Element();fresh.classes.add('is-locked');f.positions.set('n0',fresh);
  f.view.selected=new Set(['n0','n2']);f.view.updateSelection();
  assert.deepEqual(f.writes(),{nodes:3,outlines:2,edges:0});
  assert.equal(fresh.classes.has('is-selected'),true);assert.equal(fresh.classes.has('is-locked'),true);
  assert.equal(f.positions.get('n1')!.classes.has('is-selected'),false);
  f.view.selected.clear();f.view.updateSelection();
  assert.equal([...f.positions.values(),...f.outlines].some(el=>el.classes.has('is-selected')),false);
});

test('single-edge highlight switches only changed classes and keeps unrelated SVG classes',()=>{
  const f=fixture();f.edges[0].classes.add('ts-edge');f.view.selectedEdge='e0';f.view.updateSelection();f.reset();
  f.view.updateSelection();assert.deepEqual(f.writes(),{nodes:0,outlines:0,edges:0});
  f.view.selectedEdge='e1';f.view.updateSelection();assert.deepEqual(f.highlighted(),['e1']);
  assert.deepEqual(f.writes(),{nodes:0,outlines:0,edges:2});assert.equal(f.edges[0].classes.has('ts-edge'),true);
  f.view.selectedEdge=undefined;f.view.updateSelection();assert.deepEqual(f.highlighted(),[]);
});

test('batch highlights still recheck edge scope, endpoint locks, hidden branches and reconnections',()=>{
  const f=fixture();f.view.selected=new Set(['n0','n1']);f.view.batchFormatTarget='edges';
  f.view.updateSelection();assert.deepEqual(f.highlighted(),['e0']);
  f.view.batchEdgeScope='connected';f.view.updateSelection();assert.deepEqual(f.highlighted(),['e0','e1']);
  f.board.nodes[2].locked=true;f.view.updateSelection();assert.deepEqual(f.highlighted(),['e0']);
  delete f.board.nodes[2].locked;f.board.edges[0].kind='branch';f.board.nodes[0].branchFolded=true;
  f.view.updateSelection();assert.deepEqual(f.highlighted(),[]);
  delete f.board.nodes[0].branchFolded;f.board.edges[1].from='n3';f.view.updateSelection();assert.deepEqual(f.highlighted(),['e0']);
  f.board.edges[1].from='n1';f.view.updateSelection();assert.deepEqual(f.highlighted(),['e0','e1']);
});

test('marquee removes stale batch highlights and defers panels until release without changing gesture scheduling',()=>{
  const f=fixture();f.view.selected=new Set(['n0','n1']);f.view.batchFormatTarget='edges';f.view.updateSelection();
  f.view.marquee={};f.view.updateSelection();assert.deepEqual(f.highlighted(),[]);
  assert.equal(f.calls.inspector,1);assert.equal(f.calls.render,1);
  f.view.marquee=undefined;f.view.gesture={};f.view.updateSelection();assert.deepEqual(f.highlighted(),['e0']);
  assert.equal(f.calls.inspector,2);assert.equal(f.calls.render,1);
  f.view.gesture=undefined;f.view.updateSelection();assert.equal(f.calls.render,2);
});
