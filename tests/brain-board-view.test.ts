import {renderBoardSaveFeedback} from '../src/board-save-feedback';
import {bindBoardHostInset} from '../src/board-chrome';
import {brainIdeaNode} from '../src/brain-board-idea';
import * as descendants from '../src/brain-board-descendants';
import * as ports from '../src/brain-board-ports';
import {LocalRelationMotion} from '../src/local-relations-motion';
import test from 'node:test';
import {BrainRefreshCache} from '../src/brain-refresh-cache';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as state from '../src/board-mindmap';
import * as relations from '../src/local-relations';
import * as layout from '../src/brain-board-layout';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as geometry from '../src/relation-geometry-checkpoint';
import * as brain from '../src/brain-board';
import * as creation from '../src/brain-board-create';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {emptyBoard,clone,type Board,type Card} from '../src/model';
import * as brainColors from '../src/brain-colors';
import * as readingPositions from '../src/brain-reading-positions';

class Doc {
 body?:El;querySelector(selector:string){return this.body?.querySelector(selector)??null;}
 listeners=new Map<string,Set<(e:any)=>void>>();
 focused=true;hasFocus(){return this.focused;}
 activeElement:El|null=null;frames=new Map<number,()=>void>();counter=0;timers=new Map<number,()=>void>();
 defaultView={listeners:new Map<string,Set<(e:any)=>void>>(),closed:false,setTimeout:(fn:()=>void)=>{const id=++this.counter;this.timers.set(id,fn);return id;},clearTimeout:(id:number)=>this.timers.delete(id),matchMedia:()=>({matches:false}),requestAnimationFrame:(fn:()=>void)=>{const id=++this.counter;this.frames.set(id,fn);return id;},cancelAnimationFrame:(id:number)=>this.frames.delete(id),getComputedStyle:(el:El)=>({display:el.hidden?'none':'flex',visibility:'visible'}),addEventListener:(type:string,fn:(e:any)=>void)=>{const events=this.defaultView.listeners.get(type)??new Set();events.add(fn);this.defaultView.listeners.set(type,events);},removeEventListener:(type:string,fn:(e:any)=>void)=>this.defaultView.listeners.get(type)?.delete(fn)};
 tick(){const frames=[...this.frames.values()];this.frames.clear();for(const fn of frames)fn();}
}
class El {
 children:El[]=[];parentElement:El|null=null;dataset:Record<string,string>={};attrs:Record<string,string>={};classes=new Set<string>();listeners=new Map<string,Set<(e:any)=>void>>();hidden=false;disabled=false;visible=true;title='';text='';value='';style:Record<string,any>={getPropertyValue(name:string){return this[name]||'';},setProperty(name:string,value:string){this[name]=value;},removeProperty(name:string){delete this[name];}};scrollTop=0;scrollLeft=0;clientTop=0;clientHeight=400;clientWidth=600;scrollHeight=400;scrollWidth=600;scrollRequests:unknown[]=[];scrollIntoView(options:unknown){this.scrollRequests.push(options);for(const parent of this.ancestors())parent.scrollTop+=40;}
 onclick:((event:any)=>void)|null=null;onpointerdown:((event:any)=>void)|null=null;oninput:((event:any)=>void)|null=null;onkeydown:((event:any)=>void)|null=null;
 classList={add:(...values:string[])=>values.forEach(value=>this.classes.add(value)),remove:(...values:string[])=>values.forEach(value=>this.classes.delete(value)),contains:(value:string)=>this.classes.has(value),toggle:(value:string,force?:boolean)=>{const on=force??!this.classes.has(value);if(on)this.classes.add(value);else this.classes.delete(value);return on;}};
 constructor(readonly tagName:string,public ownerDocument:Doc,options:any={}){if(typeof options==='string')options={cls:options};this.text=options.text||'';for(const cls of (options.cls||'').split(' ').filter(Boolean))this.classes.add(cls);for(const [key,value]of Object.entries(options.attr||{}))this.setAttribute(key,String(value));}
 get isConnected():boolean{return this.tagName==='ROOT'||!!this.parentElement?.isConnected;}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 createEl(tag:string,options:any={}){return this.appendChild(new El(tag.toUpperCase(),this.ownerDocument,options));}createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}createSvg(tag:string,options:any={}){return this.createEl(tag,options);}
 appendChild(child:El){return this.insertBefore(child,null);}insertBefore(child:El,before:El|null){child.remove();const index=before?this.children.indexOf(before):-1;if(index<0)this.children.push(child);else this.children.splice(index,0,child);child.parentElement=this;return child;}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
 replaceChildren(...children:El[]){this.empty();for(const child of children)this.appendChild(child);}empty(){for(const child of this.children)child.parentElement=null;this.children=[];this.text='';}setText(value:string){this.empty();this.text=value;}
 setAttribute(key:string,value:string){this.attrs[key]=value;if(key==='title')this.title=value;if(key.startsWith('data-'))this.dataset[this.dataKey(key)]=value;}getAttribute(key:string){return key.startsWith('data-')?this.dataset[this.dataKey(key)]??null:this.attrs[key]??null;}private dataKey(key:string){return key.slice(5).replace(/-([a-z])/g,(_match,letter)=>letter.toUpperCase());}
 removeAttribute(key:string){delete this.attrs[key];}
 addClass(name:string){this.classList.add(name);}removeClass(name:string){this.classList.remove(name);}
 contains(child:El|null):boolean{return !!child&&(child===this||this.children.some(item=>item.contains(child)));}
 matches(selector:string):boolean{if(selector.includes(','))return selector.split(',').some(part=>this.matches(part.trim()));if(selector==='[contenteditable]:not([contenteditable=false])')return this.getAttribute('contenteditable')!==null&&this.getAttribute('contenteditable')!=='false';if(selector.startsWith('.'))return this.classes.has(selector.slice(1));if(selector.startsWith('[')){const found=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/)!;return this.getAttribute(found[1])!==null&&(found[2]===undefined||this.getAttribute(found[1])===found[2]);}return this.tagName===selector.toUpperCase();}
 closest(selector:string):El|null{return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
 querySelectorAll(selector:string):El[]{return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}querySelector(selector:string){return this.querySelectorAll(selector)[0];}
 getClientRects(){return this.isConnected&&this.visible&&!this.hidden&&!this.ancestors().some(parent=>!parent.visible||parent.hidden)?[this.getBoundingClientRect()]:[];}
 getBoundingClientRect(){const inside=this.classes.has('ts-brain-pill');return{left:inside?20:0,top:inside?20:0,right:inside?200:this.clientWidth,bottom:inside?80:this.clientHeight,width:inside?180:this.clientWidth,height:inside?60:this.clientHeight};}
 ancestors():El[]{return this.parentElement?[this.parentElement,...this.parentElement.ancestors()]:[];}
 focus(){if(this.isConnected&&!this.disabled){const changed=this.ownerDocument.activeElement!==this;this.ownerDocument.activeElement=this;if(changed)this.dispatch('focus');}}
 dispatch(type:string,extra:any={}){const event={type,target:this,button:0,key:'',shiftKey:false,ctrlKey:false,metaKey:false,isComposing:false,deltaY:0,deltaX:0,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...extra};let current:El|null=this;while(current){const fn=(current as any)['on'+type];fn?.(event);for(const listener of current.listeners.get(type)||[])listener(event);if(event.stopped)break;current=current.parentElement;}return event;}
 click(){if(!this.disabled)this.dispatch('click');}
}
class Component {
 children:Component[]=[];callbacks:(()=>void)[]=[];loaded=false;
 load(){this.loaded=true;(this as any).onload?.();for(const child of this.children)if(!child.loaded)child.load();}
 unload(){(this as any).onunload?.();for(const child of [...this.children])child.unload();this.children=[];for(const callback of this.callbacks.splice(0))callback();this.loaded=false;}
 addChild<T extends Component>(child:T):T {this.children.push(child);if(this.loaded)child.load();return child;}
 removeChild(child:Component){this.children=this.children.filter(value=>value!==child);child.unload();return child;}
 register(callback:()=>void){this.callbacks.push(callback);}
 registerDomEvent(el:El,type:string,callback:(event:any)=>void){let events=el.listeners.get(type);if(!events){events=new Set();el.listeners.set(type,events);}events.add(callback);this.register(()=>events!.delete(callback));}
}
class MenuItem {submenu?:Menu;setSubmenu(){return this.submenu??=new Menu();}title='';icon='';disabled=false;callback=()=>{};setTitle(value:string){this.title=value;return this;}setIcon(value:string){this.icon=value;return this;}setDisabled(value:boolean){this.disabled=value;return this;}onClick(fn:()=>void){this.callback=fn;return this;}click(){if(!this.disabled)this.callback();}}
class Menu {static last:Menu;items:MenuItem[]=[];native=true;shown?:string;doc?:Doc;hidden=false;private onHidden=()=>{};constructor(){Menu.last=this;}setUseNativeMenu(value:boolean){this.native=value;return this;}addItem(fn:(item:MenuItem)=>void){const item=new MenuItem();fn(item);this.items.push(item);return this;}addSeparator(){}showAtMouseEvent(){Menu.last=this;this.shown='mouse';}showAtPosition(_position:any,doc:Doc){Menu.last=this;this.shown='keyboard';this.doc=doc;}onHide(fn:()=>void){this.onHidden=fn;}hide(){this.hidden=true;this.onHidden();}}
const source=readFileSync(process.env.QA_BRAIN_VIEW_SOURCE||'src/brain-board-view.ts','utf8').replace(/^import[^\n]*\n/gm,'').replace(/\bexport /g,'');
const deps={bindBoardHostInset,renderBoardSaveFeedback,BrainRefreshCache,...readingPositions,...brainColors,...descendants,...ports,LocalRelationMotion,...state,...relations,...layout,...creation,Component,Menu,setIcon(el:El,icon:string){el.dataset.icon=icon;}};
const {BrainBoardView:View}=new Function(...Object.keys(deps),transformSync(source+'\nreturn {BrainBoardView};',{loader:'ts'}).code)(...Object.values(deps));
const card=(id:string,kind:Card['kind']='card'):Card=>({id,kind,title:'标题 '+id,file:kind==='card'?`Notes/${id}.md`:kind==='board'?`Boards/${id}.thoughtspace`:undefined,x:10,y:20,width:120,height:80,color:'slate'});
function fixture(beforeLoad?:(context:{doc:Doc;root:El;el:El;board:Board;view:any;host:any})=>void){
 const doc=new Doc(),root=new El('ROOT',doc),el=root.createDiv();doc.body=root;
 const board:Board={...emptyBoard(),version:3,presentation:'brain',brain:state.createBoardMindmapState('b'),nodes:[...['a','b','c','d','sibling'].map(id=>card(id)),card('group','section'),card('sub','board'),card('text','text')],edges:[{id:'ab',from:'a',to:'b',label:'父级',kind:'branch'},{id:'as',from:'a',to:'sibling',label:'',kind:'branch'},{id:'bc',from:'b',to:'c',label:'子级',kind:'branch'},{id:'bd',from:'b',to:'d',label:'引用'},{id:'bs',from:'b',to:'sub',label:'子板',direction:'both'},{id:'bg',from:'b',to:'group',label:'分组',direction:'both'},{id:'bt',from:'b',to:'text',label:'不可用'}]};
 let snapshot:any={board,path:'Board.thoughtspace',key:{}},added=0;const navigation=new Set<()=>void>();const saves:any[]=[],viewports:any[]=[],opens:{id:string;current:()=>boolean;edit:boolean}[]=[],previews:{id:string;body:El;scope:Component;current:()=>boolean}[]=[],missing=new Set<string>(),stamps=new Map<string,string>();
 const host:any={subscribeNavigation:(invalidate:()=>void)=>{navigation.add(invalidate);return()=>navigation.delete(invalidate);},snapshot:()=>snapshot,change:(next:any)=>{saves.push(clone(next));snapshot.board.brain=next;},source:(id:string)=>{const node=board.nodes.find(item=>item.id===id);return{label:'来源 '+id,path:node?.file,available:!!node&&!missing.has(id),reason:'来源文件缺失',canEdit:node?.kind==='card',stamp:stamps.get(id)||'1'};},open:async(id:string,current:()=>boolean,edit:boolean)=>{opens.push({id,current,edit});},preview:(id:string,body:El,scope:Component,current:()=>boolean)=>{previews.push({id,body,scope,current});if(current())body.createEl('p',{text:`真实正文 ${id}`});},add:()=>{added++;},viewport:(value:any)=>{viewports.push(value);board.brainViewport=value;},relate:()=>{},fileMenu:()=>{}};
 host.container=root;const view=new View({},el,host);beforeLoad?.({doc,root,el,board,view,host});view.load();
 return{view,doc,root,el,board,host,saves,viewports,opens,previews,missing,stamps,navigation,get snapshot(){return snapshot;},setSnapshot:(value:any)=>{snapshot=value;},get added(){return added;}};
}
const node=(f:ReturnType<typeof fixture>,id:string)=>f.el.querySelector(`[data-brain-node-id="${id}"]`)!;
// Node operation tests select via the real title before using the shared toolbar.
const action=(root:El,key:string)=>{if(root.dataset.brainNodeId){root.querySelector('.ts-brain-node-title')!.click();root=root.ancestors().find(item=>item.classes.has('ts-brain-shell'))!.querySelector('.ts-brain-selection')!;}return root.querySelector(`[data-brain-action="${key}"]`)!;};
const title=(f:ReturnType<typeof fixture>,id:string)=>node(f,id).querySelector('.ts-brain-node-title')!;
const navigateCenter=(f:ReturnType<typeof fixture>,id:string)=>{title(f,id).click();action(f.el,'center').click();};
const allMenuItems=(menu:Menu):MenuItem[]=>menu.items.flatMap(item=>[item,...(item.submenu?allMenuItems(item.submenu):[])]);
test('known unchanged graph retains SVG, history and preview DOM; revision/source/expand invalidates',()=>{
 const f=fixture();let nativeReads=0;f.setSnapshot({...f.snapshot,graphRevision:1,nativeRevision:1,native:()=>{nativeReads++;return[];}});f.view.refresh();
 const svg=f.el.querySelector('.ts-brain-links')!,recent=f.el.querySelector('.ts-brain-recent')!,paths=[...svg.children],entries=[...recent.children];
 for(let i=0;i<20;i++)f.view.refresh();assert.equal(nativeReads,1);assert.deepEqual(svg.children,paths);assert.deepEqual(recent.children,entries);
 f.board.nodes.find(n=>n.id==='c')!.title='Fresh title';f.setSnapshot({...f.snapshot,graphRevision:2});f.view.refresh();assert.match(title(f,'c').textContent,/Fresh title/);assert.equal(nativeReads,2);
 f.board.brain!.expandedIds=['b'];f.view.refresh();const preview=node(f,'b').querySelector('.ts-brain-preview')!;assert.ok(preview);f.view.refresh();assert.equal(node(f,'b').querySelector('.ts-brain-preview'),preview);
 f.stamps.set('b','new-source');f.setSnapshot({...f.snapshot,nativeRevision:2});f.view.refresh();assert.notEqual(node(f,'b').querySelector('.ts-brain-preview'),preview);
 f.view.unload();assert.equal(f.view.projection,undefined);assert.equal(f.view.layout,undefined);assert.equal(f.view.transformLayout,undefined);
});
test('hosts without revision contracts retain descendant paging but detect in-place graph edits',()=>{
 const f=fixture();for(let i=0;i<75;i++){f.board.nodes.push(card('paged-'+i));f.board.edges.push({id:'p'+i,from:'b',to:'paged-'+i,kind:'branch',label:''});}f.board.brain!.descendantDepth=3;f.view.refresh();const index=f.view.branchCache.index;
 action(f.el,'next-branches').click();assert.equal(f.view.descendantPage.page,1);assert.equal(f.view.branchCache.index,index);f.view.refresh();assert.equal(f.view.descendantPage.page,1);
 f.board.nodes.find(n=>n.id==='paged-0')!.title='Updated';f.view.refresh();assert.notEqual(f.view.branchCache.index,index);
});
const menuItem=(title:string)=>allMenuItems(Menu.last).find(item=>item.title===title)!;

test('reading capture uses the exact logical camera before its deferred frame and never persists',()=>{
 const f=fixture();f.view.wheel({target:f.el,deltaMode:0,deltaX:13.5,deltaY:-21.25,ctrlKey:false,metaKey:false,preventDefault(){},stopPropagation(){}});const camera={...f.view.camera},before=JSON.stringify(f.board),captured=f.view.captureReadingPosition();assert.deepEqual(captured.viewport,camera);assert.equal(captured.centerId,'b');assert.equal(JSON.stringify(f.board),before);assert.equal(f.viewports.length,0);assert.notEqual(captured.viewport,f.view.camera);captured.viewport.x=999;assert.deepEqual(f.view.camera,camera);
});
test('restoring a brain location cancels queued pan camera without a delayed overwrite',()=>{
 const f=fixture(),capture=f.view.captureReadingPosition();f.view.zoomAt(.37);assert(f.view.viewportIntent);assert(f.doc.timers.size);f.view.prepareReadingPositionRestore();assert.equal(f.view.viewportIntent,undefined);assert.equal(f.doc.timers.size,0);assert.equal(f.view.cameraFrame,0);f.board.brain=state.updateBoardMindmapState(f.board.brain!,{type:'center',id:'a'},f.board.nodes);readingPositions.applyBrainReadingPosition(f.board,capture);f.view.refresh();assert.deepEqual(f.view.camera,capture.viewport);f.doc.tick();f.view.flushViewport();assert.equal(f.viewports.length,0);assert.deepEqual(f.board.brainViewport,capture.viewport);
});
test('reading manager uses only the board menu and stale callbacks cannot reopen it',()=>{
 const f=fixture(),requests:Array<()=>boolean>=[];f.host.readingPositions=(current:()=>boolean)=>requests.push(current);const before=JSON.stringify(f.board),topActions=f.el.querySelector('.ts-brain-top-actions')!.children.length;action(f.el,'more').click();menuItem('脑图阅读位置…').click();assert.equal(requests.length,1);assert(requests[0]());assert.equal(f.el.querySelector('.ts-brain-top-actions')!.children.length,topActions);assert.equal(JSON.stringify(f.board),before);
 navigateCenter(f,'a');assert(!requests[0]());action(f.el,'more').click();f.snapshot.readOnly=true;f.view.refresh();menuItem('脑图阅读位置…').click();assert.equal(requests.length,1);assert.throws(()=>f.view.captureReadingPosition(),/不可保存/);
});

