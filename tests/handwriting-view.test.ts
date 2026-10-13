import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as ink from '../src/ink-model';
import * as input from '../src/handwriting-input';
import * as inkEdit from '../src/handwriting-ink-edit';
import * as inkActions from '../src/ink-selection-actions';
import * as visibleInk from '../src/visible-ink-path';
import {InkPathCache} from '../src/ink-path-cache';
import {bindBoardHostInset} from '../src/board-chrome';
import type {Board} from '../src/model';
import type {HandwritingView,HandwritingHost} from '../src/handwriting-view';

class Target {
 listeners=new Map<string,Set<(event:any)=>void>>();
 addEventListener(type:string,callback:(event:any)=>void){const list=this.listeners.get(type)||new Set();list.add(callback);this.listeners.set(type,list);}
 removeEventListener(type:string,callback:(event:any)=>void){this.listeners.get(type)?.delete(callback);}
 fire(type:string,patch:Record<string,unknown>={}){const event={type,preventDefault(){},stopPropagation(){},...patch};for(const callback of this.listeners.get(type)||[])callback(event);}
}
class Element extends Target {
 children:Element[]=[];parentElement?:Element;connected=true;textContent='';title='';hidden=false;disabled=false;value='';dataset:Record<string,string>={};
 attributes=new Map<string,string>();attributeWrites=new Map<string,number>();classes=new Set<string>();captures=new Set<number>();
 style:Record<string,unknown>&{setProperty:(key:string,value:string)=>void;getPropertyValue:(key:string)=>string;removeProperty:(key:string)=>void}={setProperty:(key,value)=>{this.style[key]=value;},getPropertyValue:key=>String(this.style[key]||''),removeProperty:key=>{delete this.style[key];}};
 rect={left:0,top:0,width:800,height:600};width=0;height=0;
 classList={add:(...names:string[])=>this.addClass(...names),remove:(...names:string[])=>this.removeClass(...names)};
 constructor(readonly ownerDocument:Doc,readonly tag='div'){super();}
 get isConnected():boolean{return this.parentElement?this.parentElement.isConnected:this.connected;}
 createEl(tag:string,options?:{cls?:string;text?:string;attr?:Record<string,string>}|string){const child=new Element(this.ownerDocument,tag);if(typeof options==='string')child.addClass(options);else if(options){if(options.cls)child.addClass(options.cls);child.textContent=options.text||'';for(const [key,value]of Object.entries(options.attr||{}))child.setAttribute(key,value);}if(child.classes.has('ts-handwriting-selection-actions'))child.rect={left:0,top:0,width:216,height:54};this.appendChild(child);return child;}
 createDiv(options?:Parameters<Element['createEl']>[1]){return this.createEl('div',options);}
 createSpan(options?:Parameters<Element['createEl']>[1]){return this.createEl('span',options);}
 appendChild(child:Element){child.parentElement?.children.splice(child.parentElement.children.indexOf(child),1);child.parentElement=this;this.children.push(child);return child;}
 insertBefore(child:Element,before:Element){child.parentElement=this;this.children.splice(this.children.indexOf(before),0,child);return child;}
 replaceChildren(){for(const child of [...this.children])child.remove();}
 setAttribute(key:string,value:string){this.attributes.set(key,String(value));this.attributeWrites.set(key,(this.attributeWrites.get(key)||0)+1);}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 removeAttribute(key:string){this.attributes.delete(key);}
 addClass(...names:string[]){for(const name of names.flatMap(value=>value.split(' ')))if(name)this.classes.add(name);}
 removeClass(...names:string[]){for(const name of names)this.classes.delete(name);}
 toggleClass(name:string,on:boolean){if(on)this.classes.add(name);else this.classes.delete(name);}
 setText(text:string){this.textContent=text;}
 getBoundingClientRect(){return{...this.rect,right:this.rect.left+this.rect.width,bottom:this.rect.top+this.rect.height};}
 getClientRects(){return this.isConnected&&!this.hidden?[this.getBoundingClientRect()]:[];}
 contains(node:Element):boolean{return this===node||this.children.some(child=>child.contains(node));}
 querySelector(_selector:string){return this.all().find(element=>element.tag==='button'&&!element.disabled);}
 setPointerCapture(id:number){this.captures.add(id);}
 hasPointerCapture(id:number){return this.captures.has(id);}
 releasePointerCapture(id:number){this.captures.delete(id);}
 focus(options?:FocusOptions){this.ownerDocument.activeElement=this;this.ownerDocument.focusOptions.push(options);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=undefined;this.connected=false;}
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
 getContext(){return this.ownerDocument.context;}
}
class Doc extends Target {
 hidden=false;frames=new Map<number,()=>void>();nextFrame=0;fills:string[]=[];clears=0;now=1000;
 body=new Element(this);statusBar?:Element;
 activeElement?:Element;focusOptions:(FocusOptions|undefined)[]=[];
 context={setTransform(){},clearRect:()=>{this.clears++;},fill:(path:{data:string})=>{this.fills.push(path.data);},beginPath(){},arc(){},stroke(){},fillStyle:'',strokeStyle:'',lineWidth:1};
 defaultView=Object.assign(new Target(),{performance:{now:()=>this.now},devicePixelRatio:2,innerWidth:800,innerHeight:600,visualViewport:Object.assign(new Target(),{offsetLeft:0,offsetTop:0,width:800,height:600}),Path2D:class{constructor(readonly data:string){}},getComputedStyle:(element:Element)=>({display:element.hidden?'none':'block',visibility:'visible',getPropertyValue:(key:string)=>element.style.getPropertyValue(key)}),requestAnimationFrame:(callback:()=>void)=>{const id=++this.nextFrame;this.frames.set(id,callback);return id;},cancelAnimationFrame:(id:number)=>this.frames.delete(id)});
 querySelector(selector:string){assert.equal(selector,'.status-bar');return this.statusBar||null;}
 createElementNS(_namespace:string,tag:string){return new Element(this,tag);}
 frame(){const callbacks=[...this.frames.values()];this.frames.clear();for(const callback of callbacks)callback();}
 keydown(key:string,patch:Record<string,unknown>={}){this.activeElement?.fire('keydown',{key,isComposing:false,defaultPrevented:false,...patch});}
}
const stroke=(id='saved'):ink.InkStroke=>({id,color:'#222222',width:3,points:[[0,0,.5],[20,20,1]]});
const pointer=(id:number,x:number,y:number,type='pen')=>({pointerId:id,pointerType:type,clientX:x,clientY:y,pressure:.6,button:0,buttons:1,timeStamp:10});
function fixture(strokes:ink.InkStroke[]=[],path2D=true){
 const doc=new Doc(),root=new Element(doc),observers:{callback:()=>void;disconnected:boolean}[]=[],pathLengths:number[]=[];
 if(!path2D)Reflect.deleteProperty(doc.defaultView,'Path2D');
 class Observer {disconnected=false;constructor(readonly callback:()=>void){observers.push(this);}observe(){}unobserve(){}disconnect(){this.disconnected=true;}}
 Reflect.set(doc.defaultView,'ResizeObserver',Observer);
 const module={exports:{}};let ids=0;
 new Function('require','module','exports','ResizeObserver',transformSync(readFileSync('src/handwriting-view.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{
  if(name==='obsidian')return{setIcon:(element:Element,icon:string)=>element.setAttribute('data-icon',icon)};
  if(name==='./model')return{uid:()=>`new-${++ids}`};if(name==='./handwriting-input')return input;
  if(name==='./handwriting-ink-edit')return inkEdit;if(name==='./ink-path-cache')return{InkPathCache};if(name==='./ink-selection-actions')return inkActions;
  if(name==='./visible-ink-path')return visibleInk;
  if(name==='./board-chrome')return{bindBoardHostInset};
  if(name==='./ink-model')return{...ink,strokePath:(value:ink.InkStroke)=>{pathLengths.push(value.points.length);return ink.strokePath(value);}};
  throw Error(`Unexpected dependency ${name}`);
 },module,module.exports,Observer);
 const View=(module.exports as {HandwritingView:new(root:HTMLElement,host:HandwritingHost)=>HandwritingView}).HandwritingView;
 let board:Board={version:3,presentation:'handwriting',nodes:[],edges:[],viewport:{x:60,y:60,zoom:1},ink:{version:1,strokes}},key:unknown={},readOnly=false;
 const commits:ink.InkStroke[]=[],erases:readonly string[][]=[],edits:inkEdit.InkEdit[]=[],cameras:{viewport:Board['viewport'];persist:boolean}[]=[],notices:string[]=[],undos:boolean[]=[];
 let view:HandwritingView;
 const host:HandwritingHost={snapshot:()=>({key,board,readOnly}),commitStroke:(value,owner)=>{assert.equal(owner,key);commits.push(value);board.ink!.strokes.push(value);view.refresh();},commitErase:(ids,owner)=>{assert.equal(owner,key);(erases as string[][]).push([...ids]);board.ink!.strokes=board.ink!.strokes.filter(value=>!ids.includes(value.id));view.refresh();},camera:(viewport,owner,persist)=>{assert.equal(owner,key);assert.equal(persist,true);board.viewport={...viewport};cameras.push({viewport:{...viewport},persist});view.refresh();},undo:redo=>{undos.push(redo);},notice:message=>{notices.push(message);}};
 view=new View(root as unknown as HTMLElement,host);
 const stage=root.all().find(element=>element.classes.has('ts-handwriting-stage'))!,svg=root.all().find(element=>element.tag==='svg')!;
 const button=(label:string)=>{const value=root.all().find(element=>element.tag==='button'&&element.getAttribute('aria-label')===label);assert.ok(value,label);return value;};
 const controller=Reflect.get(view,'controller') as input.HandwritingInputController;
 const editable=()=>{host.commitInk=(edit,owner,expectedInk)=>{assert.equal(owner,key);assert.equal(board.ink,expectedInk);edits.push(edit);board.ink=inkEdit.applyInkEdit(expectedInk,edit);view.refresh();};};
 return{view,doc,root,stage,svg,button,controller,commits,erases,edits,editable,cameras,notices,undos,pathLengths,observers,get board(){return board;},replaceBoard:(value:Board)=>{board=value;},setReadonly:(value:boolean)=>{readOnly=value;},switchKey:()=>{key={};}};
}
const world=(f:ReturnType<typeof fixture>)=>f.root.all().find(element=>element.classes.has('ts-handwriting-world'))!;
function sharedFixture(){
 const a=fixture(),b=fixture(),shared=a.board,key={},frames=[a,b];
 for(const f of frames){
  const host=Reflect.get(f.view,'host') as HandwritingHost;
  host.snapshot=()=>({key,board:shared,readOnly:false});
  host.camera=(viewport,owner,persist)=>{assert.equal(owner,key);assert.equal(persist,true);shared.viewport={...viewport};f.cameras.push({viewport:{...viewport},persist});for(const view of frames)view.view.refresh();};
  host.commitStroke=(stroke,owner)=>{assert.equal(owner,key);f.commits.push(stroke);shared.ink!.strokes.push(stroke);for(const view of frames)view.view.refresh();};
  f.view.refresh();
 }
 return{a,b,shared,dispose:()=>{a.view.dispose();b.view.dispose();}};
}

test('footer host inset remains stable after resize without dropping live ink or saving the camera',()=>{
 const f=fixture([stroke()]),shell=f.root.all().find(element=>element.classes.has('ts-handwriting'))!,footer=f.root.all().find(element=>element.classes.has('ts-handwriting-footer'))!;
 shell.rect={left:44,top:84,width:346,height:760};footer.rect={left:44,top:812,width:346,height:32};
 const camera={...f.board.viewport},saved=JSON.stringify(f.board.ink);
 f.controller.down(pointer(1,100,100));f.controller.move(pointer(1,120,120));f.doc.frame();
 f.doc.statusBar=new Element(f.doc);f.doc.statusBar.rect={left:62.5625,top:817,width:327.4375,height:27};
 f.doc.defaultView.fire('resize');f.doc.frame();assert.equal(shell.style.getPropertyValue('--ts-host-bottom-inset'),'27px');
 // Model the resulting CSS margin in measured layout, then run the existing
 // stage resize path. The real helper still computes from the fixed shell.
 footer.rect.top-=27;f.stage.rect.height-=27;f.observers[0].callback();
 for(let count=0;count<5;count++){f.observers[1].callback();f.doc.frame();assert.equal(shell.style.getPropertyValue('--ts-host-bottom-inset'),'27px');}
 assert.ok(Reflect.get(f.view,'draft'));assert.ok(f.stage.captures.has(1));assert.deepEqual(f.board.viewport,camera);assert.equal(f.cameras.length,0);assert.equal(JSON.stringify(f.board.ink),saved);assert.equal(f.commits.length,0);
 f.controller.move(pointer(1,140,140));f.controller.up({...pointer(1,160,160),buttons:0});
 assert.equal(f.commits.length,1);assert.deepEqual(f.commits[0].points,[[40,40,.6],[60,60,.6],[80,80,.6],[100,100,.6]]);assert.deepEqual(f.board.viewport,camera);assert.equal(f.cameras.length,0);
 f.doc.statusBar.hidden=true;f.observers[1].callback();f.doc.frame();assert.equal(shell.style.getPropertyValue('--ts-host-bottom-inset'),'0px');
 f.doc.statusBar.hidden=false;f.doc.statusBar.rect.left=400;f.observers[1].callback();f.doc.frame();assert.equal(shell.style.getPropertyValue('--ts-host-bottom-inset'),'0px','unrelated panes do not reserve space');
 f.observers[1].callback();assert.equal(f.doc.frames.size,1);f.view.dispose();assert.equal(f.doc.frames.size,0);assert.equal(shell.style.getPropertyValue('--ts-host-bottom-inset'),'');assert.ok(f.observers.every(observer=>observer.disconnected));assert.equal(f.doc.defaultView.listeners.get('resize')?.size,0);assert.equal(f.doc.defaultView.visualViewport.listeners.get('resize')?.size,0);
});

test('handwriting defaults to pen and reuses saved SVG paths on camera and unrelated refreshes',()=>{
 const f=fixture([stroke()]);assert.equal(f.button('笔').getAttribute('aria-pressed'),'true');assert.equal(f.root.classes.has('ts-handwriting-board'),true);
 const saved=f.svg.children.find(element=>element.getAttribute('data-ink-id')==='saved')!;assert.equal(saved.attributeWrites.get('d'),1);
 f.board.viewport={x:10,y:20,zoom:.5};f.view.refresh();f.view.refresh();assert.equal(saved.attributeWrites.get('d'),1);
 f.board.ink!.strokes[0]={...stroke(),color:'#315e9b'};f.view.refresh();assert.equal(saved.attributeWrites.get('d'),1);assert.equal(saved.getAttribute('fill'),'#315e9b');
 f.board.ink!.strokes=[];f.view.refresh();assert.ok(!f.svg.children.includes(saved));f.view.dispose();f.view.dispose();assert.ok(!f.root.classes.has('ts-handwriting-board'));
});

test('draft frames draw only new one/two-point pieces and commit one complete world-coordinate stroke',()=>{
 const f=fixture();f.controller.down(pointer(1,60,60));f.controller.move(pointer(1,70,80));f.doc.frame();const before=f.doc.fills.length;
 assert.ok(before>0);assert.ok(f.pathLengths.every(length=>length<=2));assert.equal(f.commits.length,0);
 f.controller.move(pointer(1,80,90));f.doc.frame();assert.equal(f.doc.fills.length-before,1);assert.ok(f.pathLengths.every(length=>length<=2));
 f.controller.up({...pointer(1,90,100),buttons:0});assert.equal(f.commits.length,1);assert.deepEqual(f.commits[0].points[0],[0,0,.6]);assert.deepEqual(f.commits[0].points.at(-1),[30,40,.6]);assert.equal(f.doc.frames.size,0);f.view.dispose();
});

test('readonly, board replacement, blur and disposal cancel drafts without writes',()=>{
 for(const reason of ['readonly','board','key','blur','dispose']){
  const f=fixture();f.controller.down(pointer(1,65,65));f.controller.move(pointer(1,75,75));
  if(reason==='readonly'){f.setReadonly(true);f.view.refresh();}
  if(reason==='board'){f.replaceBoard({...f.board,ink:{version:1,strokes:[]}});f.view.refresh();}
  if(reason==='key')f.switchKey();
  if(reason==='blur')f.doc.defaultView.fire('blur');
  if(reason==='dispose')f.view.dispose();
  f.controller.up({...pointer(1,80,80),buttons:0});f.doc.frame();assert.equal(f.commits.length,0,reason);assert.equal(f.doc.frames.size,0,reason);f.view.dispose();
 }
});

test('two-finger navigation previews only the local camera and persists once without writing ink',()=>{
 const f=fixture();f.controller.down(pointer(1,100,100,'touch'));f.controller.move(pointer(1,120,120,'touch'));f.doc.frame();assert.equal(f.cameras.length,0);
 f.controller.down(pointer(2,200,100,'touch'));f.controller.move(pointer(2,250,110,'touch'));f.doc.frame();assert.equal(f.cameras.length,0);assert.deepEqual(f.board.viewport,{x:60,y:60,zoom:1});assert.notEqual(world(f).style.transform,'translate(60px, 60px) scale(1)');assert.equal(f.commits.length,0);
 f.controller.up({...pointer(2,250,110,'touch'),buttons:0});f.controller.up({...pointer(1,120,120,'touch'),buttons:0});assert.equal(f.cameras.filter(value=>value.persist).length,1);f.view.dispose();
});

test('eraser, undo and fit use explicit host transactions while mixed content is preserved',()=>{
 const f=fixture([stroke()]);f.board.nodes.push({id:'note',kind:'card',file:'Note.md',x:0,y:0,width:200,height:160,color:'sand'});f.view.refresh();
 assert.ok(f.root.all().some(element=>element.classes.has('ts-handwriting-mixed')&&!element.hidden));
 f.button('整笔擦除').fire('click');f.controller.down(pointer(1,70,70));f.controller.up({...pointer(1,70,70),buttons:0});assert.deepEqual(f.erases,[['saved']]);assert.equal(f.board.nodes.length,1);
 f.button('撤销').fire('click');f.button('重做').fire('click');assert.deepEqual(f.undos,[false,true]);
 f.board.ink!.strokes=[stroke()];f.view.refresh();f.view.fit();assert.equal(f.cameras.at(-1)?.persist,true);assert.ok(f.board.viewport.zoom>=.15&&f.board.viewport.zoom<=2.5);f.view.dispose();
});

test('SVG fallback adds only new draft pieces and clears them on commit',()=>{
 const f=fixture([],false);f.controller.down(pointer(1,60,60));f.controller.move(pointer(1,70,70));f.doc.frame();
 const group=f.svg.children.find(element=>element.tag==='g')!,first=group.children[0];assert.equal(group.children.length,1);assert.ok(f.pathLengths.every(length=>length<=2));
 f.controller.move(pointer(1,80,80));f.doc.frame();assert.equal(group.children.length,2);assert.equal(first.attributeWrites.get('d'),1);assert.ok(f.pathLengths.every(length=>length<=2));
 f.controller.up({...pointer(1,90,90),buttons:0});assert.equal(group.children.length,0);assert.equal(f.commits.length,1);f.view.dispose();
});

test('a sparse eraser path removes a crossed stroke even when both event endpoints miss',()=>{
 const value:ink.InkStroke={id:'crossed',color:'#222222',width:3,points:[[-30,0,1],[30,0,1]]},f=fixture([value]);
 f.button('整笔擦除').fire('click');f.controller.down(pointer(1,60,-40));f.controller.up({...pointer(1,60,160),buttons:0});
 assert.deepEqual(f.erases,[['crossed']]);f.view.dispose();
});

test('keyboard history cancels the draft and respects readonly state',()=>{
 const f=fixture();f.controller.down(pointer(1,60,60));f.controller.move(pointer(1,70,70));
 f.stage.fire('keydown',{key:'z',ctrlKey:true,shiftKey:false,isComposing:false,defaultPrevented:false});f.controller.up({...pointer(1,80,80),buttons:0});
 assert.equal(f.commits.length,0);assert.deepEqual(f.undos,[false]);assert.equal(f.doc.frames.size,0);
 f.stage.fire('keydown',{key:'z',metaKey:true,shiftKey:true,isComposing:false,defaultPrevented:false});assert.deepEqual(f.undos,[false,true]);
 f.setReadonly(true);f.view.refresh();f.stage.fire('keydown',{key:'y',ctrlKey:true,isComposing:false,defaultPrevented:false});assert.deepEqual(f.undos,[false,true]);assert.equal(f.button('撤销').disabled,true);f.view.dispose();
});

test('accepted mouse and pen downs focus the stage so focused Escape cancels the draft',()=>{
 for(const type of ['mouse','pen']){
  const f=fixture();f.stage.fire('pointerdown',pointer(1,60,60,type));assert.equal(f.doc.activeElement,f.stage);assert.deepEqual(f.doc.focusOptions,[{preventScroll:true}]);
  f.stage.fire('pointermove',pointer(1,80,80,type));f.doc.keydown('Escape');f.stage.fire('pointerup',{...pointer(1,90,90,type),buttons:0});
  assert.equal(f.commits.length,0,type);assert.equal(f.doc.frames.size,0,type);f.view.dispose();
 }
});

test('touches, readonly, and ignored mouse downs preserve the current keyboard focus',()=>{
 for(const kind of ['touch','readonly','right','middle','control','unknown']){
  const f=fixture(),focus=f.button('笔');focus.focus();f.doc.focusOptions=[];
  if(kind==='readonly'){f.setReadonly(true);f.view.refresh();}
  const event={...pointer(1,60,60,kind==='touch'?'touch':kind==='unknown'?'other':'mouse'),button:kind==='right'?2:kind==='middle'?1:0,ctrlKey:kind==='control'};
  f.stage.fire('pointerdown',event);assert.equal(f.doc.activeElement,focus,kind);assert.deepEqual(f.doc.focusOptions,[],kind);f.view.dispose();
 }
});

test('document release observes held touch IDs without suppressing another view',()=>{
 const f=fixture();f.controller.down(pointer(1,100,100,'touch'));f.controller.down(pointer(2,200,100,'touch'));f.controller.move(pointer(2,230,100,'touch'));f.doc.frame();
 let suppressed=0;const events={preventDefault:()=>{suppressed++;},stopPropagation:()=>{suppressed++;}};
 f.doc.fire('pointerup',{...pointer(2,230,100,'touch'),buttons:0,...events});assert.ok(f.stage.captures.has(1));assert.ok(!f.stage.captures.has(2));
 f.doc.fire('pointerup',{...pointer(1,100,100,'touch'),buttons:0,...events});assert.equal(f.stage.captures.size,0);assert.equal(suppressed,0);assert.equal(f.cameras.filter(value=>value.persist).length,1);f.view.dispose();
});

test('two views keep preview local and share committed camera before interpreting new pen coordinates',()=>{
 const f=sharedFixture(),{a,b,shared}=f;a.button('移动').fire('click');a.controller.down(pointer(1,100,100,'mouse'));a.controller.move(pointer(1,200,100,'mouse'));a.doc.frame();
 assert.deepEqual(shared.viewport,{x:60,y:60,zoom:1});assert.equal(world(a).style.transform,'translate(160px, 60px) scale(1)');assert.equal(world(b).style.transform,'translate(60px, 60px) scale(1)');
 b.controller.down(pointer(2,60,60));b.controller.up({...pointer(2,60,60),buttons:0});assert.deepEqual(shared.ink!.strokes[0].points,[[0,0,.6]]);
 assert.equal(world(a).style.transform,'translate(160px, 60px) scale(1)','save feedback keeps the active local preview');
 a.controller.up({...pointer(1,200,100,'mouse'),buttons:0});assert.deepEqual(shared.viewport,{x:160,y:60,zoom:1});assert.equal(world(b).style.transform,'translate(160px, 60px) scale(1)');assert.equal(a.cameras.length,1);
 b.controller.down(pointer(3,60,60));b.controller.up({...pointer(3,60,60),buttons:0});assert.deepEqual(shared.ink!.strokes[1].points,[[-100,0,.6]]);assert.deepEqual(a.undos,[]);assert.deepEqual(b.undos,[]);f.dispose();
});

test('a foreign camera commit cancels an ink draft before the visible world moves',()=>{
 const f=sharedFixture(),{a,b,shared}=f;b.controller.down(pointer(2,60,60));b.controller.move(pointer(2,70,70));b.doc.frame();
 a.button('移动').fire('click');a.controller.down(pointer(1,100,100,'mouse'));a.controller.move(pointer(1,200,100,'mouse'));a.doc.frame();a.controller.up({...pointer(1,200,100,'mouse'),buttons:0});
 b.controller.up({...pointer(2,80,80),buttons:0});assert.equal(shared.ink!.strokes.length,0);assert.equal(b.doc.frames.size,0);assert.equal(world(b).style.transform,'translate(160px, 60px) scale(1)');f.dispose();
});

test('foreign camera commits discard another local preview without restoring or overwriting shared camera',()=>{
 const f=sharedFixture(),{a,b,shared}=f;
 for(const [index,view]of [a,b].entries()){view.button('移动').fire('click');view.controller.down(pointer(index+1,100,100,'mouse'));view.controller.move(pointer(index+1,index?130:200,100,'mouse'));view.doc.frame();}
 assert.equal(world(b).style.transform,'translate(90px, 60px) scale(1)');a.controller.up({...pointer(1,200,100,'mouse'),buttons:0});
 assert.equal(world(b).style.transform,'translate(160px, 60px) scale(1)');b.controller.up({...pointer(2,130,100,'mouse'),buttons:0});assert.deepEqual(shared.viewport,{x:160,y:60,zoom:1});assert.equal(b.cameras.length,0);
 b.doc.defaultView.fire('blur');assert.deepEqual(shared.viewport,{x:160,y:60,zoom:1});f.dispose();
});

for(const path2D of [true,false])test(`resize completely redraws the active ${path2D?'canvas':'SVG'} draft and preserves its camera`,()=>{
 const f=fixture([],path2D);f.controller.down(pointer(1,60,60));f.controller.move(pointer(1,80,90));f.doc.frame();const before=f.doc.fills.length;
 f.stage.rect={left:20,top:40,width:390,height:600};f.observers[0].callback();assert.equal(f.commits.length,0);assert.ok(f.stage.captures.has(1));assert.deepEqual(f.board.viewport,{x:60,y:60,zoom:1});
 if(path2D)assert.equal(f.doc.fills.length-before,2,'a resized bitmap must redraw every sampled draft piece');
 else{const group=f.svg.children.find(element=>element.tag==='g')!;assert.equal(group.children.length,1);assert.ok(group.children[0].getAttribute('d'));}
 assert.equal(world(f).style.transform,'translate(60px, 60px) scale(1)');
 f.controller.up({...pointer(1,110,150),buttons:0});assert.deepEqual(f.commits[0].points.map(([x,y])=>[x,y]),[[0,0],[20,30],[30,50]]);f.view.dispose();
});

test('visualViewport resize, scroll and DPR changes retain a draft and remove all viewport listeners on dispose',()=>{
 const f=fixture();f.controller.down(pointer(1,60,60));f.controller.move(pointer(1,70,70));f.doc.frame();const viewport=f.doc.defaultView.visualViewport;
 f.stage.rect.left=10;f.stage.rect.top=20;viewport.fire('scroll');assert.ok(f.stage.captures.has(1));assert.equal(f.commits.length,0);
 f.stage.rect.height=280;f.doc.defaultView.devicePixelRatio=3;viewport.fire('resize');const canvas=f.root.all().find(element=>element.tag==='canvas')!;assert.equal(canvas.height,840);assert.ok(f.doc.fills.length>=4);
 f.controller.up({...pointer(1,90,100),buttons:0});assert.equal(f.commits.length,1);assert.deepEqual(f.commits[0].points.at(-1),[20,20,.6]);
 f.view.dispose();assert.equal(viewport.listeners.get('resize')?.size,0);assert.equal(viewport.listeners.get('scroll')?.size,0);
});

test('layout changes retain a local pinch preview and terminal release shares it exactly once',()=>{
 const f=fixture();f.controller.down(pointer(1,100,100,'touch'));f.controller.down(pointer(2,200,100,'touch'));f.controller.move(pointer(2,240,100,'touch'));f.doc.frame();const camera=world(f).style.transform;
 f.stage.rect.width=360;f.stage.rect.height=260;f.observers[0].callback();assert.equal(world(f).style.transform,camera);assert.equal(f.cameras.length,0);assert.equal(f.stage.captures.size,2);
 f.controller.up({...pointer(2,240,100,'touch'),buttons:0});f.controller.up({...pointer(1,100,100,'touch'),buttons:0});assert.equal(world(f).style.transform,camera);assert.equal(f.cameras.length,1);f.view.dispose();
});

test('finger writing has an explicit view-only switch and keeps two-finger navigation available',()=>{
 const f=fixture(),button=f.button('手指书写');assert.equal(button.getAttribute('aria-pressed'),'false');assert.match(button.title as string,/关闭.*避免/);
 f.stage.fire('pointerdown',pointer(1,60,60,'touch'));f.stage.fire('pointerup',{...pointer(1,60,60,'touch'),buttons:0});assert.equal(f.commits.length,0);
 button.fire('click');assert.equal(button.getAttribute('aria-pressed'),'true');assert.match(f.stage.getAttribute('aria-label')!,/单指/);
 f.stage.fire('pointerdown',pointer(1,60,60,'touch'));f.stage.fire('pointermove',pointer(1,80,80,'touch'));f.stage.fire('pointerup',{...pointer(1,90,90,'touch'),buttons:0});assert.equal(f.commits.length,1);
 f.setReadonly(true);f.view.refresh();assert.equal(button.disabled,true);const reopened=fixture();assert.equal(reopened.button('手指书写').getAttribute('aria-pressed'),'false');assert.ok(!('fingerWriting'in f.board));f.view.dispose();reopened.view.dispose();
});

function selectFixture(zoom=1,type='pen'){
 const f=fixture([stroke('a'),{...stroke('b'),points:[[200,200,.5]]}]);f.editable();f.board.viewport={x:60,y:60,zoom};f.view.refresh();f.button('套索选笔迹').fire('click');
 const p=(id:number,x:number,y:number)=>pointer(id,60+x*zoom,60+y*zoom,type);
 f.controller.down(p(1,-8,-8));for(const [x,y]of [[30,-8],[30,30],[-8,30],[-8,-8]])f.controller.move(p(1,x,y));f.controller.up({...p(1,-8,-8),buttons:0});
 assert.equal(f.edits.length,0);assert.equal(f.svg.children.find(e=>e.getAttribute('data-ink-id')==='a')?.getAttribute('data-ink-selected'),'true');
 assert.equal(f.svg.children.find(e=>e.getAttribute('data-ink-id')==='b')?.getAttribute('data-ink-selected'),'false');return{f,p};
}

for(const zoom of [.15,1,2.5])test(`lasso selects and previews one exact world translation at zoom ${zoom}`,()=>{
 const {f,p}=selectFixture(zoom);const before=JSON.stringify(f.board.ink),unchanged=f.board.ink!.strokes[1];
 f.controller.down(p(2,10,10));f.controller.move(p(2,30,50));f.doc.frame();assert.equal(JSON.stringify(f.board.ink),before);
 assert.equal(f.svg.children.find(e=>e.getAttribute('data-ink-id')==='a')?.getAttribute('transform'),'translate(20 40)');
 f.controller.up({...p(2,30,50),buttons:0});assert.equal(f.edits.length,1);assert.deepEqual(f.edits[0],{kind:'translate',ids:['a'],dx:20,dy:40});
 assert.deepEqual(f.board.ink!.strokes[0].points,[[20,40,.5],[40,60,1]]);assert.equal(f.board.ink!.strokes[1],unchanged);assert.equal(f.stage.captures.size,0);f.view.dispose();
});

for(const boundary of ['cancel','lostCapture','escape','tool','resize','zero-size','owner','readonly','ink-replaced','blur','dispose'])test(`selection move ${boundary} restores preview without a transaction`,()=>{
 const {f,p}=selectFixture();const original=f.board.ink,source=JSON.stringify(original);f.controller.down(p(2,10,10));f.controller.move(p(2,30,50));f.doc.frame();
 if(boundary==='cancel')f.controller.cancel(p(2,30,50));
 if(boundary==='lostCapture')f.controller.lostCapture(p(2,30,50));
 if(boundary==='escape')f.stage.fire('keydown',{key:'Escape',isComposing:false,defaultPrevented:false});
 if(boundary==='tool')f.button('笔').fire('click');
 if(boundary==='resize'||boundary==='zero-size'){f.stage.rect={left:10,top:20,width:boundary==='zero-size'?0:390,height:844};f.observers[0].callback();}
 if(boundary==='owner')f.switchKey();
 if(boundary==='readonly'){f.setReadonly(true);f.view.refresh();}
 if(boundary==='ink-replaced'){f.board.ink={...original!,strokes:[...original!.strokes,stroke('foreign')]};f.view.refresh();}
 if(boundary==='blur')f.doc.defaultView.fire('blur');
 if(boundary==='dispose')f.view.dispose();
 f.controller.up({...p(2,50,70),buttons:0});f.doc.frame();assert.equal(f.edits.length,0,boundary);assert.equal(JSON.stringify(original),source);assert.equal(f.stage.captures.size,0);f.view.dispose();
});

test('explicit single-finger lasso works with finger writing off and second finger cancels move before camera navigation',()=>{
 const {f,p}=selectFixture(1,'touch');assert.equal(f.button('手指书写').getAttribute('aria-pressed'),'false');const source=JSON.stringify(f.board.ink);
 f.controller.down(p(2,10,10));f.controller.move(p(2,30,40));f.doc.frame();f.controller.down(p(3,110,10));f.controller.move(p(3,160,10));f.doc.frame();
 f.controller.up({...p(3,160,10),buttons:0});f.controller.up({...p(2,30,40),buttons:0});assert.equal(f.edits.length,0);assert.equal(JSON.stringify(f.board.ink),source);assert.equal(f.cameras.length,1);assert.equal(f.stage.captures.size,0);f.view.dispose();
});

test('selection duplicate and delete each use one command and leave original pressure and mixed content intact',()=>{
 const {f}=selectFixture();const a=f.board.ink!.strokes[0];f.button('复制选中笔迹').fire('click');assert.equal(f.edits.length,1);assert.equal(f.edits[0].kind,'duplicate');assert.equal(f.board.ink!.strokes[0],a);assert.deepEqual(f.board.ink!.strokes[2].points,[[24,24,.5],[44,44,1]]);f.view.dispose();
 const {f:g}=selectFixture();g.button('删除选中笔迹').fire('click');assert.equal(g.edits.length,1);assert.deepEqual(g.board.ink!.strokes.map(stroke=>stroke.id),['b']);g.view.dispose();
});

test('secondary panels expose labeled keyboard controls and cancel a held draft without saving',()=>{
 const f=fixture(),toolbar=f.root.all().find(element=>element.classes.has('ts-handwriting-toolbar'))!;
 assert.deepEqual(toolbar.all().filter(element=>element.tag==='button').map(element=>element.dataset.inkAction),['pen','eraser','undo','pen-settings','more']);
 f.controller.down(pointer(1,60,60));f.controller.move(pointer(1,80,80));f.button('笔设置').fire('click');assert.equal(f.button('笔设置').getAttribute('aria-expanded'),'true');
 f.controller.up({...pointer(1,80,80),buttons:0});assert.equal(f.commits.length,0);
 const panel=f.root.all().find(element=>element.classes.has('ts-handwriting-pen-settings'))!;panel.fire('keydown',{key:'Escape',isComposing:false});assert.equal(panel.hidden,true);assert.equal(f.doc.activeElement,f.button('笔设置'));
 f.stage.fire('keydown',{key:'l',isComposing:false,defaultPrevented:false});assert.equal(f.stage.dataset.tool,'lasso');f.stage.fire('keydown',{key:'b',isComposing:false,defaultPrevented:false});assert.equal(f.stage.dataset.tool,'pen');f.view.dispose();
});

test('choosing a pen setting or secondary tool returns keyboard focus to its visible trigger',()=>{
 const f=fixture();
 f.button('笔设置').fire('click');f.button('蓝色').focus();f.button('蓝色').fire('click');
 assert.equal(f.doc.activeElement,f.button('笔设置'));
 f.button('笔设置').fire('click');const width=f.root.all().find(element=>element.tag==='select')!;width.focus();width.value='5';width.fire('change');
 assert.equal(f.doc.activeElement,f.button('笔设置'));
 f.button('更多').fire('click');f.button('套索选笔迹').focus();f.button('套索选笔迹').fire('click');
 assert.equal(f.doc.activeElement,f.button('更多'));assert.equal(f.stage.dataset.tool,'lasso');
 f.button('更多').fire('click');f.button('手指书写').focus();f.button('手指书写').fire('click');
 assert.equal(f.doc.activeElement,f.button('更多'));f.view.dispose();
});

test('a canvas contact closing a popover retains the existing pen and enabled-finger drawing behavior',()=>{
 for(const type of ['pen','touch']){
  const f=fixture();if(type==='touch')f.button('手指书写').fire('click');
  f.button('笔设置').fire('click');const point=pointer(91,90,90,type);
  f.doc.fire('pointerdown',{...point,target:f.stage});f.stage.fire('pointerdown',{...point,target:f.stage});
  f.stage.fire('pointermove',pointer(91,120,105,type));f.stage.fire('pointerup',{...pointer(91,120,105,type),buttons:0});
  assert.equal(f.button('笔设置').getAttribute('aria-expanded'),'false');assert.equal(f.commits.length,1);f.view.dispose();
 }
});

test('new ink identity rejects a stale pen commit, and mutable same-ID geometry never displays an old cached path',()=>{
 const f=fixture([stroke()]);f.editable();f.controller.down(pointer(1,60,60));f.board.ink={version:1,strokes:[...f.board.ink!.strokes,stroke('other')]};f.view.refresh();f.controller.up({...pointer(1,90,90),buttons:0});assert.equal(f.edits.length,0);
 const path=f.svg.children.find(element=>element.getAttribute('data-ink-id')==='saved')!,before=path.getAttribute('d');f.board.ink.strokes[0].points[0][0]+=10;f.view.refresh();assert.notEqual(path.getAttribute('d'),before);f.view.dispose();
});

test('same-session board replacement reuses old stroke paths through undo and redo',()=>{
 const old=stroke(),f=fixture([old]),cache=Reflect.get(f.view,'pathCache') as InkPathCache,baseline=cache.encodings,original=f.board;
 const next={...original,ink:inkEdit.applyInkEdit(original.ink!,{kind:'translate',ids:['saved'],dx:24,dy:18})};f.replaceBoard(next);f.view.refresh();assert.equal(cache.encodings,baseline+1);
 f.replaceBoard(original);f.view.refresh();assert.equal(cache.encodings,baseline+1);f.replaceBoard(next);f.view.refresh();assert.equal(cache.encodings,baseline+1);
 f.switchKey();f.view.refresh();assert.equal(cache.encodings,baseline+2);f.view.dispose();assert.equal(cache.bytes,0);
});

function stageGesture(f:ReturnType<typeof fixture>,id:number,x:number,y:number,type='mouse'){
 f.stage.fire('pointerdown',pointer(id,x,y,type));f.stage.fire('pointermove',pointer(id,x+30,y+40,type));f.stage.fire('pointerup',{...pointer(id,x+30,y+40,type),buttons:0});f.doc.frame();
}
for(const type of ['mouse','touch','pen'])test(`modal ${type} repeats consume the whole gesture and each down extends the local guard`,()=>{
 const f=fixture();if(type==='touch')f.button('手指书写').fire('click');f.view.suppressPointerRepeat({clientX:60,clientY:60,pointerType:type});
 const listeners=f.doc.listeners.size;f.doc.now+=590;let suppressed=0;f.stage.fire('pointerdown',{...pointer(1,84,60,type),preventDefault:()=>{suppressed++;}});
 assert.equal(suppressed,1);assert.equal(f.stage.captures.size,0);f.stage.fire('pointermove',pointer(1,180,180,type));f.stage.fire('pointerup',{...pointer(1,180,180,type),buttons:0});f.doc.frame();assert.equal(f.commits.length,0);assert.equal(f.cameras.length,0);
 f.doc.now+=590;stageGesture(f,2,60,60,type);assert.equal(f.commits.length,0,'repeat is still guarded after original deadline');assert.equal(f.stage.captures.size,0);assert.equal(f.doc.frames.size,0);assert.equal(f.doc.listeners.size,listeners,'no added document listener');
 f.doc.now+=600;stageGesture(f,3,60,60,type);assert.equal(f.commits.length,1,'first down at expiry is allowed');f.view.dispose();
});

test('repeat suppression cancels an already held draft and ignores its late release',()=>{
 const f=fixture();f.stage.fire('pointerdown',pointer(1,60,60));f.stage.fire('pointermove',pointer(1,80,80));assert.equal(f.stage.captures.size,1);
 f.view.suppressPointerRepeat({clientX:60,clientY:60,pointerType:'pen'});assert.equal(f.stage.captures.size,0);assert.equal(f.doc.frames.size,0);
 f.stage.fire('pointerup',{...pointer(1,90,90),buttons:0});assert.equal(f.commits.length,0);stageGesture(f,2,60,60,'pen');assert.equal(f.commits.length,0);f.view.dispose();
});

for(const boundary of ['location','type','expiry'])test(`a different ${boundary} immediately allows input and clears the repeat guard`,()=>{
 const f=fixture();f.view.suppressPointerRepeat({clientX:60,clientY:60,pointerType:'mouse'});
 if(boundary==='expiry')f.doc.now+=600;
 stageGesture(f,1,boundary==='location'?85:60,60,boundary==='type'?'pen':'mouse');assert.equal(f.commits.length,1);
 stageGesture(f,2,60,60,'mouse');assert.equal(f.commits.length,2,'the old guarded point is now immediately allowed');f.view.dispose();
});

test('same-session board replacement retains repeat protection, but a new exact owner clears it',()=>{
 const f=fixture();f.view.suppressPointerRepeat({clientX:60,clientY:60,pointerType:'mouse'});f.replaceBoard({...f.board,viewport:{...f.board.viewport}});f.view.refresh();stageGesture(f,1,60,60);assert.equal(f.commits.length,0);
 f.switchKey();f.view.refresh();stageGesture(f,2,60,60);assert.equal(f.commits.length,1);f.view.dispose();
});

test('repeat guards never leak to another view or survive readonly ownership handoff',()=>{
 const f=fixture(),other=fixture();f.view.suppressPointerRepeat({clientX:60,clientY:60,pointerType:'mouse'});stageGesture(other,1,60,60);assert.equal(other.commits.length,1);
 f.setReadonly(true);f.view.refresh();stageGesture(f,1,60,60);assert.equal(f.commits.length,0);f.setReadonly(false);f.view.refresh();stageGesture(f,2,60,60);assert.equal(f.commits.length,1);f.view.dispose();other.view.dispose();
});

test('invalid points, absent snapshots and disposed views do not establish repeat protection',()=>{
 for(const invalid of [{clientX:NaN,clientY:60,pointerType:'mouse'},{clientX:60,clientY:Infinity,pointerType:'pen'},{clientX:60,clientY:60,pointerType:''},{clientX:60,clientY:60,pointerType:'keyboard'}]){
  const f=fixture();f.view.suppressPointerRepeat(invalid);stageGesture(f,1,60,60);assert.equal(f.commits.length,1);f.view.dispose();
 }
 const f=fixture(),host=Reflect.get(f.view,'host') as HandwritingHost,snapshot=host.snapshot;host.snapshot=()=>undefined;f.view.suppressPointerRepeat({clientX:60,clientY:60,pointerType:'mouse'});host.snapshot=snapshot;stageGesture(f,1,60,60);assert.equal(f.commits.length,1);
 f.view.dispose();f.view.suppressPointerRepeat({clientX:60,clientY:60,pointerType:'mouse'});assert.equal(Reflect.get(f.view,'pointerRepeat'),undefined);assert.equal(f.stage.listeners.get('pointerdown')?.size,0);
});

const selectionBar=(f:ReturnType<typeof fixture>)=>f.root.all().find(element=>element.classes.has('ts-handwriting-selection-actions'))!;
function nearbyPress(f:ReturnType<typeof fixture>,kind:'duplicate'|'remove'|'cancel',type='mouse',id=40){
 const bar=selectionBar(f),button=bar.all().find(element=>element.dataset.inkAction===`${kind}-nearby-selection`)!;
 assert.ok(button);const x=f.stage.rect.left+Number.parseFloat(String(bar.style.left))+24,y=f.stage.rect.top+Number.parseFloat(String(bar.style.top))+24,point={...pointer(id,x,y,type),target:button};
 f.doc.fire('pointerdown',point);bar.fire('pointerdown',point);
 return{bar,button,point,release:()=>{f.doc.fire('pointerup',{...point,buttons:0});bar.fire('pointerup',{...point,buttons:0});},click:()=>button.fire('click',{detail:1,target:button,clientX:x,clientY:y})};
}

test('nearby actions appear only for an editable lasso selection and never add main toolbar buttons',()=>{
 const empty=fixture(),bar=selectionBar(empty);assert.equal(bar.hidden,true);empty.view.dispose();
 const {f}=selectFixture();assert.equal(selectionBar(f).hidden,false);assert.deepEqual(selectionBar(f).all().filter(element=>element.tag==='button').map(element=>element.getAttribute('aria-label')),['复制','删除','取消']);
 const toolbar=f.root.all().find(element=>element.classes.has('ts-handwriting-toolbar'))!;assert.equal(toolbar.all().filter(element=>element.tag==='button').length,5);
 f.button('更多').fire('click');assert.equal(selectionBar(f).hidden,true);f.button('更多').fire('click');assert.equal(selectionBar(f).hidden,false);
 f.button('笔').fire('click');assert.equal(selectionBar(f).hidden,true);f.view.dispose();
});

for(const zoom of [.15,1,2.5])for(const kind of ['duplicate','remove','cancel'] as const)test(`nearby ${kind} at ${zoom} commits exactly once or cancels without any write`,()=>{
 const {f}=selectFixture(zoom),before=JSON.stringify(f.board.ink),original=f.board.ink!.strokes[0];
 f.board.nodes.push({id:'mixed',kind:'card',file:'Native.md',x:1,y:2,width:100,height:90,color:'sand'});f.board.edges.push({id:'mixed-edge',from:'mixed',to:'mixed',label:'原生引用'});Reflect.set(f.board.ink!.strokes[0],'extension',{preserved:true});
 const mixed=JSON.stringify([f.board.nodes,f.board.edges]),originalPoints=JSON.stringify(original.points),gesture=nearbyPress(f,kind,'pen');
 assert.equal(f.stage.captures.size,0);assert.equal(f.edits.length,0);assert.equal(f.commits.length,0);assert.equal(f.doc.activeElement,gesture.button);
 gesture.release();gesture.click();assert.equal(selectionBar(f).hidden,true);assert.equal(f.doc.activeElement,f.stage);assert.equal(f.cameras.length,0);
 assert.equal(f.edits.length,kind==='cancel'?0:1);assert.equal(JSON.stringify([f.board.nodes,f.board.edges]),mixed);assert.equal(JSON.stringify(original.points),originalPoints);
 if(kind==='duplicate'){assert.equal(f.board.ink!.strokes.length,3);assert.deepEqual(f.board.ink!.strokes[2].points,[[24,24,.5],[44,44,1]]);assert.deepEqual(Reflect.get(f.board.ink!.strokes[2],'extension'),{preserved:true});}
 if(kind==='remove')assert.deepEqual(f.board.ink!.strokes.map(value=>value.id),['b']);
 if(kind==='cancel')assert.equal(JSON.stringify({...f.board.ink,strokes:f.board.ink!.strokes.map(value=>{const copy={...value};Reflect.deleteProperty(copy,'extension');return copy;})}),before);
 gesture.click();assert.equal(f.edits.length,kind==='cancel'?0:1,'cached hidden button cannot execute again');f.view.dispose();
});

for(const type of ['mouse','touch','pen'])for(const kind of ['duplicate','remove','cancel'] as const)test(`disappearing nearby ${kind} consumes same-point ${type} repeat without ink, capture or pan`,()=>{
 const {f}=selectFixture(),gesture=nearbyPress(f,kind,type);gesture.release();gesture.click();const source=JSON.stringify(f.board.ink),edits=f.edits.length;
 f.stage.fire('pointerdown',{...gesture.point,pointerId:42,target:f.stage});f.stage.fire('pointermove',{...gesture.point,pointerId:42,clientX:gesture.point.clientX+50,clientY:gesture.point.clientY+60,target:f.stage});f.stage.fire('pointerup',{...gesture.point,pointerId:42,buttons:0,target:f.stage});
 assert.equal(JSON.stringify(f.board.ink),source);assert.equal(f.edits.length,edits);assert.equal(f.commits.length,0);assert.equal(f.cameras.length,0);assert.equal(f.stage.captures.size,0);assert.equal(f.doc.frames.size,0);f.view.dispose();
});

for(const boundary of ['pointercancel','drag','terminal-drag','resize','visible-scroll','visible-keyboard','camera','ink','owner','same-key-board','readonly','tool','blur','menu','external-dialog','focus-dialog','keyboard-dialog','held-stage-touch','second-action-touch','dispose'])test(`nearby delete rejects a ${boundary} action pressed on an earlier selection`,()=>{
 const {f,p}=selectFixture(),original=f.board.ink!,source=JSON.stringify(original),gesture=nearbyPress(f,'remove','touch');
 if(boundary==='pointercancel')f.doc.fire('pointercancel',gesture.point);
 if(boundary==='drag')gesture.bar.fire('pointermove',{...gesture.point,clientX:gesture.point.clientX+30});
 if(boundary==='terminal-drag')f.doc.fire('pointerup',{...gesture.point,clientY:gesture.point.clientY+30,buttons:0});
 if(boundary==='resize'){f.stage.rect.width=390;f.observers[0].callback();}
 if(boundary==='visible-scroll'){f.doc.defaultView.visualViewport.offsetTop=10;f.doc.defaultView.visualViewport.fire('scroll');}
 if(boundary==='visible-keyboard'){f.doc.defaultView.visualViewport.height=300;f.doc.defaultView.visualViewport.fire('resize');}
 if(boundary==='camera'){f.board.viewport={...f.board.viewport,x:75};f.view.refresh();}
 if(boundary==='ink'){f.board.ink={version:1,strokes:[...original.strokes,stroke('foreign')]};f.view.refresh();}
 if(boundary==='owner'){f.switchKey();f.view.refresh();}
 if(boundary==='same-key-board'){f.replaceBoard({...f.board});f.view.refresh();}
 if(boundary==='readonly'){f.setReadonly(true);f.view.refresh();}
 if(boundary==='tool')f.button('笔').fire('click');
 if(boundary==='blur')f.doc.defaultView.fire('blur');
 if(boundary==='menu')f.button('更多').fire('click');
 if(boundary==='external-dialog')f.doc.fire('pointerdown',{...pointer(91,500,200,'mouse'),target:new Element(f.doc)});
 if(boundary==='focus-dialog')f.doc.fire('focusin',{target:new Element(f.doc,'input')});
 if(boundary==='keyboard-dialog')f.doc.fire('keydown',{key:'o',metaKey:true,target:gesture.button});
 if(boundary==='held-stage-touch'){
  const other={...p(44,10,10),target:f.stage};f.doc.fire('pointerdown',other);f.stage.fire('pointerdown',other);f.stage.fire('pointermove',{...other,clientX:120,clientY:130});f.doc.fire('pointerup',{...other,buttons:0});f.stage.fire('pointerup',{...other,buttons:0});
 }
 if(boundary==='second-action-touch'){const other={...gesture.point,pointerId:44};f.doc.fire('pointerdown',other);gesture.bar.fire('pointerdown',other);f.doc.fire('pointerup',{...other,buttons:0});}
 if(boundary==='dispose')f.view.dispose();
 gesture.release();gesture.click();f.doc.frame();assert.equal(f.edits.length,0,boundary);assert.equal(f.commits.length,0,boundary);assert.equal(JSON.stringify(original),source,boundary);assert.equal(f.stage.captures.size,0);f.view.dispose();
});

test('nearby controls intercept padding and button downs and do not pass control events to the ink controller',()=>{
 const {f}=selectFixture(),bar=selectionBar(f);let prevented=0,stopped=0;
 bar.fire('pointerdown',{...pointer(40,50,100,'pen'),target:bar,preventDefault:()=>prevented++,stopPropagation:()=>stopped++});
 f.stage.fire('pointerdown',{...pointer(40,50,100,'pen'),target:bar,preventDefault:()=>prevented++,stopPropagation:()=>stopped++});
 assert.equal(prevented,2);assert.equal(stopped,2);assert.equal(f.stage.captures.size,0);assert.equal(f.doc.frames.size,0);assert.equal(f.edits.length,0);f.view.dispose();
});

test('native DOMRect prototype accessors remain exact in the action basis, and accept one matching release',()=>{
 const {f}=selectFixture(),prototype=Object.fromEntries(Object.entries(f.stage.rect).map(([key,value])=>[key,{get:()=>value,enumerable:false}]));
 Reflect.set(f.stage,'getBoundingClientRect',()=>Object.create(Object.defineProperties({},prototype)));
 const gesture=nearbyPress(f,'remove','mouse');gesture.release();gesture.click();assert.equal(f.edits.length,1);assert.deepEqual(f.board.ink!.strokes.map(value=>value.id),['b']);assert.equal(selectionBar(f).hidden,true);f.view.dispose();
});

test('nearby actions support native keyboard activation, arrow navigation and Escape focus cleanup',()=>{
 const {f}=selectFixture(),bar=selectionBar(f),buttons=bar.all().filter(element=>element.tag==='button');buttons[0].focus();
 bar.fire('keydown',{key:'ArrowRight',defaultPrevented:false,isComposing:false});assert.equal(f.doc.activeElement,buttons[1]);bar.fire('keydown',{key:'End',defaultPrevented:false,isComposing:false});assert.equal(f.doc.activeElement,buttons[2]);
 bar.fire('keydown',{key:'Home',defaultPrevented:false,isComposing:false});assert.equal(f.doc.activeElement,buttons[0]);bar.fire('keydown',{key:'ArrowLeft',defaultPrevented:false,isComposing:false});assert.equal(f.doc.activeElement,buttons[2]);
 const source=JSON.stringify(f.board.ink);bar.fire('keydown',{key:'Escape',defaultPrevented:false,isComposing:false});assert.equal(bar.hidden,true);assert.equal(f.doc.activeElement,f.stage);assert.equal(JSON.stringify(f.board.ink),source);assert.equal(f.edits.length,0);f.view.dispose();
 const {f:g}=selectFixture(),copy=selectionBar(g).all().find(element=>element.dataset.inkAction==='duplicate-nearby-selection')!;copy.focus();copy.fire('click',{detail:0});assert.equal(g.edits.length,1);assert.equal(g.doc.activeElement,g.stage);assert.equal(selectionBar(g).hidden,true);g.view.dispose();
});

test('context layout uses this view window, safe area and visible keyboard bounds; offscreen and tiny stages hide',()=>{
 const {f}=selectFixture(),bar=selectionBar(f),viewport=f.doc.defaultView.visualViewport;
 f.stage.rect={left:50,top:80,width:390,height:600};Object.assign(viewport,{offsetLeft:40,offsetTop:100,width:430,height:300});
 Reflect.set(f.doc.defaultView,'getComputedStyle',()=>({getPropertyValue:(key:string)=>key.endsWith('-top')?'20px':key.endsWith('-bottom')?'25px':'0px'}));f.observers[0].callback();
 assert.equal(bar.hidden,false);let top=f.stage.rect.top+Number.parseFloat(String(bar.style.top));assert.ok(top>=128);assert.ok(top+54<=367);
 f.board.viewport={x:60,y:250,zoom:1};f.view.refresh();top=f.stage.rect.top+Number.parseFloat(String(bar.style.top));assert.ok(top+54<=367);
 f.board.viewport={x:2000,y:250,zoom:1};f.view.refresh();assert.equal(bar.hidden,true);
 f.board.viewport={x:60,y:60,zoom:1};f.stage.rect.width=150;f.observers[0].callback();assert.equal(bar.hidden,true);f.view.dispose();assert.equal(f.doc.defaultView.listeners.get('resize')?.size,0);assert.equal(viewport.listeners.get('scroll')?.size,0);
});

test('navigation without an intervening refresh still rejects the captured context owner, and no stale More action writes',()=>{
 const {f}=selectFixture(),gesture=nearbyPress(f,'remove');f.switchKey();gesture.release();gesture.click();assert.equal(f.edits.length,0);f.button('删除选中笔迹').fire('click');assert.equal(f.edits.length,0);f.view.dispose();
});

test('a cancelled two-finger camera restores the nearby actions after held contacts release without changing selected ink',()=>{
 const {f}=selectFixture(),source=JSON.stringify(f.board.ink),bar=selectionBar(f);
 for(const point of [pointer(60,250,250,'touch'),pointer(61,350,250,'touch')]){f.doc.fire('pointerdown',{...point,target:f.stage});f.stage.fire('pointerdown',{...point,target:f.stage});}
 f.stage.fire('pointermove',pointer(61,400,260,'touch'));f.doc.frame();assert.equal(bar.hidden,true);
 f.doc.fire('pointercancel',pointer(61,400,260,'touch'));f.stage.fire('pointercancel',pointer(61,400,260,'touch'));f.doc.fire('pointerup',{...pointer(60,250,250,'touch'),buttons:0});f.stage.fire('pointerup',{...pointer(60,250,250,'touch'),buttons:0});
 assert.equal(bar.hidden,false);assert.equal(JSON.stringify(f.board.ink),source);assert.equal(f.edits.length,0);assert.equal(f.cameras.length,0);assert.equal(f.stage.captures.size,0);f.view.dispose();
});

test('rejected or failed context commits never permit a repeated tap to write ink, and keep host error visible',async()=>{
 const {f}=selectFixture(),host=Reflect.get(f.view,'host') as HandwritingHost,source=JSON.stringify(f.board.ink);host.commitInk=()=>Promise.reject(new Error('模拟保存失败'));
 const gesture=nearbyPress(f,'remove','pen');gesture.release();gesture.click();await Promise.resolve();assert.equal(JSON.stringify(f.board.ink),source);assert.ok(f.notices.some(message=>message.includes('模拟保存失败')));assert.equal(selectionBar(f).hidden,true);
 stageGesture(f,55,gesture.point.clientX,gesture.point.clientY,'pen');assert.equal(f.commits.length,0);assert.equal(f.edits.length,0);assert.equal(f.stage.captures.size,0);f.view.dispose();
});

const largeVisibleStrokes=()=>Array.from({length:3},(_,index):ink.InkStroke=>({id:`long-${index}`,color:'#222222',width:3,points:Array.from({length:4097},(_,i)=>[i/20,index*40+Math.sin(i/10),.1+(i%7)/8])}));
function finishVectors(f:ReturnType<typeof fixture>){for(let i=0;i<20&&f.doc.frames.size;i++)f.doc.frame();assert.equal(f.stage.dataset.inkRenderState,'ready');}

test('large full-visible cold load yields SVG creation across frames and rejects only new edits',()=>{
 const f=fixture(largeVisibleStrokes()),source=JSON.stringify(f.board.ink);assert.equal(f.stage.dataset.inkRenderState,'loading');assert.equal(f.stage.getAttribute('aria-busy'),'true');assert.equal(f.svg.all().filter(element=>element.getAttribute('data-ink-id')).length,0);
 f.controller.down(pointer(1,100,100));f.controller.up({...pointer(1,100,100),buttons:0});assert.equal(f.commits.length,0);
 f.doc.frame();assert.equal(f.svg.all().filter(element=>element.getAttribute('data-ink-id')).length,1);assert.equal(f.stage.dataset.inkRenderState,'loading');
 f.button('更多').fire('click');assert.equal(f.root.all().find(element=>element.classes.has('ts-handwriting-more'))?.hidden,false);f.button('移动').fire('click');
 f.controller.down(pointer(2,100,100,'mouse'));f.controller.move(pointer(2,120,100,'mouse'));f.controller.up({...pointer(2,120,100,'mouse'),buttons:0});assert.equal(f.cameras.length,1);assert.equal(f.commits.length,0);
 finishVectors(f);assert.equal(f.stage.getAttribute('aria-busy'),'false');assert.equal(f.stage.dataset.inkSourcePoints,'12291');assert.equal(f.stage.dataset.inkProjectedPoints,'12291');
 for(const stroke of f.board.ink!.strokes)assert.equal(f.svg.all().find(element=>element.getAttribute('data-ink-id')===stroke.id)?.getAttribute('d'),ink.strokePath(stroke));
 assert.equal(JSON.stringify(f.board.ink),source);f.button('笔').fire('click');assert.equal(f.stage.dataset.inkRenderState,'ready');f.controller.down(pointer(3,100,100));f.controller.up({...pointer(3,100,100),buttons:0});assert.equal(f.commits.length,1);finishVectors(f);f.view.dispose();
});

test('same-source refreshes reuse pending progress and completed vectors, including in-place mutation invalidation',()=>{
 const f=fixture(largeVisibleStrokes());f.doc.frame();const first=f.svg.all().find(element=>element.getAttribute('data-ink-id')==='long-0')!,writes=first.attributeWrites.get('d'),frame=[...f.doc.frames.keys()][0];
 for(let i=0;i<5;i++)f.view.refresh();assert.equal([...f.doc.frames.keys()][0],frame);assert.equal(first.attributeWrites.get('d'),writes);f.doc.frame();assert.equal(f.svg.all().filter(element=>element.getAttribute('data-ink-id')).length,2);finishVectors(f);
 const completeWrites=first.attributeWrites.get('d');for(let i=0;i<5;i++)f.view.refresh();assert.equal(f.doc.frames.size,0);assert.equal(f.stage.dataset.inkRenderState,'ready');assert.equal(first.attributeWrites.get('d'),completeWrites);
 f.board.ink!.strokes[0].points[100][2]=1;f.view.refresh();assert.equal(f.stage.dataset.inkRenderState,'loading');finishVectors(f);assert.equal(first.getAttribute('d'),ink.strokePath(f.board.ink!.strokes[0]));assert.ok(first.attributeWrites.get('d')!>completeWrites!);f.view.dispose();
});

for(const boundary of ['dispose','key','board','ink','window','disconnect'] as const)test(`queued vector frame rejects stale ${boundary} source and never creates stale ink`,()=>{
 const f=fixture(largeVisibleStrokes()),stale=[...f.doc.frames.values()];
 if(boundary==='dispose')f.view.dispose();if(boundary==='key')f.switchKey();if(boundary==='board')f.replaceBoard({...f.board,ink:{version:1,strokes:[stroke('new')]}});if(boundary==='ink')f.board.ink={version:1,strokes:[stroke('new')]};if(boundary==='window')Reflect.set(f.doc.defaultView,'closed',true);if(boundary==='disconnect')f.root.connected=false;
 for(const callback of stale)callback();assert.equal(f.svg.all().some(element=>element.getAttribute('data-ink-id')?.startsWith('long-')),false);assert.equal(f.commits.length,0);assert.equal(f.edits.length,0);f.view.dispose();
});

test('loading export sees complete raw source and undo cancels old render rather than writing a late frame',()=>{
 const f=fixture(largeVisibleStrokes()),host=Reflect.get(f.view,'host') as HandwritingHost,source=JSON.stringify(f.board.ink);let exported='';host.export=()=>{exported=JSON.stringify(f.board.ink);};f.view.refresh();const stale=[...f.doc.frames.values()];
 f.button('更多').fire('click');f.button('导出 / 插入笔记…').fire('click');assert.equal(exported,source);assert.equal(f.commits.length,0);
 host.undo=redo=>{f.undos.push(redo);f.board.ink={version:1,strokes:[stroke('undo')]};};f.stage.fire('keydown',{key:'z',metaKey:true});assert.deepEqual(f.undos,[false]);assert.equal(f.stage.dataset.inkRenderState,'ready');for(const callback of stale)callback();assert.deepEqual(f.svg.all().filter(element=>element.getAttribute('data-ink-id')).map(element=>element.getAttribute('data-ink-id')),['undo']);f.view.dispose();
});

test('resize during an active draft reprojects saved vectors without discarding the draft or world samples',()=>{
 const f=fixture(largeVisibleStrokes());finishVectors(f);f.controller.down(pointer(1,100,100));f.controller.move(pointer(1,120,120));f.doc.frame();const before=Reflect.get(f.view,'draft') as input.HandwritingDraft;assert.ok(before);
 f.stage.rect={left:40,top:80,width:390,height:300};f.doc.defaultView.visualViewport.height=300;f.observers[0].callback();assert.equal(f.stage.dataset.inkRenderState,'loading');assert.ok(Reflect.get(f.view,'draft'));assert.ok(f.stage.captures.has(1));
 f.controller.move(pointer(1,200,180));f.controller.up({...pointer(1,200,180),buttons:0});assert.equal(f.commits.length,1);assert.deepEqual(f.commits[0].points.slice(0,2),[[40,40,.6],[60,60,.6]]);assert.deepEqual(f.commits[0].points.at(-1),[100,40,.6]);finishVectors(f);f.view.dispose();
});

test('culling respects translated selected display geometry and cancellation restores original projection',()=>{
 const strokes=largeVisibleStrokes();for(const value of strokes)for(const point of value.points)point[0]+=2000;
 const f=fixture(strokes);f.editable();finishVectors(f);const first=f.svg.all().find(element=>element.getAttribute('data-ink-id')===strokes[0].id)!;assert.equal(first.getAttribute('d'),'');assert.equal(f.stage.dataset.inkProjectedPoints,'0');
 f.button('更多').fire('click');f.button('套索选笔迹').fire('click');Reflect.set(f.view,'selected',[strokes[0].id]);Reflect.set(f.view,'selectionInk',f.board.ink);Reflect.set(f.view,'selectionDelta',{x:-2000,y:0});Reflect.get(f.view,'drawSelection').call(f.view);finishVectors(f);assert.equal(first.getAttribute('d'),ink.strokePath(strokes[0]));assert.equal(first.getAttribute('transform'),'translate(-2000 0)');
 Reflect.set(f.view,'selectionDelta',{x:0,y:0});Reflect.get(f.view,'drawSelection').call(f.view);finishVectors(f);assert.equal(first.getAttribute('d'),'');assert.equal(f.edits.length,0);assert.equal(f.commits.length,0);f.view.dispose();
});
