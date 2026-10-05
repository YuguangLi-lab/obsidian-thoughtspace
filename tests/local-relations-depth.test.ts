import test from 'node:test';
import assert from 'node:assert/strict';
import type {Board,Card,Edge} from '../src/model';
import {localRelationDepth,type LocalRelationDepthOptions} from '../src/local-relations-depth';
import {localNeighborhood,type NativeLocalRelation} from '../src/local-relations';
const node=(id:string,options:Partial<Card>={}):Card=>({id,kind:'card',file:`Notes/${id}.md`,title:id,x:0,y:0,width:240,height:100,color:'sand',...options});
const edge=(id:string,from:string,to:string,options:Partial<Edge>={}):Edge=>({id,from,to,label:'',...options});
const board=(nodes:Card[],edges:Edge[]=[]):Board=>({version:3,nodes,edges,viewport:{x:12,y:-10,zoom:.75}});
const options=(visible:readonly string[],more:Partial<LocalRelationDepthOptions>={}):LocalRelationDepthOptions=>({visibleFirstLayerIds:visible,...more});
const native=(nodeId:string,id='native',kind:'incoming'|'outgoing'='outgoing'):NativeLocalRelation=>({nodeId,kind,evidenceTotal:1,evidence:[{id,kind:'link',sourcePath:'Notes/source.md',targetPath:`Notes/${nodeId}.md`,subpath:'#Heading',line:4}]});

test('depth two performs no native work until a supported first-layer object is explicitly expanded',()=>{
 const b=board([node('center'),node('a'),node('b')],[edge('ca','center','a'),edge('ab','a','b')]),calls:string[]=[];
 const result=localRelationDepth(b,'center',[],options(['a'],{nativeFor:id=>{calls.push(id);return[];}}));assert.deepEqual(result.expandedIds,[]);assert.deepEqual(result.nodes,[]);assert.deepEqual(result.firstLayerIds,['a']);assert.deepEqual(calls,[]);
});

for(const kind of ['text','image','pdf','audio','video'] as const)test(`unsupported ${kind} centers cannot initiate depth expansion`,()=>{
 const b=board([node('center',{kind}),node('a')],[edge('ca','center','a')]),result=localRelationDepth(b,'center',['a'],options(['a'],{nativeFor(){throw Error('No metadata expected');}}));assert.deepEqual(result.firstLayerIds,[]);assert.deepEqual(result.branches,[]);assert.deepEqual(result.nodes,[]);
});

test('missing centers and arbitrary visible IDs are rejected before metadata is requested',()=>{
 const b=board([node('center'),node('a'),node('isolated'),node('text',{kind:'text'})],[edge('ca','center','a'),edge('ct','center','text')]),calls:string[]=[],opts=options(['center','a','isolated','text','missing'],{nativeFor:id=>{calls.push(id);return[];}});
 assert.equal(localRelationDepth(b,'deleted',['a'],opts).branches.length,0);const result=localRelationDepth(b,'center',['center','isolated','text','missing','a'],opts);assert.deepEqual(result.expandedIds,['a']);assert.deepEqual(calls,['a']);
});

test('only currently visible true first-layer objects are eligible and duplicate expansion IDs cost no extra work',()=>{
 const b=board(['center','a','b','c','d'].map(id=>node(id)),['a','b','c','d'].map(id=>edge('c'+id,'center',id))),calls:string[]=[];
 const result=localRelationDepth(b,'center',['a','a','b','c','d'],options(['a','c','d'],{nativeFor:id=>{calls.push(id);return[];}}));assert.deepEqual(result.expandedIds,['a','c','d']);assert.deepEqual(calls,['a','c','d']);assert.equal(result.branches.length,3);
});

