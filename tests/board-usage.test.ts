import test from 'node:test';
import assert from 'node:assert/strict';
import {boardUsages} from '../src/board-usage';
import {emptyBoard,type Card} from '../src/model';
import {paragraphOrigin} from '../src/paragraph-card';
const node=(id:string,text:string):Card=>({id,kind:'text',text,x:0,y:0,width:300,height:180,color:'slate'});
const board=(...nodes:Card[])=>({...emptyBoard(),nodes});
const resolve=(path:string)=>({'A':'Sources/A.md','A.md':'Sources/A.md','Sources/A.md':'Sources/A.md','B':'Sources/B.md'} as Record<string,string>)[path];
const query=(...nodes:Card[])=>boardUsages(board(...nodes),'Boards/main.thoughtspace',resolve);

test('native headings and blocks retain distinct canonical source identities',()=>{
 const usages=query(node('n','![[A#First]]\n![[A#Second|别名]]\n![[A#^stable]]'));
 assert.deepEqual(usages.map(u=>[u.path,u.subpath,u.mode]),[
  ['Sources/A.md','#First','embed'],['Sources/A.md','#Second','embed'],['Sources/A.md','#^stable','embed']
 ]);assert.equal(new Set(usages.map(u=>u.identity)).size,3);
});

test('aliases and repeated embeds deduplicate inside a card but preserve separate card instances',()=>{
 const usages=query(node('one','![[A#First|一]] ![[A.md#First|二]]'),node('two','![[Sources/A.md#First]]'));
 assert.equal(usages.length,2);assert.deepEqual(usages.map(u=>u.nodeId),['one','two']);assert.equal(usages[0].identity,usages[1].identity);
});

test('whole-note references and dynamic text embeds retain different modes',()=>{
 const ref:Card={...node('note',''),kind:'card',file:'Sources/A.md'};
 const usages=query(ref,node('embed','![[A]]'));
 assert.deepEqual(usages.map(u=>u.mode),['note','embed']);assert.ok(usages.every(u=>u.location==='整篇笔记'));
});

test('paragraph provenance is authoritative even after its generated footer is edited',()=>{
 const original='one\n\ntwo',origin=paragraphOrigin('Sources/A.md',original,{label:'second',from:5,to:8},'snapshot');
 const usages=query({...node('snapshot','changed body\n\n> 来源：[[B]] · 第 1–1 行'),paragraphQuote:origin});
 assert.equal(usages.length,1);assert.equal(usages[0].path,'Sources/A.md');assert.equal(usages[0].mode,'snapshot');assert.equal(usages[0].location,'字符 5–8');
});

test('different static ranges remain distinct from one another and from a dynamic heading',()=>{
 const raw='same\n\nsame';const first=paragraphOrigin('Sources/A.md',raw,{label:'first',from:0,to:4},'snapshot'),second=paragraphOrigin('Sources/A.md',raw,{label:'second',from:6,to:10},'snapshot');
 const usages=query({...node('a','same'),paragraphQuote:first},{...node('b','same'),paragraphQuote:second},{...node('c','![[A#First]]'),paragraphQuote:{path:'Sources/A.md',subpath:'#First',mode:'embed'}});
 assert.equal(new Set(usages.map(u=>u.identity)).size,3);assert.deepEqual(usages.map(u=>u.mode),['snapshot','snapshot','embed']);
});

test('legacy source footers deduplicate exact locations without collapsing different ranges',()=>{
 const usages=query(node('n','body\n\n> 来源：[[A]] · 第 2–3 行\n\n> 来源：[[A.md]] · 第 2–3 行\n\n> 来源：[[A]] · 第 5–6 行'));
 assert.equal(usages.length,2);assert.deepEqual(usages.map(u=>u.location),['第 2–3 行','第 5–6 行']);assert.ok(usages.every(u=>u.mode==='snapshot'));
});

