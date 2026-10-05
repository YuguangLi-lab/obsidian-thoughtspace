import type {Card} from './model';
import {hasAsciiControl} from './value-guards';
export function brainIdeaNode(id:string,title:string,x=0):Card {
 const name=title.trim();if(!name||name.length>160)throw Error('想法名称须为 1–160 字');
 return{id,kind:'text',brainIdea:true,title:name,text:'',x,y:0,width:320,height:240,color:'slate'};
}
/** Keep identity and graph geometry; remove only incompatible text provenance. */
export function brainIdeaToNote(node:Card,path:string):Card {
 if(node.kind!=='text'||!node.brainIdea||node.locked)throw Error('想法已变化或锁定');
 if(!path.toLowerCase().endsWith('.md'))throw Error('须使用 Markdown 笔记');
 const next:Card={...node,kind:'card',file:path,autoFit:false};
 delete next.brainIdea;delete next.text;delete next.textAutoHeight;delete next.textMaxWidth;delete next.autoSize;return next;
}
export function brainNoteFolder(value:string){const path=value.trim().replace(/\/$/,'');if(!path||path.startsWith('/')||path.includes('\\')||path.split('/').some(part=>!part||part==='.'||part==='..')||hasAsciiControl(path))throw Error('请选择库内有效目标文件夹');return path;}
