import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import type {Board,Card} from '../src/model';

// Execute the actual full-refresh navigation method; only its DOM boundary is substituted.
const source=readFileSync(process.env.NAVIGATION_COUNT_SOURCE||'src/main.ts','utf8'),start=source.indexOf('  private renderNavigation()'),end=source.indexOf('  private mapPreview(',start);
assert.ok(start>=0&&end>start);
const View=new Function('button',transformSync(`return class View{${source.slice(start,end)}}`,{loader:'ts'}).code)(()=>({}));
const kinds=['card','board','text','image','pdf','section'] as const;
function fixture(count=1200){
 let reads=0,text='';const nodes:Card[]=Array.from({length:count},(_,i)=>({id:'n'+i,get kind(){reads++;return kinds[i%kinds.length];},x:i*200,y:0,width:100,height:80,color:'sand'}));
 const board:Board={version:3,nodes,edges:[],viewport:{x:0,y:0,zoom:1}},view=new View();
 Object.assign(view,{session:{board},crumbs:{empty(){},createSpan(){}},contentEl:{toggleClass(){}},trail:[],boardStats:{setText(value:string){text=value;}}});
 return{view,board,render:()=>view.renderNavigation(),get reads(){return reads;},get text(){return text;}};
}

test('120 full navigation refreshes count each of 1200 mixed objects once',t=>{
 const f=fixture();for(let frame=0;frame<120;frame++)f.render();t.diagnostic(`120 navigation refreshes: ${f.reads} kind reads`);
 assert.equal(f.reads,144000);assert.equal(f.text,'200 张卡片  ·  200 个子白板  ·  200 文本  ·  200 图片  ·  200 PDF  ·  0 条关系');
});

test('navigation counts stay current after object and board replacement, reorder and edge removal',()=>{
 const f=fixture(6);f.board.edges=[{id:'e',from:'n0',to:'n1',label:''}];f.render();assert.equal(f.text,'1 张卡片  ·  1 个子白板  ·  1 文本  ·  1 图片  ·  1 PDF  ·  1 条关系');
 f.board.nodes=f.board.nodes.map(n=>n.kind==='card'?{...n,kind:'text' as const}:n).reverse();f.render();assert.equal(f.text,'0 张卡片  ·  1 个子白板  ·  2 文本  ·  1 图片  ·  1 PDF  ·  1 条关系');
 const current:Board={...f.board,nodes:f.board.nodes.filter(n=>n.kind==='section'),edges:[]};f.view.session.board=current;f.render();assert.equal(f.text,'0 张卡片  ·  0 个子白板  ·  0 文本  ·  0 图片  ·  0 PDF  ·  0 条关系');
 current.nodes=[];f.render();assert.equal(f.text,'0 张卡片  ·  0 个子白板  ·  0 文本  ·  0 图片  ·  0 PDF  ·  0 条关系');
});
