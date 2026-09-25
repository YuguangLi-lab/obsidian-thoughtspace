import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

const source=readFileSync('src/main.ts','utf8');
const start=source.indexOf('  private showCanvasBackgroundMenu(');
assert.ok(start>=0,'canvas background menu must remain available from the board');
const method=source.slice(start,source.indexOf('  private syncCanvasControls()',start));

class Item {
  title='';icon='';checked?:boolean;run:()=>unknown=()=>{};
  setTitle(value:string){this.title=value;return this;}
  setIcon(value:string){this.icon=value;return this;}
  setChecked(value:boolean){this.checked=value;return this;}
  onClick(run:()=>unknown){this.run=run;return this;}
}
class Menu {
  static created:Menu[]=[];
  items:Item[]=[];separators=0;native=true;hidden=false;
  position?:{x:number;y:number};document?:object;onHidden?:()=>void;
  constructor(){Menu.created.push(this);}
  setUseNativeMenu(value:boolean){this.native=value;return this;}
  addItem(build:(item:Item)=>unknown){const item=new Item();build(item);this.items.push(item);return this;}
  addSeparator(){this.separators++;return this;}
  onHide(run:()=>void){this.onHidden=run;return this;}
  hide(){this.hidden=true;this.onHidden?.();return this;}
  showAtPosition(position:{x:number;y:number},document:object){this.position=position;this.document=document;return this;}
}
class Anchor {
  isConnected=true;ownerDocument={name:'board popout document'};
  attributes:Record<string,string>={};rect={left:210,top:500};
  setAttribute(name:string,value:string){this.attributes[name]=value;}
  getBoundingClientRect(){return this.rect;}
}
const View=new Function('Menu','act',transformSync(`class View{${method}}\nreturn View;`,{loader:'ts'}).code)(Menu,(run:()=>unknown)=>run());
const kinds={dots:'点阵',grid:'网格',plain:'纯色',paper:'纸张纹理',image:'背景图片'} as const;
type Kind=keyof typeof kinds;
function fixture(kind:Kind='dots',imagePath=''){
  Menu.created=[];
  const view=new View(),anchor=new Anchor(),saved:string[]=[],opened:string[]=[];
  view.closed=false;view.session={board:{id:'original'}};
  view.plugin={settings:{canvasBackground:kind,backgroundImagePath:imagePath},
    async savePreferences(){saved.push(view.plugin.settings.canvasBackground);},
    openPaperSettings(){opened.push('paper');},openBackgroundImageSettings(){opened.push('image');}};
  const open=(target=anchor)=>{view.showCanvasBackgroundMenu(target);return Menu.created.at(-1)!;};
  const item=(menu:Menu,title:string)=>{const found=menu.items.find(value=>value.title===title);assert.ok(found,`missing menu entry: ${title}`);return found;};
  return {view,anchor,saved,opened,open,item};
}

for(const kind of Object.keys(kinds) as Kind[])test(`background menu identifies the current ${kind} background without saving`,()=>{
  const f=fixture(kind),menu=f.open();
  assert.deepEqual(menu.items.filter(item=>item.checked!==undefined).map(item=>[item.title,item.checked]),
    Object.entries(kinds).map(([value,title])=>[title,value===kind]));
  assert.equal(menu.separators,1);assert.equal(menu.items.length,7);
  assert.deepEqual(f.saved,[]);assert.deepEqual(f.opened,[]);
});

