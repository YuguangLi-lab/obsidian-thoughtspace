import test from 'node:test';
import assert from 'node:assert/strict';
import {LibraryBodyReader,LibraryPreferenceStore,cleanLibraryPreferences,defaultLibraryCriteria,emptyLibraryPreferences,libraryConditionMatches,libraryEmpty,libraryMetadataMatches,libraryPreferencesStamp,libraryPropertyFacet,libraryResults,librarySearchBody,librarySnippets,libraryTagFacets,libraryTextMatches,parseLibraryCriteria,type LibraryCollection,type LibraryCriteria,type LibraryNote,type LibraryPreferences} from '../src/database-library';
import {cleanDatabasePreferences} from '../src/database-custom';
const context={cardFolder:'Cards',boardPath:'Boards/Research.thoughtspace',boardPaths:new Set(['Cards/A.md'])};
const note=(path='Cards/A.md',properties:Record<string,unknown>={}):LibraryNote=>({path,title:path.split('/').pop()!,mtime:2,ctime:1,size:10,tags:['#研究/城市','#公共空间'],properties});
const rule=(patch:Partial<LibraryCriteria>={}):LibraryCriteria=>({...defaultLibraryCriteria(),...patch});
const collection=(name='研究',rules=[rule()]):LibraryCollection=>({id:'box',name,rules});

