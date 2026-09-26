import test from 'node:test';
import assert from 'node:assert/strict';
import {inlineCodeRanges,inlineLiteralRanges,maskInlineLiterals,stripInlineComments} from '../src/markdown-literals';
import {planMarkdownEdit} from '../src/markdown-edit';
import {writingOrder,writingParts,writingItems} from '../src/writing';
import {emptyBoard,type Board,type Card} from '../src/model';

test('plain task and prose masking avoid per-character comment delimiter probes',()=>{
 const text='普通任务 a_b 😀 '.repeat(5000),startsWith=String.prototype.startsWith;let probes=0;
 String.prototype.startsWith=function(search:string,position?:number){if(search==='<!--'||search==='%%')probes++;return Reflect.apply(startsWith,this,[search,position]);};
 try{assert.deepEqual(inlineLiteralRanges(text),[]);assert.equal(maskInlineLiterals(text),text);assert.equal(stripInlineComments(text),text);}finally{String.prototype.startsWith=startsWith;}
 assert.equal(probes,0);
});

test('comment-free literal masks still protect escaped and multi-backtick code ranges',()=>{
 const text='😀 `a_b` and ``tick ` inside`` \\`escaped` end',code=inlineCodeRanges(text),ranges=inlineLiteralRanges(text);
 assert.deepEqual(ranges,code.map(r=>({...r,comment:false})));
 for(const r of ranges)assert.equal(maskInlineLiterals(text).slice(r.from,r.to),'\ufffc'.repeat(r.to-r.from));
 assert.equal(stripInlineComments(text),text);
});

test('comments retain exact UTF-16 offsets and never reinterpret protected code markers',()=>{
 const text='😀 `<!-- literal -->` <!--hidden--> body %%hidden%% tail';
 const ranges=inlineLiteralRanges(text);assert.deepEqual(ranges.map(r=>[text.slice(r.from,r.to),r.comment]),[['`<!-- literal -->`',false],['<!--hidden-->',true],['%%hidden%%',true]]);
 assert.equal(stripInlineComments(text),'😀 `<!-- literal -->`   body   tail');
 const escaped=String.raw`\<!-- literal --> \%% text`;assert.deepEqual(inlineLiteralRanges(escaped),[]);
 assert.deepEqual(inlineLiteralRanges('text <!--open').map(r=>[r.from,r.to,r.comment]),[[5,13,true]]);
});

test('code block formatting handles more delimiter runs than the function argument limit',()=>{
 const body='`x '.repeat(150000),value=planMarkdownEdit(body,0,body.length,'codeblock');
 assert.equal(value.text,'```\n'+body+'\n```');assert.deepEqual(value.change,{from:0,to:body.length,text:value.text});
});

test('inline code formatting handles a large selected passage without spread argument overflow',()=>{
 const body='`x '.repeat(150000),value=planMarkdownEdit(body,0,body.length,'code');
 assert.equal(value.text,'`` '+body+' ``');assert.equal(value.text.slice(value.start,value.end),body);
 assert.deepEqual(value.change,{from:0,to:body.length,text:value.text});
 const unwrapped=planMarkdownEdit(value.text,value.start,value.end,'code');assert.equal(unwrapped.text,body);assert.equal(unwrapped.text.slice(unwrapped.start,unwrapped.end),body);
});

test('code fences exceed the longest source run and preserve CRLF and source selection',()=>{
 const body='😀 ```` a ` b ```',text='before\r\n'+body+'\r\nafter',start=text.indexOf(body),value=planMarkdownEdit(text,start,start+body.length,'codeblock');
 assert.equal(value.change?.text,'\r\n`````\r\n'+body+'\r\n`````\r\n');
 assert.equal(value.text,text.slice(0,start)+value.change!.text+text.slice(start+body.length));
 const inline=planMarkdownEdit('before '+body+' after',7,7+body.length,'code');assert.equal(inline.text.slice(inline.start,inline.end),body);
});

const card=(id:string,i=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:'**material**',x:(i%20)*160,y:Math.floor(i/20)*100,width:120,height:80,color:'sand',...extra});
function board(){const b:Board={...emptyBoard(),version:3};b.nodes=Array.from({length:1200},(_,i)=>card('n'+i,1199-i));b.writing={title:'Draft',order:['intro','n0','n1199','missing'],chapters:[{id:'intro',title:'Introduction',body:'# Title'}]};return b;}
function geometryReads(b:Board){let count=0;b.nodes=b.nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(['x','y','width','height'].includes(String(key)))count++;return Reflect.get(target,key,receiver);}}));return()=>count;}

test('saved writing order validates ids without sorting material geometry',()=>{
 const b=board(),saved=structuredClone(b),reads=geometryReads(b);assert.deepEqual(writingOrder(b),['intro','n0','n1199']);assert.equal(reads(),0);assert.deepEqual(b,saved);
});

test('writing parts without groups use the saved order without sorting the whole board',()=>{
 const b=board(),saved=structuredClone(b),reads=geometryReads(b);assert.deepEqual(writingParts(b).map(p=>p.node.id),['intro','n0','n1199']);assert.equal(reads(),0);assert.deepEqual(b,saved);
});

test('writing groups preserve child reading order, exclusions and chapter options',()=>{
 const b:Board={...emptyBoard(),version:3,nodes:[card('group',0,{kind:'section',width:900,height:600}),card('later',0,{x:300,y:120}),card('first',0,{x:40,y:40}),card('excluded',0,{x:200,y:40}),card('pdf',0,{kind:'pdf',file:'a.pdf'}),card('portal',0,{kind:'board',file:'a.thoughtspace'})],writing:{title:'Draft',order:['intro','group','first'],chapters:[{id:'intro',title:'Chapter',body:'Text'}],options:{first:{title:'renamed',level:0,note:'Keep [[source]]'},excluded:{excluded:true}}}};
 const saved=structuredClone(b);assert.deepEqual(writingParts(b).map(p=>[p.node.id,p.depth,p.node.title,p.note]),[['intro',2,'Chapter',undefined],['group',2,undefined,undefined],['first',0,'renamed','Keep [[source]]'],['later',3,undefined,undefined]]);assert.deepEqual(b,saved);
 assert.deepEqual(writingParts(b,[]),[]);assert.deepEqual(writingParts(b,['group','group']).map(p=>p.node.id),['group','first','later']);
 assert.deepEqual(writingItems(b).map(n=>n.id),['group','first','excluded','later','intro']);
});

test('writing source edits and exclusions are fresh on every assembly',()=>{
 const b=board();assert.equal(writingParts(b)[0].node.text,'# Title');b.writing!.chapters![0].body='changed';b.writing!.options={n0:{excluded:true}};
 assert.deepEqual(writingParts(b).map(p=>[p.node.id,p.node.text]),[['intro','changed'],['n1199','**material**']]);b.nodes=b.nodes.filter(n=>n.id!=='n1199');assert.deepEqual(writingOrder(b),['intro','n0']);
});
