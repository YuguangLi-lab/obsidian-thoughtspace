import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {branchState,unfoldAncestors} from '../src/mindmap';
import {foldCards} from '../src/board-tools';
import {markdownEdit} from '../src/markdown-edit';

const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,`Missing method range: ${start}`);
 return source.slice(a,b);
}
const methods=take('  private requireOwner(','  private canCreateBlankText(')
 +take('  private addFile(','  toggleMindmap(')
 +take('  async newText(','  editText(')
 +take('  private endInline(','  private finishInlineForNavigation(')
 +take('  private async startInlineEdit(','  promptTextToNote(')
 +take('  revealNode(','  async copyDeepLink(');

// Execute the actual creation, editing and reveal paths. Only Obsidian's host,
// rendered element and editor are substitutes; camera updates stay real.
function fixture(zoom=1){
 let seq=0;
 const calls={clear:0,active:0,selection:0,render:0,remember:0,transform:0,persist:0,nativeWrites:0,createdFiles:0,focus:[] as unknown[],ranges:[] as number[][],editors:[] as any[],sizes:[] as {width:number;height:number}[],fits:[] as ((size:{width:number;height:number})=>void)[]};
 class TFile {extension='md';content='A note';constructor(readonly path:string){}}
 class InlineNodeEditor {
  input=Object.assign(new EventTarget(),{focus:(options?:unknown)=>calls.focus.push(options),setSelectionRange:(from:number,to:number)=>calls.ranges.push([from,to])});
  el={contains:()=>false};saving=false;
  constructor(_el:unknown,readonly options:any){calls.editors.push(this);}
  dispose(){this.options.dispose?.();}
  syncGeometry(){}
 }
 const deps={TFile,InlineNodeEditor,InlineCardFit:class {schedule(){}dispose(){}},InlineTextFit:class {constructor(_app:unknown,_body:unknown,_path:unknown,_node:unknown,apply:(size:{width:number;height:number})=>void){calls.fits.push(apply);}schedule(){}async flush(){}dispose(){}},markdownEdit,uid:()=>`new-${++seq}`,fitTextNode:()=>{},
  readCurrentNativeNote:(_app:unknown,file:TFile)=>read(file),
  branchState,unfoldAncestors,foldCards,
  writeNativeNoteDraft:async(_app:unknown,file:TFile,original:string,value:string,validate:()=>unknown)=>{calls.nativeWrites++;validate();assert.equal(file.content,original);file.content=value;},
  Notice:class {},isPdfFile:()=>false,
 };
 const View=new Function(...Object.keys(deps),transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
 const view=new View(),files=new Map<string,TFile>();
 const board={version:3,mode:'free',viewport:{x:123,y:-87,zoom},nodes:[] as any[],edges:[]};
 const owner={board,file:new TFile('Boards/example.thoughtspace'),blocked:false,change:(apply:(b:any)=>void)=>apply(board),persist:()=>calls.persist++};
 let read:(file:TFile)=>Promise<string>=async file=>file.content;
 const addFile=(path='note.md')=>{const file=new TFile(path);files.set(path,file);return file;};
 Object.assign(view,{session:owner,closed:false,inlineStart:0,positions:new Map(),pendingFits:new Map(),selected:new Set(),
  selectedEdge:'old-edge',mode:'connect',connectFrom:'old',connectSide:'right',contextOpen:true,
  stage:{clientWidth:1000,clientHeight:800,removeClass(){},focus:(options?:unknown)=>calls.focus.push(options)},
  connectButton:{removeClass(){}},leaf:{},contentEl:{ownerDocument:{activeElement:null,body:{}}},
  app:{vault:{getAbstractFileByPath:(path:string)=>files.get(path)},workspace:{setActiveLeaf(){calls.active++;}}},
  plugin:{settings:{defaultTextSize:18,defaultCardWidth:300,cardFolder:'Cards'},
   createUnique:async()=>{calls.createdFiles++;return addFile(`Cards/new-${files.size}.md`);}},
  point:()=>({x:250,y:180}),clearCanvasGesture:()=>calls.clear++,updateSelection:()=>calls.selection++,
  rememberViewport:()=>calls.remember++,transform:()=>calls.transform++,renderSelectionTools(){},
  nodeAppearanceKey:()=>'',nodeMeasureKey:()=>'',
  applyInlineSize:(_id:string,size:{width:number;height:number})=>calls.sizes.push(size),
  renderBoard(){calls.render++;view.positions.clear();const hidden=branchState(board as any).hidden;for(const n of board.nodes)if(!hidden.has(n.id)||n.id===view.inlineId||n.id===view.inlineTarget)view.positions.set(n.id,{querySelector:()=>({})});},
  mutate:(apply:(b:any)=>void)=>apply(board),
 });
 const node=(kind='text',patch:any={})=>{const n={id:`node-${board.nodes.length}`,kind,text:'Draft',x:450,y:290,width:100,height:60,...(kind==='card'?{file:addFile().path}:{}),...patch};board.nodes.push(n);return n;};
 return{view,owner,board,calls,node,files,setRead:(next:typeof read)=>{read=next;}};
}

for(const zoom of [.15,.5,1,2.5])for(const kind of ['text','card'])test(`new ${kind} editing preserves the camera at zoom ${zoom}`,async()=>{
 const f=fixture(zoom),n=f.node(kind),camera=f.board.viewport,before={...camera};
 await f.view.startInlineEdit(n.id,false,true);
 assert.equal(f.board.viewport,camera);assert.deepEqual(f.board.viewport,before);
 assert.equal(f.view.inlineId,n.id);assert.equal(f.calls.editors.length,1);
 assert.deepEqual([...f.view.selected],[n.id]);assert.equal(f.view.selectedEdge,undefined);
 assert.equal(f.view.mode,'select');assert.equal(f.view.connectFrom,undefined);assert.equal(f.view.connectSide,undefined);
 assert.equal(f.calls.active,1);assert.equal(f.calls.remember,0);assert.equal(f.calls.transform,0);assert.equal(f.calls.persist,0);
});

test('new table is an in-place Markdown text node with selected first header, without a note file',async()=>{
 const f=fixture(.25),before={...f.board.viewport},template=markdownEdit('',0,0,'table');
 await f.view.newTable({x:650,y:140});
 assert.equal(f.board.nodes.length,1);const table=f.board.nodes[0],editor=f.calls.editors[0];
 assert.equal(table.kind,'text');assert.equal(table.text,template.text);assert.equal(table.file,undefined);assert.equal(table.x,610);assert.equal(table.y,110);
 assert.equal(table.autoSize,true);assert.equal(editor.options.markdown,true);assert.equal(editor.options.nodeKind,'text');assert.equal(editor.options.contextFile,f.owner.file);assert.equal(editor.options.file,undefined);
 assert.deepEqual(f.calls.ranges,[[template.start,template.end]]);assert.deepEqual(f.board.viewport,before);assert.equal(f.calls.createdFiles,0);assert.equal(f.calls.nativeWrites,0);assert.equal(f.calls.remember,0);
});

test('edited Markdown text and tables persist only to their owning board node',async()=>{
 const f=fixture(),n=f.node(),untouched=f.node('card'),note=f.files.get(untouched.file)!,originalNote=note.content;
 await f.view.startInlineEdit(n.id,false,true);const editor=f.calls.editors[0],markdown='## 标题\n\n公式 $x^2$\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';
 await editor.options.save(markdown);
 assert.equal(n.text,markdown);assert.equal(n.kind,'text');assert.equal(n.file,undefined);assert.equal(note.content,originalNote);
 assert.equal(f.calls.nativeWrites,0);assert.equal(f.calls.createdFiles,0);assert.equal(f.view.inline,undefined);
});

test('native text editing can expand for source syntax without persisting its temporary height',async()=>{
 const f=fixture(),n=f.node();await f.view.startInlineEdit(n.id,false,true);const editor=f.calls.editors[0];
 f.calls.fits[0]({width:280,height:190});editor.options.temporaryHeight(360);
 assert.deepEqual(f.calls.sizes.at(-1),{width:280,height:360});assert.equal(n.height,60);
 await editor.options.save('## Saved Markdown');assert.equal(n.width,280);assert.equal(n.height,190);
 const count=f.calls.sizes.length;editor.options.temporaryHeight(400);assert.equal(f.calls.sizes.length,count);
});

test('temporary editor dimensions respect cancellation, stale owners and fixed note-card behavior',async()=>{
 const f=fixture(),n=f.node();await f.view.startInlineEdit(n.id,false,true);const editor=f.calls.editors[0];
 for(const invalid of [NaN,Infinity,-1,1300])editor.options.temporaryHeight(invalid);assert.equal(f.calls.sizes.length,0);
 editor.options.temporaryHeight(320);editor.options.cancel();assert.equal(n.height,60);assert.equal(n.width,100);
 const next=fixture(),card=next.node('card');await next.view.startInlineEdit(card.id,false,true);assert.equal(next.calls.editors[0].options.temporaryHeight,undefined);
 const stale=fixture(),text=stale.node();await stale.view.startInlineEdit(text.id,false,true);stale.view.session={board:{nodes:[]}};
 stale.calls.editors[0].options.temporaryHeight(500);assert.equal(stale.calls.sizes.length,0);
});

test('new table creation respects unsaved-conflict and switched-board boundaries',async()=>{
 const failed=fixture(),camera={...failed.board.viewport};failed.view.inline={commit:async()=>false};await failed.view.newTable();
 assert.equal(failed.board.nodes.length,0);assert.equal(failed.calls.editors.length,0);assert.deepEqual(failed.board.viewport,camera);
 const changed=fixture();let release!:(saved:boolean)=>void;changed.view.inline={commit:()=>new Promise(resolve=>release=resolve)};
 const creating=changed.view.newTable();changed.view.session={board:{nodes:[],viewport:{x:4,y:5,zoom:1}},blocked:false};release(true);
 await assert.rejects(creating,/白板已切换/);assert.equal(changed.board.nodes.length,0);assert.equal(changed.calls.editors.length,0);
});

test('text Markdown save refuses replacement of a changed or locked node',async()=>{
 for(const state of ['changed','locked','removed','switched']){
  const f=fixture(),n=f.node();await f.view.startInlineEdit(n.id,false,true);const editor=f.calls.editors[0];
  if(state==='changed')n.text='其他修改';if(state==='locked')n.locked=true;if(state==='removed')f.board.nodes.splice(0);if(state==='switched')f.view.session={board:{nodes:[]}};
  await assert.rejects(editor.options.save('新 Markdown **内容**'),/变化|改变|切换/);assert.notEqual(n.text,'新 Markdown **内容**');assert.equal(f.calls.nativeWrites,0);assert.equal(f.calls.createdFiles,0);
 }
});

for(const zoom of [.4,1.6])test(`ordinary editing keeps explicit reveal behavior at zoom ${zoom}`,async()=>{
 const f=fixture(zoom),n=f.node(),nextZoom=zoom<.75?.9:zoom;
 await f.view.startInlineEdit(n.id);
 assert.deepEqual(f.board.viewport,{x:500-(n.x+n.width/2)*nextZoom,y:355-(n.y+n.height/2)*nextZoom,zoom:nextZoom});
 assert.equal(f.calls.remember,1);assert.equal(f.calls.transform,1);assert.equal(f.calls.persist,1);
 assert.equal(f.view.inlineId,n.id);
});

for(const kind of ['text','card'])test(`creating a ${kind} uses in-place editing rather than revealing its center`,async()=>{
 const f=fixture(.4),before={...f.board.viewport};
 await (kind==='text'?f.view.newText({x:950,y:25}):f.view.newCard({x:950,y:25}));
 assert.equal(f.board.nodes.length,1);assert.equal(f.board.nodes[0].kind,kind);
 assert.deepEqual(f.board.viewport,before);assert.equal(f.view.inlineId,f.board.nodes[0].id);
 assert.equal(f.calls.remember,0);assert.equal(f.calls.editors.length,1);
});

test('creating a central topic selects its initial title without recentering',async()=>{
 const f=fixture(.3),before={...f.board.viewport};await f.view.newText({x:-400,y:900},true);
 assert.equal(f.board.nodes[0].text,'中心主题');assert.equal(f.calls.editors[0].options.selectAll,true);
 assert.equal(f.board.mode,'mindmap');assert.deepEqual(f.board.viewport,before);
});

test('an unresolved existing draft leaves camera and editor untouched',async()=>{
 const f=fixture(.4),n=f.node(),before={...f.board.viewport},editor={commit:async()=>false};f.view.inline=editor;
 await f.view.startInlineEdit(n.id,false,true);
 assert.equal(f.view.inline,editor);assert.deepEqual(f.board.viewport,before);
 assert.equal(f.calls.editors.length,0);assert.equal(f.calls.active,0);
});

test('switching boards while reading a note cannot move either camera or open its old editor',async()=>{
 const f=fixture(.4),n=f.node('card'),before={...f.board.viewport};let release!:(value:string)=>void;
 f.setRead(()=>new Promise(resolve=>{release=resolve;}));
 const pending=f.view.startInlineEdit(n.id,false,true),next={board:{viewport:{x:800,y:300,zoom:2}},blocked:false};
 f.view.session=next;release('A note');await assert.rejects(pending,/白板已切换/);
 assert.deepEqual(f.board.viewport,before);assert.deepEqual(next.board.viewport,{x:800,y:300,zoom:2});
 assert.equal(f.calls.editors.length,0);assert.equal(f.calls.active,0);
});

test('a camera changed while a note loads is preserved as-is, not restored to an older snapshot',async()=>{
 const f=fixture(.4),n=f.node('card');let release!:(value:string)=>void;
 f.setRead(()=>new Promise(resolve=>{release=resolve;}));const pending=f.view.startInlineEdit(n.id,false,true);
 Object.assign(f.board.viewport,{x:-900,y:600,zoom:.2});release('A note');await pending;
 assert.deepEqual(f.board.viewport,{x:-900,y:600,zoom:.2});assert.equal(f.view.inlineId,n.id);
});

test('locked and exiting editors cannot change the camera or activate another editor',async()=>{
 for(const condition of ['locked','exiting']){
  const f=fixture(.4),n=f.node('text',{locked:condition==='locked'}),before={...f.board.viewport};
  if(condition==='exiting')f.view.inlineExit=Promise.resolve();
  const pending=f.view.startInlineEdit(n.id,false,true);
  if(condition==='locked')await assert.rejects(pending,/锁定/);else await pending;
  assert.deepEqual(f.board.viewport,before);assert.equal(f.calls.editors.length,0);assert.equal(f.calls.active,0);
 }
});

for(const kind of ['text','card'])for(const parentBranch of [false,true])test(`new ${kind} in a folded group remains visible after save${parentBranch?' with a folded group parent':''}`,async()=>{
 const f=fixture(.4),before={...f.board.viewport};
 const group=f.node('section',{id:'group',x:0,y:0,width:1000,height:800,sectionFolded:true});
 const unrelated=f.node('section',{id:'unrelated',x:1500,y:0,width:700,height:500,sectionFolded:true});
 const parent=parentBranch?f.node('section',{id:'parent',x:-1500,y:0,width:600,height:500,branchFolded:true}):undefined;
 if(parent)(f.board.edges as any[]).push({id:'group-branch',kind:'branch',from:parent.id,to:group.id});
 await (kind==='text'?f.view.newText({x:500,y:400}):f.view.newCard({x:500,y:400}));
 const created=f.board.nodes.at(-1),editor=f.view.inline;
 assert.equal(created.kind,kind);assert.equal(f.view.inlineId,created.id);
 assert.equal(branchState(f.board as any).hidden.has(created.id),false);
 assert.equal(!!group.sectionFolded,false);assert.equal(unrelated.sectionFolded,true);
 if(parent)assert.equal(!!parent.branchFolded,false);
 await editor.options.save('Saved content stays visible');
 assert.equal(f.view.inline,undefined);assert.equal(f.view.inlineId,undefined);assert.equal(f.view.inlineTarget,undefined);
 assert.equal(branchState(f.board as any).hidden.has(created.id),false);assert.ok(f.view.positions.has(created.id));
 assert.equal(kind==='text'?created.text:f.files.get(created.file)!.content,'Saved content stays visible');
 assert.deepEqual(f.board.viewport,before);assert.equal(f.calls.remember,0);assert.equal(f.calls.transform,0);
 assert.equal(unrelated.sectionFolded,true);
});
