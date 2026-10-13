import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,type Card} from '../src/model';
import {paragraphOrigin} from '../src/paragraph-card';
import {boardReferenceOccurrences,referenceOccurrenceGroups,referenceOccurrenceStamp,validateReferenceOccurrence,ReferenceOccurrenceLimitError,ReferenceOccurrenceTrail,ReferenceOccurrenceNavigationCancelled,type ReferenceOccurrence,type ReferenceOccurrenceTrailHost} from '../src/reference-occurrences';

const card=(id:string,file='Sources/A.md',x=0,y=0):Card=>({id,kind:'card',file,x,y,width:100,height:80,color:'slate'});
const text=(id:string,value:string):Card=>({...card(id),kind:'text',file:undefined,text:value});
const section=(id:string,title:string,x:number,y:number,width:number,height:number):Card=>({id,title,kind:'section',x,y,width,height,color:'slate'});
const board=(...nodes:Card[])=>({...emptyBoard(),nodes});
const resolve=(path:string)=>({'A':'Sources/A.md','A.md':'Sources/A.md','Sources/A.md':'Sources/A.md','B':'Sources/B.md'} as Record<string,string>)[path];
const query=(...nodes:Card[])=>boardReferenceOccurrences(board(...nodes),'Boards/topic.md','主题','Sources/A.md',resolve);

