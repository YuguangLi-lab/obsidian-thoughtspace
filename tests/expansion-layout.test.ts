import test from 'node:test';
import assert from 'node:assert/strict';
import {reflowExpandedContent} from '../src/expansion-layout';
import {clone,emptyBoard,type Board,type Card} from '../src/model';
import {foldCards} from '../src/board-tools';
import {branchState,visibleBranchBoard,reflowAutomaticMindmaps} from '../src/mindmap';
import {sectionContains} from '../src/sections';
import {planGroupMove,applyGroupMove} from '../src/group-organizer';

const node=(id:string,x:number,y:number,width=280,height=100,extra:Partial<Card>={}):Card=>({id,kind:'text',x,y,width,height,color:'blue',text:id,...extra});
const group=(id:string,x:number,y:number,width:number,height:number,extra:Partial<Card>={}):Card=>node(id,x,y,width,height,{kind:'section',title:id,...extra});
function board(...nodes:Card[]):Board{return{...emptyBoard(),version:3,nodes};}
function grow(b:Board,id:string,height:number){const before=clone(b);b.nodes.find(n=>n.id===id)!.height=height;reflowExpandedContent(b,before);return before;}
function overlap(a:Card,b:Card){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
function collisions(b:Board){const visible=visibleBranchBoard(b).nodes.filter(n=>n.kind!=='section');return visible.flatMap((a,i)=>visible.slice(i+1).filter(other=>overlap(a,other)).map(other=>[a.id,other.id]));}
function current(b:Board,id:string){return b.nodes.find(n=>n.id===id)!;}

test('expanding a long text moves only its colliding image/audio column and grows its frame',()=>{
 const b=board(group('g',0,0,600,760),node('text',40,60,500,72,{collapsed:true,expandedHeight:460}),node('image',40,210,480,250,{kind:'image',file:'image.png'}),node('audio',40,490,480,140,{kind:'audio',file:'audio.mp3'}),node('unrelated',900,60));
 const before=clone(b);foldCards(b,new Set(['text']),false);reflowExpandedContent(b,before);
 assert.deepEqual(collisions(b),[]);assert.equal(current(b,'text').y,60);assert.equal(current(b,'image').y,544);assert.equal(current(b,'audio').y,818);assert.equal(current(b,'g').height,988);assert.deepEqual(current(b,'unrelated'),current(before,'unrelated'));
});

test('plain movements, shrinking, new nodes and style changes never rearrange older content',()=>{
 for(const action of ['move','shrink','add','style']as const){const b=board(node('a',0,0),node('b',0,130)),before=clone(b);if(action==='move')current(b,'a').y=100;if(action==='shrink')current(b,'a').height=80;if(action==='add')b.nodes.push(node('new',0,100));if(action==='style')current(b,'a').color='rose';const requested=clone(b);reflowExpandedContent(b,before);assert.deepEqual(b,requested,action);}
});

test('unrelated pre-existing overlaps remain unchanged',()=>{
 const b=board(node('a',0,0),node('b',0,150),node('x',900,0),node('y',900,50));const oldX=clone(current(b,'x')),oldY=clone(current(b,'y'));grow(b,'a',200);
 assert.deepEqual(collisions(b),[['x','y']]);assert.deepEqual(current(b,'x'),oldX);assert.deepEqual(current(b,'y'),oldY);
});

test('repeated asynchronous growth pushes downstream once and equal measurements are idempotent',()=>{
 const b=board(node('a',0,0),node('b',0,130),node('c',0,260));grow(b,'a',200);assert.equal(current(b,'b').y,224);assert.equal(current(b,'c').y,348);grow(b,'a',350);assert.equal(current(b,'b').y,374);assert.equal(current(b,'c').y,498);
 const saved=clone(b);reflowExpandedContent(b,clone(b));assert.deepEqual(b,saved);grow(b,'a',200);assert.deepEqual(current(b,'b'),current(saved,'b'));
});

test('old overlap involving the expanded source is resolved',()=>{
 const b=board(node('a',0,0,280,150),node('b',0,80));grow(b,'a',250);assert.equal(current(b,'b').y,274);assert.deepEqual(collisions(b),[]);
});

test('a locked obstacle stays fixed while the expanding source moves below it',()=>{
 const b=board(node('source',0,0),node('locked',0,150,280,100,{locked:true}),node('downstream',0,280));const fixed=clone(current(b,'locked'));grow(b,'source',220);
 assert.deepEqual(current(b,'locked'),fixed);assert.equal(current(b,'source').y,274);assert.deepEqual(collisions(b),[]);
});

test('a locked enclosing frame rejects growth that cannot preserve its bounds',()=>{
 const b=board(group('g',0,0,400,350,{locked:true}),node('source',30,60,280,100),node('b',30,190));
 assert.throws(()=>grow(b,'source',250),/锁定|分组/);
});

test('inner group growth propagates through its parent without splitting nested material',()=>{
 const b=board(group('outer',0,0,700,600),group('inner',30,60,600,280),node('source',60,120,300,80),node('inner-tail',60,224,300,80),node('outer-tail',30,380,300,100));
 grow(b,'source',260);
 assert.deepEqual(collisions(b),[]);assert.equal(current(b,'inner-tail').y,404);assert.ok(current(b,'inner').height>=454);assert.ok(current(b,'outer-tail').y>=current(b,'inner').y+current(b,'inner').height+24);
 for(const id of ['source','inner-tail'])assert.ok(sectionContains(current(b,'inner'),current(b,id)));assert.ok(sectionContains(current(b,'outer'),current(b,'inner')));assert.ok(sectionContains(current(b,'outer'),current(b,'outer-tail')));
});

test('moving a sibling nested group carries its whole frame and contents equally',()=>{
 const b=board(group('outer',0,0,650,800),node('source',30,60,500,100),group('nested',30,200,550,350),node('nested-a',60,260,300,100),node('nested-b',60,400,300,100));
 const before=clone(b);grow(b,'source',240);const dy=current(b,'nested').y-current(before,'nested').y;assert.ok(dy>0);
 for(const id of ['nested-a','nested-b'])assert.equal(current(b,id).y-current(before,id).y,dy);assert.deepEqual(collisions(b),[]);
});

test('a folded branch moves with all hidden descendants',()=>{
 const b=board(node('source',0,0),node('folded',0,150,280,100,{branchFolded:true}),node('hidden',400,300));b.edges=[{id:'branch',from:'folded',to:'hidden',kind:'branch',label:''}];
 const before=clone(b);grow(b,'source',250);const dy=current(b,'folded').y-current(before,'folded').y;assert.equal(dy,124);assert.equal(current(b,'hidden').y-current(before,'hidden').y,dy);assert.ok(branchState(b).hidden.has('hidden'));assert.deepEqual(collisions(b),[]);
});

test('locked hidden descendants pin their folded root movement unit',()=>{
 const b=board(node('source',0,0),node('folded',0,150,280,100,{branchFolded:true}),node('hidden',400,300,280,100,{locked:true}));b.edges=[{id:'branch',from:'folded',to:'hidden',kind:'branch',label:''}];
 const before=clone(b);grow(b,'source',250);assert.deepEqual(current(b,'folded'),current(before,'folded'));assert.deepEqual(current(b,'hidden'),current(before,'hidden'));assert.deepEqual(collisions(b),[]);
});

test('expanding a section pushes outside cards so frame growth never acquires them',()=>{
 const b=board(group('g',0,0,400,300),node('source',30,60,300,100),node('tail',30,184,300,80),node('outside',30,340,300,100));const outsideBefore=clone(current(b,'outside'));
 grow(b,'source',280);assert.ok(current(b,'outside').y>outsideBefore.y);assert.equal(sectionContains(current(b,'g'),current(b,'outside')),false);assert.deepEqual(collisions(b),[]);
});

test('revealing old hidden content in a section also resolves its collisions',()=>{
 const b=board(group('g',0,0,450,400,{sectionFolded:true}),node('a',30,60,300,180),node('b',30,180,300,100),node('outside',30,430));const before=clone(b);delete current(b,'g').sectionFolded;reflowExpandedContent(b,before);assert.deepEqual(collisions(b),[]);assert.equal(current(b,'b').y,264);
});

test('a shared overlap between independent groups rejects affected expansion',()=>{
 const b=board(group('one',0,0,500,400),group('two',100,0,500,400),node('shared',150,60,200,100),node('other',150,200,200,100));assert.throws(()=>grow(b,'shared',220),/重叠|共享/);
});

test('unrelated ambiguous groups do not block an independent expansion',()=>{
 const b=board(node('source',0,0),node('tail',0,150),group('one',1000,0,500,400),group('two',1100,0,500,400),node('shared',1150,60,200,100));grow(b,'source',250);assert.equal(current(b,'tail').y,274);
});

test('an automatic mindmap tree is moved as one unit without changing internal offsets',()=>{
 const b=board(node('tree',0,0,200,80,{mindmapRules:{layout:'right',density:'standard',automatic:true}}),node('child',300,0,200,80),node('outside',300,120,250,100));b.edges=[{id:'branch',from:'tree',to:'child',kind:'branch',label:''}];
 grow(b,'child',180);assert.equal(current(b,'tree').y,0);assert.equal(current(b,'child').y,0);assert.equal(current(b,'outside').y,204);assert.deepEqual(collisions(b),[]);
});

test('width expansion uses the compact display footprint and moves a colliding neighbor down',()=>{
 const b=board(node('source',0,0,500,72,{collapsed:true,expandedHeight:100}),node('right',240,0,200,100));const before=clone(b);foldCards(b,new Set(['source']),false);reflowExpandedContent(b,before);assert.equal(current(b,'right').x,240);assert.equal(current(b,'right').y,124);assert.deepEqual(collisions(b),[]);
});

test('simultaneous expansion around a fixed obstacle terminates with disjoint active content',()=>{
 const b=board(node('a',0,0,280,72,{collapsed:true,expandedHeight:230}),node('b',0,150,280,72,{collapsed:true,expandedHeight:180}),node('fixed',0,260,280,100,{locked:true}),node('tail',0,420));
 const before=clone(b);foldCards(b,new Set(['a','b']),false);reflowExpandedContent(b,before);assert.deepEqual(current(b,'fixed'),current(before,'fixed'));assert.deepEqual(collisions(b),[]);
});

test('revealing overlapping locked nodes inside an automatic tree rejects the change',()=>{
 const b=board(node('root',0,0,200,80,{branchFolded:true,mindmapRules:{layout:'right',density:'standard',automatic:true}}),node('one',300,0,200,100,{locked:true}),node('two',300,50,200,100,{locked:true}));
 b.edges=[{id:'one-edge',from:'root',to:'one',kind:'branch',label:''},{id:'two-edge',from:'root',to:'two',kind:'branch',label:''}];const before=clone(b);delete current(b,'root').branchFolded;assert.throws(()=>reflowExpandedContent(b,before),/锁定|导图/);
});

test('a displaced automatic tree keeps every child offset unchanged',()=>{
 const b=board(node('source',0,0,500,100),node('tree',0,150,200,80,{mindmapRules:{layout:'right',density:'standard',automatic:true}}),node('child',300,150,200,80));b.edges=[{id:'edge',from:'tree',to:'child',kind:'branch',label:''}];
 const before=clone(b);grow(b,'source',300);const shift=current(b,'tree').y-current(before,'tree').y;assert.equal(shift,174);assert.equal(current(b,'child').y-current(before,'child').y,shift);assert.deepEqual(collisions(b),[]);
});

test('content growth still clears a partially intruding outside card when its frame needs no expansion',()=>{
 const b=board(group('g',0,0,700,700),node('source',40,70,280,100),node('outside',200,650,600,80));grow(b,'source',600);assert.equal(current(b,'g').height,700);assert.equal(current(b,'outside').y,724);assert.deepEqual(collisions(b),[]);
});

test('activity inside a roomy frame does not repair unrelated overlaps at the frame edge',()=>{
 const b=board(group('g',0,0,700,700),node('source',40,70,280,100),node('outside',200,500,600,80));const outside=clone(current(b,'outside'));grow(b,'source',200);assert.deepEqual(current(b,'outside'),outside);
});

test('an explicitly manual mindmap preserves internal positions on size changes and only clears outsiders',()=>{
 const b=board(node('root',0,0,200,80,{mindmapRules:{layout:'right',density:'standard',automatic:false}}),node('one',300,0,200,80),node('two',300,120,200,80),node('outside',300,240,200,80));b.edges=[{id:'one-edge',from:'root',to:'one',kind:'branch',label:''},{id:'two-edge',from:'root',to:'two',kind:'branch',label:''}];
 const before=clone(b);grow(b,'one',300);for(const id of ['root','one','two'])assert.equal(current(b,id).y,current(before,id).y);assert.equal(current(b,'outside').y,324);
});

test('explicit group enlargement and moving content into it keep their requested ownership',()=>{
 const b=board(group('g',0,0,400,300),node('a',30,60,280,100),node('moving',600,0,280,200));const before=clone(b);applyGroupMove(b,planGroupMove(b,new Set(['moving']),'g'));const requested=clone(b);reflowExpandedContent(b,before);assert.deepEqual(b,requested);assert.ok(sectionContains(current(b,'g'),current(b,'moving')));
 const previous=clone(b);current(b,'g').height+=300;const resized=clone(b);reflowExpandedContent(b,previous);assert.deepEqual(b,resized);
});

test('moving and resizing a node in the same explicit operation does not trigger expansion repair',()=>{
 const b=board(node('source',0,0),node('other',0,200)),before=clone(b);Object.assign(current(b,'source'),{y:150,height:300});const requested=clone(b);reflowExpandedContent(b,before);assert.deepEqual(b,requested);
});

test('locked automatic trees preserve existing manual geometry during plain measurements',()=>{
 const b=board(node('root',0,0,200,80,{mindmapRules:{layout:'right',density:'standard',automatic:true}}),node('one',300,0,200,80),node('two',300,120,200,80,{locked:true}));b.edges=[{id:'one-edge',from:'root',to:'one',kind:'branch',label:''},{id:'two-edge',from:'root',to:'two',kind:'branch',label:''}];const before=clone(b);grow(b,'one',900);assert.equal(current(b,'one').y,current(before,'one').y);assert.deepEqual(current(b,'two'),current(before,'two'));
});

test('native automatic reflow changing a growing leaf position still clears outside collisions',()=>{
 const b=board(node('root',0,100,200,80,{mindmapRules:{layout:'right',density:'standard',automatic:true}}),node('child',300,100,200,80),node('outside',300,250,250,100));b.edges=[{id:'edge',from:'root',to:'child',kind:'branch',label:''}];const before=clone(b);current(b,'child').height=300;reflowAutomaticMindmaps(b,before);assert.notEqual(current(b,'child').y,current(before,'child').y);reflowExpandedContent(b,before);assert.deepEqual(collisions(b),[]);assert.equal(current(b,'outside').y,314);
});

test('folded groups carry external hidden descendants linked from nested frames',()=>{
 for(const locked of [false,true]){
  const b=board(node('source',0,0),group('folded',0,150,400,400,{sectionFolded:true}),group('nested',30,220,300,250),node('external-hidden',800,220,280,100,{locked}));b.edges=[{id:'edge',from:'nested',to:'external-hidden',kind:'branch',label:''}];const before=clone(b);grow(b,'source',250);
  const dy=current(b,'folded').y-current(before,'folded').y;assert.equal(dy,locked?0:124);assert.equal(current(b,'nested').y-current(before,'nested').y,dy);assert.equal(current(b,'external-hidden').y-current(before,'external-hidden').y,dy);assert.deepEqual(collisions(b),[]);
 }
});

test('a cross-scope automatic tree stays visible to collision detection and rejects an unsafe displacement',()=>{
 for(const sectionFolded of [false,true]){const b=board(group('g',0,0,300,220,{sectionFolded}),node('root',30,60,200,80,{mindmapRules:{layout:'right',density:'standard',automatic:true}}),node('child',400,0,200,80),node('source',400,-100,200,80));b.edges=[{id:'edge',from:'root',to:'child',kind:'branch',label:''}];assert.throws(()=>grow(b,'source',250),/重叠|共享|分组/);}
});
