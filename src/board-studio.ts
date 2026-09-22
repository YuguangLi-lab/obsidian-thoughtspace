import {markdownRows} from './markdown-context';
import {imageMarkdown,remoteImageUrl} from './image-host';
import {fileReference} from './journal-links-model';
import {branchState,foldedMoveUnits,moveFoldedUnit} from './mindmap';
import {textExcerptPresentation} from './excerpt-sources';
import {Board,Card,Edge,clone,uid,parseBoard} from './model';
import {Rect,marqueeSelection} from './board-tools';
export const nodeName=(n:Card)=>n.title||n.file?.split('/').pop()||n.text?.split('\n')[0]||'未命名对象';
export const readingOrder=(nodes:Card[])=>[...nodes].sort((a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id));
export function selectStudio(board:Board,ids:ReadonlySet<string>,mode:'invert'|'type'|'color'|'component'|'viewport',rect?:Rect):Set<string>{
 if(mode==='invert')return new Set(board.nodes.filter(n=>!ids.has(n.id)).map(n=>n.id));
 if(mode==='viewport'){const hidden=branchState(board).hidden;return marqueeSelection(board.nodes.filter(n=>!hidden.has(n.id)),rect!);}
 const first=board.nodes.find(n=>ids.has(n.id));if(!first)return new Set();
 if(mode==='type'||mode==='color')return new Set(board.nodes.filter(n=>mode==='type'?n.kind===first.kind:n.color===first.color).map(n=>n.id));
 const adjacent=new Map<string,string[]>();for(const e of board.edges){for(const[a,b]of [[e.from,e.to],[e.to,e.from]]){if(!adjacent.has(a))adjacent.set(a,[]);adjacent.get(a)!.push(b);}}
 const valid=new Set(board.nodes.map(n=>n.id)),found=new Set([...ids].filter(id=>valid.has(id))),queue=[...found];for(let i=0;i<queue.length;i++)for(const id of adjacent.get(queue[i])||[])if(!found.has(id)){found.add(id);queue.push(id);}return found;
}
/** Work on a validated draft; callers can commit exactly one undo entry or skip a no-op. */
export function studioDraft(board:Board,edit:(draft:Board)=>void){const result=clone(board);edit(result);parseBoard(JSON.stringify(result));return JSON.stringify(result)===JSON.stringify(board)?undefined:result;}
export function saveSelection(board:Board,ids:ReadonlySet<string>,name:string){name=name.trim();if(!name||name.length>60)throw Error('选区名称需要 1–60 个字符');const members=board.nodes.filter(n=>ids.has(n.id)).map(n=>n.id);if(!members.length)throw Error('请先选择对象');board.selectionSets??=[];if(board.selectionSets.length>=30)throw Error('每张白板最多保存 30 个选区');if(board.selectionSets.some(s=>s.name===name))throw Error('选区名称已存在');board.selectionSets.push({id:uid(),name,ids:members});}
export function selectionMarkdown(board:Board,ids:ReadonlySet<string>){return readingOrder(board.nodes.filter(n=>ids.has(n.id))).map(n=>n.kind==='text'?n.text:n.kind==='image'&&remoteImageUrl(n.imageUrl)?imageMarkdown(n.imageUrl!):n.file?`${n.kind==='image'?'!':''}${fileReference(n.file)}`:`## ${(n.title||'分组').replace(/[\r\n]+/g,' ')}`).join('\n\n');}
export function selectionCSV(board:Board,ids:ReadonlySet<string>){const quote=(v:unknown)=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return [['类型','名称','路径','X','Y','宽度','高度','颜色'],...readingOrder(board.nodes.filter(n=>ids.has(n.id))).map(n=>[n.kind,nodeName(n),n.file,n.x,n.y,n.width,n.height,n.color])].map(row=>row.map(quote).join(',')).join('\r\n');}
export function replacementPreview(board:Board,ids:ReadonlySet<string>,search:string,replacement:string){if(!search)throw Error('请输入查找文字');if(search.length>1000||replacement.length>10000)throw Error('查找或替换文字过长');return board.nodes.filter(n=>n.kind==='text'&&!n.locked&&ids.has(n.id)&&(n.text||'').includes(search)).map(n=>({id:n.id,before:n.text!,after:n.text!.split(search).join(replacement),count:n.text!.split(search).length-1}));}
export function replaceText(board:Board,preview:ReturnType<typeof replacementPreview>){for(const p of preview){const n=board.nodes.find(n=>n.id===p.id);if(!n||n.locked||n.text!==p.before)throw Error('对象已变化，请重新预览');if(p.after.length>100000)throw Error('替换后的文本超过 100,000 字符');n.text=p.after;}}
function editable(board:Board,ids:ReadonlySet<string>){return readingOrder(board.nodes.filter(n=>ids.has(n.id)&&!n.locked&&n.kind!=='section'));}
function texts(board:Board,ids:ReadonlySet<string>){const nodes=editable(board,ids).filter(n=>n.kind==='text');if(nodes.some(n=>n.topic)||board.edges.some(e=>e.kind==='branch'&&nodes.some(n=>n.id===e.from||n.id===e.to)))throw Error('请先将思维导图主题转为普通文本');return nodes;}
function withSources(body:string,sources:string[]){return sources.length?body.trimEnd()+'\n\n'+[...new Set(sources)].map(s=>'> '+s).join('\n\n'):body;}
const remapObjectIds=(ids:string[],oldIds:ReadonlySet<string>,newIds:string[])=>[...new Set(ids.flatMap(id=>oldIds.has(id)?newIds:[id]))];
function updateSavedSelections(board:Board,oldIds:Set<string>,newIds:string[]){for(const set of board.selectionSets||[])set.ids=remapObjectIds(set.ids,oldIds,newIds);}
function mergeWritingReferences(board:Board,oldIds:ReadonlySet<string>,survivor:string){
 const writing=board.writing;if(!writing)return;
 // Resolve the option before rewriting the outline. The surviving object keeps
 // its explicit settings; otherwise the earliest configured article item wins.
 if(writing.options){
  const options=writing.options,source=options[survivor]||writing.order.filter(id=>oldIds.has(id)).map(id=>options[id]).find(Boolean);
  for(const id of oldIds)if(id!==survivor)delete options[id];
  if(source)options[survivor]=source;
 }
 writing.order=remapObjectIds(writing.order,oldIds,[survivor]);
 if(writing.referenceId&&oldIds.has(writing.referenceId))writing.referenceId=survivor;
 if(writing.referenceIds)writing.referenceIds=remapObjectIds(writing.referenceIds,oldIds,[survivor]);
}
export function mergeTexts(board:Board,ids:ReadonlySet<string>){
 const nodes=texts(board,ids);if(nodes.length<2)throw Error('请至少选择两个未锁定的普通文本');const first=nodes[0],selected=new Set(nodes.map(n=>n.id));
 const parts=nodes.map(n=>textExcerptPresentation(n.text||'')),merged=withSources(parts.map(p=>p.sources.length?p.body.trimEnd():p.body).join('\n\n'),parts.flatMap(p=>p.sources.map(s=>s.citation)));
 if(merged.length>100000)throw Error('合并后的文本超过 100,000 字符');first.text=merged;first.autoSize=false;first.height=Math.min(1100,Math.max(first.height,nodes.reduce((sum,n)=>sum+n.height,0)));
 board.nodes=board.nodes.filter(n=>!selected.has(n.id)||n===first);const seen=new Set<string>();
 board.edges=board.edges.flatMap(e=>{const affected=selected.has(e.from)||selected.has(e.to),next={...e,from:selected.has(e.from)?first.id:e.from,to:selected.has(e.to)?first.id:e.to};if(next.from===next.to)return [];
  if(affected){const key=JSON.stringify([next.from,next.to,next.label,next.style||'curve',next.direction||'forward',!!next.dashed,next.color||'',next.fromSide||'',next.toSide||'']);if(seen.has(key))return [];seen.add(key);}return [next];});
 updateSavedSelections(board,selected,[first.id]);mergeWritingReferences(board,selected,first.id);return first.id;
}
export function splitParagraphs(board:Board,ids:ReadonlySet<string>){
 const nodes=texts(board,ids);if(nodes.length!==1)throw Error('请选择一个未锁定的普通文本');const n=nodes[0],presentation=textExcerptPresentation(n.text||''),parts:string[]=[];let part:string[]=[];
 for(const row of markdownRows(presentation.body)){const line=row.source.replace(/\r$/,'');
  // Empty separator rows are omitted here; trimming a completed paragraph would
  // also remove Markdown code indentation and hard-break spaces from its content.
  if(!row.code&&!row.commentBefore&&!('openBlock' in row&&row.openBlock)&&!line.trim()){if(part.length){parts.push(part.join('\n'));part=[];}}else part.push(line);
 }if(part.length)parts.push(part.join('\n'));if(parts.length<2||parts.length>100)throw Error('需要 2–100 个由空行分隔的段落');
 const sources=presentation.sources.map(s=>s.citation),bodies=parts.map(text=>withSources(text,sources));if(bodies.some(text=>text.length>100000))throw Error('拆分后的文本超过 100,000 字符');
 n.text=bodies[0];const created=bodies.slice(1).map((text,i)=>({...clone(n),id:uid(),text,y:n.y+(n.height+24)*(i+1)}));board.nodes.push(...created);const result=[n.id,...created.map(n=>n.id)],oldIds=new Set([n.id]);updateSavedSelections(board,oldIds,result);
 if(board.writing)board.writing.order=remapObjectIds(board.writing.order,oldIds,result);
 return result;
}
export function connectSelection(board:Board,ids:ReadonlySet<string>,hub=false){const nodes=editable(board,ids);if(nodes.length<2||nodes.length>200)throw Error('请选择 2–200 个未锁定的内容对象');const existing=new Set(board.edges.map(e=>[e.from,e.to].sort().join('|')));board.version=3;for(let i=1;i<nodes.length;i++){const from=nodes[hub?0:i-1].id,to=nodes[i].id,key=[from,to].sort().join('|');if(existing.has(key))continue;board.edges.push({id:uid(),from,to,label:'',style:'curve',direction:'forward'});existing.add(key);}}
export function selectionEdges(board:Board,ids:ReadonlySet<string>){const locked=new Set(board.nodes.filter(n=>n.locked).map(n=>n.id));return board.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)&&!locked.has(e.from)&&!locked.has(e.to)&&e.kind!=='branch');}
export function reverseEdges(board:Board,ids:ReadonlySet<string>){for(const e of selectionEdges(board,ids)){[e.from,e.to]=[e.to,e.from];[e.fromSide,e.toSide]=[e.toSide,e.fromSide];}}
export function styleEdges(board:Board,ids:ReadonlySet<string>,style:Pick<Edge,'style'|'direction'|'color'|'dashed'>){board.version=3;for(const e of selectionEdges(board,ids))Object.assign(e,style);}
export function stackSelection(board:Board,ids:ReadonlySet<string>,axis:'x'|'y',gap:number){
 if(!Number.isFinite(gap)||gap<0||gap>1000)throw Error('间距必须为 0–1000');
 const units=foldedMoveUnits(board,ids).sort((a,b)=>a.root.y-b.root.y||a.root.x-b.root.x||a.root.id.localeCompare(b.root.id));if(units.length<2)throw Error('请选择至少两个未锁定的内容对象');
 const first={x:units[0].root.x,y:units[0].root.y};let cursor=first[axis];for(const unit of units){moveFoldedUnit(unit,axis==='x'?cursor:first.x,axis==='y'?cursor:first.y);cursor+=(axis==='x'?unit.root.width:unit.root.height)+gap;}
}
export function radialSelection(board:Board,ids:ReadonlySet<string>,radius:number){
 const units=foldedMoveUnits(board,ids).sort((a,b)=>a.root.y-b.root.y||a.root.x-b.root.x||a.root.id.localeCompare(b.root.id)),nodes=units.map(u=>u.root);
 if(nodes.length<3||nodes.length>200)throw Error('请选择 3–200 个未锁定的内容对象');if(!Number.isFinite(radius)||radius<100||radius>10000)throw Error('半径必须为 100–10000');
 const cx=nodes.reduce((s,n)=>s+n.x+n.width/2,0)/nodes.length,cy=nodes.reduce((s,n)=>s+n.y+n.height/2,0)/nodes.length;
 units.forEach((unit,i)=>{const a=2*Math.PI*i/nodes.length-Math.PI/2;moveFoldedUnit(unit,cx+radius*Math.cos(a)-unit.root.width/2,cy+radius*Math.sin(a)-unit.root.height/2);});
}
export function geometry(board:Board,id:string,rect:Rect){
 if(!Object.values(rect).every(Number.isFinite)||Math.abs(rect.x)>1000000||Math.abs(rect.y)>1000000||rect.width<80||rect.height<60||rect.width>10000||rect.height>10000)throw Error('坐标范围 ±1,000,000；尺寸范围 80×60 至 10,000×10,000');
 const n=board.nodes.find(n=>n.id===id);if(!n||n.locked||n.collapsed||n.kind==='section')throw Error('请选择一个未锁定、未折叠的内容对象');
 // Use the same movement unit as drag/arrange so an exact position edit cannot
 // strand hidden descendants or bypass a lock inside a folded branch.
 const unit=foldedMoveUnits(board,new Set([id]))[0];
 if(!unit)throw Error('对象已被折叠隐藏，或分支内有锁定对象，请展开并检查后调整');
 moveFoldedUnit(unit,rect.x,rect.y);Object.assign(n,{width:rect.width,height:rect.height});
 if(n.kind==='card')n.autoFit=false;if(n.kind==='text')n.autoSize=false;
}
export function studioStats(board:Board){const refs=new Map<string,number>();for(const n of board.nodes)if(n.file)refs.set(n.file,(refs.get(n.file)||0)+1);return {objects:board.nodes.length,edges:board.edges.length,notes:board.nodes.filter(n=>n.kind==='card').length,texts:board.nodes.filter(n=>n.kind==='text').length,images:board.nodes.filter(n=>n.kind==='image').length,groups:board.nodes.filter(n=>n.kind==='section').length,uniqueFiles:refs.size,repeatedReferences:[...refs.values()].reduce((s,n)=>s+Math.max(0,n-1),0)};}
