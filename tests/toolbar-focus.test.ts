import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preserveToolbarFocus} from '../src/toolbar-focus';
function fixture(){
 const body={},doc:any={body},old:any={tagName:'SELECT',isConnected:true,getAttribute:(key:string)=>key==='aria-label'?'字号':null},calls:unknown[]=[];
 const next:any={tagName:'SELECT',getAttribute:old.getAttribute,matches:()=>false,focus:(options:unknown)=>{calls.push(options);doc.activeElement=next;}};
 const host:any={ownerDocument:doc,isConnected:true,scrollLeft:75,contains:(e:unknown)=>e===old,querySelectorAll:()=>[next]};doc.activeElement=old;
 return{host,doc,old,next,calls};
}
test('toolbar replacement restores matching control and horizontal scroll',()=>{
 const {host,doc,old,next,calls}=fixture(),restore=preserveToolbarFocus(host);old.isConnected=false;doc.activeElement=doc.body;host.scrollLeft=0;restore();assert.equal(doc.activeElement,next);assert.deepEqual(calls,[{preventScroll:true}]);assert.equal(host.scrollLeft,75);
});
test('toolbar refresh never steals focus deliberately moved outside it',()=>{
 const {host,doc,old,calls}=fixture(),restore=preserveToolbarFocus(host),outside={};old.isConnected=false;doc.activeElement=outside;host.scrollLeft=0;restore();
 assert.equal(calls.length,0);assert.equal(doc.activeElement,outside);assert.equal(host.scrollLeft,75);
});
test('formatting refresh preserves horizontal scroll while the editor keeps focus',()=>{
 const {host,doc,old,calls}=fixture(),editor={};doc.activeElement=editor;
 const restore=preserveToolbarFocus(host);old.isConnected=false;host.scrollLeft=0;restore();
 assert.equal(host.scrollLeft,75);assert.equal(doc.activeElement,editor);assert.equal(calls.length,0);
});
test('formatting refresh preserves the wrapping command bar scroll with canvas focus',()=>{
 const {host,doc,calls}=fixture(),canvas={};doc.activeElement=canvas;host.scrollLeft=0;
 const commandbar={isConnected:true,scrollLeft:160,parentElement:null,matches:(selector:string)=>selector==='.ts-commandbar',contains:(element:unknown)=>element===host};host.parentElement=commandbar;
 const restore=preserveToolbarFocus(host);commandbar.scrollLeft=0;restore();
 assert.equal(commandbar.scrollLeft,160);assert.equal(host.scrollLeft,0);assert.equal(doc.activeElement,canvas);assert.equal(calls.length,0);
});
test('toolbar refresh preserves only the nearest horizontal scrolling ancestor',()=>{
 const {host,doc,old,next}=fixture();
 const outer={isConnected:true,scrollLeft:220,parentElement:doc.body,matches:()=>false,contains:()=>true,scrollWidth:900,clientWidth:400};
 const inner={isConnected:true,scrollLeft:90,parentElement:outer,matches:()=>false,contains:(element:unknown)=>element===host,scrollWidth:600,clientWidth:300};
 host.parentElement=inner;doc.defaultView={getComputedStyle:()=>({overflowX:'auto'})};
 const restore=preserveToolbarFocus(host);old.isConnected=false;doc.activeElement=doc.body;inner.scrollLeft=0;outer.scrollLeft=15;restore();
 assert.equal(inner.scrollLeft,90);assert.equal(outer.scrollLeft,15);assert.equal(doc.activeElement,next);
});
test('unchanged controls, removed toolbars and disabled replacements are not focused',()=>{
 for(const condition of ['unchanged','removed','disabled']){const {host,doc,old,next,calls}=fixture(),restore=preserveToolbarFocus(host);old.isConnected=condition==='unchanged';host.isConnected=condition!=='removed';next.matches=()=>condition==='disabled';doc.activeElement=condition==='unchanged'?old:doc.body;host.scrollLeft=0;restore();assert.equal(calls.length,0,condition);assert.equal(doc.activeElement,condition==='unchanged'?old:doc.body,condition);assert.equal(host.scrollLeft,condition==='removed'?0:75,condition);}
});
test('removed or moved toolbar cannot change its former command bar scroll',()=>{
 for(const condition of ['removed','moved','detached-parent']){
  const {host,doc,calls}=fixture();doc.activeElement=doc.body;
  const commandbar={isConnected:true,scrollLeft:140,parentElement:null,matches:()=>true,contains:(element:unknown)=>element===host&&host.parentElement===commandbar};host.parentElement=commandbar;
  const restore=preserveToolbarFocus(host);commandbar.scrollLeft=0;
  if(condition==='removed')host.isConnected=false;else if(condition==='moved')host.parentElement=null;else commandbar.isConnected=false;
  restore();assert.equal(commandbar.scrollLeft,0,condition);assert.equal(calls.length,0,condition);
 }
});
test('a different label or control type cannot inherit stale toolbar focus',()=>{
 for(const condition of ['label','type']){const {host,doc,old,next,calls}=fixture(),restore=preserveToolbarFocus(host);old.isConnected=false;doc.activeElement=doc.body;if(condition==='label')next.getAttribute=(key:string)=>key==='aria-label'?'颜色':null;else next.tagName='INPUT';restore();assert.equal(calls.length,0);}
});
