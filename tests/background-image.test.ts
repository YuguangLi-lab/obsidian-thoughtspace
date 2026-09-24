import test from 'node:test';
import assert from 'node:assert/strict';
import {BackgroundImagePreferences,MAX_BACKGROUND_IMAGE_BYTES,backgroundImageStamp,cleanBackgroundImagePreferences,defaultBackgroundImagePreferences,validateBackgroundImageBytes} from '../src/background-image';

const from64=(text:string)=>new Uint8Array(Buffer.from(text,'base64'));
const png=from64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAE0lEQVR4nGP88uUWAwMDCwMYAAAhagLIu2ryJAAAAABJRU5ErkJggg==');
const jpg=from64('/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjI4LjEwMgD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABMAAEBAAAAAAAAAAAAAAAAAAAABwEBAQAAAAAAAAAAAAAAAAAAAgQQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCAACAAIDASIAAhEAAxEA/9oADAMBAAIRAxEAPwC5AIif/9k=');
const gif=from64('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
// A browser-encoded WebP with a real image payload, independent of filename or MIME.
const webp=from64('UklGRi4AAABXRUJQVlA4ICIAAABQAQCdASoCAAIAAUAmJQBOgDEIAP77hEuvWlubhITdgYAA');

test('background image settings default to an empty local path, cover and seventy percent',()=>{
 for(const raw of [null,undefined,[],0,false,'image.png',{}])assert.deepEqual(cleanBackgroundImagePreferences(raw),defaultBackgroundImagePreferences);
 assert.deepEqual(defaultBackgroundImagePreferences,{backgroundImagePath:'',backgroundImageFit:'cover',backgroundImageOpacity:70});
});
test('vault image paths retain Chinese, spaces and supported mixed-case raster suffixes',()=>{
 for(const path of ['附件/纸张 米黄色.PNG','assets/paper.jpg','assets/paper.JPEG','wallpaper.webp','封面.gif','.obsidian/plugins/thoughtspace/backgrounds/a.png'])assert.equal(cleanBackgroundImagePreferences({backgroundImagePath:path}).backgroundImagePath,path);
 assert.equal(cleanBackgroundImagePreferences({backgroundImagePath:'  附件/米黄.png  '}).backgroundImagePath,'附件/米黄.png');
});
test('network, absolute, encoded traversal and malformed persisted paths cannot become backgrounds',()=>{
 for(const backgroundImagePath of ['/etc/test.png','//example.org/a.png','~/Pictures/a.png','C:/a.png','C:\\a.png','https://host/a.png','data:image/png;base64,AAAA','file:///a.png','javascript:a.png','../a.png','a/../b.png','a/./b.png','a//b.png','a\\b.png','a.png?q=1','a.png#page','a\0.png','a\n.png','a.png\n','\ta.png','a/\u007f.png','%2e%2e/a.png','a%2Fb.png','a%5cb.png','%252e%252e/a.png','a.svg','a.png.svg','a','a/'.repeat(2050)+'x.png',{},[],true,12])assert.equal(cleanBackgroundImagePreferences({backgroundImagePath}).backgroundImagePath,'',String(backgroundImagePath));
});
test('opacity retains zero/fractions, clamps finite values and rejects coercion; fit rejects unknown modes',()=>{
 for(const [backgroundImageOpacity,expected]of [[0,0],[33.5,33.5],[100,100],[-1,0],[120,100],[NaN,70],[Infinity,70],[-Infinity,70],['0',70],[null,70],[false,70]] as const)assert.equal(cleanBackgroundImagePreferences({backgroundImageOpacity}).backgroundImageOpacity,expected);
 for(const fit of ['cover','contain','tile'])assert.equal(cleanBackgroundImagePreferences({backgroundImageFit:fit}).backgroundImageFit,fit);
 for(const fit of ['__proto__','inherit','url(a)','stretch',null,[]])assert.equal(cleanBackgroundImagePreferences({backgroundImageFit:fit}).backgroundImageFit,'cover');
});
test('sanitization does not mutate callers/defaults and stamps cover every independent setting',()=>{
 const original={backgroundImagePath:'a.png',backgroundImageFit:'tile',backgroundImageOpacity:0,secret:'ignore'},before=JSON.stringify(original),clean=cleanBackgroundImagePreferences(original);
 assert.deepEqual(Object.keys(clean).sort(),['backgroundImageFit','backgroundImageOpacity','backgroundImagePath']);
 for(const change of [{backgroundImagePath:'b.png'},{backgroundImageFit:'contain' as const},{backgroundImageOpacity:1}])assert.notEqual(backgroundImageStamp(clean),backgroundImageStamp({...clean,...change}));
 assert.equal(backgroundImageStamp(clean),backgroundImageStamp(JSON.parse(JSON.stringify(clean)) as BackgroundImagePreferences));
 clean.backgroundImagePath='c.png';assert.equal(JSON.stringify(original),before);assert.equal(defaultBackgroundImagePreferences.backgroundImagePath,'');
});
test('actual PNG, JPEG, WebP and GIF byte signatures determine safe stored extensions',()=>{
 for(const [bytes,extension]of [[png,'png'],[jpg,'jpg'],[webp,'webp'],[gif,'gif']] as const){const before=Buffer.from(bytes);assert.equal(validateBackgroundImageBytes(bytes),extension);assert.deepEqual(Buffer.from(bytes),before);}
 const wrapped=new Uint8Array(png.length+14);wrapped.set(png,7);assert.equal(validateBackgroundImageBytes(wrapped.subarray(7,7+png.length)),'png');
});
test('empty, oversized, SVG, HTML and filename-disguised unsupported files are rejected before decode',()=>{
 assert.throws(()=>validateBackgroundImageBytes(new Uint8Array()),/为空/);
 const tooLarge=new Uint8Array(MAX_BACKGROUND_IMAGE_BYTES+1);tooLarge.set(png);assert.throws(()=>validateBackgroundImageBytes(tooLarge),/20 MB/);
 assert.throws(()=>validateBackgroundImageBytes(new Uint8Array(MAX_BACKGROUND_IMAGE_BYTES)),/仅支持/);
 for(const text of ['<svg xmlns="http://www.w3.org/2000/svg"/>','<!doctype html><script>alert(1)</script>','image.png','BMabcdefgh','RIFFxxxxWAVEabcd'])assert.throws(()=>validateBackgroundImageBytes(new TextEncoder().encode(text)),/仅支持/);
});
test('truncated images and forged signature-only files are rejected',()=>{
 for(const bytes of [png,jpg,webp,gif])for(const cut of [2,8,12,bytes.length-1])assert.throws(()=>validateBackgroundImageBytes(bytes.slice(0,cut)),/图片|支持/);
 for(const bytes of [png.slice(0,8),jpg.slice(0,3),webp.slice(0,12),gif.slice(0,6)])assert.throws(()=>validateBackgroundImageBytes(bytes),/图片|支持/);
});
test('invalid lengths, missing pixel data and zero dimensions reject misleading headers',()=>{
 const noWidth=png.slice();noWidth.fill(0,16,20);assert.throws(()=>validateBackgroundImageBytes(noWidth),/损坏/);
 const chunkOverrun=png.slice();chunkOverrun.set([255,255,255,255],8);assert.throws(()=>validateBackgroundImageBytes(chunkOverrun),/损坏/);
 const webpWrongSize=webp.slice();webpWrongSize[4]++;assert.throws(()=>validateBackgroundImageBytes(webpWrongSize),/损坏/);
 const noGifWidth=gif.slice();noGifWidth.fill(0,6,8);assert.throws(()=>validateBackgroundImageBytes(noGifWidth),/损坏/);
 const brokenJpeg=jpg.slice();const frame=brokenJpeg.findIndex((value,index)=>value===255&&brokenJpeg[index+1]===192);brokenJpeg.fill(0,frame+5,frame+7);assert.throws(()=>validateBackgroundImageBytes(brokenJpeg),/损坏/);
});
