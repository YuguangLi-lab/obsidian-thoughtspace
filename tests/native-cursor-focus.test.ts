import test from 'node:test';
import assert from 'node:assert/strict';
import {protectNativeCursorAssociation} from '../src/native-cursor-focus';
function fixture(inherited=true){
 const document={activeElement:null as unknown},content={ownerDocument:document,isConnected:true,getRootNode:()=>document},button={name:'mode'},calls:unknown[][]=[];
 const original=function(this:unknown,...args:unknown[]){calls.push([this,...args]);content.ownerDocument.activeElement=content;return 'association-measured';};
 const prototype={enforceCursorAssoc:original},docView=inherited?Object.create(prototype):Object.defineProperty({},'enforceCursorAssoc',{value:original,writable:false,configurable:true,enumerable:true});
 const view={contentDOM:content,root:document,hasFocus:true,docView};docView.view=view;document.activeElement=content;
 const install=()=>protectNativeCursorAssociation(view as unknown as Parameters<typeof protectNativeCursorAssociation>[0]);
 return{document,content,button,calls,original,prototype,docView,view,install};
}
test('late association measurement cannot reclaim focus from mode/menu/another input',()=>{const f=fixture(),restore=f.install();for(const other of [f.button,{name:'menu'},{name:'another draft'},null]){f.document.activeElement=other;f.view.hasFocus=false;assert.equal(f.docView.enforceCursorAssoc(),undefined);assert.equal(f.document.activeElement,other);}assert.equal(f.calls.length,0);restore();});
test('focused editing and intentional toolbar return preserve exact original this/arguments/result',()=>{const f=fixture(),restore=f.install();f.document.activeElement=f.button;f.view.hasFocus=false;f.docView.enforceCursorAssoc();f.document.activeElement=f.content;f.view.hasFocus=true;assert.equal(f.docView.enforceCursorAssoc('selection measurement'), 'association-measured');assert.deepEqual(f.calls,[[f.docView,'selection measurement']]);restore();});
test('actual document focus is required even when the body remains active',()=>{const f=fixture(),restore=f.install();f.view.hasFocus=false;f.docView.enforceCursorAssoc();assert.equal(f.calls.length,0);assert.equal(f.document.activeElement,f.content);restore();});
test('two embedded editors and their documents retain independent focus ownership',()=>{const a=fixture(),b=fixture(),ra=a.install(),rb=b.install();a.document.activeElement=a.button;a.view.hasFocus=false;b.docView.enforceCursorAssoc();a.docView.enforceCursorAssoc();assert.equal(a.calls.length,0);assert.equal(b.calls.length,1);assert.equal(a.document.activeElement,a.button);ra();assert.equal(b.docView.enforceCursorAssoc(),'association-measured');rb();});
test('detached, moved or replaced editor bodies cannot receive stale measurement',()=>{for(const variant of ['detached','document','content','docView','receiver']){const f=fixture(),restore=f.install(),guard=f.docView.enforceCursorAssoc;if(variant==='detached')f.content.isConnected=false;if(variant==='document')f.content.ownerDocument={activeElement:null};if(variant==='content')f.view.contentDOM={...f.content};if(variant==='docView')f.view.docView={};Reflect.apply(guard,variant==='receiver'?{}:f.docView,[]);assert.equal(f.calls.length,0,variant);restore();}});
test('cleanup removes only this own wrapper and retains the inherited prototype method',()=>{const f=fixture(),restore=f.install(),guard=f.docView.enforceCursorAssoc;assert.equal(Object.hasOwn(f.docView,'enforceCursorAssoc'),true);assert.equal(f.prototype.enforceCursorAssoc,f.original);restore();restore();assert.equal(Object.hasOwn(f.docView,'enforceCursorAssoc'),false);assert.equal(f.docView.enforceCursorAssoc,f.original);guard.call(f.docView);assert.equal(f.calls.length,0);});
test('cleanup restores the exact prior own descriptor',()=>{const f=fixture(false),before=Object.getOwnPropertyDescriptor(f.docView,'enforceCursorAssoc'),restore=f.install();restore();assert.deepEqual(Object.getOwnPropertyDescriptor(f.docView,'enforceCursorAssoc'),before);});
test('a later adapter replacement is not overwritten during disposal',()=>{const f=fixture(),restore=f.install(),later=()=>42;f.docView.enforceCursorAssoc=later;restore();assert.equal(f.docView.enforceCursorAssoc,later);});
test('nonwritable or unknown boundaries fail before altering native methods',()=>{const f=fixture();Object.defineProperty(f.docView,'enforceCursorAssoc',{value:f.original,configurable:false});assert.throws(f.install,/not independently owned/);assert.equal(f.docView.enforceCursorAssoc,f.original);const missing=fixture();delete missing.docView.view;assert.throws(missing.install,/unavailable/);assert.equal(Object.hasOwn(missing.docView,'enforceCursorAssoc'),false);});
test('native exceptions are preserved when the editing body owns focus',()=>{const f=fixture();const error=Error('native geometry failure');f.docView.enforceCursorAssoc=()=>{throw error;};const restore=f.install();assert.throws(()=>f.docView.enforceCursorAssoc(),e=>e===error);restore();});

