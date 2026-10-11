import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as ink from '../src/ink-model';
import * as input from '../src/handwriting-input';
import {isBrainBoard} from '../src/brain-board';
import {isHandwritingBoard} from '../src/handwriting-board';
import type {Board} from '../src/model';
import type {HandwritingView,HandwritingHost} from '../src/handwriting-view';

interface InkFixture {
 view:HandwritingView;controller:input.HandwritingInputController;board:Board;
 root:{classes:Set<string>;removeClass(name:string):void;ownerDocument:{defaultView:unknown};isConnected:boolean};
 doc:{frames:Map<number,()=>void>;frame():void};
}

/** Reuse the existing DOM fixture without registering its test cases a second time. */
function inkFixture():InkFixture {
 const module={exports:{}};
 const code=transformSync(readFileSync('tests/handwriting-view.test.ts','utf8')+'\nexport {fixture};',{loader:'ts',format:'cjs'}).code;
 new Function('require','module','exports',code)((name:string)=>{
  if(name==='node:test')return()=>{};
  if(name==='node:assert/strict')return assert;
  if(name==='node:fs')return{readFileSync};
  if(name==='esbuild')return{transformSync};
  if(name==='../src/ink-model')return ink;
  if(name==='../src/handwriting-input')return input;
  throw Error(`Unexpected fixture dependency ${name}`);
 },module,module.exports);
 return(module.exports as {fixture():InkFixture}).fixture();
}

function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
const source=readFileSync('src/main.ts','utf8');
const loadStart=source.indexOf('  async onLoadFile(file:'),loadEnd=source.indexOf('\n  private point(',loadStart);
const clearStart=source.indexOf('  private clearHandwritingBoard(){'),clearEnd=source.indexOf('\n  private renderHandwritingBoard(){',clearStart);
assert.ok(loadStart>=0&&loadEnd>loadStart&&clearStart>=0&&clearEnd>clearStart);
const viewCode=transformSync('class BoardView{'+source.slice(loadStart,loadEnd)+source.slice(clearStart,clearEnd)+'};return BoardView',{loader:'ts'}).code;
const pointer=(x=60,y=60)=>({pointerId:1,pointerType:'pen',clientX:x,clientY:y,pressure:.6,button:0,buttons:1,timeStamp:10});

function fixture(){
 const handwriting=inkFixture(),gate=deferred<any>(),errors:string[]=[],writes:ink.InkStroke[]=[],released:unknown[]=[];
 const View=new Function('isBrainBoard','isHandwritingBoard','isDesktopRuntime','Notice','act','report','fitTextNode','textFitsContent',viewCode)(isBrainBoard,isHandwritingBoard,()=>false,class{},(run:()=>unknown)=>{void run();},()=>{},()=>{},()=>false);
 const view=new View(),oldFile={path:'old.thoughtspace',extension:'thoughtspace'},nextFile={path:'new.thoughtspace',extension:'thoughtspace'};
 const oldOwner={file:oldFile,board:handwriting.board,listeners:new Set(),blocked:false,flush:async()=>{}};
 const host=Reflect.get(handwriting.view,'host') as HandwritingHost;
 host.snapshot=()=>view.session===oldOwner&&view.leaf.view===view?{key:oldOwner,board:oldOwner.board,readOnly:oldOwner.blocked}:undefined;
 host.commitStroke=stroke=>{writes.push(stroke);oldOwner.board.ink!.strokes.push(stroke);};
 Reflect.set(handwriting.root,'querySelectorAll',()=>[]);
 Object.assign(view,{file:oldFile,session:oldOwner,handwritingOwner:oldOwner,handwritingView:handwriting.view,
  contentEl:handwriting.root,leaf:{},closed:false,closing:false,dialogEpoch:0,sidebarRun:0,renderFrame:0,
  plugin:{provisionalBoardGeometry:new WeakMap(),session:()=>gate.promise,release:async(owner:unknown)=>{released.push(owner);},refreshDock(){},clearMaterialDrag(){}},
  cancelSaveFeedbackNavigation(){},blankClicks:{cancel(){}},clearBrainBoard(){},finishMarquee(){},setSectionTool(){},syncSelectionTool(){},
  viewTrail:{clear(){}},outlineCollapsed:new Set(),clearNodes(){},selected:new Set(),stage:{removeClass(){}},svg:{isConnected:true},
  world:{style:{removeProperty(){}},empty(){},createDiv(value:{text:string}){errors.push(value.text);}},status:{setText(){}},
  finishInlineForNavigation:async()=>{},clearCanvasGesture(){},app:{workspace:{getActiveViewOfType:()=>view}},paint(){}});
 view.leaf.view=view;handwriting.view.refresh();
 const load=()=>{view.file=nextFile;return view.onLoadFile(nextFile) as Promise<void>;};
 return{view,handwriting,gate,oldOwner,nextFile,errors,writes,released,load};
}

test('replacement load disposes the old handwriting draft before awaiting its file read',async()=>{
 const f=fixture();f.handwriting.controller.down(pointer());f.handwriting.controller.move(pointer(80,80));
 assert.equal(f.handwriting.doc.frames.size,1);
 const pending=f.load();
 assert.equal(!!f.view.handwritingView,false);assert.equal(!!f.view.handwritingOwner,false);
 assert.equal(f.handwriting.doc.frames.size,0);assert.equal(f.handwriting.root.classes.has('ts-handwriting-board'),false);
 f.handwriting.controller.up({...pointer(100,100),buttons:0});f.handwriting.doc.frame();assert.equal(f.writes.length,0);
 f.gate.reject(Error('read failed'));await pending;
 assert.equal(f.view.session,undefined);assert.equal(f.errors.length,1);assert.match(f.errors[0],/read failed/);
 assert.equal(f.handwriting.root.classes.has('ts-handwriting-board'),false);
});

test('late old input cannot append ink while a successful replacement read is pending',async()=>{
 const f=fixture();f.handwriting.controller.down(pointer());const pending=f.load();
 f.handwriting.controller.up({...pointer(90,90),buttons:0});assert.equal(f.writes.length,0);
 const nextOwner={file:f.nextFile,board:{version:3,nodes:[],edges:[],viewport:{x:60,y:60,zoom:1}},listeners:new Set(),blocked:false,flush:async()=>{}};
 f.gate.resolve(nextOwner);await pending;
 assert.equal(f.view.session,nextOwner);assert.equal(nextOwner.listeners.size,1);assert.equal(f.oldOwner.board.ink!.strokes.length,0);
});

test('a failure after mounting a new handwriting surface removes it before displaying the file error',async()=>{
 const f=fixture();let disposed=0;
 const nextOwner={file:f.nextFile,board:{version:3,presentation:'handwriting',nodes:[],edges:[],viewport:{x:60,y:60,zoom:1},ink:{version:1,strokes:[]}},listeners:new Set(),blocked:false,flush:async()=>{}};
 f.view.paint=()=>{f.view.handwritingOwner=nextOwner;f.view.handwritingView={dispose(){disposed++;}};f.handwriting.root.classes.add('ts-handwriting-board');throw Error('surface paint failed');};
 const pending=f.load();f.gate.resolve(nextOwner);await pending;
 assert.equal(disposed,1);assert.equal(!!f.view.handwritingView,false);assert.equal(!!f.view.handwritingOwner,false);
 assert.equal(f.handwriting.root.classes.has('ts-handwriting-board'),false);assert.equal(f.errors.length,1);assert.match(f.errors[0],/surface paint failed/);
 assert.equal(nextOwner.listeners.size,0);assert.deepEqual(f.released,[nextOwner]);
});
