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
const out=path.resolve(process.env.QA_OUTPUT||path.join(root,'dist/table-frame-next'));
const temporary=await mkdtemp(path.join(tmpdir(),'thoughtspace-table-frame-'));
const profile=path.join(temporary,'profile'),vault=path.join(temporary,'vault');
const plugin=path.join(vault,'.obsidian/plugins/thoughtspace');
await mkdir(plugin,{recursive:true});await mkdir(profile);await mkdir(out,{recursive:true});
const profileSource=process.env.OBSIDIAN_PROFILE||path.join(process.env.HOME,'Library/Application Support/obsidian');
const packages=(await readdir(profileSource)).filter(file=>/^obsidian-\d+\.\d+\.\d+\.asar$/.test(file)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
assert.ok(packages.length,'A current locally installed Obsidian runtime is required');
await copyFile(path.join(profileSource,packages.at(-1)),path.join(profile,packages.at(-1)));
await writeFile(path.join(profile,'obsidian.json'),JSON.stringify({vaults:{'f4a4e000f4a4e001':{path:vault,ts:Date.now(),open:true}}}));
await writeFile(path.join(vault,'.obsidian/community-plugins.json'),'["thoughtspace"]');
await writeFile(path.join(vault,'.obsidian/app.json'),JSON.stringify({alwaysUpdateLinks:true}));
await writeFile(path.join(vault,'.obsidian/appearance.json'),JSON.stringify({theme:'moonstone'}));
for(const file of ['main.js','styles.css','manifest.json'])await copyFile(path.join(root,file),path.join(plugin,file));
await writeFile(path.join(plugin,'data.json'),JSON.stringify({onboardingVersion:99}));
const markdown='| Project | State |\n| --- | --- |\n| Table QA | Ready |\n| Frame | None |';
const nodes=[
 {id:'manual',kind:'text',text:markdown,transparent:true,x:40,y:170,width:700,height:250,color:'sand',fontSize:16,autoSize:false,textAutoHeight:false},
 {id:'auto',kind:'text',text:markdown,transparent:true,x:40,y:500,width:520,height:180,color:'sand',fontSize:16,autoSize:true},
 {id:'plain',kind:'text',text:'Normal text keeps its card frame.\n\nThis is a non-table control.',transparent:false,x:820,y:170,width:300,height:180,color:'blue',fontSize:16,autoSize:false}
];
await writeFile(path.join(vault,'Table frame.thoughtspace'),JSON.stringify({version:3,nodes,edges:[],viewport:{x:20,y:20,zoom:1}},null,2));
const report={scope:'Real Obsidian runtime and plugin in an isolated temporary vault. Production rendering and inline editing; deterministic synthetic selection.',temporary,profile,vault,runtime:packages.at(-1),checks:[],metrics:[],screenshots:[],errors:[]};
report.build=Object.fromEntries(await Promise.all(['main.js','styles.css','manifest.json'].map(async file=>[file,createHash('sha256').update(await readFile(path.join(plugin,file))).digest('hex')])));
let application,browser,page;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(name,actual,expected=true)=>{let passed=true;try{assert.deepEqual(actual,expected);}catch{passed=false;}report.checks.push({name,passed,actual,expected});console.log(`${passed?'PASS':'FAIL'} ${name}: ${JSON.stringify(actual)}`);};
try{
 application=spawn(process.env.OBSIDIAN_PATH||'/Applications/Obsidian.app/Contents/MacOS/Obsidian',[`--user-data-dir=${profile}`,'--remote-debugging-port=0'],{stdio:'ignore'});
 let port;
 for(let i=0;i<100&&!port;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await sleep(200);}}
 assert.ok(port,'Isolated Obsidian CDP endpoint did not start');
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 const context=browser.contexts()[0];page=context.pages()[0]||await context.waitForEvent('page');
 assert.equal(await realpath(await page.evaluate(()=>require('@electron/remote').app.getPath('userData'))),await realpath(profile));
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.waitForFunction(()=>window.app?.workspace?.layoutReady,{},{timeout:40000});
 const trust=page.getByRole('button',{name:/信任仓库作者并启用插件|Trust author and enable plugins/});
 if(await trust.count())await trust.click();
 await page.waitForFunction(()=>!!app.plugins.plugins.thoughtspace,{},{timeout:20000});
 await page.evaluate(async()=>{
  const leaf=app.workspace.getLeaf(false);await leaf.setViewState({type:'thoughtspace-board',state:{file:'Table frame.thoughtspace'},active:true});window.qaView=leaf.view;
  app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();require('@electron/remote').getCurrentWindow().setBounds({x:40,y:40,width:1440,height:1040});
 });
 await page.waitForFunction(()=>document.querySelectorAll('.ts-node[data-id] .ts-text-markdown table').length===2,{},{timeout:30000});
 const select=async ids=>{await page.evaluate(ids=>{qaView.selected=new Set(ids);qaView.contextOpen=false;qaView.updateSelection();qaView.renderSelectionTools();},ids);await page.waitForTimeout(80);};
 const inspect=async(state,theme)=>{
  const result=await page.evaluate(()=>{
   const style=el=>{if(!el)return null;const s=getComputedStyle(el),r=el.getBoundingClientRect();return {tag:el.tagName,class:el.className,x:r.x,y:r.y,width:r.width,height:r.height,padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],outline:s.outline,outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,outlineColor:s.outlineColor,background:s.backgroundColor,boxShadow:s.boxShadow,pointerEvents:s.pointerEvents,overflow:s.overflow};};
   return [...document.querySelectorAll('.ts-node[data-id]')].map(el=>({id:el.dataset.id,node:style(el),body:style(el.querySelector('.ts-text-body')),markdown:style(el.querySelector('.ts-text-markdown')),editor:style(el.querySelector('.ts-inline-native,.ts-inline-input')),editorLayers:[...el.querySelectorAll('.cm-editor,.cm-scroller,.cm-content,.cm-contentContainer,.cm-sizer,.cm-line,.cm-table-widget,.table-wrapper')].map(part=>({...style(part),...(part.classList.contains('cm-line')?{html:part.innerHTML}:{} )})),tableWidget:style(el.querySelector('.ts-inline-native .cm-table-widget')),table:style(el.querySelector('.ts-inline-native table')||el.querySelector('table')),cell:style(el.querySelector('.ts-inline-native th,.ts-inline-native td')||el.querySelector('th,td')),pseudo:['before','after'].map(p=>{const s=getComputedStyle(el,`::${p}`);return {pseudo:p,content:s.content,border:s.border,outline:s.outline,background:s.backgroundColor,boxShadow:s.boxShadow};})}));
  });
  report.metrics.push({theme,state,nodes:result});
  for(const item of result.filter(n=>n.id!=='plain')){
   const prefix=`${theme} ${state} ${item.id}`;
   check(`${prefix} no node outline`,item.node.outlineStyle==='none'||item.node.outlineWidth==='0px');
   check(`${prefix} no node border`,item.node.border.every(v=>v==='0px'));
   check(`${prefix} no node shadow`,item.node.boxShadow,'none');
   check(`${prefix} transparent node background`,item.node.background,'rgba(0, 0, 0, 0)');
   const content=item.editor||item.body;
   if(content)check(`${prefix} no content padding`,content.padding,['0px','0px','0px','0px']);
   if(item.cell)check(`${prefix} grid retained`,item.cell.border.every(v=>Number.parseFloat(v)>0));
   if(item.editor&&item.table)check(`${prefix} editor grid starts inside visible frame`,item.table.x>=item.editor.x-.5);
   if(item.editor&&item.table&&item.tableWidget)check(`${prefix} editor grid ends inside visible viewport`,item.table.x+item.table.width<=item.tableWidget.x+item.tableWidget.width+.5);
  }
  const plain=result.find(n=>n.id==='plain');
  if(plain)check(`${theme} ${state} ordinary text frame retained`,plain.node.border.some(v=>Number.parseFloat(v)>0));
  const name=`native-${theme}-${state}.png`;await page.screenshot({path:path.join(out,name)});report.screenshots.push(name);
 };
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');},theme);
  await select([]);await page.mouse.move(1300,950);await inspect('unselected',theme);
  await select(['manual']);await inspect('selected-manual',theme);
  await select(['auto']);await inspect('selected-auto',theme);
  await select(['manual']);await page.evaluate(()=>qaView.startInlineEdit('manual'));await page.waitForTimeout(200);await inspect('editing-manual',theme);
  await page.evaluate(()=>qaView.inline?.cancel());await page.waitForTimeout(150);
  await select(['auto']);await page.evaluate(()=>qaView.startInlineEdit('auto'));await page.waitForTimeout(200);await inspect('editing-auto',theme);
  await page.evaluate(()=>qaView.inline?.cancel());await page.waitForTimeout(150);
 }
 await page.evaluate(async()=>{document.body.classList.remove('theme-dark');document.body.classList.add('theme-light');await qaView.newTable({x:400,y:350});window.qaNewTable=qaView.inlineId;});
 await page.waitForTimeout(300);await inspect('new-table-editing','light');
 report.newTable=await page.evaluate(()=>{const n=qaView.session.board.nodes.find(n=>n.id===window.qaNewTable);return {node:n,text:qaView.inline?.input.value};});
 if(process.argv.includes('--gutter-probe')){
  const gutterMetrics=()=>page.evaluate(()=>{
   const node=document.querySelector(`.ts-node[data-id="${window.qaNewTable}"]`);
   return [...node.querySelectorAll('.ts-inline-native,.cm-scroller,.cm-sizer,.cm-contentContainer,.cm-content,.cm-table-widget,.table-wrapper,table')].map(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {class:el.className,x:r.x,y:r.y,width:r.width,height:r.height,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,scrollbarGutter:s.scrollbarGutter,overflowX:s.overflowX,overflowY:s.overflowY,marginLeft:s.marginLeft,marginRight:s.marginRight};});
  });
  report.gutterProbe={before:await gutterMetrics()};
  await page.evaluate(()=>document.querySelector(`.ts-node[data-id="${window.qaNewTable}"] .ts-inline-native .cm-scroller`).style.scrollbarGutter='auto');
  await page.waitForTimeout(300);report.gutterProbe.after=await gutterMetrics();
  report.gutterProbe.overflow=await page.evaluate(()=>{
   const wrapper=document.querySelector(`.ts-node[data-id="${window.qaNewTable}"] .table-wrapper`),frame=wrapper.getBoundingClientRect();
   return [...wrapper.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>frame.right+.5).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName,class:el.className,aria:el.getAttribute('aria-label'),title:el.getAttribute('title'),x:r.x,y:r.y,width:r.width,height:r.height,overflowRight:r.right-frame.right,position:s.position,transform:s.transform,html:el.outerHTML.slice(0,350)};});
  });
  const screenshot='native-light-new-table-gutter-auto.png';await page.screenshot({path:path.join(out,screenshot)});report.screenshots.push(screenshot);
  console.log(`GUTTER ${JSON.stringify(report.gutterProbe)}`);
 }
 await page.evaluate(()=>qaView.inline?.cancel());
 const beforeTyping=await page.evaluate(()=>qaView.session.board.nodes.find(n=>n.id==='manual').text);
 const typeCell=async marker=>{
  await select(['manual']);await page.evaluate(()=>qaView.startInlineEdit('manual'));await page.waitForTimeout(150);
  const cell=page.locator('.ts-node[data-id="manual"] .ts-inline-native .table-editor th .cm-content').first();
  await cell.click();await page.keyboard.press('End');await page.keyboard.insertText(marker);
  await page.waitForFunction(marker=>qaView.inline?.input.value.includes(marker),marker,{timeout:5000});
  check(`native cell accepts ${marker}`,await page.evaluate(marker=>qaView.inline.input.value.includes(marker),marker));
 };
 await typeCell('QA_CELL_CANCEL');await page.evaluate(()=>qaView.inline.cancel());await page.waitForTimeout(150);
 check('cancel preserves original table content',await page.evaluate(()=>qaView.session.board.nodes.find(n=>n.id==='manual').text),beforeTyping);
 await typeCell('QA_CELL_COMMIT');
 check('native edited table commits',await page.evaluate(()=>qaView.inline.commit()));
 await page.evaluate(()=>qaView.session.flush());
 const saved=JSON.parse(await readFile(path.join(vault,'Table frame.thoughtspace'),'utf8')).nodes.find(n=>n.id==='manual').text;
 check('native cell edit persists to disk',saved.includes('QA_CELL_COMMIT'));
 check('canceled cell edit never persisted',!saved.includes('QA_CELL_CANCEL'));
 check('no native runtime errors',report.errors,[]);
 report.summary={passed:report.checks.filter(v=>v.passed).length,failed:report.checks.filter(v=>!v.passed).length};
 console.log(JSON.stringify(report.summary));
 if(report.summary.failed)process.exitCode=1;
}catch(error){report.failure={message:error.message,stack:error.stack};if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 if(application&&application.exitCode===null){const closed=new Promise(resolve=>application.once('exit',resolve));application.kill('SIGTERM');await Promise.race([closed,sleep(2000)]);if(application.exitCode===null)application.kill('SIGKILL');await Promise.race([closed,sleep(1000)]);}
 if(browser)await Promise.race([browser.close(),sleep(1000)]);
 console.log(`Report: ${path.join(out,'report.json')}`);
}
