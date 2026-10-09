import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as documents from '../src/board-document';
import {isBoardPath} from '../src/board-path';
import {isWorkspaceFile} from '../src/workspace';
import {boardLink,parseBoardLink} from '../src/deeplinks';
import {createBrainBoard} from '../src/brain-board';
import {captureBoardReferenceRename,createBoardReferenceRenamer} from '../src/board-reference-rename';
import {SharedOpen} from '../src/view-opening';
import {appendPendingBoardReference,removePendingBoardReference} from '../src/pending-board-references';

// Execute the production entry points and their real codec/path adapters. Host
// leaf/file classes are substituted; routing and persistence are never reimplemented.
// An explicit source path is only for replaying the same contract against the
// frozen pre-Markdown production checkout when collecting red/green evidence.
const source=readFileSync(process.env.THOUGHTSPACE_ROUTING_SOURCE||'src/main.ts','utf8'),ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const parseYaml=createRequire(import.meta.url)('js-yaml').load;
const VIEW='thoughtspace-board',EXT='thoughtspace',ROOT='ThoughtSpace';
function classDeclaration(name:string){const declaration=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text===name);assert(declaration&&ts.isClassDeclaration(declaration),`Production class ${name} is present`);return declaration;}
function methods(name:string,names:string[]){return classDeclaration(name).members.filter(node=>ts.isMethodDeclaration(node)&&node.body&&names.includes(node.name.getText(ast))).map(node=>node.getText(ast)).join('\n');}
function execute(code:string,deps:Record<string,unknown>){return new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps));}
function callsIn(methodName:string,callee:string){
 const method=classDeclaration('ThoughtSpace').members.find(node=>ts.isMethodDeclaration(node)&&node.name.getText(ast)===methodName);assert(method);
 const calls:ts.CallExpression[]=[];const visit=(node:ts.Node)=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text===callee)calls.push(node);ts.forEachChild(node,visit);};visit(method);return calls;
}
class TFile {
 stat={mtime:1,size:0};constructor(public path:string){}get extension(){return this.path.split('.').at(-1)!;}get basename(){return this.name.replace(/\.[^.]+$/,'');}get name(){return this.path.slice(this.path.lastIndexOf('/')+1);}get parent(){return{path:this.path.slice(0,Math.max(0,this.path.lastIndexOf('/')))};}
}
class BoardView {
 session:any;closed=false;fits=0;reveals:string[]=[];leaf:any;containerEl={ownerDocument:{defaultView:{requestAnimationFrame:(run:()=>void)=>run()}}};
 constructor(public file:TFile,board:model.Board=model.emptyBoard()){this.session={board,blocked:false,flush:async()=>{},refreshNativeEditing:()=>{},externalUpdate:async()=>{}};}
 resumeAutomaticGeometry(){}fit(){this.fits++;}revealNode(id:string){this.reveals.push(id);}
}
class MarkdownView {
 containerEl={isConnected:true,ownerDocument:{defaultView:globalThis}};
 saving=false;saveAgain=false;file:TFile;leaf:any;mode='source';value:string;editor={getValue:()=>this.value};
 constructor(file:TFile,value:string,private persist:(value:string)=>void){this.file=file;this.value=value;}
 getMode(){return this.mode;}getViewData(){return this.value;}async save(){this.persist(this.value);}
}
const ownershipModule={exports:{} as any};
new Function('require','module','exports',transformSync(readFileSync('src/board-editor-ownership.ts','utf8'),{loader:'ts',format:'cjs'}).code)(()=>({MarkdownView}),ownershipModule,ownershipModule.exports);
const ownership=ownershipModule.exports;
const prompts:any[]=[];
class Prompt {constructor(public app:any,public title:string,public initial:string,public run:(value:string,type?:string)=>unknown,public options?:any){}open(){prompts.push(this);}}
class Menu {
 items:Array<{title:string;run?:()=>unknown}>=[];setUseNativeMenu(){return this;}addSeparator(){}showAtMouseEvent(){}
 addItem(create:(item:any)=>void){const record:{title:string;run?:()=>unknown}={title:''},item:any={setTitle:(title:string)=>{record.title=title;return item;},setIcon:()=>item,setDisabled:()=>item,onClick:(run:()=>unknown)=>{record.run=run;return item;}};create(item);this.items.push(record);return this;}
}
const notices:string[]=[],errors:unknown[]=[];
const helper=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='isBoardFile');
const deps={mediaKind:()=>undefined,isPdfFile:()=>false,...model,...documents,...ownership,isBoardPath,isWorkspaceFile,parseYaml,TFile,BoardView,MarkdownView,Prompt,Menu,VIEW,EXT,ROOT,parseBoardLink,boardLink,createBrainBoard,captureBoardReferenceRename,createBoardReferenceRenamer,appendPendingBoardReference,removePendingBoardReference,
 normalizePath:(path:string)=>path.replace(/\/+/g,'/').replace(/^\//,''),act:(run:()=>unknown)=>run(),report:(error:unknown)=>errors.push(error),Notice:class{constructor(value:string){notices.push(value);}},window:globalThis};
const isBoardFile=helper?execute(helper.getText(ast)+';return isBoardFile;',deps):()=>{throw Error('Production isBoardFile is missing');};
const Host=execute(`class Host {${methods('ThoughtSpace',['readBoard','openBoard','openBoardInNewTab','openDeepLink','boardGraph','assertCanNestReachable','renameReferences','editReferenceJournal','deferBoardReference','retryPendingBoardReferences','flushPendingBoardReferences','createUnique','folder','duplicateBoard','promptMarkdownBoard','openCurrentMarkdownBoard','openBoardNativeMarkdown','refreshMarkdownBoardOwnership','promptSaveBoardAs','saveBoardAs','nativeFileMenu','toggleBoardNative'])}};return Host;`,{...deps,isBoardFile});
const ViewMenu=execute(`class ViewMenu {${methods('BoardView',['boardMenu','renameBoard'])}};return ViewMenu;`,{...deps,isBoardFile,fileExplorer:()=>undefined,navigator:{clipboard:{writeText:async()=>{}}}});
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function contentBoard():model.Board {
 const board=model.emptyBoard();board.version=3;board.spaceId='original-space';board.nodes=[{id:'original-node/#^',kind:'text',text:'Literal [[Sources/Note#Heading]]',x:10,y:20,width:280,height:160,color:'green'},{id:'child',kind:'board',file:'Boards/Child.md',x:340,y:20,width:240,height:160,color:'sand'}];board.edges=[{id:'original-edge',from:board.nodes[0].id,to:'child',label:'Retain',direction:'both'}];return board;
}
function fixture(){
 const host=new Host(),files=new Map<string,TFile>(),disk=new Map<TFile,string>(),frontmatter=new Map<TFile,unknown>(),leaves:any[]=[],events:any[][]=[],navigationListeners=new Set<(leaf:any)=>void>();let active:any;
 const put=(path:string,raw:string,metadata?:unknown)=>{const file=new TFile(path);file.stat.size=raw.length;files.set(path,file);disk.set(file,raw);if(metadata!==undefined)frontmatter.set(file,metadata);return file;};
 const write=(file:TFile,raw:string)=>{disk.set(file,raw);file.stat.mtime++;file.stat.size=raw.length;};
 const makeLeaf=(type:string='empty',file?:TFile)=>{
  const leaf:any={type,isDeferred:false,detached:false,view:undefined,state:{type,state:file?{file:file.path}:{}},
   getViewState:()=>leaf.state,loadIfDeferred:async()=>{leaf.isDeferred=false;events.push(['load',leaf]);},
   setViewState:async(state:any)=>{events.push(['state',state]);leaf.type=state.type;leaf.state=state;const target=files.get(state.state.file);assert(target);if(state.type===VIEW)leaf.view=new BoardView(target,await host.readBoard(target));else{leaf.view=new MarkdownView(target,disk.get(target)!,raw=>write(target,raw));leaf.view.mode=state.state.mode||'source';}leaf.view.leaf=leaf;},
   openFile:async(target:TFile,options:any)=>{events.push(['openFile',target,options]);await leaf.setViewState({type:target.extension===EXT?VIEW:'markdown',state:{file:target.path}});},
   detach:()=>{leaf.detached=true;const index=leaves.indexOf(leaf);if(index>=0)leaves.splice(index,1);events.push(['detach',leaf]);}};
  if(file){leaf.view=type===VIEW?new BoardView(file):new MarkdownView(file,disk.get(file)!,raw=>write(file,raw));leaf.view.leaf=leaf;}leaves.push(leaf);return leaf;
 };
 const workspace={on:(_name:string,run:(leaf:any)=>void)=>{navigationListeners.add(run);return run;},offref:(run:(leaf:any)=>void)=>navigationListeners.delete(run),containerEl:{ownerDocument:{defaultView:globalThis}},getLeavesOfType:(type:string)=>leaves.filter(leaf=>leaf.type===type),getLeaf:(placement:string)=>{events.push(['create',placement]);return makeLeaf();},
  getActiveFile:()=>active?.view.file,getActiveViewOfType:(kind:any)=>active?.view instanceof kind?active.view:null,getMostRecentLeaf:()=>active,getActiveLeaf:()=>active,
  revealLeaf:async(leaf:any)=>{events.push(['reveal',leaf]);},setActiveLeaf:(leaf:any)=>{active=leaf;events.push(['active',leaf]);for(const run of navigationListeners)run(leaf);}};
 const app={workspace,metadataCache:{getFileCache:(file:TFile)=>frontmatter.has(file)?{frontmatter:frontmatter.get(file)}:null},vault:{
  getName:()=> 'Synthetic Vault',getFiles:()=>[...files.values()],getAbstractFileByPath:(path:string)=>files.get(path),read:async(file:TFile)=>{events.push(['read',file]);return disk.get(file)!;},cachedRead:async(file:TFile)=>{events.push(['cachedRead',file]);return disk.get(file)!;},
  process:async(file:TFile,change:(raw:string)=>string)=>{const raw=change(disk.get(file)!);write(file,raw);events.push(['process',file]);},createFolder:async(path:string)=>{events.push(['folder',path]);},create:async(path:string,raw:string)=>{events.push(['createFile',path]);return put(path,raw,raw.startsWith('---')?{thoughtspace:'board'}:undefined);}},
  fileManager:{renameFile:async(file:TFile,path:string)=>{const old=file.path;files.delete(old);file.path=path;files.set(path,file);events.push(['rename',old,path]);}}};
 Object.assign(host,{app,sessions:new Map(),settings:{favoriteBoards:[],pendingBoardReferences:[]},referenceQueue:Promise.resolve(),referenceJournalQueue:Promise.resolve(),boardOpening:new SharedOpen(),provisionalBoardGeometry:new Map(),nativeBoardTransitions:new Set(),nativeReferenceRuns:new Map(),nativeReferenceNotices:new Set(),saveData:async(data:unknown)=>{events.push(['saveData',structuredClone(data)]);},currentBoard:undefined});
 return{host,app,files,disk,frontmatter,leaves,events,navigationListeners,put,write,makeLeaf,setActive:(leaf:any)=>{active=leaf;workspace.setActiveLeaf(leaf);},active:()=>active};
}
function decoded(file:TFile,raw:string){return documents.readBoardDocument(raw,file.extension,parseYaml).board;}

test('extension registration keeps ordinary Markdown under Obsidian ownership',()=>{
 const calls=callsIn('onload','registerExtensions'),registered:any[]=[];assert.equal(calls.length,1);
 execute(`return function(){${calls.map(call=>call.getText(ast)+';').join('\n')}};`,{EXT,VIEW}).call({registerExtensions:(extensions:string[],type:string)=>registered.push([extensions,type])});
 assert.deepEqual(registered,[[['thoughtspace'],VIEW]]);
});
test('board discovery uses exact native frontmatter and preserves workspace exclusions',()=>{
 const f=fixture();for(const value of [undefined,{},'board',{thoughtspace:'Board'},{thoughtspace:true},{thoughtspace:['board']},{thoughtspace:'board '}]){const file=f.put('Ordinary'+f.files.size+'.md','# ordinary',value);assert.equal(isBoardFile(f.app,file),false);}
 const marked=f.put('Boards/Marked.MD','invalid full content',{thoughtspace:'board'});assert.equal(isBoardFile(f.app,marked),true,'discovery is metadata only');
 assert.equal(isBoardFile(f.app,f.put('Boards/Legacy.thoughtspace','{}')),true);
 for(const path of ['ThoughtSpace-plugin-backups/Board.md','ThoughtSpace/白板搜索/Board.md'])assert.equal(isBoardFile(f.app,f.put(path,'',{thoughtspace:'board'})),false);
});
test('full read rejects unmarked and damaged marked Markdown without writing their sources',async()=>{
 const f=fixture();for(const raw of ['# ordinary\n',documents.createMarkdownBoardDocument(model.emptyBoard(),'Damaged').replace('"version": 1','"version": 999'),documents.createMarkdownBoardDocument(model.emptyBoard(),'Damaged').replace('"nodes": []','"nodes": "invalid"')]){
  const file=f.put('Boards/Bad'+f.files.size+'.md',raw,{thoughtspace:'board'});await assert.rejects(f.host.readBoard(file));assert.equal(f.disk.get(file),raw);
 }assert.equal(f.events.some(event=>event[0]==='process'||event[0]==='createFile'),false);
});
test('explicit Markdown board opening validates the codec then chooses the custom view',async()=>{
 const f=fixture(),raw=documents.createMarkdownBoardDocument(contentBoard(),'Study'),file=f.put('Boards/Study.md',raw,{thoughtspace:'board'});await f.host.openBoard(file,true);
 const state=f.events.find(event=>event[0]==='state')![1];assert.equal(state.type,VIEW);assert.equal(state.state.file,file.path);assert.equal(f.events.some(event=>event[0]==='openFile'),false);
 assert(f.events.findIndex(event=>event[0]==='cachedRead')<f.events.findIndex(event=>event[0]==='state'));assert.equal(f.host.currentBoard.file,file);assert.equal(f.host.currentBoard.fits,1);assert.equal(f.disk.get(file),raw);
});
test('legacy board opening retains registered openFile routing and source bytes',async()=>{
 const f=fixture(),raw=JSON.stringify(contentBoard()),file=f.put('Boards/Legacy.thoughtspace',raw);await f.host.openBoard(file);
 assert.equal(f.events.filter(event=>event[0]==='openFile').length,1);assert.equal(f.host.currentBoard.file,file);assert.equal(f.disk.get(file),raw);
});
test('failed explicit opening retains ordinary Markdown and releases the provisional tab before retry',async()=>{
 const f=fixture(),file=f.put('Ordinary.md','# keep this ordinary note');await assert.rejects(f.host.openBoard(file));assert.equal(f.disk.get(file),'# keep this ordinary note');assert.equal(f.leaves.length,0);
 const good=f.put('Boards/Retry.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Retry'),{thoughtspace:'board'});await f.host.openBoard(good);assert.equal(f.leaves.length,1);assert.equal(f.host.currentBoard.file,good);
});
test('Markdown deep links resolve original node identities and decline foreign-vault or ordinary notes',async()=>{
 const f=fixture(),board=contentBoard(),file=f.put('Boards/空 格+%2F.md',documents.createMarkdownBoardDocument(board,'Linked'),{thoughtspace:'board'});
 const params=Object.fromEntries(new URL(boardLink('Synthetic Vault',file.path,board.nodes[0].id)).searchParams);await f.host.openDeepLink(params);
 assert.deepEqual(f.host.currentBoard.reveals,[board.nodes[0].id]);assert.equal(f.host.currentBoard.file,file);
 await assert.rejects(f.host.openDeepLink({...params,vault:'Other Vault',space:'Other Vault'}));
 const ordinary=f.put('Ordinary.md','# ordinary');await assert.rejects(f.host.openDeepLink({...params,file:ordinary.path}));assert.equal(f.disk.get(ordinary),'# ordinary');
});
test('cross-board traversal parses every marked Markdown descendant and rejects corrupt or unmarked descendants',async()=>{
 for(const failure of ['none','unmarked','corrupt','cycle'] as const){
  const f=fixture(),parent=f.put('Boards/Parent.thoughtspace',JSON.stringify(model.emptyBoard())),childBoard=contentBoard(),child=f.put('Boards/Child.md',documents.createMarkdownBoardDocument(childBoard,'Child'),{thoughtspace:'board'}),descendant=model.emptyBoard();
  childBoard.nodes=[{...childBoard.nodes[1],file:'Boards/Grandchild.md'}];childBoard.edges=[];f.write(child,documents.createMarkdownBoardDocument(childBoard,'Child'));
  if(failure==='cycle')descendant.nodes=[{...contentBoard().nodes[1],file:parent.path}];
  const raw=failure==='unmarked'?'# ordinary':failure==='corrupt'?'---\nthoughtspace: board\n---\n\nmissing layout':documents.createMarkdownBoardDocument(descendant,'Grandchild');
  const grandchild=f.put('Boards/Grandchild.md',raw,failure==='unmarked'?{}:{thoughtspace:'board'});
  if(failure==='none'){await f.host.assertCanNestReachable(parent,child,()=>true);assert(f.events.some(event=>event[0]==='cachedRead'&&event[1]===grandchild));}
  else await assert.rejects(f.host.assertCanNestReachable(parent,child,()=>true));
  assert.equal(f.disk.get(grandchild),raw);assert.equal(f.events.some(event=>event[0]==='process'),false);
 }
});
test('board graph reports damaged marked Markdown while ignoring ordinary native notes',async()=>{
 const f=fixture(),good=f.put('Boards/Good.md',documents.createMarkdownBoardDocument(contentBoard(),'Good'),{thoughtspace:'board'}),bad=f.put('Boards/Bad.md','---\nthoughtspace: board\n---',{thoughtspace:'board'}),ordinary=f.put('Ordinary.md','# native'),legacy=f.put('Legacy.thoughtspace',JSON.stringify(model.emptyBoard()));
 const result=await f.host.boardGraph();assert.deepEqual([...result.graph.keys()].sort(),[good.path,legacy.path].sort());assert.deepEqual(result.graph.get(good.path),['Boards/Child.md']);assert.deepEqual([...result.errors],[bad.path]);assert.equal(result.graph.has(ordinary.path),false);
});
test('actual rename migration updates both codecs while preserving Markdown body and ordinary files',async()=>{
 const f=fixture(),board=contentBoard();board.nodes[1].file='Old/Child.md';const raw=documents.createMarkdownBoardDocument(board,'Keep source')+'\n<!-- retain me -->\nNative body [[Old/Child]]\n';
 const md=f.put('Boards/Parent.md',raw,{thoughtspace:'board'}),legacy=f.put('Boards/Parent.thoughtspace',JSON.stringify(board)),ordinary=f.put('Ordinary.md','# Native [[Old/Child]]'),child=f.put('New/Child.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Child'),{thoughtspace:'board'}),snapshot=captureBoardReferenceRename(child.path,[...f.files.values()]);
 await f.host.renameReferences(child,'Old/Child.md',snapshot);
 for(const file of [md,legacy])assert.equal(decoded(file,f.disk.get(file)!).nodes[1].file,child.path);
 assert(f.disk.get(md)!.endsWith('<!-- retain me -->\nNative body [[Old/Child]]\n'));assert.equal(f.disk.get(ordinary),'# Native [[Old/Child]]');assert.equal(f.disk.get(child),documents.createMarkdownBoardDocument(model.emptyBoard(),'Child'));
});
test('queued folder migration keeps Markdown format and refuses native-owned layout rewrites',async()=>{
 const f=fixture(),board=contentBoard();board.nodes[1].file='Project/Child.md';const md=f.put('Archive/Project/Parent.md',documents.createMarkdownBoardDocument(board,'Parent')+'\nKeep body.\n',{thoughtspace:'board'}),child=f.put('Archive/Project/Child.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Child'),{thoughtspace:'board'}),snapshot=captureBoardReferenceRename('Archive/Project',[...f.files.values()]);
 await f.host.renameReferences({path:'Archive/Project'},'Project',snapshot);assert.equal(decoded(md,f.disk.get(md)!).nodes[1].file,child.path);assert(f.disk.get(md)!.endsWith('Keep body.\n'));
 const protectedRaw=f.disk.get(md)!;f.makeLeaf('markdown',md);await f.host.renameReferences(child,child.path,{newPath:'Other/Child.md',files:snapshot.files});assert.equal(f.disk.get(md),protectedRaw);assert.equal(f.host.settings.pendingBoardReferences.length,1);assert.equal(f.host.settings.pendingBoardReferences[0].board,md.path);assert.equal(f.host.settings.pendingBoardReferences[0].oldPath,child.path);assert.equal(f.host.settings.pendingBoardReferences[0].newPath,'Other/Child.md');assert(f.events.some(event=>event[0]==='saveData'));
});
for(const action of ['在新标签页打开','重命名白板'])test(`board-list ${action} callback retains Markdown board routing and extension`,async()=>{
 const f=fixture(),file=f.put('Boards/Study.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Study'),{thoughtspace:'board'}),view=new ViewMenu();Object.assign(view,{app:f.app,plugin:f.host});
 const menus:Menu[]=[];const menuSource=methods('BoardView',['boardMenu']);class CapturedMenu extends Menu {constructor(){super();menus.push(this);}}
 const View=execute(`class View {${menuSource}};return View;`,{...deps,isBoardFile,Menu:CapturedMenu,fileExplorer:()=>undefined,navigator:{clipboard:{writeText:async()=>{}}}}),instance=new View();Object.assign(instance,view);
 instance.boardMenu(file,{});await menus[0].items.find(item=>item.title===action)!.run!();if(action==='在新标签页打开')assert.equal(f.leaves.at(-1).type,VIEW);
 else{await prompts.at(-1).run('Renamed');assert.equal(file.path,'Boards/Renamed.md');assert.equal(decoded(file,f.disk.get(file)!).nodes.length,0);}
});
test('native Markdown return uses the actual save barrier and the same leaf before custom view activation',async()=>{
 const f=fixture(),file=f.put('Boards/Return.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Return'),{thoughtspace:'board'}),leaf=f.makeLeaf('markdown',file);f.setActive(leaf);leaf.view.value+='\nLatest native draft.\n';
 await f.host.openCurrentMarkdownBoard();assert.equal(f.leaves.length,1);assert.equal(f.active(),leaf);assert.equal(leaf.type,VIEW);assert(f.disk.get(file)!.endsWith('Latest native draft.\n'));assert.equal(f.host.nativeBoardTransitions.size,0);
});
test('ordinary Markdown is not converted and failed native saves preserve its leaf',async()=>{
 const f=fixture(),ordinary=f.put('Ordinary.md','# native'),leaf=f.makeLeaf('markdown',ordinary);f.setActive(leaf);await assert.rejects(f.host.openCurrentMarkdownBoard());assert.equal(leaf.type,'markdown');assert.equal(f.disk.get(ordinary),'# native');
 const board=f.put('Boards/Failure.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Failure'),{thoughtspace:'board'}),boardLeaf=f.makeLeaf('markdown',board);f.setActive(boardLeaf);boardLeaf.view.save=async()=>{throw Error('Native save failure');};await assert.rejects(f.host.openCurrentMarkdownBoard(),/Native save failure/);assert.equal(boardLeaf.type,'markdown');assert.equal(f.host.nativeBoardTransitions.size,0);
});
test('repair entry opens damaged Markdown as native preview without codec overwrite',async()=>{
 const f=fixture(),raw='---\nthoughtspace: board\n---\nBroken layout\n',file=f.put('Boards/Broken.md',raw,{thoughtspace:'board'}),leaf=f.makeLeaf(VIEW,file);await f.host.openBoardNativeMarkdown(file,leaf);
 assert.equal(f.leaves.length,1);assert.equal(leaf.type,'markdown');assert.equal(leaf.state.state.file,file.path);assert.equal(leaf.state.state.mode,'preview');assert.equal(f.disk.get(file),raw);
});
test('new Markdown board and brain-board prompts emit fully validated documents without changing legacy defaults',async()=>{
 for(const presentation of ['board','brain'] as const){const f=fixture();f.host.promptMarkdownBoard(presentation);const prompt=prompts.at(-1);await prompt.run('Native '+presentation,presentation);const file=[...f.files.values()][0];assert.equal(file.extension,'md');const board=decoded(file,f.disk.get(file)!);assert.equal(board.presentation,presentation==='brain'?'brain':undefined);assert.equal(f.host.currentBoard.file,file);}
});
test('duplicate Board preserves format, original source, identities and Markdown prose but gets a fresh space',async()=>{
 for(const extension of ['md','thoughtspace']){const f=fixture(),board=contentBoard(),raw=extension==='md'?documents.createMarkdownBoardDocument(board,'Original').replace('thoughtspace: board','thoughtspace: board\ncustom: retain # comment')+'\nNative body.\n':JSON.stringify(board),file=f.put('Boards/Original.'+extension,raw,extension==='md'?{thoughtspace:'board'}:undefined),copy=await f.host.duplicateBoard(file),next=decoded(copy,f.disk.get(copy)!);
  assert.equal(copy.extension,extension);assert.notEqual(next.spaceId,board.spaceId);assert.deepEqual(next.nodes,board.nodes);assert.deepEqual(next.edges,board.edges);assert.equal(f.disk.get(file),raw);if(extension==='md'){assert(f.disk.get(copy)!.includes('custom: retain # comment'));assert(f.disk.get(copy)!.endsWith('Native body.\n'));}
 }
});
test('save-as conversion of both formats preserves all layout identities and generates independent spaces',async()=>{
 for(const from of ['md','thoughtspace'])for(const format of ['markdown','legacy'] as const){const f=fixture(),board=contentBoard(),raw=from==='md'?documents.createMarkdownBoardDocument(board,'Original')+'\nNative body stays.\n':JSON.stringify(board),file=f.put('Boards/Original.'+from,raw,from==='md'?{thoughtspace:'board'}:undefined),copy=await f.host.saveBoardAs(file,'Converted',format),next=decoded(copy,f.disk.get(copy)!);
  assert.equal(copy.extension,format==='markdown'?'md':'thoughtspace');assert.notEqual(next.spaceId,board.spaceId);assert.deepEqual(next.nodes,board.nodes);assert.deepEqual(next.edges,board.edges);assert.equal(f.disk.get(file),raw);assert.equal(f.events.some(event=>event[0]==='process'||event[0]==='rename'),false,'conversion never writes or moves the original');if(from==='md'&&format==='markdown')assert(f.disk.get(copy)!.endsWith('Native body stays.\n'));
 }
});
test('save-as flushes the authoritative session before reading the latest codec document',async()=>{
 const f=fixture(),board=contentBoard(),file=f.put('Boards/Latest.md',documents.createMarkdownBoardDocument(board,'Latest'),{thoughtspace:'board'}),updated=model.clone(board);updated.nodes[0].text='Latest committed node';let flushed=false;
 f.host.sessions.set(file,Promise.resolve({board:updated,blocked:false,refreshNativeEditing:()=>{},flush:async()=>{flushed=true;f.write(file,documents.createMarkdownBoardDocument(updated,'Latest')+'\nNew native body.\n');}}));
 const copy=await f.host.saveBoardAs(file,'Latest copy','markdown');assert(flushed);assert.equal(decoded(copy,f.disk.get(copy)!).nodes[0].text,'Latest committed node');assert(f.disk.get(copy)!.endsWith('New native body.\n'));
});
test('save-as failure and duplicate name handling never modify or overwrite the original source',async()=>{
 const f=fixture(),raw=documents.createMarkdownBoardDocument(model.emptyBoard(),'Source'),file=f.put('Boards/Source.md',raw,{thoughtspace:'board'}),occupied=f.put('Boards/Copy.md','# ordinary keep');
 const copy=await f.host.saveBoardAs(file,'Copy','markdown');assert.equal(copy.path,'Boards/Copy 2.md');assert.equal(f.disk.get(file),raw);assert.equal(f.disk.get(occupied),'# ordinary keep');
 const invalid=f.put('Boards/Invalid.md','---\nthoughtspace: board\n---\ninvalid',{thoughtspace:'board'}),before=f.files.size;await assert.rejects(f.host.saveBoardAs(invalid,'Rejected','legacy'));assert.equal(f.files.size,before);assert.equal(f.disk.get(invalid),'---\nthoughtspace: board\n---\ninvalid');await tick();
});

