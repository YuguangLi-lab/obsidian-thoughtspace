import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard} from '../src/model';
import {firstNoteReferences} from '../src/sidebar-content';
import {libraryFiles,isWorkspaceFile,noteExcerpt} from '../src/workspace';

// Run the actual library builder and predicate, substituting only host I/O and DOM.
const source=readFileSync(process.env.LIBRARY_TAG_SOURCE||'src/main.ts','utf8');
const take=(a:string,b:string)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
class File{extension='md';stat={mtime:1};parent={path:'Notes'};constructor(public path:string,public basename=path.slice(6,-3)){}}
class Element{
 children:Element[]=[];text='';cls='';value='';
 createEl(_tag:string,options:{text?:string;cls?:string}={}){const el=new Element();el.text=options.text||'';el.cls=options.cls||'';this.children.push(el);return el;}
 createDiv(options:{text?:string;cls?:string}|string={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
 createSpan(options:{text?:string;cls?:string}|string={}){return this.createDiv(options);}
 toggleClass(){}addEventListener(){}
 all():Element[]{return[this,...this.children.flatMap(c=>c.all())];}
}
function fixture(count=1200){
 const files=Array.from({length:count},(_,i)=>new File(`Notes/Note ${i}.md`)),tags=new Map(files.map((f,i)=>[f,i%2?['#b']:['#a','#shared']]));let reads=0,bodies=0;
 const deps={TFile:File,firstNoteReferences,libraryFiles,isWorkspaceFile,noteExcerpt,getAllTags:(cache:{tags?:string[]})=>cache.tags||null,setIcon(){},button:(el:Element,text:string)=>el.createEl('button',{text})};
 const View=new Function(...Object.keys(deps),transformSync(`return class View{${take('  private matches(', '  private clearSidebarFilters(')}${take('  private async buildSidebar(','  private async exportCanvas(')}}`,{loader:'ts'}).code)(...Object.values(deps));
 const view=new View();Object.assign(view,{tab:'library',query:'missing',tag:'',libraryScope:'vault',librarySort:'title',sidebarRun:1,session:{board:emptyBoard()},plugin:{settings:{cardFolder:'Notes'}},app:{vault:{getMarkdownFiles:()=>files,cachedRead:async()=>{bodies++;return 'Original body';}},metadataCache:{getFileCache:(f:File)=>{reads++;return tags.has(f)?{tags:tags.get(f)}:null;}}}});
 const render=async()=>{const el=new Element();await view.buildSidebar(el,1);return el;};
 return{view,files,tags,render,get reads(){return reads;},get bodies(){return bodies;}};
}
test('library counts tags and filters 1200 notes using one metadata read per file',async()=>{
 const f=fixture(),el=await f.render();assert.equal(f.reads,1200);assert.equal(f.bodies,0);
 assert.ok(el.all().some(el=>el.text==='#a · 600'));assert.ok(el.all().some(el=>el.text==='#b · 600'));assert.ok(el.all().some(el=>el.text==='0 篇笔记'));
});
test('library tag and path filtering retains counts, missing metadata and case semantics',async()=>{
 const f=fixture(4);f.tags.delete(f.files[3]);f.view.query='note';f.view.tag='#a';const el=await f.render();
 assert.equal(f.bodies,2);assert.equal(el.all().filter(el=>el.cls==='ts-library-card').length,2);assert.ok(el.all().some(el=>el.text==='2 篇笔记'));
 assert.ok(el.all().some(el=>el.text==='#b · 1'));
 f.view.query='#B';f.view.tag='';const none=await f.render();assert.ok(none.all().some(el=>el.text==='0 篇笔记'),'query normalization stays with the caller');
 f.view.query='#b';const one=await f.render();assert.ok(one.all().some(el=>el.text==='1 篇笔记'));
});
test('metadata is freshly read after asynchronous content loading and on the next render',async()=>{
 const f=fixture(1);f.view.query='';f.view.app.vault.cachedRead=async()=>{f.tags.set(f.files[0],['#updated']);return 'Updated body';};
 const first=await f.render();assert.ok(first.all().some(el=>el.text==='#a · 1'));assert.ok(first.all().some(el=>el.cls==='ts-library-tags'&&el.text==='#updated'));
 assert.equal(f.reads,2,'row tags after await are live, not the earlier filter snapshot');
 const second=await f.render();assert.ok(second.all().some(el=>el.text==='#updated · 1'));assert.equal(f.reads,4);
});
test('standalone matching still reads live metadata without a supplied synchronous snapshot',()=>{
 const f=fixture(1);f.view.query='#a';assert.equal(f.view.matches(f.files[0]),true);f.tags.set(f.files[0],['#b']);assert.equal(f.view.matches(f.files[0]),false);assert.equal(f.reads,2);
});
