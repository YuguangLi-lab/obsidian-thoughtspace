// Browser fixture boundary: workspace chrome is extracted from BoardView.onOpen;
// pointer methods, toolbar/palette navigation and card quick actions are production
// code. Obsidian host APIs, note previews, selected-format contents and persistence
// are represented by a fixture. This is not a native Obsidian end-to-end test.
// PLAYWRIGHT_MODULE=/opt/codex/runtimes/cua/lib/node_modules/playwright node qa/paper-workbench.cjs
// QA_SOURCE and QA_CSS allow the same fixture to document a previous revision.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {build} = require('esbuild');
const {createHash} = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve(process.env.QA_OUTPUT || 'dist/paper-workbench');
const sourcePath = path.resolve(process.env.QA_SOURCE || 'src/main.ts');
const stylesheet = path.resolve(process.env.QA_CSS || 'styles.css');
const source = fs.readFileSync(sourcePath, 'utf8');
const boardStart = source.indexOf('class BoardView extends');
function take(start, end, after = boardStart) {
  const a = source.indexOf(start, after), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'Missing production range: ' + start);
  return source.slice(a, b);
}
const construction = take('  async onOpen() {', "    this.registerDomEvent(this.stage,'pointerdown',e=>{") + '\n  }';
const selectionTool = source.indexOf('  toggleSelectionTool()', boardStart);
const finishStart = source.indexOf('  private finish', selectionTool);
const gestures = take('  private pointerDown(', '  private key(')
  + take('  private finish', '  private foldText(', finishStart)
  + take('  private displayBoard()', '  private renderEdges(');
const bindings = take("    this.registerDomEvent(this.stage, 'pointerdown'", "    this.registerDomEvent(this.stage,'wheel'");
const buttonSource = take('function button(', 'class Prompt', 0);
const report = {
  sourcePath, stylesheet, sourceSha256:createHash('sha256').update(source).digest('hex'), stylesheetSha256:createHash('sha256').update(fs.readFileSync(stylesheet)).digest('hex'),
  scope: 'Chromium with production CSS, extracted BoardView.onOpen chrome, pointer methods, toolbar/palette helpers and card quick actions. Host APIs, note/format rendering and persistence are fixtures; native Obsidian is not covered.',
  checks: [],
};
function check(name, actual, expected = true) {
  let passed = true;
  try { assert.deepEqual(actual, expected); } catch { passed = false; }
  report.checks.push({name, passed, actual, expected});
}

