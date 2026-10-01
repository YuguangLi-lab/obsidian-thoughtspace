import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {writingMarkdown,writingParts,writingName,writingSignature,writingWordCount} from '../src/writing';
import {rebaseFragment,excerptNoteMarkdown} from '../src/materials';
import {markdownEdit} from '../src/markdown-edit';
import {selectionNoteTitle} from '../src/selection-note';
import {sourceLinkTarget} from '../src/excerpt-sources';
import {emptyBoard,clone,Card} from '../src/model';

const source=readFileSync('src/writing-view.ts','utf8');
function method(start:string,end:string,deps:Record<string,unknown>={}){return new Function(...Object.keys(deps),transformSync('class View{'+source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))+'};return View',{loader:'ts'}).code)(...Object.values(deps)).prototype;}
class TFile{extension='md';constructor(public path:string){}get basename(){return this.path;}}
const card=(id:string,kind:Card['kind']='text'):Card=>({id,kind,text:'内容',file:kind==='card'?'source.md':undefined,x:0,y:0,width:240,height:100,color:'sand'});

for(const eol of ['\n','\r\n'])test(`writing compose accepts unchanged native note with ${JSON.stringify(eol)} endings`,async()=>{
 const note=new TFile('source.md'),boardFile=new TFile('board.thoughtspace'),raw=['# 原笔记','','证据 [[target]]'].join(eol),board={...emptyBoard(),nodes:[card('c','card')],writing:{title:'草稿',order:['c']}};
 const owner={board};const proto=method(' private async compose(','\n async refreshArticle()', {TFile,clone,writingParts,writingSignature,writingWordCount,writingMarkdown,writingName,excerptNoteMarkdown,rebaseFragment,remoteImageUrl:()=>false,readCurrentNativeNote:async()=>raw,parseLinktext:(link:string)=>({path:link,subpath:''})});
 const view=Object.assign(Object.create(proto),{file:boardFile,commitFields(){},ensure:()=>owner,app:{vault:{getAbstractFileByPath:(path:string)=>path==='source.md'?note:boardFile},metadataCache:{getFileCache:()=>({links:[{original:'[[target]]',link:'target',position:{start:{line:2,col:3},end:{line:2,col:13}}}]}),getFirstLinkpathDest:()=>new TFile('folder/target.md')},fileManager:{generateMarkdownLink:(file:TFile)=>'[['+file.path+']]'}}});
 const result=await view.compose();assert.match(result.text,/证据 \[\[folder\/target\.md\]\]/);
});

test('writing export strips only the actual YAML block and retains prose following empty properties',()=>{
 const body='---\n---\nEssential finding\n\n---\n\nLater finding';
 const value=writingMarkdown('Article',[{title:'Section',depth:2,body}],'[[board]]');assert.match(value,/Essential finding/);assert.match(value,/Later finding/);
 const alternate=writingMarkdown('Article',[{title:'Section',depth:2,body:'---\nsecret: metadata\n...\nEvidence'}],'[[board]]');assert.ok(!alternate.includes('secret:'));assert.match(alternate,/Evidence/);
});

