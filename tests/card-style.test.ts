import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,History,parseBoard,type Card} from '../src/model';
import {applyCardStyle,applyDefaultCardStyle,cardStyleChoice,cardStyleChoices,effectiveCardStyle,supportsCardStyle,type CardStyleChoice} from '../src/card-style';
import {applyNodeStyle,cleanBoardPreferences,defaultBoardPreferences,readNodeStyle,resetBoardInputPreferences,resetBoardPagePreferences} from '../src/board-experience';
import {selectionFormatKey} from '../src/selection-format';

const note=(patch:Partial<Card>={}):Card=>({id:'note',kind:'card',file:'notes/例子.md',title:'Alias',x:20,y:40,width:300,height:200,color:'blue',...patch});
const decorativeStyles=['band','paper','index','sticky'] as const;
const unsupported=():Card[]=>[
 note({id:'web',kind:'text',file:undefined,text:'Example',webUrl:'https://example.com'}),
 note({id:'image',kind:'image',file:'image.png'}),
 note({id:'pdf',kind:'pdf',file:'document.pdf'}),
 note({id:'audio',kind:'audio',file:'audio.mp3'}),
 note({id:'video',kind:'video',file:'video.mp4'}),
 note({id:'board',kind:'board',file:'board.thoughtspace'}),
 note({id:'section',kind:'section',file:undefined,title:'Group'}),
];

test('card style choices have six named options and Markdown notes and local text are eligible',()=>{
 assert.deepEqual(Object.keys(cardStyleChoices),['transparent','solid','band','paper','index','sticky']);
 assert.ok(Object.values(cardStyleChoices).every(label=>label.length>0));
 assert.equal(supportsCardStyle(note()),true);
 for(const file of ['notes/UPPER.MD','notes/Mixed.Md'])assert.equal(supportsCardStyle(note({file})),true);
 for(const node of [...unsupported(),note({file:undefined}),note({file:'attachment.txt'}),note({webUrl:'https://example.com'})])assert.equal(supportsCardStyle(node),false,node.id);
});

test('legacy cards retain their transparent or solid appearance without adding a new field',()=>{
 for(const transparent of [undefined,false,true]){
  const board=emptyBoard();board.nodes=[note({transparent})];
  const restored=parseBoard(JSON.stringify(board)),node=restored.nodes[0];
  assert.equal(cardStyleChoice(node),transparent?'transparent':'solid');
  assert.equal(effectiveCardStyle(node),undefined);
  assert.equal(Object.hasOwn(node,'cardStyle'),false);
  assert.deepEqual(restored,JSON.parse(JSON.stringify(board)));
 }
});

test('decorative styles preserve the old transparency flag and all note identity content and geometry',()=>{
 for(const transparent of [undefined,false,true]){
  const node=note({transparent,text:'body snapshot',fillColor:'#112233',fontSize:17,collapsed:true,height:72,expandedHeight:420}),before=clone(node);
  for(const style of decorativeStyles){
   applyCardStyle(node,style);
   assert.equal(cardStyleChoice(node),style);assert.equal(effectiveCardStyle(node),style);
   assert.equal(node.transparent,transparent);
   const {cardStyle,...rest}=clone(node);assert.equal(cardStyle,style);assert.deepEqual(rest,before);
  }
 }
});

test('returning to transparent or solid removes the decorative override',()=>{
 for(const style of decorativeStyles)for(const transparent of [false,true]){
  const node=note({transparent:!transparent});
  applyCardStyle(node,style);applyCardStyle(node,transparent?'transparent':'solid');
  assert.equal(node.transparent,transparent);assert.equal(Object.hasOwn(node,'cardStyle'),false);assert.equal(cardStyleChoice(node),transparent?'transparent':'solid');
 }
});

test('unsupported and locked nodes are unchanged by direct style changes and defaults',()=>{
 for(const node of [...unsupported(),note({locked:true,cardStyle:'paper',transparent:false})]){
  const before=clone(node);
  for(const style of Object.keys(cardStyleChoices) as CardStyleChoice[]){applyCardStyle(node,style);applyDefaultCardStyle(node,style);}
  assert.deepEqual(clone(node),before,node.id);
 }
 for(const style of decorativeStyles){
  const invalid=note({kind:'text',text:'web',webUrl:'https://example.com',cardStyle:style});
  assert.equal(effectiveCardStyle(invalid),undefined,'a stray unsupported field must not enable rendering');
 }
});

test('new eligible cards default to transparent and accept every configured choice',()=>{
 const defaultNode=note();assert.equal(applyDefaultCardStyle(defaultNode),defaultNode);
 assert.equal(defaultNode.transparent,true);assert.equal(defaultNode.cardStyle,undefined);
 for(const style of Object.keys(cardStyleChoices) as CardStyleChoice[]){
  const node=note();applyDefaultCardStyle(node,style);assert.equal(cardStyleChoice(node),style);
 }
});

