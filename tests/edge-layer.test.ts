import test from 'node:test';
import assert from 'node:assert/strict';
import {EdgeLayer} from '../src/edge-layer';
import type {Board, Card} from '../src/model';
import {connectionPath} from '../src/connections';

/** A small SVG DOM harness: exercise the renderer itself and count DOM writes. */
class SvgDocument {
 writes=0;
 queries=0;
 textWrites=0;
 classToggles=0;
 createElementNS(_namespace:string,tag:string){this.writes++;return new SvgElement(this,tag);}
}
class SvgElement {
 children:SvgElement[]=[];
 parent?:SvgElement;
 attributes=new Map<string,string>();
 dataset:Record<string,string>={};
 private content='';
 get textContent(){return this.content;}
 set textContent(value:string){this.ownerDocument.textWrites++;this.content=value;}
 ondblclick?: (event:{stopPropagation:()=>void})=>void;
 style={values:new Map<string,string>(),setProperty:(key:string,value:string)=>{this.ownerDocument.writes++;this.style.values.set(key,value);}};
 classList={
  contains:(name:string)=>(this.getAttribute('class')||'').split(/\s+/).includes(name),
  toggle:(name:string,force:boolean)=>{
   this.ownerDocument.classToggles++;
   const names=new Set((this.getAttribute('class')||'').split(/\s+/).filter(Boolean));
   if(force)names.add(name);else names.delete(name);
   this.setAttribute('class',[...names].join(' '));
  }
 };
 constructor(readonly ownerDocument:SvgDocument,readonly tag:string){}
 setAttribute(key:string,value:string){this.ownerDocument.writes++;this.attributes.set(key,value);}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 hasAttribute(key:string){return this.attributes.has(key);}
 removeAttribute(key:string){this.ownerDocument.writes++;this.attributes.delete(key);}
 appendChild(child:SvgElement){this.ownerDocument.writes++;child.parent=this;this.children.push(child);return child;}
 get nextSibling():SvgElement|null{if(!this.parent)return null;return this.parent.children[this.parent.children.indexOf(this)+1]||null;}
 insertBefore(child:SvgElement,next:SvgElement|null){this.ownerDocument.writes++;if(child===next)return child;if(child.parent)child.parent.children=child.parent.children.filter(item=>item!==child);const at=next?this.children.indexOf(next):this.children.length;assert.ok(at>=0);this.children.splice(at,0,child);child.parent=this;return child;}
 remove(){this.ownerDocument.writes++;if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;}
 closest(selector:string):SvgElement|null{
  for(let el:SvgElement|undefined=this;el;el=el.parent){if(selector==='[aria-label]'&&el.hasAttribute('aria-label'))return el;}
  return null;
 }
 querySelector(selector:string):SvgElement|null{
  this.ownerDocument.queries++;
  for(const child of this.children){
   if(selector.startsWith('.')?child.classList.contains(selector.slice(1)):child.tag===selector)return child;
   const nested=child.querySelector(selector);if(nested)return nested;
  }return null;
 }
}
function fixture(){
 const doc=new SvgDocument(),root=new SvgElement(doc,'svg'),edited:string[]=[];
 const node=(id:string,x:number,y:number):Card=>({id,x,y,width:100,height:70,kind:'text',text:id,color:'sand'});
 const board:Board={version:3,nodes:[node('a',0,0),node('b',300,0),node('c',300,200)],edges:[
  {id:'ab',from:'a',to:'b',label:'证据',color:'blue',direction:'both',dashed:true},
  {id:'ac',from:'a',to:'c',label:'',color:'rose',direction:'forward'}
 ],viewport:{x:0,y:0,zoom:1}};
 const layer=new EdgeLayer(root as unknown as SVGSVGElement,'test',id=>edited.push(id));
 const group=(id:string)=>{const found=root.children.find(child=>child.dataset.edge===id);assert.ok(found);return found;};
 const path=(id:string)=>{const found=group(id).querySelector('.ts-edge');assert.ok(found);return found;};
 return{doc,root,board,layer,edited,group,path,render:(selected?:string,batch?:ReadonlySet<string>,focus?:ReadonlySet<string>)=>layer.render(board,1000,800,selected,focus,batch)};
}

