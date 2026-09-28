import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {clone,emptyBoard,type Card} from '../src/model';
import {mediaCard,mediaFileMarkdown} from '../src/media-source';
import {selectionMarkdown} from '../src/board-studio';
import {boardSearchIndex} from '../src/board-search';
import {boardNotePaths} from '../src/native-bridge';
import {readingItems,readingRelations,connectedReadingIds} from '../src/reading-desk';
import {writingUnits,writingOrder,writingParts,writingSignature,writingMarkdown,writingName,writingWordCount} from '../src/writing';
import {resolveNativeNoteDrop} from '../src/native-note-drop';

const note:Card={id:'note',kind:'card',file:'note.md',x:10,y:20,width:200,height:100,color:'sand'};
function board(){return{...emptyBoard(),version:3 as const,nodes:[note,mediaCard('audio','资料/音频 #1%2F.mp3',400,100,320,1.25),mediaCard('video','资料/视频 #[1].mp4',700,100,320,30)],edges:[{id:'edge',from:'note',to:'audio',label:'source'}],writing:{title:'文章',order:['note','audio','video']}};}
test('binary media stay outside Markdown writing, reading and native-note queues',()=>{
 const b=board();assert.deepEqual(writingUnits(b).map(n=>n.id),['note']);assert.deepEqual(writingOrder(b),['note']);assert.deepEqual(writingParts(b).map(p=>p.node.id),['note']);
 assert.deepEqual(boardNotePaths(b),['note.md']);assert.deepEqual(readingItems(b,new Set(),{query:'',status:'all',sort:'board',onlySelected:false}).map(n=>n.id),['note']);
 assert.deepEqual(readingRelations(b,'note'),[]);assert.equal(connectedReadingIds(b).size,0);
 const group:Card={id:'group',kind:'section',title:'全部材料',x:-100,y:-100,width:2000,height:1000,color:'blue'};b.nodes.push(group);b.writing.order=['group'];assert.deepEqual(writingParts(b).map(p=>p.node.id),['group','note']);
});
test('media selection Markdown retains exact attachment paths and playback positions',()=>{
 const b=board(),nodes=b.nodes.filter(n=>n.kind!=='card'),files=new Map(nodes.map(n=>[n.file!,{path:n.file!,extension:n.file!.split('.').at(-1)!}]));
 const markdown=selectionMarkdown(b,new Set(['audio','video']));assert.equal(markdown,nodes.map(n=>mediaFileMarkdown(n.file!,n.mediaStart)).join('\n\n'));
 const result=resolveNativeNoteDrop({vaultName:'vault',getFile:path=>files.get(path),resolve:path=>files.get(path),isFile:(value):value is {path:string;extension:string}=>!!value&&typeof value==='object'&&'path' in value&&files.get(String(value.path))===value},{getData:type=>type==='text/plain'?markdown:''},null,'board.thoughtspace');
 assert.deepEqual(result.references.map(r=>[r.path,r.start]),nodes.map(n=>[n.file,n.mediaStart]));
});
test('search indexes media titles and file paths without requiring text bodies',()=>{
 const entries=boardSearchIndex(board());assert.deepEqual(entries.map(e=>[e.kind,e.path,e.body]),[['card','note.md',''],['audio','资料/音频 #1%2F.mp3',''],['video','资料/视频 #[1].mp4','']]);
});
test('full-text search reads Markdown cards only even with audio/video entries present',async()=>{
 const source=readFileSync('src/board-search-view.ts','utf8'),start=source.indexOf(' private async indexBodies('),end=source.indexOf('\n private reset(',start);
 class TFile {extension:string;stat={size:100};constructor(public path:string){this.extension=path.split('.').at(-1)!;}}
 const run=new Function('TFile',transformSync('class View{'+source.slice(start,end)+'};return View.prototype.indexBodies;',{loader:'ts'}).code)(TFile) as (this:unknown,generation:number)=>Promise<void>;
 const files=new Map(board().nodes.map(n=>[n.file!,new TFile(n.file!)])),reads:string[]=[];
 const view={closed:false,full:true,generation:1,entries:boardSearchIndex(board()),bodies:new Map(),app:{vault:{getAbstractFileByPath:(path:string)=>files.get(path),cachedRead:async(file:TFile)=>{reads.push(file.path);assert.equal(file.extension,'md');return '正文';}}},indexStatus:{setText(){}},contentEl:{win:{setTimeout:(callback:()=>void)=>callback()}},rebuild(){},reset(){}};
 await run.call(view,1);assert.deepEqual(reads,['note.md']);assert.equal(view.bodies.size,1);
});
test('writing compose safeguards binary references even if a future queue admits them',async()=>{
 const source=readFileSync('src/writing-view.ts','utf8'),start=source.indexOf(' private async compose('),end=source.indexOf('\n async refreshArticle(',start);
 class TFile {constructor(public path:string){}get basename(){return this.path;}}
 const b=board();b.nodes=b.nodes.filter(n=>n.kind!=='card');const owner={board:b},boardFile=new TFile('board.thoughtspace'),files=new Map(b.nodes.map(n=>[n.file!,new TFile(n.file!)]));let reads=0;
 const values={clone,writingSignature,writingParts:()=>b.nodes.map(node=>({node,depth:2})),TFile,remoteImageUrl:()=>undefined,imageMarkdown:()=>'',excerptNoteMarkdown:(text:string)=>text,readCurrentNativeNote:()=>{reads++;throw Error('binary read');},writingName,writingMarkdown,writingWordCount};
 const compose=new Function(...Object.keys(values),transformSync('class View{'+source.slice(start,end)+'};return View.prototype.compose;',{loader:'ts'}).code)(...Object.values(values)) as (this:unknown)=>Promise<{text:string}>;
 const result=await compose.call({commitFields(){},ensure:()=>owner,file:boardFile,app:{vault:{getAbstractFileByPath:(path:string)=>files.get(path)},fileManager:{generateMarkdownLink:(file:TFile)=>'[['+file.path+']]'}}});
 assert.equal(reads,0);assert.match(result.text,/音频/);assert.match(result.text,/视频/);
});
