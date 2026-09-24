import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {releaseEditorResource} from '../src/editor-cleanup';

// Exercise the shipped layout/save methods. Only DOM, animation scheduling and
// the native editor's requestMeasure boundary are controlled by this fixture.
const source=readFileSync(process.env.INLINE_GEOMETRY_SOURCE||'src/inline-node-editor.ts','utf8');
function fixture(){
 const warnings:unknown[][]=[],module={exports:{} as any};
 new Function('require','module','exports','console',transformSync(source,{loader:'ts',format:'cjs'}).code)(
  (name:string)=>name==='./editor-cleanup'?{releaseEditorResource}:{},module,module.exports,{warn:(...args:unknown[])=>warnings.push(args)});
 const editor=Object.create(module.exports.InlineNodeEditor.prototype),writes:{key:string;value:string}[]=[],frames=new Map<number,FrameRequestCallback>(),classes=new Set<string>();
 const style=new Proxy({} as Record<string,string>,{set(target,key:string,value:string){writes.push({key,value});target[key]=value;return true;}});
 const body={offsetLeft:0,offsetTop:30,offsetWidth:240,offsetHeight:80};
 const calls={resize:0,native:0,saves:[] as string[],disconnect:0,dispose:0,remove:0,focus:0};
 let frameId=0,resize:(value:string)=>void=()=>{},nativeResize=()=>{};
 const win={requestAnimationFrame:(run:FrameRequestCallback)=>{frames.set(++frameId,run);return frameId;},cancelAnimationFrame:(id:number)=>frames.delete(id),clearTimeout:()=>{}};
 const input={value:'原文',style,readOnly:false,selectionStart:1,selectionEnd:2,focus:()=>{calls.focus++;}};
 Object.assign(editor,{
  input,body,geometry:'',layoutFailures:new Set(),layoutHint:{hidden:true},
  native:{resize:()=>{calls.native++;nativeResize();},dispose:()=>{calls.dispose++;}},
  options:{value:'原文',resize:(value:string)=>{calls.resize++;resize(value);},save:async(value:string)=>{calls.saves.push(value);}},
  status:{text:'',setText(value:string){this.text=value;}},
  observer:{disconnect:()=>{calls.disconnect++;}},node:{removeClass:()=>{}},
  el:{ownerDocument:{defaultView:win},removeClass:(name:string)=>classes.delete(name),addClass:(name:string)=>classes.add(name),hasClass:(name:string)=>classes.has(name),remove:()=>{calls.remove++;}},
  updateState:()=>{},
 });
 const reset=()=>{writes.length=0;calls.resize=0;calls.native=0;};
 const tick=()=>{const batch=[...frames.values()];frames.clear();for(const run of batch)run(0);};
 return{editor,input,body,style,writes,calls,frames,warnings,reset,tick,setResize:(run:(value:string)=>void)=>{resize=run;},setNativeResize:(run:()=>void)=>{nativeResize=run;}};
}

test('typing with height-only auto sizing writes only height through the real scheduled layout chain',()=>{
 const f=fixture();f.editor.flushLayout();f.reset();f.setResize(()=>{f.body.offsetHeight++;});
 for(let i=0;i<120;i++){
  f.input.value=`草稿 ${i}`;
  f.editor.scheduleLayout();f.editor.scheduleLayout();f.editor.scheduleLayout();
  assert.equal(f.frames.size,1);f.tick();
 }
 assert.equal(f.calls.resize,120);assert.equal(f.calls.native,120);
 assert.deepEqual(f.writes.map(write=>write.key),Array(120).fill('height'));
 assert.deepEqual({...f.style},{left:'0px',top:'30px',width:'240px',height:'200px'});
 assert.equal(f.editor.value,'草稿 119');assert.equal(f.input.selectionStart,1);assert.equal(f.input.selectionEnd,2);assert.equal(f.calls.focus,0);
});

test('width-only content sizing updates width once and keeps the native layout notification',()=>{
 const f=fixture();f.editor.flushLayout();f.reset();f.setResize(()=>{f.body.offsetWidth=375;});
 f.input.value='改变宽度的草稿';f.editor.flushLayout();
 assert.deepEqual(f.writes,[{key:'width',value:'375px'}]);assert.equal(f.calls.resize,1);assert.equal(f.calls.native,1);
 assert.equal(f.style.height,'80px');assert.equal(f.editor.value,'改变宽度的草稿');
});