test('the fourth visible expansion is rejected and new display nodes never exceed twenty four',()=>{
 const nodes=[node('center'),...['a','b','c','d'].map(id=>node(id))],edges=['a','b','c','d'].map(id=>edge('c'+id,'center',id));
 for(const source of ['a','b','c','d'])for(let i=0;i<20;i++){nodes.push(node(source+i));edges.push(edge(source+i,source,source+i));}
 const calls:string[]=[],result=localRelationDepth(board(nodes,edges),'center',['a','b','c','d'],options(['a','b','c','d'],{kindFilters:['outgoing'],nativeFor:id=>{calls.push(id);return[];}}));
 assert.deepEqual(calls,['a','b','c']);assert.equal(result.nodes.length,24);assert.equal(result.branches.reduce((sum,b)=>sum+b.shown,0),24);assert.ok(result.branches.every(b=>b.shown===8&&b.matched===20&&b.total===21));assert.equal(new Set(result.nodes.map(n=>n.id)).size,24);
});

test('sub-board and group objects can be expanded but no contents or third layer are inferred',()=>{
 const b=board([node('center'),node('child',{kind:'board',file:'Boards/Child.thoughtspace'}),node('group',{kind:'section',file:undefined,title:'Group'}),node('target'),node('third')],[edge('cc','center','child'),edge('cg','center','group'),edge('ct','child','target'),edge('gt','group','target'),edge('tt','target','third')]),calls:string[]=[];
 const result=localRelationDepth(b,'center',['child','group'],options(['child','group'],{nativeFor:id=>{calls.push(id);return[];}}));assert.deepEqual(result.nodes.map(n=>n.id),['target']);assert.deepEqual(calls,['child','group']);assert.equal(result.nodes[0].shared,true);assert.equal(result.nodes[0].via.length,2);
});

test('cycles return to the center or existing first-layer object rather than copying tree nodes',()=>{
 const b=board(['center','a','b','new'].map(id=>node(id)),[edge('ca','center','a'),edge('cb','center','b'),edge('ac','a','center'),edge('ab','a','b'),edge('an','a','new'),edge('na','new','a')]),result=localRelationDepth(b,'center',['a'],options(['a','b'])),rows=result.branches[0].items;
 assert.equal(rows.find(n=>n.id==='center')?.placement,'center');assert.equal(rows.find(n=>n.id==='b')?.placement,'first-layer');assert.deepEqual(result.nodes.map(n=>n.id),['new']);assert.equal(result.nodes[0].via.length,2);assert.equal(result.nodes[0].shared,false);assert.equal(result.branches[0].total,3);
});

test('first-layer membership includes hidden categories filtered objects and later pages',()=>{
 const nodes=[node('center'),node('a'),...Array.from({length:25},(_,i)=>node('first-'+i))],edges=[edge('ca','center','a'),...Array.from({length:25},(_,i)=>edge('cf'+i,'center','first-'+i)),edge('return-late','a','first-24',{label:'wanted'})],b=board(nodes,edges),result=localRelationDepth(b,'center',['a'],options(['a'],{query:'wanted',queryField:'label',kindFilters:['outgoing']}));
 assert.equal(result.firstLayerIds.length,26);assert.equal(result.branches[0].matched,1);assert.equal(result.branches[0].items[0].id,'first-24');assert.equal(result.branches[0].items[0].placement,'first-layer');assert.deepEqual(result.nodes,[]);
});

test('shared second-layer targets use stable IDs and preserve every source and relationship category',()=>{
 const b=board(['center','a','b','same'].map(id=>node(id)),[edge('ca','center','a'),edge('cb','center','b'),edge('as1','a','same',{label:'one'}),edge('as2','a','same',{label:'two'}),edge('sa','same','a'),edge('bs','b','same',{direction:'both'})]),result=localRelationDepth(b,'center',['a','b'],options(['a','b'])),shared=result.nodes[0];
 assert.equal(result.nodes.length,1);assert.equal(shared.id,'same');assert.equal(shared.shared,true);assert.deepEqual(shared.via.map(v=>[v.sourceId,v.kind]),[['a','incoming'],['a','outgoing'],['b','associated']]);assert.deepEqual(shared.via[1].edgeIds,['as1','as2']);assert.deepEqual(shared.via[1].labels,['one','two']);
 assert.equal(result.branches[0].items.find(n=>n.id==='same'),shared);assert.equal(result.branches[1].items.find(n=>n.id==='same'),shared);
});

