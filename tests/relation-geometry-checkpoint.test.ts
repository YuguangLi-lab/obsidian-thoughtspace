import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,emptyBoard,History,parseBoard,type Board,type Card} from '../src/model';
import {canPersistRelationGeometry,relationGeometryShape,relationGeometryTextStamp,validRelationGeometryCheckpoint,type RelationGeometryCheckpoint,type RelationGeometryEntry} from '../src/relation-geometry-checkpoint';

const card=(patch:Partial<Card>={}):Card=>({id:'note',kind:'card',file:'Notes/Source.md',autoFit:true,x:10,y:20,width:280,height:160,color:'blue',...patch});
const text=(patch:Partial<Card>={}):Card=>card({kind:'text',file:undefined,autoFit:undefined,text:'原生正文',topic:true,...patch});
const entry=(node:Card,patch:Partial<RelationGeometryEntry>={}):RelationGeometryEntry=>({id:node.id,shape:relationGeometryShape(node),...(node.text!==undefined?{textStamp:relationGeometryTextStamp(node.text)}:{}),...(node.file?{source:{path:node.file,mtime:100,size:200,ctime:50}}:{}),...patch});
const checkpoint=(node=card()):RelationGeometryCheckpoint=>({version:1,entries:[entry(node)]});
const board=(node=card()):Board=>({...emptyBoard(),version:3,nodes:[node]});

