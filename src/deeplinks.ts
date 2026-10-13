import {hasAsciiControl} from './value-guards';
import {isBoardPath} from './board-path';
export function boardLink(vault: string, file: string, node?: string): string {
  const params = new URLSearchParams({vault,space:vault,file});
  if (node) params.set('node',node);
  return `obsidian://thoughtspace?${params.toString()}`;
}
/** Named brain locations have stable IDs, independent of their display name. */
export function brainPositionLink(vault:string,file:string,readingPosition:string):string {
 if(!validReadingPositionId(readingPosition))throw Error('脑图阅读位置标识无效');
 const params=new URLSearchParams({vault,space:vault,file,readingPosition});
 return `obsidian://thoughtspace?${params.toString()}`;
}
function validReadingPositionId(value:string){return !!value&&value.length<=256&&value.trim()===value&&!hasAsciiControl(value)&&!value.includes(String.fromCharCode(127));}
/** Parse routing data only; resolving the file still requires board-content validation. */
export function parseBoardLink(params: Record<string,string>, vault: string): {file:string;node?:string;readingPosition?:string} {
  // Obsidian consumes the routing vault parameter before invoking plugin handlers.
  if((params.space ?? params.vault)!==vault)throw new Error('此链接属于另一个仓库，请先在对应仓库启用 ThoughtSpace');
  if(!isBoardPath(params.file) || hasAsciiControl(params.file) || /(^\/|(^|\/)\.\.?(\/|$)|\\)/.test(params.file))throw new Error('白板链接路径无效');
  if(params.readingPosition!==undefined&&(!validReadingPositionId(params.readingPosition)||!!params.node))throw Error('脑图阅读位置链接无效');
  return {file:params.file,...(params.node?{node:params.node}:{}),...(params.readingPosition?{readingPosition:params.readingPosition}:{})};
}
