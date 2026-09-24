import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve as resolvePath} from 'node:path';
import {transformSync} from 'esbuild';
import {cleanPluginSettings} from '../src/plugin-settings';
import {parseLayoutSnapshot} from '../src/layout-snapshot-data';
import {hostPlugin,fileExplorer,hostSettings,workspaceLeafId} from '../src/host-capabilities';
import {emptyBoard} from '../src/model';

for(const input of [undefined,null,false,18,'saved',[]])test(`plugin settings safely reject ${JSON.stringify(input)}`,()=>{
 const settings=cleanPluginSettings(input);
 assert.equal(settings.cardFolder,'ThoughtSpace/卡片');assert.equal(settings.wheelMode,'zoom');assert.deepEqual(settings.favoriteBoards,[]);
});
test('malformed booleans do not enable optional uploads or change destructive filing preferences',()=>{
 const settings=cleanPluginSettings({imageHostEnabled:'true',cleanupEmptyFolders:0,autoFileCards:null,showMinimap:'false',nativeBookmarksMigrated:[]});
 assert.equal(settings.imageHostEnabled,undefined);assert.equal(settings.cleanupEmptyFolders,true);assert.equal(settings.autoFileCards,true);assert.equal(settings.showMinimap,true);assert.equal(settings.nativeBookmarksMigrated,undefined);
});
test('validated settings preserve disabled features and user appearance preferences',()=>{
 const settings=cleanPluginSettings({imageHostEnabled:false,autoFileCards:false,cleanupEmptyFolders:false,showMinimap:false,glassEffects:false,noteMarkdownToolbar:false,boardSearchEnabled:false,nativeBookmarksMigrated:true,surfaceStyle:'paper',readingSize:20,readingWidth:'wide',accent:'blue',density:'compact',canvasBackground:'grid',wheelMode:'pan',zoomSpeed:1.5,cardFolder:'Inbox/Cards',journalFolder:'Journal',notePaneLeafId:'pane-42'});
 assert.equal(settings.cardFolder,'Inbox/Cards');assert.equal(settings.journalFolder,'Journal');assert.equal(settings.autoFileCards,false);assert.equal(settings.cleanupEmptyFolders,false);assert.equal(settings.noteMarkdownToolbar,false);assert.equal(settings.nativeBookmarksMigrated,true);assert.equal(settings.wheelMode,'pan');assert.equal(settings.zoomSpeed,1.5);assert.equal(settings.readingSize,20);assert.equal(settings.readingWidth,'wide');assert.equal(settings.notePaneLeafId,'pane-42');
});
test('invalid folders, enums and non-finite numbers restore safe defaults',()=>{
 const settings=cleanPluginSettings({cardFolder:'../outside',journalFolder:'Journal',readingSize:Infinity,surfaceStyle:'unknown',density:4,accent:{toString:()=> 'blue'},canvasBackground:'custom',zoomSpeed:NaN,detailZoom:Infinity});
 assert.equal(settings.cardFolder,'ThoughtSpace/卡片');assert.equal(settings.journalFolder,'ThoughtSpace/日记');assert.equal(settings.readingSize,16);assert.equal(settings.surfaceStyle,'soft');assert.equal(settings.accent,'forest');assert.equal(settings.zoomSpeed,1);assert.equal(settings.detailZoom,.45);
});
test('paper canvas background survives persisted settings without changing grid or reading preferences',()=>{
 const raw={canvasBackground:'paper',surfaceStyle:'soft',gridStep:48,wheelMode:'pan',readingSize:20,readingWidth:'wide',glassEffects:false};
 const settings=cleanPluginSettings(raw),restored=cleanPluginSettings(JSON.parse(JSON.stringify(settings)));
 for(const result of [settings,restored]){assert.equal(result.canvasBackground,'paper');assert.equal(result.gridStep,48);assert.equal(result.surfaceStyle,'soft');assert.equal(result.wheelMode,'pan');assert.equal(result.readingSize,20);assert.equal(result.readingWidth,'wide');assert.equal(result.glassEffects,false);}
 assert.deepEqual(raw,{canvasBackground:'paper',surfaceStyle:'soft',gridStep:48,wheelMode:'pan',readingSize:20,readingWidth:'wide',glassEffects:false});
});
test('all existing background choices remain valid and malformed paper values fall back safely',()=>{
 for(const canvasBackground of ['dots','grid','plain','paper'])assert.equal(cleanPluginSettings({canvasBackground}).canvasBackground,canvasBackground);
 for(const canvasBackground of ['Paper','paper ',['paper'],{toString:()=>{throw Error('untrusted coercion');}},null,42])assert.equal(cleanPluginSettings({canvasBackground}).canvasBackground,'dots');
 assert.equal(cleanPluginSettings({surfaceStyle:'paper'}).canvasBackground,'dots');
});
test('bookmark migration queue accepts boolean entries and preserves valid false actions',()=>{
 const settings=cleanPluginSettings({pendingBookmarkChanges:{'a.thoughtspace':true,'b.thoughtspace':false,'c.thoughtspace':'false','d.thoughtspace':{}},favoriteBoards:['a.thoughtspace',null,{},'a.thoughtspace']});
 assert.deepEqual(settings.pendingBookmarkChanges,{'a.thoughtspace':true,'b.thoughtspace':false});assert.deepEqual(settings.favoriteBoards,['a.thoughtspace']);
});
test('snapshot parser validates shape before restoring and preserves a valid board',()=>{
 const board=emptyBoard();board.version=3;board.nodes.push({id:'node',kind:'text',text:'Original',x:0,y:0,width:100,height:60,color:'sand'});
 const parsed=parseLayoutSnapshot(JSON.stringify({board,label:'Before edit',createdAt:'2026-09-23T00:00:00Z'}));
 assert.equal(parsed.label,'Before edit');assert.equal(parsed.createdAt,'2026-09-23T00:00:00Z');assert.equal(parsed.board.nodes[0].text,'Original');
});
test('null, arrays, missing boards and invalid boards never restore as an empty snapshot',()=>{
 for(const value of [null,[],{},'snapshot',{board:null},{board:[]},{board:{nodes:'broken'}}])assert.throws(()=>parseLayoutSnapshot(JSON.stringify(value)));
});
test('snapshot labels do not invoke arbitrary object conversion',()=>{
 const parsed=parseLayoutSnapshot(JSON.stringify({board:emptyBoard(),label:{name:'untrusted'},createdAt:44}));assert.equal(parsed.label,'布局快照');assert.equal(parsed.createdAt,'');
});
test('optional host integrations reject missing or malformed capabilities',()=>{
 for(const value of [null,undefined,4,[],{}, {plugins:null},{plugins:{plugins:[]}}])assert.equal(hostPlugin(value,'yingjian'),undefined);
 for(const value of [null,undefined,[],{revealInFolder:3}])assert.equal(fileExplorer(value),undefined);
 for(const value of [{},null,{setting:{open:()=>{},openTabById:3}}])assert.equal(hostSettings(value),undefined);
 assert.equal(workspaceLeafId({id:77}),undefined);assert.equal(workspaceLeafId({id:'pane'}),'pane');
});
test('valid host capabilities retain their receiver when called',()=>{
 const explorer={seen:undefined as unknown,revealInFolder(file:unknown){this.seen=file;}};
 const file={path:'board.thoughtspace'};fileExplorer(explorer)?.revealInFolder(file as never);assert.equal(explorer.seen,file);
 const settings={openCount:0,last:'',open(){this.openCount++;},openTabById(id:string){this.last=id;}};
 const host=hostSettings({setting:settings});host?.open();host?.openTabById('thoughtspace');assert.equal(settings.openCount,1);assert.equal(settings.last,'thoughtspace');
 const plugin={videoApi:{version:1}};assert.equal(hostPlugin({plugins:{plugins:{yingjian:plugin}}},'yingjian'),plugin);
});
test('typed desktop vault identifier retains the existing SHA256 path hash',()=>{
 const source=readFileSync('src/main.ts','utf8'),a=source.indexOf('  private yingjianVaultId()'),b=source.indexOf('\n  async openYingjianLink',a);assert.ok(a>=0&&b>a);
 class FileSystemAdapter{constructor(private base:string){}getBasePath(){return this.base;}}
 const Host=new Function('FileSystemAdapter','createHash','resolvePath',transformSync(`class Host{${source.slice(a,b)}};return Host`,{loader:'ts'}).code)(FileSystemAdapter,createHash,resolvePath);
 for(const path of ['/Users/example/Documents/研究笔记','/Users/example/../example/Vault']){const host=new Host();host.app={vault:{adapter:new FileSystemAdapter(path)}};assert.equal(host.yingjianVaultId(),createHash('sha256').update(resolvePath(path)).digest('hex').slice(0,20));}
 const host=new Host();host.app={vault:{adapter:{getBasePath:()=> '/unexpected'}}};assert.throws(()=>host.yingjianVaultId(),/桌面版/);
});

