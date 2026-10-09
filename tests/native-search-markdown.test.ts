import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as search from '../src/native-search';
import {emptyBoard,type Board} from '../src/model';

const vault='研究库 #😀',source='白板/材料 #😀.md';
const queryValue=(value:string)=>new URLSearchParams({value}).toString().slice('value='.length);
function board(){const value=emptyBoard();value.version=3;value.nodes=[{id:'first',kind:'text',title:'来源标题',text:'中文检索内容\n- [ ] task\n![[linked]]',x:400,y:900,width:220,height:80,color:'green'},{id:'group',kind:'section',title:'分组检索',x:0,y:0,width:1000,height:1000,color:'green'}];value.edges=[{id:'edge',from:'first',to:'group',label:'关系检索'}];return value;}
function signedV1(body:string){return `<!-- thoughtspace-search-v1:${createHash('sha256').update(body).digest('hex')} -->\n${body}`;}
function resignedV2(text:string,change:(body:string)=>string){const first=text.indexOf('\n'),marker=/^<!-- thoughtspace-search-v2:([a-f0-9]{64}):([^\s]+) -->$/.exec(text.slice(0,first));assert.ok(marker,'generated Markdown mirror must carry a v2 source binding');const path=decodeURIComponent(marker[2]),body=change(text.slice(first+1));return `<!-- thoughtspace-search-v2:${createHash('sha256').update(path+'\n'+body).digest('hex')}:${marker[2]} -->\n${body}`;}

test('Markdown mirror mapping is separate from its source and needs verified document identity',()=>{
 const target=search.searchIndexPath(source),text=search.boardSearchDocument(board(),source,vault);
 assert.equal(target,`${search.SEARCH_FOLDER}/${source}.md`);assert.notEqual(target,source);
 assert.equal(search.isSearchIndexPath(target),true);assert.equal(search.searchBoardPath(target),undefined);
 assert.equal(search.searchBoardPath(target,text),source);assert.equal(search.searchBoardPath(target,'ordinary Markdown'),undefined);
 for(const path of [source,`${search.SEARCH_FOLDER}/ordinary.md`,`${search.SEARCH_FOLDER}/unrelated.txt.md`])assert.equal(search.isSearchIndexPath(path),false);
});

test('Markdown mirrors remain searchable excerpts, not a metadata or layout container',()=>{
 const value=board(),text=search.boardSearchDocument(value,source,vault);
 assert.match(text,/^<!-- thoughtspace-search-v2:/);assert.ok(search.isManagedSearchIndex(text));
 assert.ok(text.includes('# 材料 #😀 · 白板搜索'));assert.ok(text.includes(value.nodes[0].text!));
 for(const metadata of ['thoughtspace: board','thoughtspace-board-layout:start','"format":"thoughtspace-board"','"nodes":','"x":400','"camera":','"savedSearches":'])assert.equal(text.includes(metadata),false,metadata);
 const moved=structuredClone(value);moved.nodes[0].x+=150;assert.equal(search.boardSearchDocument(moved,source,vault),text);
 for(const [hit,node]of [['中文检索内容','first'],['分组检索','group'],['关系检索','first']])assert.deepEqual(search.searchIndexTarget(search.searchIndexPath(source),text,vault,text.split('\n').indexOf(hit)),{file:source,node});
 assert.deepEqual(search.searchIndexTarget(search.searchIndexPath(source),text,vault,1),{file:source});
});

test('real Markdown sources and ordinary Markdown notes never become mirror navigation targets',()=>{
 const text=search.boardSearchDocument(board(),source,vault);
 for(const path of [source,`${search.SEARCH_FOLDER}/ordinary.md`,`${search.SEARCH_FOLDER}/plain.md.md`])assert.equal(search.searchIndexTarget(path,text,vault,1),undefined);
 const original=`---\nthoughtspace: board\n---\n\nOriginal searchable prose\n\n<!-- thoughtspace-board-layout:start -->\n${JSON.stringify({format:'thoughtspace-board',version:1,board:board()})}\n<!-- thoughtspace-board-layout:end -->`;
 assert.equal(search.isManagedSearchIndex(original),false);assert.equal(search.searchBoardPath(search.searchIndexPath(source),original),undefined);assert.equal(search.searchIndexTarget(search.searchIndexPath(source),original,vault),undefined);
});

