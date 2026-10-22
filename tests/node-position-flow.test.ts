import {effectiveCardStyle} from '../src/card-style';
import {cardHeadingColors} from '../src/card-style-color';
import {nodeHasBorder,textBlockPadding} from '../src/text-sizing';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {cardFillHex, colors, type Card} from '../src/model';
import {sectionDisplayNode} from '../src/sections';
import {textFontFamily} from '../src/text-tools';
import {syncNodeGeometry} from '../src/node-render-key';
import {cardControlLayout} from '../src/card-control-layout';
import {foldControlObstacles} from '../src/fold-control-obstacles';

const source=readFileSync(process.env.POSITION_SOURCE||'src/main.ts','utf8'),start=source.indexOf('  private positionNode('),end=source.indexOf('  private applyInlineSize(',start);
assert.ok(start>0&&end>start);
let obstacleScans=0;
const deps={foldControlObstacles:(...args:Parameters<typeof foldControlObstacles>)=>{obstacleScans++;return foldControlObstacles(...args);},effectiveCardStyle,cardHeadingColors,nodeHasBorder,textBlockPadding,cardFillHex,colors,sectionDisplayNode,textFontFamily,syncNodeGeometry,cardControlLayout};
// Production render caches dimensions only after mounting the stage in its
// owner. Keep that ownership in this isolated method fixture as well.
const View=new Function(...Object.keys(deps),transformSync(`class View{cardControlRequests=new Map();reserveVisibleCardControls(){};stage={parentElement:{classList:{contains:()=>false}}};${source.slice(start,end)}};return View`,{loader:'ts'}).code)(...Object.values(deps));
const controlsStart=source.indexOf('      const trackControls=()=>{'),controlsEnd=source.indexOf('\n      if((n.collapsed',controlsStart);
assert.ok(controlsStart>0&&controlsEnd>controlsStart);
const ControlView=new Function('View','mountCardControlHover',transformSync(`class ControlView extends View{mountControls(n,el,scope){${source.slice(controlsStart,controlsEnd)}trackControls();}};return ControlView`,{loader:'ts'}).code)(View,()=>()=>{});
const node=(patch:Partial<Card>={}):Card=>({id:'node',kind:'card',file:'note.md',x:20,y:30,width:300,height:180,color:'blue',transparent:true,fillColor:'blue',...patch});
function surface(){
 const classes=new Set<string>(),properties=new Map<string,string>(),writes:string[]=[];
 const style=new Proxy({left:'',top:'',width:'',height:'',borderStyle:'',borderWidth:'',
  getPropertyValue:(key:string)=>properties.get(key)||'',setProperty:(key:string,value:string)=>{writes.push(key);properties.set(key,value);},
  removeProperty:(key:string)=>{writes.push(key);properties.delete(key);}
 },{set(target,key,value){writes.push(String(key));return Reflect.set(target,key,value);}});
 const element={style,dataset:{} as Record<string,string>,classList:{contains:(name:string)=>classes.has(name)},toggleClass(name:string,on:boolean){writes.push('.'+name);if(on)classes.add(name);else classes.delete(name);}};
 return {element,style,classes,properties,writes};
}

test('repeated viewport refreshes leave unchanged node presentation untouched',()=>{
 const view=new View();
 for(const kind of ['card','text','image','pdf','board','section'] as const){
  const f=surface(),n=node({kind});view.positionNode(n,f.element);f.writes.length=0;
  for(let i=0;i<120;i++)view.positionNode(n,f.element);
  assert.deepEqual(f.writes,[],`${kind}: no repeated class or CSS writes`);
 }
});

test('120 horizontal drag frames only update the changed coordinate',()=>{
 const view=new View(),f=surface(),n=node();view.positionNode(n,f.element);f.writes.length=0;
 for(let i=0;i<120;i++)view.positionNode({...n,x:21+i},f.element);
 assert.equal(f.writes.length,120);assert.ok(f.writes.every(key=>key==='left'));
 assert.deepEqual([f.style.left,f.style.top,f.style.width,f.style.height],['140px','30px','300px','180px']);
});

