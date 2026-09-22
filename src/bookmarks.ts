import { App, EventRef } from 'obsidian';
export interface Bookmark {type:string;path?:string;subpath?:string;items?:Bookmark[];ctime?:number;title?:string;}
export interface NativeBookmarks {getBookmarks():Bookmark[];addItem(item:Bookmark):void;removeItem(item:Bookmark):void;saveData():Promise<void>;on(name:'changed',callback:()=>void):EventRef;}
/** 核心书签尚无公开写入 API；集中适配并进行能力检查，缺失时保留本地收藏。 */
export function nativeBookmarks(app:App):NativeBookmarks|undefined{
  const plugin=(app as unknown as {internalPlugins?:{plugins?:Record<string,{enabled?:boolean;instance?:NativeBookmarks}>}}).internalPlugins?.plugins?.bookmarks;
  const instance=plugin?.enabled?plugin.instance:undefined;
  return instance&&['getBookmarks','addItem','removeItem','saveData','on'].every(k=>typeof(instance as unknown as Record<string,unknown>)[k]==='function')?instance:undefined;
}
export function bookmarkedBoards(items:Bookmark[]):string[]{const paths=new Set<string>(),seen=new Set<Bookmark>(),stack=[...items].reverse();while(stack.length){const item=stack.pop()!;if(!item||seen.has(item))continue;seen.add(item);if(item.type==='file'&&item.path?.endsWith('.thoughtspace')&&!item.subpath)paths.add(item.path);const children=item.items||[];for(let i=children.length-1;i>=0;i--)stack.push(children[i]);}return [...paths];}
