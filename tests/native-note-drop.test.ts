import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveNativeNoteDrop,type NativeNoteDropLookup} from '../src/native-note-drop';

class NoteFile {constructor(public path:string,public extension=path.split('.').at(-1)!){}}
function fixture(paths=['folder/Note.md','folder/paper.pdf','folder/image.png','中文/含 空格.md','literal%2F.md']){
 const files=new Map(paths.map(path=>[path,new NoteFile(path)])),lookups:string[]=[],resolutions:{link:string;sourcePath:string}[]=[];
 const aliases=new Map<string,NoteFile>();
 const lookup:NativeNoteDropLookup<NoteFile>={vaultName:'demo-vault',isFile:(value):value is NoteFile=>value instanceof NoteFile,getFile(path){lookups.push(path);return files.get(path);},resolve(link,sourcePath){resolutions.push({link,sourcePath});return aliases.get(link)||files.get(link)||files.get('folder/'+link)||files.get('folder/'+link+'.md');}};
 const transfer=(plain='',uri='')=>({getData:(type:string)=>type==='text/plain'?plain:type==='text/uri-list'?uri:''});
 const drop=(draggable:unknown=null,plain='',uri='')=>resolveNativeNoteDrop(lookup,transfer(plain,uri),draggable,'boards/current.thoughtspace');
 return{files,lookups,resolutions,aliases,lookup,transfer,drop,note:files.get('folder/Note.md')!,pdf:files.get('folder/paper.pdf')!};
}
const neverRead={getData:()=>{throw Error('native data must be authoritative');}};

