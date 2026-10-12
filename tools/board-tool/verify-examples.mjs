import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,mkdir,copyFile,cp,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

const root=fileURLToPath(new URL('../../',import.meta.url));
const digest=data=>createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(await readFile(path.join(root,'examples/ai-board/EXAMPLES.json'),'utf8'));
const snapshot=JSON.parse(await readFile(path.join(root,'tools/board-tool/SCHEMA-SNAPSHOT.json'),'utf8'));
for(const record of snapshot.modules){
 const data=await readFile(path.join(root,'tools/board-tool',record.path));
 assert.equal(digest(data),record.deliveredSHA256,record.path);
}
const temporary=await realpath(await mkdtemp(path.join(tmpdir(),'thoughtspace-public-examples-')));
const results=[];const created=[];
try{
 const bundle=path.join(temporary,'readers.mjs');
 await build({absWorkingDir:root,stdin:{contents:
  `import {load} from 'js-yaml';
   import {readBoardDocument as publicRead,replaceBoardDocumentLayout as publicReplace} from './src/board-document';
   import {readBoardDocument as schemaRead,replaceBoardDocumentLayout as schemaReplace} from './tools/board-tool/schema/board-document';
   export {publicRead,publicReplace,schemaRead,schemaReplace,load};`,
  resolveDir:root,sourcefile:'public-example-readers.ts',loader:'ts'},
  outfile:bundle,bundle:true,platform:'node',format:'esm',target:'node22',logLevel:'silent'});
 const readers=await import(pathToFileURL(bundle).href);
 const portable=path.join(temporary,'portable');await mkdir(portable);
 const cli=path.join(portable,'thoughtspace-board.mjs');await copyFile(path.join(root,'tools/dist/thoughtspace-board.mjs'),cli);
 const vault=path.join(portable,'sample-vault');await cp(path.join(root,'examples/ai-board/sample-vault'),vault,{recursive:true});
 const before=new Map();
 function run(args,exit){
  const r=spawnSync(process.execPath,[cli,...args],{cwd:portable,encoding:'utf8'});
  assert.equal(r.status,exit,`CLI ${args.join(' ')}: ${r.stderr}\n${r.stdout}`);
  return JSON.parse(r.stdout);
 }
 for(const example of manifest.examples){
  const p=path.join(vault,example.vaultRelativePath),raw=await readFile(p);before.set(p,digest(raw));
  assert.equal(digest(raw),example.sha256,example.vaultRelativePath);
  const source=raw.toString('utf8'),extension=path.extname(p);
  for(const [read,replace] of [[readers.publicRead,readers.publicReplace],[readers.schemaRead,readers.schemaReplace]]){
   const document=read(source,extension,readers.load);
   assert.deepEqual(document.board,example.expectedNormalizedBoard,example.vaultRelativePath);
   const replacement=replace(source,document,structuredClone(document.board),readers.load);
   assert.deepEqual(read(replacement.source,extension,readers.load).board,document.board);
   if(document.format==='markdown'){
    assert.equal(replacement.source.slice(0,replacement.layoutStart),source.slice(0,document.layoutStart));
    assert.equal(replacement.source.slice(replacement.layoutEnd),source.slice(document.layoutEnd));
    assert.equal(replacement.source.startsWith('\uFEFF'),source.startsWith('\uFEFF'));
   }
  }
  const expected=example.cliValidation.overall,report=run(['validate',p,'--vault-root',vault,'--json'],expected==='format_only'?2:0);
  assert.equal(report.overall,expected);assert.equal(report.format.status,'passed');
  results.push({file:example.vaultRelativePath,publicBeta2ParserRoundtrip:true,schemaParserRoundtrip:true,cliOverall:report.overall});
 }
 for(const [kind,name] of [['ordinary','ordinary-v3.md'],['brain','brain-v3.md'],['ink','handwriting-v3.md']]){
  const example=manifest.examples.find(x=>x.vaultRelativePath===name);
  const rawInput=path.join(portable,kind+'-input.json'),output=path.join(vault,'created-'+kind+'.md');
  await writeFile(rawInput,JSON.stringify(example.expectedNormalizedBoard));
  const expected=kind==='ordinary'?'format_only':'passed';
  const report=run(['create',kind,output,'--board-json',rawInput,'--vault-root',vault,'--json'],kind==='ordinary'?2:0);
  assert.equal(report.created,true);assert.equal(report.overall,expected);
  const data=await readFile(output,'utf8');
  assert.deepEqual(readers.publicRead(data,'.md',readers.load).board,example.expectedNormalizedBoard);
  assert.deepEqual(readers.schemaRead(data,'.md',readers.load).board,example.expectedNormalizedBoard);
  const rejected=run(['create',kind,output,'--board-json',rawInput,'--vault-root',vault,'--json'],1);
  assert.equal(rejected.created,false);assert.equal(await readFile(output,'utf8'),data);
  created.push({kind,created:true,publicBeta2Parser:true,schemaParser:true,cliOverall:expected,noOverwrite:true});
 }
 const inspection=run(['inspect',path.join(vault,'handwriting-v3.md'),'--json'],0);
 assert.equal(inspection.command,'inspect');assert.equal(inspection.summary.points,5);
 for(const [p,hash] of before)assert.equal(digest(await readFile(p)),hash,'Read-only example changed');
 const passed=results.filter(x=>x.cliOverall==='passed').length,formatOnly=results.filter(x=>x.cliOverall==='format_only').length;
 assert.equal(passed,6);assert.equal(formatOnly,4);assert.equal(results.length,10);
 console.log(JSON.stringify({passed:true,formalExamples:10,cliPassed:passed,cliFormatOnly:formatOnly,
  publicBeta2ParserRoundtrips:10,schemaParserRoundtrips:10,actualCLICreateCases:3,
  noNodeModulesInPortableDirectory:true,sourceExamplesUnchanged:true,results,created,
  actualPluginUIValidationPerformedByThisVerifier:false},null,2));
}finally{await rm(temporary,{recursive:true,force:true});}
