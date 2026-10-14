/** Stable project identities; no Obsidian objects or document writes. */
export type ProjectColorSlot=1|2|3|4|5|6;
export interface ProjectColor {id:number;kind:'folder'|'board';path:string;slot:ProjectColorSlot;}
export interface ProjectColorsSnapshot {version:1;nextId:number;projects:ProjectColor[];}

/** Reload reads and writes share this queue, so older saves cannot land last. */
export class ProjectColorSaveQueue {
  private tail:Promise<unknown>=Promise.resolve();
  run<T>(work:()=>Promise<T>):Promise<T>{
    const result=this.tail.then(work,work);
    this.tail=result.then(()=>undefined,()=>undefined);
    return result;
  }
}

function safePath(value:unknown):value is string {
  return typeof value==='string'&&value.length>0&&value.length<=2048&&!value.startsWith('/')&&!value.endsWith('/')&&
    !value.split('/').some(part=>!part||part==='.'||part==='..')&&
    !Array.from(value).some(char=>char.charCodeAt(0)<32);
}
function key(project:Pick<ProjectColor,'kind'|'path'>){return `${project.kind}:${project.path}`;}
function validEntry(value:unknown):value is ProjectColor {
  if(!value||typeof value!=='object')return false;
  const project=value as Partial<ProjectColor>;
  return safePath(project.path)&&!project.path.includes('/')&&['folder','board'].includes(project.kind||'')&&
    Number.isSafeInteger(project.id)&&project.id!>0&&project.id!<Number.MAX_SAFE_INTEGER&&
    Number.isInteger(project.slot)&&project.slot!>=1&&project.slot!<=6;
}

/** Existing files must be fully understood before this version may replace them. */
export function validateProjectColorsSnapshot(raw:unknown):asserts raw is ProjectColorsSnapshot {
  const invalid=()=>{throw new Error('Folio 项目配色注册表已损坏或版本不受支持；保留原文件，仅使用临时配色。');};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return invalid();
  const value=raw as Partial<ProjectColorsSnapshot>;
  if(value.version!==1||!Array.isArray(value.projects)||value.projects.length>10000||
    !Number.isSafeInteger(value.nextId)||value.nextId!<1||value.nextId!>=Number.MAX_SAFE_INTEGER)return invalid();
  const ids=new Set<number>(),keys=new Set<string>();
  for(const project of value.projects){
    if(!validEntry(project)||project.id>=value.nextId!||ids.has(project.id)||keys.has(key(project)))return invalid();
    ids.add(project.id);keys.add(key(project));
  }
}

export class ProjectColorRegistry {
  private projects=new Map<string,ProjectColor>();
  private nextId=1;
  revision=0;
  constructor(raw:unknown=null){
    if(!raw||typeof raw!=='object')return;
    const value=raw as Partial<ProjectColorsSnapshot>;
    if(value.version!==1||!Array.isArray(value.projects))return;
    const ids=new Set<number>();
    for(const item of value.projects.slice(0,10000)){
      if(!validEntry(item))continue;
      const entry:ProjectColor={...item};
      if(ids.has(entry.id)||this.projects.has(key(entry)))continue;
      ids.add(entry.id);this.projects.set(key(entry),entry);this.nextId=Math.max(this.nextId,entry.id+1);
    }
    if(Number.isSafeInteger(value.nextId)&&value.nextId!>=this.nextId)this.nextId=value.nextId!;
  }
  private ensure(kind:ProjectColor['kind'],path:string):Readonly<ProjectColor>{
    const projectKey=key({kind,path}),existing=this.projects.get(projectKey);
    if(existing)return {...existing};
    const id=this.nextId++;
    const project:ProjectColor={id,kind,path,slot:((id-1)%6+1) as ProjectColorSlot};
    this.projects.set(projectKey,project);this.revision++;return {...project};
  }
  folder(path:string):Readonly<ProjectColor>|undefined{
    return safePath(path)?this.ensure('folder',path.split('/')[0]):undefined;
  }
  boardRoot(path:string):Readonly<ProjectColor>|undefined{
    if(!safePath(path))return;
    return path.includes('/')?this.folder(path):this.ensure('board',path);
  }
  rename(oldPath:string,newPath:string,isFolder:boolean):boolean{
    if(!safePath(oldPath)||!safePath(newPath)||oldPath.includes('/')||newPath.includes('/')||oldPath===newPath)return false;
    const kind=isFolder?'folder':'board',oldKey=key({kind,path:oldPath}),project=this.projects.get(oldKey);
    if(!project)return false;
    this.projects.delete(oldKey);
    // A previously deleted project may reserve the destination name. The live
    // renamed project owns that path, without reassigning any other color.
    const renamed={...project,path:newPath};
    this.projects.set(key(renamed),renamed);this.revision++;return true;
  }
  snapshot():ProjectColorsSnapshot{
    return {version:1,nextId:this.nextId,projects:Array.from(this.projects.values(),project=>({...project}))};
  }
}