function descendants(root:SvgElement):SvgElement[]{return root.children.flatMap(child=>[child,...descendants(child)]);}
test('returning culled edges recover their paint and hit-test order',()=>{
 const f=fixture();f.render();const retained=f.group('ac'),old=f.group('ab');
 const source=f.board.nodes[0];f.board.nodes.push({...source,id:'distant',x:5000});f.board.edges[0].from='distant';f.board.edges[0].to='distant';f.render();assert.equal(old.parent,undefined);
 f.board.edges[0].from='a';f.board.edges[0].to='b';f.render();assert.deepEqual(f.root.children.filter(child=>child.dataset.edge).map(child=>child.dataset.edge),['ab','ac']);assert.equal(f.group('ac'),retained);
 const writes=f.doc.writes;for(let i=0;i<120;i++)f.render();assert.equal(f.doc.writes,writes,'stable edge order must not write SVG every frame');
});
test('in-place edge reordering updates SVG order without recreating routes or handles',()=>{
 const f=fixture();f.render('ab');const first=f.group('ab'),second=f.group('ac'),route=f.path('ab'),handles=first.querySelector('.ts-edge-handles');
 const preview=new SvgElement(f.doc,'path');preview.setAttribute('class','ts-connection-preview');f.root.appendChild(preview);
 f.board.edges.reverse();f.render('ab');assert.deepEqual(f.root.children.filter(child=>child.dataset.edge).map(child=>child.dataset.edge),['ac','ab']);assert.equal(f.group('ab'),first);assert.equal(f.group('ac'),second);assert.equal(f.path('ab'),route);assert.equal(first.querySelector('.ts-edge-handles'),handles);assert.equal(f.root.children.at(-1),preview);
});
function namedHandles(f:ReturnType<typeof fixture>,edge:string){
 const group=f.group(edge).querySelector('.ts-edge-handles');assert.ok(group);
 assert.equal(group.children.length,2);
 const elements=descendants(f.root),ids:string[]=[];
 for(const [index,handle] of group.children.entries()){
  assert.equal(handle.tag,'circle');assert.equal(handle.getAttribute('role'),'button');
  assert.equal(handle.getAttribute('aria-label'),null,'SVG must not enter Obsidian\'s HTMLElement-only tooltip path');
  const labelledBy=handle.getAttribute('aria-labelledby');assert.ok(labelledBy,'handle needs an accessible name reference');assert.ok(labelledBy.trim());
  const references=labelledBy.trim().split(/\s+/);assert.equal(references.length,1);
  const matches=elements.filter(el=>el.getAttribute('id')===references[0]);assert.equal(matches.length,1,'name reference must resolve uniquely in the rendered SVG');
  const title=matches[0];assert.equal(title.tag,'title');assert.equal(title.parent,handle);
  assert.equal(title.textContent,index===0?'拖动重接起点':'拖动重接终点');ids.push(references[0]);
 }
 assert.equal(new Set(ids).size,2,'start and end handles must have different title IDs');
 return{group,ids};
}

/** Native delegated tooltips select an aria-label ancestor, then require HTMLElement.isShown(). */
function delegatedTooltip(target:SvgElement){
 const labelled=target.closest('[aria-label]');
 if(!labelled)return false;
 return (labelled as unknown as {isShown():boolean}).isShown();
}

test('direct reconnect handles use distinct SVG title references for their accessible names',()=>{
 const f=fixture();f.render('ab');namedHandles(f,'ab');
});

test('hovering reconnect SVG handles never enters the native HTMLElement tooltip path',()=>{
 const f=fixture();f.render('ab');const handles=f.group('ab').querySelector('.ts-edge-handles');assert.ok(handles);
 for(const handle of handles.children){
  assert.equal('isShown' in handle,false,'the SVG harness deliberately has no HTMLElement helper');
  assert.doesNotThrow(()=>assert.equal(delegatedTooltip(handle),false));
 }
 // This control proves that the simulation reproduces the original native error.
 const unsafe=f.doc.createElementNS('http://www.w3.org/2000/svg','circle');unsafe.setAttribute('aria-label','旧手柄');
 assert.throws(()=>delegatedTooltip(unsafe),/isShown/);
});

