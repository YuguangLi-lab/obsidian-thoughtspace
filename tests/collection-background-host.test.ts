import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {cleanCollectionBackground,collectionBackgroundStamp} from '../src/collection-background';
import {cleanPluginSettings} from '../src/plugin-settings';

const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  private openCollectionBackground('),end=source.indexOf('  openBackgroundImageSettings()',start);
assert(start>=0&&end>start);
class CollectionView {applied=0;applyPreferences(){this.applied++;}}
class Controls {constructor(_app:unknown,readonly host:any){}show(){} }
const Plugin=new Function('CollectionBackgroundControls','CollectionView','cleanCollectionBackground','collectionBackgroundStamp','settingsLanguage','COLLECTION_VIEW_TYPE',transformSync(`return class Plugin {${source.slice(start,end)}}`,{loader:'ts'}).code)(Controls,CollectionView,cleanCollectionBackground,collectionBackgroundStamp,()=> 'zh-CN','thoughtspace-collection');
function fixture(){
 let resolve!:()=>void,reject!:(error:Error)=>void,writes=0;const pending=new Promise<void>((a,b)=>{resolve=a;reject=b;});
 const view=new CollectionView(),plugin=new Plugin();plugin.settings=cleanPluginSettings({canvasBackground:'grid',paperPreset:'custom',paperColor:'#123456'});plugin.addChild=(value:unknown)=>value;plugin.app={workspace:{getLeavesOfType:()=>[{view}]},vault:{adapter:{exists:async()=>true}}};plugin.savePreferences=()=>{writes++;return pending;};plugin.openCollectionBackground({},()=>true);
 return{plugin,view,host:(plugin.collectionBackgroundControls as Controls).host,resolve,reject,writes:()=>writes};
}
test('a collection background save changes only its own settings and awaits storage',async()=>{
 const f=fixture(),board=JSON.stringify({mode:f.plugin.settings.canvasBackground,pigment:f.plugin.settings.paperColor}),old=collectionBackgroundStamp(f.plugin.settings.collectionBackground),next=cleanCollectionBackground({canvasBackground:'grid',paperColor:'#f3efdf'});
 const saving=f.host.save(next,old);assert.equal(f.writes(),1);assert.deepEqual(f.plugin.settings.collectionBackground,next);assert.equal(JSON.stringify({mode:f.plugin.settings.canvasBackground,pigment:f.plugin.settings.paperColor}),board);f.resolve();await saving;
});
test('a stale editor is rejected before storage or mutation',async()=>{
 const f=fixture(),old=collectionBackgroundStamp(f.plugin.settings.collectionBackground);f.plugin.settings.collectionBackground=cleanCollectionBackground({paperColor:'#e3eeee'});const current=JSON.stringify(f.plugin.settings.collectionBackground);
 await assert.rejects(f.host.save(cleanCollectionBackground({canvasBackground:'dots'}),old),/背景已改变/);assert.equal(f.writes(),0);assert.equal(JSON.stringify(f.plugin.settings.collectionBackground),current);
});
test('storage failure restores collection appearance but preserves newer unrelated settings',async()=>{
 const f=fixture(),previous={...f.plugin.settings.collectionBackground},saving=f.host.save(cleanCollectionBackground({canvasBackground:'grid'}),collectionBackgroundStamp(previous));f.plugin.settings.accent='rose';f.reject(Error('disk full'));await assert.rejects(saving,/disk full/);assert.deepEqual(f.plugin.settings.collectionBackground,previous);assert.equal(f.plugin.settings.accent,'rose');assert.equal(f.view.applied,1);
});
test('an older failed save cannot overwrite a newer collection background',async()=>{
 const f=fixture(),saving=f.host.save(cleanCollectionBackground({canvasBackground:'grid'}),collectionBackgroundStamp(f.plugin.settings.collectionBackground)),newer=cleanCollectionBackground({canvasBackground:'plain',paperColor:'#eeeeff'});f.plugin.settings.collectionBackground=newer;f.reject(Error('older failed'));await assert.rejects(saving,/older failed/);assert.deepEqual(f.plugin.settings.collectionBackground,newer);assert.equal(f.view.applied,0);
});
test('unloaded plugin rejects background writes',async()=>{
 const f=fixture();f.plugin.backgroundImagesClosed=true;await assert.rejects(f.host.save(cleanCollectionBackground({canvasBackground:'grid'}),collectionBackgroundStamp(f.plugin.settings.collectionBackground)),/背景已改变/);assert.equal(f.writes(),0);
});
