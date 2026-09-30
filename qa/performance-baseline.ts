/** Algorithm baseline only: production Session + model, real temporary-file I/O.
 * No renderer, Obsidian vault/index/events, PDF decoder, input or compositor. */
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {readFile, writeFile} from 'node:fs/promises';
import {cpus, totalmem, platform, release} from 'node:os';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import {reflowReadingContent} from '../src/expansion-reading-state';
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class Session {'),end=source.indexOf('\nexport default class ThoughtSpace',start);
const deps={...model,...mindmap,reflowReadingContent,Notice:class{},EXT:'thoughtspace',report:(e:unknown)=>{throw e;}};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const out='dist/performance-baseline';mkdirSync(out,{recursive:true});
const prose=('# Long Markdown\n\n'+('Paragraph with **bold**, [local link](note.md), 中文笔记 and inline `code`.\n'.repeat(80))+'\n| A | B |\n|---|---|\n| one | two |\n').repeat(2);
function fixture(count:number):model.Board{return{version:3,viewport:{x:60,y:60,zoom:1},edges:[],nodes:Array.from({length:count},(_,i)=>{
 const kind=(['text','text','text','text','card','card','pdf','image','audio','video'] as const)[i%10];
 return{id:`n${i}`,kind,x:(i%100)*380,y:Math.floor(i/100)*280,width:320,height:220,color:'sand',...(kind==='text'?{text:prose}:kind==='card'?{file:`notes/long-${i%100}.md`}:{file:`media/fixture.${kind==='pdf'?'pdf':kind==='image'?'png':kind==='audio'?'wav':'mp4'}`})};})};}
const summary=(xs:number[])=>{const a=[...xs].sort((a,b)=>a-b);return{n:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],min:a[0],max:a.at(-1)};};
async function main(){const results=[];for(const count of [1000,5000,10000]){
 const b=fixture(count),raw=JSON.stringify(b,null,2),file=`${out}/${count}.thoughtspace`;await writeFile(file,raw);
 const measures:{parse:number[];change:number[];save:number[];heapMiB:number[];rssMiB:number[]}={parse:[],change:[],save:[],heapMiB:[],rssMiB:[]};
 const plugin={app:{vault:{process:async(_:unknown,edit:(s:string)=>string)=>{await writeFile(file,edit(await readFile(file,'utf8')));}}},createUnique:()=>{throw Error('Unexpected failed save');}};
 const s=new Session(plugin,{path:file,basename:String(count)},raw);
 for(let run=-3;run<20;run++){
  let t=performance.now();model.parseBoard(raw);const parse=performance.now()-t;
  t=performance.now();s.change((board:model.Board)=>{board.nodes[0].text+=`\nedit ${run}`;});const change=performance.now()-t;
  t=performance.now();await s.flush();const save=performance.now()-t;
  if(s.blocked)throw Error(s.status);
  const memory=process.memoryUsage();if(run>=0){measures.parse.push(parse);measures.change.push(change);measures.save.push(save);measures.heapMiB.push(memory.heapUsed/2**20);measures.rssMiB.push(memory.rss/2**20);}
 }
 const result={count,bytes:Buffer.byteLength(raw),...Object.fromEntries(Object.entries(measures).map(([k,v])=>[k,summary(v)])),raw:measures};results.push(result);console.log(JSON.stringify({...result,raw:undefined}));writeFileSync(`${out}/report.json`,JSON.stringify({scope:'Node algorithm microbenchmark, not native Obsidian or Chromium UI',baseline:'ec80f89 / 1.3.24',runtime:process.version,hardware:{cpu:cpus()[0]?.model,cores:cpus().length,memoryGiB:totalmem()/2**30,platform:platform(),release:release()},method:'3 warmups + 20 sequential samples per size; nearest-rank p50/p95; no forced GC; edit histories retained; flush begins after synchronous change, includes queued serialization and real filesystem read/write but no fsync; datasets 40% inline long Markdown,20% note refs,10% each PDF/image/audio/video refs; referenced payloads are NOT decoded; no edges',proseBytes:Buffer.byteLength(prose),results},null,2));
 }}void main();
