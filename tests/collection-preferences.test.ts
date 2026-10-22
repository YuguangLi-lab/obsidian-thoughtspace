import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

// Exercise the actual bootstrap bridge and successful-save refresh path. View
// tests separately prove that applyPreferences preserves live input/feed state.
const source=readFileSync('src/main.ts','utf8');
const bridgeStart=source.indexOf('    this.collectionWorkspace=this.addChild(new CollectionWorkspace('),bridgeEnd=source.indexOf('    this.registerView(COLLECTION_VIEW_TYPE',bridgeStart);
assert.ok(bridgeStart>0&&bridgeEnd>bridgeStart);
test('Collection bootstrap forwards current plugin accent and density rather than a startup snapshot',()=>{
 class CollectionWorkspace {constructor(_app:unknown,_library:unknown,readonly bridge:any){}}
 const Factory=new Function('CollectionWorkspace','collectionLibrary','uid',transformSync('class Factory { initialize(){'+source.slice(bridgeStart,bridgeEnd)+'} };return Factory;',{loader:'ts'}).code)(CollectionWorkspace,{},()=> 'unused-test-id');
 const factory=new Factory();Object.assign(factory,{settings:{accent:'blue',density:'compact'},manifest:{id:'thoughtspace',dir:'.obsidian/plugins/thoughtspace'},app:{vault:{configDir:'.obsidian'}},addChild:(value:unknown)=>value,register:()=>{}});factory.initialize();
 const bridge=factory.collectionWorkspace.bridge;assert.deepEqual([bridge.accent(),bridge.density()],['blue','compact']);factory.settings={accent:'rose',density:'comfortable'};assert.deepEqual([bridge.accent(),bridge.density()],['rose','comfortable']);
});
function fixture(){
 const start=source.indexOf('  async savePreferences() {'),end=source.indexOf('  async session(',start);assert.ok(start>0&&end>start);
 const painted:unknown[]=[];class BoardView {applyPreferences(){painted.push(this);}}class CollectionView extends BoardView{}class WritingView extends BoardView{}class MediaWorkspaceView extends BoardView{}class OnlineWorkspaceView extends BoardView{}class MaterialsView extends BoardView{}
 const deps={BoardView,CollectionView,WritingView,MediaWorkspaceView,OnlineWorkspaceView,MaterialsView,VIEW:'board',COLLECTION_VIEW_TYPE:'collection',WRITING:'writing',MEDIA_WORKSPACE:'media',ONLINE_WORKSPACE:'online',MATERIALS:'materials'};
 const Plugin=new Function(...Object.keys(deps),transformSync('class Plugin{'+source.slice(start,end)+'}return Plugin;',{loader:'ts'}).code)(...Object.values(deps));
 const collection=[new CollectionView(),new CollectionView(),new CollectionView()],others=[new BoardView(),new WritingView(),new MediaWorkspaceView(),new OnlineWorkspaceView(),new MaterialsView()],queries:string[]=[],settings={accent:'forest',density:'comfortable'};let resolve!:()=>void,reject!:(error:Error)=>void,dock=0;
 const saved=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});const plugin=new Plugin();Object.assign(plugin,{settings,saveData:async(value:unknown)=>{assert.equal(value,settings);await saved;},refreshDock:()=>dock++,app:{workspace:{getLeavesOfType:(type:string)=>{queries.push(type);if(type==='collection')return [...collection,{applyPreferences:()=>{throw Error('Foreign view must not be decorated');}}].map(view=>({view}));const at=['board','writing','media','online','materials'].indexOf(type);return at<0?[]:[{view:others[at]}];}}}});
 return{plugin,painted,collection,others,queries,resolve,reject,dock:()=>dock};
}
test('successful preference save repaints every registered Collection view without active-leaf or document filtering',async()=>{
 const f=fixture(),saving=f.plugin.savePreferences();await Promise.resolve();assert.equal(f.painted.length,0);f.resolve();await saving;for(const view of [...f.collection,...f.others])assert.equal(f.painted.filter(item=>item===view).length,1);assert.equal(f.queries.filter(type=>type==='collection').length,1);assert.equal(f.dock(),1);
});
test('failed preference persistence never applies an unconfirmed Collection appearance',async()=>{
 const f=fixture(),saving=f.plugin.savePreferences();f.reject(Error('settings write failed'));await assert.rejects(saving,/settings write failed/);assert.equal(f.painted.length,0);assert.equal(f.queries.length,0);assert.equal(f.dock(),0);
});
