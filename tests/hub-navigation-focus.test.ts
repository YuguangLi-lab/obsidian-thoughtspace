import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {cleanHubFilter,defaultHubFilter,hubIndex,hubResults,saveHubFilter,HubPreferences} from '../src/space-hub';

const source=readFileSync('src/space-hub-view.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,`Missing actual hub method: ${start}`);return source.slice(a,b);}
const scopes=take('const scopes:', 'const palette='),methods=take('  private action(', '  private error(')+take('  private renderNav(', '  private renderResults(')+take('  private showDetail(', '  private focus(');
type Options=string|{cls?:string;attr?:Record<string,string>;text?:string;value?:string;type?:string};
class Element {
 children:Element[]=[];classes=new Set<string>();attrs:Record<string,string>={};dataset:Record<string,string>={};hidden=false;isConnected=true;open=false;value='';checked=false;focusOptions:unknown[]=[];onclick?:()=>void;textContent='';
 constructor(readonly ownerDocument:{activeElement:unknown},readonly tag='div',options:Options={}){if(typeof options==='string')options={cls:options};for(const cls of (options.cls||'').split(/\s+/).filter(Boolean))this.classes.add(cls);for(const [k,v]of Object.entries(options.attr||{}))this.setAttribute(k,v);this.value=options.value||'';this.textContent=options.text||'';}
 createEl(tag:string,options:Options={}){const child=new Element(this.ownerDocument,tag,options);this.children.push(child);return child;}
 createDiv(options:Options={}){return this.createEl('div',options);}
 createSpan(options:Options={}){return this.createEl('span',options);}
 addClass(name:string){this.classes.add(name);}
 removeClass(name:string){this.classes.delete(name);}
 toggleClass(name:string,on:boolean){if(on)this.addClass(name);else this.removeClass(name);}
 setAttribute(name:string,value:string){this.attrs[name]=value;}
 getAttribute(name:string){return this.attrs[name]??null;}
 contains(node:unknown):boolean{return node===this||this.children.some(c=>c.contains(node));}
 matches(selector:string){return selector.startsWith('.')?this.classes.has(selector.slice(1)):this.tag===selector;}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0]||null;}
 get options(){return this.querySelectorAll('option');}
 focus(options?:unknown){assert.ok(this.isConnected,'Cannot focus a removed navigation control');this.focusOptions.push(options);this.ownerDocument.activeElement=this;}
 disconnect(){if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=null;this.isConnected=false;this.children.forEach(c=>c.disconnect());}
 empty(){this.children.forEach(c=>c.disconnect());this.children=[];}
}
const View=new Function('HTMLElement','setIcon','cleanHubFilter','defaultHubFilter','hubResults','saveHubFilter',transformSync(`${scopes}class View{${methods}}return View;`,{loader:'ts'}).code)(Element,()=>{},cleanHubFilter,defaultHubFilter,hubResults,saveHubFilter);
function fixture(){
 const document={activeElement:null as unknown},nav=new Element(document,'nav'),detail=new Element(document,'aside'),modal=new Element(document),search=new Element(document,'input'),tag=new Element(document,'select'),sort=new Element(document,'select'),journals=new Element(document,'input');
 const prefs:HubPreferences={view:'gallery',recent:[],saved:[{id:'research/:"',name:'研究材料',filter:{...defaultHubFilter,scope:'notes',query:'论文',tag:'#研究',sort:'title',includeJournals:true}},{id:'second',name:'收件箱',filter:{...defaultHubFilter,scope:'inbox'}}]};
 const view=new View();let resultsRendered=0,detailRendered=0,saves=0;
 Object.assign(view,{nav,detail,modalEl:modal,search,tag,sort,journals,filter:{...defaultHubFilter},index:hubIndex([],[]),loaded:false,active:true,page:2,
  host:{preferences:()=>prefs,favorites:()=>[],save:async(next:HubPreferences)=>{saves++;Object.assign(prefs,next);}},error:(e:unknown)=>{throw e;},renderMetrics(){},renderResults(){resultsRendered++;},renderDetail(){detailRendered++;detail.empty();detail.createEl('h3');}
 });
 const button=(label:string)=>{const b=nav.querySelectorAll('button').find(b=>b.attrs['aria-label']===label);assert.ok(b,`Missing button ${label}`);return b;};
 const disclosure=(cls:string)=>{const d=nav.querySelector('.'+cls);assert.ok(d,`Missing disclosure ${cls}`);return d;};
 return{view,document,nav,detail,search,tag,sort,journals,prefs,button,disclosure,get resultsRendered(){return resultsRendered;},get detailRendered(){return detailRendered;},get saves(){return saves;}};
}
test('first navigation render leaves disclosures closed and preserves search focus',()=>{
 const f=fixture();f.search.focus();f.view.renderNav();assert.equal(f.document.activeElement,f.search);assert.equal(f.disclosure('ts-hub-saved-disclosure').open,false);assert.equal(f.disclosure('ts-hub-insights').open,false);assert.equal(f.saves,0);
});
test('keyboard scope activation restores the equivalent new button and preserves disclosure states',()=>{
 const f=fixture();f.view.renderNav();f.disclosure('ts-hub-saved-disclosure').open=true;const old=f.button('全部笔记');old.focus();old.onclick!();
 assert.equal(f.view.filter.scope,'notes');assert.equal(f.view.page,0);assert.equal(f.document.activeElement,f.button('全部笔记'));assert.notEqual(f.document.activeElement,old);assert.equal(old.isConnected,false);assert.deepEqual(f.button('全部笔记').focusOptions,[{preventScroll:true}]);assert.equal(f.button('全部笔记').attrs['aria-pressed'],'true');assert.equal(f.disclosure('ts-hub-saved-disclosure').open,true);assert.equal(f.disclosure('ts-hub-insights').open,false);assert.equal(f.resultsRendered,1);assert.equal(f.detailRendered,1);
});
test('index refresh preserves a focused unselected scope instead of jumping to the active scope',()=>{
 const f=fixture();f.view.renderNav();f.button('收藏白板').focus();f.view.loaded=true;f.view.renderNav();assert.equal(f.view.filter.scope,'boards');assert.equal(f.document.activeElement,f.button('收藏白板'));assert.equal(f.nav.querySelectorAll('.ts-hub-nav-count').length,6);
});
test('saved filter activation restores its button by identity and keeps query controls synchronized',()=>{
 const f=fixture();f.view.renderNav();f.disclosure('ts-hub-saved-disclosure').open=true;f.disclosure('ts-hub-insights').open=true;const old=f.button('研究材料');old.focus();old.onclick!();
 assert.deepEqual(f.view.filter,f.prefs.saved[0].filter);assert.equal(f.search.value,'论文');assert.equal(f.tag.value,'#研究');assert.equal(f.tag.options.length,1);assert.equal(f.sort.value,'title');assert.equal(f.journals.checked,true);assert.equal(f.document.activeElement,f.button('研究材料'));assert.equal(f.disclosure('ts-hub-saved-disclosure').open,true);assert.equal(f.disclosure('ts-hub-insights').open,true);assert.equal(f.saves,0);
});
for(const cls of ['ts-hub-saved-disclosure','ts-hub-insights'])test(`refresh preserves ${cls} open state and summary focus, including a later close`,()=>{
 const f=fixture();f.view.renderNav();let d=f.disclosure(cls);d.open=true;d.querySelector('summary')!.focus();f.view.renderNav();d=f.disclosure(cls);assert.equal(d.open,true);assert.equal(f.document.activeElement,d.querySelector('summary'));d.open=false;f.view.renderNav();assert.equal(f.disclosure(cls).open,false);assert.equal(f.document.activeElement,f.disclosure(cls).querySelector('summary'));
});
test('refresh never steals search or detail focus while remapping the detail return control after rename',()=>{
 const f=fixture();f.view.renderNav();f.disclosure('ts-hub-saved-disclosure').open=true;f.button('管理 研究材料').focus();f.button('管理 研究材料').onclick!();const input=f.document.activeElement;
 f.prefs.saved[0].name='研究证据';f.view.renderNav();assert.equal(f.document.activeElement,input);assert.equal(f.view.detailReturnFocus,f.button('管理 研究证据'));f.view.closeDetail();assert.equal(f.document.activeElement,f.button('管理 研究证据'));
 f.search.focus();f.view.renderNav();assert.equal(f.document.activeElement,f.search);
});
test('removed saved filter falls back to its current scope for both active and deferred return focus',()=>{
 for(const managing of [false,true]){const f=fixture();f.view.filter.scope='inbox';f.view.renderNav();f.disclosure('ts-hub-saved-disclosure').open=true;const old=f.button(managing?'管理 研究材料':'研究材料');old.focus();if(managing)old.onclick!();const input=f.document.activeElement;f.prefs.saved.shift();f.view.renderNav();if(managing){assert.equal(f.document.activeElement,input);f.view.closeDetail();}assert.equal(f.document.activeElement,f.button('笔记收件箱'));assert.equal(f.saves,0);}
});
test('navigation refresh retains the save-current entry focus without opening detail or writing preferences',()=>{
 const f=fixture();f.view.renderNav();f.disclosure('ts-hub-saved-disclosure').open=true;f.button('保存当前筛选').focus();f.view.renderNav();assert.equal(f.document.activeElement,f.button('保存当前筛选'));assert.equal(f.detailRendered,0);assert.equal(f.saves,0);
});
test('returning to a saved filter in a collapsed disclosure focuses its visible summary',()=>{
 const f=fixture();f.view.renderNav();f.disclosure('ts-hub-saved-disclosure').open=true;f.button('管理 研究材料').focus();f.button('管理 研究材料').onclick!();const input=f.document.activeElement;f.disclosure('ts-hub-saved-disclosure').open=false;f.view.renderNav();assert.equal(f.document.activeElement,input);f.view.closeDetail();assert.equal(f.document.activeElement,f.disclosure('ts-hub-saved-disclosure').querySelector('summary'));assert.equal(f.disclosure('ts-hub-saved-disclosure').open,false);
});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function editSaved(f:ReturnType<typeof fixture>,label:string){f.view.renderNav();f.disclosure('ts-hub-saved-disclosure').open=true;const launcher=f.button(label);launcher.focus();launcher.onclick!();return f.detail.querySelector('input')!;}
function submit(f:ReturnType<typeof fixture>,label:string){const button=f.detail.querySelectorAll('button').find(b=>b.attrs['aria-label']===label);assert.ok(button);button.focus();button.onclick!();}
test('saving a renamed filter returns to its renamed management control after successful persistence',async()=>{
 const f=fixture(),input=editSaved(f,'管理 研究材料');input.value='研究证据';submit(f,'保存名称');await settle();assert.equal(f.prefs.saved.find(s=>s.id==='research/:"')?.name,'研究证据');assert.equal(f.document.activeElement,f.button('管理 研究证据'));assert.equal(f.detail.hidden,true);assert.equal(f.disclosure('ts-hub-saved-disclosure').open,true);assert.equal(f.saves,1);
});
test('deleting a saved filter returns to the current scope instead of a removed button',async()=>{
 const f=fixture();f.view.filter.scope='notes';editSaved(f,'管理 研究材料');submit(f,'删除筛选');await settle();assert.equal(f.prefs.saved.length,1);assert.equal(f.document.activeElement,f.button('全部笔记'));assert.equal(f.detail.hidden,true);assert.equal(f.saves,1);
});
test('saving a new filter returns to the still-visible save entry',async()=>{
 const f=fixture(),input=editSaved(f,'保存当前筛选');input.value='新筛选';submit(f,'保存筛选');await settle();assert.equal(f.prefs.saved.length,3);assert.equal(f.document.activeElement,f.button('保存当前筛选'));assert.equal(f.detail.hidden,true);assert.equal(f.saves,1);
});
test('a pending save does not steal focus if the user has returned to search',async()=>{
 const f=fixture(),input=editSaved(f,'管理 研究材料');let complete!:()=>void;f.view.host.save=(next:HubPreferences)=>new Promise<void>(resolve=>{complete=()=>{Object.assign(f.prefs,next);resolve();};});input.value='研究证据';submit(f,'保存名称');f.search.focus();complete();await settle();assert.equal(f.document.activeElement,f.search);assert.equal(f.prefs.saved.at(-1)?.name,'研究证据');
});
test('a pending save does not redraw a different detail panel opened in the meantime',async()=>{
 const f=fixture(),input=editSaved(f,'管理 研究材料');let complete!:()=>void;f.view.host.save=(next:HubPreferences)=>new Promise<void>(resolve=>{complete=()=>{Object.assign(f.prefs,next);resolve();};});input.value='研究证据';submit(f,'保存名称');f.button('管理 收件箱').focus();f.button('管理 收件箱').onclick!();const otherInput=f.detail.querySelector('input');assert.ok(otherInput);complete();await settle();assert.equal(f.document.activeElement,otherInput);assert.equal(otherInput.isConnected,true);assert.equal(f.detailRendered,0);assert.equal(f.detail.hidden,false);
});
test('pending persistence after modal close performs no navigation rendering or focus changes',async()=>{
 const f=fixture(),input=editSaved(f,'管理 研究材料');let complete!:()=>void;f.view.host.save=()=>new Promise<void>(resolve=>{complete=resolve;});input.value='研究证据';submit(f,'保存名称');const children=f.nav.children;f.view.active=false;f.detail.empty();const elsewhere=new Element(f.document,'input');elsewhere.focus();complete();await settle();assert.equal(f.nav.children,children);assert.equal(f.document.activeElement,elsewhere);assert.equal(f.detailRendered,0);
});
