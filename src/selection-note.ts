import {markdownRows} from './markdown-context';
import {inlineLiteralRanges} from './markdown-literals';
export interface NoteSelection{text:string;start:number;end:number;disabledReason?:string;}
export function selectionNoteTitle(s:NoteSelection){
 if(s.disabledReason)throw Error(s.disabledReason);if(!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>s.text.length||s.start>=s.end)throw Error('请先选择一个概念或短语');
 const selected=s.text.slice(s.start,s.end);if(!selected.trim()||selected.length>120||/[\r\n[\]|\\]/.test(selected))throw Error('请选择单行短语（最多 120 字，不含双链标记）');
 const index=s.text.slice(0,s.start).split('\n').length-1,row=[...markdownRows(s.text)][index],offset=s.text.lastIndexOf('\n',s.start-1)+1,from=s.start-offset,to=s.end-offset;
 // A top-level fenced example can itself contain quote markers. Keep that fence
 // independent from blockquote context so literal example text stays literal.
 let fence='';for(const line of s.text.split('\n').slice(0,index+1)){const marker=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);if(!marker)continue;if(!fence){if(!(marker[1][0]==='`'&&marker[2].includes('`')))fence=marker[1];}else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length&&!marker[2].trim())fence='';}
 if(fence)throw Error('请在普通正文中选择文字，避开代码块');
 if(row.code||row.visible.slice(from,to)!==selected||inlineLiteralRanges(row.visible).some(r=>r.from<to&&r.to>from))throw Error('请在普通正文中选择文字，避开代码、属性和隐藏注释');
 for(const match of row.visible.matchAll(/!?\[\[[^\n]*?\]\]|!?\[[^\n]*?\]\([^\n]*?\)/g)){if(match.index<to&&match.index+match[0].length>from)throw Error('这段文字已经在链接中，请选择普通正文');}
 return selected.trim();
}
export function sameNoteSelection(a:NoteSelection,b:NoteSelection){return !b.disabledReason&&a.text===b.text&&a.start===b.start&&a.end===b.end;}
