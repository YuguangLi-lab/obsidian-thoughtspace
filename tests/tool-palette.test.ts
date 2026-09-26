import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installToolPalettes,focusToolSection} from '../src/tool-palette';

type Listener={run:(event:any)=>void;capture:boolean};
class Surface{
 listeners=new Map<string,Listener[]>();
 addEventListener(type:string,run:(event:any)=>void,capture=false){this.listeners.set(type,[...(this.listeners.get(type)||[]),{run,capture}]);}
 removeEventListener(type:string,run:(event:any)=>void,capture=false){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item.run!==run||item.capture!==capture));}
}
class Doc extends Surface{
 elements:Element[]=[];getElementById(id:string){return this.elements.find(element=>element.getAttribute('id')===id)||null;}
 activeElement:Element|null=null;timers=new Map<number,()=>void>();sequence=0;
 defaultView={setTimeout:(run:()=>void)=>{const id=++this.sequence;this.timers.set(id,run);return id;},clearTimeout:(id:number)=>{this.timers.delete(id);}};
 flush(){for(const [id,run]of [...this.timers]){this.timers.delete(id);run();}}
}
class Element extends Surface{
 children:Element[]=[];parentElement:Element|null=null;hidden=false;disabled=false;isContentEditable=false;attributes=new Map<string,string>();focuses:unknown[]=[];scrollTop=0;scrollLeft=0;scrollHeight=100;scrollWidth=100;clientHeight=100;clientWidth=100;offsetHeight=100;offsetWidth=100;clientLeft=0;clientTop=0;
 rect={left:0,top:0,width:0,height:0};
 constructor(public ownerDocument:Doc,public tagName='DIV'){super();ownerDocument.elements.push(this);}
 append(element:Element){element.parentElement=this;this.children.push(element);return element;}
 contains(element:Element|null):boolean{return !!element&&(element===this||this.children.some(child=>child.contains(element)));}
 getAttribute(name:string){return this.attributes.get(name)??null;}
 setAttribute(name:string,value:string){this.attributes.set(name,value);}
 closest(selector:string):Element|null{for(let element:Element|null=this;element;element=element.parentElement)if(selector==='button'&&element.tagName==='BUTTON')return element;return null;}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(child=>[...(selector.startsWith('button')&&child.tagName==='BUTTON'?[child]:[]),...child.querySelectorAll(selector)]);}
 getClientRects(){for(let element:Element|null=this;element;element=element.parentElement)if(element.hidden)return[];return[{}];}
 getBoundingClientRect(){return{...this.rect,right:this.rect.left+this.rect.width,bottom:this.rect.top+this.rect.height};}
 focus(options?:unknown){this.focuses.push(options);this.ownerDocument.activeElement=this;}
 dispatch(type:string,extra:Record<string,unknown>={}){
  const event:any={target:this,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...extra};const path:Surface[]=[];
  for(let element:Element|null=this;element;element=element.parentElement)path.push(element);path.push(this.ownerDocument);
  for(const capture of [true,false])for(const element of capture?[...path].reverse():path){for(const listener of element.listeners.get(type)||[])if(listener.capture===capture)listener.run(event);if(event.stopped)return event;}return event;
 }
 click(){if(!this.disabled)this.dispatch('click');}
}
const html=(element:Element)=>element as unknown as HTMLElement;
function fixture(){
 const doc=new Doc(),main=new Element(doc),rail=main.append(new Element(doc)),triggerA=rail.append(new Element(doc,'BUTTON')),railAction=rail.append(new Element(doc,'BUTTON')),triggerB=rail.append(new Element(doc,'BUTTON'));
 const panelA=main.append(new Element(doc)),panelB=main.append(new Element(doc)),actionsA=panelA.append(new Element(doc)),actionsB=panelB.append(new Element(doc)),input=panelB.append(new Element(doc,'INPUT')),headerButton=panelA.append(new Element(doc,'BUTTON'));
 const buttons=Array.from({length:4},(_,i)=>{const button=actionsA.append(new Element(doc,'BUTTON'));button.rect={left:20+(i%2)*50,top:30+Math.floor(i/2)*50,width:40,height:40};return button;});
 const other=actionsB.append(new Element(doc,'BUTTON')),editor=main.append(new Element(doc,'TEXTAREA')),external=new Element(doc,'INPUT');let opens=0;
 const binding=installToolPalettes(html(main),html(rail),[{panel:html(panelA),trigger:html(triggerA),actions:html(actionsA)},{panel:html(panelB),trigger:html(triggerB),actions:html(actionsB),onOpen:()=>{opens++;input.focus();}}]);
 const key=(target:Element,key:string,extra:Record<string,unknown>={})=>target.dispatch('keydown',{key,...extra});
 return{doc,main,rail,triggerA,railAction,triggerB,panelA,panelB,actionsA,actionsB,input,headerButton,buttons,other,editor,external,binding,key,opens:()=>opens};
}

