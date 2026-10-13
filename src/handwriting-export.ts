import {assertInkData,inkBounds,strokePath,type InkBounds,type InkData,type InkStroke} from './ink-model';

export interface HandwritingSvg {source:string;bounds:InkBounds;strokes:number;points:number;}
export interface HandwritingSvgOptions {
 title?:string;
 current?:()=>boolean;
 yieldControl?:()=>Promise<void>;
 progress?:(done:number,total:number)=>void;
}
const visibleText=(text:string)=>Array.from(text,char=>{const code=char.charCodeAt(0);return code<32||code===127?' ':char;}).join('');
const xml=(text:string)=>visibleText(text).replace(/[&<>"']/g,value=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[value]!));
const number=(value:number)=>String(Math.round(value*1_000_000)/1_000_000);
function ensureCurrent(options:HandwritingSvgOptions){if(options.current&&!options.current())throw Error('导出已取消或来源白板已变化');}

/** No markup supplied by a file is emitted. Display geometry uses the same
 * pressure outline as the canvas; persistent full-precision samples stay intact. */
export async function renderHandwritingSvg(ink:InkData,options:HandwritingSvgOptions={}):Promise<HandwritingSvg> {
 ensureCurrent(options);assertInkData(ink);
 if(!ink.strokes.length)throw Error('还没有可导出的笔迹');
 // A captured value remains independent even if another extension mutates a
 // nested object while the cooperative renderer yields to a cancel action.
 const snapshot:InkData={version:1,strokes:ink.strokes.map(stroke=>({...stroke,points:stroke.points.map(point=>[...point])}))};
 const outline=inkBounds(snapshot)!,padding=8,bounds={x:outline.x-padding,y:outline.y-padding,width:outline.width+padding*2,height:outline.height+padding*2};
 const total=snapshot.strokes.reduce((sum,stroke)=>sum+stroke.points.length,0),paths:string[]=[];
 let done=0;options.progress?.(done,total);
 for(const stroke of snapshot.strokes){
  const pieces:string[]=[];
  for(let start=0;start<stroke.points.length;start+=512){
   ensureCurrent(options);
   const end=Math.min(start+512,stroke.points.length),part:InkStroke={...stroke,points:stroke.points.slice(Math.max(0,start-1),end)};
   // The shared endpoint disk is identical and opaque; overlap preserves the
   // exact union of disks/tapered hulls without changing pressure or coordinates.
   pieces.push(strokePath(part));done+=end-start;options.progress?.(done,total);
   if(options.yieldControl)await options.yieldControl();
  }
  paths.push(`<path fill="${stroke.color}" fill-rule="nonzero" d="${pieces.join('')}"/>`);
 }
 ensureCurrent(options);
 const scale=Math.min(1,1600/Math.max(bounds.width,bounds.height));
 const source=`<svg xmlns="http://www.w3.org/2000/svg" width="${number(bounds.width*scale)}" height="${number(bounds.height*scale)}" viewBox="${number(bounds.x)} ${number(bounds.y)} ${number(bounds.width)} ${number(bounds.height)}" role="img"><title>${xml((options.title||'手写白板').slice(0,256))}</title><desc>${snapshot.strokes.length} 条笔迹，${total} 个采样点；视觉副本，完整手写数据保留在来源白板。</desc>${paths.join('')}</svg>\n`;
 return{source,bounds,strokes:snapshot.strokes.length,points:total};
}

export interface HandwritingExportFile {path:string;basename:string;extension:string;stat?:{mtime:number;size:number};}
export interface HandwritingExportTarget<F extends HandwritingExportFile> {file:F;path:string;baseline:string;generation:number;}
export interface HandwritingExportResult<F extends HandwritingExportFile> {attachment:F;target?:F;svg:HandwritingSvg;}
export interface HandwritingExportHost<F extends HandwritingExportFile> {
 source:F;ink:InkData;current:()=>boolean;
 getFile:(path:string)=>unknown;
 read:(file:F)=>Promise<string>;
 availablePath:(filename:string,sourcePath:string)=>Promise<string>;
 create:(path:string,source:string)=>Promise<F>;
 process:(file:F,change:(source:string)=>string)=>Promise<unknown>;
 link:(file:F,sourcePath:string)=>string;
 assertTarget:(file:F)=>void;
 targetAllowed?:(file:F)=>boolean;
 yieldControl?:()=>Promise<void>;
 progress?:(done:number,total:number)=>void;
}
export class HandwritingExportError extends Error {
 constructor(message:string,readonly retainedPath?:string,readonly creationUnconfirmed=false){super(message);this.name='HandwritingExportError';}
}
export function handwritingExportFilename(title:string):string {
 const safe=Array.from(visibleText(title),char=>'\\/:*?"<>|#^[]'.includes(char)?' ':char).join('').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'').slice(0,80)||'白板';
 return `手写-${safe}.svg`;
}
export function appendHandwritingEmbed(source:string,attachment:string,backlink:string):string {
 assertHandwritingAppendPosition(source);
 const eol=source.includes('\r\n')?'\r\n':'\n';
 const separator=!source?'':source.endsWith(eol+eol)?'':source.endsWith(eol)?eol:eol+eol;
 return source+separator+`!${attachment}${eol}${eol}来源白板：${backlink}${eol}`;
}
/** Appending inside an unfinished native code/property region would silently
 * turn the embed into literal text. Do not finish or rewrite the user's region. */
export function assertHandwritingAppendPosition(source:string):void {
 const lines=source.replace(/\r\n?/g,'\n').split('\n');let start=0;
 if(lines[0]==='---'){
  const end=lines.findIndex((line,index)=>index>0&&(line==='---'||line==='...'));
  if(end<0)throw Error('目标笔记的属性区尚未结束，请先完成后再插入 SVG');start=end+1;
 }
 let fence:{char:string;length:number}|undefined;
 for(const line of lines.slice(start)){
  if(fence){const close=line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);if(close&&close[1][0]===fence.char&&close[1].length>=fence.length)fence=undefined;}
  else{const open=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);if(open&&(open[1][0]!=='`'||!open[2].includes('`')))fence={char:open[1][0],length:open[1].length};}
 }
 if(fence)throw Error('目标笔记的代码块尚未结束，请先完成后再插入 SVG');
}

