import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {resolveSourceLink,sourceLinkParts,sourceLinkTarget} from '../src/excerpt-sources';

const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  private sourceFile('),end=source.indexOf('\n  async openExcerptSource(',start);
assert.ok(start>=0&&end>start);
// Obsidian parseLinktext separates the first literal #. The file lookup seam
// intentionally matches exact vault paths so a truncated filename cannot pass.
const parseLinktext=(target:string)=>{const hash=target.indexOf('#');return{path:hash<0?target:target.slice(0,hash),subpath:hash<0?'':target.slice(hash)};};
const View=new Function('sourceLinkTarget','resolveSourceLink','parseLinktext',transformSync('class View{'+source.slice(start,end)+'};return View',{loader:'ts'}).code)(sourceLinkTarget,resolveSourceLink,parseLinktext);
function sourceFile(link:string,paths:string[]){
 const files=new Map(paths.map(path=>[path,{path}]));
 return View.prototype.sourceFile.call({app:{metadataCache:{getFirstLinkpathDest:(path:string)=>files.get(path)}}},{path:'boards/Research.thoughtspace'},{link});
}

test('actual sourceFile keeps an encoded literal hash in a Markdown source filename',()=>{
 const path='资料/实验 #1.md';assert.deepEqual(sourceFile('[实验](资料/实验%20%231.md#章节)',[path]),{file:{path},path,subpath:'#章节'});
});

test('source lookup keeps percent names encoded once and unescapes Markdown punctuation before lookup',()=>{
 for(const [link,path,subpath] of [
  ['[x](literal%2523.md#Heading)','literal%23.md','#Heading'],
  [String.raw`[x](folder\(one\)/note\_name.md#Heading)`,'folder(one)/note_name.md','#Heading'],
  ['[x](<Archive/a%20%231.pdf#page=3>)','Archive/a #1.pdf','#page=3'],
 ])assert.deepEqual(resolveSourceLink(link,p=>p===path?{path}:undefined),{file:{path},path,subpath});
});

test('legacy fully encoded fragments resolve only after the longest actual source path',()=>{
 const full='folder/a.md#b.md',short='folder/a.md',link='[x](folder%2Fa.md%23b.md%23Heading)',files=new Set([short,full]);
 assert.deepEqual(resolveSourceLink(link,p=>files.has(p)?p:undefined),{file:full,path:full,subpath:'#Heading'});
 const exact=full+'#Heading';files.add(exact);assert.deepEqual(resolveSourceLink(link,p=>files.has(p)?p:undefined),{file:exact,path:exact,subpath:''});
 assert.deepEqual(resolveSourceLink('[x](folder%2Fa.md%23Heading)',p=>p===short?p:undefined),{file:short,path:short,subpath:'#Heading'});
});

test('wiki source links retain native literal percent paths and block fragments',()=>{
 assert.deepEqual(sourceLinkParts('[[folder/literal%23.md#^block|alias]]'),[{path:'folder/literal%23.md',subpath:'#^block'}]);
 assert.deepEqual(sourceLinkParts('not a link'),[]);
});
