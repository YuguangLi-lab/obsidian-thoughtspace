import {test} from 'node:test';
import assert from 'node:assert/strict';
import {insertedPosition,planMarkdownEdit,markdownEdit,MarkdownCommand} from '../src/markdown-edit';

const position=(text:string,offset:number)=>{const lines=text.slice(0,offset).split('\n');return{line:lines.length-1,ch:lines.at(-1)!.length};};
const verify=(text:string,start:number,end:number,command:MarkdownCommand|{color:string;background?:boolean})=>{
 const plan=planMarkdownEdit(text,start,end,command),result=markdownEdit(text,start,end,command);
 assert.deepEqual({text:plan.text,start:plan.start,end:plan.end},result);
 if(!plan.change){assert.equal(plan.text,text);return;}
 const c=plan.change;assert.ok(c.from>=0&&c.to>=c.from&&c.to<=text.length);
 assert.equal(text.slice(0,c.from)+c.text+text.slice(c.to),plan.text);
 assert.ok(plan.start>=c.from&&plan.end<=c.from+c.text.length&&plan.end>=plan.start);
 for(const offset of [plan.start,plan.end])assert.deepEqual(insertedPosition(position(text,c.from),c.text,offset-c.from),position(plan.text,offset));
};
test('format plans carry a local change for a phrase at the end of a long note',()=>{
 const prefix='原始正文\n'.repeat(30000),plan=planMarkdownEdit(prefix+'重点。',prefix.length,prefix.length+2,'bold');
 assert.deepEqual(plan.change,{from:prefix.length,to:prefix.length+2,text:'**重点**'});
});
test('all supported Markdown commands preserve exact changes and final selections',()=>{
 const commands:MarkdownCommand[]=['bold','italic','strike','highlight','code','link','image','wikilink','bullet','ordered','task','quote','paragraph','h1','h2','h3','h4','h5','h6','codeblock','table','rule','callout','underline','sup','sub','indent','outdent','clear','comment','math','mathblock'];
 for(const text of ['', '前重点后', '第一\n第二\n第三', '前\r\n- [x] 任务\r\n后', '## 标题\n\n**重点**', '正文🙂\n尾部'])
 for(const command of commands)for(const [from,to] of [[0,0],[0,text.length],[Math.floor(text.length/2),text.length],[text.length,text.length]])verify(text,from,to,command);
});
test('nested wrappers can expand replacement beyond the original logical selection',()=>{
 const text='前<u>**重点**</u>后',start=text.indexOf('重点');verify(text,start,start+2,'clear');
 const p=planMarkdownEdit(text,start,start+2,'clear');assert.deepEqual(p.change,{from:1,to:text.length-1,text:'重点'});
});
test('color changes keep entity encoding and selection positions within inserted text',()=>{
 const text='第一\nA & B\n最后',at=text.indexOf('A');verify(text,at,at+5,{color:'#123456'});
 const colored=planMarkdownEdit(text,at,at+5,{color:'#123456'});verify(colored.text,colored.start,colored.end,{color:'#abcdef'});
 verify(text,at,at+5,{color:'#112233',background:true});
});
test('protected YAML and invalid commands produce no transaction',()=>{
 for(const p of [planMarkdownEdit('---\ntags: [a]\n---\n正文',4,8,'bold'),planMarkdownEdit('字',0,1,{color:'invalid'}),planMarkdownEdit('字',0,0,{color:'#123456'})])assert.equal(p.change,undefined);
});
test('inserted positions handle CRLF, empty lines and UTF-16 offsets',()=>{
 const prefix='开头\n前🙂',insert='🙂\r\n甲\n\n末尾';for(let i=0;i<=insert.length;i++)assert.deepEqual(insertedPosition(position(prefix,prefix.length),insert,i),position(prefix+insert,prefix.length+i));
});
