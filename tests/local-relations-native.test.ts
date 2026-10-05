import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLocalRelations,type NativeLocalHost,type NativeLocalMetadata} from '../src/local-relations-native';
import {localNeighborhood} from '../src/local-relations';
import type {Board,Card} from '../src/model';
const node=(id:string,file=`Notes/${id}.md`,kind:Card['kind']='card'):Card=>({id,file,kind,x:0,y:0,width:240,height:100,color:'sand'});
const board=(nodes:Card[]):Board=>({version:3,nodes,edges:[],viewport:{x:10,y:20,zoom:1}});
function setup(nodes:Card[],metadata:Record<string,NativeLocalMetadata|null>={},links:Record<string,Record<string,number>>={}){
 const b=board(nodes),calls={exists:[] as string[],cache:[] as string[],resolved:[] as string[],resolve:[] as [string,string][],tags:[] as string[]},paths=new Set(nodes.filter(n=>n.file).map(n=>n.file!));
 const host:NativeLocalHost={exists:path=>{calls.exists.push(path);return paths.has(path);},cache:path=>{calls.cache.push(path);return metadata[path]??null;},resolved:path=>{calls.resolved.push(path);return links[path];},resolve:(text,from)=>{calls.resolve.push([text,from]);const hash=text.indexOf('#'),path=hash<0?text:text.slice(0,hash);return paths.has(path)?{path,subpath:hash<0?'':text.slice(hash)}:undefined;},tags:path=>{calls.tags.push(path);return path.endsWith('a.md')?['#work','#work']:[];}};
 return{b,host,calls,paths};
}

test('native note links preserve direction and never create parent child or sibling relations',()=>{
 const f=setup([node('a'),node('b'),node('c')],{}, {'Notes/a.md':{'Notes/b.md':2},'Notes/c.md':{'Notes/a.md':1}}),native=nativeLocalRelations(f.b,'a',f.host);
 assert.deepEqual(native.relations.map(r=>[r.kind,r.nodeId]),[['outgoing','b'],['incoming','c']]);
 const local=localNeighborhood(f.b,'a',{nativeRelations:native.relations});assert.equal(local.groups.find(g=>g.kind==='parents')!.total,0);assert.equal(local.groups.find(g=>g.kind==='children')!.total,0);assert.equal(local.groups.find(g=>g.kind==='siblings')!.total,0);
 assert.deepEqual(local.groups.find(g=>g.kind==='outgoing')!.items[0].edgeIds,[]);assert.equal(local.groups.find(g=>g.kind==='outgoing')!.items[0].nativeEvidence[0].count,2);
});

test('link embed and property evidence retain their source subpath line and property keys',()=>{
 const f=setup([node('a'),node('b')],{'Notes/a.md':{links:[{link:'Notes/b.md#Heading',original:'[[b#Heading]]',position:{start:{line:4,col:2,offset:50}}}],embeds:[{link:'Notes/b.md#^existing',original:'![[b#^existing]]',position:{start:{line:8}}}],frontmatterLinks:[{link:'Notes/b.md',original:'[[b]]',key:'parent.0'}]},'Notes/b.md':{}},{'Notes/a.md':{'Notes/b.md':3}});
 const native=nativeLocalRelations(f.b,'a',f.host),relation=native.relations[0];assert.equal(relation.evidenceTotal,3);assert.deepEqual(relation.evidence.map(p=>p.kind),['link','embed','property']);assert.deepEqual(relation.evidence.map(p=>p.subpath),['#Heading','#^existing','']);assert.equal(relation.evidence[0].line,4);assert.equal(relation.evidence[2].property,'parent.0');assert.equal(relation.evidence[2].line,undefined);assert.equal(new Set(relation.evidence.map(p=>p.id)).size,3);assert.ok(relation.evidence.every(p=>p.sourcePath==='Notes/a.md'&&p.targetPath==='Notes/b.md'));
 const local=localNeighborhood(f.b,'a',{nativeRelations:native.relations,query:'parent.0',queryField:'label'});assert.equal(local.matched,1);assert.equal(local.groups.find(g=>g.kind==='parents')!.total,0);
});

