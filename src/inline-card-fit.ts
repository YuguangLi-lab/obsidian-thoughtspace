import {App,Component,MarkdownRenderer,finishRenderMath} from 'obsidian';
import {releaseEditorResource} from './editor-cleanup';
import {excerptPresentation} from './excerpt-sources';
import {markdownPreview} from './rendering';
import {measureNoteCard} from './workspace-tools';
/** One bounded measurement for the active card draft; stale renders never resize it. */
export class InlineCardFit {
 private timer?:number;private revision=0;private pending?:Promise<void>;private pendingRevision=-1;private measured=-1;private value?:string;private disposed=false;private release?:(deferScope?:boolean)=>void;private sizeKey='';
 private cached?:{body:string;context:string;parent:HTMLElement;size:{width:number;height:number}};
 private readonly win:Window;
 constructor(private app:App,private preview:HTMLElement,private path:string,private preferredWidth:number|undefined,private apply:(size:{width:number;height:number})=>void){
  this.win=preview.ownerDocument.defaultView||window;
 }
 schedule(value:string,appearanceChanged=false){if(this.disposed||(!appearanceChanged&&this.value===value))return;if(appearanceChanged)this.cached=undefined;this.value=value;this.revision++;if(this.timer!==undefined)this.win.clearTimeout(this.timer);this.timer=this.win.setTimeout(()=>{this.timer=undefined;void this.flush();},120);}
 async flush():Promise<void>{
  if(this.timer!==undefined){this.win.clearTimeout(this.timer);this.timer=undefined;}if(this.disposed||this.value===undefined)return;
  if(this.pending){if(this.pendingRevision!==this.revision)this.release?.(true);await this.pending;return this.flush();}if(this.measured===this.revision)return;
  const revision=this.revision;this.pendingRevision=revision;this.pending=this.measure(this.value,revision);try{await this.pending;}finally{this.pending=undefined;this.measured=revision;}
  if(!this.disposed&&revision!==this.revision)await this.flush();
 }
 /** Only one successful static preview is reusable, in this editor's live layout. */
 private context(sources:number){
  const style=this.win.getComputedStyle?.(this.preview),card=this.preview.closest?.<HTMLElement>('.ts-node'),frame=card&&this.win.getComputedStyle?.(card);
  const chrome=card?Array.from(card.children).filter(el=>el.matches('.ts-node-header,.ts-card-meta')).map(el=>{const style=this.win.getComputedStyle(el);return[(el as HTMLElement).offsetHeight,style.display,style.marginTop,style.marginBottom];}):[];
  return JSON.stringify([sources,this.preferredWidth,this.preview.offsetWidth,this.preview.className,this.preview.getAttribute?.('style'),card?.className,frame?.borderLeftWidth,frame?.borderRightWidth,frame?.borderTopWidth,frame?.borderBottomWidth,chrome,...(['fontFamily','fontSize','fontStyle','fontWeight','fontStretch','fontVariant','fontFeatureSettings','fontVariationSettings','lineHeight','letterSpacing','wordSpacing','textAlign','textTransform','direction','unicodeBidi','whiteSpace','wordBreak','overflowWrap','paddingTop','paddingRight','paddingBottom','paddingLeft'] as const).map(key=>style?.[key])]);
 }
 private async measure(value:string,revision:number){
  let scope:Component|undefined,holder:HTMLElement|undefined,deadline:number|undefined,released=false,scopeReleased=false,rendering=false;
  // Settle the per-measurement signal on success too; a lifetime signal retains every race.
  let cancel!:()=>void;const closed=new Promise<void>(resolve=>{cancel=resolve;});
  const releaseScope=()=>{if(scopeReleased)return;scopeReleased=true;if(deadline!==undefined)this.win.clearTimeout(deadline);releaseEditorResource('measurement scope',()=>scope?.unload());};
  // A cancelled renderer may still register native children. Keep its scope
  // alive until rendering settles, within the original (never extended) budget.
  const release=(deferScope=false)=>{if(released)return;released=true;cancel();if(!deferScope||!rendering)releaseScope();releaseEditorResource('measurement surface',()=>holder?.remove());};this.release=release;
  try{
   const parent=this.preview.parentElement;if(this.disposed||!this.preview.isConnected||!parent)return;
   const presentation=excerptPresentation(value),body=markdownPreview(presentation.body),sources=presentation.sources?.length||0;
   // Embeds, images, code, HTML, math and formatted/plugin output may change
   // independently of the source. Cache only ordinary paragraphs verified below.
   const plain=!/[\\`~$<>[\]#*_!|]/.test(body)&&!/^\s*(?:[-+]|\d+[.)])\s/m.test(body);
   const context=plain?this.context(sources):undefined,cached=this.cached;
   if(plain&&cached?.body===body&&cached.context===context&&cached.parent===parent){const key=`${cached.size.width}:${cached.size.height}`;if(key!==this.sizeKey){this.sizeKey=key;this.apply(cached.size);}return;}
   this.cached=undefined;
   scope=new Component();scope.load();holder=parent.createDiv('ts-inline-measure');const probe=this.preview.cloneNode(false) as HTMLElement;holder.appendChild(probe);
   // Optional sizing must yield to a newer draft even if a third-party renderer never settles.
   const budget=new Promise<never>((_,reject)=>{deadline=this.win.setTimeout(()=>{releaseScope();reject(new Error('Card measurement timed out'));},1000);});
   const render=MarkdownRenderer.render(this.app,body,probe,this.path,scope);rendering=true;
   const rendered=()=>{rendering=false;if(released)releaseScope();};void render.then(rendered,rendered);
   await Promise.race([render,closed,budget]);
   if(this.disposed||revision!==this.revision)return;
   if(probe.querySelector('.math'))await Promise.race([finishRenderMath(),closed,budget]);
   if(this.disposed||revision!==this.revision||!this.preview.isConnected||this.preview.parentElement!==parent||plain&&context!==this.context(sources))return;
   probe.querySelectorAll('p').forEach(p=>{if(Array.from(p.childNodes).every(n=>n.nodeType===3?!n.textContent?.trim():n.instanceOf(Element)&&n.matches('a.tag')))p.remove();});
   const size=measureNoteCard(probe,this.preferredWidth),key=`${size.width}:${size.height}`;if(Number.isFinite(size.width)&&Number.isFinite(size.height)&&size.width>=80&&size.height>=60){
    if(key!==this.sizeKey){this.sizeKey=key;this.apply(size);}
    // Native plain paragraphs carry dir="auto"; other attributes can identify
    // styled or plugin-owned content whose dimensions are not safe to reuse.
    if(context!==undefined&&!this.disposed&&revision===this.revision&&context===this.context(sources)&&Array.from(probe.querySelectorAll('*')).every(el=>['P','BR'].includes(el.tagName)&&Array.from(el.attributes||[]).every(attr=>el.tagName==='P'&&attr.name==='dir'&&attr.value==='auto'))&&(probe.textContent||'').replace(/\s/g,'')===body.replace(/\s/g,''))this.cached={body,context,parent,size};
   }
  }catch{/* Keep the last valid frame when a renderer cannot preview a draft. */}finally{release();if(this.release===release)this.release=undefined;}
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.cached=undefined;this.revision++;if(this.timer!==undefined)this.win.clearTimeout(this.timer);this.timer=undefined;const release=this.release;this.release=undefined;releaseEditorResource('pending measurement',release);}
}