function adoptedFixture(){
 const f=fixture(),restore=f.install(),target={activeElement:null as unknown};
 const adopt=()=>{f.content.ownerDocument=target;f.content.getRootNode=()=>target;target.activeElement=f.content;};
 return{...f,target,restore,adopt};
}
test('adopted content rejects the old CM root until setRoot matches its current document',()=>{
 const f=adoptedFixture();f.adopt();assert.equal(f.docView.enforceCursorAssoc('before setRoot'),undefined);assert.equal(f.calls.length,0);
 f.view.root=f.target;assert.equal(f.docView.enforceCursorAssoc('after setRoot'),'association-measured');assert.deepEqual(f.calls,[[f.docView,'after setRoot']]);f.restore();
});
test('adopted content still requires exact active body and public focus in its current window',()=>{
 const f=adoptedFixture();f.adopt();f.view.root=f.target;f.target.activeElement=f.button;f.docView.enforceCursorAssoc();assert.equal(f.calls.length,0);
 f.target.activeElement=f.content;f.view.hasFocus=false;f.docView.enforceCursorAssoc();assert.equal(f.calls.length,0);
 f.view.hasFocus=true;f.docView.enforceCursorAssoc();assert.equal(f.calls.length,1);f.target.activeElement=f.button;f.view.hasFocus=false;f.docView.enforceCursorAssoc();assert.equal(f.calls.length,1);f.restore();
});
test('root migration requires the actual getRootNode result, not merely an active element match',()=>{
 const f=adoptedFixture();f.adopt();f.view.root=f.target;f.content.getRootNode=()=>f.document;f.docView.enforceCursorAssoc();assert.equal(f.calls.length,0);f.restore();
});
test('shadow roots require both exact current root and its current owner document',()=>{
 const f=fixture(),shadow={activeElement:f.content,ownerDocument:f.document},restore=f.install();
 f.content.getRootNode=()=>shadow;f.view.root=shadow;assert.equal(f.docView.enforceCursorAssoc(),'association-measured');
 shadow.ownerDocument={activeElement:null};assert.equal(f.docView.enforceCursorAssoc(),undefined);assert.equal(f.calls.length,1);restore();
});
test('closed migrated editor cannot use a retained wrapper even when native focus remains stale',()=>{
 const f=adoptedFixture();f.adopt();f.view.root=f.target;const guard=f.docView.enforceCursorAssoc;f.restore();guard.call(f.docView,'late close');assert.equal(f.calls.length,0);assert.equal(f.docView.enforceCursorAssoc,f.original);
});
test('migrated focused native exception and receiver/argument identity remain exact',()=>{
 const f=fixture(),error=Error('migrated native geometry'),args=[{position:3},null];
 f.docView.enforceCursorAssoc=function(this:unknown,...received:unknown[]){assert.equal(this,f.docView);assert.deepEqual(received,args);throw error;};
 const restore=f.install(),target={activeElement:f.content};f.content.ownerDocument=target;f.content.getRootNode=()=>target;f.view.root=target;
 assert.throws(()=>f.docView.enforceCursorAssoc(...args),e=>e===error);restore();
});
