// Run against the existing isolated Obsidian profile; no real vault is allowed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9237'),p=browser.contexts()[0].pages().find(page=>page.url()==='app://obsidian.md/index.html');
 assert.equal(await p.evaluate(()=>app.vault.adapter.basePath),path.resolve('../thoughtspace-qa-vault'));
 const out='dist/fold-controls-native',results=[];fs.mkdirSync(out,{recursive:true});
 await p.bringToFront();await p.evaluate(()=>{const w=require('@electron/remote').getCurrentWindow();w.show();w.focus();});
 await p.route('https://example.invalid/**',route=>route.abort());
 await p.evaluate(async()=>{await app.plugins.plugins.thoughtspace.mediaDrafts.flush();await app.plugins.unloadPlugin('thoughtspace');});
 await p.evaluate(async()=>{
  // Repair only synthetic boards from earlier runs of this exact script.
  for(const file of app.vault.getFiles().filter(f=>f.path.startsWith('qa-fold-')&&f.extension==='thoughtspace')){
   const data=JSON.parse(await app.vault.read(file));let changed=false;
   for(const n of data.nodes)if(n.kind!=='card'&&n.autoFit!==undefined){delete n.autoFit;changed=true;}
   if(changed)await app.vault.modify(file,JSON.stringify(data));
  }
 });
 for(const file of ['main.js','styles.css'])fs.copyFileSync(file,'../thoughtspace-qa-vault/.obsidian/plugins/thoughtspace/'+file);
 await p.evaluate(async()=>{
  await app.plugins.loadPlugin('thoughtspace');const plugin=app.plugins.plugins.thoughtspace;
  for(const leaf of app.workspace.getLeavesOfType('thoughtspace-board'))await leaf.detach();
  const stamp=Date.now();window.foldFiles={note:`qa-fold-${stamp}.md`,board:`qa-fold-child-${stamp}.thoughtspace`};
  await app.vault.create(foldFiles.note,'# 把观察变成问题\n\n记录关键证据，再整理它们的关系。\n\n- 观察\n- 推论\n- 待验证');
  await app.vault.create(foldFiles.board,JSON.stringify({version:3,nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}}));
  const file=await app.vault.create(`qa-fold-${stamp}.thoughtspace`,JSON.stringify({version:3,nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}}));
  await plugin.openBoard(file);window.foldView=plugin.currentBoard;app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();
 });
 const setup=async(kind,zoom,side)=>{
  await p.evaluate(async({kind,zoom,side})=>{
   const v=foldView,w=v.stage.clientWidth,base={id:'parent',kind:kind==='web'?'text':kind,x:500,y:500,width:260,height:180,color:'slate',title:'研究材料 · '+kind,text:'研究中的关键问题\n\n正文与连接层级分别控制。',autoSize:false};if(kind==='card')base.autoFit=false;
   const files={card:foldFiles.note,pdf:'media/fixture.pdf',image:'media/fixture.png',audio:'media/fixture.wav',video:'media/fixture.mp4',board:foldFiles.board};
   if(files[kind])base.file=files[kind];if(kind==='web'){base.webUrl='https://example.invalid/qa-fold';base.text='[测试网页](https://example.invalid/qa-fold)';}
   const nodes=[base,{id:'child',kind:'text',text:'相邻子节点\n应保持可选',x:500+side*140,y:400,width:160,height:70,color:'blue',autoSize:false},{id:'child2',kind:'text',text:'连线子节点',x:500+side*350,y:580,width:170,height:70,color:'green',autoSize:false}];
   if(kind==='section')nodes.push({id:'inside',kind:'text',text:'框内对象',x:520,y:560,width:160,height:70,color:'rose',autoSize:false});
   v.session.change(b=>{b.nodes=nodes;b.edges=[{id:'edge',from:'parent',to:'child',kind:'branch',label:''},{id:'edge2',from:'parent',to:'child2',kind:'branch',label:''}];b.viewport={x:(w-260*zoom)/2-500*zoom,y:240-500*zoom,zoom};});
   v.selected=new Set(['parent']);v.updateSelection();v.renderBoard();await v.session.flush();await app.plugins.plugins.thoughtspace.readBoard(v.session.file);for(const notice of document.querySelectorAll('.notice'))notice.click();
  },{kind,zoom,side});await p.waitForTimeout(100);
 };
 const root=()=>p.locator('.ts-node[data-id="parent"]');
 const fold=()=>root().locator('.ts-content-fold,.ts-card-quick-fold,button[aria-label="折叠图片"]');
 const geometry=async()=>p.evaluate(()=>{
  const el=foldView.positions.get('parent'),button=el.querySelector('.ts-content-fold,.ts-card-quick-fold,button[aria-label="折叠图片"],.ts-compact-unfold');
  const dock=button.closest('.ts-card-actions,.ts-compact-actions')||button,r=dock.getBoundingClientRect(),b=button.getBoundingClientRect(),n=el.getBoundingClientRect();
  const overlap=(a,c)=>Math.min(a.right,c.right)-Math.max(a.left,c.left)>.5&&Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top)>.5;
  const children=['child','child2'].map(id=>foldView.positions.get(id)).filter(Boolean);
  return {dock:{x:r.x,y:r.y,width:r.width,height:r.height},gap:n.top-r.bottom,clearsChildren:children.every(c=>!overlap(r,c.getBoundingClientRect())),clearsBody:!overlap(r,n),hit:button.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)),childState:foldView.session.board.nodes.filter(n=>n.id.startsWith('child')).map(n=>({id:n.id,x:n.x,y:n.y,width:n.width,height:n.height,collapsed:n.collapsed,branchFolded:n.branchFolded})),dragging:foldView.dragging};
 });
 if(!process.env.QA_FOLD_INTERACTIONS_ONLY)for(const kind of ['text','card','image','pdf','audio','video','board','section','web'])for(const zoom of [.5,1,2.5])for(const side of [-1,1]){
  await setup(kind,zoom,side);const before=await geometry();
  assert.ok(before.clearsChildren&&before.clearsBody&&before.hit,JSON.stringify({kind,zoom,side,before}));
  for(let repeat=0;repeat<2;repeat++){
   await fold().click({timeout:4000});await p.waitForTimeout(80);assert.ok(await root().evaluate(el=>el.classList.contains('is-compact-fold')),'collapsed '+kind);
   assert.deepEqual((await geometry()).childState,before.childState,'content folding preserves connected children');
   assert.equal(await p.locator('.ts-node[data-id="child"]').count(),1);assert.equal(await p.locator('.ts-node[data-id="child2"]').count(),1);
   await root().locator('.ts-compact-unfold').click({timeout:4000});await p.waitForTimeout(80);assert.ok(!await root().evaluate(el=>el.classList.contains('is-compact-fold')),'expanded '+kind);
  }
  assert.deepEqual((await geometry()).childState,before.childState);results.push({kind,zoom,side,...before});console.log('PASS',kind,zoom,side);
 }
 // Actual keyboard activation and pointer hover across the external gap.
 await setup('pdf',1,1);await p.evaluate(()=>{foldView.selected.clear();foldView.updateSelection();foldView.renderBoard();});
 await root().hover();assert.ok(await fold().isVisible());await fold().hover();assert.ok((await geometry()).hit);
 await fold().focus();await p.keyboard.press('Enter');await p.waitForTimeout(150);assert.ok(await root().locator('.ts-compact-unfold').isVisible());assert.ok((await geometry()).clearsChildren,'unselected compact dock clears children');
 await root().locator('.ts-compact-unfold').focus();await p.keyboard.press('Enter');await p.waitForTimeout(150);assert.ok(await fold().isVisible());
 await setup('text',1,-1);const state=await p.evaluate(()=>structuredClone(foldView.session.board.nodes.find(n=>n.id==='parent')));
 const box=await root().boundingBox();await p.mouse.move(box.x+70,box.y+90);await p.mouse.down();await p.mouse.move(box.x+100,box.y+120,{steps:6});await p.mouse.up();await p.waitForTimeout(180);
 assert.ok(await p.evaluate(state=>{const n=foldView.session.board.nodes.find(n=>n.id==='parent');return n.x!==state.x||n.y!==state.y;},state),'node drag still moves the parent');
 await setup('pdf',1,-1);await root().locator('.ts-branch-toggle').click();await p.waitForTimeout(150);assert.equal(await p.locator('.ts-node[data-id="child"]').count(),0,'branch fold independently hides children');
 await root().locator('.ts-branch-toggle').click();await p.waitForTimeout(150);assert.equal(await p.locator('.ts-node[data-id="child"]').count(),1,'branch expansion restores children');
 await p.locator('.ts-node[data-id="child"] .ts-text-body').click();assert.ok(await p.evaluate(()=>foldView.selected.has('child')),'child stays directly selectable');
 await setup('pdf',1,1);await p.evaluate(()=>{foldView.session.change(b=>{b.nodes.find(n=>n.id==='parent').locked=true;});foldView.renderBoard();});assert.ok(await fold().isDisabled(),'locked fold remains disabled');
 for(const theme of ['light','dark']){
  await p.evaluate(theme=>{document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');},theme);
  await setup('video',1,1);await p.mouse.move(100,160);await p.waitForTimeout(100);await p.screenshot({path:path.join(out,`wide-${theme}.png`),clip:await p.locator('.ts-main').boundingBox()});
 }
 await p.evaluate(()=>{foldView.contentEl.style.width='420px';foldView.contentEl.style.flex='none';});await setup('pdf',.65,1);
 assert.ok((await geometry()).hit,'narrow fold remains reachable');await p.screenshot({path:path.join(out,'narrow-dark.png'),clip:await p.locator('.ts-main').boundingBox()});
 await p.evaluate(async()=>{foldView.contentEl.style.removeProperty('width');foldView.contentEl.style.removeProperty('flex');await foldView.session.flush();});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,extraChecks:['hover corridor','keyboard fold/unfold','node drag','separate branch fold/unfold','child selection','locked disabled','light/dark','420px narrow'],scope:'Native Obsidian temporary vault; geometry setup via controller, actual fold buttons via pointer/keyboard; 2 fold/unfold cycles per case. Web preview requests aborted locally.'},null,2));
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
