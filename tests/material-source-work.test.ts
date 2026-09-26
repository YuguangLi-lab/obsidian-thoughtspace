import test from 'node:test';
import assert from 'node:assert/strict';
import {extractFragments,rebaseFragment,selectionFragment,createFragmentRebaser,type MaterialReference} from '../src/materials';
import {boardSearchDocument,searchIndexPath,searchIndexTarget} from '../src/native-search';
import {emptyBoard} from '../src/model';
import {createHash} from 'node:crypto';

test('a small native selection in a long note resolves exact lines without splitting the prefix',t=>{
 const raw='Prior line 😀\r\n'.repeat(20000)+'first\n\t **selected**\r\nlast',from=raw.indexOf('\t **selected**'),to=raw.indexOf('last');let splitCharacters=0;
 const split=String.prototype.split,mock=t.mock.method(String.prototype,'split',function(this:string,...args:Parameters<typeof split>){splitCharacters+=this.length;return Reflect.apply(split,this,args);});
 const fragment=selectionFragment(raw,from,to);mock.mock.restore();assert.deepEqual(fragment,{id:`selection:${from}:${to}`,kind:'paragraph',title:'selected',heading:'',body:'\t **selected**\r\n',start:20002,end:20002,selection:{from,to}});
 t.diagnostic(`native selection: ${splitCharacters} characters split`);assert.ok(splitCharacters<=100,`split ${splitCharacters} characters for a short selection`);
});

test('rebasing a long linked fragment traverses its source lines once and assembles its result once',t=>{
 const rows=Array.from({length:1600},(_,i)=>`Before [[item${i}]] after`),raw=rows.join('\n'),fragment=extractFragments(raw).fragments[0],references:MaterialReference[]=rows.map((row,i)=>({original:`[[item${i}]]`,replacement:`[[folder/item${i}|别名😀]]`,start:{line:i,col:7},end:{line:i,col:row.indexOf(' after')}}));
 let reducedRows=0,copiedCharacters=0;const reduce=Array.prototype.reduce,slice=String.prototype.slice;
 Array.prototype.reduce=function(this:unknown[],...args:any[]){if(this[0]===rows[0])reducedRows+=this.length;return Reflect.apply(reduce,this,args);} as typeof reduce;
 const sliceMock=t.mock.method(String.prototype,'slice',function(this:string,...args:Parameters<typeof slice>){const out=Reflect.apply(slice,this,args);if(this.length>=raw.length&&String(this).startsWith('Before [['))copiedCharacters+=out.length;return out;});
 let result:string;try{result=rebaseFragment(raw,fragment,references);}finally{Array.prototype.reduce=reduce;sliceMock.mock.restore();}
 assert.equal(result,rows.map((row,i)=>row.replace(`[[item${i}]]`,`[[folder/item${i}|别名😀]]`)).join('\n'));assert.equal(raw,rows.join('\n'));t.diagnostic(`rebase: ${reducedRows} prefix rows reduced; ${copiedCharacters} source characters copied`);
 assert.ok(reducedRows<=rows.length*2,`visited ${reducedRows} prefix rows`);assert.ok(copiedCharacters<=raw.length*4,`copied ${copiedCharacters} characters`);
});

test('an early native-search hit does not split every line of a large generated index',t=>{
 const board=emptyBoard();board.nodes=[{id:'first',kind:'text',text:'First hit',x:0,y:0,width:100,height:60,color:'green'},{id:'long',kind:'text',text:'Long remaining content\n'.repeat(40000),x:100,y:0,width:100,height:60,color:'green'}];
 const path='白板/Native.thoughtspace',text=boardSearchDocument(board,path,'库'),line=text.split('\n').indexOf('First hit');let splitCharacters=0;const split=String.prototype.split,mock=t.mock.method(String.prototype,'split',function(this:string,...args:Parameters<typeof split>){if(String(this)===text)splitCharacters+=this.length;return Reflect.apply(split,this,args);});
 const target=searchIndexTarget(searchIndexPath(path),text,'库',line);mock.mock.restore();assert.deepEqual(target,{file:path,node:'first'});t.diagnostic(`native search: ${splitCharacters} index characters split`);assert.equal(splitCharacters,0);
});

