import {createBoardReferenceRenamer} from '../src/board-reference-rename';
import test from 'node:test';
import assert from 'node:assert/strict';
import {planPdfQuote,pdfQuoteLocation,pdfQuoteFragment,resolvePdfQuotePath,samePdfQuote} from '../src/pdf-quote';
import {textExcerptPresentation,sourceLinkParts} from '../src/excerpt-sources';
import {emptyBoard,History,parseBoard,type Card} from '../src/model';
const resolve=(path:string)=>path;
test('PDF++ selection, color and unknown fragment parameters survive exactly',()=>{
 const raw='> [!quote] Evidence\n> Copied words\n> [[资料/论文 (一).pdf#page=2&selection=4,0,5,20&color=custom&future=a%26b|p.2]]';
 const plan=planPdfQuote(raw,'',resolve);assert.equal(plan.origin.original,raw);assert.equal(plan.links[0].fragment,'#page=2&selection=4,0,5,20&color=custom&future=a%26b');assert.equal(plan.links[0].kind,'文字选区');assert.ok(plan.text.includes('[!quote] Evidence'));
 const source=textExcerptPresentation(plan.text).sources[0];assert.equal(source.page,2);assert.ok(source.link.includes('future=a%26b'));assert.equal(pdfQuoteFragment(source.link),plan.links[0].fragment);assert.equal(sourceLinkParts(source.link)[0].path,'资料/论文 (一).pdf');
});
test('annotation identifiers stay opaque and rectangle embeds retain bang and coordinates',()=>{
 for(const [raw,kind] of [['[[a.pdf#page=1&annotation=123R]]','批注'],['![[a.pdf#page=3&rect=300,200,700,600&width=300]]','矩形摘录']]){const p=planPdfQuote(raw,'',resolve);assert.equal(p.links[0].kind,kind);if(raw.startsWith('!'))assert.ok(p.text.startsWith('!['));}
});
test('Markdown encoded paths, angle destinations and titles are accepted',()=>{
 for(const link of ['[Paper](资料/论文%20(一).pdf#page=1)','[Paper](<资料/论文 (一).pdf#page=1> "Title")'])assert.equal(planPdfQuote(link,'',resolve).links[0].path,'资料/论文 (一).pdf');
});
test('page-only PDF links default to page one',()=>{assert.equal(planPdfQuote('[[a.pdf]]','',resolve).links[0].page,1);assert.ok(planPdfQuote('[[a.pdf]]','',resolve).text.includes('#page=1'));});
test('note block sources are independently resolved with explicit context',()=>{
 const seen:string[][]=[],p=planPdfQuote('[[a.pdf#page=2&annotation=ABC]]\n\n[[Notes/Paper notes#^quote-123]]','Notes/Reading.md',(path,context)=>{seen.push([path,context]);return path==='a.pdf'?'PDF/a.pdf':path+'.md';});
 assert.equal(p.links.length,1);assert.ok(p.text.includes('Notes/Paper%20notes.md#^quote-123'));assert.ok(!p.links[0].fragment.includes('quote-123'));assert.ok(seen.every(([,context])=>context==='Notes/Reading.md'));
});
test('multiple and repeated references keep distinct locations without duplicated source footers',()=>{const p=planPdfQuote('[[a.pdf#page=1]] [[a.pdf#page=1]] [[a.pdf#page=2]]','',resolve);assert.equal(p.links.length,2);assert.equal(textExcerptPresentation(p.text).sources.length,2);});
test('basename ambiguity requires explicit context and never calls arbitrary resolution',()=>{
 const files=['One/a.pdf','Two/a.pdf'];let called=false;assert.throws(()=>resolvePdfQuotePath('a.pdf','',files,()=>{called=true;return files[0];}),/同名/);assert.equal(called,false);
 assert.equal(resolvePdfQuotePath('a.pdf','Two/note.md',files,()=>files[1]),files[1]);assert.equal(resolvePdfQuotePath('One/a.pdf','',files,()=>files[0]),files[0]);
});
test('missing files, vault escapes and unsafe schemes cannot become sources',()=>{
 for(const path of ['javascript:alert(1)','file:///a.pdf','/tmp/a.pdf','C:\\a.pdf','\\a.pdf'])assert.throws(()=>resolvePdfQuotePath(path,'',[],()=>undefined));
 assert.throws(()=>resolvePdfQuotePath('../a.pdf','',[],()=>'/outside/a.pdf'),/找不到/);
 for(const raw of ['[x](javascript:alert(1)) [[a.pdf]]','[[https://host/a.pdf#page=1]]','[[obsidian://open/a.pdf]]','[x](data:text/html,test) [[a.pdf]]'])assert.throws(()=>planPdfQuote(raw,'',resolve));
});
test('malformed known PDF coordinates are rejected rather than silently repaired',()=>{
 for(const f of ['#page=','#page=0','#page=1.1','#page=Infinity','#page=1&page=2','#selection=1,2,3','#selection=1,-2,3,4','#selection=4,0,3,2','#selection=4,8,4,2','#rect=1,2,1,4','#rect=0,0,NaN,1','#annotation=','#width=0','#offset=1,2'])assert.throws(()=>pdfQuoteLocation(f),f);
});
test('unknown color remains unstyled and valid offset parameters remain unchanged',()=>{const p=planPdfQuote('[[a.pdf#page=4&offset=-2,200,1.5&color=unrecognized]]','',resolve);assert.equal(p.links[0].fragment,'#page=4&offset=-2,200,1.5&color=unrecognized');assert.equal(p.links[0].kind,'页码');});
test('payload, number of links and fragment budgets are bounded',()=>{
 assert.throws(()=>planPdfQuote('x'.repeat(100001),'',resolve));assert.throws(()=>planPdfQuote('[[a.pdf]]'.repeat(101),'',resolve));assert.throws(()=>planPdfQuote(Array.from({length:21},(_,i)=>`[[a.pdf#page=${i+1}]]`).join('\n'),'',resolve));assert.throws(()=>pdfQuoteLocation('#x='+'a'.repeat(2050)));
});
test('non-PDF input is not imported and original CRLF text is lossless',()=>{assert.throws(()=>planPdfQuote('ordinary text','',resolve));const raw='> note\r\n[[a.pdf#page=1]]\r\n';assert.equal(planPdfQuote(raw,'',resolve).origin.original,raw);});
test('quote provenance survives board serialization and a single undo/redo',()=>{
 const p=planPdfQuote('[[a.pdf#page=2&annotation=123R]]','',resolve),before=emptyBoard(),history=new History();history.push(before);const node:Card={id:'pdf-quote',kind:'text',text:p.text,pdfQuote:p.origin,x:0,y:0,width:320,height:180,color:'sand'};const after={...before,version:3 as const,nodes:[node]};const restored=parseBoard(JSON.stringify(after));assert.deepEqual(restored.nodes[0].pdfQuote,p.origin);const undo=history.undo(restored)!;assert.equal(undo.nodes.length,0);assert.deepEqual(history.redo(undo)?.nodes[0],node);
});
test('invalid provenance cannot enter a board',()=>{const board=emptyBoard();board.nodes=[{id:'x',kind:'text',text:'',x:0,y:0,width:100,height:100,color:'sand',pdfQuote:{original:'x',sourcePath:'bad\npath'}}];assert.throws(()=>parseBoard(JSON.stringify(board)));});

