import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as renderKeys from '../src/node-render-key';
import {branchState,reflowAutomaticMindmaps,validateBranches} from '../src/mindmap';
import {branchRenderSnapshot} from '../src/branch-render';
import {childConnectionCandidates} from '../src/branch-disclosure';
import {sectionDisplayNode} from '../src/sections';
import {visibleNodes,viewportRect,markdownPreview,RenderQueue} from '../src/rendering';
import {visibleGridSize} from '../src/canvas-controls';
import {textFontFamily} from '../src/text-tools';
import {textFitsContent,textBlockPadding} from '../src/text-sizing';
import {cardDisplayTitle} from '../src/card-title-model';
import {mediaDimensions} from '../src/media-geometry';
import {foldCards} from '../src/board-tools';
import {releaseEditorResource} from '../src/editor-cleanup';
import {excerptPresentation} from '../src/excerpt-sources';

// Exercise the production BoardView render path. Only the vault, Obsidian DOM,
// renderer boundaries and queue clock are substituted; cached nodes and their
// real handlers/components survive across calls exactly as in renderBoard.
const source=readFileSync(process.env.PREVIEW_SOURCE||'src/main.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const methods=take('  private renderBoard(', '  private pdfTotals=')
 +take('  private renderPdfCard(', '  private addPorts(')
 +take('  private positionNode(', '  private applyInlineSize(')
 +take('  async setTextAutoHeight(', '  fitCards(')
 +take('  private requireOwner(', '  private canCreateBlankText(');
const sessionDeps={...model,reflowAutomaticMindmaps,validateBranches,Notice:class{}};
const Session=new Function(...Object.keys(sessionDeps),transformSync(`class Session{${take('  change(fn:', '  persist() {')}};return Session`,{loader:'ts'}).code)(...Object.values(sessionDeps));
const branchModule={exports:{} as typeof import('../src/branch-controls')};
new Function('require','module','exports',transformSync(readFileSync('src/branch-controls.ts','utf8'),{loader:'ts',format:'cjs'}).code)(
 (name:string)=>{assert.equal(name,'obsidian');return{setIcon:()=>{}};},branchModule,branchModule.exports);
const keys={...renderKeys};
if(process.env.PREVIEW_KEY_SOURCE){
 const old=readFileSync(process.env.PREVIEW_KEY_SOURCE,'utf8').replace(/^import[^\n]+\n/gm,'').replace(/export /g,'');
 keys.nodeRenderKey=new Function(transformSync(`${old};return nodeRenderKey`,{loader:'ts'}).code)();
}

type Options=string|{cls?:string;text?:string;attr?:Record<string,string>;href?:string};
class Dom {
 parent?:Dom;children:Dom[]=[];classes=new Set<string>();attrs=new Map<string,string>();dataset:Record<string,string>={};
 textContent='';root=false;clientWidth=1000;clientHeight=700;naturalWidth=640;naturalHeight=320;complete=false;
 disabled=false;onclick?:()=>void;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
 readonly style=Object.assign({left:'',top:'',width:'',height:'',borderStyle:'',borderWidth:'',fontFamily:'',fontSize:'',textAlign:'',transform:'',backgroundSize:'',backgroundPosition:''},{
  getPropertyValue:(key:string)=>this.css.get(key)||'',setProperty:(key:string,value:string)=>this.css.set(key,value),removeProperty:(key:string)=>this.css.delete(key)});
 readonly css=new Map<string,string>();
 readonly ownerDocument={win:{setTimeout:()=>0,clearTimeout:()=>{},createDiv:()=>new Dom()}};
 readonly classList={contains:(name:string)=>this.classes.has(name),add:(...names:string[])=>names.forEach(n=>this.classes.add(n)),remove:(...names:string[])=>names.forEach(n=>this.classes.delete(n)),toggle:(name:string,on?:boolean)=>{const active=on??!this.classes.has(name);this.toggleClass(name,active);return active;}};
 constructor(readonly tag='div',options:Options={}){const o=typeof options==='string'?{cls:options}:options;for(const cls of (o.cls||'').split(' ').filter(Boolean))this.classes.add(cls);this.textContent=o.text||'';for(const[k,v]of Object.entries(o.attr||{}))this.setAttribute(k,v);}
 get isConnected():boolean{return this.root||!!this.parent?.isConnected;}
 get className(){return [...this.classes].join(' ');}set className(value:string){this.classes=new Set(value.split(/\s+/).filter(Boolean));}
 get childElementCount(){return this.children.length;}
 get childNodes(){return this.children;}
 get lastElementChild():Dom|null{return this.children.at(-1)||null;}
 get nextSibling():Dom|null{return this.parent?.children[this.parent.children.indexOf(this)+1]||null;}
 get nextElementSibling():Dom|null{return this.nextSibling;}
 toggleClass(name:string,on:boolean){if(on)this.classes.add(name);else this.classes.delete(name);}
 addClass(...names:string[]){this.classList.add(...names);}
 removeClass(...names:string[]){this.classList.remove(...names);}
 setAttribute(name:string,value:string){this.attrs.set(name,value);if(name==='data-id')this.dataset.id=value;}
 getAttribute(name:string){return this.attrs.get(name)||null;}
 removeAttribute(name:string){this.attrs.delete(name);}
 setText(value:string){this.textContent=value;}
 appendText(value:string){this.textContent+=value;}
 createEl(tag:string,options:Options={}){const child=new Dom(tag,options);child.parent=this;this.children.push(child);return child;}
 createDiv(options:Options={}){return this.createEl('div',options);}
 createSpan(options:Options={}){return this.createEl('span',options);}
 remove(){if(this.parent)this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=undefined;}
 empty(){for(const c of [...this.children])c.remove();this.textContent='';}
 replaceChildren(...children:Dom[]){this.empty();for(const child of children){child.remove();child.parent=this;this.children.push(child);}}
 insertBefore(child:Dom,before:Dom|null){child.remove();const index=before?this.children.indexOf(before):-1;this.children.splice(index<0?this.children.length:index,0,child);child.parent=this;}
 matches(selector:string){return selector.split(',').some(s=>s.startsWith('.')?s.slice(1).split('.').every(c=>this.classes.has(c)):s===this.tag);}
 querySelectorAll(selector:string):Dom[]{return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0]||null;}
 contains(other:Dom):boolean{return this===other||this.children.some(c=>c.contains(other));}
 addEventListener(){}removeEventListener(){}
}
class File {
 stat={mtime:100,size:200};basename:string;
 constructor(readonly path:string){this.basename=path.replace(/\.[^.]+$/,'');}
}
class Scope {
 unloaded=0;disposals:(()=>void)[]=[];children:Scope[]=[];load(){}
 addChild(child:Scope){this.children.push(child);child.load();}
 removeChild(child:Scope){this.children=this.children.filter(item=>item!==child);child.unload();}
 register(fn:()=>void){this.disposals.push(fn);}
 unload(){this.unloaded++;for(const fn of this.disposals.splice(0))fn();}
}
class Queue {
 added=0;jobs:{alive:()=>boolean;run:()=>Promise<void>}[]=[];
 add(alive:()=>boolean,run:()=>Promise<void>){this.added++;this.jobs.push({alive,run});}
 async drain(){for(const job of this.jobs.splice(0))if(job.alive())await job.run();}
}
const node=(kind:model.Card['kind'],patch:Partial<model.Card>={}):model.Card=>({id:'node',kind,x:10,y:20,width:300,height:180,color:'sand',...({card:{file:'note.md'},text:{text:'Visible text'},image:{file:'photo.png'},pdf:{file:'book.pdf'},board:{file:'child.thoughtspace'},section:{title:'Group'}}[kind]),...patch});
function fixture(kind:model.Card['kind']='card',patch:Partial<model.Card>={}){
 const n=node(kind,patch),board={...model.emptyBoard(),version:3 as const,nodes:[n]},files=new Map<string,File>(),metadata={frontmatter:{} as Record<string,unknown>,tags:[] as string[]};
 if(n.file)files.set(n.file,new File(n.file));
 const calls={metadata:0,tags:0,childCandidates:0,read:0,markdown:0,pdf:0,textFit:0,cardFit:0,mediaFits:[] as {node:model.Card;size:{width:number;height:number}}[]};
 const world=new Dom();world.root=true;const svg=world.createEl('svg'),previewQueue=new Queue(),pdfPreviewQueue=new Queue();
 const session={board,blocked:false,file:new File('board.thoughtspace')};
 const deps={textBlockPadding,...model,...keys,renderBranchControls:branchModule.exports.renderBranchControls,branchState,branchRenderSnapshot,childConnectionCandidates:(board:model.Board,roots?:ReadonlySet<string>)=>{calls.childCandidates++;return childConnectionCandidates(board,roots);},sectionDisplayNode,visibleNodes,viewportRect,markdownPreview,visibleGridSize,textFontFamily,textFitsContent,cardDisplayTitle,mediaDimensions,
  TFile:File,Component:Scope,Element:Dom,getAllTags:(cache:{tags?:string[]})=>{calls.tags++;return cache.tags||null;},setIcon:()=>{},
  button:(host:Dom,label:string,_icon:string,fn:()=>void,cls='')=>{const el=host.createEl('button',{cls,attr:{'aria-label':label}});el.createSpan();el.createSpan({text:label});el.onclick=fn;return el;},
  bindCardTitle:()=>()=>{},readProperties:(fm:Record<string,unknown>)=>({status:fm.thoughtspace_status}),statuses:{done:'完成'},isOverdue:()=>false,localDay:()=>'',
  textExcerptPresentation:(body:string)=>({body,sources:[]}),excerptPresentation:(body:string)=>({body,sources:[]}),renderTextPreview:(body:Dom,text:string)=>{body.appendText(text);body.dataset.mathStatus='none';},fitTextNode:(node:model.Card)=>{node.height=420;},remoteImageUrl:()=>undefined,
  pdfSubpath:(page:number)=>`#page=${page}`,loadPdfJs:()=>{},
  MarkdownRenderer:{async render(_app:unknown,body:string,host:Dom){calls.markdown++;host.createDiv({cls:'rendered-content',text:body});}},
  renderPdfThumbnail:async(options:{host:Dom;onSize:(size:{width:number;height:number})=>void;alive:()=>boolean})=>{calls.pdf++;if(!options.alive())return;options.host.createEl('canvas');options.onSize({width:640,height:320});return{total:12};}
 };
 const cardPreviewModule={exports:{} as typeof import('../src/card-preview')};
 const previewImports:Record<string,unknown>={obsidian:{Component:Scope,MarkdownRenderer:deps.MarkdownRenderer},'./editor-cleanup':{releaseEditorResource},'./excerpt-sources':{excerptPresentation},'./rendering':{markdownPreview}};
 const scopeModule={exports:{}};new Function('require','module','exports',transformSync(readFileSync('src/preview-render-scope.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>previewImports[name],scopeModule,scopeModule.exports);previewImports['./preview-render-scope']=scopeModule.exports;
 new Function('require','module','exports',transformSync(readFileSync('src/card-preview.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>previewImports[name],cardPreviewModule,cardPreviewModule.exports);
 const allDeps={...deps,...cardPreviewModule.exports};
 const View=new Function(...Object.keys(allDeps),transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(...Object.values(allDeps));
 const view=new View();Object.assign(view,{session,world,svg,stage:new Dom(),contentEl:new Dom(),zoomLabel:new Dom(),selected:new Set(),positions:new Map(),nodeScopes:new Map(),nodeKeys:new Map(),pdfTotals:new Map(),previewQueue,pdfPreviewQueue,
  plugin:{settings:{gridStep:24,previewLimit:20,detailZoom:.4}},
  app:{vault:{getAbstractFileByPath:(path:string)=>files.get(path),getResourcePath:(file:File)=>file.path,async cachedRead(){calls.read++;return 'Rendered **note**';}},metadataCache:{getFileCache:()=>{calls.metadata++;return metadata;}}},
  displayBoard:()=>board,updateBackToContent(){},syncCanvasControls(){},updateObjectFilter(){},renderSaveStatus(){},renderNavigation(){},renderEdges(){},renderInspector(){},renderMinimap(){},addPorts(){},
  queueTextFit(){calls.textFit++;},queueCardFit(){calls.cardFit++;},queueNodeFit(fitNode:model.Card,size:{width:number;height:number}){calls.mediaFits.push({node:fitNode,size});}
 });
 const render=()=>view.renderBoard(),element=()=>view.positions.get(n.id) as Dom,scope=()=>view.nodeScopes.get(n.id) as Scope;
 const replace=(changes:Partial<model.Card>)=>{board.nodes[0]={...board.nodes[0],...changes};render();};
 const drain=async()=>{await previewQueue.drain();await pdfPreviewQueue.drain();};
 render();return{view,board,session,calls,metadata,files,previewQueue,pdfPreviewQueue,render,element,scope,replace,drain};
}

for(const kind of ['card','text','image','pdf'] as const)test(`${kind}: appearance changes retain mounted content and renderer scope`,async()=>{
 const f=fixture(kind);await f.drain();const el=f.element(),scope=f.scope(),children=[...el.children],before={read:f.calls.read,markdown:f.calls.markdown,pdf:f.calls.pdf,textFit:f.calls.textFit};
 const patches:Partial<model.Card>[]=[{color:'blue'},{customBorder:true},{borderStyle:'dashed'}];
 if(kind==='card'||kind==='text')patches.push({fillColor:'#abc123'},{transparent:true},{textColor:'rose'});
 for(const patch of patches){f.replace(patch);assert.equal(f.element(),el,`${kind} ${JSON.stringify(patch)} must not recreate preview`);assert.equal(f.scope(),scope);assert.deepEqual(el.children,children);}
 await f.drain();assert.equal(scope.unloaded,0);assert.deepEqual({read:f.calls.read,markdown:f.calls.markdown,pdf:f.calls.pdf,textFit:f.calls.textFit},before);
 assert.equal(el.classes.has('ts-color-blue'),true);assert.equal(el.classes.has('ts-color-sand'),false);assert.equal(el.classes.has('has-custom-border'),true);assert.equal(el.style.borderStyle,'dashed');
 if(kind==='card'||kind==='text'){assert.equal(el.css.get('--ts-card-fill'),'#abc123');assert.equal(el.classes.has('is-transparent'),true);assert.equal(el.dataset.ink,'rose');}
 f.replace({color:'sand',customBorder:false,borderStyle:undefined,fillColor:undefined,transparent:false,textColor:undefined});
 assert.equal(f.element(),el);assert.equal(el.classes.has('ts-color-blue'),false);assert.equal(el.classes.has('ts-color-sand'),true);assert.equal(el.style.borderStyle,'');assert.equal(el.classes.has('has-card-fill'),false);assert.equal(el.classes.has('is-transparent'),false);if(kind==='card'||kind==='text')assert.equal(el.dataset.ink,'default');
});

for(const kind of ['card','pdf'] as const)test(`${kind}: recoloring an awaiting preview does not enqueue duplicate work`,async()=>{
 const f=fixture(kind),el=f.element(),scope=f.scope(),queue=kind==='card'?f.previewQueue:f.pdfPreviewQueue;
 for(const color of model.colors)f.replace({color});
 assert.equal(f.element(),el);assert.equal(f.scope(),scope);assert.equal(queue.added,1);assert.equal(queue.jobs.length,1);await f.drain();
 assert.equal(scope.unloaded,0);assert.equal(kind==='card'?f.calls.markdown:f.calls.pdf,1);assert.equal(el.querySelector(kind==='card'?'.ts-card-preview':'.ts-pdf-preview')?.getAttribute('aria-busy'),'false');
});

test('body, typography, measured dimensions and event state still invalidate mounted nodes',()=>{
 for(const kind of ['card','text','image','pdf'] as const){
  const patches:Partial<model.Card>[]=[{width:360},{height:240},{fontSize:22},{fontFamily:'serif'},{textAlign:'center'},{borderWidth:3},{locked:true},{branchFolded:true},{title:'Changed title'}];
  if(kind==='text')patches.push({text:'Different body'});if(kind==='card')patches.push({autoFit:true});if(kind==='image')patches.push({imageUrl:'https://example.com/image.png'});
  for(const patch of patches){const measuringCard=kind==='card'&&('width' in patch||'height' in patch);const f=fixture(kind,measuringCard?{autoFit:true}:{}),el=f.element(),scope=f.scope();f.replace(patch);assert.notEqual(f.element(),el,`${kind} ${JSON.stringify(patch)} must invalidate`);assert.equal(el.isConnected,false);assert.equal(scope.unloaded,1);}
 }
});

test('file revision, metadata and availability changes refresh card and PDF content',()=>{
 for(const kind of ['card','image','pdf'] as const)for(const field of ['mtime','size','frontmatter','tags','missing'] as const){
  const f=fixture(kind),el=f.element(),scope=f.scope(),file=f.files.get(f.board.nodes[0].file!)!;
  if(field==='mtime'||field==='size')file.stat[field]++;else if(field==='frontmatter')f.metadata.frontmatter={thoughtspace_status:'done'};else if(field==='tags')f.metadata.tags=['#new'];else f.files.delete(file.path);
  f.render();assert.notEqual(f.element(),el,`${kind} ${field}`);assert.equal(scope.unloaded,1);
 }
});

test('PDF page, folded state and board locks replace stale controls and jobs',async()=>{
 for(const patch of [{pdfPage:2},{collapsed:true,height:72,expandedHeight:180},{locked:true}]){
  const f=fixture('pdf'),el=f.element(),scope=f.scope();f.replace(patch);assert.notEqual(f.element(),el);assert.equal(scope.unloaded,1);await f.drain();
  if(patch.collapsed){assert.equal(f.calls.pdf,0);assert.equal(f.element().querySelector('.ts-pdf-preview'),null);}else assert.equal(f.calls.pdf,1,'detached prior preview must not render');
 }
 const f=fixture('pdf'),el=f.element();f.session.blocked=true;f.render();assert.notEqual(f.element(),el);assert.ok(f.element().querySelectorAll('button').filter(b=>['上一页','下一页','第 1 页'].includes(b.getAttribute('aria-label')||'')).every(b=>b.disabled));
});

test('low-detail transitions and viewport eviction do not retain stale preview components',()=>{
 const f=fixture('card'),el=f.element(),scope=f.scope();f.board.viewport.zoom=.2;f.render();assert.notEqual(f.element(),el);assert.equal(scope.unloaded,1);assert.equal(f.element().classes.has('ts-node-summary'),true);
 const summary=f.element();f.replace({color:'blue'});assert.equal(f.element(),summary);assert.equal(summary.classes.has('ts-color-blue'),true);
 f.board.viewport.zoom=1;f.render();const detail=f.element(),detailScope=f.scope();assert.notEqual(detail,summary);assert.ok(detail.querySelector('.ts-card-preview'));
 f.board.viewport.x=-10000;f.render();assert.equal(f.element(),undefined);assert.equal(detailScope.unloaded,1);f.board.viewport.x=0;f.render();assert.notEqual(f.element(),detail);
});

test('appearance reuse preserves media fit geometry, while resized media dispose stale load callbacks',()=>{
 const f=fixture('image'),el=f.element(),img=el.querySelector('img')!;assert.ok(img.onload);f.replace({color:'blue'});assert.equal(f.element(),el);img.onload!();assert.deepEqual(f.calls.mediaFits.at(-1)?.size,{width:300,height:150});
 f.replace({width:500});assert.equal(img.isConnected,false);assert.equal(img.onload,null);const current=f.element().querySelector('img')!;current.onload!();assert.deepEqual(f.calls.mediaFits.at(-1)?.size,{width:500,height:250});
});

test('changing outgoing children refreshes branch controls and folding removes only descendants',()=>{
 const f=fixture('card'),el=f.element(),scope=f.scope();
 f.board.nodes.push(node('text',{id:'child',x:500}));f.board.edges.push({id:'link',from:'node',to:'child',label:''});f.render();
 const linked=f.element();assert.notEqual(linked,el);assert.equal(scope.unloaded,1);assert.ok(linked.querySelector('.ts-branch-setup'));
 f.board.edges[0].kind='branch';f.render();const parent=f.element();assert.notEqual(parent,linked);assert.equal(parent.querySelector('.ts-branch-setup'),null);assert.equal(parent.querySelector('.ts-branch-toggle')?.getAttribute('aria-expanded'),'true');
 const child=f.view.positions.get('child') as Dom,childScope=f.view.nodeScopes.get('child') as Scope;
 f.replace({branchFolded:true});assert.equal(f.element().querySelector('.ts-branch-toggle')?.getAttribute('aria-expanded'),'false');assert.equal(f.view.positions.has('child'),false);assert.equal(child.isConnected,false);assert.equal(childScope.unloaded,1);
 f.replace({branchFolded:false});assert.equal(f.view.positions.has('child'),true);assert.notEqual(f.view.positions.get('child'),child);
});

for(const autoFit of [undefined,false])test(`fixed card with autoFit=${autoFit} keeps rendered content across resize and dimension undo`,async()=>{
 const f=fixture('card',{autoFit});await f.drain();const el=f.element(),preview=el.querySelector('.ts-card-preview'),scope=f.scope(),history=new model.History();
 const initial=model.clone(f.board);history.push(initial);
 for(let i=0;i<12;i++)f.replace({width:320+i*10,height:200+i*10});
 assert.equal(f.element(),el);assert.equal(f.scope(),scope);assert.equal(el.querySelector('.ts-card-preview'),preview);assert.equal(scope.unloaded,0);
 assert.deepEqual([el.style.width,el.style.height],['430px','310px']);assert.equal(f.previewQueue.added,1);assert.equal(f.calls.read,1);assert.equal(f.calls.markdown,1);
 const resized=model.clone(f.board);Object.assign(f.board,history.undo(f.board));f.render();assert.equal(f.element(),el);assert.deepEqual([el.style.width,el.style.height],['300px','180px']);assert.deepEqual(f.board,initial);
 Object.assign(f.board,history.redo(f.board));f.render();assert.equal(f.element(),el);assert.deepEqual(f.board,resized);assert.deepEqual([el.style.width,el.style.height],['430px','310px']);await f.drain();assert.equal(f.calls.read,1);assert.equal(f.calls.cardFit,0);
});

test('a queued fixed-card preview is reused and finishes at the latest manually chosen size',async()=>{
 const f=fixture('card',{autoFit:false}),el=f.element(),scope=f.scope();
 for(const size of [{width:420,height:280},{width:520,height:330},{width:380,height:240}])f.replace(size);
 assert.equal(f.element(),el);assert.equal(f.scope(),scope);assert.equal(f.previewQueue.added,1);assert.equal(f.previewQueue.jobs.length,1);assert.equal(f.calls.read,0);
 await f.drain();assert.equal(f.calls.read,1);assert.equal(f.calls.markdown,1);assert.equal(f.calls.cardFit,0);assert.equal(scope.unloaded,0);assert.deepEqual([el.style.width,el.style.height],['380px','240px']);assert.equal(el.querySelector('.ts-card-preview')?.getAttribute('aria-busy'),'false');
});

test('resizing a fixed card during a vault read preserves the live preview without restoring captured dimensions',async()=>{
 const f=fixture('card',{autoFit:false}),el=f.element(),scope=f.scope();let resolveRead!:(body:string)=>void;
 f.view.app.vault.cachedRead=()=>{f.calls.read++;return new Promise<string>(resolve=>{resolveRead=resolve;});};
 const running=f.drain();assert.equal(f.calls.read,1);f.replace({width:450,height:325});f.replace({width:510,height:390});resolveRead('A delayed note');await running;
 assert.equal(f.element(),el);assert.equal(f.scope(),scope);assert.equal(scope.unloaded,0);assert.equal(f.previewQueue.added,1);assert.equal(f.calls.markdown,1);assert.equal(f.calls.cardFit,0);assert.deepEqual([el.style.width,el.style.height],['510px','390px']);assert.equal(el.querySelector('.rendered-content')?.textContent,'A delayed note');
});

test('switching automatic sizing and undoing it rebuilds scopes and discards the previous pending job',async()=>{
 const f=fixture('card',{autoFit:true}),automatic=f.element(),automaticScope=f.scope(),history=new model.History();history.push(f.board);
 f.replace({autoFit:false,width:420,height:320});const fixed=f.element(),fixedScope=f.scope();assert.notEqual(fixed,automatic);assert.equal(automaticScope.unloaded,1);await f.drain();assert.equal(f.calls.read,1);assert.equal(f.calls.cardFit,0);
 Object.assign(f.board,history.undo(f.board));f.render();const restored=f.element(),restoredScope=f.scope();assert.notEqual(restored,fixed);assert.equal(fixedScope.unloaded,1);assert.equal(f.board.nodes[0].autoFit,true);await f.drain();assert.equal(f.calls.cardFit,1);
 Object.assign(f.board,history.redo(f.board));f.render();const fixedAgain=f.element();assert.notEqual(fixedAgain,restored);assert.equal(restoredScope.unloaded,1);assert.equal(f.board.nodes[0].autoFit,false);await f.drain();assert.equal(f.calls.cardFit,1);assert.deepEqual([fixedAgain.style.width,fixedAgain.style.height],['420px','320px']);
});

test('folding a resized fixed card preserves its expanded size and lock invalidates its controls',()=>{
 const f=fixture('card',{autoFit:false}),initial=f.element();f.replace({width:420,height:320});assert.equal(f.element(),initial);
 foldCards(f.board,new Set(['node']),true);f.render();const folded=f.element();assert.notEqual(folded,initial);assert.equal(f.board.nodes[0].expandedHeight,320);assert.deepEqual([folded.style.width,folded.style.height],['420px','72px']);assert.equal(folded.querySelector('.ts-card-preview'),null);
 foldCards(f.board,new Set(['node']),false);f.render();const expanded=f.element();assert.notEqual(expanded,folded);assert.deepEqual([expanded.style.width,expanded.style.height],['420px','320px']);assert.ok(expanded.querySelector('.ts-card-preview'));
 f.replace({locked:true});assert.notEqual(f.element(),expanded);assert.equal(f.element().querySelector('.ts-resize'),null);assert.ok(f.element().querySelectorAll('button').find(b=>b.getAttribute('aria-label')==='折叠卡片')?.disabled);
});


test('camera-only frames skip child candidate scans while mounted previews are reused',()=>{
 const f=fixture('card'),el=f.element(),scope=f.scope();f.calls.childCandidates=0;
 for(let i=1;i<=60;i++){f.board.viewport.x=i;f.view.renderBoard(true);}
 assert.equal(f.calls.childCandidates,0);assert.equal(f.element(),el);assert.equal(f.scope(),scope);assert.equal(f.previewQueue.added,1);
 assert.equal(f.view.world.style.transform,`translate(60px, ${f.board.viewport.y}px) scale(1)`);
});

test('camera refresh builds child candidates once when new connected nodes enter the viewport',()=>{
 const f=fixture('card');f.board.nodes.push(node('text',{id:'remote',x:1600}),node('text',{id:'target',x:2000}));f.board.edges.push({id:'relation',from:'remote',to:'target',label:''});f.render();
 assert.equal(f.view.positions.has('remote'),false);f.calls.childCandidates=0;f.board.viewport.x=-1400;f.view.renderBoard(true);
 assert.equal(f.calls.childCandidates,1);assert.ok(f.view.positions.get('remote').querySelector('.ts-branch-setup'));assert.ok(f.view.positions.has('target'));assert.equal(f.view.positions.has('node'),false);
 f.board.viewport.x=-1420;f.view.renderBoard(true);assert.equal(f.calls.childCandidates,1,'unchanged mounted nodes need no additional scan');
 f.board.viewport.x=0;f.view.renderBoard(true);assert.equal(f.calls.childCandidates,2,'returning to a detached card recomputes candidates');
});

test('detail transitions and content changes continue to refresh child disclosure controls',()=>{
 const f=fixture('card');f.board.nodes.push(node('text',{id:'child',x:500}));f.board.edges.push({id:'relation',from:'node',to:'child',label:''});f.render();f.calls.childCandidates=0;
 f.board.viewport.zoom=.2;f.view.renderBoard(true);assert.equal(f.calls.childCandidates,1);assert.ok(f.element().classes.has('ts-node-summary'));assert.ok(f.element().querySelector('.ts-branch-setup'));
 f.board.viewport.zoom=.3;f.view.renderBoard(true);assert.equal(f.calls.childCandidates,1);
 f.board.viewport.zoom=1;f.view.renderBoard(true);assert.equal(f.calls.childCandidates,2);assert.ok(f.element().querySelector('.ts-card-preview'));
 f.board.edges[0].kind='branch';f.render();assert.equal(f.calls.childCandidates,3);assert.equal(f.element().querySelector('.ts-branch-setup'),null);assert.ok(f.element().querySelector('.ts-branch-toggle'));
 f.replace({branchFolded:true});assert.equal(f.view.positions.has('child'),false);f.replace({branchFolded:false});assert.equal(f.view.positions.has('child'),true);
});


test('same-note cards share metadata and tag reads within each full render only',()=>{
 const f=fixture('card');f.view.plugin.settings.previewLimit=100;
 for(let i=1;i<40;i++)f.board.nodes.push(node('card',{id:'copy-'+i,x:10+(i%4)*10,y:20+Math.floor(i/4)*10}));
 f.calls.metadata=f.calls.tags=0;f.render();assert.equal(f.view.positions.size,40);assert.equal(f.calls.metadata,1);assert.equal(f.calls.tags,1);
 const elements=new Map(f.view.positions);f.calls.metadata=f.calls.tags=0;f.render();assert.equal(f.calls.metadata,1);assert.equal(f.calls.tags,1);for(const[id,el]of elements)assert.equal(f.view.positions.get(id),el);
 f.calls.metadata=f.calls.tags=0;f.view.renderBoard(true);assert.equal(f.calls.metadata,0);assert.equal(f.calls.tags,0);
});

test('a later metadata change updates all references and their footer from fresh state',()=>{
 const f=fixture('card');f.board.nodes.push(node('card',{id:'copy',x:30}));f.render();const old=new Map(f.view.positions);
 f.metadata.frontmatter={thoughtspace_status:'done'};f.metadata.tags=['#current'];f.calls.metadata=f.calls.tags=0;f.render();
 assert.equal(f.calls.metadata,1);assert.equal(f.calls.tags,1);
 for(const[id,el]of f.view.positions as Map<string,Dom>){assert.notEqual(el,old.get(id));assert.equal(el.querySelector('.ts-state-done')?.textContent,'完成');assert.equal(el.querySelector('.ts-tag')?.textContent,'#current');}
 f.metadata.frontmatter={};f.metadata.tags=[];f.render();for(const el of f.view.positions.values() as Iterable<Dom>){assert.equal(el.querySelector('.ts-state-done'),null);assert.equal(el.querySelector('.ts-tag'),null);}
});

test('metadata is isolated by file identity and missing cache is reused only during that render',()=>{
 const f=fixture('card');const other=new File('other.md');f.files.set(other.path,other);f.board.nodes.push(node('card',{id:'other',file:other.path,x:30}),node('card',{id:'other-copy',file:other.path,x:50}));
 let missing=true;const otherCache={frontmatter:{},tags:['#other']};f.view.app.metadataCache.getFileCache=(file:File)=>{f.calls.metadata++;return file===other?(missing?null:otherCache):f.metadata;};
 f.metadata.tags=['#first'];f.calls.metadata=f.calls.tags=0;f.render();assert.equal(f.calls.metadata,2);assert.equal(f.calls.tags,2);assert.equal(f.element().querySelector('.ts-tag')?.textContent,'#first');assert.equal(f.view.positions.get('other').querySelector('.ts-tag'),null);
 const previous=f.view.positions.get('other');missing=false;f.calls.metadata=f.calls.tags=0;f.render();assert.equal(f.calls.metadata,2);assert.equal(f.calls.tags,2);assert.notEqual(f.view.positions.get('other'),previous);assert.equal(f.view.positions.get('other').querySelector('.ts-tag').textContent,'#other');assert.equal(f.element().querySelector('.ts-tag')?.textContent,'#first');
 f.files.delete(other.path);f.render();assert.ok(f.view.positions.get('other').querySelector('.ts-missing'));
 const replacement=new File(other.path);f.files.set(other.path,replacement);f.render();assert.equal(f.view.positions.get('other').querySelector('.ts-tag').textContent,'#first','new file identity must resolve current metadata');
});

test('camera refresh chooses preview priority with bounded selection reads',()=>{
 const f=fixture('text');f.board.nodes=Array.from({length:240},(_,i)=>node('text',{id:'item-'+i,x:10+(i%12),y:20+Math.floor(i/12),autoSize:false}));
 f.view.plugin.settings.previewLimit=30;f.view.selected=new Set(f.board.nodes.filter((_,i)=>i%3===1).map(n=>n.id));f.render();
 const initial=new Map(f.view.positions);let reads=0;const selected=f.view.selected as Set<string>,has=selected.has.bind(selected);selected.has=(id:string)=>{reads++;return has(id);};
 for(let i=0;i<10;i++){f.board.viewport.x=i;f.view.renderBoard(true);}
 assert.ok(reads<=240*10,`selection checks should be at most once per visible node, received ${reads}`);
 assert.ok(f.board.nodes.every(n=>f.view.positions.get(n.id)===initial.get(n.id)));
});

test('preview priority remains stable while sections stay behind other objects',()=>{
 const f=fixture('text');f.board.nodes=[node('text',{id:'a'}),node('section',{id:'s',x:0,y:0,width:600,height:400}),node('text',{id:'b'}),node('section',{id:'t',x:5,y:5,width:650,height:450}),node('text',{id:'c'})];
 const original=f.board.nodes.map(n=>n.id),detail=()=>f.board.nodes.filter(n=>n.kind!=='section'&&!f.view.positions.get(n.id).classList.contains('ts-node-summary')).map(n=>n.id),order=()=>f.view.world.children.filter((el:Dom)=>el.dataset.id).map((el:Dom)=>el.dataset.id);
 f.view.plugin.settings.previewLimit=2;f.view.selected=new Set(['c','b']);f.render();
 assert.deepEqual(detail(),['b','c']);assert.deepEqual(order(),['s','t','a','b','c']);assert.deepEqual(f.board.nodes.map(n=>n.id),original);
 f.view.selected=new Set(['c','s']);f.render();assert.deepEqual(detail(),['c'],'sections retain their original preview-budget priority');
 f.view.selected=new Set();f.view.plugin.settings.previewLimit=3;f.render();assert.deepEqual(detail(),['a','b']);assert.deepEqual(order(),['s','t','a','b','c']);
 f.board.nodes=[f.board.nodes[4],f.board.nodes[3],f.board.nodes[2],f.board.nodes[1],f.board.nodes[0]];f.render();assert.deepEqual(detail(),['c','b']);assert.deepEqual(order(),['t','s','c','b','a']);
});

test('preview promotion and demotion preserve the budget across selection and zoom changes',()=>{
 const f=fixture('text');f.board.nodes=Array.from({length:8},(_,i)=>node('text',{id:'n'+i,x:10+i,autoSize:false}));f.view.plugin.settings.previewLimit=2;f.render();
 const details=()=>f.board.nodes.filter(n=>!f.view.positions.get(n.id).classList.contains('ts-node-summary')).map(n=>n.id);
 assert.deepEqual(details(),['n0','n1']);f.view.selected=new Set(['n7','n5','n3']);f.view.renderBoard(true);assert.deepEqual(details(),['n3','n5']);
 f.board.viewport.zoom=.2;f.view.renderBoard(true);assert.deepEqual(details(),[]);
 f.board.viewport.zoom=1;f.view.plugin.settings.previewLimit=3;f.view.renderBoard(true);assert.deepEqual(details(),['n3','n5','n7']);
 f.view.selected.clear();f.view.renderBoard(true);assert.deepEqual(details(),['n0','n1','n2']);
});


test('folded text shows a single-line summary and keeps formula source for expansion',()=>{
 const f=fixture('text',{text:'标题\n$$x^2$$\n全文',collapsed:true,height:72,expandedHeight:180});
 assert.equal(f.element().querySelector('.ts-text-body')?.textContent,'标题');assert.equal(f.calls.textFit,0);assert.equal(f.element().querySelectorAll('button').some(b=>b.getAttribute('aria-label')==='展开文本'),true);assert.equal(f.element().querySelector('.ts-resize'),null);
 assert.equal(f.board.nodes[0].text,'标题\n$$x^2$$\n全文');f.replace({collapsed:undefined,height:180,expandedHeight:undefined});assert.equal(f.element().querySelector('.ts-text-body')?.textContent,'标题\n$$x^2$$\n全文');assert.equal(f.calls.textFit,1);assert.ok(f.element().querySelector('.ts-resize'));
});

test('text auto-height button sits beside fold, defaults off and reflects explicit state changes',()=>{
 const f=fixture('text'),calls:unknown[][]=[];f.view.setTextAutoHeight=(...args:unknown[])=>calls.push(args);
 const buttons=()=>f.element().querySelector('.ts-text-actions')!.children;
 const [fold,sizing]=buttons();assert.equal(fold.getAttribute('aria-label'),'折叠文本');assert.equal(fold.nextElementSibling,sizing);assert.equal(sizing.classes.has('ts-text-auto-height'),true);assert.equal(sizing.getAttribute('aria-pressed'),'false');assert.equal(sizing.classes.has('is-active'),false);
 sizing.onclick?.();assert.deepEqual(calls,[['node']]);
 const old=f.element(),oldScope=f.scope();f.replace({textAutoHeight:true});assert.notEqual(f.element(),old);assert.equal(oldScope.unloaded,1);let active=buttons()[1];assert.equal(active.getAttribute('aria-pressed'),'true');assert.equal(active.classes.has('is-active'),true);active.onclick?.();assert.deepEqual(calls,[['node'],['node']]);
 f.replace({collapsed:true,height:72,expandedHeight:180});active=buttons()[1];assert.equal(buttons()[0].getAttribute('aria-label'),'展开文本');assert.equal(active.getAttribute('aria-pressed'),'true');assert.equal(f.board.nodes[0].textAutoHeight,true);
 f.replace({textAutoHeight:false});assert.equal(buttons()[1].getAttribute('aria-pressed'),'false');assert.equal(buttons()[1].classes.has('is-active'),false);
});
test('text sizing button preserves topic defaults and respects locked or blocked boards',()=>{
 const topic=fixture('text',{topic:true});assert.equal(topic.element().querySelector('.ts-text-auto-height')!.getAttribute('aria-pressed'),'true');topic.replace({textAutoHeight:false});assert.equal(topic.element().querySelector('.ts-text-auto-height')!.getAttribute('aria-pressed'),'false');
 for(const blocked of [false,true]){const f=fixture('text',{locked:!blocked});if(blocked){f.session.blocked=true;f.render();}const actions=f.element().querySelector('.ts-text-actions')!.children;assert.equal(actions.length,2);assert.ok(actions.every(button=>button.disabled));}
});

test('the same mounted height button performs two real transactions before repaint and remains undoable',async()=>{
 const f=fixture('text',{textAutoHeight:false}),owner=f.session as typeof f.session&{history:model.History;undo:(redo?:boolean)=>void};let writes=0,paints=0;
 Object.setPrototypeOf(owner,Session.prototype);Object.assign(owner,{history:new model.History(),persist(){writes++;},emit(){paints++;}});
 f.view.pendingFits=new Map();const before=model.clone(f.board),button=f.element().querySelector('.ts-text-auto-height')!;
 const first=button.onclick?.();assert.equal(f.board.nodes[0].textAutoHeight,true);assert.equal(f.element().querySelector('.ts-text-auto-height'),button,'the original callback is still mounted before paint');
 const second=button.onclick?.();await Promise.all([first,second]);assert.equal(f.board.nodes[0].textAutoHeight,false);assert.equal(owner.history.undoStack.length,2);assert.equal(writes,2);assert.equal(paints,2);
 assert.deepEqual([f.board.nodes[0].width,f.board.nodes[0].height],[before.nodes[0].width,before.nodes[0].height]);f.render();
 assert.equal(f.element().querySelector('.ts-text-auto-height')!.getAttribute('aria-pressed'),'false');
 owner.undo();assert.equal(owner.board.nodes[0].textAutoHeight,true);f.view.displayBoard=()=>owner.board;f.render();
 const enabled=f.element().querySelector('.ts-text-auto-height')!;assert.equal(enabled.getAttribute('aria-pressed'),'true');assert.match(enabled.getAttribute('aria-label')!,/关闭自动适应高度/);
 await enabled.onclick?.();f.render();const disabled=f.element().querySelector('.ts-text-auto-height')!;assert.equal(owner.board.nodes[0].textAutoHeight,false);assert.equal(disabled.getAttribute('aria-pressed'),'false');assert.match(disabled.getAttribute('aria-label')!,/保持宽度/);
});

test('production card jobs release shared queue slots when their nodes are removed during file reads',async()=>{
 const queue=new RenderQueue(),cards=Array.from({length:4},()=>fixture('card')),resolves:((value:string)=>void)[]=[];
 for(const f of cards){f.view.app.vault.cachedRead=()=>new Promise<string>(resolve=>resolves.push(resolve));const job=f.previewQueue.jobs.shift()!;queue.add(job.alive,job.run);}
 assert.equal(queue.active,4);for(const f of cards){f.element().remove();f.scope().unload();}queue.clear();let next=0;queue.add(()=>true,async()=>{next++;});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(next,1);assert.equal(queue.active,0);assert.equal(queue.pending,0);for(const resolve of resolves)resolve('late Markdown');await new Promise(resolve=>setImmediate(resolve));
 assert.ok(cards.every(f=>f.calls.markdown===0));assert.ok(cards.every(f=>f.calls.cardFit===0));
});
