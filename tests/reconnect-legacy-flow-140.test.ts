import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {clone,emptyBoard,parseBoard,type Board,type Card} from '../src/model';
import {reconnectEdge} from '../src/connection-flow';
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  private finishLinkDrag('),end=source.indexOf('  private createConnection(',start);
assert.ok(start>=0&&end>start);
const View=new Function('clone','reconnectEdge',transformSync(`class View{${source.slice(start,end)}};return View`,{loader:'ts'}).code)(clone,reconnectEdge);
for(const version of [1,2] as const)test(`G09 actual drag-release transaction preserves reconnect format upgrade for version ${version}`,()=>{
 const node=(id:string,x:number):Card=>({id,kind:'card',file:id+'.md',x,y:0,width:200,height:120,color:'blue'});
 const board:Board={...emptyBoard(),version,nodes:[node('a',0),node('b',400),node('c',800)],edges:[{id:'edge',from:'a',to:'b',label:'original'}]},history:Board[]=[];
 const owner={board,blocked:false,change(fn:(b:Board)=>void){history.push(clone(board));fn(board);parseBoard(JSON.stringify(board));}};
 const v=new View();Object.assign(v,{session:owner,linkDrag:{id:1,x:400,y:50,moved:true,owner,edge:{id:'edge',end:'to',expected:JSON.stringify(board.edges[0])}},connectFrom:'a',connectSide:'right',linkTarget:{id:'c',side:'top'},selected:new Set(),stage:{getBoundingClientRect:()=>({left:0,top:0,right:1200,bottom:700})},previewConnection(){},cancelConnection(this:{linkDrag:unknown}){this.linkDrag=undefined;},point:()=>({x:900,y:50}),updateSelection(){}});
 v.finishLinkDrag({pointerId:1,clientX:900,clientY:50});assert.equal(board.version,3);assert.equal(board.edges[0].to,'c');assert.equal(board.edges[0].label,'original');assert.equal(history.length,1);assert.equal(history[0].version,version);assert.doesNotThrow(()=>parseBoard(JSON.stringify(board)));
});