test('native scalar facets distinguish 0, false and their string spellings from missing',()=>{
 const notes=[undefined,null,'',[],0,false,'0','false',['x','x',0],{}].map((v,i)=>note(`Cards/${i}.md`,{value:v}));
 const facet=libraryPropertyFacet(notes,'value','disappeared');assert.equal(facet.missing,4);assert.equal(facet.values.find(v=>v.value===0)?.count,2);assert.equal(facet.values.find(v=>v.value===false)?.count,1);assert.equal(facet.values.find(v=>v.value==='x')?.count,1);assert.equal(facet.values.find(v=>v.value==='disappeared')?.count,0);
 assert.equal(libraryEmpty(false),false);assert.equal(libraryEmpty(0),false);assert.equal(libraryConditionMatches({value:false},{key:'value',op:'empty'}),false);assert.equal(libraryConditionMatches({value:['x',false]},{key:'value',op:'eq',value:false}),true);
});
test('folder boundaries, nested tags AND/OR and Properties intersect without changing notes',()=>{
 const n=note('Cards/Urban/A.md',{author:'林知',rating:0}),before=structuredClone(n),c=rule({folder:'Cards/Urban',tags:['研究','公共空间'],conditions:[{key:'rating',op:'eq',value:0}]});
 assert.equal(libraryMetadataMatches(n,c,context),true);assert.equal(libraryMetadataMatches(note('Cards/Urban2/A.md',n.properties),c,context),false);
 assert.equal(libraryMetadataMatches(n,{...c,tags:['missing','公共空间'],tagMode:'all'},context),false);assert.equal(libraryMetadataMatches(n,{...c,tags:['missing','公共空间'],tagMode:'any'},context),true);assert.deepEqual(n,before);
 assert.equal(libraryMetadataMatches(note('Cards2/A.md'),rule({scope:'cards'}),context),false);
});
test('saved current-board criteria stay bound to the original board and never become vault scope',()=>{
 const c=rule({scope:'board',boardPath:context.boardPath});assert.equal(libraryMetadataMatches(note(),c,context),true);assert.equal(libraryMetadataMatches(note(),c,{...context,boardPath:'Boards/Other.thoughtspace'}),false);assert.equal(parseLibraryCriteria({...c,boardPath:undefined}),undefined);
});
test('temporary refinements intersect intrinsic box rules; membership re-evaluates from metadata',()=>{
 const notes=[note('Cards/City/A.md'),note('Writing/B.md')],rules=[rule({folder:'Cards/City'}),rule({folder:'Writing'})];assert.deepEqual(libraryResults(notes,rules,context),[]);
 assert.equal(libraryResults(notes,[rule({tags:['研究']})],context).length,2);notes[0].tags=[];assert.equal(libraryResults(notes,[rule({tags:['研究']})],context).length,1);
});
test('facets count a nested tag once per note and keep selected zero-count values',()=>{
 const n=note();n.tags=['#研究','#研究/城市','#研究/城市'];assert.deepEqual(libraryTagFacets([n],['missing']),[['missing',0],['研究',1],['研究/城市',1]]);
});
test('literal source snippets keep CRLF line locations and exclude YAML properties',()=>{
 const raw='---\r\nauthor: hidden-token\r\n---\r\n# 标题\r\n\r\n公共空间里的步行。\r\n另一段步行证据。';
 assert.equal(librarySearchBody(raw).includes('hidden-token'),false);const snippets=librarySnippets(raw,'步行');assert.deepEqual(snippets.map(s=>s.line),[5,6]);assert.equal(raw.slice(snippets[0].from,snippets[0].to),snippets[0].text);assert.equal(librarySnippets(raw,'hidden-token').length,0);
 const thematic='正文\n---\n中间分隔\n---\n结尾';assert.equal(librarySearchBody(thematic),thematic);
 assert.ok(Number.isFinite(librarySnippets('İİİİ\n步行','步行')[0].from));
});
test('full text is opt-in and metadata search does not match YAML or hidden body',()=>{
 const n=note();assert.equal(libraryTextMatches(n,[rule({query:'正文'})],'真正的正文'),false);assert.equal(libraryTextMatches(n,[rule({query:'正文',fullText:true})],'真正的正文'),true);assert.equal(libraryTextMatches(n,[rule({query:'private-value',fullText:true})],'---\nsecret: private-value\n---\n正文'),false);
});
test('corrupt collection rules are dropped as a whole rather than broadened',()=>{
 const prefs={version:1,collections:[collection('合法'),{...collection('损坏'),id:'broken',rules:[rule(),{...rule(),scope:'unknown'}]}]};assert.equal(cleanLibraryPreferences(prefs).collections.length,1);assert.equal(cleanLibraryPreferences({version:2,collections:[collection()]}).collections.length,0);
 assert.equal(parseLibraryCriteria(rule({conditions:[{key:'__proto__',op:'empty'}]})),undefined);assert.equal(parseLibraryCriteria(rule({query:Array.from({length:33},()=> 'word').join(' ')})),undefined);
});
test('old database preferences keep their shape and new collections round-trip without touching fields',()=>{
 assert.deepEqual(cleanDatabasePreferences({fields:[],views:[]}),{fields:[],views:[]});const prefs={fields:[{key:'rating',type:'number'}],views:[],library:{version:1,collections:[collection()]}};assert.deepEqual(cleanDatabasePreferences(prefs),prefs);
});
const file=(path:string,size=10)=>({path,stat:{mtime:1,ctime:1,size}});
test('cancelling a pending body read prevents old completion from updating the next scan',async()=>{
 let release!:(v:string)=>void;const first=file('A.md'),second=file('B.md'),calls:string[]=[],reader=new LibraryBodyReader(async f=>{calls.push(f.path);return f===first?new Promise<string>(r=>release=r):'new';},()=>true,()=>Promise.resolve());
 const old=reader.scan([first]);await Promise.resolve();await Promise.resolve();reader.cancel();const next=reader.scan([second]);release('old');assert.equal(await old,undefined);assert.equal((await next)?.bodies.get('B.md'),'new');assert.deepEqual(calls,['A.md','B.md']);
});
test('changed identity or version during reads is skipped and cannot carry old snippets',async()=>{
 const f=file('A.md');const reader=new LibraryBodyReader(async()=>{f.stat.mtime++;return'body';},()=>true,()=>Promise.resolve());const result=await reader.scan([f]);assert.equal(result?.skipped,1);assert.equal(result?.bodies.size,0);
});
test('body reader never retains more than its budget and never reads oversized files',async()=>{
 const calls:string[]=[],text='x'.repeat(2_000_000);const reader=new LibraryBodyReader(async f=>{calls.push(f.path);return text;},()=>true,()=>Promise.resolve());const result=await reader.scan([file('huge.md',2_000_001),...Array.from({length:10},(_,i)=>file(`${i}.md`,2_000_000))]);assert.equal(calls.includes('huge.md'),false);assert.ok(result&&result.bytes<=20_000_000);assert.equal(result.bodies.size,5);assert.equal(result.skipped,6);
});
test('large metadata queries paginate without mutating input or duplicating membership',()=>{
 const notes=Array.from({length:6000},(_,i)=>({...note(`Cards/${i}.md`,{rating:i%5}),mtime:i})),before=notes.map(n=>n.path),found=libraryResults(notes,[rule({tags:['研究'],conditions:[{key:'rating',op:'eq',value:0}]})],context);assert.equal(found.length,1200);assert.equal(new Set(found.slice(0,48).map(n=>n.path)).size,48);assert.deepEqual(notes.map(n=>n.path),before);assert.equal(found[0].mtime,5995);
});
test('collection save snapshots reviewed values, serializes windows and rejects stale compare-and-save',async()=>{
 let prefs:LibraryPreferences|undefined=emptyLibraryPreferences(),release!:()=>void,writes=0;const pending=new Promise<void>(r=>release=r),store=new LibraryPreferenceStore({read:()=>prefs,write:v=>prefs=v,persist:async()=>{writes++;await pending;},changed:()=>{}}),stamp=libraryPreferencesStamp(prefs!);
 const a:LibraryPreferences={version:1,collections:[collection('第一窗口')]},b:LibraryPreferences={version:1,collections:[collection('第二窗口')]},first=store.save(a,stamp),second=store.save(b,stamp);a.collections[0].name='未经确认的后续修改';await Promise.resolve();await Promise.resolve();release();await first;await assert.rejects(second,/其他窗口/);assert.equal(writes,1);assert.equal(prefs?.collections[0].name,'第一窗口');
});
test('failed collection persistence rolls back only its own value; external updates survive',async()=>{
 for(const external of [false,true]){let prefs:LibraryPreferences|undefined=emptyLibraryPreferences();const previous=prefs,other:LibraryPreferences={version:1,collections:[collection('外部更新')]},store=new LibraryPreferenceStore({read:()=>prefs,write:v=>prefs=v,persist:async()=>{if(external)prefs=other;throw Error('disk full');},changed:()=>{}});await assert.rejects(store.save({version:1,collections:[collection()]},libraryPreferencesStamp(previous)),/disk full/);assert.equal(prefs,external?other:previous);}
});
