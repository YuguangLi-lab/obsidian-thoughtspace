import {themePluginMenu} from '../src/ui-tokens';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

class Scope {
 handlers:((event:any)=>unknown)[]=[];
 constructor(public parent?:Scope){}
 register(_modifiers:unknown,_key:unknown,callback:(event:any)=>unknown){this.handlers.push(callback);}
 handle(event:any):unknown{for(const callback of this.handlers){const result=callback(event);if(result!==undefined)return result;}return this.parent?.handle(event);}
}
class Menu {
 static last:Menu;static supported=true;static entries:{title:string;run:()=>void;disabled:boolean}[]=[];
 scope=new Scope();hidden=false;hideCount=0;hideCallback?:()=>void;events:string[]=[];
 constructor(){Menu.last=this;Menu.entries=[];this.scope.register([],null,event=>{this.events.push(event.key);if(event.key==='Escape')return this.hide();});if(!Menu.supported)Object.defineProperty(this,'scope',{value:this.scope,writable:false});}
 addItem(config:(item:any)=>void){const entry={title:'',run:()=>{},disabled:false};const item={setTitle:(title:string)=>{entry.title=title;return item;},setIcon:()=>item,setDisabled:(disabled:boolean)=>{entry.disabled=disabled;return item;},onClick:(run:()=>void)=>{entry.run=run;return item;}};config(item);Menu.entries.push(entry);return this;}
 addSeparator(){return this;}
 onHide(callback:()=>void){this.hideCallback=callback;}
 hide(){if(this.hidden)return this;this.hidden=true;this.hideCount++;this.hideCallback?.();return this;}
 showAtPosition(){}
}
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),start=source.indexOf('  private branchDisclosureMenu('),end=source.indexOf('\n  selectBranch()',start);assert.ok(start>=0&&end>start);
const errors:unknown[]=[];
const BoardView=new Function('themePluginMenu','Menu','Scope','act','childConnectionCandidates',transformSync('class BoardView{'+source.slice(start,end)+'}\nreturn BoardView;',{loader:'ts'}).code)(themePluginMenu,Menu,Scope,(action:()=>void)=>{try{action();}catch(error){errors.push(error);}},()=>new Map());
function fixture(){
 Menu.supported=true;errors.length=0;
 const doc:any={hasFocus:()=>true,defaultView:{closed:false},activeElement:null};
 const anchor:any={isConnected:true,hidden:false,disabled:false,ownerDocument:doc,getClientRects:()=>[{}],getBoundingClientRect:()=>({left:20,bottom:40}),focus(){throw Error('No focus stealing is allowed');}};
 const card={isConnected:true},root:any={ownerDocument:doc,contains:(value:unknown)=>value===anchor},node={id:'original'},file={path:'synthetic.md'},owner:any={file,board:{nodes:[node]},blocked:false};
 const view=new BoardView();Object.assign(view,{closed:false,closing:false,file,session:owner,dialogEpoch:1,contentEl:root,positions:new Map([['original',card]]),leaf:{view},requireOwner:(candidate=owner)=>{if(candidate!==view.session)throw Error('stale owner');return candidate;},foldBranches:(...args:unknown[])=>calls.push(args)});view.app={workspace:{getActiveViewOfType:()=>view}};const calls:unknown[][]=[];
 doc.activeElement=anchor;view.branchDisclosureMenu('original',anchor);const menu=Menu.last;
 const event=(extra:any={})=>({key:'Escape',target:anchor,defaultPrevented:false,isComposing:false,keyCode:27,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra});
 const dispatch=(e:any)=>{const result=menu.scope.handle(e);if(result===false){e.preventDefault();e.stopped=true;}if(!e.stopped&&!e.defaultPrevented&&e.key==='Escape'&&doc.activeElement===anchor)doc.activeElement=stage;return result;};const stage={};
 return{view,doc,anchor,card,root,node,file,owner,menu,event,dispatch,stage,calls};
}
test('one Escape hides the original menu without reaching the toolbar stage escape',()=>{const f=fixture(),e=f.event();assert.equal(f.dispatch(e),false);assert.equal(f.menu.hideCount,1);assert.equal(e.defaultPrevented,true);assert.equal(e.stopped,true);assert.equal(f.doc.activeElement,f.anchor);assert.equal(f.view.objectMenu,undefined);assert.deepEqual(f.menu.events,[]);assert.equal(f.calls.length,0);});
test('host-like original scope demonstrates the prior double-Escape effect',()=>{const f=fixture();f.menu.scope=f.menu.scope.parent!;const e=f.event();assert.equal(f.dispatch(e),f.menu);assert.equal(f.doc.activeElement,f.stage);assert.equal(e.defaultPrevented,false);});
test('all non-Escape keys delegate to the same inherited menu scope',()=>{for(const key of ['ArrowDown','ArrowUp','Enter',' ','Tab']){const f=fixture(),e=f.event({key});assert.equal(f.dispatch(e),undefined);assert.deepEqual(f.menu.events,[key]);assert.equal(f.menu.hidden,false);assert.equal(e.defaultPrevented,false);assert.equal(f.doc.activeElement,f.anchor);}});
for(const [name,change] of [
 ['owner changed',(f:any)=>f.view.session={}],['file changed',(f:any)=>f.view.file={}],['navigation epoch changed',(f:any)=>f.view.dialogEpoch++],['view closed',(f:any)=>f.view.closed=true],['view closing',(f:any)=>f.view.closing=true],['leaf replaced',(f:any)=>f.view.leaf.view={}],['another active view',(f:any)=>f.view.app.workspace.getActiveViewOfType=()=>({})],['new menu owner',(f:any)=>f.view.objectMenu={}],['content root replaced',(f:any)=>f.view.contentEl={}],['card replaced',(f:any)=>f.view.positions.set('original',{})],['node removed',(f:any)=>f.owner.board.nodes=[]],['anchor disconnected',(f:any)=>f.anchor.isConnected=false],['anchor hidden',(f:any)=>f.anchor.hidden=true],['anchor disabled',(f:any)=>f.anchor.disabled=true],['anchor has no rect',(f:any)=>f.anchor.getClientRects=()=>[]],['anchor adopted',(f:any)=>f.anchor.ownerDocument={}],['document unfocused',(f:any)=>f.doc.hasFocus=()=>false],['window closed',(f:any)=>f.doc.defaultView.closed=true],['other focused control',(f:any)=>f.doc.activeElement={}]
] as const)test('stale/unowned cancellation delegates without stealing focus: '+name,()=>{const f=fixture();change(f);const active=f.doc.activeElement,e=f.event();assert.equal(f.menu.scope.handle(e),f.menu);assert.equal(e.defaultPrevented,false);assert.equal(e.stopped,false);assert.equal(f.doc.activeElement,active);assert.deepEqual(f.menu.events,['Escape']);});
for(const extra of [{defaultPrevented:true},{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{target:{ownerDocument:{}}}])test('unowned Escape variant keeps inherited handling '+JSON.stringify(extra),()=>{const f=fixture(),e=f.event(extra);f.menu.scope.handle(e);assert.deepEqual(f.menu.events,['Escape']);assert.equal(e.stopped,false);assert.equal(f.doc.activeElement,f.anchor);});
test('relayed key for the same document retains the original anchor',()=>{const f=fixture(),e=f.event({target:f.doc});assert.equal(f.dispatch(e),false);assert.equal(f.doc.activeElement,f.anchor);});
test('pointer or programmatic hide never changes the active element',()=>{const f=fixture(),outside={};f.doc.activeElement=outside;f.menu.hide();assert.equal(f.doc.activeElement,outside);assert.equal(f.view.objectMenu,undefined);});
test('new menu replaces the old menu and old hide never clears its owner',()=>{const f=fixture();f.view.branchDisclosureMenu('original',f.anchor);const next=Menu.last;assert.equal(f.menu.hidden,true);assert.equal(f.view.objectMenu,next);f.menu.hideCallback?.();assert.equal(f.view.objectMenu,next);});
test('branch actions keep original labels, modes and source-owner validation',()=>{const f=fixture();assert.deepEqual(Menu.entries.map(e=>e.title),['折叠连线子节点','展开下一层','展开全部子节点']);Menu.entries[1].run();assert.equal(f.calls.length,1);assert.deepEqual([...(f.calls[0][0] as Set<string>)],['original']);assert.deepEqual(f.calls[0].slice(1),[false,'level',false]);f.view.session={};Menu.entries[0].run();assert.equal(f.calls.length,1);assert.equal(errors.length,1);});
test('unsupported non-writable host scope is left intact',()=>{const f=fixture();Menu.supported=false;f.view.branchDisclosureMenu('original',f.anchor);const menu=Menu.last;assert.equal(menu.scope.parent,undefined);assert.equal(Object.getOwnPropertyDescriptor(menu,'scope')?.writable,false);Menu.supported=true;});
