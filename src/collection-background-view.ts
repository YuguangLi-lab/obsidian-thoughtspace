import {App,Component,Menu,Modal,Notice} from 'obsidian';
import {backgroundOptions,type BoardBackground} from './board-background';
import {cleanCollectionBackground,collectionBackgroundStamp,defaultCollectionBackground} from './collection-background';
import {PaperSettingsModal} from './paper-settings-view';
import {BackgroundImageModal} from './background-image-view';
import {themePluginMenu} from './ui-tokens';

export interface CollectionBackgroundHost{
 preferences:()=>BoardBackground;language:()=> 'zh-CN'|'en';
 save:(next:BoardBackground,baseline:string)=>Promise<void>;
 resource:(path:string)=>string;exists:(path:string)=>Promise<boolean>;
 store:(file:File,current:()=>boolean)=>Promise<string>;
}
/** The existing board dialogs retain their cancellation, conflict and failure UI. */
export class CollectionBackgroundControls extends Component{
 private menu?:Menu;private modal?:Modal;private stopped=false;
 constructor(private app:App,private host:CollectionBackgroundHost){super();}
 onunload(){this.stopped=true;this.menu?.hide();this.modal?.close();this.menu=undefined;this.modal=undefined;}
 show(anchor:HTMLElement,current:()=>boolean){
  const available=()=>!this.stopped&&anchor.isConnected&&!anchor.ownerDocument.defaultView?.closed&&current();
  if(!available())return;this.menu?.hide();const menu=themePluginMenu(new Menu()).setUseNativeMenu(false);this.menu=menu;anchor.setAttribute('aria-expanded','true');
  const run=(task:()=>Promise<void>)=>{void task().catch(error=>new Notice(String(error).replace(/^Error: /,'')));};
  for(const [value,label,icon]of backgroundOptions)menu.addItem(item=>item.setTitle(label).setIcon(icon).setChecked(this.host.preferences().canvasBackground===value).onClick(()=>run(async()=>{
   if(!available())return;const previous=this.host.preferences();
   if(value==='image'&&!previous.backgroundImagePath){this.settings('image',anchor,available);return;}
   if(value==='image'&&!await this.host.exists(previous.backgroundImagePath)){if(available())this.settings('image',anchor,available);return;}
   if(available())await this.host.save(cleanCollectionBackground({...previous,canvasBackground:value}),collectionBackgroundStamp(previous));
  })));
  menu.addSeparator();menu.addItem(item=>item.setTitle('自定义纸张…').setIcon('palette').onClick(()=>{if(available())this.settings('paper',anchor,available);}));
  menu.addItem(item=>item.setTitle('设置背景图片…').setIcon('image-plus').onClick(()=>{if(available())this.settings('image',anchor,available);}));
  menu.addItem(item=>item.setTitle('恢复暖白纸张').setIcon('rotate-ccw').onClick(()=>run(async()=>{if(available())await this.host.save({...defaultCollectionBackground},collectionBackgroundStamp(this.host.preferences()));})));
  menu.onHide(()=>{if(this.menu===menu){this.menu=undefined;anchor.setAttribute('aria-expanded','false');}});
  const rect=anchor.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom+4},anchor.ownerDocument);
 }
 private settings(kind:'paper'|'image',anchor:HTMLElement,available:()=>boolean){
  this.modal?.close();const doc=anchor.ownerDocument;
  const current=()=>!this.stopped&&available()&&this.modal===modal;
  const preferences=()=>{if(!current())throw Error('收集页面已关闭，请重新打开背景设置');return this.host.preferences();};
  const save=async(value:object,file?:File)=>{
   const previous=preferences(),baseline=collectionBackgroundStamp(previous),next=cleanCollectionBackground({...previous,...value,canvasBackground:kind});
   const ready=()=>current()&&collectionBackgroundStamp(this.host.preferences())===baseline;
   if(file)next.backgroundImagePath=await this.host.store(file,ready);
   if(next.canvasBackground==='image'){
    if(next.backgroundImagePath&&!await this.host.exists(next.backgroundImagePath))throw Error('背景图片已不存在，请重新选择图片');
    if(!next.backgroundImagePath)next.canvasBackground='plain';
   }
   if(!ready())throw Error('收集背景已改变，请重新打开设置');
   await this.host.save(next,baseline);
  };
  const stamp=()=>collectionBackgroundStamp(preferences());
  const modal=kind==='paper'?new PaperSettingsModal(this.app,{stamp,language:this.host.language(),preferences,save}):new BackgroundImageModal(this.app,{stamp,language:this.host.language(),preferences,resource:this.host.resource,save});
  const open=modal.onOpen.bind(modal),close=modal.onClose.bind(modal);
  modal.onOpen=()=>{if(!current()){modal.close();return;}if(modal.containerEl.ownerDocument!==doc)doc.body.appendChild(modal.containerEl);open();if(kind==='image')modal.contentEl.createEl('p',{cls:'ts-background-file-hint',text:'收集文字区会保留柔和底纸，保证背景图片上的文字清晰。'});};
  modal.onClose=()=>{close();if(this.modal===modal)this.modal=undefined;};this.modal=modal;modal.open();
 }
}