test('v2 source binding rejects mismatched mirrors, tampering, legacy imitation and malformed markers',()=>{
 const text=search.boardSearchDocument(board(),source,vault),target=search.searchIndexPath(source);
 assert.equal(search.searchIndexTarget(search.searchIndexPath('白板/另一份.md'),text,vault,1),undefined);
 assert.equal(search.searchBoardPath(target,text+'manual edit'),undefined);assert.equal(search.isManagedSearchIndex(text+'manual edit'),false);
 const changedSource=text.replace(encodeURIComponent(source),encodeURIComponent('白板/另一份.md'));assert.equal(search.isManagedSearchIndex(changedSource),false);
 const body=text.slice(text.indexOf('\n')+1),legacy=signedV1(body);assert.ok(search.isManagedSearchIndex(legacy));assert.equal(search.searchBoardPath(target,legacy),undefined);assert.equal(search.searchIndexTarget(target,legacy,vault,1),undefined);
 for(const marker of ['%','%2Foutside.md','..%2Fescape.md']){const bad=text.replace(/:([^\s]+) -->\n/,`:${marker} -->\n`);assert.equal(search.searchBoardPath(target,bad),undefined);assert.equal(search.isManagedSearchIndex(bad),false);}
 const mismatched=resignedV2(text,body=>body.replace(`file=${queryValue(source)}`,`file=${queryValue('白板/另一份.md')}`));assert.equal(search.isManagedSearchIndex(mismatched),false);assert.equal(search.searchBoardPath(target,mismatched),undefined);assert.equal(search.searchIndexTarget(target,mismatched,vault,1),undefined);
});

test('new Markdown source mapping rejects absolute, traversal, controls and empty path segments',()=>{
 for(const path of ['/outside.md','../escape.md','a/../escape.md','./board.md','a/./board.md','a//board.md','a\\board.md','a\u0000.md','a\n.md']){
  assert.equal(search.isSearchIndexPath(search.searchIndexPath(path)),false,path);
  assert.throws(()=>search.boardSearchDocument(board(),path,vault),/路径/,path);
 }
});

test('Markdown mirror links retain vault and source checks while quoted links stay inert',()=>{
 const value=board();value.nodes[0].text='First\n```\n[定位 对象](obsidian://thoughtspace?space=other&file=wrong.md&node=wrong)\nLast';
 const text=search.boardSearchDocument(value,source,vault),target=search.searchIndexPath(source);
 for(const hit of ['First','Last'])assert.deepEqual(search.searchIndexTarget(target,text,vault,text.split('\n').indexOf(hit)),{file:source,node:'first'});
 assert.equal(search.searchIndexTarget(target,text,'其他库',1),undefined);
 for(const bad of ['file=..%2Fescape.md','file=%2Foutside.md','file=a%00.md','space=其他库']){const changed=resignedV2(text,body=>body.replace(bad.startsWith('space=')?`space=${queryValue(vault)}`:`file=${queryValue(source)}`,bad));assert.equal(search.searchIndexTarget(target,changed,vault,1),undefined,bad);}
});