test('dedicated mount draws only supported nodes without mutating geometry, state, sources or viewport',()=>{const f=fixture(),before=clone(f.board);f.view.refresh();assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);assert.equal(f.opens.length,0);assert.equal(f.previews.length,0);assert.equal(f.el.querySelectorAll('.ts-node').length,0);assert.equal(f.el.querySelectorAll('[data-id]').length,0);assert.equal(node(f,'text'),undefined);assert.ok(node(f,'group'));assert.ok(node(f,'sub'));});
test('explicit idea remains a visible center and ordinary text stays excluded',()=>{const f=fixture();f.host.createRelation=()=>{};f.board.nodes.find(n=>n.id==='b')!.brainIdea=undefined;const idea=brainIdeaNode('idea','Named idea');f.board.nodes.push(idea);f.board.brain=state.updateBoardMindmapState(f.board.brain!,{type:'center',id:'idea'},f.board.nodes);f.view.refresh();assert(node(f,'idea'));assert.equal(node(f,'idea').dataset.brainRole,'center');assert.equal(node(f,'text'),undefined);assert.equal(action(node(f,'idea'),'add-bottom').hidden,false);});
test('depth menu adds real simultaneous descendants and restores old one-layer view without source writes',()=>{
 const f=fixture();f.snapshot.graphRevision=0;for(let i=1;i<=6;i++){f.board.nodes.push(card('deep-'+i));f.board.edges.push({id:'deep-edge-'+i,from:i===1?'c':'deep-'+(i-1),to:'deep-'+i,kind:'branch',label:''});}f.snapshot.graphRevision++;f.view.refresh();const before=clone(f.board.nodes),edges=clone(f.board.edges);action(f.el,'depth').click();menuItem('显示 5 层').click();assert(node(f,'deep-4'));assert.equal(node(f,'deep-5'),undefined);assert.equal(node(f,'deep-4').dataset.brainDepth,'5');assert.equal(f.board.brain!.descendantDepth,5);assert.equal(f.saves.length,1);assert.deepEqual(clone(f.board.nodes),before);assert.deepEqual(clone(f.board.edges),edges);const index=f.view.branchCache.index;f.view.camera.x+=10;f.view.transform();f.view.refresh();assert.equal(f.view.branchCache.index,index);action(f.el,'depth').click();menuItem('显示 1 层').click();assert.equal(node(f,'deep-1'),undefined);assert.equal(f.board.brain!.descendantDepth,undefined);
});
test('graph revision invalidates descendant adjacency while hidden view neither builds nor steals focus',()=>{
 const f=fixture();f.snapshot.graphRevision=0;f.view.update({type:'depth',value:5});const old=f.view.branchCache.index;f.board.nodes.push(card('new-child'));f.board.edges.push({id:'new-edge',from:'c',to:'new-child',kind:'branch',label:''});f.snapshot.graphRevision++;f.view.refresh();assert.notEqual(f.view.branchCache.index,old);assert(node(f,'new-child'));const input=f.el.querySelector('input')!;input.focus();f.el.visible=false;const index=f.view.branchCache.index;f.snapshot.graphRevision++;f.view.refresh();assert.equal(f.view.branchCache.index,index);assert.equal(f.doc.activeElement,input);f.el.visible=true;f.view.refresh();assert.notEqual(f.view.branchCache.index,index);
});
test('four center plus buttons expose exact directions without changing center or capturing title clicks',()=>{
 const f=fixture(),calls:{id:string;side:string;current:()=>boolean}[]=[];f.host.createRelation=(id:string,side:string,current:()=>boolean)=>calls.push({id,side,current});f.view.refresh();
 for(const side of ['top','bottom','left','right']){const button=action(node(f,'b'),'add-'+side);assert.equal(button.tagName,'BUTTON');assert.equal(button.hidden,false);assert.equal(button.disabled,false);assert.equal(button.getAttribute('aria-haspopup'),'dialog');button.focus();assert.equal(f.doc.activeElement,button);button.click();assert(!node(f,'a').querySelector('[data-brain-action="add-'+side+'"]'));}
 assert.deepEqual(calls.map(({id,side})=>({id,side})),['top','bottom','left','right'].map(side=>({id:'b',side})));assert.equal(f.board.brain!.centerId,'b');assert.equal(f.saves.length,0);assert(calls.every(call=>call.current()));
 navigateCenter(f,'a');assert(calls.every(call=>!call.current()));assert.equal(f.board.brain!.centerId,'a');assert.equal(f.saves.length,1);
});
test('four-direction controls reject read-only and locked nodes while retaining navigation',()=>{
 const f=fixture(),calls:string[]=[];f.host.createRelation=(_id:string,side:string)=>calls.push(side);f.snapshot.readOnly=true;f.view.refresh();for(const side of ['top','bottom','left','right']){assert(action(node(f,'b'),'add-'+side).disabled);action(node(f,'b'),'add-'+side).click();}
 f.snapshot.readOnly=false;f.board.nodes.find(node=>node.id==='b')!.locked=true;f.view.refresh();for(const side of ['top','bottom','left','right'])action(node(f,'b'),'add-'+side).click();assert.deepEqual(calls,[]);assert.equal(title(f,'b').disabled,false);
});
test('native relation command target dispatches the same four center relations and preserves source geometry',()=>{
 const f=fixture(),calls:{id:string;side:string;current:()=>boolean}[]=[],before=clone(f.board);f.host.createRelation=(id:string,side:string,current:()=>boolean)=>calls.push({id,side,current});
 const target=f.view.relationCommandTarget();assert.ok(target);assert.equal(target.editing,false);
 for(const side of ['top','bottom','left','right']){assert.equal(target.canRun(side),true);target.run(side);}
 assert.deepEqual(calls.map(({id,side})=>({id,side})),['top','bottom','left','right'].map(side=>({id:'b',side})));assert.deepEqual(clone(f.board),before);assert(calls.every(call=>call.current()));
});
test('relation commands accept all existing supported center kinds and reject other card kinds',()=>{
 for(const kind of ['card','board','section','text','pdf','image','audio','video','mindmap'] as Card['kind'][]){
  const f=fixture(),center=f.board.nodes.find(node=>node.id==='b')!;center.kind=kind;if(kind==='text')center.brainIdea=true;
  f.host.createRelation=()=>{};const target=f.view.relationCommandTarget();assert.ok(target);
  assert.equal(target.canRun('bottom'),['card','board','section','text'].includes(kind),kind);
  if(kind==='text'){delete center.brainIdea;assert.equal(target.canRun('bottom'),false);}
 }
});
test('relation commands recheck readonly, locked, hidden, window focus and active-view identity at execution',()=>{
 const f=fixture(),calls:string[]=[];f.host.createRelation=(_id:string,side:string)=>calls.push(side);f.host.isActive=()=>true;
 const target=f.view.relationCommandTarget();assert.ok(target);const center=f.board.nodes.find(node=>node.id==='b')!;
 const changes:[()=>void,()=>void][]=[[()=>{f.snapshot.readOnly=true;},()=>{f.snapshot.readOnly=false;}],[()=>{center.locked=true;},()=>{delete center.locked;}],[()=>{f.el.visible=false;},()=>{f.el.visible=true;}],[()=>{f.doc.focused=false;},()=>{f.doc.focused=true;}],[()=>{f.doc.defaultView.closed=true;},()=>{f.doc.defaultView.closed=false;}],[()=>{f.host.isActive=()=>false;},()=>{f.host.isActive=()=>true;}]];
 for(const [block,restore]of changes){block();assert.equal(target.canRun('top'),false);target.run('top');restore();}
 assert.deepEqual(calls,[]);target.run('right');assert.deepEqual(calls,['right']);
});
test('relation commands suppress search, plaintext-only preview editors and IME without adding keyboard bindings',()=>{
 const f=fixture(),calls:string[]=[];f.host.createRelation=(_id:string,side:string)=>calls.push(side);const target=f.view.relationCommandTarget();assert.ok(target);
 for(const tag of ['input','textarea','select']){const input=f.el.createEl(tag);input.focus();assert.equal(target.canRun('bottom'),false);target.run('bottom');input.remove();}
 const editor=f.el.createDiv();editor.setAttribute('contenteditable','plaintext-only');editor.matches=selector=>selector.includes('[contenteditable]');editor.focus();assert.equal(target.canRun('bottom'),false);target.run('bottom');editor.remove();f.doc.activeElement=null;
 for(const callback of f.doc.listeners.get('compositionstart')||[])callback({});assert.equal(target.canRun('bottom'),false);target.run('bottom');
 for(const callback of f.doc.listeners.get('compositionend')||[])callback({});assert.equal(target.canRun('bottom'),true);
 const event=title(f,'b').dispatch('keydown',{key:'Tab'});assert.equal(event.defaultPrevented,false);assert.deepEqual(calls,[]);
});
test('retained relation commands invalidate after center, board path, owner or document changes and unload removes IME observers',()=>{
 const f=fixture(),calls:string[]=[];f.host.createRelation=(_id:string,side:string)=>calls.push(side);const target=f.view.relationCommandTarget();assert.ok(target);
 const initial=f.snapshot;
 for(const change of [{...initial,key:{}},{...initial,path:'Renamed.md'},{...initial,board:{...f.board,presentation:undefined}},{...initial,board:{...f.board,brain:{...f.board.brain,centerId:'a'}}}]){
  f.setSnapshot(change);assert.equal(target.canRun('left'),false);target.run('left');
 }
 f.setSnapshot(initial);f.el.ownerDocument=new Doc();assert.equal(target.canRun('left'),false);f.el.ownerDocument=f.doc;
 f.view.unload();assert.equal(target.canRun('left'),false);assert.equal(f.doc.listeners.get('compositionstart')!.size,0);assert.equal(f.doc.listeners.get('compositionend')!.size,0);assert.equal(f.doc.defaultView.listeners.get('blur')!.size,0);assert.deepEqual(calls,[]);
});
test('moving a brain to another window replaces its IME observers and releases the old document',()=>{
 const f=fixture();f.host.createRelation=()=>{};f.view.relationCommandTarget();const old=f.doc,newDoc=new Doc();f.el.ownerDocument=newDoc;f.view.relationCommandTarget();
 assert.equal(old.listeners.get('compositionstart')!.size,0);assert.equal(old.listeners.get('compositionend')!.size,0);assert.equal(old.defaultView.listeners.get('blur')!.size,0);
 const target=f.view.relationCommandTarget();assert.ok(target);for(const callback of newDoc.listeners.get('compositionstart')||[])callback({});assert.equal(target.canRun('top'),false);
 for(const callback of newDoc.listeners.get('compositionend')||[])callback({});assert.equal(target.canRun('top'),true);f.view.unload();assert.equal(newDoc.listeners.get('compositionstart')!.size,0);
});
test('external sidebar and modal text inputs suppress execution while native prompt enumeration remains discoverable',()=>{
 const f=fixture(),calls:string[]=[];f.host.createRelation=(_id:string,side:string)=>calls.push(side);
 const sidebar=f.root.createDiv(),input=sidebar.createEl('input');input.focus();assert.equal(f.view.relationCommandTarget().canRun('top'),false);f.view.relationCommandTarget().run('top');
 const prompt=f.root.createDiv('prompt'),promptInput=prompt.createEl('input');promptInput.focus();assert.equal(f.view.relationCommandTarget().canRun('top'),false);
 const checking=f.view.relationCommandTarget(true);assert.equal(checking.editing,false);assert.equal(checking.canRun('top'),true);checking.run('top');assert.deepEqual(calls,[]);
 title(f,'b').focus();f.view.relationCommandTarget().run('top');assert.deepEqual(calls,['top']);
});
test('actual sibling SVG link originates at shared parent and associated edges are dashed',()=>{const f=fixture(),links=f.el.querySelector('.ts-brain-links')!.children;assert.ok(links.some(link=>link.dataset.brainFrom==='a'&&link.dataset.brainTo==='sibling'));assert.ok(!links.some(link=>link.dataset.brainFrom==='b'&&link.dataset.brainTo==='sibling'));assert.ok(links.some(link=>(link.dataset.brainTo==='group'||link.dataset.brainFrom==='group')&&link.classes.has('is-associated')));});
test('explicit center control recenters once in same graph and keeps all source geometry intact',()=>{const f=fixture(),nodes=clone(f.board.nodes),scene=f.el.querySelector('.ts-brain-scene');navigateCenter(f,'a');navigateCenter(f,'a');assert.equal(f.board.brain!.centerId,'a');assert.equal(f.saves.length,1);assert.equal(f.el.querySelector('.ts-brain-scene'),scene);assert.deepEqual(clone(f.board.nodes),nodes);assert.equal(f.opens.length,0);assert.equal(f.doc.activeElement,title(f,'a'));});
test('persisted back/forward and unique recent nodes retain nonconsecutive history',()=>{const f=fixture();navigateCenter(f,'a');navigateCenter(f,'b');assert.deepEqual(f.board.brain!.history.entries,['b','a','b']);assert.equal(f.el.querySelectorAll('[data-brain-recent-id]').length,2);action(f.el,'back').click();assert.equal(f.board.brain!.centerId,'a');action(f.el,'back').click();assert.equal(f.board.brain!.centerId,'b');action(f.el,'forward').click();assert.equal(f.board.brain!.centerId,'a');});
test('preview keeps native body, scroll and focus across refresh and role change',()=>{const f=fixture();action(node(f,'a'),'expand').click();const old=f.previews[0],input=old.body.createEl('input');old.body.scrollTop=70;input.focus();f.view.refresh();assert.equal(f.previews.length,1);assert.equal(f.doc.activeElement,input);assert.equal(old.body.scrollTop,70);navigateCenter(f,'a');assert.equal(f.previews.length,1);assert.equal(old.current(),true);assert.equal(node(f,'a').querySelector('.ts-brain-preview'),old.body);assert.equal(node(f,'a').style.getPropertyValue('--brain-preview-width'),'340px');assert.equal(old.body.getAttribute('tabindex'),'0');assert.equal(old.body.getAttribute('role'),'region');action(node(f,'a'),'expand').click();assert.equal(node(f,'a').style.getPropertyValue('--brain-preview-width'),'');});
test('preview keeps its current node name after native loading clears aria-label and label IDs are unique per view',()=>{
 const f=fixture(),other=fixture();action(node(f,'a'),'expand').click();action(node(other,'a'),'expand').click();const body=f.previews[0].body,label=node(f,'a').querySelector('.ts-brain-node-label')!,otherLabel=node(other,'a').querySelector('.ts-brain-node-label')!;
 assert.equal(body.getAttribute('aria-labelledby'),label.getAttribute('id'));assert.notEqual(label.getAttribute('id'),otherLabel.getAttribute('id'));assert.equal(body.getAttribute('aria-description'),'正文');
 body.setAttribute('aria-label','正在加载');body.removeAttribute('aria-label');f.board.nodes.find(item=>item.id==='a')!.title='更新的知识标题';f.view.refresh();assert.equal(f.previews.length,1);assert.equal(body.getAttribute('aria-label'),null);assert.equal(body.getAttribute('aria-labelledby'),label.getAttribute('id'));assert.equal(label.textContent,'更新的知识标题');
});
test('preview source modification rebuilds only body while loss is explicit and restorable',()=>{const f=fixture();action(node(f,'a'),'expand').click();const old=f.previews[0];f.stamps.set('a','2');assert.equal(old.current(),false);f.view.refresh();assert.equal(old.scope.loaded,false);assert.equal(f.previews.length,2);f.missing.add('a');f.view.refresh();assert.match(node(f,'a').textContent,/来源文件缺失/);assert.equal(action(node(f,'a'),'open').disabled,true);assert.deepEqual(f.board.brain!.expandedIds,['a']);f.missing.delete('a');f.view.refresh();assert.equal(f.previews.length,3);});
test('collapsing body cancels scope and repeated toggle does not grow retained children',()=>{const f=fixture();for(let i=0;i<20;i++){action(node(f,'a'),'expand').click();const current=f.previews.at(-1)!;action(node(f,'a'),'expand').click();assert.equal(current.current(),false);assert.equal(current.scope.loaded,false);}assert.ok(f.view.children.length<12);});
for(const reason of ['center','owner','path','deleted','document','closed','hidden','presentation','unloaded'])test(`pending source action is canceled after ${reason}`,()=>{const f=fixture();action(node(f,'a'),'open').click();const current=f.opens[0].current;if(reason==='center')navigateCenter(f,'a');if(reason==='owner')f.setSnapshot({...f.snapshot,key:{}});if(reason==='path')f.snapshot.path='Rename.thoughtspace';if(reason==='deleted')f.board.nodes=f.board.nodes.filter(n=>n.id!=='a');if(reason==='document')f.el.ownerDocument=new Doc();if(reason==='closed')f.doc.defaultView.closed=true;if(reason==='hidden')f.el.visible=false;if(reason==='presentation')delete f.board.presentation;if(reason==='unloaded')f.view.unload();assert.equal(current(),false);});
test('native context menu edit and relationship actions use exact node and do not recenter',()=>{const f=fixture();action(node(f,'a'),'node-menu').click();assert.equal(Menu.last.native,false);menuItem('编辑实际笔记').click();assert.equal(f.opens[0].id,'a');assert.equal(f.opens[0].edit,true);assert.equal(f.board.brain!.centerId,'b');assert.ok(menuItem('添加关联'));assert.equal(f.saves.length,0);});
test('node menu opens existing-note picker directly for the exact noncenter node and stale menus cannot retarget it',()=>{
 const f=fixture(),calls:{id:string;current:()=>boolean}[]=[];f.host.associateExisting=(id:string,current:()=>boolean)=>calls.push({id,current});action(node(f,'a'),'node-menu').click();const item=menuItem('关联已有笔记…');assert(item);item.click();assert.equal(calls[0].id,'a');assert(calls[0].current());assert.equal(f.board.brain!.centerId,'b');assert.equal(f.saves.length,0);title(f,'b').click();assert(!calls[0].current());item.click();assert.equal(calls.length,1);
});
test('existing-note node-menu shortcut remains disabled for locked and read-only nodes',()=>{
 const f=fixture();f.host.associateExisting=()=>{throw Error('Must stay disabled');};f.board.nodes.find(n=>n.id==='a')!.locked=true;f.view.refresh();action(node(f,'a'),'node-menu').click();assert(menuItem('关联已有笔记…').disabled);f.board.nodes.find(n=>n.id==='a')!.locked=false;f.snapshot.readOnly=true;f.view.refresh();action(node(f,'a'),'node-menu').click();assert(menuItem('关联已有笔记…').disabled);
});
test('a busy existing-note menu action surfaces the safe failure without a window error or recentering',()=>{
 const f=fixture();f.host.associateExisting=()=>{throw Error('请先完成此白板正在进行的编辑或创建');};action(node(f,'a'),'node-menu').click();assert.doesNotThrow(()=>menuItem('关联已有笔记…').click());assert.match(f.el.querySelector('.ts-brain-status')!.textContent,/正在进行/);assert.equal(f.board.brain!.centerId,'b');assert.equal(f.saves.length,0);
});
test('keyboard context menu uses owning popout document and stale menu cannot mutate',()=>{const f=fixture();title(f,'a').dispatch('keydown',{key:'F10',shiftKey:true});assert.equal(Menu.last.doc,f.doc);const pending=menuItem('固定节点');title(f,'b').click();pending.click();assert.equal(Menu.last.hidden,true);assert.deepEqual(f.board.brain!.pins,[]);});
test('read-only state blocks persistent intents and still allows source viewing',()=>{const f=fixture();f.snapshot.readOnly=true;f.view.refresh();title(f,'a').click();action(node(f,'a'),'expand').click();action(node(f,'a'),'open').click();assert.equal(f.saves.length,0);assert.equal(f.previews.length,0);assert.equal(f.opens.length,1);assert.match(f.el.textContent,/只读/);});
test('search is local, preserves input across renders and cancels without mutations',()=>{const f=fixture(),input=f.el.querySelector('input')!;title(f,'a').dispatch('keydown',{key:'k',metaKey:true});assert.equal(f.doc.activeElement,input);assert.equal(f.el.querySelectorAll('.ts-brain-search-result').length,7);input.value='Notes/a.md';input.dispatch('input');assert.equal(f.el.querySelectorAll('.ts-brain-search-result').length,1);f.view.refresh();assert.equal(f.doc.activeElement,input);input.dispatch('keydown',{key:'Escape'});assert.equal(f.el.querySelector('.ts-brain-search-results')!.hidden,true);assert.equal(f.saves.length,0);assert.equal(f.doc.activeElement,title(f,'b'));});
test('search keyboard selection supports paths and excludes standalone text',()=>{const f=fixture(),input=f.el.querySelector('input')!;input.value='Notes/a.md';input.dispatch('input');input.dispatch('keydown',{key:'Enter'});assert.equal(f.board.brain!.centerId,'a');assert.equal(f.el.querySelector('.ts-brain-search-results')!.hidden,true);assert.equal(f.doc.activeElement,title(f,'a'));});
test('search arrow navigation keeps existing rows and input focus while updating selection',()=>{
 const f=fixture(),input=f.el.querySelector('input')!;input.focus();input.dispatch('focus');
 const rows=f.el.querySelectorAll('.ts-brain-search-result');
 for(let i=0;i<25;i++){input.dispatch('keydown',{key:'ArrowDown'});input.dispatch('keydown',{key:'ArrowUp'});}
 const current=f.el.querySelectorAll('.ts-brain-search-result');assert(current.length===rows.length&&current.every((row,index)=>row===rows[index]),'Arrow navigation must retain the existing result elements');assert(rows.every(row=>row.isConnected));assert.equal(f.doc.activeElement,input);assert.equal(rows[0].getAttribute('aria-selected'),'true');assert.equal(rows[1].getAttribute('aria-selected'),'false');assert.equal(f.saves.length,0);
 input.value='Notes/a.md';input.dispatch('input');assert.equal(f.el.querySelectorAll('.ts-brain-search-result').length,1);input.dispatch('keydown',{key:'Enter'});assert.equal(f.board.brain!.centerId,'a');
});
test('opening search through a native focus event builds the result list once',()=>{
 const f=fixture(),input=f.el.querySelector('input')!,list=f.el.querySelector('.ts-brain-search-results')!;
 let builds=0;const empty=list.empty.bind(list),focus=input.focus.bind(input);list.empty=()=>{builds++;empty();};
 input.focus=()=>{const changed=f.doc.activeElement!==input;focus();if(changed)input.dispatch('focus');};
 f.view.focusSearch();assert.equal(builds,1);assert.equal(f.doc.activeElement,input);assert.equal(list.hidden,false);
 input.dispatch('keydown',{key:'Escape'});f.view.focusSearch();assert.equal(builds,1);assert.equal(list.hidden,false);
});

