import {copyFile} from 'node:fs/promises';
import path from 'node:path';
export async function run({page,vault,report,check,screenshot}) {
 await copyFile(path.resolve('../qa/fixtures/fixture.mp4'),path.join(vault,'Keyboard.mp4'));
 await page.waitForFunction(()=>!!app.vault.getAbstractFileByPath('Keyboard.mp4'));
 await page.evaluate(async()=>{const leaf=app.workspace.getLeaf('tab');await leaf.setViewState({type:'thoughtspace-media-player',active:true,state:{file:'Keyboard.mp4',placement:'tab'}});await leaf.loadIfDeferred();window.qaMedia=leaf.view;});
 const view=page.locator('.workspace-leaf.mod-active .ts-media-workspace');await view.waitFor();await view.locator('.ts-media-card__play').click();await page.waitForFunction(()=>document.querySelector('.workspace-leaf.mod-active video')?.readyState>=2);
 await view.getByRole('textbox',{name:'摘录 Markdown 正文'}).fill('键盘验收草稿：操作后仍保留。');
 await page.evaluate(()=>{window.qaPlayerBefore=qaMedia.contentEl.querySelector('video');window.qaInputBefore=qaMedia.contentEl.querySelector('[aria-label="摘录 Markdown 正文"]');});
 await page.evaluate(async()=>{const plugin=app.plugins.plugins.thoughtspace;plugin.settings.accent='blue';plugin.settings.density='compact';await plugin.savePreferences();});
 check('native preference update retains player and draft editor identity',await page.evaluate(()=>qaMedia.contentEl.querySelector('video')===qaPlayerBefore&&qaMedia.contentEl.querySelector('[aria-label="摘录 Markdown 正文"]')===qaInputBefore));
 check('native preference update keeps the typed draft',await view.getByRole('textbox',{name:'摘录 Markdown 正文'}).inputValue(),'键盘验收草稿：操作后仍保留。');
 check('existing media view receives current accent and density',await view.evaluate(e=>[e.dataset.accent,e.dataset.density]),['blue','compact']);
 const more=view.getByRole('button',{name:'更多媒体操作',exact:true});await more.focus();await page.keyboard.press('Enter');await page.locator('.menu').waitFor();report.menuKeyboard=[];let target=false;
 for(let i=0;i<14;i++){await page.keyboard.press('ArrowDown');const state=await page.locator('.menu').evaluate(e=>Array.from(e.querySelectorAll('.menu-item')).map(item=>({text:item.querySelector('.menu-item-title')?.textContent,cls:item.className,selected:item.classList.contains('selected')||item.classList.contains('is-selected')||item.getAttribute('aria-selected')==='true'})));report.menuKeyboard.push({step:i,state});if(state.some(s=>s.selected&&s.text==='收起画面')){target=true;break;}}
 check('native menu ArrowDown reaches the compact action',target);await screenshot('media-keyboard-menu.png');
 if(target){await page.keyboard.press('Enter');await page.locator('.menu').waitFor({state:'hidden'});check('keyboard menu activation compacts the player',await view.getAttribute('data-compact-player'),'true');}
 await more.focus();await page.keyboard.press('Enter');await page.locator('.menu').waitFor();await page.keyboard.press('Escape');await page.locator('.menu').waitFor({state:'hidden'});
 check('menu cancellation preserves draft',await view.getByRole('textbox',{name:'摘录 Markdown 正文'}).inputValue(),'键盘验收草稿：操作后仍保留。');
 check('menu cancellation preserves live player',await page.evaluate(()=>qaMedia.contentEl.querySelector('video')===qaPlayerBefore));await screenshot('media-keyboard-cancel-and-draft.png');
}
