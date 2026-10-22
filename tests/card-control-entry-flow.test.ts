import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {reserveCardControlDocks} from '../src/card-control-layout';

const source=readFileSync('src/main.ts','utf8');
const take=(start:string,end:string)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const track=take('      const trackControls=()=>{','\n      if((n.collapsed');
const reserve=take('  private reserveVisibleCardControls(){','  private positionNode(');
const sync=take('  private syncCardControlContext(){','  private reserveVisibleCardControls(){');
const View=new Function('reserveCardControlDocks','mountCardControlHover','readingTitle','button',transformSync(`class View{${sync}${reserve}mount(n,el,scope){${track}trackControls();}}return View`,{loader:'ts'}).code)(reserveCardControlDocks,()=>()=>{},()=> '测试原卡片',(el:any,label:string,_icon:string,click:()=>void,cls:string)=>{
 const entry={label,cls,attrs:{} as Record<string,string>,classList:{contains:(name:string)=>name==='ts-card-control-entry'},setAttribute(k:string,v:string){this.attrs[k]=v;},click};el.entry=entry;return entry;
});

function setup(){
 const doc:{activeElement:any}={activeElement:null},view=new View(),nodes=[{id:'a',x:40,y:150,width:200,height:120},{id:'b',x:40,y:360,width:200,height:120}];
 const elements=nodes.map(n=>{
  const properties=new Map<string,string>(),classes=new Set<string>(),original={clicks:0,classList:{contains:()=>false},focus(){doc.activeElement=this;},click(){this.clicks++;}};
  const el:any={isConnected:true,ownerDocument:doc,dataset:{},original,entry:undefined,
   style:{getPropertyValue:(k:string)=>properties.get(k)||'',setProperty:(k:string,v:string)=>properties.set(k,v)},
   classList:{contains:(c:string)=>classes.has(c),add:(c:string)=>classes.add(c),remove:(c:string)=>classes.delete(c)},
   contains:(target:any)=>target===original||target===el.entry,
   querySelector:(selector:string)=>selector==='.ts-card-control-entry'?el.entry:selector.startsWith(':scope')?{}:original,
   addEventListener(){},removeEventListener(){}};
  return el;
 });
 Object.assign(view,{session:{board:{viewport:{x:0,y:0,zoom:1}}},controlStageSize:{width:346,height:700},stage:{parentElement:{classList:{contains:()=>true}}},connectionCandidates:nodes,
  selected:new Set(),positions:new Map(nodes.map((n,i)=>[n.id,elements[i]])),cardControlRequests:new Map(nodes.map(n=>[n.id,{id:n.id,node:n,count:3,priority:2,dimensions:{width:136,height:36,touchTargets:true,screenGap:24,topReserve:60,avoid:nodes.filter(other=>other!==n)}}])),updateSelection(){},positionNode(){}});
 for(let i=0;i<nodes.length;i++)view.mount(nodes[i],elements[i],{register(){}});
 return{view,doc,nodes,elements};
}

test('passive named entry selects only on click, then focuses the same existing action without invoking it',()=>{
 const {view,doc,elements}=setup();view.reserveVisibleCardControls();
 assert.equal(elements[0].entry.label,'对象操作');assert.equal(elements[0].dataset.controlDisplay,'entry');
 let stopped=0;elements[0].entry.onpointerdown({stopPropagation(){stopped++;}});
 assert.equal(stopped,1);assert.equal(view.selected.size,0,'pointerdown must not change selection beneath the pointer');
 const original=elements[0].original;doc.activeElement=elements[0].entry;elements[0].entry.click();
 assert.deepEqual([...view.selected],['a']);assert.equal(elements[0].dataset.controlDisplay,'full');assert.equal(elements[1].dataset.controlDisplay,'entry');
 assert.equal(doc.activeElement,original);assert.equal(elements[0].original,original);assert.equal(original.clicks,0,'the reveal click cannot activate a newly exposed action');
 assert.equal(elements[0].entry.attrs['aria-expanded'],'true');
});

test('entry focus alone stays passive; stale owner entry cannot change selection or focus',()=>{
 const {view,doc,elements}=setup();doc.activeElement=elements[1].entry;view.reserveVisibleCardControls();
 assert.equal(elements[1].dataset.controlDisplay,'entry');
 view.session={board:{viewport:{x:0,y:0,zoom:1}}};elements[1].entry.click();
 assert.equal(view.selected.size,0);assert.equal(doc.activeElement,elements[1].entry);
});