test('reconnect title references survive batch switches and rebuilds without writes on reuse',()=>{
 const f=fixture(),batch=new Set(['ab','ac']);f.render('ab',batch);const initial=namedHandles(f,'ab'),writes=f.doc.writes;
 f.render('ab',new Set(batch));assert.equal(f.doc.writes,writes);assert.deepEqual(namedHandles(f,'ab'),initial);
 f.render(undefined,batch);assert.equal(f.group('ab').querySelector('.ts-edge-handles'),null);
 for(const id of initial.ids)assert.equal(descendants(f.root).some(el=>el.getAttribute('id')===id),false,'removed handles must leave no stale title targets');
 f.render('ac',batch);namedHandles(f,'ac');
 f.render('ab',batch);const recreated=namedHandles(f,'ab');assert.notEqual(recreated.group,initial.group);
 assert.equal(f.group('ac').querySelector('.ts-edge-handles'),null);
 f.layer.clear();f.render('ab',batch);const rebuilt=namedHandles(f,'ab');assert.notEqual(rebuilt.group,recreated.group);
 const ids=descendants(f.root).map(el=>el.getAttribute('id')).filter((id):id is string=>id!==null);assert.equal(new Set(ids).size,ids.length,'rebuilt SVG must contain no duplicate IDs');
 const rebuiltWrites=f.doc.writes;f.render('ab',batch);assert.equal(f.doc.writes,rebuiltWrites);assert.deepEqual(namedHandles(f,'ab'),rebuilt);
});

test('batch selection highlights every chosen edge without reconnect handles or changed styles',()=>{
 const f=fixture();f.render();const a=f.path('ab'),b=f.path('ac');
 const style={color:a.style.values.get('--ts-edge-ink'),start:a.getAttribute('marker-start'),end:a.getAttribute('marker-end'),dash:a.getAttribute('stroke-dasharray')};
 f.render(undefined,new Set(['ab','ac']));
 assert.equal(f.path('ab'),a);assert.equal(f.path('ac'),b);
 for(const id of ['ab','ac']){assert.ok(f.path(id).classList.contains('is-selected'));assert.equal(f.group(id).querySelector('.ts-edge-handles'),null);}
 assert.deepEqual({color:a.style.values.get('--ts-edge-ink'),start:a.getAttribute('marker-start'),end:a.getAttribute('marker-end'),dash:a.getAttribute('stroke-dasharray')},style);
});

test('unchanged batch selections reuse SVG rows without any writes, including zoom changes',()=>{
 const f=fixture(),batch=new Set(['ab','ac']);f.render(undefined,batch);
 const groups=[f.group('ab'),f.group('ac')],writes=f.doc.writes;
 f.render(undefined,new Set(batch));f.board.viewport.zoom=.75;f.render(undefined,batch);
 assert.equal(f.doc.writes,writes);assert.deepEqual([f.group('ab'),f.group('ac')],groups);
});

test('switching an edge between batch and direct selection creates and removes handles',()=>{
 const f=fixture(),batch=new Set(['ab','ac']);f.render(undefined,batch);const path=f.path('ab');
 f.render('ab',batch);const handles=f.group('ab').querySelector('.ts-edge-handles');
 assert.ok(handles);assert.equal(handles.children.length,2);assert.equal(f.group('ac').querySelector('.ts-edge-handles'),null);
 assert.deepEqual(handles.children.map(h=>h.getAttribute('r')),['6','6']);
 const writes=f.doc.writes;f.render('ab',batch);assert.equal(f.doc.writes,writes);
 f.board.viewport.zoom=.5;f.render('ab',batch);assert.deepEqual(handles.children.map(h=>h.getAttribute('r')),['12','12']);
 f.render(undefined,batch);assert.equal(f.group('ab').querySelector('.ts-edge-handles'),null);assert.ok(path.classList.contains('is-selected'));assert.equal(f.path('ab'),path);
 f.render('ab',batch);assert.ok(f.group('ab').querySelector('.ts-edge-handles'));assert.notEqual(f.group('ab').querySelector('.ts-edge-handles'),handles);
});

