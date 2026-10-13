import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderHandwritingSvg,HandwritingExportOperation,HandwritingExportError,appendHandwritingEmbed,handwritingExportFilename,type HandwritingExportFile,type HandwritingExportHost} from '../src/handwriting-export';
import {inkBounds,type InkData} from '../src/ink-model';

const ink=():InkData=>({version:1,strokes:[{id:'dot',color:'#315e9b',width:8,points:[[-12.123456,9.987654,.15]]},{id:'pressure',color:'#b34643',width:3,points:[[2,3,0],[6,7,.5],[10,5,1]]}]});
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(value=>resolve=value);return{promise,resolve};};
function fixture(){
 const source:HandwritingExportFile={path:'Boards/手写.md',basename:'手写',extension:'md',stat:{mtime:1,size:200}},target:HandwritingExportFile={path:'Notes/既有笔记.md',basename:'既有笔记',extension:'md',stat:{mtime:1,size:30}};
 const files=new Map<string,HandwritingExportFile>([[source.path,source],[target.path,target]]),text=new Map<HandwritingExportFile,string>([[source,'原板字节'],[target,'---\r\nunknown: 保留\r\n---\r\n原生正文\r\n']]);
 let current=true,owned=false,creates=0,writes=0,pathCalls=0,createFailure=false,processFailure=false,processGate:ReturnType<typeof deferred>|undefined,createGate:ReturnType<typeof deferred>|undefined,readHook:((file:HandwritingExportFile)=>Promise<void>)|undefined,yields=0;
 const input=ink(),host:HandwritingExportHost<HandwritingExportFile>={
  source,ink:input,current:()=>current,getFile:path=>files.get(path),
  read:async file=>{await readHook?.(file);if(!text.has(file))throw Error('文件读取失败');return text.get(file)!;},
  availablePath:async(filename,from)=>{pathCalls++;assert.ok(from===source.path||from===target.path||from.endsWith('.md'));let path=`Attachments/${filename}`,index=1;while(files.has(path))path=`Attachments/${filename.replace(/\.svg$/,` ${index++}.svg`)}`;return path;},
  create:async(path,value)=>{await createGate?.promise;if(createFailure)throw Error('存储拒绝创建');if(files.has(path))throw Error('文件已存在');const file={path,basename:path.split('/').at(-1)!.slice(0,-4),extension:'svg',stat:{mtime:1,size:value.length}};files.set(path,file);text.set(file,value);creates++;return file;},
  process:async(file,change)=>{await processGate?.promise;if(processFailure)throw Error('存储拒绝正文写入');const value=change(text.get(file)!);text.set(file,value);if(file.stat)file.stat={mtime:file.stat.mtime+1,size:value.length};writes++;return value;},
  link:(file,from)=>`[[${file.path}|${file===source?'来源白板':'手写图'}]]`,
  assertTarget:()=>{if(owned)throw Error('原生笔记仍打开或旧页仍保存');},
  yieldControl:async()=>{yields++;}
 };
 const operation=new HandwritingExportOperation(host);
 return{source,target,files,text,input,host,operation,counts:()=>({creates,writes,pathCalls,yields}),stop:()=>current=false,own:()=>owned=true,free:()=>owned=false,setCreateFailure:()=>createFailure=true,setProcessFailure:()=>processFailure=true,clearProcessFailure:()=>processFailure=false,queueProcess:()=>processGate=deferred(),queueCreate:()=>createGate=deferred(),hookRead:(hook:typeof readHook)=>readHook=hook};
}
async function waitFor(check:()=>boolean){for(let i=0;i<100&&!check();i++)await new Promise<void>(resolve=>setTimeout(resolve,0));assert.ok(check(),'expected isolated phase reached');}

