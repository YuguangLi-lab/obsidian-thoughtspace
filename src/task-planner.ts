import {App,Component,TFile} from 'obsidian';
import {localDay} from './filing';
import {isWorkspaceFile} from './workspace';
import {changeTask,planTasks,PlannedTask,restoreTaskLine} from './task-planner-model';
/** Bounded concurrent initial read; thereafter only changed files are read. Store tasks, not note bodies. */
export class TaskPlanner extends Component {
 private entries=new Map<TFile,{root:string;key:string;tasks:PlannedTask[]}>();private listeners=new Set<()=>void>();private pending=new Set<TFile>();private timer?:number;private running?:Promise<void>;private stopped=false;private initialized=false;private scan?:Promise<void>;
 private revisions=new WeakMap<TFile,number>();private reads=new WeakMap<TFile,number>();private dirty=new WeakSet<TFile>();
 private invalidate(file:TFile){this.revisions.set(file,(this.revisions.get(file)||0)+1);this.dirty.add(file);}
 readonly failures=new Set<string>();
 private undo?:{file:TFile;line:number;before:string;after:string};
 constructor(private app:App,private root:()=>string){super();}
 onload(){this.stopped=false;const changed=(f:unknown)=>{if(f instanceof TFile&&f.extension==='md'){this.invalidate(f);this.pending.add(f);this.schedule();}};this.registerEvent(this.app.vault.on('modify',changed));this.registerEvent(this.app.vault.on('create',changed));this.registerEvent(this.app.vault.on('delete',()=>{for(const [f] of this.entries)if(this.app.vault.getAbstractFileByPath(f.path)!==f){this.entries.delete(f);this.failures.delete(f.path);}this.emit();}));this.registerEvent(this.app.vault.on('rename',f=>{if(f instanceof TFile)changed(f);else for(const file of this.app.vault.getMarkdownFiles())if(file.path.startsWith(f.path+'/'))changed(file);}));}
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
 private emit(){if(!this.stopped)for(const fn of this.listeners)fn();}
 private schedule(){if(this.stopped||!this.initialized)return;window.clearTimeout(this.timer);this.timer=window.setTimeout(()=>{void this.flush();},180);}
 private async read(file:TFile,force=false){
  if(this.stopped)return;const path=file.path,key=`${path}:${file.stat.mtime}:${file.stat.size}`,root=this.root();
  if(!isWorkspaceFile(file)||this.app.vault.getAbstractFileByPath(path)!==file){this.entries.delete(file);return;}
  const cached=this.entries.get(file);if(!force&&!this.dirty.has(file)&&cached?.key===key&&cached.root===root)return;
  const revision=this.revisions.get(file)||0,read=(this.reads.get(file)||0)+1;this.reads.set(file,read);
  const current=()=>!this.stopped&&this.reads.get(file)===read&&(this.revisions.get(file)||0)===revision&&file.path===path&&root===this.root()&&this.app.vault.getAbstractFileByPath(path)===file;
  try{
   const text=await (force||this.dirty.has(file)?this.app.vault.read(file):this.app.vault.cachedRead(file));
   if(!current())return;
   if(key!==`${file.path}:${file.stat.mtime}:${file.stat.size}`){this.invalidate(file);this.pending.add(file);this.schedule();return;}
   this.entries.set(file,{key,root,tasks:planTasks(text,path,root)});this.dirty.delete(file);this.failures.delete(path);
  }catch{if(current()){this.entries.delete(file);this.failures.add(path);}}
 }

 async ready(){if(!this.initialized){if(!this.scan)this.scan=(async()=>{const files=this.app.vault.getMarkdownFiles().filter(isWorkspaceFile);let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<files.length&&!this.stopped)await this.read(files[cursor++]);}));this.initialized=true;})();await this.scan;}for(const path of this.failures){const f=this.app.vault.getAbstractFileByPath(path);if(f instanceof TFile)this.pending.add(f);else this.failures.delete(path);}for(const [f,e] of this.entries)if(e.root!==this.root())this.pending.add(f);await this.flush();}
 async flush():Promise<void>{if(this.running){await this.running;if(this.pending.size)return this.flush();return;}this.running=(async()=>{while(this.pending.size&&!this.stopped){const files=[...this.pending];this.pending.clear();for(const file of files)await this.read(file);}this.emit();})();try{await this.running;}finally{this.running=undefined;}}
 all(){return [...this.entries.values()].flatMap(e=>e.tasks);}
 async update(task:PlannedTask,change:Parameters<typeof changeTask>[2]){if(this.stopped)throw Error('插件已重载，请重新打开任务面板');const file=this.app.vault.getAbstractFileByPath(task.path);if(!(file instanceof TFile))throw Error('任务来源笔记已移动或删除，请刷新');const update={...change};if(update.completedOn===undefined&&update.checked!==undefined&&update.checked!==task.checked)update.completedOn=update.checked?localDay():'';let receipt:typeof this.undo;await this.app.vault.process(file,text=>{const next=changeTask(text,task,update);if(next!==text)receipt={file,line:task.line,before:task.source,after:next.split('\n')[task.line]};return next;});if(receipt)this.undo=receipt;this.invalidate(file);await this.read(file,true);await this.flush();this.emit();}
 canUndo(){return !!this.undo;}
 async undoLast(){if(this.stopped)throw Error('插件已重载，请重新打开任务面板');const record=this.undo;if(!record)return;if(this.app.vault.getAbstractFileByPath(record.file.path)!==record.file)throw Error('任务来源文件已删除');await this.app.vault.process(record.file,text=>restoreTaskLine(text,record.line,record.after,record.before));if(this.undo===record)this.undo=undefined;this.invalidate(record.file);await this.read(record.file,true);await this.flush();this.emit();}
 async rescan(){await this.ready();for(const f of this.entries.keys())if(this.app.vault.getAbstractFileByPath(f.path)!==f)this.entries.delete(f);const files=this.app.vault.getMarkdownFiles().filter(isWorkspaceFile);let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<files.length&&!this.stopped)await this.read(files[cursor++],true);}));await this.flush();}

 onunload(){this.stopped=true;window.clearTimeout(this.timer);this.entries.clear();this.pending.clear();this.listeners.clear();this.undo=undefined;}
}
