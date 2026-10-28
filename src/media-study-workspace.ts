import {App,ItemView,TFile,WorkspaceLeaf,type ViewStateResult,setIcon} from 'obsidian';
import {themeSurface} from './ui-tokens';
import {applyWorkspaceDensity} from './workspace-density';
import type {MediaStudyMode,MediaStudyState} from './media-study-state';

export const MEDIA_STUDY_EMPTY='thoughtspace-media-study-empty';
export interface MediaStudyOwner {leaf:WorkspaceLeaf;contentEl:HTMLElement;study:MediaStudyState;studyCurrent():boolean;studyNote():TFile|undefined;studyRecord():void|Promise<void>;studyChanged():void}
export interface MediaStudyHost {show(owner:MediaStudyOwner,mode:MediaStudyMode):Promise<void>;sync(owner:MediaStudyOwner):Promise<void>;release(owner:MediaStudyOwner):void;ratio(owner:MediaStudyOwner,value:number):void}
interface Entry {owner:MediaStudyOwner;run:number;queue:Promise<unknown>;notes?:WorkspaceLeaf;board?:WorkspaceLeaf;anchor?:WorkspaceLeaf;observer?:ResizeObserver;restore?:()=>void;allocating?:boolean;navigation?:()=>boolean}
const leafId=(leaf:WorkspaceLeaf)=>{const id:unknown=Reflect.get(leaf,'id');return typeof id==='string'?id:undefined;};
const group=(leaf:WorkspaceLeaf|undefined)=>leaf?.view.containerEl.closest<HTMLElement>('.workspace-tabs');
/** A companion is a real native Markdown/Board leaf. Neither file view is
 * replaced on mode changes, so native edits, undo and board camera stay owned. */