test('metadata links resolve relative to their source note including equal basenames',()=>{
 const f=setup([node('a','FolderA/Same.md'),node('b','FolderB/Same.md'),node('c','FolderB/Other.md')],{'FolderB/Same.md':{links:[{link:'Other#Here'}]}});
 f.host.resolve=(link,source)=>link==='Other#Here'&&source==='FolderB/Same.md'?{path:'FolderB/Other.md',subpath:'#Here'}:undefined;
 const result=nativeLocalRelations(f.b,'b',f.host);assert.deepEqual(result.relations.map(r=>r.nodeId),['c']);assert.equal(result.relations[0].evidence[0].sourcePath,'FolderB/Same.md');
});

test('every board instance of a linked file remains selectable without inventing same-source links',()=>{
 const f=setup([node('center','a.md'),node('same-center','a.md'),node('first','b.md'),node('second','b.md')],{}, {'a.md':{'a.md':1,'b.md':1},'b.md':{'a.md':1}});
 const result=nativeLocalRelations(f.b,'center',f.host);assert.deepEqual(result.relations.map(r=>[r.kind,r.nodeId]),[['outgoing','first'],['outgoing','second'],['incoming','first'],['incoming','second']]);assert.deepEqual(f.calls.cache,['a.md','b.md']);assert.deepEqual(f.calls.tags,['a.md','b.md']);assert.equal(result.tagsByNode.get('first'),result.tagsByNode.get('second'));
});

test('sub-board targets have native incoming links but their contents are never parsed',()=>{
 const f=setup([node('note','a.md'),node('child','Boards/Child.thoughtspace','board'),node('group','','section')],{}, {'a.md':{'Boards/Child.thoughtspace':1}});
 const result=nativeLocalRelations(f.b,'child',f.host);assert.deepEqual(result.relations.map(r=>[r.kind,r.nodeId]),[['incoming','note']]);assert.deepEqual(f.calls.cache,['a.md']);assert.ok(!f.calls.resolved.includes('Boards/Child.thoughtspace'));
});

test('group centers do not inherit source-note links from group membership or file-like data',()=>{
 const f=setup([node('group','a.md','section'),node('a','a.md'),node('b','b.md')],{}, {'a.md':{'b.md':1}});assert.deepEqual(nativeLocalRelations(f.b,'group',f.host).relations,[]);assert.deepEqual(f.calls.cache,[]);
});

test('unsupported centers never ask the metadata host for any data',()=>{
 for(const kind of ['text','image','pdf','audio','video'] as const){const f=setup([node('center','a.md',kind),node('b')]);assert.deepEqual(nativeLocalRelations(f.b,'center',f.host),{relations:[],tagsByNode:new Map(),pendingPaths:[]});assert.ok(Object.values(f.calls).every(list=>list.length===0));}
});

test('unsupported endpoints external notes self links and missing files remain outside the native graph',()=>{
 const f=setup([node('a','a.md'),node('text','text.md','text'),node('image','image.png','image'),node('gone','gone.md'),node('ok','ok.md')],{}, {'a.md':{'a.md':1,'text.md':1,'image.png':1,'outside.md':1,'gone.md':1,'ok.md':1},'outside.md':{'a.md':1}});f.paths.delete('gone.md');
 assert.deepEqual(nativeLocalRelations(f.b,'a',f.host).relations.map(r=>r.nodeId),['ok']);assert.ok(f.calls.cache.every(path=>path==='a.md'||path==='ok.md'));assert.ok(!f.calls.exists.includes('outside.md'));
});

test('pending cache is distinct from indexed notes with no links and uses aggregate evidence only',()=>{
 const f=setup([node('a','a.md'),node('b','b.md'),node('c','c.md')],{'b.md':{},'c.md':{}},{'a.md':{'b.md':4}}),result=nativeLocalRelations(f.b,'a',f.host);
 assert.deepEqual(result.pendingPaths,['a.md']);assert.equal(result.relations[0].evidence[0].kind,'indexed');assert.equal(result.relations[0].evidence[0].count,4);assert.equal(result.relations[0].evidence[0].line,undefined);
});

