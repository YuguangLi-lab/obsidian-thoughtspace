import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../src/model';
import * as mindmap from '../src/mindmap';
import {reflowReadingContent} from '../src/expansion-reading-state';
import {collectReferencedPaths,pathTouches} from '../src/board-references';

const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class Session {'),end=source.indexOf('\nexport default class ThoughtSpace',start);
const deps={...model,...mindmap,reflowReadingContent,Notice:class{},EXT:'thoughtspace',report:()=>{},collectReferencedPaths};
const Session=new Function(...Object.keys(deps),transformSync(source.slice(start,end)+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(){
 let disk=JSON.stringify(model.emptyBoard(),null,2),writes=0;
 const plugin={app:{vault:{process:async(_file:unknown,edit:(raw:string)=>string)=>{writes++;disk=edit(disk);},read:async()=>disk}},createUnique:async()=>({path:'恢复草稿.thoughtspace'})};
 const session=new Session(plugin,{path:'board.thoughtspace',basename:'board'},disk);
 return {session,disk:()=>disk,writes:()=>writes};
}

test('camera moves wait for idle or flush and do not change the save indicator',async()=>{
 const f=fixture(),events:string[]=[];f.session.listeners.add((kind:string)=>events.push(kind||'board'));
 for(let i=0;i<30;i++){f.session.board.viewport.x=i;f.session.persist(true);}
 await tick();assert.equal(f.writes(),0);assert.equal(f.session.status,'已保存');assert.deepEqual(events,[]);
 await f.session.flush();assert.equal(f.writes(),1);assert.equal(JSON.parse(f.disk()).viewport.x,29);
 assert.equal(f.session.status,'已保存');assert.deepEqual(events,[]);
});

test('flush after close still stores the latest camera',async()=>{
 const f=fixture();f.session.board.viewport={x:12,y:34,zoom:1.5};f.session.persist(true);
 await f.session.flush();assert.deepEqual(JSON.parse(f.disk()).viewport,{x:12,y:34,zoom:1.5});
});

test('referenced paths answer file and folder events without scanning nodes each time',()=>{
 const board=model.emptyBoard();board.nodes=[{id:'a',kind:'card',file:'笔记/甲.md',x:0,y:0,width:220,height:140,color:'sand'},{id:'b',kind:'text',text:'摘录',paragraphQuote:{path:'资料/乙.md'} as model.Card['paragraphQuote'],x:0,y:200,width:220,height:80,color:'sand'}];
 const paths=collectReferencedPaths(board);
 assert.equal(pathTouches(paths,'笔记/甲.md'),true);
 assert.equal(pathTouches(paths,'其他.md'),false);
 assert.equal(pathTouches(paths,'笔记','笔记'),true);
 assert.equal(pathTouches(paths,'资料/乙.md'),true);
});
