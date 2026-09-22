import {sizeTemplateTopic} from './mindmap-sizing';
import {Board,Card,Color,Edge,clone,parseBoard,uid} from './model';
import {branchState,layoutMindmap,mindmapRoot} from './mindmap';
import {topicRows,topicLabel,TopicResult} from './mindmap-editor';
import {markdownRows,markdownColumns} from './markdown-context';
import {editorMatches,editorReplacement} from './editor-search';
import {connectionPath} from './connections';
import {cardFillHex} from './model';
export interface ImportedTopic {depth:number;text:string}
/** Extract structure while keeping code, comments and body Markdown inside their topic. */
export function parseTopicOutline(source:string,format:'markdown'|'indent'='markdown'):ImportedTopic[]{
 if(!source.trim()||source.length>100000)throw Error('请输入 1–100,000 字符的大纲');
 const result:ImportedTopic[]=[],headings:{level:number;depth:number}[]=[],lists:{indent:number;depth:number}[]=[];
 const push=(depth:number,text:string)=>{if(depth>64||result.length>=1000)throw Error('一次最多导入 1,000 个主题、64 层');result.push({depth,text});};
 const append=(text:string)=>{if(!result.length){if(text.trim())push(0,text);return;}result.at(-1)!.text+='\n'+text;};
 for(const row of markdownRows(source)){
  const raw=row.source.replace(/\r$/,'');
  if(format==='indent'){if(!raw.trim())continue;const indent=markdownColumns(/^[\t ]*/.exec(raw)![0]);while(lists.length&&lists.at(-1)!.indent>=indent)lists.pop();const depth=lists.length;push(depth,raw.trim());lists.push({indent,depth});continue;}
  if(row.code){if('openBlock' in row)append(raw);continue;}
  if(row.commentBefore||row.visible.trim()!==raw.trim()){append(raw);continue;}
  const heading=row.topLevel?/^ {0,3}(#{1,6})\s+(.+)$/.exec(raw):null;
  if(heading){while(headings.length&&headings.at(-1)!.level>=heading[1].length)headings.pop();const depth=headings.length;push(depth,heading[2].replace(/\s+#+\s*$/,'').trim());headings.push({level:heading[1].length,depth});lists.length=0;continue;}
  const item=/^([\t ]*)(?:[-+*]|\d+[.)])\s+(.+)$/.exec(raw);
  if(item){const indent=markdownColumns(item[1]);while(lists.length&&lists.at(-1)!.indent>=indent)lists.pop();const depth=(headings.at(-1)?.depth??-1)+1+lists.length;push(depth,item[2]);lists.push({indent,depth});continue;}
  append(raw);
 }
 for(const item of result){item.text=item.text.trim();if(item.text.length>10000)throw Error('单个主题超过 10,000 字符，请按标题拆分');}
 if(!result.length)throw Error('没有可导入的主题');return result;
}
function editableTree(b:Board,id:string){const root=mindmapRoot(b,id),rows=topicRows(b,root);if(rows.some(r=>r.node.locked))throw Error('主题树中有锁定对象，请先解锁');return root;}
export function appendTopicOutline(source:Board,parentId:string,items:readonly ImportedTopic[],makeId:()=>string=uid):TopicResult{
 const b=clone(source),root=editableTree(b,parentId),parent=b.nodes.find(n=>n.id===parentId);if(!parent||parent.kind==='section')throw Error('请选择一个内容主题');
 if(!items.length||items.length>1000)throw Error('一次导入 1–1,000 个主题');
 const ids=new Set([...b.nodes,...b.edges].map(n=>n.id)),fresh=()=>{const id=makeId();if(!id||ids.has(id))throw Error('新主题标识冲突');ids.add(id);return id;},stack:string[]=[];let selected=parentId,previous=-1;
 for(const item of items){if(!Number.isInteger(item.depth)||item.depth<0||item.depth>64||item.depth>previous+1||!item.text.trim()||item.text.length>10000)throw Error('大纲层级或文字无效');previous=item.depth;stack.length=item.depth;
  const id=fresh(),from=stack.at(-1)||parentId,width=300,height=Math.max(70,item.text.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil([...line].length/20)),0)*28+30);
  const node:Card={id,kind:'text',text:item.text,topic:true,x:parent.x,y:parent.y,width,height,color:parent.color,autoSize:false};if(b.nodes.find(n=>n.id===root)?.mindmapRules?.automatic)sizeTemplateTopic(node);b.nodes.push(node);b.edges.push({id:fresh(),from,to:id,kind:'branch',label:'',direction:'none',style:'curve',color:parent.color});stack.push(id);selected=id;
 }
 delete parent.branchFolded;layoutMindmap(b,root);parseBoard(JSON.stringify(b));return{board:b,root,selected};
}
export interface TopicReplacement {id:string;before:string;after:string;count:number}
export function topicReplacementPlan(board:Board,root:string,query:string,replacement:string,caseSensitive=false,wholeWord=false):TopicReplacement[]{
 if(!query)throw Error('请输入查找文字');if(replacement.length>10000)throw Error('替换内容过长');const results:TopicReplacement[]=[];let count=0;
 for(const {node}of topicRows(board,root)){if(node.kind!=='text'||node.locked)continue;const before=node.text||'',matches=editorMatches(before,query,{caseSensitive,wholeWord});if(!matches.length)continue;count+=matches.length;if(count>10000)throw Error('匹配超过 10,000 处，请缩小到一个分支');const change=editorReplacement(before,matches,replacement)!;const after=before.slice(0,change.from)+change.text+before.slice(change.to);if(after.length>100000)throw Error('替换后的单个主题超过 100,000 字符');results.push({id:node.id,before,after,count:matches.length});}return results;
}
export function applyTopicReplacements(source:Board,root:string,changes:readonly TopicReplacement[],fit?:(n:Card)=>void):TopicResult{
 const b=clone(source),nodes=new Map(b.nodes.map(n=>[n.id,n])),ids=new Set(topicRows(b,root).map(r=>r.node.id)),seen=new Set<string>();
 for(const change of changes){const n=nodes.get(change.id);if(!n||!ids.has(n.id)||seen.has(n.id)||n.kind!=='text'||n.locked||n.text!==change.before||change.after.length>100000)throw Error('替换预览已过期，请重新预览');seen.add(n.id);}
 for(const change of changes){const n=nodes.get(change.id)!;n.text=change.after;fit?.(n);}
 if(fit)layoutMindmap(b,root);parseBoard(JSON.stringify(b));return{board:b,root:mindmapRoot(b,root),selected:changes[0]?.id||root};
}
export const topicThemes:Record<string,{name:string;colors:Color[]}>={classic:{name:'经典分支',colors:['blue','green','orange','purple','rose','teal']},ocean:{name:'海湾',colors:['blue','cyan','teal','slate']},forest:{name:'林间',colors:['green','teal','lime','brown']},sunset:{name:'日落',colors:['orange','rose','red','purple']},quiet:{name:'石墨',colors:['slate']}};
export function themeTopicTree(source:Board,id:string,preset:string|undefined,line:NonNullable<Edge['style']>|undefined):TopicResult{
 const palette=preset&&Object.hasOwn(topicThemes,preset)?topicThemes[preset].colors:undefined;if((preset&&!palette)||(line&&!['curve','elbow','straight'].includes(line)))throw Error('主题样式无效');const b=clone(source),root=editableTree(b,id),{children}=branchState(b),nodes=new Map(b.nodes.map(n=>[n.id,n])),colors=new Map<string,Color>();
 for(const [i,child]of (children.get(root)||[]).entries()){const list=[child];for(let at=0;at<list.length;at++){colors.set(list[at],palette?palette[i%palette.length]:nodes.get(list[at])!.color);for(const next of children.get(list[at])||[])list.push(next);}}
 if(palette)for(const [id,color]of colors)nodes.get(id)!.color=color;for(const e of b.edges)if(e.kind==='branch'&&colors.has(e.to)){if(palette)e.color=colors.get(e.to);if(line)e.style=line;}return{board:b,root,selected:id};
}
const xml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
/** Standalone SVG contains only escaped text and local geometry, no external resources/scripts. */
export function topicSvg(board:Board,id:string,includeFolded=false){
 const hidden=includeFolded?new Set<string>():branchState(board).hidden,nodes=topicRows(board,id).map(r=>r.node).filter(n=>!hidden.has(n.id));if(!nodes.length||nodes.length>5000)throw Error('SVG 导出范围为 1–5,000 个主题');
 const byId=new Map(nodes.map(n=>[n.id,n]));let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;for(const n of nodes){x=Math.min(x,n.x);y=Math.min(y,n.y);right=Math.max(right,n.x+n.width);bottom=Math.max(bottom,n.y+n.height);}
 const parts=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x-30} ${y-30} ${right-x+60} ${bottom-y+60}" role="img"><title>${xml(topicLabel(nodes[0]))}</title><rect x="${x-30}" y="${y-30}" width="${right-x+60}" height="${bottom-y+60}" fill="#fff"/>`];
 parts.push('<defs><marker id="topic-relation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#657580"/></marker></defs>');
 for(const e of board.edges){const a=byId.get(e.from),b=byId.get(e.to);if(!a||!b)continue;parts.push(`<path d="${connectionPath(a,b,e).path}" fill="none" stroke="${cardFillHex[e.color||b.color]}" stroke-width="2"${e.dashed?' stroke-dasharray="6 4"':''}${e.kind!=='branch'&&e.direction!=='none'?' marker-end="url(#topic-relation-arrow)"':''}${e.kind!=='branch'&&e.direction==='both'?' marker-start="url(#topic-relation-arrow)"':''}/>`);if(e.kind!=='branch'&&e.label){const p=connectionPath(a,b,e).label;parts.push(`<text x="${p.x}" y="${p.y-8}" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#26323a">${xml(e.label.slice(0,80))}</text>`);}}
 for(const n of nodes){parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="10" fill="#fff" stroke="${cardFillHex[n.color]}" stroke-width="2"/>`);const lines=topicLabel(n).split('\n').slice(0,Math.max(1,Math.floor((n.height-24)/22)));for(const [i,line]of lines.entries())parts.push(`<text x="${n.x+12}" y="${n.y+27+i*22}" fill="#26323a" font-family="sans-serif" font-size="14">${xml([...line].slice(0,Math.max(4,Math.floor((n.width-24)/14))).join(''))}</text>`);}
 parts.push('</svg>');return parts.join('');
}
