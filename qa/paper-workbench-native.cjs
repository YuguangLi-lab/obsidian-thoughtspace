// Native Obsidian validation against the isolated, already activated vault.
// Start the official host and activate the built plugin before running this file.
// This script uses real Playwright input; evaluation only reads host state,
// switches themes/window bounds, or resets disposable fixture content/camera.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.resolve(process.env.QA_OUTPUT || 'dist/paper-workbench-native');
const vault = '/workspace/.thoughtspace-native/vault';
const report = {scope:'Official native Obsidian in a disposable vault, real DOM pointer/keyboard input and CodeMirror editing. Theme, camera and fixture resets use host APIs. One explicitly controlled source fallback temporarily removes and immediately restores the native Markdown embed factory.',checks:[],screenshots:[],errors:[],warnings:[],controlledFallbackWarnings:[],geometry:[]};
function check(name, actual, expected = true) {
  let passed = true;
  try { assert.deepEqual(actual, expected); } catch { passed = false; }
  report.checks.push({name,passed,actual,expected});
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
}
let browser, page, original, originalNotes = {}, controlledFallback = false;
async function main() {
  await fs.mkdir(output,{recursive:true});
  browser = await chromium.connectOverCDP(process.env.OBSIDIAN_CDP || 'http://127.0.0.1:9222');
  page = browser.contexts()[0].pages().find(p => p.url().includes('app://obsidian.md'));
  assert.ok(page,'The official Obsidian renderer must already be running');
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='warning'&&/thoughtspace|inline|editor/i.test(message.text()))(controlledFallback?report.controlledFallbackWarnings:report.warnings).push(message.text());});
  await page.waitForFunction(()=>window.qaView?.session?.board&&app.plugins.plugins.thoughtspace,{},{timeout:20000});
  await page.bringToFront();
  await page.evaluate(()=>{require('@electron/remote').getCurrentWindow().focus();app.workspace.setActiveLeaf(qaView.leaf,{focus:true});qaView.stage.focus();});
  await page.waitForFunction(()=>document.hasFocus()&&require('@electron/remote').getCurrentWindow().isFocused(),{},{timeout:10000});
  report.runtime = await page.evaluate(()=>({version:require('@electron/remote').app.getVersion(),plugin:app.plugins.plugins.thoughtspace.manifest.version,vault:app.vault.adapter.basePath,board:qaView.file.path,hostFocused:require('@electron/remote').getCurrentWindow().isFocused(),documentFocused:document.hasFocus(),keyboardWindow:typeof activeWindow!=='undefined'&&activeWindow===window}));
  check('native runtime uses the isolated vault',report.runtime.vault,vault);
  assert.equal(report.runtime.vault,vault,'Writes are restricted to the disposable native QA vault');
  check('native host owns keyboard focus',report.runtime.hostFocused&&report.runtime.documentFocused&&report.runtime.keyboardWindow);
  report.build = {};
  for(const file of ['main.js','styles.css','manifest.json']) {
    const workspace=createHash('sha256').update(await fs.readFile(path.resolve(__dirname,'..',file))).digest('hex');
    const installed=createHash('sha256').update(await fs.readFile(path.join(vault,'.obsidian/plugins/thoughtspace',file))).digest('hex');
    report.build[file]={workspace,installed};check(`native installed ${file} matches the tested build`,installed,workspace);
  }
  original = await page.evaluate(()=>JSON.parse(JSON.stringify(qaView.session.board)));
  for (const node of original.nodes.filter(n=>n.kind==='card'&&n.file)) {
    if (!Object.hasOwn(originalNotes,node.file)) originalNotes[node.file] = await fs.readFile(path.join(vault,node.file),'utf8');
  }
  const note = original.nodes.find(n=>n.kind==='card'&&!n.locked&&!n.transparent&&(!n.fillColor||n.fillColor==='none')&&!n.cardStyle);
  const text = original.nodes.find(n=>n.kind==='text'&&!n.locked);
  const styled = original.nodes.find(n=>n.kind==='card'&&n.cardStyle);
  assert.ok(note&&text&&styled,'The fixture must contain a plain note, text and styled note');
  const saved=originalNotes[note.file]+'\n\n## 原生编辑验证\n\n纸张工作台中的 Markdown 草稿。\n\n- [ ] 通过工具栏与键盘保存';
  const root = page.locator('.ts-root.ts-paper-workbench').first();
  const node = id=>root.locator(`.ts-node[data-id="${id}"]`);
  const screenshot = async name=>{
    const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
    await page.mouse.move(viewport.width-2,viewport.height-2);await page.waitForTimeout(350);
    const file=path.join(output,`${name}.png`);await page.screenshot({path:file,caret:'initial'});report.screenshots.push(file);console.log(`SCREENSHOT ${file}`);
  };
  const settle = ()=>page.waitForTimeout(180);
  const focusHost = async()=>{await page.bringToFront();await page.evaluate(()=>require('@electron/remote').getCurrentWindow().focus());};
  const bounds = async (width,height=1000)=>{
    await page.evaluate(({width,height})=>{require('@electron/remote').getCurrentWindow().setBounds({x:20,y:20,width,height});app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();},{width,height});
    await settle();await focusHost();
  };
  const theme = async value=>{await page.evaluate(value=>{document.body.classList.toggle('theme-dark',value==='dark');document.body.classList.toggle('theme-light',value==='light');},value);await settle();};
  const reset = async()=>{
    await page.evaluate(board=>{
      qaView.inline?.cancel();qaView.clearCanvasGesture();qaView.selected.clear();qaView.selectedEdge=undefined;qaView.mode='select';qaView.selectionTool=false;qaView.appearanceTab='card';
      qaView.session.change(b=>Object.assign(b,JSON.parse(JSON.stringify(board))));qaView.renderBoard();qaView.updateSelection();app.workspace.setActiveLeaf(qaView.leaf,{focus:true});qaView.stage.focus();
    },original);await settle();
  };
  const frame = async id=>{
    await page.evaluate(id=>{
      qaView.inline?.cancel();qaView.selected.clear();qaView.selectedEdge=undefined;qaView.mode='select';qaView.selectionTool=false;
      const n=qaView.session.board.nodes.find(n=>n.id===id),zoom=Math.max(.35,Math.min(1,(qaView.stage.clientWidth-52)/n.width));
      qaView.session.board.viewport={x:(qaView.stage.clientWidth-n.width*zoom)/2-n.x*zoom,y:245-n.y*zoom,zoom};
      qaView.renderBoard();qaView.updateSelection();
    },id);await settle();
  };
  const clickNode = async id=>{
    const header=node(id).locator(':scope > .ts-node-header');
    const box=await (await header.count()&&await header.isVisible()?header:node(id)).boundingBox();assert.ok(box,`Visible node ${id}`);
    const point={x:box.x+box.width*.42,y:box.y+Math.min(15,box.height/2)};
    const hit=await page.evaluate(point=>{const target=document.elementFromPoint(point.x,point.y);return{id:target?.closest('.ts-node')?.dataset.id,tag:target?.tagName,classes:target?.className,viewport:{width:innerWidth,height:innerHeight}};},point);
    report.geometry.push({label:`pointer target ${id}`,point,box,hit});
    assert.equal(hit.id,id,`Real pointer coordinates must hit ${id} inside the native viewport`);
    await page.mouse.click(point.x,point.y);await settle();
  };
  const actionDock = async (id,label)=>{
    const actions=await node(id).locator('.ts-card-actions button').evaluateAll(buttons=>buttons.map(button=>{
      const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),main=button.closest('.ts-main').getBoundingClientRect();
      return{label:button.getAttribute('aria-label'),hit:hit===button||button.contains(hit),inBounds:r.x>=main.x-1&&r.right<=main.right+1&&r.y>=main.y-1&&r.bottom<=main.bottom+1,bounds:{x:r.x,y:r.y,width:r.width,height:r.height}};
    }));report.geometry.push({label:`${label} action dock`,actions});
    check(`${label}: quick action controls fit and receive pointer input`,actions.length>0&&actions.every(action=>action.hit&&action.inBounds));
  };
  const geometry = async label=>{
    const result=await root.evaluate(el=>{
      const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const main=el.querySelector('.ts-main'),m=rect(main),read=selector=>{const e=main.querySelector(selector);if(!e||e.hidden||getComputedStyle(e).display==='none')return null;return rect(e);};
      const workbench=read(':scope > .ts-workbench-bar'),rail=read(':scope > .ts-board-rail'),format=read(':scope > .ts-floating-formatbar'),footer=read(':scope > .ts-footer');
      const formatVisible=!!main.querySelector('.ts-selection-tools.is-visible');
      return{main:m,workbench,rail,format:formatVisible?format:null,footer,formatVisible,
        railInBounds:!!rail&&rail.x>=m.x-1&&rail.right<=m.right+1,
        formatInBounds:!formatVisible||!!format&&format.x>=m.x-1&&format.right<=m.right+1,
        workbenchRailSeparated:!workbench||!rail||workbench.bottom<=rail.y+1,
        railFormatSeparated:!formatVisible||!rail||!format||rail.right<=format.x+1||format.right<=rail.x+1,
        formatFooterSeparated:!formatVisible||!format||!footer||format.bottom<=footer.y+1,
        chromeHitTargets:[...main.querySelectorAll('.ts-board-rail button')].filter(b=>{const r=b.getBoundingClientRect(),area=b.closest('.ts-board-rail').getBoundingClientRect(),y=r.y+r.height/2;return r.width&&r.height&&r.x>=m.x&&r.right<=m.right&&y>=area.top+1&&y<=area.bottom-1;}).every(b=>{const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===b||b.contains(hit);})};
    });
    report.geometry.push({label,...result});
    for(const key of ['railInBounds','formatInBounds','railFormatSeparated','formatFooterSeparated','chromeHitTargets'])check(`${label}: ${key}`,result[key]);
  };
  const preservedSurfaces = async label=>{
    await page.evaluate(id=>{qaView.session.change(b=>{b.nodes.find(n=>n.id===id).fillColor='#d6a1bc';});qaView.renderBoard();},note.id);await settle();
    const actual=await page.evaluate(ids=>{
      const get=id=>qaView.positions.get(id),fill=get(ids.fill),styled=get(ids.styled);
      const style=getComputedStyle(fill),dark=document.body.classList.contains('theme-dark'),probe=document.createElement('span');
      probe.style.background=`color-mix(in srgb, var(--ts-card-fill) ${dark?20:38}%, var(--ts-surface))`;fill.append(probe);
      const expected=getComputedStyle(probe).backgroundColor;probe.remove();
      return{fill:getComputedStyle(fill).backgroundColor,expected,style:styled.dataset.cardStyle,fillChoice:qaView.session.board.nodes.find(n=>n.id===ids.fill).fillColor};
    },{fill:note.id,styled:styled.id});
    check(`${label}: authored fill remains model selected`,actual.fillChoice,'#d6a1bc');
    check(`${label}: authored fill remains visible`,actual.fill,actual.expected);
    check(`${label}: authored card style remains intact`,actual.style,styled.cardStyle);
    await page.evaluate(id=>{qaView.session.change(b=>{b.nodes.find(n=>n.id===id).transparent=true;});qaView.renderBoard();},note.id);await settle();
    check(`${label}: transparent note remains transparent`,await node(note.id).evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
    await page.evaluate(()=>{qaView.session.undo();qaView.session.undo();qaView.renderBoard();});await settle();
    check(`${label}: undo restores the authored surface`,await page.evaluate(id=>{const n=qaView.session.board.nodes.find(n=>n.id===id);return{fillColor:n.fillColor,transparent:n.transparent};},note.id),{fillColor:note.fillColor,transparent:note.transparent});
  };

  await bounds(1440);await theme('light');await reset();
  check('native canvas leaves editing space free of an extra header row',await root.locator('.ts-workbench-bar').count(),0);
  check('native creation toolbar is a vertical left rail',await root.locator('.ts-board-rail').evaluate(el=>el.getAttribute('aria-orientation')==='vertical'&&getComputedStyle(el.querySelector('.ts-rail-tools')).flexDirection==='column'));
  check('native left rail retains the quick card creation button',await root.locator('.ts-board-rail').getByRole('button',{name:'新建卡片',exact:true}).count(),1);
  await geometry('desktop light');await screenshot('desktop-light');
  await preservedSurfaces('light');
  await root.getByRole('button',{name:'插入内容',exact:true}).click();await settle();
  check('Insert palette opens through the real toolbar',await root.locator('.ts-insert-palette').isVisible());
  check('Insert palette keeps eleven insert actions',await root.locator('.ts-insert-palette .ts-insert-tile').count(),11);
  await screenshot('insert-palette');await page.keyboard.press('Escape');
  check('Escape closes Insert palette',await root.locator('.ts-insert-palette').isVisible(),false);
  await root.getByRole('button',{name:'更多白板工具',exact:true}).click();await settle();
  check('More palette opens through the real toolbar',await root.locator('.ts-tools-palette').isVisible());
  await screenshot('more-palette');await page.keyboard.press('Escape');
  check('Escape closes More palette',await root.locator('.ts-tools-palette').isVisible(),false);
  await root.getByRole('button',{name:'更多白板工具',exact:true}).click();await page.keyboard.press('Escape');
  check('closing palette returns native keyboard focus to its toolbar trigger',await page.evaluate(()=>!!document.activeElement?.closest('.ts-board-rail')));
  await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
  check('toolbar arrow key moves focus with a visible outline',await root.evaluate(el=>{const active=document.activeElement,s=getComputedStyle(active);return !!el.querySelector('.ts-board-rail')?.contains(active)&&active.matches(':focus-visible')&&parseFloat(s.outlineWidth)>=2;}));
  await reset();await frame(note.id);await clickNode(note.id);
  check('real pointer click selects the note',await page.evaluate(()=>[...qaView.selected]),[note.id]);
  await actionDock(note.id,'selected native note');
  await geometry('selected note');await screenshot('selected-note');
  await root.getByRole('button',{name:'文字样式',exact:true}).click();
  const size=root.getByRole('combobox',{name:'字号',exact:true});
  check('text appearance controls are real native selects',await size.count(),1);
  await size.selectOption('18');await settle();
  check('native select changes the selected note size',await page.evaluate(id=>qaView.session.board.nodes.find(n=>n.id===id).fontSize,note.id),18);
  await frame(text.id);await clickNode(text.id);
  check('real pointer click selects the text object',await page.evaluate(()=>[...qaView.selected]),[text.id]);
  await geometry('selected text');await screenshot('selected-text');
  await reset();
  // Pan the real fixture below the context toolbar before pointer selection.
  // The authored heading starts near the top, where contextual UI can cover it.
  await page.evaluate(ids=>{
    const nodes=qaView.session.board.nodes.filter(n=>ids.includes(n.id)),left=Math.min(...nodes.map(n=>n.x)),top=Math.min(...nodes.map(n=>n.y)),right=Math.max(...nodes.map(n=>n.x+n.width)),bottom=Math.max(...nodes.map(n=>n.y+n.height));
    const zoom=Math.min(1,(qaView.stage.clientWidth-80)/(right-left),(qaView.stage.clientHeight-435)/(bottom-top));
    qaView.session.board.viewport={zoom,x:40-left*zoom,y:335-top*zoom};qaView.renderBoard();
  },[note.id,text.id]);await settle();
  await clickNode(note.id);check('multi-select setup first real click selects the note',await page.evaluate(()=>[...qaView.selected]),[note.id]);
  await page.keyboard.down('Shift');await clickNode(text.id);await page.keyboard.up('Shift');
  check('Shift click selects note and text',await page.evaluate(()=>[...qaView.selected].sort()),[note.id,text.id].sort());
  await geometry('multi-selection');await screenshot('multi-selection');

  await bounds(760);await frame(note.id);await clickNode(note.id);
  controlledFallback = true;
  await page.evaluate(()=>{window.qaSavedMdFactory=app.embedRegistry.embedByExtension.md;delete app.embedRegistry.embedByExtension.md;});
  try {
    await root.getByRole('button',{name:'编辑 Markdown',exact:true}).click();
    await node(note.id).locator('.ts-inline-input').waitFor({state:'visible'});
  } finally {
    await page.evaluate(()=>{app.embedRegistry.embedByExtension.md=window.qaSavedMdFactory;delete window.qaSavedMdFactory;});
    controlledFallback = false;
  }
  check('controlled missing-native-API case opens a source editor',await page.evaluate(()=>!!qaView.inline?.fallback&&!qaView.inline?.native));
  const fallbackSaved=saved+'\n\n受控源码编辑验证。';
  await node(note.id).locator('.ts-inline-input').fill(fallbackSaved);await screenshot('controlled-source-fallback');
  await root.locator('.ts-inline-chrome').getByRole('button',{name:'保存并退出编辑 · Ctrl / ⌘ + Enter',exact:true}).click();
  await page.waitForFunction(()=>!qaView.inline,{},{timeout:10000});
  check('controlled source fallback saves actual Markdown',await fs.readFile(path.join(vault,note.file),'utf8'),fallbackSaved);
  check('native Markdown embed factory is restored after controlled fallback',await page.evaluate(()=>typeof app.embedRegistry.embedByExtension.md==='function'));
  check('controlled fallback reports its expected native-API warning',report.controlledFallbackWarnings.length===1&&report.controlledFallbackWarnings[0].includes('live editor unavailable'));
  await bounds(1440);await reset();
  await frame(note.id);await clickNode(note.id);await root.getByRole('button',{name:'编辑 Markdown',exact:true}).click();
  const cm=node(note.id).locator('.ts-inline-native .cm-content');
  await cm.waitFor({state:'visible'});
  check('actual Obsidian CodeMirror editor is active',await page.evaluate(()=>!!qaView.inline?.native?.engine?.cm&&!qaView.inline?.fallback));
  await cm.click();await page.keyboard.press('Control+a');await page.keyboard.insertText(saved);await settle();
  check('real keyboard changes the native Markdown draft',await page.evaluate(()=>qaView.inline.input.value),saved);
  await page.keyboard.press('Control+Home');await settle();
  const editorStart=await page.evaluate(()=>{
    const cm=qaView.inline.native.engine.cm,head=cm.state.selection.main.head,caret=cm.coordsAtPos(head),scroller=cm.scrollDOM.getBoundingClientRect(),line=cm.contentDOM.querySelector('.cm-line'),range=document.createRange();range.selectNodeContents(line);const ink=range.getBoundingClientRect();
    return{head,focused:cm.hasFocus,scrollTop:cm.scrollDOM.scrollTop,caret,ink:{top:ink.top,bottom:ink.bottom},scroller:{top:scroller.top,bottom:scroller.bottom},visible:cm.hasFocus&&head===0&&!!caret&&caret.top>=scroller.top-1&&caret.bottom<=scroller.bottom+1&&ink.bottom>scroller.top&&ink.top<scroller.bottom};
  });report.geometry.push({label:'native editor first caret and line',...editorStart});
  check('native editor can reveal its first line and caret',editorStart.visible);
  await screenshot('editor');
  await page.keyboard.press('Control+Enter');await page.waitForFunction(()=>!qaView.inline,{},{timeout:10000});
  check('Ctrl+Enter saves actual Markdown note',await fs.readFile(path.join(vault,note.file),'utf8'),saved);
  await root.getByRole('button',{name:'编辑 Markdown',exact:true}).click();await cm.waitFor({state:'visible'});
  await cm.click();await page.keyboard.press('Control+a');await page.keyboard.insertText('这一段只属于取消的草稿');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!qaView.inline,{},{timeout:10000});
  check('Escape cancels native edit without changing the note',await fs.readFile(path.join(vault,note.file),'utf8'),saved);
  await frame(text.id);await clickNode(text.id);await root.getByRole('button',{name:'编辑 Markdown',exact:true}).click();
  const textCm=node(text.id).locator('.ts-inline-native .cm-content');await textCm.waitFor({state:'visible'});
  await textCm.click();await page.keyboard.press('Control+a');await page.keyboard.insertText('真实文本编辑');
  await root.locator('.ts-inline-chrome').getByRole('button',{name:'保存并退出编辑 · Ctrl / ⌘ + Enter',exact:true}).click();
  await page.waitForFunction(()=>!qaView.inline,{},{timeout:10000});
  check('native text Save button commits the board text',await page.evaluate(id=>qaView.session.board.nodes.find(n=>n.id===id).text,text.id),'真实文本编辑');

  await reset();await page.locator('.side-dock-ribbon-action[aria-label="ThoughtSpace 侧边栏"]').click();await settle();
  const dock=page.locator('.ts-root.ts-dock').first();await dock.locator('.ts-search').waitFor({state:'visible'});
  await dock.getByRole('tab',{name:'卡片',exact:true}).click();await settle();
  await dock.locator('.ts-search').fill(path.basename(note.file,'.md'));await settle();
  check('material library opens and searches actual vault notes',await dock.locator('.ts-library-card').count()>0);
  await screenshot('materials');await dock.locator('.ts-search').press('Escape');
  check('Escape clears material library search',await dock.locator('.ts-search').inputValue(),'');
  await page.evaluate(()=>{app.workspace.leftSplit.collapse();app.workspace.setActiveLeaf(qaView.leaf,{focus:true});});await settle();
  await page.locator('.ts-native-header .ts-header-action[aria-label="搜索白板"]').first().click();
  await page.locator('.ts-board-search').waitFor({state:'visible'});
  await page.getByRole('searchbox',{name:'搜索白板内容',exact:true}).fill(note.title||path.basename(note.file,'.md'));await settle();
  check('native board search has matching results',await page.locator('.ts-board-search-row').count()>0);
  await screenshot('search');await page.keyboard.press('Escape');
  check('Escape closes native board search',await page.locator('.ts-board-search').count(),0);

  await bounds(1440);await theme('dark');await reset();await geometry('desktop dark');await preservedSurfaces('dark');await screenshot('desktop-dark');
  for(const width of [760,320]) {
    await bounds(width);await theme('light');await reset();await frame(note.id);await screenshot(`narrow-${width}-unselected`);await clickNode(note.id);
    await geometry(`native window ${width}`);await screenshot(`narrow-${width}`);
    await actionDock(note.id,`native window ${width}`);
    if(width===320) {
      check('native window 320: contextual toolbar reserves editing space',await root.locator('.ts-floating-formatbar').evaluate(el=>el.getBoundingClientRect().height<=280));
      const options=await root.locator('.ts-card-style-picker > button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),label=button.querySelector('.ts-card-style-name');return{style:button.dataset.style,width:r.width,visible:r.width>0&&r.height>0,hit:hit===button||button.contains(hit),labelFits:!!label&&label.scrollWidth<=label.clientWidth};}));
      check('native window 320: all six card styles remain visible and clickable',options.length===6&&options.every(option=>option.visible&&option.hit));
      check('native window 320: card styles have readable full labels',options.length===6&&options.every(option=>option.width>=70&&option.labelFits));
      report.geometry.push({label:'native window 320 card styles',options});
    }
    await root.getByRole('button',{name:'插入内容',exact:true}).click();await settle();
    check(`native window ${width}: Insert palette fits canvas`,await root.locator('.ts-insert-palette').evaluate(el=>{const r=el.getBoundingClientRect(),m=el.closest('.ts-main').getBoundingClientRect();return r.x>=m.x-1&&r.right<=m.right+1&&r.bottom<=m.bottom+1;}));
    await screenshot(`narrow-${width}-insert`);await page.keyboard.press('Escape');
    await root.getByRole('button',{name:'编辑 Markdown',exact:true}).click();await cm.waitFor({state:'visible'});
    check(`native window ${width}: editor actions stay within canvas`,await root.locator('.ts-inline-chrome .ts-inline-editor-bar').evaluate(el=>{const r=el.getBoundingClientRect(),m=el.closest('.ts-main').getBoundingClientRect();return r.x>=m.x-1&&r.right<=m.right+1&&r.y>=m.y-1&&r.bottom<=m.bottom+1;}));
    await screenshot(`narrow-${width}-editor`);await page.keyboard.press('Escape');await page.waitForFunction(()=>!qaView.inline);
  }
  await bounds(640,300);await theme('light');await geometry('native short window 640x300');
  const shortFormat=root.locator('.ts-floating-formatbar'),shortHeading=shortFormat.locator('.ts-format-heading button').first();
  let shortRect=await shortFormat.boundingBox();assert.ok(shortRect);
  check('native short window: context toolbar remains at least 36 px high',shortRect.height>=36);
  const centerHit=async control=>control.evaluate(button=>{
    const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),p=button.closest('.ts-floating-formatbar').getBoundingClientRect();
    return{hit:hit===button||button.contains(hit),fullyVisible:r.x>=p.x-1&&r.right<=p.right+1&&r.y>=p.y-1&&r.bottom<=p.bottom+1,style:button.dataset.style,controlLabel:button.getAttribute('aria-label'),bounds:{x:r.x,y:r.y,width:r.width,height:r.height}};
  });
  const headingHit=await centerHit(shortHeading);report.geometry.push({label:'short native heading hit',...headingHit});
  check('native short window: a mode control receives pointer input',headingHit.hit);
  await screenshot('short-640x300');
  const firstStyle=shortFormat.locator('.ts-card-style-option').first();
  check('native short window 640: format parameters are already visible', (await centerHit(firstStyle)).hit);
  await bounds(640,220);await geometry('native short window 640x220');await screenshot('short-640x220');
  check('native minimum-height window: context retains a 36 px control area',await shortFormat.evaluate(el=>el.getBoundingClientRect().height>=36));
  check('native minimum-height window: a mode control remains clickable',(await centerHit(shortHeading)).hit);
  // A 640 px pane naturally fits one style row. Use an actual 320x300 native
  // window to exercise vertical overflow rather than demanding fictitious scroll.
  await bounds(320,300);await geometry('native short window 320x300');await screenshot('short-320x300');
  shortRect=await shortFormat.boundingBox();assert.ok(shortRect);
  check('native short window 320: context retains a usable scroll area',shortRect.height>=36&&await shortFormat.evaluate(el=>el.scrollHeight>el.clientHeight));
  check('native short window 320: style controls fit the parameter column',await shortFormat.locator('.ts-card-style-option').evaluateAll(buttons=>buttons.every(button=>{const r=button.getBoundingClientRect(),p=button.closest('.ts-floating-formatbar').getBoundingClientRect();return r.x>=p.x-1&&r.right<=p.right+1;})));
  const finalStyle=shortFormat.locator('.ts-card-style-option').last();
  await page.mouse.move(shortRect.x+shortRect.width/2,shortRect.y+shortRect.height/2);
  const scrollBefore=await shortFormat.evaluate(el=>el.scrollTop);
  for(let step=0;step<24&&!(await centerHit(finalStyle)).fullyVisible;step++){await page.mouse.wheel(0,12);await page.waitForTimeout(70);}
  const fieldHit=await centerHit(finalStyle),scrollAfter=await shortFormat.evaluate(el=>el.scrollTop);
  report.geometry.push({label:'short native wheel reveals parameter',scrollBefore,scrollAfter,...fieldHit});
  check('native short window: real wheel reveals a format parameter',fieldHit.hit&&fieldHit.fullyVisible&&scrollAfter>scrollBefore);
  // Playwright focuses this genuine native control before delivering End/Home;
  // focus is not synthesized at the OS/window level (verified at startup).
  await firstStyle.press('End');await settle();
  check('native short window: keyboard reaches the final format action',await shortFormat.evaluate(el=>{const b=document.activeElement,r=b.getBoundingClientRect(),p=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el.contains(b)&&b.getAttribute('aria-label')==='复制对象样式'&&(hit===b||b.contains(hit))&&r.x>=p.x-1&&r.right<=p.right+1&&r.y>=p.y-1&&r.bottom<=p.bottom+1;}));
  await page.keyboard.press('Home');await settle();
  const keyboardHit=await centerHit(firstStyle);report.geometry.push({label:'short native keyboard reveals first parameter',...keyboardHit});
  check('native short window: keyboard reveals the first style parameter',keyboardHit.hit&&keyboardHit.fullyVisible&&await firstStyle.evaluate(el=>document.activeElement===el&&el.matches(':focus-visible')));
  await screenshot('short-320x300-parameters');
  await bounds(640,300);
  const shortRail=root.locator('.ts-board-rail');
  check('native short window: left rail supports vertical scrolling',await shortRail.evaluate(el=>el.scrollHeight>el.clientHeight&&/auto|scroll/.test(getComputedStyle(el).overflowY)));
  await shortRail.getByRole('button',{name:'更多白板工具',exact:true}).click();await page.keyboard.press('Escape');
  await page.keyboard.press('Home');await settle();
  check('native short window: keyboard reveals the first rail tool',await shortRail.evaluate(el=>{const b=document.activeElement,r=b.getBoundingClientRect(),a=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el.contains(b)&&b.getAttribute('aria-label')==='框选'&&r.y+r.height/2>=a.y&&r.y+r.height/2<=a.bottom&&(hit===b||b.contains(hit));}));
  await page.keyboard.press('End');await settle();
  check('native short window: keyboard reveals the last rail tool',await shortRail.evaluate(el=>{const b=document.activeElement,r=b.getBoundingClientRect(),a=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el.contains(b)&&b.getAttribute('aria-label')==='更多白板工具'&&r.y+r.height/2>=a.y&&r.y+r.height/2<=a.bottom&&el.scrollTop>0&&(hit===b||b.contains(hit));}));
  await screenshot('short-640x300-rail-end');
  await bounds(1440);await theme('light');await reset();
  await page.evaluate(()=>{qaView.session.change(b=>{b.nodes=[];b.edges=[];});qaView.selected.clear();qaView.renderBoard();});await settle();
  check('empty native board displays the designed onboarding',await root.locator('.ts-start-screen').isVisible());
  await geometry('empty board');await screenshot('empty');
  await root.locator('.ts-start-screen').getByRole('button',{name:'写下想法',exact:true}).click();
  await page.waitForFunction(()=>!!qaView.inline,{},{timeout:10000});
  check('empty-board primary action opens a native text editor',await root.locator('.ts-inline-native .cm-content').count(),1);
  await page.keyboard.press('Escape');await reset();
  await page.evaluate(()=>qaView.session.flush());
  check('native renderer reports no uncaught errors',report.errors,[]);
  check('native live editor reports no fallback or layout warnings',report.warnings,[]);
}
main().catch(async error=>{report.failure={message:error.message,stack:error.stack};console.error(error);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}).finally(async()=>{
  if(page&&original) {
    await page.evaluate(async ({board,notes})=>{
      if(window.qaSavedMdFactory){app.embedRegistry.embedByExtension.md=window.qaSavedMdFactory;delete window.qaSavedMdFactory;}
      qaView.inline?.cancel();for(const [file,content] of Object.entries(notes))await app.vault.modify(app.vault.getAbstractFileByPath(file),content);
      qaView.session.change(b=>Object.assign(b,board));qaView.selected.clear();qaView.updateSelection();qaView.renderBoard();await qaView.session.flush();
    },{board:original,notes:originalNotes}).catch(error=>{report.restoreFailure=error.message;process.exitCode=1;});
  }
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  const failed=report.checks.filter(c=>!c.passed);if(failed.length)process.exitCode=1;
  console.log(JSON.stringify({passed:report.checks.length-failed.length,failed:failed.length,screenshots:report.screenshots.length,output,failure:report.failure?.message}));
  if(browser)await browser.close();
});
