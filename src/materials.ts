import type {MaterialPoint} from './evidence';
import {textExcerptPresentation} from './excerpt-sources';
import {Board, Card, colors} from './model';
import {layoutMindmap} from './mindmap';
export type FragmentKind='paragraph'|'quote'|'task'|'code';
export interface Fragment {id:string;kind:FragmentKind;title:string;heading:string;body:string;start:number;end:number;selection?:{from:number;to:number}}
export const fragmentLabels:Record<FragmentKind,string>={paragraph:'段落',quote:'引用',task:'待办',code:'代码'};
export interface OutlineTopic {title:string;parent:number|null;depth:number}
const plain=(s:string)=>s.replace(/!?\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_match:string,a:string,b:string|undefined)=>b||a).replace(/[*`~]/g,'').trim();
/** Line numbers remain tied to the source. Fenced blocks and frontmatter never become fake headings. */
function sourceLines(raw:string){
 if(raw.length>500000)throw Error('材料超过 500,000 字符，请先选取一个章节');
 const lines=raw.replace(/\r\n?/g,'\n').split('\n');let start=0;
 if(lines[0]?.trim()==='---'){const end=lines.findIndex((s,i)=>i>0&&/^(---|\.\.\.)\s*$/.test(s));if(end<0)throw Error('笔记属性区未闭合，请先修复 Markdown');start=end+1;}
 return{lines,start};
}
export function extractFragments(raw:string):{fragments:Fragment[];truncated:boolean}{
 const {lines,start}=sourceLines(raw),fragments:Fragment[]=[];let heading='',block:string[]=[],begin=start,fence='';
 const flush=(end:number)=>{const body=block.join('\n');if(body.trim()&&fragments.length<200){const kind:FragmentKind=/^(?: {0,3}(?:`{3,}|~{3,})| {4}|\t)/.test(body)?'code':/^\s*>/.test(body)?'quote':/^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/.test(body)?'task':'paragraph';fragments.push({id:`${begin+1}:${end}`,kind,title:plain(body.replace(/^\s*(>|[-*+]\s+\[[ xX]\])\s*/,'').split('\n')[0].replace(/^\[![^\]]+\][+-]?\s*/,'')).slice(0,96)||heading||'材料片段',heading,body,start:begin+1,end});}else if(body.trim())truncated=true;block=[];};
 let truncated=false;
 for(let i=start;i<lines.length;i++){
  const line=lines[i],marker=line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
  if(fence){block.push(line);if(marker&&marker[1][0]===fence[0]&&marker[1].length>=fence.length&&!marker[2].trim()){fence='';flush(i+1);}continue;}
  if(marker){flush(i);begin=i;block=[line];fence=marker[1];continue;}
  const h=line.match(/^ {0,3}#{1,6}[ \t]+(.*)$/);
  if(h){flush(i);heading=plain(h[1].replace(/^[#]+[ \t]*$|[ \t]+#+[ \t]*$/,''));continue;}
  if(!line.trim()){flush(i);continue;}
  if(fragments.length>=200&&!block.length){truncated=true;break;}
  if(!block.length)begin=i;block.push(line);
 }
 flush(lines.length);return{fragments,truncated};
}
export function parseOutline(raw:string):OutlineTopic[]{
 const {lines,start}=sourceLines(raw),topics:OutlineTopic[]=[],headings:{level:number;index:number}[]=[],lists:{indent:number;index:number}[]=[];let fence='';
 for(let i=start;i<lines.length;i++){
  const line=lines[i],marker=line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
  if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length&&!marker[2].trim())fence='';continue;}if(fence)continue;
  const h=line.match(/^ {0,3}(#{1,6})[ \t]+(.*)$/),list=line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/);
  if(!h&&!list){if(line.trim())lists.length=0;continue;}
  if(topics.length>=200)throw Error('大纲最多支持 200 个主题，请分章节导入');
  let parent:number|null,title:string;
  if(h){lists.length=0;while(headings.length&&headings.at(-1)!.level>=h[1].length)headings.pop();parent=headings.at(-1)?.index??null;title=plain(h[2].replace(/^[#]+[ \t]*$|[ \t]+#+[ \t]*$/,''));headings.push({level:h[1].length,index:topics.length});}
  else{const indent=list![1].replace(/\t/g,'    ').length;while(lists.length&&lists.at(-1)!.indent>=indent)lists.pop();parent=lists.at(-1)?.index??headings.at(-1)?.index??null;title=plain(list![2]);lists.push({indent,index:topics.length});}
  topics.push({title:title.slice(0,500)||'未命名主题',parent,depth:parent===null?0:topics[parent].depth+1});
 }
 return topics;
}
export function outlineBoard(topics:OutlineTopic[],title:string,point:{x:number;y:number},direction:'right'|'down',id:()=>string):Board{
 if(!topics.length||topics.length>200)throw Error('需要 1–200 个标题或列表项');
 const b:Board={version:3,mode:'mindmap',mindmapDirection:direction,nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}};
 const roots=topics.filter(t=>t.parent===null).length;let root:Card|undefined;
 const make=(text:string,depth:number):Card=>({id:id(),kind:'text',topic:true,text,x:point.x,y:point.y,width:Math.min(360,Math.max(160,text.length*9+32)),height:Math.max(60,Math.min(240,Math.ceil(text.length/28)*24+24)),color:depth===0?'green':colors[(depth-1)%colors.length],autoSize:true});
 if(roots>1){root=make(title.trim()||'材料大纲',0);b.nodes.push(root);}
 const nodes:Card[]=[];
 topics.forEach((t,i)=>{if(t.parent!==null&&(!Number.isInteger(t.parent)||t.parent<0||t.parent>=i))throw Error('大纲层级无效');const n=make(t.title,t.depth+(root?1:0));nodes.push(n);b.nodes.push(n);const parent=t.parent===null?root:nodes[t.parent];if(parent)b.edges.push({id:id(),from:parent.id,to:n.id,label:'',kind:'branch',style:'curve',direction:'none',color:n.color});});
 layoutMindmap(b,b.nodes[0].id,direction);return b;
}

/** Exact native-editor offsets; never expand a sentence selection to its whole paragraph. */
export function selectionFragment(raw:string,from:number,to:number):Fragment{
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to>raw.length||to<=from)throw Error('请选择一段文字');
 const body=raw.slice(from,to);if(!body.trim())throw Error('选区没有正文');if(body.length>100000)throw Error('一次最多摘录 100,000 字符，请分段拖入');
 const start=raw.slice(0,from).split('\n').length,end=raw.slice(0,to-(body.endsWith('\n')?1:0)).split('\n').length;
 return{id:`selection:${from}:${to}`,kind:'paragraph',title:plain(body.split('\n').find(s=>s.trim())||'摘录').slice(0,96)||'摘录',heading:'',body,start,end,selection:{from,to}};
}
export interface MaterialReference {original:string;replacement:string;start:{line:number;col:number};end:{line:number;col:number}}
/** Rebase only source-indexed links whose exact original text still matches; code and prose remain untouched. */
export function rebaseFragment(raw:string,f:Fragment,references:MaterialReference[]){
 if(f.selection){
  const {from,to}=f.selection;if(selectionFragment(raw,from,to).body!==f.body)throw Error('文字选区已变化，请重新选择');
  const lines=raw.split('\n'),offsets:number[]=[];let total=0;for(const line of lines){offsets.push(total);total+=line.length+1;}
  const edits=references.map(r=>({...r,a:offsets[r.start.line]+r.start.col,b:offsets[r.end.line]+r.end.col})).filter(r=>r.a>=from&&r.b<=to).sort((a,b)=>b.a-a.a);
  let body=f.body;for(const r of edits){if(raw.slice(r.a,r.b)!==r.original)throw Error('原文链接索引已变化，请稍后重新拖入');body=body.slice(0,r.a-from)+r.replacement+body.slice(r.b-from);}return body;
 }
 const lines=raw.replace(/\r\n?/g,'\n').split('\n').slice(f.start-1,f.end),region=lines.join('\n'),offset=(line:number,col:number)=>lines.slice(0,line-(f.start-1)).reduce((n,s)=>n+s.length+1,0)+col;
 let body=region;const edits=references.filter(r=>r.start.line>=f.start-1&&r.end.line<f.end).sort((a,b)=>b.start.line-a.start.line||b.start.col-a.start.col);
 // Use separate numeric offsets; cached positions are inclusive/exclusive respectively.
 for(const r of edits){const start=offset(r.start.line,r.start.col),end=offset(r.end.line,r.end.col);if(region.slice(start,end)!==r.original)throw Error('原文链接索引已变化，请刷新材料后再试');body=body.slice(0,start)+r.replacement+body.slice(end);}
 if(region!==f.body)throw Error('材料片段已变化，请刷新后再试');return body;
}

export interface MaterialImportOptions {asText?:boolean;position?:MaterialPoint;mergeTitle?:string;title?:string;groupId?:string;focus?:boolean;insight?:string}
export interface MaterialImportResult {ids:string[];files:string[];boardPath:string;groupId?:string}
export function materialKey(f:Fragment){return JSON.stringify([f.heading,f.body]);}
export function excerptDocuments(fragments:Fragment[],sourceLink:string,options:MaterialImportOptions={}){
 const clean=(text:string)=>text.replace(/[\r\n]+/g,' ').trim().slice(0,100);
 const insight=options.insight?.trim();const reflection=insight?`## 我的理解\n\n${insight}\n\n## 来源摘录\n\n`:'';
 const citation=(f:Fragment)=>`> 来源：${sourceLink} · 第 ${f.start}–${f.end} 行${f.heading?' · '+f.heading:''}`;
 const part=(f:Fragment)=>`${f.body}\n\n${citation(f)}`;
 if(options.mergeTitle!==undefined){const title=clean(options.mergeTitle);if(!title)throw Error('请为合并后的概念笔记填写标题');return[{title,kind:fragments[0].kind,body:`# ${title}\n\n${reflection}${fragments.map(f=>f.body).join('\n\n---\n\n')}\n\n${fragments.map(citation).join('\n\n')}\n`}];}
 return fragments.map(f=>{const title=clean(fragments.length===1&&options.title?options.title:f.title);return{title,kind:f.kind,body:`# ${title}\n\n${reflection}${part(f)}\n`};});
}
/** The cache is intentionally per-workbench and bounded, never a vault-wide content index. */
export class MaterialProgress {
 private sources=new Map<object,Map<string,MaterialImportResult>>();
 constructor(readonly limit=6){}
 record(source:object,fragments:Fragment[],result:MaterialImportResult){const entries=this.sources.get(source)||new Map<string,MaterialImportResult>();this.sources.delete(source);this.sources.set(source,entries);for(const f of fragments)entries.set(result.boardPath+'\n'+materialKey(f),result);while(entries.size>600)entries.delete(entries.keys().next().value!);while(this.sources.size>this.limit)this.sources.delete(this.sources.keys().next().value!);}
 get(source:object,fragment:Fragment,boardPath:string){return this.sources.get(source)?.get(boardPath+'\n'+materialKey(fragment));}
 get size(){return this.sources.size;}
 clear(){this.sources.clear();}
}

export const pdfLiteralText=(text:string)=>text.replace(/([!-/:-@[-`{-~])/g,'\\$1');

/** Plain PDF text stays plain on the board; escape it only when creating Markdown. */
export function excerptNoteMarkdown(raw:string){
 const {body,sources}=textExcerptPresentation(raw);if(!sources.length||sources.some(source=>!source.page))return raw;
 return pdfLiteralText(body.trimEnd())+'\n\n'+sources.map(source=>'> '+source.citation).join('\n\n')+'\n';
}

/** PDF text is literal source text, not executable Markdown supplied by the document. */
export function pdfExcerptDocument(text:string,sourceLink:string,page:number,endPage=page){
 if(!text.trim()||text.length>100000)throw Error('请选择 1–100,000 字符的 PDF 正文');
 if(!Number.isInteger(page)||!Number.isInteger(endPage)||page<1||endPage<page)throw Error('无法确定 PDF 页码，请在正文中重新选择');
 const literal=pdfLiteralText;
 const title=text.trim().split('\n')[0].slice(0,80).replace(/[\r\n]/g,' '),pages=page===endPage?`${page}`:`${page}–${endPage}`;
 return{title,body:`# ${literal(title)}\n\n${text.trim().split('\n').map(line=>'> '+literal(line)).join('\n')}\n\n来源：${sourceLink} · PDF 第 ${pages} 页\n`};
}
