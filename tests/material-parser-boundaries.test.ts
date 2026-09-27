import test from 'node:test';
import assert from 'node:assert/strict';
import {extractFragments,parseOutline} from '../src/materials';
import {excerptPresentation,conceptDocument} from '../src/excerpt-sources';

const citation='> 来源：[[paper.pdf#page=2]] · PDF 第 2 页';
test('a triple-backtick inline code span is not an opening fence that hides later material',()=>{
 const raw='```inline code```\n\n# Real heading\n\nVisible paragraph';
 assert.deepEqual(parseOutline(raw).map(t=>t.title),['Real heading']);
 const blocks=extractFragments(raw).fragments;
 assert.deepEqual(blocks.map(f=>[f.kind,f.body]),[['paragraph','```inline code```'],['paragraph','Visible paragraph']]);
 assert.equal(blocks[1].heading,'Real heading');
 assert.equal(excerptPresentation('```inline code```\n\n'+citation).sources.length,1);
});

test('Markdown thematic breaks do not create empty or punctuation-only outline topics',()=>{
 const raw='# Root\n\n* * *\n\n- - -\n\n___\n\n    - code after break\n\n- Real topic';
 assert.deepEqual(parseOutline(raw).map(t=>t.title),['Root','Real topic']);
});

test('indented code list markers do not become imported topics while nested real lists survive',()=>{
 const raw='# Root\n\n    - code example\n    1. code number\n\n- Real\n  - Nested\n\n        - code inside list';
 assert.deepEqual(parseOutline(raw).map(t=>[t.title,t.parent]),[['Root',null],['Real',0],['Nested',1]]);
});

test('HTML and Obsidian comments cannot manufacture hidden imported headings or lists',()=>{
 const raw='# Root\n<!--\n## Hidden heading\n- Hidden list\n-->\n%%\n## Also hidden\n%%\n## Visible';
 assert.deepEqual(parseOutline(raw).map(t=>t.title),['Root','Visible']);
 const fragments=extractFragments('# Real\n\n<!--\n# Hidden\n```\n-->\n\nActual paragraph').fragments;
 assert.equal(fragments.at(-1)?.heading,'Real');assert.equal(fragments.at(-1)?.body,'Actual paragraph');
});

test('citation samples inside hidden comments remain source bytes and never become provenance links',()=>{
 for(const [open,close] of [['<!--','-->'],['%%','%%']]){
  for(const prefix of ['', '```\n']){
   const raw=open+'\n'+prefix+citation+'\n'+close+'\n\nVisible paragraph';
   assert.deepEqual(excerptPresentation(raw),{body:raw,sources:[]});
   assert.equal(excerptPresentation(raw+'\n\n'+citation).sources.length,1,'hidden fence samples must not swallow later visible provenance');
  }
 }
});

test('merging notes strips frontmatter with the valid YAML dot terminator',()=>{
 const result=conceptDocument('Merged',[
  {title:'A',link:'[[A]]',body:'---\ntags: [private-metadata]\n...\n# A\n\nEvidence A'},
  {title:'B',link:'[[B]]',body:'---\r\ntags: [other-metadata]\r\n...\r\n# B\r\n\r\nEvidence B'},
 ]);
 assert.ok(result.includes('Evidence A'));assert.ok(result.includes('Evidence B'));
 assert.ok(!result.includes('tags:'),'YAML properties must not become merged evidence');
});

for(const newline of ['\n','\r\n'])for(const terminator of ['---','...']){
 test(`concept merge stops at the first empty frontmatter terminator (${JSON.stringify(newline)}, ${terminator})`,()=>{
  const evidence=['Evidence A','','...','','More evidence','','---','','Tail A'].join(newline);
  const result=conceptDocument('Merged',[
   {title:'A',link:'[[A]]',body:['---',terminator+' \t','# A','',evidence].join(newline)},
   {title:'B',link:'[[B]]',body:'# B\n\nEvidence B'},
  ]);
  assert.equal(result,`# Merged\n\n## 我的理解\n\n\n## 证据与摘录\n\n### A\n\n原卡片：[[A]]\n\n${evidence}\n\n---\n\n### B\n\n原卡片：[[B]]\n\nEvidence B\n`);
 });
}

for(const opening of ['--- ','\uFEFF---'])for(const sample of ['```','<!--']){
 test(`material context skips accepted frontmatter without leaking ${sample} (${JSON.stringify(opening)})`,()=>{
  const raw=[opening,'example: |','  '+sample,'---','# Actual','','Paragraph','','- Topic'].join('\n');
  assert.deepEqual(parseOutline(raw).map(t=>[t.title,t.parent]),[['Actual',null],['Topic',0]]);
  assert.deepEqual(extractFragments(raw).fragments.map(f=>[f.body,f.heading,f.start,f.end]),[
   ['Paragraph','Actual',7,7],['- Topic','Actual',9,9],
  ]);
 });
}

test('skipping source frontmatter does not reinterpret body thematic breaks as another properties block',()=>{
 const raw='---\nexample: |\n  ```\n---\n---\n# Actual\n\nParagraph\n\n---\n- Topic';
 assert.deepEqual(parseOutline(raw).map(t=>[t.title,t.parent]),[['Actual',null],['Topic',0]]);
 assert.deepEqual(extractFragments(raw).fragments.map(f=>[f.body,f.heading,f.start,f.end]),[
  ['---','',5,5],['Paragraph','Actual',8,8],['---\n- Topic','Actual',10,11],
 ]);
});
