import type {Board} from './model';

export interface BoardExportNode {id:string;x:number;y:number;w:number;h:number;title:string}
export interface BoardExportEdge {x1:number;y1:number;x2:number;y2:number}
export interface BoardExportScene {width:number;height:number;nodes:BoardExportNode[];edges:BoardExportEdge[]}

/** Map the current camera to a local picture. Images, live PDF pages, and ink are not redrawn. */
export function boardExportScene(board:Board,view:{width:number;height:number},title:(id:string)=>string):BoardExportScene{
 const width=Math.max(1,Math.min(4096,Math.round(view.width))),height=Math.max(1,Math.min(4096,Math.round(view.height)));
 const zoom=board.viewport.zoom,ox=board.viewport.x,oy=board.viewport.y;
 if(!Number.isFinite(zoom)||zoom<=0||!Number.isFinite(ox)||!Number.isFinite(oy))throw Error('当前画面无法导出');
 // The board draws world point (x, y) at x*zoom+viewport.x, not (x+viewport.x)*zoom.
 const screen=(x:number,y:number)=>({x:x*zoom+ox,y:y*zoom+oy});
 const nodes:BoardExportNode[]=[];
 for(const node of board.nodes){
  if(node.kind==='section')continue;
  const origin=screen(node.x,node.y),w=node.width*zoom,h=node.height*zoom;
  if(origin.x+w<0||origin.y+h<0||origin.x>width||origin.y>height)continue;
  nodes.push({id:node.id,x:origin.x,y:origin.y,w,h,title:title(node.id).slice(0,80)||'未命名'});
 }
 const byId=new Map(nodes.map(node=>[node.id,node]));
 const edges:BoardExportEdge[]=[];
 for(const edge of board.edges){
  const from=byId.get(edge.from),to=byId.get(edge.to);
  if(!from||!to)continue;
  edges.push({x1:from.x+from.w/2,y1:from.y+from.h/2,x2:to.x+to.w/2,y2:to.y+to.h/2});
 }
 return {width,height,nodes,edges};
}
export function assertExportable(scene:BoardExportScene){if(!scene.nodes.length)throw Error('当前画面没有可导出的卡片');}

/** One-page PDF whose only content is a JPEG. Callers supply the already-encoded image. */
export function jpegPagePdf(jpeg:Uint8Array,width:number,height:number):Uint8Array{
 if(!jpeg.length||jpeg[0]!==0xff||jpeg[1]!==0xd8||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>4096||height>4096)throw Error('导出的图像无效');
 const encoder=new TextEncoder();
 const parts:Uint8Array[]=[];
 const push=(text:string)=>parts.push(encoder.encode(text));
 const offsets:number[]=[];
 let size=0;
 const add=(bytes:Uint8Array)=>{parts.push(bytes);size+=bytes.length;};
 const obj=(body:string,stream?:Uint8Array)=>{
  offsets.push(size);
  const head=encoder.encode(body);
  add(head);
  if(stream){add(stream);add(encoder.encode('\nendstream\n'));}
  add(encoder.encode('endobj\n'));
 };
 add(encoder.encode('%PDF-1.4\n'));
 obj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\n');
 obj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n');
 obj(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\n`);
 const content=`q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
 obj(`4 0 obj\n<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\n`);
 obj(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,jpeg);
 const xref=size;
 push('xref\n0 6\n');
 push('0000000000 65535 f \n');
 for(const offset of offsets)push(`${String(offset).padStart(10,'0')} 00000 n \n`);
 push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
 return parts.reduce((all,part)=>{const next=new Uint8Array(all.length+part.length);next.set(all);next.set(part,all.length);return next;},new Uint8Array());
}
