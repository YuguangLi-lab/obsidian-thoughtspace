import test from 'node:test';
import assert from 'node:assert/strict';
import {BoardDocumentError,replaceBoardDocumentLayout} from '../tools/board-tool/schema/board-document';
import {parseBoard} from '../tools/board-tool/schema/model';
import {board,card,text,section,sampleStroke,wrapped,realRead,parseYaml,clone,type Kind} from './ai_board_tool_fixtures';

for(const version of [1,2,3] as const)for(const extension of ['thoughtspace','md'] as const)test(`AI current-contract fixture uses real parser: Board v${version} / ${extension}`,()=>{
 const value=board('ordinary',version),source=wrapped(value,extension),document=realRead(source,extension);assert.deepEqual(document.board,value);assert.equal(document.source,source);
});
for(const kind of ['ordinary','brain','handwriting'] as Kind[])for(const extension of ['thoughtspace','md'] as const)test(`AI ${kind} / ${extension} source keeps complete opaque data through actual layout replacement`,()=>{
 const value=Object.assign(board(kind),{'vendor/state~x':{nested:[null,true,.123456789012345]}});
 if(value.nodes[0])Object.assign(value.nodes[0],{vendorNode:{keep:'未知'}});if(value.edges[0])Object.assign(value.edges[0],{vendorEdge:['keep']});if(value.ink){Object.assign(value.ink,{vendorInk:{keep:1}});Object.assign(value.ink.strokes[0],{vendorStroke:[false,0]});}
 const source=wrapped(value,extension,{vendorEnvelope:{nested:[true,null,'extra']}},'\r\n'),document=realRead(source,extension),before=clone(document.board);document.board.viewport.x=77.125;
 const saved=replaceBoardDocumentLayout(source,document,document.board,parseYaml),reopened=realRead(saved.source,extension);assert.deepEqual(reopened.board,{...before,viewport:{...before.viewport,x:77.125}});assert.equal(document.source,source);
 if(extension==='md'){assert.equal(saved.source.slice(0,saved.layoutStart),source.slice(0,document.layoutStart));assert.equal(saved.source.slice(saved.layoutEnd),source.slice(document.layoutEnd));assert.ok(saved.layoutSource.includes('"vendorEnvelope"'));assert.ok(saved.layoutSource.includes('extra'));}
});

test('Node, Edge and Stroke IDs are three independent real-parser namespaces',()=>{
 const value=board('handwriting');value.nodes=[text('shared'),text('other',120)];value.edges=[{id:'shared',from:'shared',to:'other',label:''}];value.ink!.strokes=[sampleStroke('shared')];assert.deepEqual(realRead(wrapped(value,'thoughtspace'),'thoughtspace').board,value);
 for(const collection of ['nodes','edges','strokes'] as const){const invalid=clone(value);if(collection==='strokes')invalid.ink!.strokes.push(sampleStroke('shared'));else if(collection==='nodes')invalid.nodes.push({...invalid.nodes[0],x:400});else invalid.edges.push({...invalid.edges[0]});assert.throws(()=>realRead(wrapped(invalid,'md'),'md'),BoardDocumentError);assert.deepEqual(value.ink!.strokes[0].points,[[.123456789012345, .987654321098765,0]]);}
});

test('real parser rejects branch multi-parent, branch cycles and section-containment mixed cycles',()=>{
 const value=board();value.nodes=[text('a'),text('b',120),text('c',240)];value.edges=[{id:'ab',from:'a',to:'b',label:'',kind:'branch'},{id:'cb',from:'c',to:'b',label:'',kind:'branch'}];assert.throws(()=>parseBoard(JSON.stringify(value)),/父级/);
 value.edges=[{id:'ab',from:'a',to:'b',label:'',kind:'branch'},{id:'ba',from:'b',to:'a',label:'',kind:'branch'}];assert.throws(()=>parseBoard(JSON.stringify(value)),/循环/);
 value.nodes=[section('group'),card('inside','notes/source.md',0)];value.edges=[{id:'mixed',from:'inside',to:'group',label:'',kind:'branch'}];assert.throws(()=>parseBoard(JSON.stringify(value)),/包含关系不能形成循环/);
 value.edges=[{id:'relation',from:'inside',to:'group',label:''}];assert.doesNotThrow(()=>parseBoard(JSON.stringify(value)));
});

test('real brain parser preserves missing historical refs but enforces state/history key and index invariants',()=>{
 const value=board('brain');value.brain={version:1,centerId:'deleted',expandedIds:['gone-expanded'],pins:['gone-pin'],history:{entries:['node-1','deleted'],index:1}};
 value.brainReadingPositions=[{version:1,id:'position',name:'Saved place',centerId:'deleted',expandedIds:['gone-expanded'],depth:5,viewport:{x:1.125,y:-7.25,zoom:.15}}];assert.deepEqual(realRead(wrapped(value,'md'),'md').board,value);
 for(const mutate of [(b:any)=>b.brain.future=true,(b:any)=>b.brain.history.future=true,(b:any)=>b.brain.history.index=0,(b:any)=>b.brain.history.entries=['deleted','deleted'],(b:any)=>b.brain.descendantDepth=1.5,(b:any)=>b.brainReadingPositions[0].viewport.future=1]){const invalid=clone(value);mutate(invalid);assert.throws(()=>realRead(wrapped(invalid,'md'),'md'),BoardDocumentError);}
 const revisited=board('brain');revisited.brain={version:1,centerId:'node-1',expandedIds:[],pins:[],history:{entries:['node-1','node-2','node-1'],index:2}};assert.deepEqual(realRead(wrapped(revisited,'thoughtspace'),'thoughtspace').board,revisited);
});