test('same source appears as independent instances on the same board and across boards',()=>{
 const one=query(card('first'),card('second')),two=boardReferenceOccurrences(board(card('first')),'Boards/other.thoughtspace','另一个','Sources/A.md',resolve);
 assert.deepEqual(one.map(item=>item.nodeId),['first','second']);assert.equal(new Set([...one,...two].map(item=>item.key)).size,3);assert.equal(one[0].sourcePath,'Sources/A.md');
});
test('several headings and blocks in one card have one row and distinct descriptors',()=>{
 const items=query(text('a','![[A#First]] ![[A#Second]] ![[A#^stable]]'),text('b','![[A#First]]'));
 assert.equal(items.length,2);assert.deepEqual(items[0].usages.map(usage=>usage.subpath),['#First','#Second','#^stable']);assert.equal(items[1].usages.length,1);
});
test('aliases deduplicate inside a card without collapsing other physical cards',()=>{
 const items=query(text('a','![[A#First|one]] ![[A.md#First|two]]'),text('b','![[A#First]]'));
 assert.equal(items.length,2);assert.equal(items[0].usages.length,1);assert.notEqual(items[0].key,items[1].key);
});
test('ordinary outgoing links, code, hidden comments and properties are not occurrences',()=>{
 const raw=['---','example: ![[A]]','---','[[A]] [A](A.md)','`![[A#inline]]`','```md','![[A#fence]]','```','<!-- ![[A#comment]] -->','%% ![[A#hidden]] %%','\\![[A#escaped]]'].join('\n');
 assert.deepEqual(query(text('ignored',raw)),[]);
});
test('explicit snapshot origin remains the source after body/footer edits',()=>{
 const item=query({...text('quote','Edited\n\n> 来源：[[B]] · 第 1–2 行'),paragraphQuote:paragraphOrigin('Sources/A.md','first\n\nsecond',{label:'second',from:7,to:13},'snapshot')})[0];
 assert.equal(item.usages.length,1);assert.equal(item.usages[0].mode,'snapshot');assert.equal(item.usages[0].location,'字符 7–13');
});
test('native excerpt card citations are read beside that card, not inferred from its outgoing links',()=>{
 const node=card('excerpt','Cards/excerpt.md'),contexts:string[]=[];
 const source=boardReferenceOccurrences(board(node),'Boards/B.md','B','Sources/A.md',(path,context)=>{contexts.push(context);return path==='../Sources/A.md'&&context===node.file?'Sources/A.md':undefined;},new Map([[node.file!,'body\n\n> 来源：[A](../Sources/A.md#Heading) · 第 2–3 行\n\n[[A]]']]));
 assert.equal(source.length,1);assert.equal(source[0].usages[0].mode,'snapshot');assert.equal(source[0].usages[0].subpath,'#Heading');assert.ok(contexts.every(context=>context==='Cards/excerpt.md'));
 assert.deepEqual(boardReferenceOccurrences(board(node),'Boards/B.md','B','Sources/A.md',resolve),[]);
});
test('groups present outer-to-inner names and include folded ancestors without mutating them',()=>{
 const outer={...section('outer','研究',-50,-80,800,700),sectionFolded:true},inner=section('inner','证据',-20,-40,300,250),node=card('a');
 const b=board(outer,inner,node),before=JSON.stringify(b),item=boardReferenceOccurrences(b,'B.md','B','Sources/A.md',resolve)[0];
 assert.deepEqual(item.groupPaths,[['研究','证据']]);assert.deepEqual(new Set(item.groupIds),new Set(['outer','inner']));assert.equal(referenceOccurrenceGroups(item),'研究 › 证据');assert.equal(JSON.stringify(b),before);
});
test('independent overlapping and coincident frames do not become a false hierarchy',()=>{
 const item=query(section('right','右侧',-40,-20,400,180),section('left','左侧',-20,-40,300,200),section('same1','同时一',0,0,100,80),section('same2','同时二',0,0,100,80),card('a'))[0];
 const labels=item.groupPaths.map(path=>path.join(' › '));assert.ok(labels.some(label=>label.endsWith('同时一')));assert.ok(labels.some(label=>label.endsWith('同时二')));assert.ok(!labels.some(label=>label.includes('同时一 › 同时二')||label.includes('同时二 › 同时一')));
});
test('ungrouped objects have an explicit label and long names remain intact',()=>{
 const node={...card('a'),title:'研究'.repeat(150)};const item=query(node)[0];assert.equal(item.nodeTitle,node.title);assert.deepEqual(item.groupPaths,[]);assert.equal(referenceOccurrenceGroups(item),'未分组');
});
test('stamps retain exact reference data while geometry and display title changes stay locatable',()=>{
 const node=card('a'),b=board(node),item=query(node)[0];node.x=450;node.width=180;node.title='新的展示名称';
 assert.equal(referenceOccurrenceStamp(node),item.nodeStamp);assert.equal(validateReferenceOccurrence(b,item,'Sources/A.md',resolve),true);
});
test('a deleted or source-replaced node cannot be navigated using a stale result',()=>{
 const node=card('a'),item=query(node)[0];assert.equal(validateReferenceOccurrence(board(),item,'Sources/A.md',resolve),false);
 assert.equal(validateReferenceOccurrence(board(card('a','Sources/B.md')),item,'Sources/A.md',resolve),false);
 assert.equal(validateReferenceOccurrence(board({...node,kind:'text',file:undefined,text:'![[A]]'}),item,'Sources/A.md',resolve),false);
});
test('changed text or quote provenance invalidates the captured occurrence',()=>{
 const node=text('a','![[A#First]]'),item=query(node)[0];node.text='![[A#Second]]';assert.equal(validateReferenceOccurrence(board(node),item,'Sources/A.md',resolve),false);
 const quote={...text('q','same'),paragraphQuote:paragraphOrigin('Sources/A.md','first second',{label:'first',from:0,to:5},'snapshot')},captured=query(quote)[0];quote.paragraphQuote=paragraphOrigin('Sources/A.md','first second',{label:'second',from:6,to:12},'snapshot');assert.equal(validateReferenceOccurrence(board(quote),captured,'Sources/A.md',resolve),false);
});
test('a resolver change, native citation removal or source rename invalidates stale descriptors',()=>{
 const node=text('a','![[A#First]]'),item=query(node)[0];assert.equal(validateReferenceOccurrence(board(node),item,'Sources/A.md',()=> 'Sources/B.md'),false);assert.equal(validateReferenceOccurrence(board(node),item,'Renamed/A.md',resolve),false);
 const excerpt=card('q','Cards/excerpt.md'),texts=new Map([[excerpt.file!,'body\n\n> 来源：[[A]] · 第 1–1 行']]),captured=boardReferenceOccurrences(board(excerpt),'B.md','B','Sources/A.md',resolve,texts)[0];texts.set(excerpt.file!,'body without provenance');assert.equal(validateReferenceOccurrence(board(excerpt),captured,'Sources/A.md',resolve,texts),false);
});
test('freshly renamed sources use fresh path and identity without altering card contents',()=>{
 const b=board(card('a','Moved/A.md'));const before=JSON.stringify(b),item=boardReferenceOccurrences(b,'Moved/B.md','改名后的白板','Moved/A.md',path=>path)[0];assert.equal(item.sourcePath,'Moved/A.md');assert.equal(item.boardPath,'Moved/B.md');assert.equal(validateReferenceOccurrence(b,item,'Moved/A.md',path=>path),true);assert.equal(JSON.stringify(b),before);
});
test('query results own immutable descriptors independent of later caller edits',()=>{
 const node=card('a'),b=board(node),item=query(node)[0],before=JSON.stringify(item);node.file='Sources/B.md';node.title='changed';b.nodes=[];assert.equal(JSON.stringify(item),before);
});
test('a thousand card instances survive query and validation without combining node IDs',()=>{
 const b=board(...Array.from({length:1000},(_,index)=>card(String(index),'Sources/A.md',index*120,0))),items=boardReferenceOccurrences(b,'Large.md','大型','Sources/A.md',resolve);
 assert.equal(items.length,1000);assert.equal(new Set(items.map(item=>item.key)).size,1000);assert.equal(validateReferenceOccurrence(b,items[999],'Sources/A.md',resolve),true);
});
test('bounded queries refuse oversized inputs explicitly, with no partial list or mutation',()=>{
 const b=board(card('a'),card('b')),before=JSON.stringify(b);
 assert.throws(()=>boardReferenceOccurrences(b,'B.md','B','Sources/A.md',resolve,undefined,{nodes:1,characters:1000,groupWork:1000}),ReferenceOccurrenceLimitError);
 assert.throws(()=>boardReferenceOccurrences(b,'B.md','B','Sources/A.md',resolve,new Map([['Other.md','x'.repeat(100)]]),{nodes:100,characters:40,groupWork:1000}),ReferenceOccurrenceLimitError);
 assert.throws(()=>boardReferenceOccurrences(board(section('g','group',-20,-30,300,200),card('a')),'B.md','B','Sources/A.md',resolve,undefined,{nodes:100,characters:1000,groupWork:0}),ReferenceOccurrenceLimitError);assert.equal(JSON.stringify(b),before);
});

