import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
function take(source:string,start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const open=take(source,'  openSpaceHub(', '  refreshStyleClipboard(');
const launch=take(source,'  private openHub(', '  private bindLaunchFocus(');
const compiled=transformSync(`class Plugin {${open}} class Navigator {${launch}}`,{loader:'ts'}).code;
function fixture({short=false,scoped=true,openError}:{short?:boolean;scoped?:boolean;openError?:Error}={}){
 const listeners=new Set<(event:any)=>void>();let windowFocused=true,valid=true,stops=0;
 const doc:any={activeElement:null,hasFocus:()=>windowFocused,addEventListener:(type:string,fn:(event:any)=>void)=>{assert.equal(type,'focusin');listeners.add(fn);},removeEventListener:(_type:string,fn:(event:any)=>void)=>listeners.delete(fn),overlays:[],querySelectorAll:()=>doc.overlays};
 doc.defaultView={closed:false,getComputedStyle:(el:Element)=>({visibility:el.visibility})};
 class Element {
  isConnected=true;shown=true;disabled=false;visibility='visible';children:Element[]=[];focuses=0;ownerDocument=doc;
  constructor(parent?:Element){if(parent)parent.children.push(this);}
  contains(el:unknown):boolean{return this===el||this.children.some(child=>child.contains(el));}
  getClientRects(){return this.isConnected&&this.shown?[{width:44,height:44}]:[];}
  focus(options?:FocusOptions){if(!this.isConnected||!this.shown||this.disabled)return;assert.ok(!options||options.preventScroll===true);this.focuses++;doc.activeElement=this;for(const fn of [...listeners])fn({target:this});}
  detach(){this.isConnected=false;for(const child of this.children)child.detach();if(this.contains(doc.activeElement))doc.activeElement=doc.body;}
  querySelector(){return this.children[0];}
 }
 doc.body=new Element();doc.activeElement=doc.body;
 const root=new Element(doc.body),origin=new Element(root),more=new Element(root),outside=new Element(doc.body);
 origin.shown=!short;more.shown=short;
 let created:Modal|undefined;
 class Modal {
  saved:any;shouldRestoreSelection=true;hostRestores=0;containerEl=new Element();modalEl=new Element(this.containerEl);search=new Element(this.modalEl);
  constructor(public app:unknown,public host:any){this.modalEl.isConnected=false;created=this;}
  open(){this.saved=doc.activeElement;if(openError)throw openError;this.modalEl.isConnected=true;this.search.focus();}
  close(){this.containerEl.detach();this.host.closed();if(this.shouldRestoreSelection&&this.saved?.isConnected){this.hostRestores++;this.saved.focus();}}
 }
 const {Plugin,Navigator}=new Function('SpaceHubModal',compiled+';return {Plugin,Navigator};')(Modal);
 const plugin=new Plugin();plugin.app={};plugin.settings={hub:{},favoriteBoards:[]};plugin.journalRoot='Journal';plugin.convenienceOrigin=()=>({document:doc,current:()=>valid,watch:()=>()=>{},stop:()=>{valid=false;stops++;}});
 const nav=new Navigator();nav.plugin=plugin;nav.contentEl=root;nav.leaf={view:nav};nav.stopLaunchFocus=()=>{};
 origin.focus();let modal:any,openFailure:unknown;try{modal=scoped?nav.openHub(origin,more):plugin.openSpaceHub();}catch(error){if(!openError)throw error;openFailure=error;}modal??=created;
 return{doc,root,origin,more,outside,plugin,nav,modal,listeners,Element,openFailure,setValid:(value:boolean)=>valid=value,setWindowFocus:(value:boolean)=>windowFocused=value,stops:()=>stops};
}
test('wide close restores the exact retained origin once, before scope.stop',()=>{const f=fixture();f.modal.close();assert.equal(f.doc.activeElement,f.origin);assert.equal(f.origin.focuses,2);assert.equal(f.more.focuses,0);assert.equal(f.stops(),1);assert.equal(f.listeners.size,0);assert.equal(f.modal.hostRestores,0);f.modal.host.closed();assert.equal(f.origin.focuses,2);});
test('desktop-open then short-close uses exact retained More, not a same-label replacement',()=>{const f=fixture();f.origin.shown=false;f.more.shown=true;const replacement=new f.Element(f.root);f.modal.close();assert.equal(f.doc.activeElement,f.more);assert.equal(f.more.focuses,1);assert.equal(replacement.focuses,0);});
test('short More menu entry returns to the exact More control',()=>{const f=fixture();f.modal.close();f.origin.shown=false;f.more.shown=true;f.setValid(true);f.more.focus();const modal=f.nav.openHub(f.more,f.more);modal.close();assert.equal(f.doc.activeElement,f.more);assert.equal(f.more.focuses,2);});
for(const change of ['navigation','closed-window','background-window','replaced-modal','replaced-view','destroyed-dock','reopened-dock','moved-dock','removed-origin','removed-more','detached-root','owner-menu','foreign-modal','foreign-menu','modal-document','origin-document','fallback-document'])test('close does not steal focus after '+change,()=>{
 const f=fixture();f.origin.shown=false;f.more.shown=true;
 if(change==='navigation')f.setValid(false);
 if(change==='closed-window')f.doc.defaultView.closed=true;
 if(change==='background-window')f.setWindowFocus(false);
 if(change==='replaced-modal')f.plugin.spaceHub={};
 if(change==='replaced-view')f.nav.leaf.view={};
 if(change==='destroyed-dock')f.nav.stopLaunchFocus=undefined;
 if(change==='reopened-dock')f.nav.stopLaunchFocus=()=>{};
 if(change==='moved-dock')f.nav.contentEl=new f.Element();
 if(change==='removed-origin')f.root.children=f.root.children.filter(el=>el!==f.origin);
 if(change==='removed-more')f.root.children=f.root.children.filter(el=>el!==f.more);
 if(change==='detached-root')f.root.isConnected=false;
 if(change==='owner-menu')f.nav.createMenu={};
 if(change==='foreign-modal'||change==='foreign-menu')f.doc.overlays=[new f.Element()];
 if(change==='modal-document')f.modal.containerEl.ownerDocument={};
 if(change==='origin-document'){f.origin.ownerDocument={};f.more.ownerDocument={};}
 if(change==='fallback-document')f.more.ownerDocument={};
 f.modal.close();assert.equal(f.doc.activeElement,f.doc.body);assert.equal(f.more.focuses,0);assert.equal(f.listeners.size,0);assert.equal(f.modal.hostRestores,0);
});
test('explicit outside focus is permanently revoked even if it later becomes BODY',()=>{const f=fixture();f.outside.focus();f.doc.activeElement=f.doc.body;f.modal.close();assert.equal(f.doc.activeElement,f.doc.body);assert.equal(f.origin.focuses,1);assert.equal(f.listeners.size,0);});
test('closing preserves a current outside field and cannot invoke host restore',()=>{const f=fixture();f.outside.focus();f.modal.close();assert.equal(f.doc.activeElement,f.outside);assert.equal(f.origin.focuses,1);assert.equal(f.modal.hostRestores,0);});
for(const mode of ['hidden','disabled','visibility-hidden'])test('unusable fallback '+mode+' is not focused',()=>{const f=fixture();f.origin.shown=false;f.more.shown=true;if(mode==='hidden')f.more.shown=false;if(mode==='disabled')f.more.disabled=true;if(mode==='visibility-hidden')f.more.visibility='hidden';f.modal.close();assert.equal(f.doc.activeElement,f.doc.body);assert.equal(f.more.focuses,0);});
test('hidden old menu does not block an otherwise eligible return',()=>{const f=fixture();const menu=new f.Element();menu.shown=false;f.doc.overlays=[menu];f.modal.close();assert.equal(f.doc.activeElement,f.origin);});
test('ordinary command/non-Navigator Hub preserves default host restoration and no listener',()=>{const f=fixture({scoped:false});assert.equal(f.modal.shouldRestoreSelection,true);assert.equal(f.listeners.size,0);f.modal.close();assert.equal(f.modal.hostRestores,1);assert.equal(f.doc.activeElement,f.origin);});
test('reentering existing Hub does not replace its owner or add another listener',()=>{const f=fixture();const count=f.listeners.size;const other=new f.Element(f.root);assert.equal(f.nav.openHub(other,other),f.modal);assert.equal(f.listeners.size,count);f.modal.close();assert.equal(f.doc.activeElement,f.origin);assert.equal(other.focuses,0);});
test('SpaceHub host contracts and only Navigator callbacks opt in',()=>{
 assert.ok(source.includes("onClick(()=>run(()=>this.openHub(more,more)))"));
 assert.ok(source.includes("hub=button(entry,'空间总览','compass',()=>this.openHub(hub,more))"));
 assert.equal((source.match(/this\.openHub\(/g)||[]).length,2);
 assert.ok(open.includes('current:scope.current,watchCurrent:scope.watch'));
 assert.ok(open.indexOf('restore?.();scope.stop()')>0);
});

test('failed native open releases this launch listener and scope without attempting return focus',()=>{const error=new Error('controlled open failure'),f=fixture({openError:error});assert.equal(f.openFailure,error);assert.equal(f.listeners.size,0);assert.equal(f.stops(),1);assert.equal(f.plugin.spaceHub,undefined);assert.equal(f.origin.focuses,1);assert.equal(f.more.focuses,0);f.modal.host.closed();assert.equal(f.origin.focuses,1);});
