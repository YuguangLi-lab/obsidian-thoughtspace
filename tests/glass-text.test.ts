import {test} from 'node:test';import assert from 'node:assert/strict';
import {emptyBoard,parseBoard,History,clone,canvasExport,Card,Board} from '../src/model';
import {boardLink,parseBoardLink} from '../src/deeplinks';
const fixture=():Board=>({...emptyBoard(),version:3,nodes:[{id:'t',kind:'text',text:'中文\nA & B',x:0,y:0,width:180,height:90,color:'sand',textColor:'blue',fontSize:24,textAlign:'center',autoSize:true}]});
test('text formatting roundtrips without changing content',()=>{const b=fixture();assert.deepEqual(parseBoard(JSON.stringify(b)),b);});
for(const patch of [{textColor:'chartreuse'},{fontSize:0},{fontSize:100},{fontSize:'24'},{textAlign:'justify'},{autoSize:'true'}])test('rejects invalid text style '+JSON.stringify(patch),()=>{const b=fixture();Object.assign(b.nodes[0],patch);assert.throws(()=>parseBoard(JSON.stringify(b)));});
test('undo redo restores text geometry and foreground together',()=>{const b=fixture(),before=clone(b),h=new History();h.push(b);Object.assign(b.nodes[0],{fontSize:48,textColor:'rose',width:350,height:130});const after=clone(b);assert.deepEqual(h.undo(b),before);assert.deepEqual(h.redo(before),after);});
test('Canvas export retains exact text without injecting unsupported styling',()=>{const n=canvasExport(fixture()).nodes[0];assert.equal(n.type,'text');assert.equal((n as {text?:string}).text,'中文\nA & B');assert.ok(!('textColor' in n));});
test('deep links encode Chinese spaces and URL metacharacters',()=>{const vault='我的 & 笔记',file='目录/中文 & + #白板.thoughtspace',node='topic & /?';const u=new URL(boardLink(vault,file,node));assert.equal(u.protocol,'obsidian:');assert.equal(u.hostname,'thoughtspace');assert.deepEqual(parseBoardLink(Object.fromEntries(u.searchParams),vault),{file,node});});
test('whole board link leaves node optional',()=>assert.deepEqual(parseBoardLink({vault:'V',file:'a.thoughtspace'},'V'),{file:'a.thoughtspace'}));
test('deep links reject a different vault',()=>assert.throws(()=>parseBoardLink({vault:'other',file:'a.thoughtspace'},'V')));
for(const file of ['/tmp/a.thoughtspace','../a.thoughtspace','a/../b.thoughtspace','a\\b.thoughtspace','a.md','a\n.thoughtspace'])test('deep links reject unsafe path '+JSON.stringify(file),()=>assert.throws(()=>parseBoardLink({vault:'V',file},'V')));

test('protocol routing can consume vault while preserving explicit space',()=>assert.deepEqual(parseBoardLink({space:'V',file:'a.thoughtspace',action:'thoughtspace'},'V'),{file:'a.thoughtspace'}));

test('expanded frame and text palettes roundtrip and export Canvas hex colors',()=>{for(const color of ['orange','red','teal','cyan','lime','slate','brown'] as const){const b=fixture();b.nodes[0].color=color;b.nodes[0].textColor=color;assert.deepEqual(parseBoard(JSON.stringify(b)),b);assert.match(canvasExport(b).nodes[0].color,/^#[0-9a-f]{6}$/);}});

test('font families are validated and persisted',()=>{for(const family of ['default','serif','mono']){const b=fixture();Object.assign(b.nodes[0],{fontFamily:family});assert.deepEqual(parseBoard(JSON.stringify(b)),b);}const b=fixture();Object.assign(b.nodes[0],{fontFamily:'url(evil)'});assert.throws(()=>parseBoard(JSON.stringify(b)));});