test('successive fresh search prefixes retain identical rows and reset keyboard selection without mutating the board',()=>{
 const f=fixture();for(let i=0;i<22;i++)f.board.nodes.push({...card('knowledge-'+i),title:'Knowledge Node '+i});f.view.refresh();const before=clone(f.board),input=f.el.querySelector('input')!;
 input.focus();input.value='k';input.dispatch('input');const rows=f.el.querySelectorAll('.ts-brain-search-result'),matched=relations.searchLocalCenters(f.board,'k',{pageSize:10});assert.equal(rows.length,10);assert.equal(matched.matched,22);
 input.dispatch('keydown',{key:'ArrowDown'});assert.equal(rows[1].getAttribute('aria-selected'),'true');
 for(const query of ['kn','kno','know','knowl','knowle','knowled','knowledg','knowledge','knowledge n','knowledge no','knowledge nod','knowledge node']){input.value=query;input.dispatch('input');const fresh=relations.searchLocalCenters(f.board,query,{pageSize:10});assert.deepEqual(fresh,matched);const current=f.el.querySelectorAll('.ts-brain-search-result');assert(current.length===rows.length&&current.every((row,index)=>row===rows[index]),'Equivalent fresh results must retain the result buttons');assert.equal(rows[0].getAttribute('aria-selected'),'true');assert.equal(rows[1].getAttribute('aria-selected'),'false');}
 assert.equal(f.doc.activeElement,input);assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);rows[0].click();assert.equal(f.board.brain!.centerId,'knowledge-0');assert.equal(f.el.querySelector('.ts-brain-search-results')!.hidden,true);
});
test('search retained rows invalidate for current descriptors, read-only state, pagination and owner or document changes',()=>{
 const f=fixture();f.view.focusSearch();const input=f.el.querySelector('input')!,rows=()=>f.el.querySelectorAll('.ts-brain-search-result');let prior=rows();
 const refresh=()=>{f.view.refresh();const current=rows();assert.notEqual(current[0],prior[0]);prior=current;return current;};
 f.board.nodes[0].title='新知识标题';assert.equal(refresh()[0].textContent,'新知识标题');f.board.nodes[0].file='Moved/a.md';assert.match(refresh()[0].title,/Moved\/a.md/);
 f.board.nodes[0].kind='board';assert.equal(refresh()[0].dataset.icon,'network');f.snapshot.readOnly=true;assert.ok(refresh().every(row=>row.disabled));f.snapshot.readOnly=false;refresh();
 for(let i=0;i<14;i++)f.board.nodes.push(card('paging-'+i));refresh();const next=f.el.querySelector('.ts-brain-search-results')!.querySelectorAll('button').find(button=>button.getAttribute('aria-label')==='搜索下一页')!;next.click();assert.notEqual(rows()[0],prior[0]);assert.equal(f.view.searchPage,1);
 f.setSnapshot({...f.snapshot,key:{}});refresh();f.snapshot.path='Moved/Brain.thoughtspace';refresh();const doc=new Doc();f.el.ownerDocument=doc;refresh();
 input.value='nonexistent';input.dispatch('input');assert.equal(rows().length,0);assert.match(f.el.querySelector('.ts-brain-search-results')!.textContent,/没有匹配/);f.board.nodes.push({...card('new'),title:'nonexistent'});refresh();assert.equal(rows().length,1);assert.equal(rows()[0].textContent,'nonexistent');assert.equal(f.saves.length,0);
});
test('focus uses rendered pill geometry without pill or stage rectangles and keeps final camera input',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!,pill=node(f,'b').querySelector('.ts-brain-pill')!,position=f.view.layout.nodes.find((value:any)=>value.id==='b'),zoom=.72;let rectangles=0,visibility=0;
 for(const el of [stage,pill]){const read=el.getBoundingClientRect.bind(el);el.getBoundingClientRect=()=>{rectangles++;return read();};}
 const visible=f.el.getClientRects.bind(f.el);f.el.getClientRects=()=>{visibility++;return visible();};f.view.camera={x:-2000,y:-1000,zoom};f.view.focusNode('b');
 assert.equal(rectangles,0);assert.equal(visibility,1);assert.deepEqual(f.view.camera,{zoom,x:stage.clientWidth/2-(position.x+position.width/2)*zoom,y:stage.clientHeight/2-(position.y+position.height/2)*zoom});assert.equal(f.doc.activeElement,title(f,'b'));f.view.flushPendingViewport();assert.deepEqual(f.viewports,[f.view.camera]);
 stage.clientWidth=900;stage.clientHeight=520;f.view.camera={x:-2000,y:-1000,zoom};f.view.focusNode('b');assert.equal(f.view.camera.x,450-(position.x+position.width/2)*zoom);assert.equal(f.view.camera.y,260-(position.y+position.height/2)*zoom);
 title(f,'a').focus();f.el.visible=false;f.view.focusNode('b');assert.equal(f.doc.activeElement,title(f,'a'));f.el.visible=true;f.doc.defaultView.closed=true;f.view.focusNode('b');assert.equal(f.doc.activeElement,title(f,'a'));
});
test('search focus can move between query, results and paging without closing or breaking a mouse choice',()=>{
 const f=fixture();for(let i=0;i<14;i++)f.board.nodes.push(card('search-extra-'+i));f.view.refresh();f.view.focusSearch();
 const input=f.el.querySelector('input')!,list=f.el.querySelector('.ts-brain-search-results')!,row=f.el.querySelectorAll('.ts-brain-search-result')[0],next=list.querySelectorAll('button').find(button=>button.getAttribute('aria-label')==='搜索下一页')!;
 row.focus();input.dispatch('focusout',{relatedTarget:row});assert.equal(list.hidden,false);assert.equal(f.doc.activeElement,row);
 next.focus();row.dispatch('focusout',{relatedTarget:next});assert.equal(list.hidden,false);next.click();assert.equal(list.hidden,false);assert.equal(f.saves.length,0);
 input.focus();next.dispatch('focusout',{relatedTarget:input});input.value='Notes/a.md';input.dispatch('input');const choice=f.el.querySelectorAll('.ts-brain-search-result')[0];
 choice.dispatch('pointerdown');choice.focus();input.dispatch('focusout',{relatedTarget:choice});assert.equal(list.hidden,false);choice.click();assert.equal(f.board.brain!.centerId,'a');assert.equal(f.doc.activeElement,title(f,'a'));assert.equal(list.hidden,true);assert.equal(f.saves.length,1);
});
test('focused search paging survives native removal focusout and keeps both page directions accessible',()=>{
 const f=fixture();for(let i=0;i<5;i++)f.board.nodes.push(card('page-extra-'+i));f.view.refresh();f.view.focusSearch();const input=f.el.querySelector('input')!,list=f.el.querySelector('.ts-brain-search-results')!,before=clone(f.board);let removalFocusouts=0;
 const empty=list.empty.bind(list),focus=input.focus.bind(input);
 input.focus=()=>{const previous=f.doc.activeElement;focus();if(previous&&previous!==input)previous.dispatch('focusout',{relatedTarget:input});};
 // Chromium emits focusout(null) while the focused child is still connected,
 // then moves document focus to BODY when replace/empty removes that child.
 list.empty=()=>{const focused=f.doc.activeElement;if(focused&&list.contains(focused)){removalFocusouts++;focused.dispatch('focusout',{relatedTarget:null});f.doc.activeElement=null;}empty();};
 const pager=(label:string)=>list.querySelectorAll('button').find(button=>button.getAttribute('aria-label')===label)!;
 let next=pager('搜索下一页');next.focus();input.dispatch('focusout',{relatedTarget:next});next.click();assert.equal(f.view.searchPage,1);assert.equal(list.hidden,false);assert.equal(list.querySelectorAll('.ts-brain-search-result').length,2);const previous=pager('搜索上一页');assert.equal(f.doc.activeElement,previous);assert.equal(previous.disabled,false);
 previous.click();assert.equal(f.view.searchPage,0);assert.equal(list.hidden,false);assert.equal(list.querySelectorAll('.ts-brain-search-result').length,10);next=pager('搜索下一页');assert.equal(f.doc.activeElement,next);assert.equal(removalFocusouts,0);
 const outside=title(f,'b');outside.focus();next.dispatch('focusout',{relatedTarget:outside});assert.equal(list.hidden,true);assert.equal(f.doc.activeElement,outside);assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);
});
test('search paging never hands focus from an outside editor, inactive view or another document',()=>{
 for(const reason of ['outside','inactive','unfocused','document']){
  const f=fixture();for(let i=0;i<5;i++)f.board.nodes.push(card('page-extra-'+i));f.view.refresh();f.view.focusSearch();const list=f.el.querySelector('.ts-brain-search-results')!,next=list.querySelectorAll('button').find(button=>button.getAttribute('aria-label')==='搜索下一页')!;
  next.focus();if(reason==='outside')title(f,'b').focus();if(reason==='inactive')f.host.isActive=()=>false;if(reason==='unfocused')f.doc.focused=false;
  const other=new Doc(),foreign=new El('ROOT',other).createEl('input');foreign.focus();if(reason==='document')f.el.ownerDocument=other;
  const prior=f.el.ownerDocument.activeElement;let handoffs=0;const focus=f.el.querySelector('input')!.focus;f.el.querySelector('input')!.focus=()=>{handoffs++;focus();};next.click();
  assert.equal(f.view.searchPage,1,reason);assert.equal(handoffs,0,reason);assert.equal(f.el.ownerDocument.activeElement,prior,reason);assert.equal(other.activeElement,foreign,reason);assert.equal(f.saves.length,0,reason);
 }
});
test('leaving the whole search region closes results while retaining the chosen title or reading focus',()=>{
 const f=fixture();action(node(f,'a'),'expand').click();const editor=f.previews[0].body.createEl('input'),input=f.el.querySelector('input')!,list=f.el.querySelector('.ts-brain-search-results')!;
 for(const destination of [title(f,'b'),editor]){f.view.focusSearch();input.value='标题';input.dispatch('input');destination.focus();input.dispatch('focusout',{relatedTarget:destination});assert.equal(list.hidden,true);assert.equal(input.getAttribute('aria-expanded'),'false');assert.equal(f.doc.activeElement,destination);assert.equal(input.value,'标题');}
 assert.equal(f.saves.length,1);assert.equal(f.board.brain!.centerId,'b');
});
test('search focusout safely closes for a foreign document, window target or no target without stealing focus',()=>{
 const f=fixture(),input=f.el.querySelector('input')!,list=f.el.querySelector('.ts-brain-search-results')!,otherDoc=new Doc(),foreign=new El('ROOT',otherDoc);
 for(const relatedTarget of [foreign,otherDoc.defaultView,null]){f.view.focusSearch();const current=f.doc.activeElement;assert.doesNotThrow(()=>input.dispatch('focusout',{relatedTarget}));assert.equal(list.hidden,true);assert.equal(f.doc.activeElement,current);assert.equal(f.saves.length,0);}
});
test('continuous pointer pan updates the camera without rewriting the unchanged zoom label',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!,label=action(f.el,'zoom-reset');let labels=0,panningStates=0;
 const setText=label.setText.bind(label),add=stage.classList.add;label.setText=value=>{labels++;setText(value);};stage.classList.add=(...values)=>{if(values.includes('is-panning'))panningStates++;add(...values);};
 stage.dispatch('pointerdown',{pointerId:4,clientX:30,clientY:30});stage.dispatch('pointermove',{pointerId:4,clientX:70,clientY:60});stage.dispatch('pointermove',{pointerId:4,clientX:100,clientY:90});stage.dispatch('pointerup',{pointerId:4,clientX:100,clientY:90});
 assert.equal(labels,0);assert.equal(panningStates,1);assert.equal(f.viewports.length,0);f.view.flushPendingViewport();assert.equal(f.viewports.length,1);
 action(f.el,'zoom-in').click();assert.equal(labels,1);
});
test('one unscaled selection toolbar keeps every action available at every zoom without per-node floats',()=>{
 const f=fixture();f.host.createRelation=()=>{};const toolbar=f.el.querySelector('.ts-brain-selection')!,before=clone(f.board),stage=f.el.querySelector('.ts-brain-stage')!;
 assert(!stage.contains(toolbar));assert.equal(toolbar.querySelectorAll('button').length,9);assert(toolbar.querySelector('.ts-brain-selection-relations')!.hidden);
 for(const zoom of [.15,.2,.37,.72,1,2.5]){f.view.zoomAt(zoom);title(f,'a').click();assert.equal(toolbar.dataset.brainSelectedId,'a');assert.equal(toolbar.style.transform,undefined);assert.equal(f.el.querySelectorAll('.ts-brain-node-actions').length,0);assert.equal(f.el.querySelectorAll('.ts-brain-anchor').length,0);assert.equal(action(f.el,'expand').hidden,false);assert.equal(action(f.el,'open').hidden,false);for(const side of ['top','bottom','left','right'])assert.equal(action(f.el,'add-'+side).hidden,false);assert.equal(f.board.brain!.centerId,'b');}
 assert.deepEqual(clone(f.board.nodes),before.nodes);assert.deepEqual(f.board.brain,before.brain);assert.equal(f.saves.length,0);
});
test('click or keyboard focus selects a noncenter node without navigation; explicit center preserves history',()=>{
 const f=fixture(),before=clone(f.board),camera={...f.view.camera};title(f,'a').click();assert.equal(f.view.activeNodeId,'a');assert.equal(node(f,'a').classList.contains('is-selected'),true);assert.equal(title(f,'a').getAttribute('aria-pressed'),'true');assert.deepEqual(clone(f.board),before);assert.deepEqual(f.view.camera,camera);assert.equal(f.viewports.length,0);
 title(f,'c').focus();assert.equal(f.view.activeNodeId,'c');assert.equal(node(f,'a').classList.contains('is-selected'),false);assert.equal(title(f,'a').getAttribute('aria-pressed'),'false');assert.equal(f.board.brain!.centerId,'b');title(f,'c').dispatch('keydown',{key:'ArrowDown',altKey:true});assert.equal(f.doc.activeElement,action(f.el,'center'));
 action(f.el,'center').click();assert.equal(f.board.brain!.centerId,'c');assert.deepEqual(f.board.brain!.history.entries,['b','c']);assert.equal(f.saves.length,1);
});
test('selected noncenter retains expand/open, all four relation directions and menu creation without changing center',()=>{
 const f=fixture(),calls:any[]=[];f.host.createRelation=(...args:any[])=>calls.push(args);title(f,'a').click();const before=clone(f.board.nodes);action(f.el,'expand').click();assert.equal(f.board.brain!.expandedIds.includes('a'),true);action(f.el,'open').click();assert.equal(f.opens[0].id,'a');
 for(const side of ['top','bottom','left','right'])action(f.el,'add-'+side).click();assert.deepEqual(calls.map(args=>args.slice(0,2)),['top','bottom','left','right'].map(side=>['a',side]));assert(calls.every(args=>args[2]()));action(f.el,'node-menu').click();assert(menuItem('新建节点'));menuItem('新建白板…').click();assert.deepEqual(calls[4].slice(0,2),['a','bottom']);assert.equal(calls[4][3],'board');assert.equal(f.board.brain!.centerId,'b');assert.deepEqual(clone(f.board.nodes),before);
 title(f,'c').click();assert(calls.every(args=>!args[2]()));assert(!f.opens[0].current());title(f,'a').click();assert(calls.every(args=>!args[2]()));assert(!f.opens[0].current());
});
for(const boundary of ['editor','background','inactive'])test(`zooming the shared tools preserves the ${boundary} focus boundary`,()=>{
 const f=fixture(),editor=f.root.createEl('input');title(f,'a').click();if(boundary==='editor')editor.focus();else action(f.el,'expand').focus();if(boundary==='background')f.doc.focused=false;if(boundary==='inactive')f.host.isActive=()=>false;const focused=f.doc.activeElement;
 for(const zoom of [.15,.72,2.5]){f.view.zoomAt(zoom);assert.equal(f.doc.activeElement,focused);assert.equal(f.view.activeNodeId,'a');}assert.equal(f.saves.length,0);
});
test('keyboard undo is scoped to nonediting controls and does not swallow composition',()=>{const f=fixture();let calls=0;f.host.shortcut=()=>{calls++;return true;};title(f,'a').dispatch('keydown',{key:'z',metaKey:true});assert.equal(calls,1);f.el.querySelector('input')!.dispatch('keydown',{key:'z',metaKey:true});title(f,'a').dispatch('keydown',{key:'z',metaKey:true,isComposing:true});assert.equal(calls,1);});
test('same-session other-window refresh never steals focus from external native editor',()=>{const f=fixture(),editor=f.root.createEl('input');editor.focus();f.board.brain=state.updateBoardMindmapState(f.board.brain!,{type:'center',id:'a'},f.board.nodes);f.view.refresh();assert.equal(f.doc.activeElement,editor);assert.equal(f.saves.length,0);});
test('owning board rename replaces async preview scope without losing navigation',()=>{const f=fixture();action(node(f,'a'),'expand').click();const old=f.previews[0],history=clone(f.board.brain!.history);f.snapshot.path='Renamed.thoughtspace';assert.equal(old.current(),false);f.view.refresh();assert.equal(old.scope.loaded,false);assert.equal(f.previews.length,2);assert.deepEqual(f.board.brain!.history,history);});
test('mount/refresh/resize never saves camera while explicit zoom debounces and flushes before close',()=>{const f=fixture();f.view.refresh();assert.equal(f.viewports.length,0);action(f.el,'zoom-in').click();action(f.el,'zoom-in').click();assert.equal(f.viewports.length,0);assert.equal(f.doc.timers.size,1);f.view.unload();assert.equal(f.viewports.length,1);assert.equal(f.doc.timers.size,0);assert.ok(f.viewports[0].zoom>.72);});
test('saved brain cameras below 20 percent retain their exact legal zoom on refresh and reopen',()=>{
 for(const zoom of [.15,.17643254430216013,.199999]){const f=fixture(),before=clone(f.board);f.board.brainViewport={x:5.3890829129478846,y:-12,zoom};const expected={...f.board.brainViewport};f.view.refresh();assert.deepEqual(f.view.camera,expected);f.view.refresh();assert.deepEqual(f.view.camera,expected);f.view.unload();const reopened=new View({},f.el,f.host);reopened.load();assert.deepEqual(reopened.camera,expected);assert.equal(f.viewports.length,0);assert.deepEqual(clone(f.board.nodes),before.nodes);assert.deepEqual(f.board.edges,before.edges);assert.deepEqual(f.board.brain,before.brain);reopened.unload();}
});
test('a short-screen fit persists a legal minimum zoom and reopening preserves that exact camera',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!;f.board.nodes=Array.from({length:1000},(_,i)=>brainIdeaNode('fit-'+i,'Idea '+i));f.board.edges=Array.from({length:999},(_,i)=>({id:'fit-edge-'+i,from:'fit-'+Math.floor(i/10),to:'fit-'+(i+1),kind:'branch' as const,label:''}));f.board.brain={...state.createBoardMindmapState('fit-0'),descendantDepth:5};stage.clientWidth=390;stage.clientHeight=120;f.view.refresh();const before=clone(f.board);assert.ok(f.view.layout.width*.15>stage.clientWidth||f.view.layout.height*.15>stage.clientHeight,'fixture must exceed the stage even at the persisted minimum');f.view.fitToCanvas();assert.equal(f.view.camera.zoom,.15);const projected={left:f.view.camera.x,top:f.view.camera.y,right:f.view.camera.x+f.view.layout.width*f.view.camera.zoom,bottom:f.view.camera.y+f.view.layout.height*f.view.camera.zoom};assert(Math.abs((projected.left+projected.right)/2-stage.clientWidth/2)<1e-8);assert(Math.abs((projected.top+projected.bottom)/2-stage.clientHeight/2)<1e-8);assert(projected.left<0||projected.top<0||projected.right>stage.clientWidth||projected.bottom>stage.clientHeight);const expected={...f.view.camera};f.view.flushPendingViewport();assert.deepEqual(f.viewports,[expected]);assert.deepEqual(f.board.brainViewport,expected);assert.ok(model.parseBoard(JSON.stringify(f.board)));f.view.refresh();assert.deepEqual(f.view.camera,expected);f.view.unload();const reopened=new View({},f.el,f.host);reopened.load();assert.deepEqual(reopened.camera,expected);assert.deepEqual(f.board.nodes,before.nodes);assert.deepEqual(f.board.edges,before.edges);assert.deepEqual(f.board.brain,before.brain);reopened.unload();
});
test('control-row reflow retains a restored camera while an actual pane resize preserves its reading anchor',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!;f.root.clientWidth=f.el.clientWidth=390;f.root.clientHeight=380;f.el.clientHeight=300;stage.clientWidth=346;stage.clientHeight=114;f.view.refresh();f.board.brainViewport={x:30.5,y:-64.95625,zoom:.15};const saved={...f.board.brainViewport};f.view.refresh();assert.deepEqual(f.view.camera,saved);
 // The pager finishes rendering inside the same pane: it consumes 93px.
 f.el.clientHeight=207;stage.clientHeight=21;f.view.refresh();assert.deepEqual(f.view.camera,saved);assert.deepEqual(f.board.brainViewport,saved);assert.equal(f.viewports.length,0);
 const previous=f.view.layout,camera={...f.view.camera},distance=(item:any)=>Math.hypot(camera.x+(item.x+item.width/2)*camera.zoom-stage.clientWidth/2,camera.y+(item.y+item.height/2)*camera.zoom-stage.clientHeight/2),anchor=previous.nodes.reduce((best:any,item:any)=>!best||distance(item)<distance(best)?item:best,undefined),offset={x:camera.x+(anchor.x+anchor.width/2)*camera.zoom-stage.clientWidth/2,y:camera.y+(anchor.y+anchor.height/2)*camera.zoom-stage.clientHeight/2};
 f.root.clientWidth=f.el.clientWidth=844;f.root.clientHeight=f.el.clientHeight=390;stage.clientWidth=800;stage.clientHeight=160;f.view.refresh();const next=f.view.layout.nodes.find((item:any)=>item.id===anchor.id);assert.equal(f.view.camera.zoom,saved.zoom);assert(Math.abs(f.view.camera.x+(next.x+next.width/2)*camera.zoom-stage.clientWidth/2-offset.x)<1e-8);assert(Math.abs(f.view.camera.y+(next.y+next.height/2)*camera.zoom-stage.clientHeight/2-offset.y)<1e-8);assert.deepEqual(f.board.brainViewport,saved);assert.equal(f.viewports.length,0);
 // An external saved-camera restoration in the same refresh takes precedence.
 f.root.clientWidth=f.el.clientWidth=390;f.root.clientHeight=f.el.clientHeight=380;stage.clientWidth=346;stage.clientHeight=21;f.board.brainViewport={x:11,y:22,zoom:.17643254430216013};f.view.refresh();assert.deepEqual(f.view.camera,f.board.brainViewport);assert.equal(f.viewports.length,0);
});
test('camera intent cannot save into a replacement session',()=>{const f=fixture();action(f.el,'zoom-in').click();f.setSnapshot({...f.snapshot,key:{}});f.view.flushViewport();assert.equal(f.viewports.length,0);});
test('ordinary wheel pans only the graph and preview wheel retains native scrolling',()=>{const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!,before=clone(f.board.nodes);const event=stage.dispatch('wheel',{deltaX:20,deltaY:40});assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);f.view.flushViewport();assert.equal(f.viewports.length,1);assert.deepEqual(clone(f.board.nodes),before);action(node(f,'a'),'expand').click();const wheel=f.previews[0].body.dispatch('wheel',{deltaY:30});assert.equal(wheel.defaultPrevented,false);assert.equal(wheel.stopped,true);});

