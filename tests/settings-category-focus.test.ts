import test from 'node:test';
import assert from 'node:assert/strict';
import {bindSettingsCategoryFocus} from '../src/settings-category-focus';
function fixture(){
 const listeners=new Map<string,(e:{target:unknown})=>void>();let resized=()=>{},disconnected=false;
 class Element {isConnected=true;shown=true;focuses=0;reveals=0;constructor(public category=true){}matches(){return this.category;}getClientRects(){return this.shown?[{}]:[];}focus(){this.focuses++;doc.activeElement=this;listeners.get('focusin')?.({target:this});}scrollIntoView(){this.reveals++;}}
 const body=new Element(false),doc={body,activeElement:body,addEventListener:(name:string,fn:unknown)=>listeners.set(name,fn as never),removeEventListener:(name:string)=>listeners.delete(name)};
 const picker=new Element(),button=new Element(),search=new Element(false),outside=new Element(false);picker.shown=false;
 const root={ownerDocument:doc,isConnected:true,contains:(e:unknown)=>[picker,button,search].includes(e as Element)};
 const old=globalThis.ResizeObserver;globalThis.ResizeObserver=class {constructor(callback:()=>void){resized=callback;}observe(){}disconnect(){disconnected=true;}} as never;
 const dispose=bindSettingsCategoryFocus(root as never,picker as never,()=>button as never);globalThis.ResizeObserver=old;
 return{picker,button,search,outside,doc,listeners,resize:()=>resized(),dispose,disconnected:()=>disconnected};
}
test('focused wide category migrates once to the visible compact peer, then back to current button',()=>{const f=fixture();f.button.focus();f.button.shown=false;f.picker.shown=true;f.doc.activeElement=f.doc.body;f.resize();assert.equal(f.doc.activeElement,f.picker);assert.equal(f.picker.focuses,1);f.resize();assert.equal(f.picker.focuses,1);f.picker.shown=false;f.button.shown=true;f.doc.activeElement=f.doc.body;f.resize();assert.equal(f.doc.activeElement,f.button);assert.equal(f.button.reveals,1);f.dispose();});
test('resize cannot steal search or outside focus',()=>{for(const target of ['search','outside'] as const){const f=fixture();f.button.focus();f[target].focus();f.button.shown=false;f.picker.shown=true;f.resize();assert.equal(f.doc.activeElement,f[target]);assert.equal(f.picker.focuses,0);f.dispose();}});
test('intentional blur while category remains visible invalidates restoration',()=>{const f=fixture();f.button.focus();f.listeners.get('focusout')?.({target:f.button});f.doc.activeElement=f.doc.body;f.button.shown=false;f.picker.shown=true;f.resize();assert.equal(f.doc.activeElement,f.doc.body);assert.equal(f.picker.focuses,0);f.dispose();});
test('hidden peer focusout is retained only for the immediate responsive transition',async()=>{const f=fixture();f.button.focus();f.button.shown=false;f.picker.shown=true;f.doc.activeElement=f.doc.body;f.listeners.get('focusout')?.({target:f.button});await Promise.resolve();assert.equal(f.doc.activeElement,f.picker);f.dispose();});
test('dispose removes listeners and prevents both queued and observer restoration',async()=>{const f=fixture();f.button.focus();f.button.shown=false;f.picker.shown=true;f.doc.activeElement=f.doc.body;f.listeners.get('focusout')?.({target:f.button});f.dispose();await Promise.resolve();f.resize();assert.equal(f.doc.activeElement,f.doc.body);assert.equal(f.picker.focuses,0);assert.equal(f.listeners.size,0);assert.equal(f.disconnected(),true);});
