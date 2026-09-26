import {type App,type Component,MarkdownRenderer,finishRenderMath} from 'obsidian';
import {PreviewRenderScope} from './preview-render-scope';
import {releaseEditorResource} from './editor-cleanup';
import {textExcerptPresentation} from './excerpt-sources';
import {fitTextNode} from './text-tools';
import {textFitsContent} from './text-sizing';
import {type Card,nodeMinimumHeight} from './model';

/** One bounded Markdown measurement for the active text draft; no file writes. */
export class InlineTextFit {
 private timer?:number;private revision=0;private pending?:Promise<void>;private pendingRevision=-1;private measured=-1;private value?:string;private disposed=false;private release?:()=>void;private sizeKey='';
 private readonly win:Window;
 constructor(private app:App,private preview:HTMLElement,private path:string,private node:()=>Card|undefined,private apply:(size:{width:number;height:number})=>void){
  this.win=preview.ownerDocument.defaultView||window;
 }
 schedule(value:string,appearanceChanged=false){
  if(this.disposed)return;
  // Fixed text uses the visible preview only; opting out also cancels any older fit.
  if(!textFitsContent(this.node())){this.value=undefined;this.revision++;if(this.timer!==undefined)this.win.clearTimeout(this.timer);this.timer=undefined;this.release?.();return;}
  if(!appearanceChanged&&this.value===value)return;this.value=value;this.revision++;if(this.timer!==undefined)this.win.clearTimeout(this.timer);this.timer=this.win.setTimeout(()=>{this.timer=undefined;void this.flush();},120);
 }
 async flush():Promise<void>{
  if(this.timer!==undefined){this.win.clearTimeout(this.timer);this.timer=undefined;}if(this.disposed||this.value===undefined)return;
  if(!textFitsContent(this.node())){this.value=undefined;this.revision++;this.release?.();return;}
  if(this.pending){if(this.pendingRevision!==this.revision)this.release?.();await this.pending;return this.flush();}if(this.measured===this.revision)return;
  const revision=this.revision;this.pendingRevision=revision;this.pending=this.measure(this.value,revision);try{await this.pending;}finally{this.pending=undefined;this.measured=revision;}
  if(!this.disposed&&revision!==this.revision)await this.flush();
 }
 private async measure(value:string,revision:number){
  let scope:Component|undefined,holder:HTMLElement|undefined,deadline:number|undefined,released=false,scopeReleased=false;
  // A settled measurement must release its cancellation listeners while the editor stays open.
  let cancel!:()=>void;const closed=new Promise<void>(resolve=>{cancel=resolve;});
  const releaseScope=()=>{if(scopeReleased)return;scopeReleased=true;if(deadline!==undefined)this.win.clearTimeout(deadline);releaseEditorResource('text measurement scope',()=>scope?.unload());};
  // Cancel obsolete drafts immediately; the one-shot scope also cleans native
  // registrations arriving after its renderer has exceeded this lifetime.
  const release=()=>{if(released)return;released=true;cancel();releaseScope();releaseEditorResource('text measurement surface',()=>holder?.remove());};this.release=release;
  try{
   const parent=this.preview.parentElement,current=this.node();if(this.disposed||!this.preview.isConnected||!parent||!current||!textFitsContent(current)||current.collapsed||current.locked)return;
   // Freeze the appearance before awaiting Obsidian; the live node may be replaced or mutated.
   const node={...current};
   const latestNode=()=>{
    const latest=this.node();
    if(this.disposed||revision!==this.revision||!this.preview.isConnected||this.preview.parentElement!==parent||!latest||latest.id!==node.id||!textFitsContent(latest)||latest.collapsed||latest.locked)return;
    if(['fontSize','fontFamily','textMaxWidth','borderWidth','autoSize','textAutoHeight','topic','textAlign'].some(key=>latest[key as keyof Card]!==node[key as keyof Card]))return;
    if((node.textAutoHeight===true||node.autoSize===false)&&latest.width!==node.width)return;
    return latest;
   };
   scope=new PreviewRenderScope();scope.load();holder=parent.createDiv('ts-inline-measure');const probe=this.preview.cloneNode(false) as HTMLElement;holder.appendChild(probe);
   const content=probe.createDiv('ts-text-markdown markdown-rendered');
   // Measurement is optional: a stalled third-party renderer must never block Save indefinitely.
   const budget=new Promise<never>((_,reject)=>{deadline=this.win.setTimeout(()=>{releaseScope();reject(new Error('Text measurement timed out'));},1000);});
   const render=MarkdownRenderer.render(this.app,textExcerptPresentation(value).body,content,this.path,scope);
   await Promise.race([render,closed,budget]);
   if(!latestNode())return;
   if(content.querySelector('.math')||content.querySelector('mjx-container'))await Promise.race([finishRenderMath(),closed,budget]);
   const latest=latestNode();if(!latest)return;
   probe.dataset.markdownStatus=probe.dataset.mathStatus='ready';const draft={...node,text:value};fitTextNode(draft,parent,probe);
   const key=`${node.id}:${draft.width}:${draft.height}`;
   if(Number.isFinite(draft.width)&&Number.isFinite(draft.height)&&draft.width>=80&&draft.height>=nodeMinimumHeight(draft.kind)&&(key!==this.sizeKey||latest.width!==draft.width||latest.height!==draft.height)){this.sizeKey=key;this.apply({width:draft.width,height:draft.height});}
  }catch{/* A failed optional preview must not prevent the draft from being saved. */}finally{release();if(this.release===release)this.release=undefined;}
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.revision++;if(this.timer!==undefined)this.win.clearTimeout(this.timer);this.timer=undefined;const release=this.release;this.release=undefined;releaseEditorResource('pending text measurement',release);}
}