test('non-positive or non-finite native counts cannot create phantom relationships',()=>{
 const f=setup([node('a','a.md'),node('b','b.md'),node('c','c.md'),node('d','d.md')],{}, {'a.md':{'b.md':0,'c.md':NaN,'d.md':Infinity},'b.md':{'a.md':-1}});assert.deepEqual(nativeLocalRelations(f.b,'a',f.host).relations,[]);
});

test('native evidence retains all repeated references for evidence pagination',()=>{
 const references=Array.from({length:153},(_,i)=>({link:'b.md#Heading'+i,position:{start:{line:i}}})),f=setup([node('a','a.md'),node('b','b.md')],{'a.md':{links:references},'b.md':{}},{'a.md':{'b.md':153}}),result=nativeLocalRelations(f.b,'a',f.host),row=result.relations[0];
 assert.equal(row.evidence.length,153);assert.equal(row.evidenceTotal,153);assert.equal(row.evidence[152].subpath,'#Heading152');assert.equal(row.evidence[152].line,152);
 const item=localNeighborhood(f.b,'a',{nativeRelations:result.relations}).groups.find(g=>g.kind==='outgoing')!.items[0];assert.equal(item.nativeEvidence.length,153);assert.equal(item.nativeEvidenceTotal,153);
});

test('native and board links share a row with separately identifiable provenance',()=>{
 const f=setup([node('a','a.md'),node('b','b.md')],{}, {'a.md':{'b.md':1}});f.b.edges.push({id:'board-edge',from:'a',to:'b',label:'Board explanation'});
 const result=localNeighborhood(f.b,'a',{nativeRelations:nativeLocalRelations(f.b,'a',f.host).relations}),row=result.groups.find(g=>g.kind==='outgoing')!.items[0];assert.equal(result.total,1);assert.deepEqual(row.edgeIds,['board-edge']);assert.equal(row.nativeEvidenceTotal,1);assert.equal(row.nativeEvidence[0].kind,'indexed');
});

test('repeat native queries reflect rename delete and metadata changes without retained state',()=>{
 const f=setup([node('a','a.md'),node('b','b.md')],{'a.md':{links:[{link:'b.md'}]},'b.md':{}});assert.equal(nativeLocalRelations(f.b,'a',f.host).relations.length,1);
 f.paths.delete('b.md');assert.equal(nativeLocalRelations(f.b,'a',f.host).relations.length,0);f.b.nodes[1].file='Renamed.md';f.paths.add('Renamed.md');assert.equal(nativeLocalRelations(f.b,'a',f.host).relations.length,0);
 f.host.cache=path=>path==='a.md'?{links:[{link:'Renamed.md'}]}:{};assert.equal(nativeLocalRelations(f.b,'a',f.host).relations[0].evidence[0].targetPath,'Renamed.md');
});

test('metadata query work depends on current-board source files not external index size',()=>{
 const external=new Proxy({b:1},{ownKeys(){throw Error('No full index enumeration');}}),f=setup([node('a','a.md'),node('b','b.md')],{'a.md':{},'b.md':{}});f.host.resolved=()=>external;
 assert.deepEqual(nativeLocalRelations(f.b,'a',f.host).relations,[]);assert.deepEqual(f.calls.cache,['a.md','b.md']);assert.deepEqual(f.calls.tags,['a.md','b.md']);
});

test('native query preserves frozen board metadata and returns copied tag arrays',()=>{
 const f=setup([node('a','a.md'),node('b','b.md')],{'a.md':{links:[{link:'b.md'}]},'b.md':{}}),before=JSON.stringify(f.b),tagValues=['#one'];f.host.tags=()=>tagValues;
 for(const n of f.b.nodes)Object.freeze(n);Object.freeze(f.b.nodes);Object.freeze(f.b.edges);Object.freeze(f.b);
 const result=nativeLocalRelations(f.b,'a',f.host);tagValues.push('#two');assert.deepEqual(result.tagsByNode.get('a'),['#one']);assert.equal(JSON.stringify(f.b),before);
});
