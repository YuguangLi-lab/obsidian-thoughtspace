/**
 * Independently implemented player-only presentation, informed by the MIT
 * Media Extended v3 web-fullscreen approach. No ad, player-control or consent
 * content is removed. Serialized into the isolated official guest: keep every
 * helper and constant inside this function.
 */
export function onlinePlayerSurface(provider:string,expectedSource:string,action:'install'|'dispose'='install'):{applied:boolean;ready?:boolean;reason?:string} {
 const key=Symbol.for('thoughtspace.online.player-surface');
 const version=5;
 const scope=window as unknown as {[key:symbol]:{source:string;version?:number;dispose:()=>void;ready:()=>boolean}|undefined};
 const previous=scope[key];
 if(action==='dispose'){if(previous?.source===expectedSource)previous.dispose();return{applied:false};}
 const identity=(input:string):string|undefined=>{
  try{
   const url=new URL(input);if(url.protocol!=='https:'||url.username||url.password||url.port)return;
   if(provider==='bilibili'&&['www.bilibili.com','bilibili.com'].includes(url.hostname)){
    const id=url.pathname.match(/^\/video\/(BV[A-Za-z\d]{10}|av\d+)\/?$/)?.[1],parts=url.searchParams.getAll('p');
    if(!id||parts.length>1||parts.length===1&&!/^[1-9]\d*$/.test(parts[0]))return;
    return`${id}:${parts[0]??'1'}`;
   }
   if(provider==='youtube'&&['www.youtube.com','youtube.com'].includes(url.hostname)&&url.pathname==='/watch'){
    const ids=url.searchParams.getAll('v');if(ids.length===1&&/^[A-Za-z\d_-]{11}$/.test(ids[0]))return ids[0];
   }
  }catch{/* A login or noncanonical page never receives a player layout. */}
 };
 const expected=identity(expectedSource);
 if(!expected||identity(location.href)!==expected||window.frameElement)return{applied:false,reason:'not-playback-page'};
 if(previous?.source===expectedSource&&previous.version===version)return{applied:true,ready:previous.ready()};
 previous?.dispose();
 const playerAttribute='data-thoughtspace-player',parentAttribute='data-thoughtspace-player-parent',rootAttribute='data-thoughtspace-player-surface';
 let disposed=false,timer:number|undefined,expiry:number|undefined,found=false;
 let player:HTMLElement|undefined,parents:HTMLElement[]=[],style:CSSStyleSheet|undefined;
 let dialogStyle:CSSStyleSheet|undefined,dialogSignature='';
 let dialogs:HTMLElement[]=[],dialogContents:HTMLElement[]=[];
 let requestedWebscreen:HTMLElement|undefined;
 const attempted=new WeakSet<HTMLElement>();
 const miniAttempted=new WeakSet<HTMLElement>();
 const removeSheet=(sheet:CSSStyleSheet|undefined)=>{if(sheet)document.adoptedStyleSheets=document.adoptedStyleSheets.filter(item=>item!==sheet);};
 const createSheet=()=>{const sheet=new CSSStyleSheet();document.adoptedStyleSheets=[...document.adoptedStyleSheets,sheet];return sheet;};
 const visible=(element:Element)=>{
  const rect=element.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return false;
  for(let parent:Element|null=element,depth=0;parent&&depth<32;parent=parent.parentElement,depth++){
   const css=getComputedStyle(parent);if(css.display==='none'||css.visibility==='hidden'||css.visibility==='collapse'||css.opacity!==''&&Number(css.opacity)<=.05)return false;
  }
  return true;
 };
 const clearDialogs=()=>{
  for(const dialog of dialogs)dialog.removeAttribute('data-thoughtspace-dialog');for(const content of dialogContents)content.removeAttribute('data-thoughtspace-dialog-content');
  dialogs=[];dialogContents=[];removeSheet(dialogStyle);dialogStyle=undefined;dialogSignature='';
 };
 const fitDialogs=()=>{
  const current=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],[aria-modal="true"],dialog[open],ytd-consent-bump-v2-lightbox,.bili-mini-mask,.bili-mini-login,.bpx-player-login-wrap')).filter(visible);
  const contents:HTMLElement[]=[],rules:string[]=[];
  for(const dialog of current){
   const mask=dialog.classList.contains('bili-mini-mask');dialog.setAttribute('data-thoughtspace-dialog',mask?'mask':'dialog');
   const content=mask?dialog.querySelector<HTMLElement>('.bili-mini-content-wp'):null;
   if(content){
    const width=content.offsetWidth||content.getBoundingClientRect().width,height=content.offsetHeight||content.getBoundingClientRect().height;
    const scale=Math.min(1,Math.max(1,innerWidth-16)/width,Math.max(1,innerHeight-16)/height);
    if(Number.isFinite(scale)&&scale>0){content.setAttribute('data-thoughtspace-dialog-content','');contents.push(content);rules.push(`[data-thoughtspace-dialog-content]{flex-shrink:0!important;transform:scale(${scale})!important;transform-origin:center!important;max-width:none!important;max-height:none!important}`);}
   }
  }
  for(const dialog of dialogs)if(!current.includes(dialog))dialog.removeAttribute('data-thoughtspace-dialog');for(const content of dialogContents)if(!contents.includes(content))content.removeAttribute('data-thoughtspace-dialog-content');
  dialogs=current;dialogContents=contents;
  if(!current.length){clearDialogs();return;}
  const waitingBackdrop=player?.isConnected?'':"html::before{content:'';position:fixed;inset:0;background:#000;z-index:2147483646;pointer-events:none}";
  const css=`${waitingBackdrop}[data-thoughtspace-dialog]{position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;max-width:calc(100vw - 16px)!important;max-height:calc(100vh - 16px)!important;overflow:auto!important;box-sizing:border-box!important;z-index:2147483647!important}[data-thoughtspace-dialog="mask"]{inset:0!important;transform:none!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;display:flex!important;align-items:center!important;justify-content:center!important}${rules.join('')}`;
  if(dialogSignature===css)return;dialogSignature=css;
  if(!dialogStyle)dialogStyle=createSheet();
  dialogStyle.replaceSync(css);
 };
 const webscreen=(element:HTMLElement)=>{
  const screen=element.querySelector('.bpx-player-container')?.getAttribute('data-screen');
  // The outer wrapper can fill the viewport while Bilibili's real player is
  // still a 320 x 180 floating mini-player. Its own mode is authoritative.
  if(screen)return screen==='web'||screen==='full';
  const rect=element.getBoundingClientRect();
  return element.classList.contains('mode-webscreen')||!!element.querySelector('.mode-webscreen')||Math.abs(rect.left)<=2&&Math.abs(rect.top)<=2&&Math.abs(rect.width-innerWidth)<=3&&Math.abs(rect.height-innerHeight)<=3;
 };
 const clearLayout=()=>{
  player?.removeAttribute(playerAttribute);for(const parent of parents)parent.removeAttribute(parentAttribute);parents=[];
  document.documentElement.removeAttribute(rootAttribute);removeSheet(style);style=undefined;player=undefined;
 };
 const leaveWebscreen=()=>{
  const owned=requestedWebscreen;requestedWebscreen=undefined;
  if(owned)attempted.delete(owned);
  if(owned?.isConnected&&webscreen(owned))owned.querySelector<HTMLElement>('.bpx-player-ctrl-web')?.click();
 };
 const dispose=()=>{
  if(disposed)return;disposed=true;observer.disconnect();if(timer!==undefined)window.clearTimeout(timer);if(expiry!==undefined)window.clearTimeout(expiry);
  clearLayout();clearDialogs();if(identity(location.href)===expected)leaveWebscreen();window.removeEventListener('pagehide',dispose);window.removeEventListener('popstate',schedule);window.removeEventListener('resize',schedule);
  if(scope[key]?.dispose===dispose)delete scope[key];
 };
 const apply=()=>{
  timer=undefined;if(disposed)return;
  if(identity(location.href)!==expected){dispose();return;}
  fitDialogs();
  const target=document.querySelector<HTMLElement>(provider==='bilibili'?'#bilibili-player':'#movie_player');
  if(!target||!target.querySelector('video')){if(player&&!player.isConnected)clearLayout();return;}
  found=true;if(expiry!==undefined){window.clearTimeout(expiry);expiry=undefined;}
  if(provider==='bilibili'){
   const mini=target.querySelector('.bpx-player-container')?.getAttribute('data-screen')==='mini';
   if(!webscreen(target)&&(!attempted.has(target)||mini&&!miniAttempted.has(target))){
    const button=target.querySelector<HTMLElement>('.bpx-player-ctrl-web');
    if(button){attempted.add(target);if(mini)miniAttempted.add(target);requestedWebscreen=target;button.click();}
   }
  }
  if(player===target)return;
  clearLayout();player=target;target.setAttribute(playerAttribute,'');
  for(let parent=target.parentElement,depth=0;parent&&parent!==document.body&&depth<24;parent=parent.parentElement,depth++){parent.setAttribute(parentAttribute,'');parents.push(parent);}
  document.documentElement.setAttribute(rootAttribute,'');
  // Obsidian's styles.css cannot reach the isolated guest. Own and remove only
  // this constructable sheet; preserve all of the platform's original sheets.
  style=createSheet();
  const chrome=provider==='bilibili'?'.bili-header,#bili-header-container,.video-info-container,.right-container,#comment,.video-toolbar-container,#mirror-vdcon > .fixed-sidenav-storage':'#masthead-container,#secondary,#below,#comments';
  const internal=provider==='bilibili'?`[${playerAttribute}] .bpx-player-container{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;transform:none!important;border-radius:0!important}`:`[${playerAttribute}] .html5-video-container{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important}[${playerAttribute}] .html5-video-container video{left:0!important;top:0!important}`;
  style.replaceSync(`html[${rootAttribute}],html[${rootAttribute}] body{overflow:hidden!important;background:#000!important} [${parentAttribute}]{overflow:visible!important;transform:none!important;perspective:none!important;contain:none!important;z-index:auto!important} [${playerAttribute}]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;transform:none!important;z-index:1000!important;background:#000!important} ${internal} [${playerAttribute}] video{width:100%!important;height:100%!important;object-fit:contain!important}html[${rootAttribute}] :is(${chrome}){display:none!important}`);
  window.dispatchEvent(new Event('resize'));
 };
 function schedule(){if(!disposed&&timer===undefined)timer=window.setTimeout(apply,150);}
 const observer=new MutationObserver(schedule);
 const ready=()=>{
  if(disposed)return false;
  if(dialogs.length)return true;
  if(!player?.isConnected)return false;
  const visiblePlayer=provider==='bilibili'?player.querySelector('.bpx-player-container')??player:player;
  const video=player.querySelector('video');if(!video)return false;
  return [visiblePlayer,video].every(element=>{const rect=element.getBoundingClientRect();return Math.abs(rect.left)<=2&&Math.abs(rect.top)<=2&&Math.abs(rect.width-innerWidth)<=3&&Math.abs(rect.height-innerHeight)<=3;});
 };
 scope[key]={source:expectedSource,version,dispose,ready};
 observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','open','aria-hidden','role','aria-modal','type','data-screen']});
 window.addEventListener('pagehide',dispose,{once:true});window.addEventListener('popstate',schedule);window.addEventListener('resize',schedule);
 // A single throttled observer and a bounded initial discovery period. Once a
 // player exists it remains responsible for restoring future consent dialogs.
 expiry=window.setTimeout(()=>{if(!found)dispose();},30000);
 apply();return{applied:true,ready:ready()};
}
