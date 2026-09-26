import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard, type Card} from '../src/model';
import {addHubNotes,defaultHubFilter,hubIndex,hubMatches,hubResults,type HubNote,type HubPreferences} from '../src/space-hub';
import {filterRows,type DatabaseRow,type DatabaseFilter} from '../src/database';
const prefs:HubPreferences={view:'gallery',saved:[],recent:[]};
const note=(i:number):HubNote=>({path:`Materials/Alpha ${i}.md`,title:`Alpha Beta ${i}`,mtime:i,tags:['#研究/阅读','#project'],journal:false});
const row=(i:number):DatabaseRow=>({path:`Note ${i}.md`,title:`Alpha Beta ${i}`,tags:['#研究'],mtime:i,props:{status:'active',priority:'high',due:`2026-09-${String(i%28+1).padStart(2,'0')}`}});
const filter:DatabaseFilter={query:'',tag:'',status:'',priority:'',overdue:false,sort:'due',today:'2026-09-15'};

test('space search prepares the query once and normalizes each multi-term title only once',()=>{
 const index=hubIndex([],Array.from({length:1200},(_,i)=>note(i))),query='ALPHA beta #研究',split=String.prototype.split,lower=String.prototype.toLocaleLowerCase;let querySplits=0,titleNormalizations=0;
 String.prototype.split=function(this:string,...args:unknown[]){if(String(this)===query)querySplits++;return Reflect.apply(split,this,args);} as typeof split;
 String.prototype.toLocaleLowerCase=function(this:string,...args:unknown[]){if(String(this).startsWith('Alpha Beta '))titleNormalizations++;return Reflect.apply(lower,this,args);};
 try{const results=hubResults(index,{...defaultHubFilter,scope:'notes',query},prefs,new Set());assert.equal(results.length,1200);assert.equal(results[0].path,'Materials/Alpha 1199.md');}finally{String.prototype.split=split;String.prototype.toLocaleLowerCase=lower;}
 assert.ok(querySplits<=1,`Query parsed ${querySplits} times`);assert.ok(titleNormalizations<=1200,`Titles normalized ${titleNormalizations} times`);
});

test('space search keeps nested tag boundaries, all scopes and fresh query state',()=>{
 const n=note(0);assert.equal(hubMatches(n,'alpha #研究',''),true);assert.equal(hubMatches(n,'#研',''),false);assert.equal(hubMatches(n,'#研究/阅读','#PROJECT'),true);assert.equal(hubMatches(n,'#研究/阅读/子',''),false);assert.equal(hubMatches(n,'missing',''),false);
 const notes=[n,{...note(1),journal:true}],index=hubIndex([],notes);assert.equal(hubResults(index,{...defaultHubFilter,scope:'inbox'},prefs,new Set()).length,1);
 index.errors.push({path:'broken',message:'invalid'});assert.equal(hubResults(index,{...defaultHubFilter,scope:'inbox'},prefs,new Set()).length,0);
 n.title='Changed';assert.equal(hubResults(index,{...defaultHubFilter,scope:'notes',query:'changed'},prefs,new Set()).length,1);assert.equal(hubResults(index,{...defaultHubFilter,scope:'notes',query:'beta'},prefs,new Set()).length,0);
});

test('batch insertion checks generated IDs against existing nodes in one pass',()=>{
 const board=emptyBoard();board.nodes=Array.from({length:1200},(_,i):Card=>({id:'old'+i,kind:'text',text:'x',color:'sand',x:0,y:0,width:200,height:100}));let reads=0,id=0;
 board.nodes=board.nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}));
 const ids=addHubNotes(board,Array.from({length:100},(_,i)=>`New ${i}.md`),{x:20,y:30},300,()=>`new${id++}`);
 assert.equal(ids.length,100);assert.equal(board.nodes.length,1300);assert.equal(board.nodes[1200].x,20);assert.ok(reads<=1200,`Collision check read ${reads} IDs`);
});

test('batch collisions and ID factory failure preserve the complete board',()=>{
 const board=emptyBoard();addHubNotes(board,['One.md'],{x:0,y:0},300,()=> 'existing');const before=JSON.stringify(board);let count=0;
 assert.throws(()=>addHubNotes(board,['Two.md','Three.md'],{x:0,y:0},300,()=>++count===2?'existing':'new'),/标识冲突/);assert.equal(JSON.stringify(board),before);assert.equal(count,2);
 assert.throws(()=>addHubNotes(board,['Two.md','Three.md'],{x:0,y:0},300,()=> 'same'),/标识冲突/);assert.equal(JSON.stringify(board),before);
 count=0;assert.throws(()=>addHubNotes(board,['Two.md','Three.md'],{x:0,y:0},300,()=>{if(++count===2)throw Error('id');return 'new';}),/id/);assert.equal(JSON.stringify(board),before);
 count=0;assert.deepEqual(addHubNotes(board,['One.md'],{x:0,y:0},300,()=>{count++;return 'never';}),[]);assert.equal(count,0);assert.equal(JSON.stringify(board),before);
});

test('database date sorting validates each distinct date once per operation and keeps stable path ties',()=>{
 const rows=Array.from({length:1200},(_,i)=>row(i)),iso=Date.prototype.toISOString;let validations=0;
 Date.prototype.toISOString=function(){validations++;return Reflect.apply(iso,this,[]);};
 let actual:DatabaseRow[];
 try{actual=filterRows(rows,filter);}finally{Date.prototype.toISOString=iso;}
 const expected=[...rows].sort((a,b)=>a.props.due.localeCompare(b.props.due)||a.path.localeCompare(b.path));assert.deepEqual(actual,expected);assert.equal(rows[0].path,'Note 0.md');
 assert.ok(validations<=28,`Repeated due-date validation ${validations} times`);
 rows[0].props.due='invalid';assert.equal(filterRows(rows,filter).at(-1),rows[0]);
});

test('database overdue filtering and due sorting reuse date validation within that query',()=>{
 const rows=Array.from({length:1200},(_,i)=>row(i)),iso=Date.prototype.toISOString;let validations=0;
 Date.prototype.toISOString=function(){validations++;return Reflect.apply(iso,this,[]);};
 let actual:DatabaseRow[];
 try{actual=filterRows(rows,{...filter,overdue:true});}finally{Date.prototype.toISOString=iso;}
 assert.ok(actual!.every(r=>r.props.due<filter.today));assert.ok(validations<=28,`Overdue and sort validated ${validations} dates`);
 const unusual=[{...row(0),props:{status:'done',priority:'',due:'2026-09-01'}},{...row(1),props:{status:'active',priority:'',due:'2026-02-30'}},{...row(2),props:{status:'active',priority:'',due:''}}];assert.deepEqual(filterRows(unusual,{...filter,overdue:true}),[]);
});

test('database multirow search normalizes the query once',()=>{
 const rows=Array.from({length:1200},(_,i)=>row(i)),lower=String.prototype.toLocaleLowerCase;let queryReads=0;
 String.prototype.toLocaleLowerCase=function(this:string,...args:unknown[]){if(String(this)==='ALPHA BETA')queryReads++;return Reflect.apply(lower,this,args);};
 try{assert.equal(filterRows(rows,{...filter,sort:'updated',query:'ALPHA BETA'}).length,1200);}finally{String.prototype.toLocaleLowerCase=lower;}
 assert.ok(queryReads<=1,`Query normalized ${queryReads} times`);
});
