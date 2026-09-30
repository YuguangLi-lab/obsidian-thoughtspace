// Run after activate-plugin.mjs has freshly activated the build in the isolated
// native QA vault. The controlled source cases run before the first successful
// native editor discovery because its constructor is cached for the App lifetime.
// Pointer and keyboard operations use Playwright against official Obsidian;
// host evaluation is restricted to observation, focus, themes and fixture resets.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const output = path.resolve(process.env.QA_OUTPUT || 'dist/deep-debug-native');
const vault = '/workspace/.thoughtspace-native/vault';
const report = {
  scope:'Official Obsidian in the disposable native QA vault. Real pointer/keyboard input verifies actual CodeMirror and textarea drafts, detached format controls and Markdown persistence. Missing-native-API cases temporarily remove and immediately restore the Markdown embed factory before native constructor discovery.',
  checks:[],screenshots:[],errors:[],warnings:[],controlledFallbackWarnings:[],geometry:[],
};
let browser, page, original, originalBoardPath, controlledFallback = false;
const originalNotes = {};
// Additional scenarios must register their newly created, disposable vault
// files here immediately. Restoration removes these files without using trash.
const generatedFiles = new Set();

function check(name, actual, expected = true) {
  let passed = true;
  try { assert.deepEqual(actual,expected); } catch { passed = false; }
  report.checks.push({name,passed,actual,expected});
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
}
function fixturePath(file) {
  assert.equal(typeof file,'string');
  const absolute = path.resolve(vault,file);
  assert.ok(absolute.startsWith(vault + path.sep),'Fixture file must be contained in the disposable vault');
  return absolute;
}