test('wheel bursts accumulate the exact latest camera but project once per frame',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!,camera={...f.view.camera};let writes=0;const transform=f.view.transform.bind(f.view);f.view.transform=()=>{writes++;transform();};
 for(let i=0;i<12;i++)stage.dispatch('wheel',{deltaX:2,deltaY:3});assert.equal(writes,0);assert.equal(f.doc.frames.size,1);assert.equal(f.view.camera.x,camera.x-24);assert.equal(f.view.camera.y,camera.y-36);
 f.doc.tick();assert.equal(writes,1);assert.equal(f.doc.frames.size,0);f.view.flushPendingViewport();assert.deepEqual(f.viewports[0],f.view.camera);
});
test('zoom bursts preserve changing anchors while DOM projection is deferred',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!;let expected={...f.view.camera};
 for(const [x,y,delta]of [[100,80,-20],[200,120,30],[90,70,-10]]){const zoom=Math.max(.15,Math.min(2.5,expected.zoom*Math.exp(-delta*.002))),scale=zoom/expected.zoom;expected={x:x-(x-expected.x)*scale,y:y-(y-expected.y)*scale,zoom};stage.dispatch('wheel',{clientX:x,clientY:y,deltaY:delta,ctrlKey:true});}
 assert.deepEqual(f.view.camera,expected);assert.equal(f.doc.frames.size,1);f.doc.tick();assert.equal(f.view.scene.style.transform,`translate(${expected.x}px, ${expected.y}px) scale(${expected.zoom})`);
});
test('zoom updates only the scene and label while shared action controls retain unscaled geometry',()=>{
 const f=fixture();f.view.zoomAt(.5);assert.equal(f.view.shell.style.getPropertyValue('--brain-action-scale'),'');assert.equal(f.view.shell.style.getPropertyValue('--brain-port-scale'),'');for(const item of f.view.nodes.values()){assert.equal(item.title.style.getPropertyValue('--brain-action-scale'),'');assert.equal(item.root.style.getPropertyValue('--brain-action-scale'),'');}assert.equal(f.view.selection.root.style.transform,undefined);
});
test('refresh preserves unchanged title and expansion icon DOM but still reflects edits',()=>{
 const f=fixture(),item=f.view.nodes.get('b');let textWrites=0,iconWrites=0;const setText=item.label.setText.bind(item.label);item.label.setText=(text:string)=>{textWrites++;setText(text);};f.view.selection.expand.dataset=new Proxy(f.view.selection.expand.dataset,{set(target:Record<string,string>,key:string,value:string){if(key==='icon')iconWrites++;target[key]=value;return true;}});
 f.view.refresh();assert.equal(textWrites,0);assert.equal(iconWrites,0);action(node(f,'b'),'expand').click();assert.equal(iconWrites,1);f.view.refresh();assert.equal(iconWrites,1);action(node(f,'b'),'expand').click();assert.equal(iconWrites,2);f.board.nodes.find(n=>n.id==='b')!.title='Changed title';f.view.refresh();assert.equal(textWrites,1);assert.equal(item.label.textContent,'Changed title');assert.equal(iconWrites,2);
});
test('pointer cancellation projects and saves the final input without leaving a frame',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!;const before={...f.view.camera};stage.dispatch('pointerdown',{pointerId:9,clientX:10,clientY:20});stage.dispatch('pointermove',{pointerId:9,clientX:60,clientY:80});assert.equal(f.doc.frames.size,1);stage.dispatch('pointercancel',{pointerId:9});assert.equal(f.doc.frames.size,0);assert.equal(f.view.camera.x,before.x+50);assert.equal(f.view.camera.y,before.y+60);f.view.flushPendingViewport();assert.deepEqual(f.viewports[0],f.view.camera);
});
test('replacement refresh and unload cannot render a stale scheduled camera',()=>{
 for(const boundary of ['refresh','unload']){const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!;stage.dispatch('wheel',{deltaY:20});assert.equal(f.doc.frames.size,1);if(boundary==='refresh'){f.setSnapshot({...f.snapshot,board:{...clone(f.board),brainViewport:{x:4,y:5,zoom:1.2}},key:{}});f.view.refresh();assert.deepEqual(f.view.camera,{x:4,y:5,zoom:1.2});}else f.view.unload();assert.equal(f.doc.frames.size,0);f.doc.tick();}
});
test('removed center stays explicit and history back recovers without choosing arbitrary replacement',()=>{const f=fixture();navigateCenter(f,'a');f.board.nodes=f.board.nodes.filter(node=>node.id!=='a');const saves=f.saves.length;f.view.refresh();assert.match(f.el.textContent,/中心节点已移除/);assert.equal(f.saves.length,saves);action(f.el,'back').click();assert.equal(f.board.brain!.centerId,'b');});
test('empty dedicated board guides existing knowledge with one usable add intent and no synthetic node',()=>{const f=fixture();f.board.nodes=[];f.board.edges=[];f.board.brain=state.createBoardMindmapState();f.view.refresh();const empty=f.el.querySelector('.ts-brain-empty')!;assert.equal(f.el.querySelectorAll('.ts-brain-node').length,0);assert.match(empty.textContent,/从已有知识开始/);assert.match(empty.textContent,/仓库中的笔记或子白板/);assert.match(empty.textContent,/第一个节点将成为中心/);assert.equal(empty.querySelectorAll('button').length,1);assert.equal(action(empty,'add').getAttribute('aria-label'),'添加知识节点');action(empty,'add').click();assert.equal(f.added,1);assert.equal(f.saves.length,0);});
test('large neighborhoods and search are bounded with reachable next pages',()=>{const f=fixture();for(let i=0;i<50;i++){f.board.nodes.push(card('extra'+i));f.board.edges.push({id:'extra'+i,from:'b',to:'extra'+i,label:''});}f.view.refresh();assert.ok(f.el.querySelectorAll('.ts-brain-node').length<=20);const first=f.el.querySelectorAll('.ts-brain-node').map(item=>item.dataset.brainNodeId);action(f.el,'next-page').click();assert.ok(f.el.querySelectorAll('.ts-brain-node').some(item=>!first.includes(item.dataset.brainNodeId)));const input=f.el.querySelector('input')!;input.dispatch('focus');assert.equal(f.el.querySelectorAll('.ts-brain-search-result').length,10);assert.equal(f.saves.length,0);});
test('save failure leaves center unchanged and surfaces actionable feedback',()=>{const f=fixture();f.host.change=()=>{throw Error('保存失败，请重试');};navigateCenter(f,'a');assert.equal(f.board.brain!.centerId,'b');assert.match(f.el.querySelector('.ts-brain-status')!.textContent,/保存失败/);});

test('explicit focus after offscreen navigation recenters camera, preserves zoom and saves intent',()=>{const f=fixture();f.view.camera={x:-1400,y:-900,zoom:1.25};f.view.fitCamera=false;const stage=f.el.querySelector('.ts-brain-stage')!;stage.getBoundingClientRect=()=>({left:0,top:0,right:600,bottom:400,width:600,height:400});f.view.nodes.get('b').pill.getBoundingClientRect=()=>({left:-800,top:-500,right:-500,bottom:-410,width:300,height:90});const original=clone(f.board.nodes);f.view.focusNode('b');assert.equal(f.view.camera.zoom,1.25);assert.notEqual(f.view.camera.x,-1400);assert.notEqual(f.view.camera.y,-900);assert.equal(f.doc.activeElement,title(f,'b'));f.view.flushPendingViewport();assert.equal(f.viewports.length,1);assert.deepEqual(clone(f.board.nodes),original);});
test('refresh with offscreen camera never recenters or focuses another window',()=>{const f=fixture(),editor=f.root.createEl('input');editor.focus();f.view.camera={x:-1400,y:-900,zoom:1.25};f.view.fitCamera=false;f.view.refresh();assert.deepEqual(f.view.camera,{x:-1400,y:-900,zoom:1.25});assert.equal(f.doc.activeElement,editor);assert.equal(f.viewports.length,0);});
test('directed native arrows use unique per-view markers and ordinary associations remain undirected',()=>{const a=fixture(),b=fixture(),links=a.el.querySelector('.ts-brain-links')!.querySelectorAll('path'),directed=links.find(link=>link.dataset.brainRole==='outgoing')!,associated=links.find(link=>link.dataset.brainRole==='associated')!;assert.match(directed.getAttribute('marker-end')||'',/^url\(#ts-brain-arrow-/);assert.equal(associated.getAttribute('marker-end'),null);const marker=a.el.querySelector('marker')!,other=b.el.querySelector('marker')!;assert.notEqual(marker.getAttribute('id'),other.getAttribute('id'));assert.equal(directed.dataset.brainFrom,'b');assert.equal(directed.dataset.brainTo,'d');});

test('history boundary buttons hand focus to visible center so subsequent keyboard history remains scoped',()=>{const f=fixture();navigateCenter(f,'a');const back=action(f.el,'back');back.focus();back.click();assert.equal(back.disabled,true);assert.equal(f.doc.activeElement,title(f,'b'));const forward=action(f.el,'forward');forward.focus();forward.click();assert.equal(forward.disabled,true);assert.equal(f.doc.activeElement,title(f,'a'));f.doc.activeElement!.dispatch('keydown',{key:'ArrowLeft',altKey:true});assert.equal(f.board.brain!.centerId,'b');});

test('Cmd K in a native editable preview leaves native editing untouched',()=>{const f=fixture();action(node(f,'a'),'expand').click();const editor=f.previews[0].body.createEl('input');editor.focus();const event=editor.dispatch('keydown',{key:'k',metaKey:true});assert.equal(event.defaultPrevented,false);assert.equal(event.stopped,false);assert.equal(f.doc.activeElement,editor);assert.equal(f.el.querySelector('.ts-brain-search-results')!.hidden,true);assert.equal(f.saves.length,1);});

for(const cls of ['tag','internal-link','external-link'])test(`native preview ${cls} click keeps delegated Obsidian handlers reachable`,()=>{const f=fixture();action(node(f,'a'),'expand').click();const link=f.previews[0].body.createEl('a',{cls});let bubbled=0;f.root.listeners.set('click',new Set([()=>bubbled++]));const event=link.dispatch('click');assert.equal(event.stopped,false);assert.equal(event.defaultPrevented,false);assert.equal(bubbled,1);assert.equal(f.saves.length,1);});

test('background window repaint does not refocus its remembered recent-history button',()=>{const f=fixture(),recent=f.el.querySelector('[data-brain-recent-id="b"]')!;recent.focus();f.doc.focused=false;f.view.refresh();assert.equal(f.doc.activeElement,recent);assert.equal(recent.isConnected,false);assert.notEqual(f.doc.activeElement,f.el.querySelector('[data-brain-recent-id="b"]'));assert.equal(f.saves.length,0);});
test('foreground recent-history repaint preserves keyboard focus on the same logical entry',()=>{const f=fixture(),recent=f.el.querySelector('[data-brain-recent-id="b"]')!;recent.focus();f.doc.focused=true;f.view.refresh();assert.notEqual(f.doc.activeElement,recent);assert.equal(f.doc.activeElement,f.el.querySelector('[data-brain-recent-id="b"]'));assert.equal(f.saves.length,0);});

test('background Electron popout with misleading document focus cannot restore history focus',()=>{const f=fixture(),recent=f.el.querySelector('[data-brain-recent-id="b"]')!;recent.focus();f.doc.focused=true;f.host.isActive=()=>false;f.view.refresh();assert.equal(f.doc.activeElement,recent);assert.equal(recent.isConnected,false);assert.notEqual(f.doc.activeElement,f.el.querySelector('[data-brain-recent-id="b"]'));assert.equal(f.saves.length,0);});
test('trusted pointer activates owning leaf before stopping delegation; refresh and synthetic pointer never activate',()=>{const f=fixture();let calls=0;f.host.activate=()=>{calls++;};f.view.refresh();assert.equal(calls,0);title(f,'a').dispatch('pointerdown',{isTrusted:false});assert.equal(calls,0);const event=title(f,'a').dispatch('pointerdown',{isTrusted:true});assert.equal(calls,1);assert.equal(event.stopped,true);f.view.refresh();assert.equal(calls,1);});

test('unchanged center clicks and history boundaries retain graph and history DOM while focusing the center',()=>{
 const f=fixture(),before=clone(f.board),shell=f.el.querySelector('.ts-brain-shell')!,svg=f.el.querySelector('.ts-brain-links')!,recent=f.el.querySelector('.ts-brain-recent')!;
 const links=[...svg.children],entries=[...recent.children],center=title(f,'b');
 const unchanged=()=>{assert.equal(svg.children.length,links.length);links.forEach((link,index)=>assert.ok(svg.children[index]===link,'Unchanged navigation must retain each SVG element'));assert.equal(recent.children.length,entries.length);entries.forEach((entry,index)=>assert.ok(recent.children[index]===entry,'Unchanged navigation must retain each history control'));assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);assert.equal(f.doc.activeElement,center);};
 for(let i=0;i<3;i++){shell.focus();center.click();unchanged();}
 for(const key of ['ArrowLeft','ArrowRight']){shell.focus();const event=shell.dispatch('keydown',{key,altKey:true});assert.equal(event.defaultPrevented,true);unchanged();}
});

test('unchanged navigation clears an earlier error and still brings an offscreen current center into view',()=>{
 const f=fixture(),before=clone(f.board),change=f.host.change,status=f.el.querySelector('.ts-brain-status')!;
 f.host.change=()=>{throw Error('保存失败，请重试');};navigateCenter(f,'a');assert.match(status.textContent,/保存失败/);assert.deepEqual(clone(f.board),before);
 f.host.change=change;navigateCenter(f,'b');assert.equal(status.textContent,'');assert.equal(f.doc.activeElement,title(f,'b'));assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);
 const open=f.host.open;f.host.open=()=>{throw Error('打开来源失败，请重试');};action(node(f,'b'),'open').click();assert.match(status.textContent,/打开来源失败/);assert.deepEqual(clone(f.board),before);
 f.host.open=open;navigateCenter(f,'b');assert.equal(status.textContent,'');assert.equal(f.doc.activeElement,title(f,'b'));assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);
 const stage=f.el.querySelector('.ts-brain-stage')!;stage.getBoundingClientRect=()=>({left:0,top:0,right:600,bottom:400,width:600,height:400});
 f.view.camera={x:-1400,y:-900,zoom:1.25};f.view.fitCamera=false;f.view.nodes.get('b').pill.getBoundingClientRect=()=>({left:-800,top:-500,right:-500,bottom:-410,width:300,height:90});
 navigateCenter(f,'b');assert.equal(f.view.camera.zoom,1.25);assert.notEqual(f.view.camera.x,-1400);assert.notEqual(f.view.camera.y,-900);assert.equal(f.doc.activeElement,title(f,'b'));assert.equal(f.saves.length,0);assert.deepEqual(f.board.brain,before.brain);assert.deepEqual(clone(f.board.nodes),before.nodes);
 assert.equal(f.viewports.length,0);f.view.flushPendingViewport();assert.equal(f.viewports.length,1);assert.deepEqual(f.viewports[0],f.view.camera);
});

test('refresh reads stage dimensions once before graph writes and later resize or explicit fit uses fresh dimensions',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!,scene=f.el.querySelector('.ts-brain-scene')!,svg=f.el.querySelector('.ts-brain-links')!;
 let width=1200,height=800;const events:string[]=[];
 Object.defineProperty(stage,'clientWidth',{configurable:true,get:()=>{events.push('read:width');return width;}});Object.defineProperty(stage,'clientHeight',{configurable:true,get:()=>{events.push('read:height');return height;}});
 scene.style=new Proxy(scene.style,{set(target,key,value){events.push('write:scene');return Reflect.set(target,key,value);}});
 const setAttribute=svg.setAttribute.bind(svg);svg.setAttribute=(name,value)=>{events.push('write:svg');setAttribute(name,value);};
 const measuredOnceBeforeWrites=()=>{assert.equal(events.filter(event=>event==='read:width').length,1);assert.equal(events.filter(event=>event==='read:height').length,1);const firstWrite=events.findIndex(event=>event.startsWith('write:'));assert(firstWrite>=0);assert(events.indexOf('read:width')<firstWrite,'Stage width must be read before graph DOM writes');assert(events.indexOf('read:height')<firstWrite,'Stage height must be read before graph DOM writes');};
 const centered=()=>{const camera=f.view.camera,display=f.view.layout;assert(Math.abs(camera.x+display.width*camera.zoom/2-width/2)<1e-8);assert(Math.abs(camera.y+display.height*camera.zoom/2-height/2)<1e-8);};
 f.view.refresh();measuredOnceBeforeWrites();centered();assert.equal(f.view.layout.width,1200);assert.equal(f.viewports.length,0);
 events.length=0;width=1600;height=1000;f.view.refresh();measuredOnceBeforeWrites();centered();assert.equal(f.view.layout.width,1600);assert.equal(f.viewports.length,0);
 const zoom=f.view.camera.zoom;events.length=0;width=500;height=300;f.view.fitToCanvas();measuredOnceBeforeWrites();centered();assert(f.view.camera.zoom<zoom);assert(f.view.layout.width*f.view.camera.zoom<=width);assert(f.view.layout.height*f.view.camera.zoom<=height);assert.equal(f.viewports.length,0);
 f.view.flushPendingViewport();assert.equal(f.viewports.length,1);assert.deepEqual(f.viewports[0],f.view.camera);
});

test('continuous query edits followed immediately by arrows and Enter select current results and reject an empty result set',()=>{
 const f=fixture(),input=f.el.querySelector('input')!;f.view.focusSearch();
 for(const value of ['N','No','Notes/']){input.value=value;input.dispatch('input');}
 assert.equal(f.el.querySelectorAll('.ts-brain-search-result').length,5);input.dispatch('keydown',{key:'ArrowDown'});input.dispatch('keydown',{key:'ArrowDown'});
 const rows=f.el.querySelectorAll('.ts-brain-search-result');assert.equal(rows.filter(row=>row.getAttribute('aria-selected')==='true').length,1);assert.equal(rows[2].getAttribute('aria-selected'),'true');assert.match(rows[2].textContent,/标题 c/);assert.equal(f.doc.activeElement,input);assert.equal(f.doc.frames.size,0);
 input.dispatch('keydown',{key:'Enter'});assert.equal(f.board.brain!.centerId,'c');assert.equal(f.saves.length,1);assert.equal(f.doc.activeElement,title(f,'c'));assert.equal(f.el.querySelector('.ts-brain-search-results')!.hidden,true);
 f.view.focusSearch();input.value='Notes/a.md';input.dispatch('input');assert.equal(f.el.querySelectorAll('.ts-brain-search-result').length,1);
 input.value='__no_such_source__';input.dispatch('input');input.dispatch('keydown',{key:'ArrowDown'});input.dispatch('keydown',{key:'Enter'});
 assert.equal(f.el.querySelectorAll('.ts-brain-search-result').length,0);assert.equal(f.board.brain!.centerId,'c');assert.equal(f.saves.length,1);assert.equal(f.doc.activeElement,input);assert.equal(f.doc.frames.size,0);
});

