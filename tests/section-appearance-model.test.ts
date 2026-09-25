import test from 'node:test';
import assert from 'node:assert/strict';
import {applyNodeStyle,readNodeStyle} from '../src/board-experience';
import {Card,clone,colors,emptyBoard,History,parseBoard} from '../src/model';
import {nodeRenderKey} from '../src/node-render-key';
import {selectionFormatKey} from '../src/selection-format';
import {foldSections,sectionDisplayNode} from '../src/sections';

function node(id:string,kind:Card['kind']='section'):Card{
 const value:Card={id,kind,title:id,x:0,y:0,width:600,height:400,color:'blue'};
 if(kind==='text')value.text='Original text';
 else if(kind!=='section')value.file=`${id}.${kind==='image'?'png':kind==='pdf'?'pdf':kind==='board'?'thoughtspace':'md'}`;
 return value;
}
function board(...nodes:Card[]){return {...emptyBoard(),version:3 as const,nodes};}
const appearance={fillColor:'#Aa00fF' as const,transparent:false,sectionDivider:'dashed' as const};

test('sections persist every supported fill, transparency flag and title divider',()=>{
 for(const fillColor of ['none',...colors,'#Aa00fF'] as const){
  for(const transparent of [false,true]){
   for(const sectionDivider of ['none','solid','dashed','dotted'] as const){
    const value=board({...node('section'),fillColor,transparent,sectionDivider});
    assert.deepEqual(parseBoard(JSON.stringify(value)),value);
   }
  }
 }
});

test('legacy section appearance remains absent after loading and cloning',()=>{
 for(const version of [1,2,3] as const){
  const value={...board(node('section')),version},restored=parseBoard(JSON.stringify(value));
  assert.deepEqual(restored,value);
  assert.deepEqual(clone(restored),value);
  for(const field of ['fillColor','transparent','sectionDivider'])assert.equal(Object.hasOwn(restored.nodes[0],field),false);
 }
});

test('malformed section appearance is rejected before entering the board',()=>{
 for(const fillColor of ['#fff','#12345678','red; color: blue','transparent','invalid',true,0,null,{},[]]){
  assert.throws(()=>parseBoard(JSON.stringify(board({...node('section'),fillColor} as Card))),/对象背景颜色无效/);
 }
 for(const transparent of ['false',0,1,null,{},[]]){
  assert.throws(()=>parseBoard(JSON.stringify(board({...node('section'),transparent} as Card))),/对象透明样式无效/);
 }
 for(const sectionDivider of ['', 'double','Solid','inherit',true,0,null,{},[]]){
  assert.throws(()=>parseBoard(JSON.stringify(board({...node('section'),sectionDivider} as Card))),/分组标题分隔线样式无效/);
 }
});

test('title dividers are section-only and media or sub-boards still reject fills',()=>{
 for(const kind of ['card','text','image','pdf','board'] as const){
  assert.throws(()=>parseBoard(JSON.stringify(board({...node(kind,kind),sectionDivider:'none'}))),/分组标题分隔线样式无效/);
 }
 for(const kind of ['image','pdf','board'] as const){
  for(const patch of [{fillColor:'none'},{fillColor:'#112233'},{transparent:true},{transparent:false}]){
   assert.throws(()=>parseBoard(JSON.stringify(board({...node(kind,kind),...patch} as Card))),/对象(背景颜色|透明样式)无效/);
  }
 }
});

test('section appearance survives clone, folded projection, persistence and history',()=>{
 const value=board({...node('section'),...appearance}, {...node('member','text'),x:40,y:80,width:180,height:100});
 const before=clone(value),history=new History();history.push(value);
 foldSections(value,new Set(['section']),true);
 const folded=parseBoard(JSON.stringify(value)),display=sectionDisplayNode(folded.nodes[0]);
 assert.deepEqual(readNodeStyle(display),readNodeStyle(before.nodes[0]));
 assert.deepEqual([display.width,display.height],[320,72]);
 assert.deepEqual([folded.nodes[0].width,folded.nodes[0].height],[600,400]);
 const duplicate=clone(folded);duplicate.nodes[0].sectionDivider='dotted';
 assert.equal(folded.nodes[0].sectionDivider,'dashed');
 const undone=history.undo(value)!;assert.deepEqual(undone,before);
 assert.deepEqual(history.redo(undone),folded);
 foldSections(folded,new Set(['section']),false);assert.deepEqual(folded,before);
});

