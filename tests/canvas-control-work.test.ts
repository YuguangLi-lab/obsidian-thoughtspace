import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

const source=readFileSync(process.env.CANVAS_CONTROL_SOURCE||'src/main.ts','utf8');
const start=source.indexOf('  private syncCanvasControls()'),end=source.indexOf('  private drawAlignmentGuides(',start);
assert.ok(start>=0&&end>start);
const View=new Function(transformSync(`return class View{${source.slice(start,end)}}`,{loader:'ts'}).code)();
function fixture(count=1200){
 const stats={nodes:0,edges:0,writes:0,landing:0};
 const element=()=>{
  const classes=new Set<string>(),attributes=new Map<string,string>(),values:Record<string,unknown>={title:'',hidden:false,disabled:false,value:'',textContent:''};
  const el:any={attributes,classes,children:new Map<string,any>(),
   dataset:new Proxy({} as Record<string,string>,{set(o,k:string,v:string){stats.writes++;o[k]=v;return true;}}),
   classList:{contains:(name:string)=>classes.has(name),toggle(name:string,on:boolean){stats.writes++;if(on)classes.add(name);else classes.delete(name);}},
   getAttribute:(name:string)=>attributes.get(name)??null,setAttribute(name:string,value:string){stats.writes++;attributes.set(name,value);},
   querySelector:(selector:string)=>el.children.get(selector)||null,
   toggleClass(name:string,on:boolean){el.classList.toggle(name,on);},setText(text:string){el.textContent=text;}};
  for(const key of Object.keys(values))Object.defineProperty(el,key,{get:()=>values[key],set(value){stats.writes++;values[key]=value;},enumerable:true});
  return el;
 };
 const counted=(items:any[],key:'nodes'|'edges')=>new Proxy(items,{get(o,k,r){if(typeof k==='string'&&/^\d+$/.test(k))stats[key]++;return Reflect.get(o,k,r);}});
 const nodes=Array.from({length:count},(_,i)=>({id:'n'+i,locked:i===1})),edges=Array.from({length:count},(_,i)=>({id:'e'+i}));
 const view=new View(),root=element(),snap=element(),state=element(),background=element(),caption=element(),controls=element();
 snap.children.set('.ts-snap-state',state);background.children.set('.ts-background-caption',caption);controls.children.set('.ts-background-entry',background);
 Object.assign(view,{session:{board:{nodes:counted(nodes,'nodes'),edges:counted(edges,'edges'),snapToGrid:true},blocked:false},selected:new Set(),selectedEdge:undefined,
  contentEl:root,snapToggle:snap,gridSelect:element(),canvasControls:controls,canvasSummary:element(),focusSelectedButton:element(),plugin:{settings:{gridStep:16,canvasBackground:'grid'}},previewGridLanding(){stats.landing++;}});
 return{view,stats,nodes,edges,root,snap,state,background,caption,element};
}
test('idle canvas controls do not scan 1200 unselected objects or edges',()=>{
 const f=fixture();for(let i=0;i<120;i++)f.view.syncCanvasControls();
 assert.equal(f.stats.nodes,0);assert.equal(f.stats.edges,0);assert.equal(f.view.canvasSummary.textContent,'1200 个对象');
});
test('stable canvas controls make no repeated DOM writes for idle and selected states',()=>{
 for(const selected of [false,true]){const f=fixture();if(selected){f.view.selected.add('n0');f.view.selectedEdge='e0';}
  f.view.syncCanvasControls();f.stats.writes=0;for(let i=0;i<120;i++)f.view.syncCanvasControls();assert.equal(f.stats.writes,0);
 }
});
test('canvas controls restore live DOM changes and initialize remounted controls',()=>{
 const f=fixture();f.view.syncCanvasControls();f.root.classList.toggle('ts-has-edge',true);f.root.dataset.snap='false';f.snap.title='outdated';f.state.textContent='wrong';f.snap.setAttribute('aria-pressed','false');f.caption.textContent='old';f.background.title='old';f.background.setAttribute('aria-label','old');f.view.gridSelect.value='24';
 f.view.canvasSummary=f.element();f.view.focusSelectedButton=f.element();f.view.syncCanvasControls();
 assert.equal(f.root.classList.contains('ts-has-edge'),false);assert.equal(f.root.dataset.snap,'true');assert.equal(f.snap.getAttribute('aria-pressed'),'true');assert.equal(f.state.textContent,'开启');assert.equal(f.caption.textContent,'网格');assert.equal(f.background.getAttribute('aria-label'),'白板背景：网格');assert.equal(f.view.gridSelect.value,'16');assert.equal(f.view.canvasSummary.textContent,'1200 个对象');assert.equal(f.view.focusSelectedButton.hidden,true);
});
test('selection counts keep current locked, missing, duplicate IDs and replaced edge behavior',()=>{
 const f=fixture(3);f.view.selected=new Set(['n0','n1','missing']);f.view.selectedEdge='e0';f.view.syncCanvasControls();assert.equal(f.view.canvasSummary.textContent,'已选 3 项 · 含锁定对象');assert.equal(f.root.classList.contains('ts-has-edge'),true);
 f.nodes[1]={id:'n1',locked:false};f.nodes.push({id:'n0',locked:false});f.edges.splice(0,1);f.view.syncCanvasControls();assert.equal(f.view.canvasSummary.textContent,'已选 3 项');assert.equal(f.root.classList.contains('ts-has-edge'),false);assert.equal(f.view.focusSelectedButton.title,'聚焦所选 3 项 · Shift+F');
 f.view.session.blocked=true;f.view.session.board.snapToGrid=false;f.view.plugin.settings.canvasBackground='paper';f.view.plugin.settings.gridStep=32;f.view.syncCanvasControls();assert.equal(f.snap.disabled,true);assert.equal(f.view.focusSelectedButton.disabled,true);assert.equal(f.state.textContent,'关闭');assert.equal(f.caption.textContent,'纸张');assert.equal(f.stats.landing,1);assert.equal(f.view.gridSelect.value,'32');
});
test('detaching a session disables controls and still clears landing hints on each refresh',()=>{
 const f=fixture();f.view.selectedEdge='e0';f.view.syncCanvasControls();f.view.session=undefined;f.view.syncCanvasControls();f.view.syncCanvasControls();
 assert.equal(f.root.classList.contains('ts-has-edge'),false);assert.equal(f.snap.disabled,true);assert.equal(f.view.focusSelectedButton.disabled,true);assert.equal(f.view.canvasSummary.textContent,'0 个对象');assert.equal(f.stats.landing,2);
});
