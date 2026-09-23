import type {Command} from 'obsidian';

export type BoardInputAction='newCard'|'newText'|'insertNote'|'selection'|'connect'|'fit'|'focus'|'reset'|'fold'|'expand'|'edit'|'undo'|'redo'|'newSection'|'duplicate'|'remove'|'childTopic'|'siblingTopic'|'parentTopic'|'find'|'tidy'|'read';
export interface BoardInputCommandTarget {
 /** The resolver must return only the active, open board, never a cached board. */
 editing:boolean;
 canRun:(action:BoardInputAction)=>boolean;
 run:(action:BoardInputAction)=>void;
}
const definitions:readonly {action:BoardInputAction;id:string;name:string;icon:string}[]=[
 {action:'newCard',id:'new-card',name:'白板：新建卡片',icon:'square-plus'},
 {action:'newText',id:'new-text',name:'白板：新建文本',icon:'type'},
 {action:'insertNote',id:'insert-note',name:'白板：插入已有笔记',icon:'file-plus'},
 {action:'selection',id:'selection',name:'白板：切换框选工具',icon:'scan'},
 {action:'connect',id:'connect',name:'白板：切换连线工具',icon:'git-branch'},
 {action:'fit',id:'fit',name:'白板：显示全部内容',icon:'maximize'},
 {action:'focus',id:'focus',name:'白板：聚焦选中内容',icon:'focus'},
 {action:'reset',id:'reset',name:'白板：恢复 100% 缩放',icon:'scan-line'},
 {action:'fold',id:'fold',name:'白板：折叠选中内容',icon:'chevrons-up'},
 {action:'expand',id:'expand',name:'白板：展开选中内容',icon:'chevrons-down'},
 {action:'edit',id:'edit',name:'白板：编辑选中内容',icon:'pencil'},
 {action:'undo',id:'undo',name:'白板：撤销上一步',icon:'undo-2'},
 {action:'redo',id:'redo',name:'白板：重做上一步',icon:'redo-2'},
 {action:'newSection',id:'new-section',name:'白板：新建分组',icon:'group'},
 {action:'duplicate',id:'duplicate',name:'白板：创建选中内容的副本',icon:'copy'},
 {action:'remove',id:'remove',name:'白板：移除选中内容',icon:'trash-2'},
 {action:'childTopic',id:'child-topic',name:'白板：添加子主题',icon:'git-branch-plus'},
 {action:'siblingTopic',id:'sibling-topic',name:'白板：添加同级主题',icon:'plus'},
 {action:'parentTopic',id:'parent-topic',name:'白板：定位父主题',icon:'git-merge'},
 {action:'find',id:'find',name:'白板：搜索内容',icon:'search'},
 {action:'tidy',id:'tidy',name:'白板：整理布局',icon:'layout-dashboard'},
 {action:'read',id:'read',name:'白板：阅读选中内容',icon:'book-open'},
];
/** Register through Plugin.addCommand; Obsidian owns shortcut binding and scope.
 * The caller resolves active-board identity and action eligibility at invocation.
 * No default hotkeys are assigned, so existing user bindings remain untouched.
 */
export function boardInputCommands(resolve:()=>BoardInputCommandTarget|undefined):Command[]{
 return definitions.map(({action,id,name,icon})=>({id:`board-input-${id}`,name,icon,checkCallback:checking=>{
  const target=resolve();if(!target||target.editing||!target.canRun(action))return false;
  if(!checking)target.run(action);return true;
 }}));
}
