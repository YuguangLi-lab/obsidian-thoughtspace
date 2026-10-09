import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {emptyBoard,type Board} from '../src/model';
import {BoardDocumentError,isMarkdownBoardFrontmatter,readBoardDocument,createMarkdownBoardDocument,replaceBoardDocumentLayout,type YamlParser} from '../src/board-document';

const parseYaml=(createRequire(import.meta.url)('js-yaml') as {load:YamlParser}).load;
const start='<!-- thoughtspace-board-layout:start -->',end='<!-- thoughtspace-board-layout:end -->';
function board():Board {
 return {version:3,nodes:[
  {id:'a',kind:'text',x:0,y:0,width:160,height:80,color:'blue',text:'A\n```\n<!-- thoughtspace-board-layout:start -->'},
  {id:'b',kind:'card',x:220,y:80,width:180,height:100,color:'green',file:'材料.md'}
 ],edges:[{id:'edge',from:'a',to:'b',label:'证据',direction:'both'}],viewport:{x:-25,y:45,zoom:.8}};
}
function zone(value:unknown=board(),extras:Record<string,unknown>={},eol='\n'):string {
 return [start,'```json',JSON.stringify({format:'thoughtspace-board',version:1,...extras,board:value},null,2).replaceAll('\n',eol),'```',end].join(eol);
}
function note(value:unknown=board(),extras:Record<string,unknown>={}):string {
 return '---\nthoughtspace: board\n---\n\n# 研究\n\n正文 [[材料]]。\n\n'+zone(value,extras)+'\n\n%% 最后评论 %%\n';
}
function error(code:string,run:()=>unknown):void {
 assert.throws(run,(value:unknown)=>value instanceof BoardDocumentError&&value.code===code,code);
}

test('frontmatter discriminator requires its own scalar board property',()=>{
 assert.equal(isMarkdownBoardFrontmatter({thoughtspace:'board',tags:['project']}),true);
 for(const raw of [undefined,null,'board',[],{thoughtspace:true},{thoughtspace:['board']},{thoughtspace:'Board'},{thoughtspace:' board '},Object.create({thoughtspace:'board'})])assert.equal(isMarkdownBoardFrontmatter(raw),false);
});

for(const version of [1,2,3] as const)test(`Markdown envelope version 1 remains separate from Board version ${version}`,()=>{
 const value={...emptyBoard(),version},source=note(value),result=readBoardDocument(source,'md',parseYaml);
 assert.equal(result.format,'markdown');assert.deepEqual(result.board,value);assert.equal(result.source,source);
 assert.equal(source.slice(result.layoutStart,result.layoutEnd),result.layoutSource);assert.equal(result.layoutSource,zone(value));
});

test('BOM, CRLF, quoted YAML flag, comments and additional properties survive initial reading',()=>{
 const source='\uFEFF---\r\n# YAML comment\r\nthoughtspace: "board"\r\naliases: [研究]\r\nextra: {a: 1}\r\n---\r\n# 标题\r\n'+zone(board(),{},'\r\n')+'\r\n';
 const result=readBoardDocument(source,'.MD',parseYaml);assert.equal(result.source,source);assert.equal(result.layoutSource,zone(board(),{},'\r\n'));assert.deepEqual(result.board,board());
});

test('injected YAML parser receives only the exact frontmatter contents',()=>{
 let seen='';const source='\uFEFF---\r\nthoughtspace: board # comment\r\n---\r\n'+zone();
 readBoardDocument(source,'md',value=>{seen=value;return{thoughtspace:'board'};});assert.equal(seen,'thoughtspace: board # comment\r\n');
});

