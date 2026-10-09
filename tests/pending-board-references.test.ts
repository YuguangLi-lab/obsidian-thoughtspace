import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanPendingBoardReferences,appendPendingBoardReference,removePendingBoardReference,PENDING_BOARD_REFERENCE_LIMIT,PENDING_BOARD_REFERENCE_PATH_LIMIT,type PendingBoardReference,type PendingBoardReferenceCounts} from '../src/pending-board-references';
import {createBoardReferenceRenamer} from '../src/board-reference-rename';
import type {Board} from '../src/model';

const operation=(id='first',changes:Partial<PendingBoardReference>={}):PendingBoardReference=>({id,board:'Boards/Study.md',oldPath:'Notes/A.md',newPath:'Moved/A.md',boardPath:'Boards/Study.md',paths:['Boards/Study.md','Moved/A.md','Other/B.md'],...changes});
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;

test('event-time strings and stable operation IDs round-trip through persisted JSON',()=>{
 const expected=[operation('before-restart')];assert.deepEqual(cleanPendingBoardReferences(JSON.parse(JSON.stringify(expected))),expected);
});
test('the cleaner clones records and paths while discarding cached content and unknown fields',()=>{
 const raw={...operation(),content:'secret note body',layout:{nodes:['not retained']},file:{path:'mutable host object'}},clean=cleanPendingBoardReferences([raw]);
 assert.deepEqual(clean,[operation()]);clean[0].paths.push('Later.md');assert.deepEqual(raw.paths,operation().paths);assert.equal(Object.hasOwn(clean[0],'content'),false);
});
test('absent settings are empty and malformed top-level settings report one rejected value',()=>{
 assert.deepEqual(cleanPendingBoardReferences(undefined),[]);for(const value of [null,{},false,'entry',7]){let seen:PendingBoardReferenceCounts|undefined;assert.deepEqual(cleanPendingBoardReferences(value,count=>{seen=count;}),[]);assert.deepEqual(seen,{invalid:1,duplicates:0,overflow:0});}
});
test('valid entries following malformed and unknown records remain usable and report rejection counts',()=>{
 let counts:PendingBoardReferenceCounts|undefined;const clean=cleanPendingBoardReferences([null,{},operation('safe'),{...operation('missing'),paths:undefined},7],value=>{counts=value;});
 assert.deepEqual(clean,[operation('safe')]);assert.deepEqual(counts,{invalid:4,duplicates:0,overflow:0});
});
test('all required fields must be the records own fields rather than inherited data',()=>{
 const inherited=Object.create(operation()) as PendingBoardReference;assert.deepEqual(cleanPendingBoardReferences([inherited]),[]);
 for(const key of ['id','board','oldPath','newPath','boardPath','paths'] as const){const raw:Record<string,unknown>={...operation()};delete raw[key];assert.deepEqual(cleanPendingBoardReferences([raw]),[],key);}
});
test('throwing required-field getters are rejected while unrelated cached fields are never read',()=>{
 const unread={...operation()};Object.defineProperty(unread,'content',{get(){assert.fail('cached source must never be read');}});assert.deepEqual(cleanPendingBoardReferences([unread]),[operation()]);
 const malformed={...operation()};Object.defineProperty(malformed,'paths',{get(){throw Error('hostile getter');}});let counts:PendingBoardReferenceCounts|undefined;assert.deepEqual(cleanPendingBoardReferences([malformed],value=>{counts=value;}),[]);assert.equal(counts?.invalid,1);
});
test('Unicode names, internal spaces and literal percent or hash filename bytes survive unchanged',()=>{
 const paths=['研究/白板 #1.md','材料/100% 证据.md','notes/%2e%2e.md','__proto__.md','constructor.thoughtspace'];
 const op=operation('unicode',{board:paths[0],boardPath:paths[0],oldPath:paths[1],newPath:'新目录/100% 证据.md',paths});assert.deepEqual(cleanPendingBoardReferences([op]),[op]);
});
for(const bad of ['', '/absolute.md','../outside.md','a/../note.md','./note.md','a/./note.md','a//note.md','a/note.md/','a\\note.md','C:/note.md','file:///note.md','obsidian://open','https://server/note.md',' note.md','note.md ','note.md\n','note\u0000.md','note\u007f.md'])test(`all journal path fields reject unsafe or non-normalized paths: ${JSON.stringify(bad)}`,()=>{
 for(const key of ['board','oldPath','newPath','boardPath'] as const)assert.deepEqual(cleanPendingBoardReferences([operation('bad',{[key]:bad})]),[],key);
 assert.deepEqual(cleanPendingBoardReferences([operation('bad',{paths:['Safe.md',bad]})]),[],'one bad snapshot path rejects the entire operation');
});
test('journal board fields require supported board filename syntax and preserve legacy casing rules',()=>{
 for(const bad of ['Board.txt','Board.THOUGHTSPACE'])for(const key of ['board','boardPath'] as const)assert.deepEqual(cleanPendingBoardReferences([operation('bad',{[key]:bad})]),[]);
 for(const board of ['Boards/Old.thoughtspace','Boards/New.MD'])assert.deepEqual(cleanPendingBoardReferences([operation('valid',{board,boardPath:board})]),[operation('valid',{board,boardPath:board})]);
});
test('journal identifiers reject absent, multiline, padded and excessive values',()=>{
 for(const id of ['', ' padded ','bad\nline','bad\u007f','x'.repeat(257)])assert.deepEqual(cleanPendingBoardReferences([operation(id)]),[]);
 assert.deepEqual(cleanPendingBoardReferences([operation('x'.repeat(256))]),[operation('x'.repeat(256))]);
});
test('no-op rename records and non-string namespace entries are rejected as whole operations',()=>{
 assert.deepEqual(cleanPendingBoardReferences([operation('noop',{newPath:'Notes/A.md'})]),[]);
 assert.deepEqual(cleanPendingBoardReferences([{...operation(),paths:['A.md',null]}]),[]);
 assert.deepEqual(cleanPendingBoardReferences([{...operation(),paths:'A.md'}]),[]);
 assert.deepEqual(cleanPendingBoardReferences([operation('empty',{paths:[]})]),[operation('empty',{paths:[]})]);
});
test('exact operation duplicates keep the first persisted ID and original path order',()=>{
 let counts:PendingBoardReferenceCounts|undefined;const first=operation('stable'),same=operation('new-id'),other=operation('next',{newPath:'Elsewhere/A.md'});
 assert.deepEqual(cleanPendingBoardReferences([first,same,other],value=>{counts=value;}),[first,other]);assert.deepEqual(counts,{invalid:0,duplicates:1,overflow:0});
 const reordered=operation('different-snapshot',{paths:[...first.paths].reverse()});assert.deepEqual(cleanPendingBoardReferences([first,reordered]),[first,reordered]);
});
test('conflicting reuse of a stable ID cannot replace an earlier operation',()=>{
 let counts:PendingBoardReferenceCounts|undefined;const first=operation('stable'),collision=operation('stable',{newPath:'Other/C.md'});
 assert.deepEqual(cleanPendingBoardReferences([first,collision],value=>{counts=value;}),[first]);assert.deepEqual(counts,{invalid:1,duplicates:0,overflow:0});assert.throws(()=>appendPendingBoardReference([first],collision),/标识|ID/);
});
test('cleaning over-capacity saved settings retains the earliest operations and counts every excess record',()=>{
 const raw=Array.from({length:PENDING_BOARD_REFERENCE_LIMIT+3},(_,i)=>operation(`id-${i}`,{newPath:`Moved/Note-${i}.md`}));let counts:PendingBoardReferenceCounts|undefined;
 const clean=cleanPendingBoardReferences(raw,value=>{counts=value;});assert.equal(clean.length,PENDING_BOARD_REFERENCE_LIMIT);assert.equal(clean[0].id,'id-0');assert.equal(clean.at(-1)?.id,'id-999');assert.deepEqual(counts,{invalid:0,duplicates:0,overflow:3});
});
test('snapshot namespaces accept 10000 paths and reject larger snapshots without truncating meaning',()=>{
 const paths=Array.from({length:PENDING_BOARD_REFERENCE_PATH_LIMIT},(_,i)=>`Notes/Note-${i}.md`),max=operation('max',{paths});assert.deepEqual(cleanPendingBoardReferences([max]),[max]);
 let counts:PendingBoardReferenceCounts|undefined;assert.deepEqual(cleanPendingBoardReferences([operation('over',{paths:[...paths,'Extra.md']})],value=>{counts=value;}),[]);assert.deepEqual(counts,{invalid:1,duplicates:0,overflow:0});
});
test('a bounded journal path accepts exactly 4096 characters and rejects oversized strings unchanged',()=>{
 const longest='x'.repeat(4093)+'.md',op=operation('long',{oldPath:longest});assert.equal(longest.length,4096);assert.deepEqual(cleanPendingBoardReferences([op]),[op]);
 assert.deepEqual(cleanPendingBoardReferences([operation('overlong',{oldPath:'x'+longest})]),[]);assert.equal(op.oldPath,longest);
});
test('extremely malformed saved settings have a bounded scan and report unscanned entries as overflow',()=>{
 const raw=Array(20000).fill(null);raw[19999]=operation('too-late');let counts:PendingBoardReferenceCounts|undefined;
 assert.deepEqual(cleanPendingBoardReferences(raw,value=>{counts=value;}),[]);assert.deepEqual(counts,{invalid:8000,duplicates:0,overflow:12000});
});
test('append keeps chronological rename chains, clones event-time strings and never mutates the prior journal',()=>{
 const first=operation('a'),second=operation('b',{oldPath:'Moved/A.md',newPath:'Final/A.md',paths:['Boards/Study.md','Final/A.md']}),before=[first],original=clone(before),next=appendPendingBoardReference(before,second);
 assert.deepEqual(next,[first,second]);second.paths.push('After-event.md');assert.deepEqual(next[1].paths,['Boards/Study.md','Final/A.md']);next[0].paths.push('Not-shared.md');assert.deepEqual(before,original);
});
test('append exact duplicate is idempotent even when a fresh ID was generated',()=>{
 const first=operation('stable');assert.deepEqual(appendPendingBoardReference([first],operation('fresh')),[first]);
});
test('append at capacity explicitly fails instead of evicting a pending rename',()=>{
 const full=Array.from({length:PENDING_BOARD_REFERENCE_LIMIT},(_,i)=>operation(`id-${i}`,{newPath:`Moved/Note-${i}.md`})),before=clone(full);
 assert.throws(()=>appendPendingBoardReference(full,operation('overflow',{newPath:'Moved/Last.md'})),/1000|已满|上限/);assert.deepEqual(full,before);assert.deepEqual(appendPendingBoardReference(full,{...full[0],id:'duplicate-at-capacity'}),full);
});
test('append rejects invalid input and a malformed existing journal rather than quietly dropping pending work',()=>{
 assert.throws(()=>appendPendingBoardReference([],operation('bad',{oldPath:'../outside.md'})),/路径|记录|无效/);
 assert.throws(()=>appendPendingBoardReference([operation('bad',{board:'/outside.md'})],operation('good')),/记录|无效/);
});
test('completion removes only the chosen stable ID and preserves later chained operations',()=>{
 const first=operation('a'),second=operation('b',{oldPath:'Moved/A.md',newPath:'Final/A.md'}),journal=[first,second],before=clone(journal);
 assert.deepEqual(removePendingBoardReference(journal,'a'),[second]);assert.deepEqual(removePendingBoardReference(journal,'missing'),journal);assert.deepEqual(journal,before);
});
test('persisted replay changes only references and preserves graph IDs, same-endpoint edges and original model',()=>{
 const board:Board={version:3,nodes:[{id:'a',kind:'card',file:'Notes/A.md',x:0,y:0,width:200,height:100,color:'blue'},{id:'b',kind:'text',text:'[[Notes/A.md]] ordinary prose',x:300,y:0,width:200,height:100,color:'green'}],edges:[{id:'parent',from:'a',to:'b',label:'父子',kind:'branch'},{id:'relation',from:'a',to:'b',label:'关联',direction:'both'}],viewport:{x:0,y:0,zoom:1}};
 const first=operation('a'),second=operation('b',{oldPath:'Moved/A.md',newPath:'Final/A.md',paths:['Boards/Study.md','Final/A.md']}),journal=cleanPendingBoardReferences(JSON.parse(JSON.stringify([first,second]))),original=clone(board);
 let replay=board;for(const op of journal)replay=createBoardReferenceRenamer(op.oldPath,op.newPath,op.paths)(replay,op.boardPath)||replay;
 assert.equal(replay.nodes[0].file,'Final/A.md');assert.deepEqual(replay.edges,original.edges);assert.deepEqual(replay.nodes.map(n=>n.id),['a','b']);assert.deepEqual(board,original);
});
