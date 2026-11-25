import {Modal,Notice,Scope,getLanguage,type App} from 'obsidian';
import {libraryModalHandlers,mountCardLibrary,type LibraryElement,type LibraryViewHandlers} from './card-library-view';
import {emptyLibraryQuery,type LibraryCardRecord,type LibraryViewQuery} from './card-property-views';
import {themeSurface} from './ui-tokens';
import {cardLibraryLabels,resolveUiLanguage} from './ui-i18n';
import type {SettingsLanguagePreference} from './settings-preferences';

export interface CardLibraryHost extends Omit<LibraryViewHandlers,'setQuery'|'language'> {
 records():readonly LibraryCardRecord[];
 indexing?:boolean;
 limitNote?:string;
 language?:SettingsLanguagePreference;
}
/** Dedicated browser for the card library. Closing it does not delete notes. */
export class CardLibraryModal extends Modal {
 private query:LibraryViewQuery=emptyLibraryQuery();
 private view?:ReturnType<typeof mountCardLibrary>;
 private records:readonly LibraryCardRecord[]=[];
 constructor(app:App,private host:CardLibraryHost){
  super(app);
  // Obsidian sees Escape before a DOM keydown can reach the card's popover.
  this.scope=new Scope(this.scope);
  this.scope.register([],'Escape',event=>{
   const view=this.view;
   if(!view||event.isComposing||Reflect.get(event,'keyCode')===229)return;
   event.preventDefault();event.stopPropagation();
   if(!view.dismissActions())this.close();
   return false;
  });
 }
 onOpen(){
  const lang=resolveUiLanguage(this.host.language,typeof getLanguage==='function'?getLanguage():'zh-CN');
  this.modalEl.addClass('ts-database-modal','ts-card-library-modal');
  themeSurface(this.modalEl);
  this.titleEl.setText(cardLibraryLabels(lang).modalTitle);
  this.contentEl.addClass('ts-database','ts-card-library');
  this.view=mountCardLibrary(this.contentEl as unknown as LibraryElement,libraryModalHandlers({...this.host,language:lang},next=>{
   this.query=next;this.paint();
  },error=>{new Notice(error instanceof Error?error.message:String(error));},()=>{if(this.modalEl.isConnected)this.refresh();}));
  this.refresh();
 }
 onClose(){this.view?.close();this.view=undefined;this.records=[];this.contentEl.empty();}
 refresh(){
  if(!this.view)return;
  this.records=this.host.records();this.paint();
 }
 private paint(){this.view?.update(this.records,this.query,{indexing:this.host.indexing,limitNote:this.host.limitNote});}
}
