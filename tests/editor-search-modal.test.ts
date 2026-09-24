import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as search from '../src/editor-search';

type Options={cls?:string;text?:string;attr?:Record<string,string>;type?:string};
class Element{
 children:Element[]=[];classes=new Set<string>();attributes:Record<string,string>={};disabled=false;value='';checked=false;emptyCalls=0;focusCalls=0;
 private text='';private listeners=new Map<string,(()=>void)[]>();
 onclick?:()=>void;oninput?:()=>void;onchange?:()=>void;onkeydown?:(event:any)=>void;
 constructor(readonly tagName:string,readonly win:Clock,options:Options|string={}){const opts=typeof options==='string'?{cls:options}:options;for(const cls of (opts.cls||'').split(/\s+/).filter(Boolean))this.classes.add(cls);this.text=opts.text||'';this.attributes={...opts.attr};}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
 createEl(tag:string,options:Options|string={}){const child=new Element(tag.toUpperCase(),this.win,options);this.children.push(child);return child;}
 createDiv(options:Options|string={}){return this.createEl('div',options);}
 createSpan(options:Options|string={}){return this.createEl('span',options);}
 addClass(...classes:string[]){for(const cls of classes)this.classes.add(cls);}
 setAttribute(key:string,value:string){this.attributes[key]=value;}
 getAttribute(key:string){return this.attributes[key]??null;}
 setText(text:string){this.text=text;this.children=[];}
 appendText(text:string){this.text+=text;}
 empty(){this.emptyCalls++;this.children=[];this.text='';}
 matches(selector:string){return selector.startsWith('.')?this.classes.has(selector.slice(1)):this.tagName===selector.toUpperCase();}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0];}
 addEventListener(type:string,run:()=>void){this.listeners.set(type,[...this.listeners.get(type)||[],run]);}
 emit(type:string){for(const run of this.listeners.get(type)||[])run();}
 focus(){this.focusCalls++;}
 select(){}
 click(){if(!this.disabled)this.onclick?.();}
}
class Clock{
 next=1;pending=new Map<number,()=>void>();
 setTimeout(run:()=>void){const id=this.next++;this.pending.set(id,run);return id;}
 clearTimeout(id?:number){if(id!==undefined)this.pending.delete(id);}
 flush(){for(const [id,run] of [...this.pending]){this.pending.delete(id);run();}}
}
class Modal{
 readonly clock=new Clock();readonly modalEl=new Element('DIV',this.clock);readonly titleEl=this.modalEl.createEl('h2');readonly contentEl=this.modalEl.createDiv();closeCount=0;
 close(){this.closeCount++;(this as any).onClose();}
}
let searches=0,lineIndexes=0;
const imports:Record<string,unknown>={obsidian:{Modal,setIcon:()=>{}},'./ui-tokens':{themeSurface:()=>{}},'./editor-search':{...search,editorMatches:(...args:Parameters<typeof search.editorMatches>)=>{searches++;return search.editorMatches(...args);},editorMatchLines:(...args:Parameters<typeof search.editorMatchLines>)=>{lineIndexes++;return search.editorMatchLines(...args);}}};
const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/editor-search-view.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>imports[name],module,module.exports);
function fixture(text='cat / cat / cat',selection={start:0,end:0}){
 const state={text,...selection,disabledReason:undefined as string|undefined,reads:0,closed:0,applies:0,onApply:()=>{},history:[] as string[]};
 const host={read:()=>{state.reads++;return{text:state.text,start:state.start,end:state.end,disabledReason:state.disabledReason};},apply:(expected:string,change:NonNullable<ReturnType<typeof search.editorReplacement>>)=>{assert.equal(expected,state.text);state.history.push(state.text);state.applies++;state.text=state.text.slice(0,change.from)+change.text+state.text.slice(change.to);state.onApply();},locate:()=>{}};
 const modal=new module.exports.EditorSearchModal({},host,()=>state.closed++);modal.onOpen();
 const [query,replacement,sensitive,whole,scoped]=modal.contentEl.querySelectorAll('input') as Element[];
 const button=(name:string)=>modal.contentEl.querySelectorAll('button').find((b:Element)=>b.getAttribute('aria-label')===name) as Element;
 const preview=modal.contentEl.querySelector('.ts-editor-search-preview') as Element,error=modal.contentEl.querySelector('.ts-editor-search-error') as Element;
 const input=(value:string,target=query)=>{target.value=value;target.oninput?.();modal.clock.flush();};
 return{modal,state,host,query,replacement,sensitive,whole,scoped,button,preview,error,input,clock:modal.clock as Clock};
}
function key(input:Element,options:Record<string,unknown>={}){const event={key:'Enter',isComposing:false,keyCode:0,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...options};input.onkeydown?.(event);return event;}