test('mutating the same selection set removes stale highlights and leaves no handles',()=>{
 const f=fixture(),batch=new Set(['ab','ac']);f.render('ab',batch);
 batch.delete('ab');f.render(undefined,batch);assert.ok(!f.path('ab').classList.contains('is-selected'));assert.equal(f.group('ab').querySelector('.ts-edge-handles'),null);assert.ok(f.path('ac').classList.contains('is-selected'));
 batch.clear();f.render(undefined,batch);assert.ok(!f.path('ac').classList.contains('is-selected'));
 const writes=f.doc.writes;f.render();assert.equal(f.doc.writes,writes);
});

test('batch selection preserves focus filtering, labels and double-click editing',()=>{
 const f=fixture(),batch=new Set(['ab','ac']),focus=new Set(['a','b']);f.render(undefined,batch,focus);
 assert.ok(!f.group('ab').classList.contains('is-unrelated'));assert.ok(f.group('ac').classList.contains('is-unrelated'));
 assert.equal(f.group('ab').querySelector('text')?.textContent,'证据');
 let stopped=false;f.group('ab').ondblclick?.({stopPropagation:()=>{stopped=true;}});assert.ok(stopped);assert.deepEqual(f.edited,['ab']);
 focus.add('c');f.render(undefined,batch,focus);assert.ok(!f.group('ac').classList.contains('is-unrelated'));
});

test('deleted or offscreen selected edges release their SVG rows and reappear selected when visible',()=>{
 const f=fixture(),batch=new Set(['ab','ac']);f.render(undefined,batch);const old=f.group('ab');
 f.board.viewport.x=-10000;f.render(undefined,batch);assert.equal(old.parent,undefined);assert.equal(f.root.children.filter(child=>child.dataset.edge).length,0);
 f.board.viewport.x=0;f.render(undefined,batch);assert.notEqual(f.group('ab'),old);assert.ok(f.path('ab').classList.contains('is-selected'));assert.equal(f.group('ab').querySelector('.ts-edge-handles'),null);
 f.board.edges=[];f.render(undefined,batch);assert.equal(f.root.children.filter(child=>child.dataset.edge).length,0);
});


test('dragging labeled edges reuses caption metrics and DOM while moving labels and handles',t=>{
 const f=fixture(),source='证据 👩‍🔬 — café / e\u0301';f.board.edges[0].label=source;
 const originalFrom=Array.from,measured:string[]=[];
 t.mock.method(Array,'from',function(...args:Parameters<typeof Array.from>){
  if(typeof args[0]==='string')measured.push(args[0]);
  return Reflect.apply(originalFrom,Array,args);
 });
 f.render('ab');
 const group=f.group('ab'),caption=group.querySelector('.ts-edge-caption'),bg=caption?.querySelector('rect'),text=caption?.querySelector('text'),title=caption?.querySelector('title');
 const handles=group.querySelector('.ts-edge-handles');assert.ok(caption&&bg&&text&&title&&handles);
 const initialWidth=bg.getAttribute('width'),initialPath=f.path('ab').getAttribute('d');
 const queries=f.doc.queries,textWrites=f.doc.textWrites,measurements=measured.length;
 for(let frame=1;frame<=120;frame++){
  f.board.nodes[1].x=300+frame;f.board.nodes[1].y=frame/2;f.render('ab');
 }
 const work={measurements:measured.length-measurements,queries:f.doc.queries-queries,textWrites:f.doc.textWrites-textWrites};
 t.diagnostic(`120 labeled drag frames: ${JSON.stringify(work)}`);
 assert.deepEqual(work,{measurements:0,queries:0,textWrites:0},'position-only updates must not remeasure or rewrite unchanged caption text');
 assert.equal(group.querySelector('.ts-edge-caption'),caption);assert.equal(bg.getAttribute('width'),initialWidth);
 assert.equal(text.textContent,source);assert.equal(title.textContent,source);assert.notEqual(f.path('ab').getAttribute('d'),initialPath);
 const route=connectionPath(f.board.nodes[0],f.board.nodes[1],f.board.edges[0]);
 assert.equal(text.getAttribute('x'),String(route.label.x));assert.equal(text.getAttribute('y'),String(route.label.y+4));
 assert.equal(bg.getAttribute('x'),String(route.label.x-Number(initialWidth)/2));assert.equal(bg.getAttribute('y'),String(route.label.y-13));
 assert.deepEqual(handles.children.map(h=>[h.getAttribute('cx'),h.getAttribute('cy')]),[[String(route.from.x),String(route.from.y)],[String(route.to.x),String(route.to.y)]]);
 assert.deepEqual(measured,[source]);
});

