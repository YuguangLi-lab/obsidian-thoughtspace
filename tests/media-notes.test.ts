import test from 'node:test';
import assert from 'node:assert/strict';
import {appendMediaMoment,mediaNoteDocument,mediaNoteSource,mediaPlayerUrl,parseMediaPlayerUrl,readLegacyMediaMoments,readMediaMoments} from '../src/media-notes';
import {yingjianLink} from '../src/yingjian';

const source={vault:'我的 仓库 #1',file:'课程/名称 [特殊] #20% (一).mp4'},time=123.456;
const entry={id:'point-a_1',time,text:'**观点**\n第二行\n\n> 嵌套引用'};
const doc=()=>mediaNoteDocument(source.file);
const link=(seconds=12)=>`[${seconds}](${mediaPlayerUrl(source,seconds)})`;
test('standalone link round trips source identity and fractional time without a board',()=>{
 const url=mediaPlayerUrl(source,time);assert.deepEqual(parseMediaPlayerUrl(url),{...source,time});
 assert.equal(new URL(url).searchParams.get('file'),source.file);assert(!url.includes('board='));
 assert.deepEqual(parseMediaPlayerUrl({...source,t:String(time),action:'thoughtspace-player'}),{...source,time});
 assert.deepEqual(parseMediaPlayerUrl(new URL(url).searchParams),{...source,time});
 for(const seconds of [0,1e-7,100000000])assert.deepEqual(parseMediaPlayerUrl(mediaPlayerUrl(source,seconds)),{...source,time:seconds});
});
test('literal percent encoded filename components are decoded exactly once',()=>{
 const literal={vault:'A',file:'%2E%2E/%2F%23%20.mp3'};
 assert.deepEqual(parseMediaPlayerUrl(mediaPlayerUrl(literal,1)),{...literal,time:1});
 assert.deepEqual(parseMediaPlayerUrl({...literal,t:'1'}),{...literal,time:1});
});
test('protocol rejects wrong hosts, credentials, hash, missing, duplicate and unknown parameters',()=>{
 const url=mediaPlayerUrl(source,time);
 for(const bad of [url.replace('obsidian:','https:'),url.replace('//thoughtspace-player','//elsewhere'),url.replace('//thoughtspace-player','//user@thoughtspace-player'),url.replace('//thoughtspace-player','//@thoughtspace-player'),url.replace('//thoughtspace-player','//thoughtspace-player:80'),url.replace('?', '/path?'),url+'#x',url+'#',url+'&t=0',url+'&file=a.mp4',url+'&other=a',url+'&action=nope',url+'&action=thoughtspace-player&action=thoughtspace-player',url.replace(/&t=[^&]*/,''),url+'&x=%zz',url.replace('file=', 'file=%FF'),url.replace('vault=', 'vault=%00')])assert.equal(parseMediaPlayerUrl(bad),undefined,bad);
 assert.equal(parseMediaPlayerUrl({...source,t:12}),undefined);
});
test('invalid source traversal and time are rejected at generation and parsing boundaries',()=>{
 for(const file of ['','../x.mp4','a/../x.mp4','a/./x.mp4','a//x.mp4','/a.mp4','C:/a.mp4','a\\x.mp4','a\n.mp4',' x.mp4','x.mp4 ','x.md','https://host/x.mp4']){
  assert.throws(()=>mediaPlayerUrl({...source,file}));assert.throws(()=>mediaNoteDocument(file));
  assert.equal(parseMediaPlayerUrl({...source,file,t:'1'}),undefined);
 }
 for(const invalid of [-1,NaN,Infinity,100000001]){assert.throws(()=>mediaPlayerUrl(source,invalid));assert.equal(parseMediaPlayerUrl({...source,t:String(invalid)}),undefined);}
 for(const t of ['-0','0x10','.5','1.',' 1','1 ','1_000','1e999'])assert.equal(parseMediaPlayerUrl({...source,t}),undefined,t);
 assert.throws(()=>mediaPlayerUrl({...source,vault:' '}));
});
test('frontmatter source and escaped title retain unusual media filenames',()=>{
 const raw=doc();assert.equal(mediaNoteSource(raw),source.file);
 assert(raw.includes('thoughtspace_media: '+JSON.stringify(source.file)));
 assert(raw.includes('# 名称 \\[特殊\\] #20% (一).mp4'));
 assert.equal(mediaNoteSource('---\nthoughtspace_media: \'课程/It\'\'s.mp3\' # remark\n...\n'),'课程/It\'s.mp3');
 assert.equal(mediaNoteSource('---\nthoughtspace_media: 课程/片段 #2.mp4\n---\n'),undefined,'unquoted YAML comment cannot silently identify a different file');
 assert.equal(mediaNoteSource('---\nthoughtspace_media: clip.mp3 # comment\n---\n'),'clip.mp3');
});
test('source metadata is only recognized in closed top-level frontmatter and rejects ambiguity',()=>{
 for(const raw of ['thoughtspace_media: a.mp4','---\nthoughtspace_media: a.mp4','```yaml\n---\nthoughtspace_media: a.mp4\n---\n```','---\nwrapper:\n  thoughtspace_media: a.mp4\n---','---\nthoughtspace_media: a.mp4\nthoughtspace_media: b.mp4\n---','---\nthoughtspace_media: ../a.mp4\n---','---\nthoughtspace_media: |\n  a.mp4\n---'])assert.equal(mediaNoteSource(raw),undefined,raw);
});
test('append round trips editable multiline Markdown, image and actual source line',()=>{
 const image='![截图 \\[一\\]](附件/screen%20%231.png)',raw=appendMediaMoment(doc(),{...entry,image},source),result=readMediaMoments(raw,source);
 assert.equal(result.length,1);assert.deepEqual(result[0],{...entry,image,line:raw.split('\n').findIndex(line=>line.startsWith('> [!note]'))+1});
 const target=raw.match(/\]\((obsidian:\/\/thoughtspace-player[^)]+)\)/)?.[1];assert.deepEqual(parseMediaPlayerUrl(target!),{...source,time});
 assert(raw.endsWith('^thoughtspace-media-point-a_1\n'));
});
test('idempotent append preserves manually edited old content byte for byte',()=>{
 const saved=appendMediaMoment(doc(),entry,source).replace('**观点**','手工改写 **观点**').replace('第二行','第二行 + 新内容');
 const withTail=saved+'\n## 下一章节\n不要改变这一段\n';
 assert.equal(appendMediaMoment(withTail,{...entry,text:'替换正文',time:999},source),withTail);
 assert.equal(readMediaMoments(withTail,source)[0].text,'手工改写 **观点**\n第二行 + 新内容\n\n> 嵌套引用');
 const alteredLink=withTail.replace(mediaPlayerUrl(source,time),'https://example.com');
 assert.equal(appendMediaMoment(alteredLink,entry,source),alteredLink,'visible block ID reserves even a manually changed timestamp');
});
test('append preserves prior sections, CRLF bytes, separate records and equal timestamps',()=>{
 const before=(doc()+'## 前文\n原文\n').replace(/\n/g,'\r\n');
 const first=appendMediaMoment(before,{id:'first',time:10,text:'第一条'},source),raw=appendMediaMoment(first,{id:'second',time:10,text:'第二条'},source);
 assert(raw.startsWith(before));assert(!/(?<!\r)\n/.test(raw));
 assert.deepEqual(readMediaMoments(raw,source).map(({id,time,text})=>({id,time,text})),[{id:'first',time:10,text:'第一条'},{id:'second',time:10,text:'第二条'}]);
});
test('append and reads enforce the note source rather than retargeting an existing document',()=>{
 const raw=appendMediaMoment(doc(),entry,source),other={...source,file:'other.mp4'};
 assert.throws(()=>appendMediaMoment(raw,entry,other));assert.deepEqual(readMediaMoments(raw,other),[]);
 assert.deepEqual(readMediaMoments(raw,{...source,vault:'different'}),[]);
 assert.throws(()=>appendMediaMoment('---\nthoughtspace_media: ../a.mp4\n---',entry,source));
 assert.deepEqual(readMediaMoments(link(),{...source,file:'else.mp4'}),[]);
});
test('unsafe IDs, malformed images, oversized documents and invalid times cannot be written',()=>{
 for(const id of ['', 'a\nb','a b','../a','a'.repeat(129)])assert.throws(()=>appendMediaMoment(doc(),{...entry,id},source));
 for(const image of ['text ![a](a.png)','![a](../a.png)','![a](/a.png)','![a](https://example.com/a.png)','![a](javascript:a.png)','![[../a.png]]','![a](a.png)\n^evil','![a](a.mp4)','![a](%2E%2E/a.png)'])assert.throws(()=>appendMediaMoment(doc(),{...entry,image},source),image);
 assert.throws(()=>appendMediaMoment('x'.repeat(500001),entry,source));assert.throws(()=>readMediaMoments('x'.repeat(500001),source));
 assert.throws(()=>appendMediaMoment(doc(),{...entry,time:Infinity},source));
});
test('hidden examples do not become moments or falsely reserve a visible ID',()=>{
 const record=appendMediaMoment('',entry,source);
 const examples=['```md\n'+record+'```','~~~\n'+record+'~~~','<!--\n'+record+'-->','%%\n'+record+'%%','`'+link()+'`','    '+link(),'> ```\n> '+link()+'\n> ```'];
 for(const example of examples){assert.deepEqual(readMediaMoments(example,source),[],example);const raw=appendMediaMoment(example,entry,source);assert.equal(readMediaMoments(raw,source).length,1,example);}
});
test('fenced quoted samples do not hide a following real record',()=>{
 const sample='```md\n> '+link()+'\n```\n\n';
 const raw=appendMediaMoment(sample,entry,source);assert.equal(readMediaMoments(raw,source).length,1);assert.equal(readMediaMoments(raw,source)[0].id,entry.id);
});
test('unclosed trailing comments or fences reject an append that Markdown would hide',()=>{
 for(const raw of ['```md\nunfinished','<!-- unfinished','%% unfinished','---\nthoughtspace_media: a.mp4'])assert.throws(()=>appendMediaMoment(raw,entry,source));
 for(const text of ['<!-- unfinished','%% unfinished'])assert.throws(()=>appendMediaMoment('',{...entry,text},source));
});
test('body fences, comments and embedded timestamp examples remain editable text',()=>{
 const text='原文\n```md\n'+link(18)+'\n![example](a.png)\n```\n<!-- '+link(30)+' -->\n尾文';
 const raw=appendMediaMoment('',{...entry,text},source),moments=readMediaMoments(raw,source);
 assert.equal(moments.length,1);assert.equal(moments[0].text,text);assert.equal(moments[0].image,undefined);
});
test('only an actual body image is exposed as the editable image field',()=>{
 const image='![[附件/截图 #1.png|640]]',raw=appendMediaMoment('',{...entry,image,text:'图片说明\n`![fake](no.png)`\n%% ![hidden](hide.png) %%'},source);
 const result=readMediaMoments(raw,source)[0];assert.equal(result.image,image);assert.equal(result.text,'图片说明\n`![fake](no.png)`\n%% ![hidden](hide.png) %%');
});
test('existing unanchored player links and inline IDs are readable without fabricating nearby prose',()=>{
 const raw=`# 时间轴\n\n- ${link(12)} 现有正文 ^thoughtspace-media-exists\n\n不要纳入\n\n${link(20)} 第二条`;
 const rows=readMediaMoments(raw,source);assert.equal(rows.length,2);assert.deepEqual(rows[0],{id:'exists',time:12,text:'现有正文',line:3});assert.equal(rows[1].text,'第二条');assert.equal(rows[1].line,7);
 assert.equal(appendMediaMoment(raw,{...entry,id:'exists'},source),raw,'a moved inline block ID retains idempotency');
});
test('duplicate block IDs expose one moment while distinct equal timestamps remain separate',()=>{
 const first=appendMediaMoment('',entry,source),raw=first+'\n'+first;
 assert.equal(readMediaMoments(raw,source).length,1);
});
test('an adjacent foreign media callout cannot become the previous source body',()=>{
 const raw=`> [!note] ${link(12)}\n> 本来源\n> [!note] [0:20](${mediaPlayerUrl({...source,file:'other.mp4'},20)})\n> 另一来源`;
 const entries=readMediaMoments(raw,source);assert.equal(entries.length,1);assert.equal(entries[0].text,'本来源');
});