test('replacing one match searches the new text and renders its next match exactly once',()=>{
 const {state,input,replacement,button,preview,modal}=fixture();input('cat');input('dog',replacement);button('下一处').click();
 const scanCount=searches,indexCount=lineIndexes,renderCount=preview.emptyCalls;button('替换此处').click();
 assert.equal(state.text,'cat / dog / cat');assert.equal(state.applies,1);assert.deepEqual(modal.matches[modal.active],{from:12,to:15});
 assert.equal(searches-scanCount,1);assert.equal(lineIndexes-indexCount,1);assert.equal(preview.emptyCalls-renderCount,1);
});
test('large-note sequential replacement performs one search and one preview per edit',()=>{
 const {state,input,replacement,button,preview}=fixture('alpha\n'.repeat(9000));input('alpha');input('beta',replacement);
 const scanCount=searches,indexCount=lineIndexes,renderCount=preview.emptyCalls;
 for(let i=0;i<12;i++)button('替换此处').click();
 assert.equal(state.applies,12);assert.equal(searches-scanCount,12);assert.equal(lineIndexes-indexCount,12);assert.equal(preview.emptyCalls-renderCount,12);
 assert.equal(state.text,'beta\n'.repeat(12)+'alpha\n'.repeat(8988));
});
test('navigation replacement previews and unchanged refreshes reuse the exact search snapshot',()=>{
 const {input,replacement,button}=fixture();input('cat');const before=searches;
 for(let i=0;i<5;i++){button('下一处').click();button('上一处').click();input('dog'+i,replacement);}button('刷新内容').click();
 assert.equal(searches,before);
});
test('unchanged replacement does not rescan or create an undo transaction',()=>{
 const {state,input,replacement,button,modal}=fixture();input('cat');input('cat',replacement);const before=searches;button('替换此处').click();assert.equal(searches,before);assert.equal(state.applies,0);assert.equal(modal.active,1);
});
test('replacement containing the query skips its inserted match before wrapping',()=>{
 const {state,input,replacement,button,modal}=fixture('cat / cat');input('cat');input('cat!',replacement);button('替换此处').click();assert.equal(state.text,'cat! / cat');assert.deepEqual(modal.matches[modal.active],{from:7,to:10});button('替换此处').click();assert.equal(state.text,'cat! / cat!');assert.equal(modal.active,0);
});
test('replace all remains one native transaction and invalidates its search index once',()=>{
 const {state,input,replacement,button,preview}=fixture();input('cat');input('dog',replacement);const before=searches,renders=preview.emptyCalls;button('全部替换').click();assert.equal(state.text,'dog / dog / dog');assert.equal(state.applies,1);assert.deepEqual(state.history,['cat / cat / cat']);assert.equal(searches-before,1);assert.equal(preview.emptyCalls-renders,1);
});
test('same-length external edits invalidate cached replacements until explicit refresh',()=>{
 const {state,input,replacement,button,error}=fixture();input('cat');input('dog',replacement);state.text='bat / cat / cat';const before=searches;button('全部替换').click();assert.equal(state.applies,0);assert.equal(searches,before);assert.match(error.textContent,/编辑内容已变化/);button('刷新内容').click();assert.equal(searches,before+1);button('全部替换').click();assert.equal(state.text,'bat / dog / dog');
});
test('file switching disables replacement before any cached offsets reach the host',()=>{
 const {state,input,replacement,button,error}=fixture();input('cat');input('dog',replacement);state.disabledReason='编辑器已关闭或切换';button('替换此处').click();assert.equal(state.applies,0);assert.match(error.textContent,/已关闭或切换/);
});
test('case word and selected-range changes invalidate the search snapshot',()=>{
 const {input,sensitive,whole,scoped,modal}=fixture('Cat cat cats cat',{start:0,end:7});input('cat');const before=searches;
 sensitive.checked=true;sensitive.onchange?.();assert.equal(modal.matches.length,3);
 whole.checked=true;whole.onchange?.();assert.equal(modal.matches.length,2);
 scoped.checked=true;scoped.onchange?.();assert.deepEqual(modal.matches,[{from:4,to:7}]);assert.equal(searches-before,3);
});
test('scoped replacement updates range offsets and never changes an outside match',()=>{
 const {state,input,replacement,scoped,button,modal}=fixture('cat\ncat\ncat',{start:4,end:7});input('cat');scoped.checked=true;scoped.onchange?.();input('catapult',replacement);button('替换此处').click();assert.equal(state.text,'cat\ncatapult\ncat');assert.deepEqual(modal.selectedRange,{from:4,to:12});assert.deepEqual(modal.matches,[{from:4,to:7}]);
});
test('rapid query input stays coalesced and Enter flushes the latest query safely',()=>{
 const {query,clock,modal}=fixture('cat / dog');const before=searches;query.value='ca';query.oninput?.();query.value='dog';query.oninput?.();assert.equal(searches,before);assert.equal(clock.pending.size,1);assert.equal(key(query).defaultPrevented,true);assert.equal(searches,before+1);assert.deepEqual(modal.matches,[{from:6,to:9}]);assert.equal(clock.pending.size,0);
});
test('Chinese composition disables replacement and ignores confirmation Enter until committed',()=>{
 const {state,input,query,replacement,button,clock}=fixture('中文 中文');input('中文');input('文字',replacement);query.emit('compositionstart');const before=searches;query.value='中';query.oninput?.();assert.equal(key(query,{isComposing:true}).defaultPrevented,false);assert.equal(key(query,{keyCode:229}).defaultPrevented,false);button('全部替换').click();clock.flush();assert.equal(searches,before);assert.equal(state.applies,0);query.value='中文';query.emit('compositionend');clock.flush();button('全部替换').click();assert.equal(state.text,'文字 文字');
});
test('closing from a synchronous native transaction releases the snapshot without restoring focus',()=>{
 const {state,input,replacement,query,button,modal,preview}=fixture();input('cat');input('dog',replacement);state.onApply=()=>modal.close();const focus=query.focusCalls,renders=preview.emptyCalls;button('替换此处').click();assert.equal(state.applies,1);assert.equal(state.closed,1);assert.equal(query.focusCalls,focus);assert.equal(preview.emptyCalls,renders);assert.equal(modal.expected,'');assert.equal(modal.matchSnapshot,undefined);assert.deepEqual(modal.matches,[]);
});
test('closed search never reads a disposed editor and pending updates remain cancelled',()=>{
 const {modal,host,query,clock,input,button,state}=fixture();input('cat');const replace=button('替换此处');query.value='dog';query.oninput?.();modal.close();host.read=()=>{throw Error('disposed editor read');};clock.flush();replace.click();assert.throws(()=>modal.validate(),/查找窗口已关闭/);assert.equal(state.applies,0);assert.equal(clock.pending.size,0);assert.equal(modal.contentEl.children.length,0);
});
test('a failed host transaction retains the current index and allows a safe retry',()=>{
 const {modal,host,state,input,replacement,button,error}=fixture();input('cat');input('dog',replacement);const apply=host.apply;host.apply=()=>{throw Error('请重试');};const before=searches;button('替换此处').click();assert.equal(state.applies,0);assert.equal(searches,before);assert.match(error.textContent,/请重试/);assert.equal(modal.busy,false);host.apply=apply;button('替换此处').click();assert.equal(state.text,'dog / cat / cat');assert.equal(state.applies,1);
});