// Keep the renderer DOM doubles, but exercise production Session replacement,
// history and persistence so undo cannot be reduced to assigning an expected camera.
function sessionRendererFixture(savedViewport?:{x:number;y:number;zoom:number}){
 const first=fixture(),initial=clone(first.board);initial.nodes.find(node=>node.kind==='text')!.text='保留文本';if(savedViewport)initial.brainViewport={...savedViewport};
 let disk=JSON.stringify(initial,null,2),writes=0;
 const main=readFileSync('src/main.ts','utf8'),start=main.indexOf('class Session {'),end=main.indexOf('\ntype BoardGraph=',start);
 const deps={...model,...mindmap,...geometry,...state,...brain,reflowReadingContent,Notice:class{},EXT:'thoughtspace',report:()=>{}};
 const Session=new Function(...Object.keys(deps),transformSync(main.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
 const plugin={app:{vault:{process:async(_file:unknown,change:(raw:string)=>string)=>{disk=change(disk);writes++;},read:async()=>disk}}};
 const owner=new Session(plugin,{path:'Board.thoughtspace',basename:'Board'},disk),views:ReturnType<typeof fixture>[]=[];
 const bind=(f:ReturnType<typeof fixture>)=>{
  f.host.snapshot=()=>({board:owner.board,path:owner.file.path,key:owner,readOnly:owner.blocked});
  f.host.change=(next:state.BoardMindmapState)=>owner.changeBrainState(next);
  f.host.viewport=(next:{x:number;y:number;zoom:number})=>owner.changeBrainViewport(next);
  owner.listeners.add((kind:string)=>{if(kind==='board')f.view.refresh();});f.view.refresh();views.push(f);return f;
 };
 bind(first);return{first,owner,views,makeView:()=>bind(fixture()),disk:()=>disk,writes:()=>writes};
}

function closingRendererFixture(){
 const f=sessionRendererFixture({x:-200,y:18.3,zoom:1});f.first.view.unload();f.owner.listeners.clear();const main=readFileSync('src/main.ts','utf8');
 const take=(start:string,end:string)=>{const from=main.indexOf(start),to=main.indexOf(end,from);assert(from>=0&&to>from);return main.slice(from,to);};
 const code='class BoardView extends Component{'+take('  private fitLegacyGeometry(){','  private point(')+take('  private clearBrainBoard(){','  private addBrainObject(')+'};return BoardView';
 const deps={renderBoardSaveFeedback,BrainRefreshCache,...descendants,...ports,LocalRelationMotion,...state,...brain,...relations,Component,BrainBoardView:View,View:class{},isDesktopRuntime:()=>true,Notice:class{},TFile:class{}};
 const Parent=new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps)),parent=new Parent(),leaf={view:parent},content=f.first.root.createDiv(),plugin=f.owner.plugin;
 const navigationRefs=new Map<string,Set<{name:string;callback:(value?:unknown)=>void}>>(),workspace={getActiveViewOfType:()=>parent,on:(name:string,callback:(value?:unknown)=>void)=>{const ref={name,callback};const refs=navigationRefs.get(name)||new Set();refs.add(ref);navigationRefs.set(name,refs);return ref;},offref:(ref:{name:string;callback:(value?:unknown)=>void})=>navigationRefs.get(ref.name)?.delete(ref),trigger:(name:string,value?:unknown)=>{for(const ref of navigationRefs.get(name)||[])ref.callback(value);}};
 Object.assign(plugin,{refreshDock(){},refreshLocalRelations(){},clearMaterialDrag(){}});Object.assign(parent,{app:{workspace},plugin,leaf,contentEl:content,session:f.owner,closed:false,closing:false,dialogEpoch:0,brainObjectEpoch:0,sidebarRun:0,renderFrame:0,blankClicks:{cancel(){}},clearHandwritingBoard(){parent.handwritingView=undefined;parent.handwritingOwner=undefined;},clearCanvasGesture(){},clearNodes(){},finishMarquee(){},finishInlineForNavigation:async()=>{},cancelSaveFeedbackNavigation(){},renderSaveStatus(){},mindmapNative:()=>({relations:[],tagsByNode:new Map(),pendingPaths:[]}),mindmapSource:(_owner:any,id:string)=>({label:id,available:true,stamp:'1'})});
 parent.load();parent.renderBrainBoard();const renderer=parent.brainBoardView,el=parent.brainBoardEl;
 const paint=(kind:string)=>{if(kind==='board')parent.brainBoardView?.refresh();};f.owner.listeners.add(paint);parent.unsubscribe=()=>f.owner.listeners.delete(paint);
 const pan=()=>{const stage=el.querySelector('.ts-brain-stage')!;stage.dispatch('pointerdown',{pointerId:4,clientX:35,clientY:70});stage.dispatch('pointermove',{pointerId:4,clientX:80,clientY:95});stage.dispatch('pointerup',{pointerId:4});assert.deepEqual(renderer.camera,{x:-155,y:43.3,zoom:1});assert.equal(f.first.doc.timers.size,1);};
 const detach=()=>{content.remove();renderer.unload();};return{...f,parent,renderer,el,pan,detach,workspace,navigationRefs};
}
for(const transition of ['onUnloadFile','onClose'] as const)test(`detached Brain component unload before ${transition} preserves the last pan on immediate reopen`,async()=>{
 const f=closingRendererFixture();f.pan();f.detach();assert.equal(f.renderer.host.snapshot(),undefined);await f.parent[transition]();
 const reopened=model.parseBoard(f.disk());assert.deepEqual(reopened.brainViewport,{x:-155,y:43.3,zoom:1});assert.equal(f.first.doc.timers.size,0);assert.equal(f.owner.history.undoStack.length,0);assert.equal(f.writes(),1);
});
test('disposal rejects pending cameras after read-only, rename, undo, owner or presentation changes',async()=>{
 for(const reason of ['readOnly','rename','undo','owner','presentation']){
  const f=closingRendererFixture();f.pan();
  if(reason==='readOnly')f.owner.blocked=true;if(reason==='rename')f.owner.file.path='Renamed.thoughtspace';if(reason==='undo'){f.owner.listeners.clear();f.owner.changeBrainState(state.updateBoardMindmapState(f.owner.board.brain,{type:'center',id:'a'},f.owner.board.nodes));f.owner.undo();}if(reason==='owner')f.parent.session={board:f.owner.board,flush:async()=>{},changeBrainViewport:()=>{throw Error('Must reject the replacement owner');}};if(reason==='presentation'){delete f.owner.board.presentation;delete f.owner.board.brain;delete f.owner.board.brainViewport;}
  f.detach();await f.parent.onClose();await f.owner.flush();assert.deepEqual(model.parseBoard(f.disk()).brainViewport,{x:-200,y:18.3,zoom:1},reason);assert.equal(f.first.doc.timers.size,0,reason);
 }
});
test('formal close waits for the captured Session save before resolving',async()=>{
 const f=closingRendererFixture();let release!:()=>void,entered=false,closed=false;const gate=new Promise<void>(resolve=>{release=resolve;}),process=f.owner.plugin.app.vault.process;
 f.owner.plugin.app.vault.process=async(...args:any[])=>{entered=true;await gate;return process(...args);};f.owner.changeBrainState(state.updateBoardMindmapState(f.owner.board.brain,{type:'center',id:'a'},f.owner.board.nodes));for(let i=0;i<8;i++)await Promise.resolve();assert.equal(entered,true);
 const closing=f.parent.onClose().then(()=>{closed=true;});try{for(let i=0;i<8;i++)await Promise.resolve();assert.equal(closed,false,'Close must wait for the captured owner save');}finally{release();await closing;await f.owner.flush();}assert.equal(model.parseBoard(f.disk()).brain!.centerId,'a');
});
test('formal close waits for the save queued by canceling an ordinary canvas pan',async()=>{
 const f=closingRendererFixture();delete f.owner.board.presentation;delete f.owner.board.brain;delete f.owner.board.brainViewport;const restored={...f.owner.board.viewport};f.owner.board.viewport={...restored,x:45,y:25};let release!:()=>void,entered=false,closed=false;const gate=new Promise<void>(resolve=>{release=resolve;}),process=f.owner.plugin.app.vault.process;
 f.owner.plugin.app.vault.process=async(...args:any[])=>{entered=true;await gate;return process(...args);};f.parent.clearCanvasGesture=()=>{f.owner.board.viewport=restored;f.owner.persist();};
 const closing=f.parent.onClose().then(()=>{closed=true;});try{for(let i=0;i<8;i++)await Promise.resolve();assert.equal(entered,true);assert.equal(closed,false,'Close must also wait for the cancellation restore save');}finally{release();await closing;await f.owner.flush();}assert.deepEqual(model.parseBoard(f.disk()).viewport,restored);
});

test('Session undo removing a saved brain viewport restores default fit immediately and redo restores the saved camera',async()=>{
 const f=sessionRendererFixture(),v=f.first,initialCamera={...v.view.camera};navigateCenter(v,'a');await f.owner.flush();
 action(v.el,'zoom-in').click();v.view.flushPendingViewport();await f.owner.flush();const zoomed={...v.view.camera};assert.notDeepEqual(zoomed,initialCamera);
 f.owner.undo();await f.owner.flush();assert.equal(f.owner.board.brain.centerId,'b');assert.equal(f.owner.board.brainViewport,undefined);assert.deepEqual(v.view.camera,initialCamera);assert.deepEqual(f.makeView().view.camera,initialCamera);
 const writes=f.writes();for(const view of f.views)view.view.flushPendingViewport();await f.owner.flush();assert.equal(f.writes(),writes);assert.equal(JSON.parse(f.disk()).brainViewport,undefined);
 f.owner.undo(true);await f.owner.flush();assert.equal(f.owner.board.brain.centerId,'a');assert.deepEqual(f.owner.board.brainViewport,zoomed);for(const view of f.views)assert.deepEqual(view.view.camera,zoomed);
});

test('Session undo invalidates both windows pending cameras while ordinary navigation keeps an uncommitted camera',async()=>{
 const saved={x:0,y:0,zoom:1},f=sessionRendererFixture(saved),v=f.first,other=f.makeView();
 // Keep the new center on-screen at the pending zoom. The rectangle double used
 // to report every pill as visible even when the 600px scene was actually clipped.
 for(const view of f.views){const stage=view.el.querySelector('.ts-brain-stage')!;stage.clientWidth=1440;stage.clientHeight=900;view.view.refresh();}
 action(v.el,'zoom-in').click();const pending={...v.view.camera},board=f.owner.board;navigateCenter(v,'a');await f.owner.flush();assert.equal(f.owner.board,board);assert.deepEqual(v.view.viewportIntent.value,pending);assert.deepEqual(v.view.camera,pending);
 action(other.el,'zoom-out').click();assert.notDeepEqual(other.view.camera,pending);assert.equal(v.doc.timers.size,1);assert.equal(other.doc.timers.size,1);
 f.owner.undo();await f.owner.flush();assert.equal(f.owner.board.brain.centerId,'b');assert.deepEqual(f.owner.board.brainViewport,saved);
 for(const view of f.views){assert.equal(view.view.viewportIntent,undefined);assert.equal(view.doc.timers.size,0);assert.deepEqual(view.view.camera,saved);view.view.flushPendingViewport();}
 await f.owner.flush();assert.equal(f.writes(),2);assert.deepEqual(JSON.parse(f.disk()).brainViewport,saved);
 f.owner.undo(true);await f.owner.flush();assert.equal(f.owner.board.brain.centerId,'a');assert.deepEqual(f.owner.board.brainViewport,saved);for(const view of f.views)assert.deepEqual(view.view.camera,saved);
});

test('pending camera flush before an undo repaint cannot overwrite the replacement Session board and hidden view reconciles on show',async()=>{
 const saved={x:0,y:0,zoom:1},f=sessionRendererFixture(saved),v=f.first;navigateCenter(v,'a');await f.owner.flush();action(v.el,'zoom-in').click();
 // Model a deferred/hidden repaint: the persistence guard must stand on its own.
 f.owner.listeners.clear();f.owner.undo();await f.owner.flush();const writes=f.writes();v.el.visible=false;v.view.flushPendingViewport();await f.owner.flush();assert.equal(f.writes(),writes);assert.deepEqual(f.owner.board.brainViewport,saved);assert.equal(v.doc.timers.size,0);
 const editor=v.root.createEl('input');editor.focus();v.view.refresh();assert.equal(v.doc.activeElement,editor);v.el.visible=true;v.view.refresh();assert.deepEqual(v.view.camera,saved);assert.equal(v.doc.activeElement,editor);assert.deepEqual(JSON.parse(f.disk()).brainViewport,saved);
});

test('renaming the owning Session board retains the saved camera in both windows without writing or changing history',async()=>{
 const saved={x:-213,y:47,zoom:1.35},f=sessionRendererFixture(saved);f.makeView();const initial=clone(f.owner.board),history=f.owner.history;
 f.owner.file.path='Renamed.thoughtspace';for(const view of f.views){view.view.refresh();assert.deepEqual(view.view.camera,saved);assert.equal(view.view.boardPath,'Renamed.thoughtspace');}
 await f.owner.flush();assert.equal(f.writes(),0);assert.deepEqual(f.owner.board,initial);assert.equal(f.owner.history,history);assert.deepEqual(JSON.parse(f.disk()).brainViewport,saved);
});

test('undo cancels an in-flight captured pan without letting its remaining pointer events save into the restored board',async()=>{
 const saved={x:0,y:0,zoom:1},f=sessionRendererFixture(saved),v=f.first,stage=v.el.querySelector('.ts-brain-stage')!;let captured:number|undefined,releases=0;
 Object.assign(stage,{setPointerCapture:(id:number)=>{captured=id;},hasPointerCapture:(id:number)=>captured===id,releasePointerCapture:(id:number)=>{captured=undefined;releases++;stage.dispatch('lostpointercapture',{pointerId:id});}});
 navigateCenter(v,'a');await f.owner.flush();stage.dispatch('pointerdown',{pointerId:4,clientX:30,clientY:30});stage.dispatch('pointermove',{pointerId:4,clientX:70,clientY:50});assert.notDeepEqual(v.view.camera,saved);assert.equal(captured,4);assert.equal(stage.classList.contains('is-panning'),true);
 f.owner.undo();await f.owner.flush();const writes=f.writes();assert.deepEqual(v.view.camera,saved);assert.equal(v.view.pan,undefined);assert.equal(captured,undefined);assert.equal(releases,1);assert.equal(stage.classList.contains('is-panning'),false);assert.equal(v.doc.timers.size,0);
 stage.dispatch('pointermove',{pointerId:4,clientX:90,clientY:60});stage.dispatch('pointerup',{pointerId:4});v.view.flushPendingViewport();await f.owner.flush();assert.equal(f.writes(),writes);assert.deepEqual(v.view.camera,saved);assert.deepEqual(JSON.parse(f.disk()).brainViewport,saved);
 stage.dispatch('pointerdown',{pointerId:5,clientX:10,clientY:10});stage.dispatch('pointermove',{pointerId:5,clientX:17,clientY:19});stage.dispatch('pointerup',{pointerId:5});v.view.flushPendingViewport();await f.owner.flush();assert.deepEqual(JSON.parse(f.disk()).brainViewport,{x:7,y:9,zoom:1});assert.equal(f.writes(),writes+1);
});

test('node menus keep rename on the first level and nest all creation, relation and native file actions',()=>{
 const f=fixture(),renamed:any[]=[],created:any[]=[];f.host.renameNode=(...args:any[])=>renamed.push(args);f.host.createRelation=(...args:any[])=>created.push(args);f.host.fileMenu=(menu:Menu)=>menu.addItem(item=>item.setTitle('Native fixture action').onClick(()=>{}));
 action(node(f,'b'),'node-menu').click();const menu=Menu.last;assert(menu.items.length<=8);assert(menu.items.some(item=>item.title==='重命名来源笔记'));assert(!menu.items.some(item=>item.title==='Native fixture action'||item.title==='添加父节点'));menuItem('重命名来源笔记').click();assert.equal(renamed[0][0],'b');assert(renamed[0][1]());menuItem('新建白板…').click();assert.deepEqual(created[0].slice(0,2),['b','bottom']);assert.equal(created[0][3],'board');assert(menuItem('Native fixture action'));assert(menuItem('添加关联'));
 title(f,'a').click();assert(!renamed[0][1]());
});
test('associated depth preference renders further hops, resets on depth one and survives state replacement',()=>{
 const f=fixture();for(let i=1;i<=5;i++){f.board.nodes.push(card('assoc-'+i));f.board.edges.push({id:'assoc-e-'+i,from:i===1?'b':'assoc-'+(i-1),to:'assoc-'+i,direction:'both',fromSide:'right',toSide:'left',label:''});}
 f.snapshot.graphRevision=1;f.view.refresh();f.view.update({type:'depth',value:5});assert(node(f,'assoc-5'));assert.equal(node(f,'assoc-5').dataset.brainDepth,'5');const saved=clone(f.board);f.setSnapshot({...f.snapshot,board:clone(saved)});f.view.refresh();assert(node(f,'assoc-5'));f.view.update({type:'depth',value:1});assert.equal(node(f,'assoc-2'),undefined);assert(node(f,'assoc-1'));
});

test('color previews never rebuild the projection, render sources, save or change camera; cancellation restores saved values',()=>{
 const f=fixture(),nodeRefs=[...f.view.nodes.values()],renders=f.view.renders,camera={...f.view.camera},saveCount=f.saves.length,frameCount=f.doc.frames.size;
 f.board.brainColors={node:'#aabbcc'};f.view.refresh();const stableRenders=f.view.renders;
 for(let i=0;i<100;i++)f.view.previewColors({background:'#111111',node:'#ffffff',text:'#123456',line:'#abcdef'});
 assert.equal(f.view.renders,stableRenders);assert.deepEqual([...f.view.nodes.values()],nodeRefs);assert.equal(f.saves.length,saveCount);assert.equal(f.doc.frames.size,frameCount+1);f.doc.tick();assert.deepEqual(f.view.camera,camera);assert.deepEqual(f.board.brainColors,{node:'#aabbcc'});
 assert.equal(f.view.nodes.get('b').title.style.getPropertyValue('--brain-custom-text'),'#123456');f.view.previewColors(null);
 assert.equal(f.view.nodes.get('b').title.style.getPropertyValue('--brain-custom-text'),'');assert.equal(f.view.nodes.get('b').pill.style.getPropertyValue('--brain-custom-node'),'#aabbcc');assert(stableRenders>renders);assert.equal(f.view.shell.style.getPropertyValue('--brain-custom-node'),'');assert.equal(f.view.shell.style.getPropertyValue('--brain-custom-text'),'');
});
test('external palette change and owner switch discard stale preview without leaking to another brain',()=>{
 const f=fixture();f.view.previewColors({node:'#ffffff'});f.board.brainColors={node:'#112233'};f.view.refresh();assert.equal(f.view.nodes.get('b').pill.style.getPropertyValue('--brain-custom-node'),'#112233');
 f.view.previewColors({text:'#123456'});f.setSnapshot({...f.snapshot,key:{},path:'Other.thoughtspace',board:{...f.board,brainColors:undefined}});f.view.refresh();assert.equal(f.view.nodes.get('b').title.style.getPropertyValue('--brain-custom-text'),'');assert.equal(f.view.nodes.get('b').pill.style.getPropertyValue('--brain-custom-node'),'');
});
test('cancelling or unloading before the color frame runs prevents deferred draft paint',()=>{
 for(const cancel of ['cancel','unload']){const f=fixture(),pill=f.view.nodes.get('b').pill;f.view.previewColors({node:'#ffffff'});assert(f.view.colorFrame);if(cancel==='cancel')f.view.previewColors(null);else f.view.unload();assert.equal(f.view.colorFrame,0);f.doc.tick();assert.equal(pill.style.getPropertyValue('--brain-custom-node'),'');}
});
test('a queued preview rechecks ownership and readonly status even before the next graph refresh',()=>{
 for(const change of ['owner','readonly','palette']){const f=fixture();f.view.previewColors({node:'#ffffff'});if(change==='owner')f.setSnapshot({...f.snapshot,key:{},path:'Other.thoughtspace'});if(change==='readonly')f.setSnapshot({...f.snapshot,readOnly:true});if(change==='palette')f.board.brainColors={node:'#123456'};f.doc.tick();assert.equal(f.view.nodes.get('b').pill.style.getPropertyValue('--brain-custom-node'),change==='palette'?'#123456':'');assert.equal(f.view.colorPreview,undefined);}
});
test('border color paints node pills and expanded bodies without rebuilding previews and cancel restores each original',()=>{
 const f=fixture();action(node(f,'a'),'expand').click();const item=f.view.nodes.get('a'),preview=f.view.previews.get('a'),before=clone(f.board),renders=f.view.renders,sourceRenders=f.previews.length,camera={...f.view.camera};
 for(let i=0;i<100;i++)f.view.previewColors({border:'#8b5c91'});f.doc.tick();
 assert.equal(item.pill.style.getPropertyValue('--brain-custom-border'),'#8b5c91');assert.equal(preview.body.style.getPropertyValue('--brain-custom-border'),'#8b5c91');assert(f.view.shell.classList.contains('has-custom-border'));
 assert.equal(f.view.renders,renders);assert.equal(f.previews.length,sourceRenders);assert.deepEqual(clone(f.board),before);assert.deepEqual(f.view.camera,camera);assert.equal(item.pill.style.getPropertyValue('--brain-custom-node'),'');
 f.view.previewColors(null);assert.equal(item.pill.style.getPropertyValue('--brain-custom-border'),'');assert.equal(preview.body.style.getPropertyValue('--brain-custom-border'),'');assert(!f.view.shell.classList.contains('has-custom-border'));
});
test('removing or replacing persisted border colors does not retain paint from another board or preview',()=>{
 const f=fixture();f.board.brainColors={border:'#336677'};f.view.refresh();assert.equal(f.view.nodes.get('b').pill.style.getPropertyValue('--brain-custom-border'),'#336677');
 f.view.previewColors({border:'#ffffff'});f.board.brainColors={border:'#443366'};f.doc.tick();assert.equal(f.view.nodes.get('b').pill.style.getPropertyValue('--brain-custom-border'),'#443366');
 f.setSnapshot({...f.snapshot,key:{},path:'Other.thoughtspace',board:{...f.board,brainColors:undefined}});f.view.refresh();assert.equal(f.view.nodes.get('b').pill.style.getPropertyValue('--brain-custom-border'),'');assert(!f.view.shell.classList.contains('has-custom-border'));
});
test('the direct color action does not recenter, edit geometry or bypass a read-only board',()=>{
 const f=fixture(),opened:any[]=[];f.host.colors=()=>opened.push(clone(f.board));f.view.unload();f.view.load();const button=action(f.el,'colors'),before=clone(f.board);assert.equal(button.getAttribute('aria-haspopup'),'dialog');button.click();assert.equal(opened.length,1);assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);
 f.setSnapshot({...f.snapshot,readOnly:true});f.view.refresh();assert(button.disabled);button.click();assert.equal(opened.length,1);
 f.setSnapshot({...f.snapshot,readOnly:false});f.view.refresh();action(f.el,'more').click();const pending=menuItem('脑图配色…');f.setSnapshot({...f.snapshot,key:{},path:'Other.thoughtspace'});f.view.refresh();pending.click();assert.equal(opened.length,1);
});

test('Markdown brain menu exposes the native Properties action without adding persistent buttons',()=>{
 const f=fixture();f.setSnapshot({...f.snapshot,path:'Boards/Native.md'});let calls=0;f.host.nativeProperties=()=>calls++;f.view.refresh();action(f.el,'more').click();const entry=menuItem('原生属性与 Markdown');assert(entry);assert(!entry.disabled);entry.click();assert.equal(calls,1);assert.equal(f.el.querySelectorAll('[data-brain-action="native-properties"]').length,0);
});

test('native Properties brain action omits legacy sources, disables read-only and rejects stale or newly read-only menu contexts',()=>{
 const f=fixture();let calls=0;f.host.nativeProperties=()=>calls++;action(f.el,'more').click();assert.equal(menuItem('原生属性与 Markdown'),undefined);
 f.setSnapshot({...f.snapshot,path:'Board.MD',readOnly:true});f.view.refresh();action(f.el,'more').click();assert(menuItem('原生属性与 Markdown').disabled);menuItem('原生属性与 Markdown').click();assert.equal(calls,0);
 f.setSnapshot({...f.snapshot,readOnly:false});f.view.refresh();action(f.el,'more').click();const prior=menuItem('原生属性与 Markdown');f.setSnapshot({...f.snapshot,readOnly:true});prior.click();assert.equal(calls,0);
 f.setSnapshot({...f.snapshot,readOnly:false});f.view.refresh();action(f.el,'more').click();const stale=menuItem('原生属性与 Markdown');f.setSnapshot({...f.snapshot,path:'Other.md',key:{}});stale.click();assert.equal(calls,0);
});


