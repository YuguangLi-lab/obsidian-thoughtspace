import test from 'node:test';
import assert from 'node:assert/strict';
import {onlineVideo} from '../src/online-video';

const yt='dQw4w9WgXcQ',bv='BV1B7411m7LV';
test('YouTube standard, short, mobile, live, shorts and embed links become one playback identity',()=>{
 for(const input of [
  `https://youtube.com/watch?v=${yt}`,`https://www.youtube.com/watch/?v=${yt}`,
  `https://m.youtube.com/watch?v=${yt}`,`https://music.youtube.com/watch?v=${yt}`,
  `https://youtu.be/${yt}`,`https://youtu.be/${yt}/`,
  `https://www.youtube.com/shorts/${yt}`,`https://www.youtube.com/live/${yt}`,
  `https://www.youtube.com/embed/${yt}`,`https://www.youtube-nocookie.com/embed/${yt}`,
  `https://youtube-nocookie.com/embed/${yt}/`,`  HTTP://WWW.YOUTUBE.COM/watch?v=${yt}  `,
 ])assert.deepEqual(onlineVideo(input),{provider:'youtube',label:'YouTube',id:yt,url:`https://www.youtube.com/watch?v=${yt}`,embedUrl:`https://www.youtube-nocookie.com/embed/${yt}?autoplay=0&rel=0&playsinline=1`,start:0},input);
});
test('YouTube timestamps accept seconds, duration units, query aliases and time fragments',()=>{
 for(const [suffix,start] of [['?t=90',90],['?start=90',90],['?time_continue=90',90],['#t=90',90],['?t=1h2m3s',3723],['#t=2m3s',123],['?t=2h',7200],['?t=90s',90],['?t=2M',120],['?t=12.9',12],['?t=0',0]] as const){
  const video=onlineVideo(`https://youtu.be/${yt}${suffix}`);assert.ok(video,suffix);assert.equal(video.start,start);
  assert.equal(new URL(video.url).searchParams.get('t'),start?`${start}s`:null);assert.equal(new URL(video.embedUrl).searchParams.get('start'),start?String(start):null);
 }
});
test('canonical playback and embeds remove tracking, playlists, auto-play and injected player settings',()=>{
 const video=onlineVideo(`https://www.youtube.com/watch?v=${yt}&si=tracking&list=PLAYLIST&index=9&autoplay=1&origin=https%3A%2F%2Fevil.example&rel=1&t=1m#comments`)!;
 assert.equal(video.url,`https://www.youtube.com/watch?v=${yt}&t=60s`);
 assert.equal(video.embedUrl,`https://www.youtube-nocookie.com/embed/${yt}?autoplay=0&rel=0&playsinline=1&start=60`);
 const bili=onlineVideo(`https://www.bilibili.com/video/${bv}?spm_id_from=333.1&autoplay=1&danmaku=1&cid=1&p=2&t=45`)!;
 assert.equal(bili.url,`https://www.bilibili.com/video/${bv}/?p=2&t=45`);
 assert.equal(bili.embedUrl,`https://player.bilibili.com/player.html?bvid=${bv}&p=2&autoplay=0&danmaku=0&t=45`);
});
test('Bilibili BV and av URLs preserve identity and use official p/t player parameters',()=>{
 for(const input of [`https://bilibili.com/video/${bv}`,`https://www.bilibili.com/video/${bv}/`,`http://m.bilibili.com/video/${bv}`,`https://player.bilibili.com/player.html?bvid=${bv}`]){
  assert.deepEqual(onlineVideo(input),{provider:'bilibili',label:'哔哩哔哩',id:bv,url:`https://www.bilibili.com/video/${bv}/`,embedUrl:`https://player.bilibili.com/player.html?bvid=${bv}&p=1&autoplay=0&danmaku=0`,start:0,page:1},input);
 }
 for(const input of ['https://www.bilibili.com/video/av170001?p=2&t=45','https://player.bilibili.com/player.html?aid=170001&page=2#t=45']){
  const video=onlineVideo(input)!;assert.equal(video.id,'av170001');assert.equal(video.page,2);assert.equal(video.start,45);
  assert.equal(video.url,'https://www.bilibili.com/video/av170001/?p=2&t=45');assert.equal(video.embedUrl,'https://player.bilibili.com/player.html?aid=170001&p=2&autoplay=0&danmaku=0&t=45');
 }
});
test('times are bounded at seven days and pages accept the positive bounded range',()=>{
 for(const time of ['604800','999999999','999999999h','9'.repeat(400)])assert.equal(onlineVideo(`https://youtu.be/${yt}?t=${time}`)?.start,604800,time);
 assert.equal(onlineVideo(`https://www.bilibili.com/video/${bv}?t=999999999`)?.start,604800);
 for(const page of ['1','0002','10000'])assert.equal(onlineVideo(`https://www.bilibili.com/video/${bv}?p=${page}`)?.page,Number(page));
 for(const page of ['','0','-1','1.5','NaN','Infinity','10001','1e2','0x10','1%20','9'.repeat(400)])assert.equal(onlineVideo(`https://www.bilibili.com/video/${bv}?p=${page}`),undefined,page);
});
test('invalid, spoofed or credentialed URLs are never classified as playable videos',()=>{
 for(const input of [undefined,null,42,{},[],`//www.youtube.com/watch?v=${yt}`,`ftp://www.youtube.com/watch?v=${yt}`,`javascript:https://www.youtube.com/watch?v=${yt}`,
  `https://www.youtube.com.evil.example/watch?v=${yt}`,`https://evil.youtube.com/watch?v=${yt}`,`https://youtube.com@evil.example/watch?v=${yt}`,`https://evil.example@youtube.com/watch?v=${yt}`,
  `https://user:secret@youtube.com/watch?v=${yt}`,`https://youtube.com:443/watch?v=${yt}`,`http://youtube.com:80/watch?v=${yt}`,`https://youtube.com:8443/watch?v=${yt}`,
  `https://youtube.com./watch?v=${yt}`,`https://%79outube.com/watch?v=${yt}`,`https://youtube。com/watch?v=${yt}`,`https://you\ntube.com/watch?v=${yt}`,
  `https://youtube.com\\@evil.example/watch?v=${yt}`,`https://youtube.com/watch?v=${yt}\u0000`, `https://youtube.com/a/../watch?v=${yt}`,`https://youtube.com/%2e/watch?v=${yt}`,
  `https://www.bilibili.com.evil.example/video/${bv}`,`https://player.bilibili.com:443/player.html?bvid=${bv}`,`https://b23.tv/AbC123`,
  `https://youtu.be/${yt}?si=%ZZ`, `https://youtu.be/${yt}?si=a b`, `https://youtu.be/${yt}?si=<iframe>`, 'x'.repeat(8193),
 ])assert.equal(onlineVideo(input),undefined,String(input));
});
test('unsupported routes and invalid video identities remain ordinary links',()=>{
 for(const input of [
  'https://www.youtube.com/',`https://www.youtube.com/playlist?list=${yt}`,`https://www.youtube.com/watch`,
  `https://www.youtube-nocookie.com/watch?v=${yt}`,`https://youtu.be/watch?v=${yt}`,`https://www.youtube.com/embed/${yt}/extra`,
  'https://youtu.be/short','https://youtu.be/dQw4w9WgXcQQ','https://youtu.be/dQw4w9WgXc!',`https://www.youtube.com/watch?v=${yt}%3C`,
  'https://www.bilibili.com/bangumi/play/ep12345','https://www.bilibili.com/video/BV1short','https://www.bilibili.com/video/BV1B7411m7L!','https://www.bilibili.com/video/av0',
  `https://player.bilibili.com/video/${bv}`,`https://www.bilibili.com/player.html?bvid=${bv}`,`https://player.bilibili.com/player.html`,
  `https://player.bilibili.com/player.html?bvid=${bv}&episodeId=123`, `https://player.bilibili.com/player.html?aid=-1`, `https://player.bilibili.com/player.html?bvid=av170001`,
 ])assert.equal(onlineVideo(input),undefined,input);
});
test('duplicate IDs, page aliases and ambiguous time values are rejected instead of silently selecting one',()=>{
 for(const input of [
  `https://www.youtube.com/watch?v=${yt}&v=${yt}`,`https://www.youtube.com/watch?v=${yt}&%76=${yt}`,`https://youtu.be/${yt}?v=${yt}`,
  `https://youtu.be/${yt}?t=1&t=2`,`https://youtu.be/${yt}?start=1&t=2`,`https://youtu.be/${yt}?time_continue=1#t=2`,`https://youtu.be/${yt}#t=1&t=2`,
  `https://www.bilibili.com/video/${bv}?p=1&p=2`,`https://www.bilibili.com/video/${bv}?p=1&page=2`,`https://www.bilibili.com/video/${bv}?t=1#t=2`,
  `https://www.bilibili.com/video/${bv}?bvid=${bv}`,`https://player.bilibili.com/player.html?bvid=${bv}&aid=170001`, `https://player.bilibili.com/player.html?bvid=${bv}&bvid=${bv}`,
 ])assert.equal(onlineVideo(input),undefined,input);
});
test('malformed timestamps cannot be coerced into valid playback positions',()=>{
 for(const t of ['','-1','NaN','Infinity','1e2','0x10','1:30','1m2h','1s2s','1.5h','h','%20','12x','1%00']){
  assert.equal(onlineVideo(`https://youtu.be/${yt}?t=${t}`),undefined,t);assert.equal(onlineVideo(`https://www.bilibili.com/video/${bv}?t=${t}`),undefined,t);
 }
 assert.equal(onlineVideo(`https://www.bilibili.com/video/${bv}?t=1m`),undefined);
});
test('canonical playback and official embeds round-trip without changing video, page or start',()=>{
 for(const input of [`https://youtu.be/${yt}?t=1m2s`,`https://www.bilibili.com/video/${bv}?p=3&t=24`,'https://player.bilibili.com/player.html?aid=170001&page=2&t=12']){
  const video=onlineVideo(input)!;assert.ok(video);assert.deepEqual(onlineVideo(video.url),video);assert.deepEqual(onlineVideo(video.embedUrl),video);
 }
});
