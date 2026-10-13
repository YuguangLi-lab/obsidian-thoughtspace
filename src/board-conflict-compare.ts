import {Modal,parseYaml,type App} from 'obsidian';
import {bindBoardModalViewport} from './board-modal-viewport';
import {themeSurface} from './ui-tokens';
import {compareBoardConflictVersions,sameBoardConflictSnapshot,type BoardConflictCompareInput,type BoardConflictCompareSource,type BoardConflictCollectionDiff,type BoardConflictFieldChange} from './board-conflict-compare-model';

export type {BoardConflictCompareInput,BoardConflictCompareSource} from './board-conflict-compare-model';
export interface BoardConflictCompareHost {
 document:Document;name:string;current():boolean;read():Promise<BoardConflictCompareInput>;
 /** Validate file identity, exact source, and host ownership once more before opening. */
 open(source:BoardConflictCompareSource):Promise<void>;
 copyLocal?(source:BoardConflictCompareSource):void;closed():void;
}
const labels={original:'磁盘当前版',local:'当前本地版',recovery:'恢复草稿文件'};
/** No merge/save action: both protected versions remain intact on every exit. */
export class BoardConflictCompareModal extends Modal {
 private alive=false;private busy=false;private completed=false;private viewport?:()=>void;private input?:BoardConflictCompareInput;
 private versions?:HTMLElement;private summary?:HTMLElement;private status?:HTMLElement;private actions?:HTMLElement;
 constructor(app:App,private readonly host:BoardConflictCompareHost){super(app);}
 private current(){const doc=this.host.document;return this.alive&&this.containerEl.isConnected&&this.containerEl.ownerDocument===doc&&!!doc.defaultView&&!doc.defaultView.closed&&this.host.current();}
 private requireCurrent(){if(this.current())return true;if(this.alive)this.close();return false;}
 onOpen(){
  const doc=this.host.document;if(!this.host.current()||!doc.defaultView||doc.defaultView.closed){this.close();return;}
  if(this.containerEl.ownerDocument!==doc)doc.body.appendChild(this.containerEl);
  this.alive=true;themeSurface(this.modalEl);this.modalEl.addClass('ts-prompt-modal','ts-conflict-compare-modal');this.titleEl.setText('对照白板版本');this.viewport=bindBoardModalViewport(this.containerEl);
  this.contentEl.createEl('p',{text:`${this.host.name} · 对照读取时的文件与当前本地内容。原文件保持写入保护；这里不合并或覆盖任何版本。`});
  this.versions=this.contentEl.createDiv('ts-conflict-sources');this.summary=this.contentEl.createDiv('ts-conflict-summary');
  this.status=this.contentEl.createDiv({cls:'ts-conflict-status',attr:{role:'status','aria-live':'polite'}});
  this.actions=this.modalEl.createDiv('modal-button-container');this.buttons();void this.load();
 }
 private setBusy(value:boolean){this.busy=value;this.modalEl.setAttribute('aria-busy',String(value));for(const button of Array.from(this.actions?.querySelectorAll<HTMLButtonElement>('button')??[]))if(button.dataset.conflictAction!=='close')button.disabled=value;}
 private async load(){
  if(this.busy||!this.requireCurrent())return;this.setBusy(true);this.status!.setText('正在读取版本…');
  try{const input=await this.host.read();if(!this.requireCurrent())return;this.show(input);this.status!.setText('数量相同也可能内容不同。打开版本前会重新核实；尚未确认保存的本地内容仅在当前窗口保留。');}
  catch(error){if(this.requireCurrent()){this.status!.setText(`读取失败：${error instanceof Error?error.message:String(error)}。当前本地内容与原文件仍受保护。`);this.buttons();}}
  finally{this.setBusy(false);}
 }
 private changes(parent:HTMLElement,changes:readonly BoardConflictFieldChange[]){for(const change of changes){const item=parent.createEl('li');item.createEl('strong',{text:change.field});item.createSpan({text:`：${change.before} → ${change.after}`});}}
 private collection(parent:HTMLElement,name:string,diff:BoardConflictCollectionDiff){
  parent.createEl('p',{text:`${name}：新增 ${diff.added} · 移除 ${diff.removed} · 修改 ${diff.modified}${diff.orderChanged?' · 顺序变化':''}`});
  if(!diff.added&&!diff.removed&&!diff.modified)return;
  const details=parent.createEl('details');details.createEl('summary',{text:`查看${name}变化${diff.added+diff.removed+diff.modified>12?'（每类最多预览 12 项）':''}`});
  const list=details.createEl('ul');for(const label of diff.additions)list.createEl('li',{text:`新增：${label}`});for(const label of diff.removals)list.createEl('li',{text:`移除：${label}`});
  for(const change of diff.changes){const row=list.createEl('li');row.createEl('strong',{text:`修改：${change.label} · ${change.id}`});this.changes(row.createEl('ul'),change.fields);}
 }
 private show(input:BoardConflictCompareInput){
  this.input=input;this.versions!.empty();this.summary!.empty();const comparison=compareBoardConflictVersions(input,parseYaml);
  for(const source of [input.original,input.local,...(input.recovery?[input.recovery]:[])]){
   const card=this.versions!.createDiv({cls:'ts-conflict-version',attr:{'data-source-kind':source.kind}}),summary=comparison.sources.find(item=>item.kind===source.kind)!;
   card.createEl('h3',{text:source.kind==='recovery'?(summary.status==='readable'?'已保存恢复草稿':'恢复草稿（无法核实）'):labels[source.kind]});card.createEl('p',{cls:'ts-conflict-path',text:source.path});
   card.createEl('p',{text:source.kind==='local'?'未确认已保存至原文件；当前窗口保留版':source.mtime===undefined?'修改时间无法核实':`文件修改时间：${new Date(source.mtime).toLocaleString()}`});
   if(summary.counts){const count=summary.counts;card.createEl('p',{text:`节点 ${count.nodes} · 连线 ${count.edges} · 笔迹 ${count.strokes}（${count.points} 点）`});}
   else card.createEl('p',{text:`${summary.status==='invalid'?'格式无法解析':'无法读取'}：${summary.error}`});
  }
  if(input.recovery?.source!==undefined&&!input.recovery.error&&input.local.source!==undefined&&input.recovery.source!==input.local.source)this.versions!.createEl('p',{cls:'ts-conflict-unavailable',text:'恢复草稿文件与当前本地内容不同。请分别查看；当前本地内容可另行复制保留。'});
  if(!input.recovery)this.versions!.createEl('p',{cls:'ts-conflict-unavailable',text:'恢复文件尚未保存或不可用；请复制当前本地内容保留。'});
  for(const pair of comparison.pairs){
   const section=this.summary!.createEl('section');section.createEl('h3',{text:`${labels[pair.target]} 相对磁盘当前版`});
   if(!pair.available){section.createEl('p',{text:`无法完整对照：${pair.error}。不会将无法读取的版本计为零。`});continue;}
   if(pair.sameBytes){section.createEl('p',{text:'文件内容完全相同。'});continue;}
   if(pair.sameContent){section.createEl('p',{text:'解析内容相同，原文字节或排版不同。'});continue;}
   this.collection(section,'节点',pair.nodes!);this.collection(section,'连线',pair.edges!);this.collection(section,'笔迹',pair.strokes!);
   const changes=[...pair.settings,...pair.envelope.map(change=>({...change,field:`布局附加字段 · ${change.field}`})),...(pair.yaml?[pair.yaml]:[]),...(pair.body?[pair.body]:[])];
   if(changes.length){section.createEl('h4',{text:'镜头、设置与原生内容'});this.changes(section.createEl('ul'),changes);}
  }
  this.buttons();
 }
 private buttons(){
  this.actions!.empty();const add=(name:string,action:string,run:()=>void)=>{const button=this.actions!.createEl('button',{text:name,attr:{type:'button','data-conflict-action':action}});button.dataset.conflictAction=action;button.onclick=run;return button;};
  if(this.input?.original.source!==undefined&&!this.input.original.error)add('打开原文件','original',()=>{void this.openVersion('original');});
  if(this.input?.recovery?.source!==undefined&&!this.input.recovery.error)add('打开恢复草稿','recovery',()=>{void this.openVersion('recovery');});
  if(this.host.copyLocal&&this.input?.local.source!==undefined)add('复制本地内容','copy',()=>{if(this.busy||!this.requireCurrent())return;const local=this.input!.local;this.close();this.host.copyLocal?.(local);});
  add('重新读取','refresh',()=>{void this.load();});add('关闭','close',()=>this.close());
 }
 private async openVersion(kind:'original'|'recovery'){
  if(this.busy||!this.requireCurrent()||!this.input)return;const shown=this.input;this.setBusy(true);
  try{
   const fresh=await this.host.read();if(!this.requireCurrent())return;
   if(!sameBoardConflictSnapshot(shown,fresh)){this.show(fresh);this.status!.setText('版本已发生变化，已刷新对照。请查看更新后的内容，再次点击要打开的版本。');return;}
   const source=fresh[kind];if(!source||source.source===undefined||source.error)throw Error('此版本无法读取');
   await this.host.open(source);if(this.current())this.close();
  }catch(error){if(this.requireCurrent())this.status!.setText(`未打开：${error instanceof Error?error.message:String(error)}。原文件与本地内容仍受保护。`);}
  finally{this.setBusy(false);}
 }
 onClose(){this.alive=false;this.viewport?.();this.viewport=undefined;this.input=undefined;this.contentEl.empty();this.actions?.remove();this.actions=undefined;if(!this.completed){this.completed=true;this.host.closed();}}
}
