import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,parseBoard,type Board,type Card} from '../src/model';
import {isExplicitLibraryReference,isLibraryCard,libraryFilesOnBoard,placeExistingCard,unlinkLibraryCards} from '../src/card-library-model';

const note=(id:string,path='Cards/Shade.md',patch:Partial<Card>={}):Card=>({id,kind:'card',file:path,x:0,y:0,width:300,height:200,color:'sand',...patch});
function board(nodes:Card[],edges:Board['edges']=[]):Board{return {...emptyBoard(),version:3,nodes,edges};}

test('legacy note cards stay references and do not store a body',()=>{
 const node=note('a');
 assert.equal(isLibraryCard(node),true);
 assert.equal(isExplicitLibraryReference(node),true);
 assert.equal(node.library,undefined);
 assert.equal(node.text,undefined);
 const parsed=parseBoard(JSON.stringify(board([node])));
 assert.equal(parsed.nodes[0].file,'Cards/Shade.md');
 assert.equal(parsed.nodes[0].library,undefined);
 assert.equal(parsed.nodes[0].text,undefined);
});

test('placing an existing card stores a reference flag and not the note body',()=>{
 const left=emptyBoard(),right=emptyBoard(),body='林荫降低路面温度。';
 const first=placeExistingCard(left,'Cards/Shade.md',{x:400,y:200},'left');
 const second=placeExistingCard(right,'Cards/Shade.md',{x:80,y:90},'right');
 assert.equal(first.library,true);
 assert.equal(first.file,second.file);
 assert.equal(first.text,undefined);
 assert.equal(JSON.stringify(left).includes(body),false);
 assert.equal(JSON.stringify(right).includes(body),false);
 const saved=parseBoard(JSON.stringify(left));
 assert.equal(saved.nodes[0].library,true);
 assert.equal(saved.nodes[0].file,'Cards/Shade.md');
 assert.equal(saved.version,3);
});

test('the same note can be referenced twice without copying text between boards',()=>{
 const source=emptyBoard(),other=emptyBoard();
 placeExistingCard(source,'Notes/Claim.md',{x:100,y:100},'a');
 placeExistingCard(source,'Notes/Claim.md',{x:500,y:100},'b');
 placeExistingCard(other,'Notes/Claim.md',{x:100,y:100},'c');
 assert.deepEqual(source.nodes.map(node=>node.file),['Notes/Claim.md','Notes/Claim.md']);
 assert.notEqual(source.nodes[0].id,source.nodes[1].id);
 assert.equal(other.nodes[0].file,source.nodes[0].file);
 const edited='修改后的正文只属于笔记。';
 assert.equal(JSON.stringify([source,other]).includes(edited),false);
});

test('unlinking removes the board reference and returns the note path',()=>{
 const current=board([note('keep','Notes/Keep.md'),note('drop','Notes/Drop.md',{library:true})],[{id:'e',from:'keep',to:'drop',label:''}]);
 const paths=unlinkLibraryCards(current,new Set(['drop']));
 assert.deepEqual(paths,['Notes/Drop.md']);
 assert.deepEqual(current.nodes.map(node=>node.id),['keep']);
 assert.equal(current.edges.length,0);
 assert.equal(paths[0].endsWith('.md'),true);
});

test('unlink refuses text nodes and locked references',()=>{
 const text=board([{id:'t',kind:'text',text:'草稿',x:0,y:0,width:200,height:80,color:'sand'}]);
 assert.throws(()=>unlinkLibraryCards(text,new Set(['t'])),/笔记卡片/);
 assert.equal(text.nodes.length,1);
 const locked=board([note('a',undefined,{locked:true,library:true})]);
 assert.throws(()=>unlinkLibraryCards(locked,new Set(['a'])),/解锁/);
 assert.equal(locked.nodes.length,1);
});

test('invalid library flags are rejected and ordinary files on a board are indexed',()=>{
 assert.throws(()=>parseBoard(JSON.stringify(board([note('a',undefined,{library:true,text:'copied'})]))),/卡片库引用无效/);
 assert.throws(()=>parseBoard(JSON.stringify(board([{id:'t',kind:'text',text:'x',library:true,x:0,y:0,width:200,height:80,color:'sand'}]))),/卡片库引用无效/);
 assert.throws(()=>placeExistingCard(emptyBoard(),'../Outside.md',{x:10,y:10},'bad'),/Markdown/);
 assert.deepEqual(libraryFilesOnBoard([{kind:'card',file:'Notes/A.md'},{kind:'text',file:'skip.md'},{kind:'pdf',file:'Papers/A.pdf'},{kind:'card',file:'Notes/A.md'}]),['Notes/A.md','Papers/A.pdf']);
});
