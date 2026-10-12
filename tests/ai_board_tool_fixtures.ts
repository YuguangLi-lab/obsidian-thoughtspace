/// <reference path="../tools/board-tool/js-yaml.d.ts" />
import {createRequire} from 'node:module';
import {readBoardDocument,type YamlParser} from '../tools/board-tool/schema/board-document';
import type {Board,Card} from '../tools/board-tool/schema/model';
import type {InkStroke} from '../tools/board-tool/schema/ink-model';

export const parseYaml=(createRequire(import.meta.url)('js-yaml') as {load:YamlParser}).load;
export const start='<!-- thoughtspace-board-layout:start -->',end='<!-- thoughtspace-board-layout:end -->';
export const clone=<T>(value:T):T=>structuredClone(value);
export type Kind='ordinary'|'brain'|'handwriting';
export const text=(id:string,x=0):Card=>({id,kind:'text',text:id,x,y:0,width:80,height:40,color:'sand'});
export const card=(id:string,file='notes/source.md',x=0):Card=>({id,kind:'card',file,x,y:0,width:80,height:60,color:'sand'});
export const section=(id:string,x=-20):Card=>({id,kind:'section',title:id,x,y:-20,width:240,height:160,color:'blue'});
export const sampleStroke=(id='stroke-1',length=1):InkStroke=>({id,color:'#123456',width:2.75,points:Array.from({length},(_,i)=>[i/7+.123456789012345,Math.sin(i/11)+.987654321098765,i%2?1:0])});
export function board(kind:Kind='ordinary',version:1|2|3=3):Board {
 const value:Board={version,nodes:version===3?[text('node-1'),text('node-2',120)]:[card('node-1'),section('node-2',300)],edges:[{id:'edge-1',from:'node-1',to:'node-2',label:''}],viewport:{x:60,y:60,zoom:1}};
 if(kind==='brain'){
  value.version=3;value.presentation='brain';value.nodes=[{...text('node-1'),brainIdea:true,title:'Synthetic idea'},{...text('node-2',120),brainIdea:true,title:'Second idea'}];
  value.brain={version:1,centerId:'node-1',expandedIds:['node-2'],pins:['node-1'],history:{entries:['node-1'],index:0}};
 }else if(kind==='handwriting'){value.version=3;value.presentation='handwriting';value.nodes=[];value.edges=[];value.ink={version:1,strokes:[sampleStroke()]};}
 return value;
}
export function wrapped(value:unknown,extension:'md'|'thoughtspace',extra:Record<string,unknown>={},eol='\n'){
 if(extension==='thoughtspace')return JSON.stringify(value,null,2);
 const prefix='\uFEFF---\nthoughtspace: "board"\n# opaque YAML comment\nextra: {tags: [synthetic, 兼容], count: 7}\n---\n\n# Synthetic board\n\nBefore body [[notes/source]] `literal` 👀\n\n'.replaceAll('\n',eol),suffix='\n\nAfter body %% preserve %%\n'.replaceAll('\n',eol);
 return prefix+[start,'```json',JSON.stringify({format:'thoughtspace-board',version:1,...extra,board:value},null,2).replaceAll('\n',eol),'```',end].join(eol)+suffix;
}
export const realRead=(source:string,extension:'md'|'thoughtspace')=>readBoardDocument(source,extension,parseYaml);
