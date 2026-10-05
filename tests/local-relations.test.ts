import test from 'node:test';
import assert from 'node:assert/strict';
import type {Board,Card,Edge} from '../src/model';
import {searchLocalCenters,supportsLocalRelations,localNeighborhood,localRelationNode,localRelationKinds,LocalRelationHistory,LocalRelationPins,type LocalRelationKind} from '../src/local-relations';

const node=(id:string,options:Partial<Card>={}):Card=>({id,kind:'card',file:`Notes/${id}.md`,x:0,y:0,width:240,height:80,color:'sand',...options});
const edge=(id:string,from:string,to:string,options:Partial<Edge>={}):Edge=>({id,from,to,label:'',...options});
const board=(nodes:Card[],edges:Edge[]=[]):Board=>({version:3,nodes,edges,viewport:{x:0,y:0,zoom:1}});
const group=(value:ReturnType<typeof localNeighborhood>,kind:LocalRelationKind)=>value.groups.find(group=>group.kind===kind)!;
const ids=(value:ReturnType<typeof localNeighborhood>,kind:LocalRelationKind)=>group(value,kind).items.map(item=>item.id);

test('mode support is limited to note cards sub-boards and groups',()=>{
 for(const kind of ['card','board','section'] as const)assert.equal(supportsLocalRelations({kind}),true);
 for(const kind of ['text','image','pdf','audio','video','mindmap'] as const)assert.equal(supportsLocalRelations({kind}),false);
});

for(const kind of ['card','board','section'] as const)test(`${kind} objects can be centers and direct relation targets`,()=>{
 const current=node('center',{kind,file:kind==='board'?'Boards/Child.thoughtspace':kind==='card'?'Notes/Center.md':undefined,title:kind==='section'?'Group':undefined});
 const b=board([current,node('target')],[edge('link','center','target')]);assert.equal(localNeighborhood(b,'center').center?.kind,kind);assert.deepEqual(ids(localNeighborhood(b,'center'),'outgoing'),['target']);assert.deepEqual(ids(localNeighborhood(b,'target'),'incoming'),['center']);
});

for(const kind of ['text','image','pdf','audio','video','mindmap'] as const)test(`${kind} centers return an empty neighborhood even when explicitly linked`,()=>{
 const b=board([node('unsupported',{kind}),node('supported')],[edge('link','unsupported','supported',{kind:'branch'})]),result=localNeighborhood(b,'unsupported');
 assert.equal(result.center,undefined);assert.deepEqual(result.groups.map(g=>g.kind),[...localRelationKinds]);assert.ok(result.groups.every(g=>g.items.length===0&&g.total===0&&g.matched===0&&g.shown===0));assert.equal(result.total,0);assert.equal(result.matched,0);assert.equal(result.shown,0);
});

test('unsupported endpoints are excluded before relationship counts search and visible limits',()=>{
 const unsupported=(['text','image','pdf','audio','video','mindmap'] as const).map(kind=>node(kind,{kind,title:'Hidden '+kind}));
 const b=board([node('center'),...unsupported,node('child-board',{kind:'board',file:'Boards/Child.thoughtspace'}),node('group',{kind:'section',title:'Group',file:undefined}),node('note')],[]);
 for(const target of b.nodes.slice(1))b.edges.push(edge('out-'+target.id,'center',target.id),edge('in-'+target.id,target.id,'center'),edge('associated-'+target.id,'center',target.id,{direction:'both'}));
 const result=localNeighborhood(b,'center','',1);assert.equal(result.total,9);assert.equal(result.matched,9);assert.equal(result.shown,3);
 for(const kind of ['incoming','outgoing','associated'] as const){assert.equal(group(result,kind).total,3);assert.deepEqual(ids(result,kind),['child-board']);}
 const filtered=localNeighborhood(b,'center','Hidden');assert.equal(filtered.total,9);assert.equal(filtered.matched,0);assert.equal(filtered.shown,0);
});

