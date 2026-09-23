import {isRecord,isUnknownArray} from './value-guards';
import {CustomField,CustomCondition,SavedDatabaseView,DatabasePreferences,customValue,customMatches,validCustomKey,databaseBase} from './database-custom';
import { themeSurface } from './ui-tokens';
import { App, Component, Modal, Notice, TFile, getAllTags, parseYaml, stringifyYaml, setIcon } from 'obsidian';
import { DatabaseFilter, DatabaseRow, PropertyField, databaseCsv, filterRows, isOverdue, priorities, propertyKeys, propertyPatch, readProperties, statuses } from './database';
import { LibraryScope, isWorkspaceFile, libraryFiles, noteExcerpt } from './workspace';
import { localDay } from './filing';

interface RecordRow extends DatabaseRow { file: TFile; raw: string; excerpt: string; fields:Record<string,unknown>; }
interface DatabaseHost { preferences:DatabasePreferences;savePreferences:()=>Promise<void>;boardPath?:string; cardFolder: string; boardPaths?: Set<string>; boardTitle?: string; preview: (file: TFile) => void; }

/** 所有资料窗口共用队列。只改一个属性，并在原始文件变化时拒绝覆盖。 */
export class PropertyStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private app: App, private pluginId: string) {}
  update(file:TFile,field:PropertyField,value:string,expected:string){return this.updateValue(file,propertyKeys[field],propertyPatch(field,value),expected);}
  updateCustom(file:TFile,field:CustomField,value:string|boolean,expected:string){return this.updateValue(file,field.key,customValue(field,value),expected);}
  private updateValue(file: TFile, key: string, next:unknown, expected: string) {
    const operation = this.queue.catch(() => {}).then(async () => {
      if (!isWorkspaceFile(file) || file.extension !== 'md') throw new Error('备份文件不参与资料编辑');
      const raw = await this.app.vault.read(file);
      if (raw !== expected) throw new Error('笔记已在别处修改，已刷新资料。请核对后重试。');
      const parsed = parseRecord(raw); // 无效 YAML 不尝试覆盖。
      if (parsed[key] === next) return;
      const root = `${this.app.vault.configDir}/plugins/${this.pluginId}/property-backups/${Date.now()}-${crypto.randomUUID()}`;
      await this.app.vault.adapter.mkdir(root);
      await this.app.vault.adapter.write(`${root}/note.md`,raw);
      await this.app.vault.adapter.write(`${root}/record.json`,JSON.stringify({path:file.path,field:key,value:next ?? null},null,2));
      if (await this.app.vault.read(file) !== raw) throw new Error('备份期间笔记发生变化，请刷新后重试。');
      // processFrontMatter 本身在最新文件上处理属性；回调再确认属性集合未发生变化。
      await this.app.fileManager.processFrontMatter(file, (fm:unknown) => {
        if (!isRecord(fm))throw Error('属性区域必须是键值结构');
        if (JSON.stringify(fm) !== JSON.stringify(parsed)) throw new Error('属性已发生变化，请刷新后重试。');
        if (next === undefined) delete fm[key]; else fm[key] = next;
      });
    });
    this.queue = operation; return operation;
  }
}
export function parseRecord(raw: string): Record<string,unknown> {
  const match = raw.match(/^---\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m);
  if (raw.startsWith('---\n') || raw.startsWith('---\r\n')) {
    if (!match) throw new Error('属性区域没有闭合，请在原文中修复');
    const parsed:unknown = parseYaml(match[1]);
    if (parsed == null) return {};
    if (!isRecord(parsed)) throw new Error('属性区域必须是键值结构');
    return parsed;
  }
  return {};
}
function btn(parent: HTMLElement, title: string, icon: string, action: () => void) {
  const b=parent.createEl('button',{cls:'ts-button',attr:{'aria-label':title,title}});setIcon(b.createSpan(),icon);b.createSpan({text:title});b.onclick=action;return b;
}
export class DatabaseModal extends Modal {
  private lifecycle = new Component();
  private active = false;
  private run = 0;
  private timer?: number;
  private busy = false;
  private dragged?: RecordRow;
  private rows: RecordRow[] = [];
  private view: 'table'|'kanban' = 'table';
  private source: LibraryScope;private conditions:CustomCondition[]=[];private customBar!:HTMLElement;private savedSelect!:HTMLSelectElement;
  private limit = 100;
  private filter: DatabaseFilter = { query:'',tag:'',status:'',priority:'',overdue:false,sort:'updated',today:localDay() };
  private results!: HTMLElement;
  private count!: HTMLElement;
  private message!: HTMLElement;
  private tags!: HTMLSelectElement;
  private tabButtons: HTMLButtonElement[] = [];
  constructor(app: App, private host: DatabaseHost, private store: PropertyStore) { super(app); this.source=host.boardPaths?'board':'cards'; }
  onOpen() {
    this.active=true;this.lifecycle.load();this.modalEl.addClass('ts-database-modal');themeSurface(this.modalEl);this.titleEl.setText('卡片资料库');
    const root=this.contentEl;root.addClass('ts-database');
    root.createDiv({cls:'ts-db-subtitle',text:this.host.boardTitle ? `${this.host.boardTitle} · 从想法到行动，在表格与看板之间切换。` : '用状态、优先级与日期，整理阅读和项目进展。'});
    const top=root.createDiv('ts-db-top');const tabs=top.createDiv('ts-db-tabs');
    for(const [view,label,icon] of [['table','资料表','table-2'],['kanban','进度看板','columns-3']] as const){const b=btn(tabs,label,icon,()=>{this.view=view;this.render();});this.tabButtons.push(b);}
    this.count=top.createDiv('ts-db-count');btn(top,'自定义字段','plus',()=>this.addField());btn(top,'打开 Bases','table-properties',()=>void this.openBase());btn(top,'导出 CSV','download',()=>void this.exportCsv());btn(top,'刷新资料','refresh-cw',()=>this.schedule());
    const views=root.createDiv('ts-db-saved-views');this.savedSelect=views.createEl('select',{attr:{'aria-label':'保存的筛选视图'}});this.renderSaved();this.savedSelect.onchange=()=>this.applySaved(this.savedSelect.value);btn(views,'保存筛选视图','bookmark-plus',()=>this.saveView());btn(views,'删除此视图','trash-2',()=>void this.deleteView());
    const filters=root.createDiv('ts-db-filters');
    const search=filters.createEl('input',{type:'search',placeholder:'搜索标题、路径或标签…',attr:{'aria-label':'资料搜索'}});search.oninput=()=>{this.filter.query=search.value;this.limit=100;this.render();};
    this.select(filters,'资料范围',{cards:'卡片目录',...(this.host.boardPaths?{board:'当前白板'}:{}),vault:'整个仓库'},this.source,v=>{this.source=v as LibraryScope;this.filter.tag='';this.limit=100;this.schedule();});
    this.tags=this.select(filters,'资料标签',{'':'所有标签'},'',v=>{this.filter.tag=v;this.limit=100;this.render();});
    this.select(filters,'资料状态',{'':'所有状态',...statuses},'',v=>{this.filter.status=v;this.limit=100;this.render();});
    this.select(filters,'资料优先级',{'':'所有优先级',high:'高优先级',medium:'中优先级',low:'低优先级'},'',v=>{this.filter.priority=v;this.limit=100;this.render();});
    this.select(filters,'资料排序',{updated:'最近修改',title:'标题排序',due:'截止日期',priority:'优先级'},this.filter.sort,v=>{this.filter.sort=v as DatabaseFilter['sort'];this.render();});
    const overdue=filters.createEl('label',{cls:'ts-db-overdue-filter'});const check=overdue.createEl('input',{type:'checkbox'});overdue.createSpan({text:'仅逾期'});check.onchange=()=>{this.filter.overdue=check.checked;this.render();};
    this.customBar=root.createDiv('ts-db-custom-filters');this.renderCustomFilters();
    this.message=root.createDiv({cls:'ts-db-message',attr:{role:'status','aria-live':'polite'}});
    this.results=root.createDiv('ts-db-results');
    root.createDiv({cls:'ts-db-help',text:'修改属性即保存；拖动看板卡片可改变状态，也可使用卡片上的状态菜单。关闭后回到原白板。'});
    this.lifecycle.registerEvent(this.app.metadataCache.on('changed',()=>this.schedule()));
    for(const event of ['create','delete','rename'] as const) this.lifecycle.registerEvent(this.app.vault.on(event as 'create',()=>this.schedule()));
    this.schedule();
  }
  onClose(){this.active=false;this.run++;window.clearTimeout(this.timer);this.lifecycle.unload();this.contentEl.empty();}
  private select(parent: HTMLElement,label: string,options: Record<string,string>,value: string,change:(value:string)=>void){
    const s=parent.createEl('select',{attr:{'aria-label':label,title:label}});for(const [key,text] of Object.entries(options))s.createEl('option',{value:key,text});s.value=value;s.onchange=()=>change(s.value);return s;
  }
  private schedule(){if(!this.active)return;window.clearTimeout(this.timer);this.timer=window.setTimeout(()=>void this.load(),100);}
  private async load(){
    if(this.busy)return;
    const run=++this.run;const rows:RecordRow[]=[];let skipped=0;
    try{
      const files=libraryFiles(this.app.vault.getMarkdownFiles(),this.source,'updated',this.host.cardFolder,this.host.boardPaths||new Set());
      for(const file of files){
        if(!this.active||run!==this.run)return;
        try{const raw=await this.app.vault.cachedRead(file);const fm=parseRecord(raw);rows.push({file,raw,path:file.path,title:file.basename,mtime:file.stat.mtime,tags:[...new Set(getAllTags(this.app.metadataCache.getFileCache(file)||{})||[])],props:readProperties(fm),fields:fm,excerpt:noteExcerpt(raw)});}catch{skipped++;}
      }
      if(!this.active||run!==this.run)return;
      this.rows=rows;const tags=[...new Set(rows.flatMap(r=>r.tags))].sort();this.tags.empty();this.tags.createEl('option',{value:'',text:'所有标签'});for(const tag of tags)this.tags.createEl('option',{value:tag,text:tag});
      if(!tags.includes(this.filter.tag))this.filter.tag='';this.tags.value=this.filter.tag;
      this.message.setText(skipped?`${skipped} 篇笔记读取失败或属性格式无效，已跳过。请在原文中检查。`:'');this.render();
    }catch(e){if(this.active)this.message.setText(String(e));}
  }
  private render(){
    if(!this.active)return;
    this.filter.today=localDay();const all=filterRows(this.rows,this.filter).filter(row=>customMatches(row.fields,this.conditions,this.host.preferences.fields)),rows=all.slice(0,this.limit);
    this.count.setText(`${all.length} 篇笔记 · ${all.filter(r=>r.props.status==='done').length} 已完成`);
    this.tabButtons.forEach((b,i)=>b.toggleClass('is-active',(i===0)===(this.view==='table')));
    const scroll=this.results.scrollTop;this.results.empty();this.results.toggleClass('is-kanban',this.view==='kanban');
    if(this.view==='table')this.table(rows);else this.kanban(rows);
    if(!all.length)this.results.createDiv({cls:'ts-db-empty',text:'没有匹配笔记。试试其他范围，或清除筛选。'});
    if(all.length>rows.length)btn(this.results,`加载更多（${rows.length}/${all.length}）`,'chevrons-down',()=>{this.limit+=100;this.render();});
    this.results.scrollTop=scroll;
  }
  private title(parent:HTMLElement,row:RecordRow){const title=btn(parent,row.title,'file-text',()=>{this.close();this.host.preview(row.file);});title.addClass('ts-db-note-title');parent.createDiv({cls:'ts-db-path',text:row.path,attr:{title:row.path}});}
  private controls(parent:HTMLElement,row:RecordRow,field:PropertyField){
    if(field==='due'){
      const input=parent.createEl('input',{type:'date',attr:{'aria-label':`${row.title} 截止日期`}});input.value=row.props.due;input.disabled=this.busy;
      if(row.props.due&&!input.value)parent.createDiv({cls:'ts-db-invalid',text:`原日期：${row.props.due}`});
      input.onchange=()=>void this.update(row,field,input.value);if(isOverdue(row.props,localDay()))parent.createSpan({cls:'ts-db-overdue',text:'已逾期'});return;
    }
    const options={...(field==='status'?statuses:priorities)},value=row.props[field];if(!Object.hasOwn(options,value))options[value]=`自定义：${value}`;
    const s=this.select(parent,`${row.title} ${field==='status'?'状态':'优先级'}`,options,value,v=>void this.update(row,field,v));s.disabled=this.busy;s.dataset.value=value;
  }
  private table(rows:RecordRow[]){
    const table=this.results.createEl('table',{cls:'ts-db-table'}),head=table.createEl('thead').createEl('tr');for(const name of ['笔记','状态','优先级','截止日期','标签',...this.host.preferences.fields.map(f=>f.key)])head.createEl('th',{text:name,attr:{scope:'col'}});
    const body=table.createEl('tbody');for(const row of rows){const tr=body.createEl('tr',{attr:{'data-note-path':row.path}});this.title(tr.createEl('td'),row);for(const field of ['status','priority','due'] as const)this.controls(tr.createEl('td'),row,field);tr.createEl('td',{text:row.tags.join(' '),cls:'ts-db-tags'});for(const field of this.host.preferences.fields)this.customControl(tr.createEl('td'),row,field);}
  }
  private kanban(rows:RecordRow[]){
    const board=this.results.createDiv('ts-kanban');const columns={...statuses};if(rows.some(r=>!Object.hasOwn(statuses,r.props.status)))columns.other='其他状态';
    for(const [status,label] of Object.entries(columns)){
      const members=rows.filter(r=>status==='other'?!Object.hasOwn(statuses,r.props.status):r.props.status===status);
      const column=board.createDiv({cls:'ts-kanban-column',attr:{'data-status':status}});const head=column.createDiv('ts-kanban-heading');head.createSpan({text:label});head.createSpan({text:String(members.length),cls:'ts-kanban-count'});
      if(status!=='other'){
        column.ondragover=e=>{if(this.dragged&&!this.busy){e.preventDefault();column.addClass('is-drop-target');}};
        column.ondragleave=e=>{if(!column.contains(e.relatedTarget as Node))column.removeClass('is-drop-target');};
        column.ondrop=e=>{e.preventDefault();column.removeClass('is-drop-target');const row=this.dragged;this.dragged=undefined;if(row&&!this.busy)void this.update(row,'status',status);};
      }
      for(const row of members){
        const card=column.createDiv({cls:'ts-kanban-card',attr:{'data-note-path':row.path,draggable:String(!this.busy)}});card.ondragstart=e=>{if((e.target as HTMLElement).closest('select,input,button')||this.busy){e.preventDefault();return;}this.dragged=row;e.dataTransfer?.setData('text/plain',row.path);if(e.dataTransfer)e.dataTransfer.effectAllowed='move';};
        card.ondragend=()=>{this.dragged=undefined;this.results.querySelectorAll('.is-drop-target').forEach(el=>el.removeClass('is-drop-target'));};
        this.title(card,row);card.createDiv({cls:'ts-db-excerpt',text:row.excerpt});const controls=card.createDiv('ts-kanban-controls');this.controls(controls,row,'status');this.controls(controls,row,'priority');this.controls(controls,row,'due');card.createDiv({cls:'ts-db-tags',text:row.tags.join(' ')});for(const field of this.host.preferences.fields){const property=card.createDiv('ts-db-custom-property');property.createEl('small',{text:field.key});this.customControl(property,row,field);}
      }
      if(!members.length)column.createDiv({cls:'ts-kanban-empty',text:status==='other'?'暂无卡片':'把卡片拖到这里'});
    }
  }
  private async persist(){try{await this.host.savePreferences();}catch(e){new Notice('视图设置保存失败：'+String(e));throw e;}}
  private currentView(name='当前筛选'):SavedDatabaseView{return{id:crypto.randomUUID(),name,source:this.source,boardPath:this.source==='board'?this.host.boardPath:undefined,layout:this.view,filter:{...this.filter},conditions:this.conditions.map(c=>({...c}))};}
  private renderSaved(){this.savedSelect.empty();this.savedSelect.createEl('option',{value:'',text:'选择保存的筛选视图'});for(const v of this.host.preferences.views)if(v.source!=='board'||v.boardPath===this.host.boardPath)this.savedSelect.createEl('option',{value:v.id,text:v.name});}
  private applySaved(id:string){const v=this.host.preferences.views.find(v=>v.id===id);if(!v)return;this.source=v.source;this.view=v.layout;this.filter={...v.filter,today:localDay()};this.conditions=v.conditions.map(c=>({...c}));this.limit=100;
    const values:Record<string,string>={'资料范围':this.source,'资料标签':this.filter.tag,'资料状态':this.filter.status,'资料优先级':this.filter.priority,'资料排序':this.filter.sort};for(const [label,value]of Object.entries(values)){const el=this.contentEl.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);if(el)el.value=value;}
    this.contentEl.querySelector<HTMLInputElement>('[aria-label="资料搜索"]')!.value=this.filter.query;this.contentEl.querySelector<HTMLInputElement>('.ts-db-overdue-filter input')!.checked=this.filter.overdue;this.renderCustomFilters();this.schedule();
  }
  private saveView(){const modal=new Modal(this.app);themeSurface(modal.modalEl);modal.titleEl.setText('保存筛选视图');const current=this.host.preferences.views.find(v=>v.id===this.savedSelect.value),input=modal.contentEl.createEl('input',{type:'text',value:current?.name||'',attr:{placeholder:'例如：本周需要阅读的证据','aria-label':'筛选视图名称',maxlength:'80'}});btn(modal.contentEl,'保存','check',()=>{void(async()=>{const name=input.value.trim();if(!name)throw Error('请填写视图名称');if(!current&&this.host.preferences.views.length>=50)throw Error('最多保存 50 个视图');const next=this.currentView(name);if(current){next.id=current.id;this.host.preferences.views[this.host.preferences.views.indexOf(current)]=next;}else this.host.preferences.views.push(next);await this.persist();this.renderSaved();this.savedSelect.value=next.id;modal.close();})().catch(e=>new Notice(String(e)));});modal.open();}
  private async deleteView(){const id=this.savedSelect.value;if(!id)return;this.host.preferences.views=this.host.preferences.views.filter(v=>v.id!==id);await this.persist();this.renderSaved();}
  private addField(){const modal=new Modal(this.app);themeSurface(modal.modalEl);modal.titleEl.setText('自定义原生属性');modal.contentEl.createEl('p',{text:'填写已有 Obsidian 属性名即可复用；新属性直接写入笔记 YAML。移除显示列不会删除笔记属性。'});const input=modal.contentEl.createEl('input',{type:'text',attr:{placeholder:'例如：作者、项目、评分','aria-label':'属性名称',maxlength:'80'}}),listId='ts-props-'+crypto.randomUUID();input.setAttribute('list',listId);const list=modal.contentEl.createEl('datalist',{attr:{id:listId}});for(const key of new Set(this.rows.flatMap(r=>Object.keys(r.fields))))if(validCustomKey(key))list.createEl('option',{value:key});
    const type=this.select(modal.contentEl,'属性类型',{text:'文本',number:'数字',date:'日期',checkbox:'复选框',list:'列表'},'text',()=>{});
    btn(modal.contentEl,'添加字段','plus',()=>{void(async()=>{const key=input.value.trim();if(!validCustomKey(key))throw Error('名称无效，或与内置字段重复');if(this.host.preferences.fields.some(f=>f.key===key))throw Error('该字段已显示');if(this.host.preferences.fields.length>=30)throw Error('最多显示 30 个自定义字段');this.host.preferences.fields.push({key,type:type.value as CustomField['type']});await this.persist();modal.close();this.renderCustomFilters();this.render();})().catch(e=>new Notice(String(e)));});
    for(const f of this.host.preferences.fields){const row=modal.contentEl.createDiv('ts-db-field-definition');row.createSpan({text:`${f.key} · ${f.type}`});btn(row,'移除显示列','x',()=>{void(async()=>{if(this.host.preferences.views.some(v=>v.conditions.some(c=>c.key===f.key)))throw Error('保存的筛选仍在使用此字段，请先修改或删除相关视图');this.host.preferences.fields=this.host.preferences.fields.filter(v=>v!==f);this.conditions=this.conditions.filter(c=>c.key!==f.key);await this.persist();row.remove();this.renderCustomFilters();this.render();})().catch(e=>new Notice(String(e)));});}modal.open();
  }
  private customControl(parent:HTMLElement,row:RecordRow,field:CustomField){const value=row.fields[field.key],input=parent.createEl('input',{type:field.type==='checkbox'?'checkbox':field.type==='date'?'date':field.type==='number'?'number':'text',attr:{'aria-label':`${row.title} ${field.key}`}});if(field.type==='number')input.step='any';if(field.type==='checkbox')input.checked=value===true;else input.value=isUnknownArray(value)?value.map(v=>typeof v==='string'||typeof v==='number'||typeof v==='boolean'?String(v):JSON.stringify(v)??'').join(', '):value==null?'':typeof value==='string'||typeof value==='number'||typeof value==='boolean'?String(value):JSON.stringify(value)??'';input.disabled=this.busy;input.onchange=()=>void this.updateCustom(row,field,field.type==='checkbox'?input.checked:input.value);}
  private async updateCustom(row:RecordRow,field:CustomField,value:string|boolean){if(this.busy)return;this.busy=true;this.run++;try{await this.store.updateCustom(row.file,field,value,row.raw);}catch(e){new Notice(String(e));}finally{this.busy=false;if(this.active)await this.load();}}
  private renderCustomFilters(){this.customBar.empty();if(!this.host.preferences.fields.length)return;
    for(const [i,c]of this.conditions.entries()){const row=this.customBar.createDiv('ts-db-condition');const field=this.host.preferences.fields.find(f=>f.key===c.key);if(!field)continue;row.createSpan({text:field.key});const options:Record<string,string>={eq:'等于',empty:'未填写',...(field.type==='text'||field.type==='list'?{contains:'包含'}:{}),...(field.type==='number'||field.type==='date'?{gte:'不小于',lte:'不大于'}:{})};this.select(row,'字段比较方式',options,c.op,v=>{c.op=v as CustomCondition['op'];this.renderCustomFilters();this.render();});
      const input=field.type==='checkbox'?this.select(row,`${field.key} 筛选值`,{true:'是',false:'否'},c.value||'false',()=>{}):row.createEl('input',{type:field.type==='date'?'date':field.type==='number'?'number':'text',value:c.value,attr:{'aria-label':`${field.key} 筛选值`,placeholder:'筛选值'}});input.disabled=c.op==='empty';input.onchange=()=>{const old=c.value;c.value=input.value;try{if(c.op!=='empty'&&field.type!=='checkbox')customValue(field,c.value);this.render();}catch(e){c.value=old;new Notice(String(e));}};btn(row,'移除条件','x',()=>{this.conditions.splice(i,1);this.renderCustomFilters();this.render();});
    }
    const selector=this.select(this.customBar,'添加属性筛选',{'':'＋ 添加属性筛选',...Object.fromEntries(this.host.preferences.fields.map(f=>[f.key,f.key]))},'',key=>{if(!key)return;if(this.conditions.length>=20){new Notice('最多 20 个筛选条件');return;}this.conditions.push({key,op:'empty',value:''});this.renderCustomFilters();this.render();});selector.title='多个条件同时满足';
  }
  private async openBase(){try{const view=this.currentView(this.host.preferences.views.find(v=>v.id===this.savedSelect.value)?.name||'当前筛选');const content=stringifyYaml(databaseBase(view,this.host.preferences.fields,this.host.cardFolder,[...this.host.boardPaths||[]]));for(const path of ['ThoughtSpace','ThoughtSpace/视图'])if(!this.app.vault.getAbstractFileByPath(path))await this.app.vault.createFolder(path);const file=await this.app.vault.create(`ThoughtSpace/视图/资料视图-${Date.now()}-${crypto.randomUUID().slice(0,6)}.base`,content);this.close();await this.app.workspace.getLeaf('tab').openFile(file);new Notice(view.source==='board'?'已创建原生 Bases：当前白板文件范围快照，属性值实时读取':'已创建原生 Bases，可继续编辑筛选和视图');}catch(e){new Notice('创建 Bases 失败：'+String(e));}}
  private async exportCsv(){
    try {
      const rows=filterRows(this.rows,{...this.filter,today:localDay()}).filter(row=>customMatches(row.fields,this.conditions,this.host.preferences.fields));
      if(!rows.length){new Notice('当前筛选没有可导出的笔记');return;}
      for(const folder of ['ThoughtSpace','ThoughtSpace/导出']) if(!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
      const path=`ThoughtSpace/导出/卡片资料-${localDay()}-${crypto.randomUUID().slice(0,8)}.csv`;
      await this.app.vault.create(path,databaseCsv(rows));new Notice(`已导出 ${rows.length} 篇：${path}`,8000);if(this.active)this.message.setText(`已导出 ${rows.length} 篇：${path}`);
    }catch(e){new Notice(`导出失败：${String(e)}`,8000);}
  }
  private async update(row:RecordRow,field:PropertyField,value:string){
    if(this.busy)return;this.busy=true;this.run++;this.message.setText('正在保存…');this.render();let failure='';
    try{await this.store.update(row.file,field,value,row.raw);}catch(e){failure=e instanceof Error?e.message:String(e);new Notice(failure,8000);}
    finally{this.busy=false;if(this.active){await this.load();if(failure)this.message.setText(failure);else this.message.setText('已保存');}}
  }
}
