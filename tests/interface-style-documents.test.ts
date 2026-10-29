import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {InterfaceStyleDocuments,designTokens,themePluginMenu,themeSurface} from '../src/ui-tokens';
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
 const sheet=styles.register(f.doc)!;assert.equal(sheet.dataset.interfaceStyle,'paper');assert.equal(sheet.dataset.glassEffects,'false');
 assert.equal(styles.register(f.doc),sheet);assert.equal(f.attached.size,1);assert.equal(f.writes,1);
 styles.update({interfaceStyle:'editorial',glassEffects:false});assert.equal(f.writes,1);
 styles.dispose();assert.equal(f.attached.size,0);
});

test('retired styles keep every existing and newly opened document on paper without redundant writes',()=>{
 const a=documentFixture(),b=documentFixture(),c=documentFixture(),styles=new InterfaceStyleDocuments({interfaceStyle:'glass',glassEffects:true});
 const first=styles.register(a.doc)!,second=styles.register(b.doc)!;const before=first.textContent;
 for(const interfaceStyle of ['editorial','glass','unknown',undefined])styles.update({interfaceStyle,glassEffects:true});
 assert.equal(first.dataset.interfaceStyle,'paper');assert.equal(first.dataset.glassEffects,'false');
 assert.equal(second.textContent,first.textContent);assert.equal(first.textContent,before);assert.equal(a.writes,1);assert.equal(b.writes,1);
 const third=styles.register(c.doc)!;assert.equal(third.textContent,first.textContent);assert.equal(third.dataset.interfaceStyle,'paper');
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

for(const succeeds of [true,false])test(`actual plugin preferences refresh only after ${succeeds?'successful':'failed'} persistence`,async()=>{
 const f=documentFixture(),styles=new InterfaceStyleDocuments({interfaceStyle:'editorial'}),sheet=styles.register(f.doc)!,before=sheet.textContent,pending=deferred(),plugin=new Plugin();
 let updates=0;const update=styles.update.bind(styles);styles.update=appearance=>{updates++;update(appearance);};
 Object.assign(plugin,{settings:cleanPluginSettings({interfaceStyle:'glass',paperColor:'#bbcccc',paperTexture:87}),interfaceStyles:styles,saveData:()=>pending.promise,app:{workspace:{getLeavesOfType:()=>[]}},refreshDock:()=>{}});
 const saving=plugin.savePreferences();assert.equal(updates,0);assert.equal(sheet.textContent,before);
 if(succeeds){pending.resolve();await saving;assert.equal(updates,1);}
 else{pending.reject(Error('storage unavailable'));await assert.rejects(saving,/storage unavailable/);assert.equal(updates,0);}
 assert.equal(sheet.dataset.interfaceStyle,'paper');assert.equal(sheet.dataset.glassEffects,'false');assert.equal(sheet.textContent,before);
 assert.equal(plugin.settings.paperColor,'#bbcccc');assert.equal(plugin.settings.paperTexture,87);styles.dispose();
});

test('dialog chrome ignores retired soft/glass switches while preserving accent and density',()=>{
 const source={dataset:{surface:'soft',glass:'true',accent:'blue',density:'compact'}},classes=new Set<string>();
 const el={dataset:{} as Record<string,string>,ownerDocument:{querySelector:()=>source},addClass:(name:string)=>classes.add(name)};
 themeSurface(el as unknown as HTMLElement,{accent:'rose',glassEffects:true});
 assert.deepEqual(el.dataset,{surface:'paper',glass:'false',accent:'rose',density:'compact'});assert.ok(classes.has('ts-ui-modal'));
});

test('palette mode and surface changes synchronize every registered document after persistence',()=>{const a=documentFixture(),b=documentFixture(),c=documentFixture(),styles=new InterfaceStyleDocuments({interfacePalette:'neutral',interfaceMode:'light',accent:'palette'});const first=styles.register(a.doc)!,second=styles.register(b.doc)!,before=first.textContent;styles.update({interfacePalette:'nord',interfaceMode:'dark',surfaceStyle:'soft',accent:'palette'});assert.notEqual(first.textContent,before);assert.equal(first.textContent,second.textContent);assert.equal(first.dataset.interfacePalette,'nord');assert.equal(second.dataset.interfaceMode,'dark');const third=styles.register(c.doc)!;assert.equal(third.textContent,first.textContent);const writes=a.writes;styles.update({interfacePalette:'nord',interfaceMode:'dark',surfaceStyle:'soft',accent:'palette'});assert.equal(a.writes,writes);styles.dispose();assert.equal(a.attached.size+b.attached.size+c.attached.size,0);});
