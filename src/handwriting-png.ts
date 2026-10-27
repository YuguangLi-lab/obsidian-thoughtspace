import {sha256} from './portable-sha256';
export const MAX_PNG_PIXELS=8_000_000,MAX_PNG_SIDE=4096,MAX_PNG_BYTES=32*1024*1024;
export function handwritingPngSize(width:number,height:number){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('PNG 尺寸无效');
 const scale=Math.min(2,MAX_PNG_SIDE/width,MAX_PNG_SIDE/height,Math.sqrt(MAX_PNG_PIXELS/width/height));
 const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));if(w*h>MAX_PNG_PIXELS)throw Error('PNG 超过像素预算');return {width:w,height:h};
}
export function assertPngBytes(bytes:Uint8Array){if(bytes.length<8||bytes.length>MAX_PNG_BYTES||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw Error('PNG 生成结果无效或超过文件预算');}
export interface PngFile {path:string}
export interface HandwritingPngHost<F extends PngFile>{current:()=>boolean;render:()=>Promise<Uint8Array>;availablePath:()=>Promise<string>;getFile:(path:string)=>unknown;create:(path:string,bytes:Uint8Array)=>Promise<F>;read:(file:F)=>Promise<Uint8Array>;}
/** Exclusive creation and exact readback; an uncertain create cannot silently become another export. */
export class HandwritingPngOperation<F extends PngFile>{
 private pending?:Promise<F>;private attachment?:F;private bytes?:Uint8Array;private uncertain?:string;
 constructor(private readonly host:HandwritingPngHost<F>){}
 get busy(){return !!this.pending;}
 run():Promise<F>{if(this.pending)return this.pending;const work=this.perform().finally(()=>{if(this.pending===work)this.pending=undefined;});this.pending=work;return work;}
 private ensure(){if(!this.host.current())throw Error('PNG 导出已取消或来源已变化');}
 private async perform(){
  this.ensure();if(this.uncertain)throw Error('PNG 创建结果待核对：'+this.uncertain+'；未自动再次创建');
  this.bytes??=await this.host.render();assertPngBytes(this.bytes);this.ensure();
  if(!this.attachment){const path=await this.host.availablePath();this.ensure();if(!path.endsWith('.png')||path.startsWith('/')||path.includes('\\')||path.split('/').some(p=>!p||p.startsWith('.'))||this.host.getFile(path))throw Error('PNG 路径无效或已存在，未覆盖');
   try{this.attachment=await this.host.create(path,this.bytes);if(this.attachment.path!==path)throw Error('创建返回路径与意图不一致');}
   catch(error){this.uncertain=path;throw Error('PNG 创建结果待核对：'+path+'；未自动重试',{cause:error});}
  }
  const file=this.attachment,path=file.path;if(this.host.getFile(path)!==file)throw Error('PNG 附件已变化，请核对原文件');
  const observed=await this.host.read(file);if(this.host.getFile(path)!==file||file.path!==path||sha256(observed)!==sha256(this.bytes))throw Error('PNG 写入未确认，附件已保留：'+path);
  return file;
 }
}