test('all six production commands preserve native-note availability and invoke their actual destinations',()=>{
 const declaration=classDeclaration('ThoughtSpace').members.find(node=>ts.isMethodDeclaration(node)&&node.name.getText(ast)==='onload');assert(declaration&&ts.isMethodDeclaration(declaration)&&declaration.body);
 const destinations=new Set(['promptMarkdownBoard','openCurrentMarkdownBoard','openBoardNativeMarkdown','promptSaveBoardAs']);
 const relevant=(node:ts.Node)=>{let found=false;const visit=(child:ts.Node)=>{if(ts.isCallExpression(child)&&ts.isPropertyAccessExpression(child.expression)&&destinations.has(child.expression.name.text))found=true;ts.forEachChild(child,visit);};visit(node);return found;};
 const statements=declaration.body.statements.filter(relevant);assert.equal(statements.length,5,'Four commands and the actual two-format registration loop');
 const f=fixture(),commands:any[]=[],routed:any[][]=[];f.host.addCommand=(command:any)=>commands.push(command);
 for(const name of destinations)f.host[name]=(...args:any[])=>{routed.push([name,...args]);};
 execute('return function(){'+statements.map(statement=>statement.getText(ast)).join('\n')+'};',{...deps,isBoardFile}).call(f.host);
 assert.deepEqual(commands.map(command=>command.id),['new-markdown-board','new-markdown-brain-board','open-markdown-board','board-native-properties','save-as-markdown-board','save-as-legacy-board']);
 commands[0].callback();commands[1].callback();assert.deepEqual(routed,[['promptMarkdownBoard'],['promptMarkdownBoard','brain']]);
 const ordinary=f.put('Ordinary.md','# ordinary'),ordinaryLeaf=f.makeLeaf('markdown',ordinary);f.setActive(ordinaryLeaf);assert.equal(commands[2].checkCallback(true),false);assert.equal(commands[2].checkCallback(false),false);
 const file=f.put('Boards/Commands.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Commands'),{thoughtspace:'board'}),native=f.makeLeaf('markdown',file);f.setActive(native);assert.equal(commands[2].checkCallback(true),true);assert.equal(routed.length,2);commands[2].checkCallback(false);assert.equal(routed.at(-1)![0],'openCurrentMarkdownBoard');
 const board=f.makeLeaf(VIEW,file);f.setActive(board);assert.equal(commands[3].checkCallback(true),true);commands[3].checkCallback(false);assert.deepEqual(routed.at(-1),['openBoardNativeMarkdown',file,board]);
 for(const [index,format]of [[4,'markdown'],[5,'legacy']]as const){assert.equal(commands[index].checkCallback(true),true);commands[index].checkCallback(false);assert.deepEqual(routed.at(-1),['promptSaveBoardAs',format,board.view]);board.view.session.blocked=true;assert.equal(commands[index].checkCallback(true),false);board.view.session.blocked=false;}
 const legacy=f.put('Boards/Commands.thoughtspace',JSON.stringify(model.emptyBoard())),legacyLeaf=f.makeLeaf(VIEW,legacy);f.setActive(legacyLeaf);assert.equal(commands[3].checkCallback(true),false);
});

