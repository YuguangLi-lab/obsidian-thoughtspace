import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {isWorkspaceFile} from '../src/workspace';

const source=readFileSync('src/space-hub-view.ts','utf8');
function take(start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,`Missing actual hub method: ${start}`);return source.slice(a,b);}
const methods=take('  private file(','  onOpen(')+take('  private async openItem(','  private detailHeader(')+take('  private focus(','  private renderDetail(');
class File {constructor(readonly path:string){}}
class Element {
 children:Element[]=[];classes=new Set<string>();attrs:Record<string,string>={};dataset:Record<string,string>={};hidden=false;isConnected=true;tabIndex=0;scrollTop=0;focusOptions:unknown[]=[];
 constructor(readonly ownerDocument:{activeElement:unknown},readonly tag='div',cls=''){if(cls)this.classes.add(cls);}
 append(child:Element){this.children.push(child);return child;}
 addClass(name:string){this.classes.add(name);}
 removeClass(name:string){this.classes.delete(name);}
 toggleClass(name:string,on:boolean){if(on)this.addClass(name);else this.removeClass(name);}
 setAttribute(name:string,value:string){this.attrs[name]=value;}
 contains(node:unknown):boolean{return node===this||this.children.some(c=>c.contains(node));}
 matches(selector:string){return selector.startsWith('.')?this.classes.has(selector.slice(1)):this.tag===selector;}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0]||null;}
 focus(options?:unknown){this.focusOptions.push(options);this.ownerDocument.activeElement=this;}
 disconnect(){this.isConnected=false;this.children.forEach(c=>c.disconnect());}
 empty(){this.children.forEach(c=>c.disconnect());this.children=[];this.scrollTop=0;}
}
const View=new Function('HTMLElement','TFile','isWorkspaceFile',transformSync(`class View{${methods}}return View;`,{loader:'ts'}).code)(Element,File,isWorkspaceFile);
function fixture(){
 const document={activeElement:null as unknown},main=new Element(document),detail=new Element(document),modal=new Element(document),search=new Element(document,'input');detail.hidden=true;
 const rows=['A.thoughtspace','B.thoughtspace'].map(path=>{const row=main.append(new Element(document,'article','ts-hub-result'));row.dataset.path=path;row.append(new Element(document,'button','ts-hub-result-title'));return row;});
 const titles=rows.map(row=>row.querySelector('.ts-hub-result-title')!),events:{name:string;file?:File}[]=[],files=new Map<string,unknown>(),view=new View();let resultsRendered=0,detailsRendered=0;
 Object.assign(view,{modalEl:modal,main,detail,search,app:{vault:{getAbstractFileByPath:(path:string)=>{events.push({name:'resolve'});return files.get(path);}}},
  host:{openBoard:async(file:File)=>{events.push({name:'board',file});},openNote:(file:File)=>{events.push({name:'note',file});}},close:()=>events.push({name:'close'}),
  renderResults(){resultsRendered++;main.empty();},renderDetail(){detailsRendered++;detail.empty();detail.append(new Element(document,'h3'));},
 });main.scrollTop=287;
 return{view,document,main,detail,modal,search,rows,titles,events,files,get resultsRendered(){return resultsRendered;},get detailsRendered(){return detailsRendered;}};
}
test('opening an item detail retains result DOM and scroll while updating selection and heading focus',()=>{
 const f=fixture(),children=f.main.children;f.titles[1].focus();f.view.focus('B.thoughtspace');
 assert.equal(f.main.children,children);assert.equal(f.main.children[0],f.rows[0]);assert.equal(f.main.scrollTop,287);assert.equal(f.resultsRendered,0);assert.equal(f.detailsRendered,1);
 assert.equal(f.rows[0].classes.has('is-focused'),false);assert.equal(f.rows[1].classes.has('is-focused'),true);assert.equal(f.titles[0].attrs['aria-pressed'],'false');assert.equal(f.titles[1].attrs['aria-pressed'],'true');
 assert.equal(f.detail.hidden,false);assert(f.modal.classes.has('has-detail'));const heading=f.detail.querySelector('h3')!;assert.equal(f.document.activeElement,heading);assert.equal(heading.tabIndex,-1);assert.deepEqual(heading.focusOptions,[{preventScroll:true}]);
});
test('returning from details restores the connected launching result without scrolling',()=>{
 const f=fixture();f.titles[0].focus();f.view.focus('A.thoughtspace');f.view.closeDetail();
 assert.equal(f.document.activeElement,f.titles[0]);assert.deepEqual(f.titles[0].focusOptions.at(-1),{preventScroll:true});assert.equal(f.main.scrollTop,287);assert.equal(f.detail.hidden,true);assert.equal(f.modal.classes.has('has-detail'),false);assert.equal(f.view.detailReturnFocus,undefined);
});
test('returning after the results were rebuilt falls back to the search field',()=>{
 const f=fixture();f.titles[0].focus();f.view.focus('A.thoughtspace');f.view.renderResults();assert.equal(f.titles[0].isConnected,false);
 f.view.closeDetail();assert.equal(f.document.activeElement,f.search);assert.deepEqual(f.search.focusOptions,[{preventScroll:true}]);assert.equal(f.titles[0].focusOptions.length,1);
});
test('following a reference inside details preserves the original external return target',()=>{
 const f=fixture();f.titles[0].focus();f.view.focus('A.thoughtspace');const reference=f.detail.append(new Element(f.document,'button'));reference.focus();f.view.focus('B.thoughtspace');
 assert.equal(f.view.focused,'B.thoughtspace');assert.equal(f.main.scrollTop,287);assert.equal(f.resultsRendered,0);f.view.closeDetail();assert.equal(f.document.activeElement,f.titles[0]);assert.equal(reference.focusOptions.length,1);
});
test('closing details during a scope change does not steal focus and clears the old return target',()=>{
 const f=fixture();f.titles[0].focus();f.view.focus('A.thoughtspace');const scope=new Element(f.document,'button');scope.focus();f.view.closeDetail(false);
 assert.equal(f.document.activeElement,scope);assert.equal(f.view.detailReturnFocus,undefined);assert.equal(f.search.focusOptions.length,0);assert.equal(f.titles[0].focusOptions.length,1);assert.equal(f.detail.hidden,true);
});
test('missing, non-file and excluded files leave the hub open and invoke no host action',async()=>{
 for(const value of [undefined,{path:'A.thoughtspace'},new File('ThoughtSpace-plugin-backups/old.thoughtspace')]){const f=fixture();f.files.set('A.thoughtspace',value);await assert.rejects(f.view.openItem('A.thoughtspace',true),/文件已移动或删除/);assert.deepEqual(f.events,[{name:'resolve'}]);}
});
for(const [board,path,action]of [[true,'A.thoughtspace','board'],[false,'A.md','note']] as const)test(`direct ${action} opening resolves the current file and calls only its matching host action`,async()=>{
 const f=fixture(),file=new File(path);f.files.set(path,file);await f.view.openItem(path,board);assert.deepEqual(f.events,[{name:'resolve'},{name:'close'},{name:action,file}]);assert.equal(f.resultsRendered+f.detailsRendered,0);
});
