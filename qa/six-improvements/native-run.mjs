import {readFile,writeFile,mkdir,mkdtemp,readdir,copyFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const root=path.resolve(process.env.QA_PLUGIN_ROOT||'.');
const out=path.resolve(process.env.QA_OUTPUT);
await mkdir(out,{recursive:true});assert.equal((await readdir(out)).length,0);
const temporary=await mkdtemp(path.join(tmpdir(),'thoughtspace-six-20261008-'));
const profile=path.join(temporary,'profile'),vault=path.join(temporary,'vault');
await mkdir(profile);await mkdir(path.join(vault,'.obsidian/qa-session'),{recursive:true});
const source=path.join(process.env.HOME,'Library/Application Support/obsidian');
const packages=(await readdir(source)).filter(p=>/^obsidian-\d+\.\d+\.\d+\.asar$/.test(p)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
assert.ok(packages.length);await copyFile(path.join(source,packages.at(-1)),path.join(profile,packages.at(-1)));
await writeFile(path.join(profile,'obsidian.json'),JSON.stringify({vaults:{a6ab202610080001:{path:vault,ts:Date.now(),open:true}}}));
await writeFile(path.join(vault,'.obsidian/community-plugins.json'),'[]');
await writeFile(path.join(vault,'.obsidian/app.json'),JSON.stringify({showUnsupportedFiles:true,alwaysUpdateLinks:true}));
await writeFile(path.join(vault,'.obsidian/qa-session/data.json'),JSON.stringify({onboardingVersion:99,alignmentGuides:false,boardSearchIndex:false}));
const report={root,temporary,profile,vault,runtime:packages.at(-1),checks:[],screenshots:[],errors:[],metrics:[],scope:'New native Obsidian process/profile/vault; input via Playwright mouse and keyboard over only this process CDP. No installed plugin files, no personal notes/settings.'};
const check=(name,actual,expected=true)=>{const passed=JSON.stringify(actual)===JSON.stringify(expected);report.checks.push({name,actual,expected,passed});console.log(`${passed?'PASS':'FAIL'} ${name}`);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let application,browser,page;
try{
 application=spawn('/Applications/Obsidian.app/Contents/MacOS/Obsidian',[`--user-data-dir=${profile}`,'--remote-debugging-port=0'],{stdio:'ignore'});
 let port;for(let i=0;i<100&&!port;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await sleep(200);}}
 assert.ok(port);browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(15000);
 await page.waitForFunction(()=>window.app?.workspace?.layoutReady,{},{timeout:40000});
 check('dedicated profile',await realpath(await page.evaluate(()=>require('@electron/remote').app.getPath('userData'))),await realpath(profile));
 check('dedicated vault',await realpath(await page.evaluate(()=>app.vault.adapter.basePath)),await realpath(vault));
 const trust=page.getByRole('button',{name:/信任仓库作者并启用插件|Trust author and enable plugins/});if(await trust.count())await trust.click();
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('dialog',d=>void d.dismiss());
 const load=async builtRoot=>{
  const files=await Promise.all(['main.js','styles.css','manifest.json'].map(f=>readFile(path.join(builtRoot,f),'utf8')));
  await page.evaluate(async({code,css,manifest})=>{
   for(const l of app.workspace.getLeavesOfType('thoughtspace-board'))await l.detach();
   await app.plugins.unloadPlugin('thoughtspace');manifest.dir='.obsidian/qa-session';app.plugins.manifests.thoughtspace=manifest;
   const adapter=app.vault.adapter,read=adapter.read.bind(adapter),exists=adapter.exists.bind(adapter);
   adapter.read=async p=>p===manifest.dir+'/main.js'?code:p===manifest.dir+'/styles.css'?css:read(p);
   adapter.exists=async p=>p===manifest.dir+'/styles.css'?true:exists(p);
   await app.plugins.setEnable(true);try{await app.plugins.loadPlugin('thoughtspace');}finally{adapter.read=read;adapter.exists=exists;}
   if(!app.plugins.plugins.thoughtspace)throw Error('Plugin failed to initialize');
  },{code:files[0],css:files[1],manifest:JSON.parse(files[2])});
  report.builds??=[];report.builds.push({root:builtRoot,sha256:files.map(f=>createHash('sha256').update(f).digest('hex'))});
 };
 await load(root);await page.evaluate(()=>{app.setting.close();app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();require('@electron/remote').getCurrentWindow().setBounds({x:40,y:40,width:1440,height:1040});require('@electron/remote').getCurrentWindow().focus();});
 await page.waitForTimeout(500);for(const p of browser.contexts()[0].pages())if(p!==page)await p.close();await page.bringToFront();
 report.connection={pid:application.pid,port};await writeFile(path.join(out,'connection.json'),JSON.stringify({profile,vault,...report.connection}));
 const screenshot=async name=>{await page.mouse.move(10,20);await page.waitForTimeout(100);await page.screenshot({path:path.join(out,name),timeout:15000});report.screenshots.push(name);};
 const open=async file=>{await page.waitForFunction(file=>!!app.vault.getAbstractFileByPath(file),file,{timeout:10000});await page.evaluate(async file=>{const leaf=app.workspace.getLeaf('tab');await leaf.setViewState({type:'thoughtspace-board',state:{file},active:true});await leaf.loadIfDeferred();window.qaView=leaf.view;},file);await page.waitForFunction(file=>window.qaView?.session&&qaView.file?.path===file,file);};
 const module=await import(path.resolve(process.env.QA_CHECKS||'qa/six-improvements/performance.mjs'));
 await module.run({page,browser,out,vault,profile,report,check,screenshot,open,load});
 check('no page errors',report.errors,[]);check('no installed plugin directory',(await readdir(path.join(vault,'.obsidian'))).includes('plugins'),false);
}catch(e){report.failure={message:e.message,stack:e.stack};if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error(e);process.exitCode=1;}
finally{
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 if(application&&application.exitCode===null){const closed=new Promise(r=>application.once('exit',r));application.kill('SIGTERM');await Promise.race([closed,sleep(2000)]);if(application.exitCode===null)application.kill('SIGKILL');await Promise.race([closed,sleep(1000)]);}
 if(browser)await Promise.race([browser.close(),sleep(1000)]);if(report.checks.some(c=>!c.passed))process.exitCode=1;
 console.log(JSON.stringify({checks:report.checks.length,metrics:report.metrics.length,failure:report.failure,errors:report.errors}));
}