test('writing prose without a generated section heading retains its source H1',()=>{
 const body='# Essential finding\n\nEvidence';const value=writingMarkdown('Article',[{title:'Material',depth:0,body}],'[[board]]');assert.match(value,/# Essential finding\n\nEvidence/);
});

test('clear formatting protects complete links with nested or escaped labels',()=>{
 for(const link of ['[A \\] B](folder/a*b*c.md)','[A [B] C](folder/a*b*c.md)','[text][**key**]'])assert.equal(markdownEdit(link,0,link.length,'clear').text,link);
});

test('extracting a new note cannot replace text inside a balanced Markdown link target',()=>{
 for(const text of ['[label](folder(a)b.md)','[A [label] B](note.md)','[label][reference]']){
  const phrase=text.includes('b.md')?'b.md':text.includes('reference')?'reference':'label',start=text.indexOf(phrase);
  assert.throws(()=>selectionNoteTitle({text,start,end:start+phrase.length}),/链接/);
 }
});

test('citation source links decode escaped local Markdown destinations',()=>{
 assert.equal(sourceLinkTarget('[source](folder\\(one\\)/note\\_name.md#Heading)'), 'folder(one)/note_name.md#Heading');
 assert.equal(sourceLinkTarget('[source](<folder%20one/note.md#Heading>)'),'folder one/note.md#Heading');
});

class Input extends EventTarget{value='Draft';selectionStart=0;selectionEnd=0;setRangeText(text:string,start:number,end:number){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.selectionStart=this.selectionEnd=start+text.length;}setSelectionRange(start:number,end:number){this.selectionStart=start;this.selectionEnd=end;}focus(){}}
for(const mode of ['newChapter','insertMaterial'])test(`writing fallback ${mode} persists its programmatic textarea edit`,async()=>{
 const start=mode==='newChapter'?' private newChapter()':' private async insertMaterial(',end=mode==='newChapter'?'\n private dragRow(':'\n private async rebuildManuscript(';
 const proto=method(start,end,{writingAssemblyStamp:()=>''}),input=new Input();let persisted='Draft';input.addEventListener('input',()=>{persisted=input.value;});
 const view=Object.assign(Object.create(proto),{mode:'write',ensure:()=>({board:{}}),manuscriptInput:input,manuscriptNative:undefined,openManuscript:async()=>{},compose:async()=>({text:'# Draft\n\n白板：[[board]]\n\n## Evidence\n\nBody'}),flushFields(){}});
 await view[mode](['material']);assert.notEqual(input.value,'Draft');assert.equal(persisted,input.value);
});

class Element extends EventTarget{children:Element[]=[];value='';checked=false;constructor(public tag='div'){super();}createDiv(){const e=new Element();this.children.push(e);return e;}createEl(tag:string,options:any={}){const e=new Element(tag);e.value=options.value||'';this.children.push(e);return e;}createSpan(){return this.createEl('span');}setText(){} }
for(const custom of [true,false])test(`writing ${custom?'chapter':'annotation'} detects a remote body change before applying pending local text`,()=>{
 const node=card('entry'),state={title:'Article',order:['entry'],chapters:custom?[{id:'entry',title:'Chapter',body:'Original'}]:[],options:custom?{}:{entry:{note:'Original'}}} as any;
 const proto=method(' private renderEntryEditor(','\n private renderStatus(',{writingName,writingParts:()=>[],writingEntryBody:undefined}),input=new Input();input.value='Original';let pending:()=>void=()=>{};
 const view=Object.assign(Object.create(proto),{entryInputs:[],state:()=>state,ensure:()=>({board:{}}),markdownInput:()=>input,queueField:(_key:string,fn:()=>void)=>{pending=fn;},update:(fn:(s:any)=>void)=>fn(state),option:(_id:string,value:any)=>Object.assign(state.options.entry,value),flushFields(){}});
 view.renderEntryEditor(new Element(),node,custom);input.value='Local';input.dispatchEvent(new Event('input'));
 if(custom)state.chapters[0].body='Remote';else state.options.entry.note='Remote';
 assert.throws(()=>pending(),/变化|修改|冲突/);assert.equal(custom?state.chapters[0].body:state.options.entry.note,'Remote');assert.equal(input.value,'Local');
});

test('writing pending field retries do not apply successful operations again',()=>{
 const proto=method(' private flushFields()','\n private commitFields('),pendingFields=new Map<string,()=>void>();let successes=0,attempts=0;
 pendingFields.set('first',()=>successes++);pendingFields.set('second',()=>{if(++attempts===1)throw Error('recoverable conflict');});
 const view=Object.assign(Object.create(proto),{pendingFields,containerEl:{win:{clearTimeout(){}}}});
 assert.throws(()=>view.flushFields(),/recoverable conflict/);view.flushFields();assert.equal(successes,1);assert.equal(attempts,2);assert.equal(pendingFields.size,0);
});

test('clearing a fenced example cannot flatten its code lines or strip literal emphasis',()=>{
 const text='Before **bold**\n\n```js\nconst emphasis = "**literal**";\nnext();\n```\n\nAfter **bold**';
 const expected='Before bold\n\n```js\nconst emphasis = "**literal**";\nnext();\n```\n\nAfter bold';
 assert.equal(markdownEdit(text,0,text.length,'clear').text,expected);
});

test('new-note extraction ignores code-fence examples stored inside properties or hidden comments',()=>{
 for(const text of ['---\nexample: |\n  ```\n---\n概念','%%\n```\n%%\n概念','<!--\n```\n-->\n概念']){
  const start=text.indexOf('概念');assert.equal(selectionNoteTitle({text,start,end:start+2}),'概念');
 }
});

test('clear inside a fenced literal cannot expand through its literal star markers',()=>{
 const text='```\n**literal**\n```',start=text.indexOf('literal');assert.equal(markdownEdit(text,start,start+7,'clear').text,text);
});

test('clear still toggles ordinary inline code and prose around indented code',()=>{
 assert.equal(markdownEdit('`inline`',0,8,'clear').text,'inline');
 const text='**Before**\n\n    **code**\n\n**After**';assert.equal(markdownEdit(text,0,text.length,'clear').text,'Before\n\n    **code**\n\nAfter');
});

test('a successful queued writing field is not replayed over a later remote update after a different field fails',()=>{
 const proto=method(' private flushFields()','\n private commitFields('),pendingFields=new Map<string,()=>void>();let title='Initial',failed=true;
 pendingFields.set('title',()=>{title='Local';});pendingFields.set('chapter',()=>{if(failed)throw Error('Chapter too large');});
 const view=Object.assign(Object.create(proto),{pendingFields,containerEl:{win:{clearTimeout(){}}}});
 assert.throws(()=>view.flushFields());assert.equal(title,'Local');title='Remote';failed=false;view.flushFields();assert.equal(title,'Remote');
});

test('successful chapter saves advance their edit baseline and allow another local edit',()=>{
 const node=card('entry'),state={title:'Article',order:['entry'],chapters:[{id:'entry',title:'Chapter',body:'Original'}],options:{}};
 const proto=method(' private renderEntryEditor(','\n private renderStatus(',{writingName,writingParts:()=>[]}),input=new Input();let pending:()=>void=()=>{};
 const view=Object.assign(Object.create(proto),{entryInputs:[],state:()=>state,ensure:()=>({board:{}}),markdownInput:()=>input,queueField:(_key:string,fn:()=>void)=>{pending=fn;},update:(fn:(s:typeof state)=>void)=>fn(state),flushFields(){}});
 view.renderEntryEditor(new Element(),node,true);
 for(const value of ['First','Second']){input.value=value;input.dispatchEvent(new Event('input'));pending();assert.equal(state.chapters[0].body,value);}
});

test('pending writer callbacks queued by a successful callback survive for the next flush',()=>{
 const proto=method(' private flushFields()','\n private commitFields('),pendingFields=new Map<string,()=>void>();let next=0;
 pendingFields.set('title',()=>{pendingFields.set('title',()=>{next++;});});
 const view=Object.assign(Object.create(proto),{pendingFields,containerEl:{win:{clearTimeout(){}}}});view.flushFields();assert.equal(pendingFields.size,1);view.flushFields();assert.equal(next,1);
});

test('link envelopes retain soft-line-break destinations and existing literal escape behavior',()=>{
 for(const link of ['[source](\nfolder/a*b*c.md\n)','[A\nB](folder/a*b*c.md)','[[note#heading|alias]]','![image](folder/a*b*c.png)'])assert.equal(markdownEdit(link,0,link.length,'clear').text,link);
 const text='\\[literal] **format**';assert.equal(markdownEdit(text,0,text.length,'clear').text,'\\[literal] format');
});