test('caption content invalidates at identical geometry and follows immutable undo/redo data',()=>{
 const f=fixture(),initial=structuredClone(f.board.edges);f.render();
 const group=f.group('ab'),caption=group.querySelector('.ts-edge-caption');assert.ok(caption);
 const initialWidth=caption.querySelector('rect')?.getAttribute('width');assert.equal(initialWidth,'42');
 f.board.edges=f.board.edges.map(e=>e.id==='ab'?{...e,label:'关系 / relation 👩‍🔬'}:e);f.render();
 const changed=structuredClone(f.board.edges),changedWidth=caption.querySelector('rect')?.getAttribute('width');
 assert.notEqual(changedWidth,initialWidth);assert.equal(caption.querySelector('title')?.textContent,'关系 / relation 👩‍🔬');
 f.board.edges=structuredClone(initial);f.render();
 assert.equal(group.querySelector('.ts-edge-caption'),caption);assert.equal(caption.querySelector('rect')?.getAttribute('width'),initialWidth);assert.equal(caption.querySelector('text')?.textContent,'证据');
 f.board.edges=structuredClone(changed);f.render();assert.equal(caption.querySelector('rect')?.getAttribute('width'),changedWidth);assert.equal(caption.querySelector('text')?.textContent,'关系 / relation 👩‍🔬');
 const writes=f.doc.writes,textWrites=f.doc.textWrites;f.render();assert.equal(f.doc.writes,writes);assert.equal(f.doc.textWrites,textWrites);
});

test('truncated captions retain full Unicode tooltip and invalidate an edited hidden suffix',()=>{
 const f=fixture(),prefix='证据'.repeat(40),first=prefix+' first 👩‍🔬',second=prefix+' second 🧠';
 f.board.edges[0].label=first;f.render();const caption=f.group('ab').querySelector('.ts-edge-caption');assert.ok(caption);
 const text=caption.querySelector('text'),title=caption.querySelector('title'),bg=caption.querySelector('rect');assert.ok(text&&title&&bg);
 assert.equal(text.textContent,prefix.slice(0,79)+'…');assert.equal(title.textContent,first);assert.equal(bg.getAttribute('width'),'900');
 f.board.edges[0].label=second;f.render();assert.equal(title.textContent,second);assert.equal(text.textContent,prefix.slice(0,79)+'…');assert.equal(bg.getAttribute('width'),'900');
 f.board.edges[0].label='';f.render();assert.equal(f.group('ab').querySelector('.ts-edge-caption'),null);assert.equal(caption.parent,undefined);
 f.board.edges[0].label='A🧠中e\u0301';f.render();const recreated=f.group('ab').querySelector('.ts-edge-caption');assert.ok(recreated);assert.notEqual(recreated,caption);
 assert.equal(recreated.querySelector('text')?.textContent,'A🧠中e\u0301');assert.equal(recreated.querySelector('title')?.textContent,'A🧠中e\u0301');assert.equal(recreated.querySelector('rect')?.getAttribute('width'),'61.5');
});

test('caption metric reuse preserves connection style, selection and zoom-dependent handles',t=>{
 const f=fixture();f.render('ab');const group=f.group('ab'),caption=group.querySelector('.ts-edge-caption');assert.ok(caption);
 const originalFrom=Array.from,measured:string[]=[];
 t.mock.method(Array,'from',function(...args:Parameters<typeof Array.from>){if(typeof args[0]==='string')measured.push(args[0]);return Reflect.apply(originalFrom,Array,args);});
 const edge=f.board.edges[0];edge.color='teal';edge.dashed=false;edge.direction='none';edge.style='straight';f.board.viewport.zoom=.5;f.render('ab');
 const route=connectionPath(f.board.nodes[0],f.board.nodes[1],edge),path=f.path('ab'),handles=group.querySelector('.ts-edge-handles');assert.ok(handles);
 assert.equal(path.getAttribute('d'),route.path);assert.equal(path.getAttribute('marker-start'),null);assert.equal(path.getAttribute('marker-end'),null);assert.equal(path.getAttribute('stroke-dasharray'),null);
 assert.ok(group.classList.contains('ts-color-teal'));assert.equal(caption.querySelector('text')?.getAttribute('x'),String(route.label.x));assert.deepEqual(handles.children.map(h=>h.getAttribute('r')),['12','12']);
 f.render(undefined,new Set(['ab']));assert.equal(group.querySelector('.ts-edge-handles'),null);assert.ok(path.classList.contains('is-selected'));assert.equal(group.querySelector('.ts-edge-caption'),caption);assert.deepEqual(measured,[]);
});

