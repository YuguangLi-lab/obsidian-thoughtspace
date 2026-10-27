import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWritingSourceCheck,compareWritingSource,validWritingSourceChecks,appendWritingSourceChecks} from '../src/writing-source-check';
import {emptyBoard,parseBoard} from '../src/model';
import {validateSource} from '../tools/board-tool/index';
const raw='first\nselected text\nlast',quote='> selected text\n\n来源：[[Source.md]]';
const make=()=>makeWritingSourceCheck({nodeId:'source-card',kind:'note',path:'Notes/Source.md',ctime:123},raw,6,19,quote);
test('new source baselines survive board roundtrips while old writing has none inferred',()=>{
 const board=emptyBoard();board.writing={title:'article',order:[],manuscript:quote,sourceChecks:[make()]};
 const parsed=parseBoard(JSON.stringify(board));assert.deepEqual(parsed.writing?.sourceChecks,board.writing.sourceChecks);
 delete board.writing.sourceChecks;assert.equal(parseBoard(JSON.stringify(board)).writing?.sourceChecks,undefined);
});
test('standalone historical CLI snapshot preserves the additive source ledger without changing the input',async()=>{
 const board=emptyBoard();board.writing={title:'article',order:[],manuscript:quote,sourceChecks:[make()]};const raw=JSON.stringify(board),result=await validateSource(raw,'thoughtspace');
 assert.equal(result.report.format.status,'passed');assert.deepEqual((result.board?.writing as unknown as {sourceChecks:unknown}).sourceChecks,board.writing.sourceChecks);assert.deepEqual(JSON.parse(raw),board);
});
test('source comparisons are read-only and distinguish content changes, replacement and detached quotes',()=>{
 const baseline=make(),before=JSON.stringify(baseline);assert.equal(compareWritingSource(baseline,raw,123,quote).state,'same');
 assert.equal(compareWritingSource(baseline,raw+' changed elsewhere',123,quote).state,'changed');
 assert.equal(compareWritingSource(baseline,raw.replace('selected','rewritten'),123,quote).state,'changed');
 assert.equal(compareWritingSource(baseline,raw,999,quote).state,'unknown');
 assert.equal(compareWritingSource(baseline,raw,123,'user rewrote the entire article').state,'detached');assert.equal(JSON.stringify(baseline),before);
});
test('source check data rejects invalid paths, versions, hashes, ranges and unbounded previews',()=>{
 for(const patch of [{version:2},{path:'../outside.md'},{sourceHash:'bad'},{to:-1},{ctime:NaN},{preview:'x'.repeat(2001)}])assert.equal(validWritingSourceChecks([{...make(),...patch}]),false);
 const a=make();assert.equal(validWritingSourceChecks([a,a]),false);assert.throws(()=>makeWritingSourceCheck({nodeId:'x',kind:'note',path:'source.md',ctime:0},raw,0,raw.length+1,quote));
});
test('identical trusted baselines are deduplicated without mutating the previous ledger',()=>{
 const a=make(),b=make(),previous=[a];assert.equal(appendWritingSourceChecks(previous,[b]).length,1);assert.equal(previous.length,1);assert.equal(previous[0],a);
});
test('long source previews stay bounded and text-card sources use explicit card identity',()=>{
 const text='x'.repeat(5000),entry=makeWritingSourceCheck({nodeId:'text-card',kind:'text',path:'Board.md',ctime:0},text,0,5000,'rendered quote');
 assert.equal(entry.preview.length,2000);assert.equal(compareWritingSource(entry,text,123,'rendered quote').state,'same');
});
