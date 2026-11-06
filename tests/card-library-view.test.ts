import test from 'node:test';
import assert from 'node:assert/strict';
import {paintCardLibrary,type LibraryElement,type LibraryElementOptions} from '../src/card-library-view';
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
