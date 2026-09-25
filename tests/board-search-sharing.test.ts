import test from 'node:test';
import assert from 'node:assert/strict';
import {boardSearchIndex,searchBoard,searchExcerpt,type BoardSearchFilter} from '../src/board-search';
import {emptyBoard,type Board,type Card} from '../src/model';
const card=(id:string,extra:Partial<Card>={}):Card=>({id,kind:'card',file:'reference.md',x:0,y:0,width:120,height:80,color:'green',...extra});
const filter:BoardSearchFilter={query:'',kind:'',group:'',color:''};
test('repeated long-note instances normalize shared body once and retain individual searchable titles',t=>{
 const body='SHARED Evidence '.repeat(4000),board:Board={...emptyBoard(),nodes:Array.from({length:200},(_,i)=>card('n'+i,{title:'Alias'+i}))};let chars=0;
 const lower=String.prototype.toLocaleLowerCase;String.prototype.toLocaleLowerCase=function(...args:Parameters<typeof lower>){chars+=this.length;return lower.apply(this,args);};
 let entries:ReturnType<typeof boardSearchIndex>;
 try{entries=boardSearchIndex(board,()=>({title:'Original',body,tags:['#Proof']}));}finally{String.prototype.toLocaleLowerCase=lower;}
 t.diagnostic(JSON.stringify({instances:board.nodes.length,bodyCharacters:body.length,normalizedCharacters:chars}));assert.ok(chars<body.length+20000,`${chars} normalized characters repeat a shared body`);
 assert.equal(searchBoard(entries,{...filter,query:'shared proof'}).length,200);assert.deepEqual(searchBoard(entries,{...filter,query:'alias159 evidence'}).map(e=>e.id),['n159']);assert.equal(searchExcerpt(entries[0],'Evidence').includes('Evidence'),true);
});
test('each unique body is scanned once per query even when hundreds of local instances miss a term',t=>{
 const body='large document '.repeat(4000),entries=boardSearchIndex({...emptyBoard(),nodes:Array.from({length:200},(_,i)=>card('n'+i))},()=>({body}));const includes=String.prototype.includes;let scanned=0;
 String.prototype.includes=function(...args:Parameters<typeof includes>){if(this.length>=body.length)scanned++;return includes.apply(this,args);};
 try{assert.equal(searchBoard(entries,{...filter,query:'absentTerm'}).length,0);}finally{String.prototype.includes=includes;}
 t.diagnostic(JSON.stringify({bodyScans:scanned}));assert.equal(scanned,1);
});
test('local title and group matches combine with shared body words, and query memo never crosses calls',()=>{
 const group=card('group',{kind:'section',file:undefined,title:'StudyGroup',x:-20,y:-20,width:200,height:140});
 const entries=boardSearchIndex({...emptyBoard(),nodes:[group,card('one',{title:'LocalOne'}),card('two',{title:'LocalTwo',x:400})]},n=>n.kind==='card'?{body:'Shared Ω Evidence',tags:['#Research']}:{});
 assert.deepEqual(searchBoard(entries,{...filter,query:'localone Ω research studygroup'}).map(e=>e.id),['one']);
 assert.deepEqual(searchBoard(entries,{...filter,query:'shared',group:':none'}).map(e=>e.id),['two']);
 assert.equal(searchBoard(entries,{...filter,query:'missing'}).length,0);assert.equal(searchBoard(entries,{...filter,query:'evidence'}).length,2);
 entries[1].body='new';const refreshed=boardSearchIndex({...emptyBoard(),nodes:[card('one'),card('two')]},n=>({body:n.id==='one'?'NEW':'Shared'}));
 assert.deepEqual(searchBoard(refreshed,{...filter,query:'new'}).map(e=>e.id),['one']);assert.deepEqual(searchBoard(refreshed,{...filter,query:'shared'}).map(e=>e.id),['two']);
});
test('same-path caller metadata remains instance-specific and plain text and headings remain searchable',()=>{
 const nodes=[card('one'),card('two'),card('text',{kind:'text',text:'TextBody',file:undefined}),card('heading')];
 const entries=boardSearchIndex({...emptyBoard(),nodes},n=>n.id==='heading'?{headings:['Method Header']}:({body:n.id==='one'?'FirstUnique':'SecondUnique'}));
 assert.deepEqual(searchBoard(entries,{...filter,query:'firstunique'}).map(e=>e.id),['one']);assert.deepEqual(searchBoard(entries,{...filter,query:'secondunique'}).map(e=>e.id),['two']);assert.deepEqual(searchBoard(entries,{...filter,query:'textbody'}).map(e=>e.id),['text']);assert.deepEqual(searchBoard(entries,{...filter,query:'method header'}).map(e=>e.id),['heading']);
});
