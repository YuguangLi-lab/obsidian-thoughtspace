import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyNodeStyle,readNodeStyle,NodeStyle} from '../src/board-experience';
import {Card,clone,emptyBoard,parseBoard} from '../src/model';

const richStyle:NodeStyle={color:'purple',transparent:false,fillColor:'#Aa00fF',textColor:'default',fontFamily:'serif',fontSize:28,textAlign:'right',customBorder:true,borderStyle:'dotted',borderWidth:0};
function node(id:string,kind:Card['kind']='card'):Card{
 const n:Card={id,kind,x:13,y:-29,width:320,height:180,color:'sand',title:`Title ${id}`};
 if(kind==='text')n.text=`Text ${id}`;
 else if(kind!=='section')n.file=`${id}.${kind==='pdf'?'pdf':kind==='image'?'png':kind==='board'?'thoughtspace':'md'}`;
 return n;
}

test('copy captures only visual style, excluding reference content, geometry and branch behavior',()=>{
 const source:Card={...node('source'),...richStyle,text:'Private content',collapsed:true,height:72,expandedHeight:240,topic:true,branchFolded:true,mindmapRules:{layout:'left',density:'compact',automatic:true},autoSize:false,autoFit:true,preferredWidth:420,locked:true,review:'done'};
 const before=clone(source);
 assert.deepEqual(readNodeStyle(source),richStyle);
 assert.deepEqual(source,before);
 const media:Card={...node('media','pdf'),pdfPage:19,fontSize:20,customBorder:true};
 assert.deepEqual(readNodeStyle(media),{color:'sand',fontSize:20});
});

test('paste keeps mixed object references, content, geometry, branches, edges and viewport intact',()=>{
 const board=emptyBoard();board.version=3;
 board.nodes=[node('card'),node('text','text'),node('image','image'),node('pdf','pdf'),node('board','board'),node('section','section')];
 Object.assign(board.nodes[0],{collapsed:true,height:72,expandedHeight:220,branchFolded:true,autoFit:true,preferredWidth:420,review:'reading',mindmapRules:{layout:'right',density:'relaxed',automatic:false}});
 Object.assign(board.nodes[1],{topic:true,autoSize:false,textMaxWidth:480});
 board.nodes[3].pdfPage=7;
 board.edges=[{id:'edge',from:'card',to:'text',kind:'branch',label:'Keep label'}];
 const before=clone(board);
 const extraFields={...richStyle,id:'overwrite',file:'overwrite.md',text:'overwrite',title:'overwrite',kind:'text',x:999,y:999,width:999,height:999,locked:true,branchFolded:false,topic:false};
 applyNodeStyle(board,new Set(board.nodes.map(n=>n.id)),extraFields);
 const shared={color:'purple',textColor:'default',fontFamily:'serif',fontSize:28,textAlign:'right'};
 for(let i=0;i<board.nodes.length;i++)assert.deepEqual(board.nodes[i],{...before.nodes[i],...shared,...(['card','text','section'].includes(before.nodes[i].kind)?{customBorder:true,borderStyle:'dotted',borderWidth:0}:{}),...(['card','text','section'].includes(before.nodes[i].kind)?{transparent:false,fillColor:'#Aa00fF'}:{})});
 assert.deepEqual(board.edges,before.edges);
 assert.deepEqual(board.viewport,before.viewport);
 assert.deepEqual(parseBoard(JSON.stringify(board)),board);
});

test('paste skips locked and unselected nodes of every supported object kind',()=>{
 const board=emptyBoard();board.version=3;
 const kinds:Card['kind'][]=['card','text','image','pdf','board','section'];
 board.nodes=kinds.flatMap(kind=>[{...node(`locked-${kind}`,kind),locked:true},node(`unselected-${kind}`,kind),node(`editable-${kind}`,kind)]);
 const before=clone(board);
 applyNodeStyle(board,new Set([...kinds.flatMap(kind=>[`locked-${kind}`,`editable-${kind}`]),'missing']),richStyle);
 for(let i=0;i<board.nodes.length;i++){
  if(board.nodes[i].id.startsWith('editable-')){
   assert.equal(board.nodes[i].color,'purple');
   assert.equal(board.nodes[i].fillColor,['card','text','section'].includes(board.nodes[i].kind)?richStyle.fillColor:undefined);
   assert.equal(board.nodes[i].transparent,['card','text','section'].includes(board.nodes[i].kind)?richStyle.transparent:undefined);
  }
  else assert.deepEqual(board.nodes[i],before.nodes[i]);
 }
 assert.doesNotThrow(()=>parseBoard(JSON.stringify(board)));
});

