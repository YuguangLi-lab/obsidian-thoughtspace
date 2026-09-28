import type {Card} from './model';
import {markdownRows} from './markdown-context';

/** Markdown tables opt into content sizing; a resize or explicit toggle always wins.
 * Cache by node and source so camera/selection refreshes do not rescan long text. */
const tableCache=new WeakMap<object,{text:string;table:boolean}>();
export function textHasTable(node:Pick<Card,'text'>):boolean {
 const text=node.text||'',cached=tableCache.get(node);if(cached?.text===text)return cached.table;
 let table=false,previous='';
 if(text.includes('|')&&text.includes('---'))for(const row of markdownRows(text)){
  if(row.code||!row.topLevel){previous='';continue;}
  const line=row.visible.trim();
  if(previous.includes('|')&&/^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?$/.test(line)&&line.includes('|')){table=true;break;}
  previous=line;
 }
 tableCache.set(node,{text,table});return table;
}
export function textFitsContent(node:Pick<Card,'kind'|'topic'|'text'|'textAutoHeight'|'autoSize'>|undefined):boolean {
 return node?.kind==='text'&&(node.textAutoHeight===true||(node.textAutoHeight!==false&&node.autoSize!==false&&(node.topic===true||textHasTable(node))));
}

/** Keep one body-text line visible in a manually shortened frame without changing
 * its font. Larger frames retain their normal spacing; long content still scrolls. */
export function textBlockPadding(node:Pick<Card,'fontSize'|'borderWidth'>,height:number):number {
 return Math.max(0,Math.min(14,(height-(node.fontSize||16)*1.7-(node.borderWidth??1)*2)/2));
}

/** Tables own their cell grid, while notes and groups retain an outer frame. */
export function nodeHasBorder(node:Pick<Card,'kind'|'text'>):boolean {
 return node.kind==='card'||node.kind==='section'||node.kind==='text'&&!textHasTable(node);
}
