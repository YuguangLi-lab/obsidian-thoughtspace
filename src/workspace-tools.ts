import {imageMarkdown,remoteImageUrl} from './image-host';
import {fileReference} from './journal-links-model';
import {gridLanding} from './canvas-controls';
import { Board, Card } from './model';
/** Layout-only operations: source note files are never changed here. */
export function relatedNodes(board:Board,ids:ReadonlySet<string>):Set<string>{const result=new Set(ids);for(const e of board.edges){if(ids.has(e.from))result.add(e.to);if(ids.has(e.to))result.add(e.from);}return result;}
export function orderNodes(board:Board,ids:ReadonlySet<string>,front:boolean){const picked=board.nodes.filter(n=>ids.has(n.id)&&!n.locked),rest=board.nodes.filter(n=>!picked.includes(n));board.nodes=front?[...rest,...picked]:[...picked,...rest];}
export function matchSize(board:Board,ids:ReadonlySet<string>,axis:'width'|'height'|'both'){
 const nodes=board.nodes.filter(n=>ids.has(n.id)&&!n.locked&&!n.collapsed);if(nodes.length<2)throw Error('请选择至少两个未锁定、未折叠的对象');const first=nodes[0];
 for(const n of nodes.slice(1)){if(axis!=='height')n.width=first.width;if(axis!=='width')n.height=first.height;if(n.kind==='card')n.autoFit=false;if(n.kind==='text')n.autoSize=false;}
}
export function snapSelection(board:Board,ids:ReadonlySet<string>,step=24){const landing=gridLanding(board,ids,step);if(!landing)return;const {dx,dy}=landing;for(const n of board.nodes)if(ids.has(n.id)&&!n.locked){n.x+=dx;n.y+=dy;}}
export function boardOutline(board:Board,title:string){const clean=(s:string)=>s.replace(/[\r\n]+/g,' ').trim();const names=new Map(board.nodes.map(n=>[n.id,clean(n.title||n.file?.split('/').pop()||n.text?.split('\n')[0]||n.id)]));return `# ${clean(title)}\n\n`+board.nodes.map(n=>n.kind==='section'?`## ${clean(n.title||'分组')}`:n.kind==='text'?n.text||'':n.kind==='image'?(remoteImageUrl(n.imageUrl)?imageMarkdown(n.imageUrl!):`!${fileReference(n.file!)}`):`- ${fileReference(n.file!)}`).join('\n\n')+'\n\n## 关系\n\n'+board.edges.map(e=>{return `- ${names.get(e.from)} → ${names.get(e.to)}${e.label?'：'+clean(e.label):''}`;}).join('\n')+'\n';}
export function cardHeight(body:HTMLElement,node:Card){const chrome=92;return Math.min(1100,Math.max(150,Math.ceil(body.scrollHeight+chrome)));}
export function measureNoteCard(preview:HTMLElement,preferredWidth=240):{width:number;height:number}{
 const px=(value:string)=>{const n=parseFloat(value);return Number.isFinite(n)?n:0;};
 const card=preview.closest<HTMLElement>('.ts-node'),style=card&&getComputedStyle(card),border=style?px(style.borderLeftWidth)+px(style.borderRightWidth):2;
 const chrome=card?Array.from(card.children).filter((e):e is HTMLElement=>e.instanceOf(HTMLElement)&&e.matches('.ts-node-header,.ts-card-meta')).reduce((sum,e)=>{const c=getComputedStyle(e);return c.display==='none'?sum:sum+e.offsetHeight+px(c.marginTop)+px(c.marginBottom);},0)+(style?px(style.borderTopWidth)+px(style.borderBottomWidth):2):96;
 const probe=preview.cloneNode(true) as HTMLElement;Object.assign(probe.style,{position:'fixed',left:'-100000px',top:'0',width:'max-content',maxWidth:`${520-border}px`,minWidth:`${Math.max(80,preferredWidth-border)}px`,height:'auto',maxHeight:'none',overflow:'visible',display:'block',flex:'none',visibility:'hidden'});preview.parentElement!.appendChild(probe);
 try{const inner=Math.ceil(probe.offsetWidth),width=inner+border;probe.style.width=`${inner}px`;return{width,height:Math.min(1100,Math.max(150,Math.ceil(probe.scrollHeight+chrome)))}}finally{probe.remove();}
}