test('generated document has readable prose, native frontmatter and one explicit layout zone',()=>{
 const value=board(),source=createMarkdownBoardDocument(value,'研究 [材料]\n第二行'),result=readBoardDocument(source,'md',parseYaml);
 assert.match(source,/^---\nthoughtspace: board\n---\n/);assert.ok(source.includes('# 研究 \\[材料\\] 第二行\n'));
 assert.equal(source.split(start).length,3,'one structural marker plus literal Board text');assert.match(source,/Markdown/);assert.deepEqual(result.board,value);
 assert.equal(result.layoutSource.split('\n').filter(line=>line===start).length,1);assert.equal(result.layoutSource.split('\n').filter(line=>line===end).length,1);
});

for(const source of [note().replace('---\n',''), '\n'+note(), '# Intro\n'+note()])test('Markdown requires top frontmatter rather than a later YAML block',()=>{error('frontmatter-missing',()=>readBoardDocument(source,'md',parseYaml));});
test('missing YAML closing delimiter is rejected',()=>{error('frontmatter-invalid',()=>readBoardDocument(note().replace('board\n---','board\n'), 'md',parseYaml));});
for(const yaml of ['thoughtspace: [','thoughtspace: board\nthoughtspace: board','thoughtspace: board\nbroken: ['])test(`illegal YAML is rejected without returning a partial board: ${yaml}`,()=>{
 error('yaml-invalid',()=>readBoardDocument('---\n'+yaml+'\n---\n'+zone(),'md',parseYaml));
});
for(const yaml of ['thoughtspace: other','thoughtspace: [board]','thoughtspace: true','other: board','- board'])test(`unrelated native YAML is not a board: ${yaml}`,()=>{
 error('not-board',()=>readBoardDocument('---\n'+yaml+'\n---\n'+zone(),'md',parseYaml));
});

