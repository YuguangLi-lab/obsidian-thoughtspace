import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CollectionSavedFilters,isCollectionSavedFiltersDocument,isCollectionSavedFilterOptions,type CollectionSavedFiltersDocument} from '../src/collection-saved-filters';
import {CollectionJsonStore,type CollectionJsonAdapter} from '../src/collection-json-store';
import type {CollectionSearchOptions} from '../src/collection-search';

const path='.obsidian/plugins/thoughtspace/collection-library/saved-filters.json';
function fixture(initial?:CollectionSavedFiltersDocument){
 const files=new Map<string,string>();if(initial)files.set(path,JSON.stringify(initial));let token=0,id=0,active=true,writes=0;
 const control:{reject?:boolean;afterWrite?:()=>void}={};
 const adapter:CollectionJsonAdapter={exists:async name=>name===path.slice(0,path.lastIndexOf('/'))||files.has(name),list:async()=>({files:[...files.keys()]}),read:async name=>files.get(name)!,write:async(name,text)=>{if(control.reject)throw Error('storage refused');files.set(name,text);},copy:async(from,to)=>{if(files.has(to))throw Error('destination exists');files.set(to,files.get(from)!);writes++;control.afterWrite?.();},process:async(name,change)=>{if(control.reject)throw Error('storage refused');const text=change(files.get(name)!);files.set(name,text);writes++;control.afterWrite?.();return text;},remove:async name=>{files.delete(name);}};
 const store=new CollectionJsonStore(adapter,path,()=>`token-${++token}`,isCollectionSavedFiltersDocument),filters=new CollectionSavedFilters(store,()=>`filter-${String(++id).padStart(8,'0')}`);
 return{files,store,filters,control,current:()=>active,cancel:()=>{active=false;},writes:()=>writes};
}
const item=(id='filter-12345678',name='研究',options:CollectionSearchOptions={query:'#研究 -#归档 资料',includeBody:true,scope:'unplaced',pinnedOnly:true,since:'2024-02-29',until:'2026-10-13'})=>({id,name,options});

