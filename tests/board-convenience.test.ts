import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {movableSelection,type Board} from '../src/model';
import {moveSelection} from '../src/board-tools';
const source=readFileSync('src/main.ts','utf8');
const key=source.slice(source.indexOf('  private key(e:'),source.indexOf('  private matches(',source.indexOf('  private key(e:')));
const KeyView=new Function('act','movableSelection','moveSelection',transformSync(`class View{${key}};return View`,{loader:'ts'}).code)((fn:()=>void)=>fn(),movableSelection,moveSelection);
function keyFixture(kind='card',mode='board'){
 const v=new KeyView(),calls:unknown[][]=[],stage={closest:()=>null};
 Object.assign(v,{session:{board:{mode,nodes:[{id:'a',kind}],edges:[]}},stage,mode:'select',selected:new Set(['a']),startInlineEdit:(...args:unknown[])=>calls.push(args)});
 const event={key:'F2',code:'F2',target:stage,preventDefault(){},stopPropagation(){},repeat:false,shiftKey:false,altKey:false,ctrlKey:false,metaKey:false};
 return{v,calls,event};
}
for(const kind of ['card','text'])for(const mode of ['board','mindmap'])test(`F2 edits selected ${kind} in ${mode} without changing selection`,()=>{
 const{v,calls,event}=keyFixture(kind,mode);v.key(event);assert.deepEqual(calls,[['a',kind==='text']]);assert.deepEqual([...v.selected],['a']);
});
for(const condition of ['locked','blocked','repeat','composing','modifier','editor','multiple','other-tool','missing'])test(`F2 leaves ${condition} context alone`,()=>{
 const{v,calls,event}=keyFixture();
 if(condition==='locked')v.session.board.nodes[0].locked=true;
 if(condition==='blocked')v.session.blocked=true;
 if(condition==='repeat')event.repeat=true;
 if(condition==='composing')Object.assign(event,{isComposing:true});
 if(condition==='modifier')event.ctrlKey=true;
 if(condition==='editor')event.target={closest:()=>({} as any)};
 if(condition==='multiple')v.selected.add('b');
 if(condition==='other-tool')v.mode='connect';
 if(condition==='missing')v.session.board.nodes=[];
 v.key(event);assert.equal(calls.length,0);
});
for(const kind of ['image','pdf','board','section'])test(`F2 does not open markdown for ${kind}`,()=>{const{v,calls,event}=keyFixture(kind);v.key(event);assert.equal(calls.length,0);});

const zoom=source.slice(source.indexOf('  private zoomPresets()'),source.indexOf('  private chooseObjects()',source.indexOf('  private zoomPresets()')));
class Menu {
 static last:Menu;items:any[]=[];
 constructor(){Menu.last=this;}
 setUseNativeMenu(){return this;}
 addItem(fn:any){const item:any={setTitle(v:any){this.title=v;return this;},setIcon(){return this;},setDisabled(v:any){this.disabled=!!v;return this;},setChecked(v:any){this.checked=v;return this;},onClick(v:any){this.run=v;return this;}};fn(item);this.items.push(item);return this;}
 addSeparator(){return this;}showAtPosition(){}
}
const ZoomView=new Function('Menu',transformSync(`class View{${zoom}};return View`,{loader:'ts'}).code)(Menu);
function zoomFixture(){const v=new ZoomView(),calls:unknown[]=[];Object.assign(v,{session:{board:{viewport:{zoom:.5}}},selected:new Set(['a']),zoomLabel:{getBoundingClientRect:()=>({left:10,top:400})},focusSelection:()=>calls.push('focus'),fit:()=>calls.push('fit'),rememberViewport:()=>calls.push('remember'),zoom:(value:number)=>calls.push(value)});v.zoomPresets();return{v,calls,items:Menu.last.items};}
test('zoom menu exposes selected focus, fit-all and actual-size together',()=>{const{calls,items}=zoomFixture();items[0].run();items[1].run();items.find(i=>i.title==='100%').run();assert.deepEqual(calls,['focus','fit','remember',2]);});
test('zoom menu marks current scale and disables focus with no selection',()=>{const{v}=zoomFixture();v.selected.clear();v.zoomPresets();assert.equal(Menu.last.items[0].disabled,true);assert.equal(Menu.last.items.find(i=>i.title==='50%').checked,true);});
for(const change of ['switched','closed','blocked'])test(`open zoom menu cannot affect ${change} board`,()=>{const{v,calls,items}=zoomFixture();if(change==='switched')v.session={board:{viewport:{zoom:2}}};if(change==='closed')v.closed=true;if(change==='blocked')v.session.blocked=true;for(const item of items)item.run();assert.deepEqual(calls,[]);});
test('zoom choices use latest scale and never act on a removed selection',()=>{const{v,calls,items}=zoomFixture();v.session.board.viewport.zoom=2;v.selected.clear();items[0].run();items.find(i=>i.title==='100%').run();assert.deepEqual(calls,['remember',.5]);});

