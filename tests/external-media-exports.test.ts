import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,canvasExport,type Board} from '../src/model';
import {mediaCard,mediaFileMarkdown} from '../src/media-source';
import {parseMediaPlayerUrl} from '../src/media-notes';
import {selectionMarkdown} from '../src/board-studio';
import {boardOutline} from '../src/workspace-tools';

const vault='Research 空间 #100% [A]',files=['引用/课程 [一] #100%2F (final).tsvideo','引用/讲座 [二] #50%.tsaudio'];
function board(paths=files):Board{return{...emptyBoard(),version:3,nodes:paths.map((path,i)=>({...mediaCard('media-'+i,path,120+i*400,90,320,12.125+i),color:i?'blue' as const:'slate' as const})),edges:[]};}
function playerLinks(text:string){return[...text.matchAll(/\]\((obsidian:\/\/thoughtspace-player[^)]+)\)/g)].map(match=>parseMediaPlayerUrl(match[1]));}

test('selection Markdown exports external references through the existing player protocol with exact paths and time',()=>{
 const b=board(),result=selectionMarkdown(b,new Set(b.nodes.map(n=>n.id)),vault);
 assert.deepEqual(playerLinks(result),b.nodes.map(n=>({vault,file:n.file!,time:n.mediaStart!})));assert.ok(!result.includes('file:///'));assert.match(result,/\\\[一\\\]/);
});
test('outline exports external references as playable protocol links without exposing a local absolute path',()=>{
 const b=board(),result=boardOutline(b,'外部视频大纲',vault);
 assert.deepEqual(playerLinks(result),b.nodes.map(n=>({vault,file:n.file!,time:n.mediaStart!})));assert.ok(result.startsWith('# 外部视频大纲\n'));assert.ok(!result.includes('file:///'));
});
test('Canvas exports only external media references as text links while preserving geometry, colors and edges',()=>{
 const b=board();b.edges.push({id:'edge',from:b.nodes[0].id,to:b.nodes[1].id,label:'关联'});const original=canvasExport(b),result=canvasExport(b,vault);
 for(let i=0;i<result.nodes.length;i++){
  const node=result.nodes[i];assert.equal(node.type,'text');assert.ok('text' in node);assert.deepEqual(playerLinks(node.text!),[{vault,file:b.nodes[i].file!,time:b.nodes[i].mediaStart!}]);assert.ok(!('file' in node));assert.ok(!('subpath' in node));
  for(const key of ['id','x','y','width','height','color'] as const)assert.equal(node[key],original.nodes[i][key]);
 }
 assert.deepEqual(result.edges,original.edges);
});
test('providing vault context leaves every ordinary media export byte-for-byte unchanged',()=>{
 const b=board(['媒体/视频 [一] #100%2F.mp4','媒体/音频 #50%.mp3']),ids=new Set(b.nodes.map(n=>n.id));
 assert.equal(selectionMarkdown(b,ids,vault),selectionMarkdown(b,ids));assert.equal(selectionMarkdown(b,ids),b.nodes.map(n=>mediaFileMarkdown(n.file!,n.mediaStart)).join('\n\n'));
 assert.equal(boardOutline(b,'普通媒体',vault),boardOutline(b,'普通媒体'));assert.deepEqual(canvasExport(b,vault),canvasExport(b));
});
