import {App,Component,FileSystemAdapter,TFile,TFolder,normalizePath,type DataAdapter} from 'obsidian';
import {resolve as resolvePath} from 'path';
import {ProjectColorRegistry,ProjectColorSaveQueue,validateProjectColorsSnapshot,type ProjectColor} from './folio-project-colors';
import {atomicWriteProjectColors} from './folio-project-colors-storage';

const SAVE_QUEUES=Symbol.for('thoughtspace.folio-project-colors.save-queues.v1');
const COLOR_ATTRIBUTES=['data-folio-folder-slot','data-folio-project','data-folio-project-id'];
interface ExplorerScope {observer:MutationObserver;folders:Set<HTMLElement>;}

// Kept on the host across plugin reloads. The new load waits for the old
// unload save, even when its adapter write has not completed yet.
function saveQueue(app:App,path:string){
  const adapter=app.vault.adapter;
  const host=app.workspace.containerEl.ownerDocument.defaultView as unknown as {[key:symbol]:WeakMap<DataAdapter,Map<string,ProjectColorSaveQueue>>|undefined};
  let adapters=host[SAVE_QUEUES];
  if(!adapters){adapters=new WeakMap();host[SAVE_QUEUES]=adapters;}
  let paths=adapters.get(adapter);
  if(!paths){paths=new Map();adapters.set(adapter,paths);}
  let queue=paths.get(path);
  if(!queue){queue=new ProjectColorSaveQueue();paths.set(path,queue);}
  return queue;
}

