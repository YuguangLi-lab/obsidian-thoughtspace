import {App,Modal,setIcon} from 'obsidian';
import {Board,Card,cardFillHex} from './model';
import {GroupMovePlan,applyGroupMove,groupNodeName,outlineTree,planGroupMove} from './group-organizer';
import {sectionContains} from './sections';
import {themeSurface} from './ui-tokens';
export interface GroupOrganizerHost {board:()=>Board;ids:Set<string>;commit:(edit:(board:Board)=>void)=>void;}
const ns='http://www.w3.org/2000/svg';
let previewNumber=0;
export class GroupOrganizerModal extends Modal {
 private selectedNodeIds:Set<string>;private search!:HTMLInputElement;private targets!:HTMLSelectElement;private count!:HTMLElement;private preview!:HTMLElement;private status!:HTMLElement;private apply!:HTMLButtonElement;private plan?:GroupMovePlan;private targetId='';private closed=false;private busy=false;
 constructor(app:App,private host:GroupOrganizerHost){super(app);this.selectedNodeIds=new Set(host.ids);}
 private button(parent:HTMLElement,label:string,icon:string,run:()=>void){const button=parent.createEl('button',{attr:{'aria-label':label}});if(icon)setIcon(button.createSpan(),icon);button.createSpan({text:label});button.onclick=run;return button;}
 onOpen(){this.closed=false;themeSurface(this.modalEl);this.modalEl.addClass('ts-group-organizer');this.titleEl.setText('移入已有分组');
  this.contentEl.createEl('p',{cls:'ts-group-intro',text:'把所选内容作为一个整体收进分组，保留相对位置与连线。'});
  const body=this.contentEl.createDiv('ts-group-body'),picker=body.createDiv('ts-group-picker');picker.createEl('label',{text:'目标分组',attr:{for:'ts-group-target-choice'}});
  this.search=picker.createEl('input',{type:'search',attr:{placeholder:'搜索分组…','aria-label':'搜索目标分组'}});this.search.oninput=()=>this.refresh();
  this.targets=picker.createEl('select',{cls:'ts-group-targets',attr:{id:'ts-group-target-choice',size:'9','aria-label':'目标分组'}});this.targets.onchange=()=>{this.targetId=this.targets.value;this.updatePreview();};
  this.count=picker.createDiv({cls:'ts-group-count',attr:{role:'status','aria-live':'polite'}});
  const detail=body.createDiv('ts-group-detail');detail.createDiv({cls:'ts-group-preview-heading',text:'移入后预览'});this.preview=detail.createDiv('ts-group-preview');
  const legend=detail.createDiv('ts-group-legend');legend.createSpan({cls:'ts-group-legend-moving',text:'所选内容'});legend.createSpan({cls:'ts-group-legend-existing',text:'组内原有内容'});legend.createSpan({cls:'ts-group-legend-before',text:'原分组边界'});
  this.status=detail.createDiv({cls:'ts-group-status',attr:{role:'status','aria-live':'polite'}});
  const footer=this.contentEl.createDiv('ts-group-footer');footer.createSpan({cls:'ts-group-footnote',text:'保持当前视角 · 可一次撤销'});this.button(footer,'刷新预览','refresh-cw',()=>this.refresh());this.button(footer,'取消','',()=>this.close());this.apply=this.button(footer,'移入分组','folder-input',()=>this.commit());this.apply.addClass('mod-cta');this.apply.title='移入分组 · Ctrl / ⌘ + Enter';
  this.contentEl.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();event.stopPropagation();this.commit();}});
  this.refresh();this.search.focus();
 }
 private refresh(){if(this.closed)return;const query=this.search.value.normalize('NFKC').toLocaleLowerCase().trim(),all=outlineTree(this.host.board(),{kind:'section'}).filter(row=>!this.selectedNodeIds.has(row.node.id)),groups=all.filter(row=>groupNodeName(row.node).normalize('NFKC').toLocaleLowerCase().includes(query));
  this.targets.empty();for(const row of groups)this.targets.createEl('option',{value:row.node.id,text:`${'　'.repeat(Math.min(row.depth,6))}${groupNodeName(row.node)}${row.node.locked?' · 已锁定':''}`}).disabled=!!row.node.locked;
  if(!groups.some(row=>row.node.id===this.targetId&&!row.node.locked))this.targetId=groups.find(row=>!row.node.locked)?.node.id||'';this.targets.value=this.targetId;
  this.targets.disabled=!groups.length;this.count.setText(`${groups.length} 个目标分组 · 已选 ${this.selectedNodeIds.size} 项`);this.updatePreview();
 }
 private updatePreview(){if(this.closed)return;this.plan=undefined;this.apply.disabled=true;this.preview.empty();this.status.removeClass('is-error');
  if(!this.targetId){this.preview.createDiv({cls:'ts-group-empty',text:'没有可用的目标分组'});this.status.setText('可先在白板创建分组，或调整搜索关键词。');return;}
  try{this.plan=planGroupMove(this.host.board(),this.selectedNodeIds,this.targetId);this.draw(this.plan);const p=this.plan,next=p.target.next;this.status.setText(`移入 ${p.items.length} 项内容${p.items.length>this.selectedNodeIds.size?'（含分组与折叠后代）':''}。${p.expanded?`分组扩展为 ${Math.round(next.width)} × ${Math.round(next.height)}。`:'原分组尺寸足够。'}组内已有内容保持原位。`);this.apply.disabled=false;}
  catch(error){this.preview.createDiv({cls:'ts-group-empty',text:'当前目标无法容纳此选区'});this.status.addClass('is-error');this.status.setText(String(error).replace(/^Error: /,''));}
 }
 private draw(plan:GroupMovePlan){const svg=this.preview.ownerDocument.createElementNS(ns,'svg'),frame=plan.target.next;svg.setAttribute('viewBox',`${frame.x-24} ${frame.y-24} ${frame.width+48} ${frame.height+48}`);svg.setAttribute('role','img');const title=this.preview.ownerDocument.createElementNS(ns,'title'),titleId=`ts-group-preview-${++previewNumber}`;title.setAttribute('id',titleId);svg.setAttribute('aria-labelledby',titleId);title.textContent=`移入${groupNodeName(frame)}后的分组预览，共 ${plan.items.length} 项所选内容`;svg.appendChild(title);
  const rect=(node:Card,cls:string)=>{const el=this.preview.ownerDocument.createElementNS(ns,'rect');for(const[key,value]of Object.entries({x:node.x,y:node.y,width:node.width,height:node.height,rx:8}))el.setAttribute(key,String(value));el.setAttribute('class',cls);if(cls==='ts-group-moving')el.setAttribute('fill',cardFillHex[node.color]);svg.appendChild(el);};
  rect(frame,'ts-group-frame');rect(plan.target.original,'ts-group-original-frame');
  const selected=new Set(plan.ids),existing=this.host.board().nodes.filter(node=>!selected.has(node.id)&&sectionContains(plan.target.original,node));for(const node of existing.slice(0,100))rect(node,'ts-group-existing');
  // Bound preview DOM size on large selections while rendering every position.
  if(plan.items.length>120){const paths=new Map<string,string>();for(const node of plan.items){const color=cardFillHex[node.color];paths.set(color,(paths.get(color)||'')+`M${node.x},${node.y}h${node.width}v${node.height}h${-node.width}Z`);}for(const[color,d]of paths){const path=this.preview.ownerDocument.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('fill',color);path.setAttribute('class','ts-group-moving');svg.appendChild(path);}}
  else for(const node of [...plan.items].sort((a,b)=>Number(b.kind==='section')-Number(a.kind==='section'))){rect(node,node.kind==='section'?'ts-group-moving-frame':'ts-group-moving');}
  this.preview.appendChild(svg);if(existing.length>100)this.preview.createSpan({cls:'ts-group-preview-note',text:'原有内容显示前 100 项'});
 }
 private commit(){if(this.closed||this.busy||this.apply.disabled||!this.plan)return;this.busy=true;const plan=this.plan;
  try{this.host.commit(board=>applyGroupMove(board,plan));this.close();}
  catch(error){this.apply.disabled=true;this.status.addClass('is-error');this.status.setText(`${String(error).replace(/^Error: /,'')}。点击“刷新预览”后重试。`);}
  finally{this.busy=false;}
 }
 onClose(){this.closed=true;this.plan=undefined;this.contentEl.empty();}
}
