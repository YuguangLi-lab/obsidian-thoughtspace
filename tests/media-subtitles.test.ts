import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_SUBTITLE_CHARACTERS,MAX_SUBTITLE_CUES,srtToWebVtt} from '../src/media-subtitles';

const cue=(text:string,start='00:00:01,250',end='00:00:03,500')=>`1\n${start} --> ${end}\n${text}`;
test('BOM and CRLF SRT becomes native WebVTT with exact milliseconds and readable lines',()=>{
 const raw='\uFEFF'+[cue('你好\n第二行'),`27\n00:01:00,000 --> 00:01:01,001\n下一条`].join('\n\n').replace(/\n/g,'\r\n')+'\r\n';
 assert.equal(srtToWebVtt(raw),'WEBVTT\n\n1\n00:00:01.250 --> 00:00:03.500\n你好\n第二行\n\n2\n00:01:00.000 --> 00:01:01.001\n下一条\n');
});
test('optional numeric indexes, dot fractions and CR-only exports are accepted',()=>{
 assert.equal(srtToWebVtt('00:00:00.000-->00:00:01.005\r第一句'),'WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.005\n第一句\n');
 assert.equal(srtToWebVtt('  \n0\n00:00:00,000 --> 00:00:01,000\ntext\n \t\n').includes('\n1\n00:00:00.000'),true);
});
test('overlap and equal start times preserve distinct speakers without adjusting timing',()=>{
 const raw=cue('甲','00:00:01,000','00:00:04,000')+'\n\n'+cue('乙','00:00:01,000','00:00:02,000')+'\n\n'+cue('丙','00:00:02,000','00:00:05,000');
 const output=srtToWebVtt(raw);assert.equal(output.match(/ --> /g)?.length,3);assert(output.includes('2\n00:00:01.000 --> 00:00:02.000\n乙'));assert(output.includes('3\n00:00:02.000 --> 00:00:05.000\n丙'));
});
test('long media hours are retained and bounded to the shared maximum media time',()=>{
 assert(srtToWebVtt(cue('长视频','123:59:58,999','123:59:59,001')).includes('123:59:58.999 --> 123:59:59.001'));
 assert.throws(()=>srtToWebVtt(cue('too late','999999:00:00,000','999999:00:01,000')));
});
test('bad clocks, empty duration, backwards and unordered cues are rejected',()=>{
 for(const value of ['00:60:00,000','00:00:60,000','0:00:00,000','00:0:00,000','00:00:00,00','00:00:00,1000','-01:00:00,000','Infinity','00:00:01e3,000'])assert.throws(()=>srtToWebVtt(cue('错误',value)),value);
 assert.throws(()=>srtToWebVtt(cue('零时长','00:00:01,000','00:00:01,000')));
 assert.throws(()=>srtToWebVtt(cue('反向','00:00:02,000','00:00:01,000')));
 assert.throws(()=>srtToWebVtt(cue('later')+'\n\n'+cue('earlier','00:00:00,000','00:00:00,500')));
});
test('missing timings, empty captions, unsafe control bytes and cue-setting injection fail',()=>{
 for(const raw of ['', '\uFEFF\n ', 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\ntext', 'garbage', '1\ntext',cue(''),cue('\0text'),cue('text').replace(' --> ',' → '),cue('text').replace('\ntext',' position:50%\ntext'),cue('text')+'\n\nSTYLE\n::cue { color: red; }'])assert.throws(()=>srtToWebVtt(raw),raw);
});
test('HTML formatting and ASS hints are removed while paragraph and br breaks stay readable',()=>{
 const output=srtToWebVtt(cue('<i>斜体</i> <b>粗体</b><br/>换行\n<font color="red">红色</font> {\\an8}顶部\n<p>段落一</p><p>段落二</p>'));
 assert.equal(output.split('\n').slice(4).join('\n'),'斜体 粗体\n换行\n红色 顶部\n段落一\n段落二\n');
 assert(!output.includes('<'));assert(!output.includes('{\\'));
});
test('script, style, embedded documents, SVG and comments cannot survive as executable payload',()=>{
 const text='正文<script>alert(1)<script>nested</script>more</script><style>::cue{display:none}</style><iframe src="x">hidden</iframe><object>hidden</object><svg><text>hidden</text></svg><!-- hidden --><a href="javascript:alert(1)" onclick="bad()">可读链接</a><img src=x onerror=bad()>';
 const output=srtToWebVtt(cue(text));assert(output.endsWith('\n正文可读链接\n'));assert(!/alert|script|style|hidden|javascript|onerror|onclick|<|>/i.test(output.replace(' --> ','')));
});
test('quoted greater-than signs and unclosed dangerous tags do not leak attributes or code',()=>{
 assert(srtToWebVtt(cue('前<b title=">hello">正文</b>后')).endsWith('\n前正文后\n'));
 assert(srtToWebVtt(cue('前文<script>unclosed')).endsWith('\n前文\n'));
 assert.throws(()=>srtToWebVtt(cue('<script>only executable')));
 assert.throws(()=>srtToWebVtt(cue('<!-- no visible caption -->')));
});
test('entities and literal comparisons remain readable without creating WebVTT markup or timings',()=>{
 const output=srtToWebVtt(cue('A &amp; B &lt; C &gt; D &#x4E2D;&#25991; &quot;引号&quot;\n2 < 3 --> 4\n&lt;script&gt;literal&lt;/script&gt;\n&#0;可见'));
 assert(output.endsWith('\nA &amp; B &lt; C &gt; D 中文 "引号"\n2 &lt; 3 --&gt; 4\n&lt;script&gt;literal&lt;/script&gt;\n可见\n'));
 assert.equal(output.match(/ --> /g)?.length,1,'caption arrow cannot become a timing separator');
});
test('unknown entities remain literal and invalid numeric codepoints disappear',()=>{
 const output=srtToWebVtt(cue('&notARealEntity; &#xD800; &#1114112; 末尾'));
 assert(output.endsWith('\n&amp;notARealEntity;   末尾\n'));
});
test('oversized text, cue bodies and excessive cue counts fail before producing partial output',()=>{
 assert.throws(()=>srtToWebVtt('x'.repeat(MAX_SUBTITLE_CHARACTERS+1)),/2,000,000/);
 assert.throws(()=>srtToWebVtt(cue('x'.repeat(20001))),/20,000/);
 assert.throws(()=>srtToWebVtt(Array(MAX_SUBTITLE_CUES+1).fill(cue('x')).join('\n\n')),/20,000/);
});
