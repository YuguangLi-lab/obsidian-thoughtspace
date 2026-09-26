import {childConnectionCandidates} from '../src/branch-disclosure';
import {textFitsContent} from '../src/text-sizing';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';
const source=readFileSync('src/main.ts','utf8');
const code=source.slice(source.indexOf('  private contextMenu(e:'),source.indexOf('  private clearCanvasGesture()',source.indexOf('  private contextMenu(e:')));
class File {path='note.md'}
class NativeMenu {
 static shown:NativeMenu[]=[];items:any[]=[];event:any;hidden=false;
 addItem(fn:any){const item:any={setTitle(v:any){this.title=v;return this},setIcon(){return this},setDisabled(v:any){this.disabled=v;return this},onClick(v:any){this.run=v;return this}};fn(item);this.items.push(item);return this;}
 addSeparator(){return this;}showAtMouseEvent(e:any){this.event=e;NativeMenu.shown.push(this);return this;}hide(){this.hidden=true;}onHide(){}
}
const View=new Function('Menu','TFile','act','branchState','childConnectionCandidates','textFitsContent',transformSync('class View{'+code+'}\nreturn View',{loader:'ts'}).code)(NativeMenu,File,(fn:any)=>fn(),()=>({parents:new Map(),children:new Map()}),childConnectionCandidates,textFitsContent);
function fixture(kind='card',count=1){NativeMenu.shown=[];const file=new File();const view=new View();view.session={blocked:false,board:{nodes:Array.from({length:count},(_,i)=>({id:String(i),kind,file:file.path})),edges:[]},change:(fn:any)=>fn(view.session.board)};view.selected=new Set(count>1?view.session.board.nodes.map((n:any)=>n.id):[]);view.app={vault:{getAbstractFileByPath:()=>file}};view.clearCanvasGesture=()=>{};view.finishMarquee=()=>{};view.stage={removeClass(){},focus(){}};view.point=(x:any,y:any)=>({x,y});view.updateSelection=()=>{};view.positions=new Map();view.requireOwner=()=>view.session;const event={clientX:112,clientY:246,preventDefault(){},stopPropagation(){},target:{closest:(s:string)=>s==='[data-id]'?{getAttribute:()=> '0'}:null}};return{view,event};}
test('right click opens native menu at original mouse event, not fixed inspector',()=>{const{view,event}=fixture();view.contextMenu(event);assert.equal(NativeMenu.shown.length,1);assert.equal(NativeMenu.shown[0].event,event);assert.equal(view.contextOpen,false);});
test('card menu is compact and separates card title from file rename',()=>{const{view,event}=fixture();view.contextMenu(event);const titles=NativeMenu.shown[0]?.items.map(i=>i.title)||[];assert.ok(titles.includes('修改卡片标题'));assert.ok(titles.includes('编辑卡片'));assert.ok(titles.includes('右侧打开笔记'));assert.ok(!titles.includes('重命名笔记'));assert.ok(titles.length<=12);});
test('reopening closes prior menu; stale board callbacks cannot mutate current board',()=>{const{view,event}=fixture();view.contextMenu(event);const first=NativeMenu.shown[0];assert.ok(first);view.contextMenu(event);assert.ok(first.hidden);let removed=false;view.deleteSelection=()=>removed=true;const remove=NativeMenu.shown[1].items.find(i=>i.title.includes('移出'));view.session={board:{nodes:[],edges:[]}};remove.run();assert.equal(removed,false);});
test('multiple selection retains group and layout operations in compact menu',()=>{const{view,event}=fixture('card',2);view.contextMenu(event);const titles=NativeMenu.shown[0]?.items.map(i=>i.title)||[];assert.ok(titles.includes('建立命名分组框'));assert.ok(titles.includes('整理布局…'));assert.ok(titles.length<=10);});
test('blank canvas actions keep the clicked board coordinates',()=>{const{view,event}=fixture();event.target.closest=()=>null;let at:any;view.newText=(p:any)=>at=p;view.requireOwner=()=>view.session;view.contextMenu(event);const menu=NativeMenu.shown[0];menu.items.find(i=>i.title==='在此添加文本').run();assert.deepEqual(at,{x:112,y:246});let tableAt:any;view.newTable=(p:any)=>tableAt=p;menu.items.find(i=>i.title==='在此添加表格').run();assert.deepEqual(tableAt,{x:112,y:246});assert.ok(menu.items.length<=9);});
test('edge menu includes an explicit collapsible child-link action',()=>{const{view,event}=fixture();view.session.board.edges=[{id:'edge',from:'0',to:'1'}];event.target.closest=(s:string)=>s==='[data-edge]'?{getAttribute:()=> 'edge'}:null;view.contextMenu(event);assert.deepEqual(NativeMenu.shown[0].items.map(i=>i.title),['修改关系说明','连线样式…','允许折叠（设为父子分支）','反转连线方向','删除连线']);});
test('locked and blocked cards disable inline edits without losing read access',()=>{const{view,event}=fixture();view.session.board.nodes[0].locked=true;view.session.blocked=true;view.contextMenu(event);const items=NativeMenu.shown[0].items;assert.equal(items.find(i=>i.title==='修改卡片标题').disabled,true);assert.equal(items.find(i=>i.title==='编辑卡片').disabled,true);assert.equal(items.find(i=>i.title==='编辑标签').disabled,true);assert.equal(items.find(i=>i.title==='右侧打开笔记').disabled,false);});
test('card tag editing remains directly reachable and targets the original note',()=>{const{view,event}=fixture();let edited:string|undefined;view.plugin={editNativeTags:(file:File)=>edited=file.path};view.contextMenu(event);const item=NativeMenu.shown[0].items.find(i=>i.title==='编辑标签');assert.ok(item,'卡片右键菜单必须保留编辑标签入口');assert.equal(item.disabled,false);item.run();assert.equal(edited,'note.md');});

