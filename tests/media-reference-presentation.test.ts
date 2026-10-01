import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaReferenceTarget,mediaTimestampPresentation,mountMediaReferencePresentation} from '../src/media-reference-presentation';
import {mediaPlayerUrl} from '../src/media-notes';
import {mediaSourceUrl} from '../src/media-source';
import {onlinePlayerUrl} from '../src/online-media-notes';

test('source label is derived from native embed provenance without changing its block target',()=>{
 const target='资料/课程 & 观察.md#^thoughtspace-media-capture-1';
 assert.deepEqual(mediaReferenceTarget(target),{target,label:'课程 & 观察'});
});
for(const target of ['https://example.com/a#^thoughtspace-media-x','../a#^thoughtspace-media-x','/a#^thoughtspace-media-x','a\\b#^thoughtspace-media-x','a#ordinary','a#^thoughtspace-media-','a\n#^thoughtspace-media-x'])test('ignore nonlocal or unrelated embed '+JSON.stringify(target),()=>{
 assert.equal(mediaReferenceTarget(target),undefined);
});

class Element {
 className='';ownText='';tag='div';title='';dataset:Record<string,string>={};attrs=new Map<string,string>();children:Element[]=[];parent?:Element;reference=false;
 get parentElement(){return this.parent;}get textContent():string{return this.ownText+this.children.map(n=>n.textContent).join('');}set textContent(value:string){this.ownText=value;this.children=[];}
 embeds:Element[]=[];header?:Element;timestamp?:Element;listeners=new Map<string,EventListener>();
 ownerDocument={win:{createEl:()=>new Element()}};
 classList={add:(value:string)=>{if(!this.className.split(' ').includes(value))this.className+=' '+value;},contains:(value:string)=>this.className.split(' ').includes(value),remove:(value:string)=>{this.className=this.className.split(' ').filter(n=>n!==value).join(' ');}};
 setAttribute(key:string,value:string){this.attrs.set(key,value);}getAttribute(key:string){return this.attrs.get(key)||null;}
 createEl(tag:string,options:{cls?:string}={}){const child=new Element();child.tag=tag;child.className=options.cls||'';this.appendChild(child);return child;}
 createDiv(options:{cls:string}){return this.createEl('div',options);}
 appendChild(child:Element){child.remove();this.children.push(child);child.parent=this;}
 prepend(child:Element){child.remove();this.children.unshift(child);child.parent=this;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=undefined;}
 contains(child:Element):boolean{return child===this||this.children.some(n=>n.contains(child));}
 closest(selector:string):Element|undefined{return(selector==='.is-media-reference'?this.reference||this.classList.contains('is-media-reference'):selector==='.ts-node'?this.classList.contains('ts-node'):this.className.includes('ts-media-reference-source'))?this:this.parent?.closest(selector);}
 querySelectorAll(selector:string){return selector===':scope > p > a[href]'?this.children.filter(n=>n.tag==='p').flatMap(n=>n.children.filter(n=>n.tag==='a'&&n.attrs.has('href'))):this.embeds;}
 querySelector(selector:string){return selector.includes('markdown-preview-view')?this.header:selector.includes('callout-title-inner')?this.timestamp:selector==='.callout-content'?undefined:this.children.find(n=>n.className.includes('ts-media-reference-source'));}
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

for(const time of [0,.125,12.75])test('board and standalone timestamp metadata retain exact '+time,()=>{
 const source={vault:'研究 + 空间',file:'媒体/中文 + 片段.mp4'};
 const board=mediaSourceUrl({...source,board:'白板/研究.thoughtspace',node:'video',time});
 const player=mediaPlayerUrl(source,time);
 assert.deepEqual(mediaTimestampPresentation(board),mediaTimestampPresentation(player));
 assert.deepEqual(mediaTimestampPresentation(board),{time,label:'中文 + 片段.mp4'});
});
for(const source of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ','https://www.bilibili.com/video/BV1xx411c7mD'])test('supported online timestamp metadata preserves source note '+source,()=>{
 const info=mediaTimestampPresentation(onlinePlayerUrl('QA',source,.75,'笔记/中文 + 记录.md'));
 assert.equal(info?.time,.75);assert.equal(info?.note,'笔记/中文 + 记录.md');assert.ok(info?.label);
});
for(const href of ['https://example.com/?t=1','obsidian://thoughtspace-player?vault=QA&file=a.mp4&t=-1','obsidian://thoughtspace-player?vault=QA&file=a.mp4&t=100000001'])test('unrelated or invalid timestamps remain ordinary '+href,()=>assert.equal(mediaTimestampPresentation(href),undefined));

function directFixture(count=1){
 const node=new Element();node.className='ts-node';const root=node.createEl('div');
 const body=root.createEl('p');body.textContent='正文和截图保持原始内容';const image=root.createEl('p').createEl('img');image.setAttribute('src','app://fixture');
 const href=mediaSourceUrl({vault:'QA',file:'媒体/中文 + 片段.mp4',board:'qa.thoughtspace',node:'video',time:1.25});
 const timestamps=[];for(let i=0;i<count;i++){const timestamp=root.createEl('p').createEl('a');timestamp.setAttribute('href',href);timestamp.textContent='中文 + 片段.mp4 · 0:01';timestamps.push(timestamp);}
 return{node,root,body,image,href,timestamp:timestamps[0]};
}
for(const sourcePath of ['qa.thoughtspace','笔记/截图.md'])test('direct capture reuses native body/image/link with common header in '+sourcePath,async()=>{
 const f=directFixture(),disposals:(()=>void)[]=[],opened:string[][]=[];
 mountMediaReferencePresentation(f.root as any,{workspace:{async openLinkText(...args:string[]){opened.push(args);}}} as any,sourcePath,dispose=>disposals.push(dispose));
 const header=f.root.children[0],source=header.children[1];assert.equal(header.className,'ts-media-reference-header');assert.equal(header.children[0],f.timestamp);assert.equal(f.timestamp.getAttribute('href'),f.href);assert.equal(f.timestamp.textContent,'0:01');
 assert.ok(f.root.contains(f.body));assert.equal(f.body.textContent,'正文和截图保持原始内容');assert.ok(f.root.contains(f.image));assert.equal(f.image.getAttribute('src'),'app://fixture');
 const event={target:source,preventDefault(){},stopPropagation(){}} as any;f.root.listeners.get('click')!(event);await Promise.resolve();
 if(sourcePath.endsWith('.md')){assert.equal(source.textContent,'截图');assert.deepEqual(opened,[[sourcePath,sourcePath,'tab']]);}
 else{assert.equal(source.textContent,'中文 + 片段.mp4');assert.equal(source.getAttribute('href'),f.href);assert.deepEqual(opened,[],'playback continues through the shared board route');}
 assert.equal(f.node.classList.contains('is-media-reference'),true);disposals[0]();assert.equal(f.node.classList.contains('is-media-reference'),false);assert.equal(f.root.listeners.size,0);
});
test('several timestamps and inline prose are not collapsed into a single excerpt',()=>{
 for(const count of [1,2]){const f=directFixture(count);if(count===1)f.timestamp.parentElement!.ownText='See this reference: ';
  mountMediaReferencePresentation(f.root as any,{} as any,'qa.thoughtspace',()=>assert.fail('ordinary prose must not be decorated'));assert.equal(f.root.children[0],f.body);assert.equal(f.node.classList.contains('is-media-reference'),false);
 }
});
