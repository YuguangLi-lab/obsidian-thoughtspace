import test from 'node:test';
import assert from 'node:assert/strict';
import {bindLocalRelationsChrome,localRelationsBottomInset} from '../src/local-relations-chrome';

const rect=(left:number,top:number,right:number,bottom:number)=>({left,top,right,bottom});
test('recent controls account for the close button without treating the blank history row as a hit',()=>{
 const root=rect(44,84,820,1180),pill=rect(52,1128,152,1172),close=rect(764,1128,808,1172);
 assert.equal(localRelationsBottomInset(root,[pill,close],rect(300,1154,600,1180)),0,'the host covers only blank space');
 assert.equal(localRelationsBottomInset(root,[pill],rect(650,1154,820,1180)),0,'left history is unobscured');
 assert.equal(localRelationsBottomInset(root,[pill,close],rect(650,1154,820,1180)),26,'close is a separate real target');
 assert.equal(localRelationsBottomInset(root,[rect(764,1080,808,1124)],rect(650,1154,820,1180)),0,'already high controls remain in place');
 assert.equal(localRelationsBottomInset(root,[pill,close]),0,'popouts without a bar have no inset');
 assert.equal(localRelationsBottomInset(rect(44,84,820,500),[pill,close],rect(650,1154,820,1180)),0,'a keyboard-reduced pane does not inherit the window footer');
});

function fixture(){
 const listeners=new Map<string,Set<()=>void>>(),frames=new Map<number,()=>void>();let frameId=0;
 const events=(prefix:string)=>({addEventListener:(name:string,fn:()=>void)=>{const key=prefix+name;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key)!.add(fn);},removeEventListener:(name:string,fn:()=>void)=>listeners.get(prefix+name)?.delete(fn)});
 const observers:{fn:()=>void;targets:Set<unknown>;stopped:boolean}[]=[];
 class Observer {targets=new Set<unknown>();stopped=false;constructor(public fn:()=>void){observers.push(this);}observe(el:unknown){this.targets.add(el);}unobserve(el:unknown){this.targets.delete(el);}disconnect(){this.targets.clear();this.stopped=true;}}
 const win={...events('window:'),ResizeObserver:Observer,MutationObserver:Observer,visualViewport:events('viewport:'),requestAnimationFrame:(fn:()=>void)=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:(id:number)=>frames.delete(id),getComputedStyle:(el:any)=>({display:el.visible===false?'none':'flex',visibility:'visible'})};
 const makeBar=(box=rect(180,818,390,844))=>({visible:true,box,getBoundingClientRect(){return this.box;},getClientRects(){return this.visible?[this.box]:[];}});let bar:ReturnType<typeof makeBar>|undefined=makeBar();
 const properties=new Map<string,string>(),controls:any[]=[],style={getPropertyValue:(key:string)=>properties.get(key)||'',setProperty:(key:string,value:string)=>properties.set(key,value),removeProperty:(key:string)=>properties.delete(key)};
 const popup={hidden:true,visible:true,box:rect(52,142,382,440),getClientRects(){return this.hidden?[]:[this.box];},getBoundingClientRect(){return this.box;}};
 const doc={defaultView:win,body:{},querySelector:()=>bar},root={ownerDocument:doc,style,box:rect(44,84,390,844),querySelectorAll:()=>[popup],getBoundingClientRect(){return this.box;}};
 const recent={...events('recent:'),hidden:false,style,getClientRects:()=>[{}],querySelectorAll:()=>controls};
 const list={classList:{contains:(name:string)=>name==='ts-local-relations-recent-list'},box:rect(52,790,334,838),getBoundingClientRect(){return this.box;}};
 const control=(box:ReturnType<typeof rect>,parent:unknown)=>({box,visible:true,parentElement:parent,getClientRects(){return this.visible?[this.box]:[];},getBoundingClientRect(){const lift=parseFloat(properties.get('--ts-relations-bottom-lift')||'0');return{...this.box,top:this.box.top-lift,bottom:this.box.bottom-lift};}});
 const pill=control(rect(52,792,128,836),list),close=control(rect(338,792,382,836),undefined);controls.push(pill,close);
 const dispose=bindLocalRelationsChrome(root as unknown as HTMLElement,recent as unknown as HTMLElement),flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());},refresh=()=>{observers[0].fn();flush();};
 return{root,recent,popup,controls,pill,close,list,properties,frames,observers,listeners,dispose,flush,refresh,bar:()=>bar,setBar:(next:typeof bar)=>bar=next,makeBar};
}
test('history inset stays stable through repeated observations and uses visible clipped pills plus close',()=>{
 const f=fixture();assert.equal(f.properties.get('--ts-relations-bottom-lift'),'26px');
 for(let i=0;i<5;i++)f.refresh();assert.equal(f.properties.get('--ts-relations-bottom-lift'),'26px','translation does not oscillate');
 f.close.visible=false;f.refresh();assert.equal(f.properties.get('--ts-relations-bottom-lift'),'0px','blank part of the list does not intersect');
 f.pill.box=rect(350,792,450,836);f.refresh();assert.equal(f.properties.get('--ts-relations-bottom-lift'),'0px','a pill scrolled wholly outside the list does not count');
 f.pill.box=rect(300,792,420,836);f.refresh();assert.equal(f.properties.get('--ts-relations-bottom-lift'),'26px','the visible piece of a pill does count');
 f.recent.hidden=true;f.refresh();assert.equal(f.properties.get('--ts-relations-bottom-lift'),'0px');f.dispose();
});
test('host replacement, hidden bar, owner adoption and cleanup cannot mutate another window or leave listeners',()=>{
 const f=fixture(),old=f.bar();f.bar()!.visible=false;f.refresh();assert.equal(f.properties.get('--ts-relations-bottom-lift'),'0px');
 const next=f.makeBar();f.setBar(next);f.refresh();assert.equal(f.observers[0].targets.has(old),false);assert.equal(f.observers[0].targets.has(next),true);assert.equal(f.properties.get('--ts-relations-bottom-lift'),'26px');
 f.setBar(undefined);f.refresh();assert.equal(f.properties.get('--ts-relations-bottom-lift'),'0px');
 f.setBar(next);f.root.ownerDocument={} as typeof f.root.ownerDocument;f.refresh();assert.equal(f.properties.get('--ts-relations-bottom-lift'),'0px','stale owner cannot write a moved root');
 f.observers[0].fn();assert.equal(f.frames.size,1);f.dispose();assert.equal(f.frames.size,0);assert.ok(f.observers.every(observer=>observer.stopped));assert.ok([...f.listeners.values()].every(set=>set.size===0));assert.equal(f.properties.has('--ts-relations-bottom-lift'),false);assert.equal(f.properties.has('--ts-relations-popover-bottom-inset'),false);f.dispose();
});

