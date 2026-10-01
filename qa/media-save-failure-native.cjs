const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:9237'),p=b.contexts()[0].pages().find(page=>page.url()==='app://obsidian.md/index.html');
 assert.equal(await p.evaluate(()=>app.vault.adapter.basePath),path.resolve('../thoughtspace-qa-vault'));
 await p.evaluate(()=>{window.qaMedia=app.workspace.getLeavesOfType('thoughtspace-media-player')[0].view;});
 const snapshot=()=>p.evaluate(async()=>{const d=qaMedia.memory.draft;return{id:d.id,text:d.text,time:d.time,source:d.source,image:[...new Uint8Array(await d.image.arrayBuffer())]};});
 const before=await snapshot();assert.ok(before.image.length>100);
 await p.evaluate(()=>{window.qaOriginalSaveMoment=qaMedia.host.saveMoment;qaMedia.host.saveMoment=async()=>{throw Error('QA injected note write failure');};});
 try{
  await p.getByRole('button',{name:'保存摘录',exact:true}).click();
  await p.waitForFunction(()=>!qaMedia.memory.pending&&qaMedia.memory.draft?.locked);
  assert.deepEqual(await snapshot(),before);
  assert.ok((await p.locator('.ts-media-workspace').textContent()).includes('保存未完成，文字、截图与记录时间已保留，可重试。'));
 }finally{await p.evaluate(()=>{qaMedia.host.saveMoment=qaOriginalSaveMoment;});}
 await p.getByRole('button',{name:'保存摘录',exact:true}).click();await p.waitForFunction(()=>!qaMedia.memory.draft);
 assert.equal(await p.evaluate(async id=>{const view=qaMedia,result=await app.plugins.plugins.thoughtspace.mediaWorkspace.moments(view.currentFile());return result.entries.filter(entry=>entry.id===id).length;},before.id),1);
 fs.writeFileSync('dist/media-draft-native/save-failure.json',JSON.stringify({checks:['injected note write failure retains exact text/PNG/source/time/id and visible error','retry saves exactly one entry with the original id'],scope:'Temporary vault, actual Save button with injected host save failure; not a disk-full simulation.'},null,2));
 console.log('PASS note write failure retention and single-entry retry');await b.close();
})().catch(error=>{console.error(error);process.exit(1);});
