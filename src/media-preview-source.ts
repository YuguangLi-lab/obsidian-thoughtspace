import {markdownLinkRanges} from './markdown-links';
import {hasAsciiControl} from './value-guards';

const rasterExtension=/\.(png|jpe?g|webp|gif|avif|bmp)$/i;
function hasControl(value:string):boolean {
 if(hasAsciiControl(value))return true;
 for(const char of value){const code=char.charCodeAt(0);if(code>=127&&code<=159||code===0x2028||code===0x2029)return true;}
 return false;
}
function validPath(path:string):boolean {
 return path.length>0&&path.length<=8192&&path.trim()===path&&!hasControl(path)&&!path.includes('\\')&&!/^([a-z][a-z\d+.-]*:|\/)/i.test(path)&&path.split('/').every(part=>part!==''&&part!=='.'&&part!=='..')&&rasterExtension.test(path);
}
function validTitle(value:string):boolean {
 if(!value)return true;
 const first=value[0],last=first==='('?')':first;
 if(first!=='"'&&first!=="'"&&first!=='('||value.at(-1)!==last)return false;
 for(let i=1;i<value.length;i++){
  if(value[i]==='\\'){if(i+1>=value.length-1)return false;i++;continue;}
  if(value[i]===last)return i===value.length-1;
  if(first==='('&&value[i]==='(')return false;
 }
 return false;
}
function markdownDestination(value:string):string|undefined {
 const target=value.trim();if(!target)return;
 let end=0,destination:string;
 if(target[0]==='<'){
  for(end=1;end<target.length;end++){if(target[end]==='\\'){end++;continue;}if(target[end]==='>')break;}
  if(end>=target.length)return;destination=target.slice(1,end);end++;
 }else{
  for(;end<target.length;end++){if(target[end]==='\\'){end++;continue;}if(/\s/.test(target[end]))break;if(target[end]==='<'||target[end]==='>')return;}
  destination=target.slice(0,end);
 }
 const tail=target.slice(end);
 if(tail&&!/^\s/.test(tail)||!validTitle(tail.trim()))return;
 // Decode Markdown escapes before URL escapes. Percent decoding happens once;
 // encoded percent signs retain their literal filename identity afterwards.
 const unescaped=destination.replace(/\\(.)/g,(match:string,char:string)=>{
  const code=char.charCodeAt(0);return char===' '||code>=33&&code<=47||code>=58&&code<=64||code>=91&&code<=96||code>=123&&code<=126?char:match;
 });
 try{return decodeURIComponent(unescaped);}catch{return;}
}
/** Extract one normalized vault-root image reference. The caller must look up
 * this exact path; do not resolve it relative to a note or use basename lookup. */
export function mediaPreviewPath(image:unknown):string|undefined {
 if(typeof image!=='string'||image.length>16384||hasControl(image))return;
 const value=image.trim();let path:string|undefined;
 const wiki=/^!\[\[([^[\]]+)\]\]$/.exec(value);
 if(wiki){
  // Wikilinks contain literal vault paths, not URL-encoded destinations.
  path=wiki[1].split('|')[0];
 }else{
  if(!value.startsWith('!['))return;
  const ranges=markdownLinkRanges(value);
  if(ranges.length!==1||ranges[0].from!==1||ranges[0].to!==value.length)return;
  let depth=1,end=2;
  for(;end<value.length;end++){if(value[end]==='\\'){end++;continue;}if(value[end]==='[')depth++;else if(value[end]===']'&&!--depth)break;}
  if(value[end+1]!=='('||value.at(-1)!==')')return;
  path=markdownDestination(value.slice(end+2,-1));
 }
 return path!==undefined&&validPath(path)?path:undefined;
}
