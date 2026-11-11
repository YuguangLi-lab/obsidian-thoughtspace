import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {libraryModalHandlers,mountCardLibrary,paintCardLibrary,type LibraryElement,type LibraryElementOptions} from '../src/card-library-view';
import {buildLibraryRecords,emptyLibraryQuery,uncategorizedChoice,type LibraryViewQuery} from '../src/card-property-views';

type MockDocument={activeElement?:El};
class El implements LibraryElement {
 children:El[]=[];text='';tag='';cls='';value='';disabled=false;listeners=new Map<string,(event:Event)=>void>();textContent:string|null=null;onclick:((event:unknown)=>void)|null=null;onchange:((event:unknown)=>void)|null=null;attrs:Record<string,string>={};
 parent?:El;scrollTop=0;scrollLeft=0;
 constructor(readonly ownerDocument?:MockDocument){}
 get isConnected():boolean{return this.tag===''||!!this.parent?.isConnected;}
 get dataset(){return {libraryFocus:this.attrs['data-library-focus']};}
 getAttribute(name:string){return this.attrs[name];}
 contains(child:El){return this.all().includes(child);}
 querySelectorAll(selector:string){return selector==='[data-library-focus]'?this.all().filter(el=>el.attrs['data-library-focus']):[];}
 focus(){if(this.ownerDocument)this.ownerDocument.activeElement=this;}
 createEl(_tag:string,options:LibraryElementOptions={}){const child=new El(this.ownerDocument);child.parent=this;child.tag=_tag;child.text=options.text||'';child.cls=options.cls||'';child.value=options.value||options.attr?.value||'';child.attrs={...(options.attr||{})};if(options.attr?.['data-note-path'])child.attrs['data-note-path']=options.attr['data-note-path'];if(options.attr?.['data-library-view'])child.attrs['data-library-view']=options.attr['data-library-view'];if(options.attr?.['data-status'])child.attrs['data-status']=options.attr['data-status'];this.children.push(child);return child;}
 createDiv(options:LibraryElementOptions|string={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 createSpan(options:LibraryElementOptions|string={}){return this.createEl('span',typeof options==='string'?{cls:options}:options);}
 setAttribute(name:string,value:string){this.attrs[name]=value;if(name==='class')this.cls=value;}
 removeAttribute(name:string){delete this.attrs[name];}
 addEventListener(type:string,listener:(event:Event)=>void){this.listeners.set(type,listener);}
 emit(type:string,event:object={}){this.listeners.get(type)?.(event as Event);}
 empty(){for(const child of this.children)child.parent=undefined;this.children=[];}
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
const labeled=(root:El,label:string)=>root.all().find(el=>el.attrs['aria-label']===label)??root.all().find(el=>el.tag==='button'&&el.text===label);
const more=(root:El,title:string)=>{labeled(root,'更多操作：'+title)!.onclick?.(undefined);return root.all().find(el=>el.cls==='ts-library-more-menu')!;};

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
 labeled(card,'打开源卡片：林荫')!.onclick?.(undefined);
 labeled(card,'放置到当前白板')!.onclick?.(undefined);
 labeled(more(root,'林荫'),'从白板移除引用')!.onclick?.(undefined);
 assert.deepEqual(opened,['Cards/Shade.md']);
 assert.deepEqual(placed,['Cards/Shade.md']);
 assert.deepEqual(unlinked,['Cards/Shade.md']);
 assert.equal(unlinked.some(path=>path.includes('delete')),false);
});

test('status choices stay on the note path',()=>{
 const {root,statuses}=paint({...emptyLibraryQuery(),view:'kanban'});
 const card=root.all().find(el=>el.attrs['data-note-path']==='Cards/Shade.md')!;
 assert.equal(labeled(card,'状态 林荫'),undefined);
 const status=labeled(more(root,'林荫'),'状态 林荫')!;
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
 const menu=labeled(more(root,'林荫'),'所在白板 林荫')!;
 assert.equal(menu.all().some(el=>el.text==='选择白板'),true);
 assert.equal(menu.all().some(el=>el.text==='城市降温 · 1'),true);
 const values=menu.all().filter(el=>el.tag==='option'&&el.value).map(el=>el.value);
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
 labeled(more(root,'林荫'),'查找其余白板')!.onclick?.(undefined);
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
 assert.match(list.all().find(el=>el.attrs['data-note-path']==='Cards/Heat.md')!.all().find(el=>el.cls==='ts-library-excerpt')!.all().map(el=>el.text).join(' '),/未分类/);
 assert.match(list.all().find(el=>el.attrs['data-note-path']==='Cards/Shade.md')!.all().find(el=>el.cls==='ts-library-excerpt')!.all().map(el=>el.text).join(' '),/证据/);
 for(const view of ['list','table','kanban'] as const){
  const root=paint(view,uncategorizedChoice);
  assert.equal(root.all().some(el=>el.attrs['data-note-path']==='Cards/Shade.md'),false);
  assert.equal(root.all().some(el=>el.attrs['data-note-path']==='Cards/Heat.md'),true);
 }
 const table=paint('table',uncategorizedChoice);
 assert.equal(table.all().some(el=>el.text==='分类'),true);
 assert.equal(table.all().find(el=>el.attrs['data-note-path']==='Cards/Heat.md')!.children.some(el=>el.text==='未分类'),true);
 assert.match(paint('kanban',uncategorizedChoice).all().find(el=>el.cls==='ts-library-tags')!.all().map(el=>el.text).join(' '),/未分类/);
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
 const button=cell.all().find(el=>el.tag==='button'&&el.cls==='ts-library-title')!;
 assert.equal(button.attrs.title,title);
 assert.equal(button.attrs['aria-label'],'打开源卡片：'+title);
 const css=readFileSync('src/card-library-polish.css','utf8');
 assert.match(css,/\.ts-db-table \.ts-library-title:not\(:focus-visible\)\s*\{[^}]*text-overflow:\s*ellipsis/);
});

test('table selection stays with the pinned title and remains directly toggleable',()=>{
 const cards=records(),root=new El();
 let query={...emptyLibraryQuery(),view:'table' as const,selected:['Cards/Shade.md'] as readonly string[]} as LibraryViewQuery;
 const view=mountCardLibrary(root,{setQuery(next){query=next;view.update(cards,query);},place(){},open(){},unlink(){}});
 view.update(cards,query);
 const row=root.all().find(el=>el.attrs['data-note-path']==='Cards/Shade.md')!;
 const title=row.children.find(el=>el.cls.split(' ').includes('ts-library-title-cell'))!;
 const selection=labeled(title,'选择卡片：林荫')!;
 assert.equal(selection.attrs['aria-pressed'],'true');
 assert.equal(selection.textContent,'✓');
 selection.onclick?.(undefined);
 assert.deepEqual(query.selected,[]);
 assert.equal(labeled(root,'选择卡片：林荫')?.attrs['aria-pressed'],'false');
 const css=readFileSync('src/card-library-polish.css','utf8');
 assert.match(css,/\.ts-library-title-cell\s*\{[^}]*position:\s*sticky/);
});

test('dismissing row actions keeps the card library mounted and restores its trigger focus',()=>{
 const document:MockDocument={},cards=records(),root=new El(document);
 const view=mountCardLibrary(root,{setQuery(){},place(){},open(){},unlink(){}});
 view.update(cards,emptyLibraryQuery());
 const trigger=labeled(root,'更多操作：林荫')!,menu=more(root,'林荫');
 labeled(menu,'从白板移除引用')!.focus();
 assert.equal(trigger.attrs['aria-expanded'],'true');
 assert.equal(view.dismissActions(),true);
 assert.equal(trigger.attrs['aria-expanded'],'false');
 assert.equal(menu.attrs.hidden,'');
 assert.equal(document.activeElement,trigger);
 assert.equal(view.dismissActions(),false);
 assert.ok(labeled(root,'搜索卡片库'));
});

test('live search waits for Chinese IME composition and keeps the original field mounted',()=>{
 const cards=records(),root=new El(),queries:string[]=[];
 const view=mountCardLibrary(root,{setQuery(next){queries.push(next.query);view.update(cards,next);},place(){},open(){},unlink(){}});
 view.update(cards,emptyLibraryQuery());
 const search=labeled(root,'搜索卡片库')!;
 search.emit('compositionstart');
 search.value='lin';search.emit('input',{isComposing:true});
 assert.deepEqual(queries,[]);
 view.update(cards,emptyLibraryQuery(),{indexing:true});
 assert.equal(search.value,'lin');
 search.value='林荫';search.emit('compositionend');search.emit('input');
 assert.deepEqual(queries,['林荫']);
 assert.equal(labeled(root,'搜索卡片库'),search);
 assert.equal(root.all().some(el=>el.attrs['data-note-path']==='Cards/Heat.md'),false);
});

test('row focus and scroll survive updates, with separate scroll positions for each view',()=>{
 const document:MockDocument={},cards=records(),root=new El(document);
 let current=emptyLibraryQuery();
 const view=mountCardLibrary(root,{setQuery(next){current=next;view.update(cards,next);},place(){},open(){},unlink(){}});
 view.update(cards,current);
 const results=root.all().find(el=>el.attrs['data-library-view']==='list')!;
 results.scrollTop=120;
 const button=labeled(root,'选择卡片：林荫')!;
 button.focus();
 button.onclick?.(undefined);
 assert.equal(document.activeElement,button);
 assert.equal(labeled(root,'选择卡片：林荫'),button);
 assert.equal(results.scrollTop,120);
 const table=labeled(root,'表格')!;
 table.focus();
 table.onclick?.(undefined);
 assert.equal(document.activeElement,table);
 assert.equal(results.scrollTop,0);
 results.scrollLeft=160;
 labeled(root,'列表')!.onclick?.(undefined);
 assert.equal(results.scrollTop,120);
 assert.equal(results.scrollLeft,0);
 table.onclick?.(undefined);
 assert.equal(results.scrollLeft,160);
});

test('selecting a card in a large filtered library does not rescan records or recreate result controls',()=>{
 const cards=buildLibraryRecords(Array.from({length:1000},(_,i)=>({
  path:`Cards/Observation-${i}.md`,title:`记录 ${i}`,tags:['#观察'],properties:{},
 })),[]);
 const document:MockDocument={};
 let current:LibraryViewQuery={...emptyLibraryQuery(),tag:'观察',query:'记录'};
 let scanned=0;
 const tracked=new Proxy(cards,{
  get(target,key,receiver){
   if(typeof key==='string'&&/^\d+$/.test(key))scanned++;
   return Reflect.get(target,key,receiver);
  },
 });
 const mountRoot=new El(document);
 const view=mountCardLibrary(mountRoot,{setQuery(next){current=next;view.update(tracked,next);},place(){},open(){},unlink(){}});
 view.update(tracked,current);
 const rows=mountRoot.all().filter(el=>el.attrs['data-note-path']);
 assert.equal(rows.length,1000);
 const pick=labeled(mountRoot,'选择卡片：记录 500')!,other=labeled(mountRoot,'选择卡片：记录 999')!;
 const filterChip=labeled(mountRoot,'清除标签：#观察');
 const panel=more(mountRoot,'记录 999'),trigger=labeled(mountRoot,'更多操作：记录 999')!;
 const menuFocus=labeled(panel,'从白板移除引用')!;
 menuFocus.focus();
 scanned=0;
 pick.onclick?.(undefined);
 assert.equal(scanned,0);
 assert.deepEqual(current.selected,['Cards/Observation-500.md']);
 assert.equal(pick.attrs['aria-pressed'],'true');
 assert.equal(pick.textContent,'✓');
 assert.equal(other.attrs['aria-pressed'],'false');
 assert.deepEqual(mountRoot.all().filter(el=>el.attrs['data-note-path']).map((row,index)=>row===rows[index]),Array(1000).fill(true));
 assert.equal(labeled(mountRoot,'清除标签：#观察'),filterChip);
 assert.equal(trigger.attrs['aria-expanded'],'true');
 assert.equal(document.activeElement,menuFocus);
 assert.equal(mountRoot.all().find(el=>el.cls==='ts-db-count')?.textContent,'1000 张卡片 · 已选 1');
 pick.onclick?.(undefined);
 assert.equal(scanned,0);
 assert.equal(pick.attrs['aria-pressed'],'false');
 assert.equal(pick.textContent,'');
 assert.equal(mountRoot.all().find(el=>el.cls==='ts-db-count')?.textContent,'1000 张卡片');
});

test('replacing indexed records updates visible rows and retains selected state',()=>{
 const initial=records(),root=new El(),query={...emptyLibraryQuery(),selected:['Cards/Shade.md']};
 const view=mountCardLibrary(root,{setQuery(){},place(){},open(){},unlink(){}});
 view.update(initial,query,{indexing:true});
 const oldRow=labeled(root,'选择卡片：林荫');
 const renamed=initial.map(record=>record.path==='Cards/Shade.md'?{...record,title:'林荫调查'}:record);
 view.update(renamed,query);
 assert.equal(oldRow?.isConnected,false);
 assert.equal(labeled(root,'选择卡片：林荫调查')?.attrs['aria-pressed'],'true');
 assert.equal(root.all().find(el=>el.cls==='ts-library-index-status')?.attrs.hidden,'');
});

test('active filters can be removed individually, or reset without losing view or selection',()=>{
 const cards=records(),root=new El();
 let query:LibraryViewQuery={...emptyLibraryQuery(),view:'kanban',type:'note',tag:'城市',query:'林荫',selected:['Cards/Shade.md']};
 const view=mountCardLibrary(root,{setQuery(next){query=next;view.update(cards,query);},place(){},open(){},unlink(){}});
 view.update(cards,query);
 labeled(root,'清除标签：#城市')!.onclick?.(undefined);
 assert.equal(query.tag,'');assert.equal(query.query,'林荫');assert.equal(query.type,'note');
 labeled(root,'清除全部')!.onclick?.(undefined);
 assert.deepEqual(query,{...emptyLibraryQuery(),view:'kanban',selected:['Cards/Shade.md']});
 assert.equal(root.all().filter(el=>el.attrs['data-note-path']).length,2);
});

test('search without results offers reset and pending index status does not claim a card is unplaced',()=>{
 const cards=records(),root=new El();
 const view=mountCardLibrary(root,{setQuery(next){view.update(cards,next,{indexing:true});},place(){},open(){},unlink(){}});
 view.update(cards,{...emptyLibraryQuery(),view:'table',query:'无匹配'},{indexing:true});
 assert.equal(root.all().find(el=>el.cls==='ts-library-index-status')?.textContent,'正在索引白板引用…');
 labeled(root,'清除筛选')!.onclick?.(undefined);
 const row=root.all().find(el=>el.attrs['data-note-path']==='Cards/Heat.md')!;
 assert.ok(row.children.some(cell=>cell.text==='正在索引'));
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
