import {Modal,Notice,type App} from 'obsidian';
import {libraryModalHandlers,paintCardLibrary,type LibraryViewHandlers} from './card-library-view';
import {emptyLibraryQuery,type LibraryCardRecord,type LibraryViewQuery} from './card-property-views';
import {themeSurface} from './ui-tokens';

export interface CardLibraryHost extends Omit<LibraryViewHandlers,'setQuery'> {
 records():readonly LibraryCardRecord[];
 limitNote?:string;
}
/** Dedicated browser for the card library. Closing it does not delete notes. */
export class CardLibraryModal extends Modal {
 private query:LibraryViewQuery=emptyLibraryQuery();
 constructor(app:App,private host:CardLibraryHost){super(app);}
 onOpen(){
  this.modalEl.addClass('ts-database-modal');
  themeSurface(this.modalEl);
  this.titleEl.setText('卡片库');
  this.contentEl.addClass('ts-database');
  this.refresh();
 }
 onClose(){this.contentEl.empty();}
 refresh(){this.paint();}
 private paint(){
  paintCardLibrary(this.contentEl as unknown as Parameters<typeof paintCardLibrary>[0],this.host.records(),this.query,libraryModalHandlers(this.host,next=>{this.query=next;this.paint();},error=>{new Notice(error instanceof Error?error.message:String(error));},()=>{if(this.modalEl.isConnected)this.paint();}));
  if(this.host.limitNote)this.contentEl.createDiv({cls:'ts-muted',text:this.host.limitNote});
 }
}
