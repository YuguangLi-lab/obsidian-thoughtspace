import {Board,Card,contained} from './model';
import {readingOrder,nodeName} from './board-studio';
export interface WritingChapter {id:string;title:string;body:string}
export interface WritingOption {title?:string;level?:number;note?:string;excluded?:boolean}
export interface WritingState {
 manuscript?:string;
 title:string;order:string[];referenceId?:string;draftPath?:string;
 chapters?:WritingChapter[];options?:Record<string,WritingOption>;
 referenceIds?:string[];includeSources?:boolean;
}
export function writingUnits(board:Board){return readingOrder(board.nodes.filter(n=>['section','card','text','image'].includes(n.kind)));}
export function writingChapterNode(chapter:WritingChapter):Card{return {id:chapter.id,kind:'text',text:chapter.body,title:chapter.title,topic:true,x:0,y:0,width:240,height:100,color:'sand'};}
export function writingItems(board:Board){return [...writingUnits(board),...(board.writing?.chapters||[]).map(writingChapterNode)];}
export function writingOrder(board:Board){const ids=new Set(writingItems(board).map(n=>n.id));return (board.writing?.order||[]).filter(id=>ids.has(id));}
export function moveWriting(order:string[],id:string,index:number){const next=order.filter(value=>value!==id);const before=order.indexOf(id);if(before>=0&&before<index)index--;next.splice(Math.max(0,Math.min(index,next.length)),0,id);return next;}
/** Expand groups once; omissions apply equally to explicit rows and group children. */
export function writingParts(board:Board,order=writingOrder(board)){
 const parts:{node:Card;depth:number;note?:string}[]=[],used=new Set<string>(),items=new Map(writingItems(board).map(n=>[n.id,n]));
 const add=(n:Card,depth:number)=>{const option=board.writing?.options?.[n.id];if(used.has(n.id)||option?.excluded)return;used.add(n.id);parts.push({node:option?.title?{...n,title:option.title}:n,depth:option?.level??depth,note:option?.note});};
 for(const id of order){const node=items.get(id);if(!node||node.kind==='board'||board.writing?.options?.[id]?.excluded)continue;add(node,2);if(node.kind==='section')for(const child of readingOrder(board.nodes.filter(n=>['card','text','image'].includes(n.kind)&&contained(node,n))))add(child,3);}
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
export function writingWordCount(text:string){return (text.replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,' $1 ').match(/[\p{L}\p{N}]+/gu)||[]).length;}