test('distinct-target totals and filtering precede category merging without reusing first-layer counts',()=>{
 const b=board(['center','a','target','other'].map(id=>node(id)),[edge('ca','center','a'),edge('at','a','target',{label:'match'}),edge('ta','target','a',{label:'other'}),edge('aa','a','target',{direction:'both',label:'match'}),edge('ao','a','other',{label:'other'})]),result=localRelationDepth(b,'center',['a'],options(['a'],{query:'match',queryField:'label'})),branch=result.branches[0];
 assert.equal(result.firstLayerIds.length,1);assert.equal(branch.total,3);assert.equal(branch.matched,1);assert.equal(branch.shown,1);assert.equal(branch.items[0].id,'target');assert.deepEqual(branch.items[0].via.map(v=>v.kind),['outgoing','associated']);
});

test('type tag and query filters match the existing one-layer filter semantics',()=>{
 const b=board([node('center'),node('a'),node('card',{title:'Wanted note'}),node('group',{kind:'section',title:'Wanted group',file:undefined}),node('board',{kind:'board',title:'Wanted board',file:'B.thoughtspace'})],[edge('ca','center','a'),edge('ac','a','card'),edge('ag','a','group'),edge('ab','a','board')]),tagsByNode=new Map([['card',['#keep']]]);
 for(const filter of [{kindFilter:'section' as const},{tag:'keep',tagsByNode},{query:'Wanted',queryField:'name' as const},{kindFilters:[] as const}]){const expected=localNeighborhood(b,'a',filter).groups.flatMap(g=>g.items.map(n=>n.id)),result=localRelationDepth(b,'center',['a'],options(['a'],filter));assert.deepEqual(result.branches[0].items.map(n=>n.id),[...new Set(expected)]);}
});

test('all matching depth-two targets remain reachable through distinct pagination including return references',()=>{
 const nodes=[node('center'),node('a'),...Array.from({length:41},(_,i)=>node('target-'+i))],edges=[edge('ca','center','a'),...Array.from({length:41},(_,i)=>edge('a'+i,'a','target-'+i))],b=board(nodes,edges),visited:string[]=[];
 for(let page=0;page<6;page++){const result=localRelationDepth(b,'center',['a'],options(['a'],{pageBySource:{a:page}})),branch=result.branches[0];assert.equal(branch.total,42);assert.equal(branch.matched,42);assert.equal(branch.pages,6);assert.equal(branch.page,page);assert.equal(branch.hasPrevious,page>0);assert.equal(branch.hasNext,page<5);assert.ok(branch.items.length<=8);visited.push(...branch.items.map(n=>n.id));}
 assert.equal(new Set(visited).size,42);assert.deepEqual(visited,['center',...nodes.slice(2).map(n=>n.id)]);
});

test('per-source pages are independent and shared provenance survives another source being on a different page',()=>{
 const nodes=[node('center'),node('a'),node('b'),...Array.from({length:17},(_,i)=>node('target-'+i))],edges=[edge('ca','center','a'),edge('cb','center','b'),...Array.from({length:17},(_,i)=>edge('a'+i,'a','target-'+i)),...Array.from({length:17},(_,i)=>edge('b'+i,'b','target-'+i))],b=board(nodes,edges),result=localRelationDepth(b,'center',['a','b'],options(['a','b'],{kindFilters:['outgoing'],pageBySource:{a:0,b:2}}));
 assert.equal(result.branches[0].page,0);assert.equal(result.branches[1].page,2);assert.equal(result.nodes.length,9);assert.ok(result.nodes.every(n=>n.shared&&n.via.length===2));assert.equal(result.nodes.find(n=>n.id==='target-0')?.via[1].sourceId,'b');
});