test('390x380 popovers keep their effective bottom above the owner status bar even with hidden recent history',()=>{
 const f=fixture(),rootBefore=rect(44,84,390,380);f.root.box=rootBefore;f.setBar(f.makeBar(rect(180,354,390,380)));f.recent.hidden=true;f.popup.hidden=false;f.refresh();
 assert.equal(f.properties.get('--ts-relations-bottom-lift'),'0px');assert.equal(f.properties.get('--ts-relations-popover-bottom-inset'),'26px');
 // The narrow/coarse CSS uses a 58px top and border-box height bounded by
 // min(360px, 100% - 72px - this inset); padding cannot extend that bottom.
 const effectiveBottom=rootBefore.top+58+Math.min(360,rootBefore.bottom-rootBefore.top-72-26);
 assert.equal(effectiveBottom,340);assert.ok(effectiveBottom<=f.bar()!.box.top-14);assert.deepEqual(f.root.box,rootBefore,'no graph/container height change');
 for(let i=0;i<3;i++)f.refresh();assert.equal(f.properties.get('--ts-relations-popover-bottom-inset'),'26px','shrinking the floating height does not clear its own reserve');
 f.popup.box=rect(52,142,160,340);f.refresh();assert.equal(f.properties.get('--ts-relations-popover-bottom-inset'),'0px','a left-side popover does not inherit a right-side bar');
 f.popup.box=rect(52,142,382,340);f.refresh();assert.equal(f.properties.get('--ts-relations-popover-bottom-inset'),'26px');f.popup.hidden=true;f.refresh();assert.equal(f.properties.get('--ts-relations-popover-bottom-inset'),'0px');
 f.popup.hidden=false;f.setBar(undefined);f.refresh();assert.equal(f.properties.get('--ts-relations-popover-bottom-inset'),'0px','popout without host bar has no extra reserve');f.dispose();
});