test('provided native card note text contributes explicit excerpt provenance in the card context',()=>{
 const n:Card={...node('card',''),kind:'card',file:'Cards/excerpt.md'};const contexts:string[]=[];
 const usages=boardUsages(board(n),'Boards/main.thoughtspace',(path,context)=>{contexts.push(context);return path==='../Sources/A.md'&&context==='Cards/excerpt.md'?'Sources/A.md':undefined;},new Map([[n.file!,'# Evidence\n\nbody\n\n> 来源：[来源](../Sources/A.md#First) · 第 2–3 行']]));
 assert.deepEqual(usages.map(u=>[u.path,u.mode]),[['Cards/excerpt.md','note'],['Sources/A.md','snapshot']]);assert.equal(usages[1].subpath,'#First');assert.ok(contexts.every(c=>c==='Cards/excerpt.md'));
});

test('unprovided note bodies and ordinary outgoing links never become inferred material usages',()=>{
 const n:Card={...node('card',''),kind:'card',file:'Cards/excerpt.md'};
 assert.equal(boardUsages(board(n),'B.thoughtspace',resolve).length,1);
 const usages=boardUsages(board(n,node('text','[[A]] [A](A.md)')),'B.thoughtspace',resolve,new Map([[n.file!,'普通关联 [[A]]\n![[A#First]]']]));
 assert.equal(usages.length,1);assert.equal(usages[0].path,n.file);
});

test('missing sources retain recorded paths and exact subpaths without inventing a destination',()=>{
 const usages=boardUsages(board(node('n','![[Missing/source.md#^gone]]\n\n> 来源：[[Missing/source.md#Other]] · 第 4–5 行')),'B.thoughtspace',()=>undefined);
 assert.deepEqual(usages.map(u=>[u.path,u.subpath,u.mode]),[['Missing/source.md','#Other','snapshot'],['Missing/source.md','#^gone','embed']]);
});

test('encoded hashes resolve as real filenames before the legacy encoded-anchor fallback',()=>{
 const lookup=(path:string)=>path==='Sources/A#B.md'?path:path==='Sources/A.md'?path:undefined;
 const usages=boardUsages(board(node('n','![别名](Sources/A%23B.md#First)\n![older](Sources/A.md%23Second)')),'B.thoughtspace',lookup);
 assert.deepEqual(usages.map(u=>[u.path,u.subpath]),[['Sources/A#B.md','#First'],['Sources/A.md','#Second']]);
});

test('balanced Markdown destinations preserve parentheses and escaped destination characters',()=>{
 const usages=boardUsages(board(node('n','![标题](Sources/A(one).md#First)\n![另一项](<Sources/A%28two%29.md#%5Estable>)')),'B.thoughtspace',p=>p);
 assert.deepEqual(usages.map(u=>[u.path,u.subpath]),[['Sources/A(one).md','#First'],['Sources/A(two).md','#^stable']]);
});

test('inline code, soft-line code spans and escaped bangs are not dynamic embeds',()=>{
 const raw=['`![[A#inline]]`','``prefix','![[A#multiline]]','suffix``',String.raw`\![[A#escaped]]`,String.raw`\![alias](A.md#escaped-md)`,'![[A#real]]'].join('\n');
 const usages=query(node('n',raw));assert.deepEqual(usages.map(u=>u.subpath),['#real']);
});

test('an escaped backslash before a real embed does not suppress the embed',()=>{
 const usages=query(node('n',String.raw`\\![[A#real]]`));assert.deepEqual(usages.map(u=>u.subpath),['#real']);
});

test('frontmatter, fenced and indented code, and comments do not contribute references',()=>{
 const raw=['---','example: ![[A#properties]]','---','```md','![[A#fence]]','```','    ![[A#indented]]','<!-- ![[A#html]] -->','%% ![[A#comment]] %%','![[A#real]]'].join('\n');
 assert.deepEqual(query(node('n',raw)).map(u=>u.subpath),['#real']);
});

test('card source citations follow full paths after rename and queries do not mutate inputs',()=>{
 const b=board({...node('note',''),kind:'card',file:'Moved/excerpt.md'}),texts=new Map([['Moved/excerpt.md','body\n\n> 来源：[[Moved/source.md]] · 第 2–2 行']]);
 const before=JSON.stringify(b),beforeTexts=[...texts];const usages=boardUsages(b,'Moved/board.thoughtspace',p=>p,texts);
 assert.equal(usages[1].path,'Moved/source.md');assert.equal(usages[1].boardPath,'Moved/board.thoughtspace');assert.equal(JSON.stringify(b),before);assert.deepEqual([...texts],beforeTexts);
});
