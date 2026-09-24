import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';import {selectionFormatKey} from '../src/selection-format';import {emptyBoard,Card} from '../src/model';
const card:Card={id:'c',kind:'card',file:'n.md',x:0,y:0,width:300,height:200,color:'sand'};
test('unchanged toolbar controls survive 200 pan frames; styles and owner invalidate them',()=>{assert.match(execFileSync(process.execPath,['qa/toolbar-stability-09411.cjs'],{encoding:'utf8'}),/PASS unchanged controls retained/);});
test('format key ignores geometry and content but includes appearance, identity and locks',()=>{const b=emptyBoard();b.nodes=[card];const ids=new Set(['c']),key=selectionFormatKey(b,ids,undefined);for(const patch of [{x:100},{width:600},{text:'changed'},{title:'new alias'}])assert.equal(selectionFormatKey({...b,nodes:[{...card,...patch}]},ids,undefined),key);for(const patch of [{locked:true},{file:'other.md'},{color:'blue' as const},{fontSize:17},{customBorder:true},{transparent:true},{textAlign:'right' as const}])assert.notEqual(selectionFormatKey({...b,nodes:[{...card,...patch}]},ids,undefined),key);assert.notEqual(selectionFormatKey(b,ids,undefined,true),key);assert.notEqual(selectionFormatKey(b,new Set(),undefined),key);});
test('font size dropdown matches rendered defaults and preserves nonpreset sizes',()=>{const line=readFileSync('src/main.ts','utf8').split('\n').find(l=>l.includes("select('字号'"))!;for(const [node,want]of [[card,'14'],[{...card,kind:'text'},'16'],[{...card,fontSize:17},'17']] as const){let actual='',options:Record<string,string>={};new Function('select','texts','patchText',transformSync(line,{loader:'ts'}).code)((_l:unknown,o:Record<string,string>,values:string[])=>{actual=values[0];options=o},[node],()=>{});assert.equal(actual,want);assert.ok(options[want]);}});

test('active Markdown toolbar survives refreshes and is replaced for a new editor',()=>{assert.match(execFileSync(process.execPath,['qa/toolbar-stability-09412.cjs'],{encoding:'utf8'}),/PASS active editor toolbar reused/);});
test('unselected boards and absent edge selection do not scan unrelated nodes or edges',()=>{
 const b=emptyBoard();let reads=0;Object.defineProperty(b,'nodes',{get(){reads++;return []}});Object.defineProperty(b,'edges',{get(){reads++;return []}});
 assert.equal(selectionFormatKey(b,new Set(),undefined),'[false,"nodes",[]]');assert.equal(reads,0);
});


test('batch formatting refreshes on connection styles or scope changes, not geometry',()=>{
 const b=emptyBoard();b.nodes=[card,{...card,id:'b'}];b.edges=[{id:'e',from:'c',to:'b',label:'',style:'curve'}];
 const ids=new Set(['c','b']),batch={target:'edges' as const,scope:'internal' as const,edges:b.edges};
 const key=selectionFormatKey(b,ids,undefined,false,batch);
 b.nodes[1].x=500;b.viewport.x=80;
 assert.equal(selectionFormatKey(b,ids,undefined,false,batch),key);
 assert.notEqual(selectionFormatKey(b,ids,undefined,false,{...batch,scope:'connected'}),key);
 assert.notEqual(selectionFormatKey(b,ids,undefined,false,{...batch,target:'nodes'}),key);
 b.edges[0].color='red';assert.notEqual(selectionFormatKey(b,ids,undefined,false,batch),key);
});

test('single-edge format key refreshes on endpoint lock, unlock, deletion and restoration',()=>{
 const b=emptyBoard();b.nodes=[{...card},{...card,id:'b'}];b.edges=[{id:'e',from:'c',to:'b',label:''}];
 const key=()=>selectionFormatKey(b,new Set(),'e'),editable=key();
 for(const node of b.nodes){node.locked=true;assert.notEqual(key(),editable);delete node.locked;assert.equal(key(),editable);}
 const endpoint=b.nodes.pop()!;assert.notEqual(key(),editable);b.nodes.push(endpoint);assert.equal(key(),editable);
 b.nodes[0].x=400;b.nodes[0].width=600;b.nodes[0].title='new title';b.nodes[0].text='new content';b.viewport.x=80;
 assert.equal(key(),editable,'geometry and content do not affect an unfolded endpoint');
 b.nodes.push({...card,id:'unrelated',locked:true});assert.equal(key(),editable);
});

test('single-edge format key resolves current folded branch visibility and structural changes',()=>{
 const b=emptyBoard();b.nodes=[{...card},{...card,id:'b'},{...card,id:'parent'},{...card,id:'other'}];
 b.edges=[{id:'e',from:'c',to:'b',label:''},{id:'branch',from:'parent',to:'c',kind:'branch',label:''}];
 const key=()=>selectionFormatKey(b,new Set(),'e'),editable=key();
 b.nodes[2].branchFolded=true;const hidden=key();assert.notEqual(hidden,editable);
 b.edges[1].to='other';assert.equal(key(),editable,'the same fold flag must not preserve stale descendants');
 b.edges[1].to='c';assert.equal(key(),hidden);
 delete b.nodes[2].branchFolded;assert.equal(key(),editable);
});

test('single-edge format key changes for folded frame membership, not unrelated geometry',()=>{
 const b=emptyBoard();b.nodes=[{...card},{...card,id:'b',x:500},{id:'frame',kind:'section',x:-20,y:-20,width:350,height:250,color:'blue',sectionFolded:true}];
 b.edges=[{id:'e',from:'c',to:'b',label:''}];
 const key=()=>selectionFormatKey(b,new Set(),'e'),hidden=key();
 b.nodes[0].x=10;assert.equal(key(),hidden,'movement within the same hidden group preserves the toolbar');
 b.nodes[2].x=1000;const visible=key();assert.notEqual(visible,hidden);
 b.nodes[2].x=2000;assert.equal(key(),visible);
 b.nodes[2].x=-20;assert.equal(key(),hidden);
 delete b.nodes[2].sectionFolded;assert.equal(key(),visible);
});

test('single-edge eligibility avoids unrelated branch indexing without applicable folds',()=>{
 const b=emptyBoard();b.nodes=[{...card},{...card,id:'b'},{...card,id:'other'}];let branchReads=0;
 b.edges=[{id:'e',from:'c',to:'b',label:''},{id:'branch',from:'other',to:'c',get kind(){branchReads++;return 'branch' as const;},label:''}];
 const key=()=>selectionFormatKey(b,new Set(),'e');
 key();assert.equal(branchReads,0,'unfolded endpoint checks need no branch adjacency map');
 b.nodes[0].locked=true;b.nodes[2].branchFolded=true;
 key();assert.equal(branchReads,0,'a locked endpoint is already ineligible without branch traversal');
 delete b.nodes[0].locked;key();assert.ok(branchReads>0,'unlocked folded visibility must be resolved afresh');
});
