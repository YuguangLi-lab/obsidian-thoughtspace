import { Card } from './model';
/** 只保存仓库相对路径，忽略失效的旧配置值。 */
export function cleanFavorites(value:unknown):string[] {
  return Array.isArray(value) ? [...new Set(value.filter((v):v is string=>typeof v==='string'&&v.endsWith('.thoughtspace')&&!v.startsWith('/')&&!v.split('/').some(p=>p==='..'||!p)))].slice(0,200) : [];
}
export function remapFavorites(paths:readonly string[],oldPath:string,newPath?:string):string[]{
  return cleanFavorites(paths.flatMap(path=>path===oldPath||path.startsWith(oldPath+'/') ? newPath?[newPath+path.slice(oldPath.length)]:[]:[path]));
}
export type TaskFilter='all'|'todo'|'done';
export function taskSummary(tasks:readonly {checked:boolean}[]){const done=tasks.filter(t=>t.checked).length;return {total:tasks.length,done,percent:tasks.length?Math.round(done/tasks.length*100):0};}
export function visibleTasks<T extends {checked:boolean}>(tasks:readonly T[],filter:TaskFilter):T[]{return tasks.filter(t=>filter==='all'||t.checked===(filter==='done'));}
export type OutlineKind='all'|Card['kind'];
export function outlineNodes(nodes:readonly Card[],query:string,kind:OutlineKind,title:(n:Card)=>string):Card[]{
  const q=query.trim().toLocaleLowerCase();return nodes.filter(n=>(kind==='all'||n.kind===kind)&&`${title(n)} ${n.file||''}`.toLocaleLowerCase().includes(q)).sort((a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id));
}
export const boardTemplates=[
  {id:'research',name:'研究与论证',icon:'microscope',description:'把问题、证据与解释组织成一条论证线。',titles:['核心问题','支持证据','反例与边界','我的解释'],bodies:['## 想回答什么\n\n- [ ] 用一句话定义问题\n- [ ] 列出判断标准','## 已知证据\n\n记录来源、关键观察与可信程度。\n\n- [ ] 补充原始来源','## 哪些仍不确定\n\n记录反例、局限和其他可能的解释。\n\n- [ ] 找到一个反例','## 当前判断\n\n结论：\n\n依据：\n\n- [ ] 写下下一步验证计划']},
  {id:'project',name:'项目推进',icon:'kanban-square',description:'定义目标、安排行动、追踪风险并复盘。',titles:['目标与交付','下一步行动','风险与依赖','复盘记录'],bodies:['## 成功的标准\n\n交付物：\n\n截止时间：\n\n- [ ] 明确范围','## 可以立即开始的事\n\n- [ ] 拆出第一个可执行步骤\n- [ ] 安排负责人','## 提前发现阻碍\n\n外部依赖：\n\n应对方案：\n\n- [ ] 检查最关键的风险','## 让经验留下来\n\n做得好的：\n\n需要调整的：\n\n- [ ] 更新下一轮计划']},
  {id:'learning',name:'主题学习',icon:'book-open',description:'从学习目标到概念、例子与回顾练习。',titles:['学习目标','核心概念','例子与应用','回顾与自测'],bodies:['## 为什么学习它\n\n我希望能够：\n\n- [ ] 写下三个具体问题','## 用自己的话解释\n\n定义：\n\n与已知概念的联系：','## 把概念用起来\n\n一个具体例子：\n\n容易混淆的地方：\n\n- [ ] 完成一次练习','## 不看笔记试一试\n\n- [ ] 解释核心概念\n- [ ] 举一个自己的例子\n- [ ] 标出仍不清楚的地方']}
] as const;
