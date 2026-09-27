import {test} from 'node:test';
import assert from 'node:assert/strict';
import {yingjianLink,yingjianMoments,videoSource} from '../src/yingjian';
import {videoCaptureContent,videoCaptureRequest} from '../src/video-capture';
import {rebaseFragment} from '../src/materials';
const id='12345678-1234-1234-1234-123456789abc',other='87654321-4321-4321-4321-cba987654321';
const source='/课程/第一讲.mp4',link=yingjianLink(source,14.25),second=yingjianLink(source,88);
const capture=(key:string,stamp:string,body:string)=>`> [!note] 重点 · [00:14](${stamp})\n> ${body}\n\n^video-t-${key}`;
test('player capture selection pairs the requested block id with its own timestamp and body',()=>{
 const raw=capture(other,second,'另外一条记录')+'\n\n'+capture(id,link,'当前这条记录');
 const result=videoCaptureContent(raw,id);assert.match(result.text,/当前这条记录/);assert.ok(!result.text.includes('另外一条记录'));assert.ok(!result.text.includes(second));assert.ok(result.text.includes(link));
});
test('record examples inside code or hidden comments cannot masquerade as saved captures',()=>{
 for(const raw of ['```md\n'+capture(id,link,'代码示例')+'\n```','<!--\n'+capture(id,link,'隐藏示例')+'\n-->','%%\n'+capture(id,link,'隐藏示例')+'\n%%'])assert.throws(()=>videoCaptureContent(raw,id));
});
test('duplicate capture anchors are rejected before selecting the wrong record',()=>{
 assert.throws(()=>videoCaptureContent(capture(id,link,'第一条')+'\n\n'+capture(id,second,'重复标记'),id));
});
test('quoted timestamps inside the same captured note stay in one complete excerpt',()=>{
 const raw=capture(id,link,`这段与 [01:28](${second}) 有关\n> 下一行`)+'\n\n'+capture(other,second,'下一条记录');
 const {moments}=yingjianMoments(raw,source);assert.equal(moments.length,2);assert.ok(moments[0].fragment.body.includes('下一行'));assert.ok(moments[0].fragment.body.endsWith('^video-t-'+id));assert.equal(rebaseFragment(raw,moments[0].fragment,[]),moments[0].fragment.body);
});
test('inline screenshot timestamps retain the original image and block reference together',()=>{
 const raw=`# 课程\n\n![[视频/附件/视频截图-${id}.png|640]] [00:14](${link}&kind=note)\n\n^video-t-${id}\n\n下一段文字`;
 const {moments}=yingjianMoments(raw,source);assert.equal(moments.length,1);assert.ok(moments[0].fragment.body.includes('![[视频/附件/'));assert.ok(moments[0].fragment.body.endsWith('^video-t-'+id));assert.ok(!moments[0].fragment.body.includes('下一段'));assert.equal(rebaseFragment(raw,moments[0].fragment,[]),moments[0].fragment.body);
});
test('Windows absolute media paths supported by the installed player survive the bridge',()=>{
 for(const path of ['C:\\课程\\第一讲.mp4','D:/课程/第一讲.m4a']){assert.equal(videoSource(path),path);assert.equal(new URL(yingjianLink(path,12)).searchParams.get('video'),path);}
 for(const path of ['C:relative.mp4','C:\\课程\\bad\n.mp4','\\\\server\\video.mp4'])assert.equal(videoSource(path),undefined);
});
test('malformed record ids are rejected at the player integration boundary',()=>{
 const request={id:'------------------------------------',board:'课程.thoughtspace',note:'课程.md',vaultId:'abcdef0123456789abcd'};assert.throws(()=>videoCaptureRequest(request));assert.throws(()=>videoCaptureContent(capture(request.id,link,'正文'),request.id));
});

import {yingjianNoteSource} from '../src/yingjian';
test('saved capture metadata and scalar tags are recognized alongside original course notes',()=>{
 for(const meta of [{source,'video-note-id':'course'},{source,'yingjian-capture-id':id},{source,tags:['#影笺','学习']},{source,tags:'学习, 影笺'},{source,tags:'学习 #影笺'}])assert.equal(yingjianNoteSource(meta),source);
 for(const meta of [null,[],{source},{source,tags:['影笺/其他']},{source:'javascript:bad',tags:'影笺'},{source,'video-note-id':{}},{source,'video-note-id':'  '}])assert.equal(yingjianNoteSource(meta),undefined);
});
test('plain timestamp imports never consume a hidden or fenced example as their block reference',()=>{
 for(const suffix of ['<!--\n^video-t-'+id+'\n-->','```md\n^video-t-'+id+'\n```']){
  const row=`[00:14](${link})`;const {moments}=yingjianMoments(row+'\n\n'+suffix);assert.equal(moments[0].fragment.body,row);
 }
});
test('callout capture fragments preserve full Markdown body and remain bounded by a new callout',()=>{
 const first=`> [!note] 重点 · [00:14](${link})\n> **重点**\n>\n> ![[附件.png|640]]`,next=`> [!question] 疑问 · [01:28](${second})\n> 下一条`;
 const {moments}=yingjianMoments(first+'\n'+next,source);assert.equal(moments.length,2);assert.equal(moments[0].fragment.body,first);assert.equal(moments[1].fragment.body,next);
});
test('capture parser accepts fractional display timestamps and CRLF without mixing another record',()=>{
 const raw=capture(id,link,'保留 **Markdown**').replace('[00:14]','[00:14.250]').replace(/\n/g,'\r\n');
 const result=videoCaptureContent(raw,id);assert.equal(result.text,`重点 · [00:14.250](${link})\n\n保留 **Markdown**`);
});

import {isYingjianCaptureNote} from '../src/yingjian';
test('capture provenance matches one parsed property rather than a quoted example or longer id',()=>{
 assert.equal(isYingjianCaptureNote({'yingjian-capture-id':id},id),true);
 for(const meta of [null,{}, {'yingjian-capture-id':other},{'yingjian-capture-id':id+'-copied'},{example:'yingjian-capture-id: '+JSON.stringify(id)},{'yingjian-capture-id':[id]}])assert.equal(isYingjianCaptureNote(meta,id),false);
 assert.equal(isYingjianCaptureNote({'yingjian-capture-id':'bad'},'bad'),false);
});
