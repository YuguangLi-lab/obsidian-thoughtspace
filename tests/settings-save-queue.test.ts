import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {cleanPluginSettings,type ThoughtSpacePreferences} from '../src/plugin-settings';
import {exportSettingsProfile,parseSettingsProfile,resolveSettingsLanguage,settingsCategoryDefaults} from '../src/settings-preferences';

type Options={cls?:string;text?:string;attr?:Record<string,string>;type?:string;value?:string};
class Element {
 children:Element[]=[];dataset:Record<string,string>={};attributes:Record<string,string>={};classes=new Set<string>();value='';disabled=false;hidden=false;readOnly=false;files?:{size:number;text:()=>Promise<string>}[];writes=0;private text='';onclick?:()=>void;oninput?:()=>void;onchange?:()=>void;
 constructor(readonly tagName:string,options:Options|string={}){const opts=typeof options==='string'?{cls:options}:options;this.text=opts.text||'';this.attributes={...opts.attr};this.value=opts.value||'';if(opts.type)this.attributes.type=opts.type;for(const cls of (opts.cls||'').split(/\s+/).filter(Boolean))this.classes.add(cls);}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 createEl(tag:string,options:Options|string={}){this.writes++;const child=new Element(tag.toUpperCase(),options);this.children.push(child);return child;}createDiv(options:Options|string={}){return this.createEl('div',options);}createSpan(options:Options|string={}){return this.createEl('span',options);}
 addClass(...names:string[]){for(const name of names)this.classes.add(name);}setText(text:string){this.writes++;this.text=text;this.children=[];}empty(){this.writes++;this.children=[];this.text='';}click(){if(!this.disabled)this.onclick?.();}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(child=>[...((selector.startsWith('.')?child.classes.has(selector.slice(1)):child.tagName===selector.toUpperCase())?[child]:[]),...child.querySelectorAll(selector)]);}
}
class Setting {
 readonly settingEl:Element;
 constructor(parent:Element){this.settingEl=parent.createDiv('setting-item');}
 setName(text:string){this.settingEl.createDiv({cls:'setting-item-name',text});return this;}setDesc(text:string){this.settingEl.createDiv({cls:'setting-item-description',text});return this;}
 addButton(build:(button:any)=>void){const el=this.settingEl.createEl('button');const button={buttonEl:el,setButtonText:(text:string)=>{el.setText(text);return button;},setIcon:()=>button,setCta:()=>button,setDisabled:(disabled:boolean)=>{el.disabled=disabled;return button;},onClick:(run:()=>void)=>{el.onclick=run;return button;}};build(button);return this;}
 addDropdown(build:(control:any)=>void){const el=this.settingEl.createEl('select');const control={addOptions:()=>control,setValue:(value:string)=>{el.value=value;return control;},onChange:()=>control};build(control);return this;}
 addToggle(build:(control:any)=>void){const control={setValue:()=>control,onChange:()=>control};build(control);return this;}
}
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
const source=readFileSync('src/settings-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const compiled=transformSync(source+'\nreturn ThoughtSpaceSettings;',{loader:'ts'}).code;

function fixture(raw:unknown={}){
 const modals:any[]=[],delegated:{prefs:ThoughtSpacePreferences;persist:()=>Promise<void>}[]=[];
 class Modal {modalEl=new Element('DIV');titleEl=this.modalEl.createEl('h2');contentEl=this.modalEl.createDiv();closeCount=0;onOpen?:()=>void;onClose?:()=>void;constructor(readonly app:unknown){modals.push(this);}open(){this.onOpen?.();}close(){this.closeCount++;this.onClose?.();}}
 class PluginSettingTab {containerEl=new Element('DIV');constructor(readonly app:unknown){}}
 const deps={Modal,PluginSettingTab,Setting,Notice:class{},setIcon:()=>{},getLanguage:()=> 'en',themeSurface:()=>{},resolveSettingsLanguage,settingsCategoryDefaults,exportSettingsProfile,parseSettingsProfile,boardPreferenceControls:(_el:unknown,prefs:ThoughtSpacePreferences,persist:()=>Promise<void>)=>delegated.push({prefs,persist}),mousePreferenceControls:(_el:unknown,prefs:ThoughtSpacePreferences,persist:()=>Promise<void>)=>delegated.push({prefs,persist}),hostSettings:()=>undefined,imageHostApi:()=>undefined,validateFolders:()=>({})};
 const ThoughtSpaceSettings=new Function(...Object.keys(deps),compiled)(...Object.values(deps));
 const saves:ThoughtSpacePreferences[]=[],pending:ReturnType<typeof deferred<void>>[]=[];
 let disk=cleanPluginSettings(raw),rendered=cleanPluginSettings(raw),refreshes=0,rebuilds=0,displays=0,reports=0;
 const host={settings:cleanPluginSettings(raw),manifest:{version:'test'},noteToolbar:{refresh:()=>{refreshes++;}},rebuildBoardSearch:()=>{rebuilds++;},savePreferences:()=>{const snapshot=structuredClone(host.settings);saves.push(snapshot);const task=deferred();pending.push(task);return task.promise.then(()=>{disk=snapshot;});}};
 const tab=new ThoughtSpaceSettings({vault:{configDir:'.obsidian'}},host);
 tab.language='en';tab.display=()=>{displays++;rendered=structuredClone(host.settings);};tab.report=()=>{reports++;};
 return{tab,host,saves,pending,delegated,modals,get disk(){return disk;},get rendered(){return rendered;},get refreshes(){return refreshes;},get rebuilds(){return rebuilds;},get displays(){return displays;},get reports(){return reports;}};
}

for(const firstSuccess of [true,false])for(const secondSuccess of [true,false])test(`overlapping settings transactions preserve order when saves ${firstSuccess?'succeed':'fail'} then ${secondSuccess?'succeed':'fail'}`,async()=>{
 const f=fixture(),first=f.tab.patch({accent:'blue'}),second=f.tab.patch({accent:'rose'}),results=Promise.allSettled([first,second]);
 await tick();assert.equal(f.saves.length,1);assert.equal(f.saves[0].accent,'blue');assert.equal(f.host.settings.accent,'blue');
 if(firstSuccess)f.pending[0].resolve();else f.pending[0].reject(Error('first write failed'));
 await tick();assert.equal(f.saves.length,2);assert.equal(f.saves[1].accent,'rose');
 if(secondSuccess)f.pending[1].resolve();else f.pending[1].reject(Error('second write failed'));
 const settled=await results;assert.deepEqual(settled.map(result=>result.status),[firstSuccess?'fulfilled':'rejected',secondSuccess?'fulfilled':'rejected']);
 const expected=secondSuccess?'rose':firstSuccess?'blue':'forest';
 assert.equal(f.host.settings.accent,expected);assert.equal(f.disk.accent,expected);assert.equal(f.reports,Number(!firstSuccess)+Number(!secondSuccess));
});

test('queued patches capture caller values and preserve unrelated host changes',async()=>{
 const f=fixture({cardFolder:'Keep/cards',settingsLanguage:'en'}),values={accent:'blue'},operation=f.tab.patch(values);
 values.accent='rose';f.host.settings.density='compact';await tick();
 assert.equal(f.saves[0].accent,'blue');assert.equal(f.saves[0].density,'compact');assert.equal(f.saves[0].cardFolder,'Keep/cards');
 f.pending[0].resolve();await operation;assert.equal(f.host.settings.settingsLanguage,'en');assert.equal(f.host.settings.density,'compact');
});

test('a rollback-triggered redraw cannot leave controls stale after a queued successful change',async()=>{
 const f=fixture(),first=f.tab.patch({accent:'blue'}),second=f.tab.patch({accent:'rose'}),settled=Promise.allSettled([first,second]);
 await tick();f.pending[0].reject(Error('first write failed'));await tick();f.pending[1].resolve();await settled;await tick();
 assert.equal(f.host.settings.accent,'rose');assert.equal(f.rendered.accent,'rose');
});

test('failed transaction rollback never overwrites a newer external value',async()=>{
 const f=fixture(),operation=f.tab.patch({accent:'blue',readingSize:20}),settled=Promise.allSettled([operation]);await tick();
 f.host.settings.accent='amber';f.host.settings.cardFolder='Keep/newer-cards';f.pending[0].reject(Error('write failed'));await settled;
 assert.equal(f.host.settings.accent,'amber');assert.equal(f.host.settings.readingSize,16);assert.equal(f.host.settings.cardFolder,'Keep/newer-cards');
});

test('successful side effects run after persistence and failed search settings never rebuild indexes',async()=>{
 const f=fixture(),operation=f.tab.patch({noteMarkdownToolbar:false,boardSearchEnabled:false});await tick();
 assert.equal(f.refreshes,0);assert.equal(f.rebuilds,0);f.pending[0].resolve();await operation;
 assert.equal(f.refreshes,1);assert.equal(f.rebuilds,1);assert.equal(f.tab.containerEl.dataset.accent,'forest');
 const failed=f.tab.patch({boardSearchEnabled:true}),settled=Promise.allSettled([failed]);await tick();f.pending[1].reject(Error('write failed'));await settled;
 assert.equal(f.host.settings.boardSearchEnabled,false);assert.equal(f.rebuilds,1);assert.equal(f.refreshes,2);assert.equal(f.displays,1);
});

test('delegated input controls edit a local draft and enqueue only each changed field',async()=>{
 const f=fixture();f.tab.renderPage('input',new Element('DIV'));const control=f.delegated[0];
 assert.notEqual(control.prefs,f.host.settings);control.prefs.zoomSpeed=1.5;const first=control.persist();
 control.prefs.leftDrag='select';const second=control.persist(),settled=Promise.allSettled([first,second]);
 assert.equal(f.host.settings.zoomSpeed,1);assert.equal(f.host.settings.leftDrag,'pan');
 f.host.settings.accent='amber';await tick();assert.equal(f.saves[0].zoomSpeed,1.5);assert.equal(f.saves[0].leftDrag,'pan');
 f.pending[0].reject(Error('first write failed'));await tick();assert.equal(f.saves[1].zoomSpeed,1);assert.equal(f.saves[1].leftDrag,'select');assert.equal(f.saves[1].accent,'amber');
 f.pending[1].resolve();await settled;assert.equal(f.host.settings.zoomSpeed,1);assert.equal(f.host.settings.leftDrag,'select');
});

test('delegated card defaults preserve a newer root setting and other page defaults',async()=>{
 const f=fixture();f.tab.renderPage('cards',new Element('DIV'));const control=f.delegated[0];
 const first=f.tab.patch({defaultCardStyle:'sticky'});control.prefs.defaultCardWidth=420;const second=control.persist();
 const settled=Promise.allSettled([first,second]);await tick();f.pending[0].resolve();await tick();
 assert.equal(f.saves[1].defaultCardStyle,'sticky');assert.equal(f.saves[1].defaultCardWidth,420);assert.equal(f.saves[1].defaultTextSize,16);
 f.pending[1].resolve();await settled;
});

function profileFixture(){
 const f=fixture();f.tab.profileModal(true);const modal=f.modals.at(-1),root=modal.contentEl as Element;
 const button=(label:string)=>root.querySelectorAll('button').find(item=>item.textContent===label)!;
 const input=root.querySelectorAll('textarea')[0],file=root.querySelectorAll('input')[0],status=root.querySelectorAll('.ts-settings-profile-status')[0];
 const setJson=(value:string)=>{input.value=value;input.oninput?.();};
 const choose=(task:ReturnType<typeof deferred<string>>,size=200)=>{file.files=[{size,text:()=>task.promise}];file.onchange?.();};
 return{...f,modal,root,input,file,status,button,setJson,choose};
}
const json=(accent:string)=>JSON.stringify({format:'thoughtspace-preferences',version:1,preferences:{accent}});

test('profile edits and oversized or unreadable file selections revoke an earlier validation immediately',async()=>{
 const f=profileFixture();f.setJson(json('blue'));f.button('Validate').click();assert.equal(f.button('Apply profile').disabled,false);
 f.setJson(json('rose'));assert.equal(f.button('Apply profile').disabled,true);f.button('Validate').click();
 f.choose(deferred<string>(),65_537);assert.equal(f.button('Apply profile').disabled,true);assert.match(f.status.textContent,/too large/);
 f.button('Validate').click();const read=deferred<string>();f.choose(read);assert.equal(f.button('Apply profile').disabled,true);
 read.reject(Error('read failed'));await tick();assert.equal(f.button('Apply profile').disabled,true);assert.match(f.status.textContent,/Could not read/);assert.equal(f.saves.length,0);
});

test('only the latest profile read can replace the JSON draft',async()=>{
 const f=profileFixture(),first=deferred<string>(),second=deferred<string>();f.choose(first);f.choose(second);
 second.resolve(json('rose'));await tick();assert.equal(f.input.value,json('rose'));
 first.resolve(json('blue'));await tick();assert.equal(f.input.value,json('rose'));assert.equal(f.button('Apply profile').disabled,true);
});

test('editing JSON invalidates a pending file read and closing suppresses detached writes',async()=>{
 const f=profileFixture(),first=deferred<string>();f.choose(first);f.setJson(json('amber'));first.resolve(json('blue'));await tick();assert.equal(f.input.value,json('amber'));
 const second=deferred<string>();f.choose(second);f.modal.close();const writes=f.status.writes;second.resolve(json('rose'));await tick();
 assert.equal(f.input.value,json('amber'));assert.equal(f.status.writes,writes);assert.equal(f.root.children.length,0);assert.equal(f.saves.length,0);
});

test('a pending profile read cannot reuse validation of the previous textarea content',async()=>{
 const f=profileFixture();f.setJson(json('blue'));f.button('Validate').click();const read=deferred<string>();f.choose(read);
 f.button('Validate').click();read.resolve(json('rose'));await tick();
 assert.equal(f.button('Apply profile').disabled,true);assert.equal(f.saves.length,0);
});

test('profile Apply validates again, persists only the patch, and keeps vault-specific state',async()=>{
 const f=profileFixture();f.host.settings.cardFolder='Keep/private';f.setJson(json('blue'));f.button('Validate').click();f.button('Apply profile').click();await tick();
 assert.equal(f.saves.length,1);assert.equal(f.saves[0].accent,'blue');assert.equal(f.saves[0].cardFolder,'Keep/private');assert.equal(f.button('Apply profile').disabled,true);
 f.pending[0].resolve();await tick();assert.equal(f.modal.closeCount,1);
});

test('closing a profile during Apply never closes it twice or updates detached status',async()=>{
 for(const success of [true,false]){
  const f=profileFixture();f.setJson(json('blue'));f.button('Validate').click();f.button('Apply profile').click();await tick();
  f.modal.close();const writes=f.status.writes;
  if(success)f.pending[0].resolve();else f.pending[0].reject(Error('write failed'));
  await tick();assert.equal(f.modal.closeCount,1);assert.equal(f.status.writes,writes);assert.equal(f.root.children.length,0);
 }
});
