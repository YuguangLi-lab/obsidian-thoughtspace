import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toolbarNavigation} from '../src/toolbar-navigation';

function fixture(){
 const doc:any={activeElement:null,defaultView:{getComputedStyle:(element:Control)=>({overflowX:element.overflow})}};
 class Control{
  ownerDocument=doc;parentElement:Control|null=null;children:Control[]=[];listeners=new Set<(event:any)=>void>();
  role='';disabled=false;hidden=false;overflow='visible';clientWidth=200;scrollWidth=200;scrollLeft=0;scrollTop=23;clientLeft=0;offsetWidth=200;
  rect={left:0,right:200,width:200};focusCalls:unknown[]=[];
  constructor(public tagName='DIV',public name=''){}
  add(child:Control){this.children.push(child);child.parentElement=this;return child;}
  addEventListener(_type:string,listener:(event:any)=>void){this.listeners.add(listener);}
  removeEventListener(_type:string,listener:(event:any)=>void){this.listeners.delete(listener);}
  querySelectorAll():Control[]{return this.children.flatMap(child=>[...(child.tagName==='BUTTON'&&!child.disabled?[child]:[]),...child.querySelectorAll()]);}
  getClientRects(){return this.hidden?[]:[this.rect];}
  getBoundingClientRect(){return this.rect;}
  closest(){for(let element:Control|null=this;element;element=element.parentElement)if(element.role==='toolbar')return element;return null;}
  focus(options:unknown){doc.activeElement=this;this.focusCalls.push(options);}
  scrollIntoView(){throw Error('must not scroll the note or canvas');}
 }
 const outer=new Control(),row=outer.add(new Control());row.role='toolbar';
 const a=row.add(new Control('BUTTON','a')),b=row.add(new Control('BUTTON','b')),c=row.add(new Control('BUTTON','c'));
 const install=(element:Control)=>toolbarNavigation(element as unknown as HTMLElement);
 const press=(target:Control,key:string,overrides:Record<string,unknown>={})=>{
  const event:any={target,key,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...overrides};
  for(let element:Control|null=target;element&&!event.stopped;element=element.parentElement)for(const listener of element.listeners)listener(event);
  return event;
 };
 return{doc,outer,row,a,b,c,Control,install,press};
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
 f.row.overflow='auto';f.row.scrollWidth=800;f.row.scrollLeft=35;f.c.rect={left:260,right:290,width:30};
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
