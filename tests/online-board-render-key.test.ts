import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {nodeRenderKey} from '../src/node-render-key';
import {parseOnlineSource} from '../src/online-platform';
import {onlinePlayerUrl} from '../src/online-media-notes';
import {mediaClock,mediaTime} from '../src/media-source';
import {webCard} from '../src/web-card';
import {emptyBoard,type Board,type Card} from '../src/model';

const main=readFileSync('src/main.ts','utf8');
function between(start:string,end:string){const from=main.indexOf(start),to=main.indexOf(end,from);assert.ok(from>=0&&to>from);return main.slice(from,to);}
const renderStart='      const isMedia=n.kind',identity=between(renderStart,'      const old=this.positions.get(n.id);');
const reuse=between(renderStart,'      const el = this.world.createDiv');
const allocation=between('    const preferred:string[]=[],remaining:string[]=[],sections:Card[]=[],objects:Card[]=[];','    this.connectionCandidates=ordered;');
const capture=between('  private async captureOnlineBoardMoment(','  async seekOnlineSource(');
const code=(text:string)=>transformSync(text,{loader:'ts'}).code;
const bili='https://www.bilibili.com/video/BV1p5Yg6JEzR/';
const makeIdentity=new Function('n','childCount','branchOptions','detail','fileInfo','metadata','parseOnlineSource','nodeRenderKey','TFile',code(identity+'return {key,mediaBranchKey};'));
const reuseMounted=new Function('n','childCount','branchOptions','detail','fileInfo','metadata','parseOnlineSource','nodeRenderKey','TFile','Component','renderBranchControls',code('for(const current of [n]){'+reuse+'}'));
const detailIds=new Function('visible','b','viewportOnly',code(allocation+'return detailIds;'));
function fixture(url=bili){
 const video=webCard(url,'video',{x:100,y:100}),player={time:43.125,paused:false,disposed:false},calls={unloads:0,removed:0,branches:0,created:0};
 const mounted={ownerDocument:{activeElement:null},dataset:{mediaBranches:''},classList:{toggle(){}},querySelector:()=>({remove:()=>{calls.branches++;}}),toggleClass(){},remove(){calls.removed++;}};
 const TFile=class{},Component=class{constructor(){calls.created++;}load(){}};
 const view={session:{blocked:false},selected:new Set(['video']),relatedFocus:undefined,filterMatches:undefined,
  positions:new Map([['video',mounted]]),nodeKeys:new Map<string,string>(),mediaPlayers:new Map(),
  nodeScopes:new Map([['video',{unload(){calls.unloads++;player.paused=true;player.disposed=true;}}]]),positionNode(){}};
 const options=(children:number,candidates:number)=>({candidates,folded:false,disabled:false,count:children});
 const key=(node:Card,children=0,candidates=0,detail=true)=>makeIdentity.call(view,node,children,options(children,candidates),detail,undefined,undefined,parseOnlineSource,nodeRenderKey,TFile) as {key:string;mediaBranchKey:string};
 const initial=key(video);view.nodeKeys.set(video.id,initial.key);mounted.dataset.mediaBranches=initial.mediaBranchKey;
 const render=(node:Card,children=0,candidates=0,detail=true)=>reuseMounted.call(view,node,children,options(children,candidates),detail,undefined,undefined,parseOnlineSource,nodeRenderKey,TFile,Component,()=>{});
 return{video,player,calls,view,key,render};
}
test('adding excerpt edges updates online branch controls without disposing or pausing the mounted player',()=>{
 for(const url of [bili,'https://www.youtube.com/watch?v=M7lc1UVf-VE']){
  const f=fixture(url);f.render(f.video,1,2);f.render(f.video,2,3);
  assert.equal(f.calls.unloads,0);assert.equal(f.calls.removed,0);assert.equal(f.calls.created,0);assert.equal(f.calls.branches,2);assert.equal(f.player.disposed,false);assert.equal(f.player.paused,false);assert.equal(f.player.time,43.125);
 }
});
test('online identity survives movement and resizing but URL, part, fold and lock changes retire the old guest',()=>{
 const f=fixture();f.render({...f.video,x:900,y:300,width:800,height:600},1,1);assert.equal(f.calls.unloads,0);
 for(const patch of [{webUrl:bili+'?p=2'},{webUrl:'https://www.youtube.com/watch?v=M7lc1UVf-VE'},{collapsed:true},{locked:true}]){
  const changed=fixture();changed.render({...changed.video,...patch});assert.equal(changed.calls.unloads,1);assert.equal(changed.player.disposed,true);assert.equal(changed.calls.created,1);
 }
 const ordinary=fixture('https://example.com/');ordinary.render(ordinary.video,1,1);assert.equal(ordinary.calls.unloads,1,'ordinary webpages retain their branch-dependent identity');
});
test('capture retains the player preview under a saturated preview limit and edge repaint does not interrupt playback',async()=>{
 const f=fixture(),board:Board={...emptyBoard(),version:3,nodes:[{id:'other',kind:'text',text:'other',x:0,y:0,width:100,height:100,color:'blue'},f.video]};
 const owner={board,blocked:false,change(run:(board:Board)=>void){run(this.board);}};
 const moment={id:'capture-1',time:43.125,text:'',image:'![frame](Attachments/frame.png)'},note={path:'Notes/video.md'};
 const dependencies={parseOnlineSource,mediaTime,mediaClock,onlinePlayerUrl,uid:()=> 'edge-1',Notice:class{}};
 const Capture=new Function(...Object.keys(dependencies),code('class Capture{'+capture+'};return Capture;'))(...Object.values(dependencies));
 const view=Object.assign(f.view,{session:owner,closed:false,app:{vault:{getName:()=> 'Vault'}},
  plugin:{settings:{previewLimit:1,defaultTextSize:18,defaultEdgeStyle:'curve'},saveOnlineBoardMoment:async()=>({note,moment})},
  requireOwner:()=>owner,updateSelection(){},mediaStates:new Map(),mediaIdentities:new Map(),onlineBoardStates:new Map()});
 const before=detailIds.call(view,board.nodes,board,true) as Set<string>;assert.equal(before.has('video'),true);assert.equal(before.has('other'),false);
 await Capture.prototype.captureOnlineBoardMoment.call(view,'video',bili,{...moment,image:new Blob(['png'],{type:'image/png'})},owner);
 const after=detailIds.call(view,board.nodes,board,true) as Set<string>;assert.equal(board.nodes.length,3);assert.equal(board.edges.length,1);assert.equal(after.has('video'),true,'saving must not demote the playing source below previewLimit');
 f.render(f.video,1,1,after.has('video'));assert.equal(f.calls.unloads,0);assert.equal(f.calls.removed,0);assert.equal(f.player.paused,false);assert.equal(f.player.time,43.125);
});
