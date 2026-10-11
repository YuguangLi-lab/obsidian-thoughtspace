import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as materials from '../src/materials';

type Options={cls?:string;text?:string;attr?:Record<string,string>;type?:string;value?:string};
type Document={body:Element;activeElement:Element|null};
class Element {
 children:Element[]=[];parentElement:Element|null=null;dataset:Record<string,string>={};attributes:Record<string,string>={};classes=new Set<string>();
 value='';disabled=false;checked=false;draggable=false;tabIndex=0;scrollTop=0;selectionStart=0;selectionEnd=0;open=false;text='';focuses=0;bindings=0;
 style:Record<string,string>={};onclick?:()=>unknown;oninput?:()=>void;onchange?:()=>void;
 classList={toggle:(name:string,on:boolean)=>{if(on)this.classes.add(name);else this.classes.delete(name);},add:(name:string)=>this.classes.add(name),remove:(name:string)=>this.classes.delete(name),contains:(name:string)=>this.classes.has(name)};
 constructor(readonly tagName:string,readonly ownerDocument:Document,options:Options|string={}){const opts=typeof options==='string'?{cls:options}:options;for(const name of (opts.cls||'').split(/\s+/).filter(Boolean))this.classes.add(name);this.text=opts.text||'';this.value=opts.value||'';this.attributes={...opts.attr};if(opts.type)this.attributes.type=opts.type;for(const[key,value]of Object.entries(this.attributes))if(key.startsWith('data-'))this.dataset[key.slice(5)]=value;}
 createEl(tag:string,options:Options|string={}){const child=new Element(tag.toUpperCase(),this.ownerDocument,options);child.parentElement=this;this.children.push(child);return child;}
 createDiv(options:Options|string={}){return this.createEl('div',options);}createSpan(options:Options|string={}){return this.createEl('span',options);}
 addClass(...names:string[]){for(const name of names)this.classes.add(name);}removeClass(name:string){this.classes.delete(name);}setAttribute(name:string,value:string){this.attributes[name]=value;}
 setText(text:string){this.empty();this.text=text;}empty(){if(this.ownerDocument.activeElement&&this.children.some(child=>child.contains(this.ownerDocument.activeElement)))this.ownerDocument.activeElement=this.ownerDocument.body;for(const child of this.children)child.parentElement=null;this.children=[];this.text='';}
 contains(element:Element|null):boolean{return element===this||this.children.some(child=>child.contains(element));}
 all():Element[]{return this.children.flatMap(child=>[child,...child.all()]);}
 matches(selector:string):boolean{const tag=selector.match(/^[\w-]+/)?.[0],classes=[...selector.matchAll(/\.([\w-]+)/g)].map(match=>match[1]),attribute=selector.match(/\[([\w-]+)=([^\]]+)\]/);return(!tag||this.tagName===tag.toUpperCase())&&classes.every(name=>this.classes.has(name))&&(!attribute||this.attributes[attribute[1]]===attribute[2]);}
 querySelectorAll(selector:string):Element[]{return this.all().filter(element=>selector.split(',').some(part=>{const chain=part.trim().split(/\s+/);if(!element.matches(chain.pop()!))return false;let parent=element.parentElement;while(chain.length){const previous=chain.pop()!;while(parent&&!parent.matches(previous))parent=parent.parentElement;if(!parent)return false;parent=parent.parentElement;}return true;}));}
 querySelector(selector:string){return this.querySelectorAll(selector)[0];}
 focus(){this.focuses++;this.ownerDocument.activeElement=this;}click(){if(!this.disabled)return this.onclick?.();}scrollIntoView(){}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
}
class Component {load(){}unload(){}registerEvent(){}registerDomEvent(){}}
class TFile {stat={size:500};basename:string;constructor(readonly path:string){this.basename=path.split('/').at(-1)!.replace(/\.md$/,'');}}
const source=readFileSync('src/materials-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
let previews=0;
const deps={...materials,Component,TFile,Modal:class{},Notice:class{},setIcon(){},themeSurface(){},bindMobileViewport:(root:Element)=>{root.bindings++;return()=>{root.bindings--;};},MarkdownRenderer:{render:async()=>{previews++;}}};
const MaterialsWorkbench=new Function(...Object.keys(deps),transformSync(source+'\nreturn MaterialsWorkbench;',{loader:'ts'}).code)(...Object.values(deps));
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(){
 const doc={} as Document;doc.activeElement=null;doc.body=new Element('BODY',doc);const modalEl=doc.body.createDiv(),titleEl=modalEl.createEl('h2'),contentEl=modalEl.createDiv();
 const file=new TFile('Materials/Source.md'),raw='# 研究\n\n第一段证据。\n\n## 行动\n\n第二段材料。';
 const calls:unknown[][]=[];let importer=(...args:unknown[])=>{calls.push(args);return Promise.resolve({files:['Notes/Excerpt.md'],boardPath:'Boards/Target.thoughtspace',ids:['excerpt']});};
 const adapter={docked:true,target:()=>({name:'目标',path:'Boards/Target.thoughtspace'}),pick(){},open(){},outline(){},excerpts:(...args:unknown[])=>importer(...args)};
 const app={vault:{read:async()=>raw,on:()=>({}),getAbstractFileByPath:(path:string)=>path===file.path?file:undefined}};
 const workbench=new MaterialsWorkbench(app,adapter,modalEl,contentEl,titleEl,()=>{});workbench.reading=false;workbench.onOpen();
 const find=(label:string,root=contentEl)=>{const el=root.all().find(element=>element.attributes['aria-label']===label);assert.ok(el,`Missing ${label}`);return el;};
 const body=()=>contentEl.querySelector('.ts-materials-body')!;
 return{doc,modalEl,contentEl,file,workbench,find,body,calls,setImporter:(next:typeof importer)=>{importer=next;}};
}

test('material pane switching retains the same editor, draft, selection and scroll during compact navigation',()=>{
 const f=fixture();f.find('大纲转导图').click();const input=f.find('Markdown 大纲');input.value='# 保留草稿\n- 子节点';input.oninput?.();input.selectionStart=2;input.selectionEnd=6;input.scrollTop=80;
 const library=f.body().querySelector('.ts-materials-library')!,detail=f.body().querySelector('.ts-materials-detail')!;library.scrollTop=44;detail.scrollTop=120;const rendered=previews;
 f.find('结构预览').click();assert.equal(f.body().dataset.pane,'detail');f.find('编辑大纲').click();
 assert.equal(f.find('Markdown 大纲'),input);assert.equal(input.value,'# 保留草稿\n- 子节点');assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,6);assert.equal(input.scrollTop,80);assert.equal(library.scrollTop,44);assert.equal(detail.scrollTop,120);assert.equal(previews,rendered);
});