/** DOM metadata only. Folio's theme decides whether and how it is painted. */
export class FolioProjectColorBridge extends Component {
  private registry=new ProjectColorRegistry();
  private queue:ProjectColorSaveQueue;
  private path:string;
  private scopes=new Map<HTMLElement,ExplorerScope>();
  private stopped=false;
  private refreshQueued=false;
  private timerWindow:Window;
  private saveTimer?:number;
  private savedRevision=0;
  private persistenceAvailable=true;
  constructor(private app:App,pluginDir:string,private isBoard:(file:TFile)=>boolean,private onError:(error:unknown)=>void){
    super();
    this.path=normalizePath(`${pluginDir}/folio-project-colors.json`);
    this.timerWindow=app.workspace.containerEl.ownerDocument.defaultView||window;
    this.queue=saveQueue(app,this.path);
  }
  async initialize():Promise<void>{
    try{
      if(!(this.app.vault.adapter instanceof FileSystemAdapter))throw new Error('Folio 项目配色需要桌面文件适配器；仅使用临时配色。');
      const raw=await this.queue.run(async()=>await this.app.vault.adapter.exists(this.path)?JSON.parse(await this.app.vault.adapter.read(this.path)) as unknown:undefined);
      if(raw!==undefined)validateProjectColorsSnapshot(raw);
      this.registry=new ProjectColorRegistry(raw);
    }catch(error){
      // Never overwrite an unreadable registry with newly allocated colors.
      this.persistenceAvailable=false;this.onError(error);
    }
  }
  onload():void{
    this.seedProjects();
    this.app.workspace.onLayoutReady(()=>{if(!this.stopped)this.syncExplorers();});
    this.registerEvent(this.app.workspace.on('layout-change',()=>this.scheduleExplorerSync()));
    this.registerEvent(this.app.workspace.on('window-open',()=>this.scheduleExplorerSync()));
    this.registerEvent(this.app.vault.on('create',file=>{
      if(file.path.includes('/'))return;
      if(file instanceof TFolder)this.take(()=>this.registry.folder(file.path));
      else if(file instanceof TFile&&this.isBoard(file))this.take(()=>this.registry.boardRoot(file.path));
    }));
    this.registerEvent(this.app.vault.on('rename',(file,oldPath)=>{
      if(this.registry.rename(oldPath,file.path,file instanceof TFolder))this.scheduleSave();
      // Native data-path mutations and the board renderer update attributes
      // after the rename. Reading the old DOM here could re-create old keys.
    }));
  }
  private seedProjects(){
    const projects=this.app.vault.getRoot().children.filter(file=>file instanceof TFolder||file instanceof TFile&&this.isBoard(file));
    projects.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
    for(const file of projects)this.take(()=>file instanceof TFolder?this.registry.folder(file.path):this.registry.boardRoot(file.path));
  }
  private take(resolve:()=>Readonly<ProjectColor>|undefined){
    const revision=this.registry.revision,project=resolve();
    if(this.registry.revision!==revision)this.scheduleSave();
    return project;
  }
  private mark(element:HTMLElement,project:Readonly<ProjectColor>){
    element.setAttribute('data-folio-folder-slot',String(project.slot));
    element.setAttribute('data-folio-project',`${project.kind}:${project.path}`);
    element.setAttribute('data-folio-project-id',String(project.id));
  }
  decorateBoardRow(row:HTMLElement,rootPath:string):void{
    if(this.stopped)return;
    row.setAttribute('data-project-root',rootPath);
    const project=this.take(()=>this.registry.boardRoot(rootPath));
    if(project)this.mark(row,project);
  }
  private nativeFolder(folder:HTMLElement,scope:ExplorerScope){
    const path=folder.querySelector(':scope > .nav-folder-title[data-path]')?.getAttribute('data-path');
    const project=path&&this.app.vault.getAbstractFileByPath(path) instanceof TFolder?this.take(()=>this.registry.folder(path)):undefined;
    if(project){this.mark(folder,project);scope.folders.add(folder);}
    else this.clearFolder(folder,scope);
  }
  private clearFolder(folder:HTMLElement,scope:ExplorerScope){
    if(!scope.folders.delete(folder))return;
    for(const attribute of COLOR_ATTRIBUTES)folder.removeAttribute(attribute);
  }
  private subtree(node:Node,scope:ExplorerScope,remove=false){
    if(node.nodeType!==1)return;
    const element=node as HTMLElement;
    const visit=(folder:HTMLElement)=>remove?this.clearFolder(folder,scope):this.nativeFolder(folder,scope);
    if(element.matches('.nav-folder'))visit(element);
    for(const folder of Array.from(element.querySelectorAll<HTMLElement>('.nav-folder')))visit(folder);
  }
  private scheduleExplorerSync(){
    if(this.stopped||this.refreshQueued)return;
    this.refreshQueued=true;
    queueMicrotask(()=>{this.refreshQueued=false;if(!this.stopped)this.syncExplorers();});
  }
  private syncExplorers(){
    const containers=new Set(this.app.workspace.getLeavesOfType('file-explorer').map(leaf=>leaf.view.containerEl));
    for(const [container,scope]of this.scopes){
      if(containers.has(container))continue;
      scope.observer.disconnect();for(const folder of scope.folders)this.clearFolder(folder,scope);this.scopes.delete(container);
    }
    for(const container of containers){
      if(this.scopes.has(container))continue;
      const Observer=container.ownerDocument.defaultView?.MutationObserver;
      if(!Observer)continue;
      const scope:ExplorerScope={folders:new Set(),observer:new Observer(records=>{
        if(this.stopped)return;
        for(const record of records)for(const node of Array.from(record.removedNodes))this.subtree(node,scope,true);
        for(const record of records){
          if(record.type==='attributes'){
            const folder=(record.target as HTMLElement).closest<HTMLElement>('.nav-folder');
            if(folder)this.nativeFolder(folder,scope);
          }else for(const node of Array.from(record.addedNodes))this.subtree(node,scope);
        }
      })};
      this.scopes.set(container,scope);
      this.subtree(container,scope);
      scope.observer.observe(container,{childList:true,subtree:true,attributes:true,attributeFilter:['data-path']});
    }
  }
  private scheduleSave(){
    if(this.stopped||!this.persistenceAvailable)return;
    if(this.saveTimer!==undefined)this.timerWindow.clearTimeout(this.saveTimer);
    this.saveTimer=this.timerWindow.setTimeout(()=>{this.saveTimer=undefined;this.flush();},180);
  }
  private flush(){
    if(!this.persistenceAvailable||this.savedRevision===this.registry.revision)return;
    const revision=this.registry.revision,snapshot=JSON.stringify(this.registry.snapshot(),null,2);
    this.savedRevision=revision;
    void this.queue.run(()=>{
      const adapter=this.app.vault.adapter;
      if(!(adapter instanceof FileSystemAdapter))throw new Error('Folio 项目配色需要桌面文件适配器。');
      return atomicWriteProjectColors(resolvePath(adapter.getBasePath(),this.path),snapshot);
    }).catch(error=>{
      if(this.savedRevision===revision)this.savedRevision=-1;
      this.onError(error);
    });
  }
  onunload():void{
    this.stopped=true;
    if(this.saveTimer!==undefined)this.timerWindow.clearTimeout(this.saveTimer);
    this.saveTimer=undefined;this.flush();
    for(const scope of this.scopes.values()){
      scope.observer.disconnect();for(const folder of scope.folders)this.clearFolder(folder,scope);
    }
    this.scopes.clear();
    this.app.workspace.iterateAllLeaves(leaf=>{
      for(const row of Array.from(leaf.view.containerEl.querySelectorAll<HTMLElement>('.ts-tree-row[data-project-root]'))){
        for(const attribute of [...COLOR_ATTRIBUTES,'data-project-root'])row.removeAttribute(attribute);
      }
    });
  }
}