test('offscreen eviction, deletion and explicit clear rebuild caption content without stale metrics',()=>{
 const f=fixture();f.render();const old=f.group('ab').querySelector('.ts-edge-caption');assert.ok(old);
 f.board.viewport.x=-10000;f.render();assert.equal(f.root.children.filter(child=>child.dataset.edge).length,0);
 f.board.edges[0].label='AB';f.board.viewport.x=0;f.render();const returned=f.group('ab').querySelector('.ts-edge-caption');assert.ok(returned);assert.notEqual(returned,old);assert.equal(returned.querySelector('rect')?.getAttribute('width'),'31');
 f.layer.clear();f.board.edges[0].label='新证据';f.render();const cleared=f.group('ab').querySelector('.ts-edge-caption');assert.ok(cleared);assert.notEqual(cleared,returned);assert.equal(cleared.querySelector('title')?.textContent,'新证据');assert.equal(cleared.querySelector('rect')?.getAttribute('width'),'54');
 const edges=structuredClone(f.board.edges);f.board.edges=[];f.render();assert.equal(f.root.children.filter(child=>child.dataset.edge).length,0);
 f.board.edges=edges;f.board.edges[0].label='x';f.render();assert.equal(f.group('ab').querySelector('rect')?.getAttribute('width'),'24.5');assert.equal(f.group('ab').querySelector('text')?.textContent,'x');
});

test('moving geometry retains current selection and focus without repeating class toggles',t=>{
 const f=fixture(),focus=new Set(['a','b']),batch=new Set(['ab','ac']);f.render('ab',batch,focus);
 const groups=[f.group('ab'),f.group('ac')],paths=[f.path('ab'),f.path('ac')],toggles=f.doc.classToggles;
 for(let frame=1;frame<=120;frame++){
  f.board.nodes[0].x=frame;f.board.nodes[0].y=frame/2;f.render('ab',batch,focus);
  assert.equal(paths[0].getAttribute('d'),connectionPath(f.board.nodes[0],f.board.nodes[1],f.board.edges[0]).path);
  assert.equal(paths[1].getAttribute('d'),connectionPath(f.board.nodes[0],f.board.nodes[2],f.board.edges[1]).path);
 }
 t.diagnostic(`120 moving frames / 2 edges: ${f.doc.classToggles-toggles} class toggles`);assert.equal(f.doc.classToggles,toggles);
 assert.deepEqual([f.group('ab'),f.group('ac')],groups);assert.ok(paths.every(path=>path.classList.contains('is-selected')));assert.ok(groups[1].classList.contains('is-unrelated'));assert.ok(!groups[0].classList.contains('is-unrelated'));
 focus.add('c');batch.delete('ac');f.render('ab',batch,focus);assert.equal(f.doc.classToggles,toggles+2);assert.ok(!groups[1].classList.contains('is-unrelated'));assert.ok(!paths[1].classList.contains('is-selected'));
});

test('initial focus and selection survive color-theme changes that rewrite an edge group class',()=>{
 const f=fixture(),focus=new Set(['a']),batch=new Set(['ab']);f.render('ab',batch,focus);
 const group=f.group('ab'),path=f.path('ab');assert.ok(group.classList.contains('is-unrelated'));assert.ok(path.classList.contains('is-selected'));
 for(const color of ['teal',undefined,'rose'] as const){
  f.board.edges[0]={...f.board.edges[0],color};f.render('ab',batch,focus);
  assert.equal(f.group('ab'),group);assert.ok(group.classList.contains('is-unrelated'));assert.ok(path.classList.contains('is-selected'));assert.equal(path.style.values.get('--ts-edge-ink'),color?'var(--ts-tone)':'var(--text-muted)');if(color)assert.ok(group.classList.contains('ts-color-'+color));
  const toggles=f.doc.classToggles;f.board.nodes[0].x+=1;f.render('ab',batch,focus);assert.equal(f.doc.classToggles,toggles);
 }
 focus.add('b');batch.clear();f.render(undefined,batch,focus);assert.ok(!group.classList.contains('is-unrelated'));assert.ok(!path.classList.contains('is-selected'));
 f.layer.clear();f.render('ab',new Set(['ab']),new Set(['a']));assert.notEqual(f.group('ab'),group);assert.ok(f.group('ab').classList.contains('is-unrelated'));assert.ok(f.path('ab').classList.contains('is-selected'));
});

