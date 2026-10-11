import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as ink from '../src/ink-model';
import * as input from '../src/handwriting-input';
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
 style:Record<string,unknown>&{setProperty:(key:string,value:string)=>void}={setProperty:(key,value)=>{this.style[key]=value;}};
 rect={left:0,top:0,width:800,height:600};width=0;height=0;
 classList={add:(...names:string[])=>this.addClass(...names),remove:(...names:string[])=>this.removeClass(...names)};
 constructor(readonly ownerDocument:Doc,readonly tag='div'){super();}
 get isConnected():boolean{return this.parentElement?this.parentElement.isConnected:this.connected;}
 createEl(tag:string,options?:{cls?:string;text?:string;attr?:Record<string,string>}|string){const child=new Element(this.ownerDocument,tag);if(typeof options==='string')child.addClass(options);else if(options){if(options.cls)child.addClass(options.cls);child.textContent=options.text||'';for(const [key,value]of Object.entries(options.attr||{}))child.setAttribute(key,value);}this.appendChild(child);return child;}
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
 getBoundingClientRect(){return{...this.rect};}
 setPointerCapture(id:number){this.captures.add(id);}
 hasPointerCapture(id:number){return this.captures.has(id);}
 releasePointerCapture(id:number){this.captures.delete(id);}
 focus(options?:FocusOptions){this.ownerDocument.activeElement=this;this.ownerDocument.focusOptions.push(options);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=undefined;this.connected=false;}
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
 getContext(){return this.ownerDocument.context;}
}
class Doc extends Target {
 hidden=false;frames=new Map<number,()=>void>();nextFrame=0;fills:string[]=[];clears=0;
 activeElement?:Element;focusOptions:(FocusOptions|undefined)[]=[];
 context={setTransform(){},clearRect:()=>{this.clears++;},fill:(path:{data:string})=>{this.fills.push(path.data);},beginPath(){},arc(){},stroke(){},fillStyle:'',strokeStyle:'',lineWidth:1};
 defaultView=Object.assign(new Target(),{devicePixelRatio:2,visualViewport:new Target(),Path2D:class{constructor(readonly data:string){}},requestAnimationFrame:(callback:()=>void)=>{const id=++this.nextFrame;this.frames.set(id,callback);return id;},cancelAnimationFrame:(id:number)=>this.frames.delete(id)});
 createElementNS(_namespace:string,tag:string){return new Element(this,tag);}
 frame(){const callbacks=[...this.frames.values()];this.frames.clear();for(const callback of callbacks)callback();}
 keydown(key:string,patch:Record<string,unknown>={}){this.activeElement?.fire('keydown',{key,isComposing:false,defaultPrevented:false,...patch});}
}
const stroke=(id='saved'):ink.InkStroke=>({id,color:'#222222',width:3,points:[[0,0,.5],[20,20,1]]});
const pointer=(id:number,x:number,y:number,type='pen')=>({pointerId:id,pointerType:type,clientX:x,clientY:y,pressure:.6,button:0,buttons:1,timeStamp:10});
function fixture(strokes:ink.InkStroke[]=[],path2D=true){
 const doc=new Doc(),root=new Element(doc),observers:{callback:()=>void;disconnected:boolean}[]=[],pathLengths:number[]=[];
 if(!path2D)Reflect.deleteProperty(doc.defaultView,'Path2D');
 class Observer {disconnected=false;constructor(readonly callback:()=>void){observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
 const module={exports:{}};let ids=0;
 new Function('require','module','exports','ResizeObserver',transformSync(readFileSync('src/handwriting-view.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>{
  if(name==='obsidian')return{setIcon:(element:Element,icon:string)=>element.setAttribute('data-icon',icon)};
  if(name==='./model')return{uid:()=>`new-${++ids}`};if(name==='./handwriting-input')return input;
  if(name==='./ink-model')return{...ink,strokePath:(value:ink.InkStroke)=>{pathLengths.push(value.points.length);return ink.strokePath(value);}};
  throw Error(`Unexpected dependency ${name}`);
 },module,module.exports,Observer);
 const View=(module.exports as {HandwritingView:new(root:HTMLElement,host:HandwritingHost)=>HandwritingView}).HandwritingView;
 let board:Board={version:3,presentation:'handwriting',nodes:[],edges:[],viewport:{x:60,y:60,zoom:1},ink:{version:1,strokes}},key:unknown={},readOnly=false;
 const commits:ink.InkStroke[]=[],erases:readonly string[][]=[],cameras:{viewport:Board['viewport'];persist:boolean}[]=[],notices:string[]=[],undos:boolean[]=[];
 let view:HandwritingView;
 const host:HandwritingHost={snapshot:()=>({key,board,readOnly}),commitStroke:(value,owner)=>{assert.equal(owner,key);commits.push(value);board.ink!.strokes.push(value);view.refresh();},commitErase:(ids,owner)=>{assert.equal(owner,key);(erases as string[][]).push([...ids]);board.ink!.strokes=board.ink!.strokes.filter(value=>!ids.includes(value.id));view.refresh();},camera:(viewport,owner,persist)=>{assert.equal(owner,key);assert.equal(persist,true);board.viewport={...viewport};cameras.push({viewport:{...viewport},persist});view.refresh();},undo:redo=>{undos.push(redo);},notice:message=>{notices.push(message);}};
 view=new View(root as unknown as HTMLElement,host);
 const stage=root.all().find(element=>element.classes.has('ts-handwriting-stage'))!,svg=root.all().find(element=>element.tag==='svg')!;
 const button=(label:string)=>{const value=root.all().find(element=>element.tag==='button'&&element.getAttribute('aria-label')===label);assert.ok(value,label);return value;};
 const controller=Reflect.get(view,'controller') as input.HandwritingInputController;
 return{view,doc,root,stage,svg,button,controller,commits,erases,cameras,notices,undos,pathLengths,observers,get board(){return board;},replaceBoard:(value:Board)=>{board=value;},setReadonly:(value:boolean)=>{readOnly=value;},switchKey:()=>{key={};}};
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

test('handwriting defaults to pen and reuses saved SVG paths on camera and unrelated refreshes',()=>{
 const f=fixture([stroke()]);assert.equal(f.button('笔').getAttribute('aria-pressed'),'true');assert.equal(f.root.classes.has('ts-handwriting-board'),true);
 const saved=f.svg.children.find(element=>element.getAttribute('data-ink-id')==='saved')!;assert.equal(saved.attributeWrites.get('d'),1);
 f.board.viewport={x:10,y:20,zoom:.5};f.view.refresh();f.view.refresh();assert.equal(saved.attributeWrites.get('d'),1);
 f.board.ink!.strokes[0]={...stroke(),color:'#315e9b'};f.view.refresh();assert.equal(saved.attributeWrites.get('d'),2);assert.equal(saved.getAttribute('fill'),'#315e9b');
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
