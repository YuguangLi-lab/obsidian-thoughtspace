import {readFile} from 'node:fs/promises';
import path from 'node:path';

/** Only the dedicated QA plugin object's saveData is replaced, then restored. */
export async function runSettings({page,browser,out,vault,report,check}){
 const dataPath=path.join(vault,'.obsidian/qa-session/data.json');
 const initial=await page.evaluate(()=>({accent:app.plugins.plugins.thoughtspace.settings.accent,language:app.plugins.plugins.thoughtspace.settings.settingsLanguage}));
 report.settingsFailure??={injections:[],screenshots:[],scope:'One synthetic saveData rejection at a time in the dedicated plugin instance; no filesystem permissions changed.'};
 const state=report.settingsFailure;
 const readDisk=async()=>JSON.parse(await readFile(dataPath,'utf8'));
 const snap=async()=>page.evaluate(()=>JSON.parse(JSON.stringify(app.plugins.plugins.thoughtspace.settings)));
 const openNative=async(theme)=>{
  await page.bringToFront();
  await page.evaluate(()=>{app.setting.open();app.setting.openTabById('thoughtspace');});
  let settings;
  for(let i=0;i<30&&!settings;i++){
   for(const p of browser.contexts()[0].pages())if(await p.locator('.ts-settings-v2').count())settings=p;
   if(!settings)await page.waitForTimeout(100);
  }
  if(!settings)throw Error('Dedicated native settings window missing');
  settings.setDefaultTimeout(15000);
  await settings.evaluate(theme=>{document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');require('@electron/remote').getCurrentWindow().setBounds({width:940,height:840});require('@electron/remote').getCurrentWindow().focus();},theme);
  await settings.waitForTimeout(240);
  return settings;
 };
 const record=async(settings,name)=>{
  await settings.mouse.move(10,20);await settings.waitForTimeout(100);
  await settings.screenshot({path:path.join(out,name),timeout:15000});
  report.screenshots.push(name);state.screenshots.push(name);
 };
 const inject=async(target,label,key='accent')=>{
  await page.evaluate(({target,label,key})=>{
   const plugin=app.plugins.plugins.thoughtspace;
   if(window.qaSettingsSavePatch)throw Error('Previous QA saveData patch is still active');
   const original=plugin.saveData;
   const patch={plugin,original,key,target,label,rejected:0,passed:0};window.qaSettingsSavePatch=patch;
   plugin.saveData=async function(value){
    if(!patch.rejected&&value?.[key]===target){patch.rejected++;throw Error('QA_SYNTHETIC_SETTINGS_WRITE_FAILED:'+label);}
    patch.passed++;return original.apply(this,arguments);
   };
  },{target,label,key});
 };
 const restore=async()=>{
  const result=await page.evaluate(()=>{
   const patch=window.qaSettingsSavePatch;if(!patch)return null;
   patch.plugin.saveData=patch.original;delete window.qaSettingsSavePatch;
   return{label:patch.label,key:patch.key,target:patch.target,rejected:patch.rejected,passed:patch.passed};
  });
  if(result)state.injections.push(result);
  return result;
 };
 const profile=async(settings)=>{
  await settings.locator('[data-settings-page=profiles]').click();
  await settings.getByRole('button',{name:/^导入配置$|^Import profile$/}).click();
  const modal=settings.locator('.ts-settings-profile-modal');await modal.waitFor();return modal;
 };
 const payload=accent=>JSON.stringify({format:'thoughtspace-preferences',version:1,preferences:{accent}},null,2);
 const typePayload=async(settings,modal,text)=>{
  await modal.getByRole('textbox',{name:/偏好配置 JSON|Preference profile JSON/}).click();
  await settings.keyboard.press('Meta+a');await settings.keyboard.insertText(text);
  await modal.getByRole('button',{name:/^检查配置$|^Validate$/}).click();
 };
 const nextAccent=accent=>accent==='rose'?'amber':['forest','blue','amber','rose'][['forest','blue','amber','rose'].indexOf(accent)+1];
 const nativeGlass=async(settings,target,theme)=>{
  await settings.locator('[data-settings-page=general]').click();
  const control=settings.locator('[data-setting-key=glassEffects] .checkbox-container');
  const before=await control.evaluate(e=>e.classList.contains('is-enabled'));
  let focused;
  if(theme==='light')await control.click();
  else{await control.focus();focused=await control.evaluate(e=>e===document.activeElement);await settings.keyboard.press('Space');}
  await settings.waitForTimeout(180);
  const operation={key:'glassEffects',input:theme==='light'?'mouse-click':'keyboard-space',before,target,focused,value:await control.evaluate(e=>e.classList.contains('is-enabled')),patch:await page.evaluate(()=>{const p=window.qaSettingsSavePatch;return p?{label:p.label,rejected:p.rejected,passed:p.passed}:null;})};
  state.instantInput??=[];state.instantInput.push(operation);
  console.log('SETTINGS_NATIVE_TOGGLE '+JSON.stringify(operation));
  // Obsidian's ToggleComponent handles native change and Space/Enter explicitly.
  return control;
 };
 try{
  for(const theme of ['light','dark']){
   let settings=await openNative(theme);
   const before=await snap(),diskBefore=await readDisk(),target=nextAccent(before.accent);
   await inject(!before.glassEffects,`${theme}-instant`,'glassEffects');
   await nativeGlass(settings,!before.glassEffects,theme);
   await page.waitForFunction(()=>window.qaSettingsSavePatch?.rejected===1);
   await page.waitForFunction(glassEffects=>app.plugins.plugins.thoughtspace.settings.glassEffects===glassEffects,before.glassEffects);
   await settings.waitForTimeout(100);
   const notices=[];
   for(const p of browser.contexts()[0].pages())notices.push(...await p.locator('.notice').allTextContents());
   state[theme]??={};state[theme].instant={key:'glassEffects',notices,before:before.glassEffects,target:!before.glassEffects,after:(await snap()).glassEffects,status:await settings.locator('.ts-settings-save-status').textContent()};
   check(`settings ${theme}: failed instant preference rolls back`,(await snap()).glassEffects,before.glassEffects);
   check(`settings ${theme}: failed instant preference keeps all other settings`,await snap(),before);
   check(`settings ${theme}: failed instant preference leaves disk unchanged`,await readDisk(),diskBefore);
   check(`settings ${theme}: native failure Notice is visible`,notices.some(text=>/设置未能保存，请重试|Settings could not be saved/.test(text)));
   await record(settings,`supp-settings-${theme}-instant-failure.png`);
   check(`settings ${theme}: one deliberate instant write failure`,(await restore()).rejected,1);

   let modal=await profile(settings);const text=payload(target);
   await typePayload(settings,modal,text);
   await inject(target,`${theme}-profile`);
   await modal.getByRole('button',{name:/^应用配置$|^Apply profile$/}).click();
   await modal.locator('.ts-settings-profile-status').filter({hasText:/未能应用配置，原设置已保留|Could not apply the profile/}).waitFor();
   check(`settings ${theme}: failed profile retains exact input`,await modal.getByRole('textbox',{name:/偏好配置 JSON|Preference profile JSON/}).inputValue(),text);
   check(`settings ${theme}: failed profile input becomes editable`,await modal.getByRole('textbox',{name:/偏好配置 JSON|Preference profile JSON/}).evaluate(e=>!e.readOnly));
   check(`settings ${theme}: failed profile retry is enabled`,await modal.getByRole('button',{name:/^应用配置$|^Apply profile$/}).isEnabled());
   check(`settings ${theme}: failed profile restores memory`,await snap(),before);
   check(`settings ${theme}: failed profile leaves disk unchanged`,await readDisk(),diskBefore);
   state[theme].profileError=await modal.locator('.ts-settings-profile-status').textContent();
   await record(settings,`supp-settings-${theme}-profile-failure.png`);
   check(`settings ${theme}: one deliberate profile write failure`,(await restore()).rejected,1);

   // Retry the same failed dialog and preserved JSON after restoring the writer.
   await modal.getByRole('textbox',{name:/偏好配置 JSON|Preference profile JSON/}).click();
   const retryKeyboard=[];let reachedRetry=false;
   for(let step=1;step<=8;step++){
    await settings.keyboard.press('Tab');
    const focus=await modal.evaluate(el=>{
     const e=el.ownerDocument.activeElement,inModal=!!e&&el.contains(e),s=e?getComputedStyle(e):null;
     const label=e?.textContent?.trim()||'',r=e?.getBoundingClientRect();
     return{inModal,tag:e?.tagName,label,reached:inModal&&e?.tagName==='BUTTON'&&!e.disabled&&/^(应用配置|Apply profile)$/.test(label),focusVisible:e?.matches(':focus-visible'),outlineStyle:s?.outlineStyle,outlineColor:s?.outlineColor,outlineWidth:s?.outlineWidth,boxShadow:s?.boxShadow,borderColor:s?.borderColor,bounds:r?{top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null};
    });
    retryKeyboard.push({step,...focus});if(focus.reached){reachedRetry=true;break;}
   }
   state[theme].retryKeyboard=retryKeyboard;
   check(`settings ${theme}: real Tab navigation reaches retry Apply`,reachedRetry);
   if(!reachedRetry)throw Error('Keyboard could not reach the native profile retry button within eight Tabs');
   await record(settings,`supp-settings-${theme}-same-dialog-retry.png`);
   await settings.keyboard.press('Enter');await modal.waitFor({state:'hidden'});
   await page.waitForFunction(accent=>app.plugins.plugins.thoughtspace.settings.accent===accent,target);
   check(`settings ${theme}: retry after restoration writes real synthetic-vault data`,(await readDisk()).accent,target);
   check(`settings ${theme}: successful retry retains unrelated settings`,{...(await snap()),accent:before.accent},before);
   // Closing a separately edited import is cancellation: no Apply is dispatched.
   const applied=await snap(),appliedDisk=await readDisk();
   modal=await profile(settings);await typePayload(settings,modal,payload(before.accent));
   await modal.getByRole('button',{name:/^关闭$|^Close$/}).click();await modal.waitFor({state:'hidden'});
   check(`settings ${theme}: cancel edited import preserves settings`,await snap(),applied);
   check(`settings ${theme}: cancel edited import leaves disk unchanged`,await readDisk(),appliedDisk);
   modal=await profile(settings);
   check(`settings ${theme}: reopening canceled import starts clean`,await modal.getByRole('textbox',{name:/偏好配置 JSON|Preference profile JSON/}).inputValue(),'');
   await modal.getByRole('button',{name:/^关闭$|^Close$/}).click();await modal.waitFor({state:'hidden'});
   await page.evaluate(()=>app.setting.close());settings=await openNative(theme);
   await settings.locator('[data-settings-page=general]').click();
   check(`settings ${theme}: reopened native setting shows persisted preference`,await settings.locator('[data-setting-key=accent] select:not(.is-measuring):not([aria-hidden="true"])').inputValue(),target);
   await record(settings,`supp-settings-${theme}-persisted-reopen.png`);
   modal=await profile(settings);await typePayload(settings,modal,payload(before.accent));
   await modal.getByRole('button',{name:/^应用配置$|^Apply profile$/}).click();await modal.waitFor({state:'hidden'});
   await page.waitForFunction(accent=>app.plugins.plugins.thoughtspace.settings.accent===accent,before.accent);
   await settings.waitForTimeout(150);
   check(`settings ${theme}: native profile Apply restores original preference`,(await readDisk()).accent,before.accent);
   await page.evaluate(()=>app.setting.close());
  }
 }finally{
  await restore();
  await page.evaluate(initial=>{app.setting.close();const plugin=app.plugins.plugins.thoughtspace;if(plugin.settings.accent!==initial.accent)throw Error('QA preference not restored to original accent');},initial);
 }
 check('settings failure injection is fully removed',await page.evaluate(()=>!window.qaSettingsSavePatch));
}
