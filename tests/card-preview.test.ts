import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {releaseEditorResource} from '../src/editor-cleanup';
import {excerptPresentation} from '../src/excerpt-sources';
import {markdownPreview,RenderQueue} from '../src/rendering';
import {TextDocument,TextElement} from './text-dom-fixture';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(queue?:RenderQueue){
 class Scope{
  loaded=false;cleanups:(()=>void)[]=[];children:Scope[]=[];
  register(fn:()=>void){this.cleanups.push(fn);}load(){this.loaded=true;}
  unload(){this.loaded=false;for(const fn of this.cleanups.splice(0))fn();}
  addChild(child:Scope){this.children.push(child);child.load();}
  removeChild(child:Scope){this.children=this.children.filter(item=>item!==child);child.unload();}
 }
 const doc=new TextDocument(),createElement=doc.createElement.bind(doc);let preview:TextElement;
 doc.createElement=tag=>{const element=createElement(tag);Object.defineProperty(element,'isConnected',{get:()=>element===preview||!!element.parentElement?.isConnected});return element;};
 preview=doc.createElement('div');const scope=new Scope(),timers=new Map<number,()=>void>();let timerId=0,readCount=0,ready=0,errors=0;
 doc.defaultView.setTimeout=(fn,ms)=>{assert.equal(ms,5000);timers.set(++timerId,fn);return timerId;};doc.defaultView.clearTimeout=id=>{timers.delete(id);};
 preview.className='ts-card-preview markdown-rendered ts-preview-pending';
 Object.assign(preview.classList,{remove:(name:string)=>{preview.className=preview.className.split(/\s+/).filter(value=>value!==name).join(' ');}});
 preview.setAttribute('aria-busy','true');
 const reads:{resolve:(value:string)=>void;reject:()=>void}[]=[],renders:{element:TextElement;text:string;path:string;scope:Scope;resolve:()=>void;reject:()=>void}[]=[],sources:ReturnType<typeof excerptPresentation>['sources'][]=[];
 const app={vault:{cachedRead:()=>{readCount++;return new Promise<string>((resolve,reject)=>reads.push({resolve,reject:()=>reject(Error('read failed'))}));}}};
 const imports:Record<string,unknown>={obsidian:{Component:Scope,MarkdownRenderer:{render:(_app:unknown,text:string,element:TextElement,path:string,scope:Scope)=>{assert.equal(element.isConnected,true,'native postprocessors must receive an attached target');return new Promise<void>((resolve,reject)=>renders.push({element,text,path,scope,resolve,reject:()=>reject(Error('render failed'))}));}}},'./editor-cleanup':{releaseEditorResource},'./excerpt-sources':{excerptPresentation},'./rendering':{markdownPreview}};
 const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/card-preview.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name],module,module.exports);
 const jobs:{alive:()=>boolean;run:()=>Promise<void>}[]=[];
 const render=()=>module.exports.renderCardPreview({app,file:{path:'Notes/current.md'},preview,scope,enqueue:(alive:()=>boolean,run:()=>Promise<void>)=>queue?queue.add(alive,run):jobs.push({alive,run}),sources:(value:typeof sources[number])=>sources.push(value),ready:()=>{assert.equal(preview.classList.contains('ts-preview-pending'),false,'loading decoration must be gone before auto-fit measures');ready++;},error:()=>{errors++;preview.textContent='retry';}});
 render();return{doc,preview,scope,timers,reads,renders,sources,jobs,render,readCount:()=>readCount,ready:()=>ready,errors:()=>errors};
}

test('card preview keeps source context, read-only inputs, tag cleanup and renderer scope through completion',async()=>{
 const f=fixture(),pending=f.jobs[0].run();
 f.reads[0].resolve('---\ntags: [a]\n---\nBody\n\n来源：[[original.md]] · 第 1–2 行');await tick();
 const job=f.renders[0];assert.equal(job.path,'Notes/current.md');assert.equal(job.text,'Body\n');assert.equal(f.sources[0][0].link,'[[original.md]]');assert.equal(job.scope.loaded,true);assert.notEqual(job.element,f.preview);
 const input=f.doc.createElement('input'),blank=f.doc.createElement('p'),body=f.doc.createElement('div');body.textContent='rendered';job.element.appendChild(input);job.element.appendChild(blank);job.element.appendChild(body);job.resolve();await pending;
 assert.equal(input.disabled,true);assert.equal(blank.parentElement,undefined);assert.equal(f.preview.textContent,'rendered');assert.equal(f.ready(),1);assert.equal(f.errors(),0);assert.equal(f.timers.size,0);assert.equal(f.preview.getAttribute('aria-busy'),'false');assert.equal(job.scope.loaded,true);
 f.scope.unload();assert.equal(job.scope.loaded,false);assert.equal(f.scope.children.length,0);
});

