import {applyWorkspaceDensity} from './workspace-density';

/** Private chrome scale, shared by detached plugin windows as well as leaves.
 * Authored paper, cards, Markdown and native editor variables remain independent. */
export function designTokens(doc:Document){
 const el=doc.createElement('style');el.dataset.thoughtspaceTokens='true';
 const scale=['var(--ts-e-sheet)','var(--ts-e-paper)','var(--ts-e-wash)','var(--ts-e-wash)','var(--ts-e-line)','var(--ts-e-line)','var(--ts-e-edge)','var(--ts-e-edge)','var(--ts-e-editorial)','var(--ts-e-editorial)','var(--ts-e-muted)','var(--ts-e-ink)'];
 el.textContent=`:is(.ts-root,.ts-journal,.ts-settings,.ts-space-modal,.ts-ui-modal,.ts-native-header,.ts-writing,.ts-note-markdown-toolbar,.ts-media-workspace,.ts-online-workspace,.ts-materials-panel,.ts-materials-modal):not(:where(.ts-calendar-plugin, .ts-calendar-plugin *)){${scale.map((value,index)=>`--ts-ui-${index+1}:${value};`).join('')}}`;
 doc.head.appendChild(el);return el;
}

/** Carry the active workspace's appearance into plugin-owned dialogs only. */
export function themeSurface(el:HTMLElement,appearance?:{accent?:string;glassEffects?:boolean}) {
  const source=el.ownerDocument.querySelector<HTMLElement>('.workspace-leaf.mod-active .ts-root')||el.ownerDocument.querySelector<HTMLElement>('.ts-root');
  applyWorkspaceDensity(el,source?.dataset.density);el.addClass('ts-ui-modal');el.dataset.surface=source?.dataset.surface||'soft';el.dataset.accent=appearance?.accent||source?.dataset.accent||'forest';el.dataset.glass=String(appearance?.glassEffects??(source?.dataset.glass!=='false'));
}
