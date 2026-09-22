import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';import {nodeFitChanges} from '../src/node-fit-batch';
function fixture(){
 const source=readFileSync('src/main.ts','utf8');const take=(a:string,b:string)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 const code=take('  private queueNodeFit(', '  private refreshFontMetrics(')+take('  private flushNodeFits(', '\n  saveView(')+take('  private pointerUp(', '  private updateSelection(');
 const View=new Function('nodeFitChanges','clone',transformSync('class View{'+code+'}\nreturn View',{loader:'ts'}).code)(nodeFitChanges,structuredClone);
 const node={id:'a',kind:'card',file:'n.md',color:'sand',autoFit:true,x:0,y:0,width:300,height:150};
 const v=new View();v.pendingFits=new Map();v.nodeKeys=new Map([['a','current']]);let scheduled=0,saves=0;
 v.nodeFitQueue={schedule(){scheduled++}};v.session={board:{nodes:[node],viewport:{x:0,y:0,zoom:1}},change(fn:any){saves++;fn(this.board)}};
 v.renderBoard=()=>{};v.flushPointer=()=>{};v.previewGridLanding=()=>{};v.drawAlignmentGuides=()=>{};v.stage={hasPointerCapture:()=>false};
 return{v,node,counts:()=>({scheduled,saves})};
}
test('preview finishing during a pan applies its measured size after release',()=>{
 const {v,node,counts}=fixture();v.gesture={id:1,pan:true,x:NaN,y:NaN};v.queueNodeFit(node,{width:300,height:420});
 assert.equal(v.pendingFits.size,1,'pan must not discard completed measurements');assert.equal(node.height,150);
 v.pointerUp({pointerId:1});assert.ok(counts().scheduled>0);v.flushNodeFits();assert.equal(node.height,420);assert.equal(counts().saves,1);
});
test('a scheduled fit is retained if a gesture starts before its frame',()=>{
 const {v,node}=fixture();v.queueNodeFit(node,{width:300,height:350});v.gesture={id:1,pan:true,x:NaN,y:NaN};v.flushNodeFits();assert.equal(v.pendingFits.size,1);assert.equal(node.height,150);
 v.pointerUp({pointerId:1});v.flushNodeFits();assert.equal(node.height,350);
});
test('stale fits still cannot overwrite a manually resized or replaced card',()=>{
 const {v,node}=fixture();v.queueNodeFit(node,{width:300,height:420});v.nodeKeys.set('a','replacement');v.flushNodeFits();assert.equal(node.height,150);
});

test('cancelled panning also resumes valid measurements',()=>{
 const {v,node}=fixture();v.gesture={id:1,pan:true,x:NaN,y:NaN};v.queueNodeFit(node,{width:300,height:360});v.pointerUp({pointerId:1},true);v.flushNodeFits();assert.equal(node.height,360);
});
test('invalid measurements never schedule a board write',()=>{
 const {v,node,counts}=fixture();for(const height of [NaN,Infinity,0,-5])v.queueNodeFit(node,{width:300,height});assert.equal(v.pendingFits.size,0);assert.equal(counts().scheduled,0);
});
