import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as materials from '../src/materials';
import {emptyBoard} from '../src/model';
import {applyDefaultCardStyle} from '../src/card-style';

const source=readFileSync('src/main.ts','utf8'),begin=source.indexOf('  async importExcerpts('),end=source.indexOf('  private branchDisclosureMenu(',begin);
assert.ok(begin>0&&end>begin);
class File {stat={mtime:1,size:100};constructor(public path:string,readonly basename=path){} }
let nextId=0;
const deps={...materials,applyDefaultCardStyle,uid:()=>'excerpt-'+(++nextId),TFile:File,parseLinktext:(link:string)=>({path:link,subpath:''})};
const Importer=new Function(...Object.keys(deps),transformSync('class Importer {\n'+source.slice(begin,end)+'\n}\nreturn Importer;', {loader:'ts'}).code)(...Object.values(deps));
function fixture(count=200){
 const raw=Array.from({length:count},(_,i)=>`Paragraph ${i} [[Target]] and [[Target]]`).join('\n\n'),source=new File('Source.md'),target=new File('Target.md'),fragments=materials.extractFragments(raw).fragments;let referenced:File|undefined=source;
 const links=raw.split('\n').flatMap((line,row)=>[...line.matchAll(/\[\[Target\]\]/g)].map(m=>({link:'Target',original:m[0],position:{start:{line:row,col:m.index!},end:{line:row,col:m.index!+m[0].length}}})));let current=raw,placed=0,evidence=0,captured:string[]=[];
 const owner={board:emptyBoard()},view=new Importer();view.session=owner;view.requireOwner=(candidate:unknown)=>{if(candidate!==owner)throw Error('Owner changed');return owner;};view.materialPoint=()=>({x:0,y:0});
 view.plugin={settings:{cardFolder:'Cards',defaultCardWidth:300}};view.app={vault:{getAbstractFileByPath:(path:string)=>path===source.path?referenced:undefined,read:async()=>current},metadataCache:{getFileCache:()=>({links}),getFirstLinkpathDest:()=>target},fileManager:{generateMarkdownLink:(file:File,destination:string)=>`[[${file.path}|from ${destination}]]`}};
 view.placeExcerptTexts=async(bodies:string[])=>{placed++;captured=bodies;return{ids:bodies.map((_,i)=>'n'+i),files:[],boardPath:'Board.thoughtspace'};};
 view.appendCardEvidence=async()=>{evidence++;return{ids:['note'],files:['Note.md'],boardPath:'Board.thoughtspace'};};
 return{raw,source,fragments,view,setCurrent:(value:string)=>{current=value;},replaceSource:(next:File|undefined)=>{referenced=next;},get placed(){return placed;},get evidence(){return evidence;},get captured(){return captured;}};
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

for(const target of ['text','evidence'] as const)for(const change of ['removed','replaced','renamed'] as const)test(`${target} excerpt import rejects a ${change} source while its read is pending`,async()=>{
 const f=fixture(2);let resolve!:(raw:string)=>void;
 f.view.app.vault.read=()=>new Promise<string>(r=>resolve=r);
 const options=target==='text'?{asText:true}:{position:{x:0,y:0,targetId:'note'}};
 const importing=f.view.importExcerpts(f.source,f.raw,f.fragments,false,false,f.view.session,options);
 if(change==='renamed')f.source.path='Renamed.md';else f.replaceSource(change==='removed'?undefined:new File(f.source.path));resolve(f.raw);
 await assert.rejects(importing,/原文.*变化|来源.*变化/);assert.equal(f.placed,0);assert.equal(f.evidence,0);assert.equal(f.captured.length,0);
});

test('evidence excerpt import keeps the valid-source path working',async()=>{
 const f=fixture(2);const result=await f.view.importExcerpts(f.source,f.raw,f.fragments,false,false,f.view.session,{position:{x:0,y:0,targetId:'note'}});
 assert.equal(f.evidence,1);assert.equal(f.placed,0);assert.deepEqual(result.ids,['note']);
});

function noteImportFixture(){
 const f=fixture(2),created:File[]=[];
 f.view.session.file=new File('Board.thoughtspace');
 f.view.session.change=(apply:(board:ReturnType<typeof emptyBoard>)=>void)=>apply(f.view.session.board);
 f.view.session.flush=async()=>{};
 f.view.plugin.createUnique=async()=>{const file=new File('Cards/Excerpt-'+created.length+'.md');created.push(file);return file;};
 f.view.selected=new Set();f.view.updateSelection=()=>{};f.view.renderBoard=()=>{};
 return{...f,created};
}

for(const change of ['removed','replaced','renamed'] as const)test(change+' source during the final note import read prevents node commits',async()=>{
 const f=noteImportFixture();let reads=0,resolve:((raw:string)=>void)|undefined;
 f.view.app.vault.read=()=>{reads++;return reads===1?Promise.resolve(f.raw):new Promise<string>(r=>resolve=r);};
 const importing=f.view.importExcerpts(f.source,f.raw,f.fragments,false,false,f.view.session,{position:{x:0,y:0},focus:false});
 for(let i=0;!resolve&&i<8;i++)await Promise.resolve();assert.ok(resolve);assert.equal(reads,2);
 if(change==='renamed')f.source.path='Renamed.md';else f.replaceSource(change==='removed'?undefined:new File(f.source.path));resolve(f.raw);
 await assert.rejects(importing,/原文.*变化/);
 assert.equal(f.view.session.board.nodes.length,0);assert.equal(f.created.length,2,'created notes stay available for recovery');
});

test('valid note excerpt import creates its expected nodes and references',async()=>{
 const f=noteImportFixture();const result=await f.view.importExcerpts(f.source,f.raw,f.fragments,false,false,f.view.session,{position:{x:0,y:0},focus:false});
 assert.equal(f.created.length,2);assert.equal(f.view.session.board.nodes.length,2);assert.equal(result.ids.length,2);
 assert.deepEqual(result.files,f.created.map(file=>file.path));
 assert.ok(f.view.session.board.nodes.every((node:{kind:string;file:string})=>node.kind==='card'&&result.files.includes(node.file)));
});