test('supported branch siblings require a supported explicit shared parent',()=>{
 const b=board([node('parent'),node('center'),node('sibling'),node('text-sibling',{kind:'text'})],[edge('pc','parent','center',{kind:'branch'}),edge('ps','parent','sibling',{kind:'branch'}),edge('pt','parent','text-sibling',{kind:'branch'})]);
 let result=localNeighborhood(b,'center');assert.deepEqual(ids(result,'parents'),['parent']);assert.deepEqual(ids(result,'siblings'),['sibling']);assert.equal(result.total,2);
 b.nodes[0].kind='text';result=localNeighborhood(b,'center');assert.equal(result.invalidBranches,false);assert.deepEqual(ids(result,'parents'),[]);assert.deepEqual(ids(result,'siblings'),[]);assert.equal(result.total,0);
});

test('hidden text or media never create transitive branch or ordinary relations',()=>{
 const b=board([node('center'),node('text',{kind:'text'}),node('image',{kind:'image'}),node('beyond-text'),node('beyond-image')],[edge('ct','center','text',{kind:'branch'}),edge('tb','text','beyond-text',{kind:'branch'}),edge('ci','center','image'),edge('ib','image','beyond-image')]);
 const result=localNeighborhood(b,'center');assert.equal(result.total,0);assert.deepEqual(ids(result,'children'),[]);assert.deepEqual(ids(result,'outgoing'),[]);assert.equal(localNeighborhood(b,'beyond-text').total,0);assert.equal(localNeighborhood(b,'beyond-image').total,0);
});

test('scope updates from each current snapshot without retaining an unsupported center',()=>{
 const b=board([node('center'),node('neighbor')],[edge('link','center','neighbor')]);assert.equal(localNeighborhood(b,'center').total,1);
 b.nodes[1].kind='text';assert.equal(localNeighborhood(b,'center').total,0);b.nodes[0].kind='text';assert.equal(localNeighborhood(b,'center').center,undefined);
 b.nodes[0].kind='board';b.nodes[0].file='Boards/Center.thoughtspace';b.nodes[1].kind='card';assert.equal(localNeighborhood(b,'center').center?.kind,'board');assert.equal(localNeighborhood(b,'center').total,1);
});

for(const direction of [undefined,'forward'] as const)test(`ordinary ${direction||'default'} edges preserve source and target direction`,()=>{
 const b=board(['a','b','c'].map(id=>node(id)),[edge('in','a','b',{direction}),edge('out','b','c',{direction})]);const result=localNeighborhood(b,'b');
 assert.deepEqual(ids(result,'incoming'),['a']);assert.deepEqual(ids(result,'outgoing'),['c']);assert.equal(result.total,2);assert.deepEqual(ids(result,'parents'),[]);assert.deepEqual(ids(result,'children'),[]);
});
for(const direction of ['both','none'] as const)test(`${direction} ordinary edges are symmetric associated relations`,()=>{
 const b=board(['a','b','c'].map(id=>node(id)),[edge('ab','a','b',{direction}),edge('bc','b','c',{direction})]);const result=localNeighborhood(b,'b');
 assert.deepEqual(ids(result,'associated'),['a','c']);assert.deepEqual(ids(result,'incoming'),[]);assert.deepEqual(ids(result,'outgoing'),[]);assert.deepEqual(ids(localNeighborhood(b,'a'),'associated'),['b']);
});

test('explicit branches supply parents children and siblings regardless of arrow decoration',()=>{
 const b=board(['parent','center','sibling','child'].map(id=>node(id)),[edge('ps','parent','sibling',{kind:'branch',label:'同父分支'}),edge('pc','parent','center',{kind:'branch',direction:'none',label:'中心分支'}),edge('cc','center','child',{kind:'branch',direction:'both'})]);const result=localNeighborhood(b,'center');
 assert.deepEqual(ids(result,'parents'),['parent']);assert.deepEqual(ids(result,'children'),['child']);assert.deepEqual(ids(result,'siblings'),['sibling']);assert.deepEqual(ids(result,'associated'),[]);
 const sibling=group(result,'siblings').items[0];assert.deepEqual(sibling.viaParentIds,['parent']);assert.deepEqual(sibling.edgeIds,['ps','pc']);assert.deepEqual(sibling.labels,['同父分支','中心分支']);
});

test('ordinary edges topic flags and geometric containment never manufacture family groups',()=>{
 const b=board([node('frame',{kind:'section',title:'Frame',width:1000,height:1000}),node('parent',{topic:true}),node('a',{topic:true}),node('b',{topic:true})],[edge('pa','parent','a'),edge('pb','parent','b')]);const result=localNeighborhood(b,'a');
 assert.deepEqual(ids(result,'parents'),[]);assert.deepEqual(ids(result,'siblings'),[]);assert.deepEqual(ids(result,'children'),[]);assert.deepEqual(ids(result,'incoming'),['parent']);
});