const legacy='/Users/me/Vault/课程/名称 [特殊] #20% (一).mp4';
const legacyDoc=(metadata=`source: ${JSON.stringify(legacy)}\nvideo-note-id: abc`)=>`---\n${metadata}\n---\n\n`;
test('legacy note source is identified by metadata and returned unchanged for caller root mapping',()=>{
 for(const metadata of [`source: ${JSON.stringify(legacy)}\nvideo-note-id: abc`,`source: ${JSON.stringify(legacy)}\nyingjian-capture-id: abc`,`source: '${legacy}'\ntags: [视频, 影笺]`,`source: '${legacy}'\ntags:\n  - '#影笺'`])assert.equal(mediaNoteSource(legacyDoc(metadata)),legacy);
 assert.equal(mediaNoteSource(legacyDoc('source: "C:\\\\Vault\\\\sound.mp3"\nvideo-note-id: abc')),'C:\\Vault\\sound.mp3');
 for(const metadata of [`source: '${legacy}'`,`source: /Users/me/../other.mp4\nvideo-note-id: abc`,`source: '//server/a.mp4'\nvideo-note-id: abc`,`source: https://youtu.be/test\nvideo-note-id: abc`,`source: '${legacy}'\nvideo-note-id: abc\nthoughtspace_media: ../bad.mp4`])assert.equal(mediaNoteSource(legacyDoc(metadata)),undefined,metadata);
});
test('legacy callout timestamps retain editable content, block identity and screenshot',()=>{
 const url=yingjianLink(legacy,14.25,'视频/笔记.md',source.vault),raw=legacyDoc()+`> [!question] 疑问 · [00:14](${url})\n> 这里是编辑过的正文\n>\n> ![[附件/画面.png|640]]\n\n^video-t-uuid\n`;
 const entries=readLegacyMediaMoments(raw,source,legacy);assert.equal(entries.length,1);assert.deepEqual(entries[0],{id:'uuid',time:14.25,text:'疑问\n这里是编辑过的正文',image:'![[附件/画面.png|640]]',line:6});
 assert.equal(readMediaMoments(raw,source).length,0);assert.equal(readLegacyMediaMoments(raw,source,'/other.mp4').length,0);
});
test('legacy reads reject mismatched source, vault, duplicate parameters and hidden links',()=>{
 const url=yingjianLink(legacy,3,undefined,source.vault),line=(url:string)=>`[00:03](${url})`;
 for(const invalid of [url+'&t=4',url+'&video='+encodeURIComponent('/other.mp4'),url+'#ignored',yingjianLink('/other.mp4',3),yingjianLink(legacy,3,undefined,'other vault')])assert.equal(readLegacyMediaMoments(legacyDoc()+line(invalid),source,legacy).length,0,invalid);
 assert.equal(readLegacyMediaMoments(line(url),source,legacy).length,0,'legacy metadata identity must also match');
 assert.equal(readLegacyMediaMoments(legacyDoc()+'```\n'+line(url)+'\n```\n<!-- '+line(url)+' -->',source,legacy).length,0);
});
test('legacy vault hashes require an explicitly supplied current vault hash',()=>{
 const hash='0123456789abcdef0123',other='1123456789abcdef0123';
 const raw=legacyDoc()+`[00:03](${yingjianLink(legacy,3,undefined,hash)})`;
 assert.equal(readLegacyMediaMoments(raw,source,legacy).length,0);
 assert.equal(readLegacyMediaMoments(raw,source,legacy,other).length,0);
 assert.equal(readLegacyMediaMoments(raw,source,legacy,hash).length,1);
 assert.equal(readLegacyMediaMoments(raw,source,legacy,'not-a-vault-hash').length,0);
 assert.throws(()=>readLegacyMediaMoments(raw,{...source,file:'../else.mp4'},legacy,hash));
});
