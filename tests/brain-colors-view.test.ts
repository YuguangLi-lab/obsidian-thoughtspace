import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as colors from '../src/brain-colors';

class Element {
 children:Element[]=[];parentElement?:Element;dataset:Record<string,string>={};attributes:Record<string,string>={};classes=new Set<string>();style:Record<string,string>={};value='';text='';disabled=false;maxLength=0;onclick?:()=>void;oninput?:()=>void;
 constructor(readonly tag:string,readonly ownerDocument:Doc,options:any={}){if(typeof options==='string')options={cls:options};this.text=options.text||'';this.value=options.value||'';Object.assign(this.attributes,options.attr||{});for(const name of (options.cls||'').split(' ').filter(Boolean))this.classes.add(name);}
 get isConnected():boolean{return this.tag==='BODY'||!!this.parentElement?.isConnected;}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 createEl(tag:string,options:any={}){return this.appendChild(new Element(tag.toUpperCase(),this.ownerDocument,options));}createDiv(options:any={}){return this.createEl('div',options);}createSpan(options:any={}){return this.createEl('span',options);}
 appendChild(child:Element){child.remove();child.parentElement=this;this.children.push(child);return child;}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=undefined;}
 before(child:Element){child.remove();child.parentElement=this.parentElement;this.parentElement?.children.splice(this.parentElement.children.indexOf(this),0,child);}
 empty(){for(const child of this.children)child.parentElement=undefined;this.children=[];this.text='';}setText(value:string){this.empty();this.text=value;}addClass(value:string){this.classes.add(value);}setAttribute(key:string,value:string){this.attributes[key]=value;}
 all():Element[]{return this.children.flatMap(child=>[child,...child.all()]);}querySelector(selector:string){return this.all().find(child=>selector==='input[type=color]'&&child.tag==='INPUT'&&child.attributes.type==='color');}
 focus(){this.ownerDocument.activeElement=this;}click(){if(!this.disabled)this.onclick?.();}input(value:string){this.value=value;this.oninput?.();}
 getContext(){const ctx={fillStyle:'#000000',clearRect(){},fillRect(){},getImageData(){const hex=colors.brainColor(ctx.fillStyle)||'#000000';return{data:new Uint8ClampedArray([1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).concat(255))};}};return ctx;}
}
class Doc {
 body=new Element('BODY',this);activeElement?:Element;frames=new Map<number,()=>void>();sequence=0;
 defaultView={closed:false,requestAnimationFrame:(fn:()=>void)=>{const id=++this.sequence;this.frames.set(id,fn);return id;},cancelAnimationFrame:(id:number)=>this.frames.delete(id)};
 tick(){const callbacks=[...this.frames.values()];this.frames.clear();for(const callback of callbacks)callback();}
}
class Modal {
 containerEl:Element;modalEl:Element;contentEl:Element;closed=0;
 constructor(app:{document:Doc}){this.containerEl=app.document.body.createDiv();this.modalEl=this.containerEl.createDiv();this.contentEl=this.modalEl.createDiv();}open(){(this as any).onOpen();}close(){this.closed++;(this as any).onClose();this.containerEl.remove();}
}
class InputComponent {
 constructor(readonly inputEl:Element){}setValue(value:string){this.inputEl.value=value;return this;}setPlaceholder(value:string){this.inputEl.attributes.placeholder=value;return this;}onChange(fn:(value:string)=>void){this.inputEl.oninput=()=>fn(this.inputEl.value);return this;}
}
class Setting {
 settingEl:Element;controlEl:Element;name:Element;
 constructor(parent:Element){this.settingEl=parent.createDiv();this.name=this.settingEl.createSpan();this.controlEl=this.settingEl.createDiv();}setName(value:string){this.name.setText(value);return this;}setDesc(value:string){this.settingEl.createSpan({text:value});return this;}
 addColorPicker(fn:(component:InputComponent)=>void){fn(new InputComponent(this.controlEl.createEl('input',{attr:{type:'color'}})));return this;}addText(fn:(component:InputComponent)=>void){fn(new InputComponent(this.controlEl.createEl('input',{attr:{type:'text'}})));return this;}
 addExtraButton(fn:(component:any)=>void){const button=this.controlEl.createEl('button');fn({setIcon(){return this;},setTooltip(value:string){button.attributes['aria-label']=value;return this;},onClick(callback:()=>void){button.onclick=callback;return this;}});return this;}
}
class Observer {constructor(_callback:()=>void){}observe(){}disconnect(){}}
const source=readFileSync('src/brain-colors-view.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const deps={...colors,Modal,Setting,MutationObserver:Observer,themeSurface:(el:Element)=>{el.addClass('ts-ui-modal');el.dataset.accent='blue';}};
const View=new Function(...Object.keys(deps),transformSync(source+'\nreturn BrainColorsModal;',{loader:'ts'}).code)(...Object.values(deps));
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(){
 const doc=new Doc(),previews:any[]=[],saved:any[]=[];let current=true,fail=false;
 const host:any={document:doc,name:'测试脑图',colors:{node:'#f2f2f2',border:'#336677'},current:()=>current,preview:(value:any)=>previews.push(value),samples:()=>({background:'#ffffff',node:'#f2f2f2',border:'#666666',text:'#202020',line:'#606060'}),save:async(value:any)=>{saved.push(value);if(fail)throw Error('保存失败，请重试');}};
 const modal=new View({document:doc},host);modal.open();doc.tick();
 const root=modal.contentEl as Element,input=(name:string)=>root.all().find(el=>el.attributes['aria-label']===name)!,button=(name:string)=>root.all().find(el=>el.tag==='BUTTON'&&(el.textContent===name||el.attributes['aria-label']===name))!,preview=root.all().find(el=>el.classes.has('ts-brain-colors-preview-node'))!;
 return{doc,modal,root,host,input,button,preview,previews,saved,setCurrent:(value:boolean)=>current=value,setFailure:(value:boolean)=>fail=value};
}
test('brain color actions inherit the workspace control accent independently of draft node colors',()=>{
 const f=fixture();assert.ok(f.modal.modalEl.classes.has('ts-ui-modal'));assert.equal(f.modal.modalEl.dataset.accent,'blue');
 f.input('节点底色颜色').input('#aa3344');f.doc.tick();assert.equal(f.modal.modalEl.dataset.accent,'blue');assert.equal(f.preview.style.backgroundColor,'#aa3344');
});
test('border is independently editable with immediate dialog preview while blank fields still follow the theme',()=>{
 const f=fixture();assert.equal(f.doc.activeElement,f.input('节点边框颜色'));f.input('节点边框颜色').input('#AbC');f.doc.tick();assert.equal(f.preview.style.borderColor,'#aabbcc');assert.equal(f.preview.style.backgroundColor,'#f2f2f2');assert.equal(f.saved.length,0);assert.equal(f.input('节点边框颜色选择器').value,'#aabbcc');
 f.button('节点边框跟随主题').click();f.doc.tick();assert.equal(f.input('节点边框颜色').value,'');assert.equal(f.preview.style.borderColor,'#666666');assert.deepEqual(f.previews.at(-1),{node:'#f2f2f2'});
});
test('invalid outline color keeps the last valid visual preview and prevents a save',()=>{
 const f=fixture(),last=f.preview.style.borderColor;f.input('节点边框颜色').input('url(https://invalid.example)');f.doc.tick();assert(f.button('确定').disabled);assert.equal(f.preview.style.borderColor,last);f.button('确定').click();assert.equal(f.saved.length,0);assert.equal(f.input('节点边框颜色').attributes['aria-invalid'],'true');
});
test('clearing node overrides restores the preview center theme treatment independently of the chosen border',()=>{
 const f=fixture();f.button('节点底色跟随主题').click();f.button('节点边框跟随主题').click();f.doc.tick();assert.equal(f.preview.style.backgroundColor,'');assert.equal(f.preview.style.borderColor,'');
 f.input('节点边框颜色').input('#9a6753');f.doc.tick();assert.equal(f.preview.style.backgroundColor,'');assert.equal(f.preview.style.borderColor,'#9a6753');
 f.input('节点底色颜色').input('#e4eef0');f.doc.tick();assert.equal(f.preview.style.backgroundColor,'#e4eef0');assert.equal(f.preview.style.borderColor,'#9a6753');
});
test('cancel and reset leave persistence untouched; confirmation stores all five normalized keys exactly once',async()=>{
 const f=fixture();f.button('恢复默认').click();f.doc.tick();assert.deepEqual(f.previews.at(-1),{});assert.equal(f.saved.length,0);f.input('节点边框颜色').input('#AbC');f.input('背景颜色').input('#101010');f.button('确定').click();f.button('确定').click();await settle();assert.deepEqual(f.saved,[{background:'#101010',border:'#aabbcc'}]);assert.equal(f.modal.closed,1);assert.equal(f.previews.at(-1),null);
 const cancelled=fixture();cancelled.input('节点边框颜色').input('#ffff00');cancelled.button('取消').click();cancelled.doc.tick();assert.equal(cancelled.saved.length,0);assert.equal(cancelled.previews.at(-1),null);assert.equal(cancelled.doc.frames.size,0);
});
test('stale owner prevents commit even after a previously valid edit and save errors preserve the draft',async()=>{
 const f=fixture();f.input('节点边框颜色').input('#aabbcc');f.setCurrent(false);f.button('确定').click();await settle();assert.equal(f.saved.length,0);assert(f.button('确定').disabled);
 const failed=fixture();failed.setFailure(true);failed.input('节点边框颜色').input('#aabbcc');failed.button('确定').click();await settle();assert.equal(failed.modal.closed,0);assert.equal(failed.input('节点边框颜色').value,'#aabbcc');assert(!failed.button('取消').disabled);assert.match(failed.root.textContent,/保存失败/);failed.setFailure(false);failed.button('确定').click();await settle();assert.equal(failed.modal.closed,1);
});
