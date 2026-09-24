import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markdownEdit,markdownActive} from '../src/markdown-edit';

test('formatting wraps only the selected Chinese text and toggles off',()=>{
 const a=markdownEdit('这是重点。',2,4,'bold');assert.equal(a.text,'这是**重点**。');assert.equal(a.text.slice(a.start,a.end),'重点');
 assert.equal(markdownEdit(a.text,a.start,a.end,'bold').text,'这是重点。');
});
test('empty selection supplies a selected placeholder',()=>{const a=markdownEdit('',0,0,'bold');assert.deepEqual(a,{text:'**文字**',start:2,end:4});});
test('surrounding spaces remain outside emphasis',()=>{assert.equal(markdownEdit(' 重点 ',0,4,'bold').text,' **重点** ');});
test('italic toggling composes with bold instead of stripping it',()=>{const a=markdownEdit('**重点**',2,4,'italic');assert.equal(a.text,'***重点***');assert.equal(markdownEdit(a.text,a.start,a.end,'italic').text,'**重点**');assert.equal(markdownEdit('**重点**',0,6,'italic').text,'***重点***');});
test('converting completed tasks into bullets removes the checkbox marker',()=>{assert.equal(markdownEdit('- [x] 甲',0,7,'bullet').text,'- 甲');});
test('lists transform only selected lines, excluding following newline boundary',()=>{
 const a=markdownEdit('第一\n第二\n第三',0,6,'ordered');assert.equal(a.text,'1. 第一\n2. 第二\n第三');
 assert.equal(markdownEdit(a.text,a.start,a.end,'task').text,'- [ ] 第一\n- [ ] 第二\n第三');
});
test('task toggle removes markers and preserves nesting indentation',()=>{assert.equal(markdownEdit('  - [x] 甲\n  - [ ] 乙',0,19,'task').text,'  甲\n  乙');});
test('headings replace previous levels and paragraph removes headings',()=>{const a=markdownEdit('### 标题',5,5,'h1');assert.equal(a.text,'# 标题');assert.equal(markdownEdit(a.text,0,4,'paragraph').text,'标题');});
test('line transforms preserve CRLF and the next untouched line',()=>{assert.equal(markdownEdit('甲\r\n乙\r\n丙',0,4,'bullet').text,'- 甲\r\n- 乙\r\n丙');});
test('line transform at the beginning of an empty line stays on that line',()=>{assert.equal(markdownEdit('\n正文',0,0,'quote').text,'> \n正文');});
test('properties are protected while body remains editable',()=>{const t='---\ntags: [a]\n---\n正文';assert.equal(markdownEdit(t,4,8,'bold').text,t);assert.equal(markdownEdit(t,t.length-2,t.length,'bold').text,t.slice(0,-2)+'**正文**');});
test('links preserve labels and select the URL placeholder',()=>{const a=markdownEdit('阅读',0,2,'link');assert.equal(a.text,'[阅读](https://)');assert.equal(a.text.slice(a.start,a.end),'https://');});
test('image and Obsidian wikilink syntax are valid',()=>{assert.equal(markdownEdit('图',0,1,'image').text,'![图](https://)');assert.equal(markdownEdit('笔记',0,2,'wikilink').text,'[[笔记]]');});
test('fenced code chooses a fence longer than embedded fences',()=>{const a=markdownEdit('```js\nfoo\n```',0,13,'codeblock');assert.ok(a.text.startsWith('````\n'));assert.ok(a.text.endsWith('\n````'));});
test('block insertions separate adjacent paragraphs',()=>{const a=markdownEdit('甲乙',1,1,'rule');assert.equal(a.text,'甲\n\n---\n\n乙');});
test('callout prefixes each selected line',()=>{assert.equal(markdownEdit('甲\n乙',0,3,'callout').text,'> [!note] 笔记\n> 甲\n> 乙');});
test('table insertion retains selected literal pipes as escaped cell content',()=>{const value=markdownEdit('甲|乙',0,3,'table');assert.equal(value.text,'| 标题 | 标题 | 标题 |\n| --- | --- | --- |\n| 甲\\|乙 |  |  |');assert.equal(value.text.slice(value.start,value.end),'甲\\|乙');});
test('underline and superscript toggle while keeping the selection',()=>{for(const id of ['underline','sup','sub'] as const){const a=markdownEdit('重点',0,2,id);assert.equal(a.text.slice(a.start,a.end),'重点');assert.equal(markdownEdit(a.text,a.start,a.end,id).text,'重点');}});
test('selected text colors do not color the surrounding paragraph',()=>{const a=markdownEdit('前重点后',1,3,{color:'#3478c6'});assert.equal(a.text,'前<span style="color:#3478c6">重点</span>后');assert.equal(a.text.slice(a.start,a.end),'重点');});
test('color changes replace a wrapper and preserve entities instead of nesting',()=>{const a=markdownEdit('A & B',0,5,{color:'#3478c6'}),b=markdownEdit(a.text,a.start,a.end,{color:'#ff0000'});assert.equal(b.text,'<span style="color:#ff0000">A &amp; B</span>');});
test('dark and light highlight backgrounds get contrasting text',()=>{assert.match(markdownEdit('字',0,1,{color:'#111111',background:true}).text,/;color:#ffffff/);assert.match(markdownEdit('字',0,1,{color:'#fff1a8',background:true}).text,/;color:#202020/);});
test('invalid colors and empty color selections make no edit',()=>{assert.equal(markdownEdit('字',0,1,{color:'red;position:fixed'}).text,'字');assert.equal(markdownEdit('字',0,0,{color:'#112233'}).text,'字');});
test('indent and outdent preserve nested tasks, numbering and CRLF',()=>{const t='- [x] 甲\r\n  1. 乙\r\n丙',a=markdownEdit(t,0,t.indexOf('丙'),'indent');assert.equal(a.text,'    - [x] 甲\r\n      1. 乙\r\n丙');assert.equal(markdownEdit(a.text,a.start,a.end,'outdent').text,t);});
test('clear selected text removes its matching inline wrappers',()=>{const a=markdownEdit('**重点**',2,4,{color:'#3478c6'});assert.equal(markdownEdit(a.text,a.start,a.end,'clear').text,'重点');});
test('clear preserves URLs and wikilinks with underscores',()=>{const t='**重点** [链接](https://a/b_c_d) [[a_b_c]]';assert.equal(markdownEdit(t,0,t.length,'clear').text,'重点 [链接](https://a/b_c_d) [[a_b_c]]');});
test('comments and math wrap selection with Obsidian syntax',()=>{assert.equal(markdownEdit('说明',0,2,'comment').text,'%%说明%%');assert.equal(markdownEdit('x^2',0,3,'math').text,'$x^2$');});
test('toolbar state reflects exact emphasis, headings and task lines',()=>{const a=markdownActive('***重点***',3,5);assert.ok(a.has('bold')&&a.has('italic'));assert.ok(markdownActive('## 标题',4,4).has('h2'));assert.ok(markdownActive('- [ ] 任务',7,7).has('task'));assert.equal(markdownActive('正文',0,2).size,0);});
test('toolbar states recognize nested underline and emphasis through color markup',()=>{const t='**<u><span style="color:#3478c6">重点</span></u>**',i=t.indexOf('重点'),active=markdownActive(t,i,i+2);assert.ok(active.has('bold')&&active.has('underline'));});

test('format hints stay local at line boundaries in long documents',()=>{
 const tail='正文\n'.repeat(20000),text='## 标题\r\n\n**重点**\n'+tail,at=text.indexOf('重点');
 assert.deepEqual([...markdownActive(text,at,at+2)],['bold']);
 assert.ok(markdownActive(text,0,0).has('h2'));
 assert.equal(markdownActive(text,text.indexOf('\n')+1,text.indexOf('\n')+1).has('h2'),false);
 const span='<u><span style="color:#c03467">重点</span></u>',long=tail+span,i=long.indexOf('重点');
 assert.ok(markdownActive(long,i,i+2).has('underline'));
});

test('local emphasis detection preserves odd and even runs around selections',()=>{
 for(let n=1;n<=12;n++){
  const mark='*'.repeat(n),text='前\n'+mark+'重点'+mark+'\n后',at=2+n;
  assert.equal(markdownActive(text,at,at+2).has('italic'),n%2===1);
  const edit=markdownEdit(text,at,at+2,'italic');
  assert.equal(edit.text,'前\n'+'*'.repeat(n+(n%2?-1:1))+'重点'+'*'.repeat(n+(n%2?-1:1))+'\n后');
 }
});
test('emphasis markers within the selected range keep their original behavior',()=>{
 for(const [text,expected] of [['*字*',true],['**字**',false],['***字***',true],['字*',false],['*字',false]] as const)
  assert.equal(markdownActive(text,0,text.length).has('italic'),expected);
});
test('distant star runs do not affect a plain paragraph or italic edit',()=>{
 const prefix='*'.repeat(100000)+'x\n',text=prefix+'重点',at=prefix.length;
 assert.deepEqual([...markdownActive(text,at,at+2)],[]);
 assert.equal(markdownEdit(text,at,at+2,'italic').text,prefix+'*重点*');
});
test('long adjacent runs are counted accurately without trailing regex backtracking',()=>{
 const n=100001,mark='*'.repeat(n),text=mark+'字'+mark;
 assert.ok(markdownActive(text,n,n+1).has('italic'));
 const edit=markdownEdit(text,n,n+1,'italic');assert.equal(edit.text,'*'.repeat(n-1)+'字'+'*'.repeat(n-1));
});
test('recoloring at the end of a large document replaces only its immediate wrapper',()=>{
 const prefix=('正文\n').repeat(30000),first=markdownEdit(prefix+'字',prefix.length,prefix.length+1,{color:'#123456',background:true});
 const next=markdownEdit(first.text,first.start,first.end,{color:'#abcdef',background:true});
 assert.equal(next.text,prefix+'<mark style="background-color:#abcdef;color:#202020">字</mark>');
});


test('empty table insertion supplies three columns and selects the first heading',()=>{
 const value=markdownEdit('',0,0,'table');assert.equal(value.text,'| 标题 | 标题 | 标题 |\n| --- | --- | --- |\n| 内容 |  |  |\n| 内容 |  |  |');assert.equal(value.text.slice(value.start,value.end),'标题');
});
test('selected lines become distinct table rows and retain CRLF and existing escaped pipes',()=>{
 const text='开头\r\n\r\n甲\\|乙\r\n丙|丁\r\n\r\n结尾',start=text.indexOf('甲'),end=text.indexOf('\r\n\r\n结尾');
 const value=markdownEdit(text,start,end,'table');
 assert.equal(value.text,'开头\r\n\r\n| 标题 | 标题 | 标题 |\r\n| --- | --- | --- |\r\n| 甲\\|乙 |  |  |\r\n| 丙\\|丁 |  |  |\r\n\r\n结尾');
 assert.equal(value.text.slice(value.start,value.end),'甲\\|乙');
});
test('table escaping distinguishes a literal backslash before an unescaped separator',()=>{
 const value=markdownEdit(String.raw`甲\\|乙`,0,5,'table');assert.ok(value.text.includes(String.raw`甲\\\|乙`));
});
test('formula placeholders are mathematical and select just the editable expression',()=>{
 const inline=markdownEdit('',0,0,'math');assert.equal(inline.text,'$x^2$');assert.equal(inline.text.slice(inline.start,inline.end),'x^2');
 const block=markdownEdit('',0,0,'mathblock');assert.equal(block.text,'$$\nE = mc^2\n$$');assert.equal(block.text.slice(block.start,block.end),'E = mc^2');
});
test('display math preserves expression slashes and multiline source between adjacent paragraphs',()=>{
 const expression=String.raw`\begin{aligned}
a&=b+c\\
d&=e
\end{aligned}`,text='前文'+expression+'后文',value=markdownEdit(text,2,text.length-2,'mathblock');
 assert.equal(value.text,'前文\n\n$$\n'+expression+'\n$$\n\n后文');assert.equal(value.text.slice(value.start,value.end),expression);
});
test('display math uses existing CRLF without rewriting unselected text',()=>{
 const value=markdownEdit('前\r\nx+y\r\n后',3,6,'mathblock');assert.equal(value.text,'前\r\n\r\n$$\r\nx+y\r\n$$\r\n\r\n后');assert.equal(value.text.slice(value.start,value.end),'x+y');
});
