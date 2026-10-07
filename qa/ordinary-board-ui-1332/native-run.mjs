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
const builtRoot=path.resolve(process.env.QA_PLUGIN_ROOT||root);
const out=path.resolve(process.env.QA_OUTPUT||path.join(root,'dist/ordinary-ui-native'));
const label=process.env.QA_LABEL||'candidate';
const temporary=await mkdtemp(path.join(tmpdir(),'thoughtspace-ordinary-ui-1332-'));
const profile=path.join(temporary,'profile'),vault=path.join(temporary,'vault'),plugin=path.join(vault,'.obsidian/plugins/thoughtspace');
await mkdir(out,{recursive:true});assert.equal((await readdir(out)).length,0,'QA_OUTPUT must be empty: preserve earlier evidence and choose a new output directory');
await mkdir(plugin,{recursive:true});await mkdir(profile);
const profileSource=process.env.OBSIDIAN_PROFILE||path.join(process.env.HOME,'Library/Application Support/obsidian');
const packages=(await readdir(profileSource)).filter(file=>/^obsidian-\d+\.\d+\.\d+\.asar$/.test(file)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
assert.ok(packages.length,'An installed Obsidian runtime is required');
await copyFile(path.join(profileSource,packages.at(-1)),path.join(profile,packages.at(-1)));
await writeFile(path.join(profile,'obsidian.json'),JSON.stringify({vaults:{baad0000ca4d0001:{path:vault,ts:Date.now(),open:true}}}));
await writeFile(path.join(vault,'.obsidian/community-plugins.json'),'["thoughtspace"]');
await writeFile(path.join(vault,'.obsidian/app.json'),JSON.stringify({alwaysUpdateLinks:true,showUnsupportedFiles:true}));
for(const file of ['main.js','styles.css','manifest.json'])await copyFile(path.join(builtRoot,file),path.join(plugin,file));
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
const report={label,builtRoot,scope:'Isolated native Obsidian. Actual Playwright pointer/wheel/keyboard input for gestures; fixture model setup for scale/theme/large board. Timings are local synchronous renderer samples, not FPS or hardware input latency.',temporary,profile,vault,runtime:packages.at(-1),checks:[],screenshots:[],errors:[],handledPluginErrors:[],metrics:[]};
report.build=Object.fromEntries(await Promise.all(['main.js','styles.css','manifest.json'].map(async file=>[file,createHash('sha256').update(await readFile(path.join(plugin,file))).digest('hex')])));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(name,actual,expected=true)=>{report.checks.push({name,passed:JSON.stringify(actual)===JSON.stringify(expected),actual,expected});console.log(`${JSON.stringify(actual)===JSON.stringify(expected)?'PASS':'FAIL'} ${name}`);};
let application,browser,page;
try{
 application=spawn(process.env.OBSIDIAN_PATH||'/Applications/Obsidian.app/Contents/MacOS/Obsidian',[`--user-data-dir=${profile}`,'--remote-debugging-port=0'],{stdio:'ignore'});
 let port;for(let i=0;i<100&&!port;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await sleep(200);}}
 assert.ok(port,'Isolated CDP endpoint failed to start');
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);page=browser.contexts()[0].pages()[0];
 check('isolated profile',await realpath(await page.evaluate(()=>require('@electron/remote').app.getPath('userData'))),await realpath(profile));
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&(/thoughtspace|main\.js/i.test(message.text())||/thoughtspace/i.test(message.location().url||'')))report.handledPluginErrors.push({text:message.text(),location:message.location()});});
 await page.waitForFunction(()=>window.app?.workspace?.layoutReady,{},{timeout:40000});
 check('isolated vault',await realpath(await page.evaluate(()=>app.vault.adapter.basePath)),await realpath(vault));
 const trust=page.getByRole('button',{name:/信任仓库作者并启用插件|Trust author and enable plugins/});if(await trust.count())await trust.click();
 await page.waitForFunction(()=>!!app.plugins.plugins.thoughtspace,{},{timeout:20000});
 await page.evaluate(()=>{app.setting.close();require('@electron/remote').getCurrentWindow().focus();});await page.bringToFront();
 await page.evaluate(async()=>{const leaf=app.workspace.getLeaf(false);await leaf.setViewState({type:'thoughtspace-board',state:{file:'Polish.thoughtspace'},active:true});await leaf.loadIfDeferred();window.qaView=leaf.view;app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();require('@electron/remote').getCurrentWindow().setBounds({x:40,y:40,width:1440,height:1040});});
 await page.waitForFunction(()=>app.workspace.getLeavesOfType('thoughtspace-board').some(l=>l.view.session?.board.nodes.length===4));
 await page.evaluate(()=>{window.qaView=app.workspace.getLeavesOfType('thoughtspace-board').find(l=>l.view.session?.board.nodes.length===4).view;});
 // Trusting a test vault can open Settings in a separate window after startup.
 // Verify the host keyboard window, not just the DOM's active element.
 await page.waitForTimeout(500);
 for(const other of browser.contexts()[0].pages())if(other!==page)await other.close();
 await page.bringToFront();await page.evaluate(()=>require('@electron/remote').getCurrentWindow().focus());
 await page.waitForFunction(()=>activeWindow===window,{},{timeout:5000});
 report.nativeWindow=await page.evaluate(()=>({bounds:require('@electron/remote').getCurrentWindow().getBounds(),innerWidth,innerHeight,devicePixelRatio}));
 report.connection={pid:application.pid,cdp:`http://127.0.0.1:${port}`,profile,vault};
 await writeFile(path.join(out,'connection.json'),JSON.stringify(report.connection,null,2));
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
 const waitPreviews=async()=>{await page.waitForFunction(()=>{const stage=qaView.containerEl?.getBoundingClientRect();if(!stage)return true;return [...qaView.containerEl.querySelectorAll('.ts-card-preview,.ts-brain-preview')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return s.visibility!=='hidden'&&r.width>0&&r.height>0&&r.right>stage.left&&r.left<stage.right&&r.bottom>stage.top&&r.top<stage.bottom;}).every(e=>e.getAttribute('aria-busy')!=='true'&&e.textContent.trim().length>0);},{},{timeout:12000});};
 const idlePointer=async()=>{await page.mouse.move(10,20);await page.waitForTimeout(350);};
 const screenshot=async(name,full=false)=>{if(process.env.QA_SKIP_SHOTS==='1')return;await page.bringToFront();if(!name.includes('multiple-hover'))await idlePointer();await waitPreviews();const clip=await page.evaluate(()=>{const r=qaView.containerEl.getBoundingClientRect();return {x:Math.max(0,r.x),y:Math.max(0,r.y),width:Math.min(r.width,innerWidth-r.x),height:Math.min(r.height,innerHeight-r.y)};});try{await page.screenshot({path:path.join(out,name),clip:full?undefined:clip,timeout:15000});}catch(error){await page.bringToFront();await page.evaluate(()=>require('@electron/remote').getCurrentWindow().focus());await page.screenshot({path:path.join(out,name),clip:full?undefined:clip,timeout:15000});}report.screenshots.push(name);await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('SCREENSHOT '+path.join(out,name));};

 // Fixed synthetic scenes. They are reused without changes for baseline/candidate.
 const styles=['transparent','solid','band','paper','index','sticky'];
 const styleTitles=['无底色的记录','一张普通卡片','证据与重点','阅读中的批注','研究索引卡','下一步的想法'];
 for(let i=0;i<styles.length;i++)await page.evaluate(async({file,raw})=>{await app.vault.create(file,raw);},{file:`style-${styles[i]}.md`,raw:`# ${styleTitles[i]}\n\n用不同的卡片样式整理问题、证据和下一步。\n\n> 回到原始来源，核对关键细节。\n\n- [x] 记录观察\n- [ ] 验证假设\n\n正文保持原始笔记内容。`});
 const scene={
 ordinary:structuredClone(original),
 group:{...structuredClone(original),nodes:[{id:'group',kind:'section',title:'研究项目 · 证据整理',x:50,y:90,width:770,height:630,color:'blue',fillColor:'blue'},...structuredClone(original.nodes).map(n=>n.id==='paper'?{...n,x:920,y:160}:n)],viewport:{x:30,y:40,zoom:.85}},
 styles:{version:3,nodes:styles.map((style,i)=>({id:`style-${style}`,kind:'card',file:`style-${style}.md`,title:styleTitles[i],x:100+(i%3)*360,y:120+Math.floor(i/3)*310,width:320,height:250,color:['slate','blue','teal','rose','blue','sand'][i],autoFit:false,...(['transparent','solid'].includes(style)?{transparent:style==='transparent'}:{cardStyle:style}),fillColor:['none','none','blue','rose','cyan','lime'][i]})),edges:[],viewport:{x:25,y:20,zoom:.85}},
 empty:{version:3,nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}},
 };
 await writeFile(path.join(out,'fixture.json'),JSON.stringify({original,scene,notes},null,2));
 report.fixtureSha256=createHash('sha256').update(JSON.stringify({original,scene,notes})).digest('hex');
 const setScene=async(name,ids=[])=>{
  await page.evaluate(({board,ids})=>{qaView.inline?.cancel();qaView.clearCanvasGesture();qaView.session.board.nodes.forEach(n=>delete n.locked);qaView.session.change(b=>Object.assign(b,board));qaView.appearanceExpanded=false;qaView.appearanceTab='card';qaView.selected=new Set(ids);qaView.selectedEdge=undefined;qaView.updateSelection();qaView.renderBoard();qaView.renderSelectionTools();qaView.stage.focus();},{board:scene[name],ids});
  await page.waitForTimeout(250);await idlePointer();await waitPreviews();
 };
 const measure=async name=>{
  report.layout??=[];report.layout.push({name,...await page.evaluate(()=>{const rect=e=>{if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,fontSize:s.fontSize};};return {root:rect(qaView.contentEl),stage:rect(qaView.stage),rail:rect(qaView.contentEl.querySelector('.ts-board-rail')),format:rect(qaView.contentEl.querySelector('.ts-floating-formatbar')),footer:rect(qaView.contentEl.querySelector('.ts-footer')),insert:rect(qaView.contentEl.querySelector('.ts-insert-palette:not([hidden])')),nodes:[...qaView.contentEl.querySelectorAll('.ts-node[data-id]')].map(e=>({id:e.dataset.id,...rect(e)})),controls:[...qaView.contentEl.querySelectorAll('button')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>({label:e.getAttribute('aria-label')||e.textContent?.trim(),...rect(e)}))};})});
 };

 const candidateChecks=async(theme,width)=>{
  const probe={theme,width};report.candidateProbes??=[];
  await setScene('ordinary',['index']);await page.locator('.ts-format-mode-button[data-mode="card"]').click();await page.waitForTimeout(150);
  probe.styles=await page.locator('.ts-card-style-option').evaluateAll(options=>options.map(e=>{const name=e.querySelector('.ts-card-style-name');return{style:e.dataset.style,height:e.getBoundingClientRect().height,label:name.textContent,labelWidth:name.clientWidth,labelScroll:name.scrollWidth};}));
  check(`${theme} ${width}: card choices 44px`,probe.styles.every(e=>Math.abs(e.height-44)<.5));
  check(`${theme} ${width}: card choice labels fit`,probe.styles.every(e=>e.labelScroll<=e.labelWidth+1));
  probe.noteDock=await node('index').locator('.ts-card-actions').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
  check(`${theme} ${width}: note dock 168px`,Math.abs(probe.noteDock.width-168)<.5);
  probe.pickerDock=await node('index').evaluate(e=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return{body:rect(e),dock:rect(e.querySelector('.ts-card-actions'))};});
  if(width===1440){const {body,dock}=probe.pickerDock;check(`${theme} desktop: picker dock remains near its own card`,dock.left<body.right&&dock.right>body.left&&dock.top>=body.bottom-1&&dock.top-body.bottom<dock.height);}
  probe.heading=await page.locator('.ts-floating-formatbar').evaluate(e=>{const heading=e.querySelector('.ts-format-heading'),picker=e.querySelector('.ts-card-style-picker'),transfer=e.querySelector('.ts-style-transfer');return{headingHeight:heading.getBoundingClientRect().height,barHeight:e.getBoundingClientRect().height,pickerHeight:picker.getBoundingClientRect().height,transferParent:transfer.parentElement.className,transferVisible:getComputedStyle(transfer).display!=='none',pickerRowTops:[...new Set([...picker.querySelectorAll('.ts-card-style-option')].map(e=>Math.round(e.getBoundingClientRect().top)))]};});
  check(`${theme} ${width}: copy and paste live in heading`,probe.heading.transferParent==='ts-format-heading'&&probe.heading.transferVisible);
  if(width===420)check(`${theme} 420: card picker has two rows without orphan action row`,probe.heading.pickerRowTops.length===2&&probe.heading.headingHeight<=45&&probe.heading.barHeight<=probe.heading.headingHeight+probe.heading.pickerHeight+16);
  if(width===1440){await node('index').hover({position:{x:150,y:160}});const read=await node('index').locator('.ts-card-quick-read').boundingBox();await page.mouse.move(read.x+read.width/2,read.y+read.height/2,{steps:14});await page.waitForTimeout(250);check(`${theme} desktop: reading hover corridor keeps control hittable`,await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.ts-card-quick-read'),{x:read.x+read.width/2,y:read.y+read.height/2}));await node('index').locator('.ts-card-quick-fold').click();check(`${theme} desktop: relocated dock fold is clickable`,await node('index').evaluate(e=>e.classList.contains('is-compact-fold')));await node('index').locator('.ts-compact-inline-unfold').click();await idlePointer();}

  await setScene('ordinary',['table']);probe.textDock=await node('table').locator('.ts-card-actions').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
  check(`${theme} ${width}: text dock 68px`,Math.abs(probe.textDock.width-68)<.5);
  const docks=()=>page.evaluate(()=>['index','sticky'].map(id=>{const e=document.querySelector(`.ts-node[data-id="${id}"] .ts-card-actions`),s=getComputedStyle(e);return{id,visibility:s.visibility,pointerEvents:s.pointerEvents,opacity:s.opacity,focus:e.contains(document.activeElement)};}));
  await setScene('ordinary',['index','sticky']);await page.waitForTimeout(200);probe.multiIdle=await docks();
  check(`${theme} ${width}: idle multi docks hidden`,probe.multiIdle.every(e=>e.visibility==='hidden'&&e.pointerEvents==='none'));
  check(`${theme} ${width}: multi no duplicate count`,await page.locator('.ts-format-context-count').count(),0);
  await node('index').hover({position:{x:130,y:100}});await page.waitForTimeout(150);probe.multiHover=await docks();
  check(`${theme} ${width}: hover reveals only that dock`,probe.multiHover[0].visibility==='visible'&&probe.multiHover[1].visibility==='hidden');
  await screenshot(`${theme}-${width}-multiple-hover.png`);
  await node('index').locator('.ts-card-quick-read').focus();await idlePointer();probe.multiFocused=await docks();
  check(`${theme} ${width}: focused multi dock stays reachable`,probe.multiFocused[0].visibility==='visible'&&probe.multiFocused[0].focus&&probe.multiFocused[1].visibility==='hidden');
  await setScene('ordinary');await page.locator('.ts-insert-content-entry').click();await page.waitForTimeout(150);
  probe.insert={width:(await page.locator('.ts-insert-palette').boundingBox()).width,tiles:await page.locator('.ts-insert-palette .ts-insert-tile').count(),reachable:[]};
  check(`${theme} ${width}: insert width 332px`,Math.abs(probe.insert.width-332)<.5);
  probe.insert.defaultGeometry=await page.locator('.ts-insert-palette').evaluate(p=>{const bounds=p.getBoundingClientRect(),actions=p.querySelector('.ts-rail-actions');return{height:bounds.height,clientHeight:p.clientHeight,scrollHeight:p.scrollHeight,scrollTop:p.scrollTop,actionsScrollTop:actions.scrollTop,tiles:[...p.querySelectorAll('.ts-insert-tile')].map(e=>{const r=e.getBoundingClientRect(),description=e.querySelector('.ts-tool-description'),title=e.querySelector('span:nth-child(2)'),style=getComputedStyle(title);return{featured:e.classList.contains('ts-insert-note-entry'),height:r.height,captionDisplay:getComputedStyle(description).display,title:title.textContent,titleHeight:title.getBoundingClientRect().height,titleLineHeight:parseFloat(style.lineHeight),titleWhiteSpace:style.whiteSpace,titleWidth:title.clientWidth,titleScroll:title.scrollWidth,inside:r.left>=bounds.left-1&&r.right<=bounds.right+1&&r.top>=bounds.top-1&&r.bottom<=bounds.bottom+1};})};});
  check(`${theme} ${width}: only featured insert caption is visible`,probe.insert.defaultGeometry.tiles.every(e=>e.featured?e.captionDisplay!=='none':e.captionDisplay==='none'));
  check(`${theme} ${width}: insert tiles are compact 40px and featured 56px`,probe.insert.defaultGeometry.tiles.every(e=>Math.abs(e.height-(e.featured?56:40))<=1));
  check(`${theme} ${width}: insert titles stay one line and fit`,probe.insert.defaultGeometry.tiles.every(e=>e.titleWhiteSpace==='nowrap'&&e.titleScroll<=e.titleWidth+1&&e.titleHeight<=e.titleLineHeight+1));
  if(width===1440)check(`${theme} desktop: all 12 insert choices visible before any scroll`,probe.insert.defaultGeometry.scrollTop===0&&probe.insert.defaultGeometry.actionsScrollTop===0&&probe.insert.defaultGeometry.tiles.every(e=>e.inside));

  check(`${theme} ${width}: insert has all 12 choices`,probe.insert.tiles,12);
  for(const tile of await page.locator('.ts-insert-palette .ts-insert-tile').all()){
   await tile.focus();await page.waitForTimeout(30);probe.insert.reachable.push(await tile.evaluate(e=>{const p=e.closest('.ts-rail-popover'),r=e.getBoundingClientRect(),b=p.getBoundingClientRect();return{label:e.getAttribute('aria-label')||e.textContent,focused:document.activeElement===e,inside:r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1};}));
  }
  check(`${theme} ${width}: insert choices focus into visible panel`,probe.insert.reachable.every(e=>e.focused&&e.inside));
  await page.getByRole('button',{name:'关闭插入面板',exact:true}).click();
  if(width===420){
   await setScene('ordinary',['index']);probe.parameterRows=[];
   for(const mode of ['text','fill','border']){
    await page.locator(`.ts-format-mode-button[data-mode="${mode}"]`).click();await page.waitForTimeout(100);
    const group=page.locator(`.ts-appearance-group[data-appearance-panel="${mode}"]`);
    const row=await group.evaluate(e=>{const controls=[...e.querySelectorAll('input,select')].filter(e=>!e.disabled&&e.getClientRects().length);return{mode:e.dataset.appearancePanel,height:e.getBoundingClientRect().height,tops:controls.map(e=>e.getBoundingClientRect().top),reachable:[]};});
    check(`${theme} 420 ${mode}: parameters stay one row`,row.tops.length>0&&Math.max(...row.tops)-Math.min(...row.tops)<3);
    for(const field of await group.locator('input:enabled,select:enabled').all()){
     await field.focus();await page.waitForTimeout(30);row.reachable.push(await field.evaluate(e=>{const b=e.closest('.ts-floating-formatbar').getBoundingClientRect(),r=e.getBoundingClientRect();return{label:e.getAttribute('aria-label'),focused:e===document.activeElement,inside:r.left>=b.left-1&&r.right<=b.right+1};}));
    }
    check(`${theme} 420 ${mode}: every parameter focus reveals`,row.reachable.every(e=>e.focused&&e.inside));probe.parameterRows.push(row);await screenshot(`${theme}-420-${mode}-parameters.png`);
   }
  }
  report.candidateProbes.push(probe);await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 };
 const inlineDraftChecks=async()=>{
  await page.evaluate(()=>{qaView.containerEl.style.removeProperty('width');qaView.containerEl.style.removeProperty('flex');qaView.onResize?.();});
  await setScene('ordinary',['table']);
  const inlineSeed={version:3,nodes:[{id:'table',kind:'text',text:'Original short text.',x:120,y:200,width:300,height:140,color:'blue',fontSize:16,textAutoHeight:true,autoSize:true}],edges:[],viewport:{x:40,y:30,zoom:1}};
  await page.evaluate(board=>{qaView.session.board.nodes.forEach(n=>delete n.locked);qaView.session.change(b=>Object.assign(b,board));qaView.selected=new Set(['table']);qaView.updateSelection();qaView.renderBoard();qaView.renderSelectionTools();},inlineSeed);await page.waitForTimeout(500);
  report.inlineFixtureSha256=createHash('sha256').update(JSON.stringify(inlineSeed)).digest('hex');
  const source=await page.evaluate(()=>structuredClone(qaView.session.board.nodes[0]));
  await page.locator('.ts-format-mode-button[data-mode="markdown"]').click();
  await page.waitForFunction(()=>!!qaView.inline?.input);
  await page.evaluate(()=>qaView.inline.input.focus({preventScroll:true}));await page.keyboard.press('Meta+a');
  const draft=Array.from({length:16},(_,i)=>`Draft paragraph ${i+1}: a native typed sentence for automatic text sizing.`).join('\n\n');
  await page.keyboard.insertText(draft);
  await page.waitForFunction(height=>parseFloat(document.querySelector('.ts-node[data-id="table"]').style.height)>height+100,source.height,{timeout:10000});await page.waitForTimeout(250);
  const state=()=>page.evaluate(()=>{const e=document.querySelector('.ts-node[data-id="table"]'),n=qaView.session.board.nodes.find(n=>n.id==='table');return {width:parseFloat(e.style.width),height:parseFloat(e.style.height),sourceWidth:n.width,sourceHeight:n.height,sourceText:n.text,draft:qaView.inline?.input.value,editing:!!qaView.inline,focusClass:document.activeElement?.className};});
  const grown=await state();report.inlineDraft={source,grown,stages:[]};
  check('inline native keyboard inserts the complete long draft',grown.draft,draft);
  check('inline auto-height expands unsaved DOM',grown.height>source.height+100);
  check('inline unsaved draft keeps source geometry and content',grown.sourceWidth===source.width&&grown.sourceHeight===source.height&&grown.sourceText===source.text);
  await screenshot('inline-draft-grown.png');
  for(const mode of ['markdown','fill','text']){
   const button=page.locator(`.ts-format-mode-button[data-mode="${mode}"]`);await button.focus();await page.waitForTimeout(100);const focused=await state();
   check(`inline ${mode}: actual toolbar focus preserves draft dimensions`,Math.abs(focused.width-grown.width)<1&&Math.abs(focused.height-grown.height)<1);
   check(`inline ${mode}: focus keeps unsaved draft and original source`,focused.editing&&focused.draft===draft&&focused.sourceText===source.text&&focused.sourceHeight===source.height);
   await button.click();await page.waitForTimeout(180);const after=await state();report.inlineDraft.stages.push({mode,focused,after});
   check(`inline ${mode}: mode switch preserves expanded draft`,after.editing&&after.draft===draft&&Math.abs(after.width-grown.width)<1&&Math.abs(after.height-grown.height)<1);
   await screenshot(`inline-draft-${mode}-toolbar.png`);
  }
  await page.locator('.ts-format-mode-button[data-mode="markdown"]').click();await page.evaluate(()=>qaView.inline.input.focus({preventScroll:true}));
  await page.keyboard.press('Meta+Enter');await page.waitForFunction(()=>!qaView.inline,{},{timeout:10000});await page.waitForTimeout(200);
  const saved=await state();report.inlineDraft.saved=saved;
  check('inline keyboard save exits editing and retains exact text',!saved.editing&&saved.sourceText===draft);
  check('inline save commits automatic expanded geometry',saved.sourceHeight>source.height+100&&Math.abs(saved.height-saved.sourceHeight)<1);
  await node('table').locator('.ts-card-quick-fold').focus();await page.keyboard.press('Enter');await page.waitForTimeout(100);
  check('inline saved text can fold through native keyboard',await node('table').evaluate(e=>e.classList.contains('is-compact-fold')));
  await node('table').locator('.ts-compact-inline-unfold').click();await page.waitForTimeout(150);const unfolded=await state();report.inlineDraft.unfolded=unfolded;
  check('inline fold and unfold preserve saved expanded size and text',unfolded.sourceText===draft&&Math.abs(unfolded.sourceHeight-saved.sourceHeight)<1&&Math.abs(unfolded.height-saved.sourceHeight)<1);
  await page.evaluate(()=>qaView.session.flush());
  check('inline saved draft is persisted exactly',JSON.parse(await readFile(path.join(vault,'Polish.thoughtspace'),'utf8')).nodes.find(n=>n.id==='table').text,draft);
  await screenshot('inline-draft-saved-unfolded.png');
 };
 const rootUI=page.locator('.workspace-leaf.mod-active .ts-root');
 if(process.env.QA_INLINE_ONLY==='1')await inlineDraftChecks();
 if(process.env.QA_ONLY_BRAIN!=='1'&&process.env.QA_INLINE_ONLY!=='1'){
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');},theme);
  for(const width of [1440,640,420]){
   await page.evaluate(width=>{if(width===1440){qaView.containerEl.style.removeProperty('width');qaView.containerEl.style.removeProperty('flex');}else{qaView.containerEl.style.width=`${width}px`;qaView.containerEl.style.flex='none';}qaView.onResize?.();},width);
   const prefix=`${theme}-${width}`;
   await setScene('ordinary');await measure(`${prefix}-board`);await screenshot(`${prefix}-board.png`);
   await page.locator('.ts-insert-content-entry').click();await page.waitForTimeout(180);await measure(`${prefix}-insert`);await screenshot(`${prefix}-insert.png`);
   check(`${prefix}: insert opens`,await page.locator('.ts-insert-palette').isVisible());
   await page.getByRole('button',{name:'关闭插入面板',exact:true}).click();
   check(`${prefix}: insert close restores disclosure`,await page.locator('.ts-insert-content-entry').getAttribute('aria-expanded'),'false');
   await setScene('ordinary',['index']);await measure(`${prefix}-selected`);await screenshot(`${prefix}-selected.png`);
   await page.locator('.ts-format-mode-button[data-mode="card"]').click();await page.waitForTimeout(150);await measure(`${prefix}-card-picker`);await screenshot(`${prefix}-card-picker.png`);
   check(`${prefix}: six style choices visible`,await page.locator('.ts-card-style-option:visible').count(),6);
   await setScene('ordinary',['index','sticky']);await measure(`${prefix}-multiple`);await screenshot(`${prefix}-multiple.png`);
   await setScene('group',['group']);await measure(`${prefix}-group`);await screenshot(`${prefix}-group.png`);
   await setScene('styles');await measure(`${prefix}-styles`);await screenshot(`${prefix}-styles.png`);
   await setScene('empty');await measure(`${prefix}-empty`);await screenshot(`${prefix}-empty.png`);
   if(process.env.QA_CANDIDATE==='1')await candidateChecks(theme,width);
  }
 }
 await page.evaluate(()=>{qaView.containerEl.style.removeProperty('width');qaView.containerEl.style.removeProperty('flex');document.body.classList.remove('theme-dark');document.body.classList.add('theme-light');qaView.onResize?.();});
 await reset();
 console.log('SNAPSHOTS_COMPLETE '+out);
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
 if(process.env.QA_CANDIDATE==='1'){
  const probeDock=async phase=>{const body=await node('index').boundingBox(),dock=await node('index').locator('.ts-card-actions').boundingBox(),read=await node('index').locator('.ts-card-quick-read').boundingBox(),format=await page.locator('.ts-floating-formatbar').boundingBox();await page.mouse.move(read.x+read.width/2,read.y+read.height/2,{steps:10});await page.waitForTimeout(80);const hittable=await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.ts-node[data-id="index"] .ts-card-quick-read'),{x:read.x+read.width/2,y:read.y+read.height/2}),overlapsFormat=dock.x<format.x+format.width&&dock.x+dock.width>format.x&&dock.y<format.y+format.height&&dock.y+dock.height>format.y;report.multiResume??=[];report.multiResume.push({phase,body,dock,read,format,hittable,overlapsFormat});check(`multi ${phase}: reading dock does not cover format bar`,!overlapsFormat);check(`multi ${phase}: first reading hover remains hittable`,hittable);};
  await probeDock('drag-release');
  const body=await node('index').boundingBox();await page.mouse.move(body.x+130,body.y+100);await page.waitForTimeout(80);
  await page.evaluate(()=>{window.qaResumeEnterCount=0;document.querySelector('.ts-node[data-id="index"]').addEventListener('pointerenter',()=>qaResumeEnterCount++);qaView.stage.focus();require('@electron/remote').getCurrentWindow().blur();});await page.waitForTimeout(150);
  await page.evaluate(()=>require('@electron/remote').getCurrentWindow().focus());await page.bringToFront();await page.waitForFunction(()=>activeWindow===window);await page.mouse.move(body.x+131,body.y+100);await page.waitForTimeout(80);
  report.multiResumeBoundary={nativeBlurAndFocus:true,pointerenterAfterReturn:await page.evaluate(()=>qaResumeEnterCount),scope:'One light desktop multi-selection after drag. Return may emit pointerenter depending on host; no broad claim for every resume edge.'};
  await probeDock('window-return');
  await page.evaluate(()=>qaView.stage.focus());
 }

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
   const controlGeometry=await node('index').locator('.ts-card-actions button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect(),hiddenAncestors=[];for(let e=b;e;e=e.parentElement){const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')hiddenAncestors.push({tag:e.tagName,class:e.className,display:s.display,visibility:s.visibility});}return{label:b.getAttribute('aria-label'),class:b.className,width:r.width,height:r.height,hiddenAncestors};}));
   report.controlGeometry??=[];report.controlGeometry.push({theme,width,controls:controlGeometry});
   check(`${theme} pane ${width}: rendered toolbar controls have visible boxes`,controlGeometry.filter(b=>!b.hiddenAncestors.length).every(b=>b.width>=22&&b.height>=22));
   await screenshot(`native-${theme}-pane-${width}.png`);
  }
  await page.evaluate(()=>{qaView.containerEl.style.removeProperty('width');qaView.containerEl.style.removeProperty('flex');qaView.onResize?.();});
 }
 if(process.env.QA_CANDIDATE==='1'){
  await setScene('ordinary',['index']);await page.evaluate(()=>{qaView.plugin.copiedNodeStyle=undefined;qaView.renderSelectionTools();});
  check('collapsed appearance hides style transfer',await page.locator('.ts-style-transfer').evaluate(e=>getComputedStyle(e).display==='none'));
  await page.locator('.ts-format-mode-button[data-mode="card"]').click();
  check('style paste disabled before copying',await page.getByRole('button',{name:'粘贴对象样式',exact:true}).isDisabled());
  await page.getByRole('button',{name:'复制对象样式',exact:true}).click();
  await setScene('ordinary',['sticky']);await page.locator('.ts-format-mode-button[data-mode="card"]').click();
  const stickyBefore=await page.evaluate(()=>JSON.stringify(qaView.session.board.nodes.find(n=>n.id==='sticky')));
  await page.getByRole('button',{name:'粘贴对象样式',exact:true}).click();await page.waitForTimeout(100);
  check('actual style paste applies copied card style',await page.evaluate(()=>{const n=qaView.session.board.nodes.find(n=>n.id==='sticky');return n.cardStyle==='index'&&n.color==='blue'&&n.fillColor===undefined;}));
  await page.locator('.ts-stage').focus();await page.keyboard.press('Meta+z');await page.waitForTimeout(100);
  check('keyboard undo restores pasted target',await page.evaluate(()=>JSON.stringify(qaView.session.board.nodes.find(n=>n.id==='sticky'))),stickyBefore);
  await setScene('ordinary',['index','sticky']);await page.locator('.ts-format-mode-button[data-mode="card"]').click();
  check('copy disabled for multiple selected objects',await page.getByRole('button',{name:'复制对象样式',exact:true}).isDisabled());
  await setScene('ordinary',['paper']);await page.locator('.ts-format-mode-button[data-mode="card"]').click();
  check('paste disabled for locked target',await page.getByRole('button',{name:'粘贴对象样式',exact:true}).isDisabled());
 }
 if(process.env.QA_CANDIDATE==='1')await inlineDraftChecks();
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
 }

 if(process.env.QA_BRAIN==='1'||process.env.QA_ONLY_BRAIN==='1'){
  const titles={center:'研究问题',parent:'研究项目',child:'关键证据',association:'相关文献',sibling:'下一步验证'};
  for(const [id,title]of Object.entries(titles))await page.evaluate(async({file,raw})=>{await app.vault.create(file,raw);},{file:`brain-${id}.md`,raw:`# ${title}\n\n这是用于界面验收的合成笔记。\n\n- 记录观察与证据\n- 核对原始来源\n- 保留待验证的问题\n\n正文展开后，主题的字号和颜色继续生效。`});
  const brainNoteFiles=Object.keys(titles).map(id=>`brain-${id}.md`);const brainNoteHashes=Object.fromEntries(await Promise.all(brainNoteFiles.map(async file=>[file,createHash('sha256').update(await readFile(path.join(vault,file))).digest('hex')])));
  const brainSeed={version:3,presentation:'brain',nodes:Object.entries(titles).map(([id,title],i)=>({id,kind:'card',file:`brain-${id}.md`,title,x:i*350,y:0,width:300,height:200,color:'sand',autoFit:false})),edges:[{id:'pc',from:'parent',to:'center',kind:'branch',label:''},{id:'ps',from:'parent',to:'sibling',kind:'branch',label:''},{id:'cc',from:'center',to:'child',kind:'branch',label:''},{id:'ca',from:'center',to:'association',direction:'both',label:''}],viewport:{x:0,y:0,zoom:1},brain:{version:1,centerId:'center',expandedIds:['center','child'],pins:[],history:{entries:['center'],index:0}}};
  await page.evaluate(async board=>{await app.vault.create('Brain.thoughtspace',JSON.stringify(board));},brainSeed);
  report.brainFixtureSha256=createHash('sha256').update(JSON.stringify(brainSeed)).digest('hex');
  await page.evaluate(async()=>{const leaf=app.workspace.getLeaf('tab');await leaf.setViewState({type:'thoughtspace-board',state:{file:'Brain.thoughtspace'},active:true});await leaf.loadIfDeferred();window.qaOrdinaryView=qaView;window.qaView=leaf.view;});
  await page.waitForFunction(()=>app.workspace.getLeavesOfType('thoughtspace-board').some(l=>l.view.file?.path==='Brain.thoughtspace'&&!!l.view.session));
  await page.evaluate(()=>{window.qaView=app.workspace.getLeavesOfType('thoughtspace-board').find(l=>l.view.file?.path==='Brain.thoughtspace').view;});
  await page.waitForFunction(()=>document.querySelectorAll('.workspace-leaf.mod-active .ts-brain-preview').length===2);
  check('brain two expanded note previews',await page.locator('.workspace-leaf.mod-active .ts-brain-preview').count(),2);
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>{document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');},theme);
   for(const width of [1440,640,420]){
    await page.evaluate(width=>{require('@electron/remote').getCurrentWindow().setBounds({x:40,y:40,width:1440,height:1040});if(width===1440){qaView.containerEl.style.removeProperty('width');qaView.containerEl.style.removeProperty('flex');}else{qaView.containerEl.style.width=`${width}px`;qaView.containerEl.style.flex='none';}qaView.onResize?.();},width);await page.waitForTimeout(350);
    await screenshot(`brain-${theme}-${width}-expanded.png`);
   }
   await page.evaluate(()=>{qaView.containerEl.style.removeProperty('width');qaView.containerEl.style.removeProperty('flex');qaView.onResize?.();});await page.waitForTimeout(250);await waitPreviews();
   if(process.env.QA_CANDIDATE==='1'){
    const centerBody=page.locator('.workspace-leaf.mod-active .ts-brain-node.is-center .ts-brain-preview');
    const readingBefore=await centerBody.evaluate(e=>{window.qaBrainReadingElement=e;e.scrollTop=0;return{scrollable:e.scrollHeight>e.clientHeight,camera:JSON.stringify(qaView.brainBoardView.camera),transform:document.querySelector('.workspace-leaf.mod-active .ts-brain-scene').style.transform};});
    check(`${theme}: brain center body is internally scrollable`,readingBefore.scrollable);
    const bodyBox=await centerBody.boundingBox();await page.mouse.move(bodyBox.x+bodyBox.width/2,bodyBox.y+bodyBox.height/2);await page.mouse.wheel(0,2000);await page.waitForTimeout(220);
    const readingAfter=await centerBody.evaluate(e=>{const last=e.querySelector('.ts-card-preview-content')?.lastElementChild,r=e.getBoundingClientRect(),lastRect=last?.getBoundingClientRect();return{scrollTop:e.scrollTop,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,lastText:last?.textContent,lastVisible:!!lastRect&&lastRect.top>=r.top-1&&lastRect.bottom<=r.bottom+1,sameDOM:e===qaBrainReadingElement,camera:JSON.stringify(qaView.brainBoardView.camera),transform:document.querySelector('.workspace-leaf.mod-active .ts-brain-scene').style.transform};});
    report.brainReading??=[];report.brainReading.push({theme,before:readingBefore,after:readingAfter});
    check(`${theme}: brain body wheel reaches visible final paragraph`,readingAfter.scrollTop>0&&readingAfter.scrollTop+readingAfter.clientHeight>=readingAfter.scrollHeight-1&&readingAfter.lastVisible&&readingAfter.lastText.includes('正文展开后'));
    check(`${theme}: brain body scroll keeps camera still`,readingAfter.camera===readingBefore.camera&&readingAfter.transform===readingBefore.transform);
    check(`${theme}: brain body scroll preserves preview DOM`,readingAfter.sameDOM);
    await screenshot(`brain-${theme}-1440-body-bottom.png`);await centerBody.evaluate(e=>e.scrollTop=0);
   }
   if(process.env.QA_CANDIDATE==='1')await page.locator('[data-brain-action=colors]').click();else await page.evaluate(()=>qaView.openBrainColors());await page.waitForTimeout(300);
   report.brainColorInputs??=[];report.brainColorInputs.push({theme,inputs:await page.locator('.ts-brain-colors-modal input[type=text]').evaluateAll(inputs=>inputs.map(e=>({label:e.getAttribute('aria-label'),value:e.value})))});
   await screenshot(`brain-${theme}-colors-modal.png`,true);

   if(process.env.QA_CANDIDATE==='1'){
    const before=await page.evaluate(()=>{window.qaBrainPreviewElement=document.querySelector('.workspace-leaf.mod-active .ts-brain-preview');return JSON.stringify(qaView.session.board.brainColors||{});});
    const modal=page.locator('.ts-brain-colors-modal');
    check(`${theme}: five independent brain colors`,await modal.locator('input[type=text]').count(),5);
    await modal.getByRole('textbox',{name:'节点边框颜色',exact:true}).fill('#9a6753');await page.waitForTimeout(200);
    const preview=await page.evaluate(()=>({colors:JSON.stringify(qaView.session.board.brainColors||{}),same:qaBrainPreviewElement===document.querySelector('.workspace-leaf.mod-active .ts-brain-preview'),pill:getComputedStyle(document.querySelector('.workspace-leaf.mod-active .ts-brain-pill')).borderTopColor,body:getComputedStyle(qaBrainPreviewElement).borderTopColor}));
    report.brainProbes??=[];report.brainProbes.push({theme,preview});
    check(`${theme}: preview keeps board data`,preview.colors,before);
    check(`${theme}: border preview updates pill and body`,preview.pill==='rgb(154, 103, 83)'&&preview.body==='rgb(154, 103, 83)');
    check(`${theme}: color preview preserves expanded DOM`,preview.same);
    await screenshot(`brain-${theme}-border-preview.png`,true);
    await modal.getByRole('button',{name:'取消',exact:true}).click();await page.waitForTimeout(150);
    check(`${theme}: cancel keeps original colors`,await page.evaluate(()=>JSON.stringify(qaView.session.board.brainColors||{})),before);
    await page.locator('[data-brain-action=colors]').click();await modal.getByRole('textbox',{name:'节点边框颜色',exact:true}).fill('#9a6753');await modal.getByRole('button',{name:'确定',exact:true}).click();await modal.waitFor({state:'hidden'});await page.evaluate(()=>qaView.session.flush());
    check(`${theme}: saved independent border color`,await page.evaluate(()=>qaView.session.board.brainColors),{border:'#9a6753'});
    check(`${theme}: disk has confirmed border color`,JSON.parse(await readFile(path.join(vault,'Brain.thoughtspace'),'utf8')).brainColors,{border:'#9a6753'});
    await screenshot(`brain-${theme}-border-saved.png`);
    await page.locator('.workspace-leaf.mod-active .ts-brain-shell').focus();await page.keyboard.press('Meta+z');await page.waitForTimeout(160);
    check(`${theme}: keyboard undo restores colors`,await page.evaluate(()=>JSON.stringify(qaView.session.board.brainColors||{})),before);
    await page.locator('[data-brain-action=colors]').click();await modal.getByRole('textbox',{name:'节点边框颜色',exact:true}).fill('#9a6753');await modal.getByRole('button',{name:'确定',exact:true}).click();await modal.waitFor({state:'hidden'});
    await page.locator('[data-brain-action=colors]').click();await modal.getByRole('button',{name:'恢复默认',exact:true}).click();
    check(`${theme}: restore default remains a draft`,await page.evaluate(()=>qaView.session.board.brainColors),{border:'#9a6753'});
    await modal.getByRole('button',{name:'确定',exact:true}).click();await modal.waitFor({state:'hidden'});await page.evaluate(()=>qaView.session.flush());
    check(`${theme}: default confirmation removes overrides`,await page.evaluate(()=>JSON.stringify(qaView.session.board.brainColors||{})),'{}');
    await page.evaluate(()=>require('@electron/remote').getCurrentWindow().setBounds({x:40,y:40,width:360,height:900}));await page.waitForTimeout(180);await page.locator('[data-brain-action=colors]').click();await page.waitForTimeout(100);
    report.brainProbes.push({theme,narrow:await modal.evaluate(e=>({width:e.getBoundingClientRect().width,viewport:innerWidth,fields:[...e.querySelectorAll('input[type=text]')].map(f=>({label:f.getAttribute('aria-label'),width:f.getBoundingClientRect().width,left:f.getBoundingClientRect().left,right:f.getBoundingClientRect().right}))}))});
    check(`${theme}: narrow brain dialog fits actual window`,await modal.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
    await screenshot(`brain-${theme}-360-colors-modal.png`,true);await modal.getByRole('button',{name:'取消',exact:true}).click();await page.evaluate(()=>require('@electron/remote').getCurrentWindow().setBounds({x:40,y:40,width:1440,height:1040}));
   }else{
await page.locator('.ts-brain-colors-modal').getByRole('button',{name:'取消',exact:true}).click();
   }

  }
  check('brain colors preserve original note bytes',Object.fromEntries(await Promise.all(brainNoteFiles.map(async file=>[file,createHash('sha256').update(await readFile(path.join(vault,file))).digest('hex')]))),brainNoteHashes);
  check('brain no native page errors',report.errors,[]);
 if(process.env.QA_THEME_SOURCE){
  const themeName=JSON.parse(await readFile(path.join(process.env.QA_THEME_SOURCE,'manifest.json'),'utf8')).name;
  const themeDest=path.join(vault,'.obsidian/themes',themeName);await mkdir(themeDest,{recursive:true});for(const file of ['manifest.json','theme.css'])await copyFile(path.join(process.env.QA_THEME_SOURCE,file),path.join(themeDest,file));
  await page.evaluate(async name=>{if(typeof app.customCss.setTheme!=='function')throw Error('Theme activation API missing');await app.customCss.setTheme(name);window.qaView=window.qaOrdinaryView||qaView;app.workspace.setActiveLeaf(qaView.leaf,{focus:true});},themeName);await page.waitForTimeout(500);
  report.thirdPartyTheme={name:themeName,sha256:createHash('sha256').update(await readFile(path.join(themeDest,'theme.css'))).digest('hex'),source:process.env.QA_THEME_SOURCE};
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>{app.vault.setConfig('theme',theme==='dark'?'obsidian':'moonstone');app.setTheme(theme==='dark'?'obsidian':'moonstone');qaView.containerEl.style.removeProperty('width');qaView.containerEl.style.removeProperty('flex');qaView.onResize?.();},theme);await page.waitForTimeout(300);
   await setScene('ordinary',['index']);await screenshot(`folio-${theme}-selected.png`);
   report.thirdPartyTheme[theme]=await page.evaluate(()=>{const names=['--background-primary','--background-secondary','--text-normal','--text-muted','--font-text'];return names.map(name=>({name,host:getComputedStyle(document.body).getPropertyValue(name),root:getComputedStyle(qaView.contentEl).getPropertyValue(name)}));});
   check(`Folio ${theme}: board inherits theme variables`,report.thirdPartyTheme[theme].every(v=>v.host===v.root));
   await page.locator('.ts-format-mode-button[data-mode=card]').click();await page.waitForTimeout(100);await screenshot(`folio-${theme}-card-picker.png`);
   await setScene('ordinary',['index','sticky']);await screenshot(`folio-${theme}-multiple.png`);
  }
 }

 }

 check('no handled ThoughtSpace console errors',report.handledPluginErrors,[]);
}catch(error){report.failure={message:error.message,stack:error.stack};if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 if(application&&application.exitCode===null){const closed=new Promise(resolve=>application.once('exit',resolve));application.kill('SIGTERM');await Promise.race([closed,sleep(2000)]);if(application.exitCode===null)application.kill('SIGKILL');await Promise.race([closed,sleep(1000)]);}
 if(browser)await Promise.race([browser.close(),sleep(1000)]);
 if(report.checks.some(c=>!c.passed))process.exitCode=1;
 console.log(JSON.stringify({label:report.label,checks:report.checks.length,errors:report.errors,metrics:report.metrics,screenshots:report.screenshots.length,failure:report.failure}));
}
