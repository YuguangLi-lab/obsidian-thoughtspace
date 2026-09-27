import {isRecord} from './value-guards';

export interface YingjianPlayerAction {id:string;label:string;icon:string;description:string;}
const playerActions:readonly YingjianPlayerAction[]=[
  {id:'yingjian:open-player',label:'打开播放器',icon:'clapperboard',description:'继续当前课程，播放和时间位置由影笺管理'},
  {id:'yingjian:split-player',label:'右侧分栏',icon:'panel-right',description:'边看视频边整理白板'},
  {id:'yingjian:open-video',label:'打开视频',icon:'file-video',description:'选择本地视频或平台链接'},
  {id:'yingjian:capture-moment',label:'记下此刻',icon:'pencil-line',description:'在影笺中记录真实播放时间和想法'},
  {id:'yingjian:choose-capture-target',label:'记录到白板',icon:'crosshair',description:'在影笺选择接收截图、文字和时间戳的白板'},
  {id:'yingjian:send-to-thoughtspace',label:'导入当前课程',icon:'notebook-pen',description:'读取当前课程已保存的笔记和时间点'},
  {id:'yingjian:library',label:'课程库',icon:'library',description:'查找课程并继续学习'},
  {id:'yingjian:workspace-preferences',label:'联动设置',icon:'sliders-horizontal',description:'调整记录布局、定位方式与图床联动'},
];
/** Only show verified commands actually registered by the enabled player. */
export function yingjianPlayerActions(registered:readonly {id:string}[]):YingjianPlayerAction[]{
  const ids=new Set(registered.map(command=>command.id));
  return playerActions.filter(action=>ids.has(action.id)).map(action=>({...action}));
}
/** Never infer live playback from the player's persisted private course data. */
export function yingjianPlayerConnection(player:unknown):{installed:boolean;nativePlayback:boolean;version?:string}{
  if(!isRecord(player))return{installed:false,nativePlayback:false};
  const api=player.videoApi,manifest=player.manifest;
  return{installed:true,nativePlayback:isRecord(api)&&api.version===1&&typeof api.play==='function',
    ...(isRecord(manifest)&&typeof manifest.version==='string'?{version:manifest.version.slice(0,40)}:{})};
}

/** Optional in-process bridge; absence falls back to the existing desktop URI. */
export async function playInYingjianPlugin(player: unknown, video: string, time: number, note: string, vaultId: string): Promise<boolean> {
  const candidate = player as { videoApi?: { version?: number; play?: (video: string, time: number, note: string, vaultId: string) => Promise<void> } } | undefined
  if (candidate?.videoApi?.version !== 1 || typeof candidate.videoApi.play !== 'function') return false
  // A rejected in-process request must not silently launch a second application.
  await candidate.videoApi.play(video, time, note, vaultId)
  return true
}
