import {markdownRows} from './markdown-context';
import {maskInlineCode} from './markdown-literals';
import {markdownLinkRanges} from './markdown-links';
import {hasAsciiControl as controls} from './value-guards';
export interface PdfQuoteOrigin {original:string;sourcePath:string}
export interface PdfQuoteLink {path:string;fragment:string;page:number;kind:string}
export interface PdfQuotePlan {text:string;origin:PdfQuoteOrigin;links:PdfQuoteLink[]}
const decode=(value:string)=>{try{return decodeURIComponent(value);}catch{throw Error('链接包含无效编码');}};
/** Parse destinations without normalizing the fragment: PDF++ owns its opaque values. */
function destination(link:string){
 if(link.startsWith('[['))return link.slice(2,-2).split('|')[0];
 const start=link.indexOf('](');if(start<0)return;
 let target=link.slice(start+2,-1).trim();
 if(target.startsWith('<')){const end=target.indexOf('>');if(end<0)throw Error('链接目标不完整');target=target.slice(1,end);}
 else target=target.replace(/\s+["'][^\n]*["']\s*$/,'');
 return target.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g,'$1');
}
export function pdfQuoteFragment(link:string){const target=destination(link),hash=target?.indexOf('#')??-1;return hash<0?undefined:target!.slice(hash);}
export function pdfQuoteLocation(fragment:string){
 if(fragment.length>2048||controls(fragment)||/[<>\s]/.test(fragment)||/%(?![a-f\d]{2})/i.test(fragment))throw Error('PDF 定位参数过长或包含控制字符');
 const params=new URLSearchParams(fragment.replace(/^#/,''));
 if([...params].length>64)throw Error('PDF 定位参数过多');
 for(const key of ['page','selection','annotation','rect','offset','color','width'])if(params.getAll(key).length>1)throw Error(`PDF ${key} 参数重复`);
 if(params.has('page')&&!/^\d+$/.test(params.get('page')!))throw Error('PDF 页码必须为正整数');
 const page=Number(params.get('page')||1);if(!Number.isSafeInteger(page)||page<1)throw Error('PDF 页码必须为正整数');
 const numbers=(key:string,count:number,integers=false)=>{const raw=params.get(key);if(raw===null)return;const parts=raw.split(',');if(parts.length!==count||parts.some(s=>!s.trim()||!Number.isFinite(Number(s))||(integers&&(!Number.isSafeInteger(Number(s))||Number(s)<0))))throw Error(`PDF ${key} 参数无效`);return parts.map(Number);};
 const selection=numbers('selection',4,true);if(selection&&(selection[2]<selection[0]||selection[2]===selection[0]&&selection[3]<selection[1]))throw Error('PDF 文字范围顺序无效');
 const rect=numbers('rect',4);if(rect&&(rect[2]<=rect[0]||rect[3]<=rect[1]))throw Error('PDF 矩形范围无效');
 numbers('offset',3);
 for(const [key,value] of params)if(controls(value)||value.length>512||!key)throw Error('PDF 定位参数无效');
 if(params.has('annotation')&&!params.get('annotation'))throw Error('PDF 批注标识为空');
 if(params.has('width')&&(!Number.isFinite(Number(params.get('width')))||Number(params.get('width'))<=0))throw Error('PDF 嵌入宽度无效');
 return {page,kind:selection?'文字选区':rect?'矩形摘录':params.has('annotation')?'批注':'页码'};
}
/** Explicit context wins; an unqualified duplicate name never silently picks a file. */
export function resolvePdfQuotePath(path:string,sourcePath:string,files:readonly string[],resolve:(path:string,source:string)=>string|undefined){
 if(!path||controls(path)||/^[a-z][a-z\d+.-]*:|^[/\\]|\\/i.test(path))throw Error('只支持仓库内的文件链接');
 if(path.includes('/')&&files.includes(path))return path;
 const suffix=files.filter(file=>file===path||file.endsWith('/'+path)||file.replace(/\.md$/i,'')===path||file.replace(/\.md$/i,'').endsWith('/'+path));
 if(!sourcePath&&suffix.length>1)throw Error(`“${path}”有多个同名文件，请填写来源笔记路径或使用完整路径`);
 const result=resolve(path,sourcePath);if(!result||!files.includes(result))throw Error(`找不到来源文件：${path}。请检查链接与来源笔记路径`);
 return result;
}
function canonicalLink(path:string,fragment:string,label:string){
 const target=encodeURI(path).replace(/[()#^|[\]]/g,c=>'%'+c.charCodeAt(0).toString(16))+fragment;
 return `[${label.replace(/[\\[\]]/g,'\\$&')}](<${target}>)`;
}
/** One paste becomes one editable card and one undo step; original clipboard text stays intact. */
export function planPdfQuote(original:string,sourcePath:string,resolve:(path:string,source:string)=>string):PdfQuotePlan{
 if(!original.trim()||original.length>100000)throw Error('请粘贴 PDF 引用（最多 100,000 字符）');
 if(sourcePath.length>2048||controls(sourcePath))throw Error('来源笔记路径无效');
 const ranges=markdownLinkRanges(original);if(ranges.length>100)throw Error('一次最多处理 100 个链接');
 const links:PdfQuoteLink[]=[],replacements:{from:number;to:number;text:string}[]=[];
 for(const range of ranges){
  const raw=original.slice(range.from,range.to),target=destination(raw);if(target===undefined)continue;
  const hash=target.indexOf('#'),encodedPath=hash<0?target:target.slice(0,hash),path=raw.startsWith('[[')?encodedPath:decode(encodedPath),fragment=hash<0?'':target.slice(hash);
  if(/^https?:\/\//i.test(path)){if(/\.pdf$/i.test(path))throw Error('请使用仓库内的 PDF 链接');continue;}
  if(/^[a-z][a-z\d+.-]*:|^\/\//i.test(path))throw Error('不支持此链接协议');
  const resolved=resolve(path||sourcePath,sourcePath),pdf=/\.pdf$/i.test(resolved);
  if(pdf){const location=pdfQuoteLocation(fragment);links.push({path:resolved,fragment,...location});if(links.length>20)throw Error('一次最多导入 20 条 PDF 引用');}
  // Keep note block anchors independent from PDF coordinates. Explicit root paths
  // let this Markdown remain correct when the board is in a different folder.
  const label=raw.startsWith('[[')?raw.slice(2,-2).split('|').slice(1).join('|')||resolved.split('/').pop()!:raw.slice(1,raw.indexOf(']('));
  replacements.push({...range,text:canonicalLink(resolved,fragment,label)});
 }
 if(!links.length)throw Error('未找到仓库内的 PDF 引用。支持 wiki 或 Markdown 链接、引文及矩形嵌入');
 let text=original;for(const r of replacements.reverse())text=text.slice(0,r.from)+r.text+text.slice(r.to);
 const unique=[...new Map(links.map(link=>[link.path+link.fragment,link])).values()];
 text=text.trimEnd()+'\n\n'+unique.map(link=>`> 来源：${canonicalLink(link.path,link.fragment||'#page=1',link.path.split('/').pop()!)} · PDF 第 ${link.page} 页`).join('\n\n');
 return{text,origin:{original,sourcePath},links:unique};
}

/** Equivalent rendered links may still have different original clipboard text. */
export function samePdfQuote(node:{text?:string;pdfQuote?:PdfQuoteOrigin},plan:PdfQuotePlan){return node.text===plan.text&&node.pdfQuote?.original===plan.origin.original&&node.pdfQuote.sourcePath===plan.origin.sourcePath;}

/** Imported rendered links follow source renames; literal examples and original snapshots do not. */
export function rebasePdfQuoteLinks(text:string,rewrite:(link:string)=>string){
 return [...markdownRows(text)].map(row=>{if(row.code)return row.source;const visible=maskInlineCode(row.visible);let result=row.source;for(const range of markdownLinkRanges(visible).reverse()){const link=row.source.slice(range.from,range.to);result=result.slice(0,range.from)+rewrite(link)+result.slice(range.to);}return result;}).join('\n');
}
