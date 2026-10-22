import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import postcss from 'postcss';

const source=readFileSync('src/main.ts','utf8');
const start=source.indexOf('      // Compact only this ordinary canvas'),end=source.indexOf('      // Dedicated handwriting',start);
assert.ok(start>0&&end>start);
const update=new Function('main','root','footer','focused','ownsFocus','BoardView',transformSync(source.slice(start,end),{loader:'ts'}).code);
function fixture(){
 const doc:any={activeElement:null,defaultView:{closed:false},body:{tagName:'BODY'},focused:true,hasFocus:()=>doc.focused},calls:unknown[]=[],classes=new Set(['ts-board-layout']);let onToggle=()=>{},afterHide=()=>{},anchorRead=()=>{};
 const main:any={ownerDocument:doc,clientWidth:346,clientHeight:296,classList:{contains:(s:string)=>classes.has(s),toggle:(s:string,value:boolean)=>{if(value)classes.add(s);else classes.delete(s);onToggle();}}};
 const controls:any[]=[],root:any={ownerDocument:doc,isConnected:true,contains:(e:unknown)=>e===main||e===footer||controls.includes(e)};
 const button=(secondary=false)=>{const b:any={tagName:'BUTTON',ownerDocument:doc,isConnected:true,preHidden:false,closest:(s:string)=>s==='.ts-footer-secondary'&&secondary?b:null,getClientRects:()=>{if(classes.has('ts-compact-footer')&&secondary)afterHide();return b.preHidden||!b.isConnected||secondary&&classes.has('ts-compact-footer')?[]:[{width:44,height:44}];}};controls.push(b);return b;};
 const zoom:any=button(),zoomRects=zoom.getClientRects;zoom.getClientRects=()=>{if(classes.has('ts-compact-footer'))anchorRead();return zoomRects();};zoom.focus=(options:unknown)=>{calls.push(options);doc.activeElement=zoom;};
 const secondary=button(true),primary=button(),footer:any={ownerDocument:doc,contains:(e:unknown)=>controls.includes(e)};
 const camera={x:30,y:-19,zoom:1.25},session={file:{path:'synthetic.md'},board:{viewport:camera},blocked:false},view:any={session,contentEl:root,zoomLabel:zoom};view.leaf={view};view.activeView=view;view.app={workspace:{getActiveViewOfType:()=>view.activeView}};
 return{doc,main,root,footer,view,classes,calls,secondary,primary,zoom,camera,button,setToggle:(fn:()=>void)=>{onToggle=fn;},setAfterHide:(fn:()=>void)=>{afterHide=fn;},setAnchorRead:(fn:()=>void)=>{anchorRead=fn;},run:(ownsFocus=true)=>update.call(view,main,root,footer,doc.activeElement,ownsFocus,class BoardView{})};
}
test('actual compact block uses positive ordinary pane geometry, not viewport or pointer capability',()=>{
 for(const [width,height,ordinary,expected] of [[260,296,true,true],[480,359,true,true],[481,296,true,false],[346,360,true,false],[0,296,true,false],[346,0,true,false],[346,296,false,false]] as const){
  const f=fixture();f.main.clientWidth=width;f.main.clientHeight=height;if(!ordinary)f.classes.delete('ts-board-layout');f.run();assert.equal(f.classes.has('ts-compact-footer'),expected);assert.deepEqual(f.calls,[]);assert.deepEqual(f.camera,{x:30,y:-19,zoom:1.25});
 }
});
for(const label of ['fit','selected focus','overview'])test('only the original focused secondary transfers on its actual concealment: '+label,()=>{
 const f=fixture(),refs=[f.secondary,f.zoom,f.camera];f.doc.activeElement=f.secondary;f.run();assert.equal(f.doc.activeElement,f.zoom);assert.deepEqual(f.calls,[{preventScroll:true}]);assert.deepEqual([f.secondary,f.zoom,f.camera],refs);f.run();assert.equal(f.calls.length,1);
 f.main.clientHeight=760;f.run();assert.equal(f.classes.has('ts-compact-footer'),false);assert.equal(f.doc.activeElement,f.zoom);assert.equal(f.calls.length,1);assert.equal(f.secondary.getClientRects().length,1);
});
for(const condition of ['body','primary','IME textarea','already hidden','foreign control document','blocked','closed','closing','other leaf view','other content root','other active owner','focus moved during toggle','session moved during toggle','disconnected menu entry','foreign menu document'])test('compact footer does not steal focus: '+condition,()=>{
 const f=fixture();f.doc.activeElement=f.secondary;
 if(condition==='body')f.doc.activeElement={closest:()=>null};if(condition==='primary')f.doc.activeElement=f.primary;
 if(condition==='IME textarea')f.secondary.tagName='TEXTAREA';if(condition==='already hidden')f.secondary.preHidden=true;
 if(condition==='foreign control document')f.secondary.ownerDocument={};if(condition==='blocked')f.view.session.blocked=true;
 if(condition==='closed')f.view.closed=true;if(condition==='closing')f.view.closing=true;if(condition==='other leaf view')f.view.leaf.view={};
 if(condition==='other content root')f.view.contentEl={};if(condition==='focus moved during toggle')f.setToggle(()=>{f.doc.activeElement=f.primary;});
 if(condition==='session moved during toggle')f.setToggle(()=>{f.view.session={};});if(condition==='disconnected menu entry')f.zoom.isConnected=false;if(condition==='foreign menu document')f.zoom.ownerDocument={};
 f.run(condition!=='other active owner');assert.deepEqual(f.calls,[]);assert.deepEqual(f.camera,{x:30,y:-19,zoom:1.25});
});