test('page positions clamp after filters deletions and malformed numeric state',()=>{
 const b=board([node('center'),node('a'),...Array.from({length:20},(_,i)=>node('target-'+i))],[edge('ca','center','a'),...Array.from({length:20},(_,i)=>edge('a'+i,'a','target-'+i))]);
 assert.equal(localRelationDepth(b,'center',['a'],options(['a'],{pageBySource:{a:999}})).branches[0].page,2);
 for(const value of [-3,NaN,Infinity])assert.equal(localRelationDepth(b,'center',['a'],options(['a'],{pageBySource:{a:value}})).branches[0].page,0);
 const filtered=localRelationDepth(b,'center',['a'],options(['a'],{query:'target-19',queryField:'id',pageBySource:{a:2}}));assert.equal(filtered.branches[0].page,0);assert.equal(filtered.branches[0].matched,1);
 b.nodes.splice(3);const deleted=localRelationDepth(b,'center',['a'],options(['a'],{pageBySource:{a:2}}));assert.equal(deleted.branches[0].page,0);assert.equal(deleted.branches[0].total,2);
});

test('same titles never merge identities while snapshot rename deletion and source changes are reflected',()=>{
 const b=board([node('center'),node('a'),node('one',{title:'Same'}),node('two',{title:'Same',file:'Other/Same.md'})],[edge('ca','center','a'),edge('a1','a','one'),edge('a2','a','two')]);let result=localRelationDepth(b,'center',['a'],options(['a']));assert.deepEqual(result.nodes.map(n=>n.id),['one','two']);
 b.nodes[2].title='Renamed';b.nodes[2].file='Renamed.md';b.nodes.pop();result=localRelationDepth(b,'center',['a'],options(['a']));assert.equal(result.nodes.length,1);assert.equal(result.nodes[0].id,'one');assert.equal(result.nodes[0].title,'Renamed');assert.equal(result.nodes[0].path,'Renamed.md');b.nodes[1].kind='text';assert.equal(localRelationDepth(b,'center',['a'],options(['a'])).branches.length,0);
});

test('text and media cannot be expanded or act as hidden transit nodes into the second layer',()=>{
 const b=board(['center','a','text','image','beyond'].map(id=>node(id,id==='text'?{kind:'text'}:id==='image'?{kind:'image'}:{})),[edge('ca','center','a'),edge('at','a','text'),edge('ab','text','beyond'),edge('ai','a','image'),edge('ib','image','beyond')]),result=localRelationDepth(b,'center',['a'],options(['a']));assert.deepEqual(result.nodes,[]);assert.deepEqual(result.branches[0].items.map(n=>n.id),['center']);
});

for(const conflict of ['cycle','multi-parent','duplicate','missing'] as const)test(`invalid ${conflict} branches stay withheld while ordinary depth links remain usable`,()=>{
 const b=board(['center','a','parent','target','other'].map(id=>node(id)),[edge('ca','center','a'),edge('pa','parent','a',{kind:'branch'}),edge('at','a','target'),conflict==='cycle'?edge('bad','a','parent',{kind:'branch'}):conflict==='multi-parent'?edge('bad','other','a',{kind:'branch'}):conflict==='duplicate'?edge('bad','parent','a',{kind:'branch'}):edge('bad','deleted','a',{kind:'branch'})]),result=localRelationDepth(b,'center',['a'],options(['a']));assert.equal(result.invalidBranches,true);assert.deepEqual(result.nodes.map(n=>n.id),['target']);assert.ok(result.branches[0].items.every(n=>n.via.every(v=>!['parents','children','siblings'].includes(v.kind))));
});

