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
test('native audio and video resizing retain playback identity while source and fold changes rebuild',()=>{
 for(const kind of ['audio','video'] as const){
  const media:Card={...node,kind,file:kind==='audio'?'recording.mp3':'recording.mp4',mediaStart:12.25},context=[true,false,100,1024],key=nodeRenderKey(media,context);
  for(const patch of [{width:500},{height:350},{x:-30,y:200,width:720,height:480}])assert.equal(nodeRenderKey({...media,...patch},context),key,`${kind} resize ${JSON.stringify(patch)}`);
  for(const patch of [{file:kind==='audio'?'other.mp3':'other.mp4'},{mediaStart:42.5},{collapsed:true,height:72,expandedHeight:350}])assert.notEqual(nodeRenderKey({...media,...patch},context),key,`${kind} changed ${JSON.stringify(patch)}`);
  assert.notEqual(nodeRenderKey(media,[true,false,101,1024]),key,`${kind} file revision`);
 }
});
test('auto-fit notes, text, images, PDF and containers retain size-based renderer invalidation',()=>{
 for(const kind of ['card','text','image','pdf','board','section'] as const){const n={...node,kind,autoFit:true};assert.notEqual(nodeRenderKey({...n,width:500,height:350},[]),nodeRenderKey(n,[]));}
});

test('webpage resizing preserves browser state, while URL and fold changes rebuild',()=>{
 const n={...node,webUrl:'https://example.com/'},key=nodeRenderKey(n,[]);
 assert.equal(nodeRenderKey({...n,width:800,height:600},[]),key);
 assert.notEqual(nodeRenderKey({...n,webUrl:'https://example.org/'},[]),key);
 assert.notEqual(nodeRenderKey({...n,collapsed:true,expandedHeight:600},[]),key);
});

test('unchanged long text is serialized only once across neighboring-node redraws',()=>{
 const body='Large unchanged markdown.\n'.repeat(5000),n:Card={...node,text:body};
 const original=JSON.stringify;let fullBodySerializations=0;
 JSON.stringify=((value:unknown,...args:unknown[])=>{
  if(Array.isArray(value)&&value[0]?.text===body)fullBodySerializations++;
  return Reflect.apply(original,JSON,[value,...args]);
 }) as typeof JSON.stringify;
 try{
  const first=nodeRenderKey(n,[0,0,true,false,null]);
  for(let i=0;i<120;i++){n.x=i;n.color=i%2?'blue':'green';assert.equal(nodeRenderKey(n,[0,0,true,false,null]),first);}
  assert.equal(fullBodySerializations,1,'unrelated redraws must not repeatedly copy the unchanged long body');
 }finally{JSON.stringify=original;}
});

test('long-text reuse still detects in-place behavior, nested source and metadata mutations',()=>{
 const n:Card={...node,text:'Unchanged body\n'.repeat(5000),mindmapRules:{layout:'right',density:'standard',automatic:false},videoCapture:{id:'capture',note:'source.md'}};
 const metadata={tags:['#old'],frontmatter:{title:'Old'}},context=[0,0,true,false,metadata];
 let previous=nodeRenderKey(n,context);
 const edits=[()=>{n.mindmapRules!.automatic=true;},()=>{n.videoCapture!.note='updated.md';},()=>{metadata.tags.push('#new');},()=>{metadata.frontmatter.title='New';},()=>{n.locked=true;},()=>{n.text+='Actual edit';},()=>{n.height=250;}];
 for(const edit of edits){edit();const current=nodeRenderKey(n,context);assert.notEqual(current,previous);assert.equal(nodeRenderKey(n,context),current);previous=current;}
});

test('long-text keys preserve exact JSON shape, escaping and object own-key order',()=>{
 const body='"Quoted"\\line\n\u0000😀'.repeat(1000),n:Card={...node,text:body};
 const expected=()=>{const {x:_x,y:_y,color:_color,...content}=n;return JSON.stringify([content,1,null]);};
 assert.equal(nodeRenderKey(n,[1,null]),expected());assert.equal(nodeRenderKey(n,[1,null]),expected());
 delete n.text;n.text=body;assert.equal(nodeRenderKey(n,[1,null]),expected(),'moving the text property must not reuse a differently ordered JSON key');
 const fresh=structuredClone(n);assert.equal(nodeRenderKey(fresh,[1,null]),expected(),'replacement objects and undo snapshots retain the same render identity');
});

test('long-text stamps retain unknown own properties and observe their nested mutations',()=>{
 const n=Object.assign({...node,text:'Long body\n'.repeat(1000)},{properties:{labels:['old']}});
 Object.defineProperty(n,'__proto__',{value:{note:'Own data'},enumerable:true});
 const first=nodeRenderKey(n,[]);assert.equal(nodeRenderKey(n,[]),first);
 n.properties.labels.push('new');const changed=nodeRenderKey(n,[]);assert.notEqual(changed,first);
 const content=JSON.parse(changed)[0];assert.deepEqual(content.properties,{labels:['old','new']});
 assert.deepEqual(content.__proto__,{note:'Own data'});assert.equal(Object.hasOwn(content,'__proto__'),true);
});

