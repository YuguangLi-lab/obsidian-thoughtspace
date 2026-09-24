import {isFiniteNumber,isRecord} from './value-guards';

export interface BackgroundImagePreferences {
 backgroundImagePath:string;
 backgroundImageFit:'cover'|'contain'|'tile';
 backgroundImageOpacity:number;
}
export const defaultBackgroundImagePreferences:BackgroundImagePreferences={backgroundImagePath:'',backgroundImageFit:'cover',backgroundImageOpacity:70};
export const MAX_BACKGROUND_IMAGE_BYTES=20*1024*1024;
export type BackgroundImageExtension='png'|'jpg'|'webp'|'gif';

/** Only vault-relative raster paths enter the resource resolver; no network or raw CSS URLs. */
function cleanImagePath(value:unknown):string{
 if(typeof value!=='string'||value.length>4096||[...value].some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127))return '';
 const path=value.trim();
 if(!path||/^[~/]/.test(path)||/[\\:?#]/.test(path)||/%(?:2e|2f|5c|25)/i.test(path))return '';
 if(path.split('/').some(part=>!part||part==='.'||part==='..')||!/\.(?:png|jpe?g|webp|gif)$/i.test(path))return '';
 return path;
}
export function cleanBackgroundImagePreferences(raw:unknown):BackgroundImagePreferences{
 const saved=isRecord(raw)?raw:{},fit=saved.backgroundImageFit;
 return{
  backgroundImagePath:cleanImagePath(saved.backgroundImagePath),
  backgroundImageFit:fit==='contain'||fit==='tile'?fit:'cover',
  backgroundImageOpacity:isFiniteNumber(saved.backgroundImageOpacity)?Math.max(0,Math.min(100,saved.backgroundImageOpacity)):defaultBackgroundImagePreferences.backgroundImageOpacity,
 };
}
export function backgroundImageStamp(prefs:BackgroundImagePreferences):string{
 const clean=cleanBackgroundImagePreferences(prefs);
 return JSON.stringify([clean.backgroundImagePath,clean.backgroundImageFit,clean.backgroundImageOpacity]);
}

const ascii=(bytes:Uint8Array,offset:number,text:string)=>[...text].every((char,index)=>bytes[offset+index]===char.charCodeAt(0));
const u16le=(bytes:Uint8Array,offset:number)=>bytes[offset]+bytes[offset+1]*256;
const u16be=(bytes:Uint8Array,offset:number)=>bytes[offset]*256+bytes[offset+1];
const u32le=(bytes:Uint8Array,offset:number)=>bytes[offset]+bytes[offset+1]*256+bytes[offset+2]*65536+bytes[offset+3]*16777216;
const u32be=(bytes:Uint8Array,offset:number)=>bytes[offset]*16777216+bytes[offset+1]*65536+bytes[offset+2]*256+bytes[offset+3];
const invalid=()=>new Error('图片文件已损坏或不完整，请选择可正常打开的 PNG、JPEG、WebP 或 GIF 图片。');

function checkPng(bytes:Uint8Array){
 if(bytes.length<57||u32be(bytes,8)!==13||!ascii(bytes,12,'IHDR')||!u32be(bytes,16)||!u32be(bytes,20))throw invalid();
 let offset=8,hasPixels=false;
 while(offset+12<=bytes.length){
  const length=u32be(bytes,offset),end=offset+12+length;
  if(end>bytes.length)throw invalid();
  if(ascii(bytes,offset+4,'IDAT')&&length>0)hasPixels=true;
  if(ascii(bytes,offset+4,'IEND')){if(length!==0||end!==bytes.length||!hasPixels)throw invalid();return;}
  offset=end;
 }
 throw invalid();
}
function checkJpeg(bytes:Uint8Array){
 if(bytes.length<12||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)throw invalid();
 let offset=2,hasFrame=false;
 while(offset<bytes.length-2){
  if(bytes[offset++]!==255)throw invalid();
  while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];
  if(marker===undefined||marker===0||marker===216||marker===217)throw invalid();
  if(marker===1||marker>=208&&marker<=215)continue;
  if(offset+2>bytes.length)throw invalid();
  const length=u16be(bytes,offset);
  if(length<2||offset+length>bytes.length-2)throw invalid();
  if(marker>=192&&marker<=207&&marker!==196&&marker!==200&&marker!==204){
   if(length<8||!u16be(bytes,offset+3)||!u16be(bytes,offset+5))throw invalid();
   hasFrame=true;
  }
  if(marker===218){if(!hasFrame||length<6||offset+length>=bytes.length-2)throw invalid();return;}
  offset+=length;
 }
 throw invalid();
}
function checkWebp(bytes:Uint8Array){
 if(bytes.length<20||u32le(bytes,4)!==bytes.length-8)throw invalid();
 let offset=12,hasPixels=false;
 while(offset+8<=bytes.length){
  const length=u32le(bytes,offset+4),data=offset+8,end=data+length;
  if(end+(length%2)>bytes.length)throw invalid();
  if(ascii(bytes,offset,'VP8 ')){
   if(length<=10||!ascii(bytes,data+3,'\x9d\x01\x2a')||!(u16le(bytes,data+6)&16383)||!(u16le(bytes,data+8)&16383))throw invalid();
   hasPixels=true;
  }else if(ascii(bytes,offset,'VP8L')){if(length<=5||bytes[data]!==47)throw invalid();hasPixels=true;}
  else if(ascii(bytes,offset,'VP8X')){if(length!==10)throw invalid();}
  else if(ascii(bytes,offset,'ANMF')){if(length<24)throw invalid();hasPixels=true;}
  offset=end+(length%2);
 }
 if(offset!==bytes.length||!hasPixels)throw invalid();
}
function checkGif(bytes:Uint8Array){
 if(bytes.length<14||!u16le(bytes,6)||!u16le(bytes,8))throw invalid();
 let offset=13+(bytes[10]&128?3*2**((bytes[10]&7)+1):0),hasPixels=false;
 const skipBlocks=()=>{let total=0;while(offset<bytes.length){const size=bytes[offset++];if(size===0)return total;offset+=size;total+=size;if(offset>bytes.length)throw invalid();}throw invalid();};
 while(offset<bytes.length){
  const marker=bytes[offset++];
  if(marker===59){if(offset!==bytes.length||!hasPixels)throw invalid();return;}
  if(marker===33){if(offset>=bytes.length)throw invalid();offset++;skipBlocks();continue;}
  if(marker!==44||offset+9>bytes.length||!u16le(bytes,offset+4)||!u16le(bytes,offset+6))throw invalid();
  const packed=bytes[offset+8];offset+=9+(packed&128?3*2**((packed&7)+1):0);
  if(offset>=bytes.length||bytes[offset]<2||bytes[offset]>8)throw invalid();
  offset++;if(!skipBlocks())throw invalid();hasPixels=true;
 }
 throw invalid();
}

/** Check bytes, not filename/MIME. Callers should additionally decode pixels before importing. */
export function validateBackgroundImageBytes(bytes:Uint8Array):BackgroundImageExtension{
 if(!(bytes instanceof Uint8Array)||bytes.byteLength===0)throw new Error('图片文件为空，请重新选择图片。');
 if(bytes.byteLength>MAX_BACKGROUND_IMAGE_BYTES)throw new Error('背景图片不能超过 20 MB，请先缩小图片。');
 if(bytes[0]===137&&ascii(bytes,1,'PNG\r\n\x1a\n')){checkPng(bytes);return 'png';}
 if(bytes[0]===255&&bytes[1]===216){checkJpeg(bytes);return 'jpg';}
 if(ascii(bytes,0,'RIFF')&&ascii(bytes,8,'WEBP')){checkWebp(bytes);return 'webp';}
 if(ascii(bytes,0,'GIF87a')||ascii(bytes,0,'GIF89a')){checkGif(bytes);return 'gif';}
 throw new Error('仅支持 PNG、JPEG、WebP 和 GIF 图片，不支持 SVG 或其他文件。');
}