test('decorative styles survive JSON persistence for expanded and folded note cards',()=>{
 for(const file of ['notes/例子.md','notes/UPPER.MD','notes/Mixed.Md'])for(const style of decorativeStyles)for(const collapsed of [false,true]){
  const board=emptyBoard();board.nodes=[note({file,...(collapsed?{collapsed:true,height:72,expandedHeight:340}:{})})];
  applyCardStyle(board.nodes[0],style);
  assert.deepEqual(parseBoard(JSON.stringify(board)),board);
 }
});

test('board validation rejects unknown style values and style fields on media table web or group nodes',()=>{
 for(const value of ['transparent','solid','other',null,true,0,{}]){
  const board=emptyBoard();board.nodes=[note()];Object.assign(board.nodes[0],{cardStyle:value});
  assert.throws(()=>parseBoard(JSON.stringify(board)),/样式/);
 }
 for(const style of decorativeStyles)for(const node of unsupported()){
  const board=emptyBoard();board.version=3;board.nodes=[node];Object.assign(node,{cardStyle:style});
  assert.throws(()=>parseBoard(JSON.stringify(board)),/样式/,node.id);
 }
});

for(const decoration of decorativeStyles)test(`copy and paste carry ${decoration} decoration while preserving media and table content and ignoring locks`,()=>{
 const source=note({id:'source',cardStyle:decoration,transparent:true,fillColor:'rose'}),target=note({id:'target',file:'target.md',text:'target body'}),locked=note({id:'locked',locked:true,cardStyle:'band'});
 const board=emptyBoard();board.version=3;board.nodes=[target,locked,...unsupported()];
 const before=clone(board),style=readNodeStyle(source);
 assert.equal(style.cardStyle,decoration);assert.equal(style.transparent,true);
 applyNodeStyle(board,new Set(board.nodes.map(node=>node.id)),style);
 assert.equal(target.cardStyle,decoration);assert.equal(target.file,'target.md');assert.equal(target.text,'target body');
 assert.deepEqual(locked,before.nodes[1]);
 for(const node of board.nodes.slice(2)){
  const original=before.nodes.find(old=>old.id===node.id)!;
  assert.equal(Object.hasOwn(node,'cardStyle'),false,node.id);
  for(const key of ['id','kind','file','webUrl','text','title','x','y','width','height'] as const)assert.equal(node[key],original[key],`${node.id}.${key}`);
 }
 assert.deepEqual(parseBoard(JSON.stringify(board)),JSON.parse(JSON.stringify(board)));
});

test('copying legacy appearance clears note decoration and never reads a stray unsupported override',()=>{
 const board=emptyBoard();board.nodes=[note({cardStyle:'paper',transparent:false})];
 applyNodeStyle(board,new Set(['note']),readNodeStyle(note({transparent:true})));
 assert.equal(board.nodes[0].cardStyle,undefined);assert.equal(cardStyleChoice(board.nodes[0]),'transparent');
 const table=note({kind:'text',file:undefined,text:'web',webUrl:'https://example.com',cardStyle:'band'});
 assert.equal(readNodeStyle(table).cardStyle,undefined);
});

test('default preferences validate styles and page reset restores transparent without changing input reset scope',()=>{
 assert.equal(defaultBoardPreferences.defaultCardStyle,'transparent');
 assert.equal(cleanBoardPreferences({}).defaultCardStyle,'transparent');
 for(const style of Object.keys(cardStyleChoices))assert.equal(cleanBoardPreferences({defaultCardStyle:style}).defaultCardStyle,style);
 for(const value of ['unknown',null,false,{},1])assert.equal(cleanBoardPreferences({defaultCardStyle:value}).defaultCardStyle,'transparent');
 const settings=cleanBoardPreferences({defaultCardStyle:'paper',leftDrag:'select'});
 resetBoardInputPreferences(settings);assert.equal(settings.defaultCardStyle,'paper');
 settings.leftDrag='select';resetBoardPagePreferences(settings,false);
 assert.equal(settings.defaultCardStyle,'transparent');assert.equal(settings.leftDrag,'select');
});

for(const decoration of decorativeStyles)test(`history undo and redo restore ${decoration} decoration and the original transparency exactly`,()=>{
 const original=emptyBoard();original.nodes=[note({transparent:true})];
 const history=new History();history.push(original);const styled=clone(original);
 applyCardStyle(styled.nodes[0],decoration);
 const restored=history.undo(styled)!;assert.deepEqual(restored,original);
 const redone=history.redo(restored)!;assert.deepEqual(redone,styled);
 assert.deepEqual(parseBoard(JSON.stringify(redone)),styled);
});

test('selection formatting key updates when card style changes and returns with the original appearance',()=>{
 const board=emptyBoard();board.nodes=[note({transparent:true})];const ids=new Set(['note']);
 const original=selectionFormatKey(board,ids,undefined);
 const keys=new Set([original]);
 for(const style of decorativeStyles){applyCardStyle(board.nodes[0],style);const key=selectionFormatKey(board,ids,undefined);assert.equal(keys.has(key),false,style);keys.add(key);}
 applyCardStyle(board.nodes[0],'transparent');assert.equal(selectionFormatKey(board,ids,undefined),original);
});
