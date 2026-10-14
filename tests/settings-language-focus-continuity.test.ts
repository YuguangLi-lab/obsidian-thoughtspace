import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {cleanPluginSettings,type ThoughtSpacePreferences} from '../src/plugin-settings';
import {resolveSettingsLanguage,settingsCategoryDefaults,exportSettingsProfile,parseSettingsProfile} from '../src/settings-preferences';
import {applyBoardMousePreset,defaultBoardPreferences,resetBoardInputPreferences,resetBoardPagePreferences} from '../src/board-experience';
import {setUiFeedback} from '../src/ui-feedback';

// Full production display/filter/language callbacks and mouse preference renderer;
// only the Obsidian framework/DOM/persistence are explicit, local substitutes.
type Options={cls?:string;text?:string;attr?:Record<string,string>;type?:string;value?:string};
class Document {
 readonly body=new Element(this,'BODY');activeElement=this.body;
}
class Element {
 children:Element[]=[];parentElement:Element|null=null;dataset:Record<string,string>={};attributes:Record<string,string>={};classes=new Set<string>();
 value='';disabled=false;hidden=false;lang='';writes=0;private text='';onclick?:()=>void;oninput?:()=>void;onchange?:()=>void;onkeydown?:unknown;
 readonly classList={contains:(name:string)=>this.classes.has(name)};
 constructor(readonly ownerDocument:Document,readonly tagName:string,options:Options|string={}){const o=typeof options==='string'?{cls:options}:options;this.text=o.text||'';this.value=o.value||'';for(const c of(o.cls||'').split(/\s+/).filter(Boolean))this.classes.add(c);for(const[k,v]of Object.entries(o.attr||{}))this.setAttribute(k,v);if(o.type)this.attributes.type=o.type;}
 get isConnected():boolean{return this===this.ownerDocument.body||!!this.parentElement?.isConnected;}
 get textContent():string{return this.text+this.children.map(c=>c.textContent).join('');}
 createEl(tag:string,opts:Options|string={}){const e=new Element(this.ownerDocument,tag.toUpperCase(),opts);e.parentElement=this;this.children.push(e);this.writes++;return e;}
 createDiv(opts:Options|string={}){return this.createEl('div',opts);}createSpan(opts:Options|string={}){return this.createEl('span',opts);}
 addClass(...names:string[]){names.forEach(n=>this.classes.add(n));}toggleClass(name:string,on:boolean){if(on)this.classes.add(name);else this.classes.delete(name);}
 setAttribute(name:string,value:string){this.attributes[name]=value;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_m,c:string)=>c.toUpperCase())]=value;}
 removeAttribute(name:string){delete this.attributes[name];}getAttribute(name:string){return this.attributes[name]??null;}
 contains(e:Element|null):boolean{return !!e&&(e===this||this.children.some(c=>c.contains(e)));}
 empty(){if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;for(const c of this.children)c.parentElement=null;this.children=[];this.text='';this.writes++;}
 setText(text:string){this.empty();this.text=text;}focus(_options?:unknown){if(this.isConnected)this.ownerDocument.activeElement=this;}click(){if(!this.disabled)this.onclick?.();}
 addEventListener(_name:string,_handler:()=>void){} // This fixture exercises language events; IME events have their own production-path tests.
 remove(){if(!this.parentElement)return;const parent=this.parentElement;if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;parent.children=parent.children.filter(c=>c!==this);this.parentElement=null;}
 private simple(selector:string){const attr=selector.match(/^\[data-setting-key=["']?([^"'\]]+)["']?\]$/);if(attr)return this.dataset.settingKey===attr[1];const parts=selector.split('.'),tag=parts.shift();return(!tag||tag.toUpperCase()===this.tagName)&&parts.every(c=>this.classes.has(c));}
 querySelectorAll(selector:string):Element[]{const choices=selector.split(',').map(s=>s.trim());const matches=(e:Element)=>choices.some(s=>{if(s.startsWith(':scope > '))return e.parentElement===this&&e.simple(s.slice(9));const child=s.split(/\s*>\s*/);return child.length===2?e.simple(child[1])&&!!e.parentElement?.simple(child[0]):e.simple(s);});return this.children.flatMap(c=>[...(matches(c)?[c]:[]),...c.querySelectorAll(selector).filter(e=>matches(e))]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0]||null;}
}
class Setting {
 readonly settingEl:Element;private info:Element;private control:Element;
 constructor(parent:Element){this.settingEl=parent.createDiv('setting-item');this.info=this.settingEl.createDiv('setting-item-info');this.control=this.settingEl.createDiv('setting-item-control');}
 setName(text:string){this.info.createDiv({cls:'setting-item-name',text});return this;}setDesc(text:string){this.info.createDiv({cls:'setting-item-description',text});return this;}setHeading(){this.settingEl.addClass('setting-item-heading');return this;}
 addButton(build:(b:any)=>void){const el=this.control.createEl('button'),b={buttonEl:el,setButtonText:(t:string)=>{el.setText(t);return b;},setIcon:()=>b,setCta:()=>b,setDisabled:(v:boolean)=>{el.disabled=v;return b;},onClick:(fn:()=>void)=>{el.onclick=fn;return b;}};build(b);return this;}
 addDropdown(build:(c:any)=>void){const el=this.control.createEl('select'),c={selectEl:el,addOptions:(o:Record<string,string>)=>{Object.entries(o).forEach(([value,text])=>el.createEl('option',{value,text}));return c;},setValue:(v:string)=>{el.value=v;return c;},onChange:(fn:(v:string)=>void)=>{el.onchange=()=>fn(el.value);return c;}};build(c);return this;}
 addToggle(build:(c:any)=>void){const c={setValue:()=>c,onChange:()=>c};build(c);return this;}addText(build:(c:any)=>void){const el=this.control.createEl('input'),c={setValue:(v:string)=>{el.value=v;return c;},onChange:(fn:(v:string)=>void)=>{el.oninput=()=>fn(el.value);return c;}};build(c);return this;}
}
function deferred(){let resolve!:()=>void,reject!:(e:Error)=>void;const promise=new Promise<void>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
const tick=()=>new Promise<void>(r=>setImmediate(r));
const compile=(file:string,result:string)=>transformSync(readFileSync(file,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'')+'\nreturn '+result+';',{loader:'ts'}).code;
// Explicit frozen-source override is only for reproducible RED evidence; the
// ordinary suite always executes the current production module.
const settingsCode=compile(process.env.THOUGHTSPACE_SETTINGS_TEST_SOURCE||'src/settings-view.ts','ThoughtSpaceSettings'),controlsCode=compile('src/board-experience-view.ts','({boardPreferenceControls,mousePreferenceControls})');
function fixture(){
 const doc=new Document(),notices:string[]=[];
 class PluginSettingTab {containerEl=doc.body.createDiv();constructor(readonly app:unknown){}hide(){}}
 class Modal {modalEl=new Element(doc,'DIV');titleEl=this.modalEl.createDiv();contentEl=this.modalEl.createDiv();open(){}close(){}}
 const basic={Modal,PluginSettingTab,Setting,Notice:class{constructor(text:string){notices.push(text);}},setIcon:()=>{},themeSurface:()=>{}};
 const controlsDeps={...basic,applyBoardMousePreset,defaultBoardPreferences,resetBoardInputPreferences,resetBoardPagePreferences};
 const controls=new Function(...Object.keys(controlsDeps),controlsCode)(...Object.values(controlsDeps));
 const deps={...basic,...controls,setUiFeedback,getLanguage:()=> 'zh-CN',resolveSettingsLanguage,settingsCategoryDefaults,exportSettingsProfile,parseSettingsProfile,hostSettings:()=>undefined,imageHostApi:()=>undefined,validateFolders:()=>({})};
 const View=new Function(...Object.keys(deps),settingsCode)(...Object.values(deps));
 const pending:ReturnType<typeof deferred>[]=[],saves:ThoughtSpacePreferences[]=[];
 let disk=cleanPluginSettings({settingsLanguage:'zh-CN',cardFolder:'Keep/cards'});
 const host={settings:structuredClone(disk),manifest:{version:'test'},journalRoot:'Keep/journal',savePreferences:()=>{const snapshot=structuredClone(host.settings);saves.push(snapshot);const d=deferred();pending.push(d);return d.promise.then(()=>{disk=snapshot;});}};
 const view=new View({vault:{configDir:'.obsidian'}},host),root=view.containerEl as Element,external=doc.body.createEl('input');
 let displays=0;const display=view.display.bind(view);view.display=()=>{displays++;display();};view.display();
 const language=()=>root.querySelector('[data-setting-key=settingsLanguage]')!;
 const search=()=>root.querySelector('input')!;
 const change=(value:string,control=language())=>{control.value=value;control.onchange!();};
 const resolve=async(i:number)=>{pending[i].resolve();await tick();};const reject=async(i:number)=>{pending[i].reject(Error('fixture save failed'));await tick();};
 return{doc,view,root,host,external,notices,pending,saves,language,search,change,resolve,reject,get disk(){return disk;},get displays(){return displays;}};
}

test('language success redraw restores the still-focused language control and preserves unrelated fields',async()=>{const f=fixture(),old=f.language();old.focus();f.change('en');await tick();assert.ok(f.doc.activeElement===old);assert.equal(f.saves.length,1);await f.resolve(0);assert.ok(!(f.language()===old));assert.ok(f.doc.activeElement===f.language());assert.equal(f.root.lang,'en');assert.equal(f.host.settings.cardFolder,'Keep/cards');assert.deepEqual(f.disk,f.host.settings);});
test('language rollback redraw restores the focused control with the saved previous value',async()=>{const f=fixture();f.language().focus();f.change('en');await tick();await f.reject(0);assert.ok(f.doc.activeElement===f.language());assert.equal(f.language().value,'zh-CN');assert.equal(f.root.lang,'zh-CN');assert.equal(f.host.settings.settingsLanguage,'zh-CN');assert.equal(f.disk.settingsLanguage,'zh-CN');assert.equal(f.notices.length,1);});
for(const fails of [false,true])test(`language ${fails?'rollback':'success'} never steals external focus`,async()=>{const f=fixture();f.language().focus();f.change('en');await tick();f.external.focus();if(fails)await f.reject(0);else await f.resolve(0);assert.ok(f.doc.activeElement===f.external);});
test('moving to search before saving never restores language focus or clears its query',async()=>{const f=fixture();f.language().focus();f.change('en');await tick();const input=f.search();input.value='方向键';input.oninput!();input.focus();await f.resolve(0);assert.ok(!(f.doc.activeElement===f.language()));assert.equal(f.search().value,'方向键');});
for(const fails of [false,true])test(`hidden settings revoke language intent before ${fails?'failed':'successful'} save completion`,async()=>{const f=fixture();f.language().focus();f.change('en');await tick();f.view.hide();f.doc.activeElement=f.doc.body;if(fails)await f.reject(0);else await f.resolve(0);assert.ok(!(f.doc.activeElement===f.language()));});
test('detached settings do not redraw or refocus after language save completes',async()=>{const f=fixture();f.language().focus();f.change('en');await tick();f.root.remove();const displays=f.displays;await f.resolve(0);assert.equal(f.displays,displays);assert.ok(f.doc.activeElement===f.doc.body);assert.equal(f.disk.settingsLanguage,'en');});
test('an independent display invalidates the old language render intent',async()=>{const f=fixture();f.language().focus();f.change('en');await tick();f.view.display();const displays=f.displays,newControl=f.language();f.external.focus();await f.resolve(0);assert.equal(f.displays,displays);assert.ok(f.language()===newControl);assert.ok(f.doc.activeElement===f.external);});
for(const firstFails of [false,true])for(const secondFails of [false,true])test(`two language changes keep current focus and transaction order (${firstFails}/${secondFails})`,async()=>{const f=fixture(),old=f.language();old.focus();f.change('en');f.change('zh-CN');await tick();assert.equal(f.saves.length,1);if(firstFails)await f.reject(0);else await f.resolve(0);assert.equal(f.saves.length,2);assert.equal(f.displays,1,'an older language result cannot redraw the latest focused select');assert.ok(f.language()===old);assert.ok(f.doc.activeElement===old);if(secondFails)await f.reject(1);else await f.resolve(1);assert.equal(f.displays,2);assert.ok(f.doc.activeElement===f.language());const expected=secondFails&&!firstFails?'en':'zh-CN';assert.equal(f.language().value,expected);assert.equal(f.disk.settingsLanguage,expected);assert.equal(f.host.settings.settingsLanguage,expected);assert.equal(f.notices.length,Number(firstFails)+Number(secondFails));assert.equal(f.host.settings.cardFolder,'Keep/cards');});
test('search hides actual mouse-only explanatory prose while preserving matching setting rows and clearing restores it',()=>{const f=fixture(),p=f.root.querySelector('.ts-board-preferences > p.ts-muted')!;assert.match(p.textContent,/三个鼠标按钮/);f.search().value='方向键';f.search().oninput!();assert.equal(f.root.querySelector('.ts-settings-search-count')!.textContent,'找到 3 项设置');assert.equal(p.hidden,true);const visible=f.root.querySelectorAll('.setting-item').filter(e=>!e.hidden&&['arrowNudge','nudgeStep','fastNudge'].includes(e.dataset.settingKey));assert.equal(visible.length,3);f.search().value='';f.search().oninput!();assert.equal(p.hidden,false);assert.match(p.textContent,/三个鼠标按钮/);assert.equal(f.saves.length,0);});
