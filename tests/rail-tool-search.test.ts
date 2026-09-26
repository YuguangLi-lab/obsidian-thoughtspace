import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {installToolPalettes} from '../src/tool-palette';

type Listener={run:(event:any)=>void;capture:boolean};
class Element{
 children:Element[]=[];parentElement:Element|null=null;attributes=new Map<string,string>();listeners=new Map<string,Listener[]>();
 className='';title='';hidden=false;disabled=false;value='';textContent='';private top=0;scrollHeight=900;clientHeight=300;clicks=0;focuses:unknown[]=[];scrolls:unknown[]=[];
 constructor(public ownerDocument:{activeElement:Element|null},public tagName='DIV'){}
 createEl(tag:string,options:any={}):Element{const element:Element=tag==='button'?new Button(this.ownerDocument):new Element(this.ownerDocument,tag.toUpperCase());element.className=options.cls||'';element.textContent=options.text||'';for(const[key,value]of Object.entries(options.attr||{}))element.setAttribute(key,String(value));this.append(element);return element;}
 createDiv(options:any={}):Element{return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 createSpan(options:any={}):Element{return this.createEl('span',options);}
 setAttribute(key:string,value:string){this.attributes.set(key,value);if(key==='title')this.title=value;}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 append(element:Element){element.remove();element.parentElement=this;this.children.push(element);}
 insertBefore(element:Element,before:Element){element.remove();element.parentElement=this;this.children.splice(this.children.indexOf(before),0,element);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(element=>element!==this);this.parentElement=null;}
 contains(element:Element|null):boolean{return !!element&&(element===this||this.children.some(child=>child.contains(element)));}
 matches(selector:string){if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1));return this.tagName==='BUTTON'&&selector.startsWith('button')&&(!selector.includes(':disabled')||!this.disabled);}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 closest(selector:string):Element|null{for(let element:Element|null=this;element;element=element.parentElement)if(element.matches(selector))return element;return null;}
 setText(text:string){this.textContent=text;}
 getClientRects(){for(let element:Element|null=this;element;element=element.parentElement)if(element.hidden)return[];return[{}];}
 get offsetWidth(){return this.getClientRects().length?28:0;}
 getBoundingClientRect(){return{left:0,top:0,right:0,bottom:0,width:0,height:0};}
 get scrollTop(){return this.top;}set scrollTop(value:number){this.top=Math.max(0,Math.min(this.scrollHeight-this.clientHeight,value));}
 focus(options?:unknown){this.focuses.push(options);this.ownerDocument.activeElement=this;}
 scrollIntoView(options:unknown){this.scrolls.push(options);}
 addEventListener(type:string,run:(event:any)=>void,options?:boolean|{capture?:boolean}){const list=this.listeners.get(type)||[];list.push({run,capture:typeof options==='boolean'?options:!!options?.capture});this.listeners.set(type,list);}
 removeEventListener(type:string,run:(event:any)=>void,options?:boolean|{capture?:boolean}){const capture=typeof options==='boolean'?options:!!options?.capture;this.listeners.set(type,(this.listeners.get(type)||[]).filter(listener=>listener.run!==run||listener.capture!==capture));}
 dispatch(type:string,extra:Record<string,unknown>={}){
  const event:any={target:this,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...extra},path:Element[]=[];
  for(let element:Element|null=this;element;element=element.parentElement)path.push(element);
  for(const capture of [true,false])for(const element of capture?[...path].reverse():path){for(const listener of element.listeners.get(type)||[])if(listener.capture===capture)listener.run(event);if(event.stopped)return event;}
  return event;
 }
 click(){if(!this.disabled){this.clicks++;this.dispatch('click');}}
}
class Button extends Element{constructor(doc:{activeElement:Element|null}){super(doc,'BUTTON');}}

