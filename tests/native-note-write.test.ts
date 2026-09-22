import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
function fixture(){
 class MarkdownView {file:any;editor:any;getMode(){return 'source';}}
 const m={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/native-note-state.ts','utf8'),{loader:'ts',format:'cjs'}).code)(()=>({MarkdownView}),m,m.exports);
 let source='原文',valid=true,checks=0,writes=0,views:any[]=[],release!:()=>void;
 const file={path:'note.md'},gate=new Promise<void>(r=>release=r),app={workspace:{getLeavesOfType:()=>views.map(view=>({view}))},vault:{process:async(_file:any,fn:(text:string)=>string)=>{await gate;source=fn(source);writes++;}}};
 const validate=()=>{checks++;if(!valid)throw Error('卡片已重新关联');};
 return {write:()=>m.exports.writeNativeNoteDraft(app,file,'原文','草稿',validate),release,checks:()=>checks,writes:()=>writes,source:()=>source,relink:()=>valid=false,editDisk:(text:string)=>source=text,editNative:()=>{const view=new MarkdownView();view.file=file;view.editor={getValue:()=> '原生未保存编辑'};views=[view];}};
}
test('queued draft write rechecks ownership at the atomic transform',async()=>{
 const f=fixture(),pending=f.write();f.relink();f.release();await assert.rejects(pending,/重新关联/);assert.equal(f.source(),'原文');assert.equal(f.writes(),0);assert.equal(f.checks(),2);
});
test('a target invalid before enqueue never reaches the vault',async()=>{
 const f=fixture();f.relink();await assert.rejects(f.write(),/重新关联/);assert.equal(f.writes(),0);assert.equal(f.checks(),1);
});
test('disk changes while queued remain protected',async()=>{
 const f=fixture(),pending=f.write();f.editDisk('外部编辑');f.release();await assert.rejects(pending,/原笔记已变化/);assert.equal(f.source(),'外部编辑');assert.equal(f.writes(),0);
});
test('unsaved native changes while queued remain protected',async()=>{
 const f=fixture(),pending=f.write();f.editNative();f.release();await assert.rejects(pending,/原生笔记有新的编辑/);assert.equal(f.source(),'原文');assert.equal(f.writes(),0);
});
test('unchanged ownership and source produce one atomic write',async()=>{
 const f=fixture(),pending=f.write();f.release();await pending;assert.equal(f.source(),'草稿');assert.equal(f.writes(),1);assert.equal(f.checks(),2);
});