const invalidations:Record<string,(f:ReturnType<typeof fixture>)=>void>={
 'closed':f=>{f.view.closed=true;},'closing':f=>{f.view.closing=true;},'blocked':f=>{f.view.session.blocked=true;},
 'session replaced':f=>{f.view.session={};},'path changed':f=>{f.view.session.file.path='another.md';},
 'leaf replaced':f=>{f.view.leaf={view:f.view};},'leaf view changed':f=>{f.view.leaf.view={};},
 'content root replaced':f=>{f.view.contentEl={};},'root disconnected':f=>{f.root.isConnected=false;},
 'root document changed':f=>{f.root.ownerDocument={};},'main document changed':f=>{f.main.ownerDocument={};},
 'footer document changed':f=>{f.footer.ownerDocument={};},'footer detached':f=>{f.root.contains=()=>false;},
 'owner window closed':f=>{f.doc.defaultView.closed=true;},'owner window changed':f=>{f.doc.defaultView={closed:false};},
 'anchor replaced':f=>{f.view.zoomLabel=f.button();},'anchor disconnected':f=>{f.zoom.isConnected=false;},
 'anchor document changed':f=>{f.zoom.ownerDocument={};},'secondary disconnected':f=>{f.secondary.isConnected=false;},
 'secondary document changed':f=>{f.secondary.ownerDocument={};},'controls reparented':f=>{f.footer.contains=()=>false;},
 'document focus lost':f=>{f.doc.focused=false;},'active board changed':f=>{f.view.activeView={};},
 'body editor focused':f=>{f.doc.activeElement={tagName:'TEXTAREA'};},'primary focused':f=>{f.doc.activeElement=f.primary;},
 'ordinary mode removed':f=>{f.classes.delete('ts-board-layout');},'editable body focused':f=>{f.doc.body.isContentEditable=true;f.doc.activeElement=f.doc.body;},
 'null focus':f=>{f.doc.activeElement=null;},'null body and focus':f=>{f.doc.body=null;f.doc.activeElement=null;},
};
for(const phase of ['toggle','secondary layout','anchor layout'])for(const [name,invalidate] of Object.entries(invalidations))test('post-layout owner invalidation prevents focus: '+phase+' / '+name,()=>{
 const f=fixture();f.doc.activeElement=f.secondary;
 const hook=()=>invalidate(f);if(phase==='toggle')f.setToggle(hook);else if(phase==='secondary layout')f.setAfterHide(hook);else f.setAnchorRead(hook);
 f.run();assert.deepEqual(f.calls,[]);assert.deepEqual(f.camera,{x:30,y:-19,zoom:1.25});
});
for(const phase of ['toggle','secondary layout','anchor layout'])test('a visible original secondary falling to body transfers to the captured anchor after all layout reads: '+phase,()=>{
 const f=fixture();f.doc.activeElement=f.secondary;const originalAnchor=f.zoom;
 const hook=()=>{f.doc.activeElement=f.doc.body;};if(phase==='toggle')f.setToggle(hook);else if(phase==='secondary layout')f.setAfterHide(hook);else f.setAnchorRead(hook);
 f.run();assert.equal(f.doc.activeElement,originalAnchor);assert.deepEqual(f.calls,[{preventScroll:true}]);
});
test('an original body focus never qualifies for the hidden-secondary body fallback',()=>{const f=fixture();f.doc.body.closest=()=>null;f.doc.activeElement=f.doc.body;f.run();assert.deepEqual(f.calls,[]);assert.equal(f.doc.activeElement,f.doc.body);});
test('an already compact pane does not repeat focus handoff',()=>{const f=fixture();f.classes.add('ts-compact-footer');f.doc.activeElement=f.secondary;f.run();assert.deepEqual(f.calls,[]);});
test('a secondary kept visible by style does not hand off focus',()=>{const f=fixture();f.doc.activeElement=f.secondary;f.secondary.getClientRects=()=>[{width:44,height:44}];f.run();assert.deepEqual(f.calls,[]);assert.equal(f.doc.activeElement,f.secondary);});
test('an anchor hidden during compaction never receives focus',()=>{const f=fixture();f.doc.activeElement=f.secondary;f.setToggle(()=>{f.zoom.preHidden=true;});f.run();assert.deepEqual(f.calls,[]);});

