import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {textMathParts} from '../src/text-math';
import {yingjianTextParts} from '../src/yingjian';
class Element{
 children:Element[]=[];style:Record<string,string>={};dataset:Record<string,string>={};isConnected=true;ownerDocument={defaultView:{open:()=>{}}};text='';cls='';
 appendText(text:string){const child=new Element();child.text=text;this.children.push(child);}
 createSpan(options:any){return this.createEl('span',options)}
 createEl(_tag:string,options:any){const child=new Element();child.text=options.text||'';child.cls=options.cls||'';this.children.push(child);return child;}
 replaceChildren(...children:Element[]){this.children=children;this.text='';}
}
function fixture(options:{loadError?:boolean;renderError?:boolean}={}){
 const body=new Element(),registered:(()=>void)[]=[],scope={register:(fn:()=>void)=>registered.push(fn)},calls:{source:string;display:boolean}[]=[];let loads=0,finishes=0,ready=0,resolve!:()=>void,finish!:()=>void;
 const loaded=new Promise<void>((r,reject)=>{resolve=options.loadError?()=>reject(Error('unavailable')):r;}),finished=new Promise<void>(r=>{finish=r;});
 const imports:Record<string,unknown>={'./text-math':{textMathParts},'./yingjian':{yingjianTextParts},obsidian:{loadMathJax:()=>{loads++;return loaded;},renderMath:(source:string,display:boolean)=>{if(options.renderError)throw Error('invalid formula');calls.push({source,display});const el=new Element();el.text='rendered:'+source;return el;},finishRenderMath:()=>{finishes++;return finished;}}};
 const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/text-preview.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name],module,module.exports);
 const render=(text:string,enqueue?:(alive:()=>boolean,run:()=>Promise<void>)=>void)=>module.exports.renderTextPreview(body,text,scope,()=>ready++,enqueue);
 return{body,render,registered,calls,resolve,finish,loads:()=>loads,finishes:()=>finishes,ready:()=>ready};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('plain text preview uses no MathJax or async lifecycle and preserves every line',()=>{
 const f=fixture();f.render('literal **text**\n第二行\n');assert.equal(f.loads(),0);assert.equal(f.registered.length,0);assert.equal(f.body.dataset.mathStatus,'none');assert.equal(f.body.children.map(n=>n.text).join(''),'literal **text**\n第二行\n');
});
test('formula preview uses native math then measures once with source badge still at the end',async()=>{
 const f=fixture();f.render('公式 $x$\n$$y$$');f.body.appendText('SOURCE');assert.equal(f.body.dataset.mathStatus,'pending');f.resolve();await tick();assert.deepEqual(f.calls,[{source:'x',display:false},{source:'y',display:true}]);assert.equal(f.ready(),0);f.finish();await tick();assert.equal(f.ready(),1);assert.equal(f.body.dataset.mathStatus,'ready');assert.equal(f.body.children.at(-1)?.text,'SOURCE');assert.equal(f.body.children[1].children[0].text,'rendered:x');
});
test('closed or detached previews never commit asynchronous math or trigger stale auto-fit',async()=>{
 for(const stage of ['load','finish','detached']){const f=fixture();f.render('$x$');if(stage==='finish'){f.resolve();await tick();}if(stage==='detached')f.body.isConnected=false;else f.registered[0]();f.resolve();f.finish();await tick();assert.equal(f.ready(),0);assert.equal(f.body.children[0].text,'$x$');}
});
test('unavailable math engine or render failure retains editable LaTex source without partial DOM',async()=>{
 for(const options of [{loadError:true},{renderError:true}]){const f=fixture(options);f.render('$x$');f.resolve();f.finish();await tick();assert.equal(f.body.dataset.mathStatus,'error');assert.equal(f.body.children[0].text,'$x$');assert.equal(f.ready(),1);}
});

test('queued formula preview defers expensive native rendering and can cancel before work starts',async()=>{
 const f=fixture(),jobs:{alive:()=>boolean;run:()=>Promise<void>}[]=[];
 f.render('$x$',(alive,run)=>jobs.push({alive,run}));
 assert.equal(jobs.length,1);assert.equal(f.loads(),0);assert.equal(jobs[0].alive(),true);
 f.registered[0]();assert.equal(jobs[0].alive(),false);await jobs[0].run();assert.equal(f.loads(),0);assert.equal(f.ready(),0);
});
test('plain text bypasses the formula queue while queued formulas finish through it',async()=>{
 const plain=fixture();let queued=0;plain.render('hello',()=>queued++);assert.equal(queued,0);
 const f=fixture();let run!:()=>Promise<void>;f.render('$x$',(_alive,job)=>{queued++;run=job;});
 assert.equal(queued,1);assert.equal(f.loads(),0);const pending=run();f.resolve();f.finish();await pending;assert.equal(f.ready(),1);assert.equal(f.body.dataset.mathStatus,'ready');
});