test('control placement uses cached stage dimensions while tracking the current viewport without DOM reads',()=>{
 const view=new View(),f=surface(),n=node({x:360,y:90}),viewport={x:0,y:0,zoom:1};
 view.cardToolbarObstacles=[];view.session={board:{viewport}};view.controlStageSize={width:480,height:320};f.element.dataset.controlCount='1';
 view.stage={get clientWidth(){throw Error('positionNode must not read stage width');},get clientHeight(){throw Error('positionNode must not read stage height');}};
 const placements:{scale:string|undefined;top:string|undefined;right:string|undefined}[]=[];
 for(const next of [{x:0,y:0,zoom:1},{x:-120,y:30,zoom:.5},{x:-400,y:-50,zoom:1.5}]){
  Object.assign(viewport,next);view.positionNode(n,f.element);
  const expected=cardControlLayout(n,viewport,480,320,1,{width:36,height:36,screenGap:24});
  const placement={scale:f.properties.get('--ts-control-scale'),top:f.properties.get('--ts-control-top'),right:f.properties.get('--ts-control-right')};
  assert.deepEqual(placement,{scale:String(expected.scale),top:`${expected.top}px`,right:`${expected.right}px`});
  placements.push(placement);
 }
 assert.notDeepEqual(placements[0],placements[1]);assert.notDeepEqual(placements[1],placements[2]);
 assert.deepEqual([f.style.left,f.style.top,f.style.width,f.style.height],['360px','90px','300px','180px']);
 f.writes.length=0;view.positionNode(n,f.element);assert.deepEqual(f.writes,[],'unchanged camera and cached stage must not repeat CSS writes');
});

test('positioned docks honor cached label-button widths for notes and text',()=>{
 for(const [kind,count,width] of [['card',5,236],['text',3,136]] as const){
  const view=new View(),f=surface(),n=node({kind,x:20,y:150,width:100}),viewport={x:0,y:0,zoom:1};
  view.cardToolbarObstacles=[];view.session={board:{viewport}};view.controlStageSize={width:480,height:320};
  f.element.dataset.controlCount=String(count);f.element.dataset.controlWidth=String(width);
  view.positionNode(n,f.element);
  const expected=cardControlLayout(n,viewport,480,320,count,{width,height:36,topReserve:60,screenGap:24});
  assert.equal(f.properties.get('--ts-control-right'),`${expected.right}px`);
  assert.equal(f.properties.get('--ts-control-top'),`${expected.top}px`);
  assert.notEqual(expected.right,cardControlLayout(n,viewport,480,320,count).right,'labelled actions need more width than icon-only defaults');
 }
});

test('compact owner changes touch dock CSS and avoidance together without touching card geometry',()=>{
 const view=new View(),f=surface(),n=node({x:60,y:280,width:160,height:140}),viewport={x:0,y:0,zoom:1};
 const ownerClasses=new Set<string>();
 view.stage={parentElement:{classList:{contains:(name:string)=>ownerClasses.has(name)}},get clientWidth(){throw Error('use cached stage dimensions');},get clientHeight(){throw Error('use cached stage dimensions');}};
 view.cardToolbarObstacles=[];view.session={board:{viewport}};view.controlStageSize={width:390,height:760};view.selected=new Set([n.id]);
 f.element.dataset.controlCount='5';f.element.dataset.controlWidth='236';
 for(const touchTargets of [false,true,false]){
  if(touchTargets)ownerClasses.add('ts-touch-card-controls');else ownerClasses.delete('ts-touch-card-controls');
  view.positionNode(n,f.element);
  const expected=cardControlLayout(n,viewport,390,760,5,{width:236,height:36,touchTargets,topReserve:60,screenGap:24});
  assert.equal(f.element.dataset.touchControls,String(touchTargets));
  assert.equal(f.properties.get('--ts-control-right'),`${expected.right}px`);
  assert.equal(f.properties.get('--ts-control-top'),`${expected.top}px`);
  assert.deepEqual([f.style.left,f.style.top,f.style.width,f.style.height],['60px','280px','160px','140px']);
 }
});

