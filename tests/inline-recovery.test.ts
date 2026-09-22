import {test} from 'node:test';
import {releaseEditorResource} from '../src/editor-cleanup';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

// Exercise the real persistence methods independently of native editor construction.
function fixture(){
 const module={exports:{} as any};new Function('require','module','exports',transformSync(readFileSync('src/inline-node-editor.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>name==='./editor-cleanup'?{releaseEditorResource}:{},module,module.exports);
 const e=Object.create(module.exports.InlineNodeEditor.prototype),classes=new Set<string>(),states:any[]=[];
 Object.assign(e,{input:{value:'未保存的草稿',readOnly:false},options:{value:'原文',save:async()=>{}},status:{text:'',setText(value:string){this.text=value;}},el:{removeClass:(name:string)=>classes.delete(name),addClass:(name:string)=>classes.add(name),hasClass:(name:string)=>classes.has(name)},flushLayout:()=>{},updateState:()=>states.push({saving:e.saving,backingUp:e.backingUp,readOnly:e.input.readOnly})});
 return{e,states,classes};
}
test('concurrent persistence callers share one recovery write and lock the captured draft',async()=>{
 const {e,states}=fixture();let release!:()=>void,calls=0,written='';const gate=new Promise<void>(resolve=>release=resolve);
 const save=async(value:string)=>{calls++;written=value;await gate;};const a=e.backup(save),b=e.backup(save),c=e.commit();await Promise.resolve();
 assert.equal(calls,1);assert.equal(written,'未保存的草稿');assert.equal(e.input.readOnly,true);assert.equal(e.saving,true);assert.ok(states.some(s=>s.backingUp&&s.readOnly));
 release();assert.deepEqual(await Promise.all([a,b,c]),[true,true,true]);assert.equal(e.input.readOnly,false);assert.equal(e.saving,false);assert.equal(e.backingUp,false);
});
test('failed recovery keeps content editable and allows an explicit retry',async()=>{
 const {e,classes}=fixture();assert.equal(await e.backup(async()=>{throw Error('磁盘暂不可写');}),false);
 assert.equal(e.value,'未保存的草稿');assert.equal(e.input.readOnly,false);assert.equal(e.saving,false);assert.ok(classes.has('has-error'));assert.match(e.status.text,/草稿备份失败：磁盘暂不可写/);
 let saved='';assert.equal(await e.backup(async(value:string)=>{saved=value;}),true);assert.equal(saved,'未保存的草稿');assert.equal(classes.has('has-error'),false);
});
test('recovery does not depend on optional layout measurement',async()=>{
 const {e}=fixture();e.flushLayout=()=>{throw Error('布局不可用');};let saved='';assert.equal(await e.backup(async(value:string)=>{saved=value;}),true);assert.equal(saved,e.value);
});
test('recovery captures synchronous input finalization caused by freezing the editor',async()=>{
 const {e}=fixture();let locked=false;Object.defineProperty(e.input,'readOnly',{get:()=>locked,set:(value:boolean)=>{locked=value;if(value)e.input.value+='（输入已完成）';}});
 let saved='';assert.equal(await e.backup(async(value:string)=>{saved=value;}),true);assert.equal(saved,'未保存的草稿（输入已完成）');assert.equal(e.input.readOnly,false);
});

test('read-only preparation reentry joins the existing save',async()=>{
 const {e}=fixture();let locked=false,again:Promise<boolean>|undefined,calls=0;
 Object.defineProperty(e.input,'readOnly',{get:()=>locked,set:(value:boolean)=>{const was=locked;locked=value;if(value&&!was)again=e.commit();}});
 e.options.save=async()=>{calls++;};await e.commit();await again;assert.equal(calls,1);assert.equal(e.input.readOnly,false);
});
test('layout preparation reentry cannot start a second save',async()=>{
 const {e}=fixture();let entered=false,again:Promise<boolean>|undefined,calls=0;
 e.flushLayout=()=>{if(!entered){entered=true;again=e.commit();}};e.options.save=async()=>{calls++;};await e.commit();await again;assert.equal(calls,1);
});
test('preparation failure keeps the draft and supports explicit retry',async()=>{
 const {e,classes}=fixture();let fail=true,locked=false,calls=0;
 Object.defineProperty(e.input,'readOnly',{get:()=>locked,set:(value:boolean)=>{locked=value;if(value&&fail)throw Error('编辑器暂不可锁定');}});
 e.options.save=async()=>{calls++;};assert.equal(await e.commit(),false);assert.equal(calls,0);assert.equal(e.saving,false);assert.equal(locked,false);assert.ok(classes.has('has-error'));
 fail=false;assert.equal(await e.commit(),true);assert.equal(calls,1);
});
test('closing during preparation prevents a write from an obsolete draft',async()=>{
 const {e}=fixture();let calls=0;e.flushLayout=()=>{e.disposed=true;};e.options.save=async()=>{calls++;};assert.equal(await e.commit(),false);assert.equal(calls,0);
});
test('unlock callbacks cannot duplicate an already finished write',async()=>{
 const {e}=fixture();let locked=false,again:Promise<boolean>|undefined,calls=0;
 Object.defineProperty(e.input,'readOnly',{get:()=>locked,set:(value:boolean)=>{const was=locked;locked=value;if(!value&&was)again=e.commit();}});
 e.options.save=async()=>{calls++;};await e.commit();await again;assert.equal(calls,1);assert.equal(e.saving,false);
});