test('a replaced file during asynchronous opening cannot create a pane from a stale file identity',async()=>{
 const f=fixture(),raw=documents.createMarkdownBoardDocument(model.emptyBoard(),'Moved'),file=f.put('Boards/Identity.md',raw,{thoughtspace:'board'}),read=f.app.vault.read;
 f.app.vault.read=async(target:TFile)=>{const result=await read(target);f.files.set(file.path,new TFile(file.path));return result;};
 await assert.rejects(f.host.openBoard(file));assert.equal(f.leaves.length,0);assert.equal(f.disk.get(file),raw);
});

test('latest-input cancellation during codec reading does not create or focus a stale pane',async()=>{
 const f=fixture(),file=f.put('Boards/Cancel.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Cancel'),{thoughtspace:'board'}),read=f.app.vault.read;let current=true;
 f.app.vault.read=async(target:TFile)=>{const raw=await read(target);current=false;return raw;};await f.host.openBoard(file,false,()=>current);
 assert.equal(f.leaves.length,0);assert.equal(f.events.some(event=>event[0]==='active'),false);
});

test('save-as rejects native ownership and asynchronous identity replacement before creating a copy',async()=>{
 for(const invalid of ['native','replace','session-failure']as const){const f=fixture(),raw=documents.createMarkdownBoardDocument(model.emptyBoard(),'Protected'),file=f.put('Boards/Protected.md',raw,{thoughtspace:'board'}),before=f.files.size;
  if(invalid==='native')f.makeLeaf('markdown',file);
  else if(invalid==='replace'){const read=f.app.vault.read;f.app.vault.read=async(target:TFile)=>{const value=await read(target);f.files.set(file.path,new TFile(file.path));return value;};}
  else f.host.sessions.set(file,Promise.resolve({blocked:false,refreshNativeEditing:()=>{},flush:async()=>{throw Error('Atomic save failure');}}));
  await assert.rejects(f.host.saveBoardAs(file,'Rejected','markdown'));assert.equal(f.files.size,before);assert.equal(f.disk.get(file),raw);assert.equal(f.events.some(event=>event[0]==='createFile'),false);
 }
});