test('save feedback changes only the status and retains layout, SVG, previews, history and camera',()=>{
 const f=fixture();f.board.brain!.expandedIds=['b'];f.view.refresh();
 const graph=f.view.layout,projection=f.view.projection,camera={...f.view.camera},svg=f.el.querySelector('.ts-brain-links')!,paths=[...svg.children],history=f.el.querySelector('.ts-brain-recent')!,entries=[...history.children],preview=node(f,'b').querySelector('.ts-brain-preview'),renders=f.view.renders;
 const calls:string[]=[];f.host.saveFeedbackAction=(action:string)=>calls.push(action);
 f.setSnapshot({...f.snapshot,saveFeedback:{state:'paused',text:'原生 Markdown 已打开 · 白板仅查看',detail:'Please save the native Properties page first',action:{kind:'locate-native',label:'定位原生页'}}});
 f.view.refreshSaveFeedback();const status=f.el.querySelector('.ts-brain-status')!,button=status.querySelector('[data-save-feedback-action="locate-native"]')!;assert.ok(button);button.click();assert.deepEqual(calls,['locate-native']);assert.equal(status.hidden,false);
 for(let i=0;i<30;i++)f.view.refreshSaveFeedback();assert.equal(status.querySelector('[data-save-feedback-action="locate-native"]'),button);assert.equal(f.view.renders,renders);assert.equal(f.view.layout,graph);assert.equal(f.view.projection,projection);assert.deepEqual(svg.children,paths);assert.deepEqual(history.children,entries);assert.equal(node(f,'b').querySelector('.ts-brain-preview'),preview);assert.deepEqual(f.view.camera,camera);
 f.setSnapshot({...f.snapshot,saveFeedback:{state:'saved',text:'已保存'}});f.view.refreshSaveFeedback();assert.equal(status.hidden,true);assert.equal(status.querySelector('[data-save-feedback-action="locate-native"]'),undefined);assert.equal(f.view.renders,renders);assert.equal(f.saves.length,0);
});
test('a stale status action cannot navigate after owner, path, action or component changes',()=>{
 for(const stale of ['owner','path','action','unload']){
  const f=fixture(),calls:string[]=[];f.host.saveFeedbackAction=(action:string)=>calls.push(action);f.setSnapshot({...f.snapshot,saveFeedback:{state:'error',text:'Saved recovery',action:{kind:'open-recovery',label:'打开恢复草稿'}}});f.view.refreshSaveFeedback();const button=f.el.querySelector('[data-save-feedback-action="open-recovery"]')!;
  if(stale==='owner')f.setSnapshot({...f.snapshot,key:{}});else if(stale==='path')f.setSnapshot({...f.snapshot,path:'Moved.md'});else if(stale==='action')f.setSnapshot({...f.snapshot,saveFeedback:{state:'saved',text:'已保存'}});else f.view.unload();button.click();assert.deepEqual(calls,[]);
 }
});
test('a failed source open unhides a normal hidden brain status and keeps the error visible',async()=>{
 const f=fixture();const status=f.el.querySelector('.ts-brain-status')!;assert.equal(status.hidden,true);f.host.open=async()=>{throw Error('Source temporarily unavailable');};action(node(f,'b'),'open').click();for(let i=0;i<10;i++)await Promise.resolve();assert.equal(status.hidden,false);assert.match(status.textContent,/Source temporarily unavailable/);assert.equal(status.dataset.state,'error');
});

function touchStage(f:ReturnType<typeof fixture>){
 const stage=f.el.querySelector('.ts-brain-stage')!,captured=new Set<number>();
 (stage as any).setPointerCapture=(id:number)=>captured.add(id);(stage as any).hasPointerCapture=(id:number)=>captured.has(id);(stage as any).releasePointerCapture=(id:number)=>captured.delete(id);
 return {stage,captured,touch:(type:string,id:number,x:number,y:number)=>stage.dispatch(type,{pointerType:'touch',pointerId:id,clientX:x,clientY:y})};
}
test('two finger graph zoom preserves its world anchor and commits once after both fingers lift',()=>{
 const f=fixture(),{touch}=touchStage(f);f.view.camera={x:20,y:40,zoom:1};f.view.transform();
 const before=clone(f.board.nodes),graph=f.view.layout,paths=[...f.el.querySelector('.ts-brain-links')!.children];
 touch('pointerdown',1,100,100);touch('pointerdown',2,200,100);touch('pointermove',2,300,100);
 assert.equal(f.view.camera.zoom,2);assert.equal((200-f.view.camera.x)/f.view.camera.zoom,130);assert.equal((100-f.view.camera.y)/f.view.camera.zoom,60);
 assert.equal(f.viewports.length,0);touch('pointerup',2,300,100);const camera={...f.view.camera};touch('pointermove',1,60,80);assert.deepEqual(f.view.camera,camera);touch('pointerup',1,60,80);f.view.flushViewport();
 assert.deepEqual(f.viewports,[camera]);assert.deepEqual(clone(f.board.nodes),before);assert.equal(f.view.layout,graph);assert.deepEqual(f.el.querySelector('.ts-brain-links')!.children,paths);
});
test('touch camera keeps editing focus and ignores preview scrolling and buttons',()=>{
 const f=fixture(),{touch}=touchStage(f),outside=f.root.createEl('textarea');outside.focus();touch('pointerdown',1,30,30);assert.equal(f.doc.activeElement,outside);touch('pointerup',1,30,30);
 action(node(f,'a'),'expand').click();const camera={...f.view.camera};const event=f.previews[0].body.dispatch('pointerdown',{pointerType:'touch',pointerId:2,clientX:40,clientY:50});assert.equal(event.defaultPrevented,false);assert.deepEqual(f.view.camera,camera);assert.equal(f.view.touchPoints.size,0);
});
test('canceled touch captures cannot move a replacement brain or leave held finger pan state',()=>{
 const f=fixture(),{touch,captured}=touchStage(f);touch('pointerdown',1,30,30);touch('pointerdown',2,100,30);touch('pointercancel',1,30,30);assert.equal(captured.size,0);assert.equal(f.view.touchPoints.size,0);const camera={...f.view.camera};touch('pointermove',2,190,30);assert.deepEqual(f.view.camera,camera);
 touch('pointerdown',3,30,30);f.setSnapshot({...f.snapshot,key:{}});f.view.refresh();assert.equal(captured.size,0);assert.equal(f.view.touchPoints.size,0);const replacement={...f.view.camera};touch('pointermove',3,100,100);assert.deepEqual(f.view.camera,replacement);assert.equal(f.viewports.length,0);
});

test('touch pan bursts project once per frame and release a single viewport intent',()=>{
 const f=fixture(),{touch,captured}=touchStage(f),before={...f.view.camera};let paints=0;const transform=f.view.transform.bind(f.view);f.view.transform=()=>{paints++;transform();};
 touch('pointerdown',1,80,120);for(let i=1;i<=12;i++)touch('pointermove',1,80+i*2,120+i*3);
 assert.equal(paints,0);assert.equal(f.doc.frames.size,1);assert.equal(f.view.camera.x,before.x+24);assert.equal(f.view.camera.y,before.y+36);assert.equal(f.viewports.length,0);
 f.doc.tick();assert.equal(paints,1);touch('pointerup',1,104,156);assert.equal(captured.size,0);assert.equal(f.doc.frames.size,0);assert.equal(f.doc.timers.size,1);f.view.flushPendingViewport();assert.deepEqual(f.viewports,[f.view.camera]);
});
test('pinch translates its centroid in local stage coordinates and clamps the scale without moving its world anchor',()=>{
 const f=fixture(),{stage,touch}=touchStage(f);stage.getBoundingClientRect=()=>({left:40,top:60,right:640,bottom:460,width:600,height:400});f.view.camera={x:20,y:40,zoom:1};
 touch('pointerdown',1,140,160);touch('pointerdown',2,240,160);touch('pointermove',1,90,190);touch('pointermove',2,590,190);
 assert.equal(f.view.camera.zoom,2.5);assert.equal((300-f.view.camera.x)/f.view.camera.zoom,130);assert.equal((130-f.view.camera.y)/f.view.camera.zoom,60);
 touch('pointermove',1,339,190);touch('pointermove',2,341,190);assert.equal(f.view.camera.zoom,.15);assert.equal((300-f.view.camera.x)/f.view.camera.zoom,130);assert.equal((130-f.view.camera.y)/f.view.camera.zoom,60);
});
test('duplicate and third touches or a pen cannot replace a running graph gesture',()=>{
 const f=fixture(),{stage,touch,captured}=touchStage(f);touch('pointerdown',1,100,100);touch('pointerdown',1,120,140);touch('pointerdown',2,200,100);touch('pointerdown',3,500,300);
 stage.dispatch('pointerdown',{pointerType:'pen',pointerId:4,clientX:500,clientY:300});assert.deepEqual([...captured],[1,2]);touch('pointermove',2,300,100);assert.equal(f.view.camera.zoom,Math.min(2.5,f.view.pinch.camera.zoom*2));
 const camera={...f.view.camera};touch('pointermove',3,600,400);stage.dispatch('pointermove',{pointerType:'pen',pointerId:4,clientX:700,clientY:500});assert.deepEqual(f.view.camera,camera);
});
test('lifting either pinch finger freezes the survivor until a fresh second touch starts from the latest camera',()=>{
 for(const ended of [1,2]){const f=fixture(),{touch,captured}=touchStage(f);f.view.camera={x:20,y:40,zoom:1};touch('pointerdown',1,100,100);touch('pointerdown',2,200,100);touch('pointermove',2,300,100);touch('pointerup',ended,ended===1?100:300,100);
  const survivor=ended===1?2:1,camera={...f.view.camera};touch('pointermove',survivor,150,120);assert.deepEqual(f.view.camera,camera);touch('pointerdown',3,250,120);touch('pointermove',3,300,120);assert.equal(f.view.camera.zoom,2.5);touch('pointerup',survivor,150,120);touch('pointerup',3,300,120);assert.equal(captured.size,0);assert.equal(f.doc.timers.size,1);f.view.flushPendingViewport();assert.deepEqual(f.viewports,[f.view.camera]);
 }
});
for(const boundary of ['pointercancel','lostpointercapture','blur','unload'])test(`moved touch ${boundary} releases every capture and preserves the latest camera once`,()=>{
 const f=fixture(),{stage,touch,captured}=touchStage(f);touch('pointerdown',1,100,100);touch('pointerdown',2,200,100);touch('pointermove',2,260,130);const camera={...f.view.camera};
 const release=(stage as any).releasePointerCapture;(stage as any).releasePointerCapture=(id:number)=>{release(id);touch('lostpointercapture',id,0,0);};
 if(boundary==='blur')for(const fn of f.doc.defaultView.listeners.get('blur')||[])fn({});else if(boundary==='unload')f.view.unload();else touch(boundary,1,100,100);
 assert.equal(captured.size,0);assert.equal(f.view.touchPoints.size,0);assert.equal(f.doc.frames.size,0);assert.equal(stage.classList.contains('is-panning'),false);
 if(boundary!=='unload'){touch('pointermove',2,500,500);assert.deepEqual(f.view.camera,camera);f.view.flushPendingViewport();}assert.deepEqual(f.viewports,[camera]);
});
test('touch preview selection and native editable controls retain focus, default actions and delegated pointer handlers',()=>{
 const f=fixture();touchStage(f);action(node(f,'b'),'expand').click();const preview=f.previews[0].body,camera={...f.view.camera};let bubbled=0;f.root.listeners.set('pointerdown',new Set([()=>bubbled++]));
 for(const [tag,attrs]of [['textarea',{}],['select',{}],['input',{}],['div',{contenteditable:'true'}],['a',{href:'#note'}]] as const){const editor=preview.createEl(tag,{attr:attrs});editor.focus();const event=editor.dispatch('pointerdown',{pointerType:'touch',pointerId:11,clientX:40,clientY:50});assert.equal(event.defaultPrevented,false);assert.equal(event.stopped,false);assert.equal(f.doc.activeElement,editor);assert.deepEqual(f.view.camera,camera);assert.equal(f.view.touchPoints.size,0);}
 assert.equal(bubbled,5);const event=preview.dispatch('dblclick');assert.equal(event.stopped,false);
});
test('a zoom button or wheel ends a held touch before later moves can overwrite its camera',()=>{
 for(const command of ['button','wheel']){const f=fixture(),{stage,touch,captured}=touchStage(f);touch('pointerdown',1,100,100);touch('pointermove',1,130,120);if(command==='button')action(f.el,'zoom-in').click();else stage.dispatch('wheel',{deltaX:5,deltaY:10});const camera={...f.view.camera};touch('pointermove',1,300,400);touch('pointerup',1,300,400);assert.deepEqual(f.view.camera,camera);assert.equal(captured.size,0);f.view.flushPendingViewport();assert.deepEqual(f.viewports,[camera]);}
});
test('rapid center navigation cancels touch ownership and late moves cannot alter the new center camera',()=>{
 const f=fixture(),{touch,captured}=touchStage(f);touch('pointerdown',1,100,100);touch('pointermove',1,130,120);navigateCenter(f,'a');navigateCenter(f,'b');const camera={...f.view.camera};assert.equal(f.board.brain!.centerId,'b');assert.equal(captured.size,0);touch('pointermove',1,500,500);touch('pointerup',1,500,500);assert.deepEqual(f.view.camera,camera);f.view.flushPendingViewport();assert.deepEqual(f.viewports,[camera]);
});
test('phone and tablet rotations or split panes preserve a manually chosen reading anchor and zoom without source writes',()=>{
 const f=fixture(),{stage}=touchStage(f);f.root.clientWidth=f.el.clientWidth=stage.clientWidth=360;f.root.clientHeight=f.el.clientHeight=stage.clientHeight=740;f.view.refresh();f.view.camera.zoom=1.15;f.view.fitCamera=false;const before=clone(f.board.nodes);let anchor=f.view.layout.nodes.find((n:any)=>n.id==='b');f.view.camera.x=180-(anchor.x+anchor.width/2)*1.15+12;f.view.camera.y=370-(anchor.y+anchor.height/2)*1.15-8;f.view.transform();
 for(const [width,height]of [[390,844],[430,932],[844,390],[768,1024],[1024,768],[820,1180],[1180,820],[360,740]]){f.root.clientWidth=f.el.clientWidth=stage.clientWidth=width;f.root.clientHeight=f.el.clientHeight=stage.clientHeight=height;f.view.refresh();anchor=f.view.layout.nodes.find((n:any)=>n.id==='b');assert.equal(f.view.camera.zoom,1.15);assert(Math.abs(f.view.camera.x+(anchor.x+anchor.width/2)*1.15-width/2-12)<1e-8);assert(Math.abs(f.view.camera.y+(anchor.y+anchor.height/2)*1.15-height/2+8)<1e-8);}
 assert.deepEqual(clone(f.board.nodes),before);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);
});
test('resize during a gesture releases captures and updates its pending camera intent to the resized viewport',()=>{
 const f=fixture(),{stage,touch,captured}=touchStage(f);touch('pointerdown',1,100,100);touch('pointermove',1,130,120);f.root.clientWidth=f.el.clientWidth=stage.clientWidth=390;f.root.clientHeight=f.el.clientHeight=stage.clientHeight=844;f.view.refresh();const camera={...f.view.camera};assert.equal(captured.size,0);touch('pointermove',1,500,500);assert.deepEqual(f.view.camera,camera);f.view.flushPendingViewport();assert.deepEqual(f.viewports,[camera]);
});
test('a touch viewport save failure retains the reading camera and a fresh gesture can save and reopen it',()=>{
 const f=fixture(),{touch}=touchStage(f),viewport=f.host.viewport;f.host.viewport=()=>{throw Error('视角保存失败，请重试');};touch('pointerdown',1,100,100);touch('pointermove',1,130,120);touch('pointerup',1,130,120);const camera={...f.view.camera};f.view.flushPendingViewport();assert.match(f.el.querySelector('.ts-brain-status')!.textContent,/视角保存失败/);f.view.refresh();assert.deepEqual(f.view.camera,camera);
 f.host.viewport=viewport;touch('pointerdown',2,100,100);touch('pointermove',2,104,100);touch('pointerup',2,104,100);f.view.flushPendingViewport();const saved={...f.view.camera};f.view.unload();const reopened=new View({},f.el,f.host);reopened.load();assert.deepEqual(reopened.camera,saved);assert.deepEqual(f.viewports,[saved]);reopened.unload();
});
test('brain paging and zoom controls share a separate shell row so a narrow pane can wrap them without covering the stage',()=>{
 const f=fixture(),controls=f.el.querySelector('.ts-brain-controls')!,stage=f.el.querySelector('.ts-brain-stage')!;assert.equal(controls.parentElement,f.el.querySelector('.ts-brain-shell'));assert.equal(f.view.pager.parentElement,controls);assert.equal(f.el.querySelector('.ts-brain-zoom')!.parentElement,controls);assert.equal(stage.contains(controls),false);assert.equal(stage.querySelectorAll('.ts-brain-pan-surface').length,1);
});
test('shared selection CSS enforces 44px controls and safe wrapped scrollable layout without scaling',()=>{
 const css=readFileSync('src/brain-board.css','utf8');assert.match(css,/\.ts-brain-shell \.ts-brain-selection \.clickable-icon[^}]*width:44px;[^}]*height:44px/);assert.match(css,/\.ts-brain-selection \{[^}]*flex-wrap:wrap[^}]*safe-area-inset-right[^}]*safe-area-inset-left[^}]*overflow:auto[^}]*touch-action:pan-y/);assert(!css.includes('@media (hover:none)'));assert(!css.includes('brain-action-scale'));
});

for(const press of ['pointer','keyboard'])test(`a shared toolbar ${press} press never retargets after selection changes`,()=>{
 const f=fixture();title(f,'a').click();const button=action(f.el,'open');if(press==='pointer')button.dispatch('pointerdown',{pointerId:33});else button.dispatch('keydown',{key:'Enter'});title(f,'c').click();button.click();assert.equal(f.opens.length,0);assert.equal(f.board.brain!.centerId,'b');
 if(press==='pointer')button.dispatch('pointerdown',{pointerId:34});else button.dispatch('keydown',{key:'Enter'});button.click();assert.equal(f.opens[0].id,'c');assert.equal(f.opens.length,1);
});
test('pointercancel consumes a toolbar press and requires a fresh action',()=>{
 const f=fixture();title(f,'a').click();const button=action(f.el,'open');button.dispatch('pointerdown',{pointerId:1});button.dispatch('pointercancel',{pointerId:1});button.click();assert.equal(f.opens.length,0);button.dispatch('pointerdown',{pointerId:2});button.click();assert.equal(f.opens[0].id,'a');
});
for(const boundary of ['selection','center','hidden','blur','owner','path','document','closed','removed','presentation','unload'])test(`selected async actions invalidate permanently after ${boundary}`,()=>{
 const f=fixture(),calls:any[]=[];f.host.createRelation=(...args:any[])=>calls.push(args);title(f,'a').click();action(f.el,'open').click();action(f.el,'add-right').click();const open=f.opens[0].current,relation=calls[0][2];assert(open());assert(relation());
 if(boundary==='selection'){title(f,'c').click();title(f,'a').click();}else if(boundary==='center'){navigateCenter(f,'c');navigateCenter(f,'b');title(f,'a').click();}else if(boundary==='hidden'){f.el.visible=false;f.view.refresh();f.el.visible=true;f.view.refresh();title(f,'a').click();}else if(boundary==='blur'){for(const fn of f.doc.defaultView.listeners.get('blur')||[])fn({});}else if(boundary==='owner'){const old=f.snapshot.key;f.setSnapshot({...f.snapshot,key:{}});f.view.refresh();f.setSnapshot({...f.snapshot,key:old});f.view.refresh();title(f,'a').click();}else if(boundary==='path'){f.snapshot.path='Moved.thoughtspace';f.view.refresh();f.snapshot.path='Board.thoughtspace';f.view.refresh();title(f,'a').click();}else if(boundary==='document')f.el.ownerDocument=new Doc();else if(boundary==='closed')f.doc.defaultView.closed=true;else if(boundary==='removed')f.board.nodes=f.board.nodes.filter(n=>n.id!=='a');else if(boundary==='presentation')delete f.board.presentation;else f.view.unload();
 assert(!open());assert(!relation());if(boundary==='closed')f.doc.defaultView.closed=false;assert(!open());assert(!relation());
});
test('stale unrefreshed toolbar never acts on a replacement owner or navigation target',()=>{
 for(const boundary of ['owner','path','center']){const f=fixture();title(f,'a').click();const button=action(f.el,'open');if(boundary==='owner')f.setSnapshot({...f.snapshot,key:{}});if(boundary==='path')f.snapshot.path='Other.thoughtspace';if(boundary==='center')f.board.brain=state.updateBoardMindmapState(f.board.brain!,{type:'center',id:'c'},f.board.nodes);button.click();assert.equal(f.opens.length,0);}
});
test('deleted or paged-away selected nodes retire their tools and preserve editor focus',()=>{
 const f=fixture();title(f,'a').click();const editor=f.root.createEl('input');editor.focus();const before=f.saves.length;f.board.nodes=f.board.nodes.filter(n=>n.id!=='a');f.view.refresh();assert.equal(f.view.activeNodeId,'b');assert.equal(f.doc.activeElement,editor);assert.equal(f.view.selection.root.dataset.brainSelectedId,'b');assert.equal(f.saves.length,before);
});
test('readonly noncenter selection remains inspectable while persistent actions stay blocked',()=>{
 const f=fixture(),calls:any[]=[];f.host.createRelation=(...args:any[])=>calls.push(args);f.snapshot.readOnly=true;f.view.refresh();title(f,'a').click();assert.equal(f.view.activeNodeId,'a');assert.equal(title(f,'a').disabled,false);for(const key of ['center','expand','add-top','add-bottom','add-left','add-right']){assert.equal(action(f.el,key).disabled,true);action(f.el,key).click();}action(f.el,'open').click();assert.equal(f.opens[0].id,'a');assert.equal(f.saves.length,0);assert.equal(calls.length,0);assert.equal(f.board.brain!.centerId,'b');
});
test('selection during a pending touch frame retains the latest camera and cannot revive old gesture ownership',()=>{
 const f=fixture(),{touch,captured}=touchStage(f);touch('pointerdown',1,100,100);touch('pointerdown',2,200,100);touch('pointermove',2,275,115);const camera={...f.view.camera};assert.equal(f.doc.frames.size,1);title(f,'a').click();assert.equal(f.view.activeNodeId,'a');assert.equal(f.board.brain!.centerId,'b');assert.equal(captured.size,0);assert.deepEqual(f.view.camera,camera);assert.equal(f.doc.frames.size,0);touch('pointermove',2,500,500);touch('pointerup',2,500,500);f.doc.tick();assert.deepEqual(f.view.camera,camera);f.view.flushPendingViewport();assert.deepEqual(f.viewports,[camera]);
});
test('dense phone and tablet projections have one reachable toolbar for any selected node at low and high zoom',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!;for(let i=0;i<80;i++){f.board.nodes.push(card('dense-'+i));f.board.edges.push({id:'dense-edge-'+i,from:'b',to:'dense-'+i,kind:'branch',label:''});}f.board.brain!.descendantDepth=3;const before=clone(f.board.nodes);
 for(const [width,height]of [[360,740],[390,844],[430,932],[844,390],[768,1024],[1024,768],[820,1180],[1180,820],[360,350]]){f.root.clientWidth=f.el.clientWidth=stage.clientWidth=width;f.root.clientHeight=f.el.clientHeight=stage.clientHeight=height;f.view.refresh();for(const zoom of [.15,.37,1,2.5]){f.view.zoomAt(zoom);const id=f.view.layout.nodes.find((node:any)=>node.id!=='b').id;title(f,id).click();assert.equal(f.el.querySelectorAll('.ts-brain-selection').length,1);assert.equal(f.el.querySelectorAll('.ts-brain-node-actions').length,0);assert(!stage.contains(f.view.selection.root));assert.equal(f.view.selection.root.hidden,false);assert.equal(f.board.brain!.centerId,'b');assert.equal(f.view.activeNodeId,id);assert.equal(f.view.selection.root.style.transform,undefined);}}
 assert.deepEqual(clone(f.board.nodes),before);assert.equal(f.saves.length,0);
});

