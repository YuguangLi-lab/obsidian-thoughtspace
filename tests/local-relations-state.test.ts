import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanLocalRelationsState,cleanLocalRelationsWorkspaceState,cleanLocalRelationsPreferences,rememberLocalRelationsState,remapLocalRelationsPreferences,rememberLocalRelation,displayLocalRelationRecent,localRelationsBoardPath,HISTORY_LIMIT,PINS_LIMIT,RECENT_LIMIT,RECENT_VISIBLE_LIMIT,LENSES_LIMIT,SAVED_BOARDS_LIMIT} from '../src/local-relations-state';
import {cleanPluginSettings} from '../src/plugin-settings';

const state=(center='a')=>cleanLocalRelationsState({version:1,center,history:{entries:[center],index:0},pins:[center],recent:[center]});
const board=(index:number)=>`Boards/Board-${index}.thoughtspace`;

test('absent, malformed, old and future state formats return bounded safe defaults',()=>{
 const expected=cleanLocalRelationsState(undefined);for(const raw of [null,false,1,'state',[],{}, {version:0,center:'old'},{version:2,center:'future'}])assert.deepEqual(cleanLocalRelationsState(raw),expected);
 assert.equal(expected.version,1);assert.equal(expected.follow,'board');assert.deepEqual(expected.history,{entries:[],index:-1});assert.deepEqual(expected.pins,[]);assert.deepEqual(expected.recent,[]);assert.deepEqual(expected.settings,{density:'compact',showPaths:true});assert.equal(expected.kindFilters.length,6);
});
test('state captures the real history cursor independently from MRU order and pins',()=>{
 const clean=cleanLocalRelationsState({version:1,center:'b',history:{entries:['a','b','a','c'],index:1},recent:['c','a','b'],pins:['c'],follow:'locked'});assert.deepEqual(clean.history,{entries:['a','b','a','c'],index:1});assert.deepEqual(clean.recent,['c','a','b']);assert.deepEqual(clean.pins,['c']);assert.equal(clean.center,'b');assert.equal(clean.follow,'locked');
});
test('history cleanup preserves cursor meaning across removed entries and adjacent duplicates',()=>{
 const clean=cleanLocalRelationsState({version:1,history:{entries:['a','a',null,'b','b','c','a'],index:4}});assert.deepEqual(clean.history,{entries:['a','b','c','a'],index:1});
});
test('history clamps malformed cursors without losing nonconsecutive visits',()=>{
 for(const index of [undefined,NaN,Infinity,1.5])assert.deepEqual(cleanLocalRelationsState({version:1,history:{entries:['a','b','a'],index}}).history,{entries:['a','b','a'],index:2});
 assert.equal(cleanLocalRelationsState({version:1,history:{entries:['a','b'],index:99}}).history.index,1);assert.equal(cleanLocalRelationsState({version:1,history:{entries:['a','b'],index:-10}}).history.index,0);assert.deepEqual(cleanLocalRelationsState({version:1,history:{entries:['',null],index:8}}).history,{entries:[],index:-1});
});
test('history keeps at most 80 recent entries and remaps its cursor',()=>{
 const entries=Array.from({length:120},(_,i)=>`id-${i}`),clean=cleanLocalRelationsState({version:1,history:{entries,index:90}});assert.equal(clean.history.entries.length,HISTORY_LIMIT);assert.equal(clean.history.entries[0],'id-40');assert.equal(clean.history.index,50);assert.equal(clean.history.entries[clean.history.index],'id-90');
});
test('pins and MRU sanitize IDs, deduplicate and apply independent capacities',()=>{
 const input=[null,'',' bad ','bad\nline','x'.repeat(257),'a','a',...Array.from({length:80},(_,i)=>`node-${i}`)],clean=cleanLocalRelationsState({version:1,pins:input,recent:input,center:'bad\u0000id'});assert.equal(clean.pins.length,PINS_LIMIT);assert.equal(clean.recent.length,RECENT_LIMIT);assert.deepEqual(clean.pins.slice(0,2),['a','node-0']);assert.equal(clean.center,undefined);
});
test('MRU promotes revisited IDs without mutating source or browser history',()=>{
 const history={entries:['a','b','c'],index:0},recent=['c','b','a'],before=JSON.stringify(history),next=rememberLocalRelation(recent,'b');assert.deepEqual(next,['b','c','a']);assert.deepEqual(recent,['c','b','a']);assert.equal(JSON.stringify(history),before);assert.deepEqual(rememberLocalRelation(next,' bad '),next);
});
test('MRU stores 40 distinct visits while presentation exposes the latest 14',()=>{
 let recent:string[]=[];for(let i=0;i<100;i++)recent=rememberLocalRelation(recent,`id-${i}`);assert.equal(recent.length,RECENT_LIMIT);assert.equal(recent[0],'id-99');assert.equal(recent.at(-1),'id-60');assert.equal(displayLocalRelationRecent(recent).length,RECENT_VISIBLE_LIMIT);assert.equal(displayLocalRelationRecent(recent).at(-1),'id-86');assert.equal(recent.length,40);
});
test('filter state accepts all supported modes and preserves intentionally hidden categories',()=>{
 for(const queryField of ['all','name','tag','type','title','path','id','label'])assert.equal(cleanLocalRelationsState({version:1,queryField}).queryField,queryField);
 const clean=cleanLocalRelationsState({version:1,query:'name',queryField:'unknown',kindFilter:'section',kindFilters:[],tag:' #topic ',follow:'note',settings:{density:'comfortable',showPaths:false}});assert.equal(clean.queryField,'all');assert.equal(clean.kindFilter,'section');assert.deepEqual(clean.kindFilters,[]);assert.equal(clean.tag,'#topic');assert.equal(clean.follow,'note');assert.deepEqual(clean.settings,{density:'comfortable',showPaths:false});
});
test('filters drop invalid categories and clamp long query, tag and lens labels',()=>{
 const clean=cleanLocalRelationsState({version:1,query:'q'.repeat(3000),tag:'t'.repeat(400),kindFilters:['children','children','unknown',null,'parents'],lenses:[{name:'n'.repeat(200),query:'v'.repeat(2000)}]});assert.equal(clean.query.length,1000);assert.equal(clean.tag.length,200);assert.deepEqual(clean.kindFilters,['parents','children']);assert.equal(clean.lenses[0].name.length,80);assert.equal(clean.lenses[0].query.length,1000);
});
test('saved lenses are named independent copies with an eight-item limit',()=>{
 const filters=['parents'],lenses=[null,{name:''},{name:' A ',kindFilters:filters},{name:'A',query:'duplicate'},...Array.from({length:15},(_,i)=>({name:`Lens ${i}`,query:`Query ${i}`}))],clean=cleanLocalRelationsState({version:1,lenses});assert.equal(clean.lenses.length,LENSES_LIMIT);assert.equal(clean.lenses[0].name,'A');filters.push('children');assert.deepEqual(clean.lenses[0].kindFilters,['parents']);assert.equal(clean.lenses.filter(lens=>lens.name==='A').length,1);
});
test('workspace state includes only a safe vault board path and optional exact leaf identity',()=>{
 const clean=cleanLocalRelationsWorkspaceState({version:1,boardPath:'研究/白板.thoughtspace',originLeafId:'leaf-01',state:state()});assert.equal(clean.boardPath,'研究/白板.thoughtspace');assert.equal(clean.originLeafId,'leaf-01');assert.deepEqual(clean.state,state());assert.equal(cleanLocalRelationsWorkspaceState({version:1,boardPath:'Board.thoughtspace',originLeafId:'bad\nleaf'}).originLeafId,undefined);
});
for(const candidate of ['', '../B.thoughtspace','a/../B.thoughtspace','./B.thoughtspace','/B.thoughtspace','a//B.thoughtspace','a\\B.thoughtspace','C:/B.thoughtspace','https://x/B.thoughtspace',' B.thoughtspace','B.thoughtspace ','B.thoughtspace\n','Notes.txt','B.thoughtspace/','x'.repeat(1025)+'.thoughtspace'])test(`unsafe or non-board workspace path is rejected: ${JSON.stringify(candidate.slice(0,60))}`,()=>{
 assert.equal(localRelationsBoardPath(candidate),undefined);const clean=cleanLocalRelationsWorkspaceState({version:1,boardPath:candidate,originLeafId:'leaf',state:state('old')});assert.equal(clean.boardPath,undefined);assert.equal(clean.originLeafId,undefined);assert.equal(clean.state.center,undefined);
});
test('workspace restoration rejects old/future wrappers and clones nested state',()=>{
 for(const version of [undefined,0,2])assert.equal(cleanLocalRelationsWorkspaceState({version,boardPath:'B.thoughtspace',state:state()}).boardPath,undefined);const input={version:1,boardPath:'B.thoughtspace',state:state()},clean=cleanLocalRelationsWorkspaceState(input);clean.state.pins.push('new');assert.deepEqual(input.state.pins,['a']);
});
test('preferences reject prototype keys, arrays, unknown versions and non-board paths',()=>{
 const hostile=JSON.parse('{"__proto__":{"version":1,"center":"bad"},"constructor":{"version":1},"Notes.txt":{"version":1},"Good.thoughtspace":{"version":1,"pins":["safe"]},"Future.thoughtspace":{"version":99}}');const clean=cleanLocalRelationsPreferences(hostile);assert.deepEqual(Object.keys(clean),['Good.thoughtspace']);assert.deepEqual(clean['Good.thoughtspace'].pins,['safe']);assert.equal(Object.getPrototypeOf(clean),Object.prototype);assert.deepEqual(cleanLocalRelationsPreferences([]),{});
});
test('preference cleaning keeps the latest 30 boards and creates independent values',()=>{
 const input=Object.fromEntries(Array.from({length:45},(_,i)=>[board(i),state(`node-${i}`)])),clean=cleanLocalRelationsPreferences(input);assert.equal(Object.keys(clean).length,SAVED_BOARDS_LIMIT);assert.equal(Object.keys(clean)[0],board(15));assert.equal(Object.keys(clean).at(-1),board(44));clean[board(44)].pins.push('other');assert.deepEqual(input[board(44)].pins,['node-44']);
});
test('actively saving a board refreshes its LRU position without mutating other live histories',()=>{
 const before=Object.fromEntries(Array.from({length:30},(_,i)=>[board(i),state(`node-${i}`)])),updated=rememberLocalRelationsState(before,board(0),state('latest')),next=rememberLocalRelationsState(updated,board(30),state('new'));assert.equal(Object.keys(next).length,30);assert.equal(next[board(1)],undefined);assert.equal(next[board(0)].center,'latest');assert.equal(before[board(0)].center,'node-0');assert.deepEqual(rememberLocalRelationsState(before,'../invalid.thoughtspace',state('bad')),before);
});
test('renaming one board preserves its saved history while keeping similarly named boards',()=>{
 const input={'Boards/A.thoughtspace':state('a'),'Boards/AB.thoughtspace':state('ab')},clean=remapLocalRelationsPreferences(input,'Boards/A.thoughtspace','Moved/Renamed.thoughtspace');assert.deepEqual(Object.keys(clean),['Boards/AB.thoughtspace','Moved/Renamed.thoughtspace']);assert.deepEqual(clean['Moved/Renamed.thoughtspace'].history,input['Boards/A.thoughtspace'].history);assert.ok(input['Boards/A.thoughtspace']);
});
test('folder rename remaps descendants using path boundaries without scanning the vault',()=>{
 const input={'Boards/A.thoughtspace':state('a'),'Boards/Nested/B.thoughtspace':state('b'),'Boards-old/C.thoughtspace':state('c')},clean=remapLocalRelationsPreferences(input,'Boards','Moved');assert.deepEqual(Object.keys(clean).sort(),['Boards-old/C.thoughtspace','Moved/A.thoughtspace','Moved/Nested/B.thoughtspace']);
});
test('file and folder deletion remove only matching records',()=>{
 const input={'Boards/A.thoughtspace':state('a'),'Boards/Nested/B.thoughtspace':state('b'),'Boards-old/C.thoughtspace':state('c')};assert.deepEqual(Object.keys(remapLocalRelationsPreferences(input,'Boards/A.thoughtspace')).sort(),['Boards-old/C.thoughtspace','Boards/Nested/B.thoughtspace']);assert.deepEqual(Object.keys(remapLocalRelationsPreferences(input,'Boards')),['Boards-old/C.thoughtspace']);
});
test('rename collisions preserve the existing destination and invalid remaps are ignored',()=>{
 const input={'A.thoughtspace':state('a'),'B.thoughtspace':state('b')};assert.equal(remapLocalRelationsPreferences(input,'A.thoughtspace','B.thoughtspace')['B.thoughtspace'].center,'b');assert.deepEqual(remapLocalRelationsPreferences(input,'../A.thoughtspace','B.thoughtspace'),input);assert.deepEqual(remapLocalRelationsPreferences(input,'A.thoughtspace','../B.thoughtspace'),input);
});
test('plugin settings retain local-relation data without losing other existing preferences',()=>{
 const raw={localRelations:{'A.thoughtspace':state()},settingsLanguage:'en',boardSearchEnabled:false,notePaneLeafId:'native-leaf',favoriteBoards:['B.thoughtspace']},clean=cleanPluginSettings(raw);assert.deepEqual(clean.localRelations,raw.localRelations);assert.equal(clean.settingsLanguage,'en');assert.equal(clean.boardSearchEnabled,false);assert.equal(clean.notePaneLeafId,'native-leaf');assert.deepEqual(clean.favoriteBoards,['B.thoughtspace']);assert.deepEqual(cleanPluginSettings(null).localRelations,{});
});

