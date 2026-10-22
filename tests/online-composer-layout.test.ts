import test from 'node:test';
import assert from 'node:assert/strict';
import {bindOnlineComposerLayout} from '../src/online-composer-layout';

function fixture(width=316,height=562){
 let ready=true,composing=false,id=0,disconnected=false;const frames=new Map<number,()=>void>(),events=new Map<string,()=>void>();
 const win:any={requestAnimationFrame:(fn:()=>void)=>{frames.set(++id,fn);return id;},cancelAnimationFrame:(key:number)=>frames.delete(key),addEventListener:(type:string,fn:()=>void)=>events.set(type,fn),removeEventListener:(type:string)=>events.delete(type),ResizeObserver:class{observe(){}disconnect(){disconnected=true;}}};
 const doc:any={defaultView:win,activeElement:null};
 class El{
  children:El[]=[];parentElement:El|null=null;ownerDocument=doc;isConnected=true;dataset:Record<string,string>={};hidden=false;open=false;scrollTop=0;scrollLeft=0;value='原文\n中文 עברית';selectionStart=2;selectionEnd=6;detaches=0;focuses=0;listeners=new Map<string,(event?:any)=>void>();
  constructor(public name:string){}
  get firstChild(){return this.children[0]??null;}
  contains(node:unknown):boolean{return node===this||this.children.some(e=>e.contains(node));}
  detach(){if(!this.parentElement)return;this.detaches++;if(this.contains(doc.activeElement))doc.activeElement=doc.body;this.parentElement.children.splice(this.parentElement.children.indexOf(this),1);this.parentElement=null;}
  append(node:El){node.detach();this.children.push(node);node.parentElement=this;}
  insertBefore(node:El,before:El|null){if(node===before)return;node.detach();const i=before?this.children.indexOf(before):this.children.length;assert.ok(i>=0);this.children.splice(i,0,node);node.parentElement=this;}
  querySelectorAll(){return[manual];}
  getBoundingClientRect(){return{width,height};}
  getClientRects(){for(let e:El|null=this;e;e=e.parentElement){if(e.hidden)return[];if(e.name==='panel'&&!details.open)return[];}return[{}];}
  focus(){doc.activeElement=this;this.focuses++;}
  addEventListener(type:string,fn:(event?:any)=>void){this.listeners.set(type,fn);}
  removeEventListener(type:string){this.listeners.delete(type);}
  fire(type:string,event?:any){this.listeners.get(type)?.(event);}
 }
 win.Node=El;
 const root=new El('root'),composer=new El('composer'),details=new El('details'),summary=new El('summary'),panel=new El('panel'),heading=new El('heading'),time=new El('time'),input=new El('input'),actions=new El('actions'),hint=new El('hint'),positions=new El('positions'),switcher=new El('switcher'),manual=new El('manual');
 doc.body=new El('body');doc.activeElement=doc.body;root.dataset.panel='compose';root.append(positions);root.append(switcher);root.append(composer);composer.append(details);details.append(summary);details.append(panel);panel.append(heading);heading.append(time);panel.append(manual);composer.append(input);composer.append(actions);actions.append(hint);details.open=true;
 const controller=bindOnlineComposerLayout({root,composer,details,summary,panel,heading,time,input,actions,hint,positions,switcher,ready:()=>ready,composing:()=>composing} as any);
 const flush=()=>{for(const fn of [...frames.values()])fn();frames.clear();};
 return{root,composer,details,summary,panel,heading,time,input,actions,hint,positions,switcher,manual,doc,controller,frames,events,disconnected:()=>disconnected,ready(v:boolean){ready=v;controller.refresh();},compose(v:boolean){composing=v;controller.refresh();},resize(w:number,h:number){width=w;height=h;events.get('resize')?.();flush();},flush};
}
test('actual short compose pane puts the untouched textarea and actions before collapsed metadata',()=>{const f=fixture();assert.equal(f.root.dataset.onlineShort,'true');assert.deepEqual(f.composer.children,[f.input,f.actions,f.details]);assert.equal(f.details.open,false);assert.equal(f.time.parentElement,f.summary);assert.equal(f.positions.parentElement,f.panel);assert.equal(f.input.detaches,0);assert.equal(f.input.focuses,0);f.controller.dispose();});
test('normal size restores original control order and placement without moving the textarea',()=>{const f=fixture();f.resize(1000,700);assert.deepEqual(f.composer.children,[f.details,f.input,f.actions]);assert.equal(f.details.open,true);assert.equal(f.summary.hidden,true);assert.equal(f.positions.parentElement,f.root);assert.equal(f.root.children[0],f.positions);assert.equal(f.hint.parentElement,f.actions);assert.equal(f.time.parentElement,f.heading);assert.equal(f.input.detaches,0);f.controller.dispose();});
test('time setup is visible first until explicit confirmation reveals editing',()=>{const f=fixture();f.ready(false);assert.equal(f.composer.children[0],f.details);assert.equal(f.details.open,true);f.manual.focus();f.ready(true);assert.equal(f.details.open,true);assert.equal(f.doc.activeElement,f.manual);f.controller.revealComposer();assert.equal(f.details.open,false);assert.equal(f.composer.children[0],f.input);assert.equal(f.input.focuses,0);f.controller.dispose();});
test('positions remain accessible on the player and timeline panels',()=>{const f=fixture();for(const panel of ['player','timeline']){f.root.dataset.panel=panel;f.controller.refresh();assert.equal(f.positions.parentElement,f.root);assert.equal(f.root.children[0],f.positions);}f.root.dataset.panel='compose';f.controller.refresh();assert.equal(f.positions.parentElement,f.panel);assert.equal(f.input.detaches,0);f.controller.dispose();});
test('resize retains exact active textarea, text, selection and scroll without focus calls',()=>{const f=fixture(1000,700);f.input.focus();f.input.scrollTop=32;const value=f.input.value;f.resize(316,302);f.resize(1000,700);assert.equal(f.doc.activeElement,f.input);assert.equal(f.input.value,value);assert.equal(f.input.selectionStart,2);assert.equal(f.input.selectionEnd,6);assert.equal(f.input.scrollTop,32);assert.equal(f.input.detaches,0);assert.equal(f.input.focuses,1);f.controller.dispose();});
test('current editor focus overrides a previously open metadata panel when becoming short',()=>{const f=fixture();f.details.open=true;f.details.fire('toggle');f.resize(1000,700);f.input.focus();f.resize(316,302);assert.equal(f.details.open,false);assert.equal(f.doc.activeElement,f.input);f.controller.dispose();});
test('an owned metadata input keeps focus and remains revealed across threshold changes',()=>{const f=fixture(1000,700);f.manual.focus();f.panel.scrollTop=40;f.resize(316,302);assert.equal(f.details.open,true);assert.equal(f.doc.activeElement,f.manual);assert.equal(f.panel.scrollTop,40);assert.equal(f.manual.selectionStart,2);f.controller.dispose();});
test('textarea composition defers metadata moves until its native composition end refresh',()=>{const f=fixture(1000,700);f.input.focus();f.compose(true);f.resize(316,302);assert.equal(f.root.dataset.onlineShort,'false');assert.equal(f.input.detaches,0);f.compose(false);assert.equal(f.root.dataset.onlineShort,'true');assert.equal(f.doc.activeElement,f.input);f.controller.dispose();});
test('manual time composition also defers metadata moves and resumes after compositionend',()=>{const f=fixture(1000,700);f.manual.focus();f.panel.fire('compositionstart',{target:f.manual});f.resize(316,302);assert.equal(f.root.dataset.onlineShort,'false');f.panel.fire('compositionend');f.flush();assert.equal(f.root.dataset.onlineShort,'true');assert.equal(f.doc.activeElement,f.manual);f.controller.dispose();});
test('owner adoption and disposal stop later toggle/resize/reveal writes',()=>{const f=fixture();f.details.open=true;f.details.fire('toggle');f.root.ownerDocument={} as any;f.controller.revealComposer();assert.equal(f.details.open,true);f.resize(1000,700);assert.equal(f.root.dataset.onlineShort,'true');f.controller.dispose();f.root.ownerDocument=f.doc;f.resize(1000,700);assert.equal(f.root.dataset.onlineShort,'true');assert.equal(f.disconnected(),true);assert.equal(f.frames.size,0);assert.equal(f.panel.listeners.size,0);});
test('same-size refresh keeps deliberate disclosure state and does not reorder active controls',()=>{const f=fixture();f.details.open=true;f.details.fire('toggle');f.manual.focus();const moves=f.details.detaches;f.controller.refresh();f.resize(315,561);assert.equal(f.details.open,true);assert.equal(f.details.detaches,moves);assert.equal(f.doc.activeElement,f.manual);f.controller.dispose();});

