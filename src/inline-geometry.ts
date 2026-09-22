import {previewMindmapSize} from './mindmap';
import type {Board} from './model';
export interface InlineGeometry {id:string;width:number;height:number;}
/** Draft geometry is a display overlay, never a mutation of saved nodes or undo history. */
export function inlineDisplayBoard(board:Board,draft?:InlineGeometry):Board{
 if(!draft||!Number.isFinite(draft.width)||!Number.isFinite(draft.height)||draft.width<=0||draft.height<=0)return board;
 const index=board.nodes.findIndex(n=>n.id===draft.id&&(n.kind==='text'||n.kind==='card'));if(index<0)return board;
 const node=board.nodes[index];if(node.width===draft.width&&node.height===draft.height)return board;
 if(board.nodes.some(n=>n.mindmapRules?.automatic)){const display=previewMindmapSize(board,draft.id,draft.width,draft.height);if(display)return display;}
 const nodes=board.nodes.slice();nodes[index]={...node,width:draft.width,height:draft.height};return {...board,nodes};
}
