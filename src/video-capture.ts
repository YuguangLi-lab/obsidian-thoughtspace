import type { Board, Card } from './model';
import { yingjianNotePath, parseYingjianLink } from './yingjian';
export type CaptureLayout={width:number;placement:'below'|'right';color:'blue'|'green'|'rose'|'slate'};
export function captureLayout(raw:unknown):CaptureLayout{
 const r=(raw&&typeof raw==='object'?raw:{}) as Partial<CaptureLayout>;
 return{width:typeof r.width==='number'&&Number.isFinite(r.width)?Math.min(640,Math.max(300,Math.round(r.width))):380,placement:r.placement==='right'?'right':'below',color:r.color==='green'||r.color==='rose'||r.color==='slate'?r.color:'blue'};
}
export interface VideoCaptureRequest { id:string; board:string; note:string; vaultId:string; layout?:CaptureLayout; presentation?:'objects'; }
export function videoCaptureRequest(raw:unknown):VideoCaptureRequest {
 const r=raw as VideoCaptureRequest;
 if(!r||typeof r.id!=='string'||!/^[a-f0-9-]{36}$/.test(r.id)||!yingjianNotePath(r.note)||typeof r.board!=='string'||!r.board.endsWith('.thoughtspace')||!yingjianNotePath(r.board.slice(0,-13)+'.md')||typeof r.vaultId!=='string'||!/^[a-f0-9]{20}$/.test(r.vaultId))throw Error('视频记录目标或标识无效');
 if(r.presentation!==undefined&&r.presentation!=='objects')throw Error('不支持的视频记录展示方式');
 return{id:r.id,board:r.board,note:r.note,vaultId:r.vaultId,...(r.layout?{layout:captureLayout(r.layout)}:{}),...(r.presentation?{presentation:r.presentation}:{})};
}
export interface VideoCaptureContent {text:string;image?:string;imageSize?:{width:number;height:number}}
/** Read the saved ID-matched capture. Plain text objects never render arbitrary HTML. */
export function videoCaptureContent(raw:string,id:string):VideoCaptureContent {
 if(raw.length>500000||!/^[a-f0-9-]{36}$/.test(id))throw Error('记录格式或长度无效');
 const normalized=raw.replace(/\r\n?/g,'\n');
 const header=/^> \[!(note|question|todo)\] [^\n]*?\[((?:\d{1,3}:)?\d{1,2}:\d{2})\]\((yingjian:\/\/open\?[^\s)]+)\)$/m.exec(normalized);
 if(!header||!parseYingjianLink(header[3]))throw Error('找不到这条记录的有效时间戳');
 const start=header.index+header[0].length,tail=normalized.slice(start),marker=new RegExp('^\\^video-t-'+id+'$','m').exec(tail);
 if(!marker)throw Error('找不到这条记录的备份标记');
 const kind=header[1],body=tail.slice(0,marker.index).split('\n').filter(line=>line.startsWith('>')).map(line=>line.replace(/^> ?/,''));
 while(body.length&&!body.at(-1)?.trim())body.pop();
 const imageMatch=/^!\[\[([^\]|]+)\|640\]\]$/.exec(body.at(-1)||'');let image:string|undefined;
 if(imageMatch&&imageMatch[1].endsWith(`/视频截图-${id}.png`)){
   image=imageMatch[1];if(!yingjianNotePath(image.slice(0,-4)+'.md'))throw Error('截图路径无效');body.pop();
 }
 const label=kind==='question'?'疑问':kind==='todo'?'待实践':'重点';
 return{text:`${label} · [${header[2]}](${header[3]})\n\n${body.join('\n').trim()||'时间点'}`,image};
}
/** One atomic change creates independent objects; retry never overwrites edited objects. */
export function addVideoCaptureObjects(board:Board,request:VideoCaptureRequest,content:VideoCaptureContent,measure?:(node:Card)=>void):string {
 const id='yingjian-'+request.id,ids=[id,id+'-image'];
 const previous=board.nodes.filter(n=>ids.includes(n.id));
 if(previous.length){
   if(previous.some(n=>!['text','image'].includes(n.kind)||n.videoCapture?.id!==request.id||n.videoCapture.note!==request.note))throw Error('视频记录标识与已有对象冲突');
   return previous[0].id;
 }
 const layout=captureLayout(request.layout),objects=board.nodes.filter(n=>n.kind!=='section');
 const x=objects.length?(layout.placement==='right'?Math.max(...objects.map(n=>n.x+n.width))+32:Math.min(...objects.map(n=>n.x))):0;
 const y=objects.length?(layout.placement==='below'?Math.max(...objects.map(n=>n.y+n.height))+32:Math.min(...objects.map(n=>n.y))):0;
 const meta={id:request.id,note:request.note};
 const text:Card={id,kind:'text',text:content.text,x,y,width:layout.width,height:100,color:layout.color,fontSize:16,autoSize:false,videoCapture:{...meta}};
 measure?.(text);
 const additions=[text];
 if(content.image){
   const size=content.imageSize;if(!size||!Number.isFinite(size.width)||!Number.isFinite(size.height)||size.width<=0||size.height<=0)throw Error('截图尺寸无效');
   additions.push({id:id+'-image',kind:'image',file:content.image,x,y:y+text.height+16,width:layout.width,height:Math.max(60,Math.min(2000,Math.round(layout.width*size.height/size.width))),color:layout.color,videoCapture:{...meta}});
 }
 board.version=3;board.nodes.push(...additions);return id;
}
/** One native Markdown card, one undo entry. Retrying the same capture is idempotent. */
export function addVideoCaptureCard(board:Board,request:VideoCaptureRequest):string {
 const id='yingjian-'+request.id,previous=board.nodes.find(n=>n.id===id);
 if(previous){if(previous.kind!=='card'||previous.file!==request.note)throw Error('视频记录标识与已有对象冲突');return id;}
 const objects=board.nodes.filter(n=>n.kind!=='section');
 const layout=captureLayout(request.layout);
 const x=objects.length?(layout.placement==='right'?Math.max(...objects.map(n=>n.x+n.width))+32:Math.min(...objects.map(n=>n.x))):0;
 const y=objects.length?(layout.placement==='below'?Math.max(...objects.map(n=>n.y+n.height))+32:Math.min(...objects.map(n=>n.y))):0;
 const node:Card={id,kind:'card',transparent:true,file:request.note,x,y,width:Math.min(520,layout.width),height:360,preferredWidth:Math.min(520,layout.width),autoFit:true,color:layout.color};
 board.version=3;board.nodes.push(node);return id;
}