function contrastRatio(foreground,background){
  const luminance=color=>{
    const channels=color.match(/[\d.]+/g).slice(0,3).map(value=>Number(value)/(color.startsWith('color(srgb')?1:255)).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
    return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
  };
  const a=luminance(foreground),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

function installFixture() {
  const ns = 'http://www.w3.org/2000/svg';
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    scan: '<path d="M7 3H4a1 1 0 0 0-1 1v3M17 3h3a1 1 0 0 1 1 1v3M21 17v3a1 1 0 0 1-1 1h-3M7 21H4a1 1 0 0 1-1-1v-3"/>',
    'move-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
    'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
    group: '<rect x="3" y="3" width="18" height="18" rx="3"/><rect x="6" y="7" width="5" height="9" rx="1"/><rect x="14" y="7" width="4" height="5" rx="1"/>',
    'layout-dashboard': '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    'panels-top-left': '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h6"/>',
    'file-plus-2': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 15h8M12 11v8"/>',
    'file-input': '<path d="M14 2H6a2 2 0 0 0-2 2v3M4 17v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M2 12h10M8 8l4 4-4 4"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    'chevron-left': '<path d="m14 6-6 6 6 6"/>', 'chevron-right': '<path d="m10 6 6 6-6 6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>', 'chevron-up': '<path d="m6 15 6-6 6 6"/>',
    ellipsis: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    pencil: '<path d="m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    'panel-right-open': '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M15 3v18M7 9l3 3-3 3"/>',
    'scan-text': '<path d="M7 3H4v4M17 3h3v4M20 17v4h-3M7 21H4v-4M8 8h8M8 12h8M8 16h5"/>',
    'sticky-note': '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10l6-6V5a2 2 0 0 0-2-2ZM15 21v-6h6"/>',
    'folder-open': '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v3M3 7h18l-3 13H3Z"/>',
    focus: '<circle cx="12" cy="12" r="3"/><path d="M7 3H3v4M17 3h4v4M21 17v4h-4M7 21H3v-4"/>',
    star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
    'undo-2': '<path d="M3 7v6h6M3 13c1-7 16-8 17 1 1 5-5 8-9 5"/>',
    'redo-2': '<path d="M21 7v6h-6M21 13c-1-7-16-8-17 1-1 5 5 8 9 5"/>',
    x: '<path d="m6 6 12 12M6 18 18 6"/>',
    magnet: '<path d="M6 3H3v8a9 9 0 0 0 18 0V3h-3v8a6 6 0 0 1-12 0ZM3 7h3M18 7h3"/>',
    ruler: '<path d="m3 17 14-14 4 4L7 21ZM7 13l2 2M11 9l2 2M15 5l2 2"/>',
    palette: '<path d="M12 3C2 3 1 15 7 19c4 3 7 2 7-1 0-2-2-3-1-4 1-2 8 1 8-4 0-4-4-7-9-7Z"/><circle cx="7" cy="9" r=".5"/><circle cx="11" cy="6" r=".5"/><circle cx="16" cy="7" r=".5"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15M15 6v15"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
    'list-tree': '<path d="M3 3v14h4M3 7h4M11 5h10M11 9h6M11 15h10M11 19h6"/>',
    'list-checks': '<path d="m3 6 2 2 4-4M12 6h9M3 14l2 2 4-4M12 14h9M12 20h9"/>',
    'notebook-pen': '<path d="M13 3H5v18h12v-7M2 7h5M2 12h5M2 17h5m8-7 5-5 3 3-5 5-4 1Z"/>',
    'git-fork': '<circle cx="6" cy="3" r="2"/><circle cx="18" cy="3" r="2"/><circle cx="12" cy="21" r="2"/><path d="M6 5v4c0 3 12 3 12 0V5M12 12v7"/>',
  };
  window.qaSetIcon = (el, name) => {
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '18'); svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true'); svg.classList.add('svg-icon', 'lucide-' + name);
    svg.innerHTML = paths[name] || '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8"/>';
    el.replaceChildren(svg);
  };
  function create(tag, options = {}, svg = false) {
    if(typeof options === 'string')options = {cls: options};
    const el = svg ? document.createElementNS(ns, tag) : document.createElement(tag);
    if(options.cls)el.setAttribute('class', options.cls);
    if(options.text !== undefined)el.textContent = options.text;
    for(const [name, value] of Object.entries(options.attr || {}))el.setAttribute(name, value);
    for(const name of ['type', 'placeholder', 'value', 'href'])if(options[name] !== undefined)el[name] = options[name];
    if(options.prepend)this.prepend(el);else this.append(el);
    return el;
  }
  for(const proto of [HTMLElement.prototype, SVGElement.prototype, DocumentFragment.prototype]) {
    proto.createEl = create;
    proto.createDiv = function(options) {return create.call(this, 'div', options);};
    proto.createSpan = function(options) {return create.call(this, 'span', options);};
    proto.createSvg = function(tag, options) {return create.call(this, tag, options, true);};
    proto.empty = function() {this.replaceChildren();};
    proto.setText = function(text) {this.textContent = text;};
    proto.addClass = function(...classes) {this.classList.add(...classes);};
    proto.removeClass = function(...classes) {this.classList.remove(...classes);};
    proto.toggleClass = function(name, value) {this.classList.toggle(name, value);};
    Object.defineProperty(proto, 'win', {get() {return window;}, configurable: true});
  }
  const cleanup = [];
  const calls = {changes: 0, persist: 0, actions: [], errors: []};
  const model = window.qaModel;
  const button = window.qaButton;
  const view = new window.QaBoardView();
  const board = {...model.emptyBoard(),version:3,viewport:{x:0,y:0,zoom:1}};
  const session = {board,blocked:false,file:{basename:'一间有光的工作室',path:'一间有光的工作室.thoughtspace'},persist(){calls.persist++;},change(change){change(board);calls.changes++;this.persist();view.renderBoard();},undo(redo){calls.actions.push(redo?'redo':'undo');}};
  const positions = new Map();
  function action(name) {return () => calls.actions.push(name);}
  const plugin = {settings:{dragThreshold:4,axisLock:true,aspectLock:true,alignmentGuides:false,gridStep:24,showMinimap:true},savePreferences:async()=>calls.actions.push('savePreferences'),promptMindmap:action('mindmap'),openWriting:action('writing'),quickCapture:action('capture'),openSpaceHub:action('hub')};
  Object.assign(view, {
    session, plugin, contentEl:document.querySelector('#board'),containerEl:document.querySelector('#board-host'),file:session.file,
    app:{workspace:{on(){return{};}},vault:{getAbstractFileByPath(){return undefined;}}},
    tab:'library',closed:false,markerId:'qa-board-edges',selected:new Set(),positions,space:false,selectionTool:false,mode:'select',pointerFrame:0,dragging:false,cardToolbarObstacles:[],
    pendingFits:new Map(),nodeFitQueue:{schedule(){}},viewTrail:{remember(){}},blankClicks:{cancel(){}},
    register(fn){cleanup.push(fn);},registerEvent(){},registerDomEvent(target,event,handler,options){target.addEventListener(event,handler,options);cleanup.push(()=>target.removeEventListener(event,handler,options));},
    refreshFontMetrics(){},retryDeferredCardFits(){},scheduleRender(){requestAnimationFrame(()=>this.renderBoard());},applyPreferences(){this.contentEl.dataset.background='dots';this.contentEl.dataset.surface='paper';},
    addAction(icon,label,run){return button(document.querySelector('.view-actions'),label,icon,run,'clickable-icon');},
    syncCanvasControls(){if(this.zoomLabel)this.zoomLabel.textContent=Math.round(board.viewport.zoom*100)+'%';if(this.canvasSummary)this.canvasSummary.textContent=board.nodes.filter(n=>n.kind==='card').length+' 张卡片 · '+board.edges.length+' 条连线';if(this.boardStats)this.boardStats.textContent='设计探索 · '+board.nodes.length+' 个对象';},
    point(x,y){const r=this.stage.getBoundingClientRect();return{x:(x-r.left-board.viewport.x)/board.viewport.zoom,y:(y-r.top-board.viewport.y)/board.viewport.zoom};},
    positionNode(node,el){Object.assign(el.style,{left:node.x+'px',top:node.y+'px',width:node.width+'px',height:node.height+'px'});if(node.borderWidth!==undefined)el.style.borderWidth=node.borderWidth+'px';if(this.stage&&node.kind==='card'){const control=window.qaCardControlLayout(node,board.viewport,this.stage.clientWidth,this.stage.clientHeight,5,{width:236,height:36,topReserve:this.cardToolbarReserve||60,avoid:this.cardToolbarObstacles});for(const [name,value]of [['scale',String(control.scale)],['top',control.top+'px'],['right',control.right+'px']])el.style.setProperty('--ts-control-'+name,value);}},
    cancelConnection(){},setSectionTool(){},contextMenu(){},previewGridLanding(){},drawAlignmentGuides(){},
    titleMenu:action('titleMenu'),renameBoard:action('rename'),findOnBoard:action('find'),openSavedViews:action('savedViews'),toggleFocus:action('focus'),headerWorkspaceMenu:action('workspace'),
    toggleSelectionTool(){this.selectionTool=!this.selectionTool;this.selectionButton.classList.toggle('is-active',this.selectionTool);},
    toggleConnectionTool(){this.mode=this.mode==='connect'?'select':'connect';this.connectButton.classList.toggle('is-active',this.mode==='connect');},
    newCard:action('newCard'),newText:action('newText'),insertExistingNote:action('insertNote'),imageMenu:action('image'),insertPdfCard:action('pdf'),insertMediaCard:action('media'),newWebCard:action('web'),newTable:action('table'),newChildBoard:action('board'),sectionAction:action('section'),openLayoutPlanner:action('arrange'),
    sectionNavigator:action('sections'),openGroupOrganizer:action('group'),openReuse:action('reuse'),unifyEdgeStyle:action('edgeStyle'),openMaterials:action('materials'),openStudio:action('studio'),workspaceMenu:action('snapshot'),boardActions:action('boardActions'),openMindmapStudio:action('mindmapStudio'),addTopic:action('topic'),layoutTopics:action('layoutTopics'),showCanvasBackgroundMenu:action('background'),
    zoom(factor){board.viewport.zoom*=factor;this.transform();this.syncCanvasControls();},fit:action('fit'),focusSelection:action('focusSelection'),zoomPresets:action('zoomPresets'),
    selectTab(id){this.tab=id;for(const el of this.sidebar.querySelectorAll('[role=tab]')){const active=el.textContent===({library:'卡片',boards:'白板',tasks:'任务',outline:'大纲'})[id];el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;el.toggleClass('is-active',active);}},renderSidebar(){},
    renderInspector(){this.renderFixtureFormats();},
    updateSelection(){for(const [id,el] of positions)el.toggleClass('is-selected',this.selected.has(id));this.renderInspector();},
    transform(){this.world.style.transform='translate('+board.viewport.x+'px,'+board.viewport.y+'px) scale('+board.viewport.zoom+')';this.renderEdges();},
    renderEdges(){this.edgeLayer?.render(board,this.stage.clientWidth,this.stage.clientHeight);},
    renderBoard(){for(const node of board.nodes){const el=positions.get(node.id);if(el)this.positionNode(node,el);}this.transform();this.syncCanvasControls();},
    renderFixtureFormats(){
      const host=this.selectionTools,heading=this.selectionHeading;if(!host||!heading)return;host.empty();heading.empty();
      host.toggleClass('is-visible',this.selected.size>0);if(!this.selected.size)return;
      const modes=heading.createDiv({cls:'ts-format-mode',attr:{role:'group','aria-label':'编辑工具'}});
      for(const [name,icon,label]of [['markdown','pencil','编辑'],['card','panels-top-left','卡片'],['text','type','文字'],['fill','palette','背景'],['border','group','边框']]){
        const control=button(modes,label,icon,name==='markdown'?()=>this.startFixtureEdit():action(name),'ts-format-mode-button');control.dataset.mode=name;control.setAttribute('aria-pressed',String(name==='text'));control.toggleClass('is-active',name==='text');control.lastElementChild.className='ts-format-mode-label';
      }
      const fields=host.createDiv({cls:'ts-appearance-group',attr:{role:'group','aria-label':'文字外观','data-appearance-panel':'text'}});
      for(const [name,icon,values] of [['字体','type',['正文字体','衬线字体','等宽字体']],['字号','type',['14 px','16 px','18 px']],['文字颜色','pencil',['默认','灰色','绿色']],['文字对齐','list-tree',['左对齐','居中','右对齐']]]){
        const field=fields.createEl('label',{cls:'ts-format-field',attr:{'data-format':name}});window.qaSetIcon(field.createSpan('ts-format-label-icon'),icon);field.createSpan({cls:'ts-format-label',text:({'文字颜色':'字色','文字对齐':'对齐'})[name]||name});const select=field.createEl('select',{attr:{'aria-label':name}});for(const value of values)select.createEl('option',{text:value});
      }
      const transfer=host.createDiv({cls:'ts-style-transfer',attr:{role:'group','aria-label':'复制与粘贴外观'}});button(transfer,'复制对象样式','pencil',action('copyStyle'),'ts-icon-button');button(transfer,'粘贴对象样式','palette',action('pasteStyle'),'ts-icon-button').disabled=true;
    },
    startFixtureEdit(){
      const id=[...this.selected][0],el=positions.get(id);if(!el)return;el.addClass('is-inline-editing');
      const preview=el.querySelector('.ts-card-preview');if(preview)preview.hidden=true;
      const editor=el.createDiv('ts-inline-editor');const input=editor.createEl('textarea',{cls:'ts-inline-textarea',attr:{'aria-label':'编辑卡片 Markdown'}});input.value='## 把美感带入日常\n\n留出呼吸感，让重要的想法自然浮现。';input.focus();
      this.inline={input,checkFocus(){},saving:false};return input;
    },
  });
  window.paperFixture={view,board,calls,cleanup,positions,select(ids){view.selected=new Set(ids);view.updateSelection();},snapshot(){return{selected:[...view.selected].sort(),nodes:board.nodes.map(n=>({id:n.id,x:n.x,y:n.y,width:n.width,height:n.height})),gesture:!!view.gesture,changes:calls.changes,persist:calls.persist,actions:[...calls.actions],errors:[...calls.errors]};}};
  window.paperFixture.empty=()=>{view.selected.clear();view.updateSelection();board.nodes=[];board.edges=[];positions.clear();view.world.querySelectorAll('.ts-node').forEach(el=>el.remove());view.svg.hidden=true;view.startScreen.hidden=false;view.minimap.empty();view.minimap.hidden=true;view.syncCanvasControls();};
  window.paperFixture.mount = async () => {
    await view.onOpen();view.bind();
    document.querySelector('.ts-dock-host').append(view.sidebar);
    const list=view.list;
    const summary=list.createDiv('ts-library-section-heading');summary.createSpan({text:'今天的灵感'});summary.createSpan({text:'6 张卡片'});
    for(const [title,copy,tag] of [['把美感带入日常','少一点噪声，多一点专注。','#设计'],['柔和与秩序','暖色、留白、轻盈的边界。','#灵感'],['下一步行动','把一个好想法变成可完成的小事。','#计划'],['阅读摘录','设计是关系，也是看见。','#阅读']]){
      const item=list.createDiv({cls:'ts-library-card',attr:{tabindex:'0',draggable:'true'}});const head=item.createDiv('ts-library-card-head');window.qaSetIcon(head.createSpan(),'file-text');head.createSpan({text:title});item.createDiv({cls:'ts-library-card-preview',text:copy});item.createDiv({cls:'ts-library-card-meta',text:tag});
    }
    board.nodes=[
      {id:'group',kind:'section',title:'灵感与方向',x:70,y:200,width:665,height:390,color:'sand'},
      {id:'a',kind:'card',file:'美感.md',title:'把美感带入日常',x:96,y:262,width:286,height:252,color:'sand',autoFit:false},
      {id:'b',kind:'card',file:'秩序.md',title:'柔和与秩序',x:412,y:278,width:290,height:230,color:'blue',autoFit:false},
      {id:'c',kind:'card',file:'计划.md',title:'下一步行动',x:798,y:330,width:265,height:243,color:'green',autoFit:false},
      {id:'idea',kind:'text',text:'一间有光的工作室',x:98,y:150,width:520,height:52,color:'sand',fontSize:30,borderWidth:0},
      {id:'reflection',kind:'text',text:'看见想法之间的关系，\n从容地走向下一个开始。',x:797,y:216,width:277,height:75,color:'sand',fontSize:17,borderWidth:0},
      {id:'quote',kind:'text',text:'好的设计，让思考像呼吸一样自然。',x:100,y:638,width:720,height:44,color:'sand',fontSize:17,borderWidth:0},
    ];
    board.edges=[{id:'edge-ab',from:'a',to:'b',fromSide:'right',toSide:'left',style:'curve',color:'sand',direction:'forward'}, {id:'edge-bc',from:'b',to:'c',fromSide:'right',toSide:'left',style:'curve',color:'green',direction:'forward',label:'付诸行动'}];
    const previews={
      a:'<h3>少一点噪声，多一点专注。</h3><p>整理一张白板，也是在为思考腾出空间。让内容有层次，让操作触手可及。</p><ul><li>留白让重要的东西被看见</li><li>温暖的纸张，清晰的关系</li></ul>',
      b:'<h3>温暖，但保持清晰</h3><p>用柔和的底色、细腻的边界和轻盈的阴影，把零散想法放在同一张桌面。</p><blockquote>每一张卡片，都值得被认真看见。</blockquote>',
      c:'<h3>让想法慢慢成形</h3><ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" checked disabled> 收集今天的灵感</li><li class="task-list-item"><input type="checkbox" checked disabled> 找到核心主题</li><li class="task-list-item"><input type="checkbox" disabled> 完成第一版原型</li></ul><p>从一个可以完成的小步骤开始。</p>',
    };
    for(const node of board.nodes){
      const el=view.world.createDiv({cls:'ts-node ts-'+node.kind+' ts-color-'+node.color,attr:{'data-id':node.id}});positions.set(node.id,el);view.positionNode(node,el);
      if(node.kind==='section'){const header=el.createDiv('ts-node-header');window.qaSetIcon(header.createSpan(),'folder-open');header.createSpan({cls:'ts-section-title',text:node.title});button(header,'折叠分组','chevron-up',action('foldGroup'),'ts-section-fold ts-section-content-fold').lastElementChild.textContent='内容';el.createDiv({cls:'ts-resize',attr:{'aria-label':'拖动调整大小'}});continue;}
      if(node.kind==='text'){const body=el.createDiv('ts-text-body markdown-rendered');body.createEl('p',{text:node.text});body.style.fontSize=node.fontSize+'px';continue;}
      el.dataset.controlCount='5';el.dataset.controlWidth='236';
      const header=el.createDiv('ts-node-header');window.qaSetIcon(header.createSpan(),'file-text');header.createSpan({text:node.title});
      const actions=el.createDiv('ts-card-actions');window.qaMountCardQuickActions(actions,{kind:'card',add:(label,icon,fn,cls)=>button(actions,label,icon,fn,cls),edit:()=>{view.selected=new Set([node.id]);view.updateSelection();view.startFixtureEdit();},read:action('read'),preview:action('preview'),toggleAutoFit:action('autoFit'),fold:action('fold'),autoFit:false});
      const preview=el.createDiv('ts-card-preview markdown-rendered');preview.innerHTML=previews[node.id];
      const meta=el.createDiv('ts-card-meta');meta.createSpan({cls:'ts-state-pill ts-state-active',text:node.id==='c'?'进行中':'灵感'});meta.createEl('a',{cls:'ts-tag tag',text:node.id==='c'?'#计划':'#设计',href:'#设计'});
      el.createDiv({cls:'ts-resize',attr:{'aria-label':'拖动调整大小'}});
    }
    view.renderBoard();view.status.textContent='已保存';
    const map=view.minimap;const svg=map.createSvg('svg',{attr:{viewBox:'0 0 1150 780','aria-hidden':'true'}});for(const n of board.nodes.filter(n=>n.kind!=='text'))svg.createSvg('rect',{attr:{x:n.x,y:n.y,width:n.width,height:n.height,rx:'12',fill:n.kind==='section'?'#d7cabb':'#8eaa9c',opacity:n.kind==='section'?'.3':'.7'}});
    const stage=view.stage;
    const responsive=()=>{if(window.innerWidth<900){const zoom=window.innerWidth<450?.44:.66;board.viewport={x:20,y:30,zoom};}else board.viewport={x:5,y:10,zoom:1};view.renderBoard();};
    responsive();window.addEventListener('resize',responsive);cleanup.push(()=>window.removeEventListener('resize',responsive));
    return{width:stage.clientWidth,height:stage.clientHeight};
  };
}

