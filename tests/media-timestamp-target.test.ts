import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';
import {mediaTimestampNode} from '../src/media-timestamp-target';import {emptyBoard,type Card} from '../src/model';import {parseMediaSourceUrl} from '../src/media-source';import {parseMediaPlayerUrl,mediaPlayerUrl} from '../src/media-notes';import {parseOnlinePlayerUrl,onlinePlayerUrl} from '../src/online-media-notes';
const file='媒体/课程 + 1.mp4',video=(id:string,path=file):Card=>({id,kind:'video',file:path,x:0,y:0,width:320,height:240,color:'sand'});
test('matching source identity, relationship and explicit provenance win; ambiguity never chooses an arbitrary video',()=>{
 const b={...emptyBoard(),nodes:[video('a'),video('b'),video('wrong','other.mp4')]};assert.equal(mediaTimestampNode(b,{file}),undefined);assert.equal(mediaTimestampNode(b,{file},undefined,'b')?.id,'b');
 b.edges.push({id:'e',from:'a',to:'excerpt',label:''});assert.equal(mediaTimestampNode(b,{file},'excerpt')?.id,'a');b.nodes[0].locked=true;b.nodes[0].collapsed=true;assert.equal(mediaTimestampNode(b,{file})?.id,'b');assert.equal(mediaTimestampNode(b,{file:'missing.mp4'}),undefined);
});
class TFile{constructor(public path:string){}get extension(){return this.path.split('.').at(-1);}}
class BoardView{closed=false;file:TFile;session:any;seeks:any[]=[];online:any[]=[];constructor(path:string,nodes:Card[]){this.file=new TFile(path);this.session={file:this.file,board:{...emptyBoard(),nodes},blocked:false};}seekMediaSource(data:unknown){this.seeks.push(data);}async seekOnlineSource(...args:unknown[]){this.online.push(args);}}
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  async openBoardMediaTimestamp('),end=source.indexOf('  async openMediaSource(',start),deps={mediaTimestampNode,parseMediaSourceUrl,parseMediaPlayerUrl,parseOnlinePlayerUrl,TFile,BoardView,VIEW:'board',isWorkspaceFile:()=>true};
const Plugin=new Function(...Object.keys(deps),transformSync(`class Plugin{${source.slice(start,end)}};return Plugin;`,{loader:'ts'}).code)(...Object.values(deps));
function fixture(nodes:Card[]=[video('v')]){const origin=new BoardView('a.thoughtspace',nodes),other=new BoardView('b.thoughtspace',[video('linked')]),media=new TFile(file),calls:any[]=[];const plugin=new Plugin();Object.assign(plugin,{app:{vault:{getName:()=> 'Vault',getAbstractFileByPath:(p:string)=>p===file?media:undefined},workspace:{getLeavesOfType:()=>[{view:other}]}},openMediaWorkspace:async(...a:unknown[])=>{calls.push(a);},openOnlineWorkspace:async(...a:unknown[])=>{calls.push(a);}});return{origin,other,plugin,calls,media};}
for(const time of [0,.125,12.875])test(`both local timestamp formats preserve ${time} and reuse matching board player`,async()=>{
 const f=fixture(),href=mediaPlayerUrl({vault:'Vault',file},time),legacy='obsidian://thoughtspace-media?'+new URLSearchParams({vault:'Vault',board:'a.thoughtspace',node:'v',file,t:String(time)});
 for(const link of [href,legacy,href])await f.plugin.openBoardMediaTimestamp(link,f.origin,'excerpt');assert.equal(f.origin.seeks.length,3);assert.ok(f.origin.seeks.every((s:any)=>s.file===file&&s.time===time&&s.node==='v'));assert.equal(f.calls.length,0);
});
test('no match or ambiguous matches fall back to the existing workspace controller without inventing a board player',async()=>{
 for(const nodes of [[],[video('wrong','wrong.mp4')],[video('a'),video('b')]]){const f=fixture(nodes),before=JSON.stringify(f.origin.session.board);await f.plugin.openBoardMediaTimestamp(mediaPlayerUrl({vault:'Vault',file},.5),f.origin);assert.deepEqual(f.calls,[[f.media,'tab',.5]]);assert.equal(JSON.stringify(f.origin.session.board),before);}
});
test('explicit related board can be reused across windows, never an unrelated open board',async()=>{
 const f=fixture([]);await f.plugin.openBoardMediaTimestamp('obsidian://thoughtspace-media?'+new URLSearchParams({vault:'Vault',board:'b.thoughtspace',node:'linked',file,t:'0'}),f.origin);assert.equal(f.other.seeks.length,1);assert.equal(f.calls.length,0);
 await f.plugin.openBoardMediaTimestamp(mediaPlayerUrl({vault:'Vault',file},0),f.origin);assert.equal(f.calls.length,1);
});
test('online canonical identity and Bilibili part are matched before seeking or falling back',async()=>{
 const url='https://www.bilibili.com/video/BV1p5Yg6JEzR/?p=2',f=fixture([{...video('web'),kind:'text',webUrl:url}]);await f.plugin.openBoardMediaTimestamp(onlinePlayerUrl('Vault',url,.125),f.origin);assert.equal(f.origin.online.length,1);assert.equal(f.origin.online[0][1],.125);assert.equal(f.origin.online[0][3],'web');
 await f.plugin.openBoardMediaTimestamp(onlinePlayerUrl('Vault',url.replace('p=2','p=3'),0),f.origin);assert.equal(f.calls.length,1);
});
test('invalid/foreign links, failed fallback and failed board seeks do not issue another playback request',async()=>{
 const f=fixture();for(const href of ['https://example.com',mediaPlayerUrl({vault:'Other',file},0),'obsidian://thoughtspace-player?vault=Vault&file=../a.mp4&t=0'])await assert.rejects(()=>f.plugin.openBoardMediaTimestamp(href,f.origin));assert.equal(f.calls.length,0);
 f.origin.seekMediaSource=()=>{throw Error('source changed');};await assert.rejects(()=>f.plugin.openBoardMediaTimestamp(mediaPlayerUrl({vault:'Vault',file},0),f.origin),/source changed/);assert.equal(f.calls.length,0);
});
