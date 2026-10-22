import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

type Options={cls?:string;text?:string;attr?:Record<string,string>};
class Element {
 children:Element[]=[];parentElement?:Element;classes=new Set<string>();attrs:Record<string,string>={};value='';disabled=false;text='';
 onclick?:()=>void;oninput?:()=>void;onkeydown?:(event:any)=>void;
 constructor(readonly tag:string,readonly doc:{activeElement?:Element},options:Options|string={}){const o=typeof options==='string'?{cls:options}:options;this.text=o.text??'';this.attrs=o.attr??{};for(const c of (o.cls??'').split(' ').filter(Boolean))this.classes.add(c);}
 createEl(tag:string,o:Options|string={}){const e=new Element(tag,this.doc,o);e.parentElement=this;this.children.push(e);return e;}
 createDiv(o:Options|string={}){return this.createEl('div',o);}
 addClass(cls:string){this.classes.add(cls);}
 setText(text:string){this.text=text;}
 empty(){this.children=[];}
 focus(){this.doc.activeElement=this;}
 click(){if(!this.disabled)this.onclick?.();}
 all():Element[]{return this.children.flatMap(e=>[e,...e.all()]);}
}
function fixture(){
 const doc:{activeElement?:Element}={},bindings:{stops:number}[]=[],plans:{text:string;source:string}[]=[],saved:unknown[]=[];let saveError=false;
 class Modal {modalEl=new Element('div',doc);containerEl=new Element('div',doc);contentEl=this.modalEl.createDiv();titleEl=this.modalEl.createEl('h2');closes=0;close(){this.closes++;(this as any).onClose();}}
 const module={exports:{} as Record<string,any>};
 const compiled=transformSync(readFileSync('src/pdf-quote-view.ts','utf8'),{loader:'ts',format:'cjs'}).code;
 const imports:Record<string,unknown>={obsidian:{Modal},'./ui-tokens':{themeSurface(){}},'./board-modal-viewport':{bindBoardModalViewport(){const b={stops:0};bindings.push(b);return()=>b.stops++;}}};
 new Function('require','module','exports',compiled)((name:string)=>imports[name],module,module.exports);
 const plan=(text:string,source:string)=>{plans.push({text,source});if(!text.startsWith('[['))throw Error('引用格式错误，请检查链接');return{text,source,links:[{path:'source.pdf',page:1,kind:'page'}]};};
 const modal=new module.exports.PdfQuoteModal({},'[[source.pdf#page=1]]',plan,(value:unknown)=>{if(saveError)throw Error('保存暂时失败');saved.push(value);});modal.onOpen();
 const all=()=>modal.contentEl.all() as Element[],byClass=(cls:string)=>all().find(e=>e.classes.has(cls))!,byLabel=(label:string)=>all().find(e=>e.attrs['aria-label']===label)!,byText=(text:string)=>all().find(e=>e.text===text)!;
 return{modal,doc,plans,saved,bindings,byClass,byLabel,byText,failSave(){saveError=true;}};
}
test('all variable-height PDF form content shares one scroll owner and only actions remain fixed',()=>{
 const f=fixture(),body=f.byClass('ts-pdf-quote-body'),actions=f.byClass('ts-pdf-quote-actions');
 assert.deepEqual(f.modal.contentEl.children,[body,actions]);
 for(const cls of ['ts-pdf-quote-intro','ts-pdf-quote-status','ts-pdf-quote-scope','ts-pdf-quote-help'])assert.equal(f.byClass(cls).parentElement,body,cls+' must not consume fixed space outside the form');
 for(const label of ['PDF 引用内容','来源笔记路径'])assert.equal(f.byLabel(label).parentElement?.parentElement,body);
 assert.equal(f.doc.activeElement,f.byLabel('PDF 引用内容'));assert.equal(f.byText('取消').parentElement,actions);assert.equal(f.byText('加入白板').parentElement,actions);
});
test('invalid input keeps its draft and live error, then valid input saves the latest complete source once',()=>{
 const f=fixture(),input=f.byLabel('PDF 引用内容'),source=f.byLabel('来源笔记路径'),save=f.byText('加入白板'),status=f.byClass('ts-pdf-quote-status');
 input.value='未完成的引文';input.oninput?.();assert.equal(save.disabled,true);assert.match(status.text,/引用格式错误/);save.click();assert.equal(f.saved.length,0);assert.equal(input.value,'未完成的引文');
 input.value='[[source.pdf#page=1]]\n\n> 完整摘录。\n';source.value=' Notes/摘录.md ';source.oninput?.();assert.equal(save.disabled,false);assert.equal(status.attrs['aria-live'],'polite');save.click();
 assert.equal(f.saved.length,1);assert.deepEqual(f.plans.at(-1),{text:input.value,source:'Notes/摘录.md'});assert.equal(f.modal.closes,1);assert.equal(f.bindings[0].stops,1);save.click();assert.equal(f.saved.length,1);
});
test('cancel preserves unsaved form text in callbacks and never invokes save',()=>{const f=fixture(),input=f.byLabel('PDF 引用内容');input.value='未提交草稿';f.byText('取消').click();assert.equal(f.saved.length,0);assert.equal(f.modal.closes,1);assert.equal(f.bindings[0].stops,1);});
test('save failure remains visible and retryable in the same scroll body',()=>{const f=fixture(),save=f.byText('加入白板'),status=f.byClass('ts-pdf-quote-status');f.failSave();save.click();assert.equal(f.modal.closes,0);assert.equal(save.disabled,false);assert.match(status.text,/保存暂时失败/);assert.equal(status.parentElement,f.byClass('ts-pdf-quote-body'));assert.equal(f.saved.length,0);});
test('IME Enter does not commit and non-composing command Enter keeps its existing save behavior',()=>{const f=fixture(),input=f.byLabel('PDF 引用内容');let prevented=0;const key=(isComposing:boolean)=>input.onkeydown?.({isComposing,metaKey:true,ctrlKey:false,key:'Enter',preventDefault(){prevented++;}});key(true);assert.equal(f.saved.length,0);assert.equal(prevented,0);key(false);assert.equal(f.saved.length,1);assert.equal(prevented,1);});
