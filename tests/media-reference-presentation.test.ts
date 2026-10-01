import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaReferenceTarget,mountMediaReferencePresentation} from '../src/media-reference-presentation';
import {mediaPlayerUrl} from '../src/media-notes';

test('source label is derived from native embed provenance without changing its block target',()=>{
 const target='资料/课程 & 观察.md#^thoughtspace-media-capture-1';
 assert.deepEqual(mediaReferenceTarget(target),{target,label:'课程 & 观察'});
});
for(const target of ['https://example.com/a#^thoughtspace-media-x','../a#^thoughtspace-media-x','/a#^thoughtspace-media-x','a\\b#^thoughtspace-media-x','a#ordinary','a#^thoughtspace-media-','a\n#^thoughtspace-media-x'])test('ignore nonlocal or unrelated embed '+JSON.stringify(target),()=>{
 assert.equal(mediaReferenceTarget(target),undefined);
});

class Element {
 className='';textContent='';title='';dataset:Record<string,string>={};attrs=new Map<string,string>();children:Element[]=[];parent?:Element;reference=false;
 embeds:Element[]=[];header?:Element;timestamp?:Element;listeners=new Map<string,EventListener>();
 ownerDocument={win:{createEl:()=>new Element()}};
 classList={add:(value:string)=>{if(!this.className.split(' ').includes(value))this.className+=' '+value;}};
 setAttribute(key:string,value:string){this.attrs.set(key,value);}getAttribute(key:string){return this.attrs.get(key)||null;}
 createEl(_tag:string,options:{cls:string}){const child=new Element();child.className=options.cls;this.appendChild(child);return child;}
 appendChild(child:Element){this.children.push(child);child.parent=this;}
 contains(child:Element):boolean{return child===this||this.children.some(n=>n.contains(child));}
 closest(selector:string):Element|undefined{return(selector==='.is-media-reference'?this.reference:this.className.includes('ts-media-reference-source'))?this:this.parent?.closest(selector);}
 querySelectorAll(){return this.embeds;}
 querySelector(selector:string){return selector.includes('markdown-preview-view')?this.header:selector.includes('callout-title-inner')?this.timestamp:this.children.find(n=>n.className.includes('ts-media-reference-source'));}
 addEventListener(name:string,run:EventListener){this.listeners.set(name,run);}removeEventListener(name:string){this.listeners.delete(name);}
}
test('asynchronous refresh keeps one source link, native timestamp identity and scoped event disposal',async()=>{
 const previous=globalThis.MutationObserver,observed:{callback:()=>void;disconnected:boolean}[]=[];
 globalThis.MutationObserver=class {entry:{callback:()=>void;disconnected:boolean};constructor(callback:()=>void){this.entry={callback,disconnected:false};observed.push(this.entry);}observe(){}disconnect(){this.entry.disconnected=true;}} as any;
 try{
  const root=new Element();root.reference=true;const embed=new Element(),header=new Element(),time=new Element();root.appendChild(embed);root.embeds=[embed];embed.appendChild(header);embed.header=header;header.timestamp=time;header.appendChild(time);
  const href=mediaPlayerUrl({vault:'QA',file:'media/fixture.mp4'},1.25);time.setAttribute('href',href);time.textContent='0:01';
  embed.setAttribute('src','资料/记录.md#^thoughtspace-media-1');
  const opened:string[][]=[],disposals:(()=>void)[]=[];
  const app={workspace:{async openLinkText(...args:string[]){opened.push(args);}}};
  mountMediaReferencePresentation(root as any,app as any,'qa.thoughtspace',dispose=>disposals.push(dispose));
  const source=header.children.find(n=>n.className.includes('ts-media-reference-source'))!;assert.ok(source);
  observed[0].callback();observed[0].callback();assert.equal(header.children.length,2,'mutation batches do not duplicate metadata');
  assert.equal(header.timestamp,time);assert.equal(time.getAttribute('href'),href,'playback URL is not rewritten');
  assert.equal(source.textContent,'记录');
  let stopped=0,prevented=0;const event={target:source,stopPropagation(){stopped++;},preventDefault(){prevented++;}} as unknown as Event;
  root.listeners.get('pointerdown')!(event);root.listeners.get('click')!(event);await Promise.resolve();
  assert.deepEqual(opened,[['资料/记录.md#^thoughtspace-media-1','qa.thoughtspace','tab']]);assert.equal(stopped,2);assert.equal(prevented,1);
  embed.setAttribute('src','其他/新记录.md#^thoughtspace-media-2');observed[0].callback();assert.equal(source.textContent,'新记录');assert.equal(source.dataset.referenceTarget,'其他/新记录.md#^thoughtspace-media-2');
  disposals[0]();assert.equal(observed[0].disconnected,true);assert.equal(root.listeners.size,0);
  embed.setAttribute('src','再更新#^thoughtspace-media-3');observed[0].callback();assert.equal(source.textContent,'新记录','disposed previews cannot be rewritten');
 }finally{globalThis.MutationObserver=previous;}
});
test('ordinary previews do not install an observer or link handlers',()=>{
 const root=new Element();mountMediaReferencePresentation(root as any,{} as any,'qa.thoughtspace',()=>{throw Error('unexpected registration');});
 assert.equal(root.listeners.size,0);
});
