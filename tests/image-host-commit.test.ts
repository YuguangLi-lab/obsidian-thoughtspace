import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  async uploadExistingImage('),end=source.indexOf('  private imageImportBusy',start);
class TFile {path='local.png';name='local.png';}
function setup(){
 let resolve!:(url:string)=>void,calls=0;const pending=new Promise<string>(r=>resolve=r);
 const View=new Function('TFile','uploadHostedImage','Notice',transformSync(`class View{${source.slice(start,end)}};return View`,{loader:'ts'}).code)(TFile,()=>{calls++;return pending;},class{});
 const file=new TFile(),node={id:'image',kind:'image',file:file.path,locked:false,imageUrl:undefined as string|undefined};
 const owner={board:{nodes:[node]},change:(fn:any)=>fn(owner.board)};
 const view=new View();Object.assign(view,{hostedUploads:new Set(),file:{path:'board.thoughtspace'},requireOwner:()=>owner,app:{vault:{getAbstractFileByPath:()=>file,readBinary:async()=>new ArrayBuffer(1)}}});
 return {view,node,resolve,calls:()=>calls};
}
test('locking an image during upload preserves its local reference and releases the busy flag',async()=>{
 const f=setup(),upload=f.view.uploadExistingImage('image');await Promise.resolve();f.node.locked=true;f.resolve('https://example.com/image.png');
 await assert.rejects(upload,/图片引用已变化/);assert.equal(f.node.imageUrl,undefined);assert.equal(f.node.file,'local.png');assert.equal(f.view.hostedUploads.size,0);
});
test('duplicate image upload clicks share the existing operation without extra upload',async()=>{
 const f=setup(),upload=f.view.uploadExistingImage('image');await Promise.resolve();await f.view.uploadExistingImage('image');assert.equal(f.calls(),1);
 f.resolve('https://example.com/image.png');await upload;assert.equal(f.node.imageUrl,'https://example.com/image.png');assert.equal(f.node.file,'local.png');assert.equal(f.view.hostedUploads.size,0);
});
