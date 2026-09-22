import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,parseBoard,clone,History,colors,colorNames,Card,Board} from '../src/model';
import {readNodeStyle,applyNodeStyle} from '../src/board-experience';
function fixture(){
 const board=emptyBoard();board.version=3;board.nodes=[{id:'card',kind:'card',file:'note.md',transparent:true,x:0,y:0,width:300,height:200,color:'sand'},{id:'text',kind:'text',text:'text',x:400,y:0,width:200,height:100,color:'blue'},{id:'locked',kind:'card',file:'locked.md',locked:true,x:0,y:400,width:300,height:200,color:'green'}];
 let apply!:(b:Board,value:string)=>void;
 const line=readFileSync('src/main.ts','utf8').split('\n').find(l=>l.includes("select('边框颜色'"))!;
 new Function('select','colorNames','nodes','ids',transformSync(line,{loader:'ts'}).code)((_label:unknown,_options:unknown,_values:unknown,fn:typeof apply)=>{apply=fn},colorNames,board.nodes,new Set(board.nodes.map(n=>n.id)));
 return{board,apply};
}
test('border toolbar persists every explicit color without changing note, transparency or locks',()=>{
 const{board,apply}=fixture(),locked=clone(board.nodes[2]);
 for(const color of colors){apply(board,color);const loaded=parseBoard(JSON.stringify(board));assert.equal(loaded.nodes[0].customBorder,true);assert.equal(loaded.nodes[0].color,color);assert.equal(loaded.nodes[0].file,'note.md');assert.equal(loaded.nodes[0].transparent,true);assert.equal(loaded.nodes[1].customBorder,true);assert.deepEqual(loaded.nodes[2],locked);}
});
test('default border reset, undo and redo preserve the explicit choice',()=>{
 const{board,apply}=fixture(),h=new History();h.push(board);apply(board,'red');const red=clone(board);h.push(board);apply(board,'default');assert.equal(board.nodes[0].customBorder,undefined);const back=h.undo(board)!;assert.deepEqual(back,red);assert.equal(h.redo(back)!.nodes[0].customBorder,undefined);
});
test('style copy carries explicit border choice and default style clears it',()=>{
 const{board,apply}=fixture();apply(board,'purple');const style=readNodeStyle(board.nodes[0]);assert.equal(style.customBorder,true);board.nodes[1].customBorder=undefined;applyNodeStyle(board,new Set(['text']),style);assert.equal(board.nodes[1].customBorder,true);assert.equal(board.nodes[1].color,'purple');applyNodeStyle(board,new Set(['text']),{color:'sand'});assert.equal(board.nodes[1].customBorder,undefined);
});
test('invalid border override is rejected; legacy cards keep their default appearance',()=>{
 const{board}=fixture();assert.equal(parseBoard(JSON.stringify(board)).nodes[0].customBorder,undefined);(board.nodes[0] as any).customBorder='yes';assert.throws(()=>parseBoard(JSON.stringify(board)),/边框颜色/);
});
