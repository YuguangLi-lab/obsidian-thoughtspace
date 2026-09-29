export type OnlineProvider = 'bilibili' | 'youtube' | 'baidu';
export interface ParsedOnlineSource {kind:'online';provider:OnlineProvider;path:string;name:string;initialTime:number;mediaUrl:string}
export function parseOnlineVideo(input:string):ParsedOnlineSource;
export function onlineVideoIdentity(input:string):string|null;
export function isBilibiliShortLink(input:string):boolean;
export function allowsOnlineNavigation(provider:OnlineProvider,input:string):boolean;
export function strictOnlineUrl(input:string,base?:string):URL;
