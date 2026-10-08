import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

// Only fixture setup, persistence checkpoints and view lookup use the registered
// API. All create/rename/confirm/cancel/history intents below use native UI input.
const idea=(id,title,x)=>({id,kind:'text',brainIdea:true,title,text:'',x,y:0,width:320,height:240,color:'slate'});
const originalEdges=[
 {id:'original-child',from:'root',to:'child',kind:'branch',direction:'forward',label:'原有父子'},
 {id:'original-parallel-association',from:'root',to:'child',direction:'both',label:'原有双向关联'},
 {id:'original-association',from:'root',to:'partner',direction:'both',label:'独立关联',fromSide:'right',toSide:'left'},
];

export async function runBrain({page,report,check,screenshot,open,vault}){
 const active=()=>page.locator('.workspace-leaf.mod-active');
 const shell=()=>active().locator('.ts-brain-shell');
 const create=page.locator('.ts-brain-create-modal');
 const rename=page.locator('.ts-brain-rename-modal');
 const prompt=page.locator('.ts-prompt-modal');
 const front=async()=>{
  await page.bringToFront();
  await page.evaluate(()=>{require('@electron/remote').getCurrentWindow().focus();if(window.qaSupplementBrain)app.workspace.setActiveLeaf(qaSupplementBrain.leaf,{focus:true});});
 };
 const theme=async value=>{
  await page.evaluate(value=>{document.body.classList.toggle('theme-light',value==='light');document.body.classList.toggle('theme-dark',value==='dark');document.body.style.setProperty('--interactive-accent','#8d43c2');},value);
  await page.waitForTimeout(240);
 };
 const useView=async file=>{
  await page.waitForFunction(file=>app.workspace.getLeavesOfType('thoughtspace-board').some(l=>l.view.file?.path===file&&l.view.session),file);
  await page.evaluate(file=>{window.qaSupplementBrain=app.workspace.getLeavesOfType('thoughtspace-board').find(l=>l.view.file?.path===file).view;window.qaView=qaSupplementBrain;app.workspace.setActiveLeaf(qaSupplementBrain.leaf,{focus:true});qaSupplementBrain.plugin.settings.accent='forest';qaSupplementBrain.applyPreferences();},file);
  await front();await shell().waitFor();await page.waitForTimeout(240);
 };
 const cancel=async modal=>{await modal.getByRole('button',{name:'取消',exact:true}).click();await modal.waitFor({state:'hidden'});};
 const commandNewBrain=async()=>{
  await front();await page.keyboard.press('Meta+p');await page.locator('.prompt-input').fill('新建脑图白板');
  await page.locator('.suggestion-item').filter({hasText:'新建脑图白板'}).first().click();
  await prompt.waitFor();
 };
 const currentGraph=()=>page.evaluate(()=>({nodes:qaSupplementBrain.session.board.nodes,edges:qaSupplementBrain.session.board.edges}));
 const originalGraphIntact=async label=>{
  const graph=await currentGraph();
  check(label,graph.edges.filter(e=>e.id.startsWith('original-')),originalEdges);
  check(label+' · original node content and geometry',graph.nodes.filter(n=>['root','child','partner'].includes(n.id)),[
   idea('root','中心想法：保留身份与关系',0),idea('child','原有子节点',400),idea('partner','原有关联节点',800),
  ]);
 };
 const addAt=async action=>{
  const root=active().locator('[data-brain-node-id="root"]');await root.locator('.ts-brain-node-title').hover();
  await root.locator(`[data-brain-action="${action}"]`).click();await create.waitFor();
 };
 const renameIdea=async id=>{
  const node=active().locator(`[data-brain-node-id="${id}"]`);await node.locator('.ts-brain-node-title').hover();
  await node.locator('[data-brain-action="node-menu"]').click();
  await page.locator('.menu-item-title').filter({hasText:/^重命名想法$/}).click();await rename.waitFor();
 };
 const nativeReopen=async file=>{
  await page.evaluate(async()=>{await qaSupplementBrain.session.flush();});
  await front();await shell().focus();await page.keyboard.press('Meta+w');
  await page.waitForFunction(file=>!app.workspace.getLeavesOfType('thoughtspace-board').some(l=>l.view.file?.path===file),file);
  // Obsidian puts data-path on the clickable title itself, rather than its
  // .nav-file wrapper. The failed run's screenshot shows this real root row.
  // Keep reopen as a native mouse action, without force or a product API call.
  await page.evaluate(()=>app.workspace.leftSplit.expand());
  await page.locator(`.nav-file-title[data-path="${file}"]`).click();
  await useView(file);
 };
 report.brainSupplement={interaction:'Native command palette, mouse create/rename menus and dialogs, Enter/Escape, Meta+Z/Meta+Shift+Z, Meta+W and native file-explorer reopen; synthetic brain fixtures only.',boards:[]};

 // The public creation command itself, including its explicit brain type.
 await theme('light');await commandNewBrain();
 check('brain create: command defaults to brain presentation',await prompt.getByRole('combobox',{name:'白板类型'}).inputValue(),'brain');
 const cancelled='补测取消创建的脑图';await prompt.locator('input[type="text"]').fill(cancelled);
 await screenshot('supp-brain-board-create-cancel-light.png');await page.keyboard.press('Escape');await prompt.waitFor({state:'hidden'});
 check('brain create: Escape creates no file',await page.evaluate(name=>app.vault.getFiles().some(f=>f.basename===name),cancelled),false);
 await commandNewBrain();const createdName='补测原生命令创建的脑图';await prompt.locator('input[type="text"]').fill(createdName);await page.keyboard.press('Enter');await prompt.waitFor({state:'hidden'});
 await page.waitForFunction(name=>app.workspace.getLeavesOfType('thoughtspace-board').some(l=>l.view.file?.basename===name&&l.view.session),createdName);
 const createdPath=await page.evaluate(name=>app.workspace.getLeavesOfType('thoughtspace-board').find(l=>l.view.file?.basename===name).view.file.path,createdName);
 await useView(createdPath);
 check('brain create: confirmed native command creates an empty brain board',await page.evaluate(()=>({presentation:qaSupplementBrain.session.board.presentation,nodes:qaSupplementBrain.session.board.nodes.length,edges:qaSupplementBrain.session.board.edges.length})),{presentation:'brain',nodes:0,edges:0});
 await screenshot('supp-brain-board-create-confirm-light.png');

 for(const colorMode of ['light','dark']){
  const file=`补测脑图-${colorMode}.thoughtspace`;
  const fixture={version:3,presentation:'brain',nodes:[idea('root','中心想法：保留身份与关系',0),idea('child','原有子节点',400),idea('partner','原有关联节点',800)],edges:originalEdges,viewport:{x:0,y:0,zoom:1},brain:{version:1,centerId:'root',expandedIds:[],pins:[],history:{entries:['root'],index:0}}};
  await writeFile(path.join(vault,file),JSON.stringify(fixture));await open(file);await useView(file);await theme(colorMode);
  await addAt('add-bottom');
  check(`brain ${colorMode}: child modal states the parent direction`,(await create.textContent()).includes('中心想法：保留身份与关系 → 子节点'));
  await create.getByRole('textbox',{name:'想法名称',exact:true}).fill('   ');
  check(`brain ${colorMode}: blank idea cannot be confirmed`,await create.getByRole('button',{name:'确定',exact:true}).isDisabled());
  await create.getByRole('textbox',{name:'想法名称',exact:true}).fill('取消后不添加的中文节点');
  await screenshot(`supp-brain-${colorMode}-child-create-cancel.png`);await cancel(create);
  check(`brain ${colorMode}: cancel does not add a node or edge`,await page.evaluate(()=>[qaSupplementBrain.session.board.nodes.length,qaSupplementBrain.session.board.edges.length]),[3,3]);
  await addAt('add-bottom');const newName='新建子想法：中文长名称与身份保留';
  await create.getByRole('textbox',{name:'想法名称',exact:true}).fill(newName);await page.keyboard.press('Enter');await create.waitFor({state:'hidden'});
  await page.waitForFunction(name=>qaSupplementBrain.session.board.nodes.some(n=>n.title===name),newName);
  const newId=await page.evaluate(name=>qaSupplementBrain.session.board.nodes.find(n=>n.title===name).id,newName);
  const childEdge=await page.evaluate(id=>qaSupplementBrain.session.board.edges.find(e=>e.from==='root'&&e.to===id),newId);
  check(`brain ${colorMode}: Enter creates one child relationship`,childEdge?.kind==='branch'&&childEdge.direction==='forward');
  check(`brain ${colorMode}: idea creates no Markdown file`,await page.evaluate(name=>app.vault.getFiles().some(f=>f.extension==='md'&&f.basename===name),newName),false);
  await originalGraphIntact(`brain ${colorMode}: create retains all original semantic relationships`);
  await shell().focus();await page.keyboard.press('Meta+z');
  await page.waitForFunction(id=>!qaSupplementBrain.session.board.nodes.some(n=>n.id===id),newId);
  check(`brain ${colorMode}: native undo removes only the created node and edge`,await page.evaluate(()=>[qaSupplementBrain.session.board.nodes.length,qaSupplementBrain.session.board.edges.length]),[3,3]);
  await page.keyboard.press('Meta+Shift+z');await page.waitForFunction(id=>qaSupplementBrain.session.board.nodes.some(n=>n.id===id),newId);
  check(`brain ${colorMode}: native redo restores the same node and edge identities`,await page.evaluate(({nodeId,edgeId})=>qaSupplementBrain.session.board.nodes.some(n=>n.id===nodeId)&&qaSupplementBrain.session.board.edges.some(e=>e.id===edgeId),{nodeId:newId,edgeId:childEdge.id}));
  await renameIdea(newId);await rename.getByRole('textbox',{name:'新名称',exact:true}).fill('取消重命名草稿');await screenshot(`supp-brain-${colorMode}-rename-cancel.png`);await cancel(rename);
  check(`brain ${colorMode}: rename cancel retains the old name`,await page.evaluate(id=>qaSupplementBrain.session.board.nodes.find(n=>n.id===id).title,newId),newName);
  await renameIdea(newId);const renamed='重命名子想法：连续输入后的最终名称';
  await rename.getByRole('textbox',{name:'新名称',exact:true}).fill('中间输入');await rename.getByRole('textbox',{name:'新名称',exact:true}).fill(renamed);await page.keyboard.press('Enter');await rename.waitFor({state:'hidden'});
  check(`brain ${colorMode}: rename uses the latest name and retains node identity`,await page.evaluate(id=>qaSupplementBrain.session.board.nodes.find(n=>n.id===id).title,newId),renamed);
  await shell().focus();await page.keyboard.press('Meta+z');await page.waitForFunction(({id,name})=>qaSupplementBrain.session.board.nodes.find(n=>n.id===id)?.title===name,{id:newId,name:newName});
  check(`brain ${colorMode}: native undo restores the previous name`,await page.evaluate(id=>qaSupplementBrain.session.board.nodes.find(n=>n.id===id).title,newId),newName);
  await page.keyboard.press('Meta+Shift+z');await page.waitForFunction(({id,name})=>qaSupplementBrain.session.board.nodes.find(n=>n.id===id)?.title===name,{id:newId,name:renamed});
  await screenshot(`supp-brain-${colorMode}-rename-confirm.png`);
  await addAt('add-right');const assocName='新建双向关联想法';await create.getByRole('textbox',{name:'想法名称',exact:true}).fill(assocName);await create.getByRole('button',{name:'确定',exact:true}).click();await create.waitFor({state:'hidden'});
  const assocId=await page.evaluate(name=>qaSupplementBrain.session.board.nodes.find(n=>n.title===name).id,assocName);
  check(`brain ${colorMode}: native association creation keeps bidirectional semantics`,await page.evaluate(id=>{const e=qaSupplementBrain.session.board.edges.find(e=>e.from==='root'&&e.to===id);return !!e&&e.kind!=='branch'&&e.direction==='both';},assocId));
  await page.evaluate(async()=>{await qaSupplementBrain.session.flush();});
  const persisted=JSON.parse(await readFile(path.join(vault,file),'utf8'));
  check(`brain ${colorMode}: rename and relationship reach disk`,persisted.nodes.find(n=>n.id===newId)?.title===renamed&&persisted.edges.some(e=>e.id===childEdge.id)&&persisted.nodes.some(n=>n.id===assocId));
  await nativeReopen(file);
  check(`brain ${colorMode}: native file reopen restores names and identities`,await page.evaluate(({id,name,assocId,edgeId})=>qaSupplementBrain.session.board.nodes.find(n=>n.id===id)?.title===name&&qaSupplementBrain.session.board.nodes.some(n=>n.id===assocId)&&qaSupplementBrain.session.board.edges.some(e=>e.id===edgeId),{id:newId,name:renamed,assocId,edgeId:childEdge.id}));
  await originalGraphIntact(`brain ${colorMode}: reopen retains all original relationships`);
  await screenshot(`supp-brain-${colorMode}-native-reopen.png`);
  report.brainSupplement.boards.push({theme:colorMode,path:file,nodeId:newId,associationNodeId:assocId,childEdgeId:childEdge.id,persistedNodeCount:persisted.nodes.length,persistedEdgeCount:persisted.edges.length});
 }

 // A board-file rename is a native file operation, separate from graph undo.
 await front();await shell().getByRole('button',{name:'脑图菜单',exact:true}).click();await page.locator('.menu-item-title').filter({hasText:/^重命名白板$/}).click();await prompt.waitFor();await prompt.locator('input[type="text"]').fill('取消白板名称');await page.keyboard.press('Escape');await prompt.waitFor({state:'hidden'});
 check('brain file rename: cancellation retains the current path',await page.evaluate(()=>qaSupplementBrain.file.path),'补测脑图-dark.thoughtspace');
 await shell().getByRole('button',{name:'脑图菜单',exact:true}).click();await page.locator('.menu-item-title').filter({hasText:/^重命名白板$/}).click();await prompt.waitFor();await prompt.locator('input[type="text"]').fill('补测脑图已重命名');await screenshot('supp-brain-file-rename-dark.png');await page.keyboard.press('Enter');await prompt.waitFor({state:'hidden'});
 const renamedPath='补测脑图已重命名.thoughtspace';await page.waitForFunction(file=>qaSupplementBrain.file.path===file,renamedPath);
 check('brain file rename: old path is removed and new native file exists',await page.evaluate(file=>!app.vault.getAbstractFileByPath('补测脑图-dark.thoughtspace')&&!!app.vault.getAbstractFileByPath(file),renamedPath));
 await nativeReopen(renamedPath);await originalGraphIntact('brain file rename: native reopen preserves semantic graph');await screenshot('supp-brain-file-rename-reopened-dark.png');
 report.brainSupplement.renamedBoardPath=renamedPath;
}
