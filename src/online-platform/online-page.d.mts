export interface CaptureIdentity {token:string;seekRevision:number}
export interface CapturedVideoFrame {dataUrl:string;width:number;height:number}
export interface MediaSnapshot {time:number;duration:number;paused:boolean;rate:number;media:string;capture?:CaptureIdentity;frame?:CapturedVideoFrame}
export function onlinePageAction(provider:string,expectedUrl:string,action?:string,value?:number,expectedMedia?:string|null,expectedCapture?:{token:string;seekRevision:number}|null):Promise<{reason:string}|MediaSnapshot>;
