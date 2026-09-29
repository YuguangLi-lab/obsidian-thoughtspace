import {Component,MarkdownRenderer,type App} from 'obsidian';
import {onlineVideo} from './online-video';
import {parseOnlineSource} from './online-platform';
/** Native YouTube rendering retains Obsidian's provider identity handling. */
export function mountOnlinePreview(app:App,host:HTMLElement,url:string,path:string,parent:Component):()=>void {
 const video=onlineVideo(url),scope=new Component();parent.addChild(scope);let closed=false;
 const dispose=()=>{if(closed)return;closed=true;parent.removeChild(scope);host.empty();};
 if(video?.provider==='youtube'){
  void MarkdownRenderer.render(app,`![](${video.url})`,host,path,scope).then(()=>{if(closed){scope.unload();host.empty();}}).catch(()=>{if(!closed){host.empty();host.createSpan({text:'预览未载入，可点击“播放”进入内置播放器。'});}});
 }else if(video?.provider==='bilibili')host.createEl('iframe',{cls:'ts-online-preview__frame',attr:{title:video.label,src:video.embedUrl,sandbox:'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation',allow:'fullscreen; picture-in-picture',allowfullscreen:'',referrerpolicy:'strict-origin-when-cross-origin',loading:'lazy'}});
 else host.createSpan({text:parseOnlineSource(url)?.name||'在线视频'});
 return dispose;
}
