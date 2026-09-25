import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,type Board,type Card} from '../src/model';
import {editTopic} from '../src/mindmap-editor';
import {sizeTemplateTopic} from '../src/mindmap-sizing';
import {topicSvg} from '../src/mindmap-content';
import {connectionPath} from '../src/connections';
const node=(id:string,x=0,y=0,extra:Partial<Card>={}):Card=>({id,kind:'text',text:id,x,y,width:200,height:80,color:'green',...extra});
const board=(nodes:Card[]):Board=>({...emptyBoard(),version:3,nodes});

test('automatic topic batches size Unicode content without temporary per-line character arrays',()=>{
 const b=board([node('root',0,0,{mindmapRules:{automatic:true,layout:'right',density:'standard'}})]),saved=JSON.stringify(b),reduce=Array.prototype.reduce;let arrays=0,id=0;
 Array.prototype.reduce=function(this:unknown[],...args:unknown[]){if(this.length&&typeof this[0]==='string')arrays++;return Reflect.apply(reduce,this,args);} as typeof Array.prototype.reduce;
 let result:ReturnType<typeof editTopic>;try{result=editTopic(b,'root','child',Array.from({length:100},()=>('ASCII猫😀\n').repeat(20)),()=>`new${++id}`);}finally{Array.prototype.reduce=reduce;}
 assert.equal(arrays,0,'sizing should iterate code points directly instead of materializing one array per line');assert.equal(result.board.nodes.length,101);assert.equal(JSON.stringify(b),saved);
 for(const n of result.board.nodes.slice(1)){assert.equal(n.width,116);assert.equal(n.height,574);assert.equal(n.autoSize,true);assert.equal(n.textMaxWidth,280);assert.equal(n.text,('ASCII猫😀\n').repeat(20).trim());}
});

test('template sizing retains wrap arithmetic, font rules and non-text or collapsed early returns',()=>{
 for(const [text,fontSize,width,height]of [['ABC',16,80,60],['a'.repeat(100),16,280,166],['😀'.repeat(100),16,280,221],['ABC',24,80,71]] as const){const n=node('n',50,70,{text,fontSize,locked:true});sizeTemplateTopic(n);assert.equal(n.width,width);assert.equal(n.height,height);assert.equal(n.textMaxWidth,fontSize===24?360:280);assert.equal(n.x,50);assert.equal(n.y,70);assert.equal(n.locked,true);assert.equal(n.text,text);}
 const collapsed=node('collapsed',0,0,{collapsed:true,fontSize:24,width:190,height:72});Object.defineProperty(collapsed,'text',{get(){throw Error('collapsed content must not be measured');}});sizeTemplateTopic(collapsed);assert.equal(collapsed.width,190);assert.equal(collapsed.height,72);assert.equal(collapsed.autoSize,true);assert.equal(collapsed.textMaxWidth,360);
 const card=node('card',0,0,{kind:'card',file:'note.md'}),before={...card};sizeTemplateTopic(card);assert.deepEqual(card,before);
});

function svgBoard():Board{const b=board([node('root'),node('a',350,150),node('b',700,-150)]);b.edges=[{id:'branch-a',from:'root',to:'a',kind:'branch',label:'hidden branch label',style:'curve'},{id:'branch-b',from:'root',to:'b',kind:'branch',label:'',style:'curve'},...(['elbow','curve','straight'] as const).map((style,i)=>({id:`relation${i}`,from:'a',to:'b',style,label:'<relation & "label">',direction:'both' as const}))];return b;}
function hypotCount(run:()=>string){const original=Math.hypot;let calls=0;Math.hypot=(...values:number[])=>{calls++;return original(...values);};try{return{output:run(),calls};}finally{Math.hypot=original;}}

test('SVG labels reuse their edge route rather than calculating geometry a second time',()=>{
 const b=svgBoard(),saved=JSON.stringify(b),unlabelled=structuredClone(b);for(const edge of unlabelled.edges)if(edge.kind!=='branch')edge.label='';
 const plain=hypotCount(()=>topicSvg(unlabelled,'root')),labelled=hypotCount(()=>topicSvg(b,'root'));assert.ok(plain.calls>0);assert.equal(labelled.calls,plain.calls,'adding label text needs no additional route geometry');assert.equal(JSON.stringify(b),saved);
 assert.match(labelled.output,/&lt;relation &amp; &quot;label&quot;&gt;/);assert.equal(labelled.output.includes('hidden branch label'),false);
 for(const edge of b.edges.filter(e=>e.kind!=='branch')){const route=connectionPath(b.nodes[1],b.nodes[2],edge);assert.ok(labelled.output.includes(`d="${route.path}"`));assert.ok(labelled.output.includes(`<text x="${route.label.x}" y="${route.label.y-8}"`));}
});

test('SVG route reuse respects folds, escaped labels and live geometry after object replacement',()=>{
 const b=svgBoard();b.nodes[0].branchFolded=true;const folded=topicSvg(b,'root');assert.equal(folded.includes('relation &amp;'),false);assert.equal(folded.includes('<path d="M'),true,'marker definition remains');
 const unfolded=topicSvg(b,'root',true);assert.ok(unfolded.includes('&lt;relation &amp;'));
 b.nodes[1]={...b.nodes[1],x:1200,y:900};b.edges[2]={...b.edges[2],label:'new label',fromSide:'bottom',toSide:'top'};const moved=topicSvg(b,'root',true),route=connectionPath(b.nodes[1],b.nodes[2],b.edges[2]);assert.notEqual(moved,unfolded);assert.ok(moved.includes(`d="${route.path}"`));assert.ok(moved.includes(`>new label</text>`));
});

test('SVG branch validation and automatic-batch failures still leave source data untouched',()=>{
 const b=svgBoard();b.edges.push({id:'cycle',from:'b',to:'root',kind:'branch',label:''});let saved=JSON.stringify(b);assert.throws(()=>topicSvg(b,'root'),/循环/);assert.equal(JSON.stringify(b),saved);
 b.edges.pop();assert.throws(()=>topicSvg(b,'missing'),/已不存在/);b.nodes[0].mindmapRules={automatic:true,layout:'right',density:'standard'};b.nodes[1].locked=true;saved=JSON.stringify(b);assert.throws(()=>editTopic(b,'root','child',['text']),/锁定/);assert.equal(JSON.stringify(b),saved);
 b.nodes[1].locked=false;saved=JSON.stringify(b);assert.throws(()=>editTopic(b,'root','child',['text'],()=> 'root'),/冲突/);assert.equal(JSON.stringify(b),saved);
});
