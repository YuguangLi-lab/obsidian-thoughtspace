import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveNativeNoteDrop,type NativeNoteDropLookup} from '../src/native-note-drop';
class File {readonly extension:string;constructor(public path:string){this.extension=path.split('.').at(-1)!;}}
function fixture(paths=['资料/视频 #[1] 100%2F.mp4','资料/音频.mp3','资料/论文 #1.pdf']){
 const files=new Map(paths.map(path=>[path,new File(path)]));
 const lookup:NativeNoteDropLookup<File>={vaultName:'当前库',isFile:(v):v is File=>v instanceof File,getFile:path=>files.get(path),resolve:(path,source)=>files.get(path)||files.get(source.slice(0,source.lastIndexOf('/')+1)+path)};
 const drop=(native:unknown=null,plain='',uri='')=>resolveNativeNoteDrop(lookup,{getData:type=>type==='text/plain'?plain:type==='text/uri-list'?uri:''},native,'资料/来源.md');return{files,drop};
}
test('native audio/video explorer drops retain exact current-vault identity across supported formats',()=>{
 for(const extension of ['mp4','webm','mov','m4v','ogv','mp3','m4a','wav','ogg','oga','flac','aac','opus','MP4']){
  const path=`资料/音视频 #[一].${extension}`,f=fixture([path]),file=f.files.get(path)!;
  assert.deepEqual(f.drop({type:'file',file}),{handled:true,references:[{file,path,page:1}]});
  assert.deepEqual(f.drop({type:'file',file:new File(path)}),{handled:true,references:[]});
 }
});
test('media drag fallback preserves special filenames and time across wiki, path, Markdown and URI formats',()=>{
 const f=fixture(),path=[...f.files.keys()][0],destination=path+'#t=12.125';
 for(const text of [destination,`![[${destination}|片段]]`,`[片段](<${encodeURIComponent(path)}#t=12.125>)`])assert.deepEqual(f.drop(null,text).references.map(r=>[r.path,r.start]),[[path,12.125]],text);
 for(const uri of ['obsidian://open?vault='+encodeURIComponent('当前库')+'&file='+encodeURIComponent(destination),'obsidian://open?file='+encodeURIComponent(path)+'#t=12.125'])assert.deepEqual(f.drop(null,'',uri).references.map(r=>[r.path,r.start]),[[path,12.125]],uri);
 const file=f.files.get(path)!;
 for(const native of [{type:'link',file,linktext:destination},{type:'link',linktext:destination},{type:'link',linktext:'视频 #[1] 100%2F.mp4#t=12.125',sourcePath:'资料/来源.md'}])assert.deepEqual(f.drop(native).references.map(r=>[r.path,r.start]),[[path,12.125]]);
});
test('literal hashes remain filename characters and exact media references take precedence over headings',()=>{
 for(const path of ['资料/会议#t=12.mp4','资料/会议.mp4#t=12.mp4','资料/会议.mp4#片段.mp3']){const f=fixture([path]),file=f.files.get(path)!;
 for(const text of [path,`![[${path}]]`])assert.deepEqual(f.drop(null,text).references,[{file,path,page:1}]);
 assert.deepEqual(f.drop({type:'link',file,linktext:path}).references,[{file,path,page:1}]);
 assert.deepEqual(f.drop(null,'','obsidian://open?file='+encodeURIComponent(path)).references,[{file,path,page:1}]);
 assert.deepEqual(f.drop(null,path+'#t=8').references,[{file,path,page:1,start:8}]);
 }
});
test('media time deduplication distinguishes positions while keeping old PDF page behavior',()=>{
 const f=fixture(),text='[[资料/音频.mp3]]\n[[资料/音频.mp3#t=0]]\n[[资料/音频.mp3#t=1.5]]\n[[资料/音频.mp3#t=1.5]]\n[[资料/论文 #1.pdf#page=4]]';
 assert.deepEqual(f.drop(null,text).references.map(r=>[r.path,r.page,r.start]),[['资料/音频.mp3',1,undefined],['资料/音频.mp3',1,1.5],['资料/论文 #1.pdf',4,undefined]]);
});
test('invalid timestamps, external media, prose and atomic unsupported batches do not partly insert',()=>{
 const f=fixture(),path='资料/音频.mp3';
 for(const suffix of ['-1','NaN','Infinity','100000001','1e9','1:02',''])assert.deepEqual(f.drop(null,`[[${path}#t=${suffix}]]`),{handled:false,references:[]},suffix);
 for(const text of [`参考 [[${path}]]`,`[[https://example.com/clip.mp4]]`,`[[${path}]]\n[[资料/不存在.mp4]]`])assert.deepEqual(f.drop(null,text),{handled:false,references:[]});
 const uri='obsidian://open?vault=other&file='+encodeURIComponent(path);assert.deepEqual(f.drop(null,`[[${path}]]`,uri),{handled:false,references:[]});
 assert.deepEqual(f.drop({type:'files',files:[f.files.get(path),new File('资料/unsupported.exe')]}),{handled:true,references:[]});
});

test('external media reference attachments preserve time points when dragged from Obsidian',()=>{
 for(const path of ['媒体引用/课程 #1.tsvideo','媒体引用/访谈.tsaudio']){
  const f=fixture([path]),file=f.files.get(path)!;
  assert.deepEqual(f.drop({type:'file',file}).references,[{file,path,page:1}]);
  assert.deepEqual(f.drop(null,`[[${path}#t=12.5]]`).references,[{file,path,page:1,start:12.5}]);
 }
});
