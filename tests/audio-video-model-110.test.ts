import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasExport,clone,emptyBoard,parseBoard} from '../src/model';
import {foldCards} from '../src/board-tools';
import {mediaCard,mediaClock,mediaKind,mediaSourceMarkdown,mediaSourceUrl,mediaTime,parseMediaSourceUrl,parseMediaTime} from '../src/media-source';
import {nodeRenderKey} from '../src/node-render-key';
import {searchKinds} from '../src/board-search';
import {planLayout} from '../src/layout-planner';

test('native audio/video cards round-trip all supported extensions only in version 3',()=>{
 const b=emptyBoard();b.version=3;
 const audio=['mp3','m4a','wav','ogg','oga','flac','aac','opus'],video=['mp4','webm','mov','m4v','ogv'];
 for(const extension of [...audio,...video]){
  const kind=audio.includes(extension)?'audio':'video',path=`音视频/片段 #[一] 100%2F.${extension.toUpperCase()}`,n=mediaCard('media',path,120,180,320,12.5);
  assert.equal(n.kind,kind);assert.equal(mediaKind(path),kind);assert.equal(n.width,320);assert.equal(n.height,kind==='video'?252:140);assert.equal(n.x,-40);assert.equal(n.mediaStart,12.5);
  b.nodes=[n];assert.deepEqual(parseBoard(JSON.stringify(b)),b);
  for(const version of [1,2])assert.throws(()=>parseBoard(JSON.stringify({...b,version})));
 }
});
test('media paths reject URLs, traversal, unnormalized paths and mismatched attachment types',()=>{
 const b=emptyBoard();b.version=3;b.nodes=[mediaCard('media','media/clip.mp4',0,0)];
 for(const path of ['/clip.mp4','../clip.mp4','a/../clip.mp4','a/./clip.mp4','a//clip.mp4','C:\\clip.mp4','https://example.org/clip.mp4','a\nclip.mp4','clip.mp4 ','clip.exe','clip.mp3']){
  b.nodes[0].file=path;assert.throws(()=>parseBoard(JSON.stringify(b)),path);
  if(path!=='clip.mp3')assert.throws(()=>mediaCard('media',path,0,0),path);
 }
 for(const time of [-1,NaN,Infinity,100000001])assert.throws(()=>mediaCard('media','clip.mp4',0,0,320,time));
 for(const width of [NaN,Infinity,-10,0])assert.throws(()=>mediaCard('media','clip.mp4',0,0,width));
});
test('media start validates finite bounded seconds and rejects timestamps on other kinds',()=>{
 const b=emptyBoard();b.version=3;b.nodes=[mediaCard('media','clip.mp4',0,0)];
 for(const mediaStart of [0,0.125,100000000]){b.nodes[0].mediaStart=mediaStart;assert.deepEqual(parseBoard(JSON.stringify(b)),b);}
 for(const mediaStart of [-1,null,'1',true,NaN,Infinity,100000001])assert.throws(()=>parseBoard(JSON.stringify({...b,nodes:[{...b.nodes[0],mediaStart}]})));
 assert.throws(()=>parseBoard(JSON.stringify({...b,nodes:[{...b.nodes[0],kind:'card',file:'note.md',mediaStart:0}]})),/媒体起始时间/);
 delete b.nodes[0].mediaStart;assert.deepEqual(parseBoard(JSON.stringify(b)),b);
});
test('audio/video folding preserves original height and Canvas exports source time',()=>{
 const b=emptyBoard();b.version=3;b.nodes=[mediaCard('audio','recording.mp3',0,0,320,14),mediaCard('video','recording.mp4',500,0,480,1.25)];
 const before=clone(b);foldCards(b,new Set(b.nodes.map(n=>n.id)),true);
 assert.deepEqual(b.nodes.map(n=>n.height),[72,72]);assert.deepEqual(parseBoard(JSON.stringify(b)),b);
 foldCards(b,new Set(b.nodes.map(n=>n.id)),false);assert.deepEqual(b,before);
 assert.deepEqual(canvasExport(b).nodes.map(n=>[n.type,'file' in n?n.file:undefined,'subpath' in n?n.subpath:undefined]),[['file','recording.mp3','#t=14'],['file','recording.mp4','#t=1.25']]);
 b.nodes[0].locked=true;foldCards(b,new Set(['audio']),true);assert.equal(b.nodes[0].collapsed,undefined);
});
test('media search/layout labels are complete and source time invalidates only its render key',()=>{
 const b=emptyBoard();b.version=3;b.nodes=[mediaCard('audio','recording.mp3',0,0),mediaCard('video','recording.mp4',500,0)];
 assert.equal(searchKinds.audio,'音频');assert.equal(searchKinds.video,'视频');
 const plan=planLayout(b,new Set(['audio','video']),{mode:'kind',columns:2,gap:32,sort:'position',anchor:'corner'});
 assert.deepEqual(plan.lanes.map(l=>l.label),['音频','视频']);
 const n=b.nodes[1],key=nodeRenderKey(n,[]);assert.equal(key,nodeRenderKey({...n,x:12,color:'blue'},[]));assert.notEqual(key,nodeRenderKey({...n,mediaStart:4},[]));
});
test('media clock parsing is bounded and preserves fractional precision',()=>{
 for(const [text,seconds] of [['0',0],['12.125',12.125],['1:02.5',62.5],['1:02:03',3723],[' 00:12 ',12]] as const)assert.equal(parseMediaTime(text),seconds);
 for(const text of ['', '-1','Infinity','NaN','1e3','0x10','1:60','1:2','1:60:00','100000001'])assert.equal(parseMediaTime(text),undefined,text);
 assert.equal(mediaClock(62.9),'1:02');assert.equal(mediaClock(3723),'1:02:03');assert.throws(()=>mediaTime(Infinity));
});
test('media backlinks preserve literal special paths through one URL decoding step',()=>{
 const source={vault:'当前 & + 库',board:'白板/研究 #1%2F.thoughtspace',node:'node & 1',file:'资料/片段 #[a] 100%2F.mp4',time:12.125};
 const url=mediaSourceUrl(source);assert.deepEqual(parseMediaSourceUrl(url),source);
 const params=new URL(url).searchParams;assert.deepEqual(parseMediaSourceUrl(params),source);assert.deepEqual(parseMediaSourceUrl({...Object.fromEntries(params),action:'thoughtspace-media'}),source);
 assert.equal(mediaSourceMarkdown(source,'段落 [A]\\测试'),`[段落 \\[A\\]\\\\测试](${url})`);
});
test('media protocol rejects malformed authority, duplicate data and unsafe destinations',()=>{
 const source={vault:'demo',board:'board.thoughtspace',node:'node',file:'clip.mp4',time:4},url=mediaSourceUrl(source);
 for(const bad of [url+'&t=5',url+'&vault=other',url+'&unknown=x',url.replace('obsidian:','https:'),url.replace('thoughtspace-media?','thoughtspace-media/path?'),url+'#t=5',url.replace('t=4','t=-1'),url.replace('t=4','t=Infinity'),url.replace('t=4','t=1e9'),url.replace('t=4','t=100000001'),url.replace('file=clip.mp4','file=..%2Fclip.mp4'),url.replace('board=board.thoughtspace','board=board.md'),url.replace('file=clip.mp4','file=https%3A%2F%2Fevil%2Fclip.mp4'),url.replace('node=node','node=%00'),url.replace('node=node','node=%ZZ')])assert.equal(parseMediaSourceUrl(bad),undefined,bad);
 for(const time of [0,1e-7,Number.MIN_VALUE,100000000])assert.deepEqual(parseMediaSourceUrl(mediaSourceUrl({...source,time})),{...source,time});
 assert.equal(parseMediaSourceUrl(url.replace('node=node','node=%FF')),undefined);
 assert.throws(()=>mediaSourceUrl({...source,file:'../clip.mp4'}));
 assert.equal(parseMediaSourceUrl({vault:'demo',board:'board.thoughtspace',node:'n',file:'clip.mp4',t:4}),undefined);
});
