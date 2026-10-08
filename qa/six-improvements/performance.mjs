import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const summary=a=>{const s=[...a].sort((a,b)=>a-b);return{n:s.length,p50:s[Math.ceil(s.length*.5)-1],p95:s[Math.ceil(s.length*.95)-1],max:s.at(-1)};};
export async function run({page,browser,out,vault,report,check,screenshot,open,load}){
 const samples=[];
 for(const count of [100,500,1000]){
  const board={version:3,presentation:'brain',nodes:Array.from({length:count},(_,i)=>({id:`n${i}`,kind:'card',file:`Note-${i}.md`,title:`Note ${i}`,x:0,y:0,width:300,height:180,color:'sand',autoFit:false})),edges:Array.from({length:count-1},(_,i)=>({id:`e${i}`,from:'n0',to:`n${i+1}`,direction:'both',label:'associated'})),viewport:{x:0,y:0,zoom:1},brainViewport:{x:0,y:0,zoom:1},brain:{version:1,centerId:'n0',expandedIds:[],pins:[],history:{entries:['n0'],index:0}}};
  samples.push({count,board,hash:createHash('sha256').update(JSON.stringify(board)).digest('hex')});await writeFile(path.join(vault,`Size-${count}.thoughtspace`),JSON.stringify(board));
 }
 await page.evaluate(async()=>{for(let i=0;i<1000;i++)if(!app.vault.getAbstractFileByPath(`Note-${i}.md`))await app.vault.create(`Note-${i}.md`,`# Note ${i}\n\nSynthetic text\n`);});
 await page.waitForTimeout(700);
 report.method={counts:[100,500,1000],order:process.env.QA_AB?'A B B A':'A profile',fixtureHashes:samples.map(s=>({count:s.count,sha256:s.hash})),warmup:6,syncSamples:40,pointerMoves:45,inputSamples:20,view:'same one-hop associated projection, bounded six neighbors plus center; identical saved camera and viewport',raf:'renderer callbacks, protocol pacing included; not presentation FPS',input:'keyboard input event to next rAF; not hardware latency',memory:'no forced GC, heap and process private sampled before/after per size'};
 const variants=process.env.QA_AB?[['A',process.env.QA_BASELINE],['B',process.env.QA_CANDIDATE],['B',process.env.QA_CANDIDATE],['A',process.env.QA_BASELINE]]:[['A',report.root]];
 for(let block=0;block<variants.length;block++){
  const [variant,root]=variants[block];if(block||process.env.QA_AB)await load(root);
  for(const {count}of samples){
   await page.evaluate(async({file,board})=>{await app.vault.modify(app.vault.getAbstractFileByPath(file),JSON.stringify(board));},{file:`Size-${count}.thoughtspace`,board:samples.find(s=>s.count===count).board});await open(`Size-${count}.thoughtspace`);await page.bringToFront();await page.evaluate(()=>{require('@electron/remote').getCurrentWindow().focus();app.workspace.setActiveLeaf(qaView.leaf,{focus:true});});await page.waitForTimeout(350);
   const cdp=await browser.contexts()[0].newCDPSession(page);await cdp.send('Performance.enable');
   await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:100});await cdp.send('Profiler.start');
   const cold=await page.evaluate(()=>{const values=[];for(let i=0;i<8;i++){qaView.brainNativeRevision=(qaView.brainNativeRevision||0)+1;const start=performance.now();qaView.brainBoardView.refresh();values.push(performance.now()-start);}return values;});
   const sync=await page.evaluate(()=>{
    const brain=qaView.brainBoardView,host=brain.host,original=host.snapshot;let nativeMs=0,nativeCalls=0,sourceCalls=0;const originalSource=host.source;
    host.source=(...args)=>{sourceCalls++;return originalSource(...args);};
    host.snapshot=()=>{const value=original();if(value?.native){const native=value.native;return{...value,native:id=>{const start=performance.now();const result=native(id);nativeMs+=performance.now()-start;nativeCalls++;return result;}};}return value;};
    const heapBefore=performance.memory.usedJSHeapSize,values=[];const svg=document.querySelector('.ts-brain-links'),first=svg.querySelector('path:not(defs path)');let retained=0;
    for(let i=0;i<46;i++){const start=performance.now();brain.refresh();if(i>=6)values.push(performance.now()-start);if(first===svg.querySelector('path:not(defs path)'))retained++;}
    host.snapshot=original;host.source=originalSource;
    return{values,nativeMs,nativeCalls,sourceCalls,retained,visible:brain.layout.nodes.length,domNodes:document.querySelectorAll('.ts-brain-node').length,paths:svg.querySelectorAll('path').length,heapBefore,heapAfter:performance.memory.usedJSHeapSize};
   });
   const profile=await cdp.send('Profiler.stop');await writeFile(path.join(out,`cpu-${variant}-${block}-${count}.json`),JSON.stringify(profile.profile));
   const cpuNodes=profile.profile.nodes,byId=new Map(cpuNodes.map(n=>[n.id,n])),hot=new Map();for(let i=0;i<(profile.profile.samples||[]).length;i++){const node=byId.get(profile.profile.samples[i]);if(!node)continue;const key=node.callFrame.functionName||'(anonymous)';hot.set(key,(hot.get(key)||0)+(profile.profile.timeDeltas[i]||0));}
   const top=[...hot].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([functionName,micros])=>({functionName,micros}));
   const before=await cdp.send('Performance.getMetrics');
   await page.evaluate(()=>{window.qaFrames=[];window.qaLong=[];window.qaSampling=true;window.qaPrevious=undefined;window.qaLongObserver=new PerformanceObserver(list=>qaLong.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));qaLongObserver.observe({type:'longtask',buffered:false});const step=t=>{if(!qaSampling)return;if(qaPrevious!==undefined)qaFrames.push(t-qaPrevious);qaPrevious=t;requestAnimationFrame(step);};requestAnimationFrame(step);});
   const stage=await page.locator('.ts-brain-stage').boundingBox();await page.mouse.move(stage.x+stage.width-80,stage.y+stage.height-100);await page.mouse.down();for(let i=0;i<45;i++)await page.mouse.move(stage.x+stage.width-80-70*Math.sin(i/44*Math.PI),stage.y+stage.height-100-50*Math.sin(i/44*Math.PI));await page.mouse.up();
   await page.locator('.ts-brain-query').fill('');await page.locator('.ts-brain-query').focus();
   await page.evaluate(()=>{window.qaInputs=[];window.qaInputHandler=()=>{const start=performance.now();requestAnimationFrame(()=>qaInputs.push(performance.now()-start));};document.addEventListener('input',qaInputHandler,true);});
   for(let i=0;i<23;i++){await page.locator('.ts-brain-query').focus();await page.keyboard.type(i%2?'0':'N');await page.waitForTimeout(35);}await page.keyboard.press('Escape');
   const motion=await page.evaluate(async()=>{qaSampling=false;qaLongObserver.disconnect();document.removeEventListener('input',qaInputHandler,true);const privateInfo=await process.getProcessMemoryInfo();return{frames:qaFrames,inputs:qaInputs.slice(3),longTasks:qaLong,heap:performance.memory.usedJSHeapSize,privateMiB:privateInfo.private/1024};});
   const after=await cdp.send('Performance.getMetrics');const metric=key=>(after.metrics.find(m=>m.name===key)?.value||0)-(before.metrics.find(m=>m.name===key)?.value||0);
   const row={variant,block,count,cold,sync,top,motion,rendererMs:{task:metric('TaskDuration')*1000,script:metric('ScriptDuration')*1000,layout:metric('LayoutDuration')*1000,style:metric('RecalcStyleDuration')*1000},summary:{invalidatedRefreshMs:summary(cold),syncMs:summary(sync.values),rafMs:summary(motion.frames),inputToRafMs:summary(motion.inputs)}};
   report.metrics.push(row);check(`${variant}-${block}-${count}: fixed visible/DOM budget`,sync.visible===7&&sync.domNodes===7&&sync.paths===7);check(`${variant}-${block}-${count}: 20 measured native keyboard inputs`,motion.inputs.length,20);console.log(JSON.stringify({variant,block,count,...row.summary,nativeMs:sync.nativeMs,nativeCalls:sync.nativeCalls,retained:sync.retained,top:top.slice(0,7)}));
   await page.locator('.ts-brain-query').fill('');await screenshot(`brain-${variant}-${block}-${count}.png`);await cdp.detach();await page.evaluate(async()=>{await qaView.session.flush();await qaView.leaf.detach();});
   await writeFile(path.join(out,'report-progress.json'),JSON.stringify(report,null,2));
  }
 }
}
