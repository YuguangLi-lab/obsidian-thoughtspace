import test from 'node:test';
import assert from 'node:assert/strict';
import {ProjectColorRegistry,ProjectColorSaveQueue,validateProjectColorsSnapshot} from '../src/folio-project-colors';
import {parseBoard,boardLinks} from '../src/model';

test('project colors survive reordering, reopening and new sibling projects',()=>{
  const first=new ProjectColorRegistry();
  const a=first.folder('研究甲/文献')!;
  const b=first.folder('研究乙')!;
  assert.equal(a.slot,1);
  assert.equal(b.slot,2);
  assert.equal(first.folder('研究甲/其他资料')?.id,a.id);
  const reopened=new ProjectColorRegistry(JSON.parse(JSON.stringify(first.snapshot())));
  assert.equal(reopened.folder('研究乙/数据')?.slot,2);
  assert.equal(reopened.folder('新项目')?.slot,3);
  assert.equal(reopened.folder('研究甲')?.slot,1);
});

test('board branches use their root project, sharing folder slots and separating root-level boards',()=>{
  const colors=new ProjectColorRegistry();
  const folder=colors.folder('研究甲')!;
  assert.equal(colors.boardRoot('研究甲/主白板.thoughtspace')?.id,folder.id);
  assert.equal(colors.boardRoot('研究甲/子目录/其他白板.thoughtspace')?.slot,1);
  const rootA=colors.boardRoot('项目A.thoughtspace')!;
  const rootB=colors.boardRoot('项目B.thoughtspace')!;
  assert.notEqual(rootA.id,rootB.id);
  assert.equal(rootA.slot,2);
  assert.equal(rootB.slot,3);
});

test('top-level renames migrate identity while subtree renames and moves keep destination project ownership',()=>{
  const colors=new ProjectColorRegistry();
  const folder=colors.folder('旧项目')!;
  const board=colors.boardRoot('旧白板.thoughtspace')!;
  colors.folder('其他项目');
  assert.equal(colors.rename('旧项目','新项目',true),true);
  assert.equal(colors.folder('新项目/资料')?.id,folder.id);
  assert.equal(colors.rename('新项目/资料','新项目/材料',true),false);
  assert.equal(colors.rename('旧白板.thoughtspace','新白板.thoughtspace',false),true);
  assert.equal(colors.boardRoot('新白板.thoughtspace')?.id,board.id);
  colors.rename('新白板.thoughtspace','其他项目/白板.thoughtspace',false);
  assert.equal(colors.boardRoot('其他项目/白板.thoughtspace')?.slot,3);
  assert.equal(colors.folder('新项目')?.slot,1);
  assert.equal(colors.folder('下一项目')?.slot,4);
});

test('serialized persistence keeps new snapshots and reload reads behind older writes, recovering after errors',async()=>{
  const queue=new ProjectColorSaveQueue();
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let persisted='original';
  const first=queue.run(async()=>{await gate;persisted='older';});
  const latest=queue.run(async()=>{persisted='latest';});
  const reopened=queue.run(async()=>persisted);
  await Promise.resolve();
  assert.equal(persisted,'original');
  release();
  await first;await latest;
  assert.equal(await reopened,'latest');
  await assert.rejects(queue.run(async()=>{throw Error('write failed');}),/write failed/);
  assert.equal(await queue.run(async()=>persisted),'latest');
});

test('persisted slots and sequence survive invalid rows, deleted-name collisions and palette rollover',()=>{
  const colors=new ProjectColorRegistry({version:1,nextId:13,projects:[
    {id:10,kind:'folder',path:'原项目',slot:5},
    {id:11,kind:'folder',path:'已删项目名',slot:6},
    {id:12,kind:'folder',path:'../不安全',slot:2},
    {id:12,kind:'folder',path:'坏色槽',slot:7},
  ]});
  assert.equal(colors.folder('原项目/子目录')?.slot,5);
  assert.equal(colors.folder('新增项目')?.slot,1);
  colors.rename('原项目','已删项目名',true);
  assert.equal(colors.folder('已删项目名')?.id,10);
  assert.equal(colors.folder('已删项目名')?.slot,5);
  assert.equal(colors.folder('../不安全'),undefined);
  const snapshot=colors.snapshot();snapshot.projects[0].slot=3;
  assert.equal(colors.folder('已删项目名')?.slot,5);
});

test('valid v2 board references retain the same leaf in different root projects without mutating its model',()=>{
  const portal={id:'shared-ref',kind:'board',file:'共享/leaf.thoughtspace',x:0,y:0,width:340,height:265,color:'green'};
  const document={version:2,nodes:[portal],edges:[],viewport:{x:60,y:60,zoom:1}};
  const before=JSON.stringify(document),a=parseBoard(before),b=parseBoard(before);
  assert.deepEqual(boardLinks(a),['共享/leaf.thoughtspace']);
  assert.deepEqual(boardLinks(b),['共享/leaf.thoughtspace']);
  assert.throws(()=>parseBoard(JSON.stringify({...document,version:1})),/白板节点/);
  const colors=new ProjectColorRegistry();
  assert.equal(colors.boardRoot('项目甲/root.thoughtspace')?.slot,1);
  assert.equal(colors.boardRoot('项目乙/root.thoughtspace')?.slot,2);
  assert.equal(JSON.stringify(document),before);
});

test('existing registry data must pass validation before it can be persisted again',()=>{
  const valid={version:1,nextId:3,projects:[{id:2,kind:'folder',path:'项目甲',slot:5}]};
  assert.doesNotThrow(()=>validateProjectColorsSnapshot(valid));
  for(const invalid of [null,[],{}, {...valid,version:2},{...valid,projects:null},
    {...valid,nextId:2},{...valid,nextId:Number.MAX_SAFE_INTEGER},
    {...valid,projects:[{...valid.projects[0],path:'../损坏'}]},
    {...valid,projects:[{...valid.projects[0],slot:0}]},
    {...valid,projects:[...valid.projects,valid.projects[0]]}]){
    assert.throws(()=>validateProjectColorsSnapshot(invalid),/配色注册表/);
  }
});