test('trigger toggles one panel at a time and synchronizes disclosure state',()=>{
 const f=fixture();assert.equal(f.panelA.hidden,true);assert.equal(f.panelB.hidden,true);f.triggerA.click();assert.equal(f.panelA.hidden,false);assert.equal(f.triggerA.getAttribute('aria-expanded'),'true');assert.equal(f.doc.activeElement,f.buttons[0]);
 f.triggerB.click();assert.equal(f.panelA.hidden,true);assert.equal(f.triggerA.getAttribute('aria-expanded'),'false');assert.equal(f.panelB.hidden,false);assert.equal(f.doc.activeElement,f.input);assert.equal(f.opens(),1);
 f.triggerB.click();assert.equal(f.panelB.hidden,true);assert.equal(f.triggerB.getAttribute('aria-expanded'),'false');f.binding.dispose();
});
test('reopening a scrolled insert palette resets its viewport before focusing the first action',()=>{
 const f=fixture();f.actionsA.rect={left:10,top:20,width:100,height:80};f.actionsA.clientHeight=80;f.actionsA.offsetHeight=80;f.actionsA.scrollHeight=300;
 f.triggerA.click();f.actionsA.scrollTop=220;f.buttons[3].focus();f.key(f.buttons[3],'Escape');assert.equal(f.doc.activeElement,f.triggerA);
 f.triggerA.click();assert.equal(f.actionsA.scrollTop,0);assert.equal(f.doc.activeElement,f.buttons[0]);assert.deepEqual(f.buttons[0].focuses.at(-1),{preventScroll:true});f.binding.dispose();
});
test('disclosures identify their own dialog with distinct controls IDs',()=>{
 const f=fixture();assert.equal(f.triggerA.getAttribute('aria-haspopup'),'dialog');assert.equal(f.triggerB.getAttribute('aria-haspopup'),'dialog');const idA=f.panelA.getAttribute('id'),idB=f.panelB.getAttribute('id');assert.ok(idA);assert.ok(idB);assert.notEqual(idA,idB);assert.equal(f.triggerA.getAttribute('aria-controls'),idA);assert.equal(f.triggerB.getAttribute('aria-controls'),idB);f.binding.dispose();
});
test('Escape closes only the active palette and restores its trigger without scrolling',()=>{
 const f=fixture();f.triggerA.click();const event=f.key(f.buttons[1],'Escape');assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.equal(f.panelA.hidden,true);assert.equal(f.doc.activeElement,f.triggerA);assert.deepEqual(f.triggerA.focuses.at(-1),{preventScroll:true});
 assert.equal(f.key(f.railAction,'Escape').defaultPrevented,false);f.binding.dispose();
});
test('outside pointer closes across workspace panes without taking editor focus',()=>{
 const f=fixture();f.triggerA.click();f.editor.focus();const event=f.editor.dispatch('pointerdown');assert.equal(f.panelA.hidden,true);assert.equal(f.doc.activeElement,f.editor);assert.equal(event.defaultPrevented,false);
 f.triggerB.click();f.external.focus();f.external.dispatch('pointerdown');assert.equal(f.panelB.hidden,true);assert.equal(f.doc.activeElement,f.external);f.binding.dispose();
});
test('inside clicks retain the panel, other rail tools dismiss it, and nested trigger icons toggle once',()=>{
 const f=fixture();const icon=f.triggerA.append(new Element(f.doc,'SPAN'));icon.dispatch('pointerdown');icon.click();assert.equal(f.panelA.hidden,false);
 f.headerButton.dispatch('pointerdown');f.headerButton.click();assert.equal(f.panelA.hidden,false);f.railAction.dispatch('pointerdown');assert.equal(f.panelA.hidden,true);assert.equal(f.triggerA.focuses.length,0);f.binding.dispose();
});
test('action activation closes after execution without stealing focus from the new editor',()=>{
 const f=fixture();let activations=0;f.buttons[0].addEventListener('click',()=>{activations++;f.editor.focus();});f.triggerA.click();f.buttons[0].append(new Element(f.doc,'SPAN')).click();assert.equal(activations,1);assert.equal(f.panelA.hidden,true);assert.equal(f.doc.activeElement,f.editor);assert.equal(f.triggerA.focuses.length,0);f.binding.dispose();
});
test('an action opening the other palette does not close the new palette',()=>{
 const f=fixture();f.buttons[0].addEventListener('click',()=>f.binding.open(html(f.panelB)));f.triggerA.click();f.buttons[0].click();assert.equal(f.panelA.hidden,true);assert.equal(f.panelB.hidden,false);assert.equal(f.doc.activeElement,f.input);f.binding.dispose();
});
test('geometric grid arrows choose neighboring rows and columns, with Home and End boundaries',()=>{
 const f=fixture();f.triggerA.click();const [a,b,c,d]=f.buttons;f.key(a,'ArrowDown');assert.equal(f.doc.activeElement,c);f.key(c,'ArrowRight');assert.equal(f.doc.activeElement,d);f.key(d,'ArrowUp');assert.equal(f.doc.activeElement,b);f.key(b,'ArrowLeft');assert.equal(f.doc.activeElement,a);
 f.key(a,'End');assert.equal(f.doc.activeElement,d);f.key(d,'Home');assert.equal(f.doc.activeElement,a);assert.deepEqual(a.focuses.at(-1),{preventScroll:true});f.binding.dispose();
});
test('DOM order fallback wraps and skips hidden, disabled and aria-disabled controls',()=>{
 const f=fixture();f.buttons.forEach(button=>button.rect={left:0,top:0,width:0,height:0});f.buttons[1].hidden=true;f.buttons[2].disabled=true;f.triggerA.click();f.key(f.buttons[0],'ArrowDown');assert.equal(f.doc.activeElement,f.buttons[3]);f.key(f.buttons[3],'ArrowRight');assert.equal(f.doc.activeElement,f.buttons[0]);
 f.buttons[3].setAttribute('aria-disabled','true');f.key(f.buttons[0],'End');assert.equal(f.doc.activeElement,f.buttons[0]);f.key(f.triggerB,'ArrowUp');assert.equal(f.doc.activeElement,f.railAction);f.binding.dispose();
});
test('native inputs, guarded events and unmodified typing never run palette navigation',()=>{
 const f=fixture();f.triggerB.click();for(const key of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End']){assert.equal(f.key(f.input,key).defaultPrevented,false);assert.equal(f.doc.activeElement,f.input);}
 for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{defaultPrevented:true}]){f.key(f.other,'ArrowDown',extra);f.key(f.input,'Escape',extra);assert.equal(f.panelB.hidden,false);assert.equal(f.doc.activeElement,f.input);}
 f.binding.close();f.editor.focus();f.key(f.editor,'Escape');assert.equal(f.doc.activeElement,f.editor);f.binding.dispose();
});
test('search capture can consume first Escape, then an empty search closes normally',()=>{
 const f=fixture();let nonempty=true;f.panelB.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&nonempty){nonempty=false;event.preventDefault();event.stopPropagation();}},true);
 f.triggerB.click();f.key(f.input,'Escape');assert.equal(f.panelB.hidden,false);assert.equal(f.doc.activeElement,f.input);f.key(f.input,'Escape');assert.equal(f.panelB.hidden,true);assert.equal(f.doc.activeElement,f.triggerB);f.binding.dispose();
});
test('focusout checks settled focus and keeps transitions within the panel or its trigger',()=>{
 const f=fixture();f.triggerA.click();f.buttons[0].dispatch('focusout');f.buttons[1].focus();f.doc.flush();assert.equal(f.panelA.hidden,false);
 f.buttons[1].dispatch('focusout');f.triggerA.focus();f.doc.flush();assert.equal(f.panelA.hidden,false);
 f.triggerA.dispatch('focusout');f.editor.focus();assert.equal(f.panelA.hidden,false);f.doc.flush();assert.equal(f.panelA.hidden,true);assert.equal(f.doc.activeElement,f.editor);f.binding.dispose();
});
test('switching palettes cancels a pending focusout check from the previous panel',()=>{
 const f=fixture();f.triggerA.click();f.buttons[0].dispatch('focusout');assert.equal(f.doc.timers.size,1);f.triggerB.click();assert.equal(f.doc.timers.size,0);f.doc.flush();assert.equal(f.panelB.hidden,false);assert.equal(f.doc.activeElement,f.input);f.binding.dispose();
});
test('keyboard reveal scrolls only the local actions viewport and never the canvas',()=>{
 const f=fixture();f.actionsA.rect={left:10,top:20,width:100,height:80};f.actionsA.clientHeight=80;f.actionsA.offsetHeight=80;f.actionsA.scrollHeight=300;f.main.scrollTop=42;f.triggerA.click();f.key(f.buttons[0],'End');assert.equal(f.doc.activeElement,f.buttons[3]);assert.equal(f.actionsA.scrollTop,20);assert.equal(f.main.scrollTop,42);f.binding.dispose();
});
test('disposing removes every owned listener, cancels timers and prevents stale operations',()=>{
 const f=fixture();f.triggerA.click();f.buttons[0].dispatch('focusout');f.editor.focus();f.binding.dispose();f.binding.dispose();assert.equal(f.doc.timers.size,0);assert.equal(f.panelA.hidden,true);assert.equal(f.triggerA.getAttribute('aria-expanded'),'false');assert.equal(f.doc.activeElement,f.editor);
 for(const target of [f.doc,f.main,f.rail,f.panelA,f.panelB,f.triggerA,f.triggerB])for(const list of target.listeners.values())assert.equal(list.length,0);
 f.triggerA.click();f.binding.open(html(f.panelB));f.binding.toggle(html(f.panelA));f.binding.close(true);f.doc.flush();assert.equal(f.panelA.hidden,true);assert.equal(f.panelB.hidden,true);assert.equal(f.doc.activeElement,f.editor);
});


