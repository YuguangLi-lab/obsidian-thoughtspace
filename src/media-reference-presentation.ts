import type {App} from 'obsidian';
import {hasAsciiControl} from './value-guards';
import {parseMediaPlayerUrl} from './media-notes';
import {parseOnlinePlayerUrl} from './online-media-notes';
import {mediaClock,parseMediaSourceUrl} from './media-source';
import {parseOnlineSource} from './online-platform';

/** Reuse the protocol validators; labels never supply playback identity or time. */
export function mediaTimestampPresentation(href:string):{time:number;label:string;note?:string}|undefined {
 const local=parseMediaSourceUrl(href)||parseMediaPlayerUrl(href);
 if(local)return{time:local.time,label:local.file.split('/').at(-1)!};
 const online=parseOnlinePlayerUrl(href);
 if(online)return{time:online.time,label:parseOnlineSource(online.source)!.name,...(online.note?{note:online.note}:{})};
}
function noteTarget(value:string):boolean{return !!value.trim()&&!hasAsciiControl(value)&&!value.includes('\u007f')&&!/^[a-z][a-z\d+.-]*:|^\/|\\|(?:^|\/)\.{1,2}(?:\/|$)/i.test(value)&&/\.md$/i.test(value);}

/** Native block-embed provenance, never reconstructed from displayed prose. */
export function mediaReferenceTarget(value:string):{target:string;label:string}|undefined {
 const match=/^([^\r\n#]+)#\^thoughtspace-(?:media|online)-[a-z\d_-]+$/i.exec(value);
 if(!match||hasAsciiControl(value)||value.includes('\u007f')||/^[a-z][a-z\d+.-]*:|^\/|\\|(?:^|\/)\.{1,2}(?:\/|$)/i.test(match[1]))return;
 const label=match[1].split('/').at(-1)!.replace(/\.md$/i,'');
 return label.trim()?{target:value,label}:undefined;
}

/** Decorate the existing native embed; links, Markdown and image nodes survive.
 * Native embeds refresh asynchronously, so observe this preview alone and stop
 * with its renderer scope. No vault reads, writes or board mutations occur.
 */
export function mountMediaReferencePresentation(root:HTMLElement,app:App,sourcePath:string,register:(dispose:()=>void)=>void):void {
 // Generated board captures end in a standalone media backlink. Do not turn
 // inline links or documents containing several timestamps into a single card.
 const candidates=Array.from(root.querySelectorAll<HTMLAnchorElement>(':scope > p > a[href]')).filter(link=>mediaTimestampPresentation(link.getAttribute('href')||'')&&link.parentElement?.children.length===1&&link.parentElement.textContent?.trim()===link.textContent?.trim());
 const direct=candidates.length===1?candidates[0]:undefined;
 const embedded=!!root.closest('.is-media-reference');
 if(!embedded&&!direct)return;
 const node=root.closest('.ts-node'),ownsClass=!!node&&!node.classList.contains('is-media-reference');
 node?.classList.add('is-media-reference');
 let disposed=false;
 const decorateTime=(timestamp:HTMLAnchorElement)=>{
  const info=mediaTimestampPresentation(timestamp.getAttribute('href')||'');if(!info)return;
  const text=mediaClock(info.time);if(timestamp.textContent!==text)timestamp.textContent=text;
  timestamp.classList.add('ts-media-reference-time');timestamp.title=`回到媒体 ${text}`;timestamp.setAttribute('aria-label',timestamp.title);
 };
 if(direct){
  const info=mediaTimestampPresentation(direct.getAttribute('href')||'')!,paragraph=direct.parentElement!;
  const header=root.createDiv({cls:'ts-media-reference-header'});root.prepend(header);header.appendChild(direct);paragraph.remove();decorateTime(direct);
  root.classList.add('ts-media-excerpt-content');
  const note=noteTarget(sourcePath)?sourcePath:info.note,label=note?note.split('/').at(-1)!.replace(/\.md$/i,''):info.label;
  const link=header.createEl('a',{cls:'ts-media-reference-source'+(note?' internal-link':'')});link.textContent=label;link.setAttribute('href',note||direct.getAttribute('href')!);
  if(note)link.dataset.referenceTarget=note;
  link.title=note?`打开来源笔记：${label}`:`回到媒体：${label}`;link.setAttribute('aria-label',link.title);
 }
 const decorate=()=>{
  if(disposed)return;
  for(const embed of Array.from(root.querySelectorAll<HTMLElement>(':scope > p > .markdown-embed[src], :scope > .markdown-embed[src]'))){
   const source=mediaReferenceTarget(embed.getAttribute('src')||'');if(!source)continue;
   const title=embed.querySelector<HTMLElement>('.markdown-preview-view > .callout > .callout-title');if(!title)continue;
   const timestamp=title.querySelector<HTMLAnchorElement>('.callout-title-inner a[href]');
   const href=timestamp?.getAttribute('href')||'';
   if(!timestamp||!mediaTimestampPresentation(href))continue;
   title.classList.add('ts-media-reference-header');embed.querySelector('.callout-content')?.classList.add('ts-media-excerpt-content');decorateTime(timestamp);
   let link=title.querySelector<HTMLAnchorElement>(':scope > .ts-media-reference-source');
   if(!link)link=title.createEl('a',{cls:'ts-media-reference-source internal-link'});
   // Avoid observing our own unchanged text replacement on each mutation batch.
   if(link.textContent!==source.label)link.textContent=source.label;
   link.setAttribute('href',source.target);link.dataset.referenceTarget=source.target;
   link.title=`打开来源笔记：${source.label}`;link.setAttribute('aria-label',link.title);
  }
 };
 const sourceLink=(event:Event)=>{
  const target=event.target as Element|null,link=target?.closest?.('a.ts-media-reference-source') as HTMLAnchorElement|null;
  return link&&root.contains(link)?link:undefined;
 };
 const pointer=(event:Event)=>{if(sourceLink(event))event.stopPropagation();};
 const click=(event:Event)=>{
  const link=sourceLink(event);if(disposed||!link)return;
  const target=link.dataset.referenceTarget||'',source=mediaReferenceTarget(target)||(noteTarget(target)?{target}:undefined);if(!source)return;
  event.preventDefault();event.stopPropagation();void app.workspace.openLinkText(source.target,sourcePath,'tab').catch(()=>{if(!disposed){link.title='来源笔记暂时无法打开，请检查原笔记是否仍然存在';link.setAttribute('aria-label',link.title);}});
 };
 root.addEventListener('pointerdown',pointer);root.addEventListener('click',click);
 const observer=embedded?new MutationObserver(decorate):undefined;observer?.observe(root,{subtree:true,childList:true});if(embedded)decorate();
 register(()=>{disposed=true;observer?.disconnect();if(ownsClass)node?.classList.remove('is-media-reference');root.removeEventListener('pointerdown',pointer);root.removeEventListener('click',click);});
}