test('unloading four cards during file reads releases every shared slot for a fresh preview',async()=>{
 const queue=new RenderQueue(),cards=Array.from({length:4},()=>fixture(queue));let fresh=0;queue.add(()=>true,async()=>{fresh++;});
 assert.equal(queue.active,4);assert.equal(queue.pending,1);for(const card of cards)card.scope.unload();await tick();
 assert.equal(fresh,1);assert.equal(queue.active,0);assert.equal(queue.pending,0);
 for(const card of cards){assert.equal(card.timers.size,0);card.reads[0].resolve('late read');}await tick();
 for(const card of cards){assert.equal(card.renders.length,0);assert.equal(card.ready(),0);assert.equal(card.errors(),0);}
});

test('unloading a card during native rendering releases its slot and isolates late output',async()=>{
 const queue=new RenderQueue(1),f=fixture(queue);f.reads[0].resolve('body');await tick();const job=f.renders[0];let fresh=0;queue.add(()=>true,async()=>{fresh++;});f.scope.unload();await tick();
 assert.equal(fresh,1);assert.equal(queue.active,0);assert.equal(job.scope.loaded,false);assert.equal(f.timers.size,0);assert.equal(job.element.isConnected,false);
 job.element.textContent='late content';job.resolve();await tick();assert.equal(f.preview.textContent,'');assert.equal(f.ready(),0);assert.equal(f.errors(),0);
});

for(const phase of ['read','renderer'] as const)test(`a stalled card ${phase} times out once and cannot commit after retry`,async()=>{
 const f=fixture(),pending=f.jobs[0].run();
 if(phase==='renderer'){f.reads[0].resolve('old');await tick();f.renders[0].element.textContent='partial old';}
 [...f.timers.values()][0]();await pending;assert.equal(f.errors(),1);assert.equal(f.preview.textContent,'retry');assert.equal(f.timers.size,0);assert.equal(f.scope.children.length,0);
 f.render();const retry=f.jobs[1].run();f.reads[1].resolve('new');await tick();const current=f.renders.at(-1)!;current.element.appendChild(f.doc.createTextNode('current'));current.resolve();await retry;
 if(phase==='read')f.reads[0].resolve('late old');else{f.renders[0].element.textContent='late old';f.renders[0].reject();}await tick();
 assert.equal(f.preview.textContent,'current');assert.equal(f.ready(),1);assert.equal(f.errors(),1);assert.equal(f.timers.size,0);
});

test('replacing a pending preview on the same element cancels the old generation before it can fail',async()=>{
 const f=fixture(),old=f.jobs[0].run();f.reads[0].resolve('old');await tick();f.render();await old;const next=f.jobs[1].run();f.reads[1].resolve('new');await tick();f.renders[1].element.appendChild(f.doc.createTextNode('new'));f.renders[1].resolve();await next;f.renders[0].reject();await tick();assert.equal(f.preview.textContent,'new');assert.equal(f.errors(),0);assert.equal(f.scope.children.length,1);
});

test('a queued card canceled before its slot starts does no file work or timer allocation',async()=>{
 const f=fixture();f.scope.unload();assert.equal(f.jobs[0].alive(),false);await f.jobs[0].run();assert.equal(f.readCount(),0);assert.equal(f.timers.size,0);assert.equal(f.ready(),0);
});

test('attached native processing completes before auto-fit and retains renderer-root scrolling and handlers',async()=>{
 const f=fixture(),pending=f.jobs[0].run();f.reads[0].resolve('```mermaid\ngraph TD\nA-->B\n```');await tick();const job=f.renders[0];
 assert.equal(job.element.parentElement,f.preview);assert.equal(job.element.isConnected,true);assert.equal(job.element.classList.contains('ts-card-preview'),false);assert.equal(f.ready(),0);
 let clicked=0;job.element.style.overflowX='auto';job.element.setAttribute('dir','rtl');job.element.addEventListener('click',()=>clicked++);job.element.appendChild(f.doc.createTextNode('completed diagram'));job.resolve();await pending;
 assert.equal(f.ready(),1);assert.equal(f.preview.children[0],job.element);assert.equal(job.element.style.overflowX,'auto');assert.equal(job.element.getAttribute('dir'),'rtl');job.element.dispatch('click');assert.equal(clicked,1);assert.equal(f.preview.textContent,'completed diagram');
 f.scope.unload();assert.equal(job.element.isConnected,false);
});

test('replacing a completed card detaches its owned wrapper without losing descendant queries',async()=>{
 const f=fixture(),first=f.jobs[0].run();f.reads[0].resolve('first');await tick();const old=f.renders[0],image=f.doc.createElement('img');old.element.appendChild(image);old.resolve();await first;
 assert.equal(f.preview.querySelectorAll('img')[0],image);assert.equal(old.element.isConnected,true);f.render();assert.equal(old.element.isConnected,false);assert.equal(old.scope.loaded,false);assert.equal(f.preview.children.length,0);
 const next=f.jobs[1].run();f.reads[1].resolve('second');await tick();const current=f.renders[1];current.element.appendChild(f.doc.createTextNode('new'));current.resolve();await next;
 old.element.appendChild(f.doc.createTextNode('late old'));assert.equal(f.preview.textContent,'new');assert.equal(f.preview.children.length,1);assert.equal(current.element.isConnected,true);
});
