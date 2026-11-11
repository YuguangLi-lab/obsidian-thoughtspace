import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {libraryModalHandlers,paintCardLibrary,type LibraryElement,type LibraryElementOptions} from '../src/card-library-view';
import {buildLibraryRecords,emptyLibraryQuery,uncategorizedChoice,type LibraryViewQuery} from '../src/card-property-views';

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

test('uncategorized is a category filter in list, table, and kanban',()=>{
 const records=buildLibraryRecords([
  {path:'Cards/Shade.md',title:'林荫',tags:[],properties:{thoughtspace_choice:'证据',thoughtspace_status:'active'}},
  {path:'Cards/Heat.md',title:'热岛',tags:[],properties:{thoughtspace_status:'inbox'}},
 ],[],{options:['证据']});
 const paint=(view:'list'|'table'|'kanban',choice:string)=>{
  const root=new El();
  paintCardLibrary(root,records,{...emptyLibraryQuery(),view,choice},{setQuery(){},place(){},open(){},unlink(){},choiceOptions:['证据']});
  return root;
 };
 const list=paint('list','');
 const menu=labeled(list,'分类')!;
 assert.equal(menu.all().some(el=>el.text==='未分类'&&el.value===uncategorizedChoice),true);
 assert.match(list.all().find(el=>el.attrs['data-note-path']==='Cards/Heat.md')!.all().find(el=>el.cls==='ts-library-excerpt')!.text,/未分类/);
 assert.match(list.all().find(el=>el.attrs['data-note-path']==='Cards/Shade.md')!.all().find(el=>el.cls==='ts-library-excerpt')!.text,/证据/);
 for(const view of ['list','table','kanban'] as const){
  const root=paint(view,uncategorizedChoice);
  assert.equal(root.all().some(el=>el.attrs['data-note-path']==='Cards/Shade.md'),false);
  assert.equal(root.all().some(el=>el.attrs['data-note-path']==='Cards/Heat.md'),true);
 }
 const table=paint('table',uncategorizedChoice);
 assert.equal(table.all().some(el=>el.text==='分类'),true);
 assert.equal(table.all().find(el=>el.attrs['data-note-path']==='Cards/Heat.md')!.children.some(el=>el.text==='未分类'),true);
 assert.match(paint('kanban',uncategorizedChoice).all().find(el=>el.cls==='ts-library-tags')!.text,/未分类/);
 const empty=new El();
 paintCardLibrary(empty,records.filter(record=>record.choice),{...emptyLibraryQuery(),choice:uncategorizedChoice},{setQuery(){},place(){},open(){},unlink(){},choiceOptions:['证据']});
 assert.equal(empty.all().some(el=>el.text==='没有符合条件的未分类卡片。'),true);
});

test('switching list, table, and kanban keeps the query, filters, and selected ids',()=>{
 const cards=records(),root=new El();
 let current:LibraryViewQuery={...emptyLibraryQuery(),query:'林荫',type:'note',tag:'城市',board:'Boards/Field.md',status:'active',selected:['Cards/Shade.md']};
 const render=(next:LibraryViewQuery)=>{current=next;paintCardLibrary(root,cards,next,{setQuery:render,place(){},open(){},unlink(){}});};
 render(current);
 for(const label of ['表格','看板','列表']){
  labeled(root,label)!.onclick?.(undefined);
  assert.equal(current.query,'林荫');
  assert.equal(current.type,'note');
  assert.equal(current.tag,'城市');
  assert.equal(current.board,'Boards/Field.md');
  assert.equal(current.status,'active');
  assert.deepEqual(current.selected,['Cards/Shade.md']);
  const row=root.all().find(el=>el.attrs['data-note-path']==='Cards/Shade.md')!;
  assert.match(row.cls,/\bis-selected\b/);
  assert.equal((row.attrs.style||'').includes('background'),false);
  assert.equal(row.all().some(el=>el.cls.split(' ').includes('ts-library-selected-mark')),true);
 }
 const css=readFileSync('src/workflow.css','utf8');
 assert.match(css,/\.ts-database :is\(\.ts-library-card,\.ts-db-table tr\)\.is-selected\{[^}]*background:transparent/);
 assert.match(css,/\.ts-database \.ts-library-title\{[^}]*font-size:var\(--ts-e-title-size\)/);
 assert.match(css,/\.ts-database \.ts-library-excerpt\{[^}]*font-size:var\(--ts-e-body-size\)/);
 assert.match(css,/\.ts-database \.ts-library-tags\{[^}]*font-size:var\(--ts-e-meta-size\)/);
});

test('a truncated table title stays available on hover and keyboard focus',()=>{
 const title='林荫降低路面温度并且这条标题需要在表格里保持可检索的全文';
 const cards=buildLibraryRecords([{path:'Cards/Shade.md',title,tags:[],properties:{}}],[]);
 const root=new El();
 paintCardLibrary(root,cards,{...emptyLibraryQuery(),view:'table'},{setQuery(){},place(){},open(){},unlink(){}});
 const cell=root.all().find(el=>el.cls.split(' ').includes('ts-library-title-cell'))!;
 assert.equal(cell.attrs.title,title);
 assert.equal(cell.attrs.tabindex,'0');
 assert.equal(cell.attrs['aria-label'],title);
 const css=readFileSync('src/workflow.css','utf8');
 assert.match(css,/\.ts-database \.ts-db-table \.ts-library-title-cell\{[^}]*text-overflow:ellipsis/);
 assert.match(css,/\.ts-database \.ts-db-table \.ts-library-title-cell:focus\{[^}]*white-space:normal/);
});

test('table selection outline and mark are painted on cells and are not clipped by the title ellipsis',()=>{
 const cards=records(),root=new El();
 paintCardLibrary(root,cards,{...emptyLibraryQuery(),view:'table',selected:['Cards/Shade.md']},{setQuery(){},place(){},open(){},unlink(){}});
 const row=root.all().find(el=>el.attrs['data-note-path']==='Cards/Shade.md')!;
 const title=row.children.find(el=>el.cls.split(' ').includes('ts-library-title-cell'))!;
 const hosts=row.children.filter(el=>el.children.some(child=>child.cls.split(' ').includes('ts-library-selected-mark')));
 assert.equal(title.children.some(el=>el.cls.split(' ').includes('ts-library-selected-mark')),false);
 assert.equal(hosts.length,1);
 assert.notEqual(hosts[0],title);
 const css=readFileSync('src/workflow.css','utf8');
 assert.match(css,/\.ts-db-table tr\.is-selected>td\{[^}]*background:transparent[^}]*box-shadow:[^;]*var\(--ts-e-selected\)/);
 assert.match(css,/\.ts-db-table tr\.is-selected>td:first-child\{[^}]*box-shadow:[^;]*var\(--ts-e-selected\)/);
 assert.match(css,/\.ts-db-table tr\.is-selected>td:last-child\{[^}]*overflow:visible[^}]*position:relative/);
 assert.match(css,/\.ts-database \.ts-db-table \.ts-library-title-cell\{[^}]*overflow:hidden/);
});

test('card library kanban lays out as flex columns on a wash board with paper lanes',()=>{
 const css=readFileSync('src/workflow.css','utf8');
 const board=css.match(/\.ts-db-kanban\{[^}]*\}/)?.[0]??'';
 const lane=css.match(/\.ts-db-lane\{[^}]*\}/)?.[0]??'';
 assert.match(board,/display:flex/);
 assert.match(board,/background:var\(--ts-e-wash\)/);
 assert.match(lane,/flex:1 0 270px/);
 assert.match(lane,/background:var\(--ts-e-paper\)/);
});
