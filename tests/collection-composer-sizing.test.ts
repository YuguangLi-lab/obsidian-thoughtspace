import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

const source=readFileSync(new URL('../src/collection-view.ts',import.meta.url),'utf8');
const start=source.indexOf(' private fitBodyInput(){'),end=source.indexOf(' private report(',start);
assert.ok(start>=0&&end>start);
const View=new Function(transformSync(`class View {${source.slice(start,end)}} return View`,{loader:'ts'}).code)();

function fixture(){
 let width=300,height='72px',scrollHeight=72,scrollTop=0;
 const writes:string[]=[];
 const style={get height(){return height;},set height(value:string){height=value;writes.push(value);scrollTop=0;}};
 const input={isConnected:true,style,value:'一条记录',setCssStyles(values:Record<string,string>){assert.deepEqual(Object.keys(values),['height']);style.height=values.height;},get scrollHeight(){return scrollHeight;},get scrollTop(){return scrollTop;},set scrollTop(value:number){scrollTop=value;},getBoundingClientRect:()=>({width})};
 const document={activeElement:input};
 for(const[key,value]of Object.entries({selectionStart:1,selectionEnd:3,selectionDirection:'backward'}))Object.defineProperty(input,key,{get:()=>value,set:()=>{throw Error(`Unexpected ${key} write`);}});
 const view=new View();view.bodyInput=input;
 return{view,input,document,writes,fit:()=>view.fitBodyInput(),height:()=>height,measure:(w:number,h:number)=>{width=w;scrollHeight=h;}};
}
test('the existing textarea grows with content and contracts after clearing without replacing the field',()=>{
 const f=fixture();f.fit();f.input.value='更长的正文\n第二行\n第三行';f.measure(300,124);f.fit();assert.equal(f.height(),'124px');
 f.input.value='';f.measure(300,72);f.fit();assert.equal(f.height(),'72px');assert.equal(f.view.bodyInput,f.input);assert.equal(f.document.activeElement,f.input);
});
test('metadata synchronization with identical draft and width cannot rewrite the textarea size or scroll',()=>{
 const f=fixture();f.fit();f.writes.length=0;f.input.scrollTop=58;f.fit();assert.deepEqual(f.writes,[]);assert.equal(f.input.scrollTop,58);
});
test('a resized pane recalculates wrapping while preserving caret selection and current editor scroll',()=>{
 const f=fixture();f.fit();f.input.scrollTop=44;f.measure(240,156);f.fit();assert.equal(f.height(),'156px');assert.equal(f.input.scrollTop,44);assert.equal(Reflect.get(f.input,'selectionStart'),1);assert.equal(Reflect.get(f.input,'selectionEnd'),3);assert.equal(f.document.activeElement,f.input);
});
test('detached or unmeasurable panes do not write a guessed height or consume the later resize',()=>{
 const f=fixture();f.input.isConnected=false;f.fit();assert.deepEqual(f.writes,[]);f.input.isConnected=true;f.measure(0,72);f.fit();assert.deepEqual(f.writes,[]);f.measure(300,200);f.fit();assert.equal(f.height(),'200px');
});
test('failed height measurement keeps the prior height and permits a later retry',()=>{
 const f=fixture();f.measure(300,0);f.fit();assert.equal(f.height(),'72px');f.measure(300,168);f.fit();assert.equal(f.height(),'168px');
});
test('reopening clears only geometry cache and both draft sync and native leaf resize use the same editor sizing',()=>{
 assert.match(source,/async onOpen\(\)\{\s*this\.alive=true;this\.bodySizeValue=undefined;this\.bodySizeWidth=0;/);
 assert.match(source,/onResize\(\)\{this\.fitBodyInput\(\);\}/);
 assert.match(source,/if\(!this\.composing&&this\.bodyInput\.value!==draft\.body\)this\.bodyInput\.value=draft\.body;\s*this\.fitBodyInput\(\);/);
});
