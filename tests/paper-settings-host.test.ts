import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {cleanPaperPreferences,paperAppearanceStamp,type PaperPreferences} from '../src/paper-appearance';
import {cleanPluginSettings} from '../src/plugin-settings';

const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  openPaperSettings(){'),end=source.indexOf('  async session(',start);assert.ok(start>=0&&end>start);
function deferred(){let resolve!:()=>void,reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(){
 const calls={created:0,opened:0,focused:0,applied:0,dock:0,writes:[] as unknown[]};
 class BoardView{applyPreferences(){calls.applied++;}}
 class PaperSettingsModal{
  modalEl={isConnected:false,querySelector:()=>({focus:()=>calls.focused++})};
  constructor(_app:unknown,readonly host:{preferences:()=>PaperPreferences;save:(prefs:PaperPreferences)=>Promise<void>}){calls.created++;}
  open(){this.modalEl.isConnected=true;calls.opened++;}close(){this.modalEl.isConnected=false;}
 }
 const deps={PaperSettingsModal,BoardView,VIEW:'board',cleanPaperPreferences,paperAppearanceStamp};
 const Plugin=new Function(...Object.keys(deps),transformSync(`class Plugin{${source.slice(start,end)}}return Plugin;`,{loader:'ts'}).code)(...Object.values(deps)),plugin=new Plugin(),save=deferred();
 const settings=cleanPluginSettings({canvasBackground:'grid',paperPreset:'cream',paperColor:'#abcdef',paperTexture:55,accent:'forest'});
 Object.assign(plugin,{settings,app:{workspace:{getLeavesOfType:(type:string)=>{assert.equal(type,'board');return[{view:new BoardView()},{view:{applyPreferences:()=>{throw Error('unrelated view must not render');}}},{view:new BoardView()}];}}},saveData:async(value:unknown)=>{calls.writes.push(JSON.parse(JSON.stringify(value)));await save.promise;},refreshDock:()=>calls.dock++});
 return{plugin,calls,save,settings};
}
const next:PaperPreferences={paperPreset:'white',paperColor:'#123456',paperTexture:0};
test('opening paper settings twice reuses and focuses the existing dialog without resetting draft state',()=>{const f=fixture(),first=f.plugin.openPaperSettings(),second=f.plugin.openPaperSettings();assert.equal(first,second);assert.equal(f.calls.created,1);assert.equal(f.calls.opened,1);assert.equal(f.calls.focused,1);first.close();const third=f.plugin.openPaperSettings();assert.notEqual(third,first);assert.equal(f.calls.created,2);assert.equal(f.calls.opened,2);});
test('paper host returns fresh cleaned preferences without aliasing plugin settings',()=>{const f=fixture(),modal=f.plugin.openPaperSettings(),preferences=modal.host.preferences();assert.deepEqual(preferences,cleanPaperPreferences(f.settings));preferences.paperColor='#000000';assert.equal(f.settings.paperColor,'#abcdef');f.settings.paperColor='#fedcba';assert.equal(modal.host.preferences().paperColor,'#fedcba');});
test('successful paper apply enables paper background, persists once and refreshes only board surfaces',async()=>{const f=fixture(),modal=f.plugin.openPaperSettings(),saving=modal.host.save(next);assert.equal(f.settings.canvasBackground,'paper');assert.deepEqual(cleanPaperPreferences(f.settings),next);assert.equal(f.calls.writes.length,1);assert.equal(f.calls.applied,0);f.save.resolve();await saving;assert.equal(f.calls.applied,2);assert.equal(f.calls.dock,1);assert.equal(f.settings.accent,'forest');});
test('failed paper persistence restores paper and background while preserving newer unrelated preferences',async()=>{const f=fixture(),before={...cleanPaperPreferences(f.settings),canvasBackground:f.settings.canvasBackground},modal=f.plugin.openPaperSettings(),saving=modal.host.save(next);f.settings.accent='blue';f.save.reject(Error('write failed'));await assert.rejects(saving,/write failed/);assert.deepEqual({...cleanPaperPreferences(f.settings),canvasBackground:f.settings.canvasBackground},before);assert.equal(f.settings.accent,'blue');assert.equal(f.calls.applied,2);assert.equal(f.calls.dock,0);});
test('a failed save cannot roll back a newer remembered custom pigment under a named paper preset',async()=>{const f=fixture(),modal=f.plugin.openPaperSettings(),saving=modal.host.save(next);f.settings.paperColor='#654321';f.save.reject(Error('older write failed'));await assert.rejects(saving,/older write failed/);assert.equal(f.settings.paperPreset,'white');assert.equal(f.settings.paperColor,'#654321');assert.equal(f.settings.paperTexture,0);assert.equal(f.settings.canvasBackground,'paper');assert.equal(f.calls.applied,0);});
test('a failed paper save cannot undo a newer background choice',async()=>{const f=fixture(),modal=f.plugin.openPaperSettings(),saving=modal.host.save(next);f.settings.canvasBackground='plain';f.save.reject(Error('write failed'));await assert.rejects(saving,/write failed/);assert.equal(f.settings.canvasBackground,'plain');assert.deepEqual(cleanPaperPreferences(f.settings),next);assert.equal(f.calls.applied,0);});
