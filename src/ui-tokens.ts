import {applyWorkspaceDensity} from './workspace-density';
import {interfaceStyleRules} from './interface-style-tokens';
import type {InterfaceStyle} from './workspace';
import {createLiquidGlassRuntime,type LiquidGlassRuntime} from './liquid-glass-runtime';

export type InterfaceStyleAppearance={interfaceStyle?:InterfaceStyle;glassEffects?:boolean};
const resolvedAppearance=(appearance:InterfaceStyleAppearance)=>({interfaceStyle:appearance.interfaceStyle??'paper',glassEffects:appearance.glassEffects??true});

function updateTokens(el:HTMLStyleElement,appearance:InterfaceStyleAppearance){
 const {interfaceStyle,glassEffects}=resolvedAppearance(appearance);
 const scale=['var(--ts-e-sheet)','var(--ts-e-paper)','var(--ts-e-wash)','var(--ts-e-wash)','var(--ts-e-line)','var(--ts-e-line)','var(--ts-e-edge)','var(--ts-e-edge)','var(--ts-e-editorial)','var(--ts-e-editorial)','var(--ts-e-muted)','var(--ts-e-ink)'];
 el.textContent=`:is(.ts-root,.ts-journal,.ts-settings,.ts-space-modal,.ts-ui-modal,.ts-native-header,.ts-writing,.ts-note-markdown-toolbar,.ts-media-workspace,.ts-online-workspace,.ts-materials-panel,.ts-materials-modal):not(:where(.ts-calendar-plugin, .ts-calendar-plugin *)){${scale.map((value,index)=>`--ts-ui-${index+1}:${value};`).join('')}}\n${interfaceStyleRules(interfaceStyle,glassEffects)}`;
 el.dataset.interfaceStyle=interfaceStyle;el.dataset.glassEffects=String(glassEffects);
}

/** Private chrome scale, shared by detached plugin windows as well as leaves.
 * Authored paper, cards, Markdown and native editor variables remain independent. */
export function designTokens(doc:Document,appearance:InterfaceStyleAppearance={}){
 const el=doc.createElement('style');el.dataset.thoughtspaceTokens='true';
 updateTokens(el,appearance);
 doc.head.appendChild(el);return el;
}

/** One scoped sheet per host document, including windows with only a dialog or editor.
 * Updates operate on sheets, never on the potentially large card/document trees. */
export class InterfaceStyleDocuments {
 private sheets=new Map<Document,HTMLStyleElement>();
 private optics=new Map<Document,LiquidGlassRuntime>();
 private appearance:ReturnType<typeof resolvedAppearance>;
 private stopped=false;
 constructor(appearance:InterfaceStyleAppearance={}){this.appearance=resolvedAppearance(appearance);}
 register(doc:Document):HTMLStyleElement|undefined{
  if(this.stopped||doc.defaultView?.closed)return;
  const existing=this.sheets.get(doc);if(existing)return existing;
  const sheet=designTokens(doc,this.appearance);this.sheets.set(doc,sheet);this.syncOptics(doc);return sheet;
 }
 update(appearance:InterfaceStyleAppearance):void{
  if(this.stopped)return;
  const next=resolvedAppearance(appearance);
  if(next.interfaceStyle===this.appearance.interfaceStyle&&next.glassEffects===this.appearance.glassEffects)return;
  this.appearance=next;
  for(const [doc,sheet]of this.sheets){if(doc.defaultView?.closed)this.release(doc);else{updateTokens(sheet,next);this.syncOptics(doc);}}
 }
 private syncOptics(doc:Document){
  if(this.appearance.interfaceStyle==='glass'&&this.appearance.glassEffects){if(!this.optics.has(doc))this.optics.set(doc,createLiquidGlassRuntime(doc));}
  else{this.optics.get(doc)?.dispose();this.optics.delete(doc);}
 }
 release(doc:Document):void{this.optics.get(doc)?.dispose();this.optics.delete(doc);this.sheets.get(doc)?.remove();this.sheets.delete(doc);}
 dispose():void{this.stopped=true;for(const doc of this.sheets.keys())this.release(doc);}
}

/** Opt in only menus created by this plugin. Native OS menus have no themed DOM. */
export function themePluginMenu<T extends object>(menu:T):T{
 const dom=(menu as {dom?:HTMLElement}).dom;
 if(!dom?.classList)return menu;
 dom.classList.add('ts-ui-menu');
 const source=dom.ownerDocument.querySelector<HTMLElement>('.workspace-leaf.mod-active .ts-root')||dom.ownerDocument.querySelector<HTMLElement>('.ts-root');
 applyWorkspaceDensity(dom,source?.dataset.density);dom.dataset.accent=source?.dataset.accent||'forest';
 return menu;
}

/** Carry the active workspace's appearance into plugin-owned dialogs only. */
export function themeSurface(el:HTMLElement,appearance?:{accent?:string;glassEffects?:boolean}) {
  const source=el.ownerDocument.querySelector<HTMLElement>('.workspace-leaf.mod-active .ts-root')||el.ownerDocument.querySelector<HTMLElement>('.ts-root');
  applyWorkspaceDensity(el,source?.dataset.density);el.addClass('ts-ui-modal');el.dataset.surface=source?.dataset.surface||'soft';el.dataset.accent=appearance?.accent||source?.dataset.accent||'forest';el.dataset.glass=String(appearance?.glassEffects??(source?.dataset.glass!=='false'));
}