for(const readingSlots of [0,1])test(`folded ${readingSlots+1}-slot touch presentation retains the same focus and event target through owner changes`,()=>{
 const view=new View(),f=surface(),n=node({kind:readingSlots?'card':'text',collapsed:true,x:100,y:300,width:80,height:400}),viewport={x:30,y:-50,zoom:1};
 const ownerClasses=new Set<string>(),button=new EventTarget(),row={button};let activations=0;
 button.addEventListener('click',()=>activations++);
 Object.assign(button,{classList:{contains:()=>false}});const doc={activeElement:button};Object.assign(f.element,{ownerDocument:doc,contains:(target:unknown)=>target===button,querySelector:()=>{throw Error('Position-only presentation must not inspect or replace children');}});
 view.stage={parentElement:{classList:{contains:(name:string)=>ownerClasses.has(name)}}};view.cardToolbarObstacles=[];view.session={board:{viewport}};view.controlStageSize={width:346,height:680};view.connectionCandidates=[n];
 f.element.dataset.controlCount='1';f.element.dataset.controlWidth='36';f.element.dataset.controlInlineUnfold='true';f.element.dataset.controlDockCount=String(readingSlots);
 for(const touchTargets of [false,true,false,true]){
  if(touchTargets)ownerClasses.add('ts-touch-card-controls');else ownerClasses.delete('ts-touch-card-controls');
  view.positionNode(n,f.element);
  const count=touchTargets?readingSlots+1:1,projected=sectionDisplayNode(n),expected=cardControlLayout(projected,viewport,346,680,count,{width:32*count+4,height:36,touchTargets,topReserve:60,screenGap:24});
  assert.equal(f.element.dataset.externalUnfold,String(touchTargets));assert.equal(f.properties.get('--ts-control-top'),`${expected.top}px`);assert.equal(f.properties.get('--ts-control-right'),`${expected.right}px`);
  assert.equal(doc.activeElement,button);assert.equal(row.button,button);button.dispatchEvent(new Event('click'));
  assert.deepEqual([f.style.width,f.style.height],['80px','40px']);assert.deepEqual([n.width,n.height],[80,400]);
 }
 assert.equal(activations,4,'the same registered action remains attached after each presentation switch');
});

test('visible touch docks avoid an unselected neighbour and the current native draft bounds',()=>{
 const view=new View(),f=surface(),n=node({kind:'text',x:70,y:300,width:240,height:180}),other=node({id:'draft',x:64,y:200,width:90,height:20}),viewport={x:0,y:0,zoom:1};
 view.stage={parentElement:{classList:{contains:()=>true}}};view.cardToolbarObstacles=[];view.session={board:{viewport}};view.controlStageSize={width:390,height:760};view.selected=new Set(['draft']);view.connectionCandidates=[n,other];view.inlineTarget='draft';view.inlineGeometry={id:'draft',width:250,height:68};
 f.element.dataset.controlCount='3';f.element.dataset.controlWidth='136';obstacleScans=0;view.positionNode(n,f.element);
 const request=view.cardControlRequests.get(n.id);
 assert.equal(obstacleScans,1,'cache mounted neighbour geometry once for shared allocation');assert.deepEqual(request.dimensions.avoid,foldControlObstacles(n,[n,{...other,width:250,height:68}],viewport));assert.equal(f.properties.has('--ts-control-top'),false,'passive touch does not run an initial full-dock solver');
 assert.deepEqual([other.width,other.height],[90,20],'the native draft only changes the avoidance presentation');
});

