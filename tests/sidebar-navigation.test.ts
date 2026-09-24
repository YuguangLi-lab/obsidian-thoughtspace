import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sidebarSearchNavigation} from '../src/sidebar-navigation';
import {toolbarNavigation} from '../src/toolbar-navigation';
import {firstNoteReferences} from '../src/sidebar-content';
import type {Card} from '../src/model';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

class Control {
 listeners=new Map<string,EventListener>();items:Control[]=[];focused=0;scrolled=0;
 ownerDocument={defaultView:null};parentElement:Control|null=null;clientWidth=200;scrollWidth=200;
 visible=true;disabled=false;primary=true;tagName='BUTTON';
 addEventListener(type:string,fn:EventListener){this.listeners.set(type,fn);}
 removeEventListener(type:string,fn:EventListener){if(this.listeners.get(type)===fn)this.listeners.delete(type);}
 querySelectorAll(selector:string){return selector==='button:not(:disabled)'?this.items.filter(i=>!i.disabled):this.items;}
 getClientRects(){return this.visible?[{}]:[];}
 closest(){return this;}
 matches(selector:string){return selector.startsWith(':disabled')?this.disabled:this.primary;}
 focus(options:{preventScroll:boolean}){assert.equal(options.preventScroll,true);this.focused++;}
 scrollIntoView(options:{block:string;inline:string}){assert.deepEqual(options,{block:'nearest',inline:'nearest'});this.scrolled++;}
 key(key:string,target:Control=this,extra:Record<string,unknown>={}){
  const event={key,target,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};
  this.listeners.get('keydown')?.(event as unknown as Event);return event;
 }
}
function fixture(){
 const search=new Control(),list=new Control(),first=new Control(),last=new Control();search.tagName='INPUT';list.items=[first,last];let ready=true;
 const dispose=sidebarSearchNavigation(search as unknown as HTMLInputElement,list as unknown as HTMLElement,()=>ready);
 return{search,list,first,last,dispose,pending:()=>{ready=false;}};
}
test('search arrows enter first/last results; result arrows and Escape navigate without activation',()=>{
 const {search,list,first,last}=fixture();
 assert.ok(search.key('ArrowDown').prevented);assert.equal(first.focused,1);
 search.key('ArrowUp');assert.equal(last.focused,1);
 list.key('ArrowDown',first);assert.equal(last.focused,2);
 list.key('ArrowDown',last);assert.equal(last.focused,3);
 list.key('ArrowUp',last);assert.equal(first.focused,2);
 list.key('ArrowUp',first);list.key('Escape',last);assert.equal(search.focused,2);
 for(const key of ['Enter',' ','ArrowLeft','Home','End'])assert.equal(list.key(key,first).prevented,false);
});
test('search navigation skips invisible/disabled results and follows a replaced list',()=>{
 const {search,list,first,last}=fixture();first.visible=false;last.disabled=true;
 assert.equal(search.key('ArrowDown').prevented,false);
 const replacement=new Control();list.items=[first,last,replacement];search.key('ArrowDown');assert.equal(replacement.focused,1);
 assert.equal(first.focused+last.focused,0);
 assert.equal(list.key('ArrowDown',first).prevented,false);
 list.items=[];assert.equal(search.key('ArrowUp').prevented,false);
});
test('pending refresh, IME and modified keys preserve native behavior',()=>{
 for(const extra of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}]){
  const {search,list,first}=fixture();assert.equal(search.key('ArrowDown',search,extra).prevented,false);
  assert.equal(list.key('Escape',first,extra).prevented,false);assert.equal(first.focused+search.focused,0);
 }
 const {search,list,first,pending}=fixture();pending();assert.equal(search.key('ArrowDown').prevented,false);assert.equal(list.key('ArrowDown',first).prevented,false);
});
test('auxiliary row controls keep native keys; disposing releases both handlers',()=>{
 const {search,list,first,dispose}=fixture(),aux=new Control();aux.primary=false;
 for(const key of ['ArrowDown','ArrowUp','Escape'])assert.equal(list.key(key,aux).prevented,false);
 dispose();assert.equal(search.listeners.size+list.listeners.size,0);search.key('ArrowDown');assert.equal(first.focused,0);
});
test('actual inner tree handler lets primary arrow keys reach shared search navigation',()=>{
 const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('      tree.onkeydown=e=>{'),end=source.indexOf('      let rendered = 0;',start);
 assert.ok(start>=0&&end>start);
 const {search,list,first}=fixture(),body=source.slice(start,end).replace('tree.onkeydown=','return ');
 const inner=new Function('HTMLElement','tree',transformSync(body,{loader:'ts'}).code)(Control,{});
 for(const extra of [{},{isComposing:true},{keyCode:229}]){
  const event={key:'ArrowUp',target:first,stopped:false,prevented:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};
  inner(event);assert.equal(event.stopped,false);
  list.listeners.get('keydown')?.(event as unknown as Event);
 }
 assert.equal(search.focused,1,'only the ordinary arrow event returns to search');
});
test('toolbar keyboard navigation skips hidden/disabled buttons and preserves native controls and shortcuts',()=>{
 const row=new Control(),a=new Control(),hidden=new Control(),disabled=new Control(),b=new Control();hidden.visible=false;disabled.disabled=true;row.items=[a,hidden,disabled,b];
 const dispose=toolbarNavigation(row as unknown as HTMLElement);
 row.key('ArrowRight',a);assert.equal(b.focused,1);row.key('ArrowRight',b);assert.equal(a.focused,1);
 row.key('End',a);row.key('Home',b);assert.equal(b.focused,2);assert.equal(a.focused,2);
 const select=new Control();select.tagName='SELECT';assert.equal(row.key('ArrowRight',select).prevented,false);
 for(const extra of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}])assert.equal(row.key('Home',a,extra).prevented,false);
 assert.equal(hidden.focused+disabled.focused,0);dispose();assert.equal(row.listeners.size,0);
});
test('note index preserves first duplicate, ignores other node kinds and never mutates nodes',()=>{
 const nodes=[{kind:'text',file:'A.md',id:'text'},{kind:'card',file:'A.md',id:'first'},{kind:'card',file:'A.md',id:'duplicate'},{kind:'pdf',file:'B.pdf',id:'pdf'},{kind:'card',id:'empty'},{kind:'card',file:'a.md',id:'case'}] as Card[];
 const before=JSON.stringify(nodes),index=firstNoteReferences(nodes);
 assert.equal(index.size,2);assert.equal(index.get('A.md'),nodes[1]);assert.equal(index.get('a.md'),nodes[5]);assert.equal(JSON.stringify(nodes),before);
 nodes.splice(1,1);const refreshed=firstNoteReferences(nodes);assert.equal(refreshed.get('A.md')?.id,'duplicate');assert.equal(index.get('A.md')?.id,'first');
});
