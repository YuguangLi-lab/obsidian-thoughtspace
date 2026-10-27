import {Modal,type App,type TFile} from 'obsidian';
import {themeSurface} from './ui-tokens';
import {bindBoardModalViewport} from './board-modal-viewport';
import {renderHandwritingSvg} from './handwriting-export';
import {HandwritingPngOperation,handwritingPngSize,assertPngBytes} from './handwriting-png';
import type {HandwritingExportModalHost} from './handwriting-export-modal';
export class HandwritingPngModal extends Modal {
 private alive=false;private background:'transparent'|'paper'='paper';private stop?:()=>void;private operation?:HandwritingPngOperation<TFile>;
 constructor(app:App,private readonly host:HandwritingExportModalHost){super(app);}
 onOpen(){const doc=this.host.document||this.contentEl.ownerDocument;if(this.containerEl.ownerDocument!==doc)doc.body.appendChild(this.containerEl);this.alive=true;themeSurface(this.modalEl);this.modalEl.addClass('ts-handwriting-png-modal');this.stop=bindBoardModalViewport(this.containerEl);this.titleEl.setText('导出手写 PNG');
  this.contentEl.createEl('p',{text:'保存视觉副本，原笔迹保留。输出不超过 4096 像素单边和 800 万像素；过大画布会等比缩小。'});
  const label=this.contentEl.createEl('label',{text:'背景 '}),select=label.createEl('select',{attr:{'aria-label':'PNG 背景'}});select.createEl('option',{text:'暖白纸张',value:'paper'});select.createEl('option',{text:'透明',value:'transparent'});select.onchange=()=>{this.background=select.value==='transparent'?'transparent':'paper';};
  const status=this.contentEl.createEl('p',{attr:{role:'status','aria-live':'polite'}}),actions=this.contentEl.createDiv('modal-button-container'),save=actions.createEl('button',{text:'保存 PNG',cls:'mod-cta'}),cancel=actions.createEl('button',{text:'取消'});cancel.onclick=()=>this.close();
  const current=()=>this.alive&&this.host.current();
  save.onclick=async()=>{if(this.operation?.busy||!current())return;save.disabled=true;select.disabled=true;status.setText('正在生成并核对 PNG…');
   try{this.operation??=new HandwritingPngOperation({current,render:()=>this.renderPng(doc,current),availablePath:()=>this.app.fileManager.getAvailablePathForAttachment((this.host.source.basename.replace(/[\\/:*?"<>|#[\]]/g,' ').slice(0,80)||'手写')+'-手写.png',this.host.source.path),getFile:path=>this.app.vault.getAbstractFileByPath(path),create:(path,bytes)=>this.app.vault.createBinary(path,bytes.slice().buffer),read:async file=>new Uint8Array(await this.app.vault.readBinary(file))});
    const file=await this.operation.run();this.host.notice('PNG 已保存：'+file.path+'；原笔迹保留');if(current())this.close();
   }catch(error){if(current())status.setText(error instanceof Error?error.message:String(error));}
   finally{if(this.alive){save.disabled=false;select.disabled=!!this.operation;}}
  };
 }
 private async renderPng(doc:Document,current:()=>boolean){
  const svg=await renderHandwritingSvg(this.host.ink,{current,yieldControl:()=>new Promise<void>(resolve=>doc.defaultView!.setTimeout(resolve,0))}),size=handwritingPngSize(svg.bounds.width,svg.bounds.height),canvas=doc.body.createEl('canvas');canvas.hidden=true;canvas.width=size.width;canvas.height=size.height;
  const context=canvas.getContext('2d');if(!context){canvas.remove();throw Error('当前环境不支持 PNG 绘制，原笔迹保留');}
  const image=doc.body.createEl('img');image.hidden=true;const url=URL.createObjectURL(new Blob([svg.source],{type:'image/svg+xml'}));
  try{await new Promise<void>((resolve,reject)=>{const timer=doc.defaultView!.setTimeout(()=>reject(Error('PNG 图像解码超时')),30000);const end=(error?:Error)=>{doc.defaultView!.clearTimeout(timer);error?reject(error):resolve();};image.onload=()=>end();image.onerror=()=>end(Error('PNG 图像解码失败'));image.src=url;});
   if(!current())throw Error('PNG 导出已取消');if(this.background==='paper'){context.fillStyle='#fffdf8';context.fillRect(0,0,size.width,size.height);}context.drawImage(image,0,0,size.width,size.height);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('PNG 编码失败')),'image/png'));const bytes=new Uint8Array(await blob.arrayBuffer());assertPngBytes(bytes);return bytes;
  }finally{image.onload=null;image.onerror=null;image.src='';URL.revokeObjectURL(url);canvas.width=0;canvas.height=0;image.remove();canvas.remove();}
 }
 onClose(){this.alive=false;this.stop?.();this.contentEl.empty();this.host.closed?.();}
}
export function openHandwritingPng(app:App,host:HandwritingExportModalHost){const modal=new HandwritingPngModal(app,host);modal.open();return modal;}