async function main() {
  await fs.mkdir(output,{recursive:true});
  browser = await chromium.connectOverCDP(process.env.OBSIDIAN_CDP || 'http://127.0.0.1:9222');
  page = browser.contexts()[0].pages().find(candidate=>candidate.url().includes('app://obsidian.md'));
  assert.ok(page,'The official Obsidian renderer must already be running');
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&message.text().includes('[ThoughtSpace]'))report.errors.push(message.text());
    if(message.type()==='warning'&&/thoughtspace|inline|editor/i.test(message.text())) {
      (controlledFallback?report.controlledFallbackWarnings:report.warnings).push(message.text());
    }
  });
  await page.waitForFunction(()=>window.qaView?.session?.board&&app.plugins.plugins.thoughtspace,{},{timeout:20000});
  await page.bringToFront();
  await page.evaluate(()=>{
    require('@electron/remote').getCurrentWindow().focus();
    app.workspace.setActiveLeaf(qaView.leaf,{focus:true});qaView.stage.focus();
  });
  await page.waitForFunction(()=>document.hasFocus()&&require('@electron/remote').getCurrentWindow().isFocused(),{},{timeout:10000});
  await page.waitForTimeout(250);
  report.runtime = await page.evaluate(()=>({
    version:require('@electron/remote').app.getVersion(),plugin:app.plugins.plugins.thoughtspace.manifest.version,
    vault:app.vault.adapter.basePath,board:qaView.file.path,
    hostFocused:require('@electron/remote').getCurrentWindow().isFocused(),documentFocused:document.hasFocus(),
    keyboardWindow:typeof activeWindow!=='undefined'&&activeWindow===window,
  }));
  check('native runtime uses the isolated vault',report.runtime.vault,vault);
  assert.equal(report.runtime.vault,vault,'All writes and restoration require the disposable native QA vault');
  check('native host owns keyboard focus',report.runtime.hostFocused&&report.runtime.documentFocused&&report.runtime.keyboardWindow);
  assert.equal(report.runtime.hostFocused&&report.runtime.documentFocused&&report.runtime.keyboardWindow,true);
  report.build = {};
  for(const file of ['main.js','styles.css','manifest.json']) {
    const workspace=createHash('sha256').update(await fs.readFile(path.resolve(__dirname,'..',file))).digest('hex');
    const installed=createHash('sha256').update(await fs.readFile(path.join(vault,'.obsidian/plugins/thoughtspace',file))).digest('hex');
    report.build[file]={workspace,installed};check(`native installed ${file} matches the tested build`,installed,workspace);
    assert.equal(installed,workspace,'Native validation must run the current workspace build');
  }
  // Flush the disposable fixture before capturing it, then restore the same
  // board and every referenced Markdown note even when a scenario fails.
  await page.evaluate(()=>qaView.session.flush());
  originalBoardPath=report.runtime.board;fixturePath(originalBoardPath);
  original=await page.evaluate(()=>JSON.parse(JSON.stringify(qaView.session.board)));
  for(const item of original.nodes.filter(item=>item.kind==='card'&&item.file)) {
    if(!Object.hasOwn(originalNotes,item.file))originalNotes[item.file]=await fs.readFile(fixturePath(item.file),'utf8');
  }
  const note=original.nodes.find(item=>item.kind==='card'&&!item.locked&&item.file&&!item.webUrl);
  assert.ok(note,'The disposable fixture must contain an editable Markdown card');
  const root=page.locator('.ts-root.ts-paper-workbench').first();
  const node=id=>root.locator(`.ts-node[data-id="${id}"]`);
  const settle=()=>page.waitForTimeout(250);
  const focusHost=async()=>{
    await page.bringToFront();await page.evaluate(()=>require('@electron/remote').getCurrentWindow().focus());await settle();
  };
  const bounds=async(width,height=1000)=>{
    await page.evaluate(({width,height})=>{
      require('@electron/remote').getCurrentWindow().setBounds({x:20,y:20,width,height});
      app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();
    },{width,height});await focusHost();
  };
  const theme=async value=>{
    await page.evaluate(value=>{
      document.body.classList.toggle('theme-dark',value==='dark');document.body.classList.toggle('theme-light',value==='light');
    },value);await settle();
  };
  const reset=async()=>{
    await page.evaluate(board=>{
      qaView.inline?.cancel();qaView.clearCanvasGesture();qaView.selected.clear();qaView.selectedEdge=undefined;
      qaView.mode='select';qaView.selectionTool=false;qaView.appearanceTab='card';
      qaView.session.change(current=>{for(const key of Object.keys(current))if(!Object.hasOwn(board,key))delete current[key];Object.assign(current,JSON.parse(JSON.stringify(board)));});
      qaView.renderBoard();qaView.updateSelection();app.workspace.setActiveLeaf(qaView.leaf,{focus:true});qaView.stage.focus();
    },original);await settle();
  };
  const frame=async id=>{
    await page.evaluate(id=>{
      qaView.inline?.cancel();qaView.selected.clear();qaView.selectedEdge=undefined;qaView.mode='select';qaView.selectionTool=false;
      const item=qaView.session.board.nodes.find(item=>item.id===id);
      const zoom=Math.max(.35,Math.min(1,(qaView.stage.clientWidth-100)/item.width));
      qaView.session.board.viewport={x:(qaView.stage.clientWidth-item.width*zoom)/2-item.x*zoom,y:245-item.y*zoom,zoom};
      qaView.renderBoard();qaView.updateSelection();
    },id);await settle();
  };
  const clickNode=async id=>{
    const header=node(id).locator(':scope > .ts-node-header');
    const target=await header.count()&&await header.isVisible()?header:node(id);
    const box=await target.boundingBox();assert.ok(box,`Visible node ${id}`);
    const point={x:box.x+box.width*.42,y:box.y+Math.min(15,box.height/2)};
    const hit=await page.evaluate(point=>{
      const element=document.elementFromPoint(point.x,point.y);
      return{id:element?.closest('.ts-node')?.dataset.id,tag:element?.tagName,classes:element?.className};
    },point);
    report.geometry.push({label:`pointer target ${id}`,point,box,hit});
    assert.equal(hit.id,id,'Real pointer coordinates must hit the intended node');
    await page.mouse.click(point.x,point.y);await settle();
  };
  const screenshot=async name=>{
    const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
    await page.mouse.move(viewport.width-2,viewport.height-2);await settle();
    const file=path.join(output,`${name}.png`);await page.screenshot({path:file,caret:'initial'});
    report.screenshots.push(file);console.log(`SCREENSHOT ${file}`);
  };
  const openNoteEditor=async fallback=>{
    await frame(note.id);await clickNode(note.id);
    const edit=node(note.id).locator('.ts-card-actions').getByRole('button',{name:'编辑笔记',exact:true});
    // The visible caption is “编辑”; its accessible name is “编辑笔记”.
    if(fallback) {
      controlledFallback=true;
      await page.evaluate(()=>{
        if(Object.hasOwn(window,'qaDeepSavedMdFactory'))throw Error('A prior controlled fallback was not restored');
        window.qaDeepSavedMdFactory=app.embedRegistry.embedByExtension.md;
        delete app.embedRegistry.embedByExtension.md;
      });
      try {
        await edit.click();await node(note.id).locator('.ts-inline-input').waitFor({state:'visible',timeout:10000});
      } finally {
        await page.evaluate(()=>{
          if(Object.hasOwn(window,'qaDeepSavedMdFactory')) {
            app.embedRegistry.embedByExtension.md=window.qaDeepSavedMdFactory;delete window.qaDeepSavedMdFactory;
          }
        });controlledFallback=false;
      }
    } else {
      await edit.click();await node(note.id).locator('.ts-inline-native .cm-content').waitFor({state:'visible',timeout:10000});
    }
    await settle();
    check(`${fallback?'source':'native'} editor owns the note draft`,await page.evaluate(({id,fallback})=>
      qaView.inlineId===id&&!!qaView.inline&&!!qaView.inline.fallback===fallback&&!!qaView.inline.native!==fallback,
    {id:note.id,fallback}));
    return fallback?node(note.id).locator('.ts-inline-input'):node(note.id).locator('.ts-inline-native .cm-content');
  };
  const editDraft=async(input,value,label)=>{
    await input.click();await page.keyboard.press('Control+a');await page.keyboard.insertText(value);await settle();
    check(`${label}: real keyboard changes the draft`,await page.evaluate(()=>qaView.inline.input.value),value);
  };
  const saveFromFormatControl=async(control,value,label)=>{
    await control.focus();await settle();
    const state=await control.evaluate(element=>({
      focused:document.activeElement===element,
      insideFormat:!!element.closest('.ts-floating-formatbar'),
      outsideDraft:!qaView.inline?.ownsFocus(element),draftOpen:!!qaView.inline,
      pending:!!qaView.inline?.saving,value:qaView.inline?.input.value,
    }));report.geometry.push({label:`${label}: detached format focus`,...state});
    check(`${label}: focus stays in detached formatting controls`,state.focused&&state.insideFormat&&state.outsideDraft&&state.draftOpen&&!state.pending);
    check(`${label}: focus retains the unsaved draft`,state.value,value);
    await screenshot(`${label}-before-save`);
    await page.keyboard.press('Control+Enter');
    await page.waitForFunction(()=>!qaView.inline,{},{timeout:10000});
    check(`${label}: Ctrl+Enter exits editing`,await page.evaluate(()=>!qaView.inline));
    check(`${label}: Ctrl+Enter persists actual Markdown`,await fs.readFile(fixturePath(note.file),'utf8'),value);
    await screenshot(`${label}-after-save`);
  };

  await bounds(1440);await theme('light');await reset();
  // Successful discovery caches the native constructor, so both controlled
  // missing-API cases precede every genuine CodeMirror editor in this script.
  for(const panel of ['heading','appearance']) {
    const label=`source-${panel}`,value=originalNotes[note.file]+`\n\n## 深度调试：${label}\n\n格式栏焦点下保存的源码草稿。`;
    const input=await openNoteEditor(true);await editDraft(input,value,label);
    let control=root.locator('.ts-floating-formatbar select[aria-label="标题"]');
    if(panel==='appearance') {
      await root.locator('.ts-floating-formatbar button[data-mode="text"]').click();await settle();
      control=root.locator('.ts-floating-formatbar select[aria-label="字号"]');
    }
    await saveFromFormatControl(control,value,label);
    check(`${label}: native Markdown factory is restored`,await page.evaluate(()=>typeof app.embedRegistry.embedByExtension.md==='function'));
  }
  check('controlled source editors report exactly their expected discovery warnings',
    report.controlledFallbackWarnings.length===2&&report.controlledFallbackWarnings.every(message=>message.includes('live editor unavailable')));

  for(const panel of ['heading','appearance']) {
    const label=`native-${panel}`,value=originalNotes[note.file]+`\n\n## 深度调试：${label}\n\n格式栏焦点下保存的实时预览草稿。`;
    const input=await openNoteEditor(false);await editDraft(input,value,label);
    check(`${label}: actual Obsidian CodeMirror owns editing`,await page.evaluate(()=>
      !!qaView.inline?.native?.engine?.cm&&qaView.inline.native.engine.cm.hasFocus&&!qaView.inline.fallback));
    let control=root.locator('.ts-floating-formatbar select[aria-label="标题"]');
    if(panel==='appearance') {
      await root.locator('.ts-floating-formatbar button[data-mode="text"]').click();await settle();
      control=root.locator('.ts-floating-formatbar select[aria-label="字号"]');
    }
    await saveFromFormatControl(control,value,label);
  }

  // Hold one no-op frame marker to put two genuine pointer moves in the same
  // pending render batch. No pointer handler or geometry calculation is mocked.
  report.controlledFrameHolds='A native no-op requestAnimationFrame marker holds the view pointer queue until the actual pointerup flushes it.';
  const holdPointerFrame=()=>page.evaluate(()=>{
    if(qaView.pointerFrame)throw Error('A previous pointer frame is still pending');
    qaView.pointerFrame=requestAnimationFrame(()=>{});
  });
  const blankPoint=async()=>page.evaluate(()=>{
    const r=qaView.stage.getBoundingClientRect();
    for(const offset of [180,260,340]) {
      const point={x:r.right-140,y:r.bottom-offset},hit=document.elementFromPoint(point.x,point.y);
      if(hit===qaView.stage||hit===qaView.world||hit===qaView.svg)return point;
    }
    throw Error('A blank native canvas point is required');
  });
  await bounds(1440);await reset();
  let point=await blankPoint();
  await page.mouse.move(point.x,point.y);await page.mouse.down({button:'right'});
  check('right drag starts through actual pointer input',await page.evaluate(()=>!!qaView.rightMarquee));
  await holdPointerFrame();
  await page.mouse.move(point.x+35,point.y+20);await page.mouse.move(point.x,point.y);
  check('right drag retains its crossed threshold before the frame flush',await page.evaluate(()=>!!qaView.rightMarquee?.crossedThreshold));
  await page.mouse.up({button:'right'});await settle();
  check('same-frame right drag does not open a click menu',await page.evaluate(()=>!qaView.contextOpen),true);
  check('same-frame right drag cleans up its pointer state',await page.evaluate(()=>!qaView.rightMarquee&&!qaView.marquee&&!qaView.pointerFrame),true);
  check('same-frame right drag leaves object geometry intact',await page.evaluate(()=>qaView.session.board.nodes),original.nodes);

  await reset();await frame(note.id);await clickNode(note.id);
  const port=node(note.id).locator('.ts-connect-port[data-side="right"]');
  await port.waitFor({state:'visible'});const portBounds=await port.boundingBox();
  point={x:portBounds.x+portBounds.width/2,y:portBounds.y+portBounds.height/2};
  await page.mouse.move(point.x,point.y);await page.mouse.down();
  check('connection port starts a native drag',await page.evaluate(()=>!!qaView.linkDrag));
  await holdPointerFrame();await page.mouse.move(point.x+35,point.y+20);await page.mouse.move(point.x,point.y);
  check('same-frame connection drag retains its movement',await page.evaluate(()=>!!qaView.linkDrag?.moved));
  await page.mouse.up();await settle();
  check('same-frame connection drag clears its pending gesture',await page.evaluate(()=>!qaView.linkDrag&&!qaView.pointerFrame));
  check('connection round trip does not add a node or edge',await page.evaluate(()=>({nodes:qaView.session.board.nodes.length,edges:qaView.session.board.edges.length})),{nodes:original.nodes.length,edges:original.edges.length});

  await reset();await frame(note.id);await clickNode(note.id);
  const freshPort=await port.boundingBox(),portPoint={x:freshPort.x+freshPort.width/2,y:freshPort.y+freshPort.height/2},blank=await blankPoint();
  await page.mouse.move(portPoint.x,portPoint.y);await page.mouse.down();await page.mouse.move(blank.x,blank.y);await page.mouse.up();
  await page.waitForFunction(()=>!!qaView.inline&&qaView.session.board.nodes.length>7,{},{timeout:10000});
  check('a genuine blank connection drop still creates exactly one text and edge',await page.evaluate(()=>({nodes:qaView.session.board.nodes.length,edges:qaView.session.board.edges.length})),{nodes:original.nodes.length+1,edges:original.edges.length+1});
  check('a genuine blank connection drop opens the new text editor',await page.evaluate(()=>qaView.session.board.nodes.find(n=>n.id===qaView.inlineId)?.kind),'text');
  await page.keyboard.press('Escape');await settle();

  await reset();await page.evaluate(()=>{qaView.session.change(board=>{board.mode='mindmap';});qaView.renderBoard();});
  await frame(note.id);await clickNode(note.id);
  const topicPort=await port.boundingBox();point={x:topicPort.x+topicPort.width/2,y:topicPort.y+topicPort.height/2};
  await page.mouse.move(point.x,point.y);await page.mouse.down();await holdPointerFrame();
  await page.mouse.move(point.x+35,point.y+20);await page.mouse.move(point.x,point.y);await page.mouse.up();await settle();
  check('a mindmap drag back to its own port does not create a child',await page.evaluate(()=>({nodes:qaView.session.board.nodes.length,edges:qaView.session.board.edges.length})),{nodes:original.nodes.length,edges:original.edges.length});
  check('a mindmap round trip returns to selection mode',await page.evaluate(()=>qaView.mode),'select');

  await reset();
  const edgeId=original.edges[0].id;
  const edgePoint=await root.locator('.ts-edge-hit[data-edge="'+edgeId+'"]').evaluate(el=>{
    const local=el.getPointAtLength(el.getTotalLength()*.2),point=new DOMPoint(local.x,local.y).matrixTransform(el.getScreenCTM());
    return{x:point.x,y:point.y,hit:document.elementFromPoint(point.x,point.y)?.closest('[data-edge]')?.getAttribute('data-edge')};
  });
  assert.equal(edgePoint.hit,edgeId,'A native pointer must hit the edge path');
  await page.mouse.click(edgePoint.x,edgePoint.y);await settle();
  check('real pointer selects the edge before group drawing',await page.evaluate(()=>qaView.selectedEdge),edgeId);
  await root.locator('.ts-board-rail').getByRole('button',{name:'分组框',exact:true}).click();
  point=await blankPoint();await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+45,point.y+30);
  check('group drawing starts from the selected edge',await page.evaluate(()=>!!qaView.marquee?.section));
  await page.keyboard.press('Escape');await page.mouse.up();await settle();
  check('Escape restores the edge selection after group drawing',await page.evaluate(()=>qaView.selectedEdge),edgeId);
  check('cancelled group drawing adds no object',await page.evaluate(()=>qaView.session.board.nodes),original.nodes);

  await reset();const preferences=await page.evaluate(()=>({wheelMode:qaView.plugin.settings.wheelMode,panSpeed:qaView.plugin.settings.panSpeed,reverseWheelPan:qaView.plugin.settings.reverseWheelPan}));
  try {
    await page.evaluate(()=>{qaView.plugin.settings.wheelMode='pan';qaView.plugin.settings.panSpeed=1;qaView.plugin.settings.reverseWheelPan=false;});
    point=await blankPoint();const before=await page.evaluate(()=>({...qaView.session.board.viewport}));
    await page.mouse.move(point.x,point.y);await page.keyboard.down('Shift');await page.mouse.wheel(120,0);await page.keyboard.up('Shift');await settle();
    const after=await page.evaluate(()=>({...qaView.session.board.viewport}));
    check('Shift horizontal wheel moves the native canvas by its delta',after.x,before.x-120);
    check('Shift horizontal wheel preserves vertical position and zoom',{y:after.y,zoom:after.zoom},{y:before.y,zoom:before.zoom});
  } finally {await page.evaluate(preferences=>Object.assign(qaView.plugin.settings,preferences),preferences);}

  const focusVisible=async(label,areaSelector)=>{
    const actual=await root.evaluate((el,areaSelector)=>{
      const control=document.activeElement,area=el.querySelector(areaSelector);
      if(!control||!area||!area.contains(control))return{owned:false};
      const r=control.getBoundingClientRect(),a=area.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return{owned:true,inBounds:r.left>=a.left-1&&r.right<=a.right+1&&r.top>=a.top-1&&r.bottom<=a.bottom+1,hit:hit===control||control.contains(hit),label:control.getAttribute('aria-label'),rect:r.toJSON(),area:a.toJSON(),scrollTop:area.scrollTop};
    },areaSelector);
    report.geometry.push({label,...actual});
    check(label+': focused control is completely visible and receives pointer input',actual.owned&&actual.inBounds&&actual.hit);
  };
  for(const appearance of ['light','dark'])for(const [width,height] of [[640,220],[320,220],[320,180]]) {
    await bounds(width,height);await theme(appearance);await reset();
    const rail=root.locator('.ts-board-rail');
    for(const name of ['更多白板工具','插入内容']) {
      const label=appearance+'-'+width+'x'+height+'-'+(name==='更多白板工具'?'more':'insert');
      const buttons=rail.getByRole('button'),index=await buttons.evaluateAll((buttons,name)=>buttons.findIndex(button=>button.getAttribute('aria-label')===name),name);
      assert.ok(index>=0);await buttons.first().focus();await page.keyboard.press('Home');
      for(let i=0;i<index;i++)await page.keyboard.press('ArrowDown');
      await settle();await focusVisible(label+' trigger','.ts-board-rail');
      await rail.getByRole('button',{name,exact:true}).click();await settle();
      const panel=root.locator('.ts-rail-popover:visible');assert.equal(await panel.count(),1);
      if(name==='更多白板工具')await page.keyboard.press('ArrowDown');
      await settle();await focusVisible(label+' first','.ts-rail-popover:not([hidden])');
      await page.keyboard.press('End');await settle();await focusVisible(label+' last','.ts-rail-popover:not([hidden])');
      await page.keyboard.press('Home');await settle();await focusVisible(label+' home','.ts-rail-popover:not([hidden])');
      if(name==='更多白板工具') {
        await page.keyboard.press('ArrowUp');await settle();await focusVisible(label+' search','.ts-rail-popover:not([hidden])');
      }
      await screenshot(label);
      await page.keyboard.press('Escape');await settle();
      check(label+': Escape closes the palette',await root.locator('.ts-rail-popover:visible').count(),0);
      await focusVisible(label+' restored trigger','.ts-board-rail');
    }
  }

  // Conversions go through actual context menu and modal input. A fresh native
  // Session reads a separate copy of the saved bytes so the live view's cache
  // cannot hide a malformed persisted document. Undo/redo use real shortcuts.
  await bounds(1440);await theme('light');
  const text=original.nodes.find(item=>item.kind==='text'&&item.id==='summary');
  assert.ok(text,'The fixture requires its editable summary text');
  const prefix='QA-深度调试-'+Date.now();
  for(const variant of ['folded','video-capture']) {
    await reset();
    await page.evaluate(({id,variant,source})=>{
      qaView.session.change(board=>{
        const item=board.nodes.find(item=>item.id===id);
        if(variant==='folded'){item.collapsed=true;item.expandedHeight=item.height;item.height=72;}
        else {
          item.videoCapture={id:'11111111-2222-3333-4444-555555555555',note:source};
          item.text+='\n\n> 来源：[['+source+'#^video-t-11111111-2222-3333-4444-555555555555]]';
        }
      });qaView.renderBoard();
    },{id:text.id,variant,source:note.file});
    await frame(text.id);await clickNode(text.id);
    const originalText=await page.evaluate(id=>JSON.parse(JSON.stringify(qaView.session.board.nodes.find(item=>item.id===id))),text.id);
    const box=await node(text.id).boundingBox();
    await page.mouse.click(box.x+box.width*.4,box.y+25,{button:'right'});
    await page.getByText('转换为笔记',{exact:true}).click();
    const title=prefix+'-'+variant;
    await page.locator('.ts-prompt-modal input').fill(title);
    await page.locator('.ts-prompt-modal').getByRole('button',{name:'确定',exact:true}).click();
    await page.waitForFunction(id=>qaView.session.board.nodes.find(item=>item.id===id)?.kind==='card',text.id,{timeout:10000});
    const converted=await page.evaluate(id=>JSON.parse(JSON.stringify(qaView.session.board.nodes.find(item=>item.id===id))),text.id);
    fixturePath(converted.file);assert.ok(converted.file.includes(prefix));generatedFiles.add(converted.file);
    check(variant+': conversion preserves the intended folded height',variant==='folded'?converted.height===72&&converted.collapsed===true&&converted.expandedHeight>=220:converted.height>=220);
    check(variant+': converted note has valid provenance fields',converted.videoCapture===undefined);
    const noteContent=await fs.readFile(fixturePath(converted.file),'utf8');
    check(variant+': conversion preserves the text in its Markdown note',noteContent.includes('正在形成的想法'));
    if(variant==='video-capture')check('video capture source citation survives conversion',noteContent.includes('[['+note.file+'#^video-t-11111111-2222-3333-4444-555555555555]]'));
    const freshRead=async phase=>{
      const copied='ThoughtSpace/'+title+'-'+phase+'.thoughtspace';fixturePath(copied);generatedFiles.add(copied);
      return page.evaluate(async({id,copied})=>{
        await qaView.session.flush();
        const fresh=await app.vault.create(copied,await app.vault.read(qaView.file));
        const reopened=await qaView.plugin.session(fresh);
        try{return JSON.parse(JSON.stringify(reopened.board.nodes.find(item=>item.id===id)));}
        finally{await qaView.plugin.release(reopened);}
      },{id:text.id,copied});
    };
    check(variant+': actual saved bytes reopen in a fresh native Session',await freshRead('saved'),converted);
    await screenshot('conversion-'+variant+'-saved');
    await page.evaluate(()=>{app.workspace.rightSplit.collapse();app.workspace.setActiveLeaf(qaView.leaf,{focus:true});qaView.stage.focus();});
    await page.keyboard.press('Control+z');await settle();
    check(variant+': undo restores a reopenable original text',await freshRead('undo'),originalText);
    await page.keyboard.press('Control+Shift+z');await settle();
    check(variant+': redo restores a reopenable converted note',await freshRead('redo'),converted);
  }

  await reset();await page.evaluate(()=>qaView.session.flush());
  check('native renderer reports no uncaught errors',report.errors,[]);
  check('native editing reports no unexpected fallback or layout warnings',report.warnings,[]);
}

