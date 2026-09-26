import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,type Board,type Card} from '../src/model';
import {createBoardReferenceRenamer} from '../src/board-reference-rename';

const node=(text:string):Card=>({id:'excerpt',kind:'text',text,x:100,y:200,width:320,height:120,color:'sand'});
const board=(text:string):Board=>({...emptyBoard(),version:3,nodes:[node(text)]});
function rewrite(text:string,oldPath:string,newPath:string,paths=[newPath],boardPath='Boards/Study.thoughtspace'){
 const original=board(text),before=structuredClone(original),next=createBoardReferenceRenamer(oldPath,newPath,paths)(original,boardPath);assert.deepEqual(original,before,'Planning must not mutate a loaded or blocked board');return next?.nodes[0].text;
}

test('single note renames preserve wiki aliases, sections and source line locations',()=>{
 const raw='Excerpt\n\n> 来源：[[Sources/Old#Section|Display name]] · 第 3–8 行 · Section';
 assert.equal(rewrite(raw,'Sources/Old.md','Sources/New.md'),raw.replace('Sources/Old#Section','Sources/New.md#Section'));
});
test('unique short source links follow a rename while ambiguous names remain untouched',()=>{
 const raw='Excerpt\n\n> 来源：[[Old|Shown]] · 第 1–2 行';
 assert.equal(rewrite(raw,'Sources/Old.md','Sources/New.md'),raw.replace('[[Old|','[[Sources/New.md|'));
 assert.equal(rewrite(raw,'Sources/Old.md','Sources/New.md',['Sources/New.md','Other/Old.md']),undefined);
});
test('exact vault paths win over nested suffix matches just as native links do',()=>{
 const raw='Excerpt\n\n> 来源：[[Sources/Old]] · 第 1–2 行';
 assert.equal(rewrite(raw,'Sources/Old.md','Sources/New.md',['Sources/New.md','Nested/Sources/Old.md']),raw.replace('[[Sources/Old]]','[[Sources/New.md]]'));
});
test('explicit relative paths disambiguate sources and are rewritten as stable vault paths',()=>{
 const raw='Excerpt\n\n> 来源：[[../Sources/Old#^block-id|Evidence]] · 第 1–2 行';
 assert.equal(rewrite(raw,'Sources/Old.md','Sources/New.md',['Sources/New.md','Other/Old.md']),raw.replace('../Sources/Old#^block-id','Sources/New.md#^block-id'));
});
test('Markdown sources preserve labels and URI encoding without decoding literal percent names twice',()=>{
 const raw='Excerpt\n\n> 来源：[Label](Sources/Note%2520One.md#Section%20One) · 第 1–2 行';
 assert.equal(rewrite(raw,'Sources/Note%20One.md','Archive/New%20Name.md'),raw.replace('Sources/Note%2520One.md','Archive/New%2520Name.md'));
});
test('Markdown angle destinations and encoded PDF fragments retain their original syntax',()=>{
 const raw='Excerpt\n\n> 来源：[PDF](<Sources/Old%20Paper.pdf%23page%3D7>) · PDF 第 7–9 页';
 assert.equal(rewrite(raw,'Sources/Old Paper.pdf','Papers/New Paper.pdf'),raw.replace('Sources/Old%20Paper.pdf','Papers/New%20Paper.pdf'));
});
test('renaming a PDF source preserves literal opening fences and CRLF text',()=>{
 const raw='```r\r\n- literal PDF text\r\n\r\n> 来源：[[Sources/Old.pdf#page=7|Paper]] · PDF 第 7 页\r\n';
 assert.equal(rewrite(raw,'Sources/Old.pdf','Papers/New.pdf'),raw.replace('Sources/Old.pdf','Papers/New.pdf'));
});
test('only generated source lines change while prose, code samples and comments remain exact',()=>{
 const citation='> 来源：[[Sources/Old.pdf#page=2]] · PDF 第 2 页',body='Mention [[Sources/Old.pdf#page=2]]\n\n```md\n'+citation+'\n```\n\n<!--\n'+citation+'\n-->\n\n',raw=body+citation;
 assert.equal(rewrite(raw,'Sources/Old.pdf','Sources/New.pdf'),body+citation.replace('Old.pdf','New.pdf'));
});
test('moving a folder updates source destinations while keeping aliases and source location text',()=>{
 const raw='Excerpt\n\n> 来源：[[Sources/Sub/Old.pdf#page=2|Original]] · PDF 第 2 页';
 assert.equal(rewrite(raw,'Sources','Archive/Sources',['Archive/Sources/Sub/Old.pdf']),raw.replace('Sources/Sub/Old.pdf','Archive/Sources/Sub/Old.pdf'));
});
test('moving the board itself preserves the target of its relative generated source links',()=>{
 const raw='Excerpt\n\n> 来源：[[../Sources/Old.md#Section]] · 第 1–2 行';
 assert.equal(rewrite(raw,'Boards/Study.thoughtspace','Archive/Boards/Study.thoughtspace',['Archive/Boards/Study.thoughtspace','Sources/Old.md'],'Archive/Boards/Study.thoughtspace'),raw.replace('../Sources/Old.md','Sources/Old.md'));
});
test('moving a containing folder reconstructs both old board location and old source paths',()=>{
 const raw='Excerpt\n\n> 来源：[[../Sources/Old.md]] · 第 1–2 行';
 assert.equal(rewrite(raw,'Project','Archive/Project',['Archive/Project/Boards/Study.thoughtspace','Archive/Project/Sources/Old.md'],'Archive/Project/Boards/Study.thoughtspace'),raw.replace('../Sources/Old.md','Archive/Project/Sources/Old.md'));
});
test('missing, malformed and external source targets never guess a replacement',()=>{
 for(const link of ['[[Missing]]','[External](https://example.com/Sources/Old.md)','[Malformed](Sources/Old%ZZ.md)','[[Sources2/Old.md]]']){
  const raw='Excerpt\n\n> 来源：'+link+' · 第 1–2 行';assert.equal(rewrite(raw,'Sources/Old.md','Sources/New.md'),undefined,link);
 }
});
test('reused old paths after a rename are ambiguous and never redirect source citations',()=>{
 const raw='Excerpt\n\n> 来源：[[Sources/Old.md]] · 第 1–2 行';
 assert.equal(rewrite(raw,'Sources/Old.md','Sources/New.md',['Sources/New.md','Sources/Old.md']),undefined);
});
test('draft-only boards follow individual and directory moves without altering writing content',()=>{
 for(const [oldPath,newPath,destination] of [['Drafts/Article.md','Manuscripts/Final.md','Manuscripts/Final.md'],['Drafts','Archive/Drafts','Archive/Drafts/Article.md']]){
  const original:Board={...emptyBoard(),writing:{title:'Article',order:['intro'],draftPath:'Drafts/Article.md',chapters:[{id:'intro',title:'Introduction',body:'Keep [[Drafts/Article.md]]'}],manuscript:'Keep original prose'}},before=structuredClone(original),next=createBoardReferenceRenamer(oldPath,newPath,[destination])(original,'Study.thoughtspace');
  assert.equal(next?.writing?.draftPath,destination);assert.deepEqual(next?.writing,{...before.writing,draftPath:destination});assert.deepEqual(original,before);
 }
});
