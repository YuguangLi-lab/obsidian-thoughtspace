import {App,Component,MarkdownRenderer} from 'obsidian';
import {releaseEditorResource} from './editor-cleanup';
import {excerptPresentation} from './excerpt-sources';
import {markdownPreview} from './rendering';
import {measureNoteCard} from './workspace-tools';
/** Only the active card measures draft Markdown; stale async renders never resize it. */
export class InlineCardFit {
 private timer?:number;private revision=0;private pending?:Promise<void>;private measured=-1;private value?:string;private disposed=false;private release?:()=>void;private sizeKey='';
 constructor(private app:App,private preview:HTMLElement,private path:string,private preferredWidth:number|undefined,private apply:(size:{width:number;height:number})=>void){}
 schedule(value:string,appearanceChanged=false){if(this.disposed||(!appearanceChanged&&this.value===value))return;this.value=value;this.revision++;if(this.timer)window.clearTimeout(this.timer);this.timer=window.setTimeout(()=>{this.timer=undefined;void this.flush();},120);}
 async flush():Promise<void>{
  if(this.timer){window.clearTimeout(this.timer);this.timer=undefined;}if(this.disposed||this.value===undefined)return;
  if(this.pending){await this.pending;return this.flush();}if(this.measured===this.revision)return;
  const revision=this.revision;this.pending=this.measure(this.value,revision);try{await this.pending;}finally{this.pending=undefined;this.measured=revision;}
  if(!this.disposed&&revision!==this.revision)await this.flush();
 }
 private async measure(value:string,revision:number){
  const parent=this.preview.parentElement;if(this.disposed||!parent)return;const scope=new Component();scope.load();const holder=parent.createDiv('ts-inline-measure'),probe=this.preview.cloneNode(false) as HTMLElement;holder.appendChild(probe);let released=false;const release=()=>{if(released)return;released=true;releaseEditorResource('measurement scope',()=>scope.unload());releaseEditorResource('measurement surface',()=>holder.remove());};this.release=release;
  try{await MarkdownRenderer.render(this.app,markdownPreview(excerptPresentation(value).body),probe,this.path,scope);
   probe.querySelectorAll('p').forEach(p=>{if(Array.from(p.childNodes).every(n=>n.nodeType===3?!n.textContent?.trim():n instanceof Element&&n.matches('a.tag')))p.remove();});
   if(!this.disposed&&revision===this.revision&&this.preview.isConnected){const size=measureNoteCard(probe,this.preferredWidth),key=`${size.width}:${size.height}`;if(Number.isFinite(size.width)&&Number.isFinite(size.height)&&size.width>=80&&size.height>=60&&key!==this.sizeKey){this.sizeKey=key;this.apply(size);}}
  }catch{/* Keep the last valid frame when a renderer cannot preview a draft. */}finally{release();if(this.release===release)this.release=undefined;}
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.revision++;if(this.timer!==undefined)window.clearTimeout(this.timer);this.timer=undefined;const release=this.release;this.release=undefined;releaseEditorResource('pending measurement',release);}
}
