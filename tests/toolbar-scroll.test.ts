import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installToolbarWheel} from '../src/toolbar-scroll';

function fixture(){
 let listener:((event:any)=>void)|undefined;
 const style={direction:'ltr',lineHeight:'20px'},native={closest:()=>({})},button={closest:()=>null};
 const scroller={clientWidth:200,scrollWidth:800,scrollLeft:0,scrollTop:70,ownerDocument:{defaultView:{getComputedStyle:(element:unknown)=>{assert.equal(element,scroller);return style;}}},
  addEventListener(type:string,run:(event:any)=>void,options:unknown){assert.equal(type,'wheel');assert.deepEqual(options,{passive:false});listener=run;},
  removeEventListener(type:string,run:(event:any)=>void){assert.equal(type,'wheel');if(listener===run)listener=undefined;},
 };
 const dispose=installToolbarWheel(scroller as unknown as HTMLElement);
 const wheel=(overrides:Record<string,unknown>={})=>{const event={target:button,deltaX:0,deltaY:40,deltaMode:0,cancelable:true,defaultPrevented:false,stopped:false,
  preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...overrides};listener?.(event);return event;};
 return{scroller,style,native,wheel,dispose};
}
test('vertical mouse wheel reaches clipped tools without moving the note vertically',()=>{
 const f=fixture(),event=f.wheel();assert.equal(f.scroller.scrollLeft,40);assert.equal(f.scroller.scrollTop,70);assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);
 f.wheel({deltaX:-12,deltaY:3});assert.equal(f.scroller.scrollLeft,28);f.dispose();
});
test('wheel does not capture a fitting toolbar or a gesture that cannot move at either edge',()=>{
 const f=fixture();assert.equal(f.wheel({deltaY:-40}).defaultPrevented,false);assert.equal(f.scroller.scrollLeft,0);
 f.scroller.scrollLeft=590;assert.equal(f.wheel().defaultPrevented,true);assert.equal(f.scroller.scrollLeft,600);assert.equal(f.wheel().defaultPrevented,false);
 f.scroller.scrollWidth=200;assert.equal(f.wheel({deltaY:-40}).defaultPrevented,false);
 f.scroller.clientWidth=0;assert.equal(f.wheel().defaultPrevented,false);f.dispose();
});
test('selects, text fields, zoom modifiers and already handled wheel gestures remain native',()=>{
 const f=fixture();
 for(const overrides of [{target:f.native},{ctrlKey:true},{metaKey:true},{altKey:true},{cancelable:false},{deltaY:0},{deltaY:NaN}])assert.equal(f.wheel(overrides).defaultPrevented,false);
 f.wheel({defaultPrevented:true});assert.equal(f.scroller.scrollLeft,0);f.dispose();
});
test('line and page wheel deltas use the current toolbar font and viewport size',()=>{
 const f=fixture();f.wheel({deltaY:2,deltaMode:1});assert.equal(f.scroller.scrollLeft,40);
 f.wheel({deltaY:1,deltaMode:2});assert.equal(f.scroller.scrollLeft,240);
 f.style.lineHeight='normal';f.wheel({deltaY:-2,deltaMode:1});assert.equal(f.scroller.scrollLeft,208);f.dispose();
});
test('RTL vertical wheels progress toward later tools while horizontal gestures keep their direction',()=>{
 const f=fixture();f.style.direction='rtl';f.wheel();assert.equal(f.scroller.scrollLeft,-40);
 f.wheel({deltaX:12,deltaY:0});assert.equal(f.scroller.scrollLeft,-28);
 f.scroller.scrollLeft=-600;assert.equal(f.wheel().defaultPrevented,false);f.dispose();
});
test('disposing removes the non-passive handler and leaves future gestures untouched',()=>{
 const f=fixture();f.dispose();f.dispose();assert.equal(f.wheel().defaultPrevented,false);assert.equal(f.scroller.scrollLeft,0);
});
