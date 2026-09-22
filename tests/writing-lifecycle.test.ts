import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

class TFile {constructor(public path:string){}get basename(){return this.path;}}
const source=readFileSync('src/writing-view.ts','utf8');
const setState=source.slice(source.indexOf(' async setState('),source.indexOf('\n private action('));
const onClose=source.slice(source.indexOf(' async onClose(){'),source.lastIndexOf('\n}'));
const View=new Function('TFile','writingSignature','Notice',transformSync('class View{'+setState+onClose+'};return View',{loader:'ts'}).code)(TFile,()=>'',class{});
function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};}
function fixture(){
 const files=new Map(['old','a','b'].map(p=>[p,new TFile(p)]));
 const sessions=new Map([...files].map(([p,file])=>[p,{file,board:{},listeners:new Set<()=>void>()}]));
 const releases:any[]=[],renders:string[]=[],acquired:string[]=[];
 const content={text:'old content',setText(text:string){this.text=text},empty(){this.text=''},removeAttribute(){}};
 const view=new View();Object.assign(view,{generation:0,revision:0,articleRun:0,closed:false,owner:sessions.get('old'),file:files.get('old'),pendingFields:new Map(),entryInputs:[],history:[],future:[],contentEl:content,containerEl:{removeClass(){}},app:{vault:{getAbstractFileByPath:(p:string)=>files.get(p)}},host:{release:async(owner:any)=>{releases.push(owner)},session:async(file:TFile)=>{acquired.push(file.path);return sessions.get(file.path)}},flushFields(){},disposeEditors(){},render(this:any){content.text=this.file.path;renders.push(this.file.path)},showTransition(_state:string,message:string){content.text=message}});
 return{view,files,sessions,releases,renders,acquired,content};
}
test('an old release finishing after a newer page cannot clear its session or re-open stale content',async()=>{
 const f=fixture(),gate=deferred();let count=0;f.view.host.release=async(owner:any)=>{f.releases.push(owner);if(++count===1)await gate.promise};
 const old=f.view.setState({board:'a'});await f.view.setState({board:'b'});gate.resolve();await old;
 assert.equal(f.view.owner,f.sessions.get('b'));assert.deepEqual(f.acquired,['b']);assert.equal(f.releases.filter(x=>x===f.sessions.get('old')).length,1);assert.deepEqual(f.renders,['b']);
});
test('a stale missing-file request never replaces the newer page with an error',async()=>{
 const f=fixture(),gate=deferred();let count=0;f.view.host.release=async()=>{if(++count===1)await gate.promise};
 const old=f.view.setState({board:'missing'});await f.view.setState({board:'b'});gate.resolve();await old;assert.equal(f.content.text,'b');assert.equal(f.view.owner,f.sessions.get('b'));
});
test('closing while the old session is being released cancels acquisition and clears immediately',async()=>{
 const f=fixture(),gate=deferred();f.view.host.release=async(owner:any)=>{f.releases.push(owner);await gate.promise};
 const loading=f.view.setState({board:'a'}),closing=f.view.onClose();assert.equal(f.content.text,'');gate.resolve();await Promise.all([loading,closing]);assert.deepEqual(f.acquired,[]);assert.equal(f.releases.length,1);
});
test('closing a page cleans its view even when the final flush rejects',async()=>{
 const f=fixture();f.view.host.release=async()=>{throw Error('disk failure')};await assert.rejects(f.view.onClose(),/disk failure/);assert.equal(f.view.owner,undefined);assert.equal(f.content.text,'');
});
test('a late session acquisition after closing is released without subscribing or rendering',async()=>{
 const f=fixture(),gate=deferred<any>();f.view.owner=undefined;f.view.host.session=()=>gate.promise;
 const loading=f.view.setState({board:'a'});await f.view.onClose();gate.resolve(f.sessions.get('a'));await loading;assert.equal(f.sessions.get('a')!.listeners.size,0);assert.deepEqual(f.renders,[]);assert.deepEqual(f.releases,[f.sessions.get('a')]);
});
test('failed acquisition can be retried and only the active request renders',async()=>{
 const f=fixture();f.view.host.session=async()=>{throw Error('read failure')};await assert.rejects(f.view.setState({board:'a'}),/read failure/);assert.equal(f.view.owner,undefined);f.view.host.session=async()=>f.sessions.get('a');await f.view.setState({board:'a'});assert.equal(f.view.owner,f.sessions.get('a'));assert.deepEqual(f.renders,['a']);
});
test('pending field failure preserves the current session and editor before switching',async()=>{
 const f=fixture();let disposed=false;f.view.flushFields=()=>{throw Error('pending draft')};f.view.disposeEditors=()=>{disposed=true};await assert.rejects(f.view.setState({board:'a'}),/pending draft/);assert.equal(f.view.owner,f.sessions.get('old'));assert.equal(disposed,false);assert.deepEqual(f.releases,[]);
});
test('an obsolete read failure cannot replace the successfully opened page',async()=>{
 const f=fixture(),gate=deferred<any>();f.view.owner=undefined;f.view.host.session=(file:TFile)=>file.path==='a'?gate.promise:Promise.resolve(f.sessions.get('b'));
 const old=f.view.setState({board:'a'});await f.view.setState({board:'b'});gate.reject(Error('old read failed'));await old;assert.equal(f.content.text,'b');assert.equal(f.view.owner,f.sessions.get('b'));
});
test('close captures recovery text before disposal and prevents re-opening during recovery',async()=>{
 const f=fixture(),gate=deferred<any>(),backups:any[]=[];f.view.manuscriptInput={value:'unsaved body'};f.view.flushFields=()=>{throw Error('conflict')};f.view.disposeEditors=()=>{f.view.manuscriptInput=undefined};f.view.host.createUnique=(...args:any[])=>{backups.push(args);return gate.promise};
 const closing=f.view.onClose();assert.equal(f.content.text,'');await f.view.setState({board:'b'});assert.deepEqual(f.acquired,[]);assert.equal(f.view.owner,undefined);gate.resolve({path:'recovery.md'});await closing;assert.deepEqual(backups,[['ThoughtSpace/草稿','old-未保存正文','md','unsaved body']]);assert.deepEqual(f.releases,[f.sessions.get('old')]);
});
test('repeated close does not release twice and removes the active listener',async()=>{
 const f=fixture();await f.view.setState({board:'a'});assert.equal(f.sessions.get('a')!.listeners.size,1);await Promise.all([f.view.onClose(),f.view.onClose()]);assert.equal(f.sessions.get('a')!.listeners.size,0);assert.equal(f.releases.filter(x=>x===f.sessions.get('a')).length,1);
});
test('an obsolete Markdown preview does not change the next page after rendering completes',async()=>{
 const start=source.indexOf(' async refreshArticle(){'),end=source.indexOf('\n private async pinNativeReference(',start),gate=deferred();
 const refresh=new Function('Component','MarkdownRenderer','writingWordCount',transformSync('class View{'+source.slice(start,end)+'};return View.prototype.refreshArticle',{loader:'ts'}).code)(class{load(){}unload(){}},{render:()=>gate.promise},()=>1);
 const body:any={createDiv(){return this},createSpan(){},empty(){},querySelector(){throw Error('stale preview changed')},querySelectorAll(){return []}};
 const view:any={articleRun:0,owner:{},paper:body,contentEl:{dataset:{previewManuscript:'next-page'}},state:()=>({manuscript:'draft'}),commitFields(){},articleSignature:()=>'',action(){},renderStatus(){}};
 const pending=refresh.call(view);view.articleRun++;view.state=()=>({});gate.resolve();await pending;assert.equal(view.contentEl.dataset.previewManuscript,'next-page');
});
