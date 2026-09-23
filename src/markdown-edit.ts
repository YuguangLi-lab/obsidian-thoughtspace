import {inlineCodeRanges} from './markdown-literals';
import {markdownColumns} from './markdown-context';
function codeBody(span:string){const n=/^`+/.exec(span)![0].length;let body=span.slice(n,-n).replace(/\r?\n/g,' ');if(body.startsWith(' ')&&body.endsWith(' ')&&/[^ ]/.test(body))body=body.slice(1,-1);return body;}
const escapedAt=(s:string,i:number)=>{let j=i;while(j>0&&s[j-1]==='\\')j--;return (i-j)%2===1;};
function clearProse(text:string){
 text=text.replace(/<(span|mark) style="(?:color|background-color):#[a-f\d]{6}(?:;color:#[a-f\d]{6})?">([\s\S]*?)<\/\1>/gi,'$2').replace(/<(u|sup|sub)>([\s\S]*?)<\/\1>/g,'$2');
 // Do not infer formatting from underscores embedded in identifiers or escaped markers.
 for(const mark of ['**','__','~~','==','*','_']){
  const escaped=mark.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  text=text.replace(new RegExp(escaped+'([^\\n]+?)'+escaped,'g'),(all,body:string,at:number,source:string)=>{
   const end=at+all.length;if(escapedAt(source,at)||escapedAt(source,end-mark.length)||/^\s|\s$/.test(body))return all;
   if(mark.includes('_')&&(/[\p{L}\p{N}_]/u.test(source[at-1]||'')||/[\p{L}\p{N}_]/u.test(source[end]||'')))return all;
   return body;
  });
 }return text;
}
/** Link destinations can contain balanced parentheses; never format their contents. */
function clearLinkedProse(text:string){
 const pattern=/!?\[[^\]\n]*\]\(|\[\[[^\]\n]*\]\]|https?:\/\/[^\s]+/g;let at=0,result='',m:RegExpExecArray|null;
 while((m=pattern.exec(text))){let end=pattern.lastIndex;
  if(m[0].endsWith('](')){let depth=1;for(;end<text.length&&depth;end++){if(escapedAt(text,end))continue;if(text[end]==='(')depth++;else if(text[end]===')')depth--;}if(depth)continue;}
  result+=clearProse(text.slice(at,m.index))+text.slice(m.index,end);at=end;pattern.lastIndex=end;
 }return result+clearProse(text.slice(at));
}
function clearInline(text:string){let at=0,result='';for(const range of inlineCodeRanges(text)){result+=clearLinkedProse(text.slice(at,range.from))+codeBody(text.slice(range.from,range.to));at=range.to;}return result+clearLinkedProse(text.slice(at));}
export type MarkdownCommand = 'bold'|'italic'|'strike'|'highlight'|'code'|'link'|'image'|'wikilink'|'bullet'|'ordered'|'task'|'quote'|'paragraph'|'h1'|'h2'|'h3'|'h4'|'h5'|'h6'|'codeblock'|'table'|'rule'|'callout'|'underline'|'sup'|'sub'|'indent'|'outdent'|'clear'|'comment'|'math';
export interface MarkdownEdit {text:string;start:number;end:number;}
export interface MarkdownEditPlan extends MarkdownEdit {change?:{from:number;to:number;text:string};}
/** Resolve a selection inside inserted text without scanning or splitting the full document. */
export function insertedPosition(origin:{line:number;ch:number},text:string,offset:number){
 let line=origin.line,ch=origin.ch,at=0,next:number;
 while((next=text.indexOf('\n',at))>=0&&next<offset){line++;ch=0;at=next+1;}
 return{line,ch:ch+offset-at};
}
const unhtmlText=(text:string)=>text.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const htmlText=(text:string)=>text.replace(/&(?!(?:#\d+|#x[a-f\d]+|[a-z][a-z\d]+);)/gi,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
/** Count only an adjacent marker run; an unanchored trailing regex can rescan a long prefix. */
function starsBefore(text:string,at:number,min=0){let i=at;while(i>min&&text.charCodeAt(i-1)===42)i--;return at-i;}
function starsAfter(text:string,at:number,max=text.length){let i=at;while(i<max&&text.charCodeAt(i)===42)i++;return i-at;}
/** Local formatting hints for the current line or an exactly wrapped selection. */
export function markdownActive(text:string,start:number,end:number):Set<MarkdownCommand>{
 const active=new Set<MarkdownCommand>(),selected=text.slice(start,end),before=text.slice(Math.max(0,start-4),start),after=text.slice(end,end+4),lineStart=start===0?0:text.lastIndexOf('\n',start-1)+1;
 // Block hints need only the opening marker, not the rest of a potentially huge line.
 const indent=/[^\S\n]*/y;indent.lastIndex=lineStart;indent.exec(text);const contentStart=indent.lastIndex,line=text.slice(contentStart,contentStart+8);
 const heading=/^(#{1,6}) /.exec(line);if(heading)active.add(('h'+heading[1].length) as MarkdownCommand);
 if(/^[-+*] \[[ xX]\] /.test(line))active.add('task');else if(/^[-+*] /.test(line))active.add('bullet');
 const ordered=/\d+[.)] /y;ordered.lastIndex=contentStart;if(ordered.test(text))active.add('ordered');
 if(/^>/.test(line))active.add('quote');
 for(const [id,open,close]of [['bold','**','**'],['strike','~~','~~'],['highlight','==','=='],['code','`','`'],['underline','<u>','</u>']] as const){if((before.endsWith(open)&&after.startsWith(close)&&!escapedAt(text,start-open.length)&&!escapedAt(text,end))||(selected.startsWith(open)&&selected.endsWith(close)&&selected.length>open.length+close.length&&!escapedAt(text,start)&&!escapedAt(text,end-close.length)))active.add(id);}
 const left=starsBefore(text,start)||starsAfter(text,start,end),right=starsAfter(text,end)||starsBefore(text,end,start);if(left%2&&right%2&&!escapedAt(text,start-left)&&!escapedAt(text,end))active.add('italic');
 for(const [id,mark] of [['bold','__'],['italic','_']] as const){const a=selected.startsWith(mark)&&selected.endsWith(mark)?start:start-mark.length,b=selected.startsWith(mark)&&selected.endsWith(mark)?end:end+mark.length;if(a>=0&&text.slice(a,a+mark.length)===mark&&text.slice(b-mark.length,b)===mark&&!escapedAt(text,a)&&!/[\p{L}\p{N}_]/u.test(text[a-1]||'')&&!/[\p{L}\p{N}_]/u.test(text[b]||''))active.add(id);}
 let a=start,b=end;
 for(let pass=0;pass<8;pass++){
  const wrapped=([['bold','**','**'],['italic','*','*'],['strike','~~','~~'],['highlight','==','=='],['code','`','`'],['underline','<u>','</u>']] as const).find(([,open,close])=>text.slice(a-open.length,a)===open&&text.slice(b,b+close.length)===close&&!escapedAt(text,a-open.length));
  if(wrapped){active.add(wrapped[0]);a-=wrapped[1].length;b+=wrapped[2].length;continue;}
  const color=/<(span|mark) style="(?:color|background-color):#[a-f\d]{6}(?:;color:#[a-f\d]{6})?">$/i.exec(text.slice(Math.max(0,a-100),a));
  if(color&&text.slice(b,b+color[1].length+3)===`</${color[1]}>`){a-=color[0].length;b+=color[1].length+3;continue;}break;
 }
 return active;
}
/** Pure selection transforms. The editor owns focus, undo and persistence. */
export function markdownEdit(text:string,start:number,end:number,command:MarkdownCommand|{color:string;background?:boolean}):MarkdownEdit {
 const result=planMarkdownEdit(text,start,end,command);return{text:result.text,start:result.start,end:result.end};
}
/** The exact replacement belongs to the formatting operation, not to a second full-text diff. */
export function planMarkdownEdit(text:string,start:number,end:number,command:MarkdownCommand|{color:string;background?:boolean}):MarkdownEditPlan {
 start=Math.max(0,Math.min(text.length,start));end=Math.max(start,Math.min(text.length,end));
 const unchanged={text,start,end};
 // Properties are data, not body prose. Do not turn YAML fields into Markdown.
 const frontmatter=/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(text);
 if(frontmatter&&start<frontmatter[0].length)return unchanged;
 const selected=text.slice(start,end),eol=text.includes('\r\n')?'\r\n':'\n';
 const replace=(a:number,b:number,value:string,from=0,to=value.length):MarkdownEditPlan=>({text:text.slice(0,a)+value+text.slice(b),start:a+from,end:a+to,change:{from:a,to:b,text:value}});
 if(typeof command==='object'){
  if(!/^#[a-f\d]{6}$/i.test(command.color)||!selected)return unchanged;
  const tag=command.background?'mark':'span',property=command.background?'background-color':'color';
  const value=htmlText(selected);
  const rgb=command.color.slice(1).match(/../g)!.map(n=>parseInt(n,16)),ink=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>150?'#202020':'#ffffff';
  const open=`<${tag} style="${property}:${command.color}${command.background?';color:'+ink:''}">`,close=`</${tag}>`;
  // Recolor the existing wrapper instead of nesting one span for each choice.
  const old=new RegExp(`<${tag} style="${property}:#[a-f\\d]{6}(?:;color:#[a-f\\d]{6})?">$`,'i').exec(text.slice(Math.max(0,start-100),start));
  const a=old&&text.slice(end,end+close.length)===close?start-old[0].length:start,b=a<start?end+close.length:end;
  return replace(a,b,open+value+close,open.length,open.length+value.length);
 }
 if(['underline','sup','sub'].includes(command)){
  const tag=command==='underline'?'u':command,open=`<${tag}>`,close=`</${tag}>`;
  if(selected.startsWith(open)&&selected.endsWith(close))return replace(start,end,unhtmlText(selected.slice(open.length,-close.length)));
  if(text.slice(start-open.length,start)===open&&text.slice(end,end+close.length)===close)return replace(start-open.length,end+close.length,unhtmlText(selected));
  const value=htmlText(selected||'文字');return replace(start,end,open+value+close,open.length,open.length+value.length);
 }
 if(command==='code'){
  const range=inlineCodeRanges(text).find(r=>(r.from===start&&r.to===end)||(()=>{
   const n=/^`+/.exec(text.slice(r.from))![0].length,raw=text.slice(r.from+n,r.to-n),pad=raw.startsWith(' ')&&raw.endsWith(' ')&&/[^ ]/.test(raw)?1:0;
   return (start===r.from+n&&end===r.to-n)||(start===r.from+n+pad&&end===r.to-n-pad);
  })());
  if(range)return replace(range.from,range.to,codeBody(text.slice(range.from,range.to)));
 }
 if(command==='clear'){
  if(!selected)return unchanged;
  let a=start,b=end,content=selected;
  // Expand through immediate matching wrappers; do not touch links or list structure.
  const wrappers=[['**','**'],['__','__'],['~~','~~'],['==','=='],['*','*'],['_','_'],['`','`'],['<u>','</u>'],['<sup>','</sup>'],['<sub>','</sub>']];
  for(let pass=0;pass<8;pass++){const pair=wrappers.find(([open,close])=>text.slice(a-open.length,a)===open&&text.slice(b,b+close.length)===close&&!escapedAt(text,a-open.length)&&(!open.includes('_')||(!/[\p{L}\p{N}_]/u.test(text[a-open.length-1]||'')&&!/[\p{L}\p{N}_]/u.test(text[b+close.length]||''))));if(pair){a-=pair[0].length;b+=pair[1].length;continue;}const html=/<(span|mark) style="(?:color|background-color):#[a-f\d]{6}(?:;color:#[a-f\d]{6})?">$/i.exec(text.slice(Math.max(0,a-100),a));if(html&&text.slice(b,b+html[1].length+3)===`</${html[1]}>`){a-=html[0].length;b+=html[1].length+3;continue;}break;}
  const codeRange=inlineCodeRanges(text).find(r=>{const run=/^`+/.exec(text.slice(r.from))![0].length,raw=text.slice(r.from+run,r.to-run),pad=raw.startsWith(' ')&&raw.endsWith(' ')&&/[^ ]/.test(raw)?1:0;return start===r.from+run+pad&&end===r.to-run-pad;});
  if(codeRange)return replace(codeRange.from,codeRange.to,codeBody(text.slice(codeRange.from,codeRange.to)));
  content=clearInline(content);
  return replace(a,b,content);
 }
 if(command==='indent'||command==='outdent'){
  const a=start===0?0:text.lastIndexOf('\n',start-1)+1,last=end>start&&text[end-1]==='\n'?end-1:end,next=text.indexOf('\n',last),b=next<0?text.length:text[next-1]==='\r'?next-1:next;
  return replace(a,b,text.slice(a,b).split(/\r?\n/).map(line=>command==='indent'?'    '+line:line.replace(/^(?:\t| {1,4})/,'')).join(eol));
 }
 const marks:Partial<Record<MarkdownCommand,string>>={bold:'**',italic:'*',strike:'~~',highlight:'==',code:'`',comment:'%%',math:'$'};
 let mark=marks[command];
 if(mark){
  if(command==='bold'||command==='italic'){
   const alias=command==='bold'?'__':'_',inside=selected.startsWith(alias)&&selected.endsWith(alias)&&selected.length>alias.length*2,a=inside?start:start-alias.length,b=inside?end:end+alias.length;
   if(a>=0&&text.slice(a,a+alias.length)===alias&&text.slice(b-alias.length,b)===alias&&!escapedAt(text,a)&&!escapedAt(text,b-alias.length)&&!/[\p{L}\p{N}_]/u.test(text[a-1]||'')&&!/[\p{L}\p{N}_]/u.test(text[b]||''))return replace(a,b,text.slice(a+alias.length,b-alias.length));
  }
  if(['bold','italic','strike','highlight'].includes(command)&&/\n[ \t]*\r?\n/.test(selected))return replace(start,end,selected.split(/(\r?\n[ \t]*\r?\n)/).map((part,i)=>i%2?part:markdownEdit(part,0,part.length,command).text).join(''));
  const italicSelected=command!=='italic'||(starsAfter(text,start,end)%2===1&&starsBefore(text,end,start)%2===1);
  const italicOutside=command!=='italic'||(starsBefore(text,start)%2===1&&starsAfter(text,end)%2===1);
  if(command!=='code'&&!escapedAt(text,start)&&italicSelected&&selected.startsWith(mark)&&selected.endsWith(mark)&&selected.length>=mark.length*2)return replace(start,end,selected.slice(mark.length,-mark.length));
  if(command!=='code'&&!escapedAt(text,start-mark.length)&&italicOutside&&text.slice(start-mark.length,start)===mark&&text.slice(end,end+mark.length)===mark)return replace(start-mark.length,end+mark.length,selected);
  const leading=command==='code'?'':/^\s*/.exec(selected)![0],trailing=command==='code'||!selected.trim()?'':/\s*$/.exec(selected)![0];
  const content=(command==='code'?selected:selected.trim())||'文字';
  if(command==='code'){const runs=content.match(/`+/g)||[];mark='`'.repeat(Math.max(0,...runs.map(r=>r.length))+1);}
  const pad=command==='code'&&(content.startsWith('`')||content.endsWith('`')||(content.startsWith(' ')&&content.endsWith(' ')&&/[^ ]/.test(content)))?' ':'';
  const offset=leading.length+mark.length+pad.length;
  return replace(start,end,leading+mark+pad+content+pad+mark+trailing,offset,offset+content.length);
 }
 if(['link','image','wikilink'].includes(command)){
  const label=(selected||'文字').replace(/[\r\n]+/g,' ');
  if(command==='wikilink'){const target=(selected||'笔记名称').replace(/[\r\n[\]|]/g,' ');return replace(start,end,'[['+target+']]',2,2+target.length);}
  const prefix=(command==='image'?'!':'')+'['+label.replace(/([\\[\]])/g,'\\$1')+'](';
  return replace(start,end,prefix+'https://)',prefix.length,prefix.length+8);
 }
 if(['bullet','ordered','task','quote','paragraph','h1','h2','h3','h4','h5','h6'].includes(command)){
  const a=start===0?0:text.lastIndexOf('\n',start-1)+1;
  const last=end>start&&text[end-1]==='\n'?end-1:end;
  const next=text.indexOf('\n',last),b=next<0?text.length:text[next-1]==='\r'?next-1:next;
  const lines=text.slice(a,b).replace(/\r$/,'').split(/\r?\n/);
  const marker=command==='bullet'?/^[-+*] (?!\[[ xX]\] )/:command==='ordered'?/^\d+[.)] /:command==='task'?/^(?:[-+*]|\d+[.)]) \[[ xX]\] /:command==='quote'?/^> ?/:command.startsWith('h')?new RegExp('^#{'+command.slice(1)+'} '):/^#{1,6} /;
  const remove=command==='paragraph'||lines.some(line=>line.trim())&&lines.filter(line=>line.trim()).every(line=>marker.test(line.trimStart()));
  const numbering:{indent:number;count:number}[]=[];
  const value=lines.map(line=>{const indent=/^[\t ]*/.exec(line)![0],body=line.slice(indent.length);if(lines.length>1&&!body.trim())return line;if(remove)return indent+(command==='task'?body.replace(/^(\d+[.)] )\[[ xX]\] /,'$1').replace(/^[-+*] \[[ xX]\] /,''):body.replace(marker,''));
   const col=markdownColumns(indent);while(numbering.length&&numbering.at(-1)!.indent>col)numbering.pop();if(!numbering.length||numbering.at(-1)!.indent<col)numbering.push({indent:col,count:0});const number=++numbering.at(-1)!.count;
   const prefix=command==='bullet'?'- ':command==='ordered'?`${number}. `:command==='task'?'- [ ] ':command==='quote'?'> ':'#'.repeat(Number(command.slice(1)))+' ';
   const clean=command==='quote'?body:command.startsWith('h')?body.replace(/^#{1,6} /,''):body.replace(/^(?:[-+*] (?:\[[ xX]\] )?|\d+[.)] )/,'');
   return indent+prefix+clean;
  }).join(eol);
  return replace(a,b,value);
 }
 let content:string;
 if(command==='codeblock'){const body=selected||'代码';const fence='`'.repeat(Math.max(2,...(body.match(/`+/g)||[]).map(r=>r.length))+1);content=fence+eol+body+eol+fence;}
 else if(command==='callout')content='> [!note] '+(selected?'笔记':'标题')+eol+(selected||'内容').split(/\r?\n/).map(line=>'> '+line).join(eol);
 else if(command==='rule')content='---';
 else content='| '+(selected||'标题').replace(/[\r\n|]/g,' ')+' | 标题 |'+eol+'| --- | --- |'+eol+'| 内容 | 内容 |';
 const before=text.slice(0,start),after=text.slice(end);
 const prefix=before&&!before.endsWith(eol+eol)?before.endsWith(eol)?eol:eol+eol:'';
 const suffix=after&&!after.startsWith(eol+eol)?after.startsWith(eol)?eol:eol+eol:'';
 return replace(start,end,prefix+content+suffix,prefix.length,prefix.length+content.length);
}