test('section shortcuts focus an existing eligible command and scroll only its palette',()=>{
 const f=fixture();f.triggerA.click();const section=f.actionsA.append(new Element(f.doc));const disabled=section.append(new Element(f.doc,'BUTTON'));disabled.disabled=true;const first=section.append(new Element(f.doc,'BUTTON'));
 f.actionsA.rect={left:0,top:100,width:100,height:80};f.actionsA.clientHeight=80;f.actionsA.offsetHeight=80;f.actionsA.scrollHeight=600;f.actionsA.scrollTop=50;section.rect={left:0,top:180,width:100,height:80};first.rect={left:0,top:120,width:40,height:30};
 assert.equal(focusToolSection(html(f.actionsA),html(section)),true);assert.equal(f.doc.activeElement,first);assert.equal(f.actionsA.scrollTop,122);assert.deepEqual(first.focuses.at(-1),{preventScroll:true});assert.equal(f.panelA.hidden,false);assert.equal(f.main.scrollTop,0);assert.equal(disabled.focuses.length,0);f.binding.dispose();
});
test('section shortcuts ignore removed, hidden and empty groups without stealing focus',()=>{
 const f=fixture();f.triggerA.click();const original=f.doc.activeElement,outside=new Element(f.doc),empty=f.actionsA.append(new Element(f.doc));
 assert.equal(focusToolSection(html(f.actionsA),html(outside)),false);assert.equal(focusToolSection(html(f.actionsA),html(empty)),false);empty.append(new Element(f.doc,'BUTTON'));empty.hidden=true;
 assert.equal(focusToolSection(html(f.actionsA),html(empty)),false);assert.equal(f.doc.activeElement,original);f.binding.dispose();
});
