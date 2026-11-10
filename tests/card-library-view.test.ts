import test from 'node:test';
import assert from 'node:assert/strict';
import {libraryModalHandlers,paintCardLibrary,type LibraryElement,type LibraryElementOptions} from '../src/card-library-view';
import {buildLibraryRecords,emptyLibraryQuery,type LibraryViewQuery} from '../src/card-property-views';

class El implements LibraryElement {
 children:El[]=[];text='';cls='';value='';disabled=false;textContent:string|null=null;onclick:((event:unknown)=>void)|null=null;onchange:((event:unknown)=>void)|null=null;attrs:Record<string,string>={};
 createEl(_tag:string,options:LibraryElementOptions={}){const child=new El();child.text=options.text||'';child.cls=options.cls||'';child.value=options.value||options.attr?.value||'';child.attrs={...(options.attr||{})};if(options.attr?.['data-note-path'])child.attrs['data-note-path']=options.attr['data-note-path'];if(options.attr?.['data-library-view'])child.attrs['data-library-view']=options.attr['data-library-view'];if(options.attr?.['data-status'])child.attrs['data-status']=options.attr['data-status'];this.children.push(child);return child;}
 createDiv(options:LibraryElementOptions|string={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 createSpan(options:LibraryElementOptions|string={}){return this.createEl('span',typeof options==='string'?{cls:options}:options);}
 empty(){this.children=[];}
 all():El[]{return [this,...this.children.flatMap(child=>child.all())];}
}
const records=()=>buildLibraryRecords([
 {path:'Cards/Shade.md',title:'林荫',tags:['#城市'],properties:{thoughtspace_status:'active',topic:'步行'}},
 {path:'Cards/Heat.md',title:'热岛',tags:['#证据'],properties:{thoughtspace_status:'inbox'}},
],[{path:'Boards/Field.md',title:'田野',files:['Cards/Shade.md']}]);

function paint(query:LibraryViewQuery=emptyLibraryQuery()){
 const root=new El(),opened:string[]=[],placed:string[]=[],unlinked:string[]=[],statuses:string[]=[];
 const render=(next:LibraryViewQuery)=>paintCardLibrary(root,records(),next,{setQuery:render,place:path=>placed.push(path),open:path=>opened.push(path),unlink:path=>unlinked.push(path),setStatus:(path,status)=>{statuses.push(path+':'+status);return Promise.resolve();}});
 render(query);
 return {root,opened,placed,unlinked,statuses};
}
const labeled=(root:El,label:string)=>root.all().find(el=>el.attrs['aria-label']===label);

test('list, table and kanban show the same card without a copied body',()=>{
 for(const view of ['list','table','kanban'] as const){
  const {root}=paint({...emptyLibraryQuery(),view});
  assert.equal(root.all().find(el=>el.attrs['data-library-view']===view)!==undefined,true);
  assert.equal(root.all().some(el=>el.attrs['data-note-path']==='Cards/Shade.md'),true);
  assert.equal(root.all().some(el=>el.text.includes('林荫降低路面温度')),false);
 }
 const kanban=paint({...emptyLibraryQuery(),view:'kanban'}).root;
 assert.equal(kanban.all().some(el=>el.attrs['data-status']==='active'&&el.all().some(child=>child.attrs['data-note-path']==='Cards/Shade.md')),true);
});

test('filters and source actions do not delete the note',()=>{
 const {root,opened,placed,unlinked}=paint();
 labeled(root,'标签')!.value='城市';labeled(root,'标签')!.onchange?.(undefined);
 assert.equal(root.all().some(el=>el.attrs['data-note-path']==='Cards/Heat.md'),false);
 assert.equal(root.all().some(el=>el.attrs['data-note-path']==='Cards/Shade.md'),true);
 const card=root.all().find(el=>el.attrs['data-note-path']==='Cards/Shade.md')!;
 labeled(card,'打开源卡片')!.onclick?.(undefined);
 labeled(card,'放置到当前白板')!.onclick?.(undefined);
 labeled(card,'从白板移除引用')!.onclick?.(undefined);
 assert.deepEqual(opened,['Cards/Shade.md']);
 assert.deepEqual(placed,['Cards/Shade.md']);
 assert.deepEqual(unlinked,['Cards/Shade.md']);
 assert.equal(unlinked.some(path=>path.includes('delete')),false);
});

test('status choices stay on the note path',()=>{
 const {root,statuses}=paint({...emptyLibraryQuery(),view:'kanban'});
 const card=root.all().find(el=>el.attrs['data-note-path']==='Cards/Shade.md')!;
 const status=card.all().find(el=>el.attrs['aria-label']==='状态 林荫')!;
 status.value='done';status.onchange?.(undefined);
 assert.deepEqual(statuses,['Cards/Shade.md:done']);
});

test('several boards open the chosen card without splitting the path on a newline',()=>{
 const records=buildLibraryRecords([
  {path:'Cards/Shade.md',title:'林荫',tags:[],properties:{}},
 ],[
  {path:'Boards/A.md',title:'城市降温',files:['Cards/Shade.md'],placements:[{id:'one',file:'Cards/Shade.md'}]},
  {path:'Boards/B "二".md',title:'城市降温',files:['Cards/Shade.md'],placements:[{id:'two',file:'Cards/Shade.md'}]},
 ]);
 const root=new El(),opened:{boardPath:string;nodeId:string}[]=[];
 paintCardLibrary(root,records,emptyLibraryQuery(),{setQuery(){},place(){},open(){},unlink(){},locate:place=>opened.push(place)});
 const menu=labeled(root,'所在白板 林荫')!;
 assert.equal(menu.all().some(el=>el.text==='选择白板'),true);
 assert.equal(menu.all().some(el=>el.text==='城市降温 · 1'),true);
 const values=menu.all().map(el=>el.value).filter(value=>value.startsWith('['));
 assert.equal(values.length,2);
 menu.value=values[0];menu.onchange?.(undefined);
 assert.deepEqual(opened,[{boardPath:'Boards/A.md',boardTitle:'城市降温',nodeId:'one'}]);
 assert.equal(menu.value,'');
 menu.value=values[1];menu.onchange?.(undefined);
 assert.equal(opened[1].boardPath,'Boards/B "二".md');
 assert.equal(opened[1].nodeId,'two');
});

test('a highlight jump button names the page range',()=>{
 const records=buildLibraryRecords([{path:'Cards/Shade.md',title:'林荫',tags:[],properties:{thoughtspace_highlight:'pdf',thoughtspace_source:'Papers/A.pdf',thoughtspace_page:2,thoughtspace_end_page:4}}],[]);
 const root=new El(),opened:string[]=[];
 paintCardLibrary(root,records,emptyLibraryQuery(),{setQuery(){},place(){},open(){},unlink(){},jump:path=>opened.push(path)});
 labeled(root,'回到PDF 第 2–4 页')!.onclick?.(undefined);
 assert.deepEqual(opened,['Cards/Shade.md']);
});

test('an incomplete index can search the remaining boards and still reports a deleted board',async()=>{
 const records=buildLibraryRecords([{path:'Cards/Shade.md',title:'林荫',tags:[],properties:{}}],[],{options:[]},true);
 const root=new El(),searched:string[]=[];
 paintCardLibrary(root,records,emptyLibraryQuery(),{setQuery(){},place(){},open(){},unlink(){},searchUnindexed:async path=>{searched.push(path);}});
 const card=root.all().find(el=>el.attrs['data-note-path']==='Cards/Shade.md')!;
 assert.match(card.all().map(el=>el.text).join('\n'),/引用位置未索引完/);
 labeled(card,'查找其余白板')!.onclick?.(undefined);
 assert.deepEqual(searched,['Cards/Shade.md']);
 const notices:string[]=[];
 const handlers=libraryModalHandlers({place(){},open(){},unlink(){},choiceOptions:['主张'],locate:async()=>{throw Error('白板已移动或删除');},searchUnindexed:async()=>{}},()=>{},error=>notices.push(error instanceof Error?error.message:String(error)),()=>{});
 assert.deepEqual(handlers.choiceOptions,['主张']);
 handlers.locate!({boardPath:'Boards/Gone.md',boardTitle:'已删',nodeId:'missing'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(notices,['白板已移动或删除']);
});
