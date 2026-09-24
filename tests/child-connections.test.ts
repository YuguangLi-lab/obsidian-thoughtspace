import test from 'node:test';
import assert from 'node:assert/strict';
import {childConnectionCandidates,makeChildConnections} from '../src/branch-disclosure';
import {clone,emptyBoard,type Board,type Card,type Edge} from '../src/model';
import {validateBranches} from '../src/mindmap';

function node(id:string,kind:Card['kind']='text'):Card{return{id,kind,text:id,title:id,x:0,y:0,width:200,height:120,color:'green'};}
function edge(id:string,from:string,to:string,extra:Partial<Edge>={}):Edge{return{id,from,to,label:id,...extra};}
function board(nodes:Card[],edges:Edge[]):Board{return{...emptyBoard(),nodes,edges};}
function unchangedAfterFailure(b:Board,roots:string[],message:RegExp){
 const before=clone(b),nodes=b.nodes,edges=b.edges,edgeObjects=[...edges];
 assert.throws(()=>makeChildConnections(b,new Set(roots)),message);
 assert.deepEqual(b,before);assert.equal(b.nodes,nodes);assert.equal(b.edges,edges);
 b.edges.forEach((e,i)=>assert.equal(e,edgeObjects[i]));
}

test('candidate discovery includes mixed group links and ignores missing, self, branch, bidirectional, and undirected links',()=>{
 const b=board([node('root'),node('child'),node('frame','section')],[
  edge('legacy','root','child'),edge('forward','root','child',{direction:'forward'}),
  edge('branch','root','child',{kind:'branch'}),edge('both','root','child',{direction:'both'}),edge('none','root','child',{direction:'none'}),
  edge('missing-parent','absent','child'),edge('missing-child','root','absent'),edge('self','root','root'),
  edge('section-parent','frame','child'),edge('section-child','root','frame'),
 ]),before=clone(b);
 assert.deepEqual([...childConnectionCandidates(b)],[['root',['legacy','forward','section-child']],['frame',['section-parent']]]);
 assert.deepEqual(b,before);
});

test('candidate roots restrict discovery while retaining board edge order and all content kinds',()=>{
 const b=board([node('root'),node('other'),...(['card','board','pdf','image','text'] as const).map(kind=>node(kind,kind))],[
  edge('outside','other','text'),...['pdf','card','image','board','text'].map(kind=>edge(kind,'root',kind)),
 ]);
 assert.deepEqual([...childConnectionCandidates(b,new Set(['missing','root']))],[['root',['pdf','card','image','board','text']]]);
 assert.deepEqual([...childConnectionCandidates(b,new Set())],[]);
});

test('candidate discovery reflects edits, deletions, and undo without a stale board cache',()=>{
 const b=board([node('root'),node('child')],[edge('link','root','child')]),original=clone(b);
 assert.equal(childConnectionCandidates(b).has('root'),true);
 b.edges[0].direction='both';assert.equal(childConnectionCandidates(b).size,0);
 b.edges=original.edges;assert.equal(childConnectionCandidates(b).has('root'),true);
 b.nodes[1].kind='section';assert.equal(childConnectionCandidates(b).has('root'),true);
 b.nodes=[node('root')];assert.equal(childConnectionCandidates(b).size,0);
 b.nodes=original.nodes;assert.equal(childConnectionCandidates(b).has('root'),true);
});

test('bulk conversion preserves relation styling, untouched edge identity, and node geometry across multiple roots',()=>{
 const b=board(['a','b','c','d','e','f','g','h'].map(id=>node(id)),[
  edge('ab','a','b',{style:'elbow',direction:'forward',dashed:true,color:'rose',fromSide:'bottom',toSide:'top'}),
  edge('bc','b','c'),edge('de','d','e'),edge('fg','f','g',{kind:'branch',direction:'none',color:'blue'}),
  edge('fh','f','h',{style:'curve',direction:'both'}),edge('ah','a','h',{direction:'none'}),
 ]),before=clone(b),nodes=b.nodes,edges=b.edges;
 b.nodes[5].locked=true;
 makeChildConnections(b,new Set(['a','b','d','missing']));
 assert.equal(b.version,3);assert.equal(b.nodes,nodes);assert.notEqual(b.edges,edges);
 for(let i=0;i<3;i++)assert.deepEqual(b.edges[i],{...before.edges[i],kind:'branch',direction:'forward'});
 for(let i=3;i<edges.length;i++)assert.equal(b.edges[i],edges[i]);
 assert.deepEqual(b.nodes,before.nodes.map(n=>n.id==='f'?{...n,locked:true}:n));
 assert.deepEqual([...validateBranches(b)],[['b','a'],['c','b'],['e','d'],['g','f']]);
});