test('source rebasing retains exact selection, stale-reference protection and newline semantics',()=>{
 const raw='---\r\ntitle: Example\r\n---\r\n\r\nLead 😀 [[same]]\r\nFollow [[same]]\r\n',from=raw.indexOf('Lead'),to=raw.indexOf('Follow'),selected=selectionFragment(raw,from,to),reference={original:'[[same]]',replacement:'[[Folder/same|别名]]',start:{line:4,col:8},end:{line:4,col:16}};
 assert.equal(rebaseFragment(raw,selected,[reference]),'Lead 😀 [[Folder/same|别名]]\r\n');assert.throws(()=>rebaseFragment(raw,selected,[{...reference,original:'[[gone]]'}]),/索引已变化/);
 const fragment=extractFragments(raw).fragments[0];assert.equal(rebaseFragment(raw,fragment,[reference]),'Lead 😀 [[Folder/same|别名]]\nFollow [[same]]');assert.throws(()=>rebaseFragment(raw,{...fragment,body:'stale'},[]),/片段已变化/);
});

test('a 200-fragment import prepares the source once and queries only relevant source links',t=>{
 const rows:string[]=[],references:MaterialReference[]=[];let lineReads=0;
 for(let part=0;part<200;part++){for(let i=0;i<10;i++){const line=rows.length,original=`[[p${part}-${i}]]`;rows.push(`Before ${original} after`);references.push({original,replacement:`[[Folder/p${part}-${i}]]`,start:{get line(){lineReads++;return line;},col:7},end:{line,col:7+original.length}});}rows.push('');}
 const raw=rows.join('\n'),fragments=extractFragments(raw).fragments;let sourceSplits=0;const split=String.prototype.split,mock=t.mock.method(String.prototype,'split',function(this:string,...args:Parameters<typeof split>){if(String(this)===raw)sourceSplits++;return Reflect.apply(split,this,args);});
 const rebase=createFragmentRebaser(raw,references),result=fragments.map(rebase);mock.mock.restore();assert.equal(result.length,200);assert.equal(result[199],fragments[199].body.replace(/\[\[p/g,'[[Folder/p'));t.diagnostic(`batch: ${sourceSplits} source splits; ${lineReads} reference line reads`);assert.equal(sourceSplits,1);assert.ok(lineReads<40000,`read ${lineReads} source-reference positions`);
});

test('overlapping and repeated link metadata keeps its original replacement order',()=>{
 const raw='abcd',fragment=selectionFragment(raw,0,4),base={original:'bc',start:{line:0,col:1},end:{line:0,col:3}},references=[{...base,replacement:'LONG'},{...base,replacement:'Z'}];
 assert.equal(rebaseFragment(raw,fragment,references),'aZNGd');assert.equal(rebaseFragment(raw,{...fragment,selection:undefined,start:1,end:1},references),'aZNGd');
 const inserts=[{original:'',replacement:'X',start:{line:0,col:1},end:{line:0,col:1}},{original:'',replacement:'Y',start:{line:0,col:1},end:{line:0,col:1}}];assert.equal(rebaseFragment(raw,fragment,inserts),'aYXbcd');
});

test('search row validation still falls back to the board before interpreting malformed later links',()=>{
 const path='a.thoughtspace',valid=boardSearchDocument(emptyBoard(),path,'库'),body=valid.slice(valid.indexOf('\n')+1)+'\n[定位 对象](obsidian://thoughtspace?space=库&file=other.thoughtspace&node=wrong)\nTail\n',text=`<!-- thoughtspace-search-v1:${createHash('sha256').update(body).digest('hex')} -->\n${body}`,index=searchIndexPath(path);
 for(const line of [undefined,-1,NaN,Infinity,1.5,1e15])assert.deepEqual(searchIndexTarget(index,text,'库',line),{file:path});
 assert.equal(searchIndexTarget(index,text,'库',text.split('\n').indexOf('Tail')),undefined);assert.equal(searchIndexTarget(index,text+'changed','库',0),undefined);
});
