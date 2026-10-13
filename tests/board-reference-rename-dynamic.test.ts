import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,type Board,type Card} from '../src/model';
import {paragraphOrigin} from '../src/paragraph-card';
import {createBoardReferenceRenamer} from '../src/board-reference-rename';
import {boardReferenceOccurrences} from '../src/reference-occurrences';

const node=(text:string,id='dynamic'):Card=>({id,kind:'text',text,x:100,y:200,width:320,height:120,color:'sand'});
const board=(...nodes:Card[]):Board=>({...emptyBoard(),version:3,nodes});
function rewrite(raw:string,oldPath='Sources/Old.md',newPath='Sources/New.md',paths=[newPath],boardPath='Boards/Study.thoughtspace'){
 const input=board(node(raw)),before=structuredClone(input),next=createBoardReferenceRenamer(oldPath,newPath,paths)(input,boardPath);assert.deepEqual(input,before,'Rename planning preserves the original board');return next?.nodes[0].text;
}
test('actual two direct cards plus heading/block text stay four physical occurrences across two boards after source rename',()=>{
 const old='Sources/Old.md',next='Sources/New.md',a=board({...node('', 'A1'),kind:'card',text:undefined,file:old},{...node('', 'A2'),kind:'card',text:undefined,file:old},node(`![[${old}#Header|Heading]]\n![[${old}#^shared|Block]]`,'A3')),b=board({...node('','B1'),kind:'card',text:undefined,file:old});
 const before=structuredClone([a,b]),renamer=createBoardReferenceRenamer(old,next,[next,'Boards/A.md','Boards/B.md']);const movedA=renamer(a,'Boards/A.md')!,movedB=renamer(b,'Boards/B.md')!;
 const query=(doc:Board,path:string,source:string)=>boardReferenceOccurrences(doc,path,path,source,link=>link===source?source:undefined);
 assert.equal(query(a,'Boards/A.md',old).length+query(b,'Boards/B.md',old).length,4);const after=[...query(movedA,'Boards/A.md',next),...query(movedB,'Boards/B.md',next)];assert.equal(after.length,4);assert.deepEqual(after.map(item=>item.nodeId),['A1','A2','A3','B1']);assert.deepEqual(after[2].usages.map(usage=>usage.subpath),['#Header','#^shared']);assert.equal(movedA.nodes[2].text,`![[${next}#Header|Heading]]\n![[${next}#^shared|Block]]`);assert.deepEqual([a,b],before);
});
test('whole-note, heading, block, Unicode and aliases retain their exact dynamic syntax',()=>{
 const raw='![[Sources/Old.md]] ![[Sources/Old#第一节|阅读标题]]\n![[Sources/Old.md#^stable-block|  自定别名  ]]';
 assert.equal(rewrite(raw),raw.replaceAll('Sources/Old.md','Sources/New.md').replace('Sources/Old#','Sources/New.md#'));
});
test('Markdown labels, angle destinations and encoded fragments keep their original bytes',()=>{
 const raw='![Heading](Sources/Old%20Note.md#Heading%20One)\n![Block](<Sources/Old%20Note.md#%5Estable>)';
 assert.equal(rewrite(raw,'Sources/Old Note.md','Archive/New Note.md'),raw.replaceAll('Sources/Old%20Note.md','Archive/New%20Note.md'));
});
test('balanced and escaped Markdown destination parentheses resolve without altering display labels',()=>{
 const raw=String.raw`![one](Sources/Old(one).md#Header)\n![two](Sources/Old\(one\).md#^stable)`;
 assert.equal(rewrite(raw,'Sources/Old(one).md','Archive/New(two).md'),'![one](Archive/New%28two%29.md#Header)\\n![two](Archive/New%28two%29.md#^stable)');
});
test('literal encoded hash filenames win over the legacy fully encoded fragment fallback',()=>{
 const raw='![file](Sources/Old%23Name.md#Header)';assert.equal(rewrite(raw,'Sources/Old#Name.md','Archive/New#Name.md',['Archive/New#Name.md','Sources/Old.md']),raw.replace('Sources/Old%23Name.md','Archive/New%23Name.md'));
 const legacy='![older](Sources/Old.md%23%5Estable)';assert.equal(rewrite(legacy),legacy.replace('Sources/Old.md','Sources/New.md'));
});
test('plain prose links, inline code, fenced/indented code, properties and comments remain byte-exact',()=>{
 const sample='![[Sources/Old.md#Header]]',raw=['---','sample: '+sample,'---','ordinary [[Sources/Old.md#Header]] and [label](Sources/Old.md#Header)','`'+sample+'`','```md',sample,'```','    '+sample,'<!-- '+sample+' -->','%% '+sample+' %%','Actual '+sample].join('\r\n');
 assert.equal(rewrite(raw),raw.slice(0,raw.lastIndexOf(sample))+sample.replace('Old.md','New.md'));
});
test('soft-line inline code remains literal while actual embeds after it update',()=>{
 const raw='``before\n![[Sources/Old.md#inside]]\nafter``\n![[Sources/Old.md#outside]]';assert.equal(rewrite(raw),raw.replace('Old.md#outside','New.md#outside'));
});
test('escaped bangs stay literal and an even number of preceding backslashes retains the real embed',()=>{
 const raw=String.raw`\![[Sources/Old.md#escaped]]\n\\![[Sources/Old.md#real]]`;
 assert.equal(rewrite(raw),raw.replace('Old.md#real','New.md#real'));
});
test('several replacements after Unicode and CRLF prefixes retain absolute source offsets and trailing newline',()=>{
 const raw='前言𝌆\r\n![[Sources/Old.md#Header]] + ![[Sources/Old.md#^stable|别名]]\r\n普通 [[Sources/Old.md]]\r\n';assert.equal(rewrite(raw),raw.replace('Old.md#Header','New.md#Header').replace('Old.md#^stable','New.md#^stable'));assert.equal(rewrite(raw)?.endsWith('\r\n'),true);
});
test('only a uniquely resolved short native path updates while ambiguous short embeds stay untouched',()=>{
 assert.equal(rewrite('![[Old#Header|View]]'),'![[Sources/New.md#Header|View]]');assert.equal(rewrite('![[Old#Header]]','Sources/Old.md','Sources/New.md',['Sources/New.md','Other/Old.md']),undefined);
 const mixed='![[Old#Header]] ![[Sources/Old.md#^stable]]';assert.equal(rewrite(mixed,'Sources/Old.md','Sources/New.md',['Sources/New.md','Other/Old.md']),mixed.replace('Sources/Old.md#^stable','Sources/New.md#^stable'));
});
test('complete vault paths win over unrelated suffix matches and relative paths disambiguate same names',()=>{
 const raw='![[Sources/Old#Header]] ![[../Sources/Old.md#^stable|local]]';assert.equal(rewrite(raw,'Sources/Old.md','Sources/New.md',['Sources/New.md','Other/Old.md','Nested/Sources/Old.md']),raw.replace('Sources/Old#Header','Sources/New.md#Header').replace('../Sources/Old.md#^stable','Sources/New.md#^stable'));
});
test('missing, malformed, external and root-escaping embeds do not guess a new destination',()=>{
 for(const raw of ['![[Missing#Header]]','![remote](https://example.com/Sources/Old.md#Header)','![file](file:///Sources/Old.md#Header)','![app](obsidian://open?file=Sources/Old.md)','![bad](Sources/Old%ZZ.md#Header)','![[/Sources/Old.md]]','![[../../../Sources/Old.md#Header]]','![[Sources2/Old.md#Header]]'])assert.equal(rewrite(raw),undefined,raw);
});
test('a reused old source path remains ambiguous and is never redirected to the renamed file',()=>{
 assert.equal(rewrite('![[Sources/Old.md#Header]]','Sources/Old.md','Sources/New.md',['Sources/New.md','Sources/Old.md']),undefined);
});
test('moving only the board rebases its dynamic relative embeds to stable source vault paths',()=>{
 const raw='![[../Sources/Old.md#Header|Same source]]\n![Block](../Sources/Old.md#%5Estable)';
 assert.equal(rewrite(raw,'Boards/Study.thoughtspace','Archive/Boards/Study.thoughtspace',['Archive/Boards/Study.thoughtspace','Sources/Old.md'],'Archive/Boards/Study.thoughtspace'),raw.replaceAll('../Sources/Old.md','Sources/Old.md'));
});
test('moving a containing folder rebases board and source together and keeps surrounding prose unchanged',()=>{
 const raw='Ordinary [[../Sources/Old.md]]\n![[../Sources/Old.md#Header]]';assert.equal(rewrite(raw,'Project','Archive/Project',['Archive/Project/Boards/Study.md','Archive/Project/Sources/Old.md'],'Archive/Project/Boards/Study.md'),raw.replace('![[../Sources/Old.md','![[Archive/Project/Sources/Old.md'));
});
test('paragraph snapshot rendered links and provenance follow rename while original quote, hash and code stay exact',()=>{
 const source='Copied ![[Sources/Old.md#Header]]',examples='`![[Sources/Old.md#Header]]`\n\n```md\n![[Sources/Old.md#Header]]\n```\n\n<!-- ![[Sources/Old.md#Header]] -->\n\n',raw=examples+source+'\n\n> 来源：[[Sources/Old.md]] · 第 1–1 行',origin=paragraphOrigin('Sources/Old.md',source,{label:'all',from:0,to:source.length},'snapshot'),original=board({...node(raw),paragraphQuote:origin}),before=structuredClone(original),next=createBoardReferenceRenamer('Sources/Old.md','Sources/New.md',['Sources/New.md'])(original,'Boards/Study.md')!;
 assert.equal(next.nodes[0].text,examples+source.replace('Old.md','New.md')+'\n\n> 来源：[[Sources/New.md]] · 第 1–1 行');assert.deepEqual(next.nodes[0].paragraphQuote,{...origin,path:'Sources/New.md'});assert.deepEqual(original,before);
});
test('PDF rendered embeds and footer follow rename while original clipboard, code and comments stay exact',()=>{
 const source='Imported ![[Sources/Old.pdf#page=2&rect=72,430,312,530&opaque=a%26b]]',examples='`![[Sources/Old.pdf#page=2]]`\n\n```md\n![[Sources/Old.pdf#page=2]]\n```\n\n<!-- ![[Sources/Old.pdf#page=2]] -->\n\n',raw=examples+source+'\n\n> 来源：[[Sources/Old.pdf#page=2]] · PDF 第 2 页',original=board({...node(raw),pdfQuote:{original:source,sourcePath:'Sources/Old.pdf'}}),before=structuredClone(original),next=createBoardReferenceRenamer('Sources/Old.pdf','Sources/New.pdf',['Sources/New.pdf'])(original,'Boards/Study.md')!;
 assert.equal(next.nodes[0].text,examples+source.replace('Old.pdf','New.pdf')+'\n\n> 来源：[[Sources/New.pdf#page=2]] · PDF 第 2 页');assert.deepEqual(next.nodes[0].pdfQuote,original.nodes[0].pdfQuote);assert.deepEqual(original,before);
});
test('dynamic paragraph origin and explicit heading or block token retain one matching occurrence after rename',()=>{
 for(const subpath of ['#Header','#^shared']){
  const text=`![[Sources/Old.md${subpath}|Read]]`,origin=paragraphOrigin('Sources/Old.md','original',{label:'verified',from:0,to:8,subpath},'embed'),original=board({...node(text),paragraphQuote:origin}),before=structuredClone(original),next=createBoardReferenceRenamer('Sources/Old.md','Sources/New.md',['Sources/New.md'])(original,'Boards/Study.md')!;
  assert.equal(next.nodes[0].text,`![[Sources/New.md${subpath}|Read]]`);assert.deepEqual(next.nodes[0].paragraphQuote,{path:'Sources/New.md',subpath,mode:'embed'});const usages=boardReferenceOccurrences(next,'Boards/Study.md','Study','Sources/New.md',path=>path==='Sources/New.md'?path:undefined);assert.equal(usages.length,1);assert.equal(usages[0].usages.length,1);assert.equal(usages[0].usages[0].subpath,subpath);assert.equal(usages[0].usages[0].mode,'embed');assert.deepEqual(original,before);
 }
});
test('dynamic paragraph metadata moves without rewriting a body edited into ordinary prose links',()=>{
 const text='Independent prose [[Sources/Old.md#Header]] and [Read](Sources/Old.md#^shared)',original=board({...node(text),paragraphQuote:{path:'Sources/Old.md',subpath:'#Header',mode:'embed'}}),before=structuredClone(original),next=createBoardReferenceRenamer('Sources/Old.md','Sources/New.md',['Sources/New.md'])(original,'Boards/Study.md')!;
 assert.equal(next.nodes[0].text,text);assert.deepEqual(next.nodes[0].paragraphQuote,{path:'Sources/New.md',subpath:'#Header',mode:'embed'});assert.deepEqual(original,before);
});
test('unchanged unrelated embeds preserve the node reference and yield no rename transaction',()=>{
 const original=board(node('![[Other/Note.md#Header]]')),before=structuredClone(original);assert.equal(createBoardReferenceRenamer('Sources/Old.md','Sources/New.md',['Sources/New.md','Other/Note.md'])(original,'Boards/Study.md'),undefined);assert.deepEqual(original,before);
});
