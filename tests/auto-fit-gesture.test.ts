import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';import {nodeFitChanges} from '../src/node-fit-batch';
import type {Card} from '../src/model';
function fixture(kind:'card'|'text'='card'){
 const source=readFileSync('src/main.ts','utf8');const take=(a:string,b:string)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 const code=take('  private queueTextFit(', '\n  saveView(')+take('  private pointerUp(', '  private updateSelection(');
 const measurements=new Map<string,{width:number;height:number}>();let measured=0;
 const measure=(id:string)=>{measured++;return measurements.get(id)!;};
 const View=new Function('nodeFitChanges','clone','fitTextNode','measureNoteCard',transformSync('class View{'+code+'}\nreturn View',{loader:'ts'}).code)(nodeFitChanges,structuredClone,(n:Card)=>Object.assign(n,measure(n.id)),(preview:{fitId:string})=>measure(preview.fitId));
 const node:Card={id:'a',kind,file:'n.md',color:'sand',autoFit:true,x:0,y:0,width:300,height:150};
 const v=new View();v.pendingFits=new Map();v.deferredCardFits=new Set();v.nodeKeys=new Map([['a','current']]);let scheduled=0,saves=0;
 v.nodeFitQueue={schedule(){scheduled++}};v.session={board:{nodes:[node],viewport:{x:0,y:0,zoom:1}},change(fn:any){saves++;fn(this.board)}};
 const preview={isConnected:true,offsetWidth:300,fitId:node.id,dataset:{mathStatus:'none'},getAttribute:(_name:string):string|null=>null};v.positions=new Map([[node.id,{querySelector:()=>preview}]]);
 v.renderBoard=()=>{};v.scheduleRender=()=>{};v.flushPointer=()=>{};v.previewGridLanding=()=>{};v.drawAlignmentGuides=()=>{};v.stage={clientWidth:1000,clientHeight:700,hasPointerCapture:()=>false};
 return{v,node,preview,measurements,counts:()=>({scheduled,saves,measured})};
}
test('preview finishing during a pan applies its measured size after release',()=>{
 const {v,node,counts}=fixture();v.gesture={id:1,pan:true,x:NaN,y:NaN};v.queueNodeFit(node,{width:300,height:420});
 assert.equal(v.pendingFits.size,1,'pan must not discard completed measurements');assert.equal(node.height,150);
 v.pointerUp({pointerId:1});assert.ok(counts().scheduled>0);v.flushNodeFits();assert.equal(node.height,420);assert.equal(counts().saves,1);
});

test('a hidden connected card defers measuring until the actual stage resize callback reveals it',()=>{
 const {v,node,preview,measurements,counts}=fixture();preview.offsetWidth=0;measurements.set('a',{width:2,height:150});
 v.queueCardFit(node,preview);v.flushNodeFits();
 assert.equal(counts().measured,0);assert.equal(counts().saves,0);assert.deepEqual([...v.deferredCardFits],['a']);
 const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('    const resizeObserver=new ResizeObserver('),end=source.indexOf('\n',start);
 let notify!:()=>void;v.register=()=>{};
 new Function('ResizeObserver',source.slice(start,end)).call(v,class{constructor(callback:()=>void){notify=callback;}observe(){}disconnect(){}});
 v.stage.clientWidth=0;notify();assert.equal(counts().measured,0,'hidden resize must not probe');
 preview.offsetWidth=300;v.stage.clientWidth=1000;measurements.set('a',{width:360,height:420});notify();v.flushNodeFits();
 assert.equal(counts().measured,1);assert.equal(counts().saves,1);assert.equal(v.deferredCardFits.size,0);assert.deepEqual([node.width,node.height],[360,420]);
 notify();assert.equal(counts().measured,1,'ordinary resizes do not repeat a completed fit');
});

test('deferred card fitting uses current eligibility after deletion, locking or entering an editor',()=>{
 for(const protection of ['deleted','unmounted','locked','fixed','inlineId','inlineTarget','closed','blocked'] as const){
  const {v,node,preview,measurements,counts}=fixture();preview.offsetWidth=0;v.queueCardFit(node,preview);preview.offsetWidth=300;measurements.set('a',{width:350,height:430});
  if(protection==='deleted')v.session.board.nodes=[];else if(protection==='unmounted')v.positions.clear();else if(protection==='locked')node.locked=true;else if(protection==='fixed')node.autoFit=false;else if(protection==='closed')v.closed=true;else if(protection==='blocked')v.session.blocked=true;else v[protection]=node.id;
  v.retryDeferredCardFits();v.flushNodeFits();assert.equal(counts().saves,0,protection);assert.equal(counts().measured,0,protection);
 }
});