const hostCSS = [
  ':root{--background-primary:#fffdfa;--background-secondary:#f7f3ed;--background-secondary-alt:#f0ebe3;--background-modifier-border:#dcd5ca;--background-modifier-border-hover:#bfb4a4;--background-modifier-hover:#ece6dc;--background-modifier-box-shadow:#413426;--text-normal:#403d37;--text-muted:#807b71;--text-faint:#aaa295;--text-on-accent:#fff;--interactive-normal:#fffdfa;--interactive-hover:#f0ebe3;--interactive-accent:#608776;--interactive-accent-hover:#517764;--text-accent:#608776;--font-text:"Noto Sans CJK SC",Arial,sans-serif;--font-interface:"Noto Sans CJK SC",Arial,sans-serif;--font-monospace:monospace;--font-ui-small:12px;--font-ui-smaller:11px;--font-ui-medium:14px;--font-text-size:14px;--input-height:30px;--radius-s:5px;--radius-m:8px;--radius-l:12px;--icon-size:18px;--icon-stroke:1.7}',
  'body.theme-dark{--background-primary:#252724;--background-secondary:#1e211e;--background-secondary-alt:#2d302b;--background-modifier-border:#474c43;--background-modifier-border-hover:#717768;--background-modifier-hover:#363c33;--text-normal:#e4e4da;--text-muted:#a6aa9a;--text-faint:#787f6f;--interactive-normal:#30352d;--interactive-hover:#3c4437;--interactive-accent:#94b39b;--text-accent:#94b39b;--text-on-accent:#202720}',
  '*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{color:var(--text-normal);font-family:var(--font-interface);font-size:14px;background:var(--background-secondary)}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer}button:disabled{cursor:default}button{border:1px solid var(--background-modifier-border);background:var(--interactive-normal);border-radius:5px;padding:5px 9px}svg.svg-icon{display:block}button>span:first-child:has(svg){display:flex}input,select,textarea{border:1px solid var(--background-modifier-border);background:var(--background-primary);border-radius:5px;padding:4px 7px}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--interactive-accent);outline-offset:2px}[hidden]{display:none!important}',
  '#host{display:flex;width:100vw;height:100vh}.qa-dock-host{flex:0 0 268px;min-width:0;height:100%}#dock{width:100%;height:100%}#board-host{flex:1;min-width:0;height:100%;display:flex;flex-direction:column}#board{flex:1;min-height:0;width:100%}.view-header{height:40px;flex:none;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-primary);gap:12px}.view-header-title-container{min-width:0;flex:1}.view-header-title{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.view-actions{display:flex;align-items:center;gap:2px}.clickable-icon{border:0;background:transparent;padding:5px;display:flex;align-items:center;justify-content:center;box-shadow:none}.clickable-icon>span:last-child{display:none}.markdown-rendered{line-height:1.65}.markdown-rendered h3{font-size:17px;font-weight:600;line-height:1.45;margin:0 0 14px}.markdown-rendered p{margin:0 0 13px}.markdown-rendered ul{margin:0;padding-left:21px}.markdown-rendered li{margin:5px 0}.markdown-rendered blockquote{margin:16px 0 0;padding:0 0 0 12px;border-left:2px solid var(--background-modifier-border);color:var(--text-muted)}.task-list-item{list-style:none}.task-list-item input{margin-right:7px;accent-color:var(--interactive-accent)}.contains-task-list{padding-left:0!important}.ts-inline-editor textarea{display:block;width:100%;height:190px;resize:none}.ts-library-section-heading{display:flex;justify-content:space-between;padding:8px 2px 14px;font-size:11px;color:var(--text-muted)}.ts-library-card-preview{font-size:12px;line-height:1.6;color:var(--text-muted);padding-top:8px}',
  '@media(max-width:899px){.qa-dock-host{display:none}.view-header{height:36px;padding:0 8px}.view-header-title{font-size:11px}.view-actions .ts-save-status,.view-actions .ts-board-history-action~.ts-header-action:not(.ts-workspace-menu-entry){display:none}}',
].join('\n');

