import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLibraryRecords,filterLibraryCards,libraryKanban,libraryList,libraryTable,mergeBoardSources,type LibrarySourceNote,type LibraryViewQuery} from '../src/card-property-views';
import {emptyLibraryQuery} from '../src/card-property-views';

const note=(path:string,patch:Partial<LibrarySourceNote>={}):LibrarySourceNote=>({path,title:path.split('/').pop()!.replace(/\.md$/,''),tags:[],properties:{},...patch});
const query=(patch:Partial<LibraryViewQuery>={}):LibraryViewQuery=>({...emptyLibraryQuery(),...patch});

test('records keep properties on the note and list every whiteboard that references it',()=>{
 const notes=[note('Cards/Shade.md',{tags:['#城市/降温','#证据'],properties:{thoughtspace_status:'active',topic:'林荫',rating:2}})];
 const boards=[{path:'Boards/A.md',title:'甲',files:['Cards/Shade.md','Papers/Map.pdf']},{path:'Boards/B.md',title:'乙',files:['Cards/Shade.md']}];
 const records=buildLibraryRecords(notes,boards);
 const shade=records.find(record=>record.path==='Cards/Shade.md')!;
 assert.equal(shade.status,'active');
 assert.equal(shade.custom.topic,'林荫');
 assert.equal(shade.custom.rating,'2');
 assert.equal(shade.custom.thoughtspace_status,undefined);
 assert.deepEqual(shade.boards.map(board=>board.title),['乙','甲']);
 assert.equal(records.find(record=>record.path==='Papers/Map.pdf')?.type,'pdf');
 assert.equal(JSON.stringify(records).includes('正文不会进白板'),false);
});

test('table, kanban and list filter by type, tag, status and whiteboard',()=>{
 const records=buildLibraryRecords([
  note('Cards/Shade.md',{tags:['#城市'],properties:{thoughtspace_status:'active',topic:'步行'}}),
  note('Cards/Heat.md',{tags:['#证据'],properties:{thoughtspace_status:'inbox'}}),
  note('Cards/Done.md',{tags:['#城市/道路'],properties:{thoughtspace_status:'done'}}),
 ],[{path:'Boards/Field.md',title:'田野',files:['Cards/Shade.md','Clips/Walk.mp4']}]);
 assert.deepEqual(filterLibraryCards(records,query({type:'video'})).map(record=>record.path),['Clips/Walk.mp4']);
 assert.deepEqual(filterLibraryCards(records,query({tag:'城市'})).map(record=>record.path),['Cards/Done.md','Cards/Shade.md']);
 assert.deepEqual(filterLibraryCards(records,query({status:'inbox'})).map(record=>record.path),['Cards/Heat.md','Clips/Walk.mp4']);
 assert.deepEqual(filterLibraryCards(records,query({status:'inbox',type:'note'})).map(record=>record.path),['Cards/Heat.md']);
 assert.deepEqual(filterLibraryCards(records,query({board:'Boards/Field.md',tag:'城市'})).map(record=>record.path),['Cards/Shade.md']);
 assert.deepEqual(filterLibraryCards(records,query({query:'步行'})).map(record=>record.path),['Cards/Shade.md']);
 const table=libraryTable(filterLibraryCards(records,query({board:'Boards/Field.md'})));
 assert.ok(table.columns.includes('topic'));
 assert.equal(table.rows.find(row=>row.path==='Cards/Shade.md')?.cells.includes('田野'),true);
 const lanes=libraryKanban(records);
 assert.deepEqual(lanes.map(lane=>lane.id),['inbox','active','done']);
 assert.deepEqual(lanes.find(lane=>lane.id==='active')?.cards.map(card=>card.path),['Cards/Shade.md']);
 assert.match(libraryList(records).find(item=>item.path==='Cards/Heat.md')!.detail,/待整理/);
 assert.match(libraryList(records).find(item=>item.path==='Cards/Heat.md')!.detail,/未放置在白板/);
 const hidden=buildLibraryRecords([note('Cards/Heat.md')],[],{options:[]},true);
 assert.match(libraryList(hidden)[0].detail,/引用位置未索引完/);
 assert.equal(libraryList(hidden)[0].detail.includes('未放置'),false);
 const late=buildLibraryRecords([note('Cards/Shade.md')],[{path:'Boards/Late.md',title:'远处',files:['Cards/Shade.md'],placements:[{id:'card',file:'Cards/Shade.md'}]}],{options:[]},true);
 assert.match(libraryList(late).find(item=>item.path==='Cards/Shade.md')!.detail,/远处 · 其余白板未索引/);
 const located=buildLibraryRecords([note('Cards/Shade.md',{properties:{thoughtspace_highlight:'pdf',thoughtspace_source:'Papers/A.pdf',thoughtspace_page:2,thoughtspace_end_page:4}}),note('Cards/Walk.md',{properties:{thoughtspace_highlight:'video',thoughtspace_source:'Media/Walk.mp4',thoughtspace_time:75}})],[]);
 assert.match(libraryList(located).find(item=>item.path==='Cards/Shade.md')!.detail,/PDF 第 2–4 页/);
 assert.match(libraryList(located).find(item=>item.path==='Cards/Walk.md')!.detail,/视频 1:15/);
 const locatedTable=libraryTable(located);
 assert.ok(locatedTable.columns.includes('来源'));
 assert.equal(locatedTable.rows.find(row=>row.path==='Cards/Walk.md')?.cells.includes('视频 1:15'),true);
 assert.deepEqual(late.find(item=>item.path==='Cards/Shade.md')!.placements,[{boardPath:'Boards/Late.md',boardTitle:'远处',nodeId:'card'}]);
});

test('a saved selection does not change which cards match the filters',()=>{
 assert.deepEqual(emptyLibraryQuery().selected,[]);
 const records=buildLibraryRecords([
  note('Cards/Shade.md',{tags:['#城市'],properties:{topic:'林荫'}}),
  note('Cards/Heat.md',{tags:['#证据']}),
 ],[]);
 const matched=filterLibraryCards(records,query({query:'林'})).map(record=>record.path);
 assert.deepEqual(filterLibraryCards(records,query({query:'林',selected:['Cards/Heat.md']})).map(record=>record.path),matched);
 assert.deepEqual(matched,['Cards/Shade.md']);
});
test('a live board replaces a stale index without dropping other boards',()=>{
 const merged=mergeBoardSources([{path:'Boards/A.md',title:'旧',files:['Cards/Old.md']},{path:'Boards/B.md',title:'乙',files:['Cards/B.md']}],[{path:'Boards/A.md',title:'甲',files:['Cards/New.md']}]);
 assert.deepEqual(merged.find(board=>board.path==='Boards/A.md')?.files,['Cards/New.md']);
 assert.equal(merged.find(board=>board.path==='Boards/B.md')?.title,'乙');
});
