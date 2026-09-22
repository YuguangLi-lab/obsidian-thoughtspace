import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Board,Card} from '../src/model';
import {mindmapNavigation,mindmapParent} from '../src/mindmap-navigation';

const node=(id:string,x:number,y:number):Card=>({id,x,y,width:100,height:60,kind:'text',text:id,color:'blue',topic:true});
const fixture=():Board=>({version:3,mode:'mindmap',viewport:{x:0,y:0,zoom:1},nodes:[node('root',0,0),node('right',220,0),node('left',-220,0),node('upper',220,-100),node('lower',220,100),node('deep',440,0),node('other',110,0)],edges:[['root','right'],['root','left'],['root','upper'],['root','lower'],['right','deep']].map(([from,to],i)=>({id:`edge${i}`,from,to,kind:'branch',label:''}))});

test('visual arrows navigate parents, children and siblings without moving anything',()=>{
 const b=fixture(),before=JSON.stringify(b);
 assert.equal(mindmapNavigation(b,'root','right'),'right');assert.equal(mindmapNavigation(b,'root','left'),'left');
 assert.equal(mindmapNavigation(b,'right','left'),'root');assert.equal(mindmapNavigation(b,'right','right'),'deep');
 assert.equal(mindmapNavigation(b,'right','up'),'upper');assert.equal(mindmapNavigation(b,'right','down'),'lower');
 assert.equal(mindmapParent(b,'deep'),'right');assert.equal(mindmapParent(b,'root'),undefined);assert.equal(JSON.stringify(b),before);
});
test('hidden descendants cannot receive navigation and unrelated nearby cards are ignored',()=>{
 const b=fixture();b.nodes.find(n=>n.id==='right')!.branchFolded=true;
 b.edges.push({id:'reference',from:'right',to:'other',label:'ordinary reference'});
 assert.equal(mindmapNavigation(b,'right','right'),undefined);assert.equal(mindmapNavigation(b,'deep','left'),undefined);
 assert.equal(mindmapNavigation(b,'root','right'),'right');
});
test('filtered nodes are skipped while their visible descendants remain reachable',()=>{
 const b=fixture(),eligible=(n:Card)=>n.id==='deep'||n.id==='root';
 assert.equal(mindmapNavigation(b,'root','right',eligible),'deep');assert.equal(mindmapParent(b,'deep',eligible),undefined);
 b.nodes.find(n=>n.id==='deep')!.x=5000;assert.equal(mindmapNavigation(b,'right','right'),'deep');
});
test('top-to-bottom and leftward trees follow geometry rather than a fixed axis',()=>{
 const b=fixture();for(const n of b.nodes){const old=n.x;n.x=n.y;n.y=old;}
 assert.equal(mindmapNavigation(b,'root','down'),'right');assert.equal(mindmapNavigation(b,'right','up'),'root');
 assert.equal(mindmapNavigation(b,'right','left'),'upper');assert.equal(mindmapNavigation(b,'right','right'),'lower');
});
test('stale selection, isolated topics and damaged cycles end without recursive traversal',()=>{
 const b=fixture();assert.equal(mindmapNavigation(b,'missing','right'),undefined);assert.equal(mindmapNavigation(b,'other','right'),undefined);
 b.edges.push({id:'cycle',from:'deep',to:'root',kind:'branch',label:''});assert.equal(mindmapNavigation(b,'right','left'),undefined);
});
