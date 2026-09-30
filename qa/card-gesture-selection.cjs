// Run with the bundled Playwright runtime and a local Chrome/Chromium executable.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {buildSync} = require('esbuild');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const output = path.resolve(process.env.QA_OUTPUT || 'dist/card-gesture-selection');
const sourcePath = path.resolve(process.env.QA_SOURCE || 'src/main.ts');
const stylesheet = path.resolve(process.env.QA_CSS || 'styles.css');
const source = fs.readFileSync(sourcePath, 'utf8');
function take(start, end, after = 0) {
  const a = source.indexOf(start, after), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Missing production method range: ${start}`);
  return source.slice(a, b);
}
const selectionTool = source.indexOf('  toggleSelectionTool()');
const finishStart = source.indexOf('  private finish', selectionTool);
const methods = take('  private pointerDown(', '  private key(')
  + take('  private finish', '  private foldText(', finishStart)
  + take('  private displayBoard()', '  private renderEdges(');
const bindings = take("    this.registerDomEvent(this.stage, 'pointerdown'", "    this.registerDomEvent(this.stage,'wheel'");
const script = buildSync({
  stdin: {contents: `
    import * as model from './src/model';
    import * as mindmap from './src/mindmap';
    import * as boardTools from './src/board-tools';
    import * as dragDraft from './src/drag-draft';
    import * as dragTargetHelpers from './src/drag-targets';
    import * as experience from './src/board-experience';
    import * as sections from './src/section-resize';
    import * as edgeSelectionHelpers from './src/selection-edges';
    const {movableSelection}=model;
    const {visibleBranchBoard}=mindmap;
    const {dragStartSnapshot,dragDisplayBoard,dragGeometry,dragCommitChanges}=dragDraft;
    const {dragTargets:targets,activeDragTargets}=dragTargetHelpers;
    const dragTargets=targets;
    const {constrainedDrag,resized}=experience;
    const {resizedSection}=sections;
    const {selectionEdges:edgeSelection}=edgeSelectionHelpers;
    const selectionEdges=edgeSelection;
    class Notice {constructor(message){window.gestureNotices.push(String(message));}}
    class GestureView {
      ${methods}
      bind(){${bindings}}
      registerDomEvent(target,event,handler,options){target.addEventListener(event,handler,options);}
    }
    window.createGestureFixture=(zoom)=>{
      const stage=document.querySelector('.ts-stage'),world=document.querySelector('.ts-world');
      const positions=new Map();
      const board={...model.emptyBoard(),version:3,viewport:{x:0,y:0,zoom}};
      const calls={changes:0,persist:0,renders:0};
      const session={board,blocked:false,persist(){calls.persist++;},change(change){change(board);calls.changes++;this.persist();}};
      const view=new GestureView();
      const positionNode=(node,el)=>Object.assign(el.style,{left:node.x+'px',top:node.y+'px',width:node.width+'px',height:node.height+'px'});
      Object.assign(view,{session,stage,world,contentEl:document.querySelector('.ts-root'),positions,svg:document.querySelector('svg'),selected:new Set(),space:false,selectionTool:false,mode:'select',pointerFrame:0,dragging:false,
        plugin:{settings:{dragThreshold:4,axisLock:true,aspectLock:true,alignmentGuides:false,gridStep:24}},
        pendingFits:new Map(),nodeFitQueue:{schedule(){}},viewTrail:{remember(){}},
        syncCanvasControls(){},renderInspector(){},scheduleRender(){},renderEdges(){},previewGridLanding(){},drawAlignmentGuides(){},
        positionNode,point(x,y){const rect=stage.getBoundingClientRect();return{x:(x-rect.left-board.viewport.x)/zoom,y:(y-rect.top-board.viewport.y)/zoom};},
        cancelConnection(){},setSectionTool(){},contextMenu(){},blankClicks:{cancel(){}},
        renderBoard(){calls.renders++;world.style.transform='translate('+board.viewport.x+'px,'+board.viewport.y+'px) scale('+zoom+')';for(const node of board.nodes)positionNode(node,positions.get(node.id));}
      });
      window.gestureNotices=[];
      const reset=(edge=false)=>{
        view.flushPointer(false);view.gesture=undefined;view.marquee=undefined;view.rightMarquee=undefined;view.linkDrag=undefined;view.dragging=false;view.selectedEdge=undefined;
        board.viewport={x:0,y:0,zoom};board.nodes=[
          {id:'a',kind:'card',file:'a.md',x:edge?(stage.clientWidth-80)/zoom:80,y:80,width:240,height:160,color:'sand',autoFit:true},
          {id:'b',kind:'card',file:'b.md',x:80,y:300,width:240,height:160,color:'sand',autoFit:true}
        ];board.edges=[];world.replaceChildren();positions.clear();
        for(const node of board.nodes){
          const el=document.createElement('div');el.className='ts-node ts-card is-selected';el.dataset.id=node.id;
          const header=document.createElement('div');header.className='ts-node-header';header.textContent='Card '+node.id;el.append(header);
          const body=document.createElement('div');body.className='ts-card-body';body.textContent='Select, drag and resize';el.append(body);
          const handle=document.createElement('div');handle.className='ts-resize';handle.setAttribute('aria-label','Resize '+node.id);el.append(handle);
          world.append(el);positions.set(node.id,el);
        }
        view.selected=new Set(['a','b']);calls.changes=0;calls.persist=0;calls.renders=0;window.gestureNotices.length=0;view.renderBoard();
      };
      const snapshot=()=>({selected:[...view.selected].sort(),nodes:board.nodes.map(n=>({id:n.id,x:n.x,y:n.y,width:n.width,height:n.height,autoFit:n.autoFit})),gesture:!!view.gesture,dragging:view.dragging,changes:calls.changes,persist:calls.persist,notices:[...window.gestureNotices]});
      view.bind();reset();window.gestureFixture={view,reset,snapshot};
    };
  `, resolveDir: process.cwd(), loader: 'ts'},
  bundle: true, write: false, format: 'iife', platform: 'browser',
}).outputFiles[0].text;

const report = {sourcePath,stylesheet,scope:'Real Chromium pointer hit testing and events with production CSS, pointer methods, gesture helpers and event bindings; host/session rendering fixture, not an Obsidian end-to-end test.',checks:[]};
function check(name,actual,expected){
  let passed=true;try{assert.deepEqual(actual,expected);}catch{passed=false;}
  report.checks.push({name,passed,actual,expected});
}

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE || '/usr/bin/chromium'});
  try{
    const page=await browser.newPage({viewport:{width:1800,height:1100}});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    for(const theme of ['theme-light','theme-dark'])for(const zoom of [.5,1,2]){
      const label=theme+'/zoom '+zoom;
      await page.setContent('<!doctype html><html><body><div class="ts-root"><div class="ts-main"><div class="ts-stage" tabindex="0"><div class="ts-world"></div><svg></svg></div></div></div><aside id="outside">Other panel</aside></body></html>');
      await page.addStyleTag({content:fs.readFileSync(stylesheet,'utf8')});
      // Only host geometry and theme variables are supplied here. Handles use production CSS.
      await page.addStyleTag({content:':root{--background-primary:#fff;--background-secondary:#eee;--background-modifier-border:#999;--text-normal:#222;--text-muted:#555;--text-faint:#777;--font-text:Arial;--font-interface:Arial;--interactive-accent:#277869;--ts-accent:#277869}body.theme-dark{--background-primary:#252525;--background-secondary:#303030;--background-modifier-border:#777;--text-normal:#eee;--text-muted:#ccc;--text-faint:#aaa}body{margin:0;color:var(--text-normal);font-family:var(--font-text);background:var(--background-secondary)}.ts-root{width:1500px;height:1000px}.ts-main{width:1500px;height:1000px}.ts-stage{width:1500px;height:1000px}.ts-stage>svg{position:absolute;inset:0;pointer-events:none}#outside{position:absolute;left:1500px;top:0;width:300px;height:1000px;background:var(--background-secondary)}'});
      await page.locator('body').evaluate((el,theme)=>el.className=theme,theme);
      await page.addScriptTag({content:script});
      await page.evaluate(zoom=>createGestureFixture(zoom),zoom);
      const center=async()=>{const box=await page.locator('[data-id="a"]').boundingBox();assert.ok(box);return{x:box.x+box.width/2,y:box.y+box.height/2};};
      const snapshot=()=>page.evaluate(()=>gestureFixture.snapshot());

      const start=await center();await page.keyboard.down('Shift');await page.mouse.move(start.x,start.y);await page.mouse.down();
      await page.mouse.move(start.x+40*zoom,start.y+15*zoom,{steps:3});await page.mouse.up();await page.keyboard.up('Shift');
      const dragged=await snapshot();
      check(label+': Shift drag preserves both selected cards',dragged.selected,['a','b']);
      check(label+': Shift drag locks the movement axis for both cards',dragged.nodes.map(n=>[n.x,n.y]),[[120,80],[120,300]]);
      check(label+': drag commits exactly once',[dragged.changes,dragged.persist,dragged.gesture],[1,1,false]);

      await page.evaluate(()=>gestureFixture.reset());const click=await center();await page.keyboard.down('Shift');
      await page.mouse.click(click.x,click.y);await page.keyboard.up('Shift');const toggled=await snapshot();
      check(label+': Shift click still toggles the clicked card',toggled.selected,['b']);
      check(label+': Shift click does not save geometry',[toggled.changes,toggled.persist,toggled.gesture],[0,0,false]);

      await page.evaluate(()=>gestureFixture.reset());const handle=await page.locator('[data-id="a"] .ts-resize').boundingBox();assert.ok(handle);
      const grip={x:handle.x+handle.width/2,y:handle.y+handle.height/2};
      check(label+': production resize handle receives the pointer',await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.classList.contains('ts-resize'),grip),true);
      await page.keyboard.down('Shift');await page.mouse.move(grip.x,grip.y);await page.mouse.down();
      await page.mouse.move(grip.x+120*zoom,grip.y+5*zoom,{steps:3});await page.mouse.up();await page.keyboard.up('Shift');const resized=await snapshot();
      check(label+': Shift resize keeps the multi-selection',resized.selected,['a','b']);
      check(label+': Shift resize preserves card aspect ratio',resized.nodes.map(n=>[n.width,n.height]),[[360,240],[240,160]]);
      check(label+': resize commits exactly once',[resized.changes,resized.persist,resized.gesture],[1,1,false]);
      await page.screenshot({path:path.join(output,theme+'-zoom-'+zoom+'.png')});

      await page.evaluate(()=>gestureFixture.reset(true));const stage=await page.locator('.ts-stage').boundingBox();assert.ok(stage);
      const edgeY=stage.y+160*zoom;
      await page.mouse.move(stage.x+stage.width-1,edgeY);await page.mouse.down();
      check(label+': edge click starts an uncaptured gesture',await page.evaluate(()=>!!gestureFixture.view.gesture&&!document.querySelector('.ts-stage').hasPointerCapture(gestureFixture.view.gesture.id)),true);
      await page.mouse.move(stage.x+stage.width+1,edgeY);await page.mouse.up();const released=await snapshot();
      check(label+': release outside stage finishes an uncaptured gesture',[released.gesture,released.dragging,released.changes,released.persist],[false,false,0,0]);
      const next=await page.locator('[data-id="b"]').boundingBox();assert.ok(next);
      await page.mouse.move(next.x+next.width/2,next.y+next.height/2);await page.mouse.down();
      check(label+': next pointer press starts a fresh gesture',await page.evaluate(()=>Math.abs(gestureFixture.view.gesture?.x-(80+120)*gestureFixture.view.session.board.viewport.zoom)<.01),true);
      await page.mouse.up();
    }
    check('browser reports no uncaught errors',errors,[]);
  }finally{await browser.close();}
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  const failed=report.checks.filter(row=>!row.passed);
  console.log(JSON.stringify({passed:report.checks.length-failed.length,failed:failed.length,output}));
  failed.forEach(row=>console.error(JSON.stringify(row)));
  if(failed.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
