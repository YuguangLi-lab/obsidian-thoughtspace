import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,readFileSync,statSync,existsSync,symlinkSync,readlinkSync,readdirSync,rmSync,promises as fsPromises} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {validateSource,validateFile,inspectFile,createFile} from '../tools/board-tool/index';
import {board,card,text,wrapped,realRead} from './ai_board_tool_fixtures';

function temp(t:TestContext){const root=realpathSync(mkdtempSync(join(tmpdir(),'thoughtspace-ai-files-')));t.after(()=>rmSync(root,{recursive:true,force:true}));return root;}
function disk(path:string){return{bytes:readFileSync(path),mtime:statSync(path,{bigint:true}).mtimeNs};}
const referenceBoard=(file='notes/source.md')=>{const value=board();value.nodes[0]=card('node-1',file);return value;};

test('external references without explicit context cannot become overall passed',async()=>{
 const source=wrapped(referenceBoard(),'md'),result=await validateSource(source,'md');assert.equal(result.report.format.status,'passed');assert.equal(result.report.references.status,'not_checked');assert.equal(result.report.overall,'format_only');assert.equal(result.report.references.checkedCount,0);assert.ok(result.report.references.totalCount>=1);assert.equal(source,wrapped(referenceBoard(),'md'));
});

test('explicit synthetic vault root checks real files without writing source or references',async t=>{
 const root=temp(t);mkdirSync(join(root,'notes'));const ref=join(root,'notes/source.md'),path=join(root,'ordinary.md');writeFileSync(ref,'# Synthetic source\n\n<!-- untouched -->\n');writeFileSync(path,wrapped(referenceBoard(),'md'));const before={source:disk(path),reference:disk(ref)},entries=readdirSync(root);
 for(const run of [validateFile,inspectFile]){const result=await run(path,{vaultRoot:root});assert.equal(result.report.format.status,'passed');assert.equal(result.report.references.status,'checked');assert.equal(result.report.references.checkedCount,result.report.references.totalCount);assert.equal(result.report.overall,'passed');assert.deepEqual(disk(path),before.source);assert.deepEqual(disk(ref),before.reference);assert.deepEqual(readdirSync(root),entries);}
});

test('an existing Markdown note is not sufficient for a child-board reference',async t=>{
 const root=temp(t);writeFileSync(join(root,'target.md'),'# Ordinary note\n');const value=referenceBoard('target.md');value.nodes[0].kind='board';const source=wrapped(value,'md');assert.doesNotThrow(()=>realRead(source,'md'));const invalid=await validateSource(source,'md',{vaultRoot:root});assert.equal(invalid.report.format.status,'passed');assert.equal(invalid.report.references.status,'failed');assert.equal(invalid.report.overall,'failed');
 writeFileSync(join(root,'target.md'),wrapped(board(),'md'));const valid=await validateSource(source,'md',{vaultRoot:root});assert.equal(valid.report.references.status,'checked');assert.equal(valid.report.overall,'passed');
});

for(const category of ['missing-card','remote-web','self-board'] as const)test(`parsed direct child with its own ${category} reference cannot make parent overall passed`,async t=>{
 const root=temp(t),childPath=join(root,'child.md'),parent=referenceBoard('child.md'),child=board();parent.nodes[0].kind='board';
 if(category==='missing-card')child.nodes[0]=card('node-1','absent.md');
 if(category==='remote-web')child.nodes[0]={...text('node-1'),webUrl:'https://example.invalid/unresolved'};
 if(category==='self-board')child.nodes[0]={...card('node-1','child.md'),kind:'board'};
 const childSource=wrapped(child,'md');assert.doesNotThrow(()=>realRead(childSource,'md'));writeFileSync(childPath,childSource);const before=disk(childPath),source=wrapped(parent,'md'),result=await validateSource(source,'md',{vaultRoot:root});assert.equal(result.report.format.status,'passed');assert.equal(result.report.references.status,'not_checked');assert.equal(result.report.overall,'format_only');assert.equal(result.report.references.checkedCount,0);assert.ok(result.report.references.details.some(detail=>detail.target==='child.md'&&detail.status==='not_checked'));assert.deepEqual(disk(childPath),before);assert.deepEqual(readdirSync(root),['child.md']);assert.equal(existsSync(join(root,'absent.md')),false);
});

