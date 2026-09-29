import test from 'node:test';
import assert from 'node:assert/strict';
import {appendOnlineMoment,onlineNoteDocument,onlineNoteSource,onlinePlayerUrl,parseOnlinePlayerUrl,readOnlineMoments} from '../src/online-media-notes';
import {mediaPlayerUrl,readMediaMoments} from '../src/media-notes';
import {yingjianLink} from '../src/yingjian';

const source='https://www.bilibili.com/video/BV1xx411c7mD/?p=2',other='https://www.bilibili.com/video/BV1xx411c7mD/';
const youtube='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const vault='我的 仓库 #20%',note='视频/笔记 [一] #20% (问答).md';
const entry={id:'point-a_1',time:12.375,text:'**观点**\n第二行\n\n> 嵌套引用'};
const doc=()=>onlineNoteDocument(source);
const legacyDoc=(metadata=`source: ${JSON.stringify(source)}\nvideo-note-id: abc`)=>`---\n${metadata}\n---\n\n`;
const link=(seconds=12,path=source,targetVault=vault)=>`[00:12](${onlinePlayerUrl(targetVault,path,seconds,note)})`;
const legacyLink=(seconds=12,path=source,targetVault:string|undefined=vault)=>`[00:12](${yingjianLink(path,seconds,note,targetVault)})`;
const values=(raw:string)=>readOnlineMoments(raw,source,vault).map(({id,time,text})=>({id,time,text}));

