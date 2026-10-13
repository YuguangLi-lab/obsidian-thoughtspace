import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,type Board,type Card} from '../src/model';
import {planCollectionReferenceRename} from '../src/collection-placement-recovery';

const card=(id:string,file:string):Card=>({id,kind:'card',file,x:32,y:64,width:300,height:240,color:'sand',autoFit:true,preferredWidth:300});
function fixture():Board {
 return{...emptyBoard(),version:3,nodes:[card('new-a','Notes/旧笔记.md'),card('new-b','Notes/其他笔记.md'),card('prior','Notes/旧笔记.md'),{id:'text',kind:'text',text:'[[Notes/旧笔记.md]]',x:400,y:32,width:240,height:120,color:'blue'}],edges:[{id:'edge',from:'new-a',to:'new-b',label:'保留',style:'straight',direction:'forward'}],viewport:{x:15,y:-40,zoom:.75},savedViews:[{id:'view',name:'阅读',viewport:{x:13,y:20,zoom:1}}]};
}
const rename={id:'new-a',path:'Notes/旧笔记.md',nextPath:'归档/研究/新笔记.md'};
function freeze(value:unknown){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}}

test('only retained card file fields change; input and all unrelated serialized structure remain exact',()=>{
 const board=fixture(),before=JSON.stringify(board),refs=[rename,{id:'new-b',path:'Notes/其他笔记.md',nextPath:'归档/其他笔记.md'}];freeze(board);freeze(refs);
 const result=planCollectionReferenceRename(board,before,refs)!;
 assert.notEqual(result,board);assert.notEqual(result.nodes[2],board.nodes[2]);assert.notEqual(result.savedViews,board.savedViews);
 assert.equal(result.nodes[0].file,rename.nextPath);assert.equal(result.nodes[1].file,'归档/其他笔记.md');
 assert.equal(result.nodes[2].file,'Notes/旧笔记.md');assert.equal(result.nodes[3].text,'[[Notes/旧笔记.md]]');
 result.nodes[0].file=rename.path;result.nodes[1].file=refs[1].path;
 assert.equal(JSON.stringify(result),before);assert.equal(JSON.stringify(board),before);
});

test('an unrelated card edit, viewport move or added node invalidates the exact receipt',()=>{
 for(const mutate of [(board:Board)=>{board.nodes[2].x++;},(board:Board)=>{board.viewport.zoom=1;},(board:Board)=>{board.nodes.push(card('new-unrelated','Extra.md'));}]){
  const board=fixture(),stamp=JSON.stringify(board);mutate(board);const edited=JSON.stringify(board);
  assert.throws(()=>planCollectionReferenceRename(board,stamp,[rename]),/草稿已变化/);assert.equal(JSON.stringify(board),edited);
 }
});

test('even semantically identical JSON with another serialization is not the retained stamp',()=>{
 const board=fixture();assert.throws(()=>planCollectionReferenceRename(board,JSON.stringify(board,null,2),[rename]),/草稿已变化/);
});

test('a missing card, changed source or changed kind cannot be migrated',()=>{
 for(const mutate of [(board:Board)=>{board.nodes.shift();},(board:Board)=>{board.nodes[0].file='Other.md';},(board:Board)=>{board.nodes[0].kind='text';}]){
  const board=fixture();mutate(board);const before=JSON.stringify(board);
  assert.throws(()=>planCollectionReferenceRename(board,before,[rename]),/投递卡片/);assert.equal(JSON.stringify(board),before);
 }
});

test('duplicate receipt IDs and duplicate IDs on the board reject the whole plan',()=>{
 const board=fixture(),before=JSON.stringify(board);
 assert.throws(()=>planCollectionReferenceRename(board,before,[rename,rename]),/标识无效或重复/);assert.equal(JSON.stringify(board),before);
 board.nodes.push({...card('new-a','Notes/旧笔记.md'),x:1000});const duplicated=JSON.stringify(board);
 assert.throws(()=>planCollectionReferenceRename(board,duplicated,[rename]),/标识重复/);assert.equal(JSON.stringify(board),duplicated);
});

test('invalid old or new note paths are rejected rather than normalized',()=>{
 const paths=['','/outside.md','../outside.md','Notes/../outside.md','Notes/./file.md','Notes//file.md','Notes\\file.md','https://example.test/note.md','C:/note.md','Notes/note.md\n','Notes/\u0000file.md','Notes/\u007ffile.md','Notes/file.txt','Notes/'+ 'x'.repeat(4096)+'.md'];
 for(const path of paths){
  const board=fixture(),before=JSON.stringify(board);assert.throws(()=>planCollectionReferenceRename(board,before,[{...rename,nextPath:path}]),/路径无效/);assert.equal(JSON.stringify(board),before);
  board.nodes[0].file=path;const stamp=JSON.stringify(board);assert.throws(()=>planCollectionReferenceRename(board,stamp,[{...rename,path}]),/路径无效/);assert.equal(JSON.stringify(board),stamp);
 }
});

test('relative native Unicode names and uppercase Markdown extensions are preserved exactly',()=>{
 const board=fixture(),nextPath='研究 资料/组合e\u0301与😀.MD';
 const result=planCollectionReferenceRename(board,JSON.stringify(board),[{...rename,nextPath}])!;assert.equal(result.nodes[0].file,nextPath);
});

test('no-op results still validate every receipt and do not clone or change the board',()=>{
 const board=fixture(),before=JSON.stringify(board);freeze(board);
 assert.equal(planCollectionReferenceRename(board,before,[]),undefined);
 assert.equal(planCollectionReferenceRename(board,before,[{...rename,nextPath:rename.path}]),undefined);
 assert.throws(()=>planCollectionReferenceRename(board,before,[{...rename,id:'missing',nextPath:rename.path}]),/投递卡片/);
 assert.throws(()=>planCollectionReferenceRename(board,'stale',[]),/草稿已变化/);
 assert.equal(JSON.stringify(board),before);
});

test('validation failure after a valid reference never partially applies the first rename',()=>{
 const board=fixture(),before=JSON.stringify(board);
 assert.throws(()=>planCollectionReferenceRename(board,before,[rename,{id:'new-b',path:'wrong.md',nextPath:'Next.md'}]),/来源已变化/);
 assert.equal(JSON.stringify(board),before);
});

test('simultaneous mappings do not cascade or rewrite unselected references',()=>{
 const board=fixture();board.nodes[0].file='A.md';board.nodes[1].file='B.md';board.nodes[2].file='A.md';
 const result=planCollectionReferenceRename(board,JSON.stringify(board),[{id:'new-a',path:'A.md',nextPath:'B.md'},{id:'new-b',path:'B.md',nextPath:'C.md'}])!;
 assert.deepEqual(result.nodes.slice(0,3).map(node=>node.file),['B.md','C.md','A.md']);assert.equal(board.nodes[0].file,'A.md');
});

test('unknown serializable fields and matching-looking provenance remain untouched',()=>{
 const board=fixture() as Board&{futureMetadata:unknown};board.futureMetadata={file:rename.path,nested:[{text:rename.path}],empty:null};
 Object.assign(board.nodes[0],{futureCardMetadata:{file:rename.path,bytes:'\r\nOriginal'}});
 const before=JSON.stringify(board),result=planCollectionReferenceRename(board,before,[rename])!;
 const restored=clone(result);restored.nodes[0].file=rename.path;assert.equal(JSON.stringify(restored),before);
});
