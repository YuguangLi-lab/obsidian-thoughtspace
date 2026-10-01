import type {Board,Card} from './model';
import {parseOnlineSource} from './online-platform';

/** A source identity or explicit relationship, never whichever video is first. */
export function mediaTimestampNode(board:Board,source:{file:string}|{source:string},excerpt?:string,preferred?:string):Card|undefined{
 const matches=board.nodes.filter(n=>!(n.locked&&(n.collapsed||n.branchFolded))&&('file'in source?(n.kind==='audio'||n.kind==='video')&&n.file===source.file:!!n.webUrl&&parseOnlineSource(n.webUrl)?.path===source.source));
 const exact=preferred&&matches.find(n=>n.id===preferred);if(exact)return exact;
 if(excerpt){const related=matches.filter(n=>board.edges.some(e=>e.from===n.id&&e.to===excerpt||e.to===n.id&&e.from===excerpt));if(related.length===1)return related[0];}
 return matches.length===1?matches[0]:undefined;
}
