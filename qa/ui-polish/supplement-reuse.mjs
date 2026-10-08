// Run only inside the dedicated synthetic instance created by native-run.mjs.
// Product mutations below go through actual UI; evaluate creates fixtures,
// chooses the active synthetic leaf, and reads model/DOM evidence only.
export async function runReuse({page,report,check,screenshot,open}){
 const active=()=>page.locator('.workspace-leaf.mod-active');
 const modal=()=>page.locator('.ts-board-reuse');
 const linkModal=()=>page.locator('.ts-selection-note');
 const size=async(width=1440,height=1040)=>{
  await page.evaluate(({width,height})=>require('@electron/remote').getCurrentWindow().setBounds({x:40,y:40,width,height}),{width,height});
  await page.waitForTimeout(220);
 };
 const sourceFront=async()=>{
  await page.bringToFront();
  await page.evaluate(()=>{require('@electron/remote').getCurrentWindow().focus();app.workspace.setActiveLeaf(qaReuseSource.leaf,{focus:true});window.qaView=qaReuseSource;});
  await page.waitForTimeout(140);
 };
 const targetFront=async()=>{
  await page.evaluate(()=>{app.workspace.setActiveLeaf(qaReuseTarget.leaf,{focus:true});window.qaView=qaReuseTarget;});
  await page.waitForTimeout(160);
 };
 const record=async(name,selector)=>{
  await screenshot(name);report.reuseSurfaces??=[];
  report.reuseSurfaces.push({name,selector,...await page.locator(selector).first().evaluate(e=>{
   const r=e.getBoundingClientRect();return{theme:document.body.classList.contains('theme-dark')?'dark':'light',viewport:{width:innerWidth,height:innerHeight},bounds:{x:r.x,y:r.y,width:r.width,height:r.height},scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};
  })});
 };
 const sourceStamp=()=>page.evaluate(()=>JSON.stringify({nodes:qaReuseSource.session.board.nodes,edges:qaReuseSource.session.board.edges}));
 const noteRaw=file=>page.evaluate(async file=>app.vault.read(app.vault.getAbstractFileByPath(file)),file);
 const sourceCard=()=>active().locator('.ts-node[data-id="source"]');
 const openReuse=async()=>{
  await sourceFront();await sourceCard().locator('.ts-node-header').click();
  // The header's workspace menu does not contain reuse. The board's advertised
  // action search does (main.ts boardActions + Ctrl/Meta+Shift+P).
  await active().locator('.ts-stage').focus();await page.keyboard.press('Meta+Shift+p');
  const actions=page.locator('.ts-board-action-modal');await actions.waitFor();
  await actions.getByRole('searchbox',{name:'搜索白板操作'}).fill('复用到其他白板');
  await actions.getByRole('button',{name:'复用到其他白板',exact:true}).click();await modal().waitFor();
 };
 const openEditor=async(selectPhrase=true)=>{
  // The selected card's quick-edit dock may be hidden by its existing chrome
  // policy. Enter is the advertised actual keyboard action for the selection.
  await sourceFront();await sourceCard().locator('.ts-node-header').click();
  await active().locator('.ts-stage').focus();await page.keyboard.press('Enter');
  await active().locator('.ts-inline-native .cm-content').waitFor();
  await page.waitForFunction(()=>!!qaReuseSource.inline&&qaReuseSource.inlineId==='source');
  if(selectPhrase){
   await active().locator('.ts-inline-native .cm-content').click();await page.keyboard.press('Meta+a');
   await page.waitForFunction(()=>qaReuseSource.inline.input.selectionStart===0&&qaReuseSource.inline.input.selectionEnd===qaReuseSource.inline.value.length);
  }
 };
 const openLink=async()=>{
  await active().getByRole('button',{name:'选中文字创建或关联笔记',exact:true}).click();await linkModal().waitFor();
 };
 const chooseFragment=async targetBase=>{
  const query=linkModal().getByRole('searchbox',{name:'搜索或命名关联笔记'});
  await query.fill(targetBase);await linkModal().getByRole('button',{name:`选择 ${targetBase} 中的标题或块`,exact:true}).click();
  await linkModal().getByRole('button',{name:'返回笔记搜索',exact:true}).waitFor();
  await query.fill('特定小节');
  await linkModal().locator('.ts-fragment-option').filter({hasText:/^特定小节$/}).click();
 };
 const verifyAccent=async(theme,name,locator,property='color')=>{
  const expected=theme==='light'?'rgb(50, 103, 86)':'rgb(138, 187, 171)';
  const actual=await locator.evaluate((e,property)=>({value:getComputedStyle(e)[property],checked:e.checked,pressed:e.getAttribute('aria-pressed'),surfaceAccent:getComputedStyle(e.closest('.ts-ui-modal')).getPropertyValue('--ts-accent').trim()}),property);
  report.reuseAccent??=[];report.reuseAccent.push({theme,name,property,expected,...actual});
  await check(`${name} ${theme}: selected control uses plugin accent`,actual.value,expected);
 };
 report.reuseSupplement={scope:'Two dedicated production modals; actual menu/buttons, native editor selection, Escape/Alt+Left, native undo/redo/save. Fixtures and model snapshots are synthetic.',themes:[]};
 for(const theme of ['light','dark']){
  const prefix=`补测-${theme}`,sourceNote=`${prefix}-关联来源.md`,targetBase=`${prefix}-关联目标`,targetNote=targetBase+'.md';
  const sourceBoard=`${prefix}-复用来源.thoughtspace`,targetBoard=`${prefix}-复用目标.thoughtspace`;
  const original='待关联概念',targetOriginal=`# ${targetBase}\n\n## 特定小节\n\n这段合成证据保留原生标题和块锚点。 ^proof-block\n`;
  await page.evaluate(async({sourceNote,targetNote,original,targetOriginal,sourceBoard,targetBoard})=>{
   const node=(id,file,x,y)=>({id,kind:'card',file,title:file.replace(/\.md$/,''),x,y,width:320,height:220,color:'sand',cardStyle:'band',autoFit:false});
   await app.vault.create(sourceNote,original);await app.vault.create(targetNote,targetOriginal);
   await app.vault.create(sourceBoard,JSON.stringify({version:3,nodes:[node('source',sourceNote,80,120),node('child',targetNote,500,120)],edges:[{id:'internal-branch',from:'source',to:'child',kind:'branch',label:'合成分支'}],viewport:{x:0,y:0,zoom:1}},null,2));
   await app.vault.create(targetBoard,JSON.stringify({version:3,nodes:[node('existing',sourceNote,80,80)],edges:[],viewport:{x:0,y:0,zoom:1}},null,2));
  },{sourceNote,targetNote,original,targetOriginal,sourceBoard,targetBoard});
  await page.waitForFunction(file=>!!app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(file))?.headings?.some(h=>h.heading==='特定小节'),targetNote);
  await open(sourceBoard);await page.evaluate(theme=>{window.qaReuseSource=qaView;document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');document.body.style.setProperty('--interactive-accent','#8d43c2');qaReuseSource.plugin.settings.accent='forest';qaReuseSource.applyPreferences();},theme);
  await size();await page.waitForTimeout(240);const initialSource=await sourceStamp();
  // Cancel a configured new-board route; it must not create any destination.
  await openReuse();await check(`reuse ${theme}: target required before submit`,await modal().getByRole('button',{name:'添加并打开',exact:true}).isDisabled());
  await verifyAccent(theme,'reuse branch checkbox',modal().locator('.ts-reuse-options input[type=checkbox]'),'accentColor');
  await modal().getByRole('button',{name:'新建独立白板',exact:true}).click();
  await modal().getByRole('textbox',{name:'新白板名称'}).fill(`${prefix}-取消创建`);
  await modal().locator('.ts-reuse-options input[type=checkbox]').click();
  await check(`reuse ${theme}: unchecked branch limits preview`,await modal().locator('.ts-reuse-summary').textContent().then(t=>t.startsWith('1 个对象')));
  await modal().getByRole('combobox',{name:'放置位置'}).selectOption('below');
  await modal().getByRole('textbox',{name:'外层分组名称'}).fill('取消前的长中文分组：保持来源与原文');
  await record(`supplement-reuse-${theme}-new-cancel-wide.png`,'.ts-board-reuse');await size(640,760);
  await record(`supplement-reuse-${theme}-new-cancel-narrow.png`,'.ts-board-reuse');
  await page.keyboard.press('Escape');await modal().waitFor({state:'hidden'});await size();
  await check(`reuse ${theme}: cancellation creates no file`,await page.evaluate(name=>!!app.vault.getAbstractFileByPath(name),`${prefix}-取消创建.thoughtspace`),false);
  await check(`reuse ${theme}: cancellation preserves original graph`,await sourceStamp(),initialSource);
  await check(`reuse ${theme}: cancellation preserves source Markdown`,await noteRaw(sourceNote),original);
  // Reopen, cancel the native picker, then select an existing target.
  await openReuse();await check(`reuse ${theme}: reopened route resets preview options`,await modal().locator('.ts-reuse-summary').textContent().then(t=>t.startsWith('2 个对象')));
  await modal().getByRole('button',{name:'选择已有白板',exact:true}).click();await page.locator('.prompt-input').last().waitFor();
  await page.keyboard.press('Escape');await page.locator('.prompt-input').waitFor({state:'hidden'});
  await check(`reuse ${theme}: cancelling target picker retains reuse modal`,await modal().isVisible());
  await modal().getByRole('button',{name:'选择已有白板',exact:true}).click();await page.locator('.prompt-input').last().fill(targetBoard);
  await page.locator('.suggestion-item').filter({hasText:targetBoard}).click();
  await page.waitForFunction(()=>document.querySelector('.ts-reuse-route')?.textContent?.includes('复用目标'));
  await modal().getByRole('combobox',{name:'放置位置'}).selectOption('below');
  await size(640,760);
  await modal().getByRole('textbox',{name:'外层分组名称'}).fill('复用来源 · 继续阅读与验证');
  await check(`reuse ${theme}: existing shared note explained in preview`,await modal().locator('.ts-reuse-stats').textContent().then(t=>t.includes('1 张笔记已在目标中')));
  // fill focuses the actual final input; Tab must reach the native submit
  // button without API focus, forced clicking, or bypassing clipped parents.
  await page.keyboard.press('Tab');
  const submitFocus=await page.evaluate(()=>{
   const e=document.activeElement,r=e.getBoundingClientRect(),style=getComputedStyle(e);
   const bounds={left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
   const visible={left:0,right:innerWidth,top:0,bottom:innerHeight},clips=[];
   for(let p=e.parentElement;p;p=p.parentElement){
    const s=getComputedStyle(p),pr=p.getBoundingClientRect(),clipX=['auto','scroll','hidden','clip'].includes(s.overflowX),clipY=['auto','scroll','hidden','clip'].includes(s.overflowY);
    if(!clipX&&!clipY)continue;
    const clip={tag:p.tagName,className:p.className,overflowX:s.overflowX,overflowY:s.overflowY,left:pr.left+p.clientLeft,right:pr.left+p.clientLeft+p.clientWidth,top:pr.top+p.clientTop,bottom:pr.top+p.clientTop+p.clientHeight};clips.push(clip);
    if(clipX){visible.left=Math.max(visible.left,clip.left);visible.right=Math.min(visible.right,clip.right);}
    if(clipY){visible.top=Math.max(visible.top,clip.top);visible.bottom=Math.min(visible.bottom,clip.bottom);}
   }
   return{label:e.getAttribute('aria-label'),tag:e.tagName,inDialog:!!e.closest('.ts-board-reuse'),disabled:!!e.disabled,bounds,visibleBounds:visible,clips,fullyVisible:r.width>0&&r.height>0&&style.visibility==='visible'&&r.left>=visible.left-1&&r.right<=visible.right+1&&r.top>=visible.top-1&&r.bottom<=visible.bottom+1};
  });
  report.reuseSubmitFocus??=[];report.reuseSubmitFocus.push({theme,...submitFocus});
  await record(`supplement-reuse-${theme}-existing-keyboard-narrow.png`,'.ts-board-reuse');
  await check(`reuse ${theme}: actual Tab reaches visible enabled submit`,submitFocus.label==='添加并打开'&&submitFocus.tag==='BUTTON'&&submitFocus.inDialog&&!submitFocus.disabled&&submitFocus.fullyVisible);
  await size();
  await record(`supplement-reuse-${theme}-existing-ready.png`,'.ts-board-reuse');
  await modal().getByRole('button',{name:'添加并打开',exact:true}).click();await modal().waitFor({state:'hidden'});
  await page.waitForFunction(file=>app.workspace.activeLeaf?.view?.file?.path===file&&app.workspace.activeLeaf.view.session?.board.nodes.length===4,targetBoard);
  await page.evaluate(sourceNote=>{window.qaReuseTarget=app.workspace.activeLeaf.view;window.qaView=qaReuseTarget;window.qaReuseCopyId=qaReuseTarget.session.board.nodes.find(n=>n.id!=='existing'&&n.kind==='card'&&n.file===sourceNote)?.id;},sourceNote);
  const addition=await page.evaluate(()=>({ids:qaReuseTarget.session.board.nodes.map(n=>n.id),edges:qaReuseTarget.session.board.edges.map(e=>({id:e.id,from:e.from,to:e.to,kind:e.kind})),copyId:qaReuseCopyId}));
  await check(`reuse ${theme}: new identities retain internal branch`,addition.ids.length===4&&new Set(addition.ids).size===4&&!addition.ids.includes('source')&&!addition.ids.includes('child')&&addition.edges.length===1&&addition.edges[0].kind==='branch'&&addition.copyId!==undefined);
  await check(`reuse ${theme}: submitted copy preserves original graph`,await sourceStamp(),initialSource);
  await active().locator('.ts-stage').focus();await page.keyboard.press('Meta+z');await page.waitForFunction(()=>qaReuseTarget.session.board.nodes.length===1);
  await check(`reuse ${theme}: target undo removes entire addition`,await page.evaluate(()=>({nodes:qaReuseTarget.session.board.nodes.map(n=>n.id),edges:qaReuseTarget.session.board.edges.length})),{nodes:['existing'],edges:0});
  await page.keyboard.press('Meta+Shift+z');await page.waitForFunction(()=>qaReuseTarget.session.board.nodes.length===4);
  await check(`reuse ${theme}: target redo restores exact identities`,await page.evaluate(()=>qaReuseTarget.session.board.nodes.map(n=>n.id)),addition.ids);
  await record(`supplement-reuse-${theme}-target-redo.png`,'.workspace-leaf.mod-active .ts-stage');
  // A real native selection opens the note-link dialog; cancel fragment/embed
  // choices, then reopen and commit one native heading link.
  await openEditor();await check(`association ${theme}: actual native keyboard selects source phrase`,await page.evaluate(()=>qaReuseSource.inline.value.slice(qaReuseSource.inline.input.selectionStart,qaReuseSource.inline.input.selectionEnd)),original);
  await openLink();await chooseFragment(targetBase);
  await linkModal().getByRole('button',{name:'嵌入正文',exact:true}).click();
  await verifyAccent(theme,'association embed mode',linkModal().locator('.ts-fragment-modes button[aria-pressed=true]'));
  await verifyAccent(theme,'association heading choice',linkModal().locator('.ts-fragment-option[aria-pressed=true]'));
  await record(`supplement-association-${theme}-fragment-embed-wide.png`,'.ts-selection-note');await size(640,760);
  await record(`supplement-association-${theme}-fragment-embed-narrow.png`,'.ts-selection-note');
  await linkModal().getByRole('searchbox',{name:'搜索或命名关联笔记'}).focus();await page.keyboard.press('Alt+ArrowLeft');
  await check(`association ${theme}: keyboard return restores search`,await linkModal().getByRole('searchbox',{name:'搜索或命名关联笔记'}).inputValue(),targetBase);
  await page.keyboard.press('Escape');await linkModal().waitFor({state:'hidden'});await size();
  await check(`association ${theme}: cancelling fragment choices preserves draft`,await page.evaluate(()=>qaReuseSource.inline.value),original);
  await check(`association ${theme}: cancelling preserves both Markdown files`,[await noteRaw(sourceNote),await noteRaw(targetNote)],[original,targetOriginal]);
  await openLink();await chooseFragment(targetBase);await record(`supplement-association-${theme}-heading-link-ready.png`,'.ts-selection-note');
  const expected=await page.evaluate(({targetNote,sourceNote,original})=>app.fileManager.generateMarkdownLink(app.vault.getAbstractFileByPath(targetNote),sourceNote,'#特定小节',original),{targetNote,sourceNote,original});
  await linkModal().getByRole('button',{name:'插入所选位置链接',exact:true}).click();await linkModal().waitFor({state:'hidden'});
  await check(`association ${theme}: insertion uses native anchor and alias`,await page.evaluate(()=>qaReuseSource.inline.value),expected);
  await active().locator('.ts-inline-native .cm-content').focus();await page.keyboard.press('Meta+z');
  await check(`association ${theme}: native undo restores original phrase`,await page.evaluate(()=>qaReuseSource.inline.value),original);
  await page.keyboard.press('Meta+Shift+z');await check(`association ${theme}: native redo restores heading link`,await page.evaluate(()=>qaReuseSource.inline.value),expected);
  await record(`supplement-association-${theme}-native-redo.png`,'.workspace-leaf.mod-active .ts-inline-editor');
  await page.keyboard.press('Meta+Enter');await page.waitForFunction(()=>!qaReuseSource.inline);
  await check(`association ${theme}: native keyboard save persists exact link`,await noteRaw(sourceNote),expected);
  await check(`association ${theme}: referenced native headings/blocks remain unchanged`,await noteRaw(targetNote),targetOriginal);
  await openEditor(false);
  await page.waitForFunction(()=>!!qaReuseSource.inline);await check(`association ${theme}: reopening editor reads committed link`,await page.evaluate(()=>qaReuseSource.inline.value),expected);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!qaReuseSource.inline);
  await targetFront();await page.waitForFunction(()=>{const e=qaReuseTarget.contentEl.querySelector(`.ts-node[data-id="${qaReuseCopyId}"] .ts-card-preview`);return !!e&&e.textContent.includes('待关联概念')&&e.querySelector('a.internal-link');});
  await check(`reuse ${theme}: both board instances reference one native file`,await page.evaluate(sourceNote=>qaReuseSource.session.board.nodes.find(n=>n.id==='source').file===sourceNote&&qaReuseTarget.session.board.nodes.find(n=>n.id===qaReuseCopyId).file===sourceNote,sourceNote));
  await record(`supplement-association-${theme}-shared-target-preview.png`,'.workspace-leaf.mod-active .ts-stage');
  await check(`reuse ${theme}: association leaves source geometry/graph intact`,await sourceStamp(),initialSource);
  report.reuseSupplement.themes.push({theme,sourceBoard,targetBoard,sourceNote,targetNote,expectedNativeLink:expected,sourceGraphUnchanged:await sourceStamp()===initialSource,addedNodeIds:addition.ids,relation:addition.edges[0]});
  await page.evaluate(async()=>{await qaReuseSource.session.flush();await qaReuseTarget.session.flush();await qaReuseSource.leaf.detach();await qaReuseTarget.leaf.detach();delete window.qaReuseSource;delete window.qaReuseTarget;delete window.qaReuseCopyId;});
 }
 await size();
}
