import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,parseBoard,History,type Card} from '../src/model';
import {foldCards,visibleMarqueeSelection,moveSelection} from '../src/board-tools';
import {sectionDisplayNode,foldSections} from '../src/sections';
import {visibleBranchBoard} from '../src/mindmap';
import {connectionPath} from '../src/connections';
import {visibleNodes} from '../src/rendering';
const node=(kind:Card['kind']):Card=>({id:kind,kind,x:0,y:0,width:640,height:480,color:'blue',...(kind==='text'?{text:'标题\n完整正文 $x^2$'}:{file:`source.${({card:'md',image:'png',pdf:'pdf',board:'thoughtspace',audio:'mp3',video:'mp4'} as Record<string,string>)[kind]}`})});
for(const kind of ['card','text','image','pdf','board','audio','video'] as const)test(`${kind}: compact fold roundtrips without changing content, expanded size, links or undo`,()=>{
 const board={...emptyBoard(),version:3 as const,nodes:[node(kind)]},before=clone(board),history=new History();history.push(board);
 foldCards(board,new Set([kind]),true);const saved=clone(board),visible=visibleBranchBoard(board);
 assert.deepEqual([visible.nodes[0].width,visible.nodes[0].height],[180,40]);assert.deepEqual(board,saved);
 assert.deepEqual(sectionDisplayNode(visible.nodes[0]),visible.nodes[0],'projection is idempotent');
 const loaded=parseBoard(JSON.stringify(board));foldCards(loaded,new Set([kind]),false);assert.deepEqual(loaded,before);
 assert.deepEqual(history.undo(board),before);assert.deepEqual(history.redo(before),saved);
});
test('collapsed geometry drives culling, marquee and connection anchors without invisible hit area',()=>{
 const board={...emptyBoard(),version:3 as const,nodes:[node('text')]};foldCards(board,new Set(['text']),true);
 assert.deepEqual([...visibleMarqueeSelection(board,{x:200,y:0,width:100,height:100})],[]);
 assert.deepEqual([...visibleMarqueeSelection(board,{x:10,y:10,width:10,height:10})],['text']);
 const n=visibleBranchBoard(board).nodes[0];assert.equal(visibleNodes([n],{x:200,y:0,width:100,height:100}).length,0);
 assert.deepEqual(connectionPath(n,{...node('card'),x:800},{fromSide:'right',toSide:'left'}).from,{x:180,y:20});
});
test('legacy 72px folds load as compact display without a data migration',()=>{
 const board={...emptyBoard(),version:1 as const,nodes:[{...node('card'),collapsed:true,height:72,expandedHeight:480}]};
 const loaded=parseBoard(JSON.stringify(board));assert.deepEqual(loaded,board);assert.equal(visibleBranchBoard(loaded).nodes[0].height,40);assert.equal(loaded.nodes[0].height,72);
});
test('compact group movement retains membership and nested folds',()=>{
 const group:Card={id:'group',kind:'section',title:'研究',x:-30,y:-60,width:800,height:600,color:'green'};
 const board={...emptyBoard(),version:3 as const,nodes:[group,node('image')]};foldCards(board,new Set(['image']),true);foldSections(board,new Set(['group']),true);
 moveSelection(board,new Set(['group']),200,100);assert.equal(board.nodes[1].x,200);assert.equal(board.nodes[1].y,100);assert.deepEqual([group.width,group.height],[800,600]);
 foldSections(board,new Set(['group']),false);assert.equal(board.nodes[1].collapsed,true);assert.equal(visibleBranchBoard(board).nodes[1].height,40);
});
test('branch folding compacts only the parent and retains its expanded dimensions',()=>{
 const root=node('text'),child={...node('card'),x:900};const board={...emptyBoard(),version:3 as const,nodes:[root,child],edges:[{id:'branch',from:root.id,to:child.id,kind:'branch' as const,label:''}]};
 root.branchFolded=true;const before=clone(board),visible=visibleBranchBoard(board);assert.deepEqual(visible.nodes.map(n=>n.id),['text']);assert.equal(visible.nodes[0].height,40);assert.deepEqual(board,before);
 delete root.branchFolded;assert.equal(visibleBranchBoard(board),board);assert.deepEqual([root.width,root.height],[640,480]);
});
