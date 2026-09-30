// Native Obsidian benchmark. Only use an isolated vault; exact path guard below.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const prefix=process.env.QA_PREFIX||'bench';const root=path.resolve('..'),vault=path.join(root,'thoughtspace-qa-vault'),out=path.resolve(process.env.QA_OUTPUT||'dist/performance-native');fs.mkdirSync(out,{recursive:true});
const summary=a=>{const s=[...a].sort((a,b)=>a-b);return{n:a.length,p50:s[Math.ceil(s.length*.5)-1],p95:s[Math.ceil(s.length*.95)-1],min:s[0],max:s.at(-1)};};
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:9237');const p=b.contexts()[0].pages().find(p=>p.url().includes('app://obsidian.md'));assert.equal(await p.evaluate(()=>app.vault.adapter.basePath),vault);
 await p.waitForFunction(()=>app.plugins.plugins.thoughtspace);
 await p.bringToFront();await p.evaluate(()=>{require('@electron/remote').getCurrentWindow().setBounds({x:10,y:35,width:1440,height:1000});require('@electron/remote').getCurrentWindow().focus();app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();});
 const report={baseline:'ec80f89 / ThoughtSpace 1.3.24',runtime:await p.evaluate(()=>({title:document.title,electron:process.versions,viewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio,vault:app.vault.adapter.basePath,plugin:app.plugins.plugins.thoughtspace.manifest.version})),method:'Native Obsidian, 1440x1000 window, default theme. Per size 1 warmup then 3 measured pan/zoom runs (90 pointer moves + 30 wheel events each); 3 warmup + 20 measured keyboard inputs (beforeinput to next rAF, not hardware-to-photon); 2 warmup + 10 measured inline edit commits incl Session.flush, real temporary-vault writes. No forced GC. Media are local synthetic valid files; paused. No edges. Frame deltas include protocol pacing and scheduler, not GPU presentation timing.',results:[],errors:[]};p.on('pageerror',e=>report.errors.push(e.message));
 for(const count of [1000,5000,10000]){
  await p.evaluate(async ({count,prefix})=>{for(const l of app.workspace.getLeavesOfType('thoughtspace-board'))await l.detach();await app.workspace.getLeaf('tab').openFile(app.vault.getAbstractFileByPath(`${prefix}-${count}.thoughtspace`));window.qaView=app.workspace.getLeavesOfType('thoughtspace-board')[0].view;await qaView.session.flush();},{count,prefix});
  await p.waitForTimeout(1200);
  const result={count,bytes:fs.statSync(path.join(vault,`${prefix}-${count}.thoughtspace`)).size,frames:{pan:[],zoom:[]},input:[],save:[],memory:[],runs:[],visible:[]};
  for(let run=-1;run<3;run++){
   await p.evaluate(()=>{qaView.inline?.cancel();qaView.session.board.viewport={x:70,y:90,zoom:.85};qaView.renderBoard();});await p.waitForTimeout(250);
   const stage=await p.locator('.ts-stage').first().boundingBox();assert.ok(stage);const x=stage.x+stage.width*.65,y=stage.y+stage.height*.75;
   for(const mode of ['pan','zoom']){
    await p.evaluate(()=>{window.qaFrames=[];window.qaFrameLast=undefined;window.qaSampling=true;const step=t=>{if(!qaSampling)return;if(qaFrameLast!==undefined)qaFrames.push(t-qaFrameLast);qaFrameLast=t;requestAnimationFrame(step);};requestAnimationFrame(step);});
    if(mode==='pan'){await p.mouse.move(x,y);await p.mouse.down({button:'middle'});for(let i=0;i<90;i++)await p.mouse.move(x-400*Math.sin(i/89*Math.PI),y-180*Math.sin(i/89*Math.PI));await p.mouse.up({button:'middle'});}
    else{await p.mouse.move(x,y);for(let i=0;i<30;i++){await p.mouse.wheel(0,i<15?-22:22);await p.waitForTimeout(16);}}
    const data=await p.evaluate(()=>{qaSampling=false;return{frames:qaFrames,visible:document.querySelectorAll('.ts-node').length,viewport:qaView.session.board.viewport};});if(run>=0){result.frames[mode].push(...data.frames);result.runs.push({run,mode,...data});result.visible.push(data.visible);}await p.evaluate(()=>qaView.session.flush());
   }
  }
  await p.evaluate(()=>qaView.startInlineEdit('n0'));await p.locator('.cm-content').first().waitFor({state:'visible'}).catch(()=>{});
  console.log('EDITOR',count,await p.evaluate(()=>({native:!!qaView.inline?.native,input:qaView.inline?.input?.tagName,cm:document.querySelectorAll('.cm-content').length})));
  await p.evaluate(()=>{window.qaInputs=[];window.qaInputHandler=()=>{const t=performance.now();requestAnimationFrame(()=>qaInputs.push(performance.now()-t));};document.addEventListener('beforeinput',qaInputHandler,true);qaView.inline.input.focus();});
  for(let i=0;i<23;i++){await p.keyboard.type('x');await p.waitForTimeout(45);}
  result.input=await p.evaluate(()=>{document.removeEventListener('beforeinput',qaInputHandler,true);return qaInputs.slice(3);});
  for(let i=-2;i<10;i++){
   if(i!==-2)await p.evaluate(()=>qaView.startInlineEdit('n0'));
   await p.keyboard.type('s');await p.waitForTimeout(70);
   const elapsed=await p.evaluate(async()=>{const t=performance.now();const saved=await qaView.inline.commit();await qaView.session.flush();if(!saved||qaView.session.blocked)throw Error('Save failed');return performance.now()-t;});
   if(i>=0){result.save.push(elapsed);result.memory.push(await p.evaluate(async()=>({heapMiB:performance.memory?.usedJSHeapSize/2**20,process:await process.getProcessMemoryInfo()})));}
  }
  result.summary={panMs:summary(result.frames.pan),zoomMs:summary(result.frames.zoom),inputToRafMs:summary(result.input),saveMs:summary(result.save),heapMiB:summary(result.memory.map(m=>m.heapMiB)),privateMiB:summary(result.memory.map(m=>m.process.private/1024))};
  report.results.push(result);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await p.screenshot({path:path.join(out,`${count}.png`)});console.log(JSON.stringify({count,...result.summary}));
 }
 await b.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