test('a custom root JSON serializer retains uncached behavior for long text',()=>{
 let count=0;const n=Object.assign({...node,text:'Body\n'.repeat(1000)},{toJSON(){return{version:++count};}});
 assert.equal(nodeRenderKey(n,[]),'[{"version":1}]');assert.equal(nodeRenderKey(n,[]),'[{"version":2}]');
});

test('context and nested metadata custom serializers keep their original call count and array key',()=>{
 const n:Card={...node,text:'Body\n'.repeat(1000)};
 for(const nested of [false,true]){
  let calls=0;const metadata={toJSON(key:string){return{key,call:++calls};}};
  const context=nested?[{metadata}]:[metadata];
  for(let i=1;i<=3;i++){
   const result=JSON.parse(nodeRenderKey(n,context));
   assert.equal(calls,i,'one full render must invoke each metadata serializer only once');
   assert.deepEqual(nested?result[1].metadata:result[1],{key:nested?'metadata':'1',call:i});
  }
 }
});

test('plain metadata dates preserve their exact JSON output through in-place changes',()=>{
 const n:Card={...node,text:'Body\n'.repeat(1000)},date=new Date('2026-01-01T00:00:00.000Z');
 for(const stamp of [date.getTime(),date.getTime()+86400000]){
  date.setTime(stamp);
  const {x:_x,y:_y,color:_color,...content}=n;
  assert.equal(nodeRenderKey(n,[{date}]),JSON.stringify([content,{date}]));
 }
});

test('long-text key reuse is bounded across many live nodes in a large board',()=>{
 const first:Card={...node,id:'first-budgeted',text:'First large body\n'.repeat(1000)},others=Array.from({length:128},(_,i)=>({...node,id:'budget-'+i,text:('Large body '+i+'\n').repeat(1000)}));
 const original=JSON.stringify;let firstSerializations=0;
 JSON.stringify=((value:unknown,...args:unknown[])=>{
  if(Array.isArray(value)&&value[0]?.text===first.text)firstSerializations++;
  return Reflect.apply(original,JSON,[value,...args]);
 }) as typeof JSON.stringify;
 try{
  const key=nodeRenderKey(first,[]);for(const other of others)nodeRenderKey(other,[]);
  assert.equal(nodeRenderKey(first,[]),key);
  assert.equal(firstSerializations,2,'old entries should expire instead of retaining a large key for every visited board node');
 }finally{JSON.stringify=original;}
});

test('context array accessors are evaluated once before either cached or uncached JSON serialization',()=>{
 const n:Card={...node,text:'Body\n'.repeat(1000)};let reads=0;
 const context:unknown[]=[];Object.defineProperty(context,0,{get:()=>++reads,enumerable:true});
 assert.equal(JSON.parse(nodeRenderKey(n,context))[1],1);assert.equal(reads,1);
 assert.equal(JSON.parse(nodeRenderKey(n,context))[1],2);assert.equal(reads,2);
});

test('serialized undo and redo snapshots rebuild the same long-text keys without relying on object identity',async()=>{
 const {History,emptyBoard}=await import('../src/model'),history=new History(),board={...emptyBoard(),nodes:[{...node,text:'Original long body\n'.repeat(1000)}]};
 const originalKey=nodeRenderKey(board.nodes[0],[]);history.push(board);
 board.nodes[0].text='Edited long body\n'.repeat(1000);const editedKey=nodeRenderKey(board.nodes[0],[]);
 assert.notEqual(editedKey,originalKey);assert.equal(typeof history.undoStack[0],'string');
 const restored=history.undo(board)!;assert.notEqual(restored.nodes[0],board.nodes[0]);assert.equal(nodeRenderKey(restored.nodes[0],[]),originalKey);
 const redone=history.redo(restored)!;assert.equal(nodeRenderKey(redone.nodes[0],[]),editedKey);
});

test('decorative note styles preserve fixed previews but still invalidate automatic measurement',()=>{
 for(const autoFit of [undefined,false,true]){
  const card:Card={...node,kind:'card',file:'note.md',autoFit},context=[0,0,true,false,null],plain=nodeRenderKey(card,context);
  const band=nodeRenderKey({...card,cardStyle:'band'},context),paper=nodeRenderKey({...card,cardStyle:'paper'},context);
  if(autoFit){assert.notEqual(band,plain);assert.notEqual(paper,band);assert.notEqual(paper,plain);}
  else{assert.equal(band,plain);assert.equal(paper,plain);assert.equal(nodeRenderKey({...card,cardStyle:'paper',width:500,height:350},context),plain);}
 }
});