test('only an explicit supported shared parent yields sibling provenance at depth two',()=>{
 const b=board(['center','a','parent','sibling'].map(id=>node(id)),[edge('ca','center','a'),edge('pa','parent','a',{kind:'branch'}),edge('ps','parent','sibling',{kind:'branch'})]);let result=localRelationDepth(b,'center',['a'],options(['a']));const sibling=result.nodes.find(n=>n.id==='sibling')!;assert.equal(sibling.via[0].kind,'siblings');assert.deepEqual(sibling.via[0].viaParentIds,['parent']);assert.deepEqual(sibling.via[0].edgeIds,['pa','ps']);
 b.nodes[2].kind='text';result=localRelationDepth(b,'center',['a'],options(['a']));assert.deepEqual(result.nodes,[]);
});

test('native-only first-layer entries are valid sources and native evidence does not become a branch',()=>{
 const b=board(['center','a','target'].map(id=>node(id))),calls:string[]=[],result=localRelationDepth(b,'center',['a'],options(['a'],{centerNativeRelations:[native('a','center-a')],nativeFor:id=>{calls.push(id);return[native('target','a-target')];}}));
 assert.deepEqual(calls,['a']);assert.deepEqual(result.firstLayerIds,['a']);assert.deepEqual(result.nodes.map(n=>n.id),['target']);assert.deepEqual(result.nodes[0].via[0].edgeIds,[]);assert.equal(result.nodes[0].via[0].kind,'outgoing');assert.equal(result.nodes[0].via[0].nativeEvidence[0].id,'a-target');
});

test('mixed native and board evidence remains complete and distinct within a shared target',()=>{
 const b=board(['center','a','b','target'].map(id=>node(id)),[edge('ca','center','a'),edge('cb','center','b'),edge('at','a','target')]),many=Array.from({length:123},(_,i)=>({...native('target').evidence[0],id:'proof-'+i,line:i})),result=localRelationDepth(b,'center',['a','b'],options(['a','b'],{nativeFor:id=>[{nodeId:'target',kind:'outgoing',evidence:id==='a'?many:native('target','b-proof').evidence,evidenceTotal:id==='a'?123:1}]})),target=result.nodes[0];
 assert.equal(target.shared,true);assert.equal(target.via.length,2);assert.deepEqual(target.via[0].edgeIds,['at']);assert.equal(target.via[0].nativeEvidenceTotal,123);assert.equal(target.via[0].nativeEvidence.at(-1)?.line,122);assert.equal(target.via[1].nativeEvidence[0].id,'b-proof');
});

test('changing centers never retains former expanded sources or their native results',()=>{
 const b=board(['center','a','target','new-center'].map(id=>node(id)),[edge('ca','center','a'),edge('at','a','target')]),calls:string[]=[];assert.equal(localRelationDepth(b,'center',['a'],options(['a'])).nodes.length,1);
 const result=localRelationDepth(b,'new-center',['a'],options(['a'],{nativeFor:id=>{calls.push(id);return[native('target')];}}));assert.deepEqual(result.expandedIds,[]);assert.deepEqual(result.nodes,[]);assert.deepEqual(calls,[]);
});

test('depth queries preserve frozen board geometry metadata and caller-owned option arrays',()=>{
 const b=board(['center','a','target'].map(id=>node(id)),[edge('ca','center','a'),edge('at','a','target')]),before=JSON.stringify(b),expanded=['a'],visible=['a'],pages={a:0},opts=options(visible,{pageBySource:pages});
 for(const n of b.nodes)Object.freeze(n);for(const e of b.edges)Object.freeze(e);Object.freeze(b.nodes);Object.freeze(b.edges);Object.freeze(b.viewport);Object.freeze(b);Object.freeze(expanded);Object.freeze(visible);Object.freeze(pages);Object.freeze(opts);
 const result=localRelationDepth(b,'center',expanded,opts);assert.equal(result.nodes.length,1);assert.equal(JSON.stringify(b),before);assert.deepEqual(expanded,['a']);assert.deepEqual(pages,{a:0});
});
