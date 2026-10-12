import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSource} from '../tools/board-tool/index';
import {board,card,text,section,sampleStroke,wrapped,realRead,clone,type Kind} from './ai_board_tool_fixtures';

type Result=Awaited<ReturnType<typeof validateSource>>;
function invalid(result:Result,pointer:string,exact=false,objectFallback?:string){
 assert.equal(result.report.format.status,'failed');assert.equal(result.report.overall,'failed');assert.equal(result.board,undefined);
 const issues=result.report.diagnostics.filter(issue=>issue.severity==='error');assert.ok(issues.length);
 if(exact)assert.ok(issues.some(issue=>issue.pointer===pointer),JSON.stringify(issues));
 else assert.ok(issues.some(issue=>(issue.pointer===pointer&&issue.pointer!==objectFallback)||((issue.pointer===''||issue.pointer==='/board'||(objectFallback!==undefined&&issue.pointer===objectFallback))&&!!issue.cause)),JSON.stringify(issues));
}

for(const version of [1,2,3] as const)for(const extension of ['md','thoughtspace'] as const)test(`tool actual parser parity: ordinary Board v${version}, ${extension}`,async()=>{
 const value=board('ordinary',version),source=wrapped(value,extension),expected=realRead(source,extension),result=await validateSource(source,extension);assert.equal(result.report.format.status,'passed');assert.equal(result.report.format.boardVersion,version);assert.deepEqual(result.board,expected.board);assert.equal(result.report.references.status,version===3?'not_applicable':'not_checked');assert.equal(result.report.overall,version===3?'passed':'format_only');assert.equal(source,wrapped(value,extension));
});
for(const kind of ['ordinary','brain','handwriting'] as Kind[])for(const extension of ['md','thoughtspace'] as const)test(`tool ${kind}/${extension} validates complete source rather than a parallel schema`,async()=>{
 const value=board(kind),source=wrapped(value,extension,{opaqueEnvelope:['keep',null]}),result=await validateSource(source,extension);assert.equal(result.report.format.status,'passed');assert.equal(result.report.overall,'passed');assert.deepEqual(result.board,realRead(source,extension).board);assert.equal(result.report.format.presentation,kind);assert.equal(result.report.summary?.nodes,value.nodes.length);assert.equal(result.report.summary?.strokes,value.ink?.strokes.length||0);
});

for(const extension of ['md','thoughtspace'] as const)for(const category of ['node-duplicate','edge-duplicate','stroke-duplicate','dangling-from','dangling-to','pressure'] as const)test(`tool exact original input pointer for ${category}/${extension}`,async()=>{
 const value=board('handwriting');value.nodes=[text('shared'),text('other',120)];value.edges=[{id:'shared',from:'shared',to:'other',label:''}];value.ink!.strokes=[sampleStroke('shared')];let pointer='';
 if(category==='node-duplicate'){value.nodes.push({...value.nodes[0],x:300});pointer='/nodes/2/id';}if(category==='edge-duplicate'){value.edges.push({...value.edges[0]});pointer='/edges/1/id';}if(category==='stroke-duplicate'){value.ink!.strokes.push(sampleStroke('shared'));pointer='/ink/strokes/1/id';}if(category==='dangling-from'){value.edges[0].from='missing';pointer='/edges/0/from';}if(category==='dangling-to'){value.edges[0].to='missing';pointer='/edges/0/to';}if(category==='pressure'){value.ink!.strokes[0].points[0][2]=1.001;pointer='/ink/strokes/0/points/0/2';}
 const source=wrapped(value,extension);assert.throws(()=>realRead(source,extension));const result=await validateSource(source,extension);invalid(result,(extension==='md'?'/board':'')+pointer,true);
 if(category.endsWith('duplicate')){const issue=result.report.diagnostics.find(issue=>issue.pointer===(extension==='md'?'/board':'')+pointer)!;assert.ok(issue.relatedPointers?.includes((extension==='md'?'/board':'')+(category==='node-duplicate'?'/nodes/0/id':category==='edge-duplicate'?'/edges/0/id':'/ink/strokes/0/id')),JSON.stringify(issue));}
});

