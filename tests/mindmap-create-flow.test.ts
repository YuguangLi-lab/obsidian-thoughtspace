import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';import * as model from '../src/model';import * as mindmap from '../src/mindmap';import * as editor from '../src/mindmap-editor';import {presetMindmap} from '../src/mindmap-presets';
function view(){const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  async addTopic('),end=source.indexOf('\n  layoutTopics(',start),body=source.slice(start,end)+source.slice(source.indexOf('  async newText('),source.indexOf('\n  editText(')),deps={...model,...mindmap,...editor,Notice:class{},fitTextNode:(n:model.Card)=>{n.width=100;n.height=60;}};const View=new Function(...Object.keys(deps),transformSync('class View{'+body+'};return View',{loader:'ts'}).code)(...Object.values(deps));const v=new View();v.session={board:presetMindmap('project'),change(fn:any){fn(this.board)}};v.requireOwner=()=>v.session;v.selected=new Set([v.session.board.nodes[1].id]);v.updateSelection=()=>{};v.plugin={settings:{defaultTextSize:16}};v.startInlineEdit=async(id:string,selectAll?:boolean)=>{v.focus={id,selectAll};};return v;}
test('canvas add child creates a named connected block and selects its title for immediate typing',async()=>{const v=view(),parent=v.session.board.nodes[1].id,count=v.session.board.nodes.length;await v.addTopic();const n=v.session.board.nodes.at(-1);assert.equal(v.session.board.nodes.length,count+1);assert.equal(n.text,'子主题');assert(v.session.board.edges.some((e:model.Edge)=>e.kind==='branch'&&e.from===parent&&e.to===n.id));assert.deepEqual(v.focus,{id:n.id,selectAll:true});});
test('adding a sibling inserts directly after the active topic, not at the end of the branch',async()=>{const v=view(),first=v.session.board.nodes[2].id;v.selected=new Set([first]);const parents=mindmap.validateBranches(v.session.board),parent=parents.get(first)!;await v.addTopic(true);const children=mindmap.branchState(v.session.board).children.get(parent)!;assert.equal(children[children.indexOf(first)+1],v.focus.id);});
test('Enter on the central topic creates its first child',async()=>{const v=view(),root=v.session.board.nodes[0].id;v.selected=new Set([root]);await v.addTopic(true);assert.equal(v.session.board.nodes.at(-1).text,'子主题');assert(v.session.board.edges.some((e:model.Edge)=>e.from===root&&e.to===v.focus.id));});
test('unsaved conflicts prevent new nodes and keep the source editor active',async()=>{const v=view(),before=JSON.stringify(v.session.board);v.inline={commit:async()=>false};await v.addTopic();assert.equal(JSON.stringify(v.session.board),before);assert.equal(v.focus,undefined);assert.equal(v.topicAdding,false);});
test('a rapid repeated create does not duplicate work while the previous draft saves',async()=>{const v=view(),count=v.session.board.nodes.length;let release!:()=>void;v.inline={commit:()=>new Promise<boolean>(r=>release=()=>r(true))};const first=v.addTopic(),second=v.addTopic();await second;release();await first;assert.equal(v.session.board.nodes.length,count+1);assert.equal(v.topicAdding,false);});
test('explicit clicked topic stays the parent even when selection changes during saving',async()=>{const v=view(),clicked=v.session.board.nodes[1].id;v.inline={commit:async()=>{v.selected=new Set([v.session.board.nodes[4].id]);return true;}};await v.addTopic(false,clicked);assert(v.session.board.edges.some((e:model.Edge)=>e.from===clicked&&e.to===v.focus.id));});
function releaseView(topicClick:boolean){const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  private finishLinkDrag('),end=source.indexOf('\n  private createConnection(',start),tasks:Promise<any>[]=[],deps={...model,...mindmap,act:(fn:any)=>{tasks.push(Promise.resolve().then(fn));}};const View=new Function(...Object.keys(deps),transformSync('class View{'+source.slice(start,end)+'};return View',{loader:'ts'}).code)(...Object.values(deps));const v=new View(),owner={board:presetMindmap('project'),blocked:false};Object.assign(v,{session:owner,mode:'connect',connectFrom:'parent',linkDrag:{id:1,x:10,y:20,moved:false,owner,topicClick},stage:{hasPointerCapture:()=>false},cancelConnection(this:any){this.mode='select';this.linkDrag=undefined;},updateSelection(){},addTopic:async(sibling:boolean,id:string)=>v.created={sibling,id}});return{v,tasks};}
test('click-release on a mindmap plus creates a child instead of leaving a dangling connection',async()=>{const {v,tasks}=releaseView(true);v.finishLinkDrag({pointerId:1,clientX:10,clientY:20});await Promise.all(tasks);assert.deepEqual(v.created,{sibling:false,id:'parent'});assert.equal(v.mode,'select');});
test('free board and explicit connection mode retain click-to-connect behavior',async()=>{const {v,tasks}=releaseView(false);v.finishLinkDrag({pointerId:1,clientX:10,clientY:20});await Promise.all(tasks);assert.equal(v.created,undefined);assert.equal(v.mode,'connect');assert.deepEqual([...v.selected],['parent']);});
test('switching board before releasing a mindmap plus does not create in another board',async()=>{const {v,tasks}=releaseView(true);v.session={board:presetMindmap('reading')};v.finishLinkDrag({pointerId:1,clientX:10,clientY:20});await Promise.all(tasks);assert.equal(v.created,undefined);});

test('a new central topic starts named, selected and with automatic layout enabled',async()=>{const v=view();await v.newText({x:0,y:0},true);const n=v.session.board.nodes.at(-1);assert.equal(n.text,'中心主题');assert(n.mindmapRules.automatic);assert.deepEqual(v.focus,{id:n.id,selectAll:true});});

function queuedReleaseView(topicClick=true){
 const f=releaseView(topicClick),source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  private pointerMove('),end=source.indexOf('  private updateSelection(',start);
 const methods=new Function(transformSync('class View{'+source.slice(start,end)+'};return View.prototype',{loader:'ts'}).code)();
 for(const name of ['pointerMove','flushPointer','applyPointerMove','pointerUp'])f.v[name]=methods[name];
 const frames=new Map<number,()=>void>(),previews:number[][]=[];
 const ownerWindow={requestAnimationFrame:(fn:()=>void)=>{frames.set(1,fn);return 1;},cancelAnimationFrame:(id:number)=>frames.delete(id)};
 f.v.stage.ownerDocument={defaultView:ownerWindow};f.v.stage.getBoundingClientRect=()=>({left:0,top:0,right:800,bottom:600});
 f.v.plugin={settings:{dragThreshold:4}};f.v.point=(x:number,y:number)=>({x,y});
 f.v.previewConnection=(x:number,y:number)=>{previews.push([x,y]);f.v.linkTarget={id:'target',side:'left'};};
 f.v.createConnection=(from:string,to:string)=>{f.v.connected={from,to};};
 return {...f,frames,previews,event:(x:number,y:number,pointerId=1)=>({pointerId,clientX:x,clientY:y,buttons:0})};
}

test('connection release uses only final hit testing even with a queued preview',async()=>{
 const f=queuedReleaseView();f.v.pointerMove(f.event(100,100));f.v.pointerUp(f.event(300,200));await Promise.all(f.tasks);
 assert.deepEqual(f.previews,[[300,200]]);assert.deepEqual(f.v.connected,{from:'parent',to:'target'});assert.equal(f.frames.size,0);assert.equal(f.v.created,undefined);
});
test('queued out-and-back mindmap drag connects instead of accidentally adding a child',async()=>{
 const f=queuedReleaseView();f.v.pointerMove(f.event(100,100));f.v.pointerUp(f.event(10,20));await Promise.all(f.tasks);
 assert.deepEqual(f.previews,[[10,20]]);assert.deepEqual(f.v.connected,{from:'parent',to:'target'});assert.equal(f.v.created,undefined);
});
test('foreign pointer release cannot consume connection motion, and cancel never previews or creates',async()=>{
 const f=queuedReleaseView();f.v.pointerMove(f.event(100,100));const queued=f.v.pendingPointer;
 f.v.pointerUp(f.event(300,200,2));assert.equal(f.v.pendingPointer,queued);assert.equal(f.frames.size,1);assert.deepEqual(f.previews,[]);
 f.v.pointerUp(f.event(300,200),true);await Promise.all(f.tasks);
 assert.deepEqual(f.previews,[]);assert.equal(f.v.created,undefined);assert.equal(f.v.connected,undefined);assert.equal(f.frames.size,0);
});