test('parallel ordinary edges yield one row with all stable edge IDs and distinct labels',()=>{
 const b=board([node('a'),node('b')],[edge('one','a','b',{label:'支持'}),edge('two','a','b',{label:' 支持 '}),edge('three','a','b',{label:'需要验证'}),edge('four','a','b')]);const result=localNeighborhood(b,'a'),item=group(result,'outgoing').items[0];
 assert.equal(result.total,1);assert.deepEqual(item.edgeIds,['one','two','three','four']);assert.deepEqual(item.labels,['支持','需要验证']);assert.deepEqual(item.viaParentIds,[]);
});

test('different relationship kinds with one node remain separate without losing provenance',()=>{
 const b=board([node('a'),node('b')],[edge('branch','a','b',{kind:'branch'}),edge('forward','a','b'),edge('reverse','b','a'),edge('both','b','a',{direction:'both'})]);const result=localNeighborhood(b,'a');
 for(const kind of ['children','incoming','outgoing','associated'] as const)assert.deepEqual(ids(result,kind),['b']);assert.equal(result.total,4);assert.deepEqual(group(result,'children').items[0].edgeIds,['branch']);assert.deepEqual(group(result,'incoming').items[0].edgeIds,['reverse']);
});

test('a missing center returns six empty groups rather than stale neighbors',()=>{
 const result=localNeighborhood(board([node('a')],[edge('gone','a','deleted')]),'deleted');assert.equal(result.center,undefined);assert.deepEqual(result.groups.map(g=>g.kind),[...localRelationKinds]);assert.equal(result.total,0);assert.equal(result.shown,0);
});

test('deleted endpoints and self edges never produce local rows',()=>{
 const b=board([node('center'),node('valid')],[edge('missing','center','deleted'),edge('self','center','center'),edge('ok','center','valid')]);assert.deepEqual(ids(localNeighborhood(b,'center'),'outgoing'),['valid']);b.nodes.pop();assert.equal(localNeighborhood(b,'center').total,0);
});
for(const invalid of ['cycle','two-parents','duplicate-branch','missing-endpoint'] as const)test(`invalid ${invalid} branches are withheld without reclassifying them as ordinary links`,()=>{
 const b=board(['a','b','c'].map(id=>node(id)),[edge('branch','a','b',{kind:'branch'}),edge('normal','b','c',{label:'ordinary'})]);
 b.edges.push(invalid==='cycle'?edge('bad','b','a',{kind:'branch'}):invalid==='two-parents'?edge('bad','c','b',{kind:'branch'}):invalid==='duplicate-branch'?edge('bad','a','b',{kind:'branch'}):edge('bad','missing','b',{kind:'branch'}));
 const result=localNeighborhood(b,'b');assert.equal(result.invalidBranches,true);for(const kind of ['parents','children','siblings'] as const)assert.equal(group(result,kind).total,0);assert.deepEqual(ids(result,'outgoing'),['c']);assert.deepEqual(ids(result,'incoming'),[]);
});

test('same-name cards retain separate IDs and full path details',()=>{
 const b=board([node('center'),node('one',{kind:'card',file:'Notes/A/Same.md',text:undefined}),node('two',{kind:'card',file:'Notes/B/Same.md',text:undefined})],[edge('a','center','one'),edge('b','center','two')]);const rows=group(localNeighborhood(b,'center'),'outgoing').items;
 assert.deepEqual(rows.map(n=>n.title),['Same','Same']);assert.deepEqual(rows.map(n=>n.id),['one','two']);assert.notEqual(rows[0].detail,rows[1].detail);assert.match(rows[0].detail,/Notes\/A\/Same.md.*one/);
});

test('rename and label changes are resolved from every current snapshot',()=>{
 const b=board([node('center'),node('card',{kind:'card',file:'Notes/Old.md',text:undefined})],[edge('relation','center','card',{label:'Old label'})]);const before=localNeighborhood(b,'center');b.nodes[1].file='Moved/New.md';b.nodes[1].title='New title';b.edges[0].label='New label';const after=localNeighborhood(b,'center');
 assert.equal(group(before,'outgoing').items[0].title,'Old');assert.equal(group(after,'outgoing').items[0].title,'New title');assert.equal(group(after,'outgoing').items[0].path,'Moved/New.md');assert.deepEqual(group(after,'outgoing').items[0].labels,['New label']);assert.equal(group(after,'outgoing').items[0].id,'card');
});

