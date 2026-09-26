import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Board,type Card} from '../src/model';
import * as editor from '../src/mindmap-editor';
import * as mindmap from '../src/mindmap';
import * as branches from '../src/mindmap-branches';
type Options={cls?:string;text?:string;attr?:Record<string,string>;value?:string;type?:string};
class Element {
 children:Element[]=[];attributes:Record<string,string>={};value='';disabled=false;text='';onclick?:()=>void;oninput?:()=>void;
 constructor(readonly tag:string,opts:Options|string={}){const o=typeof opts==='string'?{cls:opts}:opts;this.text=o.text||'';this.attributes={...o.attr};this.value=o.value||'';}
 get textContent():string{return this.text+this.children.map(c=>c.textContent).join('');}
 createEl(tag:string,opts:Options|string={}){const el=new Element(tag,opts);this.children.push(el);return el;}createDiv(opts:Options|string={}){return this.createEl('div',opts);}createSpan(opts:Options|string={}){return this.createEl('span',opts);}
 setText(text:string){this.text=text;this.children=[];}empty(){this.text='';this.children=[];this.value='';}getAttribute(k:string){return this.attributes[k]??null;}click(){if(!this.disabled)this.onclick?.();}
 all(tag:string):Element[]{return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.all(tag)]);}
}
const module={exports:{} as {renderTopicRelations:(host:unknown,board:Board,id:string,apply:(r:editor.TopicResult)=>void)=>void}};
const deps:Record<string,unknown>={'./mindmap-editor':editor,'./mindmap':mindmap,'./mindmap-branches':branches};
new Function('require','module','exports',transformSync(readFileSync('src/mindmap-relations-view.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>deps[name],module,module.exports);
const node=(id:string):Card=>({id,kind:'text',text:id,x:0,y:0,width:100,height:60,color:'blue'});
function fixture(count=1201,relations=80){
 let reads=0;const board:Board={...emptyBoard(),version:3,nodes:Array.from({length:count},(_,i)=>new Proxy(node('n'+i),{get(n,k,r){if(k==='id')reads++;return Reflect.get(n,k,r);}})),edges:Array.from({length:count-1},(_,i)=>({id:'b'+i,from:'n0',to:'n'+(i+1),kind:'branch',label:''}))};
 for(let i=0;i<relations;i++)board.edges.push({id:'r'+i,from:'n0',to:'n'+(count-1-i),label:'关联 '+i});
 const host=new Element('div');module.exports.renderTopicRelations(host,board,'n0',()=>{});
 return{board,host,reads:()=>reads,target:()=>host.all('select').find(e=>e.getAttribute('aria-label')==='关联目标')!,search:()=>host.all('input').find(e=>e.getAttribute('aria-label')==='搜索关联主题')!};
}
test('relation panel resolves edit-target membership without scanning all topics per relation',()=>{
 const f=fixture();assert.ok(f.reads()<10000,`Panel read ${f.reads()} node IDs`);assert.equal(f.host.all('button').filter(b=>b.text==='编辑').length,80);assert.equal(f.target().children.length,80);assert.match(f.host.textContent,/1200 项匹配/);
});
test('empty relation search does not lowercase every topic body',()=>{
 const original=String.prototype.toLocaleLowerCase;let chars=0;String.prototype.toLocaleLowerCase=function(...args:Parameters<typeof original>){chars+=String(this).length;return original.apply(this,args);};
 try{fixture();assert.equal(chars,0);}finally{String.prototype.toLocaleLowerCase=original;}
});
test('relation editing retains a chosen target outside the first 80 and refreshes live labels',()=>{
 const f=fixture(121,1),before=JSON.stringify(f.board);f.host.all('button').find(b=>b.text==='编辑')!.click();assert.equal(f.target().children[0].value,'n120');assert.equal(f.target().value,'n120');assert.equal(f.target().children.length,80);assert.equal(JSON.stringify(f.board),before);
 f.board.nodes[119].text='Fresh Needle';f.search().value='needle';f.search().oninput?.();assert.deepEqual(f.target().children.map(o=>[o.value,o.text]),[['n119','Fresh Needle']]);assert.equal(f.target().value,'n119');
 f.search().value='no results';f.search().oninput?.();assert.equal(f.target().children.length,0);assert.equal(f.host.all('button').find(b=>b.text==='保存关联线')!.disabled,true);
});
test('relation panel still rejects invalid trees and disables writes from locked sources',()=>{
 const b:Board={...emptyBoard(),version:3,nodes:[node('a'),node('b')],edges:[{id:'e',from:'a',to:'b',kind:'branch',label:''}]};b.nodes[0].locked=true;const host=new Element('div');module.exports.renderTopicRelations(host,b,'a',()=>assert.fail('locked'));assert.equal(host.all('button').find(b=>b.text==='添加关联线')!.disabled,true);
 b.edges.push({id:'cycle',from:'b',to:'a',kind:'branch',label:''});assert.throws(()=>module.exports.renderTopicRelations(new Element('div'),b,'a',()=>{}),/循环/);
});
