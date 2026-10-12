import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,readFileSync,existsSync,statSync,readdirSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {board,card,wrapped,realRead} from './ai_board_tool_fixtures';

const cli=fileURLToPath(new URL('../tools/dist/thoughtspace-board.mjs',import.meta.url));
function temp(t:TestContext){const root=realpathSync(mkdtempSync(resolve(tmpdir(),'thoughtspace-ai-cli-')));t.after(()=>rmSync(root,{recursive:true,force:true}));return root;}
function invoke(...args:string[]){const run=spawnSync(process.execPath,[cli,...args,'--json'],{encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024});assert.equal(run.error,undefined);assert.equal(run.signal,null);assert.ok(run.stdout.trim(),run.stderr);return{status:run.status,report:JSON.parse(run.stdout) as any,stderr:run.stderr};}
function disk(path:string){return{bytes:readFileSync(path),mtime:statSync(path,{bigint:true}).mtimeNs};}

for(const command of ['validate','inspect'])test(`actual CLI ${command} JSON result is read-only and uses real parser`,t=>{
 const root=temp(t),path=resolve(root,'valid.md');writeFileSync(path,wrapped(board(),'md'));const before=disk(path),entries=readdirSync(root),result=invoke(command,path);assert.equal(result.status,0);assert.equal(result.report.command,command);assert.equal(result.report.format.status,'passed');assert.equal(result.report.overall,'passed');assert.equal(result.report.references.status,'not_applicable');assert.deepEqual(disk(path),before);assert.deepEqual(readdirSync(root),entries);assert.deepEqual(realRead(readFileSync(path,'utf8'),'md').board,board());
});

test('actual CLI unchecked refs exit2 is distinct from explicit-root checked success and failure',t=>{
 const root=temp(t),path=resolve(root,'refs.md'),value=board();value.nodes[0]=card('node-1');writeFileSync(path,wrapped(value,'md'));const before=disk(path),unchecked=invoke('validate',path);assert.equal(unchecked.status,2);assert.equal(unchecked.report.format.status,'passed');assert.equal(unchecked.report.overall,'format_only');assert.equal(unchecked.report.references.status,'not_checked');
 const missing=invoke('validate',path,'--vault-root',root);assert.equal(missing.status,1);assert.equal(missing.report.references.status,'failed');mkdirSync(resolve(root,'notes'));writeFileSync(resolve(root,'notes/source.md'),'# Synthetic source\n');const checked=invoke('validate',path,'--vault-root',root);assert.equal(checked.status,0);assert.equal(checked.report.references.status,'checked');assert.equal(checked.report.overall,'passed');assert.deepEqual(disk(path),before);
});

test('actual CLI invalid pressure gives original Markdown pointer and never writes input',t=>{
 const root=temp(t),path=resolve(root,'invalid.md'),value=board('handwriting');value.ink!.strokes[0].points[0][2]=2;writeFileSync(path,wrapped(value,'md'));const before=disk(path),result=invoke('validate',path);assert.equal(result.status,1);assert.equal(result.report.format.status,'failed');assert.ok(result.report.diagnostics.some((issue:any)=>issue.pointer==='/board/ink/strokes/0/points/0/2'));assert.deepEqual(disk(path),before);assert.deepEqual(readdirSync(root),['invalid.md']);
});

for(const kind of ['ordinary','brain','ink'])test(`actual CLI creates ${kind} exclusively, then rejects existing path`,t=>{
 const root=temp(t),path=resolve(root,`${kind}.md`),created=invoke('create',kind,path,'--title','Synthetic draft');assert.equal(created.status,0);assert.equal(created.report.created,true);assert.equal(created.report.format.status,'passed');assert.equal(existsSync(path),true);const actual=realRead(readFileSync(path,'utf8'),'md');assert.equal(actual.board.version,3);assert.equal(actual.board.presentation,kind==='brain'?'brain':kind==='ink'?'handwriting':undefined);const before=disk(path),again=invoke('create',kind,path);assert.equal(again.status,1);assert.equal(again.report.created,false);assert.deepEqual(disk(path),before);assert.deepEqual(readdirSync(root),[`${kind}.md`]);
});

test('actual CLI legacy --board-json preserves opaque data with no bulk editing',t=>{
 const root=temp(t),raw=resolve(root,'input.json'),output=resolve(root,'output.thoughtspace'),value=Object.assign(board(),{opaque:{keep:[true,null,.123456789012345]}});writeFileSync(raw,JSON.stringify(value));const before=disk(raw),created=invoke('create','ordinary',output,'--format','legacy','--board-json',raw);assert.equal(created.status,0);assert.equal(created.report.created,true);assert.deepEqual(realRead(readFileSync(output,'utf8'),'thoughtspace').board,value);assert.deepEqual(disk(raw),before);assert.deepEqual(readdirSync(root).sort(),['input.json','output.thoughtspace']);
});

test('actual CLI create with unchecked references succeeds exclusively but exits2 rather than certifying references',t=>{
 const root=temp(t),raw=resolve(root,'input.json'),output=resolve(root,'output.md'),value=board();value.nodes[0]=card('node-1');writeFileSync(raw,JSON.stringify(value));const before=disk(raw),created=invoke('create','ordinary',output,'--board-json',raw);assert.equal(created.status,2);assert.equal(created.report.created,true);assert.equal(created.report.format.status,'passed');assert.equal(created.report.references.status,'not_checked');assert.equal(created.report.overall,'format_only');assert.deepEqual(realRead(readFileSync(output,'utf8'),'md').board,value);assert.deepEqual(disk(raw),before);assert.deepEqual(readdirSync(root).sort(),['input.json','output.md']);
});

test('actual CLI invalid --board-json and symlink-parent output leave no new artifact',t=>{
 const root=temp(t),raw=resolve(root,'invalid.json'),output=resolve(root,'output.md');writeFileSync(raw,JSON.stringify({...board(),version:4}));const before=disk(raw),invalid=invoke('create','ordinary',output,'--board-json',raw);assert.equal(invalid.status,1);assert.equal(invalid.report.created,false);assert.equal(existsSync(output),false);assert.deepEqual(disk(raw),before);
 const outside=resolve(root,'outside');mkdirSync(outside);symlinkSync(outside,resolve(root,'alias'),'dir');const alias=invoke('create','ordinary',resolve(root,'alias/new.md'));assert.equal(alias.status,1);assert.equal(alias.report.created,false);assert.deepEqual(readdirSync(outside),[]);
});

test('actual CLI unsupported command cannot become a write action',t=>{
 const root=temp(t),output=resolve(root,'new.md'),result=invoke('patch',output);assert.equal(result.status,64);assert.equal(result.report.overall,'failed');assert.equal(existsSync(output),false);assert.deepEqual(readdirSync(root),[]);
});

for(const option of ['short-unknown','long-unknown','duplicate-json'] as const)test(`actual CLI ${option} usage error cannot read/write an output`,t=>{
 const root=temp(t),output=resolve(root,'new.md'),args=option==='short-unknown'?['validate',output,'-x']:option==='long-unknown'?['create','ordinary',output,'--unknown','value']:['create','ordinary',output,'--json'];const result=invoke(...args);assert.equal(result.status,64);assert.equal(result.report.overall,'failed');assert.equal(existsSync(output),false);assert.deepEqual(readdirSync(root),[]);
});