test('search checks local titles paths IDs and edge labels before applying visible limits',()=>{
 const b=board([node('center'),...Array.from({length:30},(_,i)=>node('id-'+i,{title:'Node '+i,file:'Folder/'+i+'.md'}))],Array.from({length:30},(_,i)=>edge('edge-'+i,'center','id-'+i,{label:i===29?'Last relationship':'normal'})));
 for(const query of ['node 29','folder/29','ID-29','last relationship']){const result=localNeighborhood(b,'center',query,1),g=group(result,'outgoing');assert.deepEqual(g.items.map(n=>n.id),['id-29']);assert.equal(g.total,30);assert.equal(g.matched,1);assert.equal(g.shown,1);}
 assert.equal(localNeighborhood(b,'center','not present').matched,0);assert.equal(localNeighborhood(b,'center','   ').matched,30);
});

test('visible rows use board node order independent of edge order and retain relation counts',()=>{
 const b=board(['center','b','a','c'].map(id=>node(id)),[edge('c','center','c'),edge('a','center','a'),edge('b','center','b')]);const g=group(localNeighborhood(b,'center','',2),'outgoing');assert.deepEqual(g.items.map(n=>n.id),['b','a']);assert.deepEqual([g.total,g.matched,g.shown],[3,3,2]);
});

test('large neighborhoods expose accurate totals while bounding every group and total display',()=>{
 const nodes=[node('center'),node('parent')],edges=[edge('pc','parent','center',{kind:'branch'})];
 for(const [prefix,kind]of [['child','branch'],['sibling','sibling'],['in','incoming'],['out','outgoing'],['associated','associated']] as const)for(let i=0;i<500;i++){const id=prefix+i;nodes.push(node(id));edges.push(edge('edge-'+id,kind==='sibling'?'parent':kind==='incoming'?id:'center',kind==='incoming'?'center':id,{...(kind==='branch'||kind==='sibling'?{kind:'branch' as const}:{}),...(kind==='associated'?{direction:'both' as const}:{})}));}
 const result=localNeighborhood(board(nodes,edges),'center','',10000);assert.equal(result.total,2501);assert.equal(result.matched,2501);assert.equal(result.shown,60);assert.ok(result.groups.every(g=>g.shown<=12));assert.ok(result.groups.every(g=>g.shown===g.items.length));
});
for(const limit of [0,-3,NaN,Infinity,2.9])test(`visible limit ${limit} is safely normalized`,()=>{
 const b=board([node('center'),...Array.from({length:20},(_,i)=>node(String(i)))],Array.from({length:20},(_,i)=>edge(String(i),'center',String(i))));const expected=limit===2.9?2:limit<=0?0:12;
 const result=localNeighborhood(b,'center','',limit);assert.equal(result.total,20);assert.equal(result.matched,20);assert.equal(result.shown,expected);
});

test('queries never mutate frozen board geometry topology or metadata',()=>{
 const b=board([node('center'),node('child')],[edge('branch','center','child',{kind:'branch'})]),before=JSON.stringify(b);for(const n of b.nodes)Object.freeze(n);for(const e of b.edges)Object.freeze(e);Object.freeze(b.nodes);Object.freeze(b.edges);Object.freeze(b);
 assert.deepEqual(ids(localNeighborhood(b,'center'),'children'),['child']);assert.equal(JSON.stringify(b),before);
});

test('display helpers keep metadata bounded and never substitute titles for identity',()=>{
 assert.equal(localRelationNode(node('text',{kind:'text',file:undefined,text:'\n  \nFirst line\nSecond line'})).title,'First line');assert.equal(localRelationNode(node('text',{kind:'text',file:undefined,title:'  Explicit title  ',text:'body'})).title,'Explicit title');assert.equal(localRelationNode(node('empty',{kind:'text',file:undefined,text:''})).title,'未命名文本');assert.equal(localRelationNode(node('huge',{kind:'text',file:undefined,text:'x'.repeat(1000000)})).title.length,160);assert.equal(localRelationNode(node('stable',{title:'duplicate'})).id,'stable');
});

