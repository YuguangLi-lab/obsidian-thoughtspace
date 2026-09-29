import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeMarkdownPreviewWheel} from '../src/markdown-preview-scroll';
class Element {
 nodeType=1;parentElement?:Element;scrollWidth=600;clientWidth=200;scrollHeight=100;clientHeight=100;scrollLeft=0;scrollTop=0;style={overflowX:'auto',overflowY:'auto',direction:'ltr'};ownerDocument={defaultView:{getComputedStyle:()=>this.style}};
 classes:Set<string>;
 constructor(public tag='table',classes:string[]=[]){this.classes=new Set(classes);if(tag==='math'){this.tag='div';this.classes.add('math-block');}}
 // Match the actual production selectors: class/tag, :not, descendant and direct child.
 // A selector regression must not pass merely because the mock recognizes a tag name.
 matches(selector:string):boolean{
  selector=selector.replace(/\s*>\s*/g,'>');
  const direct=selector.lastIndexOf('>'),space=selector.lastIndexOf(' ');
  if(direct>space)return this.matches(selector.slice(direct+1))&&!!this.parentElement?.matches(selector.slice(0,direct));
  if(space>=0){if(!this.matches(selector.slice(space+1)))return false;for(let parent=this.parentElement;parent;parent=parent.parentElement)if(parent.matches(selector.slice(0,space)))return true;return false;}
  let excluded=false;selector=selector.replace(/:not\(([^)]+)\)/g,(_match,inner:string)=>{excluded||=this.matches(inner);return '';});if(excluded)return false;
  const tag=selector.match(/^[a-z]+/)?.[0],classes=[...selector.matchAll(/\.([\w-]+)/g)].map(match=>match[1]);
  return (!tag||this.tag===tag)&&classes.every(name=>this.classes.has(name))&&!!(tag||classes.length);
 }
 closest(selector:string):Element|undefined{return selector.split(',').some(part=>this.matches(part.trim()))?this:this.parentElement?.closest(selector);}
}
function fixture(patch:Partial<WheelEvent>={},block=new Element()){
 const markdown=new Element('div',['ts-text-markdown']);let root=block;while(root.parentElement)root=root.parentElement;root.parentElement=markdown;
 let prevented=0,stopped=0;const child=new Element('td');child.parentElement=block;
 const event={target:child,deltaX:40,deltaY:0,deltaMode:0,shiftKey:false,ctrlKey:false,metaKey:false,defaultPrevented:false,preventDefault(){prevented++;},stopPropagation(){stopped++;},...patch} as unknown as WheelEvent;
 return{block,child,markdown,event,consume:()=>consumeMarkdownPreviewWheel(event),handled:()=>[prevented,stopped]};
}
function textFixture(patch:Partial<WheelEvent>={}){
 const body=new Element('div',['ts-text-body']),frame=new Element('div',['ts-text']);body.parentElement=frame;body.scrollWidth=body.clientWidth;body.scrollHeight=500;
 return{...fixture({deltaX:0,deltaY:55,...patch},body),body,frame};
}
function cardFixture(patch:Partial<WheelEvent>={}){
 const preview=new Element('div',['ts-card-preview']),frame=new Element('div',['ts-card']);preview.parentElement=frame;
 preview.scrollWidth=preview.clientWidth;preview.clientHeight=1098;preview.scrollHeight=1355;
 const f=fixture({deltaX:0,deltaY:55,...patch},preview);f.markdown.classes.clear();
 return{...f,preview,frame};
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
 for(const patch of [{scrollWidth:200},{clientWidth:0},{scrollWidth:Infinity},{scrollWidth:NaN}]){const block=Object.assign(new Element(),patch),f=fixture({},block);assert.equal(f.consume(),false);assert.deepEqual(f.handled(),[0,0]);}
 const outside=fixture();outside.markdown.classes.clear();assert.equal(outside.consume(),false);assert.deepEqual(outside.handled(),[0,0]);
 const hidden=fixture();hidden.block.style.overflowX='visible';assert.equal(hidden.consume(),false);
});
test('malformed or zero deltas never scroll, and extreme finite deltas stay bounded',()=>{
 for(const value of [NaN,Infinity,-Infinity,0]){const f=fixture({deltaX:value,deltaY:value});assert.equal(f.consume(),false);assert.deepEqual(f.handled(),[0,0]);}
 for(const deltaMode of [0,1,2]){const f=fixture({deltaX:Number.MAX_VALUE,deltaMode});f.block.scrollWidth=Number.MAX_VALUE;assert.equal(f.consume(),true);assert.equal(f.block.scrollLeft,100000);}
});
test('RTL horizontal blocks preserve their negative native scroll range',()=>{const f=fixture({deltaX:-35});f.block.style.direction='rtl';assert.equal(f.consume(),true);assert.equal(f.block.scrollLeft,-35);});
test('text-node event targets resolve through their containing Markdown element',()=>{const f=fixture();Object.defineProperty(f.event,'target',{value:{nodeType:3,parentElement:f.child}});assert.equal(f.consume(),true);assert.equal(f.block.scrollLeft,40);});
test('already handled wheel events and null targets are not consumed a second time',()=>{for(const patch of [{defaultPrevented:true},{target:null}]){const f=fixture(patch);assert.equal(f.consume(),false);assert.deepEqual(f.handled(),[0,0]);}});
test('expanded text bodies consume vertical wheel and leave the board unchanged',()=>{
 const f=textFixture();assert.equal(f.consume(),true);assert.equal(f.body.scrollTop,55);assert.deepEqual(f.handled(),[1,1]);
});
test('text body top and bottom boundaries never fall through to board zoom or pan',()=>{
 for(const [start,delta,end] of [[390,40,400],[400,40,400],[10,-40,0],[0,-40,0]]){const f=textFixture({deltaY:delta});f.body.scrollTop=start;assert.equal(f.consume(),true);assert.equal(f.body.scrollTop,end);assert.deepEqual(f.handled(),[1,1]);}
});
test('folded text, unrelated bodies and nonoverflowing text remain board wheel targets',()=>{
 for(const mutate of [(f:ReturnType<typeof textFixture>)=>f.frame.classes.add('is-folded'),(f:ReturnType<typeof textFixture>)=>f.frame.classes.clear(),(f:ReturnType<typeof textFixture>)=>f.body.classes.clear(),(f:ReturnType<typeof textFixture>)=>{f.body.scrollHeight=f.body.clientHeight;},(f:ReturnType<typeof textFixture>)=>{f.body.style.overflowY='hidden';}]){const f=textFixture();mutate(f);assert.equal(f.consume(),false);assert.deepEqual(f.handled(),[0,0]);}
});
test('Ctrl and Meta keep board zoom available over a scrollable text body',()=>{
 for(const key of ['ctrlKey','metaKey']){const f=textFixture({[key]:true});assert.equal(f.consume(),false);assert.equal(f.body.scrollTop,0);assert.deepEqual(f.handled(),[0,0]);}
});
test('nested tables and formulas use their own horizontal scroll and the body vertical scroll',()=>{
 for(const tag of ['table','pre','math']){
  const f=textFixture(),markdown=new Element('div',['ts-text-markdown']),nested=new Element(tag);markdown.parentElement=f.body;nested.parentElement=markdown;f.child.parentElement=nested;
  assert.equal(f.consume(),true);assert.equal(f.body.scrollTop,55);assert.equal(nested.scrollTop,0);
  Object.assign(f.event,{deltaX:40,deltaY:0});assert.equal(f.consume(),true);assert.equal(nested.scrollLeft,40);assert.equal(f.body.scrollLeft,0);
  Object.assign(f.event,{deltaX:0,deltaY:30,shiftKey:true});assert.equal(f.consume(),true);assert.equal(nested.scrollLeft,70);assert.equal(f.body.scrollTop,55);
 }
});
test('expanded note previews scroll overflowing long content without moving the board',()=>{
 const f=cardFixture();assert.equal(f.consume(),true);assert.equal(f.preview.scrollTop,55);assert.deepEqual(f.handled(),[1,1]);
});
test('note code, table and formula blocks scroll horizontally while vertical gestures reach the note preview',()=>{
 for(const tag of ['pre','table','math']){
  const f=cardFixture(),nested=new Element(tag);nested.parentElement=f.preview;f.child.parentElement=nested;
  assert.equal(f.consume(),true);assert.equal(f.preview.scrollTop,55);assert.equal(nested.scrollTop,0);
  Object.assign(f.event,{deltaX:40,deltaY:0});assert.equal(f.consume(),true);assert.equal(nested.scrollLeft,40);assert.equal(f.preview.scrollLeft,0);
  Object.assign(f.event,{deltaX:0,deltaY:30,shiftKey:true});assert.equal(f.consume(),true);assert.equal(nested.scrollLeft,70);assert.equal(f.preview.scrollTop,55);
 }
});
test('note preview top and bottom edges consume wheel without zooming or panning the board',()=>{
 for(const [start,delta,end]of [[247,40,257],[257,40,257],[10,-40,0],[0,-40,0]]){
  const f=cardFixture({deltaY:delta});f.preview.scrollTop=start;
  assert.equal(f.consume(),true);assert.equal(f.preview.scrollTop,end);assert.deepEqual(f.handled(),[1,1]);
 }
});
test('Ctrl and Meta preserve zoom over note previews and their nested code blocks',()=>{
 for(const key of ['ctrlKey','metaKey'])for(const nested of [false,true]){
  const f=cardFixture({[key]:true}),code=new Element('pre');
  if(nested){code.parentElement=f.preview;f.child.parentElement=code;Object.assign(f.event,{deltaX:40,deltaY:55});}
  assert.equal(f.consume(),false);assert.equal(f.preview.scrollTop,0);assert.equal(code.scrollLeft,0);assert.deepEqual(f.handled(),[0,0]);
 }
});
test('folded notes, unrelated previews and nonoverflowing notes remain board wheel targets',()=>{
 for(const mutate of [
  (f:ReturnType<typeof cardFixture>)=>f.frame.classes.add('is-folded'),
  (f:ReturnType<typeof cardFixture>)=>f.frame.classes.clear(),
  (f:ReturnType<typeof cardFixture>)=>f.preview.classes.clear(),
  (f:ReturnType<typeof cardFixture>)=>{const wrapper=new Element('div');wrapper.parentElement=f.frame;f.preview.parentElement=wrapper;},
  (f:ReturnType<typeof cardFixture>)=>{f.preview.scrollHeight=f.preview.clientHeight;},
  (f:ReturnType<typeof cardFixture>)=>{f.preview.style.overflowY='hidden';}
 ]){const f=cardFixture();mutate(f);assert.equal(f.consume(),false);assert.deepEqual(f.handled(),[0,0]);}
 for(const tag of ['pre','table','math']){
  const f=cardFixture({deltaX:40,deltaY:0}),nested=new Element(tag);nested.parentElement=f.preview;f.child.parentElement=nested;f.frame.classes.add('is-folded');
  assert.equal(f.consume(),false);assert.equal(nested.scrollLeft,0);assert.deepEqual(f.handled(),[0,0]);
 }
});
test('a nested note code block consumes its horizontal edge instead of scrolling the preview or board',()=>{
 const f=cardFixture({deltaX:40,deltaY:0}),code=new Element('pre');code.parentElement=f.preview;f.child.parentElement=code;
 code.scrollLeft=400;f.preview.scrollWidth=800;
 assert.equal(f.consume(),true);assert.equal(code.scrollLeft,400);assert.equal(f.preview.scrollLeft,0);assert.deepEqual(f.handled(),[1,1]);
});
test('diagonal note wheel routes horizontal code scrolling and vertical preview scrolling independently',()=>{
 for(const [codeStart,previewStart,codeEnd,previewEnd]of [[0,0,1,55],[400,247,400,257],[400,257,400,257]]){
  const f=cardFixture({deltaX:1,deltaY:55}),code=new Element('pre');code.parentElement=f.preview;f.child.parentElement=code;
  code.scrollLeft=codeStart;f.preview.scrollTop=previewStart;f.preview.scrollWidth=800;
  assert.equal(f.consume(),true);
  assert.equal(code.scrollLeft,codeEnd);assert.equal(code.scrollTop,0);
  assert.equal(f.preview.scrollTop,previewEnd);assert.equal(f.preview.scrollLeft,0);
  assert.deepEqual(f.handled(),[1,1]);
 }
});
test('a nested block that scrolls both axes consumes both without also scrolling its note preview',()=>{
 for(const [x,y,endX,endY]of [[0,0,1,55],[400,300,400,300]]){
  const f=cardFixture({deltaX:1,deltaY:55}),code=new Element('pre');code.parentElement=f.preview;f.child.parentElement=code;
  code.scrollHeight=400;code.scrollLeft=x;code.scrollTop=y;f.preview.scrollWidth=800;
  assert.equal(f.consume(),true);assert.deepEqual([code.scrollLeft,code.scrollTop],[endX,endY]);
  assert.deepEqual([f.preview.scrollLeft,f.preview.scrollTop],[0,0]);assert.deepEqual(f.handled(),[1,1]);
 }
});
test('diagonal wheel can send vertical scrolling inward and horizontal scrolling to the note preview',()=>{
 const f=cardFixture({deltaX:40,deltaY:55}),code=new Element('pre');code.parentElement=f.preview;f.child.parentElement=code;
 code.scrollWidth=code.clientWidth;code.scrollHeight=400;f.preview.scrollWidth=800;
 assert.equal(f.consume(),true);assert.deepEqual([code.scrollLeft,code.scrollTop],[0,55]);
 assert.deepEqual([f.preview.scrollLeft,f.preview.scrollTop],[40,0]);assert.deepEqual(f.handled(),[1,1]);
});
