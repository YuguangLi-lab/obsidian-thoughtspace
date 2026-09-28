import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {webUrl} from '../src/web-card';
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('  private handleBoardPaste('),end=source.indexOf('  private handleBoardDrop(',start);
const View=new Function('webUrl','isImage','act',transformSync(`class View{${source.slice(start,end)}};return View`,{loader:'ts'}).code)(webUrl,(name:string)=>name.endsWith('.png'),(fn:()=>void)=>fn());
function paste(text:string,editing=false,files:any[]=[]){const v=new View(),calls:any[]=[];Object.assign(v,{addWebCard:(...args:any[])=>calls.push(['web',...args]),pasteTexts:(...args:any[])=>calls.push(['text',...args]),importImages:(...args:any[])=>calls.push(['images',...args])});let prevented=false;v.handleBoardPaste({target:{closest:()=>editing?{}:null},clipboardData:{files,getData:(format:string)=>format==='text/plain'?text:''},preventDefault:()=>prevented=true});return {calls,prevented};}
test('pasting a webpage on a canvas child creates one webpage card',()=>{assert.deepEqual(paste('https://example.com/'),{calls:[['web','https://example.com/']],prevented:true});});
test('pasting Markdown and mixed text stays ordinary text',()=>{assert.deepEqual(paste('https://example.com/\nMy notes').calls,[['text','https://example.com/\nMy notes',false]]);});
test('native editor keeps text and image paste without creating extra board objects',()=>{assert.deepEqual(paste('https://example.com/',true),{calls:[],prevented:false});assert.deepEqual(paste('',true,[{name:'a.png'}]),{calls:[],prevented:false});});
test('image clipboard keeps image import precedence',()=>{assert.equal(paste('https://example.com/',false,[{name:'a.png'}]).calls[0][0],'images');});
