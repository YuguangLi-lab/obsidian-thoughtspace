import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {clone,emptyBoard,uid,type Card} from '../src/model';
import {connectionSides} from '../src/connections';
import {sectionDisplayNode} from '../src/sections';
import {duplicateConnection,reconnectEdge} from '../src/connection-flow';

const source=readFileSync('src/main.ts','utf8');
const take=(from:string,to:string)=>{const start=source.indexOf(from),end=source.indexOf(to,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
const methods=take('  private addPorts(','  private cancelConnection(')+take('  private startLinkDrag(','  private previewConnection(')+take('  private finishLinkDrag(','  sectionNavigator(');
const deps={clone,uid,connectionSides,sectionDisplayNode,duplicateConnection,reconnectEdge,act:(fn:()=>unknown)=>fn()};
const View=new Function(...Object.keys(deps),transformSync(`return class View{${methods}}`,{loader:'ts'}).code)(...Object.values(deps));
function fixture(){
 const board={...emptyBoard(),version:3 as const,mode:'mindmap' as const,nodes:[{id:'a',kind:'section',title:'A',x:0,y:0,width:300,height:200,color:'blue'},{id:'b',kind:'section',title:'B',x:600,y:0,width:300,height:200,color:'blue'}] as Card[]},v=new View(),ports:any[]=[],stats={topics:0,updates:0,captures:0,stops:0,prevented:0};
 const owner={board,blocked:false,change(fn:(b:typeof board)=>void){fn(this.board);}};
 Object.assign(v,{session:owner,mode:'select',selected:new Set(),positions:new Map(),plugin:{settings:{defaultEdgeStyle:'curve',defaultEdgeDirection:'forward'}},stage:{addClass(){},toggleClass(){},focus(){},setPointerCapture(){stats.captures++;},hasPointerCapture(){return false;},getBoundingClientRect(){return{left:0,top:0,right:1000,bottom:800};}},cancelConnection(){v.linkDrag=undefined;v.connectFrom=undefined;v.connectSide=undefined;v.mode='select';},setSectionTool(){},syncSelectionTool(){},previewConnection(){},updateSelection(){stats.updates++;},scheduleRender(){},point:(x:number,y:number)=>({x,y}),addTopic(){stats.topics++;}});
 const el={createEl(_tag:string,options:any){const port={...options};ports.push(port);return port;}};v.addPorts(el,'a');v.addPorts(el,'b');
 const event=(detail=1)=>({button:0,ctrlKey:false,pointerId:5,clientX:0,clientY:0,detail,stopPropagation(){stats.stops++;},preventDefault(){stats.prevented++;}});
 return{v,board,ports,stats,event};
}
test('mindmap group port press/release stays in connection mode without creating a text topic',()=>{
 const f=fixture();f.ports[1].onpointerdown(f.event());assert.equal(f.v.linkDrag.topicClick,false);f.v.finishLinkDrag(f.event());
 assert.equal(f.stats.topics,0);assert.equal(f.board.nodes.length,2);assert.equal(f.v.mode,'connect');assert.equal(f.v.connectFrom,'a');
 f.ports[7].onclick(f.event(0));assert.equal(f.board.edges.length,1);assert.deepEqual([f.board.edges[0].from,f.board.edges[0].to],['a','b']);assert.equal(f.board.edges[0].kind,undefined);assert.equal(f.stats.topics,0);
});
test('group source pointer and generated click stop propagation without double activation',()=>{
 const f=fixture(),port=f.ports[1];port.onpointerdown(f.event());port.onclick(f.event());assert.equal(f.stats.captures,1);assert.equal(f.stats.stops,3);assert.equal(f.stats.prevented,2);assert.equal(f.board.edges.length,0);assert.equal(f.stats.topics,0);assert.equal(f.v.connectFrom,'a');
});
test('keyboard activation on group ports links groups while content ports keep topic behavior',()=>{
 const f=fixture();f.ports[1].onclick(f.event(0));f.ports[7].onclick(f.event(0));assert.equal(f.board.edges.length,1);assert.equal(f.stats.topics,0);assert.equal(f.v.mode,'select');
 f.board.nodes[0].kind='text';f.board.nodes[0].text='Topic';const ports:any[]=[];f.v.addPorts({createEl(_tag:string,options:any){const p={...options};ports.push(p);return p;}},'a');ports[1].onclick(f.event(0));assert.equal(f.stats.topics,1);
});
