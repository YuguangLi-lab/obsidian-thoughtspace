import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import * as editor from '../src/mindmap-editor';
import * as sizing from '../src/mindmap-sizing';
import * as markdown from '../src/markdown-context';
import * as search from '../src/editor-search';
import * as connections from '../src/connections';
import {branchMarkdown} from '../src/mindmap-flow';
import {topicSvg,themeTopicTree,appendTopicOutline} from '../src/mindmap-content';
const node=(id:string,extra:Partial<model.Card>={}):model.Card=>({id,kind:'text',text:id,x:0,y:0,width:120,height:80,color:'blue',...extra});

test('topic theme changes do not calculate unrelated folded-frame visibility',t=>{
 let foldedReads=0;
 const deps:Record<string,unknown>={'./model':{...model,clone:(source:model.Board)=>{const draft=model.clone(source);draft.nodes=draft.nodes.map(n=>new Proxy(n,{get(o,k,r){if(k==='sectionFolded')foldedReads++;return Reflect.get(o,k,r);}}));return draft;}},'./mindmap':mindmap,'./mindmap-editor':editor,'./mindmap-sizing':sizing,'./markdown-context':markdown,'./editor-search':search,'./connections':connections};
 const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/mindmap-content.ts','utf8'),{loader:'ts',format:'cjs'}).code)((id:string)=>deps[id],module,module.exports);
 const b=model.emptyBoard();b.version=3;b.nodes=[node('root'),node('child')];b.edges=[{id:'branch',from:'root',to:'child',kind:'branch',label:''}];for(let i=0;i<64;i++)b.nodes.push(node('frame'+i,{kind:'section',title:'Frame',x:i*2000,y:500,width:1000,height:1000,sectionFolded:true}),node('inside'+i,{x:i*2000+100,y:600}));
 const before=model.clone(b),result=module.exports.themeTopicTree(b,'child','quiet','straight');const work=foldedReads;t.diagnostic(`fold visibility property reads ${work}`);assert.equal(work,0);assert.equal(result.board.nodes[1].color,'slate');assert.equal(result.board.edges[0].style,'straight');assert.deepEqual(b,before);
});

test('Markdown branch export only sorts the requested legacy subtree',t=>{
 let outsideGeometry=0;const b=model.emptyBoard();b.version=3;b.nodes=[node('root'),node('late',{y:200}),node('early',{y:50}),node('outside')];b.edges=[{id:'late',from:'root',to:'late',kind:'branch',label:''},{id:'early',from:'root',to:'early',kind:'branch',label:''}];
 for(let i=0;i<1200;i++){b.nodes.push(new Proxy(node('other'+i,{y:1200-i}),{get(o,k,r){if(k==='x'||k==='y')outsideGeometry++;return Reflect.get(o,k,r);}}));b.edges.push({id:'edge'+i,from:'outside',to:'other'+i,kind:'branch',label:''});}
 const text=branchMarkdown(b,'root');t.diagnostic(`unrelated sibling geometry reads ${outsideGeometry}`);assert.equal(outsideGeometry,0);assert.equal(text,'- root\n  - early\n  - late\n');
});

test('SVG clips long Unicode labels without expanding hidden characters',t=>{
 const b=model.emptyBoard();b.version=3;b.nodes=[node('root',{text:'😀研究'.repeat(100000)+'\nsecond\nunused',width:120,height:80})];let visits=0;const iterator=String.prototype[Symbol.iterator];
 String.prototype[Symbol.iterator]=function(){const original=iterator.call(this),count=this.length>100000;return{next(){const next=original.next();if(count&&!next.done)visits++;return next;},[Symbol.iterator](){return this;}} as StringIterator<string>;};
 let result:string;try{result=topicSvg(b,'root');}finally{String.prototype[Symbol.iterator]=iterator;}
 t.diagnostic(`code points visited for clipped long line ${visits}`);assert.ok(visits<=10,`Visited ${visits} clipped characters`);assert.ok(result.includes('>😀研究😀研究</text>'));assert.ok(result.includes('>second</text>'));assert.ok(!result.includes('>unused</text>'));
});

test('SVG clipping preserves empty rows, trailing newline and Unicode XML escaping',()=>{
 const b=model.emptyBoard();b.version=3;b.nodes=[node('root',{text:'😀\n\n<中文>&\n',width:80,height:130})];const svg=topicSvg(b,'root');assert.deepEqual([...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/gs)].map(m=>m[1]),['😀','','&lt;中文&gt;','']);assert.ok(svg.includes('<title>😀\n\n&lt;中文&gt;&amp;\n</title>'));
});

test('theme and outline export still reject unrelated cycles without mutating the selected tree',()=>{
 const b=model.emptyBoard();b.version=3;b.nodes=[node('root'),node('a'),node('b')];b.edges=[{id:'ab',from:'a',to:'b',kind:'branch',label:''},{id:'ba',from:'b',to:'a',kind:'branch',label:''}];const before=model.clone(b);
 assert.throws(()=>themeTopicTree(b,'root','classic',undefined),/循环/);assert.throws(()=>branchMarkdown(b,'root'),/循环/);assert.throws(()=>appendTopicOutline(b,'root',[{depth:0,text:'new'}]),/循环/);assert.deepEqual(b,before);
});

test('folded locked descendants still block theme changes and declared layouts retain edge order',()=>{
 const b=model.emptyBoard();b.version=3;b.nodes=[node('root',{branchFolded:true}),node('late',{y:200}),node('early',{y:50,locked:true})];b.edges=[{id:'late',from:'root',to:'late',kind:'branch',label:''},{id:'early',from:'root',to:'early',kind:'branch',label:''}];const before=model.clone(b);assert.throws(()=>themeTopicTree(b,'root','quiet','straight'),/锁定/);assert.deepEqual(b,before);
 b.mindmapLayout='right';assert.equal(branchMarkdown(b,'root'),'- root\n  - late\n  - early\n');delete b.mindmapLayout;assert.equal(branchMarkdown(b,'root'),'- root\n  - early\n  - late\n');
});
