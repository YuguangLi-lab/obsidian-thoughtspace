import{test}from'node:test';import assert from'node:assert/strict';
import{viewportRect,visibleNodes,edgeBounds,intersects,markdownPreview,RenderQueue}from'../src/rendering';import{Card,emptyBoard,History}from'../src/model';
const nodes:Card[]=Array.from({length:1200},(_,i)=>({id:String(i),kind:'card',file:`${i}.md`,x:i%40*380,y:Math.floor(i/40)*330,width:300,height:270,color:'sand'}));
test('1200 cards: viewport contains bounded nodes and pan reaches last row',()=>{const first=visibleNodes(nodes,viewportRect({x:40,y:40,zoom:1},1200,700));assert(first.length<30);assert(first.some(n=>n.id==='0'));assert(!first.some(n=>n.id==='1199'));const last=nodes[1199];assert(visibleNodes(nodes,viewportRect({x:-last.x,y:-last.y,zoom:1},1200,700)).some(n=>n.id==='1199'));assert.equal(nodes.length,1200);});
test('edge crossing viewport survives even when both nodes are offscreen',()=>{const a={...nodes[0],x:-1000},b={...nodes[1],x:2000};assert(intersects(edgeBounds(a,b),{x:0,y:0,width:1200,height:700}));assert(!intersects(edgeBounds(a,b),{x:0,y:3000,width:1200,height:700}));});
test('Markdown preserves headings tables wiki links and closes truncated code fences',()=>{const text='# Heading\n\n| A |\n|---|\n| B |\n[[Link]]';assert.equal(markdownPreview(text),text);const long='```js\n'+('const n=1;\n'.repeat(100));const preview=markdownPreview(long,120);assert.equal(preview.match(/```/g)?.length,2);assert(preview.endsWith('双击打开完整笔记'));assert.equal(markdownPreview('---\ntags: [a]\n---\n# H'),'# H');});
test('history budget bounds retained memory while recent undo and redo remain correct',()=>{const b=emptyBoard();b.nodes=nodes;const size=JSON.stringify(b).length*2,h=new History(size*3,80);for(let i=0;i<100;i++){h.push(b);b.viewport.x=i;}assert(h.bytes<=size*3+100);const prev=h.undo(b)!;assert.equal(prev.viewport.x,98);assert.equal(h.redo(prev)!.viewport.x,99);assert.equal(b.nodes.length,1200);});
test('render queue bounds concurrency and discards stale jobs before reading',async()=>{const q=new RenderQueue(2);let alive=true,reads=0;const releases:(()=>void)[]=[];for(let i=0;i<6;i++)q.add(()=>i<2||alive,async()=>{reads++;await new Promise<void>(r=>releases.push(r));});assert.equal(q.active,2);assert.equal(reads,2);alive=false;releases.forEach(r=>r());await new Promise(r=>setTimeout(r,10));assert.equal(reads,2);assert.equal(q.active,0);assert.equal(q.pending,0);});
test('long first body paragraph after a heading remains visible when preview is clipped',()=>{const body='字'.repeat(20000),result=markdownPreview('# 标题\n\n'+body,1000);assert.ok(result.includes('字'.repeat(900)));assert.ok(result.length<1100);});
test('a synchronous renderer failure releases its slot for later previews',async()=>{const q=new RenderQueue(1);let ran=false;assert.doesNotThrow(()=>q.add(()=>true,()=>{throw Error('renderer failed before returning a promise')}));q.add(()=>true,async()=>{ran=true});await new Promise(resolve=>setImmediate(resolve));assert.equal(ran,true);assert.equal(q.active,0);});
test('burst preview enqueue avoids rescanning the whole backlog on every add',()=>{const q=new RenderQueue(1);let checks=0;q.add(()=>true,()=>new Promise(()=>{}));for(let i=0;i<1000;i++)q.add(()=>{checks++;return true},async()=>{});assert.equal(q.pending,1000);assert.ok(checks<10000,`alive checks=${checks}`);q.clear();assert.equal(q.pending,0);});

test('preview queue preserves FIFO across compaction and skips detached jobs',async()=>{
 const q=new RenderQueue(3),seen:number[]=[],releases:(()=>void)[]=[];let alive=true,maxActive=0;
 for(let i=0;i<160;i++)q.add(()=>i<3||i%2===0||alive,async()=>{seen.push(i);maxActive=Math.max(maxActive,q.active);await new Promise<void>(r=>releases.push(r));});
 alive=false;
 while(q.active){releases.splice(0).forEach(r=>r());await new Promise(r=>setImmediate(r));}
 assert.deepEqual(seen,[0,1,2,...Array.from({length:78},(_,i)=>i*2+4)]);assert.equal(maxActive,3);assert.equal(q.pending,0);
});
test('clearing queued previews retains active accounting and accepts fresh work after rejection',async()=>{
 const q=new RenderQueue(1),seen:string[]=[];let reject!:(e:Error)=>void;
 q.add(()=>true,()=>new Promise<void>((_,r)=>{reject=r}));q.add(()=>true,async()=>{seen.push('removed')});q.clear();
 assert.equal(q.active,1);assert.equal(q.pending,0);q.add(()=>true,async()=>{seen.push('fresh')});reject(Error('renderer failed'));
 await new Promise(r=>setImmediate(r));assert.deepEqual(seen,['fresh']);assert.equal(q.active,0);assert.equal(q.pending,0);
});
