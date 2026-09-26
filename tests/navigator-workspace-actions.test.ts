import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

class Element {
 children:Element[]=[];parentElement?:Element;attrs:Record<string,string>={};dataset:Record<string,string>={};className='';text='';title='';action?:()=>unknown;
 constructor(options:string|{cls?:string;text?:string;attr?:Record<string,string>}={}){if(typeof options==='string')this.className=options;else{this.className=options.cls||'';this.text=options.text||'';this.attrs={...options.attr};}}
 createDiv(options:string|{cls?:string;text?:string;attr?:Record<string,string>}={}){const el=new Element(options);this.appendChild(el);return el;}
 createEl(_tag:string,options:{cls?:string;text?:string;attr?:Record<string,string>}={}){return this.createDiv(options);}
 appendChild(el:Element){el.parentElement=this;this.children.push(el);return el;}
 addClass(...names:string[]){this.className+=' '+names.join(' ');}
 setAttribute(key:string,value:string){this.attrs[key]=value;}
 empty(){for(const child of this.children)child.parentElement=undefined;this.children=[];}
 getBoundingClientRect(){return {left:15,bottom:70};}
 all():Element[]{return this.children.flatMap(c=>[c,...c.all()]);}
}
class Menu {
 static items:Menu[]=[];entries:{title:string;action:()=>unknown}[]=[];hideCallback?:()=>void;hidden=false;position?:{x:number;y:number};
 constructor(){Menu.items.push(this);}
 setUseNativeMenu(_native:boolean){return this;}
 addItem(config:(item:unknown)=>void){const entry={title:'',action:()=>{}};const item={setTitle(v:string){entry.title=v;return item;},setIcon(_v:string){return item;},onClick(fn:()=>void){entry.action=fn;return item;}};config(item);this.entries.push(entry);return this;}
 onHide(fn:()=>void){this.hideCallback=fn;}
 hide(){this.hidden=true;this.hideCallback?.();}
 showAtPosition(position:{x:number;y:number}){this.position=position;}
}
function fixture(){
 const calls:{name:string;value?:unknown}[]=[],vault={on:()=>({}),getFiles:()=>[]};
 const plugin={settings:{surfaceStyle:'soft',glassEffects:false,accent:'forest',density:'comfortable',favoriteBoards:[]},app:{vault},currentBoard:undefined,quickCapture:()=>calls.push({name:'capture'}),promptBoard:()=>calls.push({name:'new'}),openSpaceHub:()=>calls.push({name:'hub'}),openExcerptNote:()=>calls.push({name:'excerpt'}),openBoardOrganizer:(value:unknown)=>calls.push({name:'organize',value}),openSectionCatalog:(value:unknown)=>calls.push({name:'sections',value})};
 class ItemView {contentEl=new Element();app={vault};registerEvent(_event:unknown){};}
 class TemplatePicker {constructor(_app:unknown,_plugin:unknown){}open(){calls.push({name:'template'});}}
 const button=(parent:Element,label:string,_icon:string,action:()=>unknown,cls='')=>{const b=parent.createDiv({cls:'ts-button '+cls,text:label,attr:{'aria-label':label}});b.action=action;return b;};
 const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class NavigatorView extends'),end=source.indexOf('\nclass MaterialsView',start);
 assert.ok(start>=0&&end>start);
 const View=new Function('ItemView','Menu','button','TemplatePicker','DOCK','isWorkspaceFile','EXT',transformSync(source.slice(start,end)+'\nreturn NavigatorView;',{loader:'ts'}).code)(ItemView,Menu,button,TemplatePicker,'dock',()=>true,'thoughtspace');
 const view=new View({},plugin),find=(label:string)=>view.contentEl.all().find((e:Element)=>e.attrs['aria-label']===label) as Element;
 return{view,find,calls};
}
test('named creation menu retains new-board and template actions and closes with its navigator',async()=>{
 const f=fixture();await f.view.onOpen();const create=f.find('新建白板或使用模板');assert.equal(create.attrs['aria-haspopup'],'menu');assert.equal(create.attrs['aria-expanded'],'false');
 create.action?.();const first=Menu.items.at(-1)!;assert.deepEqual(first.entries.map(e=>e.title),['新建白板','从模板新建']);assert.deepEqual(first.position,{x:15,y:74});assert.equal(create.attrs['aria-expanded'],'true');
 first.entries[0].action();first.entries[1].action();assert.deepEqual(f.calls.map(c=>c.name),['new','template']);
 create.action?.();const second=Menu.items.at(-1)!;assert(first.hidden);first.hideCallback?.();assert.equal(create.attrs['aria-expanded'],'true','an old menu cannot collapse the current menu state');
 await f.view.onClose();assert(second.hidden);assert.equal(create.attrs['aria-expanded'],'false');
});
test('capture and named workspace entries remain directly reachable',async()=>{
 const f=fixture();await f.view.onOpen();for(const name of ['收集笔记','空间总览','打开笔记摘录'])f.find(name).action?.();assert.deepEqual(f.calls.map(c=>c.name),['capture','hub','excerpt']);
 const children=f.view.contentEl.all() as Element[];assert(children.findIndex(e=>e.className==='ts-dock-host')<children.findIndex(e=>e.className==='ts-dock-workspace-tools'),'board tools follow the working list in DOM and keyboard order');
});
test('persistent board tools follow the latest bound board instead of the board at creation',async()=>{
 const f=fixture();await f.view.onOpen();const board=()=>({closed:false,session:{},sidebar:new Element(),refreshNavigation(){}}),first=board(),second=board();
 f.view.bind(first);f.find('整理白板').action?.();f.view.bind(second);f.find('分组预览').action?.();second.closed=true;f.find('整理白板').action?.();
 assert.equal(f.calls[0].value,first);assert.equal(f.calls[1].value,second);assert.equal(f.calls[2].value,undefined);
});
