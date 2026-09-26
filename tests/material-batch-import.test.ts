import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as materials from '../src/materials';
import {emptyBoard} from '../src/model';

const source=readFileSync('src/main.ts','utf8'),begin=source.indexOf('  async importExcerpts('),end=source.indexOf('  private branchDisclosureMenu(',begin);
assert.ok(begin>0&&end>begin);
class File {constructor(readonly path:string,readonly basename=path){} }
const deps={...materials,TFile:File,parseLinktext:(link:string)=>({path:link,subpath:''})};
const Importer=new Function(...Object.keys(deps),transformSync('class Importer {\n'+source.slice(begin,end)+'\n}\nreturn Importer;', {loader:'ts'}).code)(...Object.values(deps));
function fixture(count=200){
 const raw=Array.from({length:count},(_,i)=>`Paragraph ${i} [[Target]] and [[Target]]`).join('\n\n'),source=new File('Source.md'),target=new File('Target.md'),fragments=materials.extractFragments(raw).fragments;
 const links=raw.split('\n').flatMap((line,row)=>[...line.matchAll(/\[\[Target\]\]/g)].map(m=>({link:'Target',original:m[0],position:{start:{line:row,col:m.index!},end:{line:row,col:m.index!+m[0].length}}})));let current=raw,placed=0,captured:string[]=[];
 const owner={board:emptyBoard()},view=new Importer();view.session=owner;view.requireOwner=(candidate:unknown)=>{if(candidate!==owner)throw Error('Owner changed');return owner;};view.materialPoint=()=>({x:0,y:0});
 view.plugin={settings:{cardFolder:'Cards',defaultCardWidth:300}};view.app={vault:{getAbstractFileByPath:(path:string)=>path===source.path?source:undefined,read:async()=>current},metadataCache:{getFileCache:()=>({links}),getFirstLinkpathDest:()=>target},fileManager:{generateMarkdownLink:(file:File,destination:string)=>`[[${file.path}|from ${destination}]]`}};
 view.placeExcerptTexts=async(bodies:string[])=>{placed++;captured=bodies;return{ids:bodies.map((_,i)=>'n'+i),files:[],boardPath:'Board.thoughtspace'};};
 return{raw,source,fragments,view,setCurrent:(value:string)=>{current=value;},get placed(){return placed;},get captured(){return captured;}};
}

test('native batch excerpt import prepares the original source once for all fragments',async t=>{
 const f=fixture(),split=String.prototype.split;let sourceSplits=0;
 const probe=t.mock.method(String.prototype,'split',function(this:string,...args:Parameters<typeof split>){if(String(this)===f.raw&&(args[0] as unknown)==='\n')sourceSplits++;return Reflect.apply(split,this,args);});
 let result;try{result=await f.view.importExcerpts(f.source,f.raw,f.fragments,false,false,f.view.session,{asText:true});}finally{probe.mock.restore();}
 assert.equal(sourceSplits,1);assert.equal(result.ids.length,200);assert.equal(f.placed,1);assert.equal(f.captured.length,200);
 assert.ok(f.captured.every(body=>body.includes('[[Target.md|from Cards/摘录.md]]')&&body.includes('来源：[[Source.md]]')));assert.ok(f.captured[199].startsWith('Paragraph 199'));assert.equal(f.view.session.board.nodes.length,0);
});

test('batch import rejects changed sources and fragments before placing any excerpt',async()=>{
 const changed=fixture(2);changed.setCurrent('Concurrent edit');await assert.rejects(changed.view.importExcerpts(changed.source,changed.raw,changed.fragments,false,false,changed.view.session,{asText:true}),/原文已变化/);assert.equal(changed.placed,0);
 const stale=fixture(2);stale.fragments[1].body='Changed fragment';await assert.rejects(stale.view.importExcerpts(stale.source,stale.raw,stale.fragments,false,false,stale.view.session,{asText:true}),/片段已变化/);assert.equal(stale.placed,0);
});
