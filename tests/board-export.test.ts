import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard} from '../src/model';
import {boardExportScene,jpegPagePdf} from '../src/board-export';

test('the current camera keeps visible cards and drops cards outside the frame',()=>{
 const board={...emptyBoard(),version:3 as const,viewport:{x:0,y:0,zoom:1},nodes:[
  {id:'near',kind:'card' as const,file:'Cards/A.md',x:10,y:20,width:200,height:120,color:'sand' as const,title:'林荫'},
  {id:'far',kind:'text' as const,text:'远处',x:5000,y:20,width:200,height:80,color:'sand' as const},
 ],edges:[{id:'e',from:'near',to:'far',label:''}]};
 const scene=boardExportScene(board,{width:800,height:600},id=>board.nodes.find(node=>node.id===id)?.title||'');
 assert.deepEqual(scene.nodes.map(node=>node.id),['near']);
 assert.equal(scene.edges.length,0);
 assert.equal(scene.nodes[0].title,'林荫');
});

test('a JPEG becomes a one-page PDF and the image bytes stay intact',()=>{
 const jpeg=Uint8Array.from([0xff,0xd8,0xff,0xd9]);
 const pdf=jpegPagePdf(jpeg,320,180);
 const text=new TextDecoder().decode(pdf);
 assert.match(text,/^%PDF-1\.4/);
 assert.match(text,/MediaBox \[0 0 320 180\]/);
 assert.match(text,/DCTDecode/);
 assert.ok(text.includes('%%EOF'));
 assert.throws(()=>jpegPagePdf(Uint8Array.from([1,2,3]),10,10),/图像无效/);
});