test('history implements back and forward without recording traversal as new visits',()=>{
 const h=new LocalRelationHistory();assert.equal(h.current,undefined);assert.equal(h.canBack,false);h.visit('a');h.visit('b');h.visit('c');assert.equal(h.back(),'b');assert.equal(h.back(),'a');assert.equal(h.back(),'a');assert.equal(h.canBack,false);assert.equal(h.canForward,true);assert.equal(h.forward(),'b');assert.equal(h.forward(),'c');assert.equal(h.forward(),'c');assert.equal(h.canForward,false);
});

test('revisiting current does not add entries or erase forward but a new jump truncates forward',()=>{
 const h=new LocalRelationHistory();h.visit('a');h.visit('b');h.visit('c');h.back();assert.equal(h.visit('b'),'b');assert.equal(h.canForward,true);h.visit('d');assert.equal(h.canForward,false);assert.equal(h.back(),'b');assert.equal(h.back(),'a');assert.equal(h.forward(),'b');assert.equal(h.forward(),'d');
});

test('history capacity limits memory while preserving live back and forward behavior',()=>{
 const h=new LocalRelationHistory(3);for(const id of ['a','b','c','d'])h.visit(id);assert.equal(h.back(),'c');assert.equal(h.back(),'b');assert.equal(h.canBack,false);assert.equal(h.forward(),'c');assert.equal(h.forward(),'d');h.clear();assert.equal(h.current,undefined);assert.equal(h.canForward,false);assert.equal(h.canBack,false);
});

test('history deletion returns to nearest surviving past or first surviving future',()=>{
 const h=new LocalRelationHistory();for(const id of ['a','b','c','d'])h.visit(id);h.back();assert.equal(h.reconcile(['a','d']),'a');assert.equal(h.canForward,true);assert.equal(h.forward(),'d');assert.equal(h.reconcile(['a']),'a');assert.equal(h.reconcile([]),undefined);
 const future=new LocalRelationHistory();future.visit('a');future.visit('b');future.back();assert.equal(future.reconcile(['b']),'b');assert.equal(future.canBack,false);
});

test('history deletion collapses adjacent identical survivors without false navigation steps',()=>{
 const h=new LocalRelationHistory();for(const id of ['a','b','a','c'])h.visit(id);h.back();assert.equal(h.reconcile(['a','c']),'a');assert.equal(h.canBack,false);assert.equal(h.forward(),'c');assert.equal(h.back(),'a');
});

test('pins use IDs, preserve insertion order, reject the seventh without eviction and release a slot',()=>{
 const pins=new LocalRelationPins();for(let i=0;i<6;i++)assert.equal(pins.toggle(String(i)),'added');assert.equal(pins.toggle('seventh'),'full');assert.deepEqual(pins.ids,['0','1','2','3','4','5']);assert.equal(pins.toggle('2'),'removed');assert.equal(pins.toggle('seventh'),'added');assert.deepEqual(pins.ids,['0','1','3','4','5','seventh']);
});

test('pins reconcile deleted IDs and returned arrays cannot mutate internal state',()=>{
 const pins=new LocalRelationPins();pins.toggle('a');pins.toggle('b');pins.ids.push('outside');assert.deepEqual(pins.ids,['a','b']);assert.deepEqual(pins.reconcile(['b']),['b']);pins.clear();assert.deepEqual(pins.ids,[]);
});

test('renaming pinned and visited nodes preserves identity while display updates from the board',()=>{
 const b=board([node('a',{title:'Original'})]),pins=new LocalRelationPins(),history=new LocalRelationHistory();pins.toggle('a');history.visit('a');b.nodes[0].title='Renamed';pins.reconcile(b.nodes.map(n=>n.id));history.reconcile(b.nodes.map(n=>n.id));assert.deepEqual(pins.ids,['a']);assert.equal(history.current,'a');assert.equal(localNeighborhood(b,history.current!).center?.title,'Renamed');
});