test('a Markdown board at the vault root keeps exact paths through explicit open, native return and save-as',async()=>{
 const f=fixture(),board=contentBoard(),raw=documents.createMarkdownBoardDocument(board,'Root')+'\nRoot prose.\n',file=f.put('Root.md',raw,{thoughtspace:'board'});
 await f.host.openBoard(file);assert.equal(f.host.currentBoard.file,file);assert.equal(f.active().state.state.file,'Root.md');
 const leaf=f.active();await f.host.openBoardNativeMarkdown(file,leaf);assert.equal(leaf.type,'markdown');await f.host.openCurrentMarkdownBoard();assert.equal(leaf.type,VIEW);assert.equal(leaf.state.state.file,'Root.md');assert.equal(f.disk.get(file),raw);
 const copy=await f.host.saveBoardAs(file,'Root copy','markdown');assert.equal(copy.path,'ThoughtSpace/白板/Root copy.md');assert.deepEqual(decoded(copy,f.disk.get(copy)!).nodes,board.nodes);assert.equal(f.disk.get(file),raw);
});

test('save-as rejects the same TFile moved while its codec source is being read',async()=>{
 const f=fixture(),raw=documents.createMarkdownBoardDocument(model.emptyBoard(),'Moving'),file=f.put('Root.md',raw,{thoughtspace:'board'}),read=f.app.vault.read;
 f.app.vault.read=async(target:TFile)=>{const value=await read(target);f.files.delete(file.path);file.path='Moved/Root.md';f.files.set(file.path,file);return value;};
 await assert.rejects(f.host.saveBoardAs(file,'Cancelled copy','markdown'));assert.equal(f.events.some(event=>event[0]==='createFile'),false);assert.equal(f.disk.get(file),raw);
});