test('observer geometry updates preserve zero and fractional positions without repeating text sizing',()=>{
 const f=fixture();f.editor.flushLayout();f.reset();
 f.body.offsetLeft=-3.5;f.body.offsetTop=0;f.editor.scheduleLayout();f.tick();
 assert.deepEqual(f.writes,[{key:'left',value:'-3.5px'},{key:'top',value:'0px'}]);
 f.reset();f.body.offsetLeft=0;f.body.offsetTop=12.25;f.editor.scheduleLayout();f.tick();
 assert.deepEqual(f.writes,[{key:'left',value:'0px'},{key:'top',value:'12.25px'}]);
 assert.equal(f.calls.resize,0);assert.equal(f.calls.native,1);
 f.reset();f.body.offsetWidth=0;f.body.offsetHeight=0;f.editor.flushLayout();
 assert.deepEqual(f.writes,[{key:'width',value:'0px'},{key:'height',value:'0px'}]);assert.equal(f.calls.native,1);
});

test('unchanged layout observers and flushes do not write styles or notify the native editor',()=>{
 const f=fixture();f.editor.flushLayout();assert.equal(f.writes.length,4);assert.equal(f.calls.native,1);f.reset();
 for(let i=0;i<30;i++){f.editor.scheduleLayout();f.tick();f.editor.flushLayout();}
 assert.equal(f.writes.length,0);assert.equal(f.calls.resize,0);assert.equal(f.calls.native,0);
 f.body.offsetLeft=4;f.body.offsetTop=8;f.body.offsetWidth=300;f.body.offsetHeight=160;f.editor.flushLayout();
 assert.deepEqual({...f.style},{left:'4px',top:'8px',width:'300px',height:'160px'});assert.equal(f.writes.length,4);assert.equal(f.calls.native,1);
});

test('changed geometry still notifies native layout when an existing style already matches',()=>{
 const f=fixture();f.editor.flushLayout();f.body.offsetHeight=160;f.style.height='160px';f.reset();f.editor.flushLayout();
 assert.equal(f.writes.length,0);assert.equal(f.calls.native,1);assert.equal(f.calls.resize,0);
 // Textarea fallback has the same geometry contract, without a native instance.
 f.editor.native=undefined;f.body.offsetWidth=260;f.reset();f.editor.flushLayout();
 assert.deepEqual(f.writes,[{key:'width',value:'260px'}]);assert.equal(f.calls.native,0);
});

test('IME guard delays scheduled sizing and saving until composition has finished',async()=>{
 const f=fixture();f.editor.flushLayout();f.reset();f.setResize(()=>{f.body.offsetHeight=100;});
 f.editor.composing=true;f.input.value='正在组字';f.editor.scheduleLayout();
 assert.equal(f.frames.size,0);assert.equal(await f.editor.commit(),false);assert.equal(f.calls.saves.length,0);assert.equal(f.writes.length,0);
 f.editor.composing=false;f.input.value='已经输入完成';f.editor.scheduleLayout();f.tick();
 assert.deepEqual(f.writes,[{key:'height',value:'100px'}]);assert.equal(f.calls.native,1);assert.equal(f.calls.resize,1);
 f.reset();assert.equal(await f.editor.commit(),true);assert.deepEqual(f.calls.saves,['已经输入完成']);assert.equal(f.writes.length,0);assert.equal(f.calls.native,0);assert.equal(f.input.readOnly,false);
});

test('disposal cancels pending layout and late callbacks cannot write or save the disposed draft',async()=>{
 const f=fixture();f.editor.flushLayout();f.reset();f.input.value='尚未保存';f.editor.scheduleLayout();assert.equal(f.frames.size,1);
 f.editor.dispose();assert.equal(f.frames.size,0);assert.equal(f.calls.dispose,1);assert.equal(f.calls.disconnect,1);assert.equal(f.calls.remove,1);
 f.body.offsetHeight=300;f.tick();f.editor.flushLayout();f.editor.syncGeometry();f.editor.scheduleLayout();
 assert.equal(await f.editor.commit(),true);assert.equal(f.frames.size,0);assert.equal(f.writes.length,0);assert.equal(f.calls.resize,0);assert.equal(f.calls.native,0);assert.equal(f.calls.saves.length,0);
});

test('native measure failure keeps the draft saveable and retries only after a new geometry',async()=>{
 const f=fixture();f.editor.flushLayout();f.reset();f.input.value='保存失败测量后的草稿';f.body.offsetHeight=100;
 f.setNativeResize(()=>{throw Error('native measure failed');});
 assert.equal(await f.editor.commit(),true);assert.deepEqual(f.calls.saves,['保存失败测量后的草稿']);assert.equal(f.input.readOnly,false);assert.equal(f.editor.layoutHint.hidden,false);
 assert.deepEqual(f.writes,[{key:'height',value:'100px'}]);assert.equal(f.warnings.length,1);assert.equal(f.calls.native,1);
 f.reset();f.editor.flushLayout();assert.equal(f.calls.native,0);assert.equal(f.writes.length,0);
 f.setNativeResize(()=>{});f.body.offsetHeight=120;f.editor.flushLayout();
 assert.deepEqual(f.writes,[{key:'height',value:'120px'}]);assert.equal(f.calls.native,1);assert.equal(f.editor.layoutHint.hidden,true);
});
