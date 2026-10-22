import {clone,type Board,type Card} from './model';
import {sectionContains} from './sections';
/** Detached preview; source notes and unselected existing objects never change. */
export function planCaptureReferences(board:Board,paths:readonly string[],groupId:string|undefined,width:number,newId:()=>string,options:{duplicate?:'allow'}={}):{board:Board;ids:string[]} {
 if(options.duplicate!==undefined&&options.duplicate!=='allow')throw Error('重复投递选项无效');
 if(board.presentation==='handwriting')throw Error('手写白板不接收笔记卡片，请选择普通或脑图白板');
 if(!paths.length||paths.length>100||!Number.isFinite(width)||width<220||width>520)throw Error('投递参数无效');
 const draft=clone(board),group=groupId?draft.nodes.find(node=>node.id===groupId&&node.kind==='section'):undefined;
 if(groupId&&!group)throw Error('目标分组已移除，请重新选择');
 if(group&&(group.locked||draft.nodes.some(node=>node.kind==='section'&&node.locked&&sectionContains(node,group))))throw Error('目标分组已锁定，请解锁或选择其他落点');
 const existing=new Set(draft.nodes.filter(node=>node.kind==='card').map(node=>node.file)),fresh=[...new Set(paths)].filter(path=>options.duplicate==='allow'||!existing.has(path));
 const ids:string[]=[];let x=0,y=0;
 if(group){x=group.x+20;y=group.y+52;for(const node of draft.nodes)if(node.id!==group.id&&sectionContains(group,node))y=Math.max(y,node.y+node.height+24);
  if(width+40>group.width||y+fresh.length*344-24>group.y+group.height-20)throw Error('目标分组空间不足；请选择白板空白处或先调整分组大小');
 }else for(const node of draft.nodes)x=Math.max(x,node.x+node.width+48);
 for(const [index,path]of fresh.entries()){
  const id=newId();if(!id||draft.nodes.some(node=>node.id===id))throw Error('卡片标识冲突，请重试');
  const node:Card={id,kind:'card',file:path,x:group?x:x+(index%3)*(width+32),y:group?y+index*344:Math.floor(index/3)*344,width,height:320,color:'sand',transparent:true};
  draft.nodes.push(node);ids.push(id);
 }
 if(ids.length)draft.version=3;return{board:draft,ids};
}
