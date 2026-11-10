import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard} from '../src/model';
import {connectionPath} from '../src/connections';
import {assertExportable,boardExportScene,jpegPagePdf} from '../src/board-export';

test('the current camera keeps visible cards and drops cards outside the frame',()=>{
 const board={...emptyBoard(),version:3 as const,viewport:{x:0,y:0,zoom:1},nodes:[
  {id:'near',kind:'card' as const,file:'Cards/A.md',x:10,y:20,width:200,height:120,color:'sand' as const,title:'林荫'},
  {id:'far',kind:'text' as const,text:'远处',x:5000,y:20,width:200,height:80,color:'sand' as const},
 ],edges:[{id:'e',from:'near',to:'far',label:''}]};
 const scene=boardExportScene(board,{width:800,height:600},id=>board.nodes.find(node=>node.id===id)?.title||'');
 assert.deepEqual(scene.nodes.map(node=>node.id),['near']);
 assert.equal(scene.edges.length,0);
 assert.equal(scene.nodes[0].title,'林荫');
 const shifted={...board,viewport:{x:50,y:-20,zoom:2},nodes:[...board.nodes,
  {id:'right',kind:'card' as const,file:'Cards/R.md',x:360,y:20,width:10,height:10,color:'sand' as const,title:'右'},
  {id:'left',kind:'text' as const,text:'左',x:-40,y:20,width:10,height:10,color:'sand' as const},
 ],edges:[...board.edges,{id:'near-right',from:'near',to:'right',label:''},{id:'near-left',from:'near',to:'left',label:''}]};
 const framed=boardExportScene(shifted,{width:800,height:600},()=>'林荫');
 const near=framed.nodes.find(node=>node.id==='near')!;
 assert.equal(near.x,10*2+50);
 assert.equal(near.y,20*2-20);
 assert.equal(framed.nodes.some(node=>node.id==='right'),true);
 assert.equal(framed.nodes.some(node=>node.id==='left'||node.id==='far'),false);
 const route=connectionPath(shifted.nodes.find(node=>node.id==='near')!,shifted.nodes.find(node=>node.id==='right')!,shifted.edges[1]);
 assert.equal(framed.edges.length,1);
 assert.ok(framed.edges[0].path.startsWith(`M ${route.from.x*2+50} ${route.from.y*2-20}`));
 assert.ok(framed.edges[0].path.endsWith(`${route.to.x*2+50} ${route.to.y*2-20}`));
 assert.throws(()=>assertExportable({...scene,nodes:[]}),/没有可导出的卡片/);
});

test('folded branches and groups export the heading the board shows',()=>{
 const folded={...emptyBoard(),version:3 as const,viewport:{x:0,y:0,zoom:1},nodes:[
  {id:'parent',kind:'card' as const,file:'Cards/P.md',title:'父',x:10,y:20,width:200,height:120,color:'sand' as const,branchFolded:true},
  {id:'child',kind:'text' as const,text:'子',x:40,y:80,width:200,height:100,color:'sand' as const},
  {id:'open',kind:'card' as const,file:'Cards/O.md',title:'旁',x:300,y:20,width:160,height:100,color:'sand' as const},
  {id:'short',kind:'card' as const,file:'Cards/S.md',title:'折',x:500,y:20,width:240,height:160,color:'sand' as const,collapsed:true},
  {id:'group',kind:'section' as const,title:'组',x:0,y:200,width:400,height:300,color:'blue' as const,sectionFolded:true},
  {id:'inside',kind:'card' as const,file:'Cards/I.md',title:'内',x:40,y:260,width:200,height:100,color:'sand' as const},
 ],edges:[
  {id:'fold',from:'parent',to:'child',label:'',kind:'branch' as const},
  {id:'keep',from:'parent',to:'open',label:'旁注',style:'straight' as const,dashed:true},
 ]};
 const picture=boardExportScene(folded,{width:800,height:600},id=>folded.nodes.find(node=>node.id===id)?.title||'');
 assert.deepEqual(picture.nodes.map(node=>node.id),['parent','open','short','group']);
 const parent=picture.nodes.find(node=>node.id==='parent')!,group=picture.nodes.find(node=>node.id==='group')!;
 assert.equal(parent.w,180);assert.equal(parent.h,40);assert.equal(parent.title,'父');
 assert.equal(picture.nodes.find(node=>node.id==='short')?.w,180);
 assert.equal(picture.nodes.find(node=>node.id==='short')?.h,40);
 assert.equal(group.w,180);assert.equal(group.h,40);assert.equal(group.title,'组');
 assert.deepEqual(picture.edges.map(edge=>edge.path),['M 190 40 L 300 70']);
 assert.equal(picture.edges[0].label,'旁注');
 assert.equal(picture.edges[0].labelX,245);assert.equal(picture.edges[0].labelY,47);
 assert.deepEqual(picture.edges[0].dash,[6,4]);
 assert.equal(folded.nodes.find(node=>node.id==='parent')?.height,120);
 assert.equal(folded.nodes.length,6);
 const open={...folded,nodes:folded.nodes.map(node=>node.id==='parent'?{...node,branchFolded:undefined}:node)};
 assert.deepEqual(boardExportScene(open,{width:800,height:600},()=>'').nodes.map(node=>node.id),['parent','child','open','short','group']);
 assert.doesNotThrow(()=>assertExportable(boardExportScene({...emptyBoard(),version:3 as const,viewport:{x:0,y:0,zoom:1},nodes:[folded.nodes[4]]}, {width:800,height:600},()=>'组')));
});

test('exported links follow the board route under the camera',()=>{
 const board={...emptyBoard(),version:3 as const,viewport:{x:12,y:-4,zoom:2},nodes:[
  {id:'a',kind:'card' as const,file:'Cards/A.md',title:'甲',x:0,y:0,width:100,height:80,color:'sand' as const},
  {id:'b',kind:'card' as const,file:'Cards/B.md',title:'乙',x:220,y:0,width:100,height:80,color:'sand' as const},
 ],edges:[
  {id:'curve',from:'a',to:'b',label:'曲线'},
  {id:'elbow',from:'b',to:'a',label:'',style:'elbow' as const,dashed:true},
 ]};
 const scene=boardExportScene(board,{width:800,height:600},id=>id);
 const curve=connectionPath(board.nodes[0],board.nodes[1],board.edges[0]);
 const elbow=connectionPath(board.nodes[1],board.nodes[0],board.edges[1]);
 assert.ok(scene.edges[0].path.startsWith(`M ${curve.from.x*2+12} ${curve.from.y*2-4}`));
 assert.ok(scene.edges[0].path.includes(' C '));
 assert.equal(scene.edges[0].label,'曲线');
 assert.ok(scene.edges[1].path.startsWith(`M ${elbow.from.x*2+12} ${elbow.from.y*2-4}`));
 assert.ok(scene.edges[1].path.includes(' Q '));
 assert.deepEqual(scene.edges[1].dash,[12,8]);
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
