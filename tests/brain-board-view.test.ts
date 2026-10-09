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

class Doc {
 listeners=new Map<string,Set<(e:any)=>void>>();
 focused=true;hasFocus(){return this.focused;}
 activeElement:El|null=null;frames=new Map<number,()=>void>();counter=0;timers=new Map<number,()=>void>();
 defaultView={listeners:new Map<string,Set<(e:any)=>void>>(),closed:false,setTimeout:(fn:()=>void)=>{const id=++this.counter;this.timers.set(id,fn);return id;},clearTimeout:(id:number)=>this.timers.delete(id),matchMedia:()=>({matches:false}),requestAnimationFrame:(fn:()=>void)=>{const id=++this.counter;this.frames.set(id,fn);return id;},cancelAnimationFrame:(id:number)=>this.frames.delete(id)};
 tick(){const frames=[...this.frames.values()];this.frames.clear();for(const fn of frames)fn();}
}
class El {
 children:El[]=[];parentElement:El|null=null;dataset:Record<string,string>={};attrs:Record<string,string>={};classes=new Set<string>();listeners=new Map<string,Set<(e:any)=>void>>();hidden=false;disabled=false;visible=true;title='';text='';value='';style:Record<string,any>={getPropertyValue(name:string){return this[name]||'';},setProperty(name:string,value:string){this[name]=value;}};scrollTop=0;scrollLeft=0;clientHeight=400;clientWidth=600;scrollHeight=400;scrollWidth=600;
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
 focus(){if(this.isConnected&&!this.disabled)this.ownerDocument.activeElement=this;}
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
const deps={BrainRefreshCache,...brainColors,...descendants,...ports,LocalRelationMotion,...state,...relations,...layout,...creation,Component,Menu,setIcon(el:El,icon:string){el.dataset.icon=icon;}};
const {BrainBoardView:View,sideActionPositions}=new Function(...Object.keys(deps),transformSync(source+'\nreturn {BrainBoardView,sideActionPositions};',{loader:'ts'}).code)(...Object.values(deps));
const card=(id:string,kind:Card['kind']='card'):Card=>({id,kind,title:'标题 '+id,file:kind==='card'?`Notes/${id}.md`:kind==='board'?`Boards/${id}.thoughtspace`:undefined,x:10,y:20,width:120,height:80,color:'slate'});
function fixture(){
 const doc=new Doc(),root=new El('ROOT',doc),el=root.createDiv();
 const board:Board={...emptyBoard(),version:3,presentation:'brain',brain:state.createBoardMindmapState('b'),nodes:[...['a','b','c','d','sibling'].map(id=>card(id)),card('group','section'),card('sub','board'),card('text','text')],edges:[{id:'ab',from:'a',to:'b',label:'父级',kind:'branch'},{id:'as',from:'a',to:'sibling',label:'',kind:'branch'},{id:'bc',from:'b',to:'c',label:'子级',kind:'branch'},{id:'bd',from:'b',to:'d',label:'引用'},{id:'bs',from:'b',to:'sub',label:'子板',direction:'both'},{id:'bg',from:'b',to:'group',label:'分组',direction:'both'},{id:'bt',from:'b',to:'text',label:'不可用'}]};
 let snapshot:any={board,path:'Board.thoughtspace',key:{}},added=0;const saves:any[]=[],viewports:any[]=[],opens:{id:string;current:()=>boolean;edit:boolean}[]=[],previews:{id:string;body:El;scope:Component;current:()=>boolean}[]=[],missing=new Set<string>(),stamps=new Map<string,string>();
 const host:any={snapshot:()=>snapshot,change:(next:any)=>{saves.push(clone(next));snapshot.board.brain=next;},source:(id:string)=>{const node=board.nodes.find(item=>item.id===id);return{label:'来源 '+id,path:node?.file,available:!!node&&!missing.has(id),reason:'来源文件缺失',canEdit:node?.kind==='card',stamp:stamps.get(id)||'1'};},open:async(id:string,current:()=>boolean,edit:boolean)=>{opens.push({id,current,edit});},preview:(id:string,body:El,scope:Component,current:()=>boolean)=>{previews.push({id,body,scope,current});if(current())body.createEl('p',{text:`真实正文 ${id}`});},add:()=>{added++;},viewport:(value:any)=>{viewports.push(value);board.brainViewport=value;},relate:()=>{},fileMenu:()=>{}};
 const view=new View({},el,host);view.load();
 return{view,doc,root,el,board,host,saves,viewports,opens,previews,missing,stamps,get snapshot(){return snapshot;},setSnapshot:(value:any)=>{snapshot=value;},get added(){return added;}};
}
const node=(f:ReturnType<typeof fixture>,id:string)=>f.el.querySelector(`[data-brain-node-id="${id}"]`)!;
const action=(root:El,key:string)=>root.querySelector(`[data-brain-action="${key}"]`)!;
const title=(f:ReturnType<typeof fixture>,id:string)=>node(f,id).querySelector('.ts-brain-node-title')!;
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

test('dedicated mount draws only supported nodes without mutating geometry, state, sources or viewport',()=>{const f=fixture(),before=clone(f.board);f.view.refresh();assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);assert.equal(f.opens.length,0);assert.equal(f.previews.length,0);assert.equal(f.el.querySelectorAll('.ts-node').length,0);assert.equal(f.el.querySelectorAll('[data-id]').length,0);assert.equal(node(f,'text'),undefined);assert.ok(node(f,'group'));assert.ok(node(f,'sub'));});
test('explicit idea remains a visible center and ordinary text stays excluded',()=>{const f=fixture();f.board.nodes.find(n=>n.id==='b')!.brainIdea=undefined;const idea=brainIdeaNode('idea','Named idea');f.board.nodes.push(idea);f.board.brain=state.updateBoardMindmapState(f.board.brain!,{type:'center',id:'idea'},f.board.nodes);f.view.refresh();assert(node(f,'idea'));assert.equal(node(f,'idea').dataset.brainRole,'center');assert.equal(node(f,'text'),undefined);assert.equal(action(node(f,'idea'),'add-bottom').hidden,false);});
test('depth menu adds real simultaneous descendants and restores old one-layer view without source writes',()=>{
 const f=fixture();f.snapshot.graphRevision=0;for(let i=1;i<=6;i++){f.board.nodes.push(card('deep-'+i));f.board.edges.push({id:'deep-edge-'+i,from:i===1?'c':'deep-'+(i-1),to:'deep-'+i,kind:'branch',label:''});}f.snapshot.graphRevision++;f.view.refresh();const before=clone(f.board.nodes),edges=clone(f.board.edges);action(f.el,'depth').click();menuItem('显示 5 层').click();assert(node(f,'deep-4'));assert.equal(node(f,'deep-5'),undefined);assert.equal(node(f,'deep-4').dataset.brainDepth,'5');assert.equal(f.board.brain!.descendantDepth,5);assert.equal(f.saves.length,1);assert.deepEqual(clone(f.board.nodes),before);assert.deepEqual(clone(f.board.edges),edges);const index=f.view.branchCache.index;f.view.camera.x+=10;f.view.transform();f.view.refresh();assert.equal(f.view.branchCache.index,index);action(f.el,'depth').click();menuItem('显示 1 层').click();assert.equal(node(f,'deep-1'),undefined);assert.equal(f.board.brain!.descendantDepth,undefined);
});
test('graph revision invalidates descendant adjacency while hidden view neither builds nor steals focus',()=>{
 const f=fixture();f.snapshot.graphRevision=0;f.view.update({type:'depth',value:5});const old=f.view.branchCache.index;f.board.nodes.push(card('new-child'));f.board.edges.push({id:'new-edge',from:'c',to:'new-child',kind:'branch',label:''});f.snapshot.graphRevision++;f.view.refresh();assert.notEqual(f.view.branchCache.index,old);assert(node(f,'new-child'));const input=f.el.querySelector('input')!;input.focus();f.el.visible=false;const index=f.view.branchCache.index;f.snapshot.graphRevision++;f.view.refresh();assert.equal(f.view.branchCache.index,index);assert.equal(f.doc.activeElement,input);f.el.visible=true;f.view.refresh();assert.notEqual(f.view.branchCache.index,index);
});
test('four center plus buttons expose exact directions without changing center or capturing title clicks',()=>{
 const f=fixture(),calls:{id:string;side:string;current:()=>boolean}[]=[];f.host.createRelation=(id:string,side:string,current:()=>boolean)=>calls.push({id,side,current});f.view.refresh();
 for(const side of ['top','bottom','left','right']){const button=action(node(f,'b'),'add-'+side);assert.equal(button.tagName,'BUTTON');assert.equal(button.hidden,false);assert.equal(button.disabled,false);assert.equal(button.getAttribute('aria-haspopup'),'dialog');button.focus();assert.equal(f.doc.activeElement,button);button.click();assert.equal(action(node(f,'a'),'add-'+side).hidden,true);}
 assert.deepEqual(calls.map(({id,side})=>({id,side})),['top','bottom','left','right'].map(side=>({id:'b',side})));assert.equal(f.board.brain!.centerId,'b');assert.equal(f.saves.length,0);assert(calls.every(call=>call.current()));
 title(f,'a').click();assert(calls.every(call=>!call.current()));assert.equal(f.board.brain!.centerId,'a');assert.equal(f.saves.length,1);
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
test('title click recenters once in same graph and keeps all source geometry intact',()=>{const f=fixture(),nodes=clone(f.board.nodes),scene=f.el.querySelector('.ts-brain-scene');title(f,'a').click();title(f,'a').click();assert.equal(f.board.brain!.centerId,'a');assert.equal(f.saves.length,1);assert.equal(f.el.querySelector('.ts-brain-scene'),scene);assert.deepEqual(clone(f.board.nodes),nodes);assert.equal(f.opens.length,0);assert.equal(f.doc.activeElement,title(f,'a'));});
test('persisted back/forward and unique recent nodes retain nonconsecutive history',()=>{const f=fixture();title(f,'a').click();title(f,'b').click();assert.deepEqual(f.board.brain!.history.entries,['b','a','b']);assert.equal(f.el.querySelectorAll('[data-brain-recent-id]').length,2);action(f.el,'back').click();assert.equal(f.board.brain!.centerId,'a');action(f.el,'back').click();assert.equal(f.board.brain!.centerId,'b');action(f.el,'forward').click();assert.equal(f.board.brain!.centerId,'a');});
test('preview keeps native body, scroll and focus across refresh and role change',()=>{const f=fixture();action(node(f,'a'),'expand').click();const old=f.previews[0],input=old.body.createEl('input');old.body.scrollTop=70;input.focus();f.view.refresh();assert.equal(f.previews.length,1);assert.equal(f.doc.activeElement,input);assert.equal(old.body.scrollTop,70);title(f,'a').click();assert.equal(f.previews.length,1);assert.equal(old.current(),true);assert.equal(node(f,'a').querySelector('.ts-brain-preview'),old.body);assert.equal(node(f,'a').style.getPropertyValue('--brain-preview-width'),'340px');assert.equal(old.body.getAttribute('tabindex'),'0');assert.equal(old.body.getAttribute('role'),'region');action(node(f,'a'),'expand').click();assert.equal(node(f,'a').style.getPropertyValue('--brain-preview-width'),'');});
test('preview keeps its current node name after native loading clears aria-label and label IDs are unique per view',()=>{
 const f=fixture(),other=fixture();action(node(f,'a'),'expand').click();action(node(other,'a'),'expand').click();const body=f.previews[0].body,label=node(f,'a').querySelector('.ts-brain-node-label')!,otherLabel=node(other,'a').querySelector('.ts-brain-node-label')!;
 assert.equal(body.getAttribute('aria-labelledby'),label.getAttribute('id'));assert.notEqual(label.getAttribute('id'),otherLabel.getAttribute('id'));assert.equal(body.getAttribute('aria-description'),'正文');
 body.setAttribute('aria-label','正在加载');body.removeAttribute('aria-label');f.board.nodes.find(item=>item.id==='a')!.title='更新的知识标题';f.view.refresh();assert.equal(f.previews.length,1);assert.equal(body.getAttribute('aria-label'),null);assert.equal(body.getAttribute('aria-labelledby'),label.getAttribute('id'));assert.equal(label.textContent,'更新的知识标题');
});
test('preview source modification rebuilds only body while loss is explicit and restorable',()=>{const f=fixture();action(node(f,'a'),'expand').click();const old=f.previews[0];f.stamps.set('a','2');assert.equal(old.current(),false);f.view.refresh();assert.equal(old.scope.loaded,false);assert.equal(f.previews.length,2);f.missing.add('a');f.view.refresh();assert.match(node(f,'a').textContent,/来源文件缺失/);assert.equal(action(node(f,'a'),'open').disabled,true);assert.deepEqual(f.board.brain!.expandedIds,['a']);f.missing.delete('a');f.view.refresh();assert.equal(f.previews.length,3);});
test('collapsing body cancels scope and repeated toggle does not grow retained children',()=>{const f=fixture();for(let i=0;i<20;i++){action(node(f,'a'),'expand').click();const current=f.previews.at(-1)!;action(node(f,'a'),'expand').click();assert.equal(current.current(),false);assert.equal(current.scope.loaded,false);}assert.ok(f.view.children.length<12);});
for(const reason of ['center','owner','path','deleted','document','closed','hidden','presentation','unloaded'])test(`pending source action is canceled after ${reason}`,()=>{const f=fixture();action(node(f,'a'),'open').click();const current=f.opens[0].current;if(reason==='center')title(f,'a').click();if(reason==='owner')f.setSnapshot({...f.snapshot,key:{}});if(reason==='path')f.snapshot.path='Rename.thoughtspace';if(reason==='deleted')f.board.nodes=f.board.nodes.filter(n=>n.id!=='a');if(reason==='document')f.el.ownerDocument=new Doc();if(reason==='closed')f.doc.defaultView.closed=true;if(reason==='hidden')f.el.visible=false;if(reason==='presentation')delete f.board.presentation;if(reason==='unloaded')f.view.unload();assert.equal(current(),false);});
test('native context menu edit and relationship actions use exact node and do not recenter',()=>{const f=fixture();action(node(f,'a'),'node-menu').click();assert.equal(Menu.last.native,false);menuItem('编辑实际笔记').click();assert.equal(f.opens[0].id,'a');assert.equal(f.opens[0].edit,true);assert.equal(f.board.brain!.centerId,'b');assert.ok(menuItem('添加关联'));assert.equal(f.saves.length,0);});
test('node menu opens existing-note picker directly for the exact noncenter node and stale menus cannot retarget it',()=>{
 const f=fixture(),calls:{id:string;current:()=>boolean}[]=[];f.host.associateExisting=(id:string,current:()=>boolean)=>calls.push({id,current});action(node(f,'a'),'node-menu').click();const item=menuItem('关联已有笔记…');assert(item);item.click();assert.equal(calls[0].id,'a');assert(calls[0].current());assert.equal(f.board.brain!.centerId,'b');assert.equal(f.saves.length,0);title(f,'a').click();assert(!calls[0].current());item.click();assert.equal(calls.length,1);
});
test('existing-note node-menu shortcut remains disabled for locked and read-only nodes',()=>{
 const f=fixture();f.host.associateExisting=()=>{throw Error('Must stay disabled');};f.board.nodes.find(n=>n.id==='a')!.locked=true;f.view.refresh();action(node(f,'a'),'node-menu').click();assert(menuItem('关联已有笔记…').disabled);f.board.nodes.find(n=>n.id==='a')!.locked=false;f.snapshot.readOnly=true;f.view.refresh();action(node(f,'a'),'node-menu').click();assert(menuItem('关联已有笔记…').disabled);
});
test('a busy existing-note menu action surfaces the safe failure without a window error or recentering',()=>{
 const f=fixture();f.host.associateExisting=()=>{throw Error('请先完成此白板正在进行的编辑或创建');};action(node(f,'a'),'node-menu').click();assert.doesNotThrow(()=>menuItem('关联已有笔记…').click());assert.match(f.el.querySelector('.ts-brain-status')!.textContent,/正在进行/);assert.equal(f.board.brain!.centerId,'b');assert.equal(f.saves.length,0);
});
test('keyboard context menu uses owning popout document and stale menu cannot mutate',()=>{const f=fixture();title(f,'a').dispatch('keydown',{key:'F10',shiftKey:true});assert.equal(Menu.last.doc,f.doc);const pending=menuItem('固定节点');title(f,'a').click();pending.click();assert.equal(Menu.last.hidden,true);assert.deepEqual(f.board.brain!.pins,[]);});
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
function narrowActionLayout():layout.BrainBoardLayout{return{width:1000,height:600,links:[],labels:[],page:0,pages:1,total:2,nodes:[{id:'b',role:'center',x:380,y:200,width:240,height:72,previewWidth:340},{id:'a',role:'associated',x:118.5,y:280,width:178,height:49,previewWidth:213},{id:'sibling',role:'siblings',x:703.5,y:280,width:178,height:49,previewWidth:213}]};}
test('side action candidates avoid full center bodies and choose visible outer lanes at 600px fit',()=>{
 const scene=narrowActionLayout(),before=clone(scene),positions=sideActionPositions(scene,{x:0,y:0,zoom:.6},{width:600,height:400});assert.equal(positions.get('a'),'left');assert.equal(positions.get('sibling'),'right');assert.deepEqual(scene,before);
});
test('600px default zoom retains a compact menu when both side lanes intersect content or the viewport',()=>{
 const positions=sideActionPositions(narrowActionLayout(),{x:-60,y:0,zoom:.72},{width:600,height:600});assert.equal(positions.get('a'),'compact');assert.equal(positions.get('sibling'),'compact');
});
test('wide reading columns keep three actions in their clear inner lanes',()=>{
 const scene=narrowActionLayout();scene.width=1600;scene.nodes[0].x=680;scene.nodes[1].x=243;scene.nodes[1].previewWidth=280;scene.nodes[2].x=1179;scene.nodes[2].previewWidth=280;
 const positions=sideActionPositions(scene,{x:0,y:0,zoom:1},{width:1600,height:800});assert.equal(positions.get('a'),'right');assert.equal(positions.get('sibling'),'left');
});
test('compact actions hide only expand/open from tab order and their existing menu keeps full actions without recentering',()=>{
 const f=fixture();f.view.layout=narrowActionLayout();f.view.camera={x:-60,y:0,zoom:.72};f.view.stageSize={width:600,height:600};f.view.transform();
 const item=node(f,'a');assert.equal(item.dataset.brainActionsSide,'compact');assert.equal(action(item,'expand').hidden,true);assert.equal(action(item,'open').hidden,true);assert.equal(action(item,'node-menu').hidden,false);assert.equal(item.classList.contains('is-compact-actions'),true);
 action(item,'node-menu').click();assert.equal(f.board.brain!.centerId,'b');assert.ok(Menu.last.items.some(item=>item.title==='展开正文'));menuItem('打开 来源 a').click();assert.equal(f.opens[0].id,'a');assert.equal(f.board.brain!.centerId,'b');assert.equal(f.saves.length,0);item.dispatch('keydown',{key:'Escape'});assert.equal(Menu.last.hidden,true);
 f.view.camera={x:0,y:0,zoom:.6};f.view.transform();assert.equal(action(item,'expand').hidden,false);assert.equal(action(item,'open').hidden,false);assert.equal(item.classList.contains('is-compact-actions'),false);
});
for(const button of ['expand','open'])test(`compacting a focused ${button} transfers focus only to the same node menu`,()=>{
 const f=fixture(),item=node(f,'a');action(item,button).focus();f.view.layout=narrowActionLayout();f.view.camera={x:-60,y:0,zoom:.72};f.view.stageSize={width:600,height:600};f.view.transform();assert.equal(f.doc.activeElement,action(item,'node-menu'));assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);
});
for(const boundary of ['editor','background','inactive'])test(`compact refresh preserves the ${boundary} focus boundary`,()=>{
 const f=fixture(),item=node(f,'a'),editor=f.root.createEl('input');if(boundary==='editor')editor.focus();else action(item,'expand').focus();const active=f.doc.activeElement;if(boundary==='background')f.doc.focused=false;if(boundary==='inactive')f.host.isActive=()=>false;
 f.view.layout=narrowActionLayout();f.view.camera={x:-60,y:0,zoom:.72};f.view.stageSize={width:600,height:600};f.view.transform();assert.equal(f.doc.activeElement,active);assert.equal(f.saves.length,0);assert.equal(f.viewports.length,0);
});
test('keyboard undo is scoped to nonediting controls and does not swallow composition',()=>{const f=fixture();let calls=0;f.host.shortcut=()=>{calls++;return true;};title(f,'a').dispatch('keydown',{key:'z',metaKey:true});assert.equal(calls,1);f.el.querySelector('input')!.dispatch('keydown',{key:'z',metaKey:true});title(f,'a').dispatch('keydown',{key:'z',metaKey:true,isComposing:true});assert.equal(calls,1);});
test('same-session other-window refresh never steals focus from external native editor',()=>{const f=fixture(),editor=f.root.createEl('input');editor.focus();f.board.brain=state.updateBoardMindmapState(f.board.brain!,{type:'center',id:'a'},f.board.nodes);f.view.refresh();assert.equal(f.doc.activeElement,editor);assert.equal(f.saves.length,0);});
test('owning board rename replaces async preview scope without losing navigation',()=>{const f=fixture();action(node(f,'a'),'expand').click();const old=f.previews[0],history=clone(f.board.brain!.history);f.snapshot.path='Renamed.thoughtspace';assert.equal(old.current(),false);f.view.refresh();assert.equal(old.scope.loaded,false);assert.equal(f.previews.length,2);assert.deepEqual(f.board.brain!.history,history);});
test('mount/refresh/resize never saves camera while explicit zoom debounces and flushes before close',()=>{const f=fixture();f.view.refresh();assert.equal(f.viewports.length,0);action(f.el,'zoom-in').click();action(f.el,'zoom-in').click();assert.equal(f.viewports.length,0);assert.equal(f.doc.timers.size,1);f.view.unload();assert.equal(f.viewports.length,1);assert.equal(f.doc.timers.size,0);assert.ok(f.viewports[0].zoom>.72);});
test('camera intent cannot save into a replacement session',()=>{const f=fixture();action(f.el,'zoom-in').click();f.setSnapshot({...f.snapshot,key:{}});f.view.flushViewport();assert.equal(f.viewports.length,0);});
test('ordinary wheel pans only the graph and preview wheel retains native scrolling',()=>{const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!,before=clone(f.board.nodes);const event=stage.dispatch('wheel',{deltaX:20,deltaY:40});assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);f.view.flushViewport();assert.equal(f.viewports.length,1);assert.deepEqual(clone(f.board.nodes),before);action(node(f,'a'),'expand').click();const wheel=f.previews[0].body.dispatch('wheel',{deltaY:30});assert.equal(wheel.defaultPrevented,false);assert.equal(wheel.stopped,true);});

