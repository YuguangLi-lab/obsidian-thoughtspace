import type {App,TFile} from 'obsidian';
import {beginCardInsertDrag,cancelCardInsertDrag,CARD_INSERT_MIME} from './card-insert';

const NOTE='text/x-thoughtspace-note';
export const DATABASE_NOTE_DRAG='application/x-thoughtspace-library-note';
const sources=new WeakMap<App,{token:string;file:TFile;path:string}>();
export function takeDatabaseNoteDrop(app:App,event:DragEvent){const source=sources.get(app);if(!source||source.token!==event.dataTransfer?.getData(DATABASE_NOTE_DRAG))return;sources.delete(app);return source.file.path===source.path&&app.vault.getAbstractFileByPath(source.path)===source.file?source.file:undefined;}
/** One source can be dropped as a board reference or through the editor chooser. */
export function beginDatabaseNoteDrag(app:App,event:DragEvent,file:TFile){
 if(!event.dataTransfer||file.extension!=='md'||app.vault.getAbstractFileByPath(file.path)!==file){event.preventDefault();return;}
 const token=crypto.randomUUID();sources.set(app,{token,file,path:file.path});event.dataTransfer.setData(DATABASE_NOTE_DRAG,token);event.dataTransfer.setData(NOTE,file.path);beginCardInsertDrag(app,event,file);event.dataTransfer.effectAllowed='copy';
}

/** Keep the drag source mounted while its own modal stops intercepting the canvas. */
export class DatabaseNoteDrag {
 private active=false;private disposed=false;private pendingDrop=false;private frame?:number;private finishTimer?:number;private restore?:()=>void;
 private document:Document;private win:Window;
 private token?:string;private editorToken?:string;
 constructor(private app:App,private container:HTMLElement,private accepted:()=>void){
  this.document=container.ownerDocument;this.win=this.document.defaultView!;
  container.addEventListener('dragstart',this.begin);
 }
 begin=(event:DragEvent)=>{
  if(this.disposed||event.defaultPrevented||!event.dataTransfer?.types.includes(NOTE))return;
  this.cancel();this.document=this.container.ownerDocument;this.win=this.document.defaultView!;this.active=true;
  this.token=event.dataTransfer.getData(DATABASE_NOTE_DRAG);this.editorToken=event.dataTransfer.getData(CARD_INSERT_MIME);
  this.document.addEventListener('drop',this.drop,true);this.document.addEventListener('dragend',this.end,true);this.document.addEventListener('keydown',this.key,true);this.win.addEventListener('blur',this.end);
  // Hiding/removing the source during dragstart cancels native HTML dragging.
  this.frame=this.win.requestAnimationFrame(()=>{
   this.frame=undefined;if(!this.active||this.disposed)return;
   const present=this.container.hasClass('ts-db-note-dragging');this.container.addClass('ts-db-note-dragging');
   this.restore=()=>{if(!present)this.container.removeClass('ts-db-note-dragging');};
  });
 };
 private drop=(event:DragEvent)=>{
  // Native event listeners can run microtasks between capture and target.
  // Inspect acceptance on the next task, after the real drop handler ran.
  const node=event.target as Node|null,target=node?.instanceOf(Element)?node:undefined;
  const destination=target?.closest('.ts-stage,.cm-editor,.ts-writing');
  this.pendingDrop=true;
  this.finishTimer=this.win.setTimeout(()=>{if(!this.active)return;const accepted=!!destination&&event.defaultPrevented;this.cancel();if(accepted&&!this.disposed)this.accepted();},0);
 };
 private end=()=>{if(!this.pendingDrop)this.cancel();};
 private key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopPropagation();this.cancel();}};
 cancel(){const was=this.active;this.active=false;this.pendingDrop=false;if(sources.get(this.app)?.token===this.token)sources.delete(this.app);if(this.editorToken)cancelCardInsertDrag(this.app,this.editorToken);this.token=undefined;this.editorToken=undefined;if(this.frame!==undefined)this.win.cancelAnimationFrame(this.frame);this.frame=undefined;this.win.clearTimeout(this.finishTimer);this.finishTimer=undefined;this.restore?.();this.restore=undefined;this.document.removeEventListener('drop',this.drop,true);this.document.removeEventListener('dragend',this.end,true);this.document.removeEventListener('keydown',this.key,true);this.win.removeEventListener('blur',this.end);return was;}
 dispose(){this.disposed=true;this.cancel();this.container.removeEventListener('dragstart',this.begin);}
}
