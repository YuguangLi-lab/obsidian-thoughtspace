import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanBoardPreferences,defaultBoardPreferences} from '../src/board-experience';
import {cleanDatabasePreferences} from '../src/database-custom';
import {cleanHubPreferences,defaultHubFilter} from '../src/space-hub';
import {hasAsciiControl} from '../src/value-guards';

test('preference cleaners accept unknown roots without throwing or preserving invalid types',()=>{
 for(const value of [undefined,null,[],42,'settings',true]){
  assert.deepEqual(cleanBoardPreferences(value),defaultBoardPreferences);
  assert.deepEqual(cleanDatabasePreferences(value),{fields:[],views:[]});
  assert.deepEqual(cleanHubPreferences(value),{view:'gallery',saved:[],recent:[]});
 }
 const board=cleanBoardPreferences({wheelMode:{},zoomSpeed:Infinity,gridStep:100,showPorts:'false'});
 assert.equal(board.wheelMode,'zoom');assert.equal(board.zoomSpeed,1);assert.equal(board.gridStep,64);assert.equal(board.showPorts,true);
});
test('database saved filters and conditions normalize nested untrusted data',()=>{
 const prefs=cleanDatabasePreferences({fields:[null,{key:'score',type:'number'},{key:'score',type:'invalid'}],views:[null,{id:'v',name:'表格',source:'vault',layout:'table',boardPath:42,filter:{query:'主题',sort:'title',tag:[],status:2,priority:{},overdue:'yes'},conditions:[null,{key:'score',op:'gte',value:'3'},{key:'missing',op:'eq',value:'x'}]}]});
 assert.deepEqual(prefs.fields,[{key:'score',type:'number'}]);
 assert.deepEqual(prefs.views,[{id:'v',name:'表格',source:'vault',layout:'table',filter:{query:'主题',sort:'title',tag:'',status:'',priority:'',overdue:false,today:''},conditions:[{key:'score',op:'gte',value:'3'}]}]);
});
test('hub preferences narrow nested filters and finite timestamps without casting input',()=>{
 const prefs=cleanHubPreferences({view:'list',saved:[null,{id:'f',name:' 收藏 ',filter:42}],recent:[null,{path:'a.thoughtspace',at:'1'},{path:'a.thoughtspace',at:2}]});
 assert.deepEqual(prefs,{view:'list',saved:[{id:'f',name:'收藏',filter:defaultHubFilter}],recent:[{path:'a.thoughtspace',at:2}]});
});
test('ASCII-control detection covers the full C0 range without rejecting Unicode or DEL',()=>{
 for(let code=0;code<32;code++)assert.equal(hasAsciiControl('前'+String.fromCharCode(code)+'后'),true);
 for(const text of ['','普通文本','folder/note.md','🌱',' ',String.fromCharCode(127)])assert.equal(hasAsciiControl(text),false);
});