for(const kind of ['card','text'])test(`Enter edits selected ${kind} on a free board`,()=>{const{v,calls,event}=keyFixture(kind);event.key='Enter';v.key(event);assert.deepEqual(calls,[['a',kind==='text']]);});
test('Enter keeps sibling creation in mindmap mode',()=>{const{v,calls,event}=keyFixture('text','mindmap');const additions:boolean[]=[];v.addTopic=(sibling:boolean)=>additions.push(sibling);event.key='Enter';v.key(event);assert.deepEqual(calls,[]);assert.deepEqual(additions,[true]);});
test('Enter does not edit locked cards or open editors from toolbar controls',()=>{for(const context of ['locked','toolbar','blocked','repeat']){const{v,calls,event}=keyFixture();event.key='Enter';if(context==='locked')v.session.board.nodes[0].locked=true;if(context==='blocked')v.session.blocked=true;if(context==='repeat')event.repeat=true;if(context==='toolbar')event.target={closest:()=>null};v.key(event);assert.deepEqual(calls,[]);}});

test('disabling board quick keys suppresses F, Shift+F, F2 and ordinary Enter',()=>{
 for(const key of ['f','F2','Enter'])for(const shiftKey of [false,true]){
  const f=keyFixture();f.v.plugin={settings:{boardQuickKeys:false}};let views=0;
  f.v.fit=()=>views++;f.v.focusSelection=()=>views++;Object.assign(f.event,{key,shiftKey});
  f.v.key(f.event);assert.deepEqual(f.calls,[]);assert.equal(views,0);
 }
});
test('enabled quick keys preserve fit and focus while missing preferences retain edit defaults',()=>{
 const f=keyFixture();f.v.plugin={settings:{boardQuickKeys:true}};const views:string[]=[];
 f.v.fit=()=>views.push('fit');f.v.focusSelection=()=>views.push('focus');
 f.event.key='f';f.v.key(f.event);f.event.shiftKey=true;f.v.key(f.event);assert.deepEqual(views,['fit','focus']);
 f.v.plugin.settings={};Object.assign(f.event,{key:'F2',shiftKey:false});f.v.key(f.event);assert.deepEqual(f.calls,[['a',false]]);
});
test('disabled board quick keys leave mindmap creation, search and Space pan available',()=>{
 const f=keyFixture('text','mindmap'),created:boolean[]=[];f.v.plugin={settings:{boardQuickKeys:false}};f.v.addTopic=(sibling:boolean)=>created.push(sibling);
 f.event.key='Enter';f.v.key(f.event);f.event.key='Tab';f.v.key(f.event);assert.deepEqual(created,[true,false]);
 let searches=0;f.v.findOnBoard=()=>searches++;Object.assign(f.event,{key:'f',ctrlKey:true});f.v.key(f.event);assert.equal(searches,1);
 Object.assign(f.event,{key:' ',code:'Space',ctrlKey:false});f.v.key(f.event);assert.equal(f.v.space,true);
});
test('quick-key configuration never takes F or Enter from active text inputs',()=>{
 for(const boardQuickKeys of [false,true])for(const key of ['f','F2','Enter']){
  const f=keyFixture();f.v.plugin={settings:{boardQuickKeys}};f.v.fit=()=>assert.fail('active editor must keep its key');
  Object.assign(f.event,{key,target:{closest:()=>({})}});f.v.key(f.event);assert.deepEqual(f.calls,[]);
 }
});

