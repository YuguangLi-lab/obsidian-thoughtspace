import {readFile,writeFile,mkdir,copyFile,mkdtemp,readdir,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.resolve(process.env.QA_OUTPUT||path.join(root,'dist/card-styles-next'));
const temporary=await mkdtemp(path.join(tmpdir(),'thoughtspace-card-styles-'));
const profile=path.join(temporary,'profile'),vault=path.join(temporary,'vault');
const plugin=path.join(vault,'.obsidian/plugins/thoughtspace');
await mkdir(plugin,{recursive:true});await mkdir(profile);await mkdir(out,{recursive:true});
const profileSource=process.env.OBSIDIAN_PROFILE||path.join(process.env.HOME,'Library/Application Support/obsidian');
const packages=(await readdir(profileSource)).filter(file=>/^obsidian-\d+\.\d+\.\d+\.asar$/.test(file)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
assert.ok(packages.length,'A current locally installed Obsidian runtime is required');
await copyFile(path.join(profileSource,packages.at(-1)),path.join(profile,packages.at(-1)));
await writeFile(path.join(profile,'obsidian.json'),JSON.stringify({vaults:{'ca4d5701e5700a01':{path:vault,ts:Date.now(),open:true}}}));
await writeFile(path.join(vault,'.obsidian/community-plugins.json'),'["thoughtspace"]');
await writeFile(path.join(vault,'.obsidian/app.json'),JSON.stringify({alwaysUpdateLinks:true,showUnsupportedFiles:true}));
await writeFile(path.join(vault,'.obsidian/appearance.json'),JSON.stringify({theme:'moonstone'}));
for(const file of ['main.js','styles.css','manifest.json'])await copyFile(path.join(root,file),path.join(plugin,file));
await writeFile(path.join(plugin,'data.json'),JSON.stringify({onboardingVersion:99}));
const styles=['transparent','solid','band','paper','index','sticky'];
const titles=['研究问题与证据','实验记录与复现','文献摘录与批注','我的双线纸笺','索引卡：临床研究中的长标题排版检验','便签：下一步要验证的想法'];
const nodes=styles.map((style,i)=>({id:style,kind:'card',file:`note-${style}.md`,title:titles[i],x:(i%3)*365,y:Math.floor(i/3)*310,width:330,height:268,color:['blue','green','rose','cyan','teal','orange'][i],autoFit:false,...(['transparent','solid'].includes(style)?{transparent:style==='transparent'}:{cardStyle:style}),fillColor:['none','none','blue','rose','cyan','lime'][i]}));
const originalBoard={version:3,nodes,edges:[],viewport:{x:42,y:58,zoom:1}};
await writeFile(path.join(vault,'Card styles.thoughtspace'),JSON.stringify(originalBoard,null,2));
for(const node of nodes){
 const markdown=`# ${node.title}\n\n这是隔离测试笔记，仅用于验收卡片的样式、阅读和编辑。\n\n> 关键证据需要回到原始来源核对。\n\n- [x] 记录研究问题\n- [ ] 整理待验证的假设\n\n| 指标 | 数值 |\n| --- | --- |\n| 样本量 | 128 |\n\n`+Array.from({length:28},(_,i)=>`段落 ${i+1}：长文阅读位置保留。StableReadingCheckpoint_${i+1}，正文不应与卡片标题或工具按钮重叠。\n\n`).join('');
 await writeFile(path.join(vault,node.file),markdown);
}
const report={scope:'Native Obsidian in an isolated temporary profile and vault. Real plugin build, DOM, renderer and production handlers. Fixture selection/model edits and synthetic UI clicks are not physical mouse or keyboard validation.',temporary,profile,vault,runtime:packages.at(-1),checks:[],screenshots:[],errors:[]};
report.build=Object.fromEntries(await Promise.all(['main.js','styles.css','manifest.json'].map(async file=>[file,createHash('sha256').update(await readFile(path.join(plugin,file))).digest('hex')])));
let application,browser,page;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(name,actual,expected=true)=>{assert.deepEqual(actual,expected,name);report.checks.push({name,passed:true});console.log(`PASS ${name}`);};
try{
 application=spawn(process.env.OBSIDIAN_PATH||'/Applications/Obsidian.app/Contents/MacOS/Obsidian',[`--user-data-dir=${profile}`,'--remote-debugging-port=0'],{stdio:'ignore'});
 let port;
 for(let i=0;i<100&&!port;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await sleep(200);}}
 assert.ok(port,'Isolated Obsidian CDP endpoint did not start');
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 const context=browser.contexts()[0];
 page=context.pages()[0]||await context.waitForEvent('page');
 const actualProfile=await page.evaluate(()=>require('@electron/remote').app.getPath('userData'));
 check('isolated user profile',await realpath(actualProfile),await realpath(profile));
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.waitForFunction(()=>window.app?.workspace?.layoutReady,{},{timeout:40000});
 const trust=page.getByRole('button',{name:/信任仓库作者并启用插件|Trust author and enable plugins/});
 if(await trust.count())await trust.click();
 await page.waitForFunction(()=>!!app.plugins.plugins.thoughtspace,{},{timeout:20000});
 if(process.argv.includes('--probe')){
  check('native vault isolated',await page.evaluate(()=>app.vault.adapter.basePath),vault);
  check('plugin loaded',await page.evaluate(()=>!!app.plugins.plugins.thoughtspace));
  await page.screenshot({path:path.join(out,'native-probe.png')});report.screenshots.push('native-probe.png');
 }else{
 await page.evaluate(async()=>{
  const plugin=app.plugins.plugins.thoughtspace;if(!plugin)await app.plugins.enablePluginAndSave('thoughtspace');
  const leaf=app.workspace.getLeaf(false);await leaf.setViewState({type:'thoughtspace-board',state:{file:'Card styles.thoughtspace'},active:true});
  window.qaView=leaf.view;
  app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();
 });
 await page.waitForFunction(()=>window.qaView?.session?.board?.nodes?.length===6&&document.querySelectorAll('.ts-node[data-id]').length>=6,{},{timeout:30000});
 await page.evaluate(()=>require('@electron/remote').getCurrentWindow().setBounds({x:40,y:40,width:1440,height:1020}));
 await page.waitForTimeout(400);
 check('native vault isolated',await page.evaluate(()=>app.vault.adapter.basePath),vault);
 check('all six cards rendered',await page.locator('.ts-node[data-id]').count(),6);
  const select=async ids=>{await page.evaluate(ids=>{qaView.selected=new Set(ids);qaView.appearanceTab='card';qaView.contextOpen=false;qaView.updateSelection();qaView.renderSelectionTools();},ids);};
  const choice=async style=>{
   await page.locator(`.ts-card-style-option[data-style="${style}"]`).click();
   await page.evaluate(()=>qaView.session.flush());await page.waitForTimeout(80);
  };
  await select(['solid']);
  check('six visible appearance choices',await page.locator('.ts-card-style-option:visible').count(),6);
  for(const style of styles){
   await choice(style);
   const state=await page.evaluate(()=>{const n=qaView.session.board.nodes.find(n=>n.id==='solid');return n.cardStyle||(n.transparent?'transparent':'solid');});
   check(`picker selects ${style}`,state,style);
   check(`picker marks ${style}`,await page.locator(`.ts-card-style-option[data-style="${style}"]`).getAttribute('aria-pressed'),'true');
  }
  await select(['index','sticky']);await choice('index');
  check('batch style applies both cards',await page.evaluate(()=>qaView.session.board.nodes.filter(n=>['index','sticky'].includes(n.id)).map(n=>n.cardStyle)),['index','index']);
  await page.evaluate(()=>qaView.session.undo());await page.waitForTimeout(100);
  check('undo restores batch appearance',await page.evaluate(()=>qaView.session.board.nodes.filter(n=>['index','sticky'].includes(n.id)).map(n=>n.cardStyle)),['index','sticky']);
  await page.evaluate(()=>qaView.session.undo(true));await page.waitForTimeout(100);
  check('redo reapplies batch appearance',await page.evaluate(()=>qaView.session.board.nodes.filter(n=>['index','sticky'].includes(n.id)).map(n=>n.cardStyle)),['index','index']);
  await page.evaluate(()=>qaView.session.change(b=>b.nodes.find(n=>n.id==='sticky').locked=true));await select(['sticky']);
  check('locked card disables all style choices',await page.locator('.ts-card-style-option:disabled').count(),6);
  await page.evaluate(()=>qaView.session.change(b=>delete b.nodes.find(n=>n.id==='sticky').locked));
  await select(['index']);await page.getByRole('button',{name:'复制对象样式',exact:true}).click();
  await select(['sticky']);await page.getByRole('button',{name:'粘贴对象样式',exact:true}).click();await page.evaluate(()=>qaView.session.flush());
  check('style clipboard transfers new appearance',await page.evaluate(()=>qaView.session.board.nodes.find(n=>n.id==='sticky').cardStyle),'index');
  await select(['solid']);
  const scrollBefore=await page.evaluate(()=>{const el=document.querySelector('.ts-node[data-id="solid"] .ts-card-preview');window.qaPreview=el;el.scrollTop=500;return el.scrollTop;});
  assert.ok(scrollBefore>0,'fixture note must be scrollable');
  for(const style of ['index','sticky','band','paper','solid']){
   await choice(style);
   check(`fixed preview preserved on ${style}`,await page.evaluate(()=>document.querySelector('.ts-node[data-id="solid"] .ts-card-preview')===window.qaPreview));
   check(`reading offset preserved on ${style}`,await page.evaluate(()=>qaPreview.scrollTop),scrollBefore);
  }
  await page.evaluate(async()=>{await qaView.startInlineEdit('solid');window.qaEditor=qaView.inline;qaView.inline.input.value+='\n\nQA_UNSAVED_DRAFT';qaView.inline.input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('.ts-format-mode-button[data-mode="card"]').click();await choice('sticky');
  check('inline editor instance preserved',await page.evaluate(()=>qaView.inline===window.qaEditor));
  check('unsaved draft preserved',await page.evaluate(()=>qaView.inline.input.value.includes('QA_UNSAVED_DRAFT')));
  await choice('index');await page.waitForTimeout(150);
  check('index heading does not overlap inline editor',await page.evaluate(()=>{const node=document.querySelector('.ts-node[data-id="solid"]');const header=node.querySelector('.ts-node-header').getBoundingClientRect(),editor=node.querySelector('.ts-inline-native,.ts-inline-input').getBoundingClientRect();return header.height>0&&editor.top>=header.bottom-1;}));
  check('draft survives index heading geometry change',await page.evaluate(()=>qaView.inline===window.qaEditor&&qaView.inline.input.value.includes('QA_UNSAVED_DRAFT')));
  await page.evaluate(()=>qaView.inline.cancel());await page.waitForTimeout(200);
  check('cancel does not persist draft',!(await readFile(path.join(vault,'note-solid.md'),'utf8')).includes('QA_UNSAVED_DRAFT'));
  await page.evaluate(board=>qaView.session.change(b=>Object.assign(b,board)),originalBoard);await select(['index']);
  await page.evaluate(()=>qaView.session.flush());
  const disk=JSON.parse(await readFile(path.join(vault,'Card styles.thoughtspace'),'utf8'));
  check('new styles persist to vault',disk.nodes.filter(n=>['index','sticky'].includes(n.id)).map(n=>n.cardStyle),['index','sticky']);
  await page.reload();await page.waitForFunction(()=>window.app?.workspace?.layoutReady&&app.plugins.plugins.thoughtspace,{},{timeout:30000});
  await page.evaluate(async()=>{const leaf=app.workspace.getLeaf(false);await leaf.setViewState({type:'thoughtspace-board',state:{file:'Card styles.thoughtspace'},active:true});window.qaView=leaf.view;});
  await page.waitForFunction(()=>window.qaView?.session?.board?.nodes?.length===6);
  check('new styles reload from vault',await page.evaluate(()=>qaView.session.board.nodes.filter(n=>['index','sticky'].includes(n.id)).map(n=>n.cardStyle)),['index','sticky']);
  for(const theme of ['light','dark'])for(const [width,height,zoom]of [[1440,1020,1],[1024,900,.5],[1440,1020,2],[640,880,1]]){
   await page.evaluate(({width,height})=>require('@electron/remote').getCurrentWindow().setBounds({width,height}),{width,height});
   await page.evaluate(({theme,zoom})=>{document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');qaView.session.board.viewport={x:28,y:30,zoom};qaView.renderBoard();},{theme,zoom});
   await select(['index']);await page.waitForTimeout(250);
   const errors=await page.evaluate(()=>Array.from(document.querySelectorAll('.ts-card-style-option')).filter(el=>{const label=el.querySelector('.ts-card-style-name');return label&&label.scrollWidth>label.clientWidth+1;}).map(el=>el.dataset.style));
   check(`${theme} ${width} zoom ${zoom} picker labels fit`,errors,[]);
   const file=`native-${theme}-${width}-zoom-${zoom}.png`;await page.screenshot({path:path.join(out,file)});report.screenshots.push(file);
  }
  for(const theme of ['light','dark']){
   await page.evaluate(()=>require('@electron/remote').getCurrentWindow().setBounds({width:1160,height:860}));
   await page.evaluate(({board,theme})=>{
    document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');
    const focused={...board,nodes:board.nodes.filter(n=>['index','sticky'].includes(n.id)).map((n,i)=>({...n,x:100+i*440,y:180,width:390,height:380})),viewport:{x:0,y:0,zoom:1}};
    qaView.session.change(b=>Object.assign(b,focused));qaView.selected.clear();qaView.updateSelection();qaView.renderBoard();
   },{board:originalBoard,theme});await page.waitForTimeout(300);
   const focused=`native-${theme}-new-styles.png`;await page.screenshot({path:path.join(out,focused)});report.screenshots.push(focused);
   const expanded=await page.evaluate(()=>Object.fromEntries(['index','sticky'].map(id=>[id,getComputedStyle(document.querySelector(`.ts-node[data-id="${id}"]`)).backgroundColor])));
   for(const zoom of [.5,1,2]){
    await page.evaluate(zoom=>{qaView.session.board.viewport.zoom=zoom;qaView.renderBoard();for(const id of ['index','sticky'])qaView.foldText(id,true);},zoom);await page.waitForTimeout(120);
    const folded=await page.evaluate(()=>Object.fromEntries(['index','sticky'].map(id=>[id,getComputedStyle(document.querySelector(`.ts-node[data-id="${id}"]`)).backgroundColor])));
    check(`${theme} zoom ${zoom} folded surfaces match expanded`,folded,expanded);
    check(`${theme} zoom ${zoom} folded controls remain mounted`,await page.locator('.ts-node.is-compact-fold .ts-compact-inline-unfold').count(),2);
    await page.evaluate(()=>{for(const id of ['index','sticky'])qaView.foldText(id,false);});
   }
   await page.evaluate(()=>{qaView.plugin.settings.detailZoom=2.4;qaView.session.board.viewport.zoom=1;qaView.renderBoard();});await page.waitForTimeout(100);
   check(`${theme} summary surfaces match expanded`,await page.evaluate(()=>Object.fromEntries(['index','sticky'].map(id=>[id,getComputedStyle(document.querySelector(`.ts-node[data-id="${id}"]`)).backgroundColor]))),expanded);
   check(`${theme} summary cards render`,await page.locator('.ts-node.ts-node-summary').count(),2);
   await page.evaluate(()=>{qaView.plugin.settings.detailZoom=.35;qaView.renderBoard();});
  }
  // Constrain the real board pane, exercising container breakpoints without
  // pretending that a desktop window is a mobile Obsidian runtime.
  for(const width of [456,420,260]){
   await page.evaluate(width=>{qaView.containerEl.style.width=`${width}px`;qaView.containerEl.style.flex='none';qaView.onResize?.();qaView.renderBoard();},width);
   await select(['index']);await page.waitForTimeout(150);
   const metrics=await page.evaluate(()=>{const options=[...document.querySelectorAll('.ts-card-style-option')],picker=document.querySelector('.ts-card-style-picker'),rows=new Set(options.map(el=>Math.round(el.getBoundingClientRect().top)));return{width:picker.getBoundingClientRect().width,columns:options.length/rows.size,rows:rows.size,overflow:options.filter(el=>{const label=el.querySelector('.ts-card-style-name');return label.scrollWidth>label.clientWidth+1;}).length};});
   report.checks.push({name:`pane ${width} responsive metrics`,passed:true,metrics});
   check(`pane ${width} picker labels fit`,metrics.overflow,0);
   check(`pane ${width} picker wraps choices`,metrics.columns,width===260?2:3);
   const file=`native-pane-${width}.png`;await page.screenshot({path:path.join(out,file)});report.screenshots.push(file);
  }
  check('no native page errors',report.errors,[]);
 }
}catch(error){report.failure={message:error.message,stack:error.stack};if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 if(application&&application.exitCode===null){const closed=new Promise(resolve=>application.once('exit',resolve));application.kill('SIGTERM');await Promise.race([closed,sleep(2000)]);if(application.exitCode===null)application.kill('SIGKILL');await Promise.race([closed,sleep(1000)]);}
 if(browser)await Promise.race([browser.close(),sleep(1000)]);
 console.log(JSON.stringify(report,null,2));
}