test('positive measurements below board minimums never schedule invalid writes',()=>{
 const {v,node,counts}=fixture();for(const size of [{width:2,height:150},{width:79.9,height:150},{width:300,height:59.9}])v.queueNodeFit(node,size);
 assert.equal(counts().scheduled,0);v.flushNodeFits();assert.equal(counts().saves,0);
});

test('reactivation does not measure a replacement preview before native rendering completes',()=>{
 const {v,node,preview,measurements,counts}=fixture();preview.offsetWidth=0;v.queueCardFit(node,preview);
 preview.offsetWidth=300;preview.getAttribute=()=> 'true';measurements.set('a',{width:350,height:430});v.retryDeferredCardFits();
 assert.equal(counts().measured,0);assert.equal(counts().scheduled,0);
 preview.getAttribute=()=> 'false';v.queueCardFit(node,preview);v.flushNodeFits();assert.equal(node.height,430);assert.equal(counts().saves,1);
});
test('a scheduled fit is retained if a gesture starts before its frame',()=>{
 const {v,node}=fixture();v.queueNodeFit(node,{width:300,height:350});v.gesture={id:1,pan:true,x:NaN,y:NaN};v.flushNodeFits();assert.equal(v.pendingFits.size,1);assert.equal(node.height,150);
 v.pointerUp({pointerId:1});v.flushNodeFits();assert.equal(node.height,350);
});
test('stale fits still cannot overwrite a manually resized or replaced card',()=>{
 const {v,node}=fixture();v.queueNodeFit(node,{width:300,height:420});v.nodeKeys.set('a','replacement');v.flushNodeFits();assert.equal(node.height,150);
});

test('cancelled panning also resumes valid measurements',()=>{
 const {v,node}=fixture();v.gesture={id:1,pan:true,x:NaN,y:NaN};v.queueNodeFit(node,{width:300,height:360});v.pointerUp({pointerId:1},true);v.flushNodeFits();assert.equal(node.height,360);
});
test('invalid measurements never schedule a board write',()=>{
 const {v,node,counts}=fixture();for(const height of [NaN,Infinity,0,-5])v.queueNodeFit(node,{width:300,height});assert.equal(v.pendingFits.size,0);assert.equal(counts().scheduled,0);
});

// Font completion and CSS changes remeasure mounted nodes while a pan may hold
// the previous fit. Exercise those production entry points, not a copied queue.
for(const kind of ['text','card'] as const)test(`${kind}: latest equal or subpixel font measurements cancel a held fit`,()=>{
 for(const latest of [{width:300,height:150},{width:300.5,height:150.999},{width:299.001,height:149.5}]){
  const {v,node,preview,measurements,counts}=fixture(kind);v.gesture={id:1,pan:true,x:NaN,y:NaN};measurements.set('a',{width:360,height:420});
  if(kind==='text')v.queueTextFit(node);else v.queueCardFit(node,preview);
  assert.equal(v.pendingFits.size,1);measurements.set('a',latest);v.refreshFontMetrics();assert.equal(counts().measured,2);
  assert.equal(v.pendingFits.has('a'),false,'the latest valid no-op must replace the older measurement');
  v.pointerUp({pointerId:1});v.flushNodeFits();assert.deepEqual([node.width,node.height],[300,150]);assert.equal(counts().saves,0);assert.equal(counts().scheduled,0);
 }
});

test('latest unchanged font measurement also cancels an already scheduled frame',()=>{
 const {v,node,measurements,counts}=fixture('text');measurements.set('a',{width:300,height:420});v.queueTextFit(node);
 measurements.set('a',{width:300,height:150});v.refreshFontMetrics();v.flushNodeFits();assert.equal(node.height,150);assert.equal(counts().scheduled,1);assert.equal(counts().saves,0);
});

test('one node returning to its current size preserves another node pending fit',()=>{
 const {v,node,measurements,counts}=fixture('text'),other:Card={...node,id:'b'};v.session.board.nodes.push(other);v.positions.set('b',{querySelector:()=>null});v.nodeKeys.set('b','other-current');
 v.gesture={id:1,pan:true,x:NaN,y:NaN};measurements.set('a',{width:300,height:420});measurements.set('b',{width:340,height:380});v.refreshFontMetrics();assert.equal(v.pendingFits.size,2);
 measurements.set('a',{width:300,height:150});v.refreshFontMetrics();assert.deepEqual([...v.pendingFits.keys()],['b']);
 v.pointerUp({pointerId:1});v.flushNodeFits();assert.deepEqual([node.width,node.height],[300,150]);assert.deepEqual([other.width,other.height],[340,380]);assert.equal(counts().saves,1);
});