test('native relation commands follow the selected noncenter without changing navigation and never revive after a switch',()=>{
 const f=fixture(),calls:any[]=[];f.host.createRelation=(...args:any[])=>calls.push(args);title(f,'a').click();const target=f.view.relationCommandTarget();assert(target);for(const side of ['top','bottom','left','right']){assert(target.canRun(side));target.run(side);}assert.deepEqual(calls.map(args=>args.slice(0,2)),['top','bottom','left','right'].map(side=>['a',side]));assert.equal(f.board.brain!.centerId,'b');assert.equal(f.saves.length,0);title(f,'c').click();assert(!target.canRun('top'));title(f,'a').click();assert(!target.canRun('top'));target.run('top');assert.equal(calls.length,4);
});
test('pointer and keyboard title selection leave source preview editing, scrolling and camera intact',()=>{
 const f=fixture();action(node(f,'a'),'expand').click();const preview=f.previews[0],editor=preview.body.createEl('textarea'),camera={...f.view.camera};preview.body.scrollTop=81;title(f,'c').click();editor.focus();editor.dispatch('focusin');assert.equal(f.view.activeNodeId,'a');assert.equal(f.doc.activeElement,editor);assert.equal(preview.body.scrollTop,81);assert(preview.current());assert.deepEqual(f.view.camera,camera);assert.equal(f.board.brain!.centerId,'b');
});

for(const side of ['top','bottom','left','right'] as const)test(`saved noncenter ${side} creation reveals its origin and new node without modifying source geometry`,()=>{
 const f=fixture();title(f,'a').click();const geometry=clone(f.board.nodes),brainBefore=clone(f.board.brain),target=brainIdeaNode('added-'+side,'Created '+side);f.board.nodes.push(target);f.board.edges.push({id:'added-edge-'+side,from:side==='top'?target.id:'a',to:side==='top'?'a':target.id,kind:side==='top'||side==='bottom'?'branch':undefined,direction:side==='top'||side==='bottom'?'forward':'both',fromSide:side==='top'||side==='bottom'?'bottom':side,toSide:side==='left'?'right':side==='right'?'left':'top',label:''});
 assert.equal(f.board.brain!.centerId,'b');assert.deepEqual(f.board.brain,brainBefore);f.view.revealRelation(target.id,'a');assert.equal(f.board.brain!.centerId,'a');assert(node(f,target.id));assert.deepEqual(clone(f.board.nodes.slice(0,-1)),geometry);assert.equal(f.board.brain!.history.entries.at(-1),'a');assert.equal(f.saves.length,1);
});
test('late noncenter reveal refuses a changed selection, unrefreshed navigation, missing node or readonly board',()=>{
 for(const boundary of ['selection','navigation','missing','readonly']){const f=fixture();title(f,'a').click();const target=brainIdeaNode('added','Created');f.board.nodes.push(target);if(boundary==='selection')title(f,'c').click();if(boundary==='navigation')f.board.brain=state.updateBoardMindmapState(f.board.brain!,{type:'center',id:'c'},f.board.nodes);if(boundary==='missing')f.board.nodes.pop();if(boundary==='readonly')f.snapshot.readOnly=true;const before=clone(f.board);f.view.revealRelation('added','a');assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);}
});

test('two-argument reveal also rejects an origin that is already center when another node is selected',()=>{
 const f=fixture();const target=brainIdeaNode('added','Created');f.board.nodes.push(target);title(f,'a').click();const camera={...f.view.camera};f.view.revealRelation('added','b');assert.equal(f.board.brain!.centerId,'b');assert.equal(f.view.activeNodeId,'a');assert.deepEqual(f.view.camera,camera);assert.equal(f.viewports.length,0);assert.equal(f.saves.length,0);
});

test('actual leaf away and back invalidates already issued source, creation and command leases without any lazy recheck or refresh',()=>{
 const f=fixture(),created:any[]=[];let active=true;f.host.isActive=()=>active;f.host.createRelation=(...args:any[])=>created.push(args);title(f,'a').click();action(f.el,'open').click();action(f.el,'add-bottom').click();const source=f.opens[0].current,creation=created[0][2],command=f.view.relationCommandTarget();assert(command);assert(source());assert(creation());assert(command.canRun('top'));
 const board=clone(f.board),camera={...f.view.camera},selected=f.view.activeNodeId,epoch=f.view.selectionEpoch,renders=f.view.renders,timers=f.doc.timers.size;active=false;for(const invalidate of f.navigation)invalidate();active=true;
 assert.equal(f.view.renders,renders);assert.equal(f.view.selectionEpoch,epoch+1);assert.equal(f.view.activeNodeId,selected);assert.deepEqual(clone(f.board),board);assert.deepEqual(f.view.camera,camera);assert.equal(f.doc.timers.size,timers);assert(!source());assert(!creation());assert(!command.canRun('top'));command.run('top');assert.equal(created.length,1);
 // A fresh intentional action works after return; the old leases stay retired.
 action(f.el,'open').click();assert.equal(f.opens.length,2);assert(f.opens[1].current());assert(!source());assert(!creation());
});
for(const press of ['pointer','keyboard'])test(`leaf departure retires a ${press} toolbar press even when return happens before click and no guard ran away`,()=>{
 const f=fixture();title(f,'a').click();const button=action(f.el,'open');if(press==='pointer')button.dispatch('pointerdown',{pointerId:16});else button.dispatch('keydown',{key:'Enter'});for(const invalidate of f.navigation)invalidate();button.click();assert.equal(f.opens.length,0);
 if(press==='pointer')button.dispatch('pointerdown',{pointerId:17});else button.dispatch('keydown',{key:'Enter'});button.click();assert.equal(f.opens[0].id,'a');
});
test('navigation invalidation closes node and board menus and retires an already opened reading manager request',()=>{
 const f=fixture(),requests:Array<()=>boolean>=[];f.host.readingPositions=(current:()=>boolean)=>requests.push(current);action(f.el,'more').click();const depth=menuItem('显示 5 层'),menu=Menu.last;menuItem('脑图阅读位置…').click();assert(requests[0]());const board=clone(f.board);for(const invalidate of f.navigation)invalidate();assert(menu.hidden);assert(!requests[0]());depth.click();assert.deepEqual(clone(f.board),board);assert.equal(f.saves.length,0);
 title(f,'a').click();action(f.el,'node-menu').click();const pin=menuItem('固定节点'),nodeMenu=Menu.last;for(const invalidate of f.navigation)invalidate();assert(nodeMenu.hidden);pin.click();assert.deepEqual(clone(f.board),board);assert.equal(f.saves.length,0);
});
test('navigation hook has one subscription and teardown removes it; retained host callback cannot affect an unloaded view',()=>{
 const f=fixture();assert.equal(f.navigation.size,1);const invalidate=[...f.navigation][0];for(let i=0;i<6;i++)f.view.refresh();assert.equal(f.navigation.size,1);f.view.unload();assert.equal(f.navigation.size,0);const epoch=f.view.selectionEpoch;invalidate();assert.equal(f.view.selectionEpoch,epoch);
});

test('production main host navigation hook uses departure payload even before the active-view getter changes and removes both listeners',()=>{
 const f=closingRendererFixture(),lease=f.renderer.current('b'),board=clone(f.owner.board),camera={...f.renderer.camera};assert(lease());assert.equal(f.navigationRefs.get('active-leaf-change')?.size,1);assert.equal(f.navigationRefs.get('file-open')?.size,1);
 // Another leaf's background file-open leaves the actual active brain alone.
 const epoch=f.renderer.selectionEpoch;f.workspace.trigger('file-open',{path:'Other.md'});assert.equal(f.renderer.selectionEpoch,epoch);assert(lease());
 // Getter still reports the old brain during both events: the payload is the
 // actual departure, and no lazy lease()/refresh call occurs until return.
 f.workspace.trigger('active-leaf-change',{view:{}});f.workspace.trigger('active-leaf-change',f.parent.leaf);assert(!lease());assert.deepEqual(clone(f.owner.board),board);assert.deepEqual(f.renderer.camera,camera);
 f.renderer.unload();assert.equal(f.navigationRefs.get('active-leaf-change')?.size,0);assert.equal(f.navigationRefs.get('file-open')?.size,0);
});

for(const press of ['pointer','Enter',' '] as const)test(`topbar, zoom and history ${press===' '?'Space':press} presses cannot revive after a leaf away and back`,()=>{
 for(const kind of ['more','settings','zoom-in','back'] as const){
  const f=fixture();let settings=0;f.host.settings=()=>{settings++;};if(kind==='back')navigateCenter(f,'a');const button=action(f.el,kind),before=clone(f.board),camera={...f.view.camera},saves=f.saves.length;
  const arm=()=>press==='pointer'?button.dispatch('pointerdown',{pointerId:42}):button.dispatch('keydown',{key:press});arm();for(const invalidate of f.navigation)invalidate();
  // No lazy guard/refresh ran between departure and return. A rejected click
  // cannot flush pointers or alter an existing pending camera intent either.
  const cancel=f.view.cancelPointers;let cancels=0;f.view.cancelPointers=function(...args:any[]){cancels++;return cancel.apply(this,args);};const timers=f.doc.timers.size,frames=f.doc.frames.size;button.click();
  assert.equal(cancels,0,kind);assert.equal(settings,0,kind);assert.equal(f.view.activeMenu,undefined,kind);assert.deepEqual(f.view.camera,camera,kind);assert.deepEqual(clone(f.board),before,kind);assert.equal(f.saves.length,saves,kind);assert.equal(f.doc.timers.size,timers,kind);assert.equal(f.doc.frames.size,frames,kind);
  arm();button.click();if(kind==='more')assert(f.view.activeMenu);else if(kind==='settings')assert.equal(settings,1);else if(kind==='zoom-in')assert(f.view.camera.zoom>camera.zoom);else{assert.equal(f.board.brain!.centerId,'b');assert.equal(f.saves.length,saves+1);}
 }
});
test('pointercancel retires generic topbar, zoom and history presses and a fresh press still acts once',()=>{
 for(const kind of ['settings','zoom-in','back'] as const){const f=fixture();let settings=0;f.host.settings=()=>{settings++;};if(kind==='back')navigateCenter(f,'a');const button=action(f.el,kind),board=clone(f.board),camera={...f.view.camera},saves=f.saves.length;button.dispatch('pointerdown',{pointerId:42});button.dispatch('pointercancel',{pointerId:42});button.click();assert.equal(settings,0);assert.deepEqual(clone(f.board),board);assert.deepEqual(f.view.camera,camera);assert.equal(f.saves.length,saves);button.dispatch('pointerdown',{pointerId:43});button.click();if(kind==='settings')assert.equal(settings,1);else if(kind==='zoom-in')assert(f.view.camera.zoom>camera.zoom);else{assert.equal(f.board.brain!.centerId,'b');assert.equal(f.saves.length,saves+1);}}
});
for(const input of ['mouse','touch','keyboard'] as const)test(`${input} title selection remains separate from a single explicit center action with generic press leases`,()=>{
 const f=fixture(),target=title(f,'a'),camera={...f.view.camera},board=clone(f.board);
 if(input==='keyboard'){target.focus();target.dispatch('keydown',{key:'Enter'});}else{target.dispatch('pointerdown',{pointerType:input,pointerId:52});if(input==='mouse')target.focus();}target.click();
 // Mouse focus selects before click and changes the press epoch; its canceled
 // click still leaves the intended selection. Touch and keyboard select too.
 assert.equal(f.view.activeNodeId,'a');assert.equal(f.board.brain!.centerId,'b');assert.equal(f.doc.activeElement,target);assert.deepEqual(clone(f.board),board);assert.deepEqual(f.view.camera,camera);assert.equal(f.saves.length,0);
 const center=action(f.el,'center');center.focus();if(input==='keyboard')center.dispatch('keydown',{key:' '});else center.dispatch('pointerdown',{pointerType:input,pointerId:53});center.click();assert.equal(f.board.brain!.centerId,'a');assert.equal(f.saves.length,1);assert.deepEqual(f.board.brain!.history.entries,['b','a']);assert.equal(f.doc.activeElement,title(f,'a'));
});


test('search keyboard navigation exposes the active option and scrolls only its results container',()=>{
 const f=fixture(),other=fixture(),input=f.el.querySelector('input')!;f.view.focusSearch();other.view.focusSearch();
 const list=f.el.querySelector('[role="listbox"]')!,otherList=other.el.querySelector('[role="listbox"]')!,rows=f.el.querySelectorAll('.ts-brain-search-result'),results=f.el.querySelector('.ts-brain-search-results')!,shell=f.el.querySelector('.ts-brain-shell')!;
 results.clientHeight=100;results.clientTop=1;results.getBoundingClientRect=()=>({left:0,top:100,right:300,bottom:202,width:300,height:102});
 rows.forEach((row,index)=>{row.getBoundingClientRect=()=>{const top=111+index*44-results.scrollTop;return{left:8,top,right:292,bottom:top+44,width:284,height:44};};});
 shell.scrollTop=7;f.el.scrollTop=13;f.root.scrollTop=19;const camera={...f.view.camera};
 assert.equal(input.getAttribute('aria-controls'),list.getAttribute('id'));assert.notEqual(list.getAttribute('id'),otherList.getAttribute('id'));
 assert.equal(input.getAttribute('aria-activedescendant'),rows[0].getAttribute('id'));input.dispatch('keydown',{key:'ArrowDown'});
 assert.equal(input.getAttribute('aria-activedescendant'),rows[1].getAttribute('id'));assert.equal(results.scrollTop,0,'an already visible result must not move');input.dispatch('keydown',{key:'ArrowDown'});
 assert.equal(input.getAttribute('aria-activedescendant'),rows[2].getAttribute('id'));assert.equal(results.scrollTop,42);assert.equal(rows[2].getBoundingClientRect().bottom,201);input.dispatch('keydown',{key:'ArrowUp'});assert.equal(results.scrollTop,42);input.dispatch('keydown',{key:'ArrowUp'});assert.equal(results.scrollTop,10);assert.equal(rows[0].getBoundingClientRect().top,101);
 assert.deepEqual([shell.scrollTop,f.el.scrollTop,f.root.scrollTop],[7,13,19]);assert(rows.every(row=>row.scrollRequests.length===0));assert.deepEqual(f.view.camera,camera);assert.equal(f.doc.activeElement,input);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);
 input.value='no matching node';input.dispatch('input');assert.equal(input.getAttribute('aria-activedescendant'),null);input.dispatch('keydown',{key:'Escape'});assert.equal(input.getAttribute('aria-expanded'),'false');assert.equal(input.getAttribute('aria-activedescendant'),null);
});

test('secondary history and relation controls disclose without saving, and Escape returns focus to their trigger',()=>{
 const f=fixture();f.host.createRelation=()=>{};f.view.refresh();const footer=f.el.querySelector('.ts-brain-footer')!,relations=f.el.querySelector('.ts-brain-selection-relations')!;
 assert(footer.hidden);assert(relations.hidden);action(f.el,'history').click();assert(!footer.hidden);assert.equal(action(f.el,'history').getAttribute('aria-expanded'),'true');const recent=f.el.querySelector('[data-brain-recent-id="b"]')!;recent.focus();recent.dispatch('keydown',{key:'Escape'});assert(footer.hidden);assert.equal(f.doc.activeElement,action(f.el,'history'));
 action(f.el,'relations-toggle').click();assert(!relations.hidden);action(f.el,'add-top').focus();action(f.el,'add-top').dispatch('keydown',{key:'Escape'});assert(relations.hidden);assert.equal(f.doc.activeElement,action(f.el,'relations-toggle'));
 action(f.el,'relations-toggle').click();title(f,'a').click();assert(relations.hidden);assert.equal(action(f.el,'relations-toggle').getAttribute('aria-expanded'),'false');assert.equal(f.saves.length,0);
});

for(const key of ['Enter',' '])test(`history ${key===' '?'Space':key} activation enters its first available item without changing the graph`,()=>{
 const f=fixture();navigateCenter(f,'a');const before=clone(f.board),saves=f.saves.length,history=action(f.el,'history'),items=f.el.querySelectorAll('[data-brain-recent-id]');items[0].disabled=true;history.focus();history.dispatch('keydown',{key});history.dispatch('click',{detail:0});assert.equal(f.doc.activeElement,items[1]);assert(!f.el.querySelector('.ts-brain-footer')!.hidden);assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,saves);assert.equal(f.viewports.length,0);
});

for(const reason of ['mouse','touch','no items','disabled','hidden item','external focus','inactive pane','blur'])test(`history disclosure keeps focus for ${reason}`,()=>{
 const f=fixture(),history=action(f.el,'history'),recent=f.el.querySelector('.ts-brain-recent')!,item=recent.querySelector('[data-brain-recent-id]')!;history.focus();let expected:El=history;
 if(reason==='no items')recent.empty();else if(reason==='disabled')item.disabled=true;else if(reason==='hidden item')item.hidden=true;else if(reason==='external focus'){expected=f.root.createEl('input');expected.focus();}else if(reason==='inactive pane')f.host.isActive=()=>false;else if(reason==='blur')f.doc.focused=false;
 if(reason==='mouse'||reason==='touch')history.dispatch('pointerdown',{pointerType:reason});history.dispatch('click',{detail:reason==='mouse'||reason==='touch'?1:0});assert.equal(f.doc.activeElement,expected);assert.equal(f.saves.length,0);
});

for(const disclosure of ['history','relations-toggle'])test(`late ${disclosure} Escape cannot steal a new external editor focus`,()=>{
 const f=fixture();f.host.createRelation=()=>{};f.view.refresh();action(f.el,disclosure).click();const target=disclosure==='history'?f.el.querySelector('[data-brain-recent-id]')!:action(f.el,'add-top'),editor=f.root.createEl('input');target.focus();editor.focus();target.dispatch('keydown',{key:'Escape'});assert.equal(f.doc.activeElement,editor);assert.equal(action(f.el,disclosure).getAttribute('aria-expanded'),'false');assert.equal(f.saves.length,0);
});

for(const [width,height]of [[346,178],[1400,900],[1600,240],[346,96],[2400,1800]])test(`explicit fit uses the actual ${width}×${height} stage regardless of external pager visibility`,()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!;stage.clientWidth=width;stage.clientHeight=height;f.view.refresh();const before=clone(f.board),layoutBefore=JSON.stringify(f.view.layout);let visibleCamera:unknown;
 for(const hidden of [false,true]){
  f.view.pager.hidden=hidden;action(f.el,'fit').click();const camera=f.view.camera,display=f.view.layout,box={left:camera.x,top:camera.y,right:camera.x+display.width*camera.zoom,bottom:camera.y+display.height*camera.zoom};
  assert(Math.abs((box.left+box.right)/2-width/2)<1e-8,'projection must be centered horizontally in the real stage');assert(Math.abs((box.top+box.bottom)/2-height/2)<1e-8,'projection must be centered vertically in the real stage');
  if(display.width*.15<=width&&display.height*.15<=height){assert(box.left>=-1e-8&&box.top>=-1e-8&&box.right<=width+1e-8&&box.bottom<=height+1e-8,'a projection that fits above the minimum zoom must remain inside the stage');}else assert.equal(camera.zoom,.15);
  if(display.width<=width&&display.height<=height)assert.equal(camera.zoom,1,'fit must not enlarge a fully visible diagram');
  if(hidden)assert.deepEqual(camera,visibleCamera);else visibleCamera={...camera};assert.equal(JSON.stringify(display),layoutBefore);assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);
 }
 f.view.flushPendingViewport();assert.deepEqual(f.viewports,[visibleCamera]);f.view.unload();assert.equal(f.viewports.length,1);
});

