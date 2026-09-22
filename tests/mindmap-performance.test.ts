import test from 'node:test';import assert from 'node:assert/strict';
import {clone} from '../src/model';import {presetMindmap,insertPreset} from '../src/mindmap-presets';import {inlineDisplayBoard} from '../src/inline-geometry';import {layoutMindmap,reflowAutomaticMindmaps} from '../src/mindmap';
test('typing in one tree preserves identity of unrelated nodes and relationship edges',()=>{
 const a=presetMindmap('project'),b=insertPreset(a,presetMindmap('organization')).board;
 b.edges.push({id:'relation-between-trees',from:b.nodes[1].id,to:b.nodes.at(-1)!.id,label:'来源'});
 const saved=clone(b),view=inlineDisplayBoard(b,{id:b.nodes[2].id,width:260,height:600});
 assert.deepEqual(b,saved);for(let i=a.nodes.length;i<b.nodes.length;i++)assert.equal(view.nodes[i],b.nodes[i]);assert.equal(view.edges.at(-1),b.edges.at(-1));
 assert.notEqual(view.nodes[2],b.nodes[2]);assert.equal(view.nodes[2].height,600);
});
test('manual and locked trees change only draft size even alongside automatic trees',()=>{
 for(const locked of [false,true]){const a=presetMindmap('project'),b=insertPreset(a,presetMindmap('organization')).board;
 if(locked)b.nodes[1].locked=true;else b.nodes[0].mindmapRules!.automatic=false;
 const old=clone(b),view=inlineDisplayBoard(b,{id:b.nodes[2].id,width:260,height:600});
 assert.deepEqual(view.nodes.map(n=>[n.x,n.y]),old.nodes.map(n=>[n.x,n.y]));assert.equal(view.edges,b.edges);assert.equal(view.nodes[1],b.nodes[1]);assert.deepEqual(b,old);}
});
test('multi-tree batch layout matches separate explicit layouts including collapsed descendants and custom sides',()=>{
 const a=presetMindmap('brainstorm'),b=insertPreset(a,presetMindmap('organization')).board,old=clone(b);
 b.nodes[1].branchFolded=true;b.nodes[2].height=390;b.nodes[a.nodes.length+1].width=480;
 const expected=clone(b);layoutMindmap(expected,b.nodes[0].id);layoutMindmap(expected,b.nodes[a.nodes.length].id);
 reflowAutomaticMindmaps(b,old);assert.deepEqual(b,expected);
});
