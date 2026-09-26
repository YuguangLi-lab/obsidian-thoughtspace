import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {allowsReadOnlyKey,isSimpleTopicContinuation} from '../src/inline-editor-keys';

const main=readFileSync('src/main.ts','utf8');
const promptStart=main.indexOf('class Prompt extends Modal {'),promptEnd=main.indexOf('class NotePicker ',promptStart);
assert.ok(promptStart>=0&&promptEnd>promptStart);
const promptSource=transformSync(main.slice(promptStart,promptEnd)+'\nreturn Prompt;',{loader:'ts'}).code;

function promptFixture(){
 const inputs:{value:string;onkeydown?:(event:any)=>void}[]=[],submitted:string[]=[];
 let closed=0;
 class Modal {
  modalEl={addClass(){}};
  contentEl={createEl(tag:string,options:{value?:string}){const el={value:options.value||'',focus(){},select(){}};if(tag==='input')inputs.push(el);return el;},empty(){}};
  close(){closed++;}
 }
 const button=(_parent:unknown,_label:string,_icon:string,run:()=>Promise<void>)=>{
  const el={disabled:false,click(){if(!el.disabled)void run();}};return el;
 };
 const Prompt=new Function('Modal','button','themeSurface',promptSource)(Modal,button,()=>{});
 const modal=new Prompt({},'关系说明','正在输入',(value:string)=>{submitted.push(value);});modal.onOpen();
 const input=inputs[0]!;
 const press=(extra:Record<string,unknown>={})=>{
  const event={key:'Enter',isComposing:false,keyCode:13,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...extra};
  input.onkeydown?.(event);return event;
 };
 return{input,submitted,press,closed:()=>closed};
}

test('naming prompt leaves the IME candidate-confirming Enter to composition',()=>{
 for(const composition of [{isComposing:true},{keyCode:229}]){
  const f=promptFixture();f.press(composition);
  assert.deepEqual(f.submitted,[],JSON.stringify(composition));assert.equal(f.closed(),0);
 }
});

test('naming prompt respects an Enter already handled by the host',()=>{
 const f=promptFixture();f.press({defaultPrevented:true});assert.deepEqual(f.submitted,[]);
});

test('a normal Enter still submits the completed name once and closes the prompt',async()=>{
 const f=promptFixture();f.input.value='  已完成的名称  ';f.press();f.press();
 assert.deepEqual(f.submitted,['已完成的名称']);await Promise.resolve();assert.equal(f.closed(),1);
});

const inline=readFileSync('src/inline-node-editor.ts','utf8');
const keyStart=inline.indexOf('  const keydown=(e:KeyboardEvent)=>{'),keyEnd=inline.indexOf("  this.el.addEventListener('keydown',e=>e.stopPropagation());",keyStart);
assert.ok(keyStart>=0&&keyEnd>keyStart);
const bindKeys=new Function('options','allowsReadOnlyKey','isSimpleTopicContinuation','Notice',transformSync(inline.slice(keyStart,keyEnd),{loader:'ts'}).code);

function inlineFixture(){
 let handler:(event:any)=>void=()=>{};
 const input={value:'草稿',selectionStart:0,selectionEnd:2,selectionCount:1},formatted:string[]=[];
 const editor={input,el:{addEventListener(_type:string,listener:(event:any)=>void){handler=listener;}},composing:false,pending:undefined,native:undefined,format:(command:string)=>formatted.push(command)};
 bindKeys.call(editor,{markdown:true},allowsReadOnlyKey,isSimpleTopicContinuation,class{});
 const press=(key:string,extra:Record<string,unknown>={})=>{
  const event={key,target:input,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,isComposing:false,keyCode:0,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...extra};
  handler(event);return event;
 };
 return{formatted,press};
}

test('inline formatting retains the exact Obsidian Mod B, I and K chords',()=>{
 for(const modifier of ['ctrlKey','metaKey'])for(const [key,command] of [['b','bold'],['i','italic'],['k','link']]){
  const f=inlineFixture(),event=f.press(key,{[modifier]:true});
  assert.deepEqual(f.formatted,[command]);assert.equal(event.defaultPrevented,true);
 }
});

test('extra Shift on native formatting chords does not unexpectedly change the draft',()=>{
 for(const modifier of ['ctrlKey','metaKey'])for(const key of ['B','I','K']){
  const f=inlineFixture(),event=f.press(key,{[modifier]:true,shiftKey:true});
  assert.deepEqual(f.formatted,[],`${modifier}+Shift+${key}`);assert.equal(event.defaultPrevented,false);
 }
});

test('the explicit strikethrough chord and alternate modifier guards remain distinct',()=>{
 for(const modifier of ['ctrlKey','metaKey']){
  const f=inlineFixture();f.press('X',{[modifier]:true,shiftKey:true});assert.deepEqual(f.formatted,['strike']);
  for(const extra of [{altKey:true},{isComposing:true},{keyCode:229},{defaultPrevented:true}]){
   const guarded=inlineFixture(),event=guarded.press('b',{[modifier]:true,...extra});assert.deepEqual(guarded.formatted,[]);assert.equal(event.stopped,false);assert.equal(event.defaultPrevented,extra.defaultPrevented===true);
  }
 }
});