test('section clipboard shares fills with card and text while keeping the divider section-only',()=>{
 const source={...node('source'),...appearance,sectionFolded:true},before=clone(source),style=Object.freeze(readNodeStyle(source));
 const value=board(...(['section','card','text','image','pdf','board'] as const).map(kind=>node(kind,kind)));
 applyNodeStyle(value,new Set(value.nodes.map(n=>n.id)),style);
 for(const destination of value.nodes){
  assert.equal(destination.sectionDivider,destination.kind==='section'?'dashed':undefined);
  const receivesFill=['section','card','text'].includes(destination.kind);
  assert.equal(destination.fillColor,receivesFill?appearance.fillColor:undefined);
  assert.equal(destination.transparent,receivesFill?false:undefined);
  assert.equal(destination.sectionFolded,undefined);
 }
 assert.deepEqual(source,before);assert.deepEqual(parseBoard(JSON.stringify(value)),value);
 assert.deepEqual(style,{color:'blue',...appearance});
});

test('card and text styles restore section divider defaults and keep fill overrides',()=>{
 for(const kind of ['card','text'] as const){
  const value=board({...node('section'),...appearance});
  const source={...node('source',kind),fillColor:'green' as const,transparent:true};
  applyNodeStyle(value,new Set(['section']),readNodeStyle(source));
  assert.deepEqual(value.nodes[0],{...node('section'),fillColor:'green',transparent:true});
  assert.equal(Object.hasOwn(value.nodes[0],'sectionDivider'),false);
  assert.deepEqual(parseBoard(JSON.stringify(value)),value);
 }
 const malformedSource={...node('source','card'),sectionDivider:'dotted' as const};
 assert.equal(Object.hasOwn(readNodeStyle(malformedSource),'sectionDivider'),false);
});

test('default styles clear group overrides while locked and unselected groups retain them',()=>{
 const value=board({...node('editable'),...appearance},{...node('locked'),...appearance,locked:true},{...node('unselected'),...appearance});
 const before=clone(value);
 applyNodeStyle(value,new Set(['editable','locked']),readNodeStyle(node('source')));
 assert.deepEqual(value.nodes[0],node('editable'));
 assert.deepEqual(value.nodes.slice(1),before.nodes.slice(1));
 assert.deepEqual(parseBoard(JSON.stringify(value)),value);
});

test('section controls and render keys invalidate for changed appearance without caching stale values',()=>{
 const value=board(node('section'),node('unselected')),ids=new Set(['section']);
 const format=selectionFormatKey(value,ids,undefined),render=nodeRenderKey(value.nodes[0],[]);
 for(const patch of [{fillColor:'#112233' as const},{transparent:true},{sectionDivider:'none' as const},{sectionDivider:'solid' as const},{sectionDivider:'dashed' as const},{sectionDivider:'dotted' as const}]){
  const changed={...value,nodes:[{...value.nodes[0],...patch},value.nodes[1]]};
  assert.notEqual(selectionFormatKey(changed,ids,undefined),format);
  assert.notEqual(nodeRenderKey(changed.nodes[0],[]),render);
 }
 value.nodes[0].x=400;value.nodes[0].y=200;value.nodes[1].sectionDivider='dotted';
 assert.equal(selectionFormatKey(value,ids,undefined),format);
 assert.equal(nodeRenderKey(value.nodes[0],[]),render);
 value.nodes[0].sectionFolded=true;assert.notEqual(nodeRenderKey(value.nodes[0],[]),render);
 assert.notEqual(selectionFormatKey(value,ids,undefined),format);
 value.nodes[0].borderStyle='dotted';const explicit=selectionFormatKey(value,ids,undefined);
 delete value.nodes[0].sectionFolded;assert.equal(selectionFormatKey(value,ids,undefined),explicit);
});
