import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveNativeNoteDrop,type NativeNoteDropLookup} from '../src/native-note-drop';

class File {readonly extension:string;constructor(public path:string){this.extension=path.split('.').at(-1)!;}}
function fixture(paths:string[]){
 const files=new Map(paths.map(path=>[path,new File(path)]));
 const lookup:NativeNoteDropLookup<File>={vaultName:'当前库',isFile:(v):v is File=>v instanceof File,getFile:path=>files.get(path),resolve:(path,source)=>files.get(path)||files.get(path+'.md')||files.get(source.slice(0,source.lastIndexOf('/')+1)+path)};
 const drop=(native:unknown=null,plain='',uri='')=>resolveNativeNoteDrop(lookup,{getData:type=>type==='text/plain'?plain:type==='text/uri-list'?uri:''},native,'资料/来源.md');
 return{files,drop};
}

test('native file explorer/search image references support the existing image formats without copying files',()=>{
 for(const extension of ['png','jpg','jpeg','gif','webp','avif','bmp','PNG']){
  const path=`资料/图 # [一] 100%25.${extension}`,f=fixture([path]),file=f.files.get(path)!;
  assert.deepEqual(f.drop({type:'file',file}),{handled:true,references:[{file,path,page:1}]});
 }
});
test('native file multi-selection keeps Markdown, PDF and images in order, deduplicating real references',()=>{
 const paths=['正文.md','资料/论文.pdf','资料/图.png'],f=fixture(paths),files=paths.map(path=>f.files.get(path)!);
 assert.deepEqual(f.drop({type:'files',files:[...files,files[2]]}).references.map(ref=>ref.path),paths);
});
test('native batches are atomic when one referenced file was deleted, replaced or is unsupported',()=>{
 for(const failure of ['deleted','replaced','unsupported','folder']){
  const f=fixture(['正文.md','资料/图.png']),valid=f.files.get('正文.md')!,image=f.files.get('资料/图.png')!;
  let second:unknown=image;
  if(failure==='deleted')f.files.delete(image.path);
  if(failure==='replaced')f.files.set(image.path,new File(image.path));
  if(failure==='unsupported')second=new File('资料/文件.exe');
  if(failure==='folder')second={path:'资料',children:[]};
  assert.deepEqual(f.drop({type:'files',files:[valid,second]}),{handled:true,references:[]},failure);
 }
});
test('wiki embeds and path drops preserve special names and PDF page suffixes',()=>{
 const paths=['资料/图 [1] #2 100%25.png','资料/论文 [1] #2.pdf'],f=fixture(paths);
 for(const text of [paths[0],`![[${paths[0]}|图]]`])assert.deepEqual(f.drop(null,text).references.map(ref=>[ref.path,ref.page]),[[paths[0],1]],text);
 for(const text of [`${paths[1]}#page=7`,`![[${paths[1]}#page=7]]`])assert.deepEqual(f.drop(null,text).references.map(ref=>[ref.path,ref.page]),[[paths[1],7]],text);
});
test('same-vault encoded image URIs decode once and preserve literal percent/hash/brackets',()=>{
 const paths=['资料/图 #[1]%2F.png','资料/图 +2.webp'],f=fixture(paths);
 const uri=paths.map(path=>'obsidian://open?vault='+encodeURIComponent('当前库')+'&file='+encodeURIComponent(path)).join('\n');
 assert.deepEqual(f.drop(null,'',uri).references.map(ref=>ref.path),paths);
});
test('complete wiki, plain path and URI batches never silently insert only the valid subset',()=>{
 const f=fixture(['正文.md','资料/图.png']);
 for(const text of ['[[正文]]\n![[资料/不存在.png]]','正文.md\n资料/不存在.png'])assert.deepEqual(f.drop(null,text).references,[],text);
 const uri=['正文.md','资料/不存在.png'].map(path=>'obsidian://open?file='+encodeURIComponent(path)).join('\n');
 assert.deepEqual(f.drop(null,'',uri).references,[]);
});
test('native PDF links retain page numbers even when a real filename contains hash and brackets',()=>{
 const path='资料/论文 #[1].pdf',f=fixture([path]),file=f.files.get(path)!;
 for(const linktext of [path+'#page=9',`![[${path}#page=9]]`])assert.deepEqual(f.drop({type:'link',file,linktext}).references.map(ref=>[ref.path,ref.page]),[[path,9]]);
});
test('image fallback does not turn prose, remote content or foreign-vault references into local cards',()=>{
 const f=fixture(['资料/图.png']);
 for(const text of ['参考 ![[资料/图.png]]','https://example.com/资料/图.png','![[https://example.com/图.png]]'])assert.deepEqual(f.drop(null,text),{handled:false,references:[]});
 assert.deepEqual(f.drop(null,'![[资料/图.png]]','obsidian://open?vault=其他&file='+encodeURIComponent('资料/图.png')),{handled:false,references:[]});
});

