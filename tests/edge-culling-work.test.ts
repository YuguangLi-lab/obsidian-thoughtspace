import test from 'node:test';
import assert from 'node:assert/strict';
import {EdgeLayer} from '../src/edge-layer';
import {viewportRect,edgeBounds,intersects} from '../src/rendering';
import type {Board,Card} from '../src/model';

class SvgElement{
 children:SvgElement[]=[];parent?:SvgElement;attributes=new Map<string,string>();dataset:Record<string,string>={};textContent='';
 style={setProperty(){}};classList={toggle:(name:string,on:boolean)=>{const classes=new Set((this.getAttribute('class')||'').split(' ').filter(Boolean));if(on)classes.add(name);else classes.delete(name);this.setAttribute('class',[...classes].join(' '));}};
 constructor(readonly ownerDocument:SvgDocument,readonly tag:string){}
 setAttribute(name:string,value:string){this.attributes.set(name,value);}getAttribute(name:string){return this.attributes.get(name)??null;}hasAttribute(name:string){return this.attributes.has(name);}removeAttribute(name:string){this.attributes.delete(name);}
 appendChild(child:SvgElement){child.parent=this;this.children.push(child);return child;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;}
}
class SvgDocument{createElementNS(_namespace:string,tag:string){return new SvgElement(this,tag);}}
const node=(id:string,x=0,y=0):Card=>({id,kind:'text',text:id,x,y,width:100,height:80,color:'sand'});
function fixture(nodes:Card[],edges:Board['edges']){const doc=new SvgDocument(),root=new SvgElement(doc,'svg'),board:Board={version:3,nodes,edges,viewport:{x:0,y:0,zoom:1}},layer=new EdgeLayer(root as unknown as SVGSVGElement,'cull',()=>{});return{root,board,layer,render:()=>layer.render(board,1000,800),ids:()=>root.children.filter(el=>el.dataset.edge).map(el=>el.dataset.edge)};}

test('camera frames reject edges right of the viewport before reading unused dimensions and y coordinates',()=>{
 const counts={x:0,y:0,width:0,height:0},nodes=Array.from({length:1200},(_,i)=>node('n'+i,i*200));
 const watched=nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(key in counts)counts[key as keyof typeof counts]++;return Reflect.get(target,key,receiver);}}));
 const edges=nodes.slice(1).map((n,i)=>({id:'e'+i,from:'n'+i,to:n.id,label:''})),f=fixture(watched,edges);f.render();
 const initial=f.ids();assert.ok(initial.length>0&&initial.length<10);for(const key of Object.keys(counts) as (keyof typeof counts)[])counts[key]=0;
 for(let frame=0;frame<120;frame++){f.board.viewport.x=frame/100;f.render();assert.deepEqual(f.ids(),initial);}
 assert.ok(counts.y<120*100,`Read ${counts.y} y coordinates for offscreen edges`);
 assert.ok(counts.height<120*100,`Read ${counts.height} heights for offscreen edges`);
});

test('edge visibility retains padded boundaries, spanning connectors and fresh geometry at every zoom',()=>{
 const nodes=[node('left',-2000),node('right',2000),node('near',1179),node('far',1700),node('down',0,2000)];
 const edges=[{id:'span',from:'left',to:'right',label:''},{id:'near',from:'near',to:'far',label:''},{id:'down',from:'near',to:'down',label:''}],f=fixture(nodes,edges);
 const verify=()=>{const byId=new Map(f.board.nodes.map(n=>[n.id,n])),view=viewportRect(f.board.viewport,1000,800),expected=f.board.edges.filter(e=>{const a=byId.get(e.from),b=byId.get(e.to);return !!a&&!!b&&intersects(edgeBounds(a,b),view);}).map(e=>e.id);f.render();assert.deepEqual(new Set(f.ids()),new Set(expected));};
 for(const zoom of [.15,.5,1,2.5])for(const x of [-5000,-1,0,1,5000]){f.board.viewport={x,y:x/3,zoom};verify();}
 f.board.nodes=f.board.nodes.map(n=>({...n,x:n.x+125.125,y:n.y-75.375})).reverse();verify();
 f.board.nodes=f.board.nodes.filter(n=>n.id!=='right');verify();f.board.nodes.push(node('right',10));verify();
 f.board.edges=[];verify();assert.equal(f.ids().length,0);
});
