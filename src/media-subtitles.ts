import {maximumMediaTime} from './media-source';

export const MAX_SUBTITLE_CHARACTERS=2000000;
export const MAX_SUBTITLE_CUES=20000;
const maximumCueCharacters=20000;
const dangerousTags=new Set(['script','style','iframe','object','embed','svg','math','template','noscript']);
const blockTags=new Set(['br','p','div','li','tr']);
function invalid(cue?:number):never {throw Error(cue===undefined?'字幕格式无效，请选择有效的 SRT 字幕':`第 ${cue} 条字幕的时码或正文无效`);}
function timestamp(value:string):number|undefined {
 const match=/^(\d{2,6}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(value);if(!match)return;
 const time=((Number(match[1])*60+Number(match[2]))*60+Number(match[3]))*1000+Number(match[4]);
 return time<=maximumMediaTime*1000?time:undefined;
}
function clock(milliseconds:number):string {
 const seconds=Math.floor(milliseconds/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);
 return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}.${String(milliseconds%1000).padStart(3,'0')}`;
}
function decodeEntity(entity:string):string {
 const names:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',lrm:'\u200e',rlm:'\u200f'};
 const body=entity.slice(1,-1);if(Object.hasOwn(names,body))return names[body];
 if(!/^#(?:\d+|x[\da-f]+)$/i.test(body))return entity;
 const code=body[1].toLowerCase()==='x'?parseInt(body.slice(2),16):Number(body.slice(1));
 return Number.isInteger(code)&&code>=32&&code<=0x10ffff&&code!==127&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):'';
}
/** No DOM or HTML parser is needed: emitted payload is escaped plain WebVTT text. */
function readableText(raw:string):string {
 let text='',offset=0;const hidden:string[]=[];
 while(offset<raw.length){
  if(raw.startsWith('<!--',offset)){const end=raw.indexOf('-->',offset+4);offset=end<0?raw.length:end+3;continue;}
  if(raw[offset]==='<'){
   const match=/^<\s*(\/?)\s*([a-z][\w:-]*)(?=[\s/>]|$)/i.exec(raw.slice(offset));
   if(match){
    let end=offset+match[0].length,quote='';
    for(;end<raw.length;end++){const char=raw[end];if(quote){if(char===quote)quote='';}else if(char==='"'||char==="'")quote=char;else if(char==='>')break;}
    const tag=match[2].toLowerCase(),closing=!!match[1],selfClosing=/\/\s*$/.test(raw.slice(offset,end));
    if(dangerousTags.has(tag)){if(closing){const at=hidden.lastIndexOf(tag);if(at>=0)hidden.splice(at);}else if(!selfClosing&&tag!=='embed')hidden.push(tag);}
    else if(!hidden.length&&blockTags.has(tag)&&(closing||tag==='br'))text+='\n';
    offset=end<raw.length?end+1:raw.length;continue;
   }
   if(/^<!|^<\?/.test(raw.slice(offset))){const end=raw.indexOf('>',offset+2);offset=end<0?raw.length:end+1;continue;}
  }
  if(!hidden.length)text+=raw[offset];offset++;
 }
 // ASS positioning hints are common in SRT exports, but are not readable captions.
 return text.replace(/\{\\[^}\n]*\}/g,'').replace(/&(?:#[\da-fx]+|[a-z]+);/gi,decodeEntity)
  .split('\n').map(line=>line.trimEnd()).filter(line=>line.trim()).join('\n').trim()
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
/** Convert a bounded, chronological SRT document. Overlapping cues remain valid. */
export function srtToWebVtt(raw:string):string {
 if(typeof raw!=='string'||raw.length>MAX_SUBTITLE_CHARACTERS)throw Error('字幕文件超过 2,000,000 字符或内容无效');
 for(let i=0;i<raw.length;i++){const code=raw.charCodeAt(i);if(code<32&&code!==9&&code!==10&&code!==13||code===127)invalid();}
 const normalized=raw.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();if(!normalized)invalid();
 const blocks=normalized.split(/\n(?:[ \t]*\n)+/);if(blocks.length>MAX_SUBTITLE_CUES)throw Error('字幕超过 20,000 条，请分段加载');
 const cues:string[]=[];let previousStart=-1;
 for(const [index,block] of blocks.entries()){
  const cue=index+1;if(block.length>maximumCueCharacters)throw Error(`第 ${cue} 条字幕超过 20,000 字符`);
  const lines=block.split('\n');if(/^\d{1,10}$/.test(lines[0].trim()))lines.shift();
  const timing=/^\s*(\S+)[ \t]*-->[ \t]*(\S+)[ \t]*$/.exec(lines.shift()||'');if(!timing)invalid(cue);
  const start=timestamp(timing[1]),end=timestamp(timing[2]);if(start===undefined||end===undefined||end<=start||start<previousStart)invalid(cue);
  const text=readableText(lines.join('\n'));if(!text)invalid(cue);
  cues.push(`${cue}\n${clock(start)} --> ${clock(end)}\n${text}`);previousStart=start;
 }
 return 'WEBVTT\n\n'+cues.join('\n\n')+'\n';
}