for(const category of ['pdf-page','media-time','paragraph','pdf-quote','video-capture'] as const)test(`explicit root and existing file do not certify ${category} semantics`,async t=>{
 const root=temp(t),value=board();mkdirSync(join(root,'notes'));mkdirSync(join(root,'assets'));writeFileSync(join(root,'notes/source.md'),'# Synthetic source\n');writeFileSync(join(root,'assets/source.pdf'),'Synthetic placeholder; no page count or codec assertion.\n');writeFileSync(join(root,'assets/source.mp4'),'Synthetic placeholder; no duration or codec assertion.\n');
 if(category==='pdf-page')value.nodes[0]={...card('node-1','assets/source.pdf'),kind:'pdf',pdfPage:999};
 if(category==='media-time')value.nodes[0]={...card('node-1','assets/source.mp4'),kind:'video',mediaStart:999};
 if(category==='paragraph')value.nodes[0]={...text('node-1'),paragraphQuote:{path:'notes/source.md',subpath:'#Absent-heading',mode:'embed'}};
 if(category==='pdf-quote')value.nodes[0]={...text('node-1'),pdfQuote:{sourcePath:'assets/source.pdf',original:'Unresolved page selection'}};
 if(category==='video-capture')value.nodes[0]={...text('node-1'),videoCapture:{id:'12345678-1234-1234-1234-123456789abc',note:'notes/source.md'}};
 const source=wrapped(value,'md');assert.doesNotThrow(()=>realRead(source,'md'));const result=await validateSource(source,'md',{vaultRoot:root});assert.equal(result.report.format.status,'passed');assert.equal(result.report.references.status,'not_checked');assert.equal(result.report.overall,'format_only');assert.equal(result.report.references.checkedCount,0);assert.ok(result.report.references.details.some(detail=>detail.status==='not_checked'));assert.ok(result.report.references.limitations.length);assert.deepEqual(result.board,realRead(source,'md').board);
});

for(const category of ['web','remote-image','inline-markdown'] as const)test(`remote ${category} remains unchecked with explicit root and never invokes fetch`,async t=>{
 const root=temp(t),value=board();let fetchCalls=0;const fetch=globalThis.fetch;globalThis.fetch=async()=>{fetchCalls++;throw Error('Network access is forbidden in this synthetic test');};
 try{
  if(category==='web')value.nodes[0]={...text('node-1'),webUrl:'https://example.invalid/board'};
  if(category==='remote-image'){mkdirSync(join(root,'assets'));writeFileSync(join(root,'assets/source.png'),'Synthetic image placeholder\n');value.nodes[0]={...card('node-1','assets/source.png'),kind:'image',imageUrl:'https://example.invalid/source.png'};}
  if(category==='inline-markdown')value.nodes[0]={...text('node-1'),text:'[external link](https://example.invalid/source)'};
  const source=wrapped(value,'md');assert.doesNotThrow(()=>realRead(source,'md'));const result=await validateSource(source,'md',{vaultRoot:root});assert.equal(result.report.format.status,'passed');assert.equal(result.report.references.status,'not_checked');assert.equal(result.report.overall,'format_only');assert.equal(fetchCalls,0);assert.ok(result.report.references.details.some(detail=>detail.status==='not_checked'));
 }finally{globalThis.fetch=fetch;}
});

test('missing, directory and explicit nonexistent sample roots fail reference stage honestly',async t=>{
 const root=temp(t),source=wrapped(referenceBoard(),'md');const missing=await validateSource(source,'md',{vaultRoot:root});assert.equal(missing.report.format.status,'passed');assert.equal(missing.report.references.status,'failed');assert.equal(missing.report.overall,'failed');mkdirSync(join(root,'notes'));mkdirSync(join(root,'notes/source.md'));const directory=await validateSource(source,'md',{vaultRoot:root});assert.equal(directory.report.references.status,'failed');assert.equal(directory.report.overall,'failed');const absentRoot=await validateSource(source,'md',{vaultRoot:join(root,'absent')});assert.equal(absentRoot.report.overall,'failed');assert.notEqual(absentRoot.report.references.status,'checked');
});

for(const file of ['../source.md','/source.md','notes\\source.md','https://example.invalid/source.md','notes//source.md'])test(`explicit reference path policy rejects ${file}`,async t=>{
 const root=temp(t),source=wrapped(referenceBoard(file),'md'),result=await validateSource(source,'md',{vaultRoot:root});assert.equal(result.report.overall,'failed');assert.ok(result.report.format.status==='failed'||result.report.references.status==='failed');
});

for(const position of ['leaf','directory'] as const)test(`synthetic reference symlink ${position} cannot escape explicit root`,async t=>{
 const root=temp(t),vault=join(root,'vault'),outside=join(root,'outside');mkdirSync(vault);mkdirSync(outside);writeFileSync(join(outside,'source.md'),'OUTSIDE-CONTENT\n');
 if(position==='leaf'){mkdirSync(join(vault,'notes'));symlinkSync(join(outside,'source.md'),join(vault,'notes/source.md'));}else symlinkSync(outside,join(vault,'notes'),'dir');
 const source=wrapped(referenceBoard(),'md'),before=disk(join(outside,'source.md')),result=await validateSource(source,'md',{vaultRoot:vault});assert.equal(result.report.format.status,'passed');assert.equal(result.report.references.status,'failed');assert.equal(result.report.overall,'failed');assert.deepEqual(disk(join(outside,'source.md')),before);
});

