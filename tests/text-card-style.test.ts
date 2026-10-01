import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,clone,History,parseBoard,type Card} from '../src/model';
import {applyCardStyle,applyDefaultCardStyle,cardStyleChoice,cardStyleChoices,type CardStyleChoice} from '../src/card-style';
import {readNodeStyle,applyNodeStyle} from '../src/board-experience';
import {nodeRenderKey} from '../src/node-render-key';

const text=(patch:Partial<Card>={}):Card=>({id:'text',kind:'text',text:'# 标题\n\n**粗体**、$x$ 与 [[来源]]\n\n| A | B |\n| --- | --- |\n| 1 | 2 |',x:120,y:80,width:300,height:220,color:'blue',fontFamily:'serif',fontSize:19,textAlign:'center',textAutoHeight:false,autoSize:false,customBorder:true,borderWidth:3,borderStyle:'dotted',...patch});
for(const choice of Object.keys(cardStyleChoices) as CardStyleChoice[])for(const state of [{},{collapsed:true,height:72,expandedHeight:220},{branchFolded:true}])test(`text ${choice} preserves data, relations and fold state ${JSON.stringify(state)}`,()=>{
 const board=emptyBoard();board.version=3;board.nodes=[text(state),text({id:'child',x:500})];board.edges=[{id:'edge',from:'text',to:'child',kind:'branch',label:'子节点'}];
 const before=clone(board),history=new History();history.push(board);applyCardStyle(board.nodes[0],choice);
 assert.equal(cardStyleChoice(board.nodes[0]),choice);assert.equal(board.nodes[0].kind,'text');assert.equal(board.nodes[0].file,undefined);
 const expected=clone(before);if(choice==='transparent'||choice==='solid')expected.nodes[0].transparent=choice==='transparent';else expected.nodes[0].cardStyle=choice;
 assert.deepEqual(board,expected);assert.deepEqual(parseBoard(JSON.stringify(board)),board);
 const undone=history.undo(board)!;assert.deepEqual(undone,before);assert.deepEqual(history.redo(undone),board);
});
test('appearance copying supports mixed note/text selections and preserves locked text',()=>{
 const board=emptyBoard();board.nodes=[text(),text({id:'locked',locked:true}),{...text({id:'note'}),kind:'card',file:'note.md'}];
 const locked=clone(board.nodes[1]);applyNodeStyle(board,new Set(['text','locked','note']),readNodeStyle(text({cardStyle:'paper'})));
 assert.equal(board.nodes[0].cardStyle,'paper');assert.equal(board.nodes[2].cardStyle,'paper');assert.deepEqual(board.nodes[1],locked);
});
test('note creation defaults do not overwrite imported text appearance',()=>{
 const node=text({cardStyle:'index'}),before=clone(node);applyDefaultCardStyle(node,'paper');assert.deepEqual(node,before);
});
test('text surface changes keep renderer identity for ordinary, table and media reference content',()=>{
 for(const body of ['ordinary text',text().text!,'![[media.md#^thoughtspace-media-1]]']){
  const node=text({text:body}),key=nodeRenderKey(node,[]);
  for(const choice of Object.keys(cardStyleChoices) as CardStyleChoice[]){applyCardStyle(node,choice);assert.equal(nodeRenderKey(node,[]),key);}
 }
});
