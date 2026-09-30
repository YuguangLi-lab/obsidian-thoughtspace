import {readFile,writeFile,mkdir,copyFile,mkdtemp,readdir,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.resolve(process.env.QA_OUTPUT||path.join(root,'dist/board-polish-next'));
const temporary=await mkdtemp(path.join(tmpdir(),'thoughtspace-board-polish-'));
const profile=path.join(temporary,'profile'),vault=path.join(temporary,'vault'),plugin=path.join(vault,'.obsidian/plugins/thoughtspace');
await mkdir(plugin,{recursive:true});await mkdir(profile);await mkdir(out,{recursive:true});
const profileSource=process.env.OBSIDIAN_PROFILE||path.join(process.env.HOME,'Library/Application Support/obsidian');
const packages=(await readdir(profileSource)).filter(file=>/^obsidian-\d+\.\d+\.\d+\.asar$/.test(file)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
assert.ok(packages.length,'An installed Obsidian runtime is required');
await copyFile(path.join(profileSource,packages.at(-1)),path.join(profile,packages.at(-1)));
await writeFile(path.join(profile,'obsidian.json'),JSON.stringify({vaults:{baad0000ca4d0001:{path:vault,ts:Date.now(),open:true}}}));
await writeFile(path.join(vault,'.obsidian/community-plugins.json'),'["thoughtspace"]');
await writeFile(path.join(vault,'.obsidian/app.json'),JSON.stringify({alwaysUpdateLinks:true,showUnsupportedFiles:true}));
for(const file of ['main.js','styles.css','manifest.json'])await copyFile(path.join(root,file),path.join(plugin,file));
await writeFile(path.join(plugin,'data.json'),JSON.stringify({onboardingVersion:99,alignmentGuides:false}));
const notes={
 index:'# Research notebook\n\n'+Array.from({length:35},(_,i)=>`Paragraph ${i+1}: evidence, questions, and a repeatable observation.\n\n`).join(''),
 sticky:'# Next steps\n\n- [ ] Check the source\n- [x] Keep the original notes\n\nOne small, verifiable change at a time.',
 paper:'# Reference\n\nA locked reference card should stay in place.',
};
for(const [id,content]of Object.entries(notes))await writeFile(path.join(vault,`${id}.md`),content);
const original={version:3,nodes:[
 {id:'index',kind:'card',file:'index.md',title:'Research notebook',x:80,y:120,width:300,height:240,autoFit:false,cardStyle:'index',color:'blue'},
 {id:'sticky',kind:'card',file:'sticky.md',title:'Next steps',x:470,y:140,width:300,height:220,autoFit:false,cardStyle:'sticky',color:'rose',fillColor:'lime'},
 {id:'paper',kind:'card',file:'paper.md',title:'Reference',x:470,y:480,width:300,height:200,autoFit:false,cardStyle:'paper',locked:true,color:'teal'},
 {id:'table',kind:'text',text:'| Item | Value |\n| --- | --- |\n| First | 128 |\n| Second | 256 |',x:80,y:470,width:300,height:170,color:'green',textAutoHeight:false,autoSize:false},
],edges:[{id:'relation',from:'index',to:'sticky',label:'Next'}],viewport:{x:40,y:30,zoom:1}};
await writeFile(path.join(vault,'Polish.thoughtspace'),JSON.stringify(original));
const report={scope:'Isolated native Obsidian. Actual Playwright pointer/wheel/keyboard input for gestures; fixture model setup for scale/theme/large board. Timings are local synchronous renderer samples, not FPS or hardware input latency.',temporary,runtime:packages.at(-1),checks:[],screenshots:[],errors:[],metrics:[]};
report.build=Object.fromEntries(await Promise.all(['main.js','styles.css','manifest.json'].map(async file=>[file,createHash('sha256').update(await readFile(path.join(plugin,file))).digest('hex')])));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(name,actual,expected=true)=>{report.checks.push({name,passed:JSON.stringify(actual)===JSON.stringify(expected),actual,expected});assert.deepEqual(actual,expected,name);console.log(`PASS ${name}`);};
let application,browser,page;
try{
 application=spawn(process.env.OBSIDIAN_PATH||'/Applications/Obsidian.app/Contents/MacOS/Obsidian',[`--user-data-dir=${profile}`,'--remote-debugging-port=0'],{stdio:'ignore'});
 let port;for(let i=0;i<100&&!port;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await sleep(200);}}
 assert.ok(port,'Isolated CDP endpoint failed to start');
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);page=browser.contexts()[0].pages()[0];
 check('isolated profile',await realpath(await page.evaluate(()=>require('@electron/remote').app.getPath('userData'))),await realpath(profile));
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.waitForFunction(()=>window.app?.workspace?.layoutReady,{},{timeout:40000});
 const trust=page.getByRole('button',{name:/信任仓库作者并启用插件|Trust author and enable plugins/});if(await trust.count())await trust.click();
 await page.waitForFunction(()=>!!app.plugins.plugins.thoughtspace,{},{timeout:20000});
 await page.evaluate(()=>{app.setting.close();require('@electron/remote').getCurrentWindow().focus();});await page.bringToFront();
 await page.evaluate(async()=>{await app.plugins.plugins.thoughtspace.openBoard(app.vault.getAbstractFileByPath('Polish.thoughtspace'));window.qaView=app.workspace.getLeavesOfType('thoughtspace-board').find(leaf=>leaf.view.file?.path==='Polish.thoughtspace').view;app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();require('@electron/remote').getCurrentWindow().setBounds({x:40,y:40,width:1440,height:1040});});
 await page.waitForFunction(()=>window.qaView?.session?.board?.nodes?.length===4);
 // Trusting a test vault can open Settings in a separate window after startup.
 // Verify the host keyboard window, not just the DOM's active element.
 await page.waitForTimeout(500);
 for(const other of browser.contexts()[0].pages())if(other!==page)await other.close();
 await page.bringToFront();await page.evaluate(()=>require('@electron/remote').getCurrentWindow().focus());
 await page.waitForFunction(()=>activeWindow===window,{},{timeout:5000});
 check('host keyboard window is the isolated board',await page.evaluate(()=>activeWindow===window));
 const node=id=>page.locator(`.ts-node[data-id="${id}"]`);
 const readNode=id=>page.evaluate(id=>{const n=qaView.session.board.nodes.find(n=>n.id===id);return{x:n.x,y:n.y,width:n.width,height:n.height};},id);
 const reset=async(zoom=1)=>{
  await page.evaluate(({board,zoom})=>{qaView.clearCanvasGesture();qaView.session.change(b=>Object.assign(b,board,{viewport:{...board.viewport,zoom}}));qaView.plugin.settings.alignmentGuides=false;qaView.selected.clear();qaView.updateSelection();qaView.renderBoard();},{board:original,zoom});
  await page.waitForTimeout(200);
  await page.evaluate(()=>{app.workspace.setActiveLeaf(qaView.leaf,{focus:true});qaView.stage.focus();});
  const blank=await page.locator('.ts-stage').boundingBox();assert.ok(blank);
  await page.mouse.move(blank.x+blank.width-70,blank.y+blank.height-140);await page.waitForTimeout(200);
 };
 const headerPoint=async id=>{const header=await node(id).locator('.ts-node-header').boundingBox(),r=header||await node(id).boundingBox();assert.ok(r);return{x:r.x+r.width*.4,y:r.y+(header?header.height*.5:6)};};
 const drag=async(p,dx,dy,cancel=false)=>{await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+dx,p.y+dy,{steps:12});if(cancel)await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(80);};
 const screenshot=async name=>{await page.screenshot({path:path.join(out,name)});report.screenshots.push(name);};
 for(const zoom of [.5,1,2]){
  await reset(zoom);
  const start=await readNode('index');
  await drag(await headerPoint('index'),48,24);
  check(`zoom ${zoom}: drag uses board coordinates`,await readNode('index'),{...start,x:start.x+48/zoom,y:start.y+24/zoom});
  check(`zoom ${zoom}: pointer release clears gesture`,await page.evaluate(()=>!qaView.gesture&&!qaView.dragging));
  await page.keyboard.press('Meta+z');await page.waitForTimeout(120);
  check(`zoom ${zoom}: keyboard undo restores drag`,await readNode('index'),start);
  await drag(await headerPoint('index'),40,20,true);
  check(`zoom ${zoom}: Escape cancels drag`,await readNode('index'),start);
  const p=await headerPoint('index');await page.mouse.click(p.x,p.y);
  // Native desktop windows may be clamped by the display. Pan the bottom
  // resize handle into view without changing the node's board geometry.
  if(zoom===2){await page.evaluate(()=>{qaView.session.board.viewport.y-=180;qaView.renderBoard(true);});await page.waitForTimeout(80);}
  const handle=await node('index').locator(':scope > .ts-resize').boundingBox();assert.ok(handle);
  await drag({x:handle.x+handle.width/2,y:handle.y+handle.height/2},36,20);
  check(`zoom ${zoom}: resize uses board coordinates`,await readNode('index'),{...start,width:start.width+36/zoom,height:start.height+20/zoom});
  await page.keyboard.press('Meta+z');await page.waitForTimeout(100);
  check(`zoom ${zoom}: undo restores size`,await readNode('index'),start);
  const again=await node('index').locator(':scope > .ts-resize').boundingBox();assert.ok(again);
  await drag({x:again.x+again.width/2,y:again.y+again.height/2},30,15,true);
  check(`zoom ${zoom}: Escape cancels resize`,await readNode('index'),start);
 }
 await reset();
 const first=await headerPoint('index');
 await page.mouse.click(first.x,first.y);
 const secondRect=await node('sticky').boundingBox();assert.ok(secondRect);
 const second={x:secondRect.x+secondRect.width*.8,y:secondRect.y+secondRect.height*.8};
 await page.keyboard.down('Shift');await page.mouse.click(second.x,second.y);await page.keyboard.up('Shift');
 check('Shift click selects both cards',await page.evaluate(()=>[...qaView.selected].sort()),['index','sticky']);
 await drag(first,30,20);
 check('batch drag moves first card',await readNode('index'),{x:110,y:140,width:300,height:240});
 check('batch drag moves second card',await readNode('sticky'),{x:500,y:160,width:300,height:220});
 await page.keyboard.press('Meta+z');await page.waitForTimeout(100);
 check('one undo restores both cards',await page.evaluate(()=>qaView.session.board.nodes.filter(n=>['index','sticky'].includes(n.id)).map(n=>[n.x,n.y])),[[80,120],[470,140]]);
 await reset();
 const locked=await readNode('paper');await drag(await headerPoint('paper'),60,25);
 check('locked card cannot be dragged',await readNode('paper'),locked);
 check('locked card cannot be resized',await node('paper').locator(':scope > .ts-resize').count(),0);
 await reset();
 const p=await headerPoint('index');await page.mouse.click(p.x,p.y);
 const scrollState=await page.evaluate(()=>{const e=document.querySelector('.ts-node[data-id="index"] .ts-card-preview');window.qaPreview=e;return{viewport:{...qaView.session.board.viewport},top:e.scrollTop,scrollable:e.scrollHeight>e.clientHeight};});
 check('long note is scrollable',scrollState.scrollable);
 const preview=await node('index').locator('.ts-card-preview').boundingBox();assert.ok(preview);
 await page.mouse.move(preview.x+preview.width/2,preview.y+preview.height/2);await page.mouse.wheel(0,200);await page.waitForTimeout(160);
 check('wheel scrolls note body',await page.evaluate(()=>qaPreview.scrollTop>0));
 check('note scrolling keeps board still',await page.evaluate(()=>qaView.session.board.viewport),scrollState.viewport);
 await page.evaluate(()=>qaPreview.scrollTop=qaPreview.scrollHeight);await page.mouse.wheel(0,200);await page.waitForTimeout(120);
 check('note scroll boundary keeps board still',await page.evaluate(()=>qaView.session.board.viewport),scrollState.viewport);
 const beforePan=await page.evaluate(()=>({viewport:{...qaView.session.board.viewport},scroll:qaPreview.scrollTop}));
 const stage=await page.locator('.ts-stage').boundingBox();assert.ok(stage);
 const blank={x:stage.x+stage.width*.82,y:stage.y+stage.height*.5};
 await drag(blank,-60,-40,true);
 check('Escape cancels camera pan',await page.evaluate(()=>qaView.session.board.viewport),beforePan.viewport);
 await drag(blank,-50,-30);
 check('blank drag pans board',await page.evaluate(()=>qaView.session.board.viewport),{...beforePan.viewport,x:beforePan.viewport.x-50,y:beforePan.viewport.y-30});
 check('panning preserves preview DOM and scroll',await page.evaluate(top=>qaPreview===document.querySelector('.ts-node[data-id="index"] .ts-card-preview')&&qaPreview.scrollTop===top,beforePan.scroll));
 await page.mouse.move(blank.x-50,blank.y-30);await page.keyboard.down('Control');await page.mouse.wheel(0,-120);await page.keyboard.up('Control');await page.waitForTimeout(160);
 check('modified wheel zooms board',await page.evaluate(()=>qaView.session.board.viewport.zoom>1));
 check('zoom preserves preview DOM and scroll',await page.evaluate(top=>qaPreview===document.querySelector('.ts-node[data-id="index"] .ts-card-preview')&&qaPreview.scrollTop===top,beforePan.scroll));
 await reset();
 await page.mouse.click((await headerPoint('index')).x,(await headerPoint('index')).y);
 await node('index').locator('.ts-card-quick-fold').click();await page.waitForTimeout(100);
 check('fold button produces compact card',await node('index').evaluate(el=>el.classList.contains('is-compact-fold')));
 await node('index').locator('.ts-compact-inline-unfold').click();await page.waitForTimeout(150);
 check('unfold restores expanded dimensions',await readNode('index'),{x:80,y:120,width:300,height:240});
 check('unfold restores note content',await node('index').locator('.ts-card-preview').textContent().then(text=>text.includes('Paragraph 35')));
 await page.evaluate(()=>qaView.session.flush());
 check('board flush preserves all notes',Object.fromEntries(await Promise.all(Object.keys(notes).map(async id=>[id,await readFile(path.join(vault,`${id}.md`),'utf8')]))),notes);
 for(const theme of ['light','dark']){
  await reset();
  await page.evaluate(theme=>{document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');qaView.selected=new Set(['index']);qaView.updateSelection();},theme);
  await screenshot(`native-${theme}-desktop.png`);
  for(const width of [640,420]){
   await page.evaluate(width=>{qaView.containerEl.style.width=`${width}px`;qaView.containerEl.style.flex='none';qaView.session.board.viewport={x:0,y:120,zoom:.8};qaView.onResize?.();qaView.renderBoard();},width);await page.waitForTimeout(200);
   const rect=await node('index').locator('.ts-card-actions').boundingBox(),surface=await page.locator('.ts-stage').boundingBox();assert.ok(rect&&surface);
   check(`${theme} pane ${width}: quick actions fit width`,rect.x>=surface.x-1&&rect.x+rect.width<=surface.x+surface.width+1);
   check(`${theme} pane ${width}: toolbar controls have visible boxes`,await node('index').locator('.ts-card-actions button').evaluateAll(buttons=>buttons.every(b=>{const r=b.getBoundingClientRect();return r.width>=22&&r.height>=22;})));
   await screenshot(`native-${theme}-pane-${width}.png`);
  }
  await page.evaluate(()=>{qaView.containerEl.style.removeProperty('width');qaView.containerEl.style.removeProperty('flex');qaView.onResize?.();});
 }
 await reset();
 await page.evaluate(()=>{
  qaView.session.change(b=>{for(let i=0;i<1196;i++)b.nodes.push({id:`extra-${i}`,kind:'text',text:`Evidence ${i}`,x:3000+(i%40)*300,y:3000+Math.floor(i/40)*220,width:220,height:160,color:'blue'});});
 });await page.waitForTimeout(200);
 const metrics=await page.evaluate(()=>{
  const samples=[];for(let i=0;i<120;i++){qaView.session.board.viewport.x=40+(i%2);const start=performance.now();qaView.renderBoard(true);samples.push(performance.now()-start);}
  samples.sort((a,b)=>a-b);return{cards:qaView.session.board.nodes.length,edges:qaView.session.board.edges.length,frames:samples.length,medianMs:samples[60],p95Ms:samples[114],mountedNodes:qaView.positions.size};
 });report.metrics.push(metrics);
 check('large board fixture has 1200 cards',metrics.cards,1200);
 check('large board culls offscreen card DOM',metrics.mountedNodes<50);
 check('no native page errors',report.errors,[]);
}catch(error){report.failure={message:error.message,stack:error.stack};if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 if(application&&application.exitCode===null){const closed=new Promise(resolve=>application.once('exit',resolve));application.kill('SIGTERM');await Promise.race([closed,sleep(2000)]);if(application.exitCode===null)application.kill('SIGKILL');await Promise.race([closed,sleep(1000)]);}
 if(browser)await Promise.race([browser.close(),sleep(1000)]);
 console.log(JSON.stringify(report,null,2));
}
