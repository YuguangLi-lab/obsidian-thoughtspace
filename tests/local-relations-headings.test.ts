import test from 'node:test';
import assert from 'node:assert/strict';
import {localHeadingTree,localHeadingPage,validateLocalHeadingTarget,type LocalNativeHeading,type LocalHeadingInput,LOCAL_HEADING_PAGE_SIZE,LOCAL_HEADING_PAGE_LIMIT} from '../src/local-relations-headings';

const heading=(text:string,level:number,line:number,offset?:number):LocalNativeHeading=>({heading:text,level,position:{start:{line,col:0,...(offset===undefined?{}:{offset})},end:{line,col:text.length+level+1}}});
const input=(headings:readonly LocalNativeHeading[]):LocalHeadingInput=>({kind:'card',path:'Notes/Source.md',mtime:123,available:true,metadata:{headings}});
const tree=(headings:readonly LocalNativeHeading[])=>localHeadingTree(input(headings));

test('native heading levels build a tree without inventing missing intermediate levels',()=>{
 const result=tree([heading('Root',1,0),heading('Skipped to H4',4,2),heading('H6',6,4),heading('H2',2,6),heading('Next root',1,8)]),[root,h4,h6,h2,next]=result.items;
 assert.equal(result.status,'ready');assert.deepEqual(result.roots,[root.id,next.id]);assert.deepEqual(root.childIds,[h4.id,h2.id]);assert.deepEqual(h4.childIds,[h6.id]);assert.equal(h4.depth,1);assert.equal(h6.depth,2);assert.equal(h2.parentId,root.id);assert.equal(next.parentId,undefined);
});
test('a document beginning at H3 has a real root and later shallower headings become new roots',()=>{
 const result=tree([heading('First H3',3,0),heading('Child H5',5,1),heading('Later H2',2,2)]);assert.deepEqual(result.items.map(item=>item.depth),[0,1,0]);assert.equal(result.roots.length,2);
});
test('repeated headings have distinct stable locations and independently addressable children',()=>{
 const result=tree([heading('Parent',1,0,0),heading('Same',2,3,20),heading('Child one',3,5,40),heading('Same',2,10,80),heading('Child two',3,12,100)]),first=result.items[1],second=result.items[3];assert.notEqual(first.id,second.id);assert.equal(first.target.line,3);assert.equal(second.target.line,10);assert.equal(result.items[2].parentId,first.id);assert.equal(result.items[4].parentId,second.id);
});
test('stable IDs include path, native line, exact title, level and optional offset but not mtime',()=>{
 const base=input([heading('Same',2,3,20)]),original=localHeadingTree(base).items[0],later=localHeadingTree({...base,mtime:124}).items[0];assert.equal(original.id,later.id);assert.notEqual(original.target.mtime,later.target.mtime);
 for(const changed of [{...base,path:'Other.md'},input([heading('Same',2,4,20)]),input([heading('Different',2,3,20)]),input([heading('Same',3,3,20)]),input([heading('Same',2,3,21)]),input([heading('Same',2,3)])])assert.notEqual(localHeadingTree(changed).items[0].id,original.id);
});
test('metadata order is normalized by native position and duplicate cache entries are deduplicated',()=>{
 const second=heading('Second',2,5,50),first=heading('First',1,0,0),result=tree([second,first,{...second}]);assert.deepEqual(result.items.map(item=>item.heading),['First','Second']);assert.equal(result.items[1].parentId,result.items[0].id);assert.equal(result.total,2);
});
test('native Setext or formatted headings require no text parser and retain the exact native location',()=>{
 const raw=heading('A **formatted** heading',1,8,75);raw.position!.end={line:9,col:12,offset:116};const result=tree([raw]);assert.equal(result.items[0].heading,raw.heading);assert.equal(result.items[0].target.line,8);assert.equal(result.items[0].target.offset,75);
});
for(const kind of ['text','board','section','image','pdf','audio','video'] as const)test(`${kind} does not masquerade as a note heading tree`,()=>{
 const result=localHeadingTree({...input([heading('Heading',1,0)]),kind});assert.equal(result.status,'unsupported');assert.equal(result.total,0);assert.deepEqual(result.items,[]);
});
test('a card without an actual Markdown source has no heading tree',()=>{
 for(const path of [undefined,'','File.pdf','Child.thoughtspace','Note.txt'])assert.equal(localHeadingTree({...input([heading('Heading',1,0)]),path}).status,'unsupported');assert.equal(localHeadingTree({...input([]),path:'Upper.MD'}).status,'ready');
});
test('missing sources and pending native caches remain distinct even when the tree is collapsed',()=>{
 const missing=localHeadingTree({...input([]),available:false}),pending=localHeadingTree({...input([]),metadata:null});assert.equal(localHeadingPage(missing,{collapsed:new Set(['all'])}).status,'missing');assert.equal(localHeadingPage(pending,{collapsed:new Set(['all'])}).status,'pending');assert.equal(localHeadingPage(missing).total,0);assert.equal(localHeadingPage(pending).visible,0);
});
test('missing cache or invalid source mtime cannot produce navigable heading targets',()=>{
 for(const patch of [{metadata:undefined},{metadata:null},{mtime:undefined},{mtime:NaN},{mtime:Infinity},{mtime:-1}]){const result=localHeadingTree({...input([heading('Heading',1,0)]),...patch});assert.equal(result.status,'pending');assert.equal(result.items.length,0);}
});
test('an indexed note with no headings is ready with an empty result rather than pending',()=>{
 const result=localHeadingTree({...input([]),metadata:{}}),page=localHeadingPage(result);assert.equal(result.status,'ready');assert.deepEqual(result.roots,[]);assert.equal(page.pageCount,0);assert.equal(page.page,0);assert.equal(page.shown,0);
});
test('malformed heading metadata is ignored and optional native positions are normalized',()=>{
 const malformed=[null,{},heading('Invalid level',0,0),heading('Too deep',7,0),heading('Fraction',1.5,0),heading('Bad line',1,-1),{heading:3,level:1,position:{start:{line:0}}},{heading:'No line',level:1},{heading:'Valid',level:2,position:{start:{line:3,col:-1,offset:NaN}}}] as unknown as LocalNativeHeading[];
 const result=tree(malformed);assert.equal(result.total,1);assert.equal(result.items[0].heading,'Valid');assert.equal(result.items[0].col,0);assert.equal(result.items[0].offset,undefined);
});
test('a blank native heading remains a valid precise location without synthesizing a block ID',()=>{
 const result=tree([heading('',1,0,0)]);assert.equal(result.total,1);assert.equal(result.items[0].target.heading,'');assert.equal(result.items[0].target.line,0);assert.equal('blockId' in result.items[0].target,false);
});
test('collapsing a heading hides its descendants only and preserves unrelated branches',()=>{
 const result=tree([heading('Root A',1,0),heading('Child',2,1),heading('Grandchild',3,2),heading('Root B',1,3),heading('Other child',2,4)]),page=localHeadingPage(result,{collapsed:new Set([result.items[0].id])});assert.deepEqual(page.items.map(item=>item.heading),['Root A','Root B','Other child']);assert.equal(page.total,5);assert.equal(page.matched,5);assert.equal(page.visible,3);assert.equal(page.hiddenByCollapse,2);
});
test('folding an inner branch preserves siblings and a folded leaf does not disappear',()=>{
 const result=tree([heading('Root',1,0),heading('A',2,1),heading('A child',3,2),heading('B',2,3)]),page=localHeadingPage(result,{collapsed:new Set([result.items[1].id,result.items[3].id,'unknown'])});assert.deepEqual(page.items.map(item=>item.heading),['Root','A','B']);assert.equal(page.hiddenByCollapse,1);
});
test('search checks every native heading and reveals matches under collapsed ancestors',()=>{
 const result=tree([heading('Parent',1,0),heading('Hidden TARGET',3,1),heading('Unrelated',1,2)]),page=localHeadingPage(result,{query:' target ',collapsed:new Set([result.items[0].id])});assert.deepEqual(page.items.map(item=>item.heading),['Hidden TARGET']);assert.equal(page.total,3);assert.equal(page.matched,1);assert.equal(page.visible,1);assert.equal(page.hiddenByCollapse,0);assert.equal(page.items[0].parentId,result.items[0].id);
});
test('searching a parent title does not silently include nonmatching descendants or paths',()=>{
 const result=tree([heading('Parent',1,0),heading('Child',2,1)]);assert.equal(localHeadingPage(result,{query:'Parent'}).matched,1);assert.equal(localHeadingPage(result,{query:'Notes/Source.md'}).matched,0);
});
test('large native heading sets remain fully reachable through bounded pages',()=>{
 const result=tree(Array.from({length:5000},(_,i)=>heading(`Heading ${i}`,i%10===0?1:2,i*2,i*20))),visited:string[]=[];for(let page=0;page<125;page++){const slice=localHeadingPage(result,{page,pageSize:40});assert.ok(slice.items.length<=LOCAL_HEADING_PAGE_LIMIT);visited.push(...slice.items.map(item=>item.id));}assert.equal(visited.length,5000);assert.equal(new Set(visited).size,5000);assert.equal(localHeadingPage(result).pageSize,LOCAL_HEADING_PAGE_SIZE);assert.equal(localHeadingPage(result).shown,30);
});
test('page sizes and offsets are clamped and empty results never produce a negative page',()=>{
 const result=tree(Array.from({length:45},(_,i)=>heading(String(i),1,i)));assert.equal(localHeadingPage(result,{pageSize:1000}).shown,40);assert.equal(localHeadingPage(result,{pageSize:0}).shown,1);assert.equal(localHeadingPage(result,{pageSize:NaN}).pageSize,30);assert.equal(localHeadingPage(result,{page:99,pageSize:40}).page,1);assert.equal(localHeadingPage(result,{page:-3}).page,0);assert.equal(localHeadingPage(result,{page:Infinity}).page,0);assert.equal(localHeadingPage(result,{query:'absent',page:99}).page,0);
});
test('folding a branch reclamps the requested page without mutating tree or fold state',()=>{
 const result=tree([heading('Root',1,0),...Array.from({length:80},(_,i)=>heading(`Child ${i}`,2,i+1))]),collapsed=new Set([result.items[0].id]),before=JSON.stringify(result),page=localHeadingPage(result,{page:2,pageSize:40,collapsed});assert.equal(page.page,0);assert.equal(page.pageCount,1);assert.equal(page.items.length,1);assert.equal(JSON.stringify(result),before);assert.deepEqual([...collapsed],[result.items[0].id]);
});
test('model construction never mutates the native cache or source descriptor',()=>{
 const raw=heading('Root',1,0,0),child=heading('Child',3,2,20),data=input([child,raw]),before=JSON.stringify(data);Object.freeze(raw.position!.start);Object.freeze(raw.position);Object.freeze(raw);Object.freeze(child);Object.freeze(data.metadata!.headings);Object.freeze(data.metadata);Object.freeze(data);localHeadingTree(data);assert.equal(JSON.stringify(data),before);
});
test('target validation accepts exact native identity, including repeated titles',()=>{
 const source=input([heading('Same',2,2,10),heading('Same',2,7,40)]),result=localHeadingTree(source);for(const item of result.items)assert.equal(validateLocalHeadingTarget(source.metadata,source.path!,source.mtime!,item.target),true);assert.equal(result.items[1].target.line,7);
});
for(const change of ['path','mtime','line','offset','heading','level','column','id'] as const)test(`changed ${change} rejects a captured heading target without guessing another location`,()=>{
 const source=input([heading('Same',2,2,10),heading('Same',2,7,40)]),target={...localHeadingTree(source).items[0].target};let path=source.path!,mtime=source.mtime!;if(change==='path')path='Moved.md';else if(change==='mtime')mtime++;else if(change==='line')target.line=7;else if(change==='offset')target.offset=40;else if(change==='heading')target.heading='Changed';else if(change==='level')target.level=3;else if(change==='column')target.col=1;else target.id='forged';assert.equal(validateLocalHeadingTarget(source.metadata,path,mtime,target),false);
});
test('a deleted, moved or retitled cache heading invalidates the old target even with unchanged mtime',()=>{
 const source=input([heading('Original',1,4,30)]),target=localHeadingTree(source).items[0].target;for(const metadata of [null,{}, {headings:[]},{headings:[heading('Original',1,5,30)]},{headings:[heading('Changed',1,4,30)]}])assert.equal(validateLocalHeadingTarget(metadata,source.path!,source.mtime!,target),false);
});
test('target validation permits absent offsets only when the matching cache also lacks one',()=>{
 const source=input([heading('No offset',1,0)]),target=localHeadingTree(source).items[0].target;assert.equal(validateLocalHeadingTarget(source.metadata,source.path!,source.mtime!,target),true);assert.equal(validateLocalHeadingTarget({headings:[heading('No offset',1,0,0)]},source.path!,source.mtime!,target),false);
});