test('native exact file uses its current-vault identity without reading unrelated transfer text',()=>{
 const f=fixture();assert.deepEqual(resolveNativeNoteDrop(f.lookup,neverRead,{type:'file',file:f.note},''),{handled:true,references:[{file:f.note,path:f.note.path,page:1}]});assert.equal(f.resolutions.length,0);
});
test('deleted and replaced native md/pdf identities are handled without rescuing unrelated payloads',()=>{
 for(const path of ['folder/Note.md','folder/paper.pdf'])for(const replacement of [false,true]){const f=fixture(),stale=f.files.get(path)!;f.files.delete(path);if(replacement)f.files.set(path,new NoteFile(path));assert.deepEqual(f.drop({type:'file',file:stale},'[[folder/Note.md]]'),{handled:true,references:[]});assert.equal(f.resolutions.length,0);}
});
test('native arrays preserve supported order and deduplicate once within the batch',()=>{
 const f=fixture(),stale=new NoteFile('deleted.md');const files=[f.note,f.files.get('folder/image.png'),{path:'folder',children:[]},stale,f.pdf,f.note];assert.deepEqual(f.drop({type:'files',files}),{handled:true,references:[{file:f.note,path:f.note.path,page:1},{file:f.pdf,path:f.pdf.path,page:1}]});assert.ok(f.lookups.length<=files.length);assert.equal(f.resolutions.length,0);
});
test('unsupported folders and malformed native types are not consumed or rescued from text',()=>{
 const f=fixture();for(const draggable of [{type:'folder',file:{path:'folder'}},{type:'file',file:f.files.get('folder/image.png')},{type:'file',file:{path:'fake.md',extension:'md'}},{type:'files',files:'folder/Note.md'},{type:'files',files:[f.files.get('folder/image.png')]},{type:'unknown'},42])assert.deepEqual(f.drop(draggable,'[[folder/Note.md]]'),{handled:false,references:[]});
});
test('native PDF links preserve the linktext page before falling back to the exact file',()=>{
 const f=fixture();for(const linktext of ['paper.pdf#page=7','[[paper.pdf#page=7|Evidence]]','![[paper.pdf#page=7]]'])assert.deepEqual(f.drop({type:'link',file:f.pdf,linktext}),{handled:true,references:[{file:f.pdf,path:f.pdf.path,page:7}]});assert.equal(f.resolutions.length,0);
});
test('native links use their own source path and only already-existing metadata destinations',()=>{
 const f=fixture();const result=f.drop({type:'link',linktext:'[[Note#Section|label]]',sourcePath:'folder/source.md'});assert.deepEqual(result,{handled:true,references:[{file:f.note,path:f.note.path,page:1}]});assert.deepEqual(f.resolutions,[{link:'Note',sourcePath:'folder/source.md'}]);assert.deepEqual(f.drop({type:'link',linktext:'Missing',sourcePath:'folder/source.md'}),{handled:false,references:[]});
});
test('native links reject stale file identity and do not fall back through linktext',()=>{
 const f=fixture(),stale=new NoteFile(f.note.path);assert.deepEqual(f.drop({type:'link',file:stale,linktext:'Note'}),{handled:true,references:[]});assert.equal(f.resolutions.length,0);
});
test('native link metadata results must still be current vault files',()=>{
 const f=fixture();f.aliases.set('Foreign',new NoteFile(f.note.path));assert.deepEqual(f.drop({type:'link',linktext:'Foreign'}),{handled:false,references:[]});for(const linktext of ['https://example.org/Note.md','obsidian://open?vault=other&file=Note'])assert.deepEqual(f.drop({type:'link',linktext}),{handled:false,references:[]});assert.equal(f.resolutions.length,1);
});
test('URI fallback resolves native extensionless paths exactly before metadata',()=>{
 const f=fixture();assert.deepEqual(f.drop(null,'','obsidian://open?vault=demo-vault&file='+encodeURIComponent('中文/含 空格')),{handled:true,references:[{file:f.files.get('中文/含 空格.md')!,path:'中文/含 空格.md',page:1}]});assert.deepEqual(f.lookups.slice(0,2),['中文/含 空格','中文/含 空格.md']);assert.equal(f.resolutions.length,0);
});
test('URI parameters decode exactly once and plus signs remain part of encoded names',()=>{
 const f=fixture(['literal%2F.md','literal/.md','A+B.md']);const uri=['literal%2F','A+B'].map(path=>'obsidian://open?file='+encodeURIComponent(path)).join('\n');const result=f.drop(null,'',uri);assert.equal(result.handled,true);assert.deepEqual(result.references.map(r=>r.path),['literal%2F.md','A+B.md']);assert.equal(f.resolutions.length,0);
});
test('multiline URI batches preserve PDF pages and ignore only exact duplicate references',()=>{
 const f=fixture();const uri=['folder/Note','folder/paper.pdf#page=2','folder/paper.pdf#page=2','folder/paper.pdf#page=3'].map(path=>'obsidian://open?vault=demo-vault&file='+encodeURIComponent(path)).join('\r\n');const result=f.drop(null,'',uri);assert.equal(result.handled,true);assert.deepEqual(result.references.map(r=>[r.path,r.page]),[['folder/Note.md',1],['folder/paper.pdf',2],['folder/paper.pdf',3]]);
});
test('cross-vault and malformed URI payloads cannot fall back into same-name current notes',()=>{
 const f=fixture();for(const uri of ['obsidian://open?vault=other&file=folder%2FNote','https://example.org/Note.md','obsidian://open?file=folder%2FNote&file=folder%2Fpaper.pdf','obsidian://open?vault=demo-vault&file=folder%2FNote\nprose','obsidian://open?file=folder%2FNote\nobsidian://open?vault=other&file=folder%2FNote'])assert.deepEqual(f.drop(null,'[[Note]]',uri),{handled:false,references:[]});assert.equal(f.lookups.length,0);assert.equal(f.resolutions.length,0);
});
test('complete wiki link lists allow aliases, headings and distinct PDF page references',()=>{
 const f=fixture();const result=f.drop(null,' [[Note#Heading|label]]\n![[paper.pdf#page=4]] [[Note]]\n[[paper.pdf#page=5|p5]] ');assert.equal(result.handled,true);assert.deepEqual(result.references.map(r=>[r.path,r.page]),[['folder/Note.md',1],['folder/paper.pdf',4],['folder/paper.pdf',5]]);
});
test('fallback never extracts accidental links from prose, external URLs or invalid PDF locators',()=>{
 const f=fixture();for(const text of ['Read [[Note]]','[[Note]] trailing','[[Note]]\nhttps://example.org/Note.md','https://example.org/Note.md','[[https://example.org/Note.md]]','[[paper.pdf#page=0]]','[[paper.pdf#page=9007199254740992]]','[[paper.pdf#page=x]]'])assert.deepEqual(f.drop(null,text),{handled:false,references:[]});assert.equal(f.lookups.length,0);assert.equal(f.resolutions.length,0);
});
test('plain path batches require every line to exist before consuming any valid member',()=>{
 const f=fixture();assert.deepEqual(f.drop(null,'folder/Note.md\nRead folder/paper.pdf'),{handled:false,references:[]});assert.deepEqual(f.drop(null,'folder/Note.md|display prose'),{handled:false,references:[]});assert.equal(f.resolutions.length,0);
});
test('plain fallback accepts only existing explicit md/pdf paths and does not basename-resolve prose',()=>{
 const f=fixture();assert.deepEqual(f.drop(null,'folder/Note.md\nfolder/paper.pdf#page=2').references.map(r=>[r.path,r.page]),[['folder/Note.md',1],['folder/paper.pdf',2]]);for(const text of ['Note','Note.md','See folder/Note.md','folder/image.png'])assert.deepEqual(f.drop(null,text),{handled:false,references:[]});assert.equal(f.resolutions.length,0);
});
test('unknown wiki targets do not create notes while existing members can be referenced',()=>{
 const f=fixture();assert.deepEqual(f.drop(null,'[[Missing]]'),{handled:false,references:[]});assert.deepEqual(f.drop(null,'[[Missing]]\n[[Note]]').references.map(r=>r.path),[f.note.path]);assert.equal(f.files.size,5);
});
test('missing transfer and unreadable browser formats are harmless',()=>{
 const f=fixture();assert.deepEqual(resolveNativeNoteDrop(f.lookup,null,null,''),{handled:false,references:[]});assert.deepEqual(resolveNativeNoteDrop(f.lookup,neverRead,null,''),{handled:false,references:[]});
});
test('native multi-file resolution stays linear for large batches with unsupported members',()=>{
 const f=fixture([]),files:NoteFile[]=[];for(let i=0;i<1000;i++){const file=new NoteFile(`notes/${i}.md`);f.files.set(file.path,file);files.push(file,new NoteFile(`${i}.png`),file);}const result=f.drop({type:'files',files});assert.equal(result.references.length,1000);assert.ok(f.lookups.length<=files.length);assert.equal(f.resolutions.length,0);
});