function navigationFixture(){
 const f=keyFixture('text');Object.assign(f.v.session.board.nodes[0],{text:'Keep content',x:10,y:20,width:100,height:60,color:'blue'});
 f.v.plugin={settings:{nudgeStep:2,fastNudge:20}};const actions={moves:0,deletes:0};
 f.v.mutate=(apply:(board:Board)=>void)=>{actions.moves++;apply(f.v.session.board);};f.v.deleteSelection=()=>actions.deletes++;
 return{...f,actions,node:f.v.session.board.nodes[0]};
}
test('disabling arrow nudges prevents ordinary and Shift movement in every direction',()=>{
 for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'])for(const shiftKey of [false,true]){
  const f=navigationFixture();f.v.plugin.settings.arrowNudge=false;Object.assign(f.event,{key,shiftKey});f.v.key(f.event);
  assert.deepEqual([f.node.x,f.node.y],[10,20]);assert.equal(f.actions.moves,0);
 }
});
test('enabled and default arrow settings use configured ordinary and fast nudge distances',()=>{
 for(const arrowNudge of [undefined,true]){
  const f=navigationFixture();f.v.plugin.settings.arrowNudge=arrowNudge;
  f.event.key='ArrowRight';f.v.key(f.event);assert.deepEqual([f.node.x,f.node.y],[12,20]);
  Object.assign(f.event,{key:'ArrowUp',shiftKey:true});f.v.key(f.event);assert.deepEqual([f.node.x,f.node.y],[12,0]);assert.equal(f.actions.moves,2);
 }
});
test('locked selections do not move even when arrow nudges are enabled',()=>{
 const f=navigationFixture();f.v.plugin.settings.arrowNudge=true;f.node.locked=true;f.event.key='ArrowRight';f.v.key(f.event);
 assert.deepEqual([f.node.x,f.node.y],[10,20]);assert.equal(f.actions.moves,0);
});
test('delete-key preference controls both Delete and Backspace, with enabled legacy defaults',()=>{
 for(const deleteKeys of [undefined,true,false])for(const key of ['Delete','Backspace']){
  const f=navigationFixture();f.v.plugin.settings.deleteKeys=deleteKeys;f.event.key=key;f.v.key(f.event);
  assert.equal(f.actions.deletes,deleteKeys===false?0:1);assert.equal(f.actions.moves,0);
 }
});
test('text inputs retain arrow and deletion keys regardless of canvas preferences',()=>{
 for(const enabled of [false,true])for(const key of ['ArrowLeft','ArrowDown','Delete','Backspace']){
  const f=navigationFixture();Object.assign(f.v.plugin.settings,{arrowNudge:enabled,deleteKeys:enabled});
  Object.assign(f.event,{key,target:{closest:()=>({})}});f.v.key(f.event);
  assert.deepEqual(f.actions,{moves:0,deletes:0});assert.deepEqual([f.node.x,f.node.y],[10,20]);
 }
});
test('Shift+Alt+F does not trigger the built-in focus shortcut',()=>{
 const f=navigationFixture();f.v.focusSelection=()=>assert.fail('Alt chord must stay available for custom shortcuts');f.v.fit=()=>assert.fail('Alt chord must not fit');
 Object.assign(f.event,{key:'F',shiftKey:true,altKey:true});f.v.key(f.event);assert.deepEqual(f.actions,{moves:0,deletes:0});
});
