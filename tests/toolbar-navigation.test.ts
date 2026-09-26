import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toolbarNavigation} from '../src/toolbar-navigation';

function fixture(){
 const doc:any={activeElement:null,defaultView:{getComputedStyle:(element:Control)=>({overflowX:element.overflow})}};
 class Control{
  ownerDocument=doc;parentElement:Control|null=null;children:Control[]=[];listeners=new Map<string,Set<(event:any)=>void>>();
  role='';disabled=false;hidden=false;overflow='visible';clientWidth=200;scrollWidth=200;scrollLeft=0;scrollTop=23;clientLeft=0;offsetWidth=200;
  private rectangle={left:0,right:200,width:200};private initialScroll=new Map<Control,number>();
  rectReads=0;tabIndex?:number;focusCalls:unknown[]=[];
  constructor(public tagName='DIV',public name=''){}
  get rect(){return this.rectangle;}
  set rect(value:{left:number;right:number;width:number}){this.rectangle=value;this.rememberScroll();}
  private rememberScroll(){this.initialScroll.clear();for(let p=this.parentElement;p;p=p.parentElement)this.initialScroll.set(p,p.scrollLeft);}
  add(child:Control){this.children.push(child);child.parentElement=this;child.rememberScroll();return child;}
  addEventListener(type:string,listener:(event:any)=>void){let listeners=this.listeners.get(type);if(!listeners)this.listeners.set(type,listeners=new Set());listeners.add(listener);}
  removeEventListener(type:string,listener:(event:any)=>void){this.listeners.get(type)?.delete(listener);}
  querySelectorAll():Control[]{return this.children.flatMap(child=>[...(child.tagName==='BUTTON'&&!child.disabled?[child]:[]),...child.querySelectorAll()]);}
  contains(element:unknown):boolean{return this===element||this.children.some(child=>child.contains(element));}
  matches(selector:string){return selector.split(',').some(tag=>tag==='[tabindex]'?this.tabIndex!==undefined:tag.toUpperCase()===this.tagName);}
  getClientRects(){return this.hidden?[]:[this.rect];}
  getBoundingClientRect(){
   this.rectReads++;let delta=0;
   for(let p=this.parentElement;p;p=p.parentElement)delta+=(p.scrollLeft-(this.initialScroll.get(p)||0))*(p.offsetWidth?p.rect.width/p.offsetWidth:1);
   return{...this.rect,left:this.rect.left-delta,right:this.rect.right-delta};
  }
  closest(){for(let element:Control|null=this;element;element=element.parentElement)if(element.role==='toolbar')return element;return null;}
  focus(options?:unknown){const changed=doc.activeElement!==this;doc.activeElement=this;this.focusCalls.push(options);if(changed)dispatch(this,'focusin');}
  scrollIntoView(){throw Error('must not scroll the note or canvas');}
 }
 const outer=new Control(),row=outer.add(new Control());row.role='toolbar';
 const a=row.add(new Control('BUTTON','a')),b=row.add(new Control('BUTTON','b')),c=row.add(new Control('BUTTON','c'));
 const install=(element:Control)=>toolbarNavigation(element as unknown as HTMLElement);
 function dispatch(target:Control,type:string,overrides:Record<string,unknown>={}){
  const event:any={target,type,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...overrides};
  for(let element:Control|null=target;element&&!event.stopped;element=element.parentElement)for(const listener of element.listeners.get(type)||[])listener(event);
  return event;
 }
 const press=(target:Control,key:string,overrides:Record<string,unknown>={})=>dispatch(target,'keydown',{key,...overrides});
 return{doc,outer,row,a,b,c,Control,install,press,dispatch};
}

