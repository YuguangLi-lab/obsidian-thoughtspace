// Deliberately load the previously verified 1.3.25 release in the disposable vault.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:9237'),p=b.contexts()[0].pages().find(page=>page.url()==='app://obsidian.md/index.html');
 const vault=path.resolve('../thoughtspace-qa-vault'),old='dist/release-1.3.25-verified',out='dist/text-style-compat-native',checks=[];
 assert.equal(await p.evaluate(()=>app.vault.adapter.basePath),vault);fs.mkdirSync(out,{recursive:true});
 const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
 const sums=fs.readFileSync(path.join(old,'SHA256SUMS.txt'),'utf8');
 for(const name of ['main.js','manifest.json','styles.css'])assert.ok(sums.includes(crypto.createHash('sha256').update(fs.readFileSync(path.join(old,name))).digest('hex')+'  '+name));
 assert.equal(JSON.parse(fs.readFileSync(path.join(old,'manifest.json'))).version,'1.3.25');
 const swap=async dir=>{
  await p.evaluate(async()=>{await app.plugins.plugins.thoughtspace?.mediaDrafts.flush();for(const leaf of [...app.workspace.getLeavesOfType('thoughtspace-board'),...app.workspace.getLeavesOfType('thoughtspace-media-player')])await leaf.detach();await app.plugins.unloadPlugin('thoughtspace');});
  for(const name of ['main.js','manifest.json','styles.css'])fs.copyFileSync(path.join(dir,name),path.join(vault,'.obsidian/plugins/thoughtspace',name));
  await p.evaluate(async()=>{app.plugins.manifests.thoughtspace={...app.plugins.manifests.thoughtspace,...JSON.parse(await app.vault.adapter.read('.obsidian/plugins/thoughtspace/manifest.json')),dir:app.vault.configDir+'/plugins/thoughtspace'};await app.plugins.loadPlugin('thoughtspace');});
 };
 const styles=['transparent','solid','band','paper','index','sticky'];
 const files=await p.evaluate(async styles=>{
  const result=[];for(const style of styles){const board={version:3,nodes:[{id:'text',kind:'text',text:'# Compatibility\n\n**保留正文**',x:20,y:30,width:300,height:200,color:'blue',autoSize:false,...(['transparent','solid'].includes(style)?{transparent:style==='transparent'}:{cardStyle:style})},{id:'child',kind:'text',text:'子节点',x:400,y:30,width:200,height:100,color:'slate'}],edges:[{id:'edge',from:'text',to:'child',kind:'branch',label:''}],viewport:{x:0,y:0,zoom:1}},raw=JSON.stringify(board,null,2),file=await app.vault.create('qa-compat-'+Date.now()+'-'+style+'.thoughtspace',raw);result.push({path:file.path,style,raw});}return result;
 },styles);
 try{
  await swap(old);
  for(const entry of files){
   await p.evaluate(async file=>app.plugins.plugins.thoughtspace.openBoard(app.vault.getAbstractFileByPath(file)),entry.path);
   if(['transparent','solid'].includes(entry.style))check('1.3.25 opens '+entry.style,await p.evaluate(()=>!!app.plugins.plugins.thoughtspace.currentBoard?.session));
   else{await p.locator('.ts-error').waitFor();check('1.3.25 visibly refuses '+entry.style,await p.locator('.ts-error').textContent().then(text=>text.includes('卡片样式无效')));}
   await p.evaluate(async()=>{for(const leaf of app.workspace.getLeavesOfType('thoughtspace-board'))await leaf.detach();});
   check('1.3.25 leaves '+entry.style+' bytes intact',await p.evaluate(async file=>app.vault.read(app.vault.getAbstractFileByPath(file)),entry.path)===entry.raw);
  }
  await swap('.');
  for(const entry of files){
   await p.evaluate(async file=>app.plugins.plugins.thoughtspace.openBoard(app.vault.getAbstractFileByPath(file)),entry.path);
   check('new version reads '+entry.style+' without data loss',await p.evaluate(raw=>JSON.stringify(app.plugins.plugins.thoughtspace.currentBoard.session.board)===JSON.stringify(JSON.parse(raw)),entry.raw));
   await p.evaluate(async()=>{const view=app.plugins.plugins.thoughtspace.currentBoard;view.session.change(board=>{const node=board.nodes[0];delete node.cardStyle;node.transparent=true;});await view.session.flush();});
  }
  await swap(old);
  for(const entry of files){await p.evaluate(async file=>app.plugins.plugins.thoughtspace.openBoard(app.vault.getAbstractFileByPath(file)),entry.path);check('downgraded '+entry.style+' opens with text and edge',await p.evaluate(()=>{const board=app.plugins.plugins.thoughtspace.currentBoard?.session?.board;return board?.nodes[0].text==='# Compatibility\n\n**保留正文**'&&board.nodes.length===2&&board.edges[0].to==='child';}));}
 }finally{await swap('.');await b.close();}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,scope:'Actual verified 1.3.25 runtime and current build in the exact disposable vault. Rejected boards are checked byte-for-byte after close. No real vault or OS protocol dispatch.'},null,2));
})().catch(error=>{console.error(error);process.exit(1);});
