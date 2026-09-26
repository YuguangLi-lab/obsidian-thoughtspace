import {Board,Edge,clone,parseBoard,uid} from './model';
import {mindmapRoot,layoutMindmap,unfoldAncestors} from './mindmap';
import {topicTreeIndex,TopicResult} from './mindmap-editor';
export type BranchDepth='focus'|'all'|'1'|'2';
export function arrangeBranchDepth(source:Board,selected:string,depth:BranchDepth):TopicResult{
 if(!['focus','all','1','2'].includes(depth))throw Error('展开方式无效');const b=clone(source),index=topicTreeIndex(b),root=index.rootOf(selected),rows=index.rows(root);if(rows.some(r=>r.node.locked))throw Error('主题树中有锁定对象，请先解锁');
 const branch=index.rows(selected),ids=new Set(branch.map(r=>r.node.id)),{children,parents}=index;
 if(depth==='focus'){const path=new Set<string>();let id:string|undefined=selected;while(id){path.add(id);id=parents.get(id);}for(const {node}of rows)if(children.has(node.id))node.branchFolded=!ids.has(node.id)&&!path.has(node.id);}
 for(const {node,depth:level}of branch)if(children.has(node.id))node.branchFolded=(depth==='1'||depth==='2')&&level>=Number(depth);
 unfoldAncestors(b,selected);layoutMindmap(b,root);parseBoard(JSON.stringify(b));return{board:b,root,selected};
}
export interface TopicRelation {target:string;label:string;direction:NonNullable<Edge['direction']>;id?:string}
export function saveTopicRelation(source:Board,selected:string,value:TopicRelation,makeId:()=>string=uid):TopicResult{
 const b=clone(source),index=topicTreeIndex(b),root=index.rootOf(selected),tree=new Set(index.rows(root).map(r=>r.node.id)),{nodes}=index;
 if(selected===value.target||!tree.has(value.target))throw Error('请选择当前主题树中的另一个主题');if(nodes.get(selected)?.locked||nodes.get(value.target)?.locked)throw Error('请先解锁两个主题');
 if(value.label.length>200||!['forward','both','none'].includes(value.direction))throw Error('关系名称最多 200 字，方向须有效');
 let edge=value.id?b.edges.find(e=>e.id===value.id):undefined;if(value.id&&(!edge||edge.kind==='branch'||edge.from!==selected))throw Error('这条关联线已变化，请重新选择');
 if(b.edges.some(e=>e.kind!=='branch'&&e.id!==value.id&&e.from===selected&&e.to===value.target))throw Error('已存在这条关联线，请编辑原关系');
 if(!edge){const id=makeId();if(!id||b.nodes.some(n=>n.id===id)||b.edges.some(e=>e.id===id))throw Error('关联线标识冲突');edge={id,from:selected,to:value.target,label:'',style:'curve',dashed:true,color:'slate'};b.edges.push(edge);}
 edge.to=value.target;edge.label=value.label.trim();edge.direction=value.direction;b.version=3;parseBoard(JSON.stringify(b));return{board:b,root,selected};
}
export function removeTopicRelation(source:Board,selected:string,id:string):TopicResult{
 const b=clone(source),edge=b.edges.find(e=>e.id===id),nodes=new Map(b.nodes.map(n=>[n.id,n]));
 if(!edge||edge.kind==='branch'||(edge.from!==selected&&edge.to!==selected))throw Error('请选择当前主题的关联线');if(nodes.get(edge.from)?.locked||nodes.get(edge.to)?.locked)throw Error('请先解锁两个主题');b.edges=b.edges.filter(e=>e!==edge);parseBoard(JSON.stringify(b));return{board:b,root:mindmapRoot(b,selected),selected};
}