/** One modal owns one operation. Repeated clicks share its in-flight result;
 * every write checks source generation, exact TFile identity and native owners. */
export class HandwritingExportOperation<F extends HandwritingExportFile> {
 private readonly sourcePath:string;
 private cancelled=false;private generation=0;private selected?:HandwritingExportTarget<F>;
 private active?:Promise<HandwritingExportResult<F>>;private completed?:HandwritingExportResult<F>;
 private rendered?:HandwritingSvg;private attachment?:F;private attachmentStamp?:{path:string;mtime?:number;size?:number};
 private uncertainAppend?:{file:F;path:string;value:string};
 constructor(private readonly host:HandwritingExportHost<F>){this.sourcePath=host.source.path;}
 cancel(){this.cancelled=true;this.generation++;}
 get busy(){return !!this.active;}
 get target(){return this.selected;}
 private ensure(){
  if(this.cancelled||!this.host.current())throw Error('导出已取消或来源白板已变化');
  if(this.host.source.path!==this.sourcePath||this.host.getFile(this.sourcePath)!==this.host.source)throw Error('来源白板已移动、删除或替换，未继续导出');
 }
 private ensureTarget(target:HandwritingExportTarget<F>){
  this.ensure();
  if(this.selected!==target||target.generation!==this.generation)throw Error('目标笔记已切换，请重新选择');
  if(target.file===this.host.source||target.file.extension.toLowerCase()!=='md'||this.host.targetAllowed&&!this.host.targetAllowed(target.file))throw Error('请选择其他原生 Markdown 笔记');
  if(target.file.path!==target.path||this.host.getFile(target.path)!==target.file)throw Error('目标笔记已移动、删除或替换，未修改');
  this.host.assertTarget(target.file);
 }
 private ensureAttachment(){
  const file=this.attachment,stamp=this.attachmentStamp;
  if(!file||!stamp||file.path!==stamp.path||this.host.getFile(stamp.path)!==file||file.stat?.mtime!==stamp.mtime||file.stat?.size!==stamp.size)throw Error('导出附件已移动、替换或修改，未插入笔记');
 }
 async chooseTarget(file:F):Promise<HandwritingExportTarget<F>> {
  this.ensure();const generation=++this.generation;this.selected=undefined;
  if(file===this.host.source||file.extension.toLowerCase()!=='md'||this.host.targetAllowed&&!this.host.targetAllowed(file))throw Error('请选择其他原生 Markdown 笔记');
  const target={file,path:file.path,baseline:'',generation};this.selected=target;
  try{this.ensureTarget(target);target.baseline=await this.host.read(file);this.ensureTarget(target);assertHandwritingAppendPosition(target.baseline);return target;}
  catch(error){if(this.selected===target)this.selected=undefined;throw error;}
 }
 run(insert:boolean):Promise<HandwritingExportResult<F>> {
  if(this.completed)return Promise.resolve(this.completed);
  if(this.active)return this.active;
  const target=insert?this.selected:undefined;
  const pending=this.perform(target,insert);this.active=pending;
  void pending.then(result=>{this.completed=result;if(this.active===pending)this.active=undefined;},()=>{if(this.active===pending)this.active=undefined;});
  return pending;
 }
 private async perform(target:HandwritingExportTarget<F>|undefined,insert:boolean):Promise<HandwritingExportResult<F>> {
  const validate=()=>{this.ensure();if(target)this.ensureTarget(target);};
  try{
   validate();if(insert&&!target)throw Error('请先选择要插入的笔记');
   if(target&&await this.host.read(target.file)!==target.baseline)throw Error('目标笔记已变化，未覆盖。请重新选择笔记');
   validate();
   if(!this.rendered)this.rendered=await renderHandwritingSvg(this.host.ink,{title:this.host.source.basename,current:()=>{try{validate();return true;}catch{return false;}},yieldControl:this.host.yieldControl,progress:this.host.progress});
   validate();
   if(this.attachment){
    this.ensureAttachment();if(await this.host.read(this.attachment)!==this.rendered.source)throw Error('已导出的 SVG 已变化，请保留附件并重新发起导出');this.ensureAttachment();
    validate();
   }else{
    const name=handwritingExportFilename(this.host.source.basename),from=target?.path||this.sourcePath;
    let path:string|undefined;
    for(let attempt=0;attempt<8;attempt++){
     const candidate=await this.host.availablePath(attempt?name.replace(/\.svg$/,`-${attempt+1}.svg`):name,from);validate();
     if(!candidate||!candidate.toLowerCase().endsWith('.svg')||candidate.startsWith('/')||candidate.split(/[\\/]/).some(part=>part==='..'||part==='.'||!part))throw Error('原生附件路径无效，未创建文件');
     if(!this.host.getFile(candidate)){path=candidate;break;}
    }
    if(!path)throw Error('附件名称持续发生冲突，请稍后重试');
    validate();
    try{this.attachment=await this.host.create(path,this.rendered.source);}
    catch(error){
     // Never adopt/delete a file that a failed create did not return: it may
     // belong to another writer or be an uncertain partial storage result.
     if(this.host.getFile(path))throw new HandwritingExportError(`附件创建未确认：${path}。原文件未覆盖，请检查该路径后重试`,path,true);
     throw error;
    }
    this.attachmentStamp={path,mtime:this.attachment.stat?.mtime,size:this.attachment.stat?.size};
    this.ensureAttachment();if(await this.host.read(this.attachment)!==this.rendered.source)throw Error('SVG 写入内容未确认，附件已保留，请检查后重试');
    validate();
   }
   if(target){
    const attachment=this.attachment;
    this.ensureAttachment();
    const embed=this.host.link(attachment,target.path),backlink=this.host.link(this.host.source,target.path);
    if(this.uncertainAppend?.file===target.file&&this.uncertainAppend.path===target.path)throw Error('上一次正文保存结果尚未确认，请先在原生笔记核对 SVG，未再次插入');
    let attempted:string|undefined;
    try{
     await this.host.process(target.file,source=>{
      validate();this.ensureAttachment();
      if(source!==target.baseline)throw Error('目标笔记已变化，未覆盖。请重新选择笔记');
      attempted=appendHandwritingEmbed(source,embed,backlink);return attempted;
     });
    }catch(error){
     if(attempted!==undefined){
      // A storage Promise can reject after its atomic transform has run. Read
      // only to confirm an exact committed value; never blindly append again.
      this.uncertainAppend={file:target.file,path:target.path,value:attempted};
      try{
       if(target.file.path===target.path&&this.host.getFile(target.path)===target.file){
        const disk=await this.host.read(target.file);
        if(target.file.path===target.path&&this.host.getFile(target.path)===target.file){
         if(disk===attempted){this.uncertainAppend=undefined;return{attachment,target:target.file,svg:this.rendered};}
         if(disk===target.baseline)this.uncertainAppend=undefined;
        }
       }
      }catch{/* A failed confirmation must retain the uncertainty and SVG. */}
      if(this.uncertainAppend)throw Error('正文保存结果未确认，请先在原生笔记核对 SVG，未自动重试插入');
     }
     throw error;
    }
    // The atomic transform is the commit boundary. A cancel after it starts
    // cannot roll back a disk write; report the committed insertion accurately.
   }
   return{attachment:this.attachment,target:target?.file,svg:this.rendered};
  }catch(error){
   if(error instanceof HandwritingExportError)throw error;
   const message=error instanceof Error?error.message:String(error);
   throw new HandwritingExportError(this.attachment?`${message}；SVG 已保留：${this.attachment.path}`:message,this.attachment?.path);
  }
 }
}