test('Markdown link and image drag formats support encoded filenames and PDF page locators',()=>{
 const paths=['资料/图 #[1]%2F.png','资料/论文 (最终).pdf'],f=fixture(paths);
 const text=`![图](${encodeURI(paths[0]).replace(/#/g,'%23')})\n[PDF](<${encodeURI(paths[1])}#page=8>)`;
 assert.deepEqual(f.drop(null,text).references.map(ref=>[ref.path,ref.page]),[[paths[0],1],[paths[1],8]]);
 const pdf=f.files.get(paths[1])!;
 assert.deepEqual(f.drop({type:'link',file:pdf,linktext:'[PDF](<'+encodeURI(paths[1])+'#page=8>)'}).references.map(ref=>[ref.path,ref.page]),[[paths[1],8]]);
});
test('Markdown relative links preserve escaped punctuation, source directory and exact hash filenames',()=>{
 const path='资料/图 (1)#[a].png',f=fixture([path]);
 const text=String.raw`![图](<图 \(1\)%23%5Ba%5D.png>)`;
 assert.deepEqual(f.drop(null,text).references.map(ref=>ref.path),[path]);
 assert.deepEqual(f.drop({type:'link',linktext:'图 (1)#[a].png',sourcePath:'资料/来源.md'}).references.map(ref=>ref.path),[path]);
});
test('Markdown fallback requires complete links and rejects malformed encoding or mixed prose',()=>{
 const f=fixture(['资料/图.png']);
 for(const text of ['参考 ![图](资料/图.png)','![图](资料/图.png) trailing','![图](%ZZ.png)','![图](https://example.org/图.png)','[图](资料/图.png)\n[未知](资料/未知.png)'])assert.deepEqual(f.drop(null,text).references,[],text);
});

test('plain and native media filenames starting with brackets are not mistaken for Markdown links',()=>{
 const path='[图] 100%.png',f=fixture([path]);
 assert.deepEqual(f.drop(null,path).references.map(ref=>ref.path),[path]);
 assert.deepEqual(f.drop({type:'link',linktext:path}).references.map(ref=>ref.path),[path]);
});

test('relative Markdown media paths retain literal hashes across parent directories without decoding twice',()=>{
 const path='附件/图 #1%2F.png',f=fixture([path]);
 const text='![图](../'+encodeURIComponent('附件')+'/'+encodeURIComponent('图 #1%2F.png')+')';
 assert.deepEqual(f.drop(null,text).references.map(ref=>ref.path),[path]);
});

test('malformed nested Wiki payloads are not rescued as filenames or partially imported',()=>{
 const f=fixture(['正文.md']);
 for(const text of ['[[正文]]\n[[[[missing]]','[['.repeat(10000)])assert.deepEqual(f.drop(null,text),{handled:false,references:[]});
});


test('native dragLink without resolved file preserves exact PDF names containing hash before page suffix',()=>{
 const file={path:'材料/论文 #[1].pdf',extension:'pdf'};
 const lookup={vaultName:'vault',isFile:(value:unknown):value is typeof file=>value===file,getFile:(path:string)=>path===file.path?file:undefined,resolve:()=>undefined};
 const result=resolveNativeNoteDrop(lookup,{getData:()=>''},{type:'link',file:undefined,linktext:file.path+'#page=2',sourcePath:'白板/工作台.thoughtspace'},'白板/工作台.thoughtspace');
 assert.equal(result.handled,true);assert.deepEqual(result.references,[{file,path:file.path,page:2}]);
});