test('a single selected card reserves only its visible actions, without changing content geometry',()=>{
 for(const [kind,count,width] of [['card',5,236],['text',3,136]] as const){
  const view=new View(),f=surface(),n=node({kind,x:20,y:150,width:100}),viewport={x:0,y:0,zoom:1};
  view.selected=new Set([n.id]);view.cardToolbarObstacles=[];view.session={board:{viewport}};view.controlStageSize={width:480,height:320};
  f.element.dataset.controlCount=String(count);f.element.dataset.controlWidth=String(width);f.element.dataset.controlEditWidth='68';
  view.positionNode(n,f.element);
  const expected=cardControlLayout(n,viewport,480,320,count-1,{width:width-68,height:36,topReserve:60,screenGap:24});
  assert.equal(f.properties.get('--ts-control-right'),`${expected.right}px`);
  assert.equal(f.properties.get('--ts-control-top'),`${expected.top}px`);
  assert.equal(f.element.dataset.quickEditHidden,'true');
  assert.deepEqual([f.style.left,f.style.top,f.style.width,f.style.height],['20px','150px','100px','180px']);
  const edit={classList:{contains:(name:string)=>name==='ts-card-quick-edit'}};
  const dom=Object.assign(f.element,{ownerDocument:{activeElement:edit as unknown},contains:(target:unknown)=>target===edit});
  view.positionNode(n,dom);
  assert.equal(f.element.dataset.quickEditHidden,'false','never remove or clip a keyboard-focused edit button');
  const complete=cardControlLayout(n,viewport,480,320,count,{width,height:36,topReserve:60,screenGap:24});
  assert.equal(f.properties.get('--ts-control-right'),`${complete.right}px`);
  dom.ownerDocument.activeElement=null;view.positionNode(n,dom);
  assert.equal(f.element.dataset.quickEditHidden,'true','blur restores the compact dock without a new selection');
  view.selected.add('second');view.positionNode(n,f.element);
  const batch=cardControlLayout(n,viewport,480,320,count,{width,height:36,topReserve:60,screenGap:24});
  assert.equal(f.element.dataset.quickEditHidden,'false');
  assert.equal(f.properties.get('--ts-control-right'),`${batch.right}px`,'hovered cards in a batch retain their own edit action');
 }
});

test('hidden batch docks skip neighbour scans, then recompute before hover or focus use',()=>{
 const view=new View(),f=surface(),n=node(),viewport={x:0,y:0,zoom:1};
 view.selected=new Set([n.id,'other']);view.cardToolbarObstacles=[];view.session={board:{viewport}};view.controlStageSize={width:900,height:600};
 view.connectionCandidates=[n,node({id:'other',x:450})];f.classes.add('is-selected');obstacleScans=0;
 for(let i=0;i<120;i++)view.positionNode(n,f.element);
 assert.equal(obstacleScans,0,'an invisible batch dock must not walk the board on every camera frame');
 f.classes.add('is-control-hover');view.positionNode(n,f.element);assert.equal(obstacleScans,1,'a shown dock still avoids nearby content');
 f.classes.delete('is-control-hover');f.classes.add('is-control-focus');view.positionNode(n,f.element);assert.equal(obstacleScans,2,'keyboard access has the same obstacle protection');
});