test('wheel bursts accumulate the exact latest camera but project once per frame',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!,camera={...f.view.camera};let writes=0;const transform=f.view.transform.bind(f.view);f.view.transform=()=>{writes++;transform();};
 for(let i=0;i<12;i++)stage.dispatch('wheel',{deltaX:2,deltaY:3});assert.equal(writes,0);assert.equal(f.doc.frames.size,1);assert.equal(f.view.camera.x,camera.x-24);assert.equal(f.view.camera.y,camera.y-36);
 f.doc.tick();assert.equal(writes,1);assert.equal(f.doc.frames.size,0);f.view.flushPendingViewport();assert.deepEqual(f.viewports[0],f.view.camera);
});
test('zoom bursts preserve changing anchors while DOM projection is deferred',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!;let expected={...f.view.camera};
 for(const [x,y,delta]of [[100,80,-20],[200,120,30],[90,70,-10]]){const zoom=Math.max(.2,Math.min(2.5,expected.zoom*Math.exp(-delta*.002))),scale=zoom/expected.zoom;expected={x:x-(x-expected.x)*scale,y:y-(y-expected.y)*scale,zoom};stage.dispatch('wheel',{clientX:x,clientY:y,deltaY:delta,ctrlKey:true});}
 assert.deepEqual(f.view.camera,expected);assert.equal(f.doc.frames.size,1);f.doc.tick();assert.equal(f.view.scene.style.transform,`translate(${expected.x}px, ${expected.y}px) scale(${expected.zoom})`);
});
test('zoom scale variables are scoped to consuming controls instead of the whole brain shell',()=>{
 const f=fixture();f.view.zoomAt(.5);assert.equal(f.view.shell.style.getPropertyValue('--brain-action-scale'),'');assert.equal(f.view.shell.style.getPropertyValue('--brain-port-scale'),'');
 for(const item of f.view.nodes.values()){assert.equal(item.actions.style.getPropertyValue('--brain-action-scale'),'2');assert.equal(item.title.style.getPropertyValue('--brain-action-scale'),'');assert.equal(item.root.style.getPropertyValue('--brain-action-scale'),'');if(item.root.dataset.brainRole==='center')for(const anchor of item.anchors)if(!anchor.hidden)assert.equal(anchor.style.getPropertyValue('--brain-port-scale'),'2');}
});
test('refresh preserves unchanged title and expansion icon DOM but still reflects edits',()=>{
 const f=fixture(),item=f.view.nodes.get('b');let textWrites=0,iconWrites=0;const setText=item.label.setText.bind(item.label);item.label.setText=(text:string)=>{textWrites++;setText(text);};item.expand.dataset=new Proxy(item.expand.dataset,{set(target:Record<string,string>,key:string,value:string){if(key==='icon')iconWrites++;target[key]=value;return true;}});
 f.view.refresh();assert.equal(textWrites,0);assert.equal(iconWrites,0);action(node(f,'b'),'expand').click();assert.equal(iconWrites,1);f.view.refresh();assert.equal(iconWrites,1);action(node(f,'b'),'expand').click();assert.equal(iconWrites,2);f.board.nodes.find(n=>n.id==='b')!.title='Changed title';f.view.refresh();assert.equal(textWrites,1);assert.equal(item.label.textContent,'Changed title');assert.equal(iconWrites,2);
});
test('pointer cancellation projects and saves the final input without leaving a frame',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!;const before={...f.view.camera};stage.dispatch('pointerdown',{pointerId:9,clientX:10,clientY:20});stage.dispatch('pointermove',{pointerId:9,clientX:60,clientY:80});assert.equal(f.doc.frames.size,1);stage.dispatch('pointercancel',{pointerId:9});assert.equal(f.doc.frames.size,0);assert.equal(f.view.camera.x,before.x+50);assert.equal(f.view.camera.y,before.y+60);f.view.flushPendingViewport();assert.deepEqual(f.viewports[0],f.view.camera);
});
test('replacement refresh and unload cannot render a stale scheduled camera',()=>{
 for(const boundary of ['refresh','unload']){const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!;stage.dispatch('wheel',{deltaY:20});assert.equal(f.doc.frames.size,1);if(boundary==='refresh'){f.setSnapshot({...f.snapshot,board:{...clone(f.board),brainViewport:{x:4,y:5,zoom:1.2}},key:{}});f.view.refresh();assert.deepEqual(f.view.camera,{x:4,y:5,zoom:1.2});}else f.view.unload();assert.equal(f.doc.frames.size,0);f.doc.tick();}
});
test('removed center stays explicit and history back recovers without choosing arbitrary replacement',()=>{const f=fixture();title(f,'a').click();f.board.nodes=f.board.nodes.filter(node=>node.id!=='a');const saves=f.saves.length;f.view.refresh();assert.match(f.el.textContent,/中心节点已移除/);assert.equal(f.saves.length,saves);action(f.el,'back').click();assert.equal(f.board.brain!.centerId,'b');});
test('empty dedicated board guides existing knowledge with one usable add intent and no synthetic node',()=>{const f=fixture();f.board.nodes=[];f.board.edges=[];f.board.brain=state.createBoardMindmapState();f.view.refresh();const empty=f.el.querySelector('.ts-brain-empty')!;assert.equal(f.el.querySelectorAll('.ts-brain-node').length,0);assert.match(empty.textContent,/从已有知识开始/);assert.match(empty.textContent,/仓库中的笔记或子白板/);assert.match(empty.textContent,/第一个节点将成为中心/);assert.equal(empty.querySelectorAll('button').length,1);assert.equal(action(empty,'add').getAttribute('aria-label'),'添加知识节点');action(empty,'add').click();assert.equal(f.added,1);assert.equal(f.saves.length,0);});
test('large neighborhoods and search are bounded with reachable next pages',()=>{const f=fixture();for(let i=0;i<50;i++){f.board.nodes.push(card('extra'+i));f.board.edges.push({id:'extra'+i,from:'b',to:'extra'+i,label:''});}f.view.refresh();assert.ok(f.el.querySelectorAll('.ts-brain-node').length<=20);const first=f.el.querySelectorAll('.ts-brain-node').map(item=>item.dataset.brainNodeId);action(f.el,'next-page').click();assert.ok(f.el.querySelectorAll('.ts-brain-node').some(item=>!first.includes(item.dataset.brainNodeId)));const input=f.el.querySelector('input')!;input.dispatch('focus');assert.equal(f.el.querySelectorAll('.ts-brain-search-result').length,10);assert.equal(f.saves.length,0);});
test('save failure leaves center unchanged and surfaces actionable feedback',()=>{const f=fixture();f.host.change=()=>{throw Error('保存失败，请重试');};title(f,'a').click();assert.equal(f.board.brain!.centerId,'b');assert.match(f.el.querySelector('.ts-brain-status')!.textContent,/保存失败/);});