const zoomSource=source.slice(source.indexOf('  private zoomPresets()'),source.indexOf('  private chooseObjects()',source.indexOf('  private zoomPresets()')));
class Menu{
 static last:Menu;items:any[]=[];position:unknown;document:unknown;
 constructor(){Menu.last=this;}setUseNativeMenu(){return this;}
 addSeparator(){return this;}addItem(fn:(i:any)=>void){const i:any={setTitle(v:unknown){this.title=v;return this;},setIcon(){return this;},setDisabled(v:boolean){this.disabled=v;return this;},setChecked(v:boolean){this.checked=v;return this;},onClick(run:()=>void){this.run=run;return this;}};fn(i);this.items.push(i);return this;}
 showAtPosition(position:unknown,document:unknown){this.position=position;this.document=document;}
}
const ZoomView=new Function('Menu',transformSync(`class View{${zoomSource}};return View`,{loader:'ts'}).code)(Menu);
function menuFixture(){
 const view=new ZoomView(),doc={defaultView:{closed:false}},calls:string[]=[],camera={x:5,y:6,zoom:1};
 const anchor={isConnected:true,ownerDocument:doc,getBoundingClientRect:()=>({left:106,top:284})},overview={isConnected:true,ownerDocument:doc,disabled:false,getAttribute:()=> '显示白板总览',click:()=>calls.push('original-overview-click')};
 Object.assign(view,{session:{file:{path:'synthetic.md'},board:{viewport:camera}},leaf:{view},contentEl:{ownerDocument:doc},zoomLabel:anchor,overviewToggle:overview,selected:new Set(['a']),focusSelection:()=>calls.push('focus'),fit:()=>calls.push('fit'),rememberViewport:()=>calls.push('remember'),zoom:()=>calls.push('zoom')});
 view.zoomPresets();return{view,doc,anchor,overview,calls,camera,menu:Menu.last};
}
test('the existing ratio menu keeps one focus and fit action and adds the original overview route',()=>{
 const f=menuFixture();assert.equal(f.menu.items.filter(i=>i.title==='适应全部内容').length,1);assert.equal(f.menu.items.filter(i=>i.title==='聚焦所选 · Shift+F').length,1);assert.equal(f.menu.items.filter(i=>/^[\d.]+%$/.test(i.title)).length,6);assert.deepEqual(f.calls,[]);assert.deepEqual(f.camera,{x:5,y:6,zoom:1});
 f.menu.items.find(i=>i.title==='显示白板总览').run();assert.deepEqual(f.calls,['original-overview-click']);assert.equal(f.menu.document,f.doc);assert.deepEqual(f.menu.position,{x:106,y:12});
});
for(const condition of ['session','path','closed','closing','blocked','leaf','anchor replaced','anchor retired','anchor document','content document','owner window closed'])test('every captured menu command stays inert after owner invalidation: '+condition,()=>{
 const f=menuFixture();if(condition==='session')f.view.session={};if(condition==='path')f.view.session.file.path='other.md';if(condition==='closed')f.view.closed=true;if(condition==='closing')f.view.closing=true;if(condition==='blocked')f.view.session.blocked=true;if(condition==='leaf')f.view.leaf.view={};if(condition==='anchor replaced')f.view.zoomLabel={};if(condition==='anchor retired')f.anchor.isConnected=false;if(condition==='anchor document')f.anchor.ownerDocument={} as any;if(condition==='content document')f.view.contentEl.ownerDocument={};if(condition==='owner window closed')f.doc.defaultView.closed=true;
 for(const item of f.menu.items)item.run();assert.deepEqual(f.calls,[]);assert.deepEqual(f.camera,{x:5,y:6,zoom:1});
});
for(const condition of ['replaced','retired','foreign','disabled'])test('overview invokes only the retained available original button: '+condition,()=>{
 const f=menuFixture();if(condition==='replaced')f.view.overviewToggle={};if(condition==='retired')f.overview.isConnected=false;if(condition==='foreign')f.overview.ownerDocument={} as any;if(condition==='disabled')f.overview.disabled=true;
 f.menu.items.find(i=>i.title==='显示白板总览').run();assert.deepEqual(f.calls,[]);
});
test('no selection disables the existing focus entry without removing fit, scale or overview',()=>{const f=menuFixture();f.view.selected.clear();f.view.zoomPresets();assert.equal(Menu.last.items[0].disabled,true);Menu.last.items[0].run();assert.deepEqual(f.calls,[]);assert.equal(Menu.last.items.length,9);});

