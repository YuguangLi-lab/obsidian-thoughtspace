import {Board,Card,contained} from './model';
import {readingOrder,nodeName} from './board-studio';
import {sectionMemberQuery} from './sections';
export interface WritingChapter {id:string;title:string;body:string}
export interface WritingOption {title?:string;level?:number;note?:string;excluded?:boolean}
export interface WritingState {
 manuscript?:string;
 title:string;order:string[];referenceId?:string;draftPath?:string;
 chapters?:WritingChapter[];options?:Record<string,WritingOption>;
 referenceIds?:string[];includeSources?:boolean;
}
const isWritingUnit=(n:Card)=>n.kind==='section'||n.kind==='card'||n.kind==='text'||n.kind==='image';
export function writingUnits(board:Board){return readingOrder(board.nodes.filter(isWritingUnit));}
export function writingChapterNode(chapter:WritingChapter):Card{return {id:chapter.id,kind:'text',text:chapter.body,title:chapter.title,topic:true,x:0,y:0,width:240,height:100,color:'sand'};}
export function writingItems(board:Board){return [...writingUnits(board),...(board.writing?.chapters||[]).map(writingChapterNode)];}
export function writingOrder(board:Board){const ids=new Set(board.nodes.filter(isWritingUnit).map(n=>n.id));for(const chapter of board.writing?.chapters||[])ids.add(chapter.id);return (board.writing?.order||[]).filter(id=>ids.has(id));}
export function moveWriting(order:string[],id:string,index:number){const next=order.filter(value=>value!==id);const before=order.indexOf(id);if(before>=0&&before<index)index--;next.splice(Math.max(0,Math.min(index,next.length)),0,id);return next;}
/** Expand groups once; omissions apply equally to explicit rows and group children. */
export function writingParts(board:Board,order=board.writing?.order||[]){
 // The saved outline chooses order; only children within an included group need
 // geometry sorting. This index belongs to this assembly and cannot become stale.
 const parts:{node:Card;depth:number;note?:string}[]=[],used=new Set<string>(),items=new Map<string,Card>();let groupCount=0;
 for(const node of board.nodes)if(isWritingUnit(node)){items.set(node.id,node);if(node.kind==='section')groupCount++;}
 for(const chapter of board.writing?.chapters||[])items.set(chapter.id,writingChapterNode(chapter));
 // Index dispersed multi-group drafts only. Broadly overlapping frames and
 // single-group previews are cheaper to scan directly. Nothing is cached.
 let members:ReturnType<typeof sectionMemberQuery>|undefined;
 if(groupCount>8&&order.length>8){
  const groups=new Set<Card>();for(const id of order){const node=items.get(id);if(node?.kind==='section'&&!board.writing?.options?.[id]?.excluded)groups.add(node);}
  if(groups.size>8){let area=0,left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const group of groups){area+=group.width*group.height;left=Math.min(left,group.x);top=Math.min(top,group.y);right=Math.max(right,group.x+group.width);bottom=Math.max(bottom,group.y+group.height);}if(Number.isFinite(area)&&area<=(right-left)*(bottom-top)*2)members=sectionMemberQuery(board.nodes);}
 }
 const add=(n:Card,depth:number)=>{const option=board.writing?.options?.[n.id];if(used.has(n.id)||option?.excluded)return false;used.add(n.id);parts.push({node:option?.title?{...n,title:option.title}:n,depth:option?.level??depth,note:option?.note});return true;};
 for(const id of order){const node=items.get(id);if(!node||node.kind==='board'||board.writing?.options?.[id]?.excluded)continue;const added=add(node,2);if(added&&node.kind==='section')for(const child of readingOrder(members?members(node).filter(n=>['card','text','image'].includes(n.kind)):board.nodes.filter(n=>['card','text','image'].includes(n.kind)&&contained(node,n))))add(child,3);}
 return parts;
}
export function writingSignature(board:Board){const w=board.writing;return JSON.stringify({nodes:board.nodes,writing:w&&{title:w.title,order:w.order,chapters:w.chapters,options:w.options,includeSources:w.includeSources}});}
export function writingMarkdown(title:string,parts:{title:string;depth:number;body:string;source?:string}[],boardLink:string){
 if(!title.trim()||!parts.length)throw Error('请填写标题并添加文章内容');
 if(parts.reduce((total,p)=>total+p.body.length,0)>1000000)throw Error('草稿超过 1,000,000 字符，请分章生成');
 const heading=(s:string)=>s.replace(/[\r\n]+/g,' ').replace(/^#+\s*/,'').trim();
 return '# '+heading(title)+'\n\n白板：'+boardLink+'\n\n'+parts.map(p=>(p.depth?'#'.repeat(p.depth)+' '+heading(p.title)+'\n\n':'')+(p.body?p.body.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'').replace(/^# [^\n]*\n/,'').trim()+'\n\n':'')+(p.source?'来源：'+p.source+'\n':'')).join('\n')+'\n';
}
export const writingName=(node:Card)=>node.title||nodeName(node).replace(/^#+\s*/,'').replace(node.file?/\.(md|png|jpe?g|webp|gif|avif)$/i:/$^/,'').slice(0,120);
/** Count CJK runs without an expanded manuscript; retain the native non-CJK fast path. */
export function writingWordCount(text:string){
 const words=/[\p{L}\p{N}]+/gu,cjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;let count=0,word:RegExpExecArray|null;
 if(!cjk.test(text))return (text.match(words)||[]).length;
 while((word=words.exec(text))){let end=0,letter:RegExpExecArray|null;cjk.lastIndex=0;while((letter=cjk.exec(word[0]))){if(letter.index>end)count++;count++;end=letter.index+letter[0].length;}if(end<word[0].length)count++;}
 return count;
}