test('paged neighborhoods make every matching neighbor reachable without exceeding sixty rows',()=>{
 const b=board([node('center'),...Array.from({length:53},(_,i)=>node('target-'+i))],Array.from({length:53},(_,i)=>edge('e'+i,'center','target-'+i))),visited:string[]=[];
 for(let page=0;page<6;page++){const result=localNeighborhood(b,'center',{pageByKind:{outgoing:page}}),g=group(result,'outgoing');assert.equal(g.total,53);assert.equal(g.matched,53);assert.equal(g.pages,6);assert.equal(g.page,page);assert.equal(g.hasPrevious,page>0);assert.equal(g.hasNext,page<5);assert.equal(g.pageSize,10);assert.ok(result.shown<=60);visited.push(...ids(result,'outgoing'));}
 assert.deepEqual(visited,b.nodes.slice(1).map(n=>n.id));
});

test('page positions clamp after filtering or deleting neighbors while raw totals remain visible',()=>{
 const b=board([node('center'),...Array.from({length:25},(_,i)=>node('target-'+i))],Array.from({length:25},(_,i)=>edge('e'+i,'center','target-'+i)));
 const filtered=group(localNeighborhood(b,'center',{query:'target-24',pageByKind:{outgoing:99}}),'outgoing');assert.equal(filtered.total,25);assert.equal(filtered.matched,1);assert.equal(filtered.page,0);assert.equal(filtered.pages,1);assert.deepEqual(filtered.items.map(n=>n.id),['target-24']);
 b.nodes.splice(5);const deleted=group(localNeighborhood(b,'center',{pageByKind:{outgoing:2}}),'outgoing');assert.equal(deleted.page,0);assert.equal(deleted.total,4);assert.equal(deleted.shown,4);
});

test('independent relation pages and selected categories retain accurate aggregate counts',()=>{
 const b=board([node('center'),...Array.from({length:23},(_,i)=>node('target-'+i))],Array.from({length:23},(_,i)=>edge('out'+i,'center','target-'+i)).concat(Array.from({length:23},(_,i)=>edge('in'+i,'target-'+i,'center'))));
 const result=localNeighborhood(b,'center',{pageByKind:{outgoing:1,incoming:2},kindFilters:['outgoing']});assert.equal(result.total,46);assert.equal(result.matched,23);assert.equal(result.shown,10);assert.equal(group(result,'incoming').total,23);assert.equal(group(result,'incoming').matched,0);assert.equal(group(result,'incoming').page,0);assert.equal(group(result,'outgoing').page,1);assert.deepEqual(ids(result,'outgoing'),Array.from({length:10},(_,i)=>'target-'+(i+10)));
});

test('query fields type filters and exact tag filters do not conflate labels with names',()=>{
 const b=board([node('center'),node('note',{title:'Alpha',file:'Folder/Source.md'}),node('sub',{kind:'board',file:'Child.thoughtspace',title:'Beta'}),node('group',{kind:'section',title:'Gamma'})],[edge('cn','center','note',{label:'Research'}),edge('cs','center','sub',{label:'Alpha'}),edge('cg','center','group')]),tagsByNode=new Map([['note',['#research/deep'] as readonly string[]]]);
 assert.deepEqual(ids(localNeighborhood(b,'center',{query:'Alpha',queryField:'name'}),'outgoing'),['note']);assert.deepEqual(ids(localNeighborhood(b,'center',{query:'Alpha',queryField:'label'}),'outgoing'),['sub']);assert.deepEqual(ids(localNeighborhood(b,'center',{query:'source',queryField:'path'}),'outgoing'),['note']);assert.deepEqual(ids(localNeighborhood(b,'center',{query:'分组',queryField:'type'}),'outgoing'),['group']);assert.deepEqual(ids(localNeighborhood(b,'center',{query:'deep',queryField:'tag',tagsByNode}),'outgoing'),['note']);
 assert.deepEqual(ids(localNeighborhood(b,'center',{kindFilter:'board'}),'outgoing'),['sub']);assert.deepEqual(ids(localNeighborhood(b,'center',{tag:'research/deep',tagsByNode}),'outgoing'),['note']);assert.equal(localNeighborhood(b,'center',{tag:'research',tagsByNode}).matched,0);assert.equal(localNeighborhood(b,'center',{query:'not-found',queryField:'id'}).shown,0);
});

