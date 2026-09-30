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
const out=path.resolve(process.env.QA_OUTPUT||path.join(root,'dist/settings-next'));
const temporary=await mkdtemp(path.join(tmpdir(),'thoughtspace-settings-'));
const profile=path.join(temporary,'profile'),vault=path.join(temporary,'vault');
const plugin=path.join(vault,'.obsidian/plugins/thoughtspace');
await mkdir(plugin,{recursive:true});await mkdir(profile);await mkdir(out,{recursive:true});
const profileSource=process.env.OBSIDIAN_PROFILE||path.join(process.env.HOME,'Library/Application Support/obsidian');
const packages=(await readdir(profileSource)).filter(file=>/^obsidian-\d+\.\d+\.\d+\.asar$/.test(file)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
assert.ok(packages.length,'A locally installed Obsidian runtime is required');
await copyFile(path.join(profileSource,packages.at(-1)),path.join(profile,packages.at(-1)));
await writeFile(path.join(profile,'obsidian.json'),JSON.stringify({vaults:{'5e771a65e5700a01':{path:vault,ts:Date.now(),open:true}}}));
await writeFile(path.join(vault,'.obsidian/community-plugins.json'),'["thoughtspace"]');
await writeFile(path.join(vault,'.obsidian/app.json'),JSON.stringify({alwaysUpdateLinks:true,showUnsupportedFiles:true}));
await writeFile(path.join(vault,'.obsidian/appearance.json'),JSON.stringify({theme:'moonstone'}));
for(const file of ['main.js','styles.css','manifest.json'])await copyFile(path.join(root,file),path.join(plugin,file));
const initialSettings={settingsLanguage:'en',onboardingVersion:99,cardFolder:'PrivateResearch/Card notes',backgroundImagePath:'PRIVATE_BACKGROUND.png',favoriteBoards:['PrivateResearch/Board.thoughtspace'],autoFileCards:false,imageHostEnabled:true,defaultCardWidth:275,defaultTextSize:17,defaultCardStyle:'index',panSpeed:1.2,zoomSpeed:.8,dragThreshold:3,nudgeStep:3,fastNudge:30,gridStep:30,previewLimit:75,detailZoom:.55,accent:'rose',readingSize:20};
await writeFile(path.join(plugin,'data.json'),JSON.stringify(initialSettings));
const note='# Settings QA\n\nOriginal note content must remain byte-identical.\n\n中文标题和用户内容不应被界面语言修改。\n';
const board=JSON.stringify({version:3,nodes:[{id:'note',kind:'card',file:'Existing note.md',title:'Original title',x:0,y:0,width:340,height:250,cardStyle:'index'}],edges:[],viewport:{x:30,y:30,zoom:1}},null,2);
await writeFile(path.join(vault,'Existing note.md'),note);
await writeFile(path.join(vault,'Existing board.thoughtspace'),board);
await mkdir(path.join(vault,'PrivateResearch'));await writeFile(path.join(vault,'PrivateResearch/Board.thoughtspace'),board);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDQAAAABJRU5ErkJggg==','base64');
await writeFile(path.join(vault,'PRIVATE_BACKGROUND.png'),png);
const report={scope:'Native Obsidian preferences tab, real plugin build and production handlers, in an isolated temporary profile and vault. DOM-driven clicks and constrained desktop settings panes are not physical-device or mobile-runtime coverage. The unused WorkspaceSettingsModal has no production entry point and is not exercised.',temporary,profile,vault,runtime:packages.at(-1),checks:[],screenshots:[],errors:[]};
report.build=Object.fromEntries(await Promise.all(['main.js','styles.css','manifest.json'].map(async file=>[file,createHash('sha256').update(await readFile(path.join(plugin,file))).digest('hex')])));
let application,browser,page,mainPage;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(name,actual,expected=true)=>{assert.deepEqual(actual,expected,name);report.checks.push({name,passed:true});console.log(`PASS ${name}`);};
const categories=['general','cards','board','input','reading','filing','images','profiles'];
const settings=()=>page.locator('.ts-settings-v2:visible');
const section=id=>settings().locator(`[data-settings-panel="${id}"]`);
const row=key=>settings().locator(`.setting-item[data-setting-key="${key}"]`);
const select=key=>row(key).locator('select:not(.is-measuring)');
const go=async id=>{await settings().locator(`[data-settings-page="${id}"]`).click();await section(id).waitFor({state:'visible'});};
const waitSaved=async(key,value)=>{
 await page.waitForFunction(({key,value})=>app.plugins.plugins.thoughtspace.settings[key]===value,{key,value});
 let saved;for(let i=0;i<100;i++){saved=JSON.parse(await readFile(path.join(plugin,'data.json'),'utf8'));if(saved[key]===value)break;await sleep(40);}
 check(`saved ${key}=${String(value)}`,saved[key],value);
};
const language=async value=>{await settings().locator('select[data-setting-key="settingsLanguage"]').selectOption(value);await waitSaved('settingsLanguage',value);await page.waitForFunction(value=>value==='auto'||document.querySelector('.ts-settings-v2')?.lang===value,value);};
const screenshot=async name=>{await page.screenshot({path:path.join(out,name)});report.screenshots.push(name);};
const geometry=async(name)=>{
 const metrics=await settings().evaluate(root=>{
  const result={width:root.getBoundingClientRect().width,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,issues:[]};
  const visible=el=>!!el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  const bad=(kind,el)=>result.issues.push({kind,key:el.closest('[data-setting-key]')?.dataset.settingKey||el.dataset.settingsPage||el.textContent?.slice(0,90)});
  if(root.scrollWidth>root.clientWidth+2)bad('root horizontal overflow',root);
  for(const el of root.querySelectorAll('button,select,input,.setting-item-name,.setting-item-description')){
   if(!visible(el))continue;
   if(el.scrollWidth>el.clientWidth+2)bad('clipped content',el);
   const outer=el.closest('.setting-item')||root,r=el.getBoundingClientRect(),box=outer.getBoundingClientRect();
   if(r.left<box.left-2||r.right>box.right+2)bad('outside row bounds',el);
  }
  for(const item of root.querySelectorAll('.setting-item')){
   if(!visible(item))continue;
   const info=item.querySelector('.setting-item-info'),control=item.querySelector('.setting-item-control');
   if(!info||!control||!control.children.length)continue;
   const a=info.getBoundingClientRect(),b=control.getBoundingClientRect();
   if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)bad('label/control overlap',item);
  }
  return result;
 });
 report.checks.push({name:`${name} layout metrics`,passed:!metrics.issues.length,metrics});
 check(`${name} no clipping or overlap`,metrics.issues,[]);
};
try{
 application=spawn(process.env.OBSIDIAN_PATH||'/Applications/Obsidian.app/Contents/MacOS/Obsidian',[`--user-data-dir=${profile}`,'--remote-debugging-port=0'],{stdio:'ignore'});
 let port;for(let i=0;i<100&&!port;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await sleep(200);}}
 assert.ok(port,'Isolated Obsidian CDP endpoint did not start');
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 const context=browser.contexts()[0];page=context.pages()[0]||await context.waitForEvent('page');mainPage=page;
 check('isolated user profile',await realpath(await page.evaluate(()=>require('@electron/remote').app.getPath('userData'))),await realpath(profile));
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.waitForFunction(()=>window.app?.workspace?.layoutReady,{},{timeout:40000});
 const trust=page.getByRole('button',{name:/信任仓库作者并启用插件|Trust author and enable plugins/});if(await trust.count())await trust.click();
 await page.waitForFunction(()=>!!app.plugins.plugins.thoughtspace,{},{timeout:20000});
 check('isolated native vault',await page.evaluate(()=>app.vault.adapter.basePath),vault);
 await page.waitForTimeout(1000);
 await page.evaluate(async()=>{require('@electron/remote').getCurrentWindow().setBounds({x:30,y:30,width:1560,height:1080});await app.setting.open();app.setting.openTabById('thoughtspace');});
 await page.waitForTimeout(400);
 if(await page.evaluate(()=>!!app.setting.popout)){
  await page.evaluate(()=>app.setting.popout.win.electronWindow.setBounds({x:40,y:40,width:1400,height:1020}));
  for(let i=0;i<50;i++){
   const candidate=context.pages().find(candidate=>candidate!==page);
   if(candidate){page=candidate;break;}await sleep(100);
  }
  await page.evaluate(()=>{window.app=window.opener.app;});
  page.on('pageerror',error=>report.errors.push(error.message));
 }
 await settings().waitFor({state:'visible'});
 report.nativeLayout=await settings().evaluate(root=>{
  const ancestors=[];for(let el=root;el;el=el.parentElement){const style=getComputedStyle(el);ancestors.push({className:el.className,width:el.getBoundingClientRect().width,maxWidth:style.maxWidth,padding:style.padding,display:style.display,inlineStyle:el.getAttribute('style')});}
  return{ancestors,headings:Array.from(root.querySelectorAll('.ts-settings-panel-heading,.ts-settings-panel-heading h3,.setting-item')).slice(0,8).map(el=>({className:el.className,background:getComputedStyle(el).background,borderRadius:getComputedStyle(el).borderRadius,before:{content:getComputedStyle(el,'::before').content,border:getComputedStyle(el,'::before').border},after:{content:getComputedStyle(el,'::after').content,border:getComputedStyle(el,'::after').border}}))};
 });console.log('NATIVE_LAYOUT',JSON.stringify(report.nativeLayout));
 check('all eight settings categories available',await settings().locator('[data-settings-page]').evaluateAll(tabs=>tabs.map(tab=>tab.dataset.settingsPage)),categories);
 for(const id of categories){await go(id);check(`category ${id} selected`,await settings().locator(`[data-settings-page="${id}"]`).getAttribute('aria-current'),'page');check(`only ${id} panel visible`,await settings().locator('[data-settings-panel]:visible').count(),1);}
 await go('input');
 for(const[key,value]of Object.entries({panSpeed:'1.2',zoomSpeed:'0.8',dragThreshold:'3',nudgeStep:'3',fastNudge:'30'}))check(`custom numeric input ${key} displayed`,await select(key).inputValue(),value);
 await go('cards');check('custom card width displayed',await select('defaultCardWidth').inputValue(),'275');check('custom text size displayed',await select('defaultTextSize').inputValue(),'17');
 await select('defaultCardStyle').selectOption('sticky');await waitSaved('defaultCardStyle','sticky');
 await select('defaultCardWidth').selectOption('420');await waitSaved('defaultCardWidth',420);
 await go('general');await select('accent').selectOption('blue');await waitSaved('accent','blue');
 await language('zh-CN');check('Chinese categories rendered',await settings().locator('[data-settings-page="cards"]').innerText(),'卡片与笔记');
 await language('en');check('English categories rendered',await settings().locator('[data-settings-page="cards"]').innerText(),'Cards & notes');
 await language('auto');check('auto resolves a supported host language',['en','zh-CN'].includes(await settings().getAttribute('lang')));await language('en');

 const search=settings().getByRole('searchbox');await search.fill('card');
 check('global search spans multiple categories',await settings().locator('[data-settings-panel]:visible').count()>1);
 check('search hides nonmatching controls',await row('glassEffects').isVisible(),false);
 check('search includes default card style',await row('defaultCardStyle').isVisible());
 await search.fill('qazx_no_such_preference_987');check('empty search state visible',await settings().locator('.ts-settings-search-count').innerText(),'No matching settings');check('empty search hides every panel',await settings().locator('[data-settings-panel]:visible').count(),0);
 await search.press('Escape');check('Escape clears search',await search.inputValue(),'');check('Escape retains focus',await search.evaluate(el=>document.activeElement===el));check('Escape restores selected category',await section('general').isVisible());
 await search.fill('width');await settings().getByRole('button',{name:'Clear search',exact:true}).click();check('clear search retains focus',await search.evaluate(el=>document.activeElement===el));

 await go('cards');await section('cards').getByRole('button',{name:'Reset this category',exact:true}).click();
 await page.locator('.modal-container:visible').last().getByRole('button',{name:'Cancel',exact:true}).click();check('reset cancel preserves card style',await select('defaultCardStyle').inputValue(),'sticky');
 await section('cards').getByRole('button',{name:'Reset this category',exact:true}).click();
 await page.locator('.modal-container:visible').last().getByRole('button',{name:'Restore defaults',exact:true}).click();await waitSaved('defaultCardStyle','transparent');await waitSaved('defaultCardWidth',300);
 check('card reset preserves other categories',await page.evaluate(()=>{const p=app.plugins.plugins.thoughtspace.settings;return[p.accent,p.panSpeed,p.readingSize,p.cardFolder,p.imageHostEnabled];}),['blue',1.2,20,initialSettings.cardFolder,true]);

 await go('filing');const folderDraft='草稿 Notes/Inbox';await row('cardFolder').locator('input[type="text"]').fill(folderDraft);
 await go('reading');await go('filing');check('folder draft survives navigation',await row('cardFolder').locator('input[type="text"]').inputValue(),folderDraft);
 await language('zh-CN');check('folder draft survives language change',await row('cardFolder').locator('input[type="text"]').inputValue(),folderDraft);
 await language('en');check('user folder draft not translated',await row('cardFolder').locator('input[type="text"]').inputValue(),folderDraft);
 check('unsaved folder draft stays off disk',JSON.parse(await readFile(path.join(plugin,'data.json'),'utf8')).cardFolder,initialSettings.cardFolder);

 await go('profiles');await row('exportProfile').getByRole('button').click();
 const exportModal=page.locator('.ts-settings-profile-modal:visible'),exportInput=exportModal.getByRole('textbox',{name:'Preference profile JSON'});
 const exported=await exportInput.inputValue(),parsed=JSON.parse(exported);
 check('export JSON readonly',await exportInput.evaluate(el=>el.readOnly));check('export format correct',parsed.format,'thoughtspace-preferences');check('export version correct',parsed.version,1);
 check('export excludes vault-private fields',Object.keys(parsed.preferences).filter(key=>['cardFolder','backgroundImagePath','favoriteBoards','imageHostEnabled','autoFileCards','settingsLanguage','journalFolder'].includes(key)),[]);
 check('export excludes private path text',exported.includes('PrivateResearch')||exported.includes('PRIVATE_BACKGROUND')||exported.includes(folderDraft),false);
 await screenshot('native-export-profile.png');await exportModal.getByRole('button',{name:'Close',exact:true}).click();
 await row('importProfile').getByRole('button').click();const importModal=page.locator('.ts-settings-profile-modal:visible'),importInput=importModal.getByRole('textbox',{name:'Preference profile JSON'}),apply=importModal.getByRole('button',{name:'Apply profile',exact:true});
 check('import initially requires validation',await apply.isDisabled());
 await importInput.fill('{broken');await importModal.getByRole('button',{name:'Validate',exact:true}).click();check('malformed profile rejected',await apply.isDisabled());check('invalid profile message English',(await importModal.locator('.ts-settings-profile-status').innerText()).startsWith('Invalid profile.'));
 const valid=JSON.stringify({format:'thoughtspace-preferences',version:1,preferences:{defaultCardStyle:'index',defaultCardWidth:360,readingSize:18,panSpeed:1.5}});
 await importInput.fill(valid);await importModal.getByRole('button',{name:'Validate',exact:true}).click();check('valid profile enables apply',await apply.isEnabled());
 await importInput.fill(valid+' ');check('editing after validation disables apply',await apply.isDisabled());
 await importModal.getByRole('button',{name:'Validate',exact:true}).click();await apply.click();await waitSaved('defaultCardStyle','index');await waitSaved('defaultCardWidth',360);await waitSaved('readingSize',18);await waitSaved('panSpeed',1.5);
 check('import preserves vault-private state',await page.evaluate(()=>{const p=app.plugins.plugins.thoughtspace.settings;return[p.cardFolder,p.backgroundImagePath,p.favoriteBoards,p.imageHostEnabled,p.autoFileCards,p.settingsLanguage];}),[initialSettings.cardFolder,initialSettings.backgroundImagePath,initialSettings.favoriteBoards,true,false,'en']);

 await go('board');await row('paper').getByRole('button').click();const paper=page.locator('.ts-paper-settings:visible');
 check('paper modal translated',(await paper.locator('.modal-title').innerText()),'Paper and texture');check('paper modal no untranslated Chinese',/[\u3400-\u9fff]/.test(await paper.innerText()),false);
 await screenshot('native-paper-english.png');await paper.getByRole('button',{name:'Cancel',exact:true}).click();
 await row('backgroundImage').getByRole('button').click();const background=page.locator('.ts-background-settings:visible');
 check('background modal translated',await background.locator('.modal-title').innerText(),'Custom background image');check('background modal no untranslated Chinese',/[\u3400-\u9fff]/.test(await background.innerText()),false);
 await background.locator('input[type="file"]').setInputFiles({name:'原始 背景名字.png',mimeType:'image/png',buffer:png});
 await page.waitForFunction(()=>document.querySelector('.ts-background-settings')?.textContent.includes('原始 背景名字.png'));
 check('selected filename preserved without translation',(await background.innerText()).includes('原始 背景名字.png'));await screenshot('native-background-english.png');await background.getByRole('button',{name:'Cancel',exact:true}).click();
 check('cancelled image selection preserves saved path',JSON.parse(await readFile(path.join(plugin,'data.json'),'utf8')).backgroundImagePath,initialSettings.backgroundImagePath);

 for(const lang of ['en','zh-CN']){
  await language(lang);
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>{document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');},theme);
   for(const width of [0,640,420]){
    await settings().evaluate((el,width)=>{el.style.width=width?`${width}px`:'';el.style.maxWidth=width?'100%':'';el.style.marginLeft=width?'0':'';},width);
    await geometry(`${lang} ${theme} ${width||'native'} navigation`);
    for(const id of categories){
     await go(id);await page.waitForTimeout(50);await geometry(`${lang} ${theme} ${width||'native'} ${id}`);
     if(lang==='en'&&theme==='light'&&!width)check(`English ${id} labels translated`,/[\u3400-\u9fff]/.test(await section(id).innerText()),false);
     if((width===420&&id==='input')||(width===640&&id==='filing')||(!width&&id==='cards'))await screenshot(`native-${lang}-${theme}-${width||'desktop'}-${id}.png`);
    }
   }
  }
 }
 await language('en');await settings().evaluate(el=>{el.style.width='';el.style.maxWidth='';el.style.marginLeft='';});
 await mainPage.reload();await mainPage.waitForFunction(()=>window.app?.workspace?.layoutReady&&app.plugins.plugins.thoughtspace,{},{timeout:30000});
 await mainPage.waitForTimeout(1000);await mainPage.evaluate(()=>{app.setting.open();app.setting.openTabById('thoughtspace');});
 await mainPage.waitForTimeout(400);page=context.pages().find(candidate=>candidate!==mainPage&&!candidate.isClosed())||mainPage;
 if(page!==mainPage)await page.evaluate(()=>{window.app=window.opener.app;});await settings().waitFor({state:'visible'});
 check('language survives app reload',await settings().getAttribute('lang'),'en');await go('cards');check('imported style survives reload',await select('defaultCardStyle').inputValue(),'index');check('imported width survives reload',await select('defaultCardWidth').inputValue(),'360');
 check('existing note stays byte-identical',await readFile(path.join(vault,'Existing note.md'),'utf8'),note);check('existing board stays byte-identical',await readFile(path.join(vault,'Existing board.thoughtspace'),'utf8'),board);
 check('no native page errors',report.errors,[]);
}catch(error){report.failure={message:error.message,stack:error.stack};if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 if(application&&application.exitCode===null){const closed=new Promise(resolve=>application.once('exit',resolve));application.kill('SIGTERM');await Promise.race([closed,sleep(2000)]);if(application.exitCode===null)application.kill('SIGKILL');await Promise.race([closed,sleep(1000)]);}
 if(browser)await Promise.race([browser.close(),sleep(1000)]);
 console.log(JSON.stringify(report,null,2));
}