async function browserScript() {
  const imports = [
    "import * as model from './src/model';import {visibleBranchBoard} from './src/mindmap';",
    "import {dragStartSnapshot,dragDisplayBoard,dragGeometry,dragCommitChanges} from './src/drag-draft';",
    "import {dragTargets,activeDragTargets} from './src/drag-targets';import {constrainedDrag,resized} from './src/board-experience';import {resizedSection} from './src/section-resize';import {selectionEdges} from './src/selection-edges';",
    "import {toolbarNavigation} from './src/toolbar-navigation';import {installToolbarWheel} from './src/toolbar-scroll';import {installToolbarOverflow} from './src/toolbar-overflow';import {installToolPalettes} from './src/tool-palette';import {installRailToolSearch} from './src/rail-tool-search';import {sidebarSearchNavigation} from './src/sidebar-navigation';import {EdgeLayer} from './src/edge-layer';import {gridSteps} from './src/canvas-controls';import {whenBoardStylesReady} from './src/stylesheet-ready';import {mountCardQuickActions} from './src/card-quick-actions';import {cardControlLayout} from './src/card-control-layout';import {setIcon} from 'obsidian';",
    'const {movableSelection}=model;const act=(fn)=>{try{Promise.resolve(fn()).catch(error=>paperFixture.calls.errors.push(String(error)));}catch(error){paperFixture.calls.errors.push(String(error));}};class Notice{constructor(message){paperFixture.calls.errors.push(String(message));}};',
    buttonSource,
    'class QaBoardView{' + construction + gestures + 'bind(){' + bindings + '}}',
    'window.QaBoardView=QaBoardView;window.qaModel=model;window.qaButton=button;window.qaMountCardQuickActions=mountCardQuickActions;window.qaCardControlLayout=cardControlLayout;',
    '(' + installFixture.toString() + ')();',
  ].join('\n');
  const result = await build({stdin:{contents:imports,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'iife',platform:'browser',plugins:[{name:'obsidian-host-fixture',setup(builder){builder.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'qa'}));builder.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export const setIcon=(el,name)=>window.qaSetIcon(el,name);export class Menu{setUseNativeMenu(){return this;}addItem(){return this;}onHide(){return this;}showAtPosition(){}}'}));}}]});
  return result.outputFiles[0].text;
}
function overlap(a,b){return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));}

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const script=await browserScript();
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/usr/bin/chromium'});
  const errors=[];
  try{
    const page=await browser.newPage();page.on('pageerror',error=>errors.push(String(error)));
    const content='<html><body><div id="host"><aside class="qa-dock-host"><div id="dock" class="ts-root ts-dock"><div class="ts-dock-body"><header class="ts-dock-launchpad" aria-label="知识空间入口"><div class="ts-dock-quick"><button class="ts-button ts-primary" aria-label="收集笔记">＋ 收集笔记</button><button class="ts-button ts-dock-create">新建⌄</button></div><nav class="ts-dock-shortcuts"><button class="ts-button">空间总览</button><button class="ts-button">笔记摘录</button></nav></header><div class="ts-dock-host"></div></div><div class="ts-dock-workspace-tools"><button class="ts-button ts-dock-organize-button">整理白板</button><button class="ts-button ts-dock-organize-button ts-dock-section-preview">分组预览</button></div></div></aside><main id="board-host"><header class="view-header"><div class="view-header-title-container"><div class="view-header-title">一间有光的工作室</div></div><div class="view-actions"></div></header><div id="board"></div></main></div></body></html>';
    const sizes=[{width:1440,height:900,name:'desktop'},{width:760,height:800,name:'narrow'},{width:320,height:720,name:'small'}];
    for(const theme of ['light','dark'])for(const size of sizes){
      const label=theme+'/'+size.name;
      await page.setViewportSize({width:size.width,height:size.height});
      await page.setContent(content);await page.locator('body').evaluate((el,theme)=>el.className='theme-'+theme,theme);
      await page.addStyleTag({content:hostCSS});await page.addStyleTag({content:fs.readFileSync(stylesheet,'utf8')});
      await page.addScriptTag({content:script});await page.evaluate(()=>paperFixture.mount());await page.waitForTimeout(120);
      await page.screenshot({path:path.join(output,theme+'-'+size.name+'.png')});
      if(process.env.QA_ONLY_SCREENSHOTS==='1'){await page.evaluate(()=>paperFixture.select(['a']));await page.waitForTimeout(80);await page.screenshot({path:path.join(output,theme+'-'+size.name+'-selected.png')});await page.evaluate(()=>paperFixture.empty());await page.waitForTimeout(50);await page.screenshot({path:path.join(output,theme+'-'+size.name+'-empty.png')});await page.evaluate(()=>paperFixture.cleanup.forEach(fn=>fn()));continue;}
      // Host theme variables must flow through both board and navigator. Test the
      // actual computed values, so a hard-coded descendant palette fails here.
      const inherited=await page.evaluate(()=>{
        const names=['--background-primary','--background-secondary','--text-normal','--text-muted','--font-text'];
        return [...document.querySelectorAll('.ts-root')].flatMap(root=>names.map(name=>({root:root.id,name,host:getComputedStyle(document.body).getPropertyValue(name).trim(),actual:getComputedStyle(root).getPropertyValue(name).trim()})));
      });
      for(const item of inherited)check(label+': '+item.root+' inherits '+item.name,item.actual,item.host);
      const accentColors=await page.evaluate(()=>{
        const roots=[...document.querySelectorAll('.ts-root')],controls=[document.querySelector('#board .ts-start-actions .ts-primary'),document.querySelector('#dock .ts-dock-quick .ts-primary')].filter(Boolean);
        const previous=roots.map(root=>({root,accent:root.getAttribute('data-accent'),ink:root.style.getPropertyValue('--text-on-accent'),hostAccent:root.style.getPropertyValue('--interactive-accent')})),transitions=controls.map(el=>({el,value:el.style.transition}));
        const results=[];for(const el of controls)el.style.transition='none';
        for(const accent of ['forest','blue','amber','rose'])for(const hostInk of ['#fff','#000']){
          for(const root of roots){root.dataset.accent=accent;root.style.setProperty('--text-on-accent',hostInk);root.style.setProperty('--interactive-accent',hostInk==='#fff'?'#416954':'#94b39b');}
          for(const el of controls){const text=el.lastElementChild||el;results.push({accent,hostInk,label:el.getAttribute('aria-label')||el.textContent.trim(),foreground:getComputedStyle(text).color,background:getComputedStyle(el).backgroundColor});}
        }
        for(const {root,accent,ink,hostAccent}of previous){if(accent===null)root.removeAttribute('data-accent');else root.setAttribute('data-accent',accent);if(ink)root.style.setProperty('--text-on-accent',ink);else root.style.removeProperty('--text-on-accent');if(hostAccent)root.style.setProperty('--interactive-accent',hostAccent);else root.style.removeProperty('--interactive-accent');}
        for(const {el,value}of transitions){if(value)el.style.transition=value;else el.style.removeProperty('transition');}return results;
      });
      for(const colors of accentColors){const ratio=contrastRatio(colors.foreground,colors.background);check(label+': '+colors.label+' text contrast for '+colors.accent+' with host ink '+colors.hostInk,ratio>=4.5);report.checks[report.checks.length-1].contrast=Number(ratio.toFixed(2));report.checks[report.checks.length-1].colors=colors;}
      const boxes={};for(const selector of ['.ts-stage','.ts-board-rail','.ts-footer'])boxes[selector]=await page.locator('#board '+selector).boundingBox();
      const stage=boxes['.ts-stage'],rail=boxes['.ts-board-rail'],footer=boxes['.ts-footer'];
      check(label+': stage remains usable',!!stage&&stage.width>=300&&stage.height>=500);
      for(const [selector,box] of Object.entries(boxes))if(box)check(label+': '+selector+' stays within viewport',box.x>=-1&&box.y>=-1&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1);
      check(label+': canvas keeps creation within the floating tool dock',await page.locator('#board .ts-workbench-bar').count(),0);
      if(rail&&footer)check(label+': tool dock does not overlap view controls',overlap(rail,footer)<1);
      check(label+': tool dock is vertical at the left canvas edge',!!rail&&rail.width<=60&&rail.height>rail.width&&rail.x>=stage.x&&rail.x+rail.width<stage.x+90);
      check(label+': tool dock exposes its vertical keyboard orientation',await page.locator('#board .ts-board-rail').getAttribute('aria-orientation'),'vertical');
      check(label+': document has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
      const create=page.locator('#board .ts-board-rail').getByRole('button',{name:'新建卡片',exact:true});await create.focus();await page.screenshot({path:path.join(output,theme+'-'+size.name+'-focused.png')});await create.click();check(label+': floating creation receives a real click',await page.evaluate(()=>paperFixture.calls.actions.includes('newCard')));
      const footerFirst=page.locator('#board .ts-view-dock button').first();await footerFirst.focus();await page.keyboard.press('End');
      check(label+': footer End navigation reaches overview control',await page.evaluate(()=>document.activeElement?.classList.contains('ts-overview-toggle')));
      check(label+': keyboard reveals footer control for pointer hit testing',await page.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;}));
      await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');check(label+': fit button remains bound after keyboard scrolling',await page.evaluate(()=>paperFixture.calls.actions.includes('fit')));
      await page.evaluate(()=>{document.activeElement?.blur();document.querySelector('.ts-view-dock').scrollLeft=0;});
      const first=page.locator('#board .ts-board-rail button').first();await first.focus();await page.keyboard.press('ArrowDown');
      check(label+': production rail keyboard navigation moves focus',await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')), '连线');
      await page.keyboard.press('ArrowUp');check(label+': vertical Up returns to the selection control',await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'框选');
      const insert=page.locator('#board .ts-insert-content-entry');await insert.focus();await page.keyboard.press('Enter');
      check(label+': insert menu opens with keyboard',await page.locator('#board .ts-insert-palette').isVisible());
      const panelBox=await page.locator('#board .ts-insert-palette').boundingBox();
      check(label+': insert panel stays inside viewport',!!panelBox&&panelBox.x>=0&&panelBox.y>=0&&panelBox.x+panelBox.width<=size.width+1&&panelBox.y+panelBox.height<=size.height+1);
      await page.keyboard.press('Escape');check(label+': Escape closes palette and restores trigger',await page.evaluate(()=>document.activeElement?.classList.contains('ts-insert-content-entry')&&document.querySelector('.ts-insert-palette').hidden));
      await page.locator('#board .ts-arrange-entry').focus();await page.keyboard.press('Enter');check(label+': arrange control remains bound',await page.evaluate(()=>paperFixture.calls.actions.includes('arrange')));
      await page.evaluate(()=>paperFixture.select(['a']));await page.waitForTimeout(80);
      const format=await page.locator('#board .ts-floating-formatbar').boundingBox();
      check(label+': selected formatting stays within viewport',!!format&&format.x>=-1&&format.x+format.width<=size.width+1);
      if(rail&&format)check(label+': selection formatting does not overlap tool dock',overlap(rail,format)<1);
      check(label+': card actions avoid the settled rail position after formatting appears',await page.evaluate(()=>{
        const main=document.querySelector('.ts-main').getBoundingClientRect(),rail=document.querySelector('.ts-board-rail').getBoundingClientRect(),obstacle=paperFixture.view.cardToolbarObstacles[0];
        return !!obstacle&&Math.abs(obstacle.x-(rail.left-main.left-6))<1&&Math.abs(obstacle.y-(rail.top-main.top-6))<1;
      }));
      check(label+': selected card edit action receives a pointer hit',await page.locator('[data-id="a"] .ts-card-quick-edit').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;}));report.checks[report.checks.length-1].hit=await page.locator('[data-id="a"] .ts-card-quick-edit').evaluate(el=>{const r=el.getBoundingClientRect();return{bounds:r.toJSON(),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML,rail:document.querySelector('.ts-board-rail').getBoundingClientRect().toJSON()};});
      await page.screenshot({path:path.join(output,theme+'-'+size.name+'-selected.png')});
      if(size.name==='desktop'){
        const card=await page.locator('[data-id="a"]').boundingBox();const start={x:card.x+card.width/2,y:card.y+100};
        await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+48,start.y+24,{steps:4});await page.mouse.up();
        check(label+': production pointer drag commits geometry',await page.evaluate(()=>{const n=paperFixture.board.nodes.find(n=>n.id==='a');return[n.x,n.y,paperFixture.snapshot().gesture];}),[144,286,false]);
        const handle=await page.locator('[data-id="a"]>.ts-resize').boundingBox();const grip={x:handle.x+handle.width/2,y:handle.y+handle.height/2};
        check(label+': resize handle receives real pointer hit',await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.classList.contains('ts-resize'),grip));
        await page.mouse.move(grip.x,grip.y);await page.mouse.down();await page.mouse.move(grip.x+40,grip.y+28,{steps:3});await page.mouse.up();
        check(label+': production resize commits size',await page.evaluate(()=>{const n=paperFixture.board.nodes.find(n=>n.id==='a');return[n.width,n.height];}),[326,280]);
        await page.locator('[data-id="a"] .ts-card-quick-edit').click();
        check(label+': card quick edit focuses fixture editor',await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'编辑卡片 Markdown');
        await page.screenshot({path:path.join(output,theme+'-'+size.name+'-editor.png')});
        await page.evaluate(()=>{document.querySelector('.ts-inline-editor')?.remove();document.querySelector('[data-id="a"]').removeClass('is-inline-editing');document.querySelector('[data-id="a"] .ts-card-preview').hidden=false;paperFixture.view.inline=undefined;});
      }
      await page.evaluate(()=>paperFixture.empty());
      await page.waitForTimeout(50);await page.screenshot({path:path.join(output,theme+'-'+size.name+'-empty.png')});
      const empty=await page.locator('#board .ts-start-screen').boundingBox();
      check(label+': empty state stays inside stage',!!empty&&empty.x>=stage.x-1&&empty.y>=stage.y-1&&empty.x+empty.width<=stage.x+stage.width+1&&empty.y+empty.height<=stage.y+stage.height+1);
      await page.getByRole('button',{name:'写下想法',exact:true}).click();check(label+': empty-state creation action stays bound',await page.evaluate(()=>paperFixture.calls.actions.includes('newText')));
      check(label+': fixture catches no command errors',await page.evaluate(()=>paperFixture.calls.errors),[]);await page.evaluate(()=>paperFixture.cleanup.forEach(fn=>fn()));
    }
    if(process.env.QA_ONLY_SCREENSHOTS!=='1')for(const theme of ['light','dark'])for(const short of [{height:300,name:'short',scroll:false},{height:220,name:'shortest',scroll:true}]){
      const label=theme+'/short 640x'+short.height+' with 82px host header';
      await page.setViewportSize({width:640,height:short.height});await page.setContent(content);
      await page.locator('body').evaluate((el,theme)=>el.className='theme-'+theme,theme);
      await page.addStyleTag({content:hostCSS});await page.addStyleTag({content:fs.readFileSync(stylesheet,'utf8')});
      // Model the native leaf's combined tab/title height found during Obsidian
      // verification. Only host geometry changes; the canvas styles stay real.
      await page.addStyleTag({content:'#board-host > .view-header{height:82px;min-height:82px}'});
      await page.addScriptTag({content:script});await page.evaluate(()=>paperFixture.mount());
      await page.evaluate(()=>paperFixture.select(['a']));await page.waitForTimeout(120);
      const format=await page.locator('#board .ts-floating-formatbar').boundingBox(),footer=await page.locator('#board .ts-footer').boundingBox(),stage=await page.locator('#board .ts-stage').boundingBox(),rail=await page.locator('#board .ts-board-rail').boundingBox();
      check(label+': context tools retain a usable minimum height',!!format&&format.height>=36);
      check(label+': context tools stay within stage',!!format&&format.x>=stage.x-1&&format.y>=stage.y-1&&format.x+format.width<=stage.x+stage.width+1&&format.y+format.height<=stage.y+stage.height+1);
      check(label+': context tools do not overlap footer',!!format&&!!footer&&overlap(format,footer)<1);report.checks[report.checks.length-1].bounds={format,footer,stage};
      check(label+': context tools do not overlap vertical rail',!!format&&!!rail&&overlap(format,rail)<1);
      check(label+': vertical rail does not overlap footer',!!rail&&!!footer&&overlap(rail,footer)<1);
      const create=page.locator('#board .ts-board-rail').getByRole('button',{name:'新建卡片',exact:true});await create.focus();
      check(label+': compact creation button receives pointer hits',await create.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;}));
      await page.locator('#board .ts-board-rail button').first().focus();await page.keyboard.press('ArrowDown');
      check(label+': compact rail Down reaches the next tool',await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'连线');
      await page.keyboard.press('End');
      check(label+': compact rail End reveals the last tool for pointer hits',await page.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect(),rail=el.closest('.ts-board-rail'),p=rail.getBoundingClientRect();return r.top>=p.top+rail.clientTop-1&&r.bottom<=p.top+rail.clientTop+rail.clientHeight+1&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;}));
      check(label+': compact rail uses its own vertical viewport',await page.locator('#board .ts-board-rail').evaluate(el=>el.scrollHeight>el.clientHeight&&el.scrollTop>0));
      await page.keyboard.press('Home');
      await page.screenshot({path:path.join(output,theme+'-'+short.name+'-selected.png')});
      if(!short.scroll){await page.evaluate(()=>paperFixture.cleanup.forEach(fn=>fn()));continue;}
      check(label+': bounded context offers local vertical scrolling',await page.evaluate(()=>{const el=document.querySelector('.ts-floating-formatbar');return el.scrollHeight>el.clientHeight&&getComputedStyle(el).overflowY==='auto';}));
      await page.mouse.move(format.x+format.width/2,format.y+format.height/2);await page.mouse.wheel(0,180);await page.waitForTimeout(120);
      check(label+': real wheel scrolls the context panel',await page.evaluate(()=>document.querySelector('.ts-floating-formatbar').scrollTop>0));
      const later=page.locator('#board select[aria-label="文字对齐"]'),field=await later.boundingBox();const point={x:field.x+field.width/2,y:field.y+field.height/2};
      check(label+': later property is visible inside bounded context',point.x>=format.x&&point.x<=format.x+format.width&&point.y>=format.y&&point.y<=format.y+format.height);
      check(label+': scrolled property receives real pointer hit',await page.evaluate(point=>document.elementFromPoint(point.x,point.y)?.closest('select')?.getAttribute('aria-label')==='文字对齐',point));
      await later.click();check(label+': later property can receive mouse focus',await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'文字对齐');await page.keyboard.press('Escape');
      await page.screenshot({path:path.join(output,theme+'-'+short.name+'-scrolled.png')});
      // Keep a heading button focused while wheeling to later fields, then
      // exercise the production End handler. preventScroll must reveal only
      // the bounded context panel, leaving the canvas and card preview alone.
      await page.locator('#board .ts-format-heading .ts-format-mode-button').first().focus();
      await page.mouse.move(format.x+format.width/2,format.y+format.height/2);await page.mouse.wheel(0,180);await page.waitForTimeout(120);
      const beforeKeyboard=await page.evaluate(()=>{const stage=paperFixture.view.stage,preview=document.querySelector('[data-id="a"] .ts-card-preview');return{panel:document.querySelector('.ts-floating-formatbar').scrollTop,stage:[stage.scrollLeft,stage.scrollTop],preview:[preview.scrollLeft,preview.scrollTop],transform:paperFixture.view.world.style.transform};});
      check(label+': heading retains keyboard focus after local wheel',await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'编辑');
      await page.keyboard.press('End');
      check(label+': End reaches the final contextual mode',await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'边框');
      check(label+': End reveals the complete focused button inside context',await page.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect(),panel=el.closest('.ts-floating-formatbar'),p=panel.getBoundingClientRect();return r.top>=p.top+panel.clientTop-1&&r.bottom<=p.top+panel.clientTop+panel.clientHeight+1&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;}));
      check(label+': keyboard reveal scrolls context toward the clipped heading',await page.evaluate(before=>document.querySelector('.ts-floating-formatbar').scrollTop<before,beforeKeyboard.panel));
      check(label+': keyboard reveal preserves canvas and card scroll',await page.evaluate(()=>{const stage=paperFixture.view.stage,preview=document.querySelector('[data-id="a"] .ts-card-preview');return{stage:[stage.scrollLeft,stage.scrollTop],preview:[preview.scrollLeft,preview.scrollTop],transform:paperFixture.view.world.style.transform};}),{stage:beforeKeyboard.stage,preview:beforeKeyboard.preview,transform:beforeKeyboard.transform});
      await page.screenshot({path:path.join(output,theme+'-'+short.name+'-keyboard.png')});await page.evaluate(()=>paperFixture.cleanup.forEach(fn=>fn()));
    }
    // Deep regression: the complete palette must remain usable in a short
    // native split. Its fixed title/search/category stack used to squeeze the
    // action viewport to 20 px, and footer restoration clipped rail focus.
    if(process.env.QA_ONLY_SCREENSHOTS!=='1')for(const theme of ['light','dark'])for(const size of [{width:640,height:300},{width:640,height:220},{width:640,height:180},{width:320,height:300},{width:320,height:220},{width:320,height:180}]){
      const label=theme+'/palette '+size.width+'x'+size.height+' with 82px host header';
      await page.setViewportSize(size);await page.setContent(content);
      await page.locator('body').evaluate((el,theme)=>el.className='theme-'+theme,theme);
      await page.addStyleTag({content:hostCSS});await page.addStyleTag({content:fs.readFileSync(stylesheet,'utf8')});
      await page.addStyleTag({content:'#board-host > .view-header{height:82px;min-height:82px}'});
      await page.addScriptTag({content:script});await page.evaluate(()=>paperFixture.mount());await page.waitForTimeout(100);
      const canvasState=()=>page.evaluate(()=>({transform:paperFixture.view.world.style.transform,scroll:[paperFixture.view.stage.scrollLeft,paperFixture.view.stage.scrollTop]}));
      const before=await canvasState();
      const focusedVisible=()=>page.evaluate(()=>{
        const el=document.activeElement,boundary=el?.closest('.ts-rail-popover,.ts-board-rail');if(!boundary)return false;
        const r=el.getBoundingClientRect(),p=boundary.getBoundingClientRect();
        return r.width>0&&r.height>=28&&r.top>=p.top+boundary.clientTop-1&&r.bottom<=p.top+boundary.clientTop+boundary.clientHeight+1&&r.left>=p.left+boundary.clientLeft-1&&r.right<=p.left+boundary.clientLeft+boundary.clientWidth+1&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;
      });
      const focusedButtonVisible=()=>page.evaluate(()=>{
        const el=document.activeElement,boundary=el?.closest('.ts-rail-popover,.ts-board-rail');if(el?.tagName!=='BUTTON'||!boundary)return false;
        const r=el.getBoundingClientRect(),p=boundary.getBoundingClientRect();
        return r.width>0&&r.height>=28&&r.top>=p.top+boundary.clientTop-1&&r.bottom<=p.top+boundary.clientTop+boundary.clientHeight+1&&r.left>=p.left+boundary.clientLeft-1&&r.right<=p.left+boundary.clientLeft+boundary.clientWidth+1&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el;
      });
      const activeLabel=()=>page.evaluate(()=>document.activeElement?.getAttribute('aria-label'));
      const more=page.getByRole('button',{name:'更多白板工具',exact:true});await more.click();await page.waitForTimeout(80);
      check(label+': more search opens with visible keyboard focus',await activeLabel(),'搜索白板工具');check(label+': search field is completely visible and hit-testable',await focusedVisible());
      check(label+': short palette owns a complete local scrolling viewport',await page.locator('.ts-tools-palette').evaluate(el=>getComputedStyle(el).overflowY==='auto'&&el.scrollHeight>el.clientHeight&&el.querySelector('.ts-rail-actions').clientHeight>36));
      await page.keyboard.press('ArrowDown');check(label+': search Down reaches the first tool',await activeLabel(),'分组总览');check(label+': first tool is completely visible and hit-testable',await focusedButtonVisible());
      await page.keyboard.press('End');check(label+': End reaches the last tool',await activeLabel(),'白板操作');check(label+': last tool is completely visible and hit-testable',await focusedButtonVisible());
      await page.keyboard.press('Home');check(label+': Home reveals the first tool',await focusedButtonVisible());
      await page.keyboard.press('ArrowUp');check(label+': Up from first returns to search',await activeLabel(),'搜索白板工具');check(label+': returning search focus reveals its entire field',await focusedVisible());
      await page.keyboard.press('ArrowUp');check(label+': search Up reaches the last tool',await activeLabel(),'白板操作');check(label+': search Up reveals the entire last tool',await focusedButtonVisible());
      await page.screenshot({path:path.join(output,theme+'-palette-'+size.width+'x'+size.height+'-last.png')});
      await page.locator('.ts-board-rail').evaluate(el=>el.scrollTop=0);await page.keyboard.press('Escape');await page.waitForTimeout(80);
      check(label+': Escape returns to the more trigger',await activeLabel(),'更多白板工具');check(label+': returned more trigger stays visible after footer reserve settles',await focusedButtonVisible());
      await more.click();await page.waitForTimeout(60);check(label+': reopening resets the palette to a visible search field',await focusedVisible());
      await page.getByRole('searchbox',{name:'搜索白板工具',exact:true}).fill('分组');await page.keyboard.press('Escape');check(label+': first search Escape clears the query locally',await page.getByRole('searchbox',{name:'搜索白板工具',exact:true}).inputValue(),'');
      check(label+': clearing search keeps its field visible',await focusedVisible());await page.keyboard.press('Escape');await page.waitForTimeout(70);
      const insert=page.getByRole('button',{name:'插入内容',exact:true});await insert.click();await page.waitForTimeout(70);
      check(label+': insert opens on the first material action',await activeLabel(),'已有笔记');check(label+': initial insert action is completely visible and hit-testable',await focusedButtonVisible());
      await page.keyboard.press('End');check(label+': insert End reaches the last action',await activeLabel(),'中心主题');check(label+': last insert action is completely visible and hit-testable',await focusedButtonVisible());
      await page.keyboard.press('Home');check(label+': insert Home reveals the first material action',await focusedButtonVisible());
      const bounds=await page.locator('.ts-insert-palette').boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.wheel(0,600);await page.waitForTimeout(80);
      check(label+': real wheel scrolls the complete insert palette',await page.locator('.ts-insert-palette').evaluate(el=>el.scrollTop>0));
      await page.keyboard.press('Home');check(label+': Home restores complete keyboard focus after pointer scrolling',await focusedButtonVisible());
      await page.screenshot({path:path.join(output,theme+'-palette-'+size.width+'x'+size.height+'-insert.png')});
      await page.getByRole('button',{name:'关闭插入面板',exact:true}).click();await page.waitForTimeout(80);
      check(label+': close button returns focus to the insert trigger',await activeLabel(),'插入内容');check(label+': returned insert trigger remains visible after footer restoration',await focusedButtonVisible());
      check(label+': popup keyboard and wheel preserve the canvas viewport',await canvasState(),before);
      check(label+': fixture catches no palette command errors',await page.evaluate(()=>paperFixture.calls.errors),[]);await page.evaluate(()=>paperFixture.cleanup.forEach(fn=>fn()));
    }
    // Production sidebar DOM, including real keyboard handlers, at widths on
    // both sides of the former 299px vertical-navigation breakpoint.
    for(const theme of ['light','dark'])for(const width of [200,280,304,420])for(const height of [800,320]){
      const label=theme+'/sidebar-'+width+'x'+height;
      await page.setViewportSize({width:1200,height});await page.setContent(content);
      await page.locator('body').evaluate((el,theme)=>el.className='theme-'+theme,theme);
      await page.addStyleTag({content:hostCSS});await page.addStyleTag({content:fs.readFileSync(stylesheet,'utf8')});
      await page.addStyleTag({content:'.qa-dock-host{flex-basis:'+width+'px}'});
      await page.addScriptTag({content:script});await page.evaluate(()=>paperFixture.mount());await page.waitForTimeout(100);
      const geometry=await page.evaluate(()=>{
        const sidebar=document.querySelector('#dock .ts-sidebar'),tabs=[...sidebar.querySelectorAll('[role=tab]')],list=sidebar.querySelector('.ts-library'),search=sidebar.querySelector('.ts-sidebar-search');
        return{sidebar:sidebar.getBoundingClientRect().toJSON(),list:list.getBoundingClientRect().toJSON(),search:search.getBoundingClientRect().toJSON(),tabs:tabs.map(el=>el.getBoundingClientRect().toJSON()),orientation:sidebar.querySelector('[role=tablist]').getAttribute('aria-orientation'),overflow:sidebar.scrollWidth>sidebar.clientWidth+1};
      });
      check(label+': all four categories in one horizontal row',geometry.tabs.length===4&&geometry.tabs.every((t,i,all)=>Math.abs(t.top-all[0].top)<1&&(!i||t.left>=all[i-1].right)));
      check(label+': navigation exposes horizontal keyboard orientation',geometry.orientation,'horizontal');
      check(label+': list uses the complete sidebar width',Math.abs(geometry.list.width-geometry.sidebar.width)<1&&Math.abs(geometry.list.left-geometry.sidebar.left)<1);
      check(label+': search stays below category tabs',geometry.search.top>=geometry.tabs[0].bottom);
      check(label+': sidebar has no horizontal overflow',geometry.overflow,false);
      const tabs=page.locator('#dock [role=tab]');await tabs.first().focus();await page.keyboard.press('ArrowRight');
      check(label+': Right activates Boards',await page.evaluate(()=>document.activeElement?.textContent),'白板');
      await page.keyboard.press('End');check(label+': End activates Outline',await tabs.last().getAttribute('aria-selected'),'true');
      await page.keyboard.press('Home');check(label+': Home activates Cards',await tabs.first().getAttribute('aria-selected'),'true');
      await page.evaluate(()=>paperFixture.cleanup.forEach(fn=>fn()));
    }
    check('browser reports no uncaught errors',errors,[]);
  }finally{await browser.close();}
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  const failed=report.checks.filter(row=>!row.passed);console.log(JSON.stringify({passed:report.checks.length-failed.length,failed:failed.length,output}));
  failed.forEach(row=>console.error(JSON.stringify(row)));if(failed.length)process.exitCode=1;
})().catch(error=>{console.error(error);report.fatalError=String(error);fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=1;});
