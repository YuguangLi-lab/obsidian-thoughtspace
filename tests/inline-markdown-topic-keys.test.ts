import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {allowsReadOnlyKey,isSimpleTopicContinuation} from '../src/inline-editor-keys';

const source=readFileSync('src/inline-node-editor.ts','utf8');
const start=source.indexOf('  const keydown=(e:KeyboardEvent)=>{');
const end=source.indexOf("  this.el.addEventListener('keydown',e=>e.stopPropagation());",start);
assert.ok(start>=0&&end>start);
const bind=new Function('options','allowsReadOnlyKey','isSimpleTopicContinuation','Notice',transformSync(source.slice(start,end),{loader:'ts'}).code);

function fixture(value='主题',native=true){
 let handler:(e:any)=>void=()=>{};
 const body={},outside={},input={value,selectionStart:value.length,selectionEnd:value.length,selectionCount:1};
 const calls={child:0,sibling:0,commit:0,cancel:0};
 const options={markdown:true,continueTopic:async(sibling:boolean)=>{calls[sibling?'sibling':'child']++;}};
 const editor={input,el:{addEventListener(_type:string,listener:(e:any)=>void){handler=listener;}},native:native?{ownsKeyTarget:(target:unknown)=>target===body}:undefined,composing:false,pending:undefined as unknown,
  commit:async()=>{calls.commit++;return true;},cancel:()=>{calls.cancel++;}};
 bind.call(editor,options,allowsReadOnlyKey,isSimpleTopicContinuation,class{});
 const key=(key:string,extra={})=>{const event={key,target:native?body:input,shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,isComposing:false,keyCode:0,repeat:false,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};handler(event);return event;};
 return{editor,input,calls,key,outside};
}

test('native contentDOM and textarea fallback both retain short-topic creation',()=>{
 for(const native of [true,false]){const f=fixture('主题',native);assert.equal(f.key('Tab').prevented,true);assert.equal(f.key('Enter').prevented,true);assert.deepEqual(f.calls,{child:1,sibling:1,commit:0,cancel:0});}
});
test('native Markdown tables, math, lists and code keep their keyboard events',()=>{
 for(const value of ['| A | B |','- [ ] 今天任务','$$x^2$$','```javascript\nconsole.log(1)\n```','文字\n下一行'])for(const key of ['Tab','Enter']){const f=fixture(value),event=f.key(key);assert.equal(event.prevented,false,value);assert.equal(event.stopped,false,value);assert.equal(f.calls.child+f.calls.sibling,0);}
});
test('selection replacement and editing within a topic never create nodes',()=>{
 for(const selection of [{selectionStart:0,selectionEnd:2},{selectionStart:1,selectionEnd:1},{selectionCount:2}]){const f=fixture();Object.assign(f.input,selection);assert.equal(f.key('Enter').prevented,false);assert.equal(f.key('Tab').prevented,false);assert.equal(f.calls.child+f.calls.sibling,0);}
});
test('IME, Shift+Enter and toolbar-targeted keys never invoke topic continuation',()=>{
 for(const extra of [{isComposing:true},{keyCode:229},{shiftKey:true},{altKey:true},{defaultPrevented:true}]){const f=fixture();assert.equal(f.key('Enter',extra).prevented,false);assert.equal(f.calls.sibling,0);}
 const f=fixture();assert.equal(f.key('Enter',{target:f.outside}).prevented,false);f.editor.composing=true;assert.equal(f.key('Tab').prevented,false);assert.equal(f.calls.child+f.calls.sibling,0);
});
test('repeated held topic keys do not create repeated nodes and explicit save remains available',()=>{
 const f=fixture();assert.equal(f.key('Enter',{repeat:true}).prevented,true);assert.equal(f.calls.sibling,0);f.key('Enter',{ctrlKey:true});assert.equal(f.calls.commit,1);assert.equal(f.calls.sibling,0);
});
