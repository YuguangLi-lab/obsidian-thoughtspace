import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installToolbarWheel,revealToolbarControl} from '../src/toolbar-scroll';

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
test('keyboard reveal keeps a clipped format control visible on both axes without scrolling its editor or canvas',()=>{
 const stage={scrollTop:180,scrollLeft:90},editor={scrollTop:64,scrollLeft:21,parentElement:stage};
 const format={clientHeight:60,scrollHeight:240,scrollTop:120,clientTop:2,offsetHeight:64,parentElement:editor,
  getBoundingClientRect:()=>({top:100,bottom:228,height:128})};
 const doc={defaultView:{getComputedStyle:(element:unknown)=>({overflowX:element===row?'auto':'visible',overflowY:element===format?'auto':'visible'})}};
 const row={ownerDocument:doc,parentElement:format,clientWidth:100,scrollWidth:300,scrollLeft:35,clientLeft:2,offsetWidth:104,
  closest:()=>row,getBoundingClientRect:()=>({left:20,right:228,width:208})};
 let top=90,inside=true;
 const control={parentElement:row,closest:(selector:string)=>{assert.equal(selector,'.ts-floating-formatbar,.ts-board-rail');return inside?format:null;},
  getBoundingClientRect:()=>({left:260-(row.scrollLeft-35)*2,right:330-(row.scrollLeft-35)*2,top:top-(format.scrollTop-120)*2,bottom:top+40-(format.scrollTop-120)*2})};
 const reveal=()=>revealToolbarControl(control as unknown as HTMLElement,row as unknown as HTMLElement);
 reveal();assert.equal(row.scrollLeft,88);assert.equal(format.scrollTop,113);
 assert.equal(control.getBoundingClientRect().top,104,'top clipping accounts for the panel border and transform');
 reveal();assert.equal(row.scrollLeft,88);assert.equal(format.scrollTop,113,'a visible control does not move either viewport');
 top=240;reveal();assert.equal(format.scrollTop,148);assert.equal(control.getBoundingClientRect().bottom,224,'later controls reveal at the lower edge');
 inside=false;top=300;reveal();assert.equal(format.scrollTop,148,'controls outside a contextual panel never scroll an ancestor vertically');
 assert.deepEqual([stage.scrollTop,stage.scrollLeft,editor.scrollTop,editor.scrollLeft],[180,90,64,21]);
});
test('a clipped vertical rail reveals its focused tool without scrolling the surrounding board',()=>{
 const stage={scrollTop:80,scrollLeft:32},editor={scrollTop:48,scrollLeft:12,parentElement:stage};
 const rail={parentElement:editor,clientWidth:50,scrollWidth:50,clientHeight:100,scrollHeight:320,scrollTop:20,clientTop:1,offsetHeight:102,
  ownerDocument:{defaultView:{getComputedStyle:()=>({overflowX:'hidden',overflowY:'auto'})}},closest:()=>rail,
  getBoundingClientRect:()=>({top:20,bottom:122,height:102})};
 const control={parentElement:rail,closest:()=>rail,getBoundingClientRect:()=>({top:180-(rail.scrollTop-20),bottom:210-(rail.scrollTop-20)})};
 const reveal=()=>revealToolbarControl(control as unknown as HTMLElement,rail as unknown as HTMLElement);
 reveal();assert.equal(rail.scrollTop,109);assert.equal(control.getBoundingClientRect().bottom,121);
 reveal();assert.equal(rail.scrollTop,109,'repeated navigation keeps a visible tool stable');
 assert.deepEqual([stage.scrollTop,stage.scrollLeft,editor.scrollTop,editor.scrollLeft],[80,32,48,12]);
});
