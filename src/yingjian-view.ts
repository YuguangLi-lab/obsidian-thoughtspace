import {App,Component,Modal,Notice,TFile,setIcon,parseYaml} from 'obsidian';
import {themeSurface} from './ui-tokens';
import {yingjianNoteSource,yingjianMoments,type VideoMoment} from './yingjian';
import type {YingjianPlayerAction} from './yingjian-player-adapter';
import {isWorkspaceFile} from './workspace';
export interface YingjianHost {
 boardTitle?:string;chooseBoard?:(file?:TFile)=>unknown;
 connection?:{installed:boolean;nativePlayback:boolean;version?:string};playerActions?:YingjianPlayerAction[];runPlayerAction?:(id:string)=>unknown;
 play:(source:string,time:number,note:TFile)=>Promise<void>;open:(file:TFile)=>Promise<unknown>;
 addNote?:(file:TFile)=>Promise<unknown>;addMoments?:(file:TFile,raw:string,moments:VideoMoment[])=>Promise<unknown>;
}
export class YingjianModal extends Modal {
 private query!:HTMLInputElement;private notes!:HTMLSelectElement;private list!:HTMLElement;private status!:HTMLElement;private error!:HTMLElement;private footer!:HTMLElement;
 private file?:TFile;private path='';private source='';private raw='';private moments:VideoMoment[]=[];private selected=new Set<string>();private closed=false;private loading=false;private busy=false;private generation=0;private limit=40;
 private lifecycle=new Component();private refreshTimer?:number;private refreshPending=false;private reloadPending=false;
 constructor(app:App,private host:YingjianHost,private done:()=>void){super(app);}
 private action(el:HTMLElement,title:string,icon:string,run:()=>unknown,disabled=false){const b=el.createEl('button',{attr:{'aria-label':title,title}});setIcon(b.createSpan(),icon);b.createSpan({text:title});b.disabled=disabled;b.onclick=()=>void this.run(run);return b;}
 private async run(action:()=>unknown){if(this.closed||this.busy||this.loading)return;this.busy=true;this.error.empty();this.render();try{await action();}catch(e){if(!this.closed)this.error.setText(e instanceof Error?e.message:String(e));}finally{this.busy=false;if(!this.closed){this.render();this.drainRefresh();}}}
 onOpen(){
  themeSurface(this.modalEl);this.modalEl.addClass('ts-yingjian');this.titleEl.setText('影笺 · 视频与白板');this.lifecycle.load();
  const overview=this.contentEl.createDiv('ts-yingjian-overview'),connection=this.host.connection;
  overview.createSpan({cls:'ts-yingjian-connection',text:connection?.nativePlayback?`影笺 ${connection.version||''} · 已连接`:connection?.installed?'影笺已启用 · 使用桌面链接回看':'未启用影笺 · 可整理已保存笔记'});
  const target=overview.createDiv('ts-yingjian-target');setIcon(target.createSpan(),'panels-top-left');target.createSpan({text:this.host.boardTitle||'尚未选择接收白板'});
  if(this.host.chooseBoard)this.action(target,'更换白板','chevron-down',async()=>this.host.chooseBoard?.(this.file?await this.validate():undefined)).addClass('ts-yingjian-compact');
  const actions=this.host.playerActions||[];
  if(actions.length&&this.host.runPlayerAction){
   const controls=this.contentEl.createDiv({cls:'ts-yingjian-player',attr:{'aria-label':'影笺播放器快捷操作'}}),primary=new Set(['yingjian:split-player','yingjian:capture-moment','yingjian:choose-capture-target','yingjian:library']);
   const add=(parent:HTMLElement,action:YingjianPlayerAction)=>{const b=this.action(parent,action.label,action.icon,()=>this.host.runPlayerAction?.(action.id));b.dataset.playerAction=action.id;b.title=action.description;};
   for(const action of actions.filter(a=>primary.has(a.id)))add(controls,action);
   const more=actions.filter(a=>!primary.has(a.id));if(more.length){const detail=controls.createEl('details',{cls:'ts-yingjian-more'});detail.createEl('summary',{text:'更多播放器操作'});const items=detail.createDiv();for(const action of more)add(items,action);}
  }
  const fields=this.contentEl.createDiv('ts-yingjian-fields');this.notes=fields.createEl('select',{attr:{'aria-label':'选择影笺笔记'}});const files=this.populateNotes();this.notes.onchange=()=>void this.load(this.notes.value);
  this.action(fields,'刷新','refresh-cw',()=>{this.populateNotes();return this.load(this.notes.value,true);});
  this.query=this.contentEl.createEl('input',{type:'search',attr:{placeholder:'搜索时间点或摘录…','aria-label':'搜索视频摘录'}});this.query.oninput=()=>{this.limit=40;this.render();};
  this.status=this.contentEl.createDiv({cls:'ts-yingjian-status',attr:{role:'status'}});this.list=this.contentEl.createDiv('ts-yingjian-list');this.error=this.contentEl.createDiv({cls:'ts-yingjian-error',attr:{role:'alert'}});this.footer=this.contentEl.createDiv('ts-yingjian-footer');
  this.contentEl.createDiv({cls:'ts-yingjian-hint',text:'播放器操作作用于当前播放的课程。选中时间点加入白板，可点击时间回看；原笔记更新后自动刷新此列表。'});
  this.lifecycle.registerEvent(this.app.metadataCache.on('changed',file=>this.queueRefresh(file===this.file||file.path===this.path)));
  this.lifecycle.registerEvent(this.app.vault.on('modify',file=>{if(file===this.file||file.path===this.path)this.queueRefresh(true);}));
  this.lifecycle.registerEvent(this.app.vault.on('rename',(file,oldPath)=>{if(oldPath===this.path){this.path=file.path;this.queueRefresh(true);}else this.queueRefresh(false);}));
  this.lifecycle.registerEvent(this.app.vault.on('delete',file=>this.queueRefresh(file===this.file||file.path===this.path)));
  this.lifecycle.registerEvent(this.app.vault.on('create',file=>{if(file instanceof TFile&&file.extension==='md')this.queueRefresh(file.path===this.path);}));
  this.render();if(files.length){this.notes.value=files[0].path;void this.load(files[0].path);}
 }
 private queueRefresh(reload:boolean){if(this.closed)return;this.refreshPending=true;this.reloadPending||=reload;if(this.refreshTimer)this.contentEl.ownerDocument.defaultView?.clearTimeout(this.refreshTimer);this.refreshTimer=this.contentEl.ownerDocument.defaultView?.setTimeout(()=>{this.refreshTimer=undefined;this.drainRefresh();},180);}
 private drainRefresh(){if(this.closed||this.busy||this.loading||!this.refreshPending)return;const reload=this.reloadPending;this.refreshPending=false;this.reloadPending=false;this.populateNotes();if(reload&&this.path)void this.load(this.path,true);}
 private populateNotes(){const path=this.path||this.notes.value;this.notes.empty();this.notes.createEl('option',{value:'',text:'选择本仓库的视频笔记或已保存摘录'});const files=this.app.vault.getMarkdownFiles().filter(isWorkspaceFile).filter(f=>yingjianNoteSource(this.app.metadataCache.getFileCache(f)?.frontmatter)).sort((a,b)=>b.stat.mtime-a.stat.mtime);for(const f of files)this.notes.createEl('option',{value:f.path,text:f.path});this.notes.value=files.some(f=>f.path===path)?path:'';return files;}
 async selectNote(path:string){if(this.closed||this.busy)throw Error('正在处理当前摘录，请稍后再打开笔记');this.populateNotes();await this.load(path);if(this.file?.path===path){if(!Array.from(this.notes.options).some(o=>o.value===path))this.notes.createEl('option',{value:path,text:path});this.notes.value=path;}}
 async load(path:string,preserve=false){
  if(this.closed)return;const generation=++this.generation,previousFile=preserve&&path===this.path?this.file:undefined;
  const keep=new Map<string,Set<number>>(),occurrences=new Map<string,number>();
  if(previousFile)for(const moment of this.moments){const key=moment.link+'\0'+moment.fragment.body,index=occurrences.get(key)||0;occurrences.set(key,index+1);if(this.selected.has(moment.id)){let indices=keep.get(key);if(!indices)keep.set(key,indices=new Set());indices.add(index);}}
  this.path=path;this.loading=true;this.selected.clear();this.file=undefined;this.raw='';this.moments=[];this.error.empty();this.render();
  try{if(!path)return;const file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile)||file.extension!=='md'||!isWorkspaceFile(file))throw Error('视频笔记已移动或删除');if(file.stat.size>2000000)throw Error('笔记过大，请先在原笔记中选择章节');
   const raw=await this.app.vault.read(file);if(this.closed||generation!==this.generation)return;
   const header=/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(raw),source=yingjianNoteSource(header?parseYaml(header[1]):undefined);
   if(!source||file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file)throw Error('视频来源已变化，请重新选择');
   const parsed=yingjianMoments(raw,source);this.file=file;this.source=source;this.raw=raw;this.moments=parsed.moments;this.selected=new Set();occurrences.clear();
   if(file===previousFile)for(const moment of parsed.moments){const key=moment.link+'\0'+moment.fragment.body,index=occurrences.get(key)||0;occurrences.set(key,index+1);if(this.selected.size<50&&keep.get(key)?.has(index))this.selected.add(moment.id);}
   this.limit=40;
   if(parsed.truncated)this.error.setText('当前只展示前 500 个时间点，请分章节处理。');
  }catch(e){if(!this.closed&&generation===this.generation)this.error.setText(e instanceof Error?e.message:String(e));}
  finally{if(generation===this.generation){this.loading=false;if(!this.closed){this.render();this.drainRefresh();}}}
 }
 private async validate(){const file=this.file,path=this.path;if(this.closed||!file||file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file)throw Error('来源笔记已变化，请刷新');const raw=await this.app.vault.read(file);if(this.closed||this.file!==file||file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file||raw!==this.raw)throw Error('来源内容已变化，请刷新后重新选择');return file;}
 private render(){
  if(this.closed)return;this.notes.disabled=this.loading||this.busy;this.query.disabled=this.loading||this.busy;this.contentEl.querySelectorAll<HTMLButtonElement>('[data-player-action]').forEach(b=>b.disabled=this.loading||this.busy);this.list.empty();this.footer.empty();
  const query=this.query.value.trim().toLocaleLowerCase(),visible=this.moments.filter(m=>!query||`${m.label}\n${m.fragment.body}`.toLocaleLowerCase().includes(query));this.status.setText(this.loading?'正在读取视频笔记…':`${visible.length} 个时间点 · 已选 ${this.selected.size} 项`);
  if(!this.file&&!this.loading)this.list.createDiv({cls:'ts-yingjian-empty',text:'选择一篇视频笔记，或在影笺中记录第一个时间点。'});
  if(this.file&&!visible.length)this.list.createDiv({cls:'ts-yingjian-empty',text:'没有匹配的时间点。可以打开视频、原笔记，或将整篇笔记加入白板。'});
  for(const m of visible.slice(0,this.limit)){
   const row=this.list.createDiv('ts-yingjian-row');row.toggleClass('is-selected',this.selected.has(m.id));const label=row.createEl('label'),check=label.createEl('input',{type:'checkbox',attr:{'aria-label':`选择 ${m.label} 第 ${m.fragment.start} 行`}});check.checked=this.selected.has(m.id);check.disabled=this.busy||this.loading;
   check.onchange=()=>{if(check.checked){if(this.selected.size>=50){check.checked=false;new Notice('一次最多选择 50 个时间点');return;}this.selected.add(m.id);}else this.selected.delete(m.id);const scroll=this.list.scrollTop;this.render();this.list.scrollTop=scroll;};
   label.createEl('strong',{text:m.label});row.createDiv({cls:'ts-yingjian-preview',text:m.fragment.body.replace(/!\[\[[^\n]+?\]\]/g,'［截图］').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/\^video-t-[\w-]+/g,'').replace(/^> ?/gm,'').slice(0,400)});
   this.action(row,'回看','play',async()=>{const file=await this.validate();await this.host.play(this.source,m.time,file);},this.busy||this.loading);
  }
  if(visible.length>this.limit)this.action(this.list,'显示更多时间点','chevron-down',()=>{this.limit+=40;});
  const selection=this.footer.createDiv('ts-yingjian-selection'),imports=this.footer.createDiv('ts-yingjian-imports');
  this.action(selection,'全选结果','list-checks',()=>{this.selected=new Set(visible.slice(0,50).map(m=>m.id));},!visible.length||this.busy||this.loading);this.action(selection,'清空','x',()=>this.selected.clear(),!this.selected.size||this.busy||this.loading);
  this.action(selection,'原笔记','file-text',async()=>this.host.open(await this.validate()),!this.file||this.busy||this.loading);this.action(selection,'播放视频','clapperboard',async()=>{const file=await this.validate();await this.host.play(this.source,0,file);},!this.file||this.busy||this.loading);
  this.action(imports,'整篇引用','file-plus',async()=>{const count=await this.host.addNote?.(await this.validate());new Notice(count===0?'白板已有此笔记，无需重复添加':'视频笔记已加入白板，原文共用');},!this.file||!this.host.addNote||this.busy||this.loading);
  this.action(imports,this.selected.size?`加入 ${this.selected.size} 条摘录`:'加入摘录','plus',async()=>{const file=await this.validate();await this.host.addMoments?.(file,this.raw,this.moments.filter(m=>this.selected.has(m.id)));this.selected.clear();new Notice('视频摘录已加入白板，可撤销');},!this.file||!this.selected.size||!this.host.addMoments||this.busy||this.loading).addClass('mod-cta');
 }
 onClose(){this.closed=true;this.generation++;if(this.refreshTimer)this.contentEl.ownerDocument.defaultView?.clearTimeout(this.refreshTimer);this.lifecycle.unload();this.raw='';this.file=undefined;this.moments=[];this.selected.clear();this.contentEl.empty();this.done();}
}