function trailFixture(){
 const items=query(card('a'),card('b'),card('c')),calls:{item:ReferenceOccurrence;index:number;current:()=>boolean}[]=[];let live=true,returns=0;
 let locate:ReferenceOccurrenceTrailHost['locate']=async(item,index,current)=>{calls.push({item,index,current});};let back:ReferenceOccurrenceTrailHost['returnToOrigin']=async()=>{returns++;};
 const trail=new ReferenceOccurrenceTrail(items,0,{current:()=>live,locate:(...args)=>locate(...args),returnToOrigin:current=>back(current)});
 return {trail,items,calls,returns:()=>returns,setCurrent:(next:boolean)=>{live=next;},setLocate:(next:ReferenceOccurrenceTrailHost['locate'])=>{locate=next;},setReturn:(next:ReferenceOccurrenceTrailHost['returnToOrigin'])=>{back=next;}};
}
test('trail navigates exact instance serially and returns to origin only on successful action',async()=>{
 const f=trailFixture();assert.equal(await f.trail.go(1),true);assert.equal(f.trail.index,1);assert.equal(f.calls[0].item.nodeId,'b');assert.equal(f.calls[0].current(),true);assert.equal(await f.trail.go(2),true);assert.equal(f.trail.index,2);assert.equal(await f.trail.returnToOrigin(),true);assert.equal(f.returns(),1);assert.equal(f.trail.active,false);
});
test('trail boundaries do not wrap or navigate an invented occurrence',async()=>{
 const f=trailFixture();for(const index of [-1,3,NaN,0.5])assert.equal(await f.trail.go(index),false);assert.equal(f.calls.length,0);assert.throws(()=>new ReferenceOccurrenceTrail([],0,{current:()=>true,locate:async()=>{},returnToOrigin:async()=>{}}));
});
test('rapid repeated previous/next/return clicks cannot launch a second asynchronous navigation',async()=>{
 const f=trailFixture();let finish!:()=>void;f.setLocate(async()=>new Promise<void>(resolve=>{finish=resolve;}));const run=f.trail.go(1);assert.equal(f.trail.pending,true);assert.equal(await f.trail.go(2),false);assert.equal(await f.trail.returnToOrigin(),false);finish();assert.equal(await run,true);assert.equal(f.trail.index,1);assert.equal(f.returns(),0);
});
test('explicit close while read is pending invalidates its late navigation and does not advance index',async()=>{
 const f=trailFixture();let finish!:()=>void,current!:()=>boolean;f.setLocate(async(_item,_index,guard)=>{current=guard;await new Promise<void>(resolve=>{finish=resolve;});});const run=f.trail.go(1);f.trail.cancel();assert.equal(current(),false);finish();await assert.rejects(run,ReferenceOccurrenceNavigationCancelled);assert.equal(f.trail.index,0);assert.equal(f.trail.pending,false);
});
test('away-and-return remains cancelled through the host monotonic ownership token',async()=>{
 const f=trailFixture();let finish!:()=>void,epoch=0;const captured=epoch,trail=new ReferenceOccurrenceTrail(f.items,0,{current:()=>epoch===captured,locate:async()=>new Promise<void>(resolve=>{finish=resolve;}),returnToOrigin:async()=>{}});
 const run=trail.go(2);epoch++;finish();await assert.rejects(run,ReferenceOccurrenceNavigationCancelled);assert.equal(trail.index,0);await assert.rejects(trail.go(1),ReferenceOccurrenceNavigationCancelled);
});
test('failed target validation keeps index and return context available for a later valid target',async()=>{
 const f=trailFixture();f.setLocate(async()=>{throw Error('target removed');});await assert.rejects(f.trail.go(1),/target removed/);assert.equal(f.trail.index,0);assert.equal(f.trail.active,true);f.setLocate(async()=>{});assert.equal(await f.trail.go(2),true);assert.equal(f.trail.index,2);
});
test('failed return preserves navigation and never dismisses the origin snapshot',async()=>{
 const f=trailFixture();f.setReturn(async()=>{throw Error('inline save failed');});await assert.rejects(f.trail.returnToOrigin(),/inline save failed/);assert.equal(f.trail.active,true);assert.equal(f.trail.pending,false);assert.equal(f.trail.index,0);
});
test('observer cleanup and trail copies are independent of source rows and group arrays',async()=>{
 const f=trailFixture(),before=f.trail.items[0].nodeTitle;f.items[0].nodeTitle='caller changed';f.items[0].usages[0].location='changed';assert.equal(f.trail.items[0].nodeTitle,before);assert.equal(f.trail.items[0].usages[0].location,'整篇笔记');let changes=0;const stop=f.trail.subscribe(()=>changes++);await f.trail.go(1);assert.equal(changes,2);stop();await f.trail.go(2);assert.equal(changes,2);
});