test('a later genuine measurement replaces the cancelled fit including the one-pixel boundary',()=>{
 for(const latest of [{width:301,height:150},{width:300,height:151},{width:299,height:150},{width:340,height:380}]){
  const {v,node,measurements,counts}=fixture('text');v.gesture={id:1,pan:true,x:NaN,y:NaN};measurements.set('a',{width:300,height:420});v.queueTextFit(node);
  measurements.set('a',{width:300,height:150});v.refreshFontMetrics();assert.equal(v.pendingFits.size,0);
  measurements.set('a',latest);v.refreshFontMetrics();assert.equal(v.pendingFits.size,1);v.pointerUp({pointerId:1});v.flushNodeFits();assert.deepEqual({width:node.width,height:node.height},latest);assert.equal(counts().saves,1);
 }
});

test('fresh fits after cancellation still respect editing, locking and stale render keys',()=>{
 for(const protection of ['inlineId','inlineTarget','locked','stale-key'] as const){
  const {v,node,measurements,counts}=fixture('text');v.gesture={id:1,pan:true,x:NaN,y:NaN};measurements.set('a',{width:300,height:420});v.queueTextFit(node);
  measurements.set('a',{width:300,height:150});v.refreshFontMetrics();assert.equal(v.pendingFits.size,0);
  measurements.set('a',{width:340,height:380});v.refreshFontMetrics();assert.equal(v.pendingFits.size,1);
  if(protection==='locked')node.locked=true;else if(protection==='stale-key')v.nodeKeys.set('a','replacement');else v[protection]=node.id;
  v.pointerUp({pointerId:1});v.flushNodeFits();assert.deepEqual([node.width,node.height],[300,150],protection);assert.equal(counts().saves,0,protection);
 }
});

test('invalid follow-up font measurements preserve the last valid fit',()=>{
 for(const height of [NaN,Infinity,0,-5]){
  const {v,node,measurements,counts}=fixture('text');v.gesture={id:1,pan:true,x:NaN,y:NaN};measurements.set('a',{width:300,height:420});v.queueTextFit(node);
  measurements.set('a',{width:300,height});v.refreshFontMetrics();assert.equal(v.pendingFits.get('a').height,420);
  v.pointerUp({pointerId:1});v.flushNodeFits();assert.equal(node.height,420);assert.equal(counts().saves,1);
 }
});


test('pending math waits for native rendering before measuring and committing text size',()=>{
 const {v,node,preview,measurements,counts}=fixture('text');measurements.set('a',{width:340,height:240});preview.dataset.mathStatus='pending';v.queueTextFit(node);v.refreshFontMetrics();assert.equal(counts().measured,0);assert.equal(v.pendingFits.size,0);
 preview.dataset.mathStatus='ready';v.queueTextFit(node);v.flushNodeFits();assert.equal(counts().measured,1);assert.deepEqual([node.width,node.height],[340,240]);
});
test('collapsed text ignores pending fits and font refresh until expanded',()=>{
 const {v,node,measurements,counts}=fixture('text');measurements.set('a',{width:340,height:240});v.queueTextFit(node);node.collapsed=true;node.expandedHeight=node.height;node.height=72;v.refreshFontMetrics();v.flushNodeFits();assert.equal(node.height,72);assert.equal(counts().saves,0);
 delete node.collapsed;node.height=node.expandedHeight;delete node.expandedHeight;v.refreshFontMetrics();v.flushNodeFits();assert.equal(node.height,240);assert.equal(counts().saves,1);
});

for(const kind of ['text','card'] as const)test(`${kind}: cold plugin styles cannot persist a premature size`,()=>{
 const {v,node,preview,measurements,counts}=fixture(kind);v.previewMetricsReady=false;measurements.set('a',{width:336,height:269});
 if(kind==='text')v.queueTextFit(node);else v.queueCardFit(node,preview);v.refreshFontMetrics();v.flushNodeFits();
 assert.equal(counts().measured,0);assert.equal(counts().saves,0);assert.deepEqual([node.width,node.height],[300,150]);
 v.previewMetricsReady=true;measurements.set('a',{width:370,height:303});v.refreshFontMetrics();v.flushNodeFits();assert.deepEqual([node.width,node.height],[370,303]);assert.equal(counts().saves,1);
});