test('Markdown marker namespace appearing inside a JSON string is ordinary board content',()=>{
 const result=readBoardDocument(note(),'md',parseYaml);assert.equal(result.board.nodes[0].text,board().nodes[0].text);
});
for(const source of [note().replace(start,''),note().replace(end,''),note().replace(zone(),'')])test('missing start or end never falls back to parsing unrelated fenced JSON',()=>{
 error('layout-missing',()=>readBoardDocument(source,'md',parseYaml));
});
for(const append of [zone(),start,end])test('duplicate delimiters or zones are rejected',()=>{
 error('layout-duplicate',()=>readBoardDocument(note()+'\n'+append,'md',parseYaml));
});
for(const replacement of ['<!-- thoughtspace-board-layout:start-->','<!-- thoughtspace-board-layout:begin -->','<!-- ThoughtSpace-board-layout:start -->','<!-- thoughtspace-board-layout:start -- >'])test(`damaged reserved marker is rejected: ${replacement}`,()=>{
 error('layout-damaged',()=>readBoardDocument(note().replace(start,replacement),'md',parseYaml));
});
test('reversed delimiters are rejected',()=>{error('layout-damaged',()=>readBoardDocument('---\nthoughtspace: board\n---\n'+end+'\n```json\n{}\n```\n'+start,'md',parseYaml));});
for(const content of ['{}','```yaml\n{}\n```','```json\n{}','```json\n{}\n```\nextra','```json\n{}\n```\n```json\n{}\n```'])test('layout zone requires exactly one intact JSON fence',()=>{
 error('layout-damaged',()=>readBoardDocument('---\nthoughtspace: board\n---\n'+start+'\n'+content+'\n'+end,'md',parseYaml));
});
test('malformed fenced JSON is rejected',()=>{error('layout-json-invalid',()=>readBoardDocument(note().replace('"format": "thoughtspace-board"','"format":'),'md',parseYaml));});
for(const value of [null,[],{}, {format:'other',version:1,board:board()}, {format:'thoughtspace-board',version:1}])test('invalid envelope shapes are rejected',()=>{
 const source='---\nthoughtspace: board\n---\n'+start+'\n```json\n'+JSON.stringify(value)+'\n```\n'+end;
 error('layout-envelope-invalid',()=>readBoardDocument(source,'md',parseYaml));
});
for(const version of [0,2,'1',undefined,null])test(`unknown envelope version is rejected independently: ${String(version)}`,()=>{
 error('layout-version-unsupported',()=>readBoardDocument(note(board(),{version}),'md',parseYaml));
});
for(const value of [{...board(),version:4},{...board(),viewport:{x:0,y:0,zoom:0}},{...board(),nodes:[{...board().nodes[0],width:NaN}]},{...board(),edges:[{...board().edges[0],to:'missing'}]}])test('initial reads validate all untrusted Board data',()=>{
 error('board-invalid',()=>readBoardDocument(note(value),'md',parseYaml));
});
test('unknown Board, node, edge and envelope fields survive a layout save',()=>{
 const value=Object.assign(board(),{future:{x:['保留',7]}});Object.assign(value.nodes[0],{futureNode:{a:true}});Object.assign(value.edges[0],{futureEdge:'retain'});
 const source=note(value,{futureEnvelope:{keep:[1,2]},extensionTag:'future'}),baseline=readBoardDocument(source,'md',parseYaml);baseline.board.viewport.x=10;
 const saved=replaceBoardDocumentLayout(source,baseline,baseline.board,parseYaml),reopened=readBoardDocument(saved.source,'md',parseYaml);
 assert.deepEqual(reopened.board,baseline.board);assert.match(saved.layoutSource,/"futureEnvelope"/);assert.match(saved.layoutSource,/"extensionTag": "future"/);
});
test('latest external prose, YAML metadata, BOM, CRLF and comments remain byte-for-byte outside the zone',()=>{
 const prefix='\uFEFF---\r\nthoughtspace: board\r\n# YAML comment\r\nextra: original\r\n---\r\n\r\n# 原文\r\n%% 外部评论 %%\r\n',suffix='\r\n\r\n[[来源#标题]]\r\n```js\r\nconst x=1;\r\n```\r\n';
 const source=prefix+zone(board(),{},'\r\n')+suffix,baseline=readBoardDocument(source,'md',parseYaml),latestPrefix=prefix.replace('extra: original','extra: 最新 metadata').replace('# 原文','# 最新正文'),latestSuffix=suffix+'末尾正文 🚀\r\n',disk=latestPrefix+baseline.layoutSource+latestSuffix;
 const value=board();value.viewport.y=777;const saved=replaceBoardDocumentLayout(disk,baseline,value,parseYaml);
 assert.equal(saved.source.slice(0,saved.layoutStart),latestPrefix);assert.equal(saved.source.slice(saved.layoutEnd),latestSuffix);assert.ok(!saved.layoutSource.replaceAll('\r\n','').includes('\n'));
 assert.deepEqual(readBoardDocument(saved.source,'md',parseYaml).board,value);assert.equal(baseline.source,source);assert.equal(disk,latestPrefix+baseline.layoutSource+latestSuffix);
});
for(const mutate of [(source:string)=>source.replace('"x": -25','"x": -24'),(source:string)=>source.replace('"format":','  "format":'),(source:string)=>source.replace('"version": 1','"version": 2'),(source:string)=>source.replace('"format": "thoughtspace-board"','"format":')])test('any concurrent layout byte change conflicts before overwrite',()=>{
 const source=note(),baseline=readBoardDocument(source,'md',parseYaml),disk=mutate(source);error('layout-conflict',()=>replaceBoardDocumentLayout(disk,baseline,board(),parseYaml));assert.equal(baseline.source,source);
});
test('save revalidates latest native YAML and zone structure before merging',()=>{
 const source=note(),baseline=readBoardDocument(source,'md',parseYaml);
 for(const [code,disk] of [['yaml-invalid',source.replace('thoughtspace: board','thoughtspace: [')],['not-board',source.replace('thoughtspace: board','thoughtspace: note')],['layout-missing',source.replace(end,'')],['layout-duplicate',source+'\n'+zone()],['layout-damaged',source.replace('```json','```yaml')]] as const)error(code,()=>replaceBoardDocumentLayout(disk,baseline,board(),parseYaml));
});
test('consecutive saves use the returned baseline and never JSON.parse an unchanged layout',()=>{
 const first=readBoardDocument(note(),'md',parseYaml),value=board();value.viewport.x=123;const original=JSON.parse;let parses=0;
 try {
  JSON.parse=(...args:Parameters<typeof JSON.parse>)=>{parses++;return original(...args) as unknown;};
  const saved=replaceBoardDocumentLayout(first.source+'新正文\n',first,value,()=>({thoughtspace:'board'}));
  value.viewport.y=456;const again=replaceBoardDocumentLayout(saved.source.replace('# 研究','# 更新标题'),saved,value,()=>({thoughtspace:'board'}));
  assert.equal(parses,0);assert.equal(again.board,value);assert.match(again.source,/# 更新标题/);assert.match(again.source,/新正文/);
 } finally {JSON.parse=original;}
});
test('one megabyte of latest Markdown prose is kept intact when layout changes',()=>{
 const source=note(),baseline=readBoardDocument(source,'md',parseYaml),prose='正文 👀 [[来源]]\r\n'.repeat(50000),disk=source+prose;
 const saved=replaceBoardDocumentLayout(disk,baseline,board(),parseYaml);assert.equal(saved.source.slice(saved.layoutEnd),source.slice(baseline.layoutEnd)+prose);
});
test('legacy files round-trip validated unknown fields without consulting YAML',()=>{
 const value=Object.assign(board(),{futureLegacy:true}),source=JSON.stringify(value,null,1),result=readBoardDocument(source,'.thoughtspace',()=>{throw Error('unused');});
 assert.equal(result.format,'legacy');assert.equal(result.source,source);assert.equal(result.layoutSource,source);assert.equal(result.layoutStart,undefined);assert.equal(result.layoutEnd,undefined);assert.deepEqual(result.board,value);
 const saved=replaceBoardDocumentLayout(source,result,result.board,()=>{throw Error('unused');});assert.equal(saved.source,JSON.stringify(value,null,2));assert.equal(saved.layoutSource,saved.source);
});
test('legacy saves enforce exact whole-file CAS even for whitespace-only concurrent changes',()=>{
 const source=JSON.stringify(board()),baseline=readBoardDocument(source,'thoughtspace',parseYaml);
 for(const disk of [source+'\n',source.replace('材料.md','changed.md'),JSON.stringify(board(),null,2)])error('legacy-conflict',()=>replaceBoardDocumentLayout(disk,baseline,board(),parseYaml));
});
test('legacy initial reads reject invalid board JSON',()=>{for(const source of ['{','null','{}',JSON.stringify({...board(),version:99})])error('board-invalid',()=>readBoardDocument(source,'thoughtspace',parseYaml));});
test('legacy BOM is recoverable and retained when saving',()=>{
 const source='\uFEFF'+JSON.stringify(board()),baseline=readBoardDocument(source,'thoughtspace',parseYaml),saved=replaceBoardDocumentLayout(source,baseline,board(),parseYaml);assert.ok(saved.source.startsWith('\uFEFF'));assert.deepEqual(readBoardDocument(saved.source,'thoughtspace',parseYaml).board,board());
});
test('unsupported extensions never guess board format from content',()=>{for(const extension of ['json','canvas','txt',''])error('unsupported-extension',()=>readBoardDocument(note(),extension,parseYaml));});
test('serialization failure returns a typed error and leaves baseline unchanged',()=>{
 const source=note(),baseline=readBoardDocument(source,'md',parseYaml),value=board();Object.assign(value,{cycle:value});error('serialization-failed',()=>replaceBoardDocumentLayout(source,baseline,value,parseYaml));assert.equal(baseline.source,source);
});
test('saving rejects an unvalidated manually constructed baseline',()=>{
 const source=note();error('baseline-invalid',()=>replaceBoardDocumentLayout(source,{format:'markdown',board:board(),source,layoutSource:zone()},board(),parseYaml));
});
