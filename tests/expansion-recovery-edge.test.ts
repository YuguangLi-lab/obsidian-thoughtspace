import test from 'node:test';
import assert from 'node:assert/strict';
import {foldCards} from '../src/board-tools';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {clone,emptyBoard,parseBoard,type Board,type Card} from '../src/model';

const node=(id:string,x:number,y:number,width=300,height=80,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width,height,color:'blue',...extra});
const frame=(id:string,x:number,y:number,width:number,height:number)=>node(id,x,y,width,height,{kind:'section',title:id});
const board=(...nodes:Card[]):Board=>({...emptyBoard(),version:3,nodes});
const at=(value:Board,id:string)=>value.nodes.find(n=>n.id===id)!;
function change(value:Board,edit:(draft:Board)=>void,measurement=false){const before=clone(value);edit(value);reflowReadingContent(value,before,{measurement});}
const geometry=(value:Board)=>value.nodes.map(({id,x,y,width,height})=>({id,x,y,width,height}));

test('the first delayed measurement of an already-open note records displacement for a later collapse',()=>{
 const value=board(frame('group',0,0,400,500),node('reading',30,60,300,100,{kind:'card',file:'reading.md',autoFit:true}),node('tail',30,200),node('outside',30,550)),baseline=clone(value);
 change(value,draft=>{at(draft,'reading').height=500;},true);
 assert(at(value,'tail').y>at(baseline,'tail').y);
 change(value,draft=>foldCards(draft,new Set(['reading']),true));
 assert.equal(at(value,'tail').y,at(baseline,'tail').y,'auto-fit without a preceding unfold must also reclaim its displaced space');
 assert.equal(at(value,'group').height,at(baseline,'group').height);
 assert.equal(at(value,'outside').y,at(baseline,'outside').y);
 assert.equal(at(value,'reading').expandedHeight,500);
});

test('an auto-sized inline text edit retains recovery while preserving the latest text and expanded height',()=>{
 const value=board(frame('group',0,0,400,500),node('reading',30,60,300,72,{autoSize:true,textAutoHeight:true,collapsed:true,expandedHeight:300}),node('tail',30,200)),baseline=clone(value);
 change(value,draft=>foldCards(draft,new Set(['reading']),false));
 // Inline text commit fits the edited text in the same normal undoable change.
 change(value,draft=>{at(draft,'reading').text='Edited content\n'.repeat(30);at(draft,'reading').height=600;});
 change(value,draft=>foldCards(draft,new Set(['reading']),true));
 assert.equal(at(value,'tail').y,at(baseline,'tail').y);
 assert.equal(at(value,'group').height,at(baseline,'group').height);
 assert.equal(at(value,'reading').expandedHeight,600);
 assert.equal(at(value,'reading').text,'Edited content\n'.repeat(30));
});

test('closing a reading card inside nested groups restores both frame levels and outer neighbors',()=>{
 const value=board(frame('outer',0,0,650,650),frame('inner',30,60,500,320),node('reading',60,120,300,72,{collapsed:true,expandedHeight:420}),node('tail',60,240),node('outer-tail',30,450,500),node('outside',0,750)),baseline=clone(value);
 change(value,draft=>foldCards(draft,new Set(['reading']),false));
 assert(at(value,'outer').height>at(baseline,'outer').height);
 change(value,draft=>foldCards(draft,new Set(['reading']),true));
 assert.deepEqual(geometry(value),geometry(baseline));
});

test('reclosing a manual folded branch restores outsiders without changing child coordinates',()=>{
 const value=board(node('root',0,0,200,80,{branchFolded:true,mindmapRules:{layout:'right',density:'standard',automatic:false}}),node('child',300,0,200,200),node('outside',300,150,200));
 value.edges=[{id:'branch',from:'root',to:'child',kind:'branch',label:''}];const baseline=clone(value);
 change(value,draft=>{delete at(draft,'root').branchFolded;});
 assert(at(value,'outside').y>at(baseline,'outside').y);
 change(value,draft=>{at(draft,'root').branchFolded=true;});
 assert.deepEqual(geometry(value),geometry(baseline));
});