test('strict saved-filter document accepts supported conditions and rejects unauthorized fields',()=>{
 assert.equal(isCollectionSavedFiltersDocument({version:1,filters:[item()]}),true);
 for(const extra of ['body','results','authorization','target','selected','bodyArmed'])assert.equal(isCollectionSavedFiltersDocument({version:1,filters:[{...item(),[extra]:true}]}),false);
 assert.equal(isCollectionSavedFiltersDocument({version:2,filters:[]}),false);assert.equal(isCollectionSavedFiltersDocument({version:1,filters:[],future:true}),false);
 assert.equal(isCollectionSavedFiltersDocument({version:1,filters:[item(),item()]}),false);assert.equal(isCollectionSavedFiltersDocument({version:1,filters:[item(),item('filter-98765432')]}),false);
});
test('options strictly validate calendar dates, range, booleans, scopes, and query limits',()=>{
 for(const options of [{query:'',since:'2025-02-29'},{query:'',since:'2024-13-01'},{query:'',since:'2024-2-01'},{query:'',since:'2026-10-14',until:'2026-10-13'},{query:'',until:''},{query:'',scope:'everything'},{query:'',scope:{toString:()=> 'all'}},{query:'',includeBody:'true'},{query:'',pinnedOnly:1},{query:'',includeBody:undefined},{query:'',body:'private'},{query:'x'.repeat(4097)}])assert.equal(isCollectionSavedFilterOptions(options),false,JSON.stringify(options));
 for(const scope of ['all','unplaced','placed','archived'])assert.equal(isCollectionSavedFilterOptions({query:'',scope}),true);
});
test('listing an empty store never writes or searches',async()=>{const f=fixture();assert.deepEqual(await f.filters.list(),{filters:[]});assert.equal(f.files.size,0);assert.equal(f.writes(),0);});
test('save persists only exact conditions and returns an isolated value',async()=>{
 const f=fixture(),options={...item().options,since:undefined,until:undefined},saved=await f.filters.save('  研究  ',options,f.current);saved.options.query='caller changed';options.query='later changed';
 const listed=await f.filters.list();assert.equal(listed.filters[0].name,'研究');assert.equal(listed.filters[0].options.query,item().options.query);assert.equal(listed.filters[0].options.includeBody,true);
 assert.deepEqual(Object.keys(JSON.parse(f.files.get(path)!).filters[0]).sort(),['id','name','options']);assert.equal(Object.hasOwn(listed.filters[0].options,'since'),false);
});
test('same-name additions reject, explicit same-id updates preserve position, and delete is targeted',async()=>{
 const f=fixture(),first=await f.filters.save('研究',{query:'one'},f.current),second=await f.filters.save('写作',{query:'two'},f.current);
 await assert.rejects(f.filters.save('  研究 ',{query:'replace silently'},f.current),/同名/);await assert.rejects(f.filters.save('写作',{query:'collision'},f.current,first.id),/同名/);
 await f.filters.save('研究更新',{query:'three',scope:'archived'},f.current,first.id);assert.deepEqual((await f.filters.list()).filters.map(entry=>entry.id),[first.id,second.id]);
 await f.filters.remove(first.id,f.current);assert.deepEqual((await f.filters.list()).filters.map(entry=>entry.id),[second.id]);await assert.rejects(f.filters.remove(first.id,f.current),/已移除/);
});
test('canonical Unicode duplicate names reject without silently overwriting',async()=>{
 const f=fixture();await f.filters.save('Café',{query:''},f.current);await assert.rejects(f.filters.save('Cafe\u0301',{query:''},f.current),/同名/);assert.equal((await f.filters.list()).filters.length,1);
});
test('invalid names, IDs, unknown option fields, and stale explicit IDs create no writes',async()=>{
 const f=fixture();for(const name of ['', '   ','n'.repeat(81)])await assert.rejects(f.filters.save(name,{query:''},f.current));
 await assert.rejects(f.filters.save('name',{query:'',body:'private'} as CollectionSearchOptions,f.current));await assert.rejects(f.filters.save('name',{query:''},f.current,'../../bad'));await assert.rejects(f.filters.save('name',{query:''},f.current,'filter-missing'),/已移除/);assert.equal(f.writes(),0);
});
test('twenty saved filters is a hard bound; updating and deleting remain available',async()=>{
 const initial:CollectionSavedFiltersDocument={version:1,filters:Array.from({length:20},(_,index)=>item(`filter-${String(index).padStart(8,'0')}`,`名称 ${index}`,{query:''}))},f=fixture(initial);
 await assert.rejects(f.filters.save('第 21 项',{query:''},f.current),/20/);await f.filters.save('更新',{query:'x'},f.current,initial.filters[0].id);await f.filters.remove(initial.filters[1].id,f.current);assert.equal((await f.filters.list()).filters.length,19);
 assert.equal(isCollectionSavedFiltersDocument({version:1,filters:[...initial.filters,item('filter-overlimit','too many')]}),false);
});
test('simultaneous commands use the latest confirmed list and preserve both distinct additions',async()=>{
 const f=fixture();await Promise.all([f.filters.save('一',{query:'1'},f.current),f.filters.save('二',{query:'2'},f.current)]);assert.deepEqual((await f.filters.list()).filters.map(entry=>entry.name),['一','二']);
 const same=fixture(),results=await Promise.allSettled([same.filters.save('同名',{query:'1'},same.current),same.filters.save('同名',{query:'2'},same.current)]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal((await same.filters.list()).filters.length,1);
});
test('cancelled add and remove never write; late cancellation retains confirmed success',async()=>{
 const f=fixture(),saved=await f.filters.save('一',{query:''},f.current);f.cancel();await assert.rejects(f.filters.save('二',{query:''},f.current),/取消/);await assert.rejects(f.filters.remove(saved.id,f.current),/取消/);assert.equal(f.writes(),1);
 const late=fixture();late.control.afterWrite=late.cancel;const result=await late.filters.save('保存成功',{query:'',includeBody:true},late.current);assert.equal((await late.filters.list()).filters[0].id,result.id);
});
test('rejected persistence leaves the confirmed list unchanged',async()=>{
 const f=fixture(),saved=await f.filters.save('原有',{query:'old'},f.current);f.control.reject=true;await assert.rejects(f.filters.save('新名',{query:'new'},f.current,saved.id));assert.equal((await f.filters.list()).filters[0].name,'原有');
 await assert.rejects(f.filters.remove(saved.id,f.current));assert.equal((await f.filters.list()).filters.length,1);
});
test('corruption exposes confirmed filters read-only and never overwrites damaged data',async()=>{
 const f=fixture();await f.filters.save('原有',{query:'old'},f.current);f.files.set(path,'{damaged');const result=await f.filters.list();assert.equal(result.filters[0].name,'原有');assert.ok(result.warning);
 await assert.rejects(f.filters.save('新名',{query:'new'},f.current));await assert.rejects(f.filters.remove(result.filters[0].id,f.current));assert.equal(f.files.get(path),'{damaged');assert.equal(f.writes(),1);
});
test('reopening a persisted body filter only lists its intent and performs no further writes',async()=>{
 const f=fixture();await f.filters.save('正文筛选',item().options,f.current);const reopened=new CollectionSavedFilters(new CollectionJsonStore({...({} as CollectionJsonAdapter),exists:async name=>f.files.has(name),read:async name=>f.files.get(name)!,list:async()=>({files:[...f.files.keys()]}),write:async()=>{throw Error('unexpected write');}},path,()=> 'unused-token',isCollectionSavedFiltersDocument),()=> 'unused-id');
 assert.equal((await reopened.list()).filters[0].options.includeBody,true);assert.equal(f.writes(),1);
});
test('saved task filters preserve exact intent, with old/default JSON unchanged',async()=>{
 const f=fixture(),legacy=await f.filters.save('原条件',{query:'#研究',includeBody:true},f.current);
 assert.deepEqual(legacy.options,{query:'#研究',includeBody:true});
 const all=await f.filters.save('所有任务状态',{query:'#研究',includeBody:true,tasks:'all'},f.current);assert.deepEqual(all.options,legacy.options);
 for(const tasks of ['any','todo','done','none'] as const){
  const saved=await f.filters.save(`任务 ${tasks}`,{query:'#研究',scope:'archived',tasks},f.current);
  assert.equal(saved.options.tasks,tasks);assert.equal((await f.filters.list()).filters.find(item=>item.id===saved.id)?.options.tasks,tasks);
 }
 assert.equal(isCollectionSavedFiltersDocument(JSON.parse(f.files.get(path)!)),true);
});
test('invalid persisted task intent blocks acceptance and new writes',async()=>{
 const f=fixture();
 for(const tasks of [undefined,null,'','completed',0,true,{},['todo']]){
  assert.equal(isCollectionSavedFilterOptions({query:'',tasks}),false);
  if(tasks!==undefined)await assert.rejects(f.filters.save('invalid',{query:'',tasks} as unknown as CollectionSearchOptions,f.current));
 }
 assert.equal(f.writes(),0);
 for(const tasks of ['all','any','todo','done','none'])assert.equal(isCollectionSavedFilterOptions({query:'',tasks}),true);
});
