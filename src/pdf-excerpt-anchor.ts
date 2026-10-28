import {sha256} from './portable-sha256';
import {isRecord,hasAsciiControl} from './value-guards';
export const pdfExcerptColors=['purple','sand','green','blue','rose'] as const;
export type PdfExcerptColor=typeof pdfExcerptColors[number];
export interface PdfExcerptOrigin {version:1;path:string;ctime:number;mtime:number;size:number;page:number;endPage:number;quote:string;color:PdfExcerptColor;anchor?:{hash:string;from:number;to:number;prefix:string;suffix:string}}
export function validPdfExcerpt(value:unknown):value is PdfExcerptOrigin{
 if(!isRecord(value)||value.version!==1||typeof value.path!=='string'||value.path.length>2048||!value.path.toLowerCase().endsWith('.pdf')||value.path.startsWith('/')||value.path.includes('\\')||value.path.split('/').some(p=>!p||p==='.'||p==='..')||hasAsciiControl(value.path)||typeof value.ctime!=='number'||!Number.isFinite(value.ctime)||value.ctime<0||typeof value.mtime!=='number'||!Number.isFinite(value.mtime)||value.mtime<0||typeof value.size!=='number'||!Number.isSafeInteger(value.size)||value.size<0||!Number.isSafeInteger(value.page)||Number(value.page)<1||!Number.isSafeInteger(value.endPage)||Number(value.endPage)<Number(value.page)||typeof value.quote!=='string'||!value.quote.trim()||value.quote.length>100000||!pdfExcerptColors.includes(value.color as PdfExcerptColor))return false;
 const a=value.anchor;return a===undefined||isRecord(a)&&value.page===value.endPage&&typeof a.hash==='string'&&/^[a-f0-9]{64}$/.test(a.hash)&&Number.isSafeInteger(a.from)&&Number(a.from)>=0&&Number.isSafeInteger(a.to)&&Number(a.to)>Number(a.from)&&Number(a.to)<=2000000&&Number(a.to)-Number(a.from)===value.quote.length&&typeof a.prefix==='string'&&a.prefix.length<=80&&typeof a.suffix==='string'&&a.suffix.length<=80;
}
export function pdfTextAnchor(text:string,from:number,to:number){
 if(text.length>2000000||!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<=from||to>text.length||to-from>100000)throw Error('PDF 选区范围无效');
 return {hash:sha256(text),from,to,prefix:text.slice(Math.max(0,from-80),from),suffix:text.slice(to,to+80)};
}
/** Exact original page text is required. Repeated phrases never trigger guesses. */
export function locatePdfText(origin:PdfExcerptOrigin,text:string){const a=origin.anchor;if(!validPdfExcerpt(origin)||!a||text.length>2000000||sha256(text)!==a.hash||text.slice(a.from,a.to)!==origin.quote||text.slice(Math.max(0,a.from-80),a.from)!==a.prefix||text.slice(a.to,a.to+80)!==a.suffix)return;return{from:a.from,to:a.to};}
export function pdfTextLayer(layer:HTMLElement){
 const doc=layer.ownerDocument,walker=doc.createTreeWalker(layer,NodeFilter.SHOW_TEXT),nodes:Text[]=[];let text='',node:Node|null;while((node=walker.nextNode())){if((node.parentElement?.closest('.endOfContent,.ts-pdf-anchor-highlight')))continue;nodes.push(node as Text);text+=node.textContent||'';if(text.length>2000000)throw Error('PDF 页文字超过定位上限');}return{text,nodes};
}
export function capturePdfExcerpt(range:Range,source:{path:string;ctime:number;mtime:number;size:number},page:number,endPage:number,color:PdfExcerptColor):PdfExcerptOrigin{
 const quote=range.toString().trim(),origin:PdfExcerptOrigin={version:1,...source,page,endPage,quote,color},start=range.startContainer.nodeType===1?range.startContainer as Element:range.startContainer.parentElement,end=range.endContainer.nodeType===1?range.endContainer as Element:range.endContainer.parentElement,layer=start?.closest<HTMLElement>('.textLayer');
 if(page===endPage&&layer&&end?.closest('.textLayer')===layer){const {text}=pdfTextLayer(layer),prefix=range.cloneRange();prefix.selectNodeContents(layer);prefix.setEnd(range.startContainer,range.startOffset);const raw=range.toString(),from=prefix.toString().length+raw.indexOf(quote),to=from+quote.length;if(text.slice(from,to)===quote)origin.anchor=pdfTextAnchor(text,from,to);}
 if(!validPdfExcerpt(origin))throw Error('PDF 摘录来源无效');return origin;
}
export function pdfAnchorRange(layer:HTMLElement,origin:PdfExcerptOrigin){const {text,nodes}=pdfTextLayer(layer),position=locatePdfText(origin,text);if(!position)return;const range=layer.ownerDocument.createRange();let offset=0,started=false;for(const node of nodes){const end=offset+node.length;if(!started&&position.from<end){range.setStart(node,position.from-offset);started=true;}if(started&&position.to<=end){range.setEnd(node,position.to-offset);return range;}offset=end;}}
