import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {atomicWriteProjectColors} from '../src/folio-project-colors-storage';
import {ProjectColorSaveQueue} from '../src/folio-project-colors';

test('registry replacement writes complete JSON and leaves no temporary files',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'folio-registry-'));
  try{
    const file=join(dir,'folio-project-colors.json');
    await writeFile(file,'{"old":true}');
    const queue=new ProjectColorSaveQueue();
    await Promise.all(Array.from({length:12},(_,revision)=>queue.run(()=>atomicWriteProjectColors(file,JSON.stringify({revision})))));
    assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{revision:11});
    assert.deepEqual(await readdir(dir),['folio-project-colors.json']);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('a failed staged write preserves the previous registry bytes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'folio-registry-'));
  try{
    const file=join(dir,'folio-project-colors.json'),original='{"version":1,"nextId":2,"projects":[]}';
    await writeFile(file,original);
    await assert.rejects(atomicWriteProjectColors(file,undefined as unknown as string));
    assert.equal(await readFile(file,'utf8'),original);
    assert.deepEqual(await readdir(dir),['folio-project-colors.json']);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('a failed rename leaves its existing destination intact and cleans the staged file',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'folio-registry-'));
  try{
    const file=join(dir,'folio-project-colors.json');
    await mkdir(file);await writeFile(join(file,'marker'),'untouched');
    await assert.rejects(atomicWriteProjectColors(file,'{"version":1}'));
    assert.equal(await readFile(join(file,'marker'),'utf8'),'untouched');
    assert.deepEqual(await readdir(dir),['folio-project-colors.json']);
  }finally{await rm(dir,{recursive:true,force:true});}
});