test('complete vault paths take precedence over nested suffixes',()=>{assert.equal(resolvePdfQuotePath('One/a.pdf','',['One/a.pdf','Nested/One/a.pdf'],()=>undefined),'One/a.pdf');});

test('equivalent wiki and Markdown imports each preserve their original clipboard syntax',()=>{const wiki=planPdfQuote('[[a.pdf#page=1|Paper]]','',resolve),markdown=planPdfQuote('[Paper](a.pdf#page=1)','',resolve),node={text:wiki.text,pdfQuote:wiki.origin};assert.equal(wiki.text,markdown.text);assert.equal(samePdfQuote(node,wiki),true);assert.equal(samePdfQuote(node,markdown),false);assert.equal(samePdfQuote(node,{...wiki,origin:{...wiki.origin,sourcePath:'Notes/A.md'}}),false);});

test('PDF quote embeds and source links follow rename while original clipboard text stays exact',()=>{const raw='![[old.pdf#page=2&rect=72,430,312,530&width=240&opaque=a%26b]]',plan=planPdfQuote(raw,'',resolve),board=emptyBoard();board.version=3;board.nodes=[{id:'quote',kind:'text',text:plan.text,pdfQuote:plan.origin,x:0,y:0,width:320,height:180,color:'sand'}];const renamed=createBoardReferenceRenamer('old.pdf','新 路径/new.pdf',['新 路径/new.pdf'])(board,'board.thoughtspace')!;const node=renamed.nodes[0];assert.equal(node.pdfQuote?.original,raw);assert.equal((node.text!.match(/#page=2&rect=72,430,312,530&width=240&opaque=a%26b/g)||[]).length,2);assert.ok(!node.text!.includes('<old.pdf'));assert.ok(node.text!.startsWith('![old.pdf](<%E6%96%B0%20%E8%B7%AF%E5%BE%84/new.pdf#'));});
test('PDF quote rename preserves code and comment examples',()=>{const plan=planPdfQuote('[[old.pdf#page=2]]','',resolve),literal='`[[old.pdf#page=2]]`\n\n```md\n[[old.pdf#page=2]]\n```\n\n<!-- [[old.pdf#page=2]] -->\n\n',board=emptyBoard();board.version=3;board.nodes=[{id:'q',kind:'text',text:literal+plan.text,pdfQuote:plan.origin,x:0,y:0,width:320,height:180,color:'sand'}];const node=createBoardReferenceRenamer('old.pdf','new.pdf',['new.pdf'])(board,'board.thoughtspace')!.nodes[0];assert.ok(node.text!.startsWith(literal));assert.ok(node.text!.slice(literal.length).includes('<new.pdf#page=2>'));});
