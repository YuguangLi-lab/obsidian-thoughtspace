import {App,Component,Modal,Notice,TFile,getAllTags,setIcon} from 'obsidian';
import {nativeRelations} from './native-bridge';
import {themeSurface} from './ui-tokens';
import {isWorkspaceFile} from './workspace';
export interface NativeBridgeHost {
  open:(file:TFile)=>unknown; add:(files:TFile[])=>unknown;
  usages:(file:TFile,active:()=>boolean)=>Promise<{files:TFile[];errors:number}>;
  openBoard:(file:TFile)=>unknown;
}
type Tab='outgoing'|'incoming'|'boards'|'properties'|'unresolved';
const labels:Record<Tab,string>={outgoing:'出链',incoming:'反向链接',boards:'所在白板',properties:'属性与标签',unresolved:'未解析链接'};
export class NativeBridgeModal extends Modal {
  private life=new Component();private active=false;private generation=0;private tab:Tab='outgoing';private query='';private page=0;private selected=new Set<string>();
  private nav!:HTMLElement;private list!:HTMLElement;private footer!:HTMLElement;private state!:HTMLElement;
  private relations={outgoing:[] as string[],incoming:[] as string[],unresolved:[] as string[]};private boards:TFile[]=[];private errors=0;
  constructor(app:App,readonly file:TFile,private host:NativeBridgeHost){super(app);}
  onOpen(){
    this.active=true;this.life.load();this.modalEl.addClass('ts-native-bridge');themeSurface(this.modalEl);
    this.titleEl.setText('Obsidian 关联');const intro=this.contentEl.createDiv('ts-native-intro');intro.createEl('h2',{text:this.file.basename});intro.createEl('p',{text:this.file.path});
    const tools=this.contentEl.createDiv('ts-native-tools');this.action(tools,'右侧编辑原文','panel-right',()=>this.host.open(this.file));this.action(tools,'加入白板…','plus',()=>this.host.add([this.file]));this.action(tools,'刷新关联','refresh-cw',()=>this.refresh());
    this.state=this.contentEl.createDiv({cls:'ts-native-state',attr:{role:'status','aria-live':'polite'}});
    this.nav=this.contentEl.createDiv({cls:'ts-native-tabs',attr:{role:'tablist','aria-label':'关联分类'}});
    const search=this.contentEl.createEl('input',{cls:'ts-native-search',type:'search',attr:{'aria-label':'筛选关联内容',placeholder:'搜索标题、路径或属性…'}});search.oninput=()=>{this.query=search.value;this.page=0;this.render();};
    this.list=this.contentEl.createDiv('ts-native-list');this.footer=this.contentEl.createDiv('ts-native-footer');
    for(const event of ['changed','resolved'] as const)this.life.registerEvent(this.app.metadataCache.on(event as 'resolved',()=>{this.markStale('原生索引已更新，点击刷新查看。');}));
    this.life.registerEvent(this.app.vault.on('rename',()=>{this.markStale('文件路径已变化，请刷新关联。');}));
    this.life.registerEvent(this.app.vault.on('delete',()=>{this.markStale('文件已删除，请刷新关联。');}));
    void this.refresh();
  }
  private markStale(message:string){
    if(!this.active)return;
    if(this.app.vault.getAbstractFileByPath(this.file.path)!==this.file){this.state.setText('原笔记已删除，请关闭面板');return;}
    this.state.setText((this.errors?`${this.errors} 块白板未能读取，所在白板列表可能不完整。 `:'')+message);
  }
  private action(el:HTMLElement,label:string,icon:string,fn:()=>unknown){const b=el.createEl('button',{attr:{'aria-label':label,title:label}});setIcon(b.createSpan(),icon);b.createSpan({text:label});b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){new Notice(String(e));}finally{b.disabled=false;}};return b;}
  async refresh(){
    const gen=++this.generation;this.state.setText('读取原生链接索引…');
    try{
      if(this.app.vault.getAbstractFileByPath(this.file.path)!==this.file)throw Error('原笔记已删除，请关闭面板');
      const valid=new Set(this.app.vault.getMarkdownFiles().filter(isWorkspaceFile).map(f=>f.path));
      this.relations=nativeRelations(this.file.path,this.app.metadataCache.resolvedLinks,this.app.metadataCache.unresolvedLinks,valid);
      const usages=await this.host.usages(this.file,()=>this.active&&gen===this.generation);if(!this.active||gen!==this.generation)return;
      this.boards=usages.files;this.errors=usages.errors;this.selected.clear();this.page=0;
      this.state.setText(this.errors?`${this.errors} 块白板未能读取，所在白板列表可能不完整。`:'来自 Obsidian 原生索引 · 加入白板保留原文');this.render();
    }catch(e){if(this.active&&gen===this.generation){this.list.empty();this.nav.empty();this.footer.empty();this.state.setText(String(e));}}
  }
  private render(){
    this.nav.empty();const cache=this.app.metadataCache.getFileCache(this.file);const props=Object.entries(cache?.frontmatter||{}).filter(([k])=>k!=='position');const tags=getAllTags(cache||{})||[];
    const counts={outgoing:this.relations.outgoing.length,incoming:this.relations.incoming.length,boards:this.boards.length,properties:props.length,unresolved:this.relations.unresolved.length};
    for(const tab of Object.keys(labels) as Tab[]){const b=this.action(this.nav,`${labels[tab]} ${counts[tab]}`,'',()=>{this.tab=tab;this.page=0;this.selected.clear();this.render();});b.setAttribute('role','tab');b.setAttribute('aria-selected',String(tab===this.tab));}
    this.list.empty();this.footer.empty();const q=this.query.trim().toLocaleLowerCase();
    if(this.tab==='properties'){
      const box=this.list.createDiv('ts-native-tags');for(const t of tags)box.createSpan({text:t});
      const dl=this.list.createEl('dl');for(const [key,value] of props){const text=typeof value==='string'?value:JSON.stringify(value);if(!`${key} ${text}`.toLocaleLowerCase().includes(q))continue;dl.createEl('dt',{text:key});dl.createEl('dd',{text:(text??'').slice(0,2000)});}
      if(!props.length&&!tags.length)this.empty('还没有属性或标签','可在右侧原文的 Obsidian 属性区域编辑。');this.footer.createSpan({text:'属性只读展示；修改请使用右侧原文。'});return;
    }
    const paths=(this.tab==='boards'?this.boards.map(f=>f.path):this.relations[this.tab]).filter(p=>p.toLocaleLowerCase().includes(q));
    this.page=Math.min(this.page,Math.max(0,Math.ceil(paths.length/60)-1));
    if(!paths.length)this.empty('没有匹配的关联',this.tab==='unresolved'?'此笔记没有未解析链接。':'可以调整搜索条件，或在原文中添加 [[双向链接]]。');
    for(const path of paths.slice(this.page*60,(this.page+1)*60)){
      const row=this.list.createDiv('ts-native-row');const f=this.app.vault.getAbstractFileByPath(path);
      if((this.tab==='incoming'||this.tab==='outgoing')&&f instanceof TFile){const check=row.createEl('input',{type:'checkbox',attr:{'aria-label':'选择 '+f.basename}});check.checked=this.selected.has(path);check.onchange=()=>{if(check.checked){if(this.selected.size>=100){check.checked=false;new Notice('每次最多选择 100 篇笔记');return;}this.selected.add(path);}else this.selected.delete(path);const scroll=this.list.scrollTop;this.render();this.list.scrollTop=scroll;this.list.querySelector<HTMLInputElement>(`input[aria-label="${CSS.escape("选择 "+f.basename)}"]`)?.focus({preventScroll:true});};}
      if(this.tab==='unresolved'){row.createSpan({text:path});row.createSpan({cls:'ts-native-badge',text:'待创建'});}
      else if(f instanceof TFile){const b=this.action(row,f.basename,this.tab==='boards'?'panels-top-left':'file-text',()=>this.tab==='boards'?this.host.openBoard(f):this.host.open(f));b.createEl('small',{text:path});}
      else row.createSpan({text:path+' · 已移动或删除'});
    }
    const controls=this.footer.createDiv();const prev=this.action(controls,'上一页','chevron-left',()=>{this.page--;this.render();});prev.disabled=this.page===0;
    controls.createSpan({text:`${this.page+1} / ${Math.max(1,Math.ceil(paths.length/60))} · ${paths.length} 项`});const next=this.action(controls,'下一页','chevron-right',()=>{this.page++;this.render();});next.disabled=(this.page+1)*60>=paths.length;
    if(this.tab==='incoming'||this.tab==='outgoing'){
      this.action(this.footer,'选择本页','list-check',()=>{for(const p of paths.slice(this.page*60,(this.page+1)*60)){if(this.selected.size>=100)break;this.selected.add(p);}this.render();});
      if(this.selected.size)this.action(this.footer,'清空选择','x',()=>{this.selected.clear();this.render();});
      const add=this.action(this.footer,`加入所选 ${this.selected.size} 篇…`,'plus',()=>{const files=[...this.selected].map(p=>this.app.vault.getAbstractFileByPath(p));if(files.some(f=>!(f instanceof TFile)))throw Error('所选笔记已变化，请刷新');return this.host.add(files as TFile[]);});add.disabled=!this.selected.size;
    }
  }
  private empty(title:string,text:string){const el=this.list.createDiv('ts-native-empty');setIcon(el.createDiv(),'network');el.createEl('h3',{text:title});el.createEl('p',{text});}
  onClose(){this.active=false;this.generation++;this.life.unload();this.contentEl.empty();}
}