test('editing fixed-size text together with a manual resize invalidates recovery',()=>{
 const value=board(frame('group',0,0,400,500),node('reading',30,60,300,72,{autoSize:false,textAutoHeight:false,collapsed:true,expandedHeight:300}),node('tail',30,200));
 change(value,draft=>foldCards(draft,new Set(['reading']),false));
 change(value,draft=>{at(draft,'reading').text='Edited fixed-size text';at(draft,'reading').height=600;});
 const manualLayout=clone(value);
 change(value,draft=>foldCards(draft,new Set(['reading']),true));
 assert.equal(at(value,'tail').y,at(manualLayout,'tail').y);
 assert.equal(at(value,'group').height,at(manualLayout,'group').height);
 assert.equal(at(value,'reading').text,'Edited fixed-size text');
});

test('two reading cards in vertically stacked groups recover independently before their shared baseline',()=>{
 const value=board(frame('a-group',0,0,400,400),node('a',30,60,300,72,{collapsed:true,expandedHeight:400}),node('a-tail',30,180),frame('b-group',0,500,400,400),node('b',30,560,300,72,{collapsed:true,expandedHeight:350}),node('b-tail',30,680),node('outside',30,980)),baseline=clone(value);
 change(value,draft=>foldCards(draft,new Set(['a']),false));
 change(value,draft=>foldCards(draft,new Set(['b']),false));
 change(value,draft=>foldCards(draft,new Set(['a']),true));
 assert.equal(at(value,'a-tail').y,at(baseline,'a-tail').y);
 assert.equal(at(value,'a-group').height,at(baseline,'a-group').height);
 assert.equal(at(value,'b').height,350);
 assert.equal(at(value,'b-group').y,at(baseline,'b-group').y);
 assert(at(value,'b-tail').y>=at(value,'b').y+at(value,'b').height);
 change(value,draft=>foldCards(draft,new Set(['b']),true));
 assert.deepEqual(geometry(value),geometry(baseline));
});

test('an automatic branch replays its still-open tree and restores the saved geometry after both folds close',()=>{
 const value=board(node('root',0,200,200,80,{branchFolded:true,mindmapRules:{layout:'right',density:'standard',automatic:true}}),node('child',300,40,200,72,{collapsed:true,expandedHeight:320}),node('sibling',300,340,200),node('outside',300,450,200));
 value.edges=[{id:'child-edge',from:'root',to:'child',kind:'branch',label:''},{id:'sibling-edge',from:'root',to:'sibling',kind:'branch',label:''}];const baseline=clone(value);
 change(value,draft=>{delete at(draft,'root').branchFolded;});
 change(value,draft=>foldCards(draft,new Set(['child']),false));
 change(value,draft=>{at(draft,'child').height=600;},true);
 change(value,draft=>foldCards(draft,new Set(['child']),true));
 assert.equal(at(value,'root').branchFolded,undefined);
 assert.equal(at(value,'outside').y,at(baseline,'outside').y);
 assert.equal(at(value,'child').expandedHeight,600);
 change(value,draft=>{at(draft,'root').branchFolded=true;});
 assert.deepEqual(geometry(value),geometry(baseline));
});

test('malformed optional checkpoint data never prevents loading the current board geometry',()=>{
 const value=board(node('reading',0,0,300,72,{collapsed:true,expandedHeight:300}),node('tail',0,180));
 change(value,draft=>foldCards(draft,new Set(['reading']),false));assert(value.readingLayout);
 const mutations=[
  (state:NonNullable<Board['readingLayout']>)=>{state.version=2 as 1;},
  (state:NonNullable<Board['readingLayout']>)=>{state.base.pop();},
  (state:NonNullable<Board['readingLayout']>)=>{state.applied[0].id='wrong-id';},
  (state:NonNullable<Board['readingLayout']>)=>{state.base[0].x=NaN;},
  (state:NonNullable<Board['readingLayout']>)=>{state.applied[0].collapsed='yes' as unknown as boolean;}
 ];
 for(const mutate of mutations){const broken=clone(value);mutate(broken.readingLayout!);const loaded=parseBoard(JSON.stringify(broken));assert.equal(loaded.readingLayout,undefined);assert.deepEqual(geometry(loaded),geometry(value));}
});