test('120 camera frames compare live edge values without rebuilding geometry and style strings',t=>{
 const f=fixture();f.render('ab');const paths=[f.path('ab'),f.path('ac')],writes=f.doc.writes,original=Array.prototype.join;let geometry=0,style=0;
 Array.prototype.join=function(this:unknown[],separator?:string){if(separator==='|'){if(this.length===11)geometry++;if(this.length===3)style++;}return original.call(this,separator);};
 try{for(let frame=0;frame<120;frame++){f.board.viewport.x=frame/100;f.render('ab');}}finally{Array.prototype.join=original;}
 t.diagnostic(`120 camera frames / 2 edges: ${JSON.stringify({geometry,style})}`);assert.deepEqual({geometry,style},{geometry:0,style:0});assert.equal(f.doc.writes,writes);assert.deepEqual([f.path('ab'),f.path('ac')],paths);
});

test('frame-local endpoint indexing avoids temporary pair arrays and reads fresh replacements',t=>{
 const f=fixture();f.board.nodes.push(...Array.from({length:1197},(_,i):Card=>({id:'far'+i,kind:'text',x:10000+i*200,y:10000,width:100,height:80,color:'sand'})));let pairs=0;
 f.board.nodes=new Proxy(f.board.nodes,{get(target,key,receiver){
  if(key==='map')return(...args:unknown[])=>{const result=Reflect.apply(Array.prototype.map,target,args) as unknown[];if(Array.isArray(result[0])&&result[0][1]===target[0])pairs+=result.length;return result;};
  return Reflect.get(target,key,receiver);
 }});
 for(let frame=0;frame<120;frame++)f.render();t.diagnostic(`120 frames / 1200 nodes: ${pairs} temporary index entry arrays`);assert.equal(pairs,0);
 f.board.nodes=f.board.nodes.map(n=>n.id==='b'?{...n,x:490,width:180}:n).reverse();f.render('ab');
 assert.equal(f.path('ab').getAttribute('d'),connectionPath(f.board.nodes.find(n=>n.id==='a')!,f.board.nodes.find(n=>n.id==='b')!,f.board.edges[0]).path);
 const prior=f.group('ab');f.board.nodes=f.board.nodes.filter(n=>n.id!=='b');f.render();assert.equal(prior.parent,undefined);
 f.board.nodes.push({id:'b',kind:'text',x:250,y:150,width:110,height:90,color:'blue'});f.render('ab');assert.notEqual(f.group('ab'),prior);
 assert.equal(f.path('ab').getAttribute('d'),connectionPath(f.board.nodes.find(n=>n.id==='a')!,f.board.nodes.find(n=>n.id==='b')!,f.board.edges[0]).path);
});

test('edge value snapshots invalidate for each endpoint field, side and path style',()=>{
 const f=fixture();f.board.edges[0].fromSide='bottom';f.board.edges[0].toSide='bottom';f.render('ab');
 const verify=()=>{const route=connectionPath(f.board.nodes[0],f.board.nodes[1],f.board.edges[0]);assert.equal(f.path('ab').getAttribute('d'),route.path);const label=f.group('ab').querySelector('text')!;assert.equal(label.getAttribute('x'),String(route.label.x));assert.equal(label.getAttribute('y'),String(route.label.y+4));const handles=f.group('ab').querySelector('.ts-edge-handles')!;assert.deepEqual(handles.children.map(h=>[h.getAttribute('cx'),h.getAttribute('cy')]),[[String(route.from.x),String(route.from.y)],[String(route.to.x),String(route.to.y)]]);};
 for(const index of [0,1])for(const key of ['x','y','width','height'] as const){f.board.nodes[index][key]+=17.125;f.render('ab');verify();}
 for(const side of ['left','right','top','bottom',undefined] as const)for(const style of ['straight','elbow','curve',undefined] as const){
  f.board.edges[0]={...f.board.edges[0],fromSide:side,toSide:side,style};f.board.nodes=f.board.nodes.map(n=>({...n}));f.render('ab');verify();
 }
});

