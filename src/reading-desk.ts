import {fileReference} from './journal-links-model';
import {Board,Card} from './model';
import {nodeName,readingOrder} from './board-studio';
export const readingTitle=(n:Card)=>nodeName(n).replace(/^#{1,6}\s+/, '').replace(n.file?/\.(md|png|jpe?g|webp|gif|bmp|avif)$/i:/$^/, '');
export const reviewLabels={later:'待读',reading:'在读',done:'已读'} as const;
export type ReviewState=keyof typeof reviewLabels;
export interface ReadingOptions{query:string;status:'all'|ReviewState;sort:'board'|'title';onlySelected:boolean;kind?:'all'|'card'|'text'|'image';connection?:'all'|'connected'|'isolated';}
export function readingItems(board:Board,ids:ReadonlySet<string>,options:ReadingOptions){const q=options.query.normalize('NFKC').toLocaleLowerCase().trim();const connected=connectedReadingIds(board);const nodes=board.nodes.filter(n=>['card','text','image'].includes(n.kind)&&(!options.kind||options.kind==='all'||n.kind===options.kind)&&(!options.connection||options.connection==='all'||connected.has(n.id)===(options.connection==='connected'))&&(!options.onlySelected||ids.has(n.id))&&(options.status==='all'||(n.review||'later')===options.status)&&(!q||`${nodeName(n)} ${n.file||''} ${n.kind==='text'?n.text||'':''}`.normalize('NFKC').toLocaleLowerCase().includes(q)));return options.sort==='board'?readingOrder(nodes):[...nodes].sort((a,b)=>nodeName(a).localeCompare(nodeName(b))||a.id.localeCompare(b.id));}
export function markReading(board:Board,ids:ReadonlySet<string>,status:ReviewState){for(const n of board.nodes)if(ids.has(n.id)&&!n.locked&&['card','text','image'].includes(n.kind)){if(status==='later')delete n.review;else n.review=status;}}
export function readingProgress(nodes:Card[]){const total=nodes.length,done=nodes.filter(n=>n.review==='done').length;return {total,done,reading:nodes.filter(n=>n.review==='reading').length,percent:total?Math.round(done*100/total):0};}
export function readingDigest(nodes:Card[],title:string){const clean=(text:string)=>text.replace(/[\r\n]+/g,' ').trim();return `# ${clean(title)} · 阅读回顾\n\n`+Object.entries(reviewLabels).map(([status,label])=>`## ${label}\n\n`+nodes.filter(n=>(n.review||'later')===status).map(n=>`- ${n.file?fileReference(n.file):clean(nodeName(n))}`).join('\n')).join('\n\n')+'\n';}

/** Only readable neighbours count: dangling edges and container portals do not enter a reading queue. */
export function connectedReadingIds(board:Board){
 const readable=new Set(board.nodes.filter(n=>['card','text','image'].includes(n.kind)).map(n=>n.id)),ids=new Set<string>();
 for(const edge of board.edges)if(edge.from!==edge.to&&readable.has(edge.from)&&readable.has(edge.to)){ids.add(edge.from);ids.add(edge.to);}
 return ids;
}
export function readingRelations(board:Board,id:string){
 const nodes=new Map(board.nodes.map(n=>[n.id,n]));
 return board.edges.flatMap(edge=>{
  if(edge.from!==id&&edge.to!==id)return [];
  const node=nodes.get(edge.from===id?edge.to:edge.from);
  if(!node||node.id===id||!['card','text','image'].includes(node.kind))return [];
  const direction=edge.direction==='none'?'关联':edge.direction==='both'?'双向':edge.from===id?'指向':'来自';
  return [{edgeId:edge.id,node,label:edge.label.trim()||'未命名连线',direction}];
 });
}
/** Keep the active object visible without mounting the entire board's queue. */
export function readingWindow(items:Card[],id?:string,size=100){
 const index=Math.max(0,items.findIndex(n=>n.id===id)),start=Math.floor(index/size)*size;
 return {start,end:Math.min(start+size,items.length),nodes:items.slice(start,start+size)};
}