test('native ATX literal validation accepts actual levels, closing markers and raw inline formatting',async()=>{
 const {localHeadingTextMatches}=await import('../src/local-relations-headings');for(const [text,title,level]of [['# Heading','Heading',1],['   ### Heading ###  ','Heading',3],['## **Bold** and [link](Note.md)','**Bold** and [link](Note.md)',2],['######','',6],['# ###','',1],['## Heading#','Heading#',2]] as const){const target=tree([heading(title,level,0,0)]).items[0].target;assert.equal(localHeadingTextMatches(text,target),true,text);}
});
test('native Setext literal validation accepts H1/H2, CRLF and exact source offsets',async()=>{
 const {localHeadingTextMatches}=await import('../src/local-relations-headings');for(const [text,title,level,line,offset]of [['Heading\n===','Heading',1,0,0],['First\r\n\r\nHeading\r\n---\r\n','Heading',2,2,9]] as const){const target=tree([heading(title,level,line,offset)]).items[0].target;assert.equal(localHeadingTextMatches(text,target),true);}
});
test('native CRLF fixture remains navigable when the public editor normalizes to LF',async()=>{
 const {localHeadingTextMatches}=await import('../src/local-relations-headings'),raw='# CRLF 第一标题\r\n\r\n正文一。\r\n\r\n## CRLF 第二标题\r\n\r\n正文二。\r\n\r\n### CRLF 第三个标题\r\n\r\n正文三。\r\n',normalized=raw.replace(/\r\n/g,'\n'),target=tree([heading('CRLF 第三个标题',3,8,47)]).items[0].target;
 assert.equal(raw.indexOf('###'),47);assert.equal(normalized.indexOf('###'),39);assert.equal(localHeadingTextMatches(raw,target),true);assert.equal(localHeadingTextMatches(normalized,target),true);assert.equal(localHeadingTextMatches(normalized,{...target,offset:39}),true);
});
test('newline compensation accepts only exact LF or uniformly CRLF offsets',async()=>{
 const {localHeadingTextMatches}=await import('../src/local-relations-headings'),text='First\n\nHeading\n---\n',target=tree([heading('Heading',2,2,9)]).items[0].target;
 for(let offset=0;offset<20;offset++)assert.equal(localHeadingTextMatches(text,{...target,offset}),offset===7||offset===9,'offset '+offset);
 assert.equal(localHeadingTextMatches(text.replace(/\n/g,'\r\n'),target),true);assert.equal(localHeadingTextMatches(text.replace(/\n/g,'\r\n'),{...target,offset:11}),false);assert.equal(localHeadingTextMatches('First\r\n\nHeading\n---\n',target),false);
});
test('CRLF compensation preserves exact heading text, level and captured line',async()=>{
 const {localHeadingTextMatches}=await import('../src/local-relations-headings'),text='First\n\n## Heading\n',target=tree([heading('Heading',2,2,9)]).items[0].target;
 assert.equal(localHeadingTextMatches(text,target),true);assert.equal(localHeadingTextMatches(text.replace('Heading','Changed'),target),false);assert.equal(localHeadingTextMatches(text.replace('## Heading','# Heading'),target),false);assert.equal(localHeadingTextMatches(text,{...target,line:1}),false);assert.equal(localHeadingTextMatches(text,{...target,line:20}),false);
});
test('CRLF compensation never bypasses fenced code or frontmatter checks',async()=>{
 const {localHeadingTextMatches}=await import('../src/local-relations-headings');for(const raw of ['```md\r\n## Heading\r\n```','---\r\n## Heading\r\n---']){const target=tree([heading('Heading',2,1,raw.indexOf('##'))]).items[0].target;assert.equal(localHeadingTextMatches(raw.replace(/\r\n/g,'\n'),target),false);}
});
test('duplicate titles are checked at their exact captured line rather than the first occurrence',async()=>{
 const {localHeadingTextMatches}=await import('../src/local-relations-headings'),text='## Same\nBody\n## Same\n';const target=tree([heading('Same',2,2,13)]).items[0].target;assert.equal(localHeadingTextMatches(text,target),true);assert.equal(localHeadingTextMatches('## Same\nBody\n## Different\n',target),false);
});
test('old literal locations reject renamed headings, wrong levels, offsets and out-of-range lines',async()=>{
 const {localHeadingTextMatches}=await import('../src/local-relations-headings'),target=tree([heading('Heading',2,0,0)]).items[0].target;for(const text of ['## Renamed','# Heading','## Heading other','plain text','    ## Heading','> ## Heading','- ## Heading','##Heading'])assert.equal(localHeadingTextMatches(text,target),false,text);assert.equal(localHeadingTextMatches('## Heading',{...target,line:100}),false);assert.equal(localHeadingTextMatches('## Heading',{...target,offset:1}),false);
});
test('cached heading text inside fenced code or YAML frontmatter never receives a guessed jump',async()=>{
 const {localHeadingTextMatches}=await import('../src/local-relations-headings');for(const text of ['```md\n## Heading\n```','~~~~\n## Heading\n~~~~','---\n## Heading\n---']){const target=tree([heading('Heading',2,1)]).items[0].target;assert.equal(localHeadingTextMatches(text,target),false,text);}
});
test('matching headings after closed fences and frontmatter remain navigable',async()=>{
 const {localHeadingTextMatches}=await import('../src/local-relations-headings');for(const text of ['````md\n```\n````\n## Heading','~~~\ntext\n~~~\n## Heading','---\ntitle: Note\n---\n## Heading']){const target=tree([heading('Heading',2,3)]).items[0].target;assert.equal(localHeadingTextMatches(text,target),true,text);}
});
test('unsupported nested or multiline Setext forms fail closed without normalizing distinct labels',async()=>{
 const {localHeadingTextMatches}=await import('../src/local-relations-headings');assert.equal(localHeadingTextMatches('A  B\n---',tree([heading('A B',2,0)]).items[0].target),false);assert.equal(localHeadingTextMatches('> Heading\n> ---',tree([heading('Heading',2,0)]).items[0].target),false);assert.equal(localHeadingTextMatches('A\nB\n---',tree([heading('A B',2,0)]).items[0].target),false);
});
