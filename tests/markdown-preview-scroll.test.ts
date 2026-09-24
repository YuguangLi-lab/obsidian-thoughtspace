import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeMarkdownPreviewWheel} from '../src/markdown-preview-scroll';
class Element {
 nodeType=1;parentElement?:Element;scrollWidth=600;clientWidth=200;scrollHeight=100;clientHeight=100;scrollLeft=0;scrollTop=0;inMarkdown=true;style={overflowX:'auto',overflowY:'auto',direction:'ltr'};ownerDocument={defaultView:{getComputedStyle:()=>this.style}};
 constructor(public tag='table'){}
 closest(_selector:string):Element|undefined{return this.inMarkdown&&['table','pre','math'].includes(this.tag)?this:this.parentElement?.closest(_selector);}
}
function fixture(patch:Partial<WheelEvent>={},block=new Element()){
 let prevented=0,stopped=0;const child=new Element('td');child.parentElement=block;
 const event={target:child,deltaX:40,deltaY:0,deltaMode:0,shiftKey:false,ctrlKey:false,metaKey:false,defaultPrevented:false,preventDefault(){prevented++;},stopPropagation(){stopped++;},...patch} as unknown as WheelEvent;
 return{block,child,event,consume:()=>consumeMarkdownPreviewWheel(event),handled:()=>[prevented,stopped]};
}
test('horizontal table wheel scrolls its containing block and blocks board propagation',()=>{const f=fixture();assert.equal(f.consume(),true);assert.equal(f.block.scrollLeft,40);assert.deepEqual(f.handled(),[1,1]);});
test('Shift wheel scrolls horizontally while keeping the vertical scroll state',()=>{const f=fixture({deltaX:0,deltaY:25,shiftKey:true});f.block.scrollHeight=300;assert.equal(f.consume(),true);assert.deepEqual([f.block.scrollLeft,f.block.scrollTop],[25,0]);});
test('horizontal device deltas already mapped by the browser are not lost with Shift',()=>{const f=fixture({deltaX:35,deltaY:0,shiftKey:true});assert.equal(f.consume(),true);assert.equal(f.block.scrollLeft,35);});
test('overflowing code and formula blocks keep their scroll gestures inside Markdown',()=>{for(const tag of ['pre','math']){const f=fixture({},new Element(tag));assert.equal(f.consume(),true);assert.equal(f.block.scrollLeft,40);}});
test('vertical wheel only scrolls blocks with real vertical overflow and scrollable CSS',()=>{
 const f=fixture({deltaX:0,deltaY:55});assert.equal(f.consume(),false);f.block.scrollHeight=400;assert.equal(f.consume(),true);assert.equal(f.block.scrollTop,55);
 const hidden=fixture({deltaX:0,deltaY:55});hidden.block.scrollHeight=400;hidden.block.style.overflowY='hidden';assert.equal(hidden.consume(),false);assert.equal(hidden.block.scrollTop,0);assert.deepEqual(hidden.handled(),[0,0]);
});
test('scroll boundaries consume gestures instead of unexpectedly zooming or panning the board',()=>{
 for(const [start,delta,end] of [[390,40,400],[400,40,400],[10,-40,0],[0,-40,0]]){const f=fixture({deltaX:delta});f.block.scrollLeft=start;assert.equal(f.consume(),true);assert.equal(f.block.scrollLeft,end);assert.deepEqual(f.handled(),[1,1]);}
});
test('Ctrl and Meta preserve board zoom even over overflowing Markdown',()=>{for(const key of ['ctrlKey','metaKey']){const f=fixture({[key]:true,shiftKey:true});assert.equal(f.consume(),false);assert.equal(f.block.scrollLeft,0);assert.deepEqual(f.handled(),[0,0]);}});
test('line and page wheel units normalize against each block axis',()=>{
 const lines=fixture({deltaX:2,deltaY:3,deltaMode:1});lines.block.scrollHeight=400;assert.equal(lines.consume(),true);assert.deepEqual([lines.block.scrollLeft,lines.block.scrollTop],[32,48]);
 const pages=fixture({deltaX:.5,deltaY:2,deltaMode:2});pages.block.scrollHeight=500;assert.equal(pages.consume(),true);assert.deepEqual([pages.block.scrollLeft,pages.block.scrollTop],[100,200]);
 const shiftedPage=fixture({deltaX:0,deltaY:1,deltaMode:2,shiftKey:true});assert.equal(shiftedPage.consume(),true);assert.equal(shiftedPage.block.scrollLeft,200);
});
test('nested non-overflowing blocks can defer to their overflowing Markdown ancestor',()=>{
 const outer=new Element('pre'),inner=new Element('math');inner.scrollWidth=inner.clientWidth;inner.parentElement=outer;const f=fixture({},inner);assert.equal(f.consume(),true);assert.equal(inner.scrollLeft,0);assert.equal(outer.scrollLeft,40);
});
test('non-Markdown targets and unscrollable dimensions are left to the board',()=>{
 for(const patch of [{scrollWidth:200},{clientWidth:0},{scrollWidth:Infinity},{scrollWidth:NaN},{inMarkdown:false}]){const block=Object.assign(new Element(),patch),f=fixture({},block);assert.equal(f.consume(),false);assert.deepEqual(f.handled(),[0,0]);}
 const hidden=fixture();hidden.block.style.overflowX='visible';assert.equal(hidden.consume(),false);
});
test('malformed or zero deltas never scroll, and extreme finite deltas stay bounded',()=>{
 for(const value of [NaN,Infinity,-Infinity,0]){const f=fixture({deltaX:value,deltaY:value});assert.equal(f.consume(),false);assert.deepEqual(f.handled(),[0,0]);}
 for(const deltaMode of [0,1,2]){const f=fixture({deltaX:Number.MAX_VALUE,deltaMode});f.block.scrollWidth=Number.MAX_VALUE;assert.equal(f.consume(),true);assert.equal(f.block.scrollLeft,100000);}
});
test('RTL horizontal blocks preserve their negative native scroll range',()=>{const f=fixture({deltaX:-35});f.block.style.direction='rtl';assert.equal(f.consume(),true);assert.equal(f.block.scrollLeft,-35);});
test('text-node event targets resolve through their containing Markdown element',()=>{const f=fixture();Object.defineProperty(f.event,'target',{value:{nodeType:3,parentElement:f.child}});assert.equal(f.consume(),true);assert.equal(f.block.scrollLeft,40);});
test('already handled wheel events and null targets are not consumed a second time',()=>{for(const patch of [{defaultPrevented:true},{target:null}]){const f=fixture(patch);assert.equal(f.consume(),false);assert.deepEqual(f.handled(),[0,0]);}});