test('title rename declines an in-place TFile move during the authoritative session flush',async()=>{
 const f=fixture(),file=f.put('Root.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Root'),{thoughtspace:'board'}),view=new ViewMenu(),owner={blocked:false,flush:async()=>{f.files.delete(file.path);file.path='Moved/Root.md';f.files.set(file.path,file);}};
 Object.assign(view,{app:f.app,file,session:owner,requireOwner:()=>owner});view.renameBoard();await assert.rejects(prompts.at(-1).run('Renamed'));assert.equal(file.path,'Moved/Root.md');assert.equal(f.events.some(event=>event[0]==='rename'),false);
});

test('native Properties handoff refuses a moved file after the board session flush',async()=>{
 const f=fixture(),raw=documents.createMarkdownBoardDocument(model.emptyBoard(),'Moving'),file=f.put('Root.md',raw,{thoughtspace:'board'}),leaf=f.makeLeaf(VIEW,file);
 leaf.view.session.flush=async()=>{f.files.delete(file.path);file.path='Moved/Root.md';f.files.set(file.path,file);};await assert.rejects(f.host.openBoardNativeMarkdown(file,leaf));assert.equal(leaf.type,VIEW);assert.equal(f.disk.get(file),raw);
});

test('native-to-board handoff waits for the opened session fresh read before returning focus',async()=>{
 const f=fixture(),file=f.put('Root.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Root'),{thoughtspace:'board'}),leaf=f.makeLeaf('markdown',file),setState=leaf.setViewState;f.setActive(leaf);
 let finish!:()=>void,refreshStarted=false;const refreshed=new Promise<void>(resolve=>{finish=resolve;});const activeBefore=f.events.filter(event=>event[0]==='active').length;
 leaf.setViewState=async(state:any)=>{if(state.type===VIEW)assert(f.host.nativeBoardTransitions.has(file));await setState(state);if(state.type===VIEW)leaf.view.session.externalUpdate=async()=>{refreshStarted=true;await refreshed;};};
 let done=false;const returning=f.host.openCurrentMarkdownBoard().then(()=>{done=true;});await tick();assert(refreshStarted);assert.equal(done,false);assert.equal(f.events.filter(event=>event[0]==='active').length,activeBefore);
 finish();await returning;assert.equal(done,true);assert.equal(leaf.type,VIEW);assert.equal(f.host.nativeBoardTransitions.size,0);
});