test('tool accepts independent Node/Edge/Stroke same-name IDs and does not bind graph endpoints to strokes',async()=>{
 const value=board('handwriting');value.nodes=[text('same'),text('second',120)];value.edges=[{id:'same',from:'same',to:'second',label:''}];value.ink!.strokes=[sampleStroke('same'),sampleStroke('stroke-only')];assert.equal((await validateSource(wrapped(value,'md'),'md')).report.format.status,'passed');value.edges[0].to='stroke-only';invalid(await validateSource(wrapped(value,'md'),'md'),'/board/edges/0/to',true);
});

for(const extension of ['md','thoughtspace'] as const)for(const category of ['width','text-height','viewport','color','self-edge','legacy-kind'] as const)test(`tool ordinary invalid ${category}/${extension} follows true parser`,async()=>{
 const value=board('ordinary',category==='legacy-kind'?1:3);let pointer='/nodes/0';if(category==='width'){value.nodes[0].width=79;pointer+='/width';}if(category==='text-height'){value.nodes[0].height=39;pointer+='/height';}if(category==='viewport'){value.viewport.zoom=.149;pointer='/viewport/zoom';}if(category==='color'){(value.nodes[0] as any).color='#ffffff';pointer+='/color';}if(category==='self-edge'){value.edges[0].to=value.edges[0].from;pointer='/edges/0/to';}if(category==='legacy-kind'){value.nodes[0].kind='text';pointer+='/kind';}
 const source=wrapped(value,extension);assert.throws(()=>realRead(source,extension));invalid(await validateSource(source,extension),(extension==='md'?'/board':'')+pointer);
});

test('tool accepts historical Node IDs and large finite ordinary geometry rather than imposing ink/profile rules',async()=>{
 const value=board();value.nodes[0].id=' historical id\t😀 ';value.edges[0].from=value.nodes[0].id;value.nodes[0].x=-1e12;value.nodes[0].width=1e12;value.nodes[0].height=1e12;value.viewport={x:-1e12,y:1e12,zoom:.15};const source=wrapped(value,'md');assert.doesNotThrow(()=>realRead(source,'md'));const result=await validateSource(source,'md');assert.equal(result.report.format.status,'passed');assert.deepEqual(result.board,value);
});

for(const category of ['two-parents','branch-cycle','mixed-section-cycle'] as const)test(`tool rejects real ${category} with honest diagnostics`,async()=>{
 const value=board();value.nodes=[text('a'),text('b',120),text('c',240)];value.edges=category==='two-parents'?[{id:'ab',from:'a',to:'b',label:'',kind:'branch'},{id:'cb',from:'c',to:'b',label:'',kind:'branch'}]:[{id:'ab',from:'a',to:'b',label:'',kind:'branch'},{id:'ba',from:'b',to:'a',label:'',kind:'branch'}];
 if(category==='mixed-section-cycle'){value.nodes=[section('group'),card('inside')];value.edges=[{id:'mixed',from:'inside',to:'group',label:'',kind:'branch'}];}
 const source=wrapped(value,'md');assert.throws(()=>realRead(source,'md'));const result=await validateSource(source,'md');invalid(result,'/board/edges',false,'/board/edges');
});

test('tool brain stale references are recoverable, preserved and not converted into format rejection',async()=>{
 const value=board('brain');value.brain={version:1,centerId:'missing-center',expandedIds:['missing-expanded'],pins:['missing-pin'],history:{entries:['node-1','missing-center'],index:1}};value.brainReadingPositions=[{version:1,id:'place',name:'Saved place',centerId:'missing-center',expandedIds:['missing-expanded'],depth:2,viewport:{x:3.125,y:-7.25,zoom:2.5}}];
 const source=wrapped(value,'md'),result=await validateSource(source,'md');assert.equal(result.report.format.status,'passed');assert.deepEqual(result.board,value);assert.ok(result.report.diagnostics.some(issue=>issue.severity==='recoverable'&&issue.pointer==='/board/brain/centerId'));assert.ok(result.report.diagnostics.some(issue=>issue.severity==='recoverable'&&issue.pointer==='/board/brainReadingPositions/0/centerId'));assert.equal(source,wrapped(value,'md'));
});