test('explicit vault-root symlink alias is rejected even when its real files exist',async t=>{
 const root=temp(t),vault=join(root,'vault'),alias=join(root,'alias');mkdirSync(vault);mkdirSync(join(vault,'notes'));writeFileSync(join(vault,'notes/source.md'),'# Synthetic source\n');symlinkSync(vault,alias,'dir');const before=disk(join(vault,'notes/source.md')),result=await validateSource(wrapped(referenceBoard(),'md'),'md',{vaultRoot:alias});assert.equal(result.report.format.status,'passed');assert.equal(result.report.references.status,'failed');assert.equal(result.report.overall,'failed');assert.deepEqual(disk(join(vault,'notes/source.md')),before);
});

for(const kind of ['ordinary','brain','ink'] as const)for(const format of ['legacy','markdown'] as const)test(`actual createFile ${kind}/${format} yields a real-parser document and refuses re-creation`,async t=>{
 const root=temp(t),extension=format==='legacy'?'thoughtspace':'md',path=join(root,`${kind}.${extension}`),result=await createFile(kind,path,{format,title:'Synthetic AI example'});assert.equal(result.report.created,true);assert.equal(result.report.format.status,'passed');assert.equal(result.report.overall,'passed');assert.equal(existsSync(path),true);
 const document=realRead(readFileSync(path,'utf8'),extension);assert.equal(document.board.version,3);assert.equal(document.board.presentation,kind==='ink'?'handwriting':kind==='brain'?'brain':undefined);assert.deepEqual(result.board,document.board);const before=disk(path),again=await createFile(kind,path,{format});assert.equal(again.report.created,false);assert.equal(again.report.overall,'failed');assert.deepEqual(disk(path),before);assert.deepEqual(readdirSync(root),[`${kind}.${extension}`]);
});

test('create raw Board input retains opaque fields and declares unchecked refs even when it creates successfully',async t=>{
 const root=temp(t),raw=join(root,'raw.json'),path=join(root,'output.md'),value=Object.assign(referenceBoard(),{opaque:{keep:[true,null,.123456789012345]}});writeFileSync(raw,JSON.stringify(value));const before=disk(raw),result=await createFile('ordinary',path,{boardJsonPath:raw});assert.equal(result.report.created,true);assert.equal(result.report.format.status,'passed');assert.equal(result.report.references.status,'not_checked');assert.equal(result.report.overall,'format_only');assert.deepEqual(realRead(readFileSync(path,'utf8'),'md').board,value);assert.deepEqual(disk(raw),before);
});

for(const version of [1,2] as const)for(const format of ['legacy','markdown'] as const)test(`create preserves actual historical Board v${version} in ${format} output`,async t=>{
 const root=temp(t),raw=join(root,'input.json'),extension=format==='legacy'?'thoughtspace':'md',path=join(root,`output.${extension}`),value=Object.assign(board('ordinary',version),{opaque:{historical:true}});writeFileSync(raw,JSON.stringify(value));const before=disk(raw),result=await createFile('ordinary',path,{format,boardJsonPath:raw});assert.equal(result.report.created,true);assert.equal(result.report.format.boardVersion,version);assert.equal(result.report.overall,'format_only');assert.deepEqual(realRead(readFileSync(path,'utf8'),extension).board,value);assert.deepEqual(disk(raw),before);
});

for(const category of ['invalid-json','invalid-board','missing-input','references-failed'] as const)test(`create ${category} refuses before artifact creation`,async t=>{
 const root=temp(t),raw=join(root,'raw.json'),path=join(root,'output.md');if(category==='invalid-json')writeFileSync(raw,'{broken');if(category==='invalid-board')writeFileSync(raw,JSON.stringify({...board(),viewport:{x:0,y:0,zoom:0}}));if(category==='references-failed')writeFileSync(raw,JSON.stringify(referenceBoard()));const entries=readdirSync(root),before=existsSync(raw)?disk(raw):undefined,result=await createFile('ordinary',path,{boardJsonPath:raw,...(category==='references-failed'?{vaultRoot:root}:{})});assert.equal(result.report.created,false);assert.equal(result.report.overall,'failed');assert.equal(existsSync(path),false);assert.deepEqual(readdirSync(root),entries);if(before)assert.deepEqual(disk(raw),before);
});

