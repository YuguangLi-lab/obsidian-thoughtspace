import test from 'node:test';
import assert from 'node:assert/strict';
import {reflowExpandedContent} from '../src/expansion-layout';
import {clone,emptyBoard,parseBoard,type Card} from '../src/model';
import {sectionContains} from '../src/sections';

test('seeded mixed-size expansion preserves locks, membership and nonoverlap across a sparse board',()=>{
 let seed=97129;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let sample=0;sample<120;sample++){
  const cards:Card[]=Array.from({length:20},(_,i)=>({id:`n${i}`,kind:'text',text:`Node ${i}`,x:30+i%5*160,y:60+Math.floor(i/5)*130,width:120,height:90,color:'blue',...(random()<.15?{locked:true}:{})}));
  const source=cards[Math.floor(random()*cards.length)];delete source.locked;
  const group:Card={id:'group',kind:'section',title:'Mixed content',x:0,y:0,width:850,height:620,color:'green'};
  const outside:Card={id:'outside',kind:'text',text:'Outside',x:30,y:690,width:300,height:80,color:'rose'};
  const board={...emptyBoard(),version:3 as const,nodes:[...(sample%2?[group]:[]),...cards,outside]},before=clone(board);
  source.height=200+Math.floor(random()*550);if(sample%3===0)source.width=280+Math.floor(random()*240);
  reflowExpandedContent(board,before);parseBoard(JSON.stringify(board));
  const content=board.nodes.filter(n=>n.kind!=='section');
  for(let i=0;i<content.length;i++)for(const b of content.slice(i+1)){
   const a=content[i],overlap=a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
   assert.equal(overlap,false,`sample ${sample}: ${a.id} overlaps ${b.id}`);
  }
  for(const old of before.nodes){const next=board.nodes.find(n=>n.id===old.id)!;
   if(old.locked)assert.deepEqual(next,old,`sample ${sample}: moved locked ${old.id}`);
   assert.equal(next.x,old.x);assert.ok(next.y>=old.y);assert.equal(next.text,old.text);
  }
  if(sample%2){for(const n of cards)assert.ok(sectionContains(group,n),`sample ${sample}: lost ${n.id}`);assert.equal(sectionContains(group,outside),false);}
  const stable=clone(board);reflowExpandedContent(board,clone(board));assert.deepEqual(board,stable);
 }
});