test('nested Markdown arrows and End reach the appearance control in the enclosing toolbar',()=>{
 const f=fixture(),group=new f.Control();f.row.children=[];f.row.add(group);group.add(f.a);group.add(f.b);f.row.add(f.c);
 const inner=f.install(group),outer=f.install(f.row);
 f.press(f.b,'ArrowRight');assert.equal(f.doc.activeElement,f.c);assert.equal(f.c.focusCalls.length,1);
 f.press(f.a,'End');assert.equal(f.doc.activeElement,f.c);f.press(f.c,'ArrowRight');assert.equal(f.doc.activeElement,f.a);
 outer();f.press(f.b,'ArrowRight');assert.equal(f.doc.activeElement,f.a,'nested toolbar resumes after outer navigation is removed');inner();
});
test('keyboard reveal moves only the toolbar horizontal viewport and preserves surrounding scroll',()=>{
 const f=fixture();f.outer.scrollWidth=1000;f.outer.overflow='auto';f.outer.scrollLeft=120;
 f.row.overflow='auto';f.row.scrollWidth=800;f.row.scrollLeft=35;f.row.rect={left:0,right:200,width:200};f.c.rect={left:260,right:290,width:30};
 const dispose=f.install(f.row);f.press(f.a,'End');
 assert.equal(f.row.scrollLeft,125);assert.equal(f.row.scrollTop,23);assert.equal(f.outer.scrollLeft,120);assert.equal(f.outer.scrollTop,23);
 assert.deepEqual(f.c.focusCalls,[{preventScroll:true}]);dispose();
});
test('inline toolbar navigation never scrolls an overflowing canvas outside the toolbar boundary',()=>{
 const f=fixture();f.outer.scrollWidth=1000;f.outer.overflow='hidden';f.outer.scrollLeft=80;f.c.rect={left:600,right:630,width:30};
 const dispose=f.install(f.row);f.press(f.a,'End');assert.equal(f.outer.scrollLeft,80);assert.equal(f.row.scrollLeft,0);dispose();
});
test('reveal accounts for a transformed toolbar and its border without shifting a visible control',()=>{
 const f=fixture();f.row.overflow='auto';f.row.scrollWidth=800;f.row.offsetWidth=204;f.row.clientLeft=2;f.row.rect={left:40,right:448,width:408};f.c.rect={left:454,right:514,width:60};
 const dispose=f.install(f.row);f.press(f.a,'End');assert.equal(f.row.scrollLeft,35);
 f.c.rect={left:300,right:360,width:60};f.press(f.a,'End');assert.equal(f.row.scrollLeft,35);dispose();
});
test('disabled and hidden controls are skipped and single-button navigation does not refocus',()=>{
 const f=fixture();f.b.disabled=true;f.c.hidden=true;const dispose=f.install(f.row);
 const event=f.press(f.a,'ArrowRight');assert.equal(event.defaultPrevented,true);assert.equal(f.a.focusCalls.length,0);
 f.c.hidden=false;f.press(f.a,'ArrowLeft');assert.equal(f.doc.activeElement,f.c);dispose();
});
test('native selects, composition and host shortcuts keep their own key behavior',()=>{
 const f=fixture(),select=f.row.add(new f.Control('SELECT'));const dispose=f.install(f.row);
 for(const key of ['ArrowLeft','ArrowRight','Home','End'])assert.equal(f.press(select,key).defaultPrevented,false);
 for(const overrides of [{isComposing:true},{keyCode:229},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}])assert.equal(f.press(f.a,'ArrowRight',overrides).defaultPrevented,false);
 f.press(f.a,'ArrowRight',{defaultPrevented:true});assert.equal(f.b.focusCalls.length,0);dispose();f.press(f.a,'ArrowRight');assert.equal(f.b.focusCalls.length,0);
});
test('focusing a partly visible native select reveals its full width without moving the canvas',()=>{
 const f=fixture(),select=f.row.add(new f.Control('SELECT'));
 f.outer.overflow='auto';f.outer.scrollWidth=1000;f.outer.scrollLeft=120;
 f.row.overflow='auto';f.row.scrollWidth=800;f.row.scrollLeft=35;f.row.rect={left:0,right:200,width:200};
 // Native reproduction: 15 px are visible, but the center is under the arrow.
 select.rect={left:185,right:247,width:62};const dispose=f.install(f.row);
 select.focus();
 assert.equal(f.doc.activeElement,select);assert.equal(f.row.scrollLeft,82);assert.deepEqual(select.getBoundingClientRect(),{left:138,right:200,width:62});
 assert.equal(f.row.scrollTop,23);assert.equal(f.outer.scrollLeft,120);assert.equal(f.outer.scrollTop,23);
 assert.equal(select.focusCalls.length,1,'revealing does not refocus the select or editor');
 const event=f.press(select,'ArrowRight');assert.equal(event.defaultPrevented,false);assert.equal(f.row.scrollLeft,82);dispose();
});
test('nested focusin is revealed once by the enclosing toolbar and resumes after its disposal',()=>{
 const f=fixture(),group=f.row.add(new f.Control()),select=group.add(new f.Control('SELECT'));
 f.row.overflow='auto';f.row.scrollWidth=800;select.rect={left:180,right:240,width:60};
 const inner=f.install(group),outer=f.install(f.row);select.focus();
 assert.equal(f.row.scrollLeft,40);assert.equal(select.rectReads,1,'only outer focusin performs the reveal');
 outer();f.row.scrollLeft=0;select.rect={left:180,right:240,width:60};select.rectReads=0;f.dispatch(select,'focusin');
 assert.equal(f.row.scrollLeft,40);assert.equal(select.rectReads,1,'nested listener handles focus after parent disposal');inner();
});
test('disposing focus navigation removes both listeners and leaves later native focus untouched',()=>{
 const f=fixture(),select=f.row.add(new f.Control('SELECT'));f.row.overflow='auto';f.row.scrollWidth=800;select.rect={left:180,right:240,width:60};
 const dispose=f.install(f.row);assert.equal(f.row.listeners.get('keydown')?.size,1);assert.equal(f.row.listeners.get('focusin')?.size,1);
 dispose();dispose();select.focus();f.press(f.a,'End');
 assert.equal(f.row.listeners.get('keydown')?.size,0);assert.equal(f.row.listeners.get('focusin')?.size,0);
 assert.equal(f.row.scrollLeft,0);assert.equal(f.doc.activeElement,select);assert.equal(f.c.focusCalls.length,0);
});
test('focus reveal handles inputs and explicit tabindex controls but ignores unrelated targets',()=>{
 const f=fixture();f.row.overflow='auto';f.row.scrollWidth=800;const dispose=f.install(f.row);
 for(const tag of ['INPUT','DIV']){
  const control=f.row.add(new f.Control(tag));if(tag==='DIV')control.tabIndex=0;
  f.row.scrollLeft=0;control.rect={left:190,right:230,width:40};control.focus();assert.equal(f.row.scrollLeft,30,tag);
 }
 f.row.scrollLeft=0;const decorative=f.row.add(new f.Control('SPAN'));decorative.rect={left:250,right:280,width:30};f.dispatch(decorative,'focusin');assert.equal(f.row.scrollLeft,0);
 for(const target of [null,new f.Control('SELECT')])for(const listener of f.row.listeners.get('focusin')||[])listener({target});
 assert.equal(f.row.scrollLeft,0);dispose();
});
