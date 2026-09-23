import {Board} from './model';
import {isWorkspaceFile} from './workspace';
export type NativeLinks = Record<string, Record<string, number>>;
export function nativeRelations(path:string, resolved:NativeLinks, unresolved:NativeLinks, valid:ReadonlySet<string>) {
  const usable=(p:string)=>p!==path&&valid.has(p)&&isWorkspaceFile({path:p});
  return {
    outgoing:Object.keys(resolved[path]||{}).filter(p=>usable(p)&&resolved[path][p]>0).sort(),
    incoming:Object.keys(resolved).filter(p=>usable(p)&&resolved[p]?.[path]>0).sort(),
    unresolved:Object.keys(unresolved[path]||{}).filter(p=>unresolved[path][p]>0).sort()
  };
}
export function boardNotePaths(board:Board):string[]{return [...new Set(board.nodes.filter(n=>n.kind==='card'&&n.file?.endsWith('.md')).map(n=>n.file!))];}
const literal=(s:string)=>s.replace(/[\\`*_{}[\]<>#|]/g,'\\$&').replace(/[\r\n]/g,' ');
/** A new Markdown snapshot, never an automatic rewrite of source notes. */
export function nativeIndex(title:string, boardMarkdownLink:string, links:string[], missing:string[]):string {
  return `# ${literal(title)} · 白板索引\n\n${boardMarkdownLink}\n\n> 白板笔记引用快照；白板改变后可重新导出。\n\n## 笔记 · ${links.length}\n\n${links.length?links.map(l=>'- '+l).join('\n'):'尚无有效笔记引用。'}\n${missing.length?'\n## 未找到的文件\n\n'+missing.map(p=>'- '+literal(p)).join('\n')+'\n':''}`;
}
