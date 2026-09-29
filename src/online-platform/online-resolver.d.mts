import type {ParsedOnlineSource} from './online-video.mjs';
export interface RedirectResponse {status:number;headers:{get(name:string):string|null};body?:{cancel():Promise<unknown>}|null}
export type RedirectFetcher=(url:string,options:{method:'GET';redirect:'manual';credentials:'omit';signal:AbortSignal})=>Promise<RedirectResponse>;
export function resolveOnlineVideo(input:string,fetcher?:RedirectFetcher):Promise<ParsedOnlineSource>;
