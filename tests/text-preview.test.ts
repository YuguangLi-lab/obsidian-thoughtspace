import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {parseYingjianLink,yingjianLink} from '../src/yingjian';
import {releaseEditorResource} from '../src/editor-cleanup';
import {TextDocument,TextElement} from './text-dom-fixture';
function fixture(){
 class Scope{loaded=false;cleanups:(()=>void)[]=[];register(fn:()=>void){this.cleanups.push(fn);}load(){this.loaded=true;}unload(){this.loaded=false;for(const fn of this.cleanups.splice(0))fn();}}
 const children:Scope[]=[],doc=new TextDocument(),body=doc.createElement('div'),registered:(()=>void)[]=[],scope={register:(fn:()=>void)=>registered.push(fn),addChild:(child:Scope)=>{children.push(child);child.load();},removeChild:(child:Scope)=>{child.unload();children.splice(children.indexOf(child),1);}},app={},calls:{text:string;element:TextElement;path:string;app:unknown;scope:unknown;resolve:()=>void;reject:()=>void}[]=[],finishes:(()=>void)[]=[];let ready=0;
 const imports:Record<string,unknown>={'./editor-cleanup':{releaseEditorResource},'./yingjian':{parseYingjianLink},obsidian:{Component:Scope,MarkdownRenderer:{render:(app:unknown,text:string,element:TextElement,path:string,scope:unknown)=>new Promise<void>((resolve,reject)=>calls.push({app,text,element,path,scope,resolve,reject:()=>reject(Error('renderer failed'))}))},finishRenderMath:()=>new Promise<void>(r=>finishes.push(r))}};
 const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/text-preview.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name],module,module.exports);
 const render=(text:string,enqueue?:(alive:()=>boolean,run:()=>Promise<void>)=>void)=>module.exports.renderTextPreview(body,text,scope,()=>ready++,enqueue,{app,sourcePath:'Board/Research.thoughtspace'});
 const paragraph=(job=0)=>{const p=doc.createElement('p');p.textContent='Rendered';if(calls[job].text.includes('$')){const math=doc.createElement('span');math.className='math';p.appendChild(math);}calls[job].element.appendChild(p);return p;};
 return{doc,body,render,registered,calls,finishes,paragraph,app,scope,children,ready:()=>ready};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function complete(f:ReturnType<typeof fixture>,index=0){f.calls[index].resolve();await tick();f.finishes.at(-1)?.();await tick();}
test('all text goes unchanged through native Markdown with the owning board source path and scope',async()=>{
 const f=fixture(),text='# 标题\n\n**强调** $x$\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n> [!note]\n> 笔记';f.render(text);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].text,text);assert.equal(f.calls[0].path,'Board/Research.thoughtspace');assert.equal(f.calls[0].app,f.app);assert.equal(f.calls[0].scope,f.children[0]);assert.equal(f.children[0].loaded,true);assert.equal(f.body.dataset.markdownStatus,'pending');assert.equal(f.ready(),0);
 f.paragraph();await complete(f);assert.equal(f.body.dataset.markdownStatus,'ready');assert.equal(f.body.dataset.mathStatus,'ready');assert.equal(f.body.attributes['aria-busy'],'false');assert.equal(f.ready(),1);
});
test('native render commits after math and preserves the actual source control inline after the last paragraph',async()=>{
 const f=fixture();f.render('$x$');f.body.appendChild(f.doc.createTextNode('\u2060'));const badge=f.doc.createElement('button');badge.className='ts-source-trigger';let clicked=0;badge.addEventListener('click',()=>clicked++);f.body.appendChild(badge);const p=f.paragraph();f.calls[0].resolve();await tick();assert.equal(f.ready(),0);assert.equal(badge.parentElement,f.body);f.finishes[0]();await tick();assert.equal(badge.parentElement,p);assert.equal(p.children.at(-1),badge);badge.dispatch('click');assert.equal(clicked,1);assert.equal(f.ready(),1);
});
test('unload, detached preview and superseded render cannot commit stale content or request sizing',async()=>{
 for(const stage of ['unload','detached','superseded']){const f=fixture();f.render('old');f.paragraph();if(stage==='unload')f.registered[0]();if(stage==='detached')f.body.isConnected=false;if(stage==='superseded')f.render('new');f.calls[0].resolve();await tick();assert.equal(f.finishes.length,0);assert.equal(f.ready(),0);assert.equal(f.body.children[0].textContent,stage==='superseded'?'new':'old');}
});
test('unloading during MathJax completion prevents stale commit',async()=>{const f=fixture();f.render('$x$');f.paragraph();f.calls[0].resolve();await tick();f.registered[0]();f.finishes[0]();await tick();assert.equal(f.ready(),0);assert.equal(f.body.children[0].textContent,'$x$');});
test('native render failure retains Markdown source and source control without partially rendered output',async()=>{
 const f=fixture();f.render('**editable**');f.paragraph();const badge=f.doc.createElement('button');badge.className='ts-source-trigger';f.body.appendChild(badge);f.calls[0].reject();await tick();assert.equal(f.body.dataset.markdownStatus,'error');assert.equal(f.body.children[0].textContent,'**editable**');assert.equal(badge.parentElement,f.body);assert.equal(f.ready(),1);
});
test('all Markdown uses the bounded render queue and a canceled job never invokes native rendering',async()=>{
 const f=fixture(),jobs:{alive:()=>boolean;run:()=>Promise<void>}[]=[];f.render('plain text',(alive,run)=>jobs.push({alive,run}));assert.equal(f.calls.length,0);assert.equal(jobs[0].alive(),true);f.registered[0]();assert.equal(jobs[0].alive(),false);await jobs[0].run();assert.equal(f.calls.length,0);
});
test('late images and fonts request scoped sizing and release image listeners on unload',async()=>{
 const f=fixture();let fontsDone!:()=>void;f.doc.fonts={status:'loading',ready:new Promise<void>(r=>fontsDone=r)};f.render('![[image.png]]');const image=f.doc.createElement('img');f.calls[0].element.appendChild(image);await complete(f);assert.equal(f.ready(),1);image.dispatch('load');assert.equal(f.ready(),2);fontsDone();await tick();assert.equal(f.ready(),3);f.registered.forEach(fn=>fn());assert.equal(image.listeners.get('load')!.size,0);image.dispatch('error');assert.equal(f.ready(),3);
});
test('rendered task checkboxes are read-only and valid player links retain their scoped integration',async()=>{
 const f=fixture();f.render('- [ ] 待办');const input=f.doc.createElement('input'),link=f.doc.createElement('a'),href=yingjianLink('https://youtu.be/abc',65);link.setAttribute('href',href);link.textContent='01:05';f.calls[0].element.appendChild(input);f.calls[0].element.appendChild(link);await complete(f);assert.equal(input.disabled,true);assert.equal(link.classList.contains('ts-video-timestamp'),true);let stopped=0;link.dispatch('click',{preventDefault(){},stopPropagation(){stopped++;}});assert.equal(stopped,1);assert.deepEqual(f.doc.opened,[href]);f.registered.forEach(fn=>fn());link.dispatch('click',{preventDefault(){},stopPropagation(){}});assert.equal(f.doc.opened.length,1);
});