test('SVG bounds, pressure paths, color and XML title stay safe; source precision is unchanged',async()=>{
 const data=ink(),before=JSON.stringify(data),bounds=inkBounds(data)!;
 const result=await renderHandwritingSvg(data,{title:'<script>&"\n标题',yieldControl:async()=>{}});
 assert.equal(JSON.stringify(data),before);assert.equal(result.strokes,2);assert.equal(result.points,4);
 assert.deepEqual(result.bounds,{x:bounds.x-8,y:bounds.y-8,width:bounds.width+16,height:bounds.height+16});
 assert.match(result.source,/&lt;script&gt;&amp;&quot; 标题/);assert.doesNotMatch(result.source,/<script|onload|<foreignObject|NaN|Infinity/);
 assert.equal((result.source.match(/<path /g)||[]).length,2);assert.match(result.source,/fill="#315e9b"/);assert.match(result.source,/fill="#b34643"/);
 assert.match(result.source,/a1\.45 1\.45/);assert.match(result.source,/a0\.375 0\.375/);assert.match(result.source,/viewBox="-/);
});
test('invalid colors, pressure, coordinates, IDs, width and collection budgets reject the complete export',async()=>{
 const invalid:unknown[]=[{version:1,strokes:[]},{version:1,strokes:[{...ink().strokes[0],color:'#fff" onload="evil'}]},{version:1,strokes:[{...ink().strokes[0],points:[[0,0,2]]}]},{version:1,strokes:[{...ink().strokes[0],points:[[Infinity,0,.5]]}]},{version:1,strokes:[{...ink().strokes[0],width:100}]},{version:1,strokes:[ink().strokes[0],ink().strokes[0]]},{version:1,strokes:[{...ink().strokes[0],points:Array.from({length:8193},()=>[0,0,.5])}]}];
 for(const value of invalid)await assert.rejects(renderHandwritingSvg(value as InkData));
});
test('a long individual stroke yields and can cancel before creating a partial SVG',async()=>{
 const data:InkData={version:1,strokes:[{id:'long',color:'#222222',width:3,points:Array.from({length:8192},(_,i)=>[i/8,Math.sin(i/5),.5])}]};let active=true,yields=0;
 await assert.rejects(renderHandwritingSvg(data,{current:()=>active,yieldControl:async()=>{if(++yields===3)active=false;}}),/取消/);
 assert.equal(yields,3);assert.equal(data.strokes[0].points.length,8192);
});
test('renderer captured samples cannot be modified by another extension while yielding',async()=>{
 const data=ink(),before=await renderHandwritingSvg(data);
 const output=await renderHandwritingSvg(data,{yieldControl:async()=>{data.strokes[0].color='red"/>';data.strokes[0].points[0][0]=999;}});
 assert.equal(output.source,before.source);assert.doesNotMatch(output.source,/red/);
});
test('safe generated filenames and appended embeds preserve exact frontmatter/body and EOL',()=>{
 assert.equal(handwritingExportFilename('../[bad]:图|?.md'),'手写-.. bad 图 .md.svg');
 assert.equal(handwritingExportFilename('   '),'手写-白板.svg');
 for(const original of ['', '正文', '正文\n', '正文\n\n', '---\r\nunknown: yes\r\n---\r\n正文\r\n']){
  const result=appendHandwritingEmbed(original,'[[附件.svg]]','[[板.md]]');assert.ok(result.startsWith(original));assert.match(result,/!\[\[附件.svg\]\]/);assert.match(result,/来源白板：\[\[板.md\]\]/);
  if(original.includes('\r\n'))assert.doesNotMatch(result.replace(/\r\n/g,''),/\n/);
 }
});
test('unfinished property/code blocks are left unchanged rather than swallowing the inserted native image',async()=>{
 for(const original of ['---\nunknown: body','正文\n```ts\ncode','正文\n~~~~\ncode\n~~~']){const f=fixture();f.text.set(f.target,original);await assert.rejects(f.operation.chooseTarget(f.target),/尚未结束/);assert.equal(f.text.get(f.target),original);assert.equal(f.counts().creates,0);}
 for(const original of ['正文\n```ts\ncode\n```','---\nunknown: 1\n...\n正文','正文\n~~~~\ncode\n~~~~~'])assert.ok(appendHandwritingEmbed(original,'[[a.svg]]','[[b.md]]').startsWith(original));
});
test('inserting one unique attachment uses native links and preserves board and target bytes',async()=>{
 const f=fixture(),before=f.text.get(f.target)!;await f.operation.chooseTarget(f.target);const result=await f.operation.run(true);
 assert.equal(result.target,f.target);assert.ok(f.text.get(f.target)!.startsWith(before));assert.match(f.text.get(f.target)!,/!\[\[Attachments\/手写-手写.svg\|手写图\]\]/);assert.match(f.text.get(f.target)!,/来源白板：\[\[Boards\/手写.md\|来源白板\]\]/);
 assert.equal(f.text.get(f.source),'原板字节');assert.deepEqual(f.input,ink());assert.equal(f.counts().creates,1);assert.equal(f.counts().writes,1);
});
test('duplicate and late clicks share one operation and never append/create twice',async()=>{
 const f=fixture();await f.operation.chooseTarget(f.target);const gate=f.queueCreate();const one=f.operation.run(true),two=f.operation.run(true);assert.equal(one,two);gate.resolve();const result=await one;assert.equal(await f.operation.run(true),result);f.operation.cancel();assert.equal(await f.operation.run(false),result);assert.equal(f.counts().creates,1);assert.equal(f.counts().writes,1);
});
test('existing attachment names are avoided without changing the existing SVG',async()=>{
 const f=fixture(),existing={path:'Attachments/手写-手写.svg',basename:'手写-手写',extension:'svg'};f.files.set(existing.path,existing);f.text.set(existing,'用户原 SVG');const result=await f.operation.run(false);assert.notEqual(result.attachment.path,existing.path);assert.equal(f.text.get(existing),'用户原 SVG');assert.equal(f.counts().writes,0);
});
test('cancel or changed source before rendering has no file/target side effect',async()=>{
 for(const action of ['cancel','navigate','rename','replace'] as const){const f=fixture();await f.operation.chooseTarget(f.target);if(action==='cancel')f.operation.cancel();if(action==='navigate')f.stop();if(action==='rename')f.source.path='Boards/renamed.md';if(action==='replace')f.files.set(f.source.path,{...f.source});await assert.rejects(f.operation.run(true));assert.equal(f.counts().creates,0);assert.equal(f.counts().writes,0);}
});
test('target editing or native ownership before export prevents an attachment from being created',async()=>{
 for(const action of ['edit','own','rename','replace'] as const){const f=fixture();await f.operation.chooseTarget(f.target);if(action==='edit')f.text.set(f.target,'外部新正文');if(action==='own')f.own();if(action==='rename')f.target.path='Notes/new.md';if(action==='replace')f.files.set(f.target.path,{...f.target});await assert.rejects(f.operation.run(true));assert.equal(f.counts().creates,0);assert.equal(f.counts().writes,0);}
});
test('native open or pending save prevents target capture without saving the native window',async()=>{
 const f=fixture();f.own();await assert.rejects(f.operation.chooseTarget(f.target),/原生笔记/);assert.equal(f.operation.target,undefined);assert.equal(f.counts().creates,0);assert.equal(f.counts().writes,0);
});
test('late asynchronous picker reads cannot reinstate a previously selected note',async()=>{
 const f=fixture(),gate=deferred(),other={path:'Notes/second.md',basename:'second',extension:'md'};f.files.set(other.path,other);f.text.set(other,'第二篇');f.hookRead(async file=>{if(file===f.target)await gate.promise;});const old=f.operation.chooseTarget(f.target);const next=await f.operation.chooseTarget(other);gate.resolve();await assert.rejects(old,/切换/);assert.equal(f.operation.target,next);const result=await f.operation.run(true);assert.equal(result.target,other);assert.equal(f.text.get(f.target),'---\r\nunknown: 保留\r\n---\r\n原生正文\r\n');
});
test('queued atomic append rechecks target changes, native owner, replacement, cancellation and source navigation',async()=>{
 for(const action of ['edit','own','replace','cancel','navigate','select-other'] as const){
  const f=fixture();await f.operation.chooseTarget(f.target);const gate=f.queueProcess(),pending=f.operation.run(true);await waitFor(()=>f.counts().creates===1);
  if(action==='edit')f.text.set(f.target,'同步新正文');if(action==='own')f.own();if(action==='replace')f.files.set(f.target.path,{...f.target});if(action==='cancel')f.operation.cancel();if(action==='navigate')f.stop();if(action==='select-other'){const other={path:'Notes/other.md',basename:'other',extension:'md'};f.files.set(other.path,other);f.text.set(other,'other');await f.operation.chooseTarget(other);}
  gate.resolve();await assert.rejects(pending,(error:unknown)=>error instanceof HandwritingExportError&&!!error.retainedPath);assert.equal(f.counts().writes,0);assert.equal(f.counts().creates,1);assert.equal(f.text.get(f.source),'原板字节');assert.ok(f.files.has('Attachments/手写-手写.svg'));
 }
});
test('attachment mutation while atomic append waits is refused and preserved',async()=>{
 const f=fixture();await f.operation.chooseTarget(f.target);const gate=f.queueProcess(),pending=f.operation.run(true);await waitFor(()=>f.counts().creates===1);const attachment=f.files.get('Attachments/手写-手写.svg')!;f.text.set(attachment,'外部修改的 SVG');attachment.stat={mtime:2,size:12};gate.resolve();await assert.rejects(pending,/附件已移动、替换或修改/);assert.equal(f.counts().writes,0);assert.equal(f.text.get(attachment),'外部修改的 SVG');
});
test('cancel during pending create retains a known attachment but never appends or deletes files',async()=>{
 const f=fixture();await f.operation.chooseTarget(f.target);const gate=f.queueCreate(),pending=f.operation.run(true);await waitFor(()=>f.counts().pathCalls===1);f.operation.cancel();gate.resolve();await assert.rejects(pending,(error:unknown)=>error instanceof HandwritingExportError&&error.retainedPath==='Attachments/手写-手写.svg');assert.equal(f.counts().creates,1);assert.equal(f.counts().writes,0);
});
test('storage failures identify retained attachments and retry insertion without duplicate files',async()=>{
 const noCreate=fixture();noCreate.setCreateFailure();await assert.rejects(noCreate.operation.run(false),/拒绝创建/);assert.equal(noCreate.counts().creates,0);
 const f=fixture();await f.operation.chooseTarget(f.target);f.setProcessFailure();await assert.rejects(f.operation.run(true),(error:unknown)=>error instanceof HandwritingExportError&&!!error.retainedPath);assert.equal(f.counts().creates,1);assert.equal(f.counts().writes,0);f.clearProcessFailure();await f.operation.chooseTarget(f.target);await f.operation.run(true);assert.equal(f.counts().creates,1);assert.equal(f.counts().writes,1);
});
test('a rejected process that actually committed is confirmed by exact disk bytes and never appended twice',async()=>{
 const f=fixture();await f.operation.chooseTarget(f.target);let attempts=0;f.host.process=async(file,change)=>{attempts++;f.text.set(file,change(f.text.get(file)!));throw Error('写入后返回错误');};const result=await f.operation.run(true);assert.equal(result.target,f.target);assert.equal(await f.operation.run(true),result);assert.equal(attempts,1);assert.equal((f.text.get(f.target)!.match(/来源白板：/g)||[]).length,1);assert.equal(f.counts().creates,1);
});
test('an ambiguous rejected append blocks same-target retries while keeping SVG and concurrent body untouched',async()=>{
 const f=fixture();await f.operation.chooseTarget(f.target);let attempts=0;f.host.process=async(file,change)=>{attempts++;change(f.text.get(file)!);f.text.set(file,'并发内容，保存结果不确定');throw Error('不确定失败');};await assert.rejects(f.operation.run(true),/保存结果未确认/);await f.operation.chooseTarget(f.target);await assert.rejects(f.operation.run(true),/尚未确认/);assert.equal(attempts,1);assert.equal(f.text.get(f.target),'并发内容，保存结果不确定');assert.equal(f.counts().creates,1);
});
test('a failed confirmation read keeps append uncertainty even after a fresh target capture',async()=>{
 const f=fixture();await f.operation.chooseTarget(f.target);let attempts=0,unreadable=false;f.host.process=async(file,change)=>{attempts++;change(f.text.get(file)!);unreadable=true;throw Error('失败');};f.hookRead(async file=>{if(file===f.target&&unreadable)throw Error('无法读取确认');});await assert.rejects(f.operation.run(true),/保存结果未确认/);unreadable=false;await f.operation.chooseTarget(f.target);await assert.rejects(f.operation.run(true),/尚未确认/);assert.equal(attempts,1);assert.equal(f.counts().creates,1);
});
test('an ambiguous create error preserves the encountered path and never adopts or overwrites it',async()=>{
 const f=fixture();f.host.create=async(path,source)=>{const file={path,basename:'ambiguous',extension:'svg'};f.files.set(path,file);f.text.set(file,source);throw Error('存储返回不确定');};await assert.rejects(f.operation.run(false),(error:unknown)=>error instanceof HandwritingExportError&&error.creationUnconfirmed&&!!error.retainedPath);assert.equal(f.counts().writes,0);assert.ok(f.files.has('Attachments/手写-手写.svg'));
});
test('attachment output follows native path validation and refuses traversal without writing',async()=>{
 for(const path of ['../bad.svg','/outside.svg','Attachments/./bad.svg','Attachments//bad.svg','bad.md','']){const f=fixture();f.host.availablePath=async()=>path;await assert.rejects(f.operation.run(false),/路径无效/);assert.equal(f.counts().creates,0);assert.equal(f.counts().writes,0);}
});
test('source itself and non-Markdown/host-rejected notes cannot be targets',async()=>{
 const f=fixture();await assert.rejects(f.operation.chooseTarget(f.source));await assert.rejects(f.operation.chooseTarget({path:'other.canvas',basename:'other',extension:'canvas'}));f.host.targetAllowed=()=>false;await assert.rejects(f.operation.chooseTarget(f.target));assert.equal(f.operation.target,undefined);
});
