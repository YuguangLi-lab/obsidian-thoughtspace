import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as studio from '../src/board-studio';
type Options={cls?:string;text?:string;attr?:Record<string,string>;value?:string};
class Element {
 children:Element[]=[];attributes:Record<string,string>={};classes=new Set<string>();value='';disabled=false;scrollTop=0;text='';onclick?:()=>void;
 constructor(readonly tag:string,opts:Options|string={}){const o=typeof opts==='string'?{cls:opts}:opts;this.text=o.text||'';this.attributes={...o.attr};this.value=o.value||'';for(const c of (o.cls||'').split(' '))if(c)this.classes.add(c);}
 get textContent():string{return this.text+this.children.map(c=>c.textContent).join('');}
 createEl(tag:string,opts:Options|string={}){const el=new Element(tag,opts);this.children.push(el);return el;}createDiv(opts:Options|string={}){return this.createEl('div',opts);}createSpan(opts:Options|string={}){return this.createEl('span',opts);}
 setText(text:string){this.text=text;this.children=[];}empty(){this.text='';this.children=[];}addClass(c:string){this.classes.add(c);}toggleClass(c:string,on:boolean){if(on)this.classes.add(c);else this.classes.delete(c);}
 getAttribute(k:string){return this.attributes[k]??null;}setAttribute(k:string,v:string){this.attributes[k]=v;}click(){if(!this.disabled)this.onclick?.();}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(c=>[...(selector.startsWith('.')?c.classes.has(selector.slice(1)):c.tag===selector)?[c]:[],...c.querySelectorAll(selector)]);}
}
class Modal {modalEl=new Element('div');contentEl=this.modalEl.createDiv();titleEl=this.modalEl.createEl('h2');close(){(this as unknown as {onClose?:()=>void}).onClose?.();this.contentEl.empty();}}
const source=transformSync(readFileSync('src/board-studio-view.ts','utf8'),{loader:'ts',format:'cjs'}).code;
const deps:Record<string,unknown>={obsidian:{Modal,Notice:class{},setIcon(){}},'./model':model,'./ui-tokens':{themeSurface(){}},'./board-studio':studio};
const module={exports:{} as {BoardStudioModal:any}};new Function('require','module','exports',source)((name:string)=>deps[name],module,module.exports);
function fixture(count=1200){
 let reads=0,commits=0,selects=0,onCommit:(()=>void)|undefined;
 let board:model.Board={...model.emptyBoard(),version:3,nodes:Array.from({length:count},(_,i)=>new Proxy({id:'n'+i,kind:'text' as const,text:'Text '+i,x:0,y:0,width:200,height:100,color:'sand' as const},{get(n,k,r){if(k==='id')reads++;return Reflect.get(n,k,r);}}))};
 const ids=new Set(Array.from({length:count},(_,i)=>'n'+(count-i-1)));ids.add('missing');let selection=new Set(ids);
 const host={board:()=>board,ids:()=>ids,commit:(edit:(b:model.Board)=>void)=>{const next=studio.studioDraft(board,edit);if(next){board=next;commits++;}onCommit?.();},select:(next:Set<string>)=>{selects++;selection=new Set(next);},reveal(){},tour(){},viewport:()=>({x:0,y:0,width:100,height:100})};
 const modal=new module.exports.BoardStudioModal({},host);modal.onOpen();const root=modal.contentEl as Element;
 return{modal,root,host,get board(){return board;},get reads(){return reads;},resetReads:()=>{reads=0;},get commits(){return commits;},get selects(){return selects;},get selection(){return selection;},setOnCommit:(fn:()=>void)=>{onCommit=fn;},replace:(next:model.Board)=>{board=next;},button:(label:string)=>root.querySelectorAll('button').find(b=>b.getAttribute('aria-label')===label)!};
}
test('workbench rendering validates a large selection without scanning the board once per selected ID',()=>{
 const f=fixture();assert.ok(f.reads<5000,`Opening workbench read ${f.reads} IDs`);assert.deepEqual([...f.modal.selected],Array.from({length:1200},(_,i)=>'n'+(1199-i)));
 assert.match(f.root.textContent,/已选 1200 项.*共 1200 个对象/);assert.equal(f.commits,0);
});
test('saved selection management resolves all records in one board pass',()=>{
 const f=fixture();f.board.selectionSets=Array.from({length:30},(_,i)=>({id:'s'+i,name:'Set '+i,ids:[...Array.from({length:400},(_,n)=>'n'+(1199-n)),'missing']}));
 f.resetReads();f.button('保存与管理选区').click();assert.ok(f.reads<=2400,`Saved selections read ${f.reads} node IDs`);
 assert.equal(f.root.querySelectorAll('button').filter(b=>/ · 400 项$/.test(b.getAttribute('aria-label')||'')).length,30);f.button('Set 0 · 400 项').click();assert.deepEqual([...f.selection],Array.from({length:400},(_,n)=>'n'+(1199-n)));assert.equal(f.commits,0);
});
test('closed workbench buttons cannot change selection or commit saved records',()=>{
 const f=fixture(3),invert=f.button('反向选择');f.button('保存与管理选区').click();const input=f.root.querySelectorAll('input')[0];input.value='Saved';const save=f.button('保存当前选区'),before=JSON.stringify(f.board);
 f.modal.close();invert.click();save.click();assert.equal(f.selects,0);assert.equal(f.commits,0);assert.equal(JSON.stringify(f.board),before);assert.equal(f.root.children.length,0);
});
test('closing during commit prevents detached handlers from rebuilding or committing twice',()=>{
 const f=fixture(3);f.button('保存与管理选区').click();f.root.querySelectorAll('input')[0].value='Saved';const save=f.button('保存当前选区');f.setOnCommit(()=>f.modal.close());save.click();assert.equal(f.commits,1);assert.equal(f.root.children.length,0);save.click();assert.equal(f.commits,1);
});
test('workbench selection refresh uses the new board snapshot and preserves selected order',()=>{
 const f=fixture(5);f.replace({...f.board,nodes:[f.board.nodes[3],f.board.nodes[1]]});f.button('文本').click();assert.deepEqual([...f.modal.selected],['n3','n1']);assert.match(f.root.textContent,/已选 2 项.*共 2 个对象/);assert.equal(f.commits,0);
});
