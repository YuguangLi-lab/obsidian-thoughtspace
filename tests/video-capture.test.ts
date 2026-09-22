import {test} from 'node:test';
import assert from 'node:assert/strict';
import {videoCaptureRequest,addVideoCaptureCard,captureLayout,videoCaptureContent,addVideoCaptureObjects} from '../src/video-capture';
import {emptyBoard,parseBoard} from '../src/model';
const request={id:'12345678-1234-1234-1234-123456789abc',board:'学习/课程.thoughtspace',note:'视频/记录.md',vaultId:'abcdef0123456789abcd'};
test('video capture request validates explicit board and note paths',()=>{
 assert.deepEqual(videoCaptureRequest(request),request);
 for(const patch of [{board:'../bad.thoughtspace'},{board:'.obsidian/a.thoughtspace'},{note:'/secret.md'},{note:'a.png'},{id:'bad'},{vaultId:'wrong'}])assert.throws(()=>videoCaptureRequest({...request,...patch}));
});
test('video cards reference Markdown and land below existing content without changing it',()=>{
 const board=emptyBoard();board.nodes.push({id:'old',kind:'text',text:'keep',x:100,y:200,width:200,height:70,color:'sand'});
 const old=structuredClone(board.nodes[0]);const id=addVideoCaptureCard(board,request);
 assert.deepEqual(board.nodes[0],old);assert.equal(board.nodes[1].file,request.note);assert.equal(board.nodes[1].y,302);assert.equal(board.nodes[1].id,id);
});
test('retries do not duplicate captured cards and collisions are rejected',()=>{
 const board=emptyBoard();const id=addVideoCaptureCard(board,request);assert.equal(addVideoCaptureCard(board,request),id);assert.equal(board.nodes.length,1);
 assert.throws(()=>addVideoCaptureCard(board,{...request,note:'另一个.md'}));
});
test('configurable cards append right of content without moving existing objects',()=>{
 const board=emptyBoard();board.nodes.push({id:'old',kind:'text',text:'keep',x:100,y:200,width:200,height:70,color:'sand'});
 const original=structuredClone(board.nodes[0]);addVideoCaptureCard(board,{...request,layout:{width:480,color:'rose',placement:'right'}});
 assert.deepEqual(board.nodes[0],original);assert.equal(board.nodes[1].x,332);assert.equal(board.nodes[1].y,200);assert.equal(board.nodes[1].width,480);assert.equal(board.nodes[1].color,'rose');
 addVideoCaptureCard(board,{...request,layout:{width:600,color:'green',placement:'below'}});assert.equal(board.nodes.length,2);assert.equal(board.nodes[1].width,480);
});
test('card options clamp corrupt values and preserve backwards compatible defaults',()=>{
 assert.deepEqual(captureLayout(null),{width:380,color:'blue',placement:'below'});
 assert.equal(captureLayout({width:Infinity}).width,380);assert.equal(captureLayout({width:10000}).width,640);
 assert.equal(captureLayout({color:'<script>',placement:'overlap',width:-1}).width,300);
});
const link='yingjian://open?video=%2Ftmp%2Fcourse.mp4&t=14.25';
const image=`视频/附件/视频截图-${request.id}.png`;
const saved=(body='这是我的想法',screenshot=true)=>`---\nyingjian-capture-id: "${request.id}"\n---\n\n> [!question] 疑问 · [00:14](${link})\n> ${body}${screenshot?'\n>\n> ![['+image+'|640]]':''}\n\n^video-t-${request.id}\n`;
test('saved capture becomes clean editable text and a separate canonical image path',()=>{
 const content=videoCaptureContent(saved(),request.id);assert.equal(content.image,image);assert.match(content.text,/疑问 · \[00:14\]/);assert.match(content.text,/这是我的想法/);assert.ok(!content.text.includes('![['));assert.ok(!content.text.includes('[!question]'));
 assert.equal(videoCaptureContent(saved('文字',false),request.id).image,undefined);
 assert.ok(videoCaptureContent(saved(`[00:01](${link})\n> 下一行`),request.id).text.includes('下一行'));
 assert.throws(()=>videoCaptureContent(saved(),request.id.replace('1234','5678')));
});
test('native object batch measures text before placing image and round-trips through real schema',()=>{
 const board=emptyBoard(),content=videoCaptureContent(saved(),request.id);content.imageSize={width:1920,height:1080};
 addVideoCaptureObjects(board,{...request,layout:{width:640,color:'green',placement:'below'}},content,n=>{n.height=172});
 assert.deepEqual(board.nodes.map(n=>n.kind),['text','image']);assert.equal(board.nodes[0].width,640);assert.equal(board.nodes[1].y,188);assert.equal(board.nodes[1].height,360);
 assert.equal(board.nodes[1].file,image);assert.deepEqual(parseBoard(JSON.stringify(board)),board);
});
test('retry preserves independently edited, moved, resized or partially deleted objects',()=>{
 const board=emptyBoard(),content={...videoCaptureContent(saved(),request.id),imageSize:{width:1920,height:1080}};
 addVideoCaptureObjects(board,request,content);Object.assign(board.nodes[0],{text:'我编辑过的文字',x:700});board.nodes[1].width=450;
 const before=structuredClone(board);addVideoCaptureObjects(board,request,content);assert.deepEqual(board,before);
 board.nodes.pop();const partial=structuredClone(board);addVideoCaptureObjects(board,request,content);assert.deepEqual(board,partial);
 assert.throws(()=>addVideoCaptureObjects(board,{...request,note:'另一个.md'},content));assert.deepEqual(board,partial);
});
test('text-only capture makes no Markdown card or fake image; bad image size is atomic',()=>{
 const board=emptyBoard();addVideoCaptureObjects(board,request,videoCaptureContent(saved('文字',false),request.id));assert.equal(board.nodes.length,1);assert.equal(board.nodes[0].kind,'text');
 const empty=emptyBoard();assert.throws(()=>addVideoCaptureObjects(empty,request,{text:'x',image}));assert.equal(empty.nodes.length,0);
 const oversized=emptyBoard();addVideoCaptureCard(oversized,{...request,layout:{width:640,color:'blue',placement:'below'}});assert.doesNotThrow(()=>parseBoard(JSON.stringify(oversized)));
});
test('metadata rejects hidden provenance and unsupported presentations',()=>{
 assert.throws(()=>videoCaptureRequest({...request,presentation:'html'}));const b=emptyBoard();addVideoCaptureObjects(b,request,{text:'文字'});b.nodes[0].videoCapture!.note='.obsidian/private.md';assert.throws(()=>parseBoard(JSON.stringify(b)));
});