function fixture(options:{hiddenGroup?:boolean;integration?:boolean}={}){
 const doc={activeElement:null as Element|null,defaultView:null,getElementById(){return null;},addEventListener(){},removeEventListener(){}},main=new Element(doc),panel=main.createDiv(),tools=panel.createDiv('ts-rail-actions'),rail=main.createDiv();let closed=0;let palettes:ReturnType<typeof installToolPalettes>|undefined;
 const group=(label:string)=>tools.createDiv({cls:'ts-tool-cluster',attr:{'aria-label':label}});
 const organize=group('组织内容'),mindmap=group('思维导图工具'),workspace=group('白板与历史');
 const button=(parent:Element,label:string,title=label)=>parent.createEl('button',{attr:{'aria-label':label,title}});
 const overview=button(organize,'分组总览','查看所有分组'),move=button(organize,'移入已有分组'),topic=button(mindmap,'子主题 · Tab'),pdf=button(workspace,'插入 PDF 卡片','从本地文件插入'),read=button(workspace,'阅读 PDF'),hidden=button(workspace,'隐藏 PDF 工具');hidden.hidden=true;
 if(options.hiddenGroup)mindmap.hidden=true;
 const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/rail-tool-search.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>name==='obsidian'?{setIcon:()=>{}}:{},module,module.exports);
 const binding=module.exports.installRailToolSearch(panel,tools),header=panel.children.find(child=>child.className==='ts-rail-search')!,field=header.children[0],input=field.children.find(child=>child.tagName==='INPUT')!,clear=field.children.find(child=>child.tagName==='BUTTON')!,status=header.children[1],empty=panel.children.find(child=>child.className==='ts-rail-empty')!;
 if(options.integration){
  const trigger=rail.createEl('button');let hidden=panel.hidden;
  Object.defineProperty(panel,'hidden',{get:()=>hidden,set:(value:boolean)=>{if(value&&!hidden)closed++;hidden=value;}});
  palettes=installToolPalettes(main as unknown as HTMLElement,rail as unknown as HTMLElement,[{panel:panel as unknown as HTMLElement,trigger:trigger as unknown as HTMLElement,actions:tools as unknown as HTMLElement,onOpen:binding.open}]);
  closed=0;palettes.open(panel as unknown as HTMLElement);
  const dispose=binding.dispose;binding.dispose=()=>{palettes?.dispose();dispose();};
 }
 const search=(value:string)=>{input.value=value;input.dispatch('input');};
 const key=(target:Element,key:string,extra:Record<string,unknown>={})=>target.dispatch('keydown',{key,...extra});
 return{doc,panel,tools,open:()=>palettes?.open(panel as unknown as HTMLElement),organize,mindmap,workspace,overview,move,topic,pdf,read,hidden,input,clear,status,empty,binding,search,key,closed:()=>closed,install:()=>module.exports.installRailToolSearch(panel,tools),recent:()=>tools.querySelectorAll('.ts-rail-recent-button'),recentGroup:()=>tools.querySelectorAll('.ts-rail-recent')[0],visible:()=>tools.querySelectorAll('button').filter(element=>element.getClientRects().length>0)};
}

