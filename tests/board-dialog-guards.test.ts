import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {colors,colorNames,emptyBoard,type Board} from '../src/model';
import {pdfPage} from '../src/pdf-card';

const source=readFileSync('src/main.ts','utf8');
const take=(start:string,end:string)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);};
const methods=take('  private labelEdge(','  async setTextAutoHeight(')+take('  private chooseObjects()','  private updateObjectFilter(')+take('  private choosePdfPage(','  private renderPdfCard(');
function fixture(){
 const prompts:any[]=[],actions=new Map<string,()=>void>();let renders=0,changes=0;
 class Element{value='';oninput?:()=>void;onchange?:()=>void;createDiv(){return new Element();}createEl(_tag:string,o:any={}){const e=new Element();e.value=o.value||'';return e;}setText(){}addClass(){}}
 class Prompt{constructor(_app:unknown,public title:string,public value:string,public submit:(v:string)=>void){prompts.push(this);}open(){}}
 class Modal{modalEl=new Element();titleEl=new Element();contentEl=new Element();open(){}close(){}}
 class TFile{extension='pdf';stat={mtime:1};constructor(public path:string){}}
 const files=new Map([['a.pdf',new TFile('a.pdf')],['b.pdf',new TFile('b.pdf')]]);
 const deps={Prompt,Modal,TFile,pdfPage,colors,colorNames,themeSurface:()=>{},button:(_p:unknown,label:string,_icon:string,run:()=>void)=>{actions.set(label,run);return{};}};
 const View=new Function(...Object.keys(deps),transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(...Object.values(deps));
 const board:Board={...emptyBoard(),version:3,nodes:[{id:'pdf',kind:'pdf',file:'a.pdf',x:0,y:0,width:200,height:200,color:'blue',pdfPage:1}],edges:[{id:'e',from:'a',to:'b',label:'original'}]};
 const owner={board,blocked:false,change:(run:(b:Board)=>void)=>{changes++;run(board);}};
 const view=new View();Object.assign(view,{session:owner,closed:false,app:{vault:{getAbstractFileByPath:(p:string)=>files.get(p)}},pdfTotals:new Map([['a.pdf',{stamp:1,total:10}]]),objectFilter:{kind:'text',color:'',query:'first'},renderBoard:()=>renders++,mutate:(run:(b:Board)=>void)=>owner.change(run),requireOwner:(expected=owner)=>{if(view.session!==expected||view.closed||expected.blocked)throw Error('白板已切换');return expected;}});
 return {view,owner,board,prompts,actions,files,changes:()=>changes,renders:()=>renders};
}

test('a stale edge caption prompt cannot overwrite a newer label',()=>{
 const f=fixture();f.view.labelEdge('e');f.board.edges[0].label='newer from another view';
 assert.throws(()=>f.prompts[0].submit('old dialog text'),/变化|改变/);
 assert.equal(f.board.edges[0].label,'newer from another view');assert.equal(f.changes(),0);
});
test('object filter clear cannot mutate the board navigated to behind its dialog',()=>{
 const f=fixture();f.view.chooseObjects();f.view.session={board:emptyBoard(),blocked:false};const filter=f.view.objectFilter={kind:'card',color:'blue',query:'new board'};
 assert.throws(()=>f.actions.get('清除筛选')!(),/切换/);assert.equal(f.view.objectFilter,filter);assert.equal(f.renders(),0);
});
test('PDF page dialog uses the current cached page limit even when opened from its context menu',()=>{
 const f=fixture();f.view.choosePdfPage('pdf');assert.throws(()=>f.prompts[0].submit('11'),/10/);assert.equal(f.board.nodes[0].pdfPage,1);assert.equal(f.changes(),0);
});
test('PDF page dialog cannot change a newly relinked document behind the same card id',()=>{
 const f=fixture();f.view.choosePdfPage('pdf',10);f.board.nodes[0].file='b.pdf';assert.throws(()=>f.prompts[0].submit('3'),/变化|改变/);assert.equal(f.board.nodes[0].pdfPage,1);assert.equal(f.changes(),0);
});
test('PDF page dialog rejects a replacement file at the same path',()=>{
 const f=fixture();f.view.choosePdfPage('pdf');
 const old=f.files.get('a.pdf')!,replacement=Object.assign(Object.create(Object.getPrototypeOf(old)),{path:'a.pdf',extension:'pdf',stat:{mtime:2}});
 f.files.set('a.pdf',replacement);
 assert.throws(()=>f.prompts[0].submit('3'),/变化|改变/);assert.equal(f.board.nodes[0].pdfPage,1);assert.equal(f.changes(),0);
});
test('unchanged dialogs still edit and current filter clear still works',()=>{
 const f=fixture();f.view.labelEdge('e');f.prompts[0].submit('new caption');assert.equal(f.board.edges[0].label,'new caption');f.view.choosePdfPage('pdf');f.prompts[1].submit('4');assert.equal(f.board.nodes[0].pdfPage,4);f.view.chooseObjects();f.actions.get('清除筛选')!();assert.deepEqual(f.view.objectFilter,{kind:'',color:'',query:''});
});
