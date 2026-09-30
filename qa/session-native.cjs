// Official Obsidian, disposable vault only. Session interleavings use production
// methods; nudge/undo and Markdown editing use real keyboard/pointer input. A
// temporary, note-specific vault.modify gate models a slow native auto-save.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.resolve(process.env.QA_OUTPUT || 'dist/session-native');
const vault = '/workspace/.thoughtspace-native/vault';
const report = {checks:[],errors:[],warnings:[],screenshots:[],scope:'Native session ownership, multi-view keyboard undo/redo and a controlled slow native save in the disposable vault.'};
let browser,page;
function check(name,actual,expected=true) {
 let passed=true;try {assert.deepEqual(actual,expected);} catch {passed=false;}
 report.checks.push({name,actual,expected,passed});console.log(`${passed?'PASS':'FAIL'} ${name}`);
}
async function main() {
 await fs.mkdir(output,{recursive:true});
 browser=await chromium.connectOverCDP(process.env.OBSIDIAN_CDP || 'http://127.0.0.1:9222');
 page=browser.contexts()[0].pages().find(p=>p.url().includes('app://obsidian.md'));assert.ok(page);
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&m.text().includes('[ThoughtSpace]'))report.errors.push(m.text());if(m.type()==='warning'&&/thoughtspace|inline|editor/i.test(m.text()))report.warnings.push(m.text());});
 await page.waitForFunction(()=>window.qaView?.session?.board);
 report.runtime=await page.evaluate(()=>({vault:app.vault.adapter.basePath,version:require('@electron/remote').app.getVersion()}));
 assert.equal(report.runtime.vault,vault);check('native test uses the disposable vault',report.runtime.vault,vault);
 report.build={};
 for(const file of ['main.js','styles.css','manifest.json']) {
  const workspace=createHash('sha256').update(await fs.readFile(path.resolve(__dirname,'..',file))).digest('hex');
  const installed=createHash('sha256').update(await fs.readFile(path.join(vault,'.obsidian/plugins/thoughtspace',file))).digest('hex');
  report.build[file]={workspace,installed};assert.equal(installed,workspace);check(`native installed ${file} matches source build`,installed,workspace);
 }
 await page.bringToFront();await page.evaluate(async()=>{
  require('@electron/remote').getCurrentWindow().focus();require('@electron/remote').getCurrentWindow().setBounds({x:20,y:20,width:1440,height:1040});
  await qaView.session.flush();
  window.qaSessionFixture={leaves:[],files:[],originalView:qaView};
  qaSessionFixture.inputEvents=[];qaSessionFixture.observeInput=e=>{
   if(e.type==='paste'||e.button===1)qaSessionFixture.inputEvents.push({type:e.type,button:e.button,preventedAtCapture:e.defaultPrevented,cancelable:e.cancelable,target:e.target?.className,active:document.activeElement?.className,ownedAtCapture:qaSessionFixture.active?.suppressMiddlePaste});
  };
  for(const type of ['pointerdown','pointerup','mousedown','mouseup','auxclick','paste'])document.addEventListener(type,qaSessionFixture.observeInput,true);
  const q=qaSessionFixture,stamp=Date.now();q.stamp=stamp;q.notePath=`Notes/QA-session-${stamp}.md`;q.boardPath=`ThoughtSpace/QA-session-${stamp}.thoughtspace`;
  if(process.platform==='linux'){q.originalSelection=require('@electron/remote').clipboard.readText('selection');q.primarySeed='Controlled primary selection for native middle-pan regression.';}
  q.body='# Native pending save\n\nOriginal disposable content.\n';
  q.note=await app.vault.create(q.notePath,q.body);q.files.push(q.note);
  const board=JSON.parse(JSON.stringify(qaView.session.board));board.nodes=[{id:'qa-text',kind:'text',text:'Shared session',x:140,y:120,width:260,height:110,color:'sand'},{id:'qa-note',kind:'card',file:q.notePath,x:470,y:120,width:350,height:310,color:'green',cardStyle:'paper'}];board.edges=[];board.mode='free';board.viewport={x:0,y:80,zoom:1};
  q.file=await app.vault.create(q.boardPath,JSON.stringify(board,null,2));q.files.push(q.file);
 });
 for(const turns of [0,1,2,3]) {
  const result=await page.evaluate(async turns=>{
   const plugin=app.plugins.plugins.thoughtspace,file=qaSessionFixture.file,initial=await plugin.session(file),closing=plugin.release(initial);
   for(let i=0;i<turns;i++)await Promise.resolve();
   const claimed=await plugin.session(file),observer=()=>{};claimed.listeners.add(observer);await closing;
   const cached=plugin.sessions.get(file),current=cached&&await cached;
   const next=await plugin.session(file),result={cached:current===claimed,same:next===claimed};
   claimed.listeners.delete(observer);await plugin.release(claimed);result.released=!plugin.sessions.has(file);return result;
  },turns);
  check(`reopen after ${turns} microtasks retains the acquired session`,result.cached&&result.same);
  check(`reopen after ${turns} microtasks still releases its last owner`,result.released);
 }
 await page.evaluate(async()=>{
  const q=qaSessionFixture;
  for(let i=0;i<2;i++){const leaf=app.workspace.getLeaf(i?'split':'tab');q.leaves.push(leaf);await leaf.setViewState({type:'thoughtspace-board',state:{file:q.boardPath}});}
  q.views=q.leaves.map(l=>l.view);q.active=q.views[0];app.workspace.setActiveLeaf(q.active.leaf,{focus:true});q.active.selected=new Set(['qa-text']);q.active.updateSelection();q.active.stage.focus();
 });
 check('two native whiteboard views share one session',await page.evaluate(()=>qaSessionFixture.views[0].session===qaSessionFixture.views[1].session));
 check('new native fixture contains only its two intended objects',await page.evaluate(()=>qaSessionFixture.active.session.board.nodes.map(n=>n.id).sort()),['qa-note','qa-text']);
 const before=await page.evaluate(()=>qaSessionFixture.active.session.board.nodes.find(n=>n.id==='qa-text').x);
 await page.keyboard.press('ArrowRight');await page.waitForTimeout(200);
 const after=await page.evaluate(()=>qaSessionFixture.active.session.board.nodes.find(n=>n.id==='qa-text').x);
 check('real keyboard nudge moves the shared object',after>before);
 check('both native views render the changed object at its updated position',await page.evaluate(after=>qaSessionFixture.views.map(v=>v.positions.get('qa-text')?.style.left),after),[`${after}px`,`${after}px`]);
 await page.keyboard.press('Control+z');await page.waitForTimeout(200);
 check('real undo restores both views',await page.evaluate(()=>qaSessionFixture.views.map(v=>v.session.board.nodes.find(n=>n.id==='qa-text').x)),[before,before]);
 await page.keyboard.press('Control+Shift+z');await page.waitForTimeout(200);
 check('real redo restores the nudge in both views',await page.evaluate(()=>qaSessionFixture.views.map(v=>v.session.board.nodes.find(n=>n.id==='qa-text').x)),[after,after]);
 check('shared session saves the final board bytes',await page.evaluate(async()=>{const q=qaSessionFixture;await q.active.session.flush();return JSON.parse(await app.vault.read(q.file)).nodes.find(n=>n.id==='qa-text').x;}),after);
 for(const order of ['read-before-pan','pan-before-read']) {
 await page.evaluate(async order=>{
  const q=qaSessionFixture;q.originalRead=app.vault.read;
  if(q.primarySeed)require('@electron/remote').clipboard.writeText(q.primarySeed,'selection');
  const external=JSON.parse(await app.vault.read(q.file));external.viewport={x:900,y:450,zoom:1};
  q.externalId=`qa-external-${order}`;external.nodes.push({id:q.externalId,kind:'text',text:'External update',x:950,y:100,width:220,height:100,color:'sand'});
  q.externalRaw=JSON.stringify(external,null,2);q.externalGateActive=true;q.externalReadStarted=false;
  const gate=new Promise(resolve=>q.releaseExternal=resolve);
  app.vault.read=async function(file,...args){if(file===q.file&&q.externalGateActive){q.externalReadStarted=true;await gate;return q.externalRaw;}return q.originalRead.call(this,file,...args);};
  q.cameraBefore={...q.active.session.board.viewport};q.active.selected.clear();q.active.updateSelection();q.active.stage.focus();
 },order);
 if(await page.evaluate(()=>!!qaSessionFixture.primarySeed))check(`${order}: Linux primary selection contains the controlled fixture`,await page.evaluate(()=>require('@electron/remote').clipboard.readText('selection')===qaSessionFixture.primarySeed));
 const notifyExternal=async()=>{await page.evaluate(async()=>{const q=qaSessionFixture;await app.vault.modify(q.file,q.externalRaw);q.external=q.active.session.externalUpdate();});await page.waitForFunction(()=>qaSessionFixture.externalReadStarted);};
 if(order==='read-before-pan')await notifyExternal();
 const stageBox=await page.evaluate(()=>{const r=qaSessionFixture.active.stage.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});
 const panPoint={x:stageBox.x+stageBox.width*.52,y:stageBox.y+stageBox.height*.8};
 check(`${order}: native pan starts on actual blank canvas`,await page.evaluate(p=>{const e=document.elementFromPoint(p.x,p.y);return !!e?.closest('.ts-stage')&&!e.closest('[data-id],button,.ts-toolbar');},panPoint));
 await page.mouse.move(panPoint.x,panPoint.y);await page.mouse.down({button:'middle'});await page.mouse.move(panPoint.x+80,panPoint.y+30,{steps:4});await page.waitForTimeout(180);
 const camera=await page.evaluate(()=>({...qaSessionFixture.active.session.board.viewport}));
 check(`${order}: real middle drag moves the camera before the external read completes`,await page.evaluate(camera=>camera.x!==qaSessionFixture.cameraBefore.x,camera));
 if(order==='pan-before-read')await notifyExternal();
 await page.evaluate(()=>{const q=qaSessionFixture;q.externalGateActive=false;q.releaseExternal();});
 await page.waitForFunction(()=>qaSessionFixture.active.session.baseline===qaSessionFixture.externalRaw);
 check(`${order}: external content is accepted during the native pan`,await page.evaluate(()=>qaSessionFixture.active.session.board.nodes.some(n=>n.id===qaSessionFixture.externalId)));
 check(`${order}: external read does not jump the active native camera`,await page.evaluate(()=>({...qaSessionFixture.active.session.board.viewport})),camera);
 await page.mouse.up({button:'middle'});await page.evaluate(async()=>{const q=qaSessionFixture;await q.external;await q.active.session.flush();app.vault.read=q.originalRead;});
 const synced=await page.evaluate(async()=>{const q=qaSessionFixture,b=JSON.parse(await app.vault.read(q.file));return{camera:b.viewport,external:b.nodes.some(n=>n.id===q.externalId),blocked:q.active.session.blocked};});
 check(`${order}: native pan release saves its camera against the external baseline`,synced.camera,camera);
 check(`${order}: native pan release preserves external objects without a false save conflict`,synced.external&&!synced.blocked);
 }
 await page.evaluate(async()=>{
  const q=qaSessionFixture;await q.leaves[1].detach();q.views=q.views.slice(0,1);
  const leaf=app.workspace.getLeaf('tab');q.leaves.push(leaf);await leaf.setViewState({type:'markdown',state:{file:q.notePath,mode:'source'}});q.native=leaf.view;
  app.workspace.setActiveLeaf(leaf,{focus:true});q.native.editor.focus();
  q.originalModify=app.vault.modify;const gate=new Promise(resolve=>q.releaseSave=resolve);
  app.vault.modify=async function(file,...args){if(file===q.note&&!q.gateUsed){q.gateUsed=true;q.saveBlocked=true;await gate;}return q.originalModify.call(this,file,...args);};
 });
 await page.keyboard.press('Control+End');await page.keyboard.insertText('\nPending native content must be retained.\n');
 await page.evaluate(()=>{const q=qaSessionFixture;q.expected=q.native.editor.getValue();q.saving=q.native.save().catch(e=>q.saveError=String(e));});
 await page.waitForFunction(()=>qaSessionFixture.saveBlocked&&qaSessionFixture.native.saving,{},{timeout:10000});
 check('native TextFileView has an actual pending save',await page.evaluate(()=>qaSessionFixture.native.saving===true));
 check('pending native content is newer than disk',await page.evaluate(async()=>{const q=qaSessionFixture;return await app.vault.read(q.note)!==q.expected;}));
 await page.evaluate(()=>{
  const q=qaSessionFixture,v=q.active;app.workspace.setActiveLeaf(v.leaf,{focus:true});v.selected=new Set(['qa-note']);v.selectedEdge=undefined;
  v.session.board.viewport={x:(v.stage.clientWidth-350)/2-470,y:80,zoom:1};v.renderBoard();v.updateSelection();v.stage.focus();
 });await page.waitForTimeout(200);
 const card=page.locator('.workspace-leaf.mod-active .ts-node[data-id="qa-note"]');
 await card.locator('.ts-card-actions').getByRole('button',{name:'编辑笔记',exact:true}).click();
 await page.waitForTimeout(120);await page.evaluate(()=>qaSessionFixture.releaseSave());
 await card.locator('.ts-inline-native .cm-content').waitFor({state:'visible',timeout:10000});
 check('card opens the pending native content without a false conflict',await page.evaluate(()=>{const q=qaSessionFixture;return q.active.inline?.input.value===q.expected;}));
 check('pending native save finishes without an error',await page.evaluate(async()=>{const q=qaSessionFixture;await q.saving;return !q.saveError;}));
 await page.keyboard.press('Control+End');await page.keyboard.insertText('\nSaved from the whiteboard after native auto-save.\n');
 const finalText=await page.evaluate(()=>qaSessionFixture.active.inline.input.value);
 report.finalBoard=await page.evaluate(()=>{const q=qaSessionFixture;return{nodes:q.active.session.board.nodes.map(n=>({id:n.id,kind:n.kind,text:n.text})),rendered:[...q.active.positions.keys()],inputEvents:q.inputEvents};});
 check('native keyboard editing introduces no unintended board objects',report.finalBoard.nodes.map(n=>n.id).sort(),['qa-external-pan-before-read','qa-external-read-before-pan','qa-note','qa-text']);
 check('native middle pan does not dispatch a canvas paste',report.finalBoard.inputEvents.filter(e=>e.type==='paste'&&e.target==='ts-stage').length,0);
 const screenshot=path.join(output,'pending-native-save-editor.png');await page.screenshot({path:screenshot});report.screenshots.push(screenshot);
 await page.keyboard.press('Control+Enter');await page.waitForFunction(()=>!qaSessionFixture.active.inline);
 check('card edit persists both native and whiteboard additions',await page.evaluate(()=>app.vault.read(qaSessionFixture.note)),finalText);
 check('native source view receives the whiteboard save',await page.evaluate(()=>qaSessionFixture.native.editor.getValue()),finalText);
}
(async()=>{
 try {await main();} catch(e){report.errors.push(e.stack||String(e));console.error(e);}
 finally {
  if(page)try {const unexpected=await page.evaluate(async()=>{
   const q=window.qaSessionFixture;if(!q)return;
   for(const type of ['pointerdown','pointerup','mousedown','mouseup','auxclick','paste'])document.removeEventListener(type,q.observeInput,true);
   if(q.originalRead)app.vault.read=q.originalRead;q.externalGateActive=false;q.releaseExternal?.();await q.external;
   if(q.originalModify)app.vault.modify=q.originalModify;q.releaseSave?.();await q.saving;
   q.active?.inline?.cancel();const sessions=new Set((q.views||[]).map(v=>v.session).filter(Boolean));
   for(const session of sessions)await session.flush();
   for(const leaf of q.leaves)if(app.workspace.getLeafById(leaf.id))await leaf.detach();
   for(const session of sessions)await session.flush();
   for(const file of [...q.files].reverse())if(app.vault.getAbstractFileByPath(file.path)===file)await app.vault.delete(file,true);
   const leftovers=app.vault.getFiles().filter(f=>f.basename.startsWith(`QA-session-${q.stamp}`)&&['Notes','ThoughtSpace'].includes(f.parent?.path));
   const paths=leftovers.map(f=>f.path);for(const file of leftovers)await app.vault.delete(file,true);
   app.workspace.setActiveLeaf(q.originalView.leaf,{focus:true});q.originalView.stage.focus();
   if(q.originalSelection!==undefined)require('@electron/remote').clipboard.writeText(q.originalSelection,'selection');delete window.qaSessionFixture;return paths;
  });if(unexpected)check('native fixture cleanup leaves no extra recovery files',unexpected,[]);} catch(e){report.errors.push(`restoration: ${e.stack||e}`);}
  if(browser)await browser.close();
  report.summary={checks:report.checks.length,passed:report.checks.filter(c=>c.passed).length,failed:report.checks.filter(c=>!c.passed).length,errors:report.errors.length,warnings:report.warnings.length};
  await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
  if(report.summary.failed||report.summary.errors||report.summary.warnings)process.exitCode=1;
 }
})();
