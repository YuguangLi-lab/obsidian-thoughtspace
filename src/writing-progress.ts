import type {Board} from './model';
import {markdownRows} from './markdown-context';
import {writingParts,writingName,writingWordCount} from './writing';
/** Compact comparison token, not a content cache or a cryptographic digest. */
export function writingToken(text:string){let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
export interface ManuscriptSection {title:string;level:number;from:number;to:number;bodyFrom:number;key:string;words:number}
/** Read top-level ATX/single-line Setext headings, matching Obsidian, excluding properties, quotes, lists, comments and code. */
export function manuscriptSections(text:string):ManuscriptSection[]{
 const found:ManuscriptSection[]=[];let offset=0,previous:{text:string;from:number;valid:boolean;lines:number}|undefined;
 for(const row of markdownRows(text)){
  const line=row.visible,valid=!row.code&&row.topLevel,atx=valid?/^ {0,3}(#{1,6})(?:[ \t]+(.*?)|[ \t]*)$/.exec(line):null;
  const setext=valid&&previous?.valid&&previous.lines===1&&previous.text.trim()&&/^ {0,3}(=+|-+)[ \t]*$/.exec(line);
  if(atx||setext){const title=(atx?(atx[2]||'').replace(/[ \t]+#+[ \t]*$/,''):previous!.text.trim()).trim()||'未命名章节';found.push({title,level:atx?atx[1].length:line.trim()[0]==='='?1:2,from:atx?offset:previous!.from,to:text.length,bodyFrom:offset+row.source.length+1,key:'',words:0});}
  const paragraph=valid&&!!line.trim()&&!atx&&!setext&&!/^\s*(?:[-*+]|\d+[.)])\s/.test(line)&&!/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(line);
  previous=paragraph?{text:previous?.valid?previous.text.trim()+' '+line.trim():line,from:previous?.valid?previous.from:offset,valid:true,lines:(previous?.lines||0)+1}:undefined;offset+=row.source.length+1;
 }
 const counts=new Map<string,number>(),occurrences=new Map<string,number>();
 for(let i=0;i<found.length;i++){const s=found[i];s.to=found[i+1]?.from??text.length;s.bodyFrom=Math.min(s.bodyFrom,s.to);s.key=writingToken(text.slice(s.from,s.to).trimEnd());s.words=writingWordCount(text.slice(s.bodyFrom,s.to));counts.set(s.key,(counts.get(s.key)||0)+1);}
 for(const s of found){const key=s.key,index=occurrences.get(key)||0;occurrences.set(key,index+1);s.key=key+':'+counts.get(key)+':'+index;}
 return found;
}
/** Only assembly-affecting content; unrelated geometry, views and reference navigation are omitted. */
export function writingAssemblyStamp(board:Board){return writingToken(JSON.stringify([board.writing?.title||'',board.writing?.includeSources!==false,writingParts(board).map(p=>[p.node.id,writingName(p.node),p.depth,p.note||'',p.node.kind,p.node.text||'',p.node.file||'',p.node.imageUrl||''])]));}
export function pruneWritingCompleted(text:string,completed:readonly string[]=[]){const keys=new Set(manuscriptSections(text).map(s=>s.key));return completed.filter(key=>keys.has(key));}