test('card and text fill values and explicit false or zero overrides survive copying and pasting',()=>{
 const board=emptyBoard();board.version=3;board.nodes=[node('card'),node('text','text')];
 for(const fillColor of ['none','#Aa00fF','rose'] as const){
  for(const transparent of [true,false]){
   for(const kind of ['card','text'] as const){
    const captured=readNodeStyle({...node('source',kind),...richStyle,fillColor,transparent,customBorder:false});
    applyNodeStyle(board,new Set(['card','text']),captured);
    for(const destination of board.nodes){
     assert.equal(destination.fillColor,fillColor);
     assert.equal(destination.transparent,transparent);
     assert.equal(destination.customBorder,false);
     assert.equal(destination.borderWidth,0);
    }
    assert.deepEqual(parseBoard(JSON.stringify(board)),board);
   }
  }
 }
});

test('absent source overrides clear previous card and text destination fills',()=>{
 const board=emptyBoard();board.version=3;
 board.nodes=[{...node('card'),...richStyle,transparent:true},{...node('text','text'),...richStyle,transparent:true}];
 applyNodeStyle(board,new Set(['card','text']),readNodeStyle(node('source','text')));
 assert.deepEqual(board.nodes,[node('card'),node('text','text')]);
 for(const destination of board.nodes)for(const key of ['transparent','fillColor','textColor','fontFamily','fontSize','textAlign','customBorder','borderStyle','borderWidth'])assert.equal(Object.hasOwn(destination,key),false);
});

test('copied style is a detached snapshot and paste does not mutate or consume it',()=>{
 const source={...node('source'),...richStyle};
 const captured=readNodeStyle(source),before=clone(captured);
 Object.assign(source,{color:'red',fillColor:'none',fontSize:12,transparent:true});
 delete source.borderWidth;
 assert.deepEqual(captured,before);
 Object.freeze(captured);
 const board=emptyBoard();board.nodes=[node('first'),node('second')];
 applyNodeStyle(board,new Set(['first']),captured);
 Object.assign(board.nodes[0],{color:'green',fillColor:'blue',fontSize:16});
 applyNodeStyle(board,new Set(['second']),captured);
 assert.deepEqual(readNodeStyle(board.nodes[1]),before);
 assert.deepEqual(captured,before);
});

test('empty or stale selection leaves the board and copied style unchanged',()=>{
 const board=emptyBoard();board.nodes=[{...node('destination'),fontSize:16}];
 const before=clone(board),captured=Object.freeze({...richStyle});
 applyNodeStyle(board,new Set(),captured);
 applyNodeStyle(board,new Set(['deleted']),captured);
 assert.deepEqual(board,before);
 assert.deepEqual(captured,richStyle);
});

test('border style cannot be copied from or pasted onto borderless object kinds',()=>{
 for(const kind of ['image','pdf','audio','video','board'] as const){
  const legacy={...node('legacy',kind),borderWidth:4,borderStyle:'dashed' as const,customBorder:true};const captured=readNodeStyle(legacy);
  for(const key of ['borderWidth','borderStyle','customBorder'])assert.equal(Object.hasOwn(captured,key),false);
  const board={...emptyBoard(),nodes:[legacy,node('fresh',kind)]};applyNodeStyle(board,new Set(['legacy','fresh']),richStyle);
  assert.deepEqual([legacy.borderWidth,legacy.borderStyle,legacy.customBorder],[4,'dashed',true]);
  for(const key of ['borderWidth','borderStyle','customBorder'])assert.equal(Object.hasOwn(board.nodes[1],key),false);
 }
});

test('group border overrides survive style copy, paste and serialization',()=>{
 const board=emptyBoard();board.version=3;board.nodes=[node('group','section')];
 const source={...node('source','section'),...richStyle,sectionDivider:'dashed' as const};
 applyNodeStyle(board,new Set(['group']),readNodeStyle(source));
 assert.deepEqual(readNodeStyle(board.nodes[0]),readNodeStyle(source));
 assert.deepEqual(parseBoard(JSON.stringify(board)),board);
});

test('pasting frame styles leaves table card grid and source intact',()=>{
 const table={...node('table','text'),text:'| A | B |\n| --- | --- |\n| 1 | 2 |'},board=emptyBoard();board.nodes=[table];
 applyNodeStyle(board,new Set(['table']),richStyle);assert.equal(table.borderWidth,undefined);assert.equal(table.customBorder,undefined);assert.equal(readNodeStyle({...table,customBorder:true}).customBorder,undefined);
});