test('search normalizes full-width text and combines tokens across tool title and group name',()=>{
 const f=fixture();f.search(' ＰＤＦ ');assert.deepEqual(f.visible(),[f.pdf,f.read]);assert.match(f.status.textContent,/2 项工具/);assert.equal(f.organize.hidden,true);
 f.search('pdf 卡片');assert.deepEqual(f.visible(),[f.pdf]);f.search('本地');assert.deepEqual(f.visible(),[f.pdf]);
 f.search('组织内容 分组');assert.deepEqual(f.visible(),[f.overview,f.move]);assert.equal(f.tools.querySelectorAll('button').length,6,'existing action nodes remain in place');f.binding.dispose();
});
test('clear, nonempty Escape and reopening restore all eligible actions and keep search focus',()=>{
 const f=fixture({integration:true});f.search('pdf');f.tools.scrollTop=90;f.clear.click();assert.equal(f.input.value,'');assert.equal(f.doc.activeElement,f.input);assert.equal(f.tools.scrollTop,0);assert.equal(f.clear.hidden,true);assert.equal(f.hidden.hidden,true);
 f.search('missing');assert.equal(f.empty.hidden,false);const first=f.key(f.input,'Escape');assert.equal(first.defaultPrevented,true);assert.equal(f.closed(),0);assert.equal(f.input.value,'');assert.equal(f.empty.hidden,true);
 f.key(f.input,'Escape');assert.equal(f.closed(),1);f.open();f.search('pdf');f.binding.open();assert.equal(f.input.value,'');assert.equal(f.doc.activeElement,f.input);assert.equal(f.visible().length,5);f.binding.dispose();
});
test('Enter executes only the first enabled matching action and ignores repeated keys',()=>{
 const f=fixture();f.pdf.disabled=true;f.search('pdf');f.key(f.input,'Enter');assert.equal(f.pdf.clicks,0);assert.equal(f.read.clicks,1);assert.equal(f.hidden.clicks,0);
 f.key(f.input,'Enter',{repeat:true});assert.equal(f.read.clicks,1);f.search('not-found');f.key(f.input,'Enter');assert.equal(f.read.clicks,1);
 f.search('pdf 卡片');f.key(f.input,'Enter');assert.equal(f.pdf.clicks,0);f.binding.dispose();
});
test('IME retains current results until composition ends and cannot execute an action while composing',()=>{
 const f=fixture();f.input.dispatch('compositionstart');f.search('pdf');assert.equal(f.visible().length,5);assert.equal(f.key(f.input,'Enter').defaultPrevented,false);assert.equal(f.overview.clicks,0);
 f.input.dispatch('compositionend');assert.deepEqual(f.visible(),[f.pdf,f.read]);f.key(f.input,'Enter',{isComposing:true});assert.equal(f.pdf.clicks,0);f.key(f.input,'Enter');assert.equal(f.pdf.clicks,1);f.binding.dispose();
});
test('legacy IME key events never execute or move focus to a tool',()=>{
 const f=fixture();f.search('pdf');f.key(f.input,'Enter',{keyCode:229});f.key(f.input,'ArrowDown',{keyCode:229});assert.equal(f.pdf.clicks,0);assert.equal(f.pdf.focuses.length,0);f.binding.dispose();
});
test('IME Escape and modified tool arrows keep their native behavior in the actual panel integration',()=>{
 const f=fixture({integration:true});
 for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}]){
  assert.equal(f.key(f.input,'Escape',extra).defaultPrevented,false);assert.equal(f.key(f.overview,'ArrowDown',extra).defaultPrevented,false);
 }
 assert.equal(f.closed(),0);assert.equal(f.move.focuses.length,0);f.binding.dispose();
});
test('search arrows enter reachable results and reveal the last result; Up from first returns to search',()=>{
 const f=fixture();f.search('pdf');f.key(f.input,'ArrowUp');assert.equal(f.doc.activeElement,f.read);assert.equal(f.tools.scrollTop,f.tools.scrollHeight-f.tools.clientHeight);
 f.key(f.input,'ArrowDown');assert.equal(f.doc.activeElement,f.pdf);assert.equal(f.tools.scrollTop,0);f.key(f.pdf,'ArrowUp');assert.equal(f.doc.activeElement,f.input);f.binding.dispose();
});
test('hidden original clusters never count as matches or leave a false nonempty result state',()=>{
 const f=fixture({hiddenGroup:true});f.search('子主题');assert.deepEqual(f.visible(),[]);assert.match(f.status.textContent,/0 项工具/);assert.equal(f.empty.hidden,false);f.key(f.input,'Enter');assert.equal(f.topic.clicks,0);f.binding.dispose();assert.equal(f.mindmap.hidden,true);
});
test('disposing removes search surfaces and listeners and restores original hidden states',()=>{
 const f=fixture({hiddenGroup:true});f.search('pdf');f.binding.dispose();f.binding.dispose();assert.equal(f.panel.children.length,1);assert.equal(f.organize.hidden,false);assert.equal(f.mindmap.hidden,true);assert.equal(f.hidden.hidden,true);assert.equal(f.topic.hidden,false);
 f.input.value='分组';f.input.dispatch('input');f.key(f.input,'Enter');f.clear.click();f.binding.open();assert.equal(f.input.value,'分组');assert.equal(f.pdf.hidden,false);assert.equal(f.overview.clicks,0);
 for(const element of [f.input,f.clear,f.panel,f.tools])for(const listeners of element.listeners.values())assert.equal(listeners.length,0);
});