main().catch(async error=>{
  report.failure={message:error.message,stack:error.stack};console.error(error);process.exitCode=1;
  if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}).finally(async()=>{
  if(page&&original) {
    await page.evaluate(async({vault,boardPath,board,notes,generated})=>{
      if(app.vault.adapter.basePath!==vault)throw Error('Refusing restoration outside the disposable native QA vault');
      if(qaView.file.path!==boardPath)throw Error('Fixture board changed; restoration needs its original owner');
      if(Object.hasOwn(window,'qaDeepSavedMdFactory')) {
        app.embedRegistry.embedByExtension.md=window.qaDeepSavedMdFactory;delete window.qaDeepSavedMdFactory;
      }
      const editor=qaView.inline;if(editor?.saving)await editor.pending;
      qaView.inline?.cancel();
      if(qaView.inline)throw Error('Active draft could not be cancelled safely during restoration');
      qaView.clearCanvasGesture();
      for(const[file,content]of Object.entries(notes)) {
        const target=app.vault.getAbstractFileByPath(file);
        if(!target)throw Error('Fixture note disappeared: '+file);
        await app.vault.modify(target,content);
      }
      qaView.session.change(current=>{for(const key of Object.keys(current))if(!Object.hasOwn(board,key))delete current[key];Object.assign(current,board);});
      qaView.selected.clear();qaView.selectedEdge=undefined;qaView.updateSelection();qaView.renderBoard();await qaView.session.flush();
      for(const file of generated) {
        if(Object.hasOwn(notes,file)||file===boardPath)throw Error('Refusing to remove an original fixture file');
        const target=app.vault.getAbstractFileByPath(file);
        for(const leaf of app.workspace.getLeavesOfType('markdown'))if(leaf.view.file===target)leaf.detach();
        if(target)await app.vault.delete(target,true);
      }
    },{vault,boardPath:originalBoardPath,board:original,notes:originalNotes,generated:[...generatedFiles]})
      .catch(error=>{report.restoreFailure=error.message;process.exitCode=1;});
    for(const[file,content]of Object.entries(originalNotes)) {
      check(`restoration preserves ${file}`,await fs.readFile(fixturePath(file),'utf8').catch(()=>null),content);
    }
    check('restoration preserves the original board',
      await page.evaluate(()=>JSON.parse(JSON.stringify(qaView.session.board))).catch(()=>null),original);
    for(const file of generatedFiles)check(`restoration removes generated ${file}`,
      await fs.access(fixturePath(file)).then(()=>false,()=>true));
  }
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  const failed=report.checks.filter(item=>!item.passed);if(failed.length)process.exitCode=1;
  console.log(JSON.stringify({passed:report.checks.length-failed.length,failed:failed.length,screenshots:report.screenshots.length,output,failure:report.failure?.message,restoreFailure:report.restoreFailure}));
  if(browser)await browser.close();
});