for(const category of ['state-unknown','history-unknown','history-index','history-center','adjacent-history','expanded-limit','pins-limit','history-limit','depth-fraction','position-unknown'] as const)test(`tool real brain invariant ${category} is not weakened by schema`,async()=>{
 const value=board('brain') as any;let pointer='/brain';
 if(category==='state-unknown')value.brain.unknown=true;if(category==='history-unknown'){value.brain.history.unknown=true;pointer='/brain/history';}if(category==='history-index'){value.brain.history.index=1;pointer='/brain/history/index';}if(category==='history-center'){value.brain.centerId='node-2';pointer='/brain/centerId';}if(category==='adjacent-history'){value.brain.history.entries=['node-1','node-1'];value.brain.history.index=1;pointer='/brain/history/entries/1';}if(category==='expanded-limit'){value.brain.expandedIds=Array.from({length:9},(_,i)=>`n${i}`);pointer='/brain/expandedIds';}if(category==='pins-limit'){value.brain.pins=Array.from({length:7},(_,i)=>`n${i}`);pointer='/brain/pins';}if(category==='history-limit'){value.brain.history.entries=Array.from({length:41},(_,i)=>`n${i}`);value.brain.history.index=40;value.brain.centerId='n40';pointer='/brain/history/entries';}if(category==='depth-fraction'){value.brain.descendantDepth=1.5;pointer='/brain/descendantDepth';}if(category==='position-unknown'){value.brainReadingPositions=[{version:1,id:'place',name:'Place',centerId:'node-1',expandedIds:[],depth:1,viewport:{x:0,y:0,zoom:1},unknown:true}];pointer='/brainReadingPositions/0';}
 const source=wrapped(value,'md');assert.throws(()=>realRead(source,'md'));invalid(await validateSource(source,'md'),'/board'+pointer,false,category==='position-unknown'?'/board/brainReadingPositions':'/board/brain');
});

test('tool brain history40/expanded8/pins6/readingPositions50 limits accept complete recoverable state',async()=>{
 const value=board('brain'),entries=Array.from({length:40},(_,i)=>`history-${i}`);value.brain={version:1,centerId:entries[39],expandedIds:Array.from({length:8},(_,i)=>`expanded-${i}`),pins:Array.from({length:6},(_,i)=>`pin-${i}`),history:{entries,index:39},descendantDepth:5};value.brainReadingPositions=Array.from({length:50},(_,i)=>({version:1,id:`place-${i}`,name:`Place ${i}`,centerId:`missing-${i}`,expandedIds:[],depth:1,viewport:{x:i,y:-i,zoom:2.5}}));const source=wrapped(value,'md'),result=await validateSource(source,'md');assert.equal(result.report.format.status,'passed');assert.deepEqual(result.board,realRead(source,'md').board);assert.equal(result.board?.brainReadingPositions?.length,50);assert.equal(result.board?.brain?.history.entries.length,40);assert.equal(Object.is(result.board?.brainReadingPositions?.[0].viewport.y,-0),false);assert.ok(result.report.diagnostics.some(issue=>issue.severity==='recoverable'));
});

for(const category of ['empty-ink','single8192','total65536','strokes2000'] as const)test(`tool ink legal ${category} keeps full samples and pressure precision`,async()=>{
 const value=board('handwriting');value.ink!.strokes=category==='empty-ink'?[]:category==='single8192'?[sampleStroke('s',8192)]:category==='total65536'?Array.from({length:8},(_,i)=>sampleStroke(`s${i}`,8192)):Array.from({length:2000},(_,i)=>sampleStroke(`s${i}`));
 const source=wrapped(value,'md'),result=await validateSource(source,'md');assert.equal(result.report.format.status,'passed');assert.deepEqual(result.board?.ink,value.ink);assert.equal(result.report.summary?.points,value.ink!.strokes.reduce((sum,stroke)=>sum+stroke.points.length,0));assert.equal(source,wrapped(value,'md'));
});
for(const category of ['single8193','total65537','strokes2001','world','tuple','stroke-width','non-handwriting'] as const)test(`tool ink invalid ${category} cannot truncate into success`,async()=>{
 const value=board('handwriting');let pointer='/ink/strokes';if(category==='single8193'){value.ink!.strokes=[sampleStroke('s',8193)];pointer+='/0/points';}if(category==='total65537')value.ink!.strokes=[...Array.from({length:8},(_,i)=>sampleStroke(`s${i}`,8192)),sampleStroke('extra')];if(category==='strokes2001')value.ink!.strokes=Array.from({length:2001},(_,i)=>sampleStroke(`s${i}`));if(category==='world'){value.ink!.strokes[0].points[0][1]=-1000000.0001;pointer+='/0/points/0/1';}if(category==='tuple'){value.ink!.strokes[0].points[0].push(.5);pointer+='/0/points/0';}if(category==='stroke-width'){value.ink!.strokes[0].width=.499;pointer+='/0/width';}if(category==='non-handwriting'){delete value.presentation;pointer='/ink';}
 const source=wrapped(value,'md');assert.throws(()=>realRead(source,'md'));invalid(await validateSource(source,'md'),'/board'+pointer);assert.equal(source,wrapped(value,'md'));
});

