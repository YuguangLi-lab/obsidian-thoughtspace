import type {Board} from './model';
import {connectionPath} from './connections';
import {visibleBranchBoard} from './mindmap';

export interface BoardExportNode {id:string;x:number;y:number;w:number;h:number;title:string}
export interface BoardExportArrow {x:number;y:number;dx:number;dy:number}
export interface BoardExportEdge {path:string;label:string;labelX:number;labelY:number;dash?:[number,number];arrows:BoardExportArrow[]}
export interface BoardExportScene {width:number;height:number;nodes:BoardExportNode[];edges:BoardExportEdge[]}

function place(value:number){return String(Math.round(value*100)/100);}
/** World path commands are M, L, C, and Q with coordinate pairs. Map each pair with the camera. */
function screenPath(path:string,zoom:number,ox:number,oy:number){
 let axis=0,out='';
 for(const token of path.match(/[A-Za-z]|-?(?:\d+\.\d+|\d+|\.\d+)(?:e[+-]?\d+)?/g)||[]){
  if(out)out+=' ';
  if(/[A-Za-z]/.test(token)){axis=0;out+=token;continue;}
  const value=Number(token);
  out+=place(axis%2===0?value*zoom+ox:value*zoom+oy);axis+=1;
 }
 return out;
}
function pathPoints(path:string){
 const values=(path.match(/-?(?:\d+\.\d+|\d+|\.\d+)(?:e[+-]?\d+)?/g)||[]).map(Number),points:{x:number;y:number}[]=[];
 for(let i=0;i+1<values.length;i+=2)points.push({x:values[i],y:values[i+1]});
 return points;
}
function aim(from:{x:number;y:number},to:{x:number;y:number}):BoardExportArrow|undefined{
 const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
 if(length<0.5)return;
 return {x:to.x,y:to.y,dx:Math.round(dx/length*10000)/10000,dy:Math.round(dy/length*10000)/10000};
}
/** Match the board marker: an end arrow unless the link has none, and a start arrow when it points both ways. */
function linkArrows(path:string,direction:string|undefined):BoardExportArrow[]{
 if(direction==='none')return [];
 const points=pathPoints(path);
 if(points.length<2)return [];
 const arrows:BoardExportArrow[]=[];
 const end=aim(points[points.length-2],points[points.length-1]);
 if(end)arrows.push(end);
 if(direction==='both'){const start=aim(points[1],points[0]);if(start)arrows.push(start);}
 return arrows;
}

/** Map the current camera to a local picture. Images, live PDF pages, and ink are not redrawn. */
export function boardExportScene(board:Board,view:{width:number;height:number},title:(id:string)=>string):BoardExportScene{
 const width=Math.max(1,Math.min(4096,Math.round(view.width))),height=Math.max(1,Math.min(4096,Math.round(view.height)));
 const zoom=board.viewport.zoom,ox=board.viewport.x,oy=board.viewport.y;
 if(!Number.isFinite(zoom)||zoom<=0||!Number.isFinite(ox)||!Number.isFinite(oy))throw Error('当前画面无法导出');
 // The board draws world point (x, y) at x*zoom+viewport.x, not (x+viewport.x)*zoom.
 // Folded branches and groups hide their members and draw a short heading. Export that picture.
 const shown=visibleBranchBoard(board);
 const world=new Map(shown.nodes.map(node=>[node.id,node]));
 const screen=(x:number,y:number)=>({x:x*zoom+ox,y:y*zoom+oy});
 const nodes:BoardExportNode[]=[];
 for(const node of shown.nodes){
  const origin=screen(node.x,node.y),w=node.width*zoom,h=node.height*zoom;
  if(origin.x+w<0||origin.y+h<0||origin.x>width||origin.y>height)continue;
  nodes.push({id:node.id,x:origin.x,y:origin.y,w,h,title:title(node.id).slice(0,80)||'未命名'});
 }
 const exported=new Set(nodes.map(node=>node.id));
 const edges:BoardExportEdge[]=[];
 for(const edge of shown.edges){
  const from=world.get(edge.from),to=world.get(edge.to);
  if(!from||!to||!exported.has(from.id)||!exported.has(to.id))continue;
  const route=connectionPath(from,to,edge),label=screen(route.label.x,route.label.y);
  const path=screenPath(route.path,zoom,ox,oy);
  edges.push({path,label:edge.label.slice(0,80),labelX:Math.round(label.x*100)/100,labelY:Math.round((label.y-8)*100)/100,dash:edge.dashed?[Math.max(1,6*zoom),Math.max(1,4*zoom)]:undefined,arrows:linkArrows(path,edge.direction)});
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
