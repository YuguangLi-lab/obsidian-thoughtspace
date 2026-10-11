/** Read the host only when a desktop action is requested. Pure codecs and URL
 * parsers can therefore be imported without loading any host or Node backend. */
export function isDesktopRuntime():boolean {
 try{
  const host=require('obsidian') as Pick<typeof import('obsidian'),'Platform'>;
  return host.Platform?.isDesktop===true;
 }catch{return false;}
}

export function requireDesktopRuntime(feature:string):void {
 if(!isDesktopRuntime())throw Error(`${feature}需要桌面版 Obsidian；移动端保留已有内容，但无法访问电脑上的文件或播放器。`);
}

/** Keep Node's exact desktop path semantics, including existing vault hashes. */
export function desktopPathResolve(...paths:string[]):string {
 requireDesktopRuntime('桌面文件路径');
 const runtime=require('path') as Pick<typeof import('path'),'resolve'>;
 return runtime.resolve(...paths);
}