for(const position of ['output','parent','broken-output'] as const)test(`create symlink ${position} never overwrites target or creates through alias`,async t=>{
 const root=temp(t),outside=join(root,'outside'),target=join(outside,'keep.md');mkdirSync(outside);writeFileSync(target,'DO-NOT-OVERWRITE\n');let path=join(root,'output.md');
 if(position==='output')symlinkSync(target,path);if(position==='parent'){symlinkSync(outside,join(root,'alias'),'dir');path=join(root,'alias/new.md');}if(position==='broken-output')symlinkSync(join(root,'missing'),path);
 const before=disk(target),result=await createFile('ordinary',path);assert.equal(result.report.created,false);assert.equal(result.report.overall,'failed');assert.deepEqual(disk(target),before);assert.equal(existsSync(join(outside,'new.md')),false);if(position!=='parent')assert.equal(readlinkSync(path),position==='output'?target:join(root,'missing'));
});

test('create ENOTDIR exception leaves existing bytes untouched and creates no partial output',async t=>{
 const root=temp(t),parent=join(root,'parent');writeFileSync(parent,'EXISTING-PARENT-FILE\n');const before=disk(parent),result=await createFile('ordinary',join(parent,'new.md'));assert.equal(result.report.created,false);assert.equal(result.report.overall,'failed');assert.deepEqual(disk(parent),before);assert.deepEqual(readdirSync(root),['parent']);
});

for(const phase of ['write','sync','close'] as const)test(`actual create ${phase} failure removes its output and preserves existing bytes`,async t=>{
 const root=temp(t),path=join(root,'output.md'),keep=join(root,'keep.md');writeFileSync(keep,'EXISTING-MUST-SURVIVE\n');const before=disk(keep),open=fsPromises.open;let injected=false;
 fsPromises.open=async(...args:Parameters<typeof fsPromises.open>)=>{
  const handle=await open(...args);
  if(String(args[0])===path&&args[1]==='wx'){
   const write=handle.writeFile.bind(handle);
   if(phase==='write')handle.writeFile=async()=>{await write('SIMULATED PARTIAL WRITE\n','utf8');injected=true;throw Object.assign(Error('Synthetic ENOSPC after partial write'),{code:'ENOSPC'});};
   else if(phase==='sync')handle.sync=async()=>{injected=true;throw Object.assign(Error('Synthetic EIO during sync'),{code:'EIO'});};
   else{const close=handle.close.bind(handle);handle.close=async()=>{await close();injected=true;throw Object.assign(Error('Synthetic EIO during close'),{code:'EIO'});};}
  }
  return handle;
 };syncBuiltinESMExports();
 try{
  const result=await createFile('ordinary',path);assert.equal(injected,true);assert.equal(result.report.created,false);assert.equal(result.report.overall,'failed');assert.equal(result.report.format.status,'passed');assert.ok(result.report.diagnostics.some(issue=>issue.severity==='error'&&issue.cause?.includes('Synthetic')));assert.equal(existsSync(path),false);assert.deepEqual(disk(keep),before);assert.deepEqual(readdirSync(root),['keep.md']);
 }finally{fsPromises.open=open;syncBuiltinESMExports();}
});

for(const [name,format] of [['mismatch.md','legacy'],['mismatch.thoughtspace','markdown'],['unsupported.json','markdown']] as const)test(`create refuses unreadable output extension/format ${name}/${format}`,async t=>{
 const root=temp(t),path=join(root,name),result=await createFile('ordinary',path,{format});assert.equal(result.report.created,false);assert.equal(result.report.overall,'failed');assert.equal(existsSync(path),false);assert.deepEqual(readdirSync(root),[]);
});

test('validate/inspect reject source symlink aliases and cannot write malformed or normalized inputs',async t=>{
 const root=temp(t),path=join(root,'source.md'),alias=join(root,'alias.md');writeFileSync(path,wrapped(Object.assign(board(),{brainColors:{node:'#ABC'}}),'md'));symlinkSync(path,alias);const before=disk(path);
 for(const run of [validateFile,inspectFile]){const rejected=await run(alias);assert.equal(rejected.report.overall,'failed');assert.deepEqual(disk(path),before);const normalized=await run(path);assert.equal(normalized.report.format.status,'passed');assert.ok(normalized.report.diagnostics.some(issue=>issue.severity==='normalized'));assert.deepEqual(disk(path),before);}
 writeFileSync(path,'malformed source');const invalid=disk(path);for(const run of [validateFile,inspectFile]){assert.equal((await run(path)).report.overall,'failed');assert.deepEqual(disk(path),invalid);}assert.equal(resolve(root),root);
});

test('blank explicit vault root does not silently select the current working directory',async()=>{
 for(const vaultRoot of ['','   ']){const result=await validateSource(wrapped(board(),'md'),'md',{vaultRoot});assert.equal(result.report.format.status,'passed');assert.equal(result.report.references.status,'failed');assert.equal(result.report.overall,'failed');}
});