test('empty, missing, and relation-free selections are exact no-ops including board version and edge array',()=>{
 const b=board([node('root'),node('child'),node('other')],[edge('link','root','child')]),before=clone(b),edges=b.edges;
 for(const roots of [[],['missing'],['other']]){makeChildConnections(b,new Set(roots));assert.deepEqual(b,before);assert.equal(b.edges,edges);}
});

test('invalid ordinary endpoints remain untouched when a valid sibling is converted',()=>{
 const b=board([node('root'),node('child')],[
  edge('valid','root','child'),edge('self','root','root'),edge('missing','root','absent'),
  edge('missing-parent','absent','child'),
 ]),edges=b.edges;
 makeChildConnections(b,new Set(['root','frame','absent']));
 assert.equal(b.edges[0].kind,'branch');for(let i=1;i<edges.length;i++)assert.equal(b.edges[i],edges[i]);
});

test('duplicate ordinary links to one child reject the entire batch instead of silently choosing one',()=>{
 const b=board(['root','child','other'].map(id=>node(id)),[
  edge('valid','root','other'),edge('one','root','child'),edge('duplicate','root','child'),
 ]);
 unchangedAfterFailure(b,['root'],/一个父级/);
});

test('competing selected roots cannot assign the same child to two parents',()=>{
 const b=board(['a','b','child','other'].map(id=>node(id)),[
  edge('valid','a','other'),edge('a-child','a','child'),edge('b-child','b','child'),
 ]);
 unchangedAfterFailure(b,['a','b'],/一个父级/);
});

test('an existing parent prevents conversion without modifying a successful earlier candidate',()=>{
 const b=board(['a','b','child','other'].map(id=>node(id)),[
  edge('valid','a','other'),edge('old','b','child',{kind:'branch'}),edge('new','a','child'),
 ]);
 unchangedAfterFailure(b,['a'],/一个父级/);
});

test('conversion checks the complete branch forest before committing any proposed edge',()=>{
 const b=board(['a','b','c','other'].map(id=>node(id)),[
  edge('valid','c','other'),edge('ab','a','b',{kind:'branch'}),edge('bc','b','c',{kind:'branch'}),edge('ca','c','a'),
 ]);
 unchangedAfterFailure(b,['c'],/循环/);
 const selectedCycle=board(['a','b'].map(id=>node(id)),[edge('ab','a','b'),edge('ba','b','a')]);
 unchangedAfterFailure(selectedCycle,['a','b'],/循环/);
});

for(const locked of ['root','second'])test(`a locked ${locked} leaves the complete conversion batch unchanged`,()=>{
 const b=board(['root','first','second'].map(id=>({...node(id),...(id===locked?{locked:true}:{})})),[
  edge('first','root','first'),edge('second','root','second'),
 ]);
 unchangedAfterFailure(b,['root'],/解锁/);
});

test('scoped conversion handles many independent relation trees and preserves every unrelated edge',()=>{
 const count=5000,b=board(Array.from({length:count*2},(_,i)=>node(`n${i}`)),Array.from({length:count},(_,i)=>edge(`e${i}`,`n${i*2}`,`n${i*2+1}`)));
 const roots=new Set(['n0',`n${(count-1)*2}`]),edges=b.edges;
 assert.deepEqual([...childConnectionCandidates(b,roots)],[['n0',['e0']],[`n${(count-1)*2}`,[`e${count-1}`]]]);
 makeChildConnections(b,roots);
 assert.equal(b.edges[0].kind,'branch');assert.equal(b.edges.at(-1)!.kind,'branch');
 for(let i=1;i<count-1;i++)assert.equal(b.edges[i],edges[i]);
 assert.equal(validateBranches(b).size,2);
});