test('online notes have a canonical URL identity and independent Bilibili parts',()=>{
 assert.equal(onlineNoteSource(doc()),source);
 assert.equal(onlineNoteSource(onlineNoteDocument('https://m.bilibili.com/video/BV1xx411c7mD?p=2&t=31&share=abc')),source);
 assert.equal(onlineNoteSource(onlineNoteDocument('https://youtu.be/dQw4w9WgXcQ?t=10')),youtube);
 assert.notEqual(onlineNoteSource(onlineNoteDocument(other)),source);
 assert(doc().includes('thoughtspace_online_video: '+JSON.stringify(source)));
 assert(doc().includes('# 哔哩哔哩 · BV1xx411c7mD · P2'));
});
test('legacy metadata supports both stable identifiers and established tags',()=>{
 for(const metadata of [`source: ${JSON.stringify(source)}\nvideo-note-id: abc`,`source: '${source}' # comment\nyingjian-capture-id: abc`,`source: ${source} # comment\ntags: [视频, 影笺]`,`source: '${source}'\ntags:\n  - '#影笺'`])assert.equal(onlineNoteSource(legacyDoc(metadata)),source,metadata);
 assert.equal(onlineNoteSource(legacyDoc('source: https://youtu.be/dQw4w9WgXcQ?t=99\ntags: 影笺')),youtube);
});
test('source scalars reject malformed, ambiguous, nested and unidentified metadata',()=>{
 for(const raw of [
  `source: ${source}\nvideo-note-id: abc`,
  `---\nsource: ${source}\nvideo-note-id: abc`,
  `\`\`\`yaml\n${legacyDoc()}\`\`\``,
  legacyDoc(`source: '${source}'`),
  legacyDoc(`source: '${source}'\nsource: '${other}'\nvideo-note-id: abc`),
  legacyDoc(`wrapper:\n  source: '${source}'\nvideo-note-id: abc`),
  legacyDoc(`source: |\n  ${source}\nvideo-note-id: abc`),
  legacyDoc(`source: ['${source}']\nvideo-note-id: abc`),
  legacyDoc(`source: "${source}" trailing\nvideo-note-id: abc`),
  legacyDoc(`source: '${source}'\nvideo-note-id: abc\nthoughtspace_media: a.mp4`),
  legacyDoc(`thoughtspace_online_video: '${source}'\nthoughtspace_online_video: '${source}'`),
  legacyDoc(`thoughtspace_online_video: '${source}'\nsource: '${other}'`),
  legacyDoc(`thoughtspace_online_video: '${source}'\nsource: []`)
 ])assert.equal(onlineNoteSource(raw),undefined,raw);
 assert.equal(onlineNoteSource(legacyDoc(`thoughtspace_online_video: '${source}'\nsource: 'https://bilibili.com/video/BV1xx411c7mD?p=2&t=10'`)),source);
 for(const invalid of ['true','false','null','12','!!str '+source,'&source '+source,'<'+source+'>','分享 '+source,source+'。',source+'"suffix','https://user@www.youtube.com/watch?v=dQw4w9WgXcQ','http://youtu.be/dQw4w9WgXcQ','https://b23.tv/abc','https://example.com/video.mp4']){
  assert.equal(onlineNoteSource(legacyDoc(`source: ${JSON.stringify(invalid)}\nvideo-note-id: abc`)),undefined,invalid);
  assert.throws(()=>onlineNoteDocument(invalid),invalid);
 }
});
test('player links round trip Unicode note/vault values and fractional times exactly once',()=>{
 for(const time of [0,1e-7,12.375,864000]){
  const expected={vault,source,time,note},url=onlinePlayerUrl(vault,source,time,note);
  assert.deepEqual(parseOnlinePlayerUrl(url),expected);
  assert.deepEqual(parseOnlinePlayerUrl({vault,source,t:String(time),note,action:'thoughtspace-online-player'}),expected);
  assert.equal(new URL(url).searchParams.get('note'),note);
 }
 const literal='视频/%2E%2E%2F%23.md';
 assert.equal(parseOnlinePlayerUrl(onlinePlayerUrl(vault,source,1,literal))?.note,literal);
 assert.deepEqual(parseOnlinePlayerUrl({vault,source:'https://youtu.be/dQw4w9WgXcQ?t=90',t:'4'}),{vault,source:youtube,time:4});
 assert.deepEqual(parseOnlinePlayerUrl(onlinePlayerUrl(vault,source,0)),{vault,source,time:0});
});
test('protocol boundaries reject credential, host, path, parameter and encoding ambiguity',()=>{
 const url=onlinePlayerUrl(vault,source,12,note);
 for(const bad of [url.replace('obsidian:','https:'),url.replace('//thoughtspace-online-player','//elsewhere'),url.replace('//thoughtspace-online-player','//user@thoughtspace-online-player'),url.replace('//thoughtspace-online-player','//@thoughtspace-online-player'),url.replace('//thoughtspace-online-player','//thoughtspace-online-player:80'),url.replace('?', '/path?'),url+'#x',url+'#',url+'&t=0',url+'&source='+encodeURIComponent(other),url+'&other=a',url+'&action=nope',url+'&action=thoughtspace-online-player&action=thoughtspace-online-player',url.replace(/&t=[^&]*/,''),url+'&x=%zz',url.replace('source=','source=%FF'),url.replace('vault=','vault=%00')])assert.equal(parseOnlinePlayerUrl(bad),undefined,bad);
 assert.equal(parseOnlinePlayerUrl({vault,source,t:'1',extra:'no'}),undefined);
});
test('generation and parsing reject unsafe paths, invalid times and empty identities',()=>{
 for(const invalidNote of ['','../x.md','a/../x.md','a/./x.md','a//x.md','/a.md','C:/a.md','a\\x.md','a\n.md',' a.md','a.md ','a.mp4','.hidden/a.md','https://host/a.md']){
  assert.throws(()=>onlinePlayerUrl(vault,source,0,invalidNote),invalidNote);
  assert.equal(parseOnlinePlayerUrl({vault,source,t:'1',note:invalidNote}),undefined,invalidNote);
 }
 for(const time of [-1,NaN,Infinity,864001]){assert.throws(()=>onlinePlayerUrl(vault,source,time));assert.equal(parseOnlinePlayerUrl({vault,source,t:String(time)}),undefined);}
 for(const t of ['-0','0x10','.5','1.',' 1','1 ','1_000','1e999'])assert.equal(parseOnlinePlayerUrl({vault,source,t}),undefined,t);
 for(const invalidVault of ['', ' ', 'a\n', 'a'.repeat(1001)]){assert.throws(()=>onlinePlayerUrl(invalidVault,source,0));assert.equal(parseOnlinePlayerUrl({vault:invalidVault,source,t:'1'}),undefined);}
 for(const invalidSource of ['',other+'。','请观看 '+source,'/video.mp4'])assert.equal(parseOnlinePlayerUrl({vault,source:invalidSource,t:'1'}),undefined);
});
test('append round trips Markdown, source line and optional legacy screenshot as editable fields',()=>{
 const raw=appendOnlineMoment(doc(),entry,source,vault,note),moments=readOnlineMoments(raw,source,vault);
 assert.deepEqual(moments,[{...entry,line:raw.split('\n').findIndex(line=>line.startsWith('> [!note]'))+1}]);
 const image='![[附件/截图 #1.png|640]]';
 const legacy=legacyDoc()+`> [!question] 疑问 · ${legacyLink(14.25)}\n> 编辑后的正文\n>\n> ${image}\n\n^video-t-old\n`;
 assert.deepEqual(readOnlineMoments(legacy,source,vault),[{id:'old',time:14.25,text:'疑问\n编辑后的正文',image,line:6}]);
});
test('new-note append can omit an unresolved note path while retaining exact source identity',()=>{
 const raw=appendOnlineMoment(doc(),entry,source,vault),url=raw.match(/\]\((obsidian:\/\/thoughtspace-online-player[^)]+)\)/)![1];
 assert.deepEqual(parseOnlinePlayerUrl(url),{vault,source,time:entry.time});assert.deepEqual(values(raw),[entry]);
});
test('append preserves the old header, full original content and CRLF bytes',()=>{
 const before=(legacyDoc()+`## 前文\n原文\n\n> [!note] ${legacyLink(4)}\n> 旧记录\n\n^video-t-before\n`).replace(/\n/g,'\r\n');
 const first=appendOnlineMoment(before,entry,source,vault,note),raw=appendOnlineMoment(first,{id:'second',time:entry.time,text:'第二条'},source,vault,note);
 assert(raw.startsWith(before));assert(!raw.includes('thoughtspace_online_video:'));assert(!/(?<!\r)\n/.test(raw));
 assert.deepEqual(values(raw),[{id:'before',time:4,text:'旧记录'},entry,{id:'second',time:entry.time,text:'第二条'}]);
});
test('visible old/new block IDs reserve manually edited entries without overwriting content',()=>{
 const saved=appendOnlineMoment(doc(),entry,source,vault,note).replace('**观点**','手工改写').replace(onlinePlayerUrl(vault,source,entry.time,note),'https://example.com');
 assert.equal(appendOnlineMoment(saved,{...entry,time:999,text:'覆盖'},source,vault,note),saved);
 const old=legacyDoc()+`- ${legacyLink()} 已改写 ^video-t-${entry.id}\n`;
 assert.equal(appendOnlineMoment(old,entry,source,vault,note),old);
});
test('source part and vault must agree before reading or appending',()=>{
 const raw=appendOnlineMoment(doc(),entry,source,vault,note);
 assert.throws(()=>appendOnlineMoment(raw,entry,other,vault,note));
 assert.throws(()=>appendOnlineMoment('',entry,source,vault,note));
 assert.deepEqual(readOnlineMoments(raw,other,vault),[]);
 assert.deepEqual(readOnlineMoments(raw,source,'elsewhere'),[]);
 assert.deepEqual(readOnlineMoments(doc()+link(1,other),source,vault),[]);
 assert.deepEqual(readOnlineMoments(legacyDoc()+legacyLink(1,other),source,vault),[]);
 assert.deepEqual(readOnlineMoments(link(),source,vault),[]);
});
test('legacy vault hash needs the explicit current hash and malformed old links are ignored',()=>{
 const hash='0123456789abcdef0123',raw=legacyDoc()+legacyLink(3,source,hash);
 assert.deepEqual(readOnlineMoments(raw,source,vault),[]);
 assert.deepEqual(readOnlineMoments(raw,source,vault,'1123456789abcdef0123'),[]);
 assert.equal(readOnlineMoments(raw,source,vault,hash).length,1);
 assert.deepEqual(readOnlineMoments(raw,source,vault,'invalid-hash'),[]);
 const url=yingjianLink(source,3,note,vault);
 for(const invalid of [url+'&t=4',url+'&video='+encodeURIComponent(other),url+'#ignored',url+'&extra=1',yingjianLink(source,3,note,'elsewhere'),yingjianLink(source,3,'../else.md',vault),yingjianLink(source,864001,note,vault)])assert.deepEqual(readOnlineMoments(legacyDoc()+`[00:03](${invalid})`,source,vault),[],invalid);
 const noVault=yingjianLink(source,3,note);
 assert.equal(readOnlineMoments(legacyDoc()+`[00:03](${noVault})`,source,vault).length,1,'old links without a vault remain bound by the note metadata');
});
test('hidden examples neither expose moments nor reserve visible anchors',()=>{
 const record=appendOnlineMoment(doc(),entry,source,vault,note).slice(doc().length);
 for(const example of ['```md\n'+record+'```','~~~\n'+record+'~~~','<!--\n'+record+'-->','%%\n'+record+'%%','`'+link()+'`','    '+link(),'> ```\n> '+link()+'\n> ```']){
  assert.deepEqual(readOnlineMoments(doc()+example,source,vault),[],example);
  assert.equal(readOnlineMoments(appendOnlineMoment(doc()+example,entry,source,vault,note),source,vault).length,1,example);
 }
});
test('unfinished Markdown blocks and ambiguous or oversized additions are rejected',()=>{
 for(const suffix of ['```md\nunfinished','<!-- unfinished','%% unfinished'])assert.throws(()=>appendOnlineMoment(doc()+suffix,entry,source,vault,note));
 assert.throws(()=>appendOnlineMoment('---\nthoughtspace_online_video: '+source,entry,source,vault,note));
 for(const text of ['<!-- unfinished','%% unfinished','a\0b','a'.repeat(100001)])assert.throws(()=>appendOnlineMoment(doc(),{...entry,text},source,vault,note));
 for(const id of ['', 'a\nb','a b','../a','a'.repeat(129)])assert.throws(()=>appendOnlineMoment(doc(),{...entry,id},source,vault,note));
 assert.throws(()=>appendOnlineMoment(doc(),{...entry,time:Infinity},source,vault,note));
 assert.throws(()=>appendOnlineMoment(doc()+'a'.repeat(500000),entry,source,vault,note));
 assert.deepEqual(readOnlineMoments(doc()+'a'.repeat(500000),source,vault),[]);
});
test('body examples stay editable and adjacent foreign callouts remain outside the record',()=>{
 const text='原文\n```md\n'+link(18)+'\n![example](a.png)\n```\n<!-- '+legacyLink(30)+' -->\n尾文';
 const raw=appendOnlineMoment(doc(),{...entry,text},source,vault,note),moments=readOnlineMoments(raw,source,vault);
 assert.equal(moments.length,1);assert.equal(moments[0].text,text);assert.equal(moments[0].image,undefined);
 for(const foreign of [link(20,other),legacyLink(20,other),`[00:20](${mediaPlayerUrl({vault,file:'a.mp4'},20)})`]){
  const content=doc()+`> [!note] ${link()}\n> 本来源\n> [!note] ${foreign}\n> 另一来源`;
  assert.equal(readOnlineMoments(content,source,vault)[0].text,'本来源');
 }
 const local=`> [!note] [00:20](${mediaPlayerUrl({vault,file:'a.mp4'},20)})\n> 本地\n> [!note] ${link()}\n> 在线`;
 assert.equal(readMediaMoments(local,{vault,file:'a.mp4'})[0].text,'本地','shared parser sees the new protocol boundary too');
});
test('mixed legacy and current entries keep document order and deduplicate stable IDs',()=>{
 const old=legacyDoc()+`> [!note] ${legacyLink(2)}\n> 旧内容\n\n^video-t-${entry.id}\n\n`;
 const current=appendOnlineMoment(doc(),entry,source,vault,note).slice(doc().length);
 const raw=old+current+`\n- ${link(20)} 现有正文 ^thoughtspace-online-inline\n\n不要纳入\n\n${link(21)} 第二条`;
 const moments=readOnlineMoments(raw,source,vault);
 assert.equal(moments.length,3);assert.deepEqual(moments.map(({id,time,text})=>({id,time,text})),[{id:entry.id,time:2,text:'旧内容'},{id:'inline',time:20,text:'现有正文'},{id:`line:${raw.split('\n').length}`,time:21,text:'第二条'}]);
});

test('online screenshot records keep a safe image embed and actual timestamp',()=>{
 const image='![视频截图](images/frame%201.png)',raw=appendOnlineMoment(doc(),{id:'frame',time:3.125,text:'',image},source,vault,note),entries=readOnlineMoments(raw,source,vault);
 assert.equal(entries[0].image,image);assert.equal(entries[0].time,3.125);assert.equal(entries[0].text,'');
 for(const bad of ['![x](https://evil.example/x.png)','![x](../escape.png)','<script>x</script>'])assert.throws(()=>appendOnlineMoment(doc(),{id:'x',time:1,text:'',image:bad},source,vault,note));
});