// Native CSS layout is represented here by a stage-height response to the real
// host-inset binding. Actual flex geometry and hit-testing remain native QA work.
function hostChromeFixture(){
 const f=fixture(),shell=f.el.querySelector('.ts-brain-shell')!,zoom=f.el.querySelector('.ts-brain-zoom')!,stage=f.el.querySelector('.ts-brain-stage')!,bar=f.root.createDiv('status-bar');
 const rect=(left:number,top:number,right:number,bottom:number)=>({left,top,right,bottom,width:right-left,height:bottom-top});
 shell.getBoundingClientRect=()=>rect(44,40,390,844);zoom.getBoundingClientRect=()=>rect(92,780,378,824);bar.getBoundingClientRect=()=>rect(160,818,390,844);
 f.root.clientWidth=390;f.root.clientHeight=844;stage.clientWidth=346;stage.clientHeight=554;
 const set=shell.style.setProperty.bind(shell.style);shell.style.setProperty=(name:string,value:string)=>{if(name==='--ts-host-bottom-inset')stage.clientHeight-=Number.parseFloat(value)-(Number.parseFloat(shell.style.getPropertyValue(name))||0);set(name,value);};
 const resize=()=>{for(const fn of f.doc.defaultView.listeners.get('resize')||[])fn({});f.doc.tick();};
 f.view.refresh();return{...f,shell,zoom,stage,bar,rect,resize};
}
test('brain host inset uses the actual zoom group, reserves only overlapping chrome, and releases its owner window',()=>{
 const f=hostChromeFixture();f.resize();assert.equal(f.shell.style.getPropertyValue('--ts-host-bottom-inset'),'26px');assert.equal(f.stage.clientHeight,528);
 // A full-width controls row intersects the status bar, but its left-hand zoom
 // commands do not. No gap is needed for empty space in another pane/row.
 f.shell.getBoundingClientRect=()=>f.rect(44,40,1440,1000);f.zoom.getBoundingClientRect=()=>f.rect(56,940,366,984);f.bar.getBoundingClientRect=()=>f.rect(1094,974,1440,1000);f.resize();assert.equal(f.shell.style.getPropertyValue('--ts-host-bottom-inset'),'0px');assert.equal(f.stage.clientHeight,554);
 f.zoom.getBoundingClientRect=()=>f.rect(1094,940,1400,984);f.resize();assert.equal(f.shell.style.getPropertyValue('--ts-host-bottom-inset'),'26px');f.bar.hidden=true;f.resize();assert.equal(f.shell.style.getPropertyValue('--ts-host-bottom-inset'),'0px');
 const old=f.doc,next=new Doc(),root=new El('ROOT',next);next.body=root;root.appendChild(f.el);const adopt=(el:El)=>{el.ownerDocument=next;for(const child of el.children)adopt(child);};adopt(f.el);f.host.container=root;f.view.refresh();assert.equal(old.defaultView.listeners.get('resize')?.size,0);assert.equal(next.defaultView.listeners.get('resize')?.size,1);assert.equal(f.shell.style.getPropertyValue('--ts-host-bottom-inset'),'0px');
 // Queue a host notification then unload; it must not retain or act on the view.
 for(const fn of next.defaultView.listeners.get('resize')||[])fn({});assert(next.frames.size);f.view.unload();assert.equal(next.defaultView.listeners.get('resize')?.size,0);assert.equal(next.frames.size,0);assert.equal(f.shell.style.getPropertyValue('--ts-host-bottom-inset'),'');
});
for(const mode of ['stored','manual'] as const)test(`host chrome reflow preserves the exact ${mode} camera with no extra persistence`,()=>{
 const f=hostChromeFixture();if(mode==='stored'){f.board.brainViewport={x:17.125,y:-69.75,zoom:.17643254430216013};f.view.refresh();}else{f.view.zoomAt(.63);f.view.flushPendingViewport();}const camera={...f.view.camera},before=clone(f.board),writes=f.viewports.length;
 f.resize();assert.equal(f.shell.style.getPropertyValue('--ts-host-bottom-inset'),'26px');f.view.refresh();assert.deepEqual(f.view.camera,camera);f.view.refresh();assert.deepEqual(f.view.camera,camera);assert.equal(f.view.viewportIntent,undefined);assert.equal(f.doc.timers.size,0);assert.equal(f.viewports.length,writes);assert.deepEqual(clone(f.board),before);
 f.bar.hidden=true;f.resize();f.view.refresh();assert.deepEqual(f.view.camera,camera);assert.equal(f.viewports.length,writes);f.view.unload();
});
test('host chrome keeps the existing automatic-fit contract and explicit fit saves only its own camera',()=>{
 const f=hostChromeFixture(),before=clone(f.board),camera={...f.view.camera};assert.equal(f.view.fitCamera,true);f.resize();f.view.refresh();assert.equal(f.stage.clientHeight,528);assert.notDeepEqual(f.view.camera,camera);assert.equal(f.view.fitCamera,true);assert.equal(f.view.stageSize.height,528);
 const projectedCenter=()=>({x:f.view.camera.x+f.view.layout.width*f.view.camera.zoom/2,y:f.view.camera.y+f.view.layout.height*f.view.camera.zoom/2});assert.deepEqual(projectedCenter(),{x:f.stage.clientWidth/2,y:f.stage.clientHeight/2});assert.equal(f.view.viewportIntent,undefined);assert.equal(f.viewports.length,0);assert.equal(f.doc.timers.size,0);assert.deepEqual(clone(f.board),before);
 action(f.el,'fit').click();assert.deepEqual(projectedCenter(),{x:f.stage.clientWidth/2,y:f.stage.clientHeight/2});const cameraAfterFit={...f.view.camera};f.view.flushPendingViewport();assert.deepEqual(f.viewports,[cameraAfterFit]);f.view.unload();
});
test('a chrome notification cannot consume a later real pane resize or a new center',()=>{
 const f=hostChromeFixture();f.board.brainViewport={x:17.125,y:-69.75,zoom:.3};f.view.refresh();const camera={...f.view.camera},previous=f.view.layout,distance=(item:any)=>Math.hypot(camera.x+(item.x+item.width/2)*camera.zoom-f.stage.clientWidth/2,camera.y+(item.y+item.height/2)*camera.zoom-f.stage.clientHeight/2),anchor=previous.nodes.reduce((best:any,item:any)=>!best||distance(item)<distance(best)?item:best,undefined),offset={x:camera.x+(anchor.x+anchor.width/2)*camera.zoom-f.stage.clientWidth/2,y:camera.y+(anchor.y+anchor.height/2)*camera.zoom-f.stage.clientHeight/2};
 f.resize();f.root.clientWidth=844;f.root.clientHeight=390;f.stage.clientWidth=800;f.stage.clientHeight=180;f.view.refresh();const next=f.view.layout.nodes.find((item:any)=>item.id===anchor.id);assert.equal(f.view.camera.zoom,camera.zoom);assert(Math.abs(f.view.camera.x+(next.x+next.width/2)*camera.zoom-f.stage.clientWidth/2-offset.x)<1e-8);assert(Math.abs(f.view.camera.y+(next.y+next.height/2)*camera.zoom-f.stage.clientHeight/2-offset.y)<1e-8);assert.equal(f.viewports.length,0);
 f.bar.hidden=true;f.resize();f.board.brain=state.updateBoardMindmapState(f.board.brain!,{type:'center',id:'c'},f.board.nodes);f.view.refresh();assert.equal(f.view.center,'c');assert.equal(f.view.layout.nodes.find((item:any)=>item.role==='center').id,'c');assert.equal(f.viewports.length,0);f.view.unload();
});
test('single descendant segment has a short summary and no inert paging actions; detailed stats remain in the depth menu',()=>{
 const f=fixture();f.board.brain!.descendantDepth=2;f.view.refresh();const before=clone(f.board);assert.equal(f.view.descendantPage.hasNext,false);assert.equal(action(f.el,'previous-branches'),undefined);assert.equal(action(f.el,'next-branches'),undefined);assert.equal(action(f.el,'reset-branches'),undefined);assert.equal(f.view.pager.textContent,`关系 2 层 · 显示 ${f.view.layout.nodes.length}/${f.view.branchCache.index.nodes.size} 个节点`);
 action(f.el,'depth').click();assert(allMenuItems(Menu.last).some(item=>item.title.includes(`已浏览 ${f.view.descendantPage.visited} 个节点`)&&item.disabled));assert.deepEqual(clone(f.board),before);
 for(let i=0;i<75;i++){f.board.nodes.push(card('chrome-paged-'+i));f.board.edges.push({id:'chrome-edge-'+i,from:'b',to:'chrome-paged-'+i,kind:'branch',label:''});}f.view.refresh();assert.equal(action(f.el,'previous-branches').disabled,true);assert.equal(action(f.el,'next-branches').disabled,false);action(f.el,'next-branches').click();assert.equal(action(f.el,'previous-branches').disabled,false);assert.equal(action(f.el,'reset-branches').disabled,false);action(f.el,'reset-branches').click();assert.equal(f.view.descendantPage.page,0);f.view.unload();
});

test('host inset is present before the first brain refresh reads the stage',()=>{
 let atFirstRefresh='';const f=fixture(({root,view})=>{const bar=root.createDiv('status-bar');bar.getBoundingClientRect=()=>({left:200,top:374,right:600,bottom:400,width:400,height:26});const refresh=view.refresh.bind(view);view.refresh=()=>{if(!atFirstRefresh)atFirstRefresh=view.shell.style.getPropertyValue('--ts-host-bottom-inset');refresh();};});assert.equal(atFirstRefresh,'26px');assert.equal(f.viewports.length,0);f.view.unload();
});

// G: short-pane disclosure uses real command elements, without new persistence.
function shortToolsFixture(){
 const f=fixture(),shell=f.el.querySelector('.ts-brain-shell')!;shell.clientHeight=245;f.view.syncToolsLayout();return{...f,shell,tools:f.el.querySelector('.ts-brain-tools')!,toggle:action(f.el,'tools'),close:action(f.el,'tools-close')};
}
test('short-pane tools preserve exact command identity, node selection and persisted camera across repeated disclosures',()=>{
 const f=fixture(),shell=f.el.querySelector('.ts-brain-shell')!,controls=f.el.querySelector('.ts-brain-controls')!,selection=f.el.querySelector('.ts-brain-selection')!,footer=f.el.querySelector('.ts-brain-footer')!,buttons=controls.querySelectorAll('button');
 f.board.brainViewport={x:12.25,y:-67.5,zoom:.72};f.view.refresh();title(f,'a').click();const before=clone(f.board),camera={...f.view.camera},tools=f.el.querySelector('.ts-brain-tools')!;assert.equal(controls.parentElement,shell);
 shell.clientHeight=245;f.view.syncToolsLayout();assert.equal(controls.parentElement,tools);assert.equal(selection.parentElement,tools);assert.equal(footer.parentElement,tools);assert(tools.hidden);
 for(let i=0;i<5;i++){action(f.el,'tools').click();assert(!tools.hidden);action(f.el,'tools-close').click();assert(tools.hidden);}assert.deepEqual(controls.querySelectorAll('button'),buttons);assert.equal(f.view.activeNodeId,'a');assert.deepEqual(f.view.camera,camera);assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);
 shell.clientHeight=600;f.view.syncToolsLayout();assert.equal(controls.parentElement,shell);assert.equal(selection.parentElement,shell);assert.equal(footer.parentElement,shell);assert(shell.children.indexOf(selection)<shell.children.indexOf(footer));assert(shell.children.indexOf(footer)<shell.children.indexOf(controls));assert.deepEqual(controls.querySelectorAll('button'),buttons);
});
test('short-pane keyboard open enters close control and Escape returns focus without saving',()=>{
 const f=shortToolsFixture();f.toggle.focus();f.toggle.dispatch('keydown',{key:'Enter'});f.toggle.dispatch('click',{detail:0});assert.equal(f.toggle.getAttribute('aria-expanded'),'true');assert.equal(f.doc.activeElement,f.close);f.close.dispatch('keydown',{key:'Escape'});assert(f.tools.hidden);assert.equal(f.doc.activeElement,f.toggle);assert.equal(f.toggle.getAttribute('aria-expanded'),'false');assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);
});
for(const reason of ['ordinary close','outside touch','external editor','blur','inactive pane'])test(`short-pane close focus ownership: ${reason}`,()=>{
 const f=shortToolsFixture();f.toggle.click();const zoom=action(f.el,'zoom-in');zoom.focus();let expected:El=f.toggle;
 if(reason==='external editor'){expected=f.root.createEl('input');expected.focus();}if(reason==='blur'){f.doc.focused=false;expected=zoom;}if(reason==='inactive pane'){f.host.isActive=()=>false;expected=zoom;}
 if(reason==='outside touch')f.el.querySelector('.ts-brain-stage')!.dispatch('pointerdown',{pointerType:'touch',pointerId:81});else f.view.toggleTools(false);
 assert(f.tools.hidden);assert.equal(f.doc.activeElement,expected);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);
});
test('crossing short-pane threshold keeps an owned focused command visible and returns header focus to the canvas',()=>{
 const f=fixture(),shell=f.el.querySelector('.ts-brain-shell')!,zoom=action(f.el,'zoom-in'),tools=f.el.querySelector('.ts-brain-tools')!;zoom.focus();shell.clientHeight=360;f.view.syncToolsLayout();assert(!tools.hidden);assert.equal(f.doc.activeElement,zoom);assert(zoom.getClientRects().length);shell.clientHeight=361;f.view.syncToolsLayout();assert(tools.hidden);assert.equal(f.doc.activeElement,zoom);assert.equal(zoom.parentElement?.parentElement?.parentElement,shell);
 shell.clientHeight=245;f.view.syncToolsLayout();action(f.el,'tools-close').focus();shell.clientHeight=600;f.view.syncToolsLayout();assert.equal(f.doc.activeElement,shell);assert.equal(f.saves.length,0);
});
test('short-pane focus never follows the threshold out of an external or inactive editor',()=>{
 for(const mode of ['external','inactive','blur']){const f=shortToolsFixture();f.toggle.focus();let expected:El=f.toggle;if(mode==='external'){expected=f.root.createEl('input');expected.focus();}else if(mode==='inactive')f.host.isActive=()=>false;else f.doc.focused=false;f.shell.clientHeight=600;f.view.syncToolsLayout();assert.equal(f.doc.activeElement,expected);}
});
test('short-pane moves do not revive a stale selected-node press or board-menu callback',()=>{
 const f=fixture(),shell=f.el.querySelector('.ts-brain-shell')!;title(f,'a').click();const open=action(f.el,'open');open.dispatch('pointerdown');shell.clientHeight=245;f.view.syncToolsLayout();action(f.el,'tools').click();title(f,'c').click();open.click();assert.equal(f.opens.length,0);
 action(f.el,'more').click();const add=menuItem('添加节点');f.navigation.forEach(fn=>fn());add.click();assert.equal(f.added,0);assert(f.el.querySelector('.ts-brain-tools')!.hidden);
});
test('short-pane tools coexist with search and board menus without hiding their real entry points',()=>{
 const f=shortToolsFixture();f.toggle.click();action(f.el,'zoom-in').focus();action(f.el,'zoom-in').dispatch('keydown',{key:'k',ctrlKey:true});assert(f.tools.hidden);assert.equal(f.doc.activeElement,f.el.querySelector('input'));assert.equal(f.el.querySelector('input')!.getAttribute('aria-expanded'),'true');
 f.toggle.click();action(f.el,'more').focus();action(f.el,'more').dispatch('click',{detail:0});assert(f.tools.hidden);assert.equal(f.doc.activeElement,action(f.el,'more'));assert(menuItem('添加节点'));assert(menuItem('适应画布'));assert.equal(f.saves.length,0);
});
test('short-pane relation and history disclosures retain independent Escape levels and node leases',()=>{
 const f=shortToolsFixture();f.host.createRelation=()=>{};f.view.refresh();f.toggle.click();action(f.el,'relations-toggle').click();action(f.el,'add-top').focus();action(f.el,'add-top').dispatch('keydown',{key:'Escape'});assert.equal(f.doc.activeElement,action(f.el,'relations-toggle'));assert(!f.tools.hidden);action(f.el,'relations-toggle').dispatch('keydown',{key:'Escape'});assert(f.tools.hidden);assert.equal(f.doc.activeElement,f.toggle);
 f.toggle.click();action(f.el,'history').click();f.el.querySelector('[data-brain-recent-id]')!.focus();f.el.querySelector('[data-brain-recent-id]')!.dispatch('keydown',{key:'Escape'});assert(!f.tools.hidden);assert.equal(f.doc.activeElement,action(f.el,'history'));assert.equal(f.saves.length,0);
});
test('short-pane long Chinese selection and true branch paging preserve content and page state when moved',()=>{
 const f=shortToolsFixture();f.board.nodes.find(n=>n.id==='b')!.title='中文与 English 2026：很长的研究标题，保留标点与数字，不截掉节点操作的上下文。';for(let i=0;i<75;i++){f.board.nodes.push(card('short-page-'+i));f.board.edges.push({id:'short-edge-'+i,from:'b',to:'short-page-'+i,kind:'branch',label:''});}f.board.brain!.descendantDepth=3;f.view.refresh();f.toggle.click();assert.match(f.el.querySelector('.ts-brain-selection-name')!.textContent,/中文与 English 2026/);const next=action(f.el,'next-branches');assert(next);next.click();assert.equal(f.view.descendantPage.page,1);f.close.click();f.shell.clientHeight=600;f.view.syncToolsLayout();assert.equal(f.view.descendantPage.page,1);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);
});

test('short-pane reparent restores the same focused control after native-style removal blur',()=>{
 const f=fixture(),shell=f.el.querySelector('.ts-brain-shell')!,controls=f.el.querySelector('.ts-brain-controls')!,zoom=action(f.el,'zoom-in');const remove=controls.remove.bind(controls);controls.remove=()=>{if(controls.contains(f.doc.activeElement))f.doc.activeElement=f.doc.body!;remove();};zoom.focus();shell.clientHeight=245;f.view.syncToolsLayout();assert.equal(f.doc.activeElement,zoom);assert(!f.el.querySelector('.ts-brain-tools')!.hidden);shell.clientHeight=600;f.view.syncToolsLayout();assert.equal(f.doc.activeElement,zoom);assert.equal(f.saves.length,0);
});

test('a direct short-pane mount starts with the whole command set collapsed without camera persistence',()=>{
 const f=fixture(({el,board})=>{board.brainViewport={x:-20,y:30,zoom:.72};const create=el.createDiv.bind(el);el.createDiv=(options:any={})=>{const child=create(options);if(child.classes.has('ts-brain-shell'))child.clientHeight=245;return child;};});assert(f.view.shortTools);assert(f.el.querySelector('.ts-brain-tools')!.hidden);assert.equal(f.el.querySelector('.ts-brain-controls')!.parentElement,f.el.querySelector('.ts-brain-tools'));assert.deepEqual(f.view.camera,{x:-20,y:30,zoom:.72});assert.equal(f.viewports.length,0);assert.equal(f.saves.length,0);f.view.unload();assert.equal(f.doc.frames.size,0);assert.equal(f.doc.timers.size,0);
});

test('short tools reveal restored focus only inside their own scrollport and leave canvas camera unchanged',()=>{
 const f=shortToolsFixture();f.toggle.click();const button=action(f.el,'zoom-in'),stage=f.el.querySelector('.ts-brain-stage')!,camera={...f.view.camera},before=clone(f.board);f.tools.clientHeight=120;f.tools.clientTop=1;f.tools.getBoundingClientRect=()=>({x:0,y:20,left:0,right:300,top:20,bottom:140,width:300,height:120});button.getBoundingClientRect=()=>({x:0,y:160,left:0,right:44,top:160,bottom:204,width:44,height:44});button.focus();button.dispatch('focusin');assert.equal(f.tools.scrollTop,69);assert.equal(stage.scrollTop,0);assert.equal(f.shell.scrollTop,0);assert.deepEqual(f.view.camera,camera);assert.deepEqual(clone(f.board),before);
 f.tools.scrollTop=150;button.getBoundingClientRect=()=>({x:0,y:-30,left:0,right:44,top:-30,bottom:14,width:44,height:44});button.dispatch('focusin');assert.equal(f.tools.scrollTop,93);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);
});
for(const reason of ['closed','external focus','blur','inactive pane','desktop'])test(`short tools do not scroll for non-owned focus: ${reason}`,()=>{
 const f=shortToolsFixture();f.toggle.click();const button=action(f.el,'zoom-in');button.focus();f.tools.clientHeight=40;f.tools.scrollTop=19;button.getBoundingClientRect=()=>({x:0,y:300,left:0,right:44,top:300,bottom:344,width:44,height:44});
 if(reason==='closed')f.view.toggleTools(false);if(reason==='external focus')f.root.createEl('input').focus();if(reason==='blur')f.doc.focused=false;if(reason==='inactive pane')f.host.isActive=()=>false;if(reason==='desktop'){f.shell.clientHeight=600;f.view.syncToolsLayout();}button.dispatch('focusin');assert.equal(f.tools.scrollTop,19);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);
});
