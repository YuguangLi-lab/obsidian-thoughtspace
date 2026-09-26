import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {transformSync} from 'esbuild';
import * as connections from '../src/connections';
import type {Board,Card} from '../src/model';

const directory=process.env.RENDER_HOT_PATH_SOURCE||'src';
function load(name:string,dependencies:Record<string,unknown>={},globals:Record<string,unknown>={}){
 const module={exports:{} as any},source=readFileSync(join(directory,name+'.ts'),'utf8');
 new Function('require','module','exports',...Object.keys(globals),transformSync(source,{loader:'ts',format:'cjs'}).code)((name:string)=>dependencies[name],module,module.exports,...Object.values(globals));
 return module.exports;
}
const rendering=load('rendering'),geometry=load('node-render-key');
class SvgElement {
 children:SvgElement[]=[];parent?:SvgElement;attributes=new Map<string,string>();dataset:Record<string,string>={};textContent='';
 ownerDocument={createElementNS:(_namespace:string,tag:string)=>new SvgElement(tag)};
 style={setProperty:()=>{}};
 classList={toggle:(name:string,on:boolean)=>{const classes=new Set((this.getAttribute('class')||'').split(' ').filter(Boolean));if(on)classes.add(name);else classes.delete(name);this.setAttribute('class',[...classes].join(' '));}};
 constructor(readonly tag:string){}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 setAttribute(key:string,value:string){this.attributes.set(key,value);}
 hasAttribute(key:string){return this.attributes.has(key);}
 removeAttribute(key:string){this.attributes.delete(key);}
 appendChild(child:SvgElement){child.parent=this;this.children.push(child);return child;}
 get nextSibling():SvgElement|null{return this.parent?.children[this.parent.children.indexOf(this)+1]||null;}
 insertBefore(child:SvgElement,next:SvgElement|null){if(child===next)return child;if(child.parent)child.parent.children=child.parent.children.filter(item=>item!==child);const at=next?this.children.indexOf(next):this.children.length;assert.ok(at>=0);this.children.splice(at,0,child);child.parent=this;return child;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=undefined;}
}
const node=(id:string,x=0,y=0):Card=>({id,kind:'text',text:id,color:'sand',x,y,width:100,height:60});

test('stable visible edges do not rebuild a frame-sized membership collection',t=>{
 let additions=0,collections=0;
 class TrackedSet<T> extends Set<T>{constructor(){super();collections++;}add(value:T){additions++;return super.add(value);}}
 const {EdgeLayer}=load('edge-layer',{'./connections':connections,'./rendering':rendering},{Set:TrackedSet}),root=new SvgElement('svg'),layer=new EdgeLayer(root,'hot-path',()=>{});
 const nodes=Array.from({length:1200},(_,i)=>node('n'+i,i%20*100,Math.floor(i/20)*100));
 const board:Board={version:3,nodes,edges:nodes.slice(1).map((n,i)=>({id:'e'+i,from:nodes[i].id,to:n.id,label:'',style:'straight'})),viewport:{x:0,y:0,zoom:.1}};
 layer.render(board,1000,800);const rows=root.children.filter(child=>child.dataset.edge),paths=rows.map(row=>row.children[0].getAttribute('d'));
 additions=0;collections=0;
 for(let frame=0;frame<120;frame++){board.viewport.x=frame/100;layer.render(board,1000,800);}
 t.diagnostic(`120 frames / ${board.edges.length} visible edges: ${JSON.stringify({additions,collections})}`);
 assert.deepEqual({additions,collections},{additions:0,collections:0});
 assert.deepEqual(root.children.filter(child=>child.dataset.edge),rows);assert.deepEqual(rows.map(row=>row.children[0].getAttribute('d')),paths);
 board.nodes.splice(0,1);layer.render(board,1000,800);assert.equal(rows[0].parent,undefined,'missing endpoints must evict their former rows');
 board.viewport.x=-100000;layer.render(board,1000,800);assert.equal(root.children.filter(child=>child.dataset.edge).length,0);
 board.viewport.x=0;board.nodes.unshift(node('n0'));layer.render(board,1000,800);assert.equal(root.children.filter(child=>child.dataset.edge).length,1199);
 board.edges=[];layer.render(board,1000,800);assert.equal(root.children.filter(child=>child.dataset.edge).length,0);layer.clear();assert.equal(root.children.length,1);
});

test('geometry updates avoid entry arrays while preserving draft dimensions and fractional positions',t=>{
 const original=Object.entries;let entries=0,writes=0;
 const style=new Proxy({left:'0px',top:'0px',width:'100px',height:'60px'},{set(target,key,value){writes++;Reflect.set(target,key,value);return true;}}),element={style},card=node('a');
 t.mock.method(Object,'entries',function(value:object){entries++;return original(value);});
 for(let frame=0;frame<120;frame++)for(let i=0;i<1200;i++)geometry.syncNodeGeometry(card,element);
 t.diagnostic(`144000 unchanged geometry patches: ${JSON.stringify({entries,writes})}`);assert.deepEqual({entries,writes},{entries:0,writes:0});
 Object.assign(card,{x:-1.125,y:3.75,width:250.5,height:150.25});geometry.syncNodeGeometry(card,element,true);
 assert.deepEqual(style,{left:'-1.125px',top:'3.75px',width:'100px',height:'60px'});assert.equal(writes,2);
 geometry.syncNodeGeometry(card,element);assert.deepEqual(style,{left:'-1.125px',top:'3.75px',width:'250.5px',height:'150.25px'});assert.equal(writes,4);
});

test('long ordinary note previews avoid per-line fence scans and retain the full clipped prefix',t=>{
 const paragraph='资料与解释 🧠 / evidence\r\n',body=paragraph.repeat(2000),limit=16000,original=String.prototype.match;let scans=0;
 t.mock.method(String.prototype,'match',function(this:string,pattern:RegExp){if(pattern.source==='^ {0,3}(`{3,}|~{3,})(.*)$')scans++;return original.call(this,pattern);});
 let result='';for(let preview=0;preview<120;preview++)result=rendering.markdownPreview(body,limit);
 t.diagnostic(`120 long ordinary previews: ${scans} line-level fence scans`);assert.equal(scans,0);
 let prefix=body.slice(0,limit);if(/[\uD800-\uDBFF]$/.test(prefix))prefix=prefix.slice(0,-1);
 assert.equal(result,prefix+'\n\n… 双击打开完整笔记');
});

test('clipped Markdown keeps code-fence validity, frontmatter removal and Unicode boundaries',()=>{
 const samples:[string,number,string][]=[
  ['---\r\ntags: [x]\r\n---\r\nabcdef',3,'abc'],
  ['```js\nabcdef',9,'```js\nabc\n```'],
  ['  ~~~~text\nabcdef',13,'  ~~~~text\nab\n~~~~'],
  ['```a`b\nabcdef',10,'```a`b\nabc'],
  ['```\na\n```\nabcdef',12,'```\na\n```\nab'],
  ['```\na\n~~~\nabcdef',12,'```\na\n~~~\nab\n```'],
  ['~~~\na\n~~~~ extra\nabcdef',19,'~~~\na\n~~~~ extra\nab\n~~~'],
  ['    ```\nabcdef',10,'    ```\nab'],
  ['a😀bc',2,'a'],
 ];
 for(const [raw,limit,prefix]of samples)assert.equal(rendering.markdownPreview(raw,limit),prefix+'\n\n… 双击打开完整笔记',JSON.stringify({raw,limit}));
 assert.equal(rendering.markdownPreview('small'), 'small');assert.equal(rendering.markdownPreview('---\na: 1\n---\nsmall'),'small');
});
