import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,type Card} from '../src/model';
import {visibleBranchBoard} from '../src/mindmap';
import {intersects,viewportRect} from '../src/rendering';

const source=readFileSync(process.env.BACK_CONTENT_SOURCE||'src/main.ts','utf8');
const start=source.indexOf('  private updateBackToContent('),end=source.indexOf('  private transform()',start);
assert.ok(start>0&&end>start);
const View=new Function('visibleBranchBoard','intersects','viewportRect',transformSync(`class View{${source.slice(start,end)}};return View`,{loader:'ts'}).code)(visibleBranchBoard,intersects,viewportRect);
const node=(id:string,x=2000,y=2000):Card=>({id,kind:'text',text:id,x,y,width:120,height:80,color:'sand'});
function fixture(nodes:Card[]){
 const board=emptyBoard();board.viewport={x:0,y:0,zoom:1};board.nodes=nodes;
 const classes=new Set<string>(),counts={width:0,height:0,writes:0};const button={classList:{contains:(key:string)=>classes.has(key)},toggleClass(key:string,on:boolean){counts.writes++;if(on)classes.add(key);else classes.delete(key);}};
 const view=new View();view.session={board};view.backToContent=button;
 const size={width:800,height:600};view.stage={get clientWidth(){counts.width++;return size.width;},get clientHeight(){counts.height++;return size.height;}};
 return {view,board,size,classes,counts,reset(){counts.width=counts.height=counts.writes=0;}};
}

test('an offscreen 1200-card board measures the viewport once per refresh',()=>{
 const f=fixture(Array.from({length:1200},(_,i)=>node(String(i))));f.view.updateBackToContent();
 assert.equal(f.classes.has('is-visible'),true);assert.deepEqual(f.counts,{width:1,height:1,writes:1});f.reset();
 for(let i=0;i<120;i++)f.view.updateBackToContent();
 assert.deepEqual(f.counts,{width:120,height:120,writes:0});
});
test('camera, viewport size and mutable node changes update the affordance immediately',()=>{
 const f=fixture([node('a')]);f.view.updateBackToContent();assert.ok(f.classes.has('is-visible'));
 f.board.viewport={x:-2000,y:-2000,zoom:1};f.view.updateBackToContent();assert.ok(!f.classes.has('is-visible'));
 f.board.viewport={x:0,y:0,zoom:1};f.view.updateBackToContent();assert.ok(f.classes.has('is-visible'));
 f.size.width=2500;f.size.height=2500;f.view.updateBackToContent();assert.ok(!f.classes.has('is-visible'));
 f.board.nodes[0].x=6000;f.view.updateBackToContent();assert.ok(f.classes.has('is-visible'));
 f.board.viewport.zoom=.2;f.view.updateBackToContent();assert.ok(!f.classes.has('is-visible'));
});
test('hidden descendants do not count as visible content and unfolding reevaluates them',()=>{
 const f=fixture([node('root'),node('child',100,100)]);f.board.version=3;f.board.nodes[0].branchFolded=true;f.board.edges=[{id:'edge',kind:'branch',from:'root',to:'child',label:''}];
 f.view.updateBackToContent();assert.ok(f.classes.has('is-visible'));f.board.nodes[0].branchFolded=false;f.view.updateBackToContent();assert.ok(!f.classes.has('is-visible'));
});
test('a folded section uses compact displayed bounds instead of its logical frame',()=>{
 const f=fixture([{...node('frame',700,100),kind:'section',width:1000,height:1000,sectionFolded:true}]);
 f.board.viewport.x=-1100;f.view.updateBackToContent();assert.ok(f.classes.has('is-visible'));
 f.board.nodes[0].sectionFolded=false;f.view.updateBackToContent();assert.ok(!f.classes.has('is-visible'));
});
test('empty boards and missing controls avoid layout reads and clear stale visibility',()=>{
 const f=fixture([node('a')]);f.view.updateBackToContent();f.board.nodes=[];f.reset();f.view.updateBackToContent();
 assert.equal(f.classes.has('is-visible'),false);assert.deepEqual(f.counts,{width:0,height:0,writes:1});
 f.board.nodes=[node('a')];f.view.backToContent=undefined;f.reset();assert.doesNotThrow(()=>f.view.updateBackToContent());assert.deepEqual(f.counts,{width:0,height:0,writes:0});
});