test('recent actions keep three distinct latest tools without moving the original buttons',()=>{
 const f=fixture(),originals=f.tools.querySelectorAll('button');assert.equal(f.recentGroup().hidden,true);
 f.overview.click();f.move.click();f.topic.click();f.pdf.createSpan().click();
 assert.deepEqual(f.recent().map(button=>button.getAttribute('aria-label')),['插入 PDF 卡片','子主题 · Tab','移入已有分组']);
 f.topic.click();assert.deepEqual(f.recent().map(button=>button.getAttribute('aria-label')),['子主题 · Tab','插入 PDF 卡片','移入已有分组']);
 assert.deepEqual(f.tools.querySelectorAll('button').filter(button=>!button.matches('.ts-rail-recent-button')),originals);f.binding.dispose();
});
test('search hides recent shortcuts and counts each original result only once',()=>{
 const f=fixture();f.pdf.click();f.read.click();assert.equal(f.recent().length,2);
 f.search('pdf');assert.equal(f.recentGroup().hidden,true);assert.deepEqual(f.visible(),[f.pdf,f.read]);assert.match(f.status.textContent,/^2 项工具/);
 f.search('not found');assert.equal(f.empty.hidden,false);f.clear.click();assert.equal(f.recentGroup().hidden,false);assert.equal(f.recent().length,2);assert.equal(f.empty.hidden,true);f.binding.dispose();
});
test('recent shortcuts execute the current original handler once and follow the existing panel close flow',()=>{
 const f=fixture({integration:true});let actions=0;f.pdf.addEventListener('click',()=>actions++);f.pdf.click();assert.equal(f.closed(),1);
 f.open();f.recent()[0].children[1].click();assert.equal(actions,2);assert.equal(f.pdf.clicks,2);assert.equal(f.closed(),2);assert.equal(f.recent().length,1);
 f.open();f.key(f.input,'Enter');assert.equal(actions,3);assert.equal(f.closed(),3);f.key(f.input,'Enter',{repeat:true});assert.equal(actions,3);f.binding.dispose();
});
test('recent buttons join the existing keyboard order and Up from the first returns to search',()=>{
 const f=fixture({integration:true});f.pdf.click();f.open();f.topic.click();f.open();const recent=f.recent();
 f.key(f.input,'ArrowDown');assert.equal(f.doc.activeElement,recent[0]);f.key(recent[0],'ArrowDown');assert.equal(f.doc.activeElement,recent[1]);
 f.key(recent[1],'ArrowDown');assert.equal(f.doc.activeElement,f.overview);f.key(f.overview,'ArrowUp');assert.equal(f.doc.activeElement,recent[1]);
 f.key(recent[0],'ArrowUp');assert.equal(f.doc.activeElement,f.input);f.key(f.input,'ArrowUp');assert.equal(f.doc.activeElement,f.read);f.binding.dispose();
});
test('recent shortcuts refresh labels and toggle state from originals when reopening',()=>{
 const f=fixture();f.pdf.click();f.pdf.className='ts-button is-active';f.pdf.setAttribute('aria-label','当前 PDF');f.pdf.setAttribute('title','当前工具提示');f.pdf.setAttribute('aria-pressed','true');f.binding.open();
 const recent=f.recent()[0];assert.equal(recent.getAttribute('aria-label'),'当前 PDF');assert.equal(recent.title,'当前工具提示');assert.equal(recent.getAttribute('aria-pressed'),'true');assert.ok(recent.matches('.is-active'));f.binding.dispose();
});
test('hidden, disabled and removed originals cannot remain executable recent actions',()=>{
 const f=fixture();f.pdf.click();f.topic.click();f.move.click();const stale=f.recent()[0];f.move.disabled=true;stale.click();assert.equal(f.move.clicks,1);assert.equal(f.recent().length,2);
 f.pdf.hidden=true;f.mindmap.hidden=true;f.binding.open();assert.equal(f.pdf.hidden,true);assert.equal(f.mindmap.hidden,true);assert.equal(f.recentGroup().hidden,true);
 f.move.disabled=false;f.move.remove();f.binding.open();stale.click();assert.equal(f.move.clicks,1);assert.equal(f.recent().length,0);f.binding.dispose();assert.equal(f.pdf.hidden,true);assert.equal(f.mindmap.hidden,true);
});
test('installing twice shares one binding and disposing clears only its panel-local recent history',()=>{
 const f=fixture();f.pdf.click();const again=f.install();assert.equal(again,f.binding);assert.equal(f.panel.querySelectorAll('.ts-rail-search').length,1);assert.equal(f.tools.querySelectorAll('.ts-rail-recent').length,1);assert.equal(f.tools.listeners.get('click')?.length,1);
 f.binding.dispose();const next=f.install();assert.notEqual(next,f.binding);assert.equal(f.recentGroup().hidden,true);assert.equal(f.recent().length,0);next.dispose();
});
