import {setIcon} from 'obsidian';
import {OnlinePlatform,parseOnlineSource,type OnlineState} from './online-platform';
import {mediaClock} from './media-source';
import {uid} from './model';

export interface OnlineBoardMoment {id:string;time:number;text:string;image?:Blob}
export interface OnlineBoardPlayerHandle {dispose():void;pause():void;seek(time:number):Promise<void>}
type Platform=Pick<OnlinePlatform,'mount'|'open'|'command'|'position'|'capture'|'dispose'>;
interface Options {
 alive:()=>boolean;
 disabled?:boolean;
 initialTime?:number;
 onState?:(state:OnlineState)=>void;
 onPlay?:()=>void;
 onCapture:(moment:OnlineBoardMoment)=>Promise<unknown>;
 createPlatform?:(notify:(state:OnlineState)=>void)=>Platform;
}

/** Each mounted card owns its guest; workspace navigation never borrows it. */
export function mountOnlineBoardPlayer(host:HTMLElement,url:string,options:Options):OnlineBoardPlayerHandle {
 const source=parseOnlineSource(url);if(!source)throw Error('在线视频来源无效');
 const path=source.path;
 let disposed=false,opened=false,busy=false,playing=false,revision=0,state:OnlineState|undefined,pending:OnlineBoardMoment|undefined,message='';
 let resumeTime=options.initialTime??source.initialTime??0;
 const live=()=>!disposed&&host.isConnected&&options.alive();
 const verified=()=>!!state&&state.sourcePath===path&&state.available&&!state.closed&&!state.candidate;
 const root=host.createDiv('ts-online-board-player'),surface=root.createDiv('ts-online-board-player__surface');
 const empty=surface.createDiv({cls:'ts-online-board-player__empty',text:'尚未加载视频'});
 const footer=root.createDiv('ts-online-board-player__footer'),actions=footer.createDiv('ts-online-board-player__actions');
 const action=(label:string,icon:string,run:()=>Promise<unknown>|void)=>{
  const button=actions.createEl('button',{cls:'ts-online-board-player__action',attr:{type:'button',title:label,'aria-label':label}});
  const symbol=button.createSpan('ts-online-board-player__icon');setIcon(symbol,icon);
  const text=button.createSpan({cls:'ts-online-board-player__label',text:label});
  const failed=(error:unknown)=>{if(live()){message=error instanceof Error?error.message:'操作未完成，请重试';paint();}};
  button.onclick=event=>{event.stopPropagation();if(button.disabled||!live())return;try{void Promise.resolve(run()).catch(failed);}catch(error){failed(error);}};
  button.onpointerdown=event=>event.stopPropagation();button.ondblclick=event=>event.stopPropagation();
  return {button,symbol,text,set(label:string,icon:string){button.setAttribute('title',label);button.setAttribute('aria-label',label);text.setText(label);setIcon(symbol,icon);}};
 };
 const load=action('加载视频','play',async()=>{
  message='';
  if(!opened||state?.closed||state?.candidate||state?.sourcePath&&state.sourcePath!==path){open(resumeTime);return;}
  await platform.command(path,verified()?'toggle':'reload');
 });
 const timestamp=action('记下此刻','bookmark-plus',()=>acquire(false));
 const screenshot=action('截取画面','camera',()=>acquire(true));
 const retry=action('重试保存','rotate-cw',()=>save());retry.button.hidden=true;
 const clock=footer.createSpan({cls:'ts-online-board-player__clock',text:'时间未同步'});
 const status=root.createDiv({cls:'ts-online-board-player__status',attr:{role:'status','aria-live':'polite'}});
 const platform=(options.createPlatform??(notify=>new OnlinePlatform(notify)))(next=>{
  if(!live())return;
  state=next;
  if(!verified())revision++;
  else resumeTime=next.time;
  const nextPlaying=verified()&&!next.paused;
  if(nextPlaying&&!playing){playing=true;options.onPlay?.();}else playing=nextPlaying;
  options.onState?.(next);paint();
 });
 const release=platform.mount(surface,path);

 function paint(){
  if(!live())return;
  const synced=verified();
  load.set(!opened?'加载视频':!synced?'重新加载视频':state!.paused?'播放':'暂停',opened&&synced&&!state!.paused?'pause':'play');
  load.button.disabled=busy;
  timestamp.button.disabled=screenshot.button.disabled=!!options.disabled||!synced||busy||!!pending;
  retry.button.hidden=!pending;retry.button.disabled=!!options.disabled||busy;
  root.setAttribute('aria-busy',String(busy));
  clock.setText(synced?mediaClock(state!.time):'时间未同步');
  const problem=opened&&!synced?(state?.error||(state?.candidate||state?.sourcePath&&state.sourcePath!==path?'视频来源已变化，请重新加载原视频':state?.closed?'播放器已关闭，请重新加载':'正在等待视频同步')):'';
  status.setText(busy||pending?message:problem||message||(!opened?'尚未加载视频':''));
 }
 function open(time:number){
  if(!live())throw Error('视频卡片已关闭');
  if(!Number.isFinite(time)||time<0||time>864000)throw Error('无效的播放时间');
  empty.hidden=true;
  try{platform.open(path,time);opened=true;paint();}catch(error){empty.hidden=false;throw error;}
 }
 async function acquire(frame:boolean){
  if(!live()||options.disabled||!verified()||busy||pending)return;
  busy=true;message=frame?'正在截取画面…':'正在读取播放时间…';paint();
  const started=revision;
  try{
   const captured=frame?await platform.capture(path):undefined;
   const time=captured?.time??await platform.position(path);
   if(!live())return;
   if(started!==revision||!verified())throw Error('视频来源或播放状态已变化，请重新摘录');
   if(!Number.isFinite(time)||time<0||time>864000)throw Error('播放时间无效，请重新同步');
   pending={id:uid(),time,text:'',...(captured?{image:new Blob([Uint8Array.from(captured.bytes)],{type:'image/png'})}:{})};
  }catch(error){if(live())message=error instanceof Error?error.message:'无法读取当前视频，请重试';}
  finally{busy=false;paint();}
  if(live()&&pending)await save();
 }
 async function save(){
  if(!live()||options.disabled||busy||!pending)return;
  const snapshot=pending;busy=true;message='正在保存摘录…';paint();
  try{
   await options.onCapture(snapshot);
   if(!live())return;
   if(pending===snapshot)pending=undefined;
   message=`已保存 ${mediaClock(snapshot.time)} ${snapshot.image?'截图':'时间戳'}`;
  }catch(error){if(live())message=`保存失败：${error instanceof Error?error.message:'请重试'}；摘录仍保留`;}finally{busy=false;paint();}
 }
 paint();
 return {
  dispose(){if(disposed)return;disposed=true;revision++;try{release();}finally{platform.dispose();root.remove();}},
  pause(){if(disposed||!opened)return;void platform.command(path,'pause').catch(()=>undefined);},
  async seek(time){if(!live())throw Error('视频卡片已关闭');if(!Number.isFinite(time)||time<0||time>864000)throw Error('无效的播放时间');if(!opened)open(time);else await platform.command(path,'seek',time);}
 };
}
