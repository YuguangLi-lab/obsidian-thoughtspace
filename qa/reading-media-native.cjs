// Uses only the fixture created in the isolated thoughtspace-qa-vault.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9237');
 const p=browser.contexts()[0].pages().find(page=>page.url()==='app://obsidian.md/index.html');
 assert.equal(await p.evaluate(()=>app.vault.adapter.basePath),path.resolve('../thoughtspace-qa-vault'));
 const out='dist/reading-media-native',fixture=JSON.parse(fs.readFileSync(path.join(out,'fixture.json'))),checks=[];
 const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
 await p.bringToFront();await p.evaluate(()=>{const w=require('@electron/remote').getCurrentWindow();w.show();w.focus();});
 const open=async()=>{await p.evaluate(async file=>{await app.plugins.plugins.thoughtspace.openBoard(app.vault.getAbstractFileByPath(file));window.designView=app.plugins.plugins.thoughtspace.currentBoard;},fixture.file);};
 await p.evaluate(async()=>{for(const leaf of app.workspace.getLeavesOfType('thoughtspace-board'))await leaf.detach();});
 await open();
 await p.evaluate(()=>{
  const v=designView;v.contentEl.style.removeProperty('width');v.contentEl.style.removeProperty('flex');
  if(!v.session.board.nodes.some(n=>n.id==='style-child'))v.session.change(b=>{b.nodes.push({id:'style-child',kind:'text',text:'连接与折叠保持原样',x:520,y:990,width:280,height:100,color:'slate',autoSize:false});b.edges.push({id:'style-edge',from:'text',to:'style-child',kind:'branch',label:'关联'});});
  window.visualBefore=JSON.parse(JSON.stringify(v.session.board.nodes));window.visualEdges=JSON.stringify(v.session.board.edges);
 });
 const select=async ids=>{await p.evaluate(ids=>{designView.selected=new Set(ids);designView.updateSelection();designView.renderSelectionTools();},ids);await p.waitForTimeout(80);};
 const center=async id=>{await p.evaluate(id=>{const n=designView.session.board.nodes.find(n=>n.id===id);designView.session.board.viewport={x:designView.stage.clientWidth/2-(n.x+n.width/2),y:220-n.y,zoom:1};designView.renderBoard();},id);};
 const shot=async name=>{await p.evaluate(()=>{for(const notice of document.querySelectorAll('.notice'))notice.click();});await p.mouse.move(110,150);await p.screenshot({path:path.join(out,name),clip:await p.evaluate(()=>{const r=designView.contentEl.querySelector('.ts-main').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})});};
 const styles=p.locator('.ts-card-style-picker');
 const showStyles=async()=>{const mode=p.locator('.ts-format-mode-button[data-mode="card"]');if(await mode.getAttribute('aria-pressed')!=='true'||!await styles.isVisible())await mode.click();};
 await select(['text']);await center('text');await showStyles();check('text exposes the same six card styles',await styles.locator('button').count()===6);
 await p.evaluate(()=>{window.textPreview=designView.positions.get('text').querySelector('.ts-text-markdown');});
 for(const style of ['transparent','solid','band','paper','index','sticky']){
  await styles.locator(`[data-style="${style}"]`).click();await p.waitForTimeout(100);
  check('text style '+style+' keeps content, geometry and renderer',await p.evaluate(style=>{
   const n=designView.session.board.nodes.find(n=>n.id==='text'),old=visualBefore.find(n=>n.id==='text');
   const expected=style==='transparent'||style==='solid'?n.transparent===(style==='transparent')&&!n.cardStyle:n.cardStyle===style;
   return expected&&['id','kind','text','x','y','width','height','fontSize','fontFamily','borderWidth','borderStyle'].every(k=>n[k]===old[k])&&designView.positions.get('text').querySelector('.ts-text-markdown')===textPreview&&JSON.stringify(designView.session.board.edges)===visualEdges;
  },style));
 }
 await p.evaluate(()=>designView.stage.focus());await p.keyboard.press('Meta+z');await p.waitForTimeout(100);check('keyboard undo restores index',await p.evaluate(()=>designView.session.board.nodes.find(n=>n.id==='text').cardStyle==='index'));
 await p.keyboard.press('Meta+Shift+z');await p.waitForTimeout(100);check('keyboard redo restores sticky',await p.evaluate(()=>designView.session.board.nodes.find(n=>n.id==='text').cardStyle==='sticky'));
 await p.evaluate(async()=>{await designView.session.flush();await designView.leaf.detach();});await open();check('saved text style survives reopen',await p.evaluate(()=>designView.session.board.nodes.find(n=>n.id==='text').cardStyle==='sticky'));
 await select(['text','note']);await center('text');await showStyles();await styles.locator('[data-style="paper"]').click();await p.waitForTimeout(100);
 check('mixed text/note selection shares one picker',await p.evaluate(()=>designView.session.board.nodes.filter(n=>['text','note'].includes(n.id)).every(n=>n.cardStyle==='paper')));
 await p.evaluate(()=>{designView.session.change(b=>{b.nodes.find(n=>n.id==='text').locked=true;});designView.renderBoard();designView.renderSelectionTools();});check('locked mixed selection disables style changes',await styles.locator('button:not(:disabled)').count()===0);
 await p.evaluate(()=>{designView.session.change(b=>{delete b.nodes.find(n=>n.id==='text').locked;});});await select(['text']);await center('text');
 await p.locator('[data-id="text"] .ts-card-quick-fold').click();await p.waitForTimeout(100);await showStyles();await styles.locator('[data-style="index"]').click();await p.waitForTimeout(100);
 check('styling a folded text preserves content fold and connected child',await p.evaluate(()=>{const n=designView.session.board.nodes.find(n=>n.id==='text');return n.collapsed&&n.height===72&&n.cardStyle==='index'&&!!designView.positions.get('style-child');}));
 await p.locator('[data-id="text"] .ts-compact-unfold').click();await p.waitForTimeout(100);await center('text');
 await p.locator('[data-id="text"] .ts-branch-toggle').click();await p.waitForTimeout(100);check('styled text can fold its children separately',await p.locator('[data-id="style-child"]').count()===0);
 await p.locator('[data-id="text"] .ts-branch-toggle').click();await p.waitForTimeout(100);check('styled text restores its child',await p.evaluate(()=>!designView.session.board.nodes.find(n=>n.id==='text').branchFolded));
 // Both native editing and the source fallback retain the current draft/selection.
 for(const fallback of [false,true]){
  await center('text');await select(['text']);await p.evaluate(async fallback=>{const original=designView.app;try{if(fallback){designView.app=Object.create(original);Object.defineProperty(designView.app,'embedRegistry',{value:undefined});}await designView.startInlineEdit('text');}finally{designView.app=original;}window.editBefore=designView.inline.snapshot();},fallback);
  await p.locator('.ts-format-mode-button[data-mode="card"]').click();await styles.locator('[data-style="band"]').click();await p.waitForTimeout(100);
  check((fallback?'fallback':'native')+' editing retains text and selection on style change',await p.evaluate(()=>{const s=designView.inline.snapshot();return s.text===editBefore.text&&s.start===editBefore.start&&s.end===editBefore.end;}));
  await shot(fallback?'editor-fallback.png':'editor-native.png');await p.evaluate(()=>designView.inline.cancel());
 }
 await select(['wide']);await center('wide');await p.locator('[data-id="wide"] .ts-media-reference-source').waitFor();
 const source=p.locator('[data-id="wide"] .ts-media-reference-source');await source.focus();await p.keyboard.press('Enter');await p.waitForFunction(source=>app.workspace.activeLeaf?.view?.file?.path===source,fixture.source,{timeout:10000});
 check('source link opens the actual saved Markdown note',await p.evaluate(source=>app.workspace.activeLeaf?.view?.file?.path===source,fixture.source));await open();await center('wide');
 const href=await p.locator('[data-id="wide"] .ts-media-reference-time').getAttribute('href');
 await p.evaluate(()=>{document.addEventListener('click',event=>{if(event.target.closest?.('.ts-media-reference-time')){event.preventDefault();event.stopImmediatePropagation();}},{capture:true,once:true});});
 await p.locator('[data-id="wide"] .ts-media-reference-time').click();await p.evaluate(async href=>{await app.plugins.plugins.thoughtspace.openMediaPlayerSource(Object.fromEntries(new URL(href).searchParams));},href);await p.waitForTimeout(200);
 check('rendered timestamp resolves through native plugin handler to the same media/time',await p.evaluate(href=>{const u=new URL(href),view=app.workspace.getLeavesOfType('thoughtspace-media-player').find(l=>l.view.currentFile()?.path===u.searchParams.get('file'))?.view;return !!view&&Math.abs(view.currentPlayback().time-Number(u.searchParams.get('t')))<.2;},href));await open();
 const originalSource=await p.evaluate(async source=>app.vault.read(app.vault.getAbstractFileByPath(source)),fixture.source);
 await p.evaluate(async source=>{await app.vault.process(app.vault.getAbstractFileByPath(source),raw=>raw.replace('先观察镜头中的变化','原笔记更新的观察'));},fixture.source);await p.waitForFunction(()=>document.querySelector('[data-id="wide"] .callout-content')?.textContent.includes('原笔记更新的观察'));
 check('source refresh redecorates once and preserves live embed',await p.locator('[data-id="wide"] .ts-media-reference-source').count()===1);
 await p.evaluate(async({source,raw})=>app.vault.modify(app.vault.getAbstractFileByPath(source),raw),{source:fixture.source,raw:originalSource});
 for(const id of ['wide','portrait','square']){await center(id);await p.locator(`[data-id="${id}"] img`).waitFor();const ratio=await p.locator(`[data-id="${id}"] img`).evaluate(img=>{const r=img.getBoundingClientRect();return{display:r.width/r.height,natural:img.naturalWidth/img.naturalHeight,height:r.height};});check(id+' screenshot retains full aspect ratio',Math.abs(ratio.display-ratio.natural)<.02&&ratio.height<=241);}
 await select(['text']);await center('text');await showStyles();await shot('text-types-light.png');
 // Restore only test appearances for the presentation images, not node geometry.
 await p.evaluate(()=>{designView.session.change(b=>{for(const n of b.nodes.filter(n=>['note','text'].includes(n.id)))delete n.cardStyle;});});
 for(const theme of ['light','dark']){
  await p.evaluate(theme=>{document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');designView.appearanceExpanded=false;designView.renderSelectionTools();designView.session.board.viewport={x:20,y:80,zoom:.85};designView.renderBoard();},theme);await select(['wide']);await shot(`wide-${theme}.png`);
 }
 for(const width of [420,320]){
  await p.evaluate(width=>{designView.contentEl.style.width=width+'px';designView.contentEl.style.flex='none';},width);await select(['wide']);await center('wide');await p.evaluate(()=>{const n=designView.session.board.nodes.find(n=>n.id==='wide'),z=Math.min(1,(designView.stage.clientWidth-104)/n.width);designView.appearanceExpanded=false;designView.renderSelectionTools();designView.session.board.viewport={x:78-n.x*z,y:180-n.y*z,zoom:z};designView.renderBoard();});
  check(width+'px metadata stays inside its card',await p.locator('[data-id="wide"]').evaluate(e=>{const r=e.getBoundingClientRect(),links=[...e.querySelectorAll('.ts-media-reference-source,.ts-media-reference-time')];return links.length===2&&links.every(a=>{const b=a.getBoundingClientRect();const pane=designView.stage.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right&&b.left>=pane.left&&b.right<=pane.right;});}));
  await shot(`narrow-${width}-dark.png`);
 }
 await p.evaluate(()=>{designView.contentEl.style.removeProperty('width');designView.contentEl.style.removeProperty('flex');});
 check('all original content, geometry, formatting and edges remain intact',await p.evaluate(()=>visualBefore.every(old=>{const n=designView.session.board.nodes.find(n=>n.id===old.id);return ['id','kind','text','file','x','y','width','height','fontFamily','fontSize','textAlign','borderWidth','borderStyle'].every(k=>n[k]===old[k]);})&&JSON.stringify(designView.session.board.edges)===visualEdges));
 await p.evaluate(async()=>designView.session.flush());
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,scope:'Actual Obsidian temporary vault. Source link uses real keyboard activation. Timestamp click is intercepted to avoid OS dispatch into another vault, then passed to the actual plugin handler. Geometry/fixture setup uses controller; style/undo/redo/fold actions use actual UI.'},null,2));
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