test('legacy ThoughtSpace search mapping, marker, opening links and excerpts stay compatible',()=>{
 const path='资料/旧 #😀.thoughtspace',value=board(),text=search.boardSearchDocument(value,path,vault),target=search.searchIndexPath(path);
 assert.match(text,/^<!-- thoughtspace-search-v1:[a-f0-9]{64} -->\n# 旧 #😀 · 白板搜索\n\n/);assert.equal(search.isSearchIndexPath(target),true);assert.equal(search.searchBoardPath(target),path);assert.ok(search.isManagedSearchIndex(text));
 assert.deepEqual(search.searchIndexTarget(target,text,vault,text.split('\n').indexOf('关系检索')),{file:path,node:'first'});
});

test('Markdown mirrors follow the source extension case accepted by native board paths',()=>{
 const path='白板/大写.MD',text=search.boardSearchDocument(board(),path,vault),target=search.searchIndexPath(path);
 assert.match(text,/^<!-- thoughtspace-search-v2:/);assert.ok(text.includes('# 大写 · 白板搜索'));assert.equal(search.isSearchIndexPath(target),true);assert.equal(search.searchBoardPath(target,text),path);assert.deepEqual(search.searchIndexTarget(target,text,vault,1),{file:path});
});

function fixture(initial:Board|undefined=board()){
 const files=new Map<string,string>(),errors:unknown[]=[],writes:string[]=[],removals:string[]=[],reads:string[]=[];let current:Board|undefined=initial;
 const sync=new search.BoardSearchSync({board:async()=>current,read:async path=>{reads.push(path);return files.get(path);},write:async(path,text,expected)=>{assert.equal(files.get(path),expected);files.set(path,text);writes.push(path);},remove:async(path,expected)=>{assert.equal(files.get(path),expected);files.delete(path);removals.push(path);}},vault,(_path,error)=>errors.push(error));
 return {sync,files,errors,writes,removals,reads,setBoard:(value:Board|undefined)=>{current=value;}};
}

test('Markdown mirror worker coalesces saves, avoids the actual source and removes only its own orphan',async()=>{
 const f=fixture(),target=search.searchIndexPath(source),original='Original source YAML and body';f.files.set(source,original);
 for(let i=0;i<20;i++)f.sync.enqueue(source);await f.sync.flush();assert.deepEqual(f.writes,[target]);assert.ok(search.isManagedSearchIndex(f.files.get(target)!));assert.equal(f.files.get(source),original);
 f.sync.enqueue(source);await f.sync.flush();assert.equal(f.writes.length,1);
 f.setBoard(undefined);f.sync.enqueue(source);await f.sync.flush();assert.deepEqual(f.removals,[target]);assert.equal(f.files.get(source),original);assert.deepEqual(f.errors,[]);
});

test('Markdown mirror worker preserves manual edits and correctly checks identity before update or delete',async()=>{
 const badOpening=resignedV2(search.boardSearchDocument(board(),source,vault),body=>body.replace(`file=${queryValue(source)}`,`file=${queryValue('白板/另一份.md')}`));
 for(const old of ['ordinary note',search.boardSearchDocument(board(),'白板/另一份.md',vault),badOpening,signedV1(search.boardSearchDocument(board(),source,vault).split('\n').slice(1).join('\n'))]){
  const f=fixture(),target=search.searchIndexPath(source);f.files.set(target,old);f.sync.enqueue(source);await f.sync.flush();f.setBoard(undefined);f.sync.enqueue(source);await f.sync.flush();assert.equal(f.files.get(target),old);assert.deepEqual(f.writes,[]);assert.deepEqual(f.removals,[]);assert.equal(f.errors.length,2);
 }
});

test('unsafe Markdown sources are rejected before mirror IO',async()=>{
 const f=fixture();f.sync.enqueue('../outside.md');await f.sync.flush();assert.equal(f.errors.length,1);assert.deepEqual(f.reads,[]);assert.deepEqual(f.writes,[]);assert.deepEqual(f.removals,[]);
});

test('Markdown mirror worker drains the latest save and stops pending work without touching a source',async()=>{
 const value=board();let sync!:search.BoardSearchSync,stored:string|undefined;const content:string[]=[];
 sync=new search.BoardSearchSync({board:async()=>value,read:async()=>stored,write:async(_path,text)=>{stored=text;content.push(text);if(content.length===1){value.nodes[0].text='latest Markdown board edit';sync.enqueue(source);}},remove:async()=>{}},vault,(_path,error)=>assert.fail(String(error)));
 sync.enqueue(source);await sync.flush();assert.equal(content.length,2);assert.ok(content[1].includes('latest Markdown board edit'));
 let resolve!:(value:Board)=>void,writes=0;const stopped=new search.BoardSearchSync({board:()=>new Promise(done=>{resolve=done;}),read:async()=>undefined,write:async()=>{writes++;},remove:async()=>{}},vault,(_path,error)=>assert.fail(String(error)));
 stopped.enqueue(source);const pending=stopped.flush();stopped.stop();resolve(value);await pending;assert.equal(writes,0);
});

test('Markdown mirror write failures report the source and allow a later retry',async()=>{
 const errors:{path:string;error:unknown}[]=[];let fail=true,stored:string|undefined,writes=0;
 const sync=new search.BoardSearchSync({board:async()=>board(),read:async()=>stored,write:async(_path,text)=>{writes++;if(fail)throw Error('disk temporarily unavailable');stored=text;},remove:async()=>{}},vault,(path,error)=>errors.push({path,error}));
 sync.enqueue(source);await sync.flush();assert.equal(stored,undefined);assert.equal(errors.length,1);assert.equal(errors[0].path,source);assert.match(String(errors[0].error),/disk temporarily unavailable/);
 fail=false;sync.enqueue(source);await sync.flush();assert.equal(writes,2);assert.ok(search.isManagedSearchIndex(stored!));assert.equal(search.searchBoardPath(search.searchIndexPath(source),stored),source);
});