for(const extension of ['md','thoughtspace'] as const)for(const scenario of ['single8192','total65536','strokes2000'] as const)test(`real ink exact boundary ${scenario} / ${extension} retains all pressure/world precision`,()=>{
 const value=board('handwriting');value.ink!.strokes=scenario==='single8192'?[sampleStroke('s',8192)]:scenario==='total65536'?Array.from({length:8},(_,i)=>sampleStroke(`s${i}`,8192)):Array.from({length:2000},(_,i)=>sampleStroke(`s${i}`));
 value.ink!.strokes[0].points[0]=[-1000000,1000000,0];value.ink!.strokes[0].width=.5;value.ink!.strokes.at(-1)!.width=24;
 const source=wrapped(value,extension),document=realRead(source,extension);assert.deepEqual(document.board.ink,value.ink);assert.equal(document.source,source);assert.deepEqual(realRead(replaceBoardDocumentLayout(source,document,document.board,parseYaml).source,extension).board.ink,value.ink);
});

for(const scenario of ['single8193','total65537','strokes2001','pressure','world','tuple','width'] as const)test(`invalid ink ${scenario} rejects complete collection with no silent truncation`,()=>{
 const value=board('handwriting');if(scenario==='single8193')value.ink!.strokes=[sampleStroke('s',8193)];if(scenario==='total65537')value.ink!.strokes=[...Array.from({length:8},(_,i)=>sampleStroke(`s${i}`,8192)),sampleStroke('extra')];if(scenario==='strokes2001')value.ink!.strokes=Array.from({length:2001},(_,i)=>sampleStroke(`s${i}`));if(scenario==='pressure')value.ink!.strokes[0].points[0][2]=1.01;if(scenario==='world')value.ink!.strokes[0].points[0][0]=1000000.001;if(scenario==='tuple')value.ink!.strokes[0].points[0].push(.5);if(scenario==='width')value.ink!.strokes[0].width=24.001;
 const source=wrapped(value,'md');assert.throws(()=>realRead(source,'md'),error=>error instanceof BoardDocumentError&&error.code==='board-invalid');assert.equal(source,wrapped(value,'md'));assert.equal(value.ink!.strokes.length,scenario==='strokes2001'?2001:scenario==='total65537'?9:1);
});

test('normalization is real parser behavior, while opaque fields survive unchanged',()=>{
 const value=Object.assign(board(),{background:{canvasBackground:'paper',future:'cleaned',backgroundImageOpacity:200},brainColors:{node:' #ABC ',text:'javascript:bad',future:'cleaned'},readingLayout:{invalid:true},relationGeometry:{invalid:true},opaque:{keep:['source',7]}}),source=wrapped(value,'md'),document=realRead(source,'md');
 assert.notDeepEqual(document.board,value);assert.deepEqual(document.board,parseBoard(JSON.stringify(value)));assert.deepEqual((document.board as any).opaque,value.opaque);assert.equal((document.board.background as any).future,undefined);assert.equal(document.board.background?.backgroundImageOpacity,100);assert.deepEqual(document.board.brainColors,{node:'#aabbcc'});assert.equal(document.board.readingLayout,undefined);assert.equal(document.source,source);
});

for(const token of ['-0','-0.000e2','1e999','-1e-999','9'.repeat(400),'9'.repeat(250)+'e99','-0.'+'0'.repeat(400)+'1','1e-7'])test(`AI numeric source follows actual Markdown compatibility path (${token.length>30?`${token.slice(0,10)}…${token.length} chars`:token})`,()=>{
 const value=Object.assign(board(),{futureNumber:0}),source=wrapped(value,'md').replace('"futureNumber": 0',`"futureNumber": ${token}`),actual=realRead(source,'md').board as any;
 assert.deepEqual(actual.futureNumber,JSON.parse(JSON.stringify(JSON.parse(token))));assert.equal(realRead(source,'md').source,source);
});

test('actual legacy/Markdown parser negative-zero semantics are distinct and scientific required overflow is rejected',()=>{
 const value=board(),legacy=wrapped(value,'thoughtspace').replace('"x": 0','"x": -0'),markdown=wrapped(value,'md').replace('"x": 0','"x": -0');assert.equal(Object.is(realRead(legacy,'thoughtspace').board.nodes[0].x,-0),true);assert.equal(Object.is(realRead(markdown,'md').board.nodes[0].x,-0),false);
 for(const extension of ['thoughtspace','md'] as const){const source=wrapped(value,extension).replace('"x": 0','"x": 1e999');assert.throws(()=>realRead(source,extension),BoardDocumentError);}
});
