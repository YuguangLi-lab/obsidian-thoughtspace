import type {Board} from './model';
import {sourceLinkParts,textExcerptPresentation} from './excerpt-sources';
import {markdownRows} from './markdown-context';
import {markdownLinkRanges} from './markdown-links';
import {inlineCodeRanges} from './markdown-literals';
export interface BoardUsage {boardPath:string;nodeId:string;title:string;path:string;subpath:string;mode:'note'|'embed'|'snapshot';location:string;identity:string;}
/** Pure query over a board and optional, already-read card notes. It never expands
 * ordinary outgoing links into reuse, or reads source-note bodies recursively. */
export function boardUsages(board:Board,boardPath:string,resolve:(path:string,context:string)=>string|undefined,cardTexts?:ReadonlyMap<string,string>):BoardUsage[]{
 const result:BoardUsage[]=[];
 for(const n of board.nodes){const found=new Map<string,BoardUsage>();
  const add=(path:string,subpath:string,mode:BoardUsage['mode'],location:string,key='')=>{if(!path)return;const identity=JSON.stringify([path,subpath,mode,key]);found.set(identity,{boardPath,nodeId:n.id,title:n.title||n.file?.split('/').pop()||n.text?.split('\n')[0].slice(0,100)||'未命名卡片',path,subpath,mode,location,identity});};
  const link=(text:string,mode:BoardUsage['mode'],location:string,key='',context=boardPath)=>{const candidates=sourceLinkParts(text);const hit=candidates.map(p=>({...p,resolved:resolve(p.path,context)})).find(p=>p.resolved);const p=hit||candidates[0];if(p)add(hit?.resolved||p.path,p.subpath,mode,location||p.subpath||'整篇笔记',key);};
  if(n.kind==='card'&&n.file){
   add(n.file,'','note','整篇笔记');
   // Material excerpts stored in native Markdown remain explicit source usages.
   // Resolve their relative links beside the card note, never beside the board.
   const raw=cardTexts?.get(n.file);if(raw)for(const s of textExcerptPresentation(raw).sources)link(s.link,'snapshot',s.location,s.location,n.file);
  }
  if(n.paragraphQuote){const o=n.paragraphQuote;add(o.path,o.subpath||'',o.mode,o.mode==='embed'?o.subpath:`字符 ${o.from}–${o.to}`,o.mode==='snapshot'?JSON.stringify([o.hash,o.from,o.to]):'');}
  else if(n.kind==='text'){
   const parsed=textExcerptPresentation(n.text||'');for(const s of parsed.sources)link(s.link,'snapshot',s.location,s.location);
   // Code spans may cross a soft line break. Keep their document offsets while
   // the row parser masks fenced code, properties and hidden comments.
   const code=inlineCodeRanges(parsed.body);let offset=0,codeIndex=0;
   for(const row of markdownRows(parsed.body)){
    if(!row.code)for(const range of markdownLinkRanges(row.visible)){
     const bang=range.from-1;if(bang<0||row.visible[bang]!=='!')continue;
     let slash=bang;while(slash>0&&row.visible[slash-1]==='\\')slash--;if((bang-slash)%2)continue;
     const position=offset+bang;while(codeIndex<code.length&&code[codeIndex].to<=position)codeIndex++;
     if(codeIndex<code.length&&code[codeIndex].from<=position)continue;
     link(row.visible.slice(range.from,range.to),'embed','');
    }
    offset+=row.source.length+1;
   }
  }
  result.push(...found.values());
 }return result;
}