test('selecting a different background persists the chosen mode exactly once',async()=>{
  const f=fixture(),menu=f.open();await f.item(menu,'纸张纹理').run();
  assert.equal(f.view.plugin.settings.canvasBackground,'paper');assert.deepEqual(f.saved,['paper']);
  assert.deepEqual(f.opened,[]);
});
test('selecting the current background does not write preferences again',async()=>{
  const f=fixture('grid'),menu=f.open();await f.item(menu,'网格').run();
  assert.equal(f.view.plugin.settings.canvasBackground,'grid');assert.deepEqual(f.saved,[]);
});
test('choosing an image without a saved image opens its settings and preserves the current mode',async()=>{
  const f=fixture('paper'),menu=f.open();await f.item(menu,'背景图片').run();
  assert.equal(f.view.plugin.settings.canvasBackground,'paper');assert.deepEqual(f.saved,[]);assert.deepEqual(f.opened,['image']);
});
test('choosing a previously configured image reuses its path and persists image mode',async()=>{
  const f=fixture('grid','ThoughtSpace/背景/paper.png'),menu=f.open();await f.item(menu,'背景图片').run();
  assert.equal(f.view.plugin.settings.backgroundImagePath,'ThoughtSpace/背景/paper.png');
  assert.equal(f.view.plugin.settings.canvasBackground,'image');assert.deepEqual(f.saved,['image']);assert.deepEqual(f.opened,[]);
});
test('paper and image customization remain separate, directly reachable actions',async()=>{
  const f=fixture(),menu=f.open();await f.item(menu,'自定义纸张…').run();await f.item(menu,'设置背景图片…').run();
  assert.deepEqual(f.opened,['paper','image']);assert.deepEqual(f.saved,[]);assert.equal(f.view.plugin.settings.canvasBackground,'dots');
});

for(const stale of ['closed','board-changed','anchor-removed'] as const)test(`callbacks are inert after ${stale}, including customization actions`,async()=>{
  const f=fixture(),menu=f.open();
  if(stale==='closed')f.view.closed=true;
  if(stale==='board-changed')f.view.session={board:{id:'replacement'}};
  if(stale==='anchor-removed')f.anchor.isConnected=false;
  for(const item of menu.items)await item.run();
  assert.equal(f.view.plugin.settings.canvasBackground,'dots');assert.deepEqual(f.saved,[]);assert.deepEqual(f.opened,[]);
});

test('closed views and removed anchors do not open or allocate a menu',()=>{
  const f=fixture();f.view.closed=true;f.view.showCanvasBackgroundMenu(f.anchor);
  f.view.closed=false;f.anchor.isConnected=false;f.view.showCanvasBackgroundMenu(f.anchor);
  assert.equal(Menu.created.length,0);assert.equal(f.anchor.attributes['aria-expanded'],undefined);
});
test('opening anchors the non-native menu in the correct document and hiding clears its expanded state',()=>{
  const f=fixture(),menu=f.open();assert.equal(menu.native,false);assert.equal(menu.document,f.anchor.ownerDocument);
  assert.deepEqual(menu.position,{x:210,y:212});assert.equal(f.anchor.attributes['aria-expanded'],'true');assert.equal(f.view.canvasMenu,menu);
  menu.hide();assert.equal(f.anchor.attributes['aria-expanded'],'false');assert.equal(f.view.canvasMenu,undefined);
});
test('reopening closes the previous menu and preserves the new anchor expanded state',()=>{
  const f=fixture(),first=f.open(),secondAnchor=new Anchor();secondAnchor.rect.top=100;
  const second=f.open(secondAnchor);assert.equal(first.hidden,true);assert.equal(f.anchor.attributes['aria-expanded'],'false');
  assert.equal(f.view.canvasMenu,second);assert.equal(secondAnchor.attributes['aria-expanded'],'true');
  assert.deepEqual(second.position,{x:210,y:12});
  first.onHidden?.();assert.equal(f.view.canvasMenu,second);assert.equal(secondAnchor.attributes['aria-expanded'],'true');
  second.hide();assert.equal(secondAnchor.attributes['aria-expanded'],'false');assert.equal(f.view.canvasMenu,undefined);
});
test('closing a menu after its anchor is detached does not leave stale expanded state on that anchor',()=>{
  const f=fixture(),menu=f.open();f.anchor.isConnected=false;menu.hide();
  assert.equal(f.view.canvasMenu,undefined);assert.equal(f.anchor.attributes['aria-expanded'],'false');
});
