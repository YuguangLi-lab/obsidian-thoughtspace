import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webUrl,webCard,updateWebCard,webMarkdown,renderWebCard} from '../src/web-card';
import {parseBoard,emptyBoard,canvasExport,clone} from '../src/model';
import {nodeHasBorder,textFitsContent} from '../src/text-sizing';
import {foldCards} from '../src/board-tools';
import {sectionDisplayNode} from '../src/sections';
import {TextDocument,TextElement} from './text-dom-fixture';
const url='https://example.com/research?q=1#results';
for(const value of ['javascript:alert(1)','file:///tmp/test','data:text/html,x','https://user:secret@example.com','https://example.com/\\x','https://example.com/<x>','https://example.com/\npath','https://example.com/a b',123,null])test(`reject unsafe web URL ${String(value)}`,()=>assert.equal(webUrl(value),undefined));
test('URLs retain queries and fragments, with only boundary whitespace trimmed',()=>{assert.equal(webUrl(' '+url+' '),url);assert.equal(webUrl('http://example.com'),'http://example.com/');});
test('web card persists as readable Markdown without note creation or viewport movement',()=>{const b={...emptyBoard(),version:3 as const,nodes:[webCard(url,'web',{x:100,y:200})]};assert.deepEqual(parseBoard(JSON.stringify(b)),b);assert.match(b.nodes[0].text!,/example\.com/);assert.equal(b.nodes[0].file,undefined);assert.equal(nodeHasBorder(b.nodes[0]),false);assert.equal(textFitsContent(b.nodes[0]),false);assert.deepEqual(canvasExport(b).nodes[0],{id:'web',type:'link',url,x:-220,y:-30,width:640,height:460,color:'5'});});
test('web links cannot be attached to non-text object types',()=>{const b={...emptyBoard(),version:3 as const,nodes:[{...webCard(url,'web',{x:0,y:0}),kind:'card' as const,file:'note.md'}]};assert.throws(()=>parseBoard(JSON.stringify(b)),/网页/);});
test('fold and expand preserve the URL and exact original dimensions',()=>{const b={...emptyBoard(),version:3 as const,nodes:[webCard(url,'w',{x:0,y:0})]},before=clone(b);foldCards(b,new Set(['w']),true);assert.equal(sectionDisplayNode(b.nodes[0]).height,40);foldCards(parseBoard(JSON.stringify(b)),new Set(['w']),false);foldCards(b,new Set(['w']),false);assert.deepEqual(b,before);});
test('changing links updates automatic titles while keeping custom names and geometry',()=>{const n=webCard(url,'w',{x:0,y:0});updateWebCard(n,'https://obsidian.md/');assert.equal(n.title,'obsidian.md');n.title='参考材料';updateWebCard(n,url);assert.equal(n.title,'参考材料');assert.match(n.text!,/参考材料/);n.locked=true;assert.throws(()=>updateWebCard(n,'https://example.org'),/锁定/);});
test('Markdown fallback escapes link delimiters',()=>assert.equal(webMarkdown('https://example.com/a(b)','[title]'),'[\\[title\\]](https://example.com/a%28b%29)'));
class WebEl extends TextElement {
 onclick?: (event:any)=>void;onpointerdown?: (event:any)=>void;ondblclick?: (event:any)=>void;hidden=false;
 createEl(tag:string,options:any={}){const e=this.ownerDocument.createElement(tag) as WebEl;e.className=options.cls||'';e.textContent=options.text||'';for(const [k,v]of Object.entries(options.attr||{}))e.setAttribute(k,String(v));this.appendChild(e);return e;}
 createDiv(options:any={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 createSpan(options:any={}){return this.createEl('span',typeof options==='string'?{cls:options}:options);}
 addClass(name:string){this.classList.add(name);}removeClass(name:string){this.className=this.className.split(' ').filter(n=>n!==name).join(' ');}setText(value:string){this.textContent=value;}
}
class WebDoc extends TextDocument {createElement(tag:string){const e=new WebEl(this,tag);this.elements.push(e);return e;}}
test('web preview loads in a large card, is sandboxed and released on disposal',()=>{
 const doc=new WebDoc(),host=doc.createElement('div');let dispose=()=>{};renderWebCard(host as unknown as HTMLElement,webCard(url,'w',{x:0,y:0}),{open(){},edit(){},fold(){},copy(){},disabled:false,register(fn){dispose=fn;}});
 assert.ok(host.querySelector('iframe'));const preview=(host.querySelectorAll('button') as WebEl[]).find(b=>b.attributes.title==='在卡片内预览网页')!;
 const frame=host.querySelector('iframe')!;assert.equal(frame.attributes.src,url);assert.equal(frame.attributes.sandbox.includes('allow-same-origin'),false);assert.equal(frame.attributes.referrerpolicy,'no-referrer');
 preview.onclick!({stopPropagation(){}});assert.equal(host.querySelector('iframe'),null);preview.onclick!({stopPropagation(){}});dispose();assert.equal(host.querySelector('iframe'),null);preview.onclick!({stopPropagation(){}});assert.equal(host.querySelector('iframe'),null);
});
