import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaSourceUrl,parseMediaSourceUrl} from '../src/media-source';
import {mediaPlayerUrl,parseMediaPlayerUrl} from '../src/media-notes';
import {onlinePlayerUrl,parseOnlinePlayerUrl} from '../src/online-media-notes';

// Obsidian 1.11.7 decodes URI fields with decodeURIComponent, which preserves '+'.
function obsidianCallback(url:string):Record<string,string> {
 const [action,query]=url.slice('obsidian://'.length).split('?'),params:Record<string,string>={};
 for(const pair of query.split('&')){
  const [key,value]=pair.split('=');params[decodeURIComponent(key)]=decodeURIComponent(value);
 }
 return{...params,action};
}
const vaults=['Research Notes','Research+Notes','研究 + 笔记 #100%2F & 问答'];
const board='白板/课程 + [一] #100%2F & 问答.thoughtspace',node='视频 + [一] #100%2F & 问答',time=12.125;

for(const extension of ['mp4','mp3','tsvideo','tsaudio'])test(`${extension} backlinks survive real Obsidian URI decoding with exact vault and paths`,()=>{
 const file=`引用/课程 + [一] #100%2F & 问答.${extension}`;
 for(const vault of vaults){
  const expected={vault,board,node,file,time},url=mediaSourceUrl(expected);
  assert.deepEqual(parseMediaSourceUrl(obsidianCallback(url)),expected);
  assert.deepEqual(parseMediaSourceUrl(url),expected);
  assert.ok(!url.includes('+'));assert.ok(url.includes('%20'));assert.ok(url.includes('%2B'));
  const player=mediaPlayerUrl({vault,file},time);
  assert.deepEqual(parseMediaPlayerUrl(obsidianCallback(player)),{vault,file,time});
  assert.deepEqual(parseMediaPlayerUrl(player),{vault,file,time});
  assert.ok(!player.includes('+'));
 }
});

for(const source of ['https://www.bilibili.com/video/BV1xx411c7mD/?p=2','https://www.youtube.com/watch?v=dQw4w9WgXcQ'])test(`${source} backlinks retain vault and note names through Obsidian`,()=>{
 const note='视频/课程 + [一] #100%2F & 问答.md';
 for(const vault of vaults){
  const expected={vault,source,time,note},url=onlinePlayerUrl(vault,source,time,note);
  assert.deepEqual(parseOnlinePlayerUrl(obsidianCallback(url)),expected);
  assert.deepEqual(parseOnlinePlayerUrl(url),expected);
  assert.ok(!url.includes('+'));assert.ok(url.includes('%20'));assert.ok(url.includes('%2B'));
 }
});

test('legacy raw links still distinguish form-encoded spaces from literal plus signs',()=>{
 const vault=vaults[2],file='引用/课程 + [一] #100%2F & 问答.tsvideo';
 const boardLink='obsidian://thoughtspace-media?'+new URLSearchParams({vault,board,node,file,t:String(time)});
 assert.deepEqual(parseMediaSourceUrl(boardLink),{vault,board,node,file,time});
 const playerLink='obsidian://thoughtspace-player?'+new URLSearchParams({vault,file,t:String(time)});
 assert.deepEqual(parseMediaPlayerUrl(playerLink),{vault,file,time});
 const source='https://www.bilibili.com/video/BV1xx411c7mD/?p=2',note='视频/课程 + #100%2F & 问答.md';
 const onlineLink='obsidian://thoughtspace-online-player?'+new URLSearchParams({vault,source,note,t:String(time)});
 assert.deepEqual(parseOnlinePlayerUrl(onlineLink),{vault,source,note,time});
});

test('already-decoded callbacks preserve literal plus and percent-encoded filename text',()=>{
 const vault='Research+Notes',file='引用/课程+%2F.tsvideo',board='白板/课程+%2F.thoughtspace',node='node+%2F';
 assert.deepEqual(parseMediaSourceUrl({vault,board,node,file,t:String(time),action:'thoughtspace-media'}),{vault,board,node,file,time});
 assert.deepEqual(parseMediaPlayerUrl({vault,file,t:String(time),action:'thoughtspace-player'}),{vault,file,time});
 const source='https://www.youtube.com/watch?v=dQw4w9WgXcQ',note='视频/课程+%2F.md';
 assert.deepEqual(parseOnlinePlayerUrl({vault,source,note,t:String(time),action:'thoughtspace-online-player'}),{vault,source,note,time});
});
