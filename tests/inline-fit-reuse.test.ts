import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {releaseEditorResource} from '../src/editor-cleanup';
import * as sources from '../src/excerpt-sources';
import {markdownPreview} from '../src/rendering';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve!:()=>void,reject!:(error:Error)=>void;const promise=new Promise<void>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(kind:'card'|'text'='card',mode:'immediate'|'pending'|'math'='immediate'){
 let now=0,next=0,measures=0,applies=0,loads=0,unloads=0,holders=0,removes=0,styleReads=0;
 let shape='P',attributes:{name:string;value:string}[]=[],changedText=false,size={width:300,height:180};
 const jobs:{value:string;time:number;gate:ReturnType<typeof deferred>;scope:Scope}[]=[],mathJobs:ReturnType<typeof deferred>[]=[],timers=new Map<number,{run:()=>void;due:number;delay:number}>();
 const typography={fontFamily:'Body',fontSize:'14px',fontStyle:'normal',fontWeight:'400',direction:'ltr',lineHeight:'24px',letterSpacing:'0px',textAlign:'left',paddingTop:'10px',paddingRight:'10px',paddingBottom:'10px',paddingLeft:'10px'};
 const header={offsetHeight:30,matches:()=>true,style:{display:'block',marginTop:'0px',marginBottom:'0px'}},footer={offsetHeight:25,matches:()=>true,style:{display:'block',marginTop:'0px',marginBottom:'0px'}};
 const card={children:[header,footer],style:{borderLeftWidth:'1px',borderRightWidth:'1px',borderTopWidth:'1px',borderBottomWidth:'1px'}};
 const win={setTimeout(run:()=>void,delay:number){const id=next++;timers.set(id,{run,due:now+delay,delay});return id;},clearTimeout(id:number){timers.delete(id);},getComputedStyle:(element:any)=>{styleReads++;return element.style||typography;}};
 function content():any{return{value:'',textContent:'',children:[],dataset:{},querySelector(selector:string){return selector==='.math'&&this.value.includes('$$')?{}:null;},querySelectorAll(selector:string){return selector==='*'?this.children:[];},createDiv:content};}
 const parent=()=>({createDiv(){holders++;return{appendChild(){},remove(){removes++;}};}});
 const preview:any={isConnected:true,ownerDocument:{defaultView:win},className:'ts-card-preview',offsetWidth:300,cssText:'',getAttribute:()=>preview.cssText,closest:()=>card,cloneNode:content,parentElement:parent()};
 class Scope{loaded=false;cleanups:(()=>void)[]=[];children:Scope[]=[];register(fn:()=>void){this.cleanups.push(fn);}addChild(child:Scope){this.children.push(child);if(this.loaded)child.load();return child;}load(){if(this.loaded)return;this.loaded=true;loads++;for(const child of this.children)child.load();}unload(){if(!this.loaded)return;this.loaded=false;unloads++;for(const child of this.children.splice(0))child.unload();for(const fn of this.cleanups.splice(0))fn();}}
 const node={id:'draft',kind:'text',text:'old',x:0,y:0,width:120,height:80,color:'green',autoSize:true};
 const imports:Record<string,unknown>={'./editor-cleanup':{releaseEditorResource},'./excerpt-sources':sources,'./rendering':{markdownPreview},'./workspace-tools':{measureNoteCard:()=>{measures++;return size;}},'./text-tools':{fitTextNode:(draft:any)=>{measures++;Object.assign(draft,size);}},obsidian:{Component:Scope,MarkdownRenderer:{render(_app:unknown,value:string,output:any,_path:string,scope:Scope){output.value=value;output.textContent=changedText?'dynamic content':value;output.children=[{tagName:shape,attributes}];const gate=deferred();jobs.push({value,time:now,gate,scope});if(mode==='immediate'||mode==='math')gate.resolve();return gate.promise;}},finishRenderMath(){const gate=deferred();mathJobs.push(gate);return gate.promise;}}};
 const module={exports:{} as any};new Function('require','module','exports','window',transformSync(readFileSync(`src/inline-${kind}-fit.ts`,'utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name],module,module.exports,win);
 const Fit=module.exports[kind==='card'?'InlineCardFit':'InlineTextFit'],fit=new Fit({},preview,'note.md',kind==='text'?()=>node:undefined,(result:any)=>{applies++;Object.assign(node,result);});
 return{fit,jobs,mathJobs,timers,preview,typography,header,footer,card,parent,Scope,get styleReads(){return styleReads;},advance(time:number){now=time;for(const[id,timer]of [...timers].sort((a,b)=>a[1].due-b[1].due)){if(timer.due<=now&&timers.has(id)){timers.delete(id);timer.run();}}},setShape:(tag:string)=>{shape=tag;},setAttributes:(value:typeof attributes)=>{attributes=value;},changeRenderedText:()=>{changedText=true;},setSize:(value:typeof size)=>{size=value;},stats:()=>({renders:jobs.length,measures,applies,loads,unloads,holders,removes})};
}
const metadata=(sequence:number,body='Same static paragraph')=>`---\nsequence: ${sequence}\n---\n${body}`;

for(const scenario of ['clipped-tail','frontmatter','source-footer'])test(`equivalent static card ${scenario} previews reuse one successful render and measurement`,async()=>{
 const f=fixture(),prefix='Plain paragraph.\n\n'.repeat(1200);
 for(let i=0;i<60;i++){f.fit.schedule(scenario==='clipped-tail'?prefix+i:scenario==='frontmatter'?metadata(i):`Same paragraph\n\n> 来源：[[paper${i}.pdf]] · PDF 第 2 页`);await f.fit.flush();}
 assert.equal(new Set(f.jobs.map(job=>job.value)).size,1);assert.deepEqual(f.stats(),{renders:1,measures:1,applies:1,loads:1,unloads:1,holders:1,removes:1});f.fit.dispose();
});

test('static reuse invalidates for fonts, explicit theme changes, width, chrome and reparenting',async()=>{
 const f=fixture();f.fit.schedule(metadata(0));await f.fit.flush();
 const changes=[()=>{f.typography.fontFamily='New Font';},()=>{f.typography.fontSize='24px';},()=>{f.typography.fontStyle='italic';},()=>{f.typography.direction='rtl';},()=>{f.fit.preferredWidth=360;},()=>{f.preview.offsetWidth=350;},()=>{f.preview.cssText='padding:20px';},()=>{f.footer.offsetHeight=60;},()=>{f.card.style.borderLeftWidth='4px';},()=>{f.preview.parentElement=f.parent();}];
 for(let i=0;i<changes.length;i++){changes[i]();f.fit.schedule(metadata(i+1));await f.fit.flush();assert.equal(f.jobs.length,i+2);}
 // Existing css-change / loadingdone hooks use this explicit appearance signal,
 // including a newly loaded font whose CSS family string did not change.
 f.fit.schedule(metadata(changes.length),true);await f.fit.flush();assert.equal(f.jobs.length,changes.length+2);f.fit.dispose();
});

test('source reference occupancy invalidates an otherwise identical static preview',async()=>{
 const f=fixture();f.fit.schedule('Body\n');await f.fit.flush();f.fit.schedule('Body\n\n> 来源：[[paper.pdf]] · PDF 第 2 页');await f.fit.flush();assert.equal(f.jobs[0].value,f.jobs[1].value);assert.equal(f.jobs.length,2);f.fit.dispose();
});

test('native plain paragraphs with dir=auto reuse, while other paragraph attributes remain uncached',async()=>{
 for(const attributes of [[{name:'dir',value:'auto'}],[{name:'dir',value:'rtl'}],[{name:'dir',value:'ltr'}],[{name:'dir',value:'auto'},{name:'class',value:'plugin-output'}]]){
  const f=fixture();f.setAttributes(attributes);for(let i=0;i<2;i++){f.fit.schedule(metadata(i));await f.fit.flush();}assert.equal(f.jobs.length,attributes.length===1&&attributes[0].value==='auto'?1:2,JSON.stringify(attributes));f.fit.dispose();
 }
});

test('dynamic Markdown and unexpected rendered elements or text always use the renderer',async()=>{
 for(const body of ['![[note]]','![image](image.png)','<div>HTML</div>','```plugin\nvalue\n```','$x$','[[note]]','[label](target)','**formatted**']){const f=fixture();for(let i=0;i<2;i++){f.fit.schedule(metadata(i,body));await f.fit.flush();}assert.equal(f.jobs.length,2,body);assert.equal(f.styleReads,0,'rich Markdown must not pay for optional static-cache context reads');f.fit.dispose();}
 for(const shape of ['IMG','IFRAME','SPAN','PRE','A']){const f=fixture();f.setShape(shape);for(let i=0;i<2;i++){f.fit.schedule(metadata(i));await f.fit.flush();}assert.equal(f.jobs.length,2,shape);f.fit.dispose();}
 for(const name of ['class','style','id','data-plugin']){const f=fixture();f.setAttributes([{name,value:'dynamic'}]);for(let i=0;i<2;i++){f.fit.schedule(metadata(i));await f.fit.flush();}assert.equal(f.jobs.length,2,name);f.fit.dispose();}
 const f=fixture();f.changeRenderedText();for(let i=0;i<2;i++){f.fit.schedule(metadata(i));await f.fit.flush();}assert.equal(f.jobs.length,2);f.fit.dispose();
});

test('failed or invalid measurements are never cached, and a later successful static measurement is reusable',async()=>{
 const f=fixture('card','pending');f.fit.schedule(metadata(0));let pending=f.fit.flush();f.jobs[0].gate.reject(Error('renderer failure'));await pending;
 f.fit.schedule(metadata(1));pending=f.fit.flush();assert.equal(f.jobs.length,2);f.jobs[1].gate.resolve();await pending;f.fit.schedule(metadata(2));pending=f.fit.flush();assert.equal(f.jobs.length,2);await pending;f.fit.dispose();
 const invalid=fixture();invalid.setSize({width:NaN,height:180});invalid.fit.schedule(metadata(0));await invalid.fit.flush();invalid.setSize({width:300,height:180});invalid.fit.schedule(metadata(1));await invalid.fit.flush();assert.equal(invalid.jobs.length,2);assert.equal(invalid.stats().applies,1);invalid.fit.dispose();
});

test('reuse keeps only the last successful presentation and is isolated to one editor lifetime',async()=>{
 const f=fixture();for(const value of [metadata(0,'First'),metadata(1,'Second'),metadata(2,'First')]){f.fit.schedule(value);await f.fit.flush();}assert.equal(f.jobs.length,3,'undo to an older presentation cannot use a multi-entry cache');f.fit.dispose();f.fit.schedule(metadata(3));await f.fit.flush();assert.equal(f.jobs.length,3);
 const next=fixture();next.fit.schedule(metadata(0,'First'));await next.fit.flush();assert.equal(next.jobs.length,1);next.fit.dispose();
});

test('an unscheduled font change while a static renderer is pending cannot cache or apply its old dimensions',async()=>{
 const f=fixture('card','pending');f.fit.schedule(metadata(0));const pending=f.fit.flush();f.typography.fontSize='28px';f.jobs[0].gate.resolve();await pending;assert.equal(f.stats().applies,0);assert.equal(f.stats().measures,0);
 f.fit.schedule(metadata(1));const retry=f.fit.flush();assert.equal(f.jobs.length,2);f.jobs[1].gate.resolve();await retry;assert.equal(f.stats().applies,1);f.fit.dispose();
});

for(const kind of ['card','text'] as const)for(const phase of ['render','math'] as const)test(`${kind}: newer ${phase} measurement starts at its debounce without waiting for the obsolete deadline`,async()=>{
 const f=fixture(kind,phase==='math'?'math':'pending');f.fit.schedule(phase==='math'?'old $$x$$':'old');const pending=f.fit.flush();await tick();f.advance(40);f.fit.schedule('latest');f.advance(159);await tick();assert.equal(f.jobs.length,1);assert.equal(f.jobs[0].scope.loaded,true);
 f.advance(160);await tick();assert.equal(f.jobs.length,2);assert.equal(f.jobs[1].time,160);assert.equal(f.jobs[0].scope.loaded,phase==='render');assert.equal(f.stats().removes,phase==='math'?2:1);assert.equal(f.stats().applies,phase==='math'?1:0);
 if(phase==='render'){f.jobs[0].gate.reject(Error('late old renderer'));await tick();assert.equal(f.jobs[1].scope.loaded,true);assert.equal(f.stats().applies,0);f.jobs[1].gate.resolve();}else f.mathJobs[0].resolve();await pending;await tick();assert.equal(f.stats().applies,1);assert.equal(f.stats().loads,f.stats().unloads);assert.equal(f.timers.size,0);f.fit.dispose();
});

for(const kind of ['card','text'] as const)test(`${kind}: concurrent same-revision flushes share the existing renderer until completion`,async()=>{
 const f=fixture(kind,'pending');f.fit.schedule('same');const first=f.fit.flush(),second=f.fit.flush();await tick();assert.equal(f.jobs.length,1);assert.equal(f.jobs[0].scope.loaded,true);assert.equal(f.stats().unloads,0);f.jobs[0].gate.resolve();await Promise.all([first,second]);assert.equal(f.stats().applies,1);f.fit.dispose();
});

for(const kind of ['card','text'] as const)test(`${kind}: a superseded renderer keeps native late registrations and pre-registered children until it settles`,async()=>{
 const f=fixture(kind,'pending');let cleaned=0;f.fit.schedule('old');const old=f.fit.flush();f.advance(40);f.fit.schedule('latest');f.advance(160);await tick();assert.equal(f.jobs.length,2);assert.equal(f.stats().removes,1);
 const oldScope=f.jobs[0].scope;oldScope.register(()=>cleaned++);const child=new f.Scope();child.register(()=>cleaned++);oldScope.addChild(child);assert.equal(oldScope.loaded,true);assert.equal(child.loaded,true);
 f.jobs[0].gate.resolve();await tick();assert.equal(cleaned,2);assert.equal(oldScope.loaded,false);assert.equal(child.loaded,false);assert.equal(f.jobs[1].scope.loaded,true);f.jobs[1].gate.resolve();await old;f.fit.dispose();assert.equal(f.timers.size,0);
});

for(const kind of ['card','text'] as const)test(`${kind}: a superseded native scope never extends its original deadline`,async()=>{
 const f=fixture(kind,'pending');f.fit.schedule('old');const old=f.fit.flush();f.advance(40);f.fit.schedule('latest');f.advance(160);await tick();f.advance(999);await tick();assert.equal(f.jobs[0].scope.loaded,true);f.advance(1000);await tick();assert.equal(f.jobs[0].scope.loaded,false);assert.equal(f.jobs[1].scope.loaded,true);assert.equal(f.stats().unloads,1);
 f.jobs[1].gate.resolve();await old;f.jobs[0].gate.resolve();await tick();assert.equal(f.stats().unloads,2);f.fit.dispose();assert.equal(f.timers.size,0);
});

for(const kind of ['card','text'] as const)test(`${kind}: repeated stalled drafts keep native scopes bounded by debounce and deadline, including after close`,async()=>{
 const f=fixture(kind,'pending');const waits:Promise<void>[]=[];let peak=0;f.fit.schedule('draft 0');waits.push(f.fit.flush());
 for(let i=1;i<=100;i++){f.fit.schedule(`draft ${i}`);f.advance(i*120);await tick();const stats=f.stats();peak=Math.max(peak,stats.loads-stats.unloads);assert.equal(stats.holders-stats.removes,1);assert.ok(stats.loads-stats.unloads<=9);}
 assert.equal(f.jobs.length,101);assert.equal(peak,9);f.fit.dispose();await Promise.all(waits);assert.equal(f.stats().holders,f.stats().removes);f.advance(13000);await tick();assert.equal(f.stats().loads,f.stats().unloads);assert.equal(f.timers.size,0);for(const job of f.jobs)job.gate.resolve();await tick();assert.equal(f.stats().loads,f.stats().unloads);assert.equal(f.stats().applies,0);
});
