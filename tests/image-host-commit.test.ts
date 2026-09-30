import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  async uploadExistingImage('),end=source.indexOf('  private imageImportBusy',start);
class TFile {path='local.png';name='local.png';stat={mtime:1,size:1};}
function setup(){
 let resolve!:(url:string)=>void,calls=0;const pending=new Promise<string>(r=>resolve=r);
 const View=new Function('TFile','uploadHostedImage','Notice',transformSync(`class View{${source.slice(start,end)}};return View`,{loader:'ts'}).code)(TFile,()=>{calls++;return pending;},class{});
 const file=new TFile(),node={id:'image',kind:'image',file:file.path,locked:false,imageUrl:undefined as string|undefined};let referenced:TFile|undefined=file;
 const owner={board:{nodes:[node]},change:(fn:any)=>fn(owner.board)};
 const view=new View();Object.assign(view,{hostedUploads:new Set(),file:{path:'board.thoughtspace'},requireOwner:()=>owner,app:{vault:{getAbstractFileByPath:()=>referenced,readBinary:async()=>new ArrayBuffer(1)}}});
 return {view,node,file,resolve,calls:()=>calls,replaceSource:(next:TFile|undefined)=>{referenced=next;}};
}
test('locking an image during upload preserves its local reference and releases the busy flag',async()=>{
 const f=setup(),upload=f.view.uploadExistingImage('image');await Promise.resolve();f.node.locked=true;f.resolve('https://example.com/image.png');
 await assert.rejects(upload,/图片引用已变化/);assert.equal(f.node.imageUrl,undefined);assert.equal(f.node.file,'local.png');assert.equal(f.view.hostedUploads.size,0);
});
test('duplicate image upload clicks share the existing operation without extra upload',async()=>{
 const f=setup(),upload=f.view.uploadExistingImage('image');await Promise.resolve();await f.view.uploadExistingImage('image');assert.equal(f.calls(),1);
 f.resolve('https://example.com/image.png');await upload;assert.equal(f.node.imageUrl,'https://example.com/image.png');assert.equal(f.node.file,'local.png');assert.equal(f.view.hostedUploads.size,0);
});

for(const change of ['removed','replaced','edited','resized','renamed'] as const)test(`image upload refuses a ${change} source before replacing its remote reference`,async()=>{
 const f=setup(),upload=f.view.uploadExistingImage('image');await Promise.resolve();
 if(change==='removed')f.replaceSource(undefined);
 if(change==='replaced')f.replaceSource(new TFile());
 if(change==='edited')f.file.stat.mtime++;
 if(change==='resized')f.file.stat.size++;
 if(change==='renamed')f.file.path='renamed.png';
 f.resolve('https://example.com/stale.png');
 await assert.rejects(upload,/图片.*变化|来源.*变化/);
 assert.equal(f.node.imageUrl,undefined);assert.equal(f.node.file,'local.png');assert.equal(f.view.hostedUploads.size,0);
});

test('image source changes during binary read stop the upload request itself',async()=>{
 const f=setup();let resolve!:(bytes:ArrayBuffer)=>void;
 f.view.app.vault.readBinary=()=>new Promise<ArrayBuffer>(r=>resolve=r);
 const upload=f.view.uploadExistingImage('image');f.file.stat.mtime++;resolve(new ArrayBuffer(1));f.resolve('https://example.com/stale.png');
 await assert.rejects(upload,/图片.*变化|来源.*变化/);
 assert.equal(f.calls(),0);assert.equal(f.node.imageUrl,undefined);assert.equal(f.view.hostedUploads.size,0);
});
