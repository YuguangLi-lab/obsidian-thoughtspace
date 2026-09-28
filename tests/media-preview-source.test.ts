import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaPreviewPath} from '../src/media-preview-source';

test('normalized Markdown screenshot paths preserve Unicode, spaces, hashes and parentheses',()=>{
 assert.equal(mediaPreviewPath('![截图](附件/课程%20一%20%28重点%29%20%231.png)'),'附件/课程 一 (重点) #1.png');
 assert.equal(mediaPreviewPath('![图](附件/课程(第一节).PNG)'),'附件/课程(第一节).PNG');
 assert.equal(mediaPreviewPath('![图](<附件/课程 一 (重点).jpeg>)'),'附件/课程 一 (重点).jpeg');
 assert.equal(mediaPreviewPath('![图](附件/课程\\ 一\\(重点\\).webp)'),'附件/课程 一(重点).webp');
});
test('balanced and escaped alt labels do not become part of the destination',()=>{
 assert.equal(mediaPreviewPath('![截图 [第一张] \\[备注\\]](附件/画面.png)'),'附件/画面.png');
 assert.equal(mediaPreviewPath('![label [inner](decoy) [nested]](附件/real.png)'),'附件/real.png');
 assert.equal(mediaPreviewPath('![label](附件/name%5D%28part%29.png)'),'附件/name](part).png');
});
test('optional Markdown titles are ignored without swallowing extra markup',()=>{
 for(const title of ['"一张截图"',"'一张截图'",'(一张截图)','"引用 \\"内容\\""'])assert.equal(mediaPreviewPath(`![图](附件/画面.png ${title})`),'附件/画面.png',title);
 assert.equal(mediaPreviewPath('![图](<附件/课程 一.png> "备注 (一)")'),'附件/课程 一.png');
 for(const bad of ['![图](附件/画面.png trailing)','![图](附件/画面.png "one" "two")','![图](附件/画面.png "unfinished)','![图](附件/画面.png (unfinished)','![图](<附件/画面.png>"title")','![图](附件/画面.png "escaped close\\")'])assert.equal(mediaPreviewPath(bad),undefined,bad);
});
test('wiki aliases and dimensions leave the exact literal vault path unchanged',()=>{
 for(const suffix of ['', '|截图说明', '|640', '|640x360'])assert.equal(mediaPreviewPath(`![[附件/课程 (一) #1.png${suffix}]]`),'附件/课程 (一) #1.png');
 assert.equal(mediaPreviewPath('![[附件/100%20%2F.png|不解码文件名]]'),'附件/100%20%2F.png');
 assert.equal(mediaPreviewPath('![[附件/100%.png]]'),'附件/100%.png');
 assert.equal(mediaPreviewPath('![[附件/&amp;.png]]'),'附件/&amp;.png');
});
test('URL encoding is decoded exactly once, without normalizing a literal encoded path again',()=>{
 assert.equal(mediaPreviewPath('![图](附件/100%25%2520.png)'),'附件/100%%20.png');
 assert.equal(mediaPreviewPath('![图](%252e%252e/画面.png)'),'%2e%2e/画面.png');
 assert.equal(mediaPreviewPath('![图](附件%2F画面.png)'),'附件/画面.png');
 assert.equal(mediaPreviewPath('![图](附件/%252Fname.png)'),'附件/%2Fname.png');
 for(const bad of ['![图](附件/100%.png)','![图](附件/%GG.png)','![图](附件/%FF.png)','![图](附件/%E4%B8.png)'])assert.equal(mediaPreviewPath(bad),undefined,bad);
});
test('schemes, external URLs and absolute paths never become a preview source',()=>{
 const paths=['https://host/a.png','http://host/a.png','data:image/png;base64,a.png','file:///tmp/a.png','obsidian://open/a.png','javascript:a.png','/tmp/a.png','//host/a.png','C:/a.png','C:\\a.png','\\\\host\\a.png'];
 for(const path of paths){assert.equal(mediaPreviewPath(`![[${path}]]`),undefined,path);assert.equal(mediaPreviewPath(`![图](${encodeURI(path)})`),undefined,path);}
 for(const path of ['https%3A%2F%2Fhost/a.png','%2Ftmp/a.png','%5C%5Chost%5Ca.png','C%3A%2Fa.png'])assert.equal(mediaPreviewPath(`![图](${path})`),undefined,path);
});
test('relative traversal and ambiguous path segments are rejected after decoding',()=>{
 for(const path of ['../a.png','./a.png','dir/../a.png','dir/./a.png','dir//a.png','dir\\a.png','dir/%2e%2e/a.png','%2e/a.png','dir%2F%2Ffile.png','dir%5C..%5Ca.png','%20a.png','a.png%20'])assert.equal(mediaPreviewPath(`![图](${path})`),undefined,path);
 for(const path of ['../a.png','./a.png','dir/../a.png','dir/./a.png','dir//a.png','dir\\a.png',' a.png','a.png '])assert.equal(mediaPreviewPath(`![[${path}]]`),undefined,path);
});
test('controls in the input or decoded path are rejected rather than trimmed away',()=>{
 for(const control of ['\0','\t','\n','\r','\x1f','\x7f','\x85','\u2028','\u2029']){
  assert.equal(mediaPreviewPath(`![图](a${control}.png)`),undefined);
  assert.equal(mediaPreviewPath(`![图](a${encodeURIComponent(control)}.png)`),undefined);
  assert.equal(mediaPreviewPath(`![[a.png|alias${control}]]`),undefined);
 }
 assert.equal(mediaPreviewPath('\n![图](a.png)'),undefined);
});
test('only supported raster extensions are allowed, without query or fragment fallback',()=>{
 for(const extension of ['png','jpg','jpeg','webp','gif','avif','bmp','JPEG'])assert.equal(mediaPreviewPath(`![图](附件/a.${extension})`),`附件/a.${extension}`);
 for(const path of ['a.svg','a.SVG','a.svg.png.svg','a.html','a.pdf','a.mp4','a.png?download=1','a.png#section','a.png/','a'])assert.equal(mediaPreviewPath(`![图](${path})`),undefined,path);
});
test('requires an entire single image, not text, code, comments, links or references',()=>{
 for(const input of ['a.png','[图](a.png)','[[a.png]]','![图][ref]','before ![图](a.png)','![图](a.png) after','![图](a.png) ![图](b.png)','`![图](a.png)`','<!-- ![图](a.png) -->','%% ![[a.png]] %%','\\![图](a.png)','![[a.png]','![图](a.png','![[a.png]] trailing','![label ](decoy) [nested]](附件/real.png)'])assert.equal(mediaPreviewPath(input),undefined,input);
 assert.equal(mediaPreviewPath('  ![图](附件/a.png)  '),'附件/a.png');
});
test('unexpected types and oversized inputs fail without coercion or exceptions',()=>{
 for(const input of [undefined,null,0,{},[],{toString(){throw Error('must not coerce');}},'x'.repeat(16385),'![[ '+ 'x'.repeat(8193)+'.png]]'])assert.equal(mediaPreviewPath(input),undefined);
 assert.equal(mediaPreviewPath(`![[${'a'.repeat(8188)}.png]]`),'a'.repeat(8188)+'.png');
 assert.equal(mediaPreviewPath(`![[${'a'.repeat(8189)}.png]]`),undefined);
});