test('presentation changes still apply immediately without a cached node identity',()=>{
 const view=new View(),f=surface(),n=node();view.positionNode(n,f.element);f.writes.length=0;
 Object.assign(n,{transparent:false,fillColor:'#123abc',fontSize:24,fontFamily:'serif',customBorder:true,borderWidth:3,borderStyle:'dashed'});
 view.positionNode(n,f.element);
 assert.equal(f.classes.has('is-transparent'),false);assert.equal(f.classes.has('has-card-fill'),true);assert.equal(f.classes.has('has-custom-border'),true);
 assert.equal(f.properties.get('--ts-card-fill'),'#123abc');assert.equal(f.properties.get('--ts-card-body-size'),'24px');assert.equal(f.properties.get('--ts-card-body-font'),textFontFamily('serif'));
 assert.equal(f.style.borderWidth,'3px');assert.equal(f.style.borderStyle,'dashed');assert.ok(!f.writes.includes('left'));
 delete n.fillColor;delete n.borderWidth;delete n.borderStyle;n.customBorder=false;view.positionNode(n,f.element);
 assert.equal(f.classes.has('has-card-fill'),false);assert.equal(f.properties.has('--ts-card-fill'),false);assert.equal(f.style.borderWidth,'');assert.equal(f.style.borderStyle,'');
});

test('reused nodes synchronize border and text colors through replacements and undo',()=>{
 const view=new View(),f=surface(),n=node({color:'blue',textColor:'rose'});view.positionNode(n,f.element);
 assert.equal(f.classes.has('ts-color-blue'),true);assert.equal(f.element.dataset.ink,'rose');
 view.positionNode({...n,color:'green',textColor:'purple'},f.element);
 assert.equal(f.classes.has('ts-color-blue'),false);assert.equal(f.classes.has('ts-color-green'),true);assert.equal(f.element.dataset.ink,'purple');
 view.positionNode(n,f.element);assert.equal(f.classes.has('ts-color-green'),false);assert.equal(f.classes.has('ts-color-blue'),true);assert.equal(f.element.dataset.ink,'rose');
 view.positionNode({...n,textColor:undefined},f.element);assert.equal(f.element.dataset.ink,'default');
});

test('appearance refresh keeps an inline editor draft size while updating its position and font',()=>{
 const view=new View(),f=surface(),n=node();view.positionNode(n,f.element);f.style.width='420px';f.style.height='270px';f.writes.length=0;
 view.positionNode({...n,x:50,y:80,fontSize:20},f.element,true);
 assert.deepEqual([f.style.left,f.style.top,f.style.width,f.style.height],['50px','80px','420px','270px']);
 assert.equal(f.properties.get('--ts-card-body-size'),'20px');assert.ok(!f.writes.includes('width')&&!f.writes.includes('height'));
});

test('pointer and focus dock events preserve the active inline draft when focus moves to the detached toolbar',()=>{
 for(const kind of ['text','card'] as const)for(const marker of ['inlineId','inlineTarget'] as const){
  const view=new ControlView(),f=surface(),n=node({kind}),before=structuredClone(n),classes=f.classes;
  const toolbarButton={classList:{contains:()=>false}},element=Object.assign(new EventTarget(),f.element,{
   querySelector:()=>null,isConnected:true,ownerDocument:{activeElement:toolbarButton},contains:()=>false,
   classList:{contains:(name:string)=>classes.has(name),add:(name:string)=>classes.add(name),remove:(name:string)=>classes.delete(name)},
  });
  const disposers:(()=>void)[]=[];
  view.selected=new Set([n.id]);view.session={board:{viewport:{x:0,y:0,zoom:1},nodes:[n]}};view.cardToolbarObstacles=[];
  view.controlStageSize={width:900,height:600};view.connectionCandidates=[n];view[marker]=n.id;
  view.mountControls(n,element,{register:(dispose:()=>void)=>disposers.push(dispose)});
  f.style.width='420px';f.style.height='470px';f.writes.length=0;
  for(const type of ['focusout','focusin','pointerenter']){
   element.dispatchEvent(new Event(type));
   assert.equal(view[marker],n.id,'moving focus does not finish the retained inline draft');
   assert.deepEqual([f.style.width,f.style.height],['420px','470px'],`${kind} ${marker} ${type}: live draft geometry must survive`);
   assert.ok(!f.writes.includes('width')&&!f.writes.includes('height'),'dock events must not reset an expanded editor');
  }
  assert.deepEqual(n,before,'presentation must not write the draft dimensions into the source');
  assert.ok(Number.isFinite(parseFloat(f.properties.get('--ts-control-top')!)),'dock placement still updates');
  disposers.forEach(dispose=>dispose());
 }
});

