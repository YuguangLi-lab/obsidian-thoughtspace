import {App,Modal,Notice,setIcon} from 'obsidian';
import {BackgroundImagePreferences,cleanBackgroundImagePreferences,backgroundImageStamp,MAX_BACKGROUND_IMAGE_BYTES} from './background-image';
import {themeSurface} from './ui-tokens';

export interface BackgroundImageHost {
 preferences:()=>BackgroundImagePreferences;
 resource:(path:string)=>string;
 save:(preferences:BackgroundImagePreferences,file?:File)=>Promise<void>;
}
const imageExtensions=/\.(?:png|jpe?g|webp|gif)$/i;
const imageTypes=new Set(['image/png','image/jpeg','image/webp','image/gif']);
const cssImage=(url:string)=>`url("${url.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\r\n\f]/g,'')}")`;
/** An image is decoded locally; only Apply copies it into the vault via the host. */
export class BackgroundImageModal extends Modal {
 private imageDraft=cleanBackgroundImagePreferences({});private imageBaseline='';private imageHadSource=false;private imageReadFailed=false;private imageBusy=false;private imageClosed=false;private imageConflict=false;private imageLoading=false;private imageRun=0;private imageLoadRun=0;
 private imageFile?:File;private imageObjectUrl='';private imageUrls=new Set<string>();
 private imageInput!:HTMLInputElement;private imageChoose!:HTMLButtonElement;private imageRemove!:HTMLButtonElement;private imageName!:HTMLElement;private imageSlider!:HTMLInputElement;private imageStrength!:HTMLOutputElement;private imagePreview!:HTMLElement;private imageStatus!:HTMLElement;private imageApply!:HTMLButtonElement;private imageReload!:HTMLButtonElement;private imageFits=new Map<BackgroundImagePreferences['backgroundImageFit'],HTMLButtonElement>();
 constructor(app:App,private imageHost:BackgroundImageHost){super(app);}
 private imageButton(parent:HTMLElement,label:string,run:()=>void,cls=''){const button=parent.createEl('button',{text:label,cls,attr:{'aria-label':label}});button.onclick=()=>{if(!this.imageClosed&&!this.imageBusy)run();};return button;}
 onOpen(){this.imageRun++;this.imageClosed=false;this.imageBusy=false;this.imageLoading=false;this.imageConflict=false;this.imageReadFailed=false;this.imageFits.clear();this.contentEl.empty();themeSurface(this.modalEl);this.modalEl.addClass('ts-background-settings');this.titleEl.setText('自定义背景图片');
  this.contentEl.createEl('p',{cls:'ts-background-intro',text:'用一张喜欢的图片，布置自己的思考空间。'});
  const body=this.contentEl.createDiv('ts-background-settings-body'),controls=body.createDiv('ts-background-controls');controls.createEl('h3',{text:'背景图片'});
  const source=controls.createDiv('ts-background-source');setIcon(source.createSpan('ts-background-source-icon'),'image');this.imageName=source.createDiv('ts-background-source-name');
  const actions=controls.createDiv('ts-background-source-actions');this.imageChoose=this.imageButton(actions,'选择图片',()=>this.imageInput.click(),'mod-cta');this.imageRemove=this.imageButton(actions,'移除',()=>this.imageClear());
  this.imageInput=controls.createEl('input',{type:'file',attr:{accept:'.png,.jpg,.jpeg,.webp,.gif','aria-label':'选择本地背景图片'}});this.imageInput.hidden=true;this.imageInput.onchange=()=>{const file=this.imageInput.files?.[0];this.imageInput.value='';if(file)void this.imagePick(file);};
  controls.createEl('p',{cls:'ts-background-file-hint',text:'支持 PNG、JPG、WebP、GIF，最大 20 MB。应用后保存到当前仓库，不上传网络。'});
  const fit=controls.createDiv('ts-background-fit-control');fit.createEl('h3',{text:'显示方式'});const choices=fit.createDiv({cls:'ts-background-fit-options',attr:{role:'group','aria-label':'背景图片显示方式'}});
  for(const[value,label]of [['cover','铺满'],['contain','完整显示'],['tile','平铺']] as const){const button=this.imageButton(choices,label,()=>{this.imageDraft.backgroundImageFit=value;this.imageSync();});button.setAttribute('data-image-fit',value);this.imageFits.set(value,button);}
  const opacity=controls.createDiv('ts-background-opacity-control'),label=opacity.createEl('label');label.createSpan({text:'图片浓度'});this.imageStrength=label.createEl('output',{attr:{'aria-live':'polite'}});this.imageSlider=opacity.createEl('input',{type:'range',attr:{min:'0',max:'100',step:'1','aria-label':'背景图片浓度'}});this.imageSlider.oninput=()=>{if(this.imageClosed||this.imageBusy||this.imageReadFailed)return;this.imageDraft.backgroundImageOpacity=cleanBackgroundImagePreferences({...this.imageDraft,backgroundImageOpacity:Number(this.imageSlider.value)}).backgroundImageOpacity;this.imageSync();};
  const limits=opacity.createDiv('ts-background-opacity-limits');limits.createSpan({text:'轻淡'});limits.createSpan({text:'清晰'});
  const scene=body.createDiv('ts-background-preview-pane');scene.createDiv({cls:'ts-background-preview-heading',text:'白板预览'});this.imagePreview=scene.createDiv({cls:'ts-background-preview',attr:{'aria-label':'背景图片预览'}});const content=this.imagePreview.createDiv('ts-background-preview-content');content.createSpan({cls:'ts-background-preview-caption',text:'我的思考空间'});const note=content.createDiv('ts-background-preview-note');note.createEl('h3',{text:'让想法有处安放'});note.createEl('p',{text:'保留一些空白，开始下一段思考。'});scene.createDiv({cls:'ts-background-preview-hint',text:'背景固定在屏幕上，缩放白板时保持稳定。'});
  this.imageStatus=this.contentEl.createDiv({cls:'ts-background-settings-status',attr:{role:'status','aria-live':'polite'}});
  const footer=this.contentEl.createDiv('ts-background-settings-footer');this.imageReload=this.imageButton(footer,'载入当前设置',()=>this.imageLoad(),'ts-background-reload');this.imageReload.hidden=true;const cancel=footer.createEl('button',{text:'取消',attr:{'aria-label':'取消'}});cancel.onclick=()=>{if(!this.imageClosed)this.close();};this.imageApply=this.imageButton(footer,'应用',()=>{void this.imageSave();},'mod-cta');
  this.contentEl.onkeydown=event=>{if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();if(!this.imageApply.disabled)void this.imageSave();}};
  this.imageLoad();
 }
 private imageRevoke(url:string){if(url&&this.imageUrls.delete(url))URL.revokeObjectURL(url);}
 private imageDiscard(){this.imageLoadRun++;for(const url of this.imageUrls)this.imageRevoke(url);this.imageObjectUrl='';this.imageFile=undefined;this.imageLoading=false;}
 private imageLoad(){if(this.imageClosed||this.imageBusy)return;try{const current=cleanBackgroundImagePreferences(this.imageHost.preferences());this.imageDiscard();this.imageDraft=current;this.imageBaseline=backgroundImageStamp(current);this.imageHadSource=!!current.backgroundImagePath;this.imageConflict=false;this.imageReadFailed=false;this.imageStatus.setText('');this.imageSync();}catch(error){this.imageReadFailed=true;this.imageStatus.setText(`无法读取背景设置：${String(error).replace(/^Error: /,'')}。请重新载入。`);this.imageSync();}}
 private imageClear(){if(this.imageClosed||this.imageBusy||this.imageReadFailed)return;this.imageDiscard();this.imageDraft.backgroundImagePath='';this.imageStatus.setText('');this.imageSync();}
 private async imagePick(file:File){if(this.imageClosed||this.imageBusy||this.imageReadFailed)return;
  if(!imageExtensions.test(file.name)||file.type&&!imageTypes.has(file.type)){this.imageStatus.setText('请选择 PNG、JPG、WebP 或 GIF 图片。');return;}
  if(file.size>MAX_BACKGROUND_IMAGE_BYTES){this.imageStatus.setText('图片超过 20 MB，请选择较小的图片。');return;}
  if(file.size===0){this.imageStatus.setText('图片为空，请重新选择。');return;}
  const run=++this.imageLoadRun;let url='';this.imageLoading=true;this.imageStatus.setText('正在读取图片…');this.imageSync();
  try{url=URL.createObjectURL(file);this.imageUrls.add(url);const image=this.contentEl.ownerDocument.createElement('img');image.decoding='async';image.src=url;await image.decode();if(this.imageClosed||run!==this.imageLoadRun){this.imageRevoke(url);return;}if(!image.naturalWidth||!image.naturalHeight)throw Error('图片尺寸无效');if(image.naturalWidth*image.naturalHeight>40_000_000)throw Error('图片超过 4000 万像素，请缩小后重试');
   this.imageRevoke(this.imageObjectUrl);this.imageFile=file;this.imageObjectUrl=url;this.imageLoading=false;this.imageStatus.setText('');this.imageSync();
  }catch(error){this.imageRevoke(url);if(this.imageClosed||run!==this.imageLoadRun)return;this.imageLoading=false;this.imageStatus.setText(`无法读取这张图片：${String(error).replace(/^Error: /,'')}。请尝试其他图片。`);this.imageSync();}
 }
 private imageSync(){if(this.imageClosed)return;const hasImage=!!this.imageFile||!!this.imageDraft.backgroundImagePath;this.imageName.setText(this.imageFile?.name||(this.imageDraft.backgroundImagePath?'已保存的背景图片':'尚未选择图片'));this.imageChoose.setText(hasImage?'更换图片':'选择图片');this.imageChoose.disabled=this.imageBusy||this.imageReadFailed;this.imageRemove.disabled=this.imageBusy||this.imageReadFailed||!hasImage&&!this.imageLoading;this.imageInput.disabled=this.imageBusy||this.imageReadFailed;this.imageSlider.disabled=this.imageBusy||this.imageReadFailed;
  for(const[fit,button]of this.imageFits){button.setAttribute('aria-pressed',String(this.imageDraft.backgroundImageFit===fit));button.disabled=this.imageBusy||this.imageReadFailed;}
  this.imageSlider.value=String(this.imageDraft.backgroundImageOpacity);this.imageStrength.setText(`${this.imageDraft.backgroundImageOpacity}%`);const fit=this.imageDraft.backgroundImageFit;this.imagePreview.style.setProperty('--ts-background-image-fit',fit==='tile'?'auto':fit);this.imagePreview.style.setProperty('--ts-background-image-repeat',fit==='tile'?'repeat':'no-repeat');this.imagePreview.style.setProperty('--ts-background-image-opacity',String(this.imageDraft.backgroundImageOpacity/100));
  try{const url=this.imageObjectUrl||(this.imageDraft.backgroundImagePath?this.imageHost.resource(this.imageDraft.backgroundImagePath):'');this.imagePreview.style.setProperty('--ts-background-image',url?cssImage(url):'none');}catch(error){this.imagePreview.setCssProps({'--ts-background-image':'none'});this.imageStatus.setText(`原背景无法读取，可以更换图片。${String(error).replace(/^Error: /,'')}`);}
  this.imageApply.disabled=this.imageBusy||this.imageLoading||this.imageConflict||this.imageReadFailed||!hasImage&&!this.imageHadSource;this.imageApply.setText(this.imageBusy?'正在应用…':'应用');this.imageReload.hidden=!this.imageConflict&&!this.imageReadFailed;this.imageReload.disabled=this.imageBusy;
 }
 private async imageSave(){if(this.imageClosed||this.imageBusy||this.imageApply.disabled)return;
  try{if(backgroundImageStamp(this.imageHost.preferences())!==this.imageBaseline){this.imageConflict=true;this.imageStatus.setText('背景图片已在其他窗口改变。请载入当前设置后重新调整。');this.imageSync();return;}}catch(error){this.imageStatus.setText(String(error).replace(/^Error: /,''));return;}
  const next=cleanBackgroundImagePreferences(this.imageDraft),file=this.imageFile,run=this.imageRun;this.imageBusy=true;this.imageStatus.setText('正在保存背景图片…');this.imageSync();
  try{await this.imageHost.save(next,file);if(this.imageClosed||run!==this.imageRun)return;this.imageBusy=false;this.close();}
  catch(error){const message=`背景图片保存失败：${String(error).replace(/^Error: /,'')}`;if(this.imageClosed||run!==this.imageRun){new Notice(message);return;}this.imageBusy=false;this.imageStatus.setText(`${message}。可以重试。`);this.imageSync();}
 }
 onClose(){this.imageRun++;this.imageClosed=true;this.imageDiscard();this.imageFits.clear();this.contentEl.onkeydown=null;this.contentEl.empty();}
}
