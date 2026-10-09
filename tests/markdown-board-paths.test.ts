import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,parseBoard,boardLinks,canvasExport} from '../src/model';
import {boardLink,parseBoardLink} from '../src/deeplinks';
import {cleanFavorites,remapFavorites} from '../src/navigation';
import {bookmarkedBoards,type Bookmark} from '../src/bookmarks';
import {cleanLocalRelationsWorkspaceState,cleanLocalRelationsPreferences,remapLocalRelationsPreferences} from '../src/local-relations-state';
import {cleanHubPreferences,rememberBoard,remapHubPaths} from '../src/space-hub';
import {createBrainBoard} from '../src/brain-board';
import {planBrainNoteRelation} from '../src/brain-board-create';
import {captureLocalRelationEdit} from '../src/local-relations-edit';
import {videoCaptureRequest} from '../src/video-capture';
import {mediaSourceUrl,parseMediaSourceUrl,isVaultMediaPath} from '../src/media-source';
import {isBoardPath} from '../src/board-path';

const markdown='白板/研究 + [一] #100%2F & 问答.md';
const legacy='白板/研究 + [一] #100%2F & 问答.thoughtspace';
// These pure functions retain path candidates. A host must verify the actual
// Markdown frontmatter and complete board payload before opening any candidate.
test('board path helper accepts candidates without normalizing literal filename characters or inspecting note contents',()=>{
 for(const path of [legacy,markdown,'普通笔记.md','Board.MD','Board.Md'])assert.equal(isBoardPath(path),true,path);
 for(const path of [undefined,null,123,{},[],true,'','Board.txt','Board.thoughtspace/','Board.THOUGHTSPACE','../Board.md','./Board.md','Folder/../Board.md','Folder/./Board.md','/Board.md','Folder\\Board.md'])assert.equal(isBoardPath(path),false,String(path));
 assert.equal(isBoardPath('白板/%2F.md'),true);assert.equal(isBoardPath('白板/#^anchor.md'),true);
});

test('the board model gains only the Markdown extension and retains existing path-field semantics',()=>{
 for(const suffix of ['thoughtspace','md'])for(const prefix of [' Leading','Folder//Board','Folder/Name:part','Folder/Tab\tName','x'.repeat(8192)]){
  const board={...emptyBoard(),version:3 as const,nodes:[{id:'child',kind:'board' as const,file:`${prefix}.${suffix}`,x:0,y:0,width:320,height:240,color:'green' as const}]};
  assert.deepEqual(parseBoard(JSON.stringify(board)),board);
 }
});

test('caller-specific path guards remain separate from the candidate extension helper',()=>{
 assert.equal(isBoardPath(' Bad\tName.md'),true);assert.throws(()=>parseBoardLink({vault:'V',file:'Bad\tName.md'},'V'));
 const wrapper=(boardPath:string)=>cleanLocalRelationsWorkspaceState({version:1,boardPath,originLeafId:'leaf',state:{version:1,center:'node'}});
 for(const path of [' Leading.md','Folder//Board.md','Folder/Name:part.md','Tab\tName.md','x'.repeat(1025)+'.md'])assert.equal(wrapper(path).boardPath,undefined,path.slice(0,30));
 const source={vault:'V',board:markdown,node:'node',file:'clip.mp4',time:1};
 for(const board of [' Leading.md','Folder//Board.md','C:/Board.md','https://host/Board.md','Tab\tName.md','x'.repeat(8193)+'.md'])assert.throws(()=>mediaSourceUrl({...source,board}));
});

test('child boards accept Markdown paths in supported schema versions while preserving identities and Canvas export',()=>{
 for(const file of [legacy,markdown])for(const version of [2,3] as const){
  const board={...emptyBoard(),version,nodes:[{id:'child + #id',kind:'board' as const,file,x:30,y:40,width:320,height:240,color:'green' as const}]};
  assert.deepEqual(parseBoard(JSON.stringify(board)),board);assert.deepEqual(boardLinks(board),[file]);
  assert.equal((canvasExport(board).nodes[0] as {file:string}).file,file);
 }
 const old={...emptyBoard(),nodes:[{id:'child',kind:'board',file:markdown,x:0,y:0,width:320,height:240,color:'green'}]};
 assert.throws(()=>parseBoard(JSON.stringify(old)),/白板节点/);
});

test('Markdown board deep links retain literal path, node, vault and existing URL encoding',()=>{
 const vault='研究 + 笔记',node='node/#^anchor + %2F';
 for(const file of [legacy,markdown]){
  const uri=new URL(boardLink(vault,file,node));assert.deepEqual(parseBoardLink(Object.fromEntries(uri.searchParams),vault),{file,node});
  assert.deepEqual(parseBoardLink({space:vault,file,node,action:'thoughtspace'},vault),{file,node});
  assert.throws(()=>parseBoardLink({space:'other',file,node},vault));assert.ok(uri.href.includes('%252F'));
 }
});

test('favorite path candidates retain both extensions and rename folders without changing literal filenames',()=>{
 assert.deepEqual(cleanFavorites([legacy,markdown,markdown,'other.txt']),[legacy,markdown]);
 assert.deepEqual(remapFavorites([legacy,markdown],'白板','资料'),[legacy.replace('白板/','资料/'),markdown.replace('白板/','资料/')]);
 assert.deepEqual(remapFavorites([legacy,markdown],markdown),[legacy]);
});