test('dock events still synchronize a different node and released inline drafts, with cleanup',()=>{
 const view=new ControlView(),f=surface(),n=node({x:45,y:65}),classes=f.classes;
 const element=Object.assign(new EventTarget(),f.element,{
  querySelector:()=>null,isConnected:true,ownerDocument:{activeElement:null},contains:()=>false,
  classList:{contains:(name:string)=>classes.has(name),add:(name:string)=>classes.add(name),remove:(name:string)=>classes.delete(name)},
 });
 const disposers:(()=>void)[]=[];
 view.selected=new Set([n.id]);view.session={board:{viewport:{x:0,y:0,zoom:1},nodes:[n]}};view.cardToolbarObstacles=[];
 view.controlStageSize={width:900,height:600};view.connectionCandidates=[n];view.inlineId='another';view.inlineTarget='another';
 view.mountControls(n,element,{register:(dispose:()=>void)=>disposers.push(dispose)});
 f.style.width='420px';f.style.height='470px';element.dispatchEvent(new Event('focusin'));
 assert.deepEqual([f.style.left,f.style.top,f.style.width,f.style.height],['45px','65px','300px','180px']);
 view.inlineId=n.id;f.style.width='420px';f.style.height='470px';element.dispatchEvent(new Event('focusout'));
 assert.deepEqual([f.style.width,f.style.height],['420px','470px']);
 view.inlineId=undefined;view.inlineTarget=undefined;element.dispatchEvent(new Event('focusout'));
 assert.deepEqual([f.style.width,f.style.height],['300px','180px'],'after editing ends the source geometry applies again');
 disposers.forEach(dispose=>dispose());f.writes.length=0;
 for(const type of ['focusout','focusin','pointerenter'])element.dispatchEvent(new Event(type));
 assert.deepEqual(f.writes,[],'unloaded scopes cannot position stale nodes');
});

test('folded section presentation tracks compact geometry without mutating logical bounds',()=>{
 const view=new View(),f=surface(),n=node({kind:'section',sectionFolded:true,width:800,height:600}),before=structuredClone(n),display=sectionDisplayNode(n);
 view.positionNode(n,f.element);assert.equal(f.style.width,`${display.width}px`);assert.equal(f.style.height,`${display.height}px`);assert.deepEqual(n,before);
 delete n.sectionFolded;view.positionNode(n,f.element);assert.equal(f.style.width,'800px');assert.equal(f.style.height,'600px');
});

test('the measured footer band participates in the cached touch entry reservation',()=>{
 const view=new View(),f=surface(),n=node({x:60,y:140,width:160,height:100}),viewport={x:0,y:0,zoom:1};
 view.stage={parentElement:{classList:{contains:(name:string)=>name==='ts-touch-card-controls'}}};view.session={board:{viewport}};view.controlStageSize={width:346,height:296};view.cardToolbarObstacles=[];view.connectionCandidates=[n];
 view.cardFooterObstacle={x:0,y:195,width:346,height:101};f.element.dataset.controlCount='5';f.element.dataset.controlWidth='236';
 view.positionNode(n,f.element);const request=view.cardControlRequests.get(n.id);assert.ok(request);assert.ok(request.dimensions.avoid.includes(view.cardFooterObstacle));
 assert.equal(f.element.dataset.touchControls,'true');assert.equal(f.element.dataset.controlDisplay,'entry');assert.deepEqual([f.style.left,f.style.top,f.style.width,f.style.height],['60px','140px','160px','100px']);
});