test('tool reports normalization separately and retains opaque fields under actual parser results',async()=>{
 const value=Object.assign(board(),{background:{canvasBackground:'paper',future:'drop',backgroundImageOpacity:101},brainColors:{node:'#ABC',text:'javascript:bad'},readingLayout:{invalid:true},relationGeometry:{invalid:true},'vendor/state~x':{keep:[false,null,.123456789012345]}}),source=wrapped(value,'md',{opaqueEnvelope:[true,0]}),result=await validateSource(source,'md');
 assert.equal(result.report.format.status,'passed');assert.deepEqual(result.board,realRead(source,'md').board);assert.deepEqual((result.board as any)['vendor/state~x'],value['vendor/state~x']);assert.ok(result.report.diagnostics.some(issue=>issue.severity==='normalized'));assert.equal(source,wrapped(value,'md',{opaqueEnvelope:[true,0]}));
});

test('normalization diagnostic JSON Pointer escapes original slash and tilde keys',async()=>{
 const value=Object.assign(board(),{background:{canvasBackground:'paper','vendor/state~x':{future:true}}}),source=wrapped(value,'md'),result=await validateSource(source,'md');assert.equal(result.report.format.status,'passed');assert.deepEqual(result.board,realRead(source,'md').board);assert.ok(result.report.diagnostics.some(issue=>issue.severity==='normalized'&&issue.pointer==='/board/background/vendor~1state~0x'),JSON.stringify(result.report.diagnostics));assert.equal(source,wrapped(value,'md'));
});

test('inline marker prose outside the real layout cannot hide normalization diagnostics',async()=>{
 const value=Object.assign(board(),{brainColors:{node:'#ABC'}}),source=wrapped(value,'md').replace('Before body','Inline `<!-- thoughtspace-board-layout:start -->` Before body');assert.doesNotThrow(()=>realRead(source,'md'));const result=await validateSource(source,'md');assert.equal(result.report.format.status,'passed');assert.deepEqual(result.board,realRead(source,'md').board);assert.ok(result.report.diagnostics.some(issue=>issue.severity==='normalized'&&issue.pointer==='/board/brainColors/node'));assert.equal(source.includes('Inline `<!-- thoughtspace-board-layout:start -->`'),true);
});

for(const token of ['-0','1e999','-1e-999','9'.repeat(400),'9'.repeat(250)+'e99','-0.'+'0'.repeat(400)+'1','1e-7'])test(`tool numeric parity / original-token input ${token.slice(0,12)}`,async()=>{
 const value=Object.assign(board(),{'vendor/state~x':0}),source=wrapped(value,'md').replace('"vendor/state~x": 0',`"vendor/state~x": ${token}`),result=await validateSource(source,'md');assert.equal(result.report.format.status,'passed');assert.deepEqual(result.board,realRead(source,'md').board);assert.equal(Object.is((result.board as any)['vendor/state~x'],-0),false);assert.equal(source,wrapped(value,'md').replace('"vendor/state~x": 0',`"vendor/state~x": ${token}`));
});

test('document/YAML/JSON failures use real document codes and do not invent JSON property locations',async()=>{
 const source=wrapped(board(),'md');for(const invalidSource of [source.replace('thoughtspace: "board"','thoughtspace: ['),source.replace('<!-- thoughtspace-board-layout:end -->',''),source.replace('"format": "thoughtspace-board"','"format":')]){assert.throws(()=>realRead(invalidSource,'md'));const result=await validateSource(invalidSource,'md');assert.equal(result.report.format.status,'failed');assert.ok(result.report.diagnostics.some(issue=>issue.severity==='error'&&(issue.pointer===null||issue.pointer==='')),JSON.stringify(result.report.diagnostics));assert.ok(!result.report.diagnostics.some(issue=>issue.pointer==='/yaml'||issue.pointer==='/layout'));}
});
