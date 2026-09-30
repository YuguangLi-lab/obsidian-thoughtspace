const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9237'),p=b.contexts()[0].pages()[0],out='dist/media-draft-native';assert.equal(await p.evaluate(()=>app.vault.adapter.basePath),path.resolve('../thoughtspace-qa-vault'));const checks=[];const check=(s,v)=>{assert.ok(v,s);checks.push(s);console.log('PASS',s);};
 await p.evaluate(async()=>{app.plugins.plugins.thoughtspace.mediaRecovery?.close();window.qaMedia=app.workspace.getLeavesOfType('thoughtspace-media-player')[0].view;await qaMedia.clearDraft();for(const draft of app.plugins.plugins.thoughtspace.mediaDrafts.pending())await app.plugins.plugins.thoughtspace.mediaDrafts.discard(draft.id);app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();qaMedia.contentEl.style.removeProperty('width');qaMedia.contentEl.style.removeProperty('flex');const name='media/学习片段 · 媒体摘录 UI 验证.mp4';let file=app.vault.getAbstractFileByPath(name);if(!file)file=await app.vault.createBinary(name,await app.vault.readBinary(app.vault.getAbstractFileByPath('media/fixture.mp4')));await app.plugins.plugins.thoughtspace.openMediaWorkspace(file,'tab');window.qaMedia=app.workspace.getLeavesOfType('thoughtspace-media-player')[0].view;});
 const input=p.getByRole('textbox',{name:'摘录 Markdown 正文',exact:true});await p.getByRole('button',{name:'播放视频',exact:true}).click();await p.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 await p.evaluate(()=>{window.qaVideo=document.querySelector('video');qaVideo.loop=true;qaVideo.muted=true;return qaVideo.play();});
 for(const [index,text]of ['观察：画面中的空间关系\n保留关键帧，稍后在白板上整理关联。','理解：先记录时间，再补充自己的解释。','下一步：回看这一段，将证据与观点对应。'].entries()){
  await p.evaluate(index=>qaMedia.player.seek(index*.5),index);await p.waitForTimeout(80);await input.fill(text);if(index===0){await p.getByRole('button',{name:'截取当前视频画面并记录时间点',exact:true}).click();await p.waitForFunction(()=>!!qaMedia.memory.draft?.image);}
  await p.getByRole('button',{name:'保存摘录',exact:true}).click();await p.waitForFunction(()=>!qaMedia.memory.draft);}
 await input.fill('我的摘录\n\n这一帧值得留下。可以继续播放，补充自己的理解后再保存。');await p.getByRole('button',{name:'截取当前视频画面并记录时间点',exact:true}).click();await p.waitForFunction(()=>!!qaMedia.memory.draft?.image);await p.evaluate(()=>app.plugins.plugins.thoughtspace.mediaDrafts.flush());
 await p.evaluate(()=>{void qaVideo.play();window.qaInput=qaMedia.input;window.qaDraft=qaMedia.memory.draft;qaInput.focus();qaInput.setSelectionRange(2,5);qaMedia.setViewerRatio(54);qaMedia.setComposerRatio(40);});
 check('changing both layout ratios preserves decoder, editor, focus and selection',await p.evaluate(()=>qaVideo===document.querySelector('video')&&qaInput===qaMedia.input&&document.activeElement===qaInput&&qaInput.selectionStart===2&&qaInput.selectionEnd===5&&qaDraft===qaMedia.memory.draft));
 check('left column contains player only; capture is in the right composer',await p.evaluate(()=>!qaMedia.contentEl.querySelector('.ts-media-workspace__main textarea')&&!!qaMedia.contentEl.querySelector('.ts-media-workspace__composer .ts-media-card__frame')&&!qaMedia.contentEl.querySelector('.ts-media-workspace__main .ts-media-card__capture')));
 await p.evaluate(()=>{qaMedia.input.blur();document.body.classList.remove('theme-dark');document.body.classList.add('theme-light');});await p.waitForTimeout(250);await p.locator('.ts-media-workspace').screenshot({path:path.join(out,'media-wide-light.png')});
 await p.evaluate(()=>{document.body.classList.remove('theme-light');document.body.classList.add('theme-dark');});await p.waitForTimeout(200);await p.locator('.ts-media-workspace').screenshot({path:path.join(out,'media-wide-dark.png')});
 const geometry=[];
 for(const width of [420,320,260]){
  await p.evaluate(width=>{qaMedia.contentEl.style.width=width+'px';qaMedia.contentEl.style.flex='none';},width);await p.waitForTimeout(100);
  await p.getByRole('button',{name:'时间轴',exact:true}).click();check(`tabs at ${width}px retain player and draft`,await p.evaluate(()=>qaVideo===document.querySelector('video')&&qaInput===qaMedia.input&&qaDraft===qaMedia.memory.draft&&!qaVideo.paused));
  if(width===420)await p.locator('.ts-media-workspace').screenshot({path:path.join(out,'media-narrow-timeline-dark.png')});
  await p.getByRole('button',{name:'写摘录',exact:true}).click();await input.focus();await input.press('End');await input.press('ArrowLeft');
  geometry.push(await p.evaluate(()=>{const root=qaMedia.contentEl,r=root.getBoundingClientRect(),save=qaMedia.saveButton.getBoundingClientRect(),input=qaMedia.input.getBoundingClientRect();return{width:root.clientWidth,root:r.toJSON(),save:save.toJSON(),editor:input.toJSON(),saveVisible:save.left>=r.left&&save.right<=r.right&&save.bottom<=r.bottom};}));
  await p.locator('.ts-media-workspace').screenshot({path:path.join(out,`media-narrow-${width}-dark.png`)});
 }
 check('save is inside each narrow leaf',geometry.every(g=>g.saveVisible));
 await p.evaluate(()=>{qaMedia.contentEl.style.removeProperty('width');qaMedia.contentEl.style.removeProperty('flex');qaVideo.pause();});
 check('layout and tabs never changed text/image/id',await p.evaluate(()=>qaMedia.memory.draft===qaDraft&&qaDraft.text.startsWith('我的摘录')&&!!qaDraft.image));
 fs.writeFileSync(path.join(out,'layout.json'),JSON.stringify({checks,geometry},null,2));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