test('summary focus transfers to the visible editor when the normal layout hides summary',()=>{const f=fixture();f.summary.focus();f.resize(1000,700);assert.equal(f.summary.hidden,true);assert.equal(f.doc.activeElement,f.input);assert.equal(f.input.getClientRects().length,1);f.controller.dispose();});
test('unconfirmed summary focus transfers to visible manual metadata instead of the read-only editor',()=>{const f=fixture();f.ready(false);f.summary.focus();f.resize(1000,700);assert.equal(f.summary.hidden,true);assert.equal(f.doc.activeElement,f.manual);assert.equal(f.manual.getClientRects().length,1);assert.equal(f.input.focuses,0);f.controller.dispose();});

// A portrait phone must not spend its extra height on metadata at the expense
// of the same native draft editor. Crossing the width boundary never recreates it.
test('narrow portrait panes keep confirmed editing first across height and width changes',()=>{
 const f=fixture(346,752);f.input.focus();f.input.scrollTop=71;const value=f.input.value;
 assert.equal(f.root.dataset.onlineShort,'true');assert.equal(f.details.open,false);assert.deepEqual(f.composer.children,[f.input,f.actions,f.details]);
 f.resize(386,920);assert.equal(f.root.dataset.onlineShort,'true');assert.equal(f.details.open,false);
 f.resize(600,920);assert.equal(f.root.dataset.onlineShort,'false');assert.deepEqual(f.composer.children,[f.details,f.input,f.actions]);
 f.resize(346,752);assert.equal(f.doc.activeElement,f.input);assert.equal(f.input.value,value);assert.equal(f.input.selectionStart,2);assert.equal(f.input.selectionEnd,6);assert.equal(f.input.scrollTop,71);assert.equal(f.input.detaches,0);assert.equal(f.input.focuses,1);f.controller.dispose();
});
test('portrait time confirmation and deliberate metadata disclosure remain accessible',()=>{
 const f=fixture(346,752);f.ready(false);assert.equal(f.details.open,true);assert.equal(f.composer.children[0],f.details);
 f.manual.focus();f.ready(true);assert.equal(f.details.open,true);assert.equal(f.doc.activeElement,f.manual);
 f.controller.revealComposer();assert.equal(f.details.open,false);assert.equal(f.composer.children[0],f.input);
 f.details.open=true;f.details.fire('toggle');f.resize(386,920);assert.equal(f.details.open,true);assert.equal(f.positions.parentElement,f.panel);assert.equal(f.input.detaches,0);f.controller.dispose();
});
