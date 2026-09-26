import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownRows} from '../src/markdown-context';
import {inlineLiteralRanges,stripInlineComments} from '../src/markdown-literals';
import {planTasks} from '../src/task-planner-model';
import {writingParts} from '../src/writing';
import {emptyBoard,type Card} from '../src/model';

function probes<T>(run:()=>T){const startsWith=String.prototype.startsWith;let count=0;String.prototype.startsWith=function(search:string,position?:number){if(search==='<!--'||search==='%%')count++;return Reflect.apply(startsWith,this,[search,position]);};try{return{value:run(),count:()=>count};}finally{String.prototype.startsWith=startsWith;}}

test('long Markdown rows with sparse comments inspect delimiters instead of probing each prose character',t=>{
 const prefix='普通段落 😀 words '.repeat(10000),text=prefix+'<!--hidden--> tail',result=probes(()=>[...markdownRows(text)]);
 assert.equal(result.value.length,1);assert.equal(result.value[0].visible,prefix+' '.repeat(13)+' tail');t.diagnostic(`${result.count()} delimiter probes`);assert(result.count()<20);
});
test('task parsing with sparse hidden metadata preserves actual due dates and protected text with bounded probes',t=>{
 const title='ordinary words '.repeat(1000),text=Array.from({length:20},(_,i)=>`- [ ] ${title}${i} <!-- 📅 2099-01-01 --> 📅 2026-09-28 \`📅 2098-01-01\``).join('\n'),result=probes(()=>planTasks(text,'notes.md','Journal'));
 assert.equal(result.value.length,20);assert(result.value.every(task=>task.due==='2026-09-28'&&task.title.includes('`📅 2098-01-01`')&&!task.title.includes('2099')));assert.equal(result.value[0].source,text.split('\n')[0]);t.diagnostic(`${result.count()} delimiter probes for 20 long tasks`);assert(result.count()<1500);
});
test('comment scanning preserves code spans crossed by comments and overlapping escaped percent markers',()=>{
 const crossing='<!-- ` --> %%hidden%% ` tail',ranges=inlineLiteralRanges(crossing);assert.deepEqual(ranges.map(r=>[crossing.slice(r.from,r.to),r.comment]),[['<!-- ` -->',true],['%%hidden%%',true]]);
 const escaped=String.raw`\%%%body%% \<!--escaped--> `+'`<!--code--> %%literal%%`';
 assert.equal(stripInlineComments(escaped),String.raw`\%  \<!--escaped--> `+'`<!--code--> %%literal%%`');
 const rows=[...markdownRows('before <!-- open\n` end --> %%hide%% tail\nplain')];assert.equal(rows[0].visible,'before '+' '.repeat(9));assert.equal(rows[1].visible,' '.repeat(9)+' '+' '.repeat(8)+' tail');assert.equal(rows[2].visible,'plain');
});
test('native Markdown metadata remains intact around YAML, callouts, fenced examples and CRLF',()=>{
 const text='---\r\ntitle: "<!--property-->"\r\n---\r\n> [!note]\r\n> ```md\r\n> <!--example-->\r\n> ```\r\n- item <!--hidden-->\r\n  continuation\r\n';
 const rows=[...markdownRows(text)];assert.deepEqual(rows.map(r=>r.source),text.split('\n'));assert.deepEqual(rows.map(r=>r.code),[true,true,true,false,true,true,true,false,false,false]);assert.equal(rows[7].visible,'- item '+' '.repeat(13));assert.equal(rows[8].topLevel,false);
});

function groupedBoard(){const b={...emptyBoard(),version:3 as const};for(let g=0;g<64;g++){b.nodes.push({id:'g'+g,kind:'section',title:'Group '+g,x:g*1000,y:0,width:800,height:600,color:'sand'});for(let i=0;i<16;i++)b.nodes.push({id:`n${g}-${i}`,kind:'text',text:'Text '+i,x:g*1000+30+i%4*160,y:60+Math.floor(i/4)*110,width:120,height:80,color:'sand'});}b.writing={title:'Draft',order:Array.from({length:64},(_,g)=>'g'+g)};return b;}
function geometryCounter(nodes:Card[]){let count=0;return{nodes:nodes.map(n=>new Proxy(n,{get(target,key,receiver){if(['x','y','width','height'].includes(String(key)))count++;return Reflect.get(target,key,receiver);}})),reads:()=>count};}
test('assembling many writing groups visits nearby material instead of scanning every object for each chapter',t=>{
 const b=groupedBoard(),saved=structuredClone(b),counter=geometryCounter(b.nodes);b.nodes=counter.nodes;const result=writingParts(b);t.diagnostic(`${counter.reads()} geometry reads for 64 groups`);assert.equal(result.length,1088);assert.deepEqual(result.slice(0,3).map(p=>[p.node.id,p.depth]),[['g0',2],['n0-0',3],['n0-1',3]]);assert(counter.reads()<65000);assert.deepEqual(b,saved);
});
test('single-group writing keeps a light scan and immediately observes moved material and exclusions',t=>{
 const b=groupedBoard(),counter=geometryCounter(b.nodes);b.nodes=counter.nodes;assert.equal(writingParts(b,['g0']).length,17);t.diagnostic(`${counter.reads()} geometry reads for one group`);assert(counter.reads()<9000);
 b.nodes.find(n=>n.id==='n0-0')!.x=50000;b.writing!.options={'n0-1':{excluded:true},'n0-2':{title:'Renamed',level:0,note:'[[source]]'}};
 const result=writingParts(b,['g0']);assert.equal(result.length,15);assert.deepEqual(result[1],{node:{...b.nodes.find(n=>n.id==='n0-2')!,title:'Renamed'},depth:0,note:'[[source]]'});
});