test('workspace and plugin state round-trip through JSON without serializing live runtime objects',()=>{
 const saved=cleanLocalRelationsState({version:1,center:'a',history:{entries:['a','b','a'],index:0},pins:['b'],recent:['a','b'],follow:'note',query:'Query',queryField:'tag',tag:'#topic',lenses:[{name:'Topics',query:'#topic',queryField:'tag'}]}),workspace=cleanLocalRelationsWorkspaceState({version:1,boardPath:'A.thoughtspace',originLeafId:'origin',state:saved});assert.deepEqual(cleanLocalRelationsWorkspaceState(JSON.parse(JSON.stringify(workspace))),workspace);const prefs=rememberLocalRelationsState({},'A.thoughtspace',saved);assert.deepEqual(cleanLocalRelationsPreferences(JSON.parse(JSON.stringify(prefs))),prefs);
});
test('two live windows may keep separate cursors after the latest active snapshot is persisted',()=>{
 const one=state('a'),two=state('b');one.history={entries:['a','b','c'],index:0};two.history={entries:['a','b','c'],index:2};const first=rememberLocalRelationsState({},'A.thoughtspace',one),second=rememberLocalRelationsState(first,'A.thoughtspace',two);assert.equal(second['A.thoughtspace'].history.index,2);assert.equal(one.history.index,0);assert.equal(first['A.thoughtspace'].history.index,0);second['A.thoughtspace'].history.entries.push('d');assert.deepEqual(two.history.entries,['a','b','c']);
});
test('large malformed arrays remain bounded and retain a valid history tail',()=>{
 const bad=Array(10000).fill(null),clean=cleanLocalRelationsState({version:1,history:{entries:[...bad,'a','b'],index:10001},pins:bad,recent:bad,lenses:bad,query:'\u0000'.repeat(10000)+'late'});assert.deepEqual(clean.history,{entries:['a','b'],index:1});assert.deepEqual(clean.pins,[]);assert.deepEqual(clean.recent,[]);assert.deepEqual(clean.lenses,[]);assert.equal(clean.query,'');
});