test('plain Markdown does not initialize or wait on the math finishing path',async()=>{const f=fixture();f.render('**内容**');f.paragraph();await complete(f);assert.equal(f.finishes.length,0);assert.equal(f.body.dataset.markdownStatus,'ready');assert.equal(f.ready(),1);});

test('unloading a pending native render releases its queue slot before the renderer resolves',async()=>{
 const f=fixture(),jobs:{alive:()=>boolean;run:()=>Promise<void>}[]=[];f.render('waiting',(alive,run)=>jobs.push({alive,run}));const pending=jobs[0].run(),child=f.children[0];assert.equal(f.calls.length,1);f.registered[0]();await pending;assert.equal(child.loaded,false);assert.equal(f.children.length,0);assert.equal(f.ready(),0);assert.equal(f.body.children[0].textContent,'waiting');
});
test('a stalled native renderer times out without replacing the source or retaining its child scope',async()=>{
 const f=fixture(),jobs:{alive:()=>boolean;run:()=>Promise<void>}[]=[];let timeout!:()=>void,cleared=0;f.doc.win.setTimeout=(callback,ms)=>{assert.equal(ms,5000);timeout=callback;return 7;};f.doc.win.clearTimeout=id=>{assert.equal(id,7);cleared++;};f.render('source',(alive,run)=>jobs.push({alive,run}));const pending=jobs[0].run(),child=f.children[0];f.paragraph();timeout();await pending;assert.equal(f.body.dataset.markdownStatus,'error');assert.equal(f.body.children[0].textContent,'source');assert.equal(child.loaded,false);assert.equal(f.children.length,0);assert.equal(cleared,1);assert.equal(f.ready(),1);f.calls[0].resolve();await tick();assert.equal(f.body.children[0].textContent,'source');assert.equal(f.ready(),1);
});
test('a successful native renderer keeps its scope until replacement and clears its deadline',async()=>{
 const f=fixture();let cleared=0;f.doc.win.setTimeout=()=>3;f.doc.win.clearTimeout=id=>{assert.equal(id,3);cleared++;};f.render('first');f.paragraph();await complete(f);const child=f.children[0];assert.equal(child.loaded,true);assert.equal(cleared,1);f.render('second');assert.equal(child.loaded,false);assert.equal(f.children.length,1);f.registered.at(-1)!();await tick();assert.equal(f.children.length,0);assert.equal(cleared,2);
});

test('scope cancellation releases the preview queue while MathJax is still pending',async()=>{const f=fixture(),jobs:{alive:()=>boolean;run:()=>Promise<void>}[]=[];f.render('$x$',(alive,run)=>jobs.push({alive,run}));const pending=jobs[0].run();f.paragraph();f.calls[0].resolve();await tick();assert.equal(f.finishes.length,1);f.registered[0]();await pending;assert.equal(f.children.length,0);assert.equal(f.ready(),0);assert.equal(f.body.children[0].textContent,'$x$');});
test('replacing a ready preview releases its image listeners without unloading unrelated root controls',async()=>{const f=fixture();f.render('image');const image=f.doc.createElement('img');f.calls[0].element.appendChild(image);await complete(f);const badge=f.doc.createElement('button');badge.className='ts-source-trigger';f.body.appendChild(badge);let click=0;badge.addEventListener('click',()=>click++);assert.equal(image.listeners.get('load')!.size,1);f.render('replacement');assert.equal(image.listeners.get('load')!.size,0);badge.dispatch('click');assert.equal(click,1);assert.equal(badge.parentElement,f.body);f.registered.at(-1)!();await tick();});