test('a switched leaf during the fresh session read cancels the handoff and releases the transition',async()=>{
 const f=fixture(),file=f.put('Root.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Root'),{thoughtspace:'board'}),other=f.put('Other.md','# native'),leaf=f.makeLeaf('markdown',file),setState=leaf.setViewState;f.setActive(leaf);
 leaf.setViewState=async(state:any)=>{await setState(state);if(state.type===VIEW)leaf.view.session.externalUpdate=async()=>{await setState({type:'markdown',state:{file:other.path,mode:'source'}});};};
 await assert.rejects(f.host.openCurrentMarkdownBoard());assert.equal(leaf.type,'markdown');assert.equal(leaf.view.file,other);assert.equal(f.host.nativeBoardTransitions.size,0);assert.equal(f.disk.get(other),'# native');
});

test('the active native editor menu returns the same Markdown board safely while Explorer preserves ordinary opening',async()=>{
 const f=fixture(),file=f.put('Boards/Context.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Context'),{thoughtspace:'board'}),leaf=f.makeLeaf('markdown',file);f.setActive(leaf);let returns=0,opens=0;f.host.openCurrentMarkdownBoard=async()=>{returns++;};f.host.openBoard=async()=>{opens++;};
 const editor=new Menu();f.host.nativeFileMenu(editor,[file],leaf.view);const returning=editor.items.find(item=>item.title==='返回白板');assert(returning);await returning.run!();assert.equal(returns,1);assert.equal(opens,0);
 const explorer=new Menu();f.host.nativeFileMenu(explorer,[file]);assert(!explorer.items.some(item=>item.title==='返回白板'));await explorer.items.find(item=>item.title==='以白板打开')!.run!();assert.equal(opens,1);
});
test('a stale native menu cannot navigate a newer active native page',async()=>{
 const f=fixture(),file=f.put('Boards/Stale.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Stale'),{thoughtspace:'board'}),leaf=f.makeLeaf('markdown',file);f.setActive(leaf);const menu=new Menu();f.host.nativeFileMenu(menu,[file],leaf.view);let returns=0;f.host.openCurrentMarkdownBoard=async()=>{returns++;};const next=f.put('Other.md','# retain'),other=f.makeLeaf('markdown',next);f.setActive(other);await assert.rejects(Promise.resolve().then(()=>menu.items.find(item=>item.title==='返回白板')!.run!()),/已变化|取消/);assert.equal(returns,0);assert.equal(f.active(),other);
});
test('rapid identical native Properties requests share one board flush and one same-leaf transition',async()=>{
 const f=fixture(),file=f.put('Boards/Repeated.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Repeated'),{thoughtspace:'board'}),leaf=f.makeLeaf(VIEW,file);f.setActive(leaf);let flushes=0,release!:()=>void;const hold=new Promise<void>(resolve=>release=resolve);leaf.view.session.flush=async()=>{flushes++;await hold;};
 const first=f.host.openBoardNativeMarkdown(file,leaf),second=f.host.openBoardNativeMarkdown(file,leaf);await tick();assert.equal(flushes,1);release();await Promise.all([first,second]);assert.equal(f.events.filter(event=>event[0]==='state').length,1);assert.equal(f.leaves.length,1);assert.equal(leaf.type,'markdown');
});
for(const changed of ['active-leaf','view','file','session']as const)test(`native Properties request cancels a changed ${changed} during flush without late transition or focus`,async()=>{
 const f=fixture(),file=f.put('Boards/Pending.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Pending'),{thoughtspace:'board'}),leaf=f.makeLeaf(VIEW,file);f.setActive(leaf);let release!:()=>void;const hold=new Promise<void>(resolve=>release=resolve);leaf.view.session.flush=async()=>hold;const opening=f.host.openBoardNativeMarkdown(file,leaf),settled=Promise.allSettled([opening]);await tick();
 const other=f.put('Other.md','# keep newer page');if(changed==='active-leaf')f.setActive(f.makeLeaf('markdown',other));else if(changed==='view')leaf.view=new MarkdownView(other,'# keep newer page',()=>{});else if(changed==='file')leaf.view.file=other;else leaf.view.session={blocked:false,flush:async()=>{}};
 const focus=f.events.filter(event=>event[0]==='active').length;release();const result=await settled;assert.equal(result[0].status,'rejected');assert.equal(f.events.filter(event=>event[0]==='state').length,0);assert.equal(f.events.filter(event=>event[0]==='active').length,focus);assert.equal(f.disk.get(other),'# keep newer page');
});

