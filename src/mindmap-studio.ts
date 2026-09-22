import {Board,Color,clone,emptyBoard} from './model';
import {branchState,layoutMindmap,MindmapLayout,mindmapRoot} from './mindmap';
export interface MindmapOptions {layout:MindmapLayout;density:'compact'|'standard'|'relaxed';depth:'keep'|'all'|'1'|'2'|'3';rainbow:boolean;}
export const mindmapLayouts:Record<MindmapLayout,string>={bilateral:'双向导图',right:'向右逻辑图',left:'向左逻辑图',down:'向下组织图'};
export function mindmapSignature(b:Board){const {viewport,...content}=b;return JSON.stringify(content);}
export function mindmapPlan(board:Board,id:string,options:MindmapOptions){
 if(!Object.hasOwn(mindmapLayouts,options.layout)||!['compact','standard','relaxed'].includes(options.density)||!['keep','all','1','2','3'].includes(options.depth))throw Error('导图选项无效');
 const b=clone(board),rootId=mindmapRoot(b,id),byId=new Map(b.nodes.map(n=>[n.id,n])),root=byId.get(rootId);
 if(!root||root.kind==='section')throw Error('请选择一个主题');
 const {children}=branchState(b),rows=[{id:rootId,depth:0,branch:-1}];
 for(let i=0;i<rows.length;i++){const row=rows[i];for(const [j,id]of (children.get(row.id)||[]).entries())rows.push({id,depth:row.depth+1,branch:row.depth===0?j:row.branch});}
 if(rows.some(r=>byId.get(r.id)!.locked))throw Error('导图中有锁定对象，请先解锁');
 const palette:Color[]=['blue','green','orange','purple','rose','teal'],colorById=new Map<string,Color>();
 for(const row of rows){const n=byId.get(row.id)!;if(options.depth!=='keep')n.branchFolded=options.depth==='all'?false:row.depth>=Number(options.depth)&&children.has(row.id);if(options.rainbow&&row.branch>=0){n.color=palette[row.branch%palette.length];colorById.set(n.id,n.color);}}
 if(options.rainbow)for(const e of b.edges)if(e.kind==='branch'&&colorById.has(e.to))e.color=colorById.get(e.to);
 if(root.mindmapRules){root.mindmapRules.layout=options.layout;root.mindmapRules.density=options.density;}b.mindmapDensity=options.density;layoutMindmap(b,rootId,options.layout);return {board:b,rootId,ids:new Set(rows.map(r=>r.id))};
}
export function starterMindmap(title:string,id:()=>string){
 const b=emptyBoard();b.version=3;const root=id();b.nodes.push({id:root,kind:'text',text:title.trim()||'中心主题',topic:true,x:0,y:0,width:220,height:80,color:'green',fontSize:24});
 for(const [label,child]of [['目标','想要解决什么问题？'],['材料','插入笔记、图片和证据'],['行动','下一步做什么？'],['想法','双击编辑 · Tab 添加子主题']]){
  const parent=id(),leaf=id();b.nodes.push({id:parent,kind:'text',text:label,topic:true,x:0,y:0,width:160,height:60,color:'blue'},{id:leaf,kind:'text',text:child,topic:true,x:0,y:0,width:240,height:70,color:'blue'});b.edges.push({id:id(),from:root,to:parent,kind:'branch',label:'',direction:'none',style:'curve'},{id:id(),from:parent,to:leaf,kind:'branch',label:'',direction:'none',style:'curve'});
 }
 return mindmapPlan(b,root,{layout:'bilateral',density:'standard',depth:'all',rainbow:true}).board;
}