export class MediaStudyWorkspace implements MediaStudyHost {
 private entries=new Map<MediaStudyOwner,Entry>();private stopped=false;
 private anchors=new WeakMap<MediaStudyOwner,WorkspaceLeaf>();
 private documents=new WeakMap<Document,{left:HTMLElement;anchor:WorkspaceLeaf}>();
 constructor(private app:App,private host:{boardType:string;chooseBoard(owner:MediaStudyOwner):Promise<TFile|undefined>;validateBoard(file:TFile):Promise<void>;accent():string;density():string}){}
 private entry(owner:MediaStudyOwner){let entry=this.entries.get(owner);if(!entry){const previous=this.documents.get(owner.contentEl.ownerDocument);entry={owner,run:0,queue:Promise.resolve(),anchor:this.anchors.get(owner)||(previous&&previous.left===group(owner.leaf)?previous.anchor:undefined)};this.entries.set(owner,entry);}return entry;}
 private current(owner:MediaStudyOwner){return !this.stopped&&owner.study.enabled&&owner.studyCurrent()&&owner.leaf.view===(owner as unknown)&&owner.contentEl.isConnected;}
 private find(id:string|undefined){let found:WorkspaceLeaf|undefined;if(id)this.app.workspace.iterateAllLeaves(leaf=>{if(leafId(leaf)===id)found=leaf;});return found;}
 private matches(leaf:WorkspaceLeaf|undefined,owner:MediaStudyOwner,mode:MediaStudyMode){if(!leaf||leaf===owner.leaf||leaf.view.containerEl.ownerDocument!==owner.contentEl.ownerDocument||!leaf.view.containerEl.isConnected)return false;const state=leaf.getViewState();return mode==='board'?state.type===this.host.boardType&&state.state?.file===owner.study.board:state.type===MEDIA_STUDY_EMPTY&&state.state?.pair===owner.study.id||state.type==='markdown'&&!!owner.studyNote()&&state.state?.file===owner.studyNote()?.path;}
 show(owner:MediaStudyOwner,mode:MediaStudyMode){const entry=this.entry(owner),run=++entry.run;const operation=entry.queue.catch(()=>{}).then(async()=>{let cancelled=false;const valid=()=>{const active=this.app.workspace.getActiveViewOfType(ItemView)?.leaf;if(active&&active!==owner.leaf&&active!==entry.notes&&active!==entry.board&&active!==entry.anchor)cancelled=true;return !cancelled;};entry.navigation=()=>!cancelled;const ref=this.app.workspace.on('active-leaf-change',()=>{if(!entry.allocating)valid();});try{await this.open(entry,mode,run);}finally{this.app.workspace.offref(ref);entry.navigation=undefined;}});entry.queue=operation;return operation;}
 private async open(entry:Entry,mode:MediaStudyMode,run:number){
  const owner=entry.owner,source=owner.study.id,current=()=>this.current(owner)&&owner.study.id===source&&entry.run===run&&entry.navigation?.()!==false;if(!current())return;
  let board:TFile|undefined;if(mode==='board'){const file=owner.study.board&&this.app.vault.getAbstractFileByPath(owner.study.board);board=file instanceof TFile?file:await this.host.chooseBoard(owner);if(!board||!current())return;await this.host.validateBoard(board);if(!current())return;owner.study.board=board.path;}
  const note=owner.studyNote();let target=mode==='board'?entry.board||this.find(owner.study.boardLeaf):entry.notes||this.find(owner.study.noteLeaf);
  if(!this.matches(target,owner,mode))target=undefined;
  if(!target){
   const anchor=[entry.notes,entry.board,entry.anchor,this.find(owner.study.noteLeaf),this.find(owner.study.boardLeaf)].find(leaf=>leaf&&leaf!==owner.leaf&&leaf.view.containerEl.isConnected&&leaf.view.containerEl.ownerDocument===owner.contentEl.ownerDocument&&group(leaf)!==group(owner.leaf));
   entry.allocating=true;try{if(anchor){const before=new Set<WorkspaceLeaf>();this.app.workspace.iterateAllLeaves(leaf=>before.add(leaf));this.app.workspace.setActiveLeaf(anchor,{focus:false});target=this.app.workspace.getLeaf('tab');if(before.has(target)||target.parent!==anchor.parent||target.getViewState().type!=='empty'){throw Error('无法安全创建并排页，原页面保持不变');}}
   else target=this.app.workspace.createLeafBySplit(owner.leaf,owner.contentEl.ownerDocument.defaultView!.innerWidth<760?'horizontal':'vertical');entry.anchor=target;this.anchors.set(owner,target);}finally{entry.allocating=false;}
   if(target.view.containerEl.ownerDocument!==owner.contentEl.ownerDocument)throw Error('并排页不在当前窗口，已停止');
   const allocated=target,empty=allocated.view,state=JSON.stringify(allocated.getViewState());try{
    if(!current()){if(allocated.view===empty&&JSON.stringify(allocated.getViewState())===state)allocated.detach();return;}
    if(mode==='board')await allocated.setViewState({type:this.host.boardType,state:{file:board!.path},active:false});
    else if(note)await allocated.openFile(note,{active:false});
    else await allocated.setViewState({type:MEDIA_STUDY_EMPTY,state:{pair:source},active:false});
   }catch(error){if(allocated.view===empty&&JSON.stringify(allocated.getViewState())===state)allocated.detach();throw error;}
  }
  if(!current()||!this.matches(target,owner,mode))return;
  if(mode==='notes'){entry.notes=target;owner.study.noteLeaf=leafId(target);}else{entry.board=target;owner.study.boardLeaf=leafId(target);}
  entry.anchor=target;this.anchors.set(owner,target);const left=group(owner.leaf);if(left)this.documents.set(owner.contentEl.ownerDocument,{left,anchor:target});for(const other of this.entries.values())if(other!==entry&&group(other.owner.leaf)===left){other.observer?.disconnect();other.restore?.();other.observer=undefined;other.restore=undefined;}owner.study.mode=mode;owner.studyChanged();await this.app.workspace.revealLeaf(target);if(!current())return;this.layout(entry);this.app.workspace.setActiveLeaf(owner.leaf,{focus:false});
 }
 async sync(owner:MediaStudyOwner){const entry=this.entries.get(owner),note=owner.studyNote();if(!entry||!note||!this.current(owner))return;const target=entry.notes||this.find(owner.study.noteLeaf),state=target?.getViewState();if(!target||state?.type!==MEDIA_STUDY_EMPTY||state.state?.pair!==owner.study.id)return;await target.openFile(note,{active:false});if(this.current(owner)){entry.notes=target;owner.study.noteLeaf=leafId(target);owner.studyChanged();}}
 ratio(owner:MediaStudyOwner,value:number){owner.study.ratio=Math.max(38,Math.min(70,value));const entry=this.entries.get(owner);if(entry)this.layout(entry);owner.studyChanged();}
 private layout(entry:Entry){
  entry.observer?.disconnect();entry.restore?.();entry.observer=undefined;entry.restore=undefined;
  const left=group(entry.owner.leaf),right=group(entry.owner.study.mode==='board'?entry.board!:entry.notes!);if(!left||!right||left===right||left.parentElement!==right.parentElement)return;const parent=left.parentElement!;if(Array.from(parent.children).filter(el=>el.matches('.workspace-tabs,.workspace-split')).length!==2)return;
  const previousClasses=[left.classList.contains('ts-media-study-column'),right.classList.contains('ts-media-study-column'),parent.classList.contains('ts-media-study-stack')];const old=[left.style.flexGrow,left.style.flexBasis,right.style.flexGrow,right.style.flexBasis,parent.style.flexDirection];
  let lastNarrow:boolean|undefined,frame:number|undefined;const win=entry.owner.contentEl.ownerDocument.defaultView!;const apply=()=>{if(!this.current(entry.owner))return;const narrow=parent.clientWidth<760;if(lastNarrow===narrow)return;lastNarrow=narrow;parent.toggleClass('ts-media-study-stack',narrow);left.style.flexGrow=String(entry.owner.study.ratio);right.style.flexGrow=String(100-entry.owner.study.ratio);left.addClass('ts-media-study-column');right.addClass('ts-media-study-column');parent.style.flexDirection=narrow?'column':'row';};apply();entry.observer=new ResizeObserver(()=>{if(frame===undefined)frame=win.requestAnimationFrame(()=>{frame=undefined;apply();});});entry.observer.observe(parent);entry.restore=()=>{if(frame!==undefined)win.cancelAnimationFrame(frame);parent.toggleClass('ts-media-study-stack',previousClasses[2]);if(!previousClasses[0])left.removeClass('ts-media-study-column');if(!previousClasses[1])right.removeClass('ts-media-study-column');[left.style.flexGrow,left.style.flexBasis,right.style.flexGrow,right.style.flexBasis,parent.style.flexDirection]=old;};
 }
 empty(pair:string,root:HTMLElement){const owner=[...this.entries.keys()].find(o=>o.study.id===pair);themeSurface(root,{accent:this.host.accent()});applyWorkspaceDensity(root,this.host.density());root.createEl('h3',{text:'连续笔记'});root.createEl('p',{text:'保存第一条摘录后，在这里打开同一份 Markdown，继续写长文、查看截图和时间锚。'});const button=root.createEl('button',{text:'记下此刻',cls:'mod-cta'});setIcon(button.createSpan(),'bookmark-plus');button.onclick=()=>{if(owner&&this.current(owner))void owner.studyRecord();};}
 release(owner:MediaStudyOwner){const entry=this.entries.get(owner);if(!entry)return;entry.run++;entry.observer?.disconnect();entry.restore?.();this.entries.delete(owner);}
 dispose(){this.stopped=true;for(const owner of this.entries.keys())this.release(owner);}
}
export class MediaStudyEmptyView extends ItemView {
 private pair='';constructor(leaf:WorkspaceLeaf,private host:MediaStudyWorkspace){super(leaf);}
 getViewType(){return MEDIA_STUDY_EMPTY;}getDisplayText(){return '视频 · 连续笔记';}getIcon(){return 'notebook-pen';}
 getState(){return{pair:this.pair};}async setState(state:{pair?:string},result?:ViewStateResult){this.pair=state.pair||'';this.contentEl.empty();this.contentEl.addClass('ts-media-study-empty');this.host.empty(this.pair,this.contentEl);if(result)result.history=true;}
}
