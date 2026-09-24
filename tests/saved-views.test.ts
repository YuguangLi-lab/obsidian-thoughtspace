import test from 'node:test';
import assert from 'node:assert/strict';
import {Board,emptyBoard,parseBoard} from '../src/model';
import {addSavedView,renameSavedView,updateSavedView,reorderSavedView,removeSavedView,savedViewOrderStamp,savedViewStamp,savedViewViewport} from '../src/saved-views';

function fixture(){const board:Board=emptyBoard();board.nodes.push({id:'note',kind:'text',text:'保留正文',x:1,y:2,width:80,height:60,color:'sand'});board.viewport={x:234,y:-18,zoom:.35};return board;}
test('saved cameras survive serialization while leaving viewport, content and references intact',()=>{
 const b=fixture(),content=JSON.stringify({nodes:b.nodes,edges:b.edges,viewport:b.viewport});addSavedView(b,'v1','  论证区  ');
 assert.equal(b.savedViews![0].name,'论证区');assert.notEqual(b.savedViews![0].viewport,b.viewport);assert.equal(b.version,3);
 assert.deepEqual(parseBoard(JSON.stringify(b)).savedViews,b.savedViews);assert.equal(JSON.stringify({nodes:b.nodes,edges:b.edges,viewport:b.viewport}),content);
});
test('rename and update operate by identity, preserve other cameras and do not navigate',()=>{
 const b=fixture();addSavedView(b,'a','材料');addSavedView(b,'b','文章');const second=JSON.stringify(b.savedViews![1]),camera={...b.viewport};
 renameSavedView(b,'a','证据',savedViewStamp(b.savedViews![0]));updateSavedView(b,'a',{x:30,y:40,zoom:1.5},savedViewStamp(b.savedViews![0]));
 assert.equal(b.savedViews![0].name,'证据');assert.deepEqual(b.savedViews![0].viewport,{x:30,y:40,zoom:1.5});assert.deepEqual(b.viewport,camera);assert.equal(JSON.stringify(b.savedViews![1]),second);
});
test('reorder respects list ends and removal keeps unrelated cameras',()=>{
 const b=fixture();for(const id of ['a','b','c'])addSavedView(b,id,id);reorderSavedView(b,'b',-1);reorderSavedView(b,'b',-1);assert.deepEqual(b.savedViews!.map(v=>v.id),['b','a','c']);
 reorderSavedView(b,'b',1);reorderSavedView(b,'c',1);removeSavedView(b,'b',savedViewStamp(b.savedViews![1]));assert.deepEqual(b.savedViews!.map(v=>v.id),['a','c']);
});
test('a stale view cannot rename, update or delete another window revision',()=>{
 for(const action of [(b:Board,s:string)=>renameSavedView(b,'a','old',s),(b:Board,s:string)=>updateSavedView(b,'a',{x:0,y:0,zoom:1},s),(b:Board,s:string)=>removeSavedView(b,'a',s)]){
  const b=fixture();addSavedView(b,'a','区域');const stamp=savedViewStamp(b.savedViews![0]);renameSavedView(b,'a','窗口二');const before=JSON.stringify(b);assert.throws(()=>action(b,stamp),/已变化/);assert.equal(JSON.stringify(b),before);
 }
});
test('invalid names, duplicate IDs and invalid cameras leave the board untouched',()=>{
 const b=fixture();addSavedView(b,'a','有效');
 for(const mutate of [()=>addSavedView(b,'a','重复'),()=>addSavedView(b,'b','  '),()=>renameSavedView(b,'a','x'.repeat(101)),()=>updateSavedView(b,'a',{x:Infinity,y:0,zoom:1}),()=>updateSavedView(b,'a',{x:0,y:0,zoom:.01}),()=>removeSavedView(b,'missing')]){const before=JSON.stringify(b);assert.throws(mutate);assert.equal(JSON.stringify(b),before);}
});
test('camera capacity matches persisted board validation',()=>{
 const b=fixture();for(let i=0;i<50;i++)addSavedView(b,String(i),'视角 '+i);assert.throws(()=>addSavedView(b,'extra','第51个'),/50/);assert.equal(parseBoard(JSON.stringify(b)).savedViews!.length,50);
});
test('resolving a reviewed camera returns a defensive copy without navigating',()=>{const board=fixture();addSavedView(board,'v','区域');const before=JSON.stringify(board),camera=savedViewViewport(board,'v',savedViewStamp(board.savedViews![0]));camera.x=9999;assert.equal(JSON.stringify(board),before);});
test('deleted or revised camera previews cannot silently navigate somewhere different',()=>{const board=fixture();addSavedView(board,'v','区域');const expected=savedViewStamp(board.savedViews![0]);updateSavedView(board,'v',{x:800,y:600,zoom:1});assert.throws(()=>savedViewViewport(board,'v',expected),/已变化/);removeSavedView(board,'v');assert.throws(()=>savedViewViewport(board,'v',expected),/已移除/);});
test('reordering rejects a stale order atomically while accepting unrelated camera edits',()=>{const board=fixture();for(const id of ['a','b','c'])addSavedView(board,id,id);const stamp=savedViewOrderStamp(board);renameSavedView(board,'b','新名称');reorderSavedView(board,'b',-1,stamp);const before=JSON.stringify(board);assert.throws(()=>reorderSavedView(board,'c',-1,stamp),/顺序已变化/);assert.equal(JSON.stringify(board),before);});
