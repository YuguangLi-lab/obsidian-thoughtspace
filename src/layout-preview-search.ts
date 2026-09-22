import {Card} from './model';
import {readingTitle} from './reading-desk';
export interface PreviewEntry{id:string;title:string;key:string}
const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase();
export const indexPreview=(nodes:readonly Card[]):PreviewEntry[]=>nodes.map(n=>{const title=readingTitle(n);return {id:n.id,title,key:normalize(`${title} ${n.file||''}`)};});
export function searchPreview(index:readonly PreviewEntry[],query:string):PreviewEntry[]{
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 return terms.length?index.filter(n=>terms.every(term=>n.key.includes(term))):[];
}
