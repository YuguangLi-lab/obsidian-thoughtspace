import {copyFile} from 'node:fs/promises';
import path from 'node:path';
export async function runMedia(ctx){
 const {page,vault,report,check,screenshot}=ctx;
 await copyFile(path.resolve('../qa/fixtures/focus.mp4'),path.join(vault,'Focus-QA.mp4'));
 await page.waitForFunction(()=>!!app.vault.getAbstractFileByPath('Focus-QA.mp4'));
 for(const theme of ['light','dark']){
  await page.bringToFront();await page.evaluate(theme=>{document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');require('@electron/remote').getCurrentWindow().focus();},theme);
  await page.keyboard.press('Meta+p');const initialCommand=page.locator('.prompt-input');await initialCommand.waitFor();await initialCommand.fill('在主页面打开媒体播放器');await page.keyboard.press('Enter');await initialCommand.waitFor({state:'hidden'});
  const initialView=page.locator('.workspace-leaf.mod-active .ts-media-workspace');await initialView.waitFor();await initialView.getByRole('button',{name:'选择音频或视频',exact:true}).click();const initialPicker=page.locator('.prompt-input');await initialPicker.waitFor();await initialPicker.fill('Focus-QA.mp4');await page.keyboard.press('Enter');await initialPicker.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('.workspace-leaf.mod-active .ts-media-workspace')?.dataset.mediaKind==='video');
  await page.evaluate(()=>{window.qaMedia=app.workspace.activeLeaf.view;});
  const view=page.locator('.workspace-leaf.mod-active .ts-media-workspace');await view.waitFor();await page.waitForTimeout(240);await view.locator('.ts-media-card__play').click();await page.waitForFunction(()=>document.querySelector('.workspace-leaf.mod-active video')?.readyState>=2&&!document.querySelector('.workspace-leaf.mod-active video')?.paused);
  const input=view.getByRole('textbox',{name:'摘录 Markdown 正文'});await input.fill(`专注播放保留草稿-${theme}`);await page.evaluate(()=>{window.qaFocusVideo=qaMedia.contentEl.querySelector('video');window.qaFocusInput=qaMedia.contentEl.querySelector('[aria-label="摘录 Markdown 正文"]');});
  const more=view.getByRole('button',{name:'更多媒体操作',exact:true});await more.focus();await page.keyboard.press('Enter');await page.locator('.menu').waitFor();await page.waitForTimeout(180);await page.keyboard.press('Escape');await page.locator('.menu').waitFor({state:'hidden'});
  check(`${theme} media: cancel menu keeps normal layout`,await view.getAttribute('data-focus-player'),'false');check(`${theme} media: cancel menu preserves draft`,await input.inputValue(),`专注播放保留草稿-${theme}`);
  await more.click();await page.locator('.menu-item-title').filter({hasText:/^专注播放$/}).click();await screenshot(`supplement-media-${theme}-focus.png`);
  const focus=await view.evaluate(e=>({focused:e.dataset.focusPlayer,desk:getComputedStyle(e.querySelector('.ts-media-workspace__desk')).display,composer:getComputedStyle(e.querySelector('.ts-media-workspace__composer')).display,videoSame:e.querySelector('video')===qaFocusVideo,inputSame:e.querySelector('[aria-label="摘录 Markdown 正文"]')===qaFocusInput,playing:!qaFocusVideo.paused,value:qaFocusInput.value}));report.focusMedia??=[];report.focusMedia.push({theme,...focus});
  check(`${theme} media: focus hides record panels`,focus.focused==='true'&&focus.desk==='none'&&focus.composer==='none');check(`${theme} media: focus retains live decoder and draft`,focus.videoSame&&focus.inputSame&&focus.playing&&focus.value===`专注播放保留草稿-${theme}`);
  await more.focus();await page.keyboard.press('Enter');await page.locator('.menu').waitFor();await page.waitForTimeout(180);let reached=false;
  for(let i=0;i<14;i++){await page.keyboard.press('ArrowDown');const target=await page.locator('.menu').evaluate(e=>Array.from(e.querySelectorAll('.menu-item')).find(e=>e.classList.contains('selected')||e.classList.contains('is-selected'))?.querySelector('.menu-item-title')?.textContent);if(target==='显示记录面板'){reached=true;break;}}
  check(`${theme} media: keyboard reaches restore panels`,reached);if(reached)await page.keyboard.press('Enter');else await page.keyboard.press('Escape');await page.locator('.menu').waitFor({state:'hidden'});await screenshot(`supplement-media-${theme}-restored.png`);
  check(`${theme} media: restored panels retain editor and text`,await view.evaluate(e=>e.dataset.focusPlayer==='false'&&e.querySelector('[aria-label="摘录 Markdown 正文"]')===qaFocusInput&&qaFocusInput.value===`专注播放保留草稿-${document.body.classList.contains('theme-dark')?'dark':'light'}`));
  await more.click();await page.locator('.menu-item-title').filter({hasText:/^专注播放$/}).click();await page.keyboard.press('Meta+w');await view.waitFor({state:'hidden'});
  await page.keyboard.press('Meta+p');const command=page.locator('.prompt-input');await command.waitFor();await command.fill('在主页面打开媒体播放器');await page.keyboard.press('Enter');await command.waitFor({state:'hidden'});await view.waitFor();
  await view.getByRole('button',{name:'选择音频或视频',exact:true}).click();const picker=page.locator('.prompt-input');await picker.waitFor();await picker.fill('Focus-QA.mp4');await page.keyboard.press('Enter');await picker.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('.workspace-leaf.mod-active .ts-media-workspace')?.dataset.mediaKind==='video');await page.waitForTimeout(200);await screenshot(`supplement-media-${theme}-reopened.png`);
  check(`${theme} media: reopen restores focus state`,await view.getAttribute('data-focus-player'),'true');
  await more.click();await page.locator('.menu-item-title').filter({hasText:/^显示记录面板$/}).click();check(`${theme} media: reopen restores typed draft`,await view.getByRole('textbox',{name:'摘录 Markdown 正文'}).inputValue(),`专注播放保留草稿-${theme}`);
  await page.keyboard.press('Meta+w');await view.waitFor({state:'hidden'});
 }
}
