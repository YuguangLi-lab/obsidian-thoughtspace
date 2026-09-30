import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {cleanPaperPreferences,paperAppearanceStamp,paperBaseColor,paperPresets} from '../src/paper-appearance';
import {cleanBackgroundImagePreferences,backgroundImageStamp,MAX_BACKGROUND_IMAGE_BYTES} from '../src/background-image';

type Options={cls?:string;text?:string;attr?:Record<string,string>;type?:string};
class Element {
 children:Element[]=[];attributes:Record<string,string>={};classes=new Set<string>();value='';disabled=false;hidden=false;private text='';onclick?:()=>void;oninput?:()=>void;onkeydown:unknown=null;
 style={values:{} as Record<string,string>,setProperty(name:string,value:string){this.values[name]=value;}};
 ownerDocument={createElement:()=>({decoding:'',src:'',naturalWidth:320,naturalHeight:200,decode:()=>Promise.resolve()})};
 constructor(readonly tagName:string,options:Options|string={}){const opts=typeof options==='string'?{cls:options}:options;this.text=opts.text||'';this.attributes={...opts.attr};if(opts.type)this.attributes.type=opts.type;for(const cls of (opts.cls||'').split(/\s+/).filter(Boolean))this.classes.add(cls);}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 createEl(tag:string,options:Options|string={}){const child=new Element(tag.toUpperCase(),options);this.children.push(child);return child;}
 createDiv(options:Options|string={}){return this.createEl('div',options);}createSpan(options:Options|string={}){return this.createEl('span',options);}
 addClass(...names:string[]){for(const name of names)this.classes.add(name);}setAttribute(name:string,value:string){this.attributes[name]=value;}getAttribute(name:string){return this.attributes[name]??null;}
 setText(text:string){this.text=text;this.children=[];}empty(){this.children=[];this.text='';}prepend(child:Element){this.children=this.children.filter(item=>item!==child);this.children.unshift(child);}
 setCssProps(values:Record<string,string>){Object.assign(this.style.values,values);}click(){if(!this.disabled)this.onclick?.();}
 all():Element[]{return[this,...this.children.flatMap(child=>child.all())];}
}
class Modal {readonly modalEl=new Element('DIV');readonly titleEl=this.modalEl.createEl('h2');readonly contentEl=this.modalEl.createDiv();closeCount=0;constructor(readonly app:unknown){}close(){this.closeCount++;(this as unknown as {onClose:()=>void}).onClose();}}
const notices:string[]=[];
const dependencies={Modal,Notice:class {constructor(text:string){notices.push(text);}},themeSurface:()=>{},setIcon:()=>{},cleanPaperPreferences,paperAppearanceStamp,paperBaseColor,paperPresets,cleanBackgroundImagePreferences,backgroundImageStamp,MAX_BACKGROUND_IMAGE_BYTES};
function load(filename:string,name:string){const source=readFileSync(`src/${filename}.ts`,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');return new Function(...Object.keys(dependencies),transformSync(`${source}\nreturn ${name};`,{loader:'ts'}).code)(...Object.values(dependencies));}
const Paper=load('paper-settings-view','PaperSettingsModal'),Background=load('background-image-view','BackgroundImageModal');
function fixture(kind:'paper'|'background',language?:'zh-CN'|'en'){
 let current:unknown=kind==='paper'?cleanPaperPreferences({}):cleanBackgroundImagePreferences({backgroundImagePath:'Images/paper.png'});
 const saved:unknown[]=[];let saveError=false;
 const host={language,preferences:()=>current,resource:(path:string)=>`app://vault/${path}`,save:async(value:unknown)=>{if(saveError)throw Error('disk full');saved.push(value);}};
 const modal=new(kind==='paper'?Paper:Background)({},host);modal.onOpen();const root=modal.modalEl as Element;
 const control=(label:string)=>{const found=root.all().find(el=>el.getAttribute('aria-label')===label||(el.tagName==='BUTTON'&&el.textContent===label));assert.ok(found,`Missing ${label}`);return found;};
 return {root,modal,host,saved,control,get status(){return root.all().find(el=>el.classes.has(kind==='paper'?'ts-paper-settings-status':'ts-background-settings-status'))!;},setCurrent:(value:unknown)=>{current=value;},failSave:()=>{saveError=true;}};
}
const tick=async()=>{await Promise.resolve();await Promise.resolve();};
const englishOnly=(root:Element)=>{for(const el of root.all()){assert.doesNotMatch(el.textContent,/[\u3400-\u9fff]/);for(const key of ['aria-label','title','placeholder'])assert.doesNotMatch(el.getAttribute(key)||'',/[\u3400-\u9fff]/);}};

for(const kind of ['paper','background'] as const){
 test(`${kind} settings render full English text and accessible labels`,()=>{const f=fixture(kind,'en');englishOnly(f.root);assert.equal(f.control('Apply').disabled,false);assert.equal(f.control('Cancel').tagName,'BUTTON');if(kind==='paper')for(const label of ['Cream paper','White paper','Ivory paper','Kraft paper','Recycled paper'])assert.ok(f.control(label));else for(const label of ['Cover','Contain','Tile'])assert.ok(f.control(label));});
 test(`${kind} settings preserve Chinese as the default and explicit Chinese locale`,()=>{for(const language of [undefined,'zh-CN'] as const){const f=fixture(kind,language);assert.ok(f.control('应用'));assert.ok(f.control('取消'));assert.match(f.root.textContent,/[\u3400-\u9fff]/);}});
 test(`${kind} conflict and reload state stay English without saving`,async()=>{const f=fixture(kind,'en');f.setCurrent(kind==='paper'?cleanPaperPreferences({paperTexture:12}):cleanBackgroundImagePreferences({backgroundImagePath:'Images/paper.png',backgroundImageOpacity:12}));f.control('Apply').click();await tick();assert.match(f.status.textContent,/another window/);englishOnly(f.root);assert.equal(f.saved.length,0);assert.equal(f.control('Apply').disabled,true);f.control('Reload current settings').click();assert.equal(f.control('Apply').disabled,false);});
 test(`${kind} save failure and retry message stay English`,async()=>{const f=fixture(kind,'en');f.failSave();f.control('Apply').click();await tick();assert.match(f.status.textContent,/Could not save.*disk full.*retry/);englishOnly(f.root);assert.equal(f.control('Apply').disabled,false);assert.equal(f.modal.closeCount,0);});
 test(`${kind} pending state and detached failure notice stay English`,async()=>{const f=fixture(kind,'en');let reject!:(reason:Error)=>void;f.host.save=()=>new Promise<void>((_,no)=>{reject=no;});const count=notices.length;f.control('Apply').click();assert.match(f.status.textContent,/Saving/);assert.ok(f.root.all().find(el=>el.textContent==='Applying...'));englishOnly(f.root);f.modal.close();reject(Error('disk unavailable'));await tick();assert.equal(notices.length,count+1);assert.match(notices.at(-1)!,/Could not save/);assert.doesNotMatch(notices.at(-1)!,/[\u3400-\u9fff]/);});
}
test('English paper color validation recovers using an English preset',()=>{const f=fixture('paper','en'),hex=f.control('Custom paper color hex code');hex.value='#ff';hex.oninput?.();assert.match(f.status.textContent,/complete color code/);assert.equal(f.control('Apply').disabled,true);f.control('White paper').click();assert.equal(f.control('Apply').disabled,false);englishOnly(f.root);});
test('English background picker validation does not allocate an image preview',async()=>{const f=fixture('background','en');for(const[file,pattern]of [[{name:'image.svg',type:'image/svg+xml',size:10},/Choose a PNG/],[{name:'image.png',type:'image/png',size:MAX_BACKGROUND_IMAGE_BYTES+1},/exceeds 20 MB/],[{name:'image.png',type:'image/png',size:0},/file is empty/]] as const){await f.modal.imagePick(file);assert.match(f.status.textContent,pattern);englishOnly(f.root);}assert.equal(f.saved.length,0);});
test('English image picker preserves the original user filename',async t=>{t.mock.method(URL,'createObjectURL',()=> 'blob:settings-language-test');t.mock.method(URL,'revokeObjectURL',()=>{});const f=fixture('background','en');await f.modal.imagePick({name:'研究背景.png',type:'image/png',size:200});assert.match(f.root.textContent,/研究背景\.png/);assert.equal(f.saved.length,0);f.control('Cancel').click();});
test('English image read and resource errors keep English recovery wrappers',()=>{const f=fixture('background','en');f.host.preferences=()=>{throw Error('unavailable');};f.modal.imageLoad();assert.match(f.status.textContent,/Could not read background settings: unavailable. Please reload/);englishOnly(f.root);const g=fixture('background','en');g.host.resource=()=>{throw Error('asset unavailable');};g.modal.imageSync();assert.match(g.status.textContent,/saved background is unavailable/);englishOnly(g.root);});
