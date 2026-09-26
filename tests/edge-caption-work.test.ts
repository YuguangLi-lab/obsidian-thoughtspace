import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {transformSync} from 'esbuild';
import * as connections from '../src/connections';
import * as rendering from '../src/rendering';
import type {Board,Card} from '../src/model';

class Element{
 children:Element[]=[];parent?:Element;attributes=new Map<string,string>();dataset:Record<string,string>={};textContent='';
 ownerDocument={createElementNS:(_namespace:string,tag:string)=>new Element(tag)};
 style={setProperty(){}};classList={toggle:(name:string,on:boolean)=>{const list=new Set((this.getAttribute('class')||'').split(' ').filter(Boolean));if(on)list.add(name);else list.delete(name);this.setAttribute('class',[...list].join(' '));}};
 constructor(readonly tag:string){}
 setAttribute(name:string,value:string){this.attributes.set(name,value);}getAttribute(name:string){return this.attributes.get(name)??null;}hasAttribute(name:string){return this.attributes.has(name);}removeAttribute(name:string){this.attributes.delete(name);}
 appendChild(child:Element){child.parent=this;this.children.push(child);return child;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;}
 get nextSibling():Element|null{return this.parent?.children[this.parent.children.indexOf(this)+1]||null;}
 insertBefore(child:Element,next:Element|null){if(child===next)return child;if(child.parent)child.parent.children=child.parent.children.filter(item=>item!==child);const at=next?this.children.indexOf(next):this.children.length;assert.ok(at>=0);this.children.splice(at,0,child);child.parent=this;return child;}
}
function fixture(label='标签'){
 let handleArrays=0;class TrackedArray extends Array{static from(value:any,...args:any[]):any{if(Array.isArray(value)&&value[0]?.tag==='circle')handleArrays++;return Reflect.apply(Array.from,Array,[value,...args]);}}
 const module={exports:{} as any},source=process.env.EDGE_CAPTION_SOURCE||'src';new Function('require','module','exports','Array',transformSync(readFileSync(join(source,'edge-layer.ts'),'utf8'),{loader:'ts',format:'cjs'}).code)((key:string)=>({'./connections':connections,'./rendering':rendering})[key],module,module.exports,TrackedArray);
 const node=(id:string,x:number):Card=>({id,kind:'text',text:id,x,y:20,width:140,height:90,color:'sand'});
 const b:Board={version:3,nodes:[node('a',20),node('b',440)],edges:[{id:'edge',from:'a',to:'b',label}],viewport:{x:0,y:0,zoom:1}},root=new Element('svg'),layer=new module.exports.EdgeLayer(root,'caption-work',()=>{});
 const find=(tag:string)=>{const all=(el:Element):Element[]=>[el,...el.children.flatMap(all)];return all(root).filter(el=>el.tag===tag);};
 return{board:b,root,layer,find,copies:()=>handleArrays,render:(selected:string|null='edge')=>layer.render(b,1000,800,selected??undefined)};
}
test('moving a selected connector reuses its two handle references without copying SVG children per frame',t=>{
 const f=fixture();f.render();const handles=f.find('circle');for(let i=0;i<120;i++){f.board.nodes[1].x+=.5;f.board.viewport.zoom=1+i/100;f.render();const route=connections.connectionPath(f.board.nodes[0],f.board.nodes[1],f.board.edges[0]);assert.equal(handles[0].getAttribute('cx'),String(route.from.x));assert.equal(handles[1].getAttribute('cx'),String(route.to.x));assert.equal(handles[0].getAttribute('r'),String(6/f.board.viewport.zoom));}
 assert.deepEqual(f.find('circle'),handles);t.diagnostic(`121 selected-edge updates: ${f.copies()} child arrays`);assert.equal(f.copies(),0);
});
test('a long connector label stores its source once without embedding it into a geometry key',t=>{
 const label='证据 😀 | '.repeat(5000),f=fixture(label);f.render();let compositeCharacters=0;
 for(let i=0;i<100;i++){f.board.nodes[1].y+=.25;f.render();for(const row of f.layer.rows.values())for(const value of Object.values(row))if(typeof value==='string'&&value!==label&&value.startsWith(label))compositeCharacters+=value.length;}
 const title=f.find('title').find(el=>el.textContent===label),text=f.find('text')[0];assert.ok(title);assert.ok(text.textContent.endsWith('…'));assert.ok(text.textContent.length<=80);t.diagnostic(`100 moved labels: ${compositeCharacters} composite-key characters`);assert.equal(compositeCharacters,0);
});
test('caption and handle transitions survive label removal, selection changes, culling and row recreation',()=>{
 const f=fixture('first');f.render();const firstText=f.find('text')[0];f.board.edges[0].label='second 😀';f.render();assert.equal(f.find('text')[0],firstText);assert.equal(firstText.textContent,'second 😀');
 f.board.edges[0].label='';f.render();assert.equal(f.find('text').length,0);f.render(null);assert.equal(f.find('circle').length,0);
 f.board.edges[0].label='third';f.render();assert.equal(f.find('text')[0].textContent,'third');assert.equal(f.find('circle').length,2);f.board.viewport.x=-10000;f.render();assert.equal(f.find('text').length,0);assert.equal(f.find('circle').length,0);
 f.board.viewport.x=0;f.render();assert.equal(f.find('text')[0].textContent,'third');assert.equal(f.find('circle').length,2);f.layer.clear();assert.equal(f.root.children.length,1);
});
