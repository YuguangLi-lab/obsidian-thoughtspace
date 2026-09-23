import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {clone,emptyBoard,History,parseBoard,type Card} from '../src/model';
import {foldCards} from '../src/board-tools';

const portal=():Card=>({id:'portal',kind:'board',file:'child.thoughtspace',x:80,y:40,width:340,height:260,color:'green'});
test('child whiteboard folds, persists and restores its original size and reference',()=>{
 const b=emptyBoard();b.version=3;b.nodes=[portal()];const before=clone(b);
 foldCards(b,new Set(['portal']),true);
 assert.equal(b.nodes[0].collapsed,true);assert.equal(b.nodes[0].height,72);assert.equal(b.nodes[0].expandedHeight,260);
 const loaded=parseBoard(JSON.stringify(b));foldCards(loaded,new Set(['portal']),true);foldCards(loaded,new Set(['portal']),false);
 assert.deepEqual(loaded,before);
});
test('persisted child-board collapse is accepted with the same geometry validation as notes',()=>{
 const b=emptyBoard();b.version=2;b.nodes=[{...portal(),collapsed:true,height:72,expandedHeight:260}];
 assert.deepEqual(parseBoard(JSON.stringify(b)),b);
 for(const bad of [{height:260},{expandedHeight:NaN},{expandedHeight:30}])assert.throws(()=>parseBoard(JSON.stringify({...b,nodes:[{...b.nodes[0],...bad}]})));
});
test('child-board folding respects locks and undo restores exact dimensions',()=>{
 const b=emptyBoard();b.version=3;b.nodes=[portal(),{...portal(),id:'locked',locked:true}];const before=clone(b),h=new History();h.push(b);
 foldCards(b,new Set(['portal','locked']),true);assert.equal(b.nodes[0].height,72);assert.deepEqual(b.nodes[1],before.nodes[1]);
 const back=h.undo(b)!;assert.deepEqual(back,before);assert.equal(h.redo(back)!.nodes[0].collapsed,true);
});

class File{path='child.thoughtspace';basename='Child board';}
class El{
 children:El[]=[];cls='';text='';isConnected=true;attrs:Record<string,string>={};disabled=false;onclick?:()=>void;ondblclick?:any;
 constructor(public parent?:El,options:any={}){this.cls=typeof options==='string'?options:options.cls||'';this.text=options.text||'';parent?.children.push(this);}
 createDiv(options:any={}){return new El(this,options)}createSpan(options:any={}){return new El(this,options)}
 addClass(cls:string){this.cls+=' '+cls}empty(){this.children=[]}setText(text:string){this.text=text}setAttribute(k:string,v:string){this.attrs[k]=v}
 all():El[]{return this.children.flatMap(c=>[c,...c.all()])}
}
function render(collapsed=false,locked=false,blocked=false,missing=false){
 const source=readFileSync('src/main.ts','utf8'),start=source.indexOf("      } else if (n.kind === 'board') {"),end=source.indexOf("      } else if(n.kind==='text'){",start);
 assert.ok(start>=0&&end>start);
 const body=source.slice(start+"      } else if (n.kind === 'board') {".length,end);
 const n={...portal(),locked,...(collapsed?{collapsed:true,height:72,expandedHeight:260}:{})},board={...emptyBoard(),version:3,nodes:[n]},el=new El(),header=el.createDiv('ts-node-header'),pending:Promise<any>[]=[];let reads=0,entered=0;
 const owner={blocked,board};const view={session:owner,app:{vault:{getAbstractFileByPath:()=>missing?null:new File()}},plugin:{readBoard:async()=>{reads++;return emptyBoard()}},mutate:(fn:any)=>fn(board),enterBoard:()=>entered++,mapPreview:()=>{},requireOwner:()=>owner};
 const button=(parent:El,label:string,_icon:string,run:()=>void,cls?:string)=>{const e=new El(parent,{cls,text:label});e.onclick=run;return e;};
 new Function('n','el','header','TFile','button','setIcon','act','boardLinks','foldCards',transformSync(body,{loader:'ts'}).code).call(view,n,el,header,File,button,()=>{},(fn:()=>any)=>{const p=fn();if(p?.then)pending.push(p);},()=>[],foldCards);
 return {n,el,header,pending,reads:()=>reads,entered:()=>entered};
}
test('collapsed portal mounts no thumbnail and does not load child content',async()=>{
 const f=render(true);await Promise.all(f.pending);assert.equal(f.reads(),0);assert.ok(!f.el.all().some(e=>e.cls==='ts-portal-preview'));
 const expand=f.el.all().find(e=>e.text==='展开子白板');assert.ok(expand);assert.equal(expand.attrs['aria-expanded'],'false');expand.onclick!();assert.equal(f.n.height,260);
});
test('expanded portal exposes collapse without breaking enter-board action',async()=>{
 const f=render();await Promise.all(f.pending);assert.equal(f.reads(),1);
 const fold=f.el.all().find(e=>e.text==='折叠子白板');assert.ok(fold);assert.equal(fold.attrs['aria-expanded'],'true');fold.onclick!();assert.equal(f.n.height,72);
 f.el.all().find(e=>e.text==='进入白板')!.onclick!();assert.equal(f.entered(),1);
});
test('portal fold controls respect locks and blocked sessions even when reference is missing',()=>{
 for(const [locked,blocked]of [[true,false],[false,true]]){const f=render(false,locked,blocked,true);const fold=f.el.all().find(e=>e.text==='折叠子白板');assert.ok(fold);assert.equal(fold.disabled,true);}
});
