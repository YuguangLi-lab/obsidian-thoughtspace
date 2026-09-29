import type {Card} from './model';
import {onlineVideo} from './online-video';

export function webUrl(value:unknown):string|undefined {
 if(typeof value!=='string')return;const input=value.trim();
 if(!input||input.length>8192||(/[\s\\<>]/.test(input)||Array.from(input).some(c=>c.charCodeAt(0)<32)))return;
 try{const url=new URL(input);if(['https:','http:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password)return url.href;}catch{/* Invalid links stay ordinary text. */}
}
export function webMarkdown(url:string,title?:string):string {
 const safe=webUrl(url);if(!safe)throw Error('请输入有效的 HTTP 或 HTTPS 网页链接');
 return `[${(title||new URL(safe).hostname).replace(/[\]\\[]/g,'\\$&').replace(/[\r\n]/g,' ')}](${safe.replace(/\(/g,'%28').replace(/\)/g,'%29')})`;
}
function webTitle(url:string){const video=onlineVideo(url);return video?`${video.label} · ${video.id}${video.page&&video.page>1?' · P'+video.page:''}`:new URL(url).hostname;}
/** Stored as readable Markdown too, so older builds preserve the source link. */
export function webCard(input:string,id:string,position:{x:number;y:number}):Card {
 const url=webUrl(input);if(!url)throw Error('请输入有效的 HTTP 或 HTTPS 网页链接');
 const title=webTitle(url);
 return {id,kind:'text',webUrl:url,title,text:webMarkdown(url,title),x:position.x-320,y:position.y-230,width:640,height:460,color:'blue',autoSize:false,transparent:true};
}
export function updateWebCard(node:Card,input:string):void {
 const url=webUrl(input);if(!url)throw Error('请输入有效的 HTTP 或 HTTPS 网页链接');
 if(!node.webUrl||node.kind!=='text'||node.locked)throw Error('网页卡片已变化或被锁定');
 const automatic=!node.title||node.title===new URL(node.webUrl).hostname||node.title===webTitle(node.webUrl);
 node.webUrl=url;if(automatic)node.title=webTitle(url);node.text=webMarkdown(url,node.title);
}

/** Only mounted webpage cards load previews; disposal releases the embedded page. */
export function renderWebCard(host:HTMLElement,node:Card,options:{open:()=>void;edit:()=>void;fold:()=>void;copy:()=>void;disabled:boolean;register:(dispose:()=>void)=>void;online?:{open:()=>void;mount:(host:HTMLElement)=>()=>void}}) {
 const url=webUrl(node.webUrl);if(!url)return;let disposed=false;host.addClass('ts-web-card');
 if(options.online)host.addClass('ts-web-card--online');
 const top=host.createDiv('ts-web-heading');top.createSpan({cls:'ts-web-domain',text:new URL(url).hostname,attr:{title:url}});
 const action=(parent:HTMLElement,title:string,label:string,run:()=>void)=>{const b=parent.createEl('button',{text:label,attr:{type:'button',title,'aria-label':title}});b.onclick=e=>{e.stopPropagation();if(!disposed&&host.isConnected)run();};b.onpointerdown=e=>e.stopPropagation();return b;};

 const body=host.createDiv('ts-web-summary');body.createEl('strong',{text:node.title||new URL(url).hostname});
 body.createSpan({cls:'ts-web-url',text:url,attr:{title:url}});
 const actions=top.createDiv('ts-web-actions');action(actions,'打开原网页','↗',options.open);
 let iframe:HTMLElement|undefined,releaseVideo:(()=>void)|undefined;
 const togglePreview=()=>{
  if(iframe){releaseVideo?.();releaseVideo=undefined;iframe.remove();iframe=undefined;body.hidden=false;preview.setText('预览');host.removeClass('is-previewing');return;}
  body.hidden=true;host.addClass('is-previewing');preview.setText('链接');
  if(options.online){iframe=host.createDiv('ts-online-preview');releaseVideo=options.online.mount(iframe);return;}
  iframe=host.createEl('iframe',{cls:'ts-web-preview',attr:{title:node.title||url,src:url,sandbox:'allow-scripts allow-forms allow-popups',referrerpolicy:'no-referrer',loading:'lazy'}});
 };
 const preview=action(actions,'在卡片内预览网页','预览',togglePreview);
 if(options.online)action(actions,'打开在线视频笔记','笔记',()=>{if(iframe)togglePreview();options.online!.open();});
 action(actions,'复制网页链接','⧉',options.copy);action(actions,'修改网页链接','修改',options.edit).disabled=options.disabled;
 action(actions,'折叠网页','⌃',options.fold).disabled=options.disabled;
 togglePreview();
 options.register(()=>{disposed=true;releaseVideo?.();releaseVideo=undefined;iframe?.remove();iframe=undefined;});
 host.ondblclick=e=>{if((e.target as Element).closest('button,iframe'))return;e.stopPropagation();options.open();};
}
