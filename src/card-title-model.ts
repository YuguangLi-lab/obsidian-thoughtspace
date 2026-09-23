import {hasAsciiControl} from './value-guards';
import type {Board,Card} from './model';
/** A per-instance board label; it never mutates the linked Markdown file. */
export function cardDisplayTitle(node:Card,file?:{basename:string}){return node.title?.trim()||file?.basename||node.file?.split('/').pop()?.replace(/\.md$/i,'')||'笔记';}
export function setCardTitle(board:Board,id:string,value:string,previous:string|undefined){
 const node=board.nodes.find(n=>n.id===id);if(!node||node.kind!=='card')throw Error('卡片不存在或类型已变化');if(node.locked)throw Error('卡片已锁定');if(node.title!==previous)throw Error('卡片标题已被其他操作修改，请重新编辑');
 const title=value.trim();if(hasAsciiControl(title))throw Error('卡片标题请使用单行文字');if(title.length>500)throw Error('卡片标题不能超过 500 个字符');
 if(title)node.title=title;else delete node.title;
}