test('excerpt preview and outline editor remember their own compact panes without hiding a new outline draft',async()=>{
 const f=fixture();await f.workbench.load(f.file);const title=f.body().querySelector('.ts-materials-fragment-title')!;title.click();assert.equal(f.body().dataset.pane,'detail');
 f.find('大纲转导图').click();assert.equal(f.body().dataset.pane,'library');f.find('Markdown 大纲').value='# 手机草稿\n- 分屏编辑';f.find('Markdown 大纲').oninput?.();
 f.find('摘录成笔记').click();assert.equal(f.body().dataset.pane,'detail');f.find('大纲转导图').click();assert.equal(f.body().dataset.pane,'library');assert.equal(f.find('Markdown 大纲').value,'# 手机草稿\n- 分屏编辑');
});

test('a failed touch import preserves selected fragments and text drafts, restores focus in its own window and retries once',async()=>{
 const f=fixture();await f.workbench.load(f.file);const selected=f.body().querySelector('.ts-materials-fragment input[type=checkbox]')!;selected.checked=true;selected.onchange?.();
 f.find('摘录笔记标题').value='自己的标题';f.find('摘录笔记标题').oninput?.();f.find('我的理解').value='自己的理解';f.find('我的理解').oninput?.();
 const task=deferred<{files:string[];boardPath:string;ids:string[]}>();let starts=0;f.setImporter((...args:unknown[])=>{starts++;f.calls.push(args);return task.promise;});f.find('摘录笔记标题').focus();
 f.find('创建摘录笔记').click();f.find('创建摘录笔记').click();assert.equal(starts,1);assert.equal(f.find('创建摘录笔记').disabled,true);task.reject(Error('存储失败'));await tick();
 assert.equal(f.find('摘录笔记标题').value,'自己的标题');assert.equal(f.find('我的理解').value,'自己的理解');assert.equal(f.body().querySelector('.ts-materials-fragment input[type=checkbox]')!.checked,true);assert.match(f.contentEl.querySelector('.ts-materials-error')!.text,/存储失败/);assert.ok(f.doc.activeElement?.classes.has('mod-cta'));assert.equal(f.find('创建摘录笔记').disabled,false);
 f.setImporter((...args:unknown[])=>{starts++;f.calls.push(args);return Promise.resolve({files:['Notes/Retry.md'],boardPath:'Boards/Target.thoughtspace',ids:['retry']});});f.find('创建摘录笔记').click();await tick();assert.equal(starts,2);assert.equal(f.find('摘录笔记标题').value,'');assert.equal(f.find('我的理解').value,'');assert.equal(f.body().querySelector('.ts-materials-fragment input[type=checkbox]')!.checked,false);
});

test('closing during a source read leaves the detached mobile workbench empty',async()=>{
 const f=fixture(),read=deferred<string>();f.workbench.app.vault.read=()=>read.promise;const loading=f.workbench.load(f.file);f.workbench.onClose();read.resolve('# Late source');await loading;
 assert.deepEqual(f.contentEl.children,[]);assert.equal(f.workbench.sourceFile,undefined);
});

test('closing releases viewport listeners once and stale touch controls cannot reopen a picker or import',async()=>{
 const f=fixture();await f.workbench.load(f.file);let picks=0;f.workbench.adapter.pick=()=>{picks++;};const choose=f.find('更换材料'),fragment=f.workbench.fragments[0];
 assert.equal(f.modalEl.bindings,1);f.workbench.onClose();f.workbench.onClose();assert.equal(f.modalEl.bindings,0);choose.click();await f.workbench.perform([fragment]);await f.workbench.load(f.file);
 assert.equal(picks,0);assert.deepEqual(f.calls,[]);assert.deepEqual(f.contentEl.children,[]);
});

test('scrolling a material back to the top stays at zero after switching sources',async()=>{
 const f=fixture();f.workbench.reading=true;await f.workbench.load(f.file);f.body().querySelector('.ts-materials-reader')!.scrollTop=130;f.workbench.render();
 f.body().querySelector('.ts-materials-reader')!.scrollTop=0;await f.workbench.load(new TFile('Materials/Other.md'));await f.workbench.load(f.file);
 assert.equal(f.body().querySelector('.ts-materials-reader')!.scrollTop,0);
});