test('new page sizes and page numbers normalize nonfinite and adversarial values',()=>{
 const b=board([node('center'),...Array.from({length:25},(_,i)=>node(String(i)))],Array.from({length:25},(_,i)=>edge('e'+i,'center',String(i))));
 for(const size of [-10,0,1,4.9,NaN,Infinity,999]){const result=localNeighborhood(b,'center',{pageSize:size,pageByKind:{outgoing:Infinity}}),g=group(result,'outgoing');assert.equal(g.page,0);assert.ok(g.shown>=1&&g.shown<=10);assert.equal(g.pageSize,Number.isFinite(size)?Math.max(1,Math.min(10,Math.floor(size))):10);}
 assert.equal(group(localNeighborhood(b,'center',{pageByKind:{outgoing:-1}}),'outgoing').page,0);
});

test('all-board search includes isolated supported objects and preserves equal-title identities',()=>{
 const b=board([node('one',{title:'Same'}),node('two',{title:'Same',file:'Other/Same.md'}),node('section',{kind:'section',title:'Group'}),node('sub',{kind:'board',file:'Child.thoughtspace'}),node('excluded',{kind:'text',title:'Same'})]);
 const all=searchLocalCenters(b);assert.equal(all.total,4);assert.equal(all.matched,4);assert.deepEqual(all.items.map(n=>n.id),['one','two','section','sub']);assert.deepEqual(searchLocalCenters(b,'Same').items.map(n=>n.id),['one','two']);assert.deepEqual(searchLocalCenters(b,'Other/Same').items.map(n=>n.id),['two']);assert.deepEqual(searchLocalCenters(b,'section',{queryField:'id'}).items.map(n=>n.id),['section']);
});

test('center search ranks exact names first and pages through all matching objects',()=>{
 const b=board([node('prefix',{title:'Target prefixed'}),node('exact',{title:'Target'}),...Array.from({length:63},(_,i)=>node('id-'+i,{title:'Target '+i}))]);assert.equal(searchLocalCenters(b,'Target',{pageSize:10}).items[0].id,'exact');
 const visited=new Set<string>();for(let page=0;page<7;page++){const result=searchLocalCenters(b,'Target',{page,pageSize:10});assert.equal(result.matched,65);assert.equal(result.pages,7);for(const n of result.items)visited.add(n.id);}assert.equal(visited.size,65);assert.equal(searchLocalCenters(b,'Target',{page:999,pageSize:10}).page,6);
});

test('center search obeys tags types and snapshot rename without mutating board data',()=>{
 const b=board([node('a',{title:'Before'}),node('b',{kind:'section',title:'Group'})]),tagsByNode=new Map([['a',['#tag']]]),before=JSON.stringify(b);
 assert.deepEqual(searchLocalCenters(b,'',{tag:'#tag',tagsByNode}).items.map(n=>n.id),['a']);assert.deepEqual(searchLocalCenters(b,'',{kindFilter:'section'}).items.map(n=>n.id),['b']);assert.equal(JSON.stringify(b),before);b.nodes[0].title='After';assert.equal(searchLocalCenters(b,'Before').matched,0);assert.equal(searchLocalCenters(b,'After').items[0].id,'a');
});

test('history snapshots are defensive and restore the cursor with nonconsecutive repeat visits',()=>{
 const h=new LocalRelationHistory();h.restore({entries:['a','b','a','c'],index:2});assert.equal(h.current,'a');assert.equal(h.canForward,true);assert.equal(h.back(),'b');assert.equal(h.forward(),'a');assert.equal(h.forward(),'c');const saved=h.snapshot();saved.entries.push('external');saved.index=0;assert.equal(h.current,'c');assert.equal(h.snapshot().entries.length,4);
});

test('history restore caps entries and reconciles invalid blank or adjacent duplicate records',()=>{
 const h=new LocalRelationHistory(3);h.restore({entries:['a','','b','b','c','d'],index:4});assert.deepEqual(h.snapshot(),{entries:['b','c','d'],index:1});assert.equal(h.current,'c');h.restore({entries:[],index:100});assert.equal(h.current,undefined);assert.equal(h.canBack,false);h.restore({entries:['a','b'],index:NaN});assert.equal(h.current,'a');
});

test('pins restore copies unique valid IDs and never exceeds six entries',()=>{
 const values=['a','a','','b','c','d','e','f','g'],pins=new LocalRelationPins();pins.restore(values);assert.deepEqual(pins.ids,['a','b','c','d','e','f']);values.splice(0);assert.equal(pins.ids.length,6);pins.restore([]);assert.equal(pins.ids.length,0);
});