test('nested native bookmarks retain Markdown candidates, exclude anchors and keep cyclic groups bounded',()=>{
 const folder:Bookmark={type:'group',items:[{type:'file',path:legacy},{type:'file',path:markdown},{type:'file',path:markdown,subpath:'#^anchor'},{type:'file',path:'other.txt'}]};
 folder.items!.push(folder);assert.deepEqual(bookmarkedBoards([folder]),[legacy,markdown]);
});

test('relation restoration and rename preserve Markdown board paths and existing node history',()=>{
 const state={version:1,center:'node + #id',history:{entries:['first','node + #id'],index:1},pins:['first'],recent:['node + #id']};
 const wrapper=cleanLocalRelationsWorkspaceState({version:1,boardPath:markdown,originLeafId:'leaf-01',state});
 assert.equal(wrapper.boardPath,markdown);assert.equal(wrapper.originLeafId,'leaf-01');assert.deepEqual(wrapper.state.history,state.history);
 const prefs=cleanLocalRelationsPreferences({[legacy]:state,[markdown]:state});assert.deepEqual(Object.keys(prefs),[legacy,markdown]);
 const remapped=remapLocalRelationsPreferences(prefs,'白板','资料');assert.deepEqual(Object.keys(remapped),[legacy.replace('白板/','资料/'),markdown.replace('白板/','资料/')]);
 assert.deepEqual(remapped[markdown.replace('白板/','资料/')].history,state.history);
});

test('space hub cleanup, MRU and folder rename preserve both board extensions',()=>{
 let prefs=cleanHubPreferences({recent:[{path:legacy,at:1},{path:markdown,at:2}]});assert.deepEqual(prefs.recent,[{path:legacy,at:1},{path:markdown,at:2}]);
 prefs=rememberBoard(prefs,markdown,3);assert.deepEqual(cleanHubPreferences(prefs).recent,[{path:markdown,at:3},{path:legacy,at:1}]);
 assert.deepEqual(remapHubPaths(prefs,'白板','资料').recent.map(item=>item.path),[markdown.replace('白板/','资料/'),legacy.replace('白板/','资料/')]);
});

test('brain board creation keeps Markdown child boards distinct from note cards and reuses existing node identity',()=>{
 for(const side of ['top','bottom','left','right'] as const){
  const board=createBrainBoard('center');board.nodes=[{id:'center',kind:'card',file:'Center.md',x:0,y:0,width:320,height:240,color:'slate'}];
  const before=JSON.stringify(board),result=planBrainNoteRelation(board,'center',markdown,side,'child','edge + #id',captureLocalRelationEdit(board,['center']),undefined,'board');
  assert.equal(result.board.nodes.at(-1)!.kind,'board');assert.equal(result.board.nodes.at(-1)!.file,markdown);
  assert.equal(result.board.edges[0].id,'edge + #id');assert.deepEqual(parseBoard(JSON.stringify(result.board)),result.board);assert.equal(JSON.stringify(board),before);
 }
 const board=createBrainBoard('center');board.nodes=[{id:'center',kind:'card',file:'Center.md',x:0,y:0,width:320,height:240,color:'slate'},{id:'existing',kind:'board',file:markdown,x:900,y:0,width:320,height:240,color:'green'}];
 const result=planBrainNoteRelation(board,'center',markdown,'right','unused','relation',captureLocalRelationEdit(board,['center']),undefined,'board');assert.equal(result.added,false);assert.equal(result.nodeId,'existing');assert.deepEqual(result.board.nodes,board.nodes);
});

test('video capture requests accept Markdown board destinations without changing provenance or existing note-path guards',()=>{
 const request={id:'12345678-1234-1234-1234-123456789abc',board:markdown,note:'视频/记录.md',vaultId:'abcdef0123456789abcd'};
 for(const board of [legacy,markdown])assert.deepEqual(videoCaptureRequest({...request,board}),{...request,board});
 for(const board of ['../bad.md','.obsidian/bad.md','bad.txt'])assert.throws(()=>videoCaptureRequest({...request,board}));
 assert.throws(()=>videoCaptureRequest({...request,note:'.obsidian/private.md'}));
});

test('media backlinks accept Markdown board destinations and preserve one-step protocol encoding',()=>{
 for(const board of [legacy,markdown]){
  const source={vault:'研究 + 笔记',board,node:'node/#^anchor + %2F',file:'媒体/课程 + #100%2F.mp4',time:12.125},uri=mediaSourceUrl(source);
  assert.deepEqual(parseMediaSourceUrl(uri),source);assert.ok(!uri.includes('+'));assert.ok(uri.includes('%252F'));
  const params:Record<string,string>={};for(const pair of uri.split('?')[1].split('&')){const [key,value]=pair.split('=');params[decodeURIComponent(key)]=decodeURIComponent(value);}
  assert.deepEqual(parseMediaSourceUrl({...params,action:'thoughtspace-media'}),source);
 }
 // Attachment validation remains separate from the board extension change.
 assert.equal(isVaultMediaPath(markdown),false);assert.equal(isVaultMediaPath('https://host/clip.mp4'),false);assert.equal(isVaultMediaPath('媒体/片段.mp4'),true);
});