test('explicit focus after offscreen navigation recenters camera, preserves zoom and saves intent',()=>{const f=fixture();f.view.camera={x:-1400,y:-900,zoom:1.25};f.view.fitCamera=false;const stage=f.el.querySelector('.ts-brain-stage')!;stage.getBoundingClientRect=()=>({left:0,top:0,right:600,bottom:400,width:600,height:400});f.view.nodes.get('b').pill.getBoundingClientRect=()=>({left:-800,top:-500,right:-500,bottom:-410,width:300,height:90});const original=clone(f.board.nodes);f.view.focusNode('b');assert.equal(f.view.camera.zoom,1.25);assert.notEqual(f.view.camera.x,-1400);assert.notEqual(f.view.camera.y,-900);assert.equal(f.doc.activeElement,title(f,'b'));f.view.flushPendingViewport();assert.equal(f.viewports.length,1);assert.deepEqual(clone(f.board.nodes),original);});
test('refresh with offscreen camera never recenters or focuses another window',()=>{const f=fixture(),editor=f.root.createEl('input');editor.focus();f.view.camera={x:-1400,y:-900,zoom:1.25};f.view.fitCamera=false;f.view.refresh();assert.deepEqual(f.view.camera,{x:-1400,y:-900,zoom:1.25});assert.equal(f.doc.activeElement,editor);assert.equal(f.viewports.length,0);});
test('directed native arrows use unique per-view markers and ordinary associations remain undirected',()=>{const a=fixture(),b=fixture(),links=a.el.querySelector('.ts-brain-links')!.querySelectorAll('path'),directed=links.find(link=>link.dataset.brainRole==='outgoing')!,associated=links.find(link=>link.dataset.brainRole==='associated')!;assert.match(directed.getAttribute('marker-end')||'',/^url\(#ts-brain-arrow-/);assert.equal(associated.getAttribute('marker-end'),null);const marker=a.el.querySelector('marker')!,other=b.el.querySelector('marker')!;assert.notEqual(marker.getAttribute('id'),other.getAttribute('id'));assert.equal(directed.dataset.brainFrom,'b');assert.equal(directed.dataset.brainTo,'d');});

test('history boundary buttons hand focus to visible center so subsequent keyboard history remains scoped',()=>{const f=fixture();title(f,'a').click();const back=action(f.el,'back');back.focus();back.click();assert.equal(back.disabled,true);assert.equal(f.doc.activeElement,title(f,'b'));const forward=action(f.el,'forward');forward.focus();forward.click();assert.equal(forward.disabled,true);assert.equal(f.doc.activeElement,title(f,'a'));f.doc.activeElement!.dispatch('keydown',{key:'ArrowLeft',altKey:true});assert.equal(f.board.brain!.centerId,'b');});

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
 f.host.change=()=>{throw Error('保存失败，请重试');};title(f,'a').click();assert.match(status.textContent,/保存失败/);assert.deepEqual(clone(f.board),before);
 f.host.change=change;title(f,'b').click();assert.equal(status.textContent,'');assert.equal(f.doc.activeElement,title(f,'b'));assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);
 const open=f.host.open;f.host.open=()=>{throw Error('打开来源失败，请重试');};action(node(f,'b'),'open').click();assert.match(status.textContent,/打开来源失败/);assert.deepEqual(clone(f.board),before);
 f.host.open=open;title(f,'b').click();assert.equal(status.textContent,'');assert.equal(f.doc.activeElement,title(f,'b'));assert.deepEqual(clone(f.board),before);assert.equal(f.saves.length,0);
 const stage=f.el.querySelector('.ts-brain-stage')!;stage.getBoundingClientRect=()=>({left:0,top:0,right:600,bottom:400,width:600,height:400});
 f.view.camera={x:-1400,y:-900,zoom:1.25};f.view.fitCamera=false;f.view.nodes.get('b').pill.getBoundingClientRect=()=>({left:-800,top:-500,right:-500,bottom:-410,width:300,height:90});
 title(f,'b').click();assert.equal(f.view.camera.zoom,1.25);assert.notEqual(f.view.camera.x,-1400);assert.notEqual(f.view.camera.y,-900);assert.equal(f.doc.activeElement,title(f,'b'));assert.equal(f.saves.length,0);assert.deepEqual(f.board.brain,before.brain);assert.deepEqual(clone(f.board.nodes),before.nodes);
 assert.equal(f.viewports.length,0);f.view.flushPendingViewport();assert.equal(f.viewports.length,1);assert.deepEqual(f.viewports[0],f.view.camera);
});

test('refresh reads stage dimensions once before graph writes and later resize or explicit fit uses fresh dimensions',()=>{
 const f=fixture(),stage=f.el.querySelector('.ts-brain-stage')!,scene=f.el.querySelector('.ts-brain-scene')!,svg=f.el.querySelector('.ts-brain-links')!;
 let width=1200,height=800;const events:string[]=[];
 Object.defineProperty(stage,'clientWidth',{configurable:true,get:()=>{events.push('read:width');return width;}});Object.defineProperty(stage,'clientHeight',{configurable:true,get:()=>{events.push('read:height');return height;}});
 scene.style=new Proxy(scene.style,{set(target,key,value){events.push('write:scene');return Reflect.set(target,key,value);}});
 const setAttribute=svg.setAttribute.bind(svg);svg.setAttribute=(name,value)=>{events.push('write:svg');setAttribute(name,value);};
 const measuredOnceBeforeWrites=()=>{assert.equal(events.filter(event=>event==='read:width').length,1);assert.equal(events.filter(event=>event==='read:height').length,1);const firstWrite=events.findIndex(event=>event.startsWith('write:'));assert(firstWrite>=0);assert(events.indexOf('read:width')<firstWrite,'Stage width must be read before graph DOM writes');assert(events.indexOf('read:height')<firstWrite,'Stage height must be read before graph DOM writes');};
 const centered=()=>{const camera=f.view.camera,display=f.view.layout;assert(Math.abs(camera.x+display.width*camera.zoom/2-width/2)<1e-8);assert(Math.abs(camera.y+display.height*camera.zoom/2-(f.view.fitAll?Math.max(160,height-(f.view.pager.hidden?76:144)):height)/2)<1e-8);};
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
 const deps={BrainRefreshCache,...descendants,...ports,LocalRelationMotion,...state,...brain,...relations,Component,BrainBoardView:View,View:class{},Notice:class{},TFile:class{}};
 const Parent=new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps)),parent=new Parent(),leaf={view:parent},content=f.first.root.createDiv(),plugin=f.owner.plugin;
 Object.assign(plugin,{refreshDock(){},refreshLocalRelations(){},clearMaterialDrag(){}});Object.assign(parent,{app:{workspace:{getActiveViewOfType:()=>parent}},plugin,leaf,contentEl:content,session:f.owner,closed:false,closing:false,dialogEpoch:0,brainObjectEpoch:0,sidebarRun:0,renderFrame:0,blankClicks:{cancel(){}},clearCanvasGesture(){},clearNodes(){},finishMarquee(){},finishInlineForNavigation:async()=>{},renderSaveStatus(){},mindmapNative:()=>({relations:[],tagsByNode:new Map(),pendingPaths:[]}),mindmapSource:(_owner:any,id:string)=>({label:id,available:true,stamp:'1'})});
 parent.load();parent.renderBrainBoard();const renderer=parent.brainBoardView,el=parent.brainBoardEl;
 const paint=(kind:string)=>{if(kind==='board')parent.brainBoardView?.refresh();};f.owner.listeners.add(paint);parent.unsubscribe=()=>f.owner.listeners.delete(paint);
 const pan=()=>{const stage=el.querySelector('.ts-brain-stage')!;stage.dispatch('pointerdown',{pointerId:4,clientX:35,clientY:70});stage.dispatch('pointermove',{pointerId:4,clientX:80,clientY:95});stage.dispatch('pointerup',{pointerId:4});assert.deepEqual(renderer.camera,{x:-155,y:43.3,zoom:1});assert.equal(f.first.doc.timers.size,1);};
 const detach=()=>{content.remove();renderer.unload();};return{...f,parent,renderer,el,pan,detach};
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
 const f=sessionRendererFixture(),v=f.first,initialCamera={...v.view.camera};title(v,'a').click();await f.owner.flush();
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
 action(v.el,'zoom-in').click();const pending={...v.view.camera},board=f.owner.board;title(v,'a').click();await f.owner.flush();assert.equal(f.owner.board,board);assert.deepEqual(v.view.viewportIntent.value,pending);assert.deepEqual(v.view.camera,pending);
 action(other.el,'zoom-out').click();assert.notDeepEqual(other.view.camera,pending);assert.equal(v.doc.timers.size,1);assert.equal(other.doc.timers.size,1);
 f.owner.undo();await f.owner.flush();assert.equal(f.owner.board.brain.centerId,'b');assert.deepEqual(f.owner.board.brainViewport,saved);
 for(const view of f.views){assert.equal(view.view.viewportIntent,undefined);assert.equal(view.doc.timers.size,0);assert.deepEqual(view.view.camera,saved);view.view.flushPendingViewport();}
 await f.owner.flush();assert.equal(f.writes(),2);assert.deepEqual(JSON.parse(f.disk()).brainViewport,saved);
 f.owner.undo(true);await f.owner.flush();assert.equal(f.owner.board.brain.centerId,'a');assert.deepEqual(f.owner.board.brainViewport,saved);for(const view of f.views)assert.deepEqual(view.view.camera,saved);
});

test('pending camera flush before an undo repaint cannot overwrite the replacement Session board and hidden view reconciles on show',async()=>{
 const saved={x:0,y:0,zoom:1},f=sessionRendererFixture(saved),v=f.first;title(v,'a').click();await f.owner.flush();action(v.el,'zoom-in').click();
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
 title(v,'a').click();await f.owner.flush();stage.dispatch('pointerdown',{pointerId:4,clientX:30,clientY:30});stage.dispatch('pointermove',{pointerId:4,clientX:70,clientY:50});assert.notDeepEqual(v.view.camera,saved);assert.equal(captured,4);assert.equal(stage.classList.contains('is-panning'),true);
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
