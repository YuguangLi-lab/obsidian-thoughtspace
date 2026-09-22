import {remoteImageUrl} from './image-host';
import type {WritingState} from './writing';
import {markdownRows} from './markdown-context';
import {yingjianNotePath} from './yingjian';
/** Capture provenance survives independent text/image editing and safe note renames. */
export interface Card { videoCapture?:{id:string;note:string} }
import { connectionSides, Side } from './connections';
import { branchState, validateBranches } from './mindmap';
/** 笔记卡片保留 Markdown 引用；独立文本与布局保存在白板内，图片保留附件引用。 */
export type Color = 'sand' | 'blue' | 'green' | 'rose' | 'purple' | 'orange' | 'red' | 'teal' | 'cyan' | 'lime' | 'slate' | 'brown';
export const colors: Color[] = ['sand', 'blue', 'green', 'rose', 'purple', 'orange', 'red', 'teal', 'cyan', 'lime', 'slate', 'brown'];
export const colorNames:Record<Color,string>={sand:'米黄',blue:'蓝色',green:'绿色',rose:'粉色',purple:'紫色',orange:'橙色',red:'朱红',teal:'青绿',cyan:'天青',lime:'草绿',slate:'石墨',brown:'栗棕'};
export type CardFill = Color | 'none' | `#${string}`;
export const validCardFill=(value:unknown):value is CardFill=>typeof value==='string'&&(value==='none'||colors.includes(value as Color)||/^#[0-9a-fA-F]{6}$/.test(value));
export const cardFillHex:Record<Color,string>={sand:'#e8d8a8',blue:'#bbd5e7',green:'#bedbca',rose:'#eac6cc',purple:'#d6cbe8',orange:'#edc49a',red:'#e7b1ae',teal:'#a9d4c9',cyan:'#a9d8e4',lime:'#cad9a3',slate:'#bdc8d2',brown:'#d2bca9'};
export interface Card { mindmapRules?:{layout:'right'|'left'|'down'|'bilateral';density:'compact'|'standard'|'relaxed';automatic:boolean};textMaxWidth?:number; imageUrl?:string; transparent?:boolean; fillColor?:CardFill; branchFolded?:boolean; review?:'later'|'reading'|'done'; id: string; kind: 'card' | 'section' | 'board' | 'text' | 'image' | 'pdf'; pdfPage?:number; x: number; y: number; width: number; height: number; color: Color; file?: string; title?: string; collapsed?: boolean; expandedHeight?: number; text?: string; topic?: boolean; textColor?: Color | 'default'; fontSize?: number; fontFamily?: 'default' | 'serif' | 'mono'; textAlign?: 'left' | 'center' | 'right'; autoSize?: boolean; autoFit?:boolean; preferredWidth?:number; locked?:boolean; customBorder?:boolean; borderStyle?:'solid'|'dashed'|'dotted'; borderWidth?:number }
export interface Edge { id: string; from: string; to: string; label: string; style?: 'curve'|'straight'|'elbow'; direction?: 'forward'|'both'|'none'; dashed?: boolean; color?: Color; fromSide?: Side; toSide?: Side; kind?: 'branch' }
export interface Board { mindmapLayout?:'right'|'left'|'down'|'bilateral'; mindmapDensity?:'compact'|'standard'|'relaxed'; writing?:WritingState; selectionSets?:{id:string;name:string;ids:string[]}[]; spaceId?:string; snapToGrid?:boolean; savedViews?:{id:string;name:string;viewport:{x:number;y:number;zoom:number}}[]; version: 1 | 2 | 3; mode?: 'free'|'mindmap'; mindmapDirection?: 'right'|'down'; nodes: Card[]; edges: Edge[]; viewport: { x: number; y: number; zoom: number } }
export const emptyBoard = (): Board => ({ version: 1, nodes: [], edges: [], viewport: { x: 60, y: 60, zoom: 1 } });
export const uid = () => crypto.randomUUID();
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export function parseBoard(text: string): Board {
  const b = JSON.parse(text);
  if (![1, 2, 3].includes(b?.version) || !Array.isArray(b.nodes) || !Array.isArray(b.edges)) throw new Error('不支持的白板格式或版本');
  const ids = new Set<string>();
  for (const n of b.nodes) {
    if (!n || typeof n.id !== 'string' || !n.id.trim() || ids.has(n.id) || !(b.version === 3 ? ['card','section','board','text','image','pdf'] : b.version === 2 ? ['card', 'section', 'board'] : ['card', 'section']).includes(n.kind) ||
      !['x', 'y', 'width', 'height'].every(k => Number.isFinite(n[k])) || n.width < 80 || n.height < 60 ||
      !colors.includes(n.color) || (['card','board','image','pdf'].includes(n.kind) && (typeof n.file !== 'string' || !(n.kind === 'pdf' ? /\.pdf$/i.test(n.file) : n.kind === 'image' ? /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(n.file) : n.file.endsWith(n.kind === 'board' ? '.thoughtspace' : '.md')) || /(^\/|(^|\/)\.\.?(\/|$)|\\)/.test(n.file))) ||
      (n.kind === 'section' && typeof n.title !== 'string')) throw new Error('白板节点数据不完整');
    if ((n.collapsed !== undefined && typeof n.collapsed !== 'boolean') ||
      (n.collapsed && (n.kind !== 'card' || n.height !== 72 || !Number.isFinite(n.expandedHeight) || n.expandedHeight < 60)) ||
      (!n.collapsed && n.expandedHeight !== undefined)) throw new Error('卡片折叠数据不完整');
    if ((n.kind === 'text' && typeof n.text !== 'string') || (n.topic !== undefined && (b.version !== 3 || typeof n.topic !== 'boolean'))) throw new Error('文本或主题数据不完整');
    if ((n.textColor !== undefined && !['default',...colors].includes(n.textColor)) ||
      (n.fontSize !== undefined && (!Number.isFinite(n.fontSize) || n.fontSize < 12 || n.fontSize > 48)) ||
      (n.fontFamily !== undefined && !['default','serif','mono'].includes(n.fontFamily)) ||
      (n.textAlign !== undefined && !['left','center','right'].includes(n.textAlign)) ||
      (n.autoSize !== undefined && typeof n.autoSize !== 'boolean')) throw new Error('文本样式数据不完整');
    if(n.mindmapRules!==undefined&&(!n.mindmapRules||typeof n.mindmapRules!=='object'||!['right','left','down','bilateral'].includes(n.mindmapRules.layout)||!['compact','standard','relaxed'].includes(n.mindmapRules.density)||typeof n.mindmapRules.automatic!=='boolean'||n.kind==='section'))throw Error('导图自动布局规则无效');
    if(n.textMaxWidth!==undefined&&(n.kind!=='text'||!Number.isFinite(n.textMaxWidth)||n.textMaxWidth<160||n.textMaxWidth>720))throw Error('主题换行宽度无效');
    if(n.pdfPage!==undefined&&(n.kind!=='pdf'||!Number.isSafeInteger(n.pdfPage)||n.pdfPage<1))throw Error('PDF 页码无效');
    if(n.imageUrl!==undefined&&(n.kind!=='image'||!remoteImageUrl(n.imageUrl)))throw Error('图床图片地址无效');
    if(n.videoCapture!==undefined&&(!['text','image'].includes(n.kind)||!n.videoCapture||typeof n.videoCapture.id!=='string'||!/^[a-f0-9-]{36}$/.test(n.videoCapture.id)||!yingjianNotePath(n.videoCapture.note)))throw Error('视频记录来源无效');
    if(n.transparent!==undefined&&(n.kind!=='card'||typeof n.transparent!=='boolean'))throw Error('卡片透明样式无效');
    if(n.fillColor!==undefined&&(n.kind!=='card'||!validCardFill(n.fillColor)))throw Error('卡片背景颜色无效');
    if(n.preferredWidth!==undefined&&(n.kind!=='card'||!Number.isFinite(n.preferredWidth)||n.preferredWidth<220||n.preferredWidth>520))throw Error('卡片默认宽度无效');
    if(n.customBorder!==undefined&&typeof n.customBorder!=='boolean')throw Error('边框颜色设置无效');
    if((n.locked!==undefined&&typeof n.locked!=='boolean')||(n.autoFit!==undefined&&(n.kind!=='card'||typeof n.autoFit!=='boolean'))||(n.borderWidth!==undefined&&![0,1,2,3,4].includes(n.borderWidth))||(n.borderStyle!==undefined&&!['solid','dashed','dotted'].includes(n.borderStyle)))throw Error('对象样式或锁定状态不完整');
    if(n.branchFolded!==undefined&&(b.version!==3||typeof n.branchFolded!=='boolean'||n.kind==='section'))throw Error('导图折叠状态无效');
    if(n.review!==undefined&&(!['later','reading','done'].includes(n.review)||!['card','text','image'].includes(n.kind)))throw Error('阅读状态无效');
    ids.add(n.id);
  }
  const edgeIds = new Set<string>();
  for (const e of b.edges) {
    if (!e || typeof e.id !== 'string' || !e.id.trim() || edgeIds.has(e.id) || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to || typeof e.label !== 'string') throw new Error('白板连线数据不完整');
    for (const [key, values] of Object.entries({style:['curve','straight','elbow'],direction:['forward','both','none'],color:colors,fromSide:['top','right','bottom','left'],toSide:['top','right','bottom','left'],kind:['branch']})) if(e[key] !== undefined && (b.version !== 3 || !values.includes(e[key]))) throw new Error('连线样式不完整');
    if(e.dashed !== undefined && (b.version !== 3 || typeof e.dashed !== 'boolean')) throw new Error('连线样式不完整');
    edgeIds.add(e.id);
  }
  if (!b.viewport || !['x', 'y', 'zoom'].every(k => Number.isFinite(b.viewport[k])) || b.viewport.zoom < .15 || b.viewport.zoom > 2.5) throw new Error('白板视口数据不完整');
  if((b.mode !== undefined && (b.version !== 3 || !['free','mindmap'].includes(b.mode))) || (b.mindmapDirection !== undefined && (b.version !== 3 || !['right','down'].includes(b.mindmapDirection)))) throw new Error('导图设置不完整');
  if((b.mindmapLayout!==undefined&&(b.version!==3||!['right','left','down','bilateral'].includes(b.mindmapLayout)))||(b.mindmapDensity!==undefined&&(b.version!==3||!['compact','standard','relaxed'].includes(b.mindmapDensity))))throw Error('思维导图布局设置无效');
  if(b.spaceId!==undefined&&(typeof b.spaceId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(b.spaceId)))throw Error('空间标识无效');
  if(b.snapToGrid!==undefined&&typeof b.snapToGrid!=='boolean')throw Error('吸附设置无效');
  if(b.savedViews!==undefined){if(!Array.isArray(b.savedViews)||b.savedViews.length>50)throw Error('保存视角无效');const seen=new Set();for(const v of b.savedViews){if(typeof v.id!=='string'||seen.has(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>100||!v.viewport||!['x','y','zoom'].every(k=>Number.isFinite(v.viewport[k]))||v.viewport.zoom<.15||v.viewport.zoom>2.5)throw Error('保存视角无效');seen.add(v.id);}}
  if(b.selectionSets!==undefined){if(!Array.isArray(b.selectionSets)||b.selectionSets.length>30)throw Error('保存选区无效');const seen=new Set<string>();for(const s of b.selectionSets){if(!s||typeof s.id!=='string'||seen.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>60||!Array.isArray(s.ids)||s.ids.length>100000||s.ids.some((id:unknown)=>typeof id!=='string')||new Set(s.ids).size!==s.ids.length)throw Error('保存选区无效');seen.add(s.id);}}
  if(b.writing!==undefined){const w=b.writing;if(!w||typeof w.title!=='string'||w.title.length>160||!Array.isArray(w.order)||w.order.length>100000||w.order.some((id:unknown)=>typeof id!=='string')||new Set(w.order).size!==w.order.length||(w.referenceId!==undefined&&typeof w.referenceId!=='string')||(w.draftPath!==undefined&&typeof w.draftPath!=='string'))throw Error('写作顺序数据无效');
    if(w.manuscript!==undefined&&(typeof w.manuscript!=='string'||w.manuscript.length>1000000))throw Error('写作正文数据无效');
    if(w.includeSources!==undefined&&typeof w.includeSources!=='boolean')throw Error('写作来源选项无效');
    if(w.referenceIds!==undefined&&(!Array.isArray(w.referenceIds)||w.referenceIds.length>12||w.referenceIds.some((id:unknown)=>typeof id!=='string')||new Set(w.referenceIds).size!==w.referenceIds.length))throw Error('写作参考数据无效');
    if(w.chapters!==undefined&&(!Array.isArray(w.chapters)||w.chapters.length>500||w.chapters.some((c:any)=>!c||typeof c.id!=='string'||typeof c.title!=='string'||c.title.length>160||typeof c.body!=='string'||c.body.length>100000||b.nodes.some((n:any)=>n.id===c.id))||new Set(w.chapters.map((c:any)=>c.id)).size!==w.chapters.length))throw Error('写作章节数据无效');
    if(w.options!==undefined){if(!w.options||typeof w.options!=='object'||Array.isArray(w.options))throw Error('写作选项无效');for(const o of Object.values(w.options) as any[]){if(!o||typeof o!=='object'||Array.isArray(o)||(o.title!==undefined&&(typeof o.title!=='string'||o.title.length>160))||(o.note!==undefined&&(typeof o.note!=='string'||o.note.length>20000))||(o.level!==undefined&&![0,2,3,4].includes(o.level))||(o.excluded!==undefined&&typeof o.excluded!=='boolean'))throw Error('写作选项无效');}}
  }
  validateBranches(b);
  return b;
}
export function removeNodes(b: Board, ids: Set<string>): void {
  b.nodes = b.nodes.filter(n => !ids.has(n.id));
  b.edges = b.edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
}
export function contained(section: Card, node: Card): boolean {
  return node.kind !== 'section' && node.x >= section.x && node.y >= section.y && node.x + node.width <= section.x + section.width && node.y + node.height <= section.y + section.height;
}
/** Reject invalid geometry before layout or persistence can spread NaN across a board. */
export function assertBoardGeometry(board:Board):void {
 for(const n of board.nodes)if(![n.x,n.y,n.width,n.height].every(Number.isFinite)||n.width<80||n.height<60)throw Error('白板尺寸无效，已阻止写入');
 const v=board.viewport;if(!v||![v.x,v.y,v.zoom].every(Number.isFinite)||v.zoom<.15||v.zoom>2.5)throw Error('白板视口无效，已阻止写入');
}
export function fitViewport(nodes: Card[], width: number, height: number): Board['viewport'] {
  nodes=nodes.filter(n=>[n.x,n.y,n.width,n.height].every(Number.isFinite)&&n.width>0&&n.height>0);
  if (!nodes.length || !Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0) return emptyBoard().viewport;
  const x = Math.min(...nodes.map(n => n.x)), y = Math.min(...nodes.map(n => n.y));
  const w = Math.max(...nodes.map(n => n.x + n.width)) - x, h = Math.max(...nodes.map(n => n.y + n.height)) - y;
  const zoom = Math.max(.15, Math.min(1.3, (width - 100) / w, (height - 100) / h));
  return { x: (width - w * zoom) / 2 - x * zoom, y: (height - h * zoom) / 2 - y * zoom, zoom };
}
export class History {
  // Serialized snapshots avoid retaining entire object graphs. The budget covers both stacks.
  undoStack: string[] = []; redoStack: string[] = [];
  constructor(readonly maxBytes=8*1024*1024,readonly maxEntries=80){}
  get bytes(){return [...this.undoStack,...this.redoStack].reduce((sum,s)=>sum+s.length*2,0);}
  private trim(){while(this.undoStack.length+this.redoStack.length>1&&(this.bytes>this.maxBytes||this.undoStack.length+this.redoStack.length>this.maxEntries)){
    if(this.undoStack.length>1)this.undoStack.shift();else if(this.redoStack.length>1)this.redoStack.shift();else this.undoStack.shift();
  }}
  push(before:Board){this.undoStack.push(JSON.stringify(before));this.redoStack=[];this.trim();}
  undo(current:Board){const previous=this.undoStack.pop();if(previous){this.redoStack.push(JSON.stringify(current));this.trim();return JSON.parse(previous) as Board;}}
  redo(current:Board){const next=this.redoStack.pop();if(next){this.undoStack.push(JSON.stringify(current));this.trim();return JSON.parse(next) as Board;}}
}

export function canvasExport(b: Board) {
  const palette: Record<Color, string> = { sand: '3', blue: '5', green: '4', rose: '1', purple: '6', orange:'#edab6d',red:'#df8580',teal:'#87c8bb',cyan:'#8fcbdc',lime:'#b9cd82',slate:'#aab4c2',brown:'#c2a18c' };
  return { nodes: b.nodes.map(n => ({ id:n.id, type:n.kind==='section'?'group':n.kind==='text'?'text':'file', x:n.x,y:n.y,width:n.width,height:n.height,color:palette[n.color], ...(n.kind==='section'?{label:n.title}:n.kind==='text'?{text:n.text}:{file:n.file,...(n.kind==='pdf'?{subpath:`#page=${n.pdfPage||1}`}:{})}) })),
    edges:b.edges.map(e=>({id:e.id,fromNode:e.from,toNode:e.to,...connectionSides(b.nodes.find(n=>n.id===e.from)!,b.nodes.find(n=>n.id===e.to)!,e),fromEnd:e.direction==='both'?'arrow':'none',toEnd:e.direction==='none'?'none':'arrow',label:e.label,...(e.color?{color:palette[e.color]}:{})})) };
}
export interface Task { line: number; text: string; checked: boolean; source: string; checkboxOffset?:number }
export function extractTasks(content: string): Task[] {
 const tasks:Task[]=[];
 for(const row of markdownRows(content)){
  if(row.code)continue;
  const m=/^(?:(?: {0,3}>[ \t]?)+)?[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[([ xX])\][ \t]+(.*)$/.exec(row.visible);
  if(!m)continue;
  const offset=m[0].length-m[2].length,checkboxOffset=row.visible.lastIndexOf('[',offset-1);
  tasks.push({line:row.line,text:row.source.replace(/\r$/,'').slice(offset),checked:m[1]!==' ',source:row.source,checkboxOffset});
 }return tasks;
}
/** Preserve quote/callout prefixes and modify the actual indexed checkbox only. */
export function taskCheckbox(task:Task){return task.checkboxOffset??task.source.search(/\[[ xX]\]/);}
/** 对原行做乐观校验，避免任务列表过期时改错另一条任务。 */
export function toggleTask(content: string, task: Task): string {
  const lines = content.split('\n');
  if (lines[task.line] !== task.source) throw new Error('任务已被其他编辑修改，请刷新后再试');
  const at=taskCheckbox(task);if(at<0)throw Error('任务格式无法识别');
  lines[task.line]=task.source.slice(0,at)+(task.checked?'[ ]':'[x]')+task.source.slice(at+3);
  return lines.join('\n');
}
export function safeName(name: string): string { return name.replace(/[\\/:*?"<>|\[\]#^]/g, '-').replace(/^\.+/, '').trim().slice(0, 100) || '未命名'; }

export function boardLinks(board: Board): string[] { return [...new Set(board.nodes.filter(n => n.kind === 'board').map(n => n.file!))]; }
/** 多父级引用合法，但不能把祖先放进后代；检查只访问可达子图。 */
export function wouldCycle(graph: ReadonlyMap<string, readonly string[]>, parent: string, child: string): boolean {
  const pending = [child], visited = new Set<string>();
  while (pending.length) { const path = pending.pop()!; if (path === parent) return true; if (visited.has(path)) continue; visited.add(path); pending.push(...(graph.get(path) || [])); }
  return false;
}
/** One-operation index only: boards are mutable and must never reuse this after edits or undo. */
function selectionExpansion(board:Board){
  const nodes=new Map(board.nodes.map(n=>[n.id,n]));let children:Map<string,string[]>|undefined;
  const expand=(selected:ReadonlySet<string>)=>{
    const ids=new Set([...selected].filter(id=>nodes.has(id)));
    // Frames own contained content, not other frames. Preserve that existing rule.
    const sections=board.nodes.filter(n=>n.kind==='section'&&ids.has(n.id));
    for(const section of sections)for(const n of board.nodes)if(contained(section,n))ids.add(n.id);
    const pending=[...ids].filter(id=>nodes.get(id)?.branchFolded),seen=new Set<string>();
    if(pending.length){children??=branchState(board).children;while(pending.length){const id=pending.pop()!;if(seen.has(id))continue;seen.add(id);for(const child of children.get(id)||[]){ids.add(child);pending.push(child);}}}
    return ids;
  };
  return{nodes,expand};
}
export function expandedSelection(board: Board, selected: Set<string>): Set<string> {return selectionExpansion(board).expand(selected);}
/** Loose cards are singleton units; expand only frames/folded roots using one transaction index. */
export function selectionMemberships(board:Board,roots:readonly Card[]){
  const {nodes,expand}=selectionExpansion(board),memberships=new Map<string,Card[]>();
  for(const root of roots){const members:Card[]=[];if(root.kind==='section'||root.branchFolded)for(const id of expand(new Set([root.id]))){const node=nodes.get(id);if(node&&id!==root.id)members.push(node);}memberships.set(root.id,members);}
  return memberships;
}
/** Expand only unlocked movement roots; locked frames must not drag their contents. */
export function movableSelection(board:Board,selected:ReadonlySet<string>):Set<string>{
  const roots=new Set(board.nodes.filter(n=>selected.has(n.id)&&!n.locked).map(n=>n.id));
  const expanded=expandedSelection(board,roots);
  return new Set(board.nodes.filter(n=>expanded.has(n.id)&&!n.locked).map(n=>n.id));
}
/** 先生成完整子白板，再由调用层落盘；跨边界关系改接到入口，内部关系原样保留。 */
export function extractSubboard(original: Board, selected: Set<string>, path: string, title: string, portalId: string = uid()) {
  const ids = expandedSelection(original, selected), members = original.nodes.filter(n => ids.has(n.id));
  if (!members.length) throw new Error('请先选择卡片或分组');
  const parent = clone(original), child = emptyBoard(); child.version = original.version === 3 ? 3 : 2; parent.version = child.version; if(original.mode){child.mode=original.mode;child.mindmapDirection=original.mindmapDirection;}
  const x = Math.min(...members.map(n => n.x)), y = Math.min(...members.map(n => n.y));
  child.nodes = clone(members).map(n => ({ ...n, x: n.x - x + 50, y: n.y - y + 50 }));
  child.edges = clone(original.edges.filter(e => ids.has(e.from) && ids.has(e.to)));
  parent.nodes = parent.nodes.filter(n => !ids.has(n.id));
  const portal: Card = { id: portalId, kind: 'board', file: path, title, x, y, width: 340, height: 265, color: 'green' };
  parent.nodes.push(portal);
  parent.edges = parent.edges.filter(e => !(ids.has(e.from) && ids.has(e.to))).map(e => ({ ...e, from: ids.has(e.from) ? portalId : e.from, to: ids.has(e.to) ? portalId : e.to }));
  for(const e of parent.edges) if(e.from===portalId||e.to===portalId) delete e.kind;
  return { parent, child, portal };
}
/** 按阅读顺序排布；整个分组作为一个单元移动，内部相对位置不变。 */
export function tidyBoard(board: Board, selected: Set<string> = new Set()) {
  const sections = board.nodes.filter(n => n.kind === 'section'),hidden=branchState(board).hidden;
  const candidates = board.nodes.filter(n=>!hidden.has(n.id)).filter(n => selected.size ? selected.has(n.id) : n.kind === 'section' || !sections.some(s => contained(s, n)))
    .filter(n => !sections.some(s => s.id !== n.id && (!selected.size || selected.has(s.id)) && contained(s, n)))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const membership=selectionMemberships(board,candidates);
  // A locked member pins its complete frame/folded subtree; restoring just that
  // member after moving the unit would split the group or stretch hidden branches.
  const units=candidates.filter(n=>!n.locked&&!membership.get(n.id)!.some(member=>member.locked));
  if (!units.length) return;
  const cols = Math.ceil(Math.sqrt(units.length)), left = Math.min(...units.map(n => n.x)), top = Math.min(...units.map(n => n.y));
  let y = top;
  const moved = new Set<string>();
  for (let start = 0; start < units.length; start += cols) {
    const row = units.slice(start, start + cols); let x = left;
    for (const unit of row) {
      const dx = x - unit.x, dy = y - unit.y;
      const members = membership.get(unit.id) || [];
      for (const n of [unit, ...members]) if (!moved.has(n.id)) { n.x += dx; n.y += dy; moved.add(n.id); }
      x += unit.width + 70;
    }
    y += Math.max(...row.map(n => n.height)) + 75;
  }
}