test('reservation uses cached visible geometry and never repositions nodes or scans overscan',()=>{
 const {view,doc,elements,nodes}=setup();view.positionNode=()=>{throw Error('second geometry scan');};
 const hidden={id:'overscan',x:1000,y:1000,width:200,height:120};view.connectionCandidates.push(hidden);view.positions.set(hidden.id,elements[1]);view.cardControlRequests.set(hidden.id,{id:hidden.id,node:hidden,count:3,dimensions:{width:136,height:36,touchTargets:true},priority:2});
 doc.activeElement=elements[0].original;view.selected=new Set([nodes[0].id]);view.reserveVisibleCardControls();
 assert.equal(elements[0].dataset.controlDisplay,'full');assert.equal(doc.activeElement,elements[0].original);
 assert.equal(nodes[0].x,40);
});

test('a focused entry retains its own presentation and focus through a shorter viewport',()=>{
 const {view,doc,elements}=setup();doc.activeElement=elements[0].entry;view.reserveVisibleCardControls();
 const original=doc.activeElement;view.controlStageSize.height=260;view.reserveVisibleCardControls();
 assert.equal(elements[0].dataset.controlDisplay,'entry','focus alone must not expand actions');
 assert.equal(elements[0].dataset.controlSuppressed,'false','focused entry cannot disappear on resize');
 assert.equal(doc.activeElement,original);assert.equal(view.selected.size,0);
});


test('overscan defaults are passive before being skipped, including a previously full dock',()=>{
 const {view,doc,nodes,elements}=setup();view.controlStageSize={width:292,height:296};nodes[1].y=300;
 elements[1].dataset.controlDisplay='full';elements[1].dataset.controlSuppressed='false';const original=elements[1].original;
 view.reserveVisibleCardControls();
 assert.equal(elements[1].dataset.controlDisplay,'entry');assert.equal(elements[1].dataset.controlSuppressed,'true');assert.equal(elements[1].entry.attrs['aria-expanded'],'false');
 assert.equal(elements[1].original,original);assert.equal(doc.activeElement,null);assert.equal(view.selected.size,0);assert.equal(nodes[1].y,300);
 nodes[1].y=180;view.controlStageSize={width:346,height:700};view.reserveVisibleCardControls();
 assert.equal(elements[1].dataset.controlDisplay,'entry');assert.equal(elements[1].dataset.controlSuppressed,'false','a re-entering original card can recover its entry');
});
test('a partially visible body still participates in entry reservation',()=>{
 const {view,nodes,elements}=setup();view.controlStageSize={width:346,height:400};nodes[1].y=390;
 view.reserveVisibleCardControls();assert.equal(elements[1].dataset.controlDisplay,'entry');assert.equal(elements[1].dataset.controlSuppressed,'false');assert.equal(view.selected.size,0);
});
test('coarse keyboard-owned primary actions retain their full state and original focus',()=>{
 const {view,doc,elements}=setup();doc.activeElement=elements[0].original;
 view.reserveVisibleCardControls();assert.equal(elements[0].dataset.controlDisplay,'full');assert.equal(elements[0].dataset.controlSuppressed,'false');assert.equal(doc.activeElement,elements[0].original);assert.equal(view.selected.size,0);
});

test('wide coarse selection uses the original context lease even with desktop navigation',()=>{
 const {view,doc,nodes,elements}=setup();view.session.board.nodes=nodes;view.selected=new Set([nodes[0].id]);
 const original=elements[0].original;let received:any;view.cardControlContext={update:(target:any)=>{received=target;},owns:(card:any)=>received?.card===card};
 view.stage.parentElement.classList.contains=(name:string)=>name==='ts-touch-card-controls';
 view.syncCardControlContext();assert.equal(received.card,elements[0]);assert.equal(received.owner,view.session);assert.equal(received.current(),true);
 assert.equal(elements[0].dataset.controlDisplay,'context');assert.equal(elements[0].original,original);assert.equal(doc.activeElement,null);assert.deepEqual([...view.selected],[nodes[0].id]);
 view.selected.clear();assert.equal(received.current(),false);view.syncCardControlContext();assert.equal(received,undefined);
});

test('an offscreen newly selected card waits for its real context lease instead of leaking a full world dock',()=>{
 const {view,nodes,elements}=setup();view.controlStageSize={width:292,height:296};nodes[1].y=300;view.selected=new Set([nodes[1].id]);
 view.reserveVisibleCardControls();assert.equal(elements[1].dataset.controlDisplay,'entry');assert.equal(elements[1].dataset.controlSuppressed,'true');assert.equal(elements[1].entry.attrs['aria-expanded'],'false');assert.deepEqual([...view.selected],[nodes[1].id]);
});