for(const entry of [false,true])test(`initial touch presentation preserves an exact focused ${entry?'entry':'action'} before reservation`,()=>{
 const view=new View(),f=surface(),n=node({x:60,y:140,width:160,height:100}),viewport={x:0,y:0,zoom:1};
 const control={classList:{contains:(name:string)=>entry&&name==='ts-card-control-entry'}},doc={activeElement:control};
 Object.assign(f.element,{ownerDocument:doc,contains:(target:unknown)=>target===control});
 const data=f.element.dataset;f.element.dataset=new Proxy(data,{set(target,key,value){if(key==='touchControls'&&value==='true')assert.equal(target.controlDisplay,entry?'entry':'full','CSS must receive the focus-preserving state before touch mode');return Reflect.set(target,key,value);}});
 view.stage={parentElement:{classList:{contains:(name:string)=>name==='ts-touch-card-controls'}}};view.session={board:{viewport}};view.controlStageSize={width:346,height:700};view.cardToolbarObstacles=[];view.connectionCandidates=[n];
 f.element.dataset.controlCount='5';f.element.dataset.controlWidth='236';view.positionNode(n,f.element);
 assert.equal(doc.activeElement,control);assert.equal(f.element.dataset.controlDisplay,entry?'entry':'full');assert.deepEqual([n.x,n.y,n.width,n.height],[60,140,160,100]);
});

test('mounted context-owned touch cards refresh local port and reading scales during camera-only zoom',()=>{
 const view=new View(),f=surface(),n=node(),viewport={x:0,y:0,zoom:1},before=structuredClone(n);
 let portScale='1',touch=true,owned=true;
 view.world={style:{getPropertyValue:(name:string)=>{assert.equal(name,'--ts-port-scale');return portScale;}}};
 view.stage={parentElement:{classList:{contains:(name:string)=>touch&&name==='ts-touch-card-controls'}}};
 view.session={board:{viewport,nodes:[n]}};view.selected=new Set([n.id]);view.controlStageSize={width:820,height:1180};view.cardToolbarObstacles=[];
 view.cardControlContext={owns:(el:unknown)=>owned&&el===f.element};
 f.element.dataset.touchControls='false';f.properties.set('--ts-port-scale','1');f.properties.set('--ts-control-scale','1');f.properties.set('--ts-control-top','-200px');f.properties.set('--ts-control-right','-50px');
 for(const zoom of [1,.5,.25,1,2,3]){
  viewport.zoom=zoom;portScale=String(1/Math.min(1,zoom));const camera=structuredClone(viewport);view.positionNode(n,f.element);
  assert.equal(f.element.dataset.touchControls,'true','fine-to-touch context borrowing updates the existing reading target');
  assert.equal(f.properties.get('--ts-port-scale'),portScale);assert.equal(f.properties.get('--ts-control-scale'),String(1/zoom));
  assert.equal(Number(f.properties.get('--ts-control-scale'))*zoom*44,44,'reading target keeps its full screen size');
  assert.equal(f.properties.get('--ts-control-top'),'-200px');assert.equal(f.properties.get('--ts-control-right'),'-50px','borrowed controls are not repositioned');
  assert.deepEqual(n,before);assert.deepEqual(viewport,camera);
  f.writes.length=0;viewport.x+=10;view.positionNode(n,f.element);assert.deepEqual(f.writes,[],'same-zoom pan writes no host presentation');
 }
 // Production syncCardControlContext releases borrowed controls before a fine-pointer layout.
 touch=false;owned=false;view.positionNode(n,f.element);
 const expected=cardControlLayout(n,viewport,820,1180,5,{width:164,height:36,topReserve:60,screenGap:24});
 assert.equal(f.element.dataset.touchControls,'false');assert.equal(f.properties.get('--ts-control-scale'),String(expected.scale));
 assert.equal(f.properties.get('--ts-control-top'),`${expected.top}px`);assert.equal(f.properties.get('--ts-control-right'),`${expected.right}px`);
 assert.equal(f.properties.get('--ts-port-scale'),portScale);assert.deepEqual(n,before);
});
