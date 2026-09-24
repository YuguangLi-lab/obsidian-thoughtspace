import test from 'node:test';
import assert from 'node:assert/strict';
import {fitTextNode} from '../src/text-tools';
import {type Card} from '../src/model';
import {TextDocument} from './text-dom-fixture';
function fixture(status='ready'){
 const doc=new TextDocument(),host=doc.createElement('div'),rendered=doc.createElement('div');rendered.className='ts-text-body markdown-rendered';rendered.dataset.markdownStatus=status;rendered.dataset.mathStatus=status;const content=doc.createElement('div');content.className='ts-text-markdown markdown-rendered';const paragraph=doc.createElement('p'),math=doc.createElement('mjx-container');math.setAttribute('id','native-math-id');paragraph.appendChild(math);content.appendChild(paragraph);rendered.appendChild(content);const badge=doc.createElement('button');badge.className='ts-source-trigger';paragraph.appendChild(badge);
 const node:Card={id:'text',kind:'text',text:'$\\frac{1}{2}$',x:0,y:0,width:200,height:120,color:'green'};
 const fit=()=>fitTextNode(node,host as unknown as HTMLElement,rendered as unknown as HTMLElement);
 return{node,doc,host,rendered,content,paragraph,badge,fit};
}
test('Markdown auto-fit clones native math in the same class context while preserving the live source control',()=>{
 const f=fixture();f.fit();assert.deepEqual([f.node.width,f.node.height],[344,180]);const context=f.doc.elements.find(e=>e.classList.contains('ts-text-fit-context'))!,frame=context.children[0],body=frame.children[0],paragraph=body.querySelector('p')!;
 assert.equal(context.classList.contains('ts-root'),true);assert.equal(frame.classList.contains('ts-text'),true);assert.equal(body.className,'ts-text-body markdown-rendered');assert.equal(context.style['--font-text'],'Custom Body Font');assert.equal(body.querySelector('[id]'),null);assert.equal(body.querySelector('.ts-source-trigger'),null);assert.equal(paragraph.children.at(-1)!.style.width,'20px');assert.equal(f.badge.parentElement,f.paragraph);assert.equal(f.paragraph.children[0].attributes.id,'native-math-id');assert.equal(context.removed,true);
});
test('pending Markdown cannot replace rendered geometry with raw syntax metrics',()=>{const f=fixture('pending'),before=structuredClone(f.node),count=f.doc.elements.length;f.fit();assert.deepEqual(f.node,before);assert.equal(f.doc.elements.length,count);});
test('failed or absent Markdown uses readable source sizing',()=>{for(const status of ['error','none']){const f=fixture(status);f.fit();const body=f.doc.elements.find(e=>e.classList.contains('ts-text-fit-context'))!.children[0].children[0];assert.equal(body.textContent,f.node.text);assert.equal(body.children.length,0);}});
test('manual text width is kept exactly while Markdown height and CSS typography are measured',()=>{
 const f=fixture();f.node.autoSize=false;Object.assign(f.doc.computed,{fontSize:'24px',fontWeight:'500',lineHeight:'40.8px',letterSpacing:'0.2px',paddingTop:'28px',paddingRight:'32px',paddingBottom:'28px',paddingLeft:'32px'});f.fit();assert.equal(f.node.width,200);assert.equal(f.node.height,180);const frame=f.doc.elements.find(e=>e.classList.contains('ts-text-fit-context'))!.children[0];assert.equal(frame.style.width,'200px');assert.equal(frame.style.minWidth,'0');assert.equal(frame.children[0].style.fontSize,'24px');assert.equal(frame.children[0].style.paddingRight,'32px');
});
test('automatic text width is capped by its own configured text width, without camera scaling',()=>{
 const f=fixture();f.node.textMaxWidth=420;f.node.topic=true;f.fit();const frame=f.doc.elements.find(e=>e.classList.contains('ts-text-fit-context'))!.children[0];assert.equal(frame.style.maxWidth,'420px');assert.equal(frame.style.transform,'none');assert.equal(frame.style.width,'max-content');assert.equal(frame.classList.contains('ts-topic'),true);
});
test('inline draft Markdown measurements reserve excerpt sources even before the actual control exists',()=>{
 const f=fixture();f.badge.remove();f.node.text='内容\n\n> 来源：[[paper.pdf]] · PDF 第 2 页';f.fit();const body=f.doc.elements.find(e=>e.classList.contains('ts-text-fit-context'))!.children[0].children[0],paragraph=body.querySelector('p')!;assert.equal(paragraph.children.at(-1)!.style.width,'20px');assert.equal(f.paragraph.children.length,1);
});
test('non-finite or empty measurement does not destroy existing node geometry',()=>{for(const size of [{width:0,height:10},{width:100,height:NaN},{width:Infinity,height:10}]){const f=fixture(),before=structuredClone(f.node);f.doc.measure=()=>size;f.fit();assert.deepEqual(f.node,before);assert.equal(f.doc.elements.find(e=>e.classList.contains('ts-text-fit-context'))!.removed,true);}});
