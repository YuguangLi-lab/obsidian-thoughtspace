import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Card} from '../src/model';
const source=readFileSync(process.env.GEOMETRY_SOURCE||'src/model.ts','utf8');
const a=source.indexOf('export function assertBoardGeometry('),z=source.indexOf('export class History',a);
const {assertBoardGeometry,fitViewport}=new Function('emptyBoard',transformSync(source.slice(a,z).replaceAll('export function','function')+';return {assertBoardGeometry,fitViewport}',{loader:'ts'}).code)(emptyBoard);
const node=(i:number):Card=>({id:String(i),kind:'text',text:'x',x:i*340,y:(i%9)*230,width:320,height:200,color:'sand'});
function reference(nodes:Card[],width:number,height:number){
 nodes=nodes.filter(n=>[n.x,n.y,n.width,n.height].every(Number.isFinite)&&n.width>0&&n.height>0);
 if(!nodes.length||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return emptyBoard().viewport;
 const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y)),w=Math.max(...nodes.map(n=>n.x+n.width))-x,h=Math.max(...nodes.map(n=>n.y+n.height))-y;
 const zoom=Math.max(.15,Math.min(1.3,(width-100)/w,(height-100)/h));return{x:(width-w*zoom)/2-x*zoom,y:(height-h*zoom)/2-y*zoom,zoom};
}
test('geometry validation does not allocate per-node coordinate arrays on repeated transactions',()=>{
 const board=emptyBoard();board.nodes=Array.from({length:1200},(_,i)=>node(i));let every=0;const original=Array.prototype.every;
 Array.prototype.every=(function(this:unknown[],...args:any[]){every++;return Reflect.apply(original,this,args);}) as typeof original;
 try{for(let i=0;i<120;i++)assertBoardGeometry(board);}finally{Array.prototype.every=original;}
 assert.equal(every,0);
});
test('geometry validation still rejects each invalid coordinate, size and viewport',()=>{
 for(const field of ['x','y','width','height'] as const)for(const value of [NaN,Infinity,-Infinity]){const b=emptyBoard();b.nodes=[{...node(0),[field]:value}];assert.throws(()=>assertBoardGeometry(b),/尺寸无效/);}
 for(const [width,height] of [[79,40],[80,39]]){const b=emptyBoard();b.nodes=[{...node(0),width,height}];assert.throws(()=>assertBoardGeometry(b),/尺寸无效/);}
 for(const field of ['x','y','zoom'] as const)for(const value of [NaN,Infinity,-Infinity]){const b=emptyBoard();b.viewport[field]=value;assert.throws(()=>assertBoardGeometry(b),/视口无效/);}
 for(const zoom of [.1499,2.5001]){const b=emptyBoard();b.viewport.zoom=zoom;assert.throws(()=>assertBoardGeometry(b),/视口无效/);}
 const b=emptyBoard();b.nodes=[{...node(0),x:-0,y:-10,width:80,height:40}];for(const zoom of [.15,2.5]){b.viewport.zoom=zoom;assert.doesNotThrow(()=>assertBoardGeometry(b));}
});
test('fit viewport preserves exact bounds and numeric edge cases without array scans',()=>{
 let seed=19;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
 for(let i=0;i<800;i++){const nodes=Array.from({length:i%37},(_,j)=>({...node(j),x:(rand()-.5)*1e5,y:(rand()-.5)*1e5,width:rand()*1000,height:rand()*1000}));if(nodes.length&&i%3===0)nodes[0].width=NaN;const w=rand()*1500,h=rand()*1000;assert.deepEqual(fitViewport(nodes,w,h),reference(nodes,w,h));}
 for(const width of [0,-1,NaN,Infinity,1,100,1000])for(const height of [0,NaN,1,1000])for(const nodes of [[],[node(0)],[{...node(0),x:-0,y:-0}],[{...node(0),width:0}],[{...node(0),x:1e308,width:1e308}]])assert.deepEqual(fitViewport(nodes,width,height),reference(nodes,width,height));
});
test('fit viewport handles a large board without exceeding function argument limits',()=>{
 const nodes=Array.from({length:160000},(_,i)=>node(i));const result=fitViewport(nodes,1000,800);
 assert.deepEqual(result,reference([nodes[0],nodes[8],nodes.at(-1)!],1000,800));
});
