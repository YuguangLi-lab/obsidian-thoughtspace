import {test} from 'node:test';
import {releaseEditorResource} from '../src/editor-cleanup';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

function fixture(){
 const module={exports:{} as any},warnings:unknown[]=[];
 new Function('require','module','exports','console',transformSync(readFileSync('src/inline-node-editor.ts','utf8'),{loader:'ts',format:'cjs'}).code)((name:string)=>name==='./editor-cleanup'?{releaseEditorResource}:{},module,module.exports,{warn:(...args:unknown[])=>warnings.push(args)});
 const e=Object.create(module.exports.InlineNodeEditor.prototype),classes=new Set<string>();
 Object.assign(e,{input:{value:'正文草稿',style:{},readOnly:false},options:{value:'原文',resize:()=>{},save:async()=>{}},body:{offsetLeft:0,offsetTop:30,offsetWidth:240,offsetHeight:80},status:{text:'',setText(value:string){this.text=value;}},layoutFailures:new Set(),layoutHint:{hidden:true},el:{removeClass:(n:string)=>classes.delete(n),addClass:(n:string)=>classes.add(n),hasClass:(n:string)=>classes.has(n)},updateState:()=>{}});
 return{e,classes,warnings};
}
test('failed auto sizing does not stop normal content persistence',async()=>{
 const {e,warnings,classes}=fixture();let saved='';e.options.resize=()=>{throw Error('测量失败');};e.options.save=async(value:string)=>{saved=value;};
 assert.equal(await e.commit(),true);assert.equal(saved,'正文草稿');assert.equal(e.layoutHint.hidden,false);assert.equal(classes.has('has-error'),false);assert.equal(e.input.readOnly,false);assert.equal(warnings.length,1);
});
test('unchanged failed measurement is not repeated by layout observers or save',async()=>{
 const {e,warnings}=fixture();let calls=0;e.options.resize=()=>{calls++;throw Error('测量失败');};
 for(let n=0;n<30;n++)e.flushLayout();await e.commit();assert.equal(calls,1);assert.equal(warnings.length,1);assert.equal(e.layoutHint.hidden,false);
 e.input.value+='修改';e.flushLayout();assert.equal(calls,2);assert.equal(warnings.length,1);
 e.options.resize=()=>{calls++;};e.input.value+='重试';e.flushLayout();assert.equal(calls,3);assert.equal(e.layoutHint.hidden,true);
});
test('a font or size change can retry sizing without changing text',()=>{
 const {e}=fixture();e.options.resize=()=>{throw Error('测量失败');};e.flushLayout();
 let appearance=false;e.options.resize=(_value:string,_input:unknown,changed:boolean)=>{appearance=changed;};e.appearanceChanged=true;e.flushLayout();
 assert.equal(appearance,true);assert.equal(e.layoutHint.hidden,true);assert.equal(e.value,'正文草稿');
});
test('native geometry failure cannot block saving or leave inputs locked',async()=>{
 const {e}=fixture();let calls=0,saved='';e.native={resize:()=>{calls++;throw Error('原生排版失败');}};e.options.save=async(value:string)=>{saved=value;};
 assert.equal(await e.commit(),true);e.flushLayout();assert.equal(calls,1);assert.equal(saved,e.value);assert.equal(e.layoutHint.hidden,false);assert.equal(e.input.readOnly,false);
 e.native.resize=()=>{calls++;};e.body.offsetWidth=300;e.flushLayout();assert.equal(calls,2);assert.equal(e.layoutHint.hidden,true);
});
test('recovering one layout stage does not clear another outstanding failure',()=>{
 const {e}=fixture();e.options.resize=()=>{throw Error('尺寸');};e.native={resize:()=>{throw Error('几何');}};e.flushLayout();assert.equal(e.layoutFailures.size,2);
 e.options.resize=()=>{};e.input.value+='新';e.flushLayout();assert.equal(e.layoutFailures.size,1);assert.equal(e.layoutHint.hidden,false);
 e.native.resize=()=>{};e.body.offsetHeight=120;e.flushLayout();assert.equal(e.layoutHint.hidden,true);
});
test('a layout warning never masks a real source conflict or disables its retry',async()=>{
 const {e,classes}=fixture();e.options.resize=()=>{throw Error('排版失败');};e.options.save=async()=>{throw Error('来源已被其他窗口修改');};
 assert.equal(await e.commit(),false);assert.ok(classes.has('has-error'));assert.match(e.status.text,/来源已被其他窗口修改/);assert.equal(e.layoutHint.hidden,false);assert.equal(e.input.readOnly,false);
 e.options.save=async()=>{};assert.equal(await e.commit(),true);assert.equal(classes.has('has-error'),false);
});


test('native text height is transient, intrinsic, and does not feed back from the larger frame',()=>{
 const {e}=fixture(),heights:number[]=[];let intrinsic=302;
 Object.assign(e,{node:{offsetHeight:225},native:{resize(){},intrinsicHeight:()=>intrinsic}});e.body.offsetHeight=223;e.options.nodeKind='text';e.options.temporaryHeight=(height:number)=>{heights.push(height);e.node.offsetHeight=height;e.body.offsetHeight=height-2;};
 for(let n=0;n<30;n++)e.flushLayout();assert.deepEqual(heights,[304]);assert.equal(e.input.style.height,'302px');
 intrinsic=140;e.flushLayout();assert.deepEqual(heights,[304,142]);assert.equal(e.value,'正文草稿');
});
test('temporary native height has a finite cap and ignores invalid measurements',()=>{
 const {e}=fixture(),heights:number[]=[];let intrinsic=10000;
 Object.assign(e,{node:{offsetHeight:225},native:{resize(){},intrinsicHeight:()=>intrinsic}});e.body.offsetHeight=223;e.options.nodeKind='text';e.options.temporaryHeight=(height:number)=>heights.push(height);
 e.flushLayout();assert.deepEqual(heights,[1200]);for(const value of [NaN,Infinity,-5]){intrinsic=value;e.flushLayout();}assert.deepEqual(heights,[1200]);
});
test('native card drafts and fallback source inputs do not opt into temporary text geometry',()=>{
 const {e}=fixture();let calls=0;e.options.temporaryHeight=()=>calls++;e.options.nodeKind='card';e.native={resize(){},intrinsicHeight:()=>500};e.flushLayout();assert.equal(calls,0);
 e.options.nodeKind='text';e.native=undefined;e.flushLayout();assert.equal(calls,0);
});
test('a failed native-height callback cannot prevent saving or repeat on every layout frame',async()=>{
 const {e,warnings}=fixture();let calls=0,saved='';Object.assign(e,{node:{offsetHeight:225},native:{resize(){},intrinsicHeight:()=>300}});e.body.offsetHeight=223;e.options.nodeKind='text';e.options.temporaryHeight=()=>{calls++;throw Error('detached board');};e.options.save=async(value:string)=>{saved=value;};
 e.flushLayout();assert.equal(e.layoutHint.hidden,false);await e.commit();assert.equal(saved,e.value);assert.equal(calls,1);assert.equal(warnings.length,1);
});
