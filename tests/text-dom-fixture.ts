/** Minimal tree/event surface for native-renderer ownership tests (not a Markdown parser). */
export class TextElement {
 nodeType=1;tagName:string;className='';dataset:Record<string,string>={};attributes:Record<string,string>={};children:TextElement[]=[];parentElement?:TextElement;removed=false;isConnected=true;disabled=false;complete=false;title='';ownText='';listeners=new Map<string,Set<(...args:any[])=>void>>();
 style:any={setProperty(key:string,value:string){this[key]=value;}};
 classList={add:(...names:string[])=>{this.className=[this.className,...names].join(' ').trim();},contains:(name:string)=>this.className.split(/\s+/).includes(name)};
 constructor(public ownerDocument:TextDocument,tag='div'){this.tagName=tag.toUpperCase();}
 get textContent(){return this.ownText+this.children.map(c=>c.textContent).join('');}set textContent(value:string){this.children=[];this.ownText=value;}
 get childNodes(){return this.children;}get lastElementChild(){return[...this.children].reverse().find(c=>c.nodeType===1);}
 get previousSibling(){const siblings=this.parentElement?.children||[];return siblings[siblings.indexOf(this)-1];}
 appendChild(child:TextElement){child.remove();child.removed=false;child.parentElement=this;this.children.push(child);return child;}
 replaceChildren(...children:TextElement[]){this.children.forEach(c=>c.parentElement=undefined);this.children=[];this.ownText='';children.forEach(c=>this.appendChild(c));}
 replaceWith(next:TextElement){if(!this.parentElement)return;const parent=this.parentElement,index=parent.children.indexOf(this);this.parentElement=undefined;next.remove();parent.children[index]=next;next.parentElement=parent;}
 remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=undefined;}this.removed=true;}
 setAttribute(key:string,value:string){this.attributes[key]=value;}getAttribute(key:string){return this.attributes[key]??null;}removeAttribute(key:string){delete this.attributes[key];}
 matches(selector:string){if(selector==='[id]')return'id'in this.attributes;if(selector==='a[href]')return this.tagName==='A'&&'href'in this.attributes;if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));return this.tagName===selector.toUpperCase();}
 querySelectorAll<T=TextElement>(selector:string):T[]{const direct=selector.startsWith(':scope > '),sel=selector.replace(':scope > ','');const visit=(node:TextElement):TextElement[]=>node.children.flatMap(c=>[...(c.matches(sel)?[c]:[]),...(!direct?visit(c):[])]);return visit(this) as T[];}
 querySelector<T=TextElement>(selector:string):T|null{return this.querySelectorAll<T>(selector)[0]||null;}
 cloneNode(deep=false):TextElement{const copy=new TextElement(this.ownerDocument,this.tagName);copy.className=this.className;copy.ownText=this.ownText;copy.nodeType=this.nodeType;copy.attributes={...this.attributes};copy.dataset={...this.dataset};Object.assign(copy.style,this.style);if(deep)this.children.forEach(c=>copy.appendChild(c.cloneNode(true)));return copy;}
 addEventListener(event:string,fn:(...args:any[])=>void){const items=this.listeners.get(event)||new Set();items.add(fn);this.listeners.set(event,items);}removeEventListener(event:string,fn:(...args:any[])=>void){this.listeners.get(event)?.delete(fn);}
 dispatch(event:string,data:any={}){for(const fn of this.listeners.get(event)||[])fn(data);}
 getBoundingClientRect(){return this.ownerDocument.measure(this);}
}
export class TextDocument {
 elements:TextElement[]=[];body=new TextElement(this);opened:string[]=[];fonts:any;
 computed:any={fontFamily:'Body Font',length:1,0:'--font-text',getPropertyValue:(key:string)=>key==='--font-text'?'Custom Body Font':''};
 defaultView={open:(href:string)=>this.opened.push(href),getComputedStyle:(_:unknown)=>this.computed,createDiv:()=>this.createElement('div'),createSpan:()=>this.createElement('span'),setTimeout:(_callback:()=>void,_time:number)=>0,clearTimeout:(_id:number)=>{}};
 get win(){return this.defaultView;}
 measure=(element:TextElement)=>({width:element.style.width==='200px'?200:344,height:180});
 createElement(tag:string){const element=new TextElement(this,tag);this.elements.push(element);return element;}
 createTextNode(text:string){const element=this.createElement('#text');element.nodeType=3;element.ownText=text;return element;}
}
