import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {releaseEditorResource} from '../src/editor-cleanup';

/** Track cancellation lifetime at the real async boundary; no GC timing or heap threshold. */
function fixture(kind:'card'|'text',math:boolean){
 const signals=new Set<Promise<unknown>>(),timers=new Set<number>();let timerId=0,renders=0,typesets=0,loaded=0,holders=0;
 const promiseRuntime=new Proxy(Promise,{get(target,key,receiver){
  if(key!=='race')return Reflect.get(target,key,receiver);
  return(values:Iterable<unknown>)=>{const inputs=Array.from(values),signal=inputs[1] as Promise<unknown>;
   if(!signals.has(signal)){signals.add(signal);void signal.then(()=>signals.delete(signal),()=>signals.delete(signal));}
   return Promise.race(inputs);
  };
 }});
 const win={setTimeout:()=>{const id=timerId++;timers.add(id);return id;},clearTimeout:(id:number)=>timers.delete(id)};
 const content=()=>({querySelector:()=>math?{}:null});
 const preview={isConnected:true,ownerDocument:{defaultView:win},cloneNode:()=>({dataset:{},createDiv:content,querySelector:content().querySelector,querySelectorAll:()=>[]}),parentElement:{createDiv:()=>{holders++;return{appendChild(){},remove(){holders--;}};}}};
 class Scope{load(){loaded++;}unload(){loaded--;}}
 const node={id:'draft',kind:'text',text:'old',x:0,y:0,width:120,height:80,color:'green',autoSize:true};
 const imports:Record<string,unknown>={
  './editor-cleanup':{releaseEditorResource},
  './excerpt-sources':{excerptPresentation:(body:string)=>({body}),textExcerptPresentation:(body:string)=>({body})},
  './rendering':{markdownPreview:(body:string)=>body},
  './workspace-tools':{measureNoteCard:()=>({width:300,height:180})},
  './text-tools':{fitTextNode:(draft:typeof node)=>Object.assign(draft,{width:300,height:180})},
  obsidian:{Component:Scope,MarkdownRenderer:{render:()=>{renders++;return Promise.resolve();}},finishRenderMath:()=>{typesets++;return Promise.resolve();}}
 };
 const module={exports:{} as Record<string,new(...args:unknown[])=>{schedule(value:string):void;flush():Promise<void>;dispose():void}>};
 new Function('require','module','exports','window','Promise',transformSync(readFileSync(`src/inline-${kind}-fit.ts`,'utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name],module,module.exports,win,promiseRuntime);
 const Fit=module.exports[kind==='card'?'InlineCardFit':'InlineTextFit'];
 const fit=new Fit({},preview,'note.md',kind==='text'?()=>node:undefined,(size:{width:number;height:number})=>Object.assign(node,size));
 return{fit,signals,timers,get renders(){return renders;},get typesets(){return typesets;},get loaded(){return loaded;},get holders(){return holders;}};
}

for(const kind of ['card','text'] as const)for(const math of [false,true])test(`${kind} ${math?'formula':'plain'} measurements release cancellation listeners while the editor stays open`,async()=>{
 const f=fixture(kind,math);
 try{
  for(let i=0;i<100;i++){
   f.fit.schedule(`draft ${i}`);await f.fit.flush();
   assert.equal(f.signals.size,0,'a completed measurement must not retain a pending editor-lifetime cancellation signal');
   assert.equal(f.timers.size,0);assert.equal(f.loaded,0);assert.equal(f.holders,0);
  }
  assert.equal(f.renders,100);assert.equal(f.typesets,math?100:0);
 }finally{f.fit.dispose();}
});
