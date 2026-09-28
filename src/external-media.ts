import {Platform,type App,type TFile} from 'obsidian';
import {stat,realpath} from 'fs/promises';
import {statSync} from 'fs';
import {isAbsolute,normalize,basename,extname} from 'path';
import {fileURLToPath,pathToFileURL} from 'url';
import {isVaultMediaPath,mediaKind,type MediaKind} from './media-source';
import {hasAsciiControl,isRecord} from './value-guards';

export interface ExternalMediaReference {version:1;source:string;mtime:number;size:number}
const referenceLimit=16*1024;
const changedMessage='仓库外的媒体文件已变化，请重新关联；原有摘录仍保留';
export function isExternalMediaReference(path:string):boolean{return /\.(tsvideo|tsaudio)$/i.test(path);}
function externalKind(path:string):MediaKind|undefined{return isExternalMediaReference(path)?undefined:mediaKind(path);}
/** Decode only at the file-URL boundary; a literal percent in a path remains literal. */
export function normalizeExternalMediaPath(input:string):string {
 if(typeof input!=='string'||!input||input.length>8192||hasAsciiControl(input)||input.includes('\u007f'))throw Error('本地媒体路径无效');
 let path=input;
 if(/^file:/i.test(input)){
  let url:URL;try{url=new URL(input);}catch{throw Error('本地媒体链接无效');}
  if(url.protocol!=='file:'||url.hostname&&url.hostname!=='localhost'||url.search||url.hash||url.username||url.password||url.port||/%(?![0-9a-f]{2})/i.test(input))throw Error('请选择本机的绝对文件路径或 file 链接');
  try{path=fileURLToPath(url);}catch{throw Error('本地媒体链接无效');}
 }
 if(!isAbsolute(path)||hasAsciiControl(path)||path.includes('\u007f')||path.startsWith('\\\\')||path.startsWith('//'))throw Error('请选择本机的绝对文件路径或 file 链接');
 return normalize(path);
}
export function parseExternalMediaReference(raw:string,expectedKind?:MediaKind):ExternalMediaReference {
 if(typeof raw!=='string'||raw.length>referenceLimit)throw Error('媒体引用文件超过读取上限');
 let value:unknown;try{value=JSON.parse(raw);}catch{throw Error('媒体引用文件格式无效');}
 if(!isRecord(value)||Object.keys(value).length!==4||value.version!==1||typeof value.source!=='string'||!/^file:/i.test(value.source)||typeof value.mtime!=='number'||!Number.isFinite(value.mtime)||value.mtime<0||typeof value.size!=='number'||!Number.isSafeInteger(value.size)||value.size<=0)throw Error('媒体引用文件格式无效');
 const path=normalizeExternalMediaPath(value.source),kind=externalKind(path);
 if(!kind||expectedKind&&kind!==expectedKind)throw Error('媒体引用与本地音视频类型不匹配');
 return {version:1,source:pathToFileURL(path).href,mtime:value.mtime,size:value.size};
}
/** Creates only a small descriptor. The media bytes remain in their original location. */
export async function createExternalMediaReference(input:string):Promise<{kind:MediaKind;extension:'tsvideo'|'tsaudio';basename:string;content:string;source:string}> {
 const inputPath=normalizeExternalMediaPath(input);if(!externalKind(inputPath))throw Error('请选择支持的本地音频或视频文件');
 let path:string,info:Awaited<ReturnType<typeof stat>>;try{path=await realpath(inputPath);info=await stat(path);}catch{throw Error('无法读取本地媒体文件，请检查文件是否存在');}
 const kind=externalKind(path);if(!kind||!info.isFile()||!Number.isSafeInteger(info.size)||info.size<=0||!Number.isFinite(info.mtimeMs)||info.mtimeMs<0)throw Error('请选择有效的本地音频或视频文件');
 const reference:ExternalMediaReference={version:1,source:pathToFileURL(path).href,mtime:info.mtimeMs,size:info.size};
 return {kind,extension:kind==='video'?'tsvideo':'tsaudio',basename:basename(inputPath,extname(inputPath)),source:reference.source,content:JSON.stringify(reference,null,2)+'\n'};
}
function assertFingerprint(reference:ExternalMediaReference,info:{isFile:()=>boolean;mtimeMs:number;size:number}){
 if(!info.isFile()||info.mtimeMs!==reference.mtime||info.size!==reference.size)throw Error(changedMessage);
}
export async function validateExternalMediaReference(reference:ExternalMediaReference):Promise<void>{
 let info:Awaited<ReturnType<typeof stat>>;try{info=await stat(normalizeExternalMediaPath(reference.source));}catch{throw Error('找不到仓库外的媒体文件，请检查原文件位置');}
 assertFingerprint(reference,info);
}
/** The vault process callback is synchronous; verify the external file at its commit boundary. */
export function validateExternalMediaReferenceSync(reference:ExternalMediaReference):void {
 let info:ReturnType<typeof statSync>;try{info=statSync(normalizeExternalMediaPath(reference.source));}catch{throw Error('找不到仓库外的媒体文件，请检查原文件位置');}
 assertFingerprint(reference,info);
}
export async function readExternalMediaReference(app:App,file:TFile):Promise<ExternalMediaReference>{
 const path=file.path,mtime=file.stat.mtime,size=file.stat.size;
 const ensure=()=>{if(!isExternalMediaReference(path)||!isVaultMediaPath(path)||file.path!==path||file.stat.mtime!==mtime||file.stat.size!==size||app.vault.getAbstractFileByPath(path)!==file)throw Error('媒体引用已移动、删除或变化，请重新选择');};
 ensure();if(size>referenceLimit)throw Error('媒体引用文件超过读取上限');
 const raw=await app.vault.read(file);ensure();const reference=parseExternalMediaReference(raw,mediaKind(path));
 await validateExternalMediaReference(reference);ensure();return reference;
}
export function resolveMediaResource(app:App,file:TFile):string|Promise<string>{
 if(!isVaultMediaPath(file.path)||app.vault.getAbstractFileByPath(file.path)!==file)throw Error('媒体已移动或删除，请重新选择');
 if(!isExternalMediaReference(file.path))return app.vault.getResourcePath(file);
 return readExternalMediaReference(app,file).then(reference=>Platform.resourcePathPrefix+reference.source.slice('file:///'.length));
}
