import {Board,Card,clone,contained} from './model';
export interface BoardPreferences {
 toolbarDensity:'compact'|'comfortable';wheelMode:'zoom'|'pan';zoomSpeed:number;gridStep:number;previewLimit:number;detailZoom:number;
 defaultCardWidth:number;defaultTextSize:number;defaultEdgeStyle:'curve'|'straight'|'elbow';defaultEdgeDirection:'forward'|'both'|'none';
 showCardTags:boolean;showPorts:boolean;showBoardHints:boolean;axisLock:boolean;alignmentGuides:boolean;aspectLock:boolean;nudgeStep:number;fastNudge:number;
}
export const defaultBoardPreferences:BoardPreferences={toolbarDensity:'compact',wheelMode:'zoom',zoomSpeed:1,gridStep:24,previewLimit:100,detailZoom:.45,defaultCardWidth:300,defaultTextSize:16,defaultEdgeStyle:'curve',defaultEdgeDirection:'forward',showCardTags:true,showPorts:true,showBoardHints:true,axisLock:true,alignmentGuides:true,aspectLock:true,nudgeStep:1,fastNudge:10};
export function cleanBoardPreferences(input:Partial<BoardPreferences>):BoardPreferences{
 const out={...defaultBoardPreferences};for(const k of Object.keys(out) as (keyof BoardPreferences)[]){const v=input[k];if(typeof out[k]==='boolean'&&typeof v==='boolean')Object.assign(out,{[k]:v});}
 const ranges={zoomSpeed:[.3,2],gridStep:[8,64],previewLimit:[20,160],detailZoom:[.2,.9],defaultCardWidth:[220,520],defaultTextSize:[12,32],nudgeStep:[1,10],fastNudge:[10,100]};for(const[k,[min,max]]of Object.entries(ranges)){const v=input[k as keyof BoardPreferences];if(typeof v==='number'&&Number.isFinite(v))Object.assign(out,{[k]:Math.min(max,Math.max(min,v))});}
 for(const[k,values]of Object.entries({toolbarDensity:['compact','comfortable'],wheelMode:['zoom','pan'],defaultEdgeStyle:['curve','straight','elbow'],defaultEdgeDirection:['forward','both','none']})){const value=input[k as keyof BoardPreferences];if(values.includes(value as string))Object.assign(out,{[k]:value});}return out;
}
export type ObjectFilter={kind:string;color:string;query:string};
export function filterObjects(nodes:Card[],filter:ObjectFilter){const q=filter.query.toLocaleLowerCase().trim();return new Set(nodes.filter(n=>(!filter.kind||n.kind===filter.kind)&&(!filter.color||n.color===filter.color)&&(!q||`${n.file||''} ${n.title||''} ${n.text||''}`.toLocaleLowerCase().includes(q))).map(n=>n.id));}
export type NodeStyle=Pick<Card,'transparent'|'fillColor'|'color'|'textColor'|'fontFamily'|'fontSize'|'textAlign'|'customBorder'|'borderStyle'|'borderWidth'>;
const styleKeys=['transparent','fillColor','color','textColor','fontFamily','fontSize','textAlign','customBorder','borderStyle','borderWidth'] as const;
export function readNodeStyle(n:Card):NodeStyle{const result={color:n.color} as NodeStyle;for(const k of styleKeys)if(n[k]!==undefined)Object.assign(result,{[k]:n[k]});return result;}
export function applyNodeStyle(board:Board,ids:ReadonlySet<string>,style:NodeStyle){for(const n of board.nodes.filter(n=>ids.has(n.id)&&!n.locked))for(const k of styleKeys){if((k==='fillColor'||k==='transparent')&&n.kind!=='card')continue;if(style[k]===undefined)delete n[k];else Object.assign(n,{[k]:style[k]});}}
export function stepLayers(board:Board,ids:ReadonlySet<string>,up:boolean){const picked=(n:Card)=>ids.has(n.id)&&!n.locked;for(let i=up?board.nodes.length-2:1;up?i>=0:i<board.nodes.length;up?i--:i++){const other=i+(up?1:-1);if(picked(board.nodes[i])&&!picked(board.nodes[other])&&(board.nodes[i].kind==='section')===(board.nodes[other].kind==='section')){[board.nodes[i],board.nodes[other]]=[board.nodes[other],board.nodes[i]];}}}
export function fitSections(board:Board,ids:ReadonlySet<string>,padding=28){for(const section of board.nodes.filter(n=>n.kind==='section'&&ids.has(n.id)&&!n.locked)){const nodes=board.nodes.filter(n=>contained(section,n));if(!nodes.length)continue;const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y));const right=Math.max(...nodes.map(n=>n.x+n.width)),bottom=Math.max(...nodes.map(n=>n.y+n.height));Object.assign(section,{x:x-padding,y:y-padding-24,width:right-x+padding*2,height:bottom-y+padding*2+24});}}
export function directionalNode(nodes:Card[],id:string,direction:'left'|'right'|'up'|'down'){
 const origin=nodes.find(n=>n.id===id);if(!origin)return;const horizontal=direction==='left'||direction==='right',sign=direction==='left'||direction==='up'?-1:1;let best:Card|undefined,score=Infinity;
 for(const n of nodes){if(n===origin||n.kind==='section')continue;const dx=n.x+n.width/2-origin.x-origin.width/2,dy=n.y+n.height/2-origin.y-origin.height/2,along=(horizontal?dx:dy)*sign,cross=Math.abs(horizontal?dy:dx);if(along<=0)continue;const value=along+cross*2;if(value<score){score=value;best=n;}}return best;
}
export function boardIssues(board:Board,exists:(path:string)=>boolean){const linked=new Set(board.edges.flatMap(e=>[e.from,e.to]));return {missing:board.nodes.filter(n=>n.file&&!exists(n.file)),isolated:board.nodes.filter(n=>n.kind!=='section'&&!linked.has(n.id)),locked:board.nodes.filter(n=>n.locked)};}
export function textBatch(text:string){if(text.length>100000)throw Error('一次最多粘贴 100,000 个字符');const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(lines.length>100)throw Error('一次最多创建 100 个文本框');return lines;}
export function wheelDelta(value:number,mode:number,page:number){return Math.max(-600,Math.min(600,value*(mode===1?16:mode===2?Math.max(100,page):1)));}
export function constrainedDrag(dx:number,dy:number,lock:boolean){if(!lock)return{dx,dy};return Math.abs(dx)>=Math.abs(dy)?{dx,dy:0}:{dx:0,dy};}
export function resized(original:Card,dx:number,dy:number,ratio:boolean){const media=original.kind==='image'||original.kind==='pdf',minHeight=media?60:100,minWidth=media||original.kind==='text'?80:180;let width=Math.max(minWidth,original.width+dx),height=Math.max(minHeight,original.height+dy);if(ratio||media){const scale=Math.max(minWidth/original.width,minHeight/original.height,Math.abs(dx/original.width)>=Math.abs(dy/original.height)?width/original.width:height/original.height);width=original.width*scale;height=original.height*scale;}return{width,height};}
export class ViewTrail {
 private past:Board['viewport'][]=[];private future:Board['viewport'][]=[];
 remember(v:Board['viewport']){if(JSON.stringify(this.past.at(-1))!==JSON.stringify(v)){this.past.push(clone(v));if(this.past.length>30)this.past.shift();}this.future=[];}
 travel(current:Board['viewport'],forward=false){const stack=forward?this.future:this.past;let next=stack.pop();while(next&&JSON.stringify(next)===JSON.stringify(current))next=stack.pop();if(next)(forward?this.past:this.future).push(clone(current));return next;}
 clear(){this.past=[];this.future=[];}
}
