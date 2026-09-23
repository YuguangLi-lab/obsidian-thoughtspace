import test from 'node:test';
import assert from 'node:assert/strict';
import {EdgeLayer} from '../src/edge-layer';
import type {Board, Card} from '../src/model';

/** A small SVG DOM harness: exercise the renderer itself and count DOM writes. */
class SvgDocument {
 writes=0;
 createElementNS(_namespace:string,tag:string){this.writes++;return new SvgElement(this,tag);}
}
class SvgElement {
 children:SvgElement[]=[];
 parent?:SvgElement;
 attributes=new Map<string,string>();
 dataset:Record<string,string>={};
 textContent='';
 ondblclick?: (event:{stopPropagation:()=>void})=>void;
 style={values:new Map<string,string>(),setProperty:(key:string,value:string)=>{this.ownerDocument.writes++;this.style.values.set(key,value);}};
 classList={
  contains:(name:string)=>(this.getAttribute('class')||'').split(/\s+/).includes(name),
  toggle:(name:string,force:boolean)=>{
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
 remove(){this.ownerDocument.writes++;if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;}
 closest(selector:string):SvgElement|null{
  for(let el:SvgElement|undefined=this;el;el=el.parent){if(selector==='[aria-label]'&&el.hasAttribute('aria-label'))return el;}
  return null;
 }
 querySelector(selector:string):SvgElement|null{
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
