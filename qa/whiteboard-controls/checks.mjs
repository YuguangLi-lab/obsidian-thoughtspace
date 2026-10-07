import {readFile} from 'node:fs/promises';
import path from 'node:path';

// Synthetic fixtures and actual renderer input. No user vault or fixed CDP port.
export async function controlsChecks({page,check,screenshot,report,fixtureDir}) {
 const candidate=process.env.QA_CONTROLS==='1';
 const observe=(name,actual)=>{report.controls??=[];report.controls.push({name,...actual});};
 const verify=(name,value)=>{if(candidate)check(name,value);};
 const files={};
 for(const name of ['fixture.png','fixture.wav','fixture.mp4'])files[name]=[...await readFile(path.join(fixtureDir,name))];
 await page.evaluate(async files=>{
  for(const [name,bytes] of Object.entries(files))await app.vault.createBinary(name,new Uint8Array(bytes).buffer);
  // A small, valid one-page PDF generated solely for this control fixture.
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 180] /Resources << >> /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];
  let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=pdf.length;pdf+='xref\n0 5\n0000000000 65535 f \n';for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  await app.vault.createBinary('fixture.pdf',new TextEncoder().encode(pdf).buffer);
  await app.vault.create('Child.thoughtspace',JSON.stringify({version:3,nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}}));
 },files);
 const parent=()=>page.locator('.ts-node[data-id="parent"]');
 const fold=()=>parent().locator('.ts-content-fold,.ts-card-quick-fold,button[aria-label="折叠图片"]');
 const setup=async(kind,zoom=1,width=1440)=>{
  await page.evaluate(({kind,zoom,width})=>{
   qaView.inline?.cancel();qaView.clearCanvasGesture();qaView.session.board.nodes.forEach(n=>delete n.locked);
   if(width===1440){qaView.containerEl.style.removeProperty('width');qaView.containerEl.style.removeProperty('flex');}
   else{qaView.containerEl.style.width=`${width}px`;qaView.containerEl.style.flex='none';}
   qaView.onResize?.();
   const files={card:'index.md',image:'fixture.png',pdf:'fixture.pdf',audio:'fixture.wav',video:'fixture.mp4',board:'Child.thoughtspace'};
   const node={id:'parent',kind,x:500,y:500,width:280,height:180,color:'slate',title:'长中文研究资料名称 · 从观察整理到验证的完整记录',text:'关键问题\n\n正文与子节点分别控制。',autoSize:false};
   if(kind==='card')node.autoFit=false;if(files[kind])node.file=files[kind];
   const child={id:'child',kind:'text',text:'独立子节点',x:810,y:620,width:160,height:70,color:'blue',autoSize:false};
   qaView.session.change(b=>{b.nodes=[node,child];b.edges=[{id:'child-edge',from:'parent',to:'child',kind:'branch',label:''}];b.viewport={x:Math.max(70,(qaView.stage.clientWidth-280*zoom)/2)-500*zoom,y:220-500*zoom,zoom};});
   qaView.appearanceExpanded=false;qaView.selected=new Set(['parent']);qaView.updateSelection();qaView.renderBoard();qaView.stage.focus();
  },{kind,zoom,width});await page.waitForTimeout(130);
 };
 const model=()=>page.evaluate(()=>structuredClone(qaView.session.board));
 const probe=()=>parent().evaluate(el=>{
  const button=el.querySelector('.ts-compact-unfold,.ts-content-fold,.ts-card-quick-fold,button[aria-label="折叠图片"]');
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const node=rect(el),control=button?rect(button):null,row=el.querySelector('.ts-compact-fold-row');
  return{node,control,inline:!!row&&button?.parentElement===row,hit:!!control&&button.contains(document.elementFromPoint(control.x+control.width/2,control.y+control.height/2)),focus:document.activeElement===button,title:el.querySelector('.ts-compact-fold-title')?.textContent};
 });
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{document.body.classList.toggle('theme-dark',theme==='dark');document.body.classList.toggle('theme-light',theme==='light');},theme);
  for(const zoom of [.5,1,2])for(const kind of ['text','card','image','pdf','audio','video','board','section']){
   await setup(kind,zoom);const before=await model(),label=`${theme} ${kind} ${zoom}`;
   await fold().focus();await page.keyboard.press('Enter');await page.waitForTimeout(100);
   const compact=await probe();observe(label,compact);
   verify(`${label}: unified inline expand is 28 screen px`,compact.inline&&Math.abs(compact.control.width-28)<1&&Math.abs(compact.control.height-28)<1);
   check(`${label}: compact control is a real hit target`,compact.hit);
   check(`${label}: keyboard focus follows fold`,compact.focus);
   if(zoom===1)await screenshot(`controls-${theme}-${kind}-folded.png`);
   await parent().locator('.ts-compact-unfold').click();await page.waitForTimeout(100);
   const after=await model();
   check(`${label}: content unfolding preserves geometry`,after.nodes.map(n=>[n.id,n.x,n.y,n.width,n.height]),before.nodes.map(n=>[n.id,n.x,n.y,n.width,n.height]));
   check(`${label}: connected child remains visible`,await page.locator('.ts-node[data-id="child"]').count(),1);
   if(zoom===1){
    await parent().locator('.ts-branch-toggle').click();await page.waitForTimeout(80);
    check(`${label}: branch disclosure independently hides child`,await page.locator('.ts-node[data-id="child"]').count(),0);
    await parent().locator('.ts-branch-toggle').click();await page.waitForTimeout(80);
    check(`${label}: branch disclosure restores child`,await page.locator('.ts-node[data-id="child"]').count(),1);
   }
  }
  for(const width of [420,260]){
   await setup('card',1,width);
   await page.locator('.ts-format-mode-button[data-mode="card"]').click();await page.waitForTimeout(120);
   const bar=await page.locator('.ts-floating-formatbar').evaluate(e=>{const h=e.querySelector('.ts-format-heading'),r=e.getBoundingClientRect();return{width:r.width,headingHeight:h.clientHeight,headingScroll:h.scrollWidth,headingWidth:h.clientWidth};});
   observe(`${theme} ${width} heading`,bar);
   verify(`${theme} ${width}: heading remains one scrollable row`,bar.headingHeight<=42);
   check(`${theme} ${width}: toolbar fits pane`,bar.width<=width-14);
   for(const mode of ['card','text','fill','border']){
    const button=page.locator(`.ts-format-mode-button[data-mode="${mode}"]`);
    await button.focus();await page.keyboard.press('Enter');await page.waitForTimeout(80);
    check(`${theme} ${width}: ${mode} is keyboard reachable`,await button.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.closest('.ts-format-heading').getBoundingClientRect();return document.activeElement===e&&r.left>=p.left-1&&r.right<=p.right+1;}));
   }
   await screenshot(`controls-${theme}-${width}-format.png`);
   // Native context menu and Escape, followed by repeated insert open/close.
   await parent().click({button:'right',position:{x:80,y:70}});await page.waitForTimeout(100);await screenshot(`controls-${theme}-${width}-menu.png`);
   await page.keyboard.press('Escape');check(`${theme} ${width}: Escape closes native menu`,await page.locator('.menu').count(),0);
   for(let i=0;i<3;i++){await page.locator('.ts-insert-content-entry').click();await page.keyboard.press('Escape');}
   check(`${theme} ${width}: repeated insertion closes`,await page.locator('.ts-insert-palette').isVisible(),false);
   await setup('pdf',.5,width);await fold().click();await page.waitForTimeout(80);await screenshot(`controls-${theme}-${width}-pdf-folded.png`);
   verify(`${theme} ${width}: narrow media unfolds inline`,(await probe()).inline);
   await parent().locator('.ts-compact-unfold').click();await page.waitForTimeout(80);
   await page.evaluate(()=>{qaView.session.change(b=>{b.nodes.find(n=>n.id==='parent').locked=true;});qaView.renderBoard();});
   check(`${theme} ${width}: locked fold is disabled`,await fold().isDisabled());
  }
 }
 // A later DOM sibling must not cover the selected card. Hover cannot steal it.
 await setup('text');await page.evaluate(()=>{qaView.session.change(b=>{b.nodes.push({...b.nodes[0],id:'cover',text:'未选中的上层对象',x:510,y:510});});qaView.renderBoard();});
 const layering=await parent().evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+100,r.y+90)?.closest('.ts-node');return{hit:hit?.dataset.id,zIndex:getComputedStyle(e).zIndex};});
 observe('selection layering',layering);verify('selected card paints above later unselected sibling',layering.hit==='parent');
 await screenshot('controls-selected-overlap.png');
 await setup('image');await page.evaluate(()=>{qaView.selected.clear();qaView.updateSelection();qaView.renderBoard();});
 const stage=await page.locator('.ts-stage').boundingBox();await page.mouse.move(stage.x+stage.width-20,stage.y+stage.height-20);await page.waitForTimeout(160);
 const hidden=await parent().locator('.ts-image-actions').evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{visibility:s.visibility,pointerEvents:s.pointerEvents,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
 observe('hidden image controls',hidden);verify('hidden image dock rejects pointer input',hidden.visibility==='hidden'&&hidden.pointerEvents==='none'&&!hidden.hit);
 await setup('text');await page.evaluate(()=>{qaView.session.change(b=>Object.assign(b.nodes[0],{fontFamily:'mono',fontSize:18,textColor:'rose',fillColor:'#345678',customBorder:true,borderStyle:'dashed',borderWidth:3,transparent:true}));qaView.renderBoard();});
 const custom=await model();await fold().click();await page.waitForTimeout(80);await parent().locator('.ts-compact-unfold').click();await page.waitForTimeout(80);
 const fields=n=>({fontFamily:n.fontFamily,fontSize:n.fontSize,textColor:n.textColor,fillColor:n.fillColor,customBorder:n.customBorder,borderStyle:n.borderStyle,borderWidth:n.borderWidth,transparent:n.transparent});
 check('custom font color border and transparency survive fold',fields((await model()).nodes[0]),fields(custom.nodes[0]));
 check('custom transparent surface stays clear',await parent().evaluate(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'));
 // Undo/redo and reopen preserve content fold independently from branch fold.
 await setup('pdf');const original=await model();await fold().click();await page.waitForTimeout(80);await page.evaluate(()=>qaView.stage.focus());
 await page.keyboard.press('Meta+z');await page.waitForTimeout(100);check('fold undo expands media',await parent().evaluate(e=>!e.classList.contains('is-compact-fold')));
 await page.keyboard.press('Meta+Shift+z');await page.waitForTimeout(100);check('fold redo restores media fold',await parent().evaluate(e=>e.classList.contains('is-compact-fold')));
 await page.evaluate(()=>qaView.session.flush());
 await page.evaluate(async()=>{const file=qaView.file,leaf=qaView.leaf;await leaf.setViewState({type:'empty'});await leaf.setViewState({type:'thoughtspace-board',state:{file:file.path},active:true});await leaf.loadIfDeferred();window.qaView=leaf.view;});await page.waitForTimeout(250);
 check('reopen retains media fold',await parent().evaluate(e=>e.classList.contains('is-compact-fold')));
 await parent().locator('.ts-compact-unfold').click();await page.waitForTimeout(100);
 check('reopen unfold retains node geometry',(await model()).nodes.map(n=>[n.id,n.x,n.y,n.width,n.height]),original.nodes.map(n=>[n.id,n.x,n.y,n.width,n.height]));
 // Settings search and categories remain functional in a small dialog.
 await page.evaluate(()=>{app.setting.open();app.setting.openTabById('thoughtspace');});await page.waitForTimeout(180);
 let settingsPage=page;
 for(const other of page.context().pages())if(await other.locator('.ts-settings-v2').count()){settingsPage=other;break;}
 const settings=settingsPage.locator('.ts-settings-v2');
 check('native settings tab is present',await settings.count(),1);
 if(await settings.count()){
  await settings.evaluate(e=>{e.style.width='260px';e.style.maxWidth='260px';});
  await settings.locator('.ts-settings-search input').fill('字体');await settingsPage.waitForTimeout(100);
  await settingsPage.screenshot({path:path.join(process.env.QA_OUTPUT,'controls-settings-search.png')});report.screenshots.push('controls-settings-search.png');
  check('settings retains searchable categories',await settings.locator('.ts-settings-nav button').count()>0);
  check('settings search text retained',await settings.locator('.ts-settings-search input').inputValue(),'字体');
 }
 await settingsPage.keyboard.press('Escape');
 await page.evaluate(()=>app.setting.close());
 await page.bringToFront();
 await setup('card');
 // Same fixture and input count in both builds. Renderer durations and RAF
 // intervals do not represent hardware-to-pixel latency or a general FPS claim.
 await page.evaluate(()=>{qaView.session.change(b=>{for(let i=0;i<1198;i++)b.nodes.push({id:`offscreen-${i}`,kind:'text',text:`Evidence ${i}`,x:3000+(i%40)*300,y:3000+Math.floor(i/40)*220,width:220,height:160,color:'slate',autoSize:false});});});
 const client=await page.context().newCDPSession(page);await client.send('Performance.enable');
 const readMetrics=async()=>Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const timings=[];
 for(const gesture of ['drag','pan','zoom']){
  await page.evaluate(()=>{window.qaIntervals=[];let last;window.qaRecording=true;const tick=t=>{if(last!==undefined)qaIntervals.push(t-last);last=t;if(qaRecording)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  console.log('PERFORMANCE START '+gesture);const start=await readMetrics();
  const rect=await parent().boundingBox(),stage=await page.locator('.ts-stage').boundingBox();
  if(gesture==='zoom'){
   await page.mouse.move(stage.x+stage.width*.75,stage.y+stage.height*.5);await page.keyboard.down('Control');
   for(let i=0;i<12;i++){await page.mouse.wheel(0,i%2?-40:40);await page.waitForTimeout(30);}await page.keyboard.up('Control');
  }else{
   const x=gesture==='drag'?rect.x+rect.width*.4:stage.x+stage.width*.8,y=gesture==='drag'?rect.y+12:stage.y+stage.height*.6;
   for(let i=0;i<6;i++){await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+35,y+20,{steps:12});await page.mouse.up();await page.mouse.move(x+35,y+20);await page.mouse.down();await page.mouse.move(x,y,{steps:12});await page.mouse.up();}
  }
  const end=await readMetrics();const frame=await page.evaluate(()=>{qaRecording=false;const a=qaIntervals.sort((a,b)=>a-b);return{samples:a.length,medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)]};});
  console.log('PERFORMANCE END '+gesture);timings.push({gesture,frames:frame,durationMs:Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].map(name=>[name,(end[name]-start[name])*1000]))});
 }
 await client.detach();report.pointerPerformance={cards:1200,mounted:await page.evaluate(()=>qaView.positions.size),samples:timings};
}
