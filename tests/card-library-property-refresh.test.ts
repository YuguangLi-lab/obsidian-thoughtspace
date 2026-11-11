import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {transformSync} from 'esbuild';
import {libraryModalHandlers,type LibraryViewHandlers} from '../src/card-library-view';
import {buildLibraryRecords,filterLibraryCards,emptyLibraryQuery,libraryKanban,mergeBoardSources,type LibraryCardRecord} from '../src/card-property-views';
import {choiceKey,choiceValue} from '../src/choice-field';
import {propertyKeys,readProperties} from '../src/database';

const source=readFileSync('src/main.ts','utf8');
const take=(from:string,to:string)=>{
 const start=source.indexOf(from),end=source.indexOf(to,start);
 assert.ok(start>=0&&end>start,from);
 return source.slice(start,end);
};
const methods=take('  private cardLibraryRun=0;','  private firstSession?')+take('  private async setLibrary','  openDatabase(view?: BoardView)');

function fixture(){
 class TFile{path='Cards/Plan.md';basename='计划';extension='md';stat={mtime:1,size:10};}
 const file=new TFile();
 const inbox={ [propertyKeys.status]:'inbox',[choiceKey]:'主张',reference:'保留属性' };
 let disk:Record<string,unknown>={...inbox},cached:Record<string,unknown>={...inbox},failure=false,current=file;
 const errors:unknown[]=[];
 type Host=Omit<LibraryViewHandlers,'setQuery'>&{records():LibraryCardRecord[]};
 class CardLibraryModal{
  modalEl={isConnected:false};
  records:LibraryCardRecord[]=[];
  handlers:LibraryViewHandlers;
  constructor(_app:unknown,private host:Host){
   this.handlers=libraryModalHandlers(host,()=>{},error=>errors.push(error),()=>{if(this.modalEl.isConnected)this.refresh();});
  }
  open(){this.modalEl.isConnected=true;this.refresh();}
  refresh(){this.records=this.host.records();}
 }
 const deps={TFile,CardLibraryModal,choiceKey,choiceValue,propertyKeys,readProperties,buildLibraryRecords,mergeBoardSources,
  parseRecord:JSON.parse,isWorkspaceFile:()=>true,isBoardFile:()=>false,isRecord:(value:unknown)=>!!value&&typeof value==='object',getAllTags:()=>['#计划'],
  createLibraryBoardReader:()=>async()=>({boards:[],failed:[]}),libraryIndexFiles:()=>({files:[],omitted:[]})};
 const Plugin=new Function(...Object.keys(deps),transformSync(`return class Plugin{${methods}}`,{loader:'ts'}).code)(...Object.values(deps));
 const plugin=new Plugin();
 const write=async(key:string,value:string,expected:string)=>{
  assert.equal(expected,JSON.stringify(disk));
  if(failure)throw Error('写入失败');
  if(value)disk[key]=value;else delete disk[key];
  current.stat={mtime:current.stat.mtime+1,size:JSON.stringify(disk).length};
 };
 Object.assign(plugin,{app:{vault:{getMarkdownFiles:()=>[current],getFiles:()=>[current],getAbstractFileByPath:()=>current,read:async()=>JSON.stringify(disk)},metadataCache:{getFileCache:()=>({frontmatter:cached})}},
  settings:{choiceField:{options:['主张','证据']}},propertyStore:{update:(_file:TFile,_field:string,value:string,expected:string)=>write(propertyKeys.status,value,expected),updateCustom:(_file:TFile,_field:unknown,value:string,expected:string)=>write(choiceKey,value,expected)}});
 return {file,plugin,errors,catchUp(){cached={...disk};},external(next:Record<string,unknown>){disk={...disk,...next};current.stat={mtime:current.stat.mtime+1,size:JSON.stringify(disk).length};cached={...disk};},replaceFile(){const replacement=new TFile();replacement.stat={...current.stat};current=replacement;cached={...inbox};},fail(){failure=true;},cached:()=>cached};
}

test('successful status and choice writes refresh library filters while the native cache is stale',async()=>{
 const f=fixture(),modal=await f.plugin.openCardLibrary() as {records:LibraryCardRecord[];handlers:LibraryViewHandlers;refresh():void};
 const before=modal.records;
 assert.equal(before[0].status,'inbox');
 await modal.handlers.setStatus!(f.file.path,'active');
 assert.notEqual(modal.records,before);
 assert.equal(f.cached()[propertyKeys.status],'inbox');
 assert.equal(libraryKanban(modal.records).find(column=>column.id==='active')?.cards.length,1);
 assert.equal(filterLibraryCards(modal.records,{...emptyLibraryQuery(),query:'进行中'}).length,1);
 await modal.handlers.setChoice!(f.file.path,'证据');
 assert.equal(f.cached()[choiceKey],'主张');
 assert.equal(filterLibraryCards(modal.records,{...emptyLibraryQuery(),status:'active',choice:'证据'}).length,1);
 assert.equal(modal.records[0].custom.reference,'保留属性');
 await modal.handlers.setChoice!(f.file.path,'');
 assert.equal(modal.records[0].choice,'');
 modal.refresh();
 assert.equal(modal.records[0].status,'active');
 assert.equal(modal.records[0].choice,'');
 f.catchUp();modal.refresh();
 assert.equal(modal.records[0].status,'active');
 f.external({[propertyKeys.status]:'done',[choiceKey]:'主张'});modal.refresh();
 assert.equal(modal.records[0].status,'done');
 assert.equal(modal.records[0].choice,'主张');
 assert.deepEqual(f.errors,[]);
});

test('library property refresh ignores failed writes and replacement files at the same path',async()=>{
 const f=fixture(),modal=await f.plugin.openCardLibrary() as {records:LibraryCardRecord[];handlers:LibraryViewHandlers;refresh():void};
 await modal.handlers.setStatus!(f.file.path,'active');
 assert.equal(modal.records[0].status,'active');
 f.fail();await modal.handlers.setStatus!(f.file.path,'done');
 assert.equal(f.errors.length,1);
 assert.equal(modal.records[0].status,'active');
 f.replaceFile();modal.refresh();
 assert.equal(modal.records[0].status,'inbox');
});

test('a newer edit replaces the overlay even if the index skipped the earlier committed values',async()=>{
 const f=fixture(),modal=await f.plugin.openCardLibrary() as {records:LibraryCardRecord[];handlers:LibraryViewHandlers;refresh():void};
 await modal.handlers.setStatus!(f.file.path,'active');
 assert.equal(f.cached()[propertyKeys.status],'inbox');
 f.external({[propertyKeys.status]:'done',[choiceKey]:'证据'});modal.refresh();
 assert.equal(modal.records[0].status,'done');
 assert.equal(modal.records[0].choice,'证据');
});