test('zero coordinates, empty captions and absent or false styles preserve default paths and handles',()=>{
 const f=fixture(),edge=f.board.edges[0];Object.assign(edge,{label:'',style:undefined,fromSide:undefined,toSide:undefined,color:undefined,direction:undefined,dashed:undefined});
 Object.assign(f.board.nodes[0],{x:0,y:0});Object.assign(f.board.nodes[1],{x:0,y:200});f.render('ab');
 const path=f.path('ab');assert.equal(path.getAttribute('d'),connectionPath(f.board.nodes[0],f.board.nodes[1],edge).path);assert.equal(f.group('ab').querySelector('.ts-edge-caption'),null);assert.equal(path.style.values.get('--ts-edge-ink'),'var(--text-muted)');assert.equal(path.getAttribute('stroke-dasharray'),null);
 const writes=f.doc.writes;f.board.nodes[0].x=-0;f.board.nodes[0].y=-0;f.render('ab');assert.equal(f.doc.writes,writes,'signed zero retains the existing route and DOM');
 for(const dashed of [true,false,undefined]){edge.dashed=dashed;edge.direction='none';f.board.viewport.zoom=.5;f.render('ab');assert.equal(path.getAttribute('stroke-dasharray'),dashed?'7 5':null);assert.equal(path.getAttribute('marker-start'),null);assert.equal(path.getAttribute('marker-end'),null);assert.equal(path.getAttribute('d'),connectionPath(f.board.nodes[0],f.board.nodes[1],edge).path);assert.deepEqual(f.group('ab').querySelector('.ts-edge-handles')!.children.map(h=>h.getAttribute('r')),['12','12']);}
 edge.direction=undefined;edge.color='rose';f.render('ab');assert.match(path.getAttribute('marker-end')||'',/test-rose/);assert.ok(f.group('ab').classList.contains('ts-color-rose'));
});

test('moving edges do not recheck unchanged marker definitions',t=>{
 const f=fixture();f.render('ab');const has=Set.prototype.has;let markerLookups=0;
 Set.prototype.has=function(value:unknown){if(typeof value==='string'&&/^test-(blue|rose)$/.test(value))markerLookups++;return has.call(this,value);};
 try{for(let frame=0;frame<120;frame++){f.board.nodes[0].x=frame/8;f.render('ab');}}
 finally{Set.prototype.has=has;}
 t.diagnostic(`120 moving frames / 2 styled edges: ${markerLookups} repeated marker lookups`);assert.equal(markerLookups,0);
 const defs=f.root.children.find(child=>child.tag==='defs')!;assert.equal(defs.children.length,2);
 f.board.edges[0].color='teal';f.render('ab');assert.equal(defs.children.length,3);assert.match(f.path('ab').getAttribute('marker-end')||'',/test-teal/);
 f.layer.clear();f.render('ab');assert.notEqual(f.root.children[0],defs);assert.equal(f.root.children[0].children.length,2);
});

test('truncated edge captions keep a surrogate pair intact and preserve the complete tooltip',()=>{
 const f=fixture(),value='a'.repeat(78)+'😀 evidence';f.board.edges[0].label=value;f.render();
 const caption=f.group('ab').querySelector('.ts-edge-caption')!;assert.equal(caption.querySelector('text')!.textContent,'a'.repeat(78)+'…');assert.equal(caption.querySelector('title')!.textContent,value);
 f.board.edges[0].label='a'.repeat(77)+'😀 evidence';f.render();assert.equal(caption.querySelector('text')!.textContent,'a'.repeat(77)+'😀…');
 f.board.edges[0].label='a'.repeat(78)+'\ud83d evidence';f.render();assert.equal(caption.querySelector('text')!.textContent,'a'.repeat(78)+'\ud83d…','already unpaired source characters are not silently rewritten');
});
