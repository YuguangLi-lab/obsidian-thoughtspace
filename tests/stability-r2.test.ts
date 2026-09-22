/** Regression coverage for the twelve defects recorded in STABILITY-AUDIT-0.61.0-R2.md. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {emptyBoard,Card,Board} from '../src/model';
import {planTasks,taskMatches,changeTask} from '../src/task-planner-model';
import {extractFragments,parseOutline,pdfExcerptDocument} from '../src/materials';
import {selectionMarkdown,stackSelection,selectStudio} from '../src/board-studio';
import {resolveLayoutScope} from '../src/layout-planner';
import {markdownEdit} from '../src/markdown-edit';
const node=(id:string,x=0,y=0):Card=>({id,kind:'text',text:id,x,y,width:100,height:60,color:'green'});
const make=():Board=>({...emptyBoard(),version:3,nodes:[{...node('root'),branchFolded:true,topic:true},{...node('child',200),topic:true},node('other',0,200)],edges:[{id:'branch',from:'root',to:'child',kind:'branch',label:''}]});
test('R01 literal inline-code metadata must not drive task dates or overwrite code while scheduling',()=>{
 const raw='- [ ] 检查日志 ` 09:00 ERROR `';
 assert.deepEqual({due:planTasks('- [ ] 阅读 `📅 2020-01-01` 示例','T.md','D')[0].due??null,codePreserved:changeTask(raw,planTasks(raw,'T.md','D')[0],{time:{start:'10:00'}}).includes('` 09:00 ERROR `')},{due:null,codePreserved:true});
});
test('R02 upcoming must include an upcoming due date even if its scheduled date passed',()=>assert.equal(taskMatches(planTasks('- [ ] 报告 ⏳ 2026-09-09 📅 2026-09-12','T.md','D')[0],'2026-09-10','upcoming'),true));
test('R03 extraction must retain the indentation that makes the original a code block',()=>assert.equal(extractFragments('    const x = 1;\n    console.log(x);').fragments[0].body,'    const x = 1;\n    console.log(x);'));
test('R04 outline import must preserve the literal hash in the native heading C#',()=>assert.equal(parseOutline('# C#')[0].title,'C#'));
test('R05 PDF note export must escape a literal setext marker (native renderer otherwise loses it)',()=>assert.equal(pdfExcerptDocument('标题\n===','[[paper.pdf]]',1).body.includes('> \\=\\=\\='),true));
test('R06 Markdown export must not treat a literal filename hash as a heading separator',()=>{const b=make();b.nodes=[{...node('file'),kind:'card',file:'C# 入门.md'}];assert.equal(selectionMarkdown(b,new Set(['file'])).includes('[[C# 入门.md]]'),false);});
test('R07 viewport selection and visible layout must both exclude collapsed descendants',()=>{
 const b=make(),rect={x:-1,y:-1,width:800,height:800};assert.deepEqual({selection:[...selectStudio(b,new Set(),'viewport',rect)],layout:[...resolveLayoutScope(b,'visible',new Set(),rect).ids]},{selection:['root','other'],layout:['root','other']});
});
test('R08 arranging a collapsed root must retain its hidden descendants relative positions',()=>{const b=make();b.nodes[2].y=-200;const before={x:b.nodes[1].x-b.nodes[0].x,y:b.nodes[1].y-b.nodes[0].y};stackSelection(b,new Set(['root','other']),'x',30);assert.deepEqual({x:b.nodes[1].x-b.nodes[0].x,y:b.nodes[1].y-b.nodes[0].y},before);});
test('R09 applying inline code must preserve selected boundary spaces after native rendering',()=>assert.equal(markdownEdit(' foo ',0,5,'code').text,'`  foo  `'));
test('R10 indented code examples must not become actionable tasks',()=>assert.deepEqual(planTasks('    - [ ] 示例任务\n\n- [ ] 真实任务','T.md','D').map(t=>t.text),['真实任务']));
test('R11 an older rescan read must not replace a newer task update',async()=>{
 // Bundle the real class; only the Obsidian host and controllable I/O delay are replaced.
 const code=buildSync({entryPoints:['src/task-planner.ts'],bundle:true,write:false,format:'cjs',platform:'node',external:['obsidian']}).outputFiles[0].text;
 class TFile{path='T.md';extension='md';stat={mtime:1,size:14};}class Component{}
 const module={exports:{} as any};new Function('require','module','exports',code)((id:string)=>{if(id==='obsidian')return{Component,TFile};throw Error(id);},module,module.exports);
 const file=new TFile();let body='- [ ] OLD TASK',hold=false,release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),captured=new Promise<void>(r=>entered=r);
 const vault={getAbstractFileByPath:(path:string)=>path===file.path?file:null,getMarkdownFiles:()=>[file],cachedRead:async()=>body,read:async()=>{const snapshot=body;if(hold){hold=false;entered();await gate;}return snapshot;},process:async(_file:unknown,fn:(text:string)=>string)=>{body=fn(body);file.stat.mtime++;file.stat.size=body.length;}};
 const p=new module.exports.TaskPlanner({vault},()=> 'D');await p.ready();const original=p.all()[0];hold=true;const scan=p.rescan();await captured;await p.update(original,{content:'NEW TASK'});assert.equal(p.all()[0].text,'NEW TASK');release();await scan;assert.equal(body,'- [ ] NEW TASK');assert.equal(p.all()[0].text,'NEW TASK');
});
test('R12 a successful same-size write in the same millisecond must invalidate its task cache',async()=>{
 const code=buildSync({entryPoints:['src/task-planner.ts'],bundle:true,write:false,format:'cjs',platform:'node',external:['obsidian']}).outputFiles[0].text;
 class TFile{path='T.md';extension='md';stat={mtime:1,size:14};}class Component{}
 const module={exports:{} as any};new Function('require','module','exports',code)((id:string)=>{if(id==='obsidian')return{Component,TFile};throw Error(id);},module,module.exports);
 const file=new TFile();let body='- [ ] NEW TASK';
 const vault={getAbstractFileByPath:(path:string)=>path===file.path?file:null,getMarkdownFiles:()=>[file],cachedRead:async()=>body,read:async()=>body,process:async(_file:unknown,fn:(text:string)=>string)=>{body=fn(body);/* Two native writes can have the same mtime millisecond and byte length. */}};
 const p=new module.exports.TaskPlanner({vault},()=> 'D');await p.ready();await p.update(p.all()[0],{content:'OLD TASK'});assert.equal(body,'- [ ] OLD TASK');assert.equal(p.all()[0].text,'OLD TASK');
});