test('missing files disable tag editing and stale menu cannot edit another board note',()=>{const{view,event}=fixture();let calls=0;view.plugin={editNativeTags:()=>calls++};view.contextMenu(event);const item=NativeMenu.shown[0].items.find(i=>i.title==='编辑标签');view.session={board:{nodes:[],edges:[]}};item.run();assert.equal(calls,0);const next=fixture();next.view.app.vault.getAbstractFileByPath=()=>null;next.view.contextMenu(next.event);assert.equal(NativeMenu.shown[0].items.find(i=>i.title==='编辑标签').disabled,true);});

test('child-board context menu can fold and expand the portal at any camera zoom',()=>{const{view,event}=fixture('board');let folded:boolean|undefined;view.foldSelection=(value:boolean)=>folded=value;view.contextMenu(event);NativeMenu.shown.at(-1)!.items.find(i=>i.title==='折叠子白板').run();assert.equal(folded,true);view.session.board.nodes[0].collapsed=true;view.contextMenu(event);NativeMenu.shown.at(-1)!.items.find(i=>i.title==='展开子白板').run();assert.equal(folded,false);});
test('locked child-board portal remains openable but cannot be folded',()=>{const{view,event}=fixture('board');view.session.board.nodes[0].locked=true;view.contextMenu(event);const items=NativeMenu.shown[0].items;assert.equal(items.find(i=>i.title==='折叠子白板').disabled,true);assert.equal(items.find(i=>i.title==='进入子白板').disabled,false);});

test('ordinary outgoing arrow exposes one-click child setup on the parent menu',()=>{
 const{view,event}=fixture('card',2);view.selected=new Set(['0']);
 view.session.board.edges.push({id:'arrow',from:'0',to:'1',label:'',direction:'forward'});
 const calls:any[]=[];view.foldBranches=(...args:any[])=>calls.push(args);
 view.contextMenu(event);const action=NativeMenu.shown[0].items.find(i=>i.title==='设为子节点并折叠');
 assert.ok(action);assert.equal(action.disabled,false);action.run();
 assert.deepEqual([...calls[0][0]],['0']);assert.deepEqual(calls[0].slice(1),[true,'collapse',true]);
});


test('text menu folds only the text body and restores it through the same action',()=>{
 const {view,event}=fixture('text');const values:boolean[]=[];view.foldSelection=(folded:boolean)=>values.push(folded);
 view.contextMenu(event);const fold=NativeMenu.shown.at(-1)!.items.find(i=>i.title==='折叠文本');assert.ok(fold);fold.run();
 view.session.board.nodes[0].collapsed=true;view.contextMenu(event);const expand=NativeMenu.shown.at(-1)!.items.find(i=>i.title==='展开文本');assert.ok(expand);expand.run();assert.deepEqual(values,[true,false]);
});
test('locked text exposes disabled fold and group exposes connection entry',()=>{
 const {view,event}=fixture('text');view.session.board.nodes[0].locked=true;view.contextMenu(event);assert.equal(NativeMenu.shown.at(-1)!.items.find(i=>i.title==='折叠文本')?.disabled,true);
 const group=fixture('section');group.view.contextMenu(group.event);const connect=NativeMenu.shown.at(-1)!.items.find(i=>i.title==='从此处开始连线');assert.ok(connect);assert.equal(connect.disabled,false);connect.run();assert.equal(group.view.connectFrom,'0');assert.equal(group.view.mode,'connect');
});
test('text menu exposes the current auto-height setting beside its fold action',()=>{
 const {view,event}=fixture('text'),calls:unknown[][]=[];view.setTextAutoHeight=(...args:unknown[])=>calls.push(args);
 view.contextMenu(event);let items=NativeMenu.shown.at(-1)!.items,index=items.findIndex(i=>i.title==='折叠文本');assert.equal(items[index+1].title,'自动适应文本高度');items[index+1].run();assert.deepEqual(calls,[['0']]);
 view.session.board.nodes[0].textAutoHeight=true;view.contextMenu(event);items=NativeMenu.shown.at(-1)!.items;index=items.findIndex(i=>i.title==='折叠文本');assert.equal(items[index+1].title,'关闭自动适应高度');items[index+1].run();assert.deepEqual(calls,[['0'],['0']]);
 view.session.board.nodes[0].locked=true;view.contextMenu(event);assert.equal(NativeMenu.shown.at(-1)!.items.find(i=>i.title==='关闭自动适应高度').disabled,true);
});