const css=postcss.parse(readFileSync('src/canvas-dock.css','utf8'));
test('all compact CSS is scoped to the class applied from actual ordinary pane geometry',()=>{
 const rules:any[]=[];css.walkRules(r=>{if(r.selector.includes('ts-compact-footer'))rules.push(r);});assert.equal(rules.length,6);
 for(const r of rules)assert.ok(r.selector.startsWith('.ts-root .ts-main.ts-board-layout.ts-compact-footer > .ts-footer '));
 const declarations=(part:string)=>Object.fromEntries(rules.find(r=>r.selector.endsWith(part)).nodes.filter((n:any)=>n.type==='decl').map((n:any)=>[n.prop,n.value]));
 assert.deepEqual(declarations('.ts-view-dock'),{padding:'3px',gap:'0'});
 const button=declarations('.ts-view-dock .ts-button');for(const k of ['width','min-width','height','min-height'])assert.equal(button[k],'44px');
 assert.equal(declarations('.ts-footer-secondary').display,'none');assert.equal(declarations('.ts-canvas-settings-toggle > span:last-child').display,'none');
 assert.equal(declarations('.ts-camera-controls')['border-inline-start'],'0');
});
test('declared minimum width preserves four primary targets inside a real 260px coarse pane',()=>{
 const dock=44+(44+46+44+2*2)+2*3+2;assert.equal(dock,190);assert.equal(260-54-2*8,dock);
 const old=64+6+(8+1)+(44+46+44+44+3*2)+(44+4+2)+2*5+2;assert.equal(old,325);assert.ok(old>390-44-54-16);
 assert.equal(44+2*3+2,52);assert.equal(67-52,15);
 // This arithmetic is a declared CSS budget, never a rendered result.
});
