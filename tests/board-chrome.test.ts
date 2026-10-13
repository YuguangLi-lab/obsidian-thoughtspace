import test from 'node:test';
import assert from 'node:assert/strict';
import {boardHostBottomInset,boardFooterReserve,compactBoardChrome,bindBoardHostInset,bindBoardToolProxy} from '../src/board-chrome';

const rect=(left:number,top:number,right:number,bottom:number)=>({left,top,right,bottom});
test('compact tools use the actual pane and do not change a wide touch desktop',()=>{
 for(const width of [346,390,600])assert.equal(compactBoardChrome(width,false),true);
 assert.equal(compactBoardChrome(601,false),false);assert.equal(compactBoardChrome(820,true),true);assert.equal(compactBoardChrome(900,true),true);assert.equal(compactBoardChrome(901,true),false);assert.equal(compactBoardChrome(1440,true),false);assert.equal(compactBoardChrome(0,true),false);
});
test('native phone fixture reserves the obscured lower edge, not just its unoccluded center',()=>{
 const main=rect(44,84,390,844),dock=rect(53.5,780,380.5,836),status=rect(180,818,390,844);
 const inset=boardHostBottomInset(main,dock,status);assert.equal(inset,26);
 const movedBottom=836-inset;assert.equal(movedBottom,810);assert.ok(movedBottom<status.top);
 // Board contents and the camera remain external to this chrome-only calculation.
 assert.deepEqual(main,rect(44,84,390,844));assert.deepEqual(dock,rect(53.5,780,380.5,836));
});
test('keyboard, hidden host bars, popouts and unrelated panes do not acquire a gap',()=>{
 const main=rect(44,84,390,844),dock=rect(53,780,380,836);
 assert.equal(boardHostBottomInset(main,dock),0);
 assert.equal(boardHostBottomInset(main,dock,rect(0,0,0,0)),0);
 assert.equal(boardHostBottomInset(rect(44,84,390,500),dock,rect(0,818,390,844)),0);
 assert.equal(boardHostBottomInset(rect(0,0,1440,1000),rect(576,942,907,984),rect(1100,974,1440,1000)),0);
 assert.equal(boardHostBottomInset(main,dock,rect(0,200,390,300)),0);
 assert.equal(boardHostBottomInset(main,dock,rect(0,100,390,844)),0,'an unrelated large overlay is not a status bar');
 assert.equal(boardHostBottomInset(main,dock,rect(180,817.4,390,844)),27,'round upwards to protect every pixel');
});
test('palette-hidden footer does not reserve the full window, and visible inset is counted once',()=>{
 const main=rect(44,84,390,844);
 assert.equal(boardFooterReserve(main),28);assert.equal(boardFooterReserve(main,rect(0,0,0,0)),28);
 assert.equal(boardFooterReserve(main,rect(53,780,380,836)),76);
 assert.equal(boardFooterReserve(main,rect(53,754,380,810)),102,'26px host gap is included once');
});

