import test from 'node:test';import assert from 'node:assert/strict';import {nodeRenderKey,syncNodeGeometry} from '../src/node-render-key';import type {Card} from '../src/model';
const node:Card={id:'n',kind:'text',text:'内容',x:10,y:20,width:200,height:80,color:'sand'};
test('moving a node reuses content while dimensions, body, font and file metadata invalidate it',()=>{const context=[2,true,false,100],key=nodeRenderKey(node,context);assert.equal(nodeRenderKey({...node,x:500,y:-300},context),key);for(const patch of [{width:300},{height:90},{text:'改变'},{fontFamily:'serif' as const},{collapsed:true}])assert.notEqual(nodeRenderKey({...node,...patch},context),key);assert.notEqual(nodeRenderKey(node,[2,true,false,101]),key);});
test('geometry writes are skipped when unchanged and preserve the live editor dimensions',()=>{let writes=0;const style=new Proxy({left:'10px',top:'20px',width:'200px',height:'80px'},{set(o,k,v){writes++;o[k as keyof typeof o]=v;return true;}}),element={style} as unknown as HTMLElement;syncNodeGeometry(node,element);assert.equal(writes,0);syncNodeGeometry({...node,x:30,width:400,height:300},element,true);assert.equal(writes,1);assert.equal(style.width,'200px');assert.equal(style.height,'80px');syncNodeGeometry({...node,x:30,width:400,height:300},element);assert.equal(writes,3);});
test('pure appearance updates preserve note, text, image and PDF render identity',()=>{
 for(const kind of ['card','text','image','pdf'] as const){
  const n={...node,kind},key=nodeRenderKey(n,[]);
  for(const patch of [{color:'green' as const},{fillColor:'#112233' as const},{transparent:true},{textColor:'blue' as const},{customBorder:true},{borderStyle:'dotted' as const}])assert.equal(nodeRenderKey({...n,...patch},[]),key,`${kind} ${JSON.stringify(patch)}`);
 }
});
test('measurement, behavior and source changes still rebuild reused previews',()=>{
 const n:Card={...node,kind:'card',file:'note.md',autoFit:true},key=nodeRenderKey(n,[2,3,true,false,100]);
 for(const patch of [{borderWidth:3},{fontSize:22},{textAlign:'center' as const},{autoFit:false},{preferredWidth:450},{locked:true},{collapsed:true},{file:'other.md'},{pdfPage:2},{title:'新标题'},{topic:true},{branchFolded:true}])assert.notEqual(nodeRenderKey({...n,...patch},[2,3,true,false,100]),key,JSON.stringify(patch));
 for(const context of [[3,3,true,false,100],[2,4,true,false,100],[2,3,false,false,100],[2,3,true,true,100],[2,3,true,false,101]])assert.notEqual(nodeRenderKey(n,context),key);
});
test('sub-board and section render identities retain their existing invalidation rules',()=>{
 for(const kind of ['board','section'] as const){const n={...node,kind};assert.notEqual(nodeRenderKey(n,[]),nodeRenderKey({...n,color:'green'},[]));}
});
test('fixed-size Markdown cards reuse content when only their dimensions change',()=>{
 for(const autoFit of [false,undefined]){
  const card:Card={...node,kind:'card',file:'note.md',autoFit},key=nodeRenderKey(card,[]);
  assert.equal(nodeRenderKey({...card,width:500,height:350},[]),key);
  assert.notEqual(nodeRenderKey({...card,autoFit:true},[]),key);
  for(const patch of [{collapsed:true},{expandedHeight:350},{locked:true},{preferredWidth:500},{fontSize:22},{borderWidth:3}])assert.notEqual(nodeRenderKey({...card,...patch},[]),key);
 }
});
test('auto-fit notes and media retain size-based renderer invalidation',()=>{
 for(const kind of ['card','text','image','pdf','board','section'] as const){const n={...node,kind,autoFit:true};assert.notEqual(nodeRenderKey({...n,width:500,height:350},[]),nodeRenderKey(n,[]));}
});
