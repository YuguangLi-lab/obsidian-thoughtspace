import {hasAsciiControl} from './value-guards';
import {createHash} from 'crypto';
import type {Board} from './model';
import {boardLink,parseBoardLink} from './deeplinks';
export const SEARCH_FOLDER='ThoughtSpace/白板搜索';
export const searchIndexPath=(path:string)=>`${SEARCH_FOLDER}/${path}.md`;
export function searchBoardPath(path:string){
 if(!path.startsWith(SEARCH_FOLDER+'/')||!path.endsWith('.thoughtspace.md'))return;
 const file=path.slice(SEARCH_FOLDER.length+1,-3);
 if(!file||hasAsciiControl(file)||/(^\/|(^|\/)\.\.?(\/|$)|\\)/.test(file))return;
 return file;
}
const checksum=(text:string)=>createHash('sha256').update(text).digest('hex');
export function isManagedSearchIndex(text:string){const match=/^<!-- thoughtspace-search-v1:([a-f0-9]{64}) -->\n/.exec(text);return !!match&&checksum(text.slice(match[0].length))===match[1];}
/** Resolve only generated navigation links, never links quoted inside node content. */
export function searchIndexTarget(path:string,text:string,vault:string,line?:number){
 const file=searchBoardPath(path);if(!file||!isManagedSearchIndex(text))return;
 let target:{file:string;node?:string},fence='';
 const lines=text.split('\n'),opening=/^\[打开白板\]\((obsidian:\/\/thoughtspace\?[^\s]+)\)$/.exec(lines[3]||'');
 if(!opening)return;
 try{target=parseBoardLink(Object.fromEntries(new URL(opening[1]).searchParams),vault);if(target.file!==file||target.node)return;}catch{return;}
 const limit=typeof line==='number'&&Number.isInteger(line)&&line>=0&&line<lines.length?line:0;
 for(let i=0;i<=limit&&i<lines.length;i++){
  const value=lines[i];
  if(fence){if(value===fence)fence='';continue;}
  const code=/^(`{3,})text$/.exec(value);if(code){fence=code[1];continue;}
  const link=/^\[(?:打开白板|定位 对象|定位 分组|定位连线起点)\]\((obsidian:\/\/thoughtspace\?[^\s]+)\)$/.exec(value);if(!link)continue;
  try{const parsed=parseBoardLink(Object.fromEntries(new URL(link[1]).searchParams),vault);if(parsed.file!==file)return;target=parsed;}catch{return;}
 }
 return target;
}
/** Code fences retain exact searchable characters without executing embeds or tasks. */
const plain=(text:string)=>{let longest=0;for(const match of text.matchAll(/`+/g))longest=Math.max(longest,match[0].length);const fence='`'.repeat(Math.max(3,longest+1));return `${fence}text\n${text}\n${fence}`;};
export function boardSearchDocument(board:Board,path:string,vault:string){
 const chunks=[`# ${path.split('/').pop()!.replace(/\.thoughtspace$/,'')} · 白板搜索`, `[打开白板](${boardLink(vault,path)})`, '自动生成的搜索索引。请在白板中编辑；笔记正文在原 Markdown 文件中搜索。'];
 for(const node of board.nodes){
  const content=[node.title,node.text,node.file,node.kind==='pdf'?`PDF 第 ${node.pdfPage||1} 页`:undefined].filter((v):v is string=>typeof v==='string'&&!!v.trim());
  if(content.length)chunks.push(`[定位 ${node.kind==='section'?'分组':'对象'}](${boardLink(vault,path,node.id)})\n\n${content.map(plain).join('\n\n')}`);
 }
 for(const edge of board.edges)if(edge.label.trim())chunks.push(`[定位连线起点](${boardLink(vault,path,edge.from)})\n\n${plain(edge.label)}`);
 const body=chunks.join('\n\n')+'\n';return `<!-- thoughtspace-search-v1:${checksum(body)} -->\n${body}`;
}
export interface SearchIndexIO {
 board(path:string):Promise<Board|undefined>;
 read(path:string):Promise<string|undefined>;
 write(path:string,content:string,expected:string|undefined):Promise<void>;
 remove(path:string,expected:string):Promise<void>;
}
/** One serial, coalescing worker; indexing never runs in the pointer/render path. */
export class BoardSearchSync {
 private pending=new Set<string>();private running?:Promise<void>;private stopped=false;
 constructor(private io:SearchIndexIO,private vault:string,private error:(path:string,error:unknown)=>void){}
 enqueue(path:string){if(!this.stopped)this.pending.add(path);}
 flush():Promise<void>{if(this.running)return this.running;this.running=this.drain().finally(()=>{this.running=undefined;});return this.running;}
 stop(){this.stopped=true;this.pending.clear();}
 private async drain(){while(this.pending.size&&!this.stopped){const path=this.pending.values().next().value!;this.pending.delete(path);try{
  const board=await this.io.board(path);if(this.stopped)return;
  const target=searchIndexPath(path),old=await this.io.read(target);if(this.stopped)return;
  if(old!==undefined&&!isManagedSearchIndex(old))throw Error('搜索索引有手动修改，已保留；移开该文件后可重建索引');
  if(!board){if(old!==undefined)await this.io.remove(target,old);continue;}
  const next=boardSearchDocument(board,path,this.vault);if(next!==old&&!this.stopped)await this.io.write(target,next,old);
 }catch(error){this.error(path,error);}}}
}
