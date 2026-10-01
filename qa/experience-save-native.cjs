// Same seed, native editor commit, history and atomic vault.process for both phases.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const phase=process.env.QA_PHASE||'before',out=path.resolve('dist/experience-save'),vault=path.resolve('../thoughtspace-qa-vault');fs.mkdirSync(out,{recursive:true});
const summary=a=>{const s=[...a].sort((a,b)=>a-b);return{n:s.length,p50:s[Math.ceil(s.length*.5)-1],p95:s[Math.ceil(s.length*.95)-1]};};
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9237'),p=browser.contexts()[0].pages().find(p=>p.url()==='app://obsidian.md/index.html');assert.equal(await p.evaluate(()=>app.vault.adapter.basePath),vault);
 const report={phase,method:'2 warmup + 10 native inline commit/flush samples per size; paused synthetic media; same seed reset per phase; wrappers measure change/history/emit/process; overlapping intervals must not be summed. CPU profile is a separate 3-save pass at 10k.',runtime:await p.evaluate(()=>({title:document.title,versions:process.versions,plugin:app.plugins.plugins.thoughtspace.manifest.version})),results:[]};
 await p.evaluate(async()=>{for(const leaf of app.workspace.getLeavesOfType('thoughtspace-board'))await leaf.detach();require('@electron/remote').getCurrentWindow().setSize(1440,900);app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();});
 for(const count of [1000,5000,10000]){
  const seed=path.join(out,`seed-${count}.json`);if(!fs.existsSync(seed))fs.copyFileSync(path.join(vault,`bench-${count}.thoughtspace`),seed);
  const file=`qa-experience-save-${count}.thoughtspace`;
  await p.evaluate(async({seed,file})=>{for(const leaf of app.workspace.getLeavesOfType('thoughtspace-board'))await leaf.detach();const raw=require('fs').readFileSync(seed,'utf8'),f=app.vault.getAbstractFileByPath(file);if(f)await app.vault.modify(f,raw);else await app.vault.create(file,raw);await app.plugins.plugins.thoughtspace.openBoard(app.vault.getAbstractFileByPath(file));window.perfView=app.workspace.getLeavesOfType('thoughtspace-board').find(l=>l.view.file?.path===file&&l.view.session).view;perfView.session.board.viewport={x:70,y:90,zoom:.85};perfView.renderBoard();await perfView.session.flush();},{seed,file});
  await p.waitForTimeout(600);
  await p.evaluate(()=>{const s=perfView.session;window.perfTimes={change:[],history:[],emit:[],process:[]};window.perfRestore=[];for(const [host,name,key] of [[s,'change','change'],[s.history,'push','history'],[s,'emit','emit']]){const original=host[name];host[name]=function(...args){const t=performance.now();try{return original.apply(this,args);}finally{perfTimes[key].push(performance.now()-t);}};perfRestore.push(()=>host[name]=original);}const host=app.vault,original=host.process;host.process=async function(file,...args){const t=performance.now();try{return await original.call(this,file,...args);}finally{if(file===s.file)perfTimes.process.push(performance.now()-t);}};perfRestore.push(()=>host.process=original);});
  const samples=[];
  try{
   for(let i=-2;i<10;i++){
    await p.evaluate(async()=>{await perfView.startInlineEdit('n0');perfView.inline.input.value+='s';});await p.waitForTimeout(80);
    const sample=await p.evaluate(async()=>{for(const key of Object.keys(perfTimes))perfTimes[key]=[];const t=performance.now(),saved=await perfView.inline.commit();await perfView.session.flush();if(!saved||perfView.session.blocked)throw Error('Native save failed');return{total:performance.now()-t,...Object.fromEntries(Object.entries(perfTimes).map(([key,values])=>[key,values.reduce((a,b)=>a+b,0)])),visible:perfView.positions.size,heapMiB:performance.memory.usedJSHeapSize/2**20};});if(i>=0)samples.push(sample);
   }
   report.results.push({count,samples,summary:Object.fromEntries(['total','change','history','emit','process','heapMiB'].map(key=>[key,summary(samples.map(s=>s[key]))]))});fs.writeFileSync(path.join(out,`${phase}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report.results.at(-1).summary));
   if(count===10000){const cdp=await p.context().newCDPSession(p);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');for(let i=0;i<3;i++)await p.evaluate(async()=>{await perfView.startInlineEdit('n0');perfView.inline.input.value+='p';await perfView.inline.commit();await perfView.session.flush();});const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(path.join(out,`${phase}.cpuprofile`),JSON.stringify(profile));await cdp.detach();}
  }finally{await p.evaluate(()=>{for(const restore of perfRestore.reverse())restore();});}
 }
 await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
