import {sizeTemplateTopic} from './mindmap-sizing';
import {Board,Card,clone,emptyBoard,uid,parseBoard} from './model';
import {validateBranches} from './mindmap';
import {mindmapPlan} from './mindmap-studio';
import {appendTopicOutline,parseTopicOutline} from './mindmap-content';
import {TopicResult} from './mindmap-editor';
export const mindmapPresets=[
 {id:'brainstorm',name:'灵感发散',category:'思考',description:'从问题出发，发散、筛选，再落到行动。',layout:'bilateral',outline:'## 问题\n- 现状\n- 想要改变什么\n## 灵感\n- 可能的方向\n- 大胆的假设\n## 筛选\n- 价值\n- 可行性\n## 下一步\n- 最小实验\n- 验证标准'},
 {id:'project',name:'项目计划',category:'规划',description:'围绕目标组织交付、资源和风险。',layout:'right',outline:'## 目标\n- 预期成果\n- 验收标准\n## 里程碑\n- 准备\n- 执行\n- 交付\n## 资源\n- 人员\n- 时间\n## 风险\n- 关键依赖\n- 备选方案'},
 {id:'reading',name:'阅读笔记',category:'学习',description:'把观点、证据与自己的疑问连起来。',layout:'bilateral',outline:'## 核心问题\n- 作者在回答什么\n## 主要观点\n- 观点一\n- 观点二\n## 证据\n- 摘录与出处\n- 推理过程\n## 我的思考\n- 同意与质疑\n- 与旧知识的联系\n## 后续阅读\n- 相关材料'},
 {id:'research',name:'研究设计',category:'研究',description:'从假设到方法、质量控制和结果解释。',layout:'right',outline:'## 研究问题\n- 背景与缺口\n- 可检验假设\n## 方法\n- 对象与样本\n- 暴露与结局\n- 分析计划\n## 质量控制\n- 偏倚与混杂\n- 敏感性分析\n## 结果解释\n- 预期发现\n- 局限性'},
 {id:'argument',name:'论证结构',category:'研究',description:'为主张组织证据，并保留反例与边界。',layout:'left',outline:'## 主张\n- 一句话结论\n## 支持证据\n- 证据一\n- 证据二\n## 反对观点\n- 反例\n- 替代解释\n## 回应\n- 可以回应什么\n- 仍然不确定什么'},
 {id:'review',name:'复盘改进',category:'规划',description:'对照目标与结果，找到原因并形成改进。',layout:'bilateral',outline:'## 原定目标\n- 预期结果\n## 实际结果\n- 做得好的\n- 未达成的\n## 原因\n- 可控因素\n- 外部因素\n## 改进\n- 保留\n- 停止\n- 开始'},
 {id:'swot',name:'SWOT 分析',category:'思考',description:'梳理内部优劣势与外部机会、威胁。',layout:'bilateral',outline:'## 优势 Strengths\n- 现有能力\n- 独特资源\n## 劣势 Weaknesses\n- 能力缺口\n- 资源限制\n## 机会 Opportunities\n- 新需求\n- 外部支持\n## 威胁 Threats\n- 竞争变化\n- 不确定性'},
 {id:'organization',name:'组织分工',category:'规划',description:'按层级明确角色、职责和协作关系。',layout:'down',outline:'## 统筹\n- 目标与决策\n- 资源协调\n## 执行\n- 工作包一\n- 工作包二\n## 支持\n- 质量检查\n- 文档与沟通'}
] as const;
export function presetMindmap(id:string,title?:string,makeId:()=>string=uid,measure?:(n:Card)=>void):Board{
 const preset=mindmapPresets.find(p=>p.id===id);if(!preset)throw Error('模板不存在');const label=title?.trim()||preset.name;if(label.length>200)throw Error('标题最多 200 字');
 const b=emptyBoard();b.version=3;const root=makeId();b.nodes.push({id:root,kind:'text',topic:true,text:label,x:0,y:0,width:Math.max(220,Math.min(460,label.length*24+36)),height:Math.max(80,Math.ceil(label.length/17)*40+28),color:'green',fontSize:24});
 const result=appendTopicOutline(b,root,parseTopicOutline(preset.outline),makeId);for(const n of result.board.nodes){sizeTemplateTopic(n);measure?.(n);}result.board.nodes[0].mindmapRules={layout:preset.layout,density:'standard',automatic:true};
 return mindmapPlan(result.board,root,{layout:preset.layout,density:'standard',depth:'all',rainbow:true}).board;
}
/** Add a complete independent tree without moving or replacing existing content. */
export function insertPreset(source:Board,preset:Board):TopicResult{
 const board=clone(source),tree=clone(preset),ids=new Set([...board.nodes,...board.edges].map(n=>n.id));
 for(const n of [...tree.nodes,...tree.edges]){if(ids.has(n.id))throw Error('模板标识冲突，请重试');ids.add(n.id);}
 const parents=validateBranches(tree),root=tree.nodes.find(n=>!parents.has(n.id));if(!root)throw Error('模板缺少中心主题');
 const left=Math.min(...tree.nodes.map(n=>n.x)),top=Math.min(...tree.nodes.map(n=>n.y));let right=0,anchorY=0;if(board.nodes.length){right=-Infinity;anchorY=Infinity;for(const n of board.nodes){right=Math.max(right,n.x+n.width);anchorY=Math.min(anchorY,n.y);}}
 for(const n of tree.nodes){n.x+=right+(board.nodes.length?180:0)-left;n.y+=anchorY-top;}
 board.nodes.push(...tree.nodes);board.edges.push(...tree.edges);board.version=3;parseBoard(JSON.stringify(board));return{board,root:root.id,selected:root.id};
}
