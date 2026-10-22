import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {InterfaceStyleDocuments,designTokens,themePluginMenu} from '../src/ui-tokens';
import {cleanPluginSettings} from '../src/plugin-settings';

function documentFixture(){
 const attached=new Set<unknown>(),window={closed:false};let writes=0;
 const doc={defaultView:window,createElement:(tag:string)=>{
  assert.equal(tag,'style');let text='';
  return{dataset:{} as Record<string,string>,get textContent(){return text;},set textContent(value:string){text=value;writes++;},remove(){attached.delete(this);}};
 },head:{appendChild:(el:unknown)=>{attached.add(el);}}};
 return{doc:doc as unknown as Document,window,attached,get writes(){return writes;}};
}

test('document sheets work without any board DOM and repeated registration is idempotent',()=>{
 const f=documentFixture(),styles=new InterfaceStyleDocuments({interfaceStyle:'editorial',glassEffects:false});
 const sheet=styles.register(f.doc)!;assert.equal(sheet.dataset.interfaceStyle,'editorial');assert.equal(sheet.dataset.glassEffects,'false');
 assert.equal(styles.register(f.doc),sheet);assert.equal(f.attached.size,1);assert.equal(f.writes,1);
 styles.update({interfaceStyle:'editorial',glassEffects:false});assert.equal(f.writes,1);
 styles.dispose();assert.equal(f.attached.size,0);
});

test('switching updates each existing document once and newly opened windows inherit the selected style',()=>{
 const a=documentFixture(),b=documentFixture(),c=documentFixture(),styles=new InterfaceStyleDocuments();
 const first=styles.register(a.doc)!,second=styles.register(b.doc)!;assert.equal(first.dataset.interfaceStyle,'paper');
 const before=first.textContent;styles.update({interfaceStyle:'glass',glassEffects:true});
 assert.equal(first.dataset.interfaceStyle,'glass');assert.equal(second.textContent,first.textContent);assert.notEqual(first.textContent,before);
 assert.equal(a.writes,2);assert.equal(b.writes,2);const third=styles.register(c.doc)!;assert.equal(third.textContent,first.textContent);
 styles.update({interfaceStyle:'glass',glassEffects:false});assert.equal(first.dataset.glassEffects,'false');assert.equal(third.textContent,first.textContent);
 styles.dispose();assert.equal(a.attached.size+b.attached.size+c.attached.size,0);
});

test('closed documents and unload release sheets; late layout callbacks cannot recreate them',()=>{
 const a=documentFixture(),b=documentFixture(),styles=new InterfaceStyleDocuments();
 styles.register(a.doc);styles.register(b.doc);styles.release(a.doc);styles.release(a.doc);assert.equal(a.attached.size,0);
 b.window.closed=true;styles.update({interfaceStyle:'editorial'});assert.equal(b.attached.size,0);assert.equal(styles.register(b.doc),undefined);
 styles.dispose();assert.equal(styles.register(a.doc),undefined);styles.update({interfaceStyle:'glass'});styles.dispose();assert.equal(a.attached.size,0);
});

test('standalone token creation remains compatible and defaults to paper without changing document attributes',()=>{
 const f=documentFixture(),sheet=designTokens(f.doc);assert.equal(sheet.dataset.thoughtspaceTokens,'true');assert.equal(sheet.dataset.interfaceStyle,'paper');assert.equal(f.attached.size,1);sheet.remove();
});

test('only explicitly owned DOM menus opt into interface styles while native menus and their behavior stay untouched',()=>{
 const native={scope:{original:true},useNative:true};assert.equal(themePluginMenu(native),native);assert.deepEqual(native,{scope:{original:true},useNative:true});
 const classes=new Set<string>(),source={dataset:{accent:'blue',density:'compact'}},scope={original:true};
 const dom={classList:{add:(name:string)=>classes.add(name)},dataset:{} as Record<string,string>,ownerDocument:{querySelector:()=>source}};
 const menu={dom,scope,hide:()=>42},hide=menu.hide;assert.equal(themePluginMenu(menu),menu);
 assert.deepEqual([...classes],['ts-ui-menu']);assert.deepEqual(dom.dataset,{accent:'blue',density:'compact'});assert.equal(menu.scope,scope);assert.equal(menu.hide,hide);
});

const main=readFileSync('src/main.ts','utf8'),start=main.indexOf('  async savePreferences() {'),end=main.indexOf('  async session(',start);
assert.ok(start>=0&&end>start);
const dependencies={VIEW:'board',COLLECTION_VIEW_TYPE:'collection',WRITING:'writing',MEDIA_WORKSPACE:'media',ONLINE_WORKSPACE:'online',MATERIALS:'materials',BoardView:class{},CollectionView:class{},WritingView:class{},MediaWorkspaceView:class{},OnlineWorkspaceView:class{},MaterialsView:class{}};
const Plugin=new Function(...Object.keys(dependencies),transformSync(`class Plugin{${main.slice(start,end)}}return Plugin;`,{loader:'ts'}).code)(...Object.values(dependencies));
function deferred(){let resolve!:()=>void,reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}

for(const succeeds of [true,false])test(`the actual plugin save ${succeeds?'commits':'does not apply'} interface changes ${succeeds?'after':'when failing'} persistence`,async()=>{
 const f=documentFixture(),styles=new InterfaceStyleDocuments({interfaceStyle:'editorial'}),sheet=styles.register(f.doc)!,before=sheet.textContent,pending=deferred(),plugin=new Plugin();
 Object.assign(plugin,{settings:cleanPluginSettings({interfaceStyle:'glass',glassEffects:false}),interfaceStyles:styles,saveData:()=>pending.promise,app:{workspace:{getLeavesOfType:()=>[]}},refreshDock:()=>{}});
 const saving=plugin.savePreferences();assert.equal(sheet.textContent,before);assert.equal(sheet.dataset.interfaceStyle,'editorial');
 if(succeeds){pending.resolve();await saving;assert.equal(sheet.dataset.interfaceStyle,'glass');assert.equal(sheet.dataset.glassEffects,'false');assert.notEqual(sheet.textContent,before);}
 else{pending.reject(Error('storage unavailable'));await assert.rejects(saving,/storage unavailable/);assert.equal(sheet.textContent,before);assert.equal(sheet.dataset.interfaceStyle,'editorial');}
 styles.dispose();
});