function hostFixture(withPanels=false){
 const frames=new Map<number,()=>void>(),listeners=new Map<string,Set<()=>void>>();let id=0;
 const emitter=(prefix:string)=>({addEventListener:(key:string,fn:()=>void)=>{const name=prefix+key;if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name)!.add(fn);},removeEventListener:(key:string,fn:()=>void)=>listeners.get(prefix+key)?.delete(fn)});
 const mutations:{fn:()=>void;targets:Set<unknown>;stopped:boolean}[]=[],resizes:{fn:()=>void;targets:Set<unknown>;stopped:boolean}[]=[];
 class MutationObserver{targets=new Set<unknown>();stopped=false;constructor(public fn:()=>void){mutations.push(this);}observe(target:unknown){this.targets.add(target);}disconnect(){this.targets.clear();this.stopped=true;}}
 class ResizeObserver{targets=new Set<unknown>();stopped=false;constructor(public fn:()=>void){resizes.push(this);}observe(target:unknown){this.targets.add(target);}unobserve(target:unknown){this.targets.delete(target);}disconnect(){this.targets.clear();this.stopped=true;}}
 const win={...emitter('win:'),MutationObserver,ResizeObserver,visualViewport:emitter('viewport:'),requestAnimationFrame:(fn:()=>void)=>{frames.set(++id,fn);return id;},cancelAnimationFrame:(key:number)=>frames.delete(key),getComputedStyle:(el:any)=>({display:el.visible?'flex':'none',visibility:el.visibility||'visible'})};
 let bar:any;const doc={defaultView:win,body:{},querySelector:(selector:string)=>{assert.equal(selector,'.status-bar');return bar;}};
 const properties=new Map([['--ts-host-bottom-inset','3px']]);
 const main={ownerDocument:doc,style:{getPropertyValue:(key:string)=>properties.get(key)||'',setProperty:(key:string,value:string)=>properties.set(key,value),removeProperty:(key:string)=>properties.delete(key)},box:rect(44,84,390,withPanels?380:844),getBoundingClientRect(){return this.box;}};
 const dock={box:withPanels?rect(0,0,0,0):rect(53.5,780,380.5,836),getBoundingClientRect(){return this.box;}};
 const makeBar=()=>({visible:true,box:withPanels?rect(43.890625,353,390,380):rect(180,818,390,844),getClientRects(){return this.visible?[this.box]:[];},getBoundingClientRect(){return this.box;}});
 const panels=[0,1].map(index=>{
  const values=new Map(index===0?[['--ts-palette-host-inset','5px']]:[]);
  return{ownerDocument:doc as unknown as Document,hidden:index===1,isConnected:true,visible:true,visibility:'visible',values,
   style:{getPropertyValue:(key:string)=>values.get(key)||'',setProperty:(key:string,value:string)=>values.set(key,value),removeProperty:(key:string)=>values.delete(key)},
   box:rect(116,92,377,372),getClientRects(){return this.isConnected&&!this.hidden&&this.visible?[this.box]:[];},getBoundingClientRect(){return this.box;}};
 });
 bar=makeBar();let changes=0;const dispose=bindBoardHostInset(main as unknown as HTMLElement,dock as unknown as HTMLElement,()=>changes++,withPanels?panels as unknown as HTMLElement[]:[]);
 const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
 return{main,dock,doc,panels,properties,frames,listeners,mutations,resizes,dispose,flush,changes:()=>changes,bar:()=>bar,setBar:(next:any)=>{bar=next;},makeBar};
}
test('host observer follows only its document, handles bar replacement and cleans every resource',()=>{
 const f=hostFixture();assert.equal(f.properties.get('--ts-host-bottom-inset'),'26px');assert.equal(f.changes(),1);
 for(let i=0;i<5;i++)f.resizes[0].fn();assert.equal(f.frames.size,1);f.flush();assert.equal(f.changes(),1);
 f.bar().visible=false;f.mutations[0].fn();f.flush();assert.equal(f.properties.get('--ts-host-bottom-inset'),'0px');
 const old=f.bar(),next=f.makeBar();f.setBar(next);f.mutations[1].fn();f.flush();assert.equal(f.properties.get('--ts-host-bottom-inset'),'26px');assert.equal(f.resizes[0].targets.has(old),false);assert.equal(f.resizes[0].targets.has(next),true);
 f.main.box=rect(44,84,390,500);for(const fn of f.listeners.get('viewport:resize')!)fn();f.flush();assert.equal(f.properties.get('--ts-host-bottom-inset'),'0px');
 f.resizes[0].fn();assert.equal(f.frames.size,1);f.dispose();f.dispose();assert.equal(f.frames.size,0);assert.equal(f.properties.get('--ts-host-bottom-inset'),'3px');assert.equal([...f.listeners.values()].reduce((n,list)=>n+list.size,0),0);assert.ok([...f.mutations,...f.resizes].every(observer=>observer.stopped));
});
test('short tools and insertion palettes own their host gap while the footer is hidden',()=>{
 const f=hostFixture(true),[tools,insert]=f.panels,property='--ts-palette-host-inset';
 assert.equal(f.properties.get('--ts-host-bottom-inset'),'0px','a hidden dock does not supply the panel measurement');
 assert.equal(tools.values.get(property),'27px');assert.equal(insert.values.get(property),'0px');
 assert.equal(f.resizes.length,1,'panels reuse the existing host resize observer');
 assert.deepEqual([...f.mutations[2].targets],[tools,insert]);
 assert.equal(f.changes(),1,'root and panel updates are announced together');
 const originalMain={...f.main.box};
 tools.box=rect(116,92,377,345);f.resizes[0].fn();f.flush();
 assert.equal(tools.values.get(property),'27px','shortening the panel must not switch its inset off');
 assert.equal(f.changes(),1,'settled geometry cannot create an inset feedback loop');
 tools.hidden=true;insert.hidden=false;f.mutations[2].fn();f.flush();
 assert.equal(tools.values.get(property),'0px');assert.equal(insert.values.get(property),'27px');
 assert.equal(f.properties.get('--ts-host-bottom-inset'),'0px','switching palettes never replaces the footer variable');
 insert.hidden=true;f.mutations[2].fn();f.flush();assert.equal(insert.values.get(property),'0px');
 assert.deepEqual(f.main.box,originalMain,'closing changes only local style, not the stage bounds');
 f.dispose();
});
test('panel host gaps follow actual horizontal projection, owner and visual presence',()=>{
 const f=hostFixture(true),panel=f.panels[0],property='--ts-palette-host-inset';
 const refresh=()=>{f.mutations[2].fn();f.flush();};
 f.bar().box=rect(378,353,390,380);refresh();assert.equal(panel.values.get(property),'0px','a different horizontal pane needs no gap');
 f.bar().box=rect(43.890625,353,390,380);refresh();assert.equal(panel.values.get(property),'27px');
 panel.visibility='hidden';refresh();assert.equal(panel.values.get(property),'0px');panel.visibility='visible';
 panel.visible=false;refresh();assert.equal(panel.values.get(property),'0px');panel.visible=true;
 panel.isConnected=false;refresh();assert.equal(panel.values.get(property),'0px');panel.isConnected=true;
 panel.ownerDocument={} as Document;refresh();assert.equal(panel.values.get(property),'0px');panel.ownerDocument=f.doc as unknown as Document;
 panel.box=rect(116,92,377,92);refresh();assert.equal(panel.values.get(property),'0px','an empty panel is not a visible overlay');panel.box=rect(116,92,377,372);
 f.main.box=rect(44,84,390,320);refresh();assert.equal(panel.values.get(property),'0px','a keyboard-reduced pane ends before the host bar');
 f.main.box=rect(44,84,390,380);f.bar().visible=false;refresh();assert.equal(panel.values.get(property),'0px');
 f.setBar(null);refresh();assert.equal(panel.values.get(property),'0px','popouts without a status bar need no gap');f.dispose();
});
test('wide layouts and closing a palette keep the dock and panel gaps independent',()=>{
 const f=hostFixture(true),panel=f.panels[0],property='--ts-palette-host-inset';
 f.main.box=rect(0,0,1440,1000);f.dock.box=rect(576,942,907,984);panel.box=rect(82,100,518,600);f.bar().box=rect(1100,974,1440,1000);
 f.resizes[0].fn();f.flush();assert.equal(f.properties.get('--ts-host-bottom-inset'),'0px');assert.equal(panel.values.get(property),'0px','a wide left palette does not inherit a right status bar');
 f.main.box=rect(44,84,390,380);f.dock.box=rect(54,290,380,345);panel.box=rect(116,92,377,345);f.bar().box=rect(43.890625,353,390,380);
 f.resizes[0].fn();f.flush();assert.equal(f.properties.get('--ts-host-bottom-inset'),'27px');assert.equal(panel.values.get(property),'27px','each gap is measured, never summed');
 const originalDock={...f.dock.box};panel.hidden=true;f.mutations[2].fn();f.flush();
 assert.equal(panel.values.get(property),'0px');assert.equal(f.properties.get('--ts-host-bottom-inset'),'27px','restoring the visible dock retains its own stable inset');
 assert.deepEqual(f.dock.box,originalDock);f.dispose();
});
test('panel cleanup restores local properties and rejects pending or late observer callbacks',()=>{
 const f=hostFixture(true),[tools,insert]=f.panels,property='--ts-palette-host-inset';
 for(let i=0;i<4;i++){f.mutations[2].fn();f.resizes[0].fn();}assert.equal(f.frames.size,1);
 const pending=[...f.frames.values()][0],changes=f.changes();f.dispose();f.dispose();
 assert.equal(tools.values.get(property),'5px');assert.equal(insert.values.has(property),false);assert.equal(f.properties.get('--ts-host-bottom-inset'),'3px');
 assert.equal(f.frames.size,0);assert.ok([...f.mutations,...f.resizes].every(observer=>observer.stopped));
 assert.equal([...f.listeners.values()].reduce((n,list)=>n+list.size,0),0);
 pending();for(const observer of [...f.mutations,...f.resizes])observer.fn();f.flush();
 assert.equal(f.changes(),changes);assert.equal(f.frames.size,0);assert.equal(tools.values.get(property),'5px');assert.equal(insert.values.has(property),false);
});
test('tool proxies track actual mode, disabled and disclosure state without changing the command',()=>{
 let update=()=>{},released=false;
 const doc={defaultView:{MutationObserver:class{constructor(fn:()=>void){update=fn;}observe(){}disconnect(){released=true;}}}};
 const control=()=>{const attributes=new Map<string,string>(),classes=new Set<string>();return{ownerDocument:doc,disabled:false,classList:{contains:(name:string)=>classes.has(name),toggle:(name:string,value:boolean)=>value?classes.add(name):classes.delete(name)},getAttribute:(name:string)=>attributes.get(name)??null,hasAttribute:(name:string)=>attributes.has(name),setAttribute:(name:string,value:string)=>attributes.set(name,value),removeAttribute:(name:string)=>attributes.delete(name)};};
 const source=control(),target=control();source.setAttribute('aria-label','连线');const stop=bindBoardToolProxy(source as unknown as HTMLButtonElement,target as unknown as HTMLButtonElement);
 assert.equal(target.getAttribute('aria-pressed'),'false');source.classList.toggle('is-active',true);source.disabled=true;source.setAttribute('aria-busy','true');update();assert.equal(target.getAttribute('aria-pressed'),'true');assert.equal(target.disabled,true);assert.equal(target.getAttribute('aria-busy'),'true');
 source.classList.toggle('is-active',false);source.disabled=false;source.removeAttribute('aria-busy');source.setAttribute('aria-expanded','true');source.setAttribute('aria-controls','insert-panel');update();assert.equal(target.getAttribute('aria-pressed'),'false');assert.equal(target.disabled,false);assert.equal(target.getAttribute('aria-busy'),null);assert.equal(target.getAttribute('aria-controls'),'insert-panel');stop();assert.equal(released,true);
});