test('plugin settings sanitize layout presets through the persisted settings boundary',()=>{
 const options={mode:'color',columns:3,gap:40,sort:'title',anchor:'center',createSections:true};
 const raw={layoutPresets:[null,{id:'valid',name:'  阅读材料  ',options:{...options,viewport:{x:5,y:7,zoom:2},selectedIds:['secret-card'],file:'private.md',focus:true},nodes:['secret-content'],boardPath:'Research.thoughtspace'},{id:'broken',name:'Broken',options:{...options,gap:Infinity}},{id:'duplicate-name',name:'阅读材料',options},{id:'valid',name:'Duplicate id',options}],unrecognizedLayoutDefaults:{viewport:{x:1,y:2,zoom:1}}};
 const result=cleanPluginSettings(raw);assert.deepEqual(result.layoutPresets,[{id:'valid',name:'阅读材料',options}]);assert.equal(Object.hasOwn(result,'unrecognizedLayoutDefaults'),false);assert.deepEqual(cleanPluginSettings(JSON.parse(JSON.stringify(result))).layoutPresets,result.layoutPresets);
});
test('persisted layout presets are bounded, malformed containers are empty and settings cleaning never aliases source objects',()=>{
 const options={mode:'kind',columns:2,gap:24,sort:'position',anchor:'corner',createSections:true};
 for(const layoutPresets of [undefined,null,false,'preset',{},[{id:'x',name:'Name',options:{...options,columns:99}}]])assert.deepEqual(cleanPluginSettings({layoutPresets}).layoutPresets,[]);
 const raw={layoutPresets:Array.from({length:25},(_,i)=>({id:String(i),name:`Preset ${i}`,options:{...options}}))},before=JSON.stringify(raw),first=cleanPluginSettings(raw),second=cleanPluginSettings(raw);assert.equal(first.layoutPresets.length,20);assert.equal(JSON.stringify(raw),before);
 first.layoutPresets[0].name='Changed locally';first.layoutPresets[0].options.gap=72;first.layoutPresets.pop();assert.equal(raw.layoutPresets[0].name,'Preset 0');assert.equal(raw.layoutPresets[0].options.gap,24);assert.equal(raw.layoutPresets.length,25);assert.equal(second.layoutPresets[0].name,'Preset 0');assert.equal(second.layoutPresets[0].options.gap,24);assert.equal(second.layoutPresets.length,20);
});