test('an optional checkpoint survives the board round trip without changing node geometry or content',()=>{
 const node=text(),b=board(node),before=clone(b);b.relationGeometry=checkpoint(node);
 const read=parseBoard(JSON.stringify(b));assert.deepEqual(read,clone(b));assert.deepEqual(read.nodes,before.nodes);assert.deepEqual(read.edges,before.edges);assert.deepEqual(read.viewport,before.viewport);assert.equal(read.relationGeometry?.entries[0].shape.includes(node.text!),false);
});
for(const version of [1,2,3] as const)test(`version ${version} boards remain compatible with optional checkpoints`,()=>{
 const b=board();b.version=version;assert.deepEqual(parseBoard(JSON.stringify(b)),b);assert.equal('relationGeometry' in parseBoard(JSON.stringify(b)),false);
 b.relationGeometry=checkpoint(b.nodes[0]);assert.deepEqual(parseBoard(JSON.stringify(b)),b);
});
test('history owns isolated checkpoint snapshots through undo and redo',()=>{
 const b=board();b.relationGeometry=checkpoint();const before=clone(b),history=new History();history.push(b);delete b.relationGeometry;
 const undone=history.undo(b)!;assert.deepEqual(undone,before);const redone=history.redo(undone)!;assert.equal(redone.relationGeometry,undefined);undone.relationGeometry!.entries[0].shape='changed';assert.deepEqual(history.undo(redone),before);
});
test('only objects with active automatic measurement persist sizing intent',()=>{
 assert.equal(canPersistRelationGeometry(card()),true);assert.equal(canPersistRelationGeometry(card({locked:true})),true);
 for(const autoFit of [undefined,false])assert.equal(canPersistRelationGeometry(card({autoFit})),false);
 for(const kind of ['board','section','audio','video'] as const)assert.equal(canPersistRelationGeometry(card({kind})),false);
 for(const kind of ['image','pdf'] as const)assert.equal(canPersistRelationGeometry(card({kind,autoFit:undefined})),true);
 assert.equal(canPersistRelationGeometry(text()),true);assert.equal(canPersistRelationGeometry(text({topic:false})),false);assert.equal(canPersistRelationGeometry(text({textAutoHeight:false})),false);assert.equal(canPersistRelationGeometry(text({autoSize:false})),false);
 assert.equal(canPersistRelationGeometry(text({topic:false,autoSize:false,textAutoHeight:true})),true);assert.equal(canPersistRelationGeometry(text({webUrl:'https://example.com'})),false);
 assert.equal(canPersistRelationGeometry(text({topic:false,text:'| name |\n| --- |\n| content |'})),true);assert.equal(canPersistRelationGeometry(text({topic:false,text:'```\n| name |\n| --- |\n```'})),false);
});
test('shape is deterministic, bounded to sizing inputs, and does not retain body text',()=>{
 const node=text({title:'短标题',text:'a secret body',fontSize:20}),shape=relationGeometryShape(node);
 assert.equal(shape,relationGeometryShape(clone(node)));assert.equal(shape.includes(node.text!),false);assert.equal(shape,relationGeometryShape({...node,text:'different body',x:999,y:888,color:'green',review:'done'}));
 assert.equal(shape,relationGeometryShape({...node,id:'different-id'}),'entry ID owns identity independently');
 assert.deepEqual(JSON.parse(shape),[node.kind,null,node.title,null,null,node.width,node.height,null,null,null,null,null,null,null,node.topic,null,null,null,null,node.fontSize,null,null,null,null,null]);
});
const sizingChanges:Partial<Card>[]=[{kind:'image'},{file:'Other.md'},{title:'Other title'},{width:320},{height:200},{autoFit:false},{preferredWidth:400},{collapsed:true},{branchFolded:true},{sectionFolded:true},{locked:true},{autoSize:false},{topic:true},{textAutoHeight:true},{textMaxWidth:320},{cardStyle:'paper'},{fontFamily:'serif'},{fontSize:24},{borderWidth:3},{textAlign:'right'},{imageUrl:'https://example.com/a.png'},{pdfPage:2},{webUrl:'https://example.com'}];
for(const change of sizingChanges)test(`shape invalidates the sizing input ${Object.keys(change)[0]}`,()=>{
 const node=card();assert.notEqual(relationGeometryShape(node),relationGeometryShape({...node,...change}));
});
test('paragraph origin path, mode and subpath participate without duplicating quoted text',()=>{
 const node=text({paragraphQuote:{mode:'embed',path:'Notes/Origin.md',subpath:'#Topic'}}),shape=relationGeometryShape(node);
 assert(shape.includes('Notes/Origin.md'));assert(shape.includes('#Topic'));assert.notEqual(shape,relationGeometryShape({...node,paragraphQuote:{mode:'embed',path:'Notes/Renamed.md',subpath:'#Topic'}}));
 assert.notEqual(shape,relationGeometryShape({...node,paragraphQuote:{mode:'embed',path:'Notes/Origin.md',subpath:'#Other'}}));
 assert.notEqual(shape,relationGeometryShape({...node,paragraphQuote:{mode:'snapshot',path:'Notes/Origin.md',subpath:'#Topic',quote:'sensitive quote',hash:'a'.repeat(64),from:0,to:15}}));
 assert.equal(relationGeometryShape({...node,paragraphQuote:{mode:'snapshot',path:'Notes/Origin.md',quote:'sensitive quote',hash:'a'.repeat(64),from:0,to:15}}).includes('sensitive quote'),false);
});
test('text fingerprints distinguish absent, empty, Unicode and same-length edited content',()=>{
 assert.equal(relationGeometryTextStamp(undefined),undefined);assert.equal(relationGeometryTextStamp(''),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
 assert.match(relationGeometryTextStamp('原生正文')!,/^[a-f0-9]{64}$/);assert.equal(relationGeometryTextStamp('原生正文'),relationGeometryTextStamp('原生正文'));assert.notEqual(relationGeometryTextStamp('AB'),relationGeometryTextStamp('BA'));
 const body='private paragraph '.repeat(100000),stamp=relationGeometryTextStamp(body)!;assert.equal(stamp.length,64);assert.equal(stamp.includes('private'),false);
});
test('validation is pure with frozen checkpoint and source inputs',()=>{
 const n=Object.freeze(card()),source=Object.freeze({path:n.file!,mtime:1.5,size:0,ctime:0}),saved=Object.freeze({version:1,entries:Object.freeze([Object.freeze(entry(n,{source}))])});
 assert.equal(validRelationGeometryCheckpoint(saved,Object.freeze([n])),true);assert.equal(source.mtime,1.5);
});
const malformed:unknown[]=[null,[],{}, {version:2,entries:[]},{version:1,entries:null},{version:1,entries:[null]},
 {version:1,entries:[{id:'missing',shape:'[]'}]},{version:1,entries:[{id:' ',shape:'[]'}]},
 {version:1,entries:[{id:'note',shape:''}]},{version:1,entries:[{id:'note',shape:123}]},
 {version:1,entries:[{id:'note',shape:'x'.repeat(65537)}]},
 {version:1,entries:[{id:'note',shape:'[]',textStamp:'A'.repeat(64)}]},
 {version:1,entries:[{id:'note',shape:'[]',textStamp:'a'.repeat(63)}]},
 {version:1,entries:[{id:'note',shape:'[]',source:null}]},
 {version:1,entries:[{id:'note',shape:'[]'},{id:'note',shape:'[]'}]}];
for(let i=0;i<malformed.length;i++)test(`invalid optional cache ${i+1} is removed without rejecting a valid board`,()=>{
 const b=board(),saved=malformed[i];assert.equal(validRelationGeometryCheckpoint(saved,b.nodes),false);const parsed=parseBoard(JSON.stringify({...b,relationGeometry:saved}));assert.deepEqual(parsed,b);
});
for(const path of ['', '/Notes/Source.md','../Source.md','Notes/../Source.md','./Source.md','Notes//Source.md','Notes\\Source.md','C:Source.md','https://example.com/a.md','Notes/\nSource.md','a'.repeat(2049)])test(`invalid source path ${JSON.stringify(path.slice(0,30))} is rejected`,()=>{
 const n=card(),saved=checkpoint(n);saved.entries[0].source!.path=path;assert.equal(validRelationGeometryCheckpoint(saved,[n]),false);
});
for(const [key,value] of [['mtime',NaN],['mtime',Infinity],['mtime',-1],['size',NaN],['size',Infinity],['size',-1],['size',0.5],['size',Number.MAX_SAFE_INTEGER+1],['ctime',NaN],['ctime',Infinity],['ctime',-1]] as const)test(`source ${key} ${value} does not validate`,()=>{
 const n=card(),saved=checkpoint(n);saved.entries[0].source![key]=value;assert.equal(validRelationGeometryCheckpoint(saved,[n]),false);
});
test('source stats may omit ctime and source itself may be absent for local text',()=>{
 const n=card(),saved=checkpoint(n);delete saved.entries[0].source!.ctime;assert.equal(validRelationGeometryCheckpoint(saved,[n]),true);const t=text();assert.equal(validRelationGeometryCheckpoint(checkpoint(t),[t]),true);
});
test('structurally valid stale identities are left to the current Session source comparison',()=>{
 const n=card(),saved=checkpoint(n);saved.entries[0].shape=relationGeometryShape({...n,fontSize:24});saved.entries[0].source!.mtime=5;assert.equal(validRelationGeometryCheckpoint(saved,[n]),true);
});
test('unsupported and no-longer-automatic objects cannot retain persisted measurement protection',()=>{
 for(const n of [card({autoFit:false}),card({kind:'board',file:'nested.thoughtspace'}),text({autoSize:false}),card({kind:'section',title:'Group'})])assert.equal(validRelationGeometryCheckpoint(checkpoint(n),[n]),false);
});
test('duplicate IDs are rejected even when enough other live nodes are present',()=>{
 const n=card(),saved=checkpoint(n);saved.entries.push(clone(saved.entries[0]));assert.equal(validRelationGeometryCheckpoint(saved,[n,card({id:'other'})]),false);
});
test('deleted targets discard the cache without altering remaining source or geometry data',()=>{
 const b=board();b.relationGeometry=checkpoint();b.nodes=[];const read=parseBoard(JSON.stringify(b));assert.equal(read.relationGeometry,undefined);assert.deepEqual(read.nodes,[]);assert.deepEqual(read.viewport,b.viewport);
});
test('cache entries and strings have a board-local total size budget',()=>{
 const nodes=Array.from({length:123},(_,i)=>card({id:'node-'+i})),saved:RelationGeometryCheckpoint={version:1,entries:nodes.map(node=>entry(node,{shape:'x'.repeat(65536)}))};
 assert.equal(validRelationGeometryCheckpoint({...saved,entries:saved.entries.slice(0,122)},nodes),true);assert.equal(validRelationGeometryCheckpoint(saved,nodes),false);
 const oversized=card({id:'x'.repeat(2049)});assert.equal(validRelationGeometryCheckpoint(checkpoint(oversized),[oversized]),false);
});
test('an empty optional cache is harmless and ordinary invalid board data remains an error',()=>{
 const b=board();b.relationGeometry={version:1,entries:[]};assert.deepEqual(parseBoard(JSON.stringify(b)),b);
 b.nodes[0].width=1;assert.throws(()=>parseBoard(JSON.stringify(b)),/白板节点数据不完整/);
});
