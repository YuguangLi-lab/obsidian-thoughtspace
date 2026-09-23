import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,parseBoard,clone} from '../src/model';

const valid=()=>({...emptyBoard(),version:3 as const,nodes:[{id:'a',kind:'text' as const,text:'研究主题',color:'blue' as const,x:0,y:0,width:200,height:100}]});
const read=(value:unknown)=>parseBoard(JSON.stringify(value));
test('untrusted board collections and nested records reject primitives and null with domain errors',()=>{
 for(const input of [null,[],true,'text',{...valid(),nodes:{}},{...valid(),edges:'edge'}])assert.throws(()=>read(input),/不支持的白板格式或版本/);
 for(const node of [null,[],42,'text'])assert.throws(()=>read({...valid(),nodes:[node]}),/白板节点数据不完整/);
 for(const key of ['file','title','text'])assert.throws(()=>read({...valid(),nodes:[{...valid().nodes[0],[key]:42}]}),/白板节点数据不完整/);
 for(const viewport of [null,[],{},'view',{x:0,y:0,zoom:'1'}])assert.throws(()=>read({...valid(),viewport}),/白板视口数据不完整/);
 for(const savedViews of [[null],[[]],[{id:'view',name:'视角',viewport:{x:0,y:0,zoom:'1'}}]])assert.throws(()=>read({...valid(),savedViews}),/保存视角无效/);
 for(const selectionSets of [[null],[{id:'set',name:'选区',ids:[1]}]])assert.throws(()=>read({...valid(),selectionSets}),/保存选区无效/);
});
test('writing metadata validates each chapter and option before reading fields',()=>{
 const writing={title:'草稿',order:['a']};
 for(const chapters of [[null],[[]],[{id:'chapter',title:3,body:''}],[{id:'a',title:'冲突',body:''}],[{id:'b',title:'重复',body:''},{id:'b',title:'重复',body:''}]])assert.throws(()=>read({...valid(),writing:{...writing,chapters}}),/写作章节数据无效/);
 for(const options of [[],{a:null},{a:[]},{a:{level:'2'}},{a:{excluded:'false'}}])assert.throws(()=>read({...valid(),writing:{...writing,options}}),/写作选项无效/);
 const complete={...valid(),writing:{...writing,chapters:[{id:'intro',title:'导言',body:'内容'}],options:{a:{title:'重命名',level:2,note:'备注',excluded:false}}}};
 assert.deepEqual(read(complete),complete);
});
test('typed cloning isolates nested board metadata while preserving JSON snapshot semantics',()=>{
 const original={...valid(),writing:{title:'文章',order:['a'],options:{a:{note:'原备注'}}}},copy=clone(original);
 copy.nodes[0].text='已修改';copy.writing.options.a.note='新备注';
 assert.equal(original.nodes[0].text,'研究主题');assert.equal(original.writing.options.a.note,'原备注');
 assert.deepEqual(read(copy),copy);
 assert.deepEqual(clone({value:'kept',optional:undefined}),{value:'kept'});
});
