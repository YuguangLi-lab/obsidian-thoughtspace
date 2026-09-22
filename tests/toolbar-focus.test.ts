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
 const {host,doc,old,calls}=fixture(),restore=preserveToolbarFocus(host);old.isConnected=false;doc.activeElement={};restore();assert.equal(calls.length,0);
});
test('unchanged controls, removed toolbars and disabled replacements are not focused',()=>{
 for(const condition of ['unchanged','removed','disabled']){const {host,doc,old,next,calls}=fixture(),restore=preserveToolbarFocus(host);old.isConnected=condition==='unchanged';host.isConnected=condition!=='removed';next.matches=()=>condition==='disabled';doc.activeElement=doc.body;restore();assert.equal(calls.length,0,condition);}
});
test('a different label or control type cannot inherit stale toolbar focus',()=>{
 for(const condition of ['label','type']){const {host,doc,old,next,calls}=fixture(),restore=preserveToolbarFocus(host);old.isConnected=false;doc.activeElement=doc.body;if(condition==='label')next.getAttribute=(key:string)=>key==='aria-label'?'颜色':null;else next.tagName='INPUT';restore();assert.equal(calls.length,0);}
});