test('a native Properties request that leaves then returns still cancels and releases its listener',async()=>{
 const f=fixture(),file=f.put('Boards/Away.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Away'),{thoughtspace:'board'}),leaf=f.makeLeaf(VIEW,file);f.setActive(leaf);let release!:()=>void;const hold=new Promise<void>(resolve=>release=resolve);leaf.view.session.flush=async()=>hold;const opening=f.host.openBoardNativeMarkdown(file,leaf),settled=Promise.allSettled([opening]);await tick();assert.equal(f.navigationListeners.size,1);const other=f.makeLeaf('markdown',f.put('Other.md','# Other'));f.setActive(other);f.setActive(leaf);release();assert.equal((await settled)[0].status,'rejected');assert.equal(f.events.filter(event=>event[0]==='state').length,0);assert.equal(f.navigationListeners.size,0);
});
test('blocked native Properties handoff preserves its board and allows one fresh retry after saving succeeds',async()=>{
 const f=fixture(),file=f.put('Boards/Retry.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Retry'),{thoughtspace:'board'}),leaf=f.makeLeaf(VIEW,file);f.setActive(leaf);leaf.view.session.blocked=true;await assert.rejects(f.host.openBoardNativeMarkdown(file,leaf),/布局尚未安全保存/);assert.equal(leaf.type,VIEW);assert.equal(f.navigationListeners.size,0);leaf.view.session.blocked=false;await f.host.openBoardNativeMarkdown(file,leaf);assert.equal(leaf.type,'markdown');assert.equal(f.navigationListeners.size,0);
});
test('the toggle handler reuses both safe paths and never makes an ordinary note into a board',async()=>{
 const f=fixture(),file=f.put('Boards/Toggle.md',documents.createMarkdownBoardDocument(model.emptyBoard(),'Toggle'),{thoughtspace:'board'}),leaf=f.makeLeaf(VIEW,file);f.setActive(leaf);await f.host.toggleBoardNative();assert.equal(leaf.type,'markdown');await f.host.toggleBoardNative();assert.equal(leaf.type,VIEW);assert.equal(f.leaves.length,1);
 const ordinary=f.makeLeaf('markdown',f.put('Ordinary.md','# retain ordinary'));f.setActive(ordinary);await assert.rejects(f.host.toggleBoardNative(),/thoughtspace/);assert.equal(ordinary.type,'markdown');
});
