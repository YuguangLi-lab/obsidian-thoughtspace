import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const directory=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(directory,'../..');
await mkdir(directory,{recursive:true});
const result=await build({entryPoints:[path.join(directory,'harness.ts')],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'});
const styles=await readFile(path.join(root,'styles.css'),'utf8');
const screenshot=await readFile(path.join(root,'qa/online-board-capture/640x460-light-synced.png'));
const base=`*{box-sizing:border-box}body{margin:0;font:14px Arial,sans-serif;color:#24272b;background:#f2f4f5;--font-interface:Arial,sans-serif;--font-text:Arial,sans-serif;--background-primary:#fff;--background-secondary:#f5f6f7;--background-modifier-border:#cbd1d4;--text-normal:#24272b;--text-muted:#616b70;--text-faint:#7a858a;--interactive-accent:#237f69}header{padding:14px 24px;background:white;border-bottom:1px solid #ccd3d6}h1{font-size:16px;margin:0}header p{margin:6px 0 0;font-size:12px;color:#657075}.ts-root{display:block!important;width:100%;height:auto;overflow:visible;background:transparent}.ts-main{display:block}.qa-canvas{position:relative;margin:24px}.ts-world{position:absolute;transform-origin:0 0}.ts-node{position:absolute;display:flex;flex-direction:column;--ts-tone:#b6584a;--ts-tint:#d8e5e2;--ts-line:#cad3d0}.ts-node.ts-section{z-index:0!important;background:#e5ebe850!important;border:1px solid #b6584a!important;border-radius:8px!important}.ts-node:not(.ts-section){z-index:1;background:#fff!important}.ts-node .ts-node-header{padding:8px 12px!important;height:36px!important;min-height:36px;font-size:13px;line-height:20px}.ts-node.ts-text .ts-text-body{padding:12px 18px;font-size:16px;line-height:1.7;white-space:normal}.ts-text-body h3{font-size:17px;line-height:1.5;margin:10px 0}.ts-text-body p{margin:10px 0}.qa-audio{margin:14px;padding:10px;border-top:3px solid #2c8670;color:#435d58}.qa-paper{margin:0 10px 10px;padding:6px 14px;background:white;border:1px solid #e0e5e3;font-size:11px;color:#36434b}.qa-paper h4{margin:8px 0}.qa-paper p{margin:8px 0}.ts-edges{z-index:0}.ts-compact-fold-row{padding:8px 12px;overflow:hidden;white-space:nowrap}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}),reports=[];
try{
 for(const [width,height,scale]of [[1280,900,.5],[1280,900,1],[1280,900,1.5],[390,844,.5]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent(`<html><head><meta charset="utf-8"><style>${styles}\n${base}</style></head><body><header><h1>展开自动让位 · 合成验收场景</h1><p>真实布局算法与样式；模拟节点与测量数据，并非用户仓库截图。</p></header><main class="ts-root"><div class="ts-main"><div class="qa-canvas"><div class="ts-world"></div></div></div></main></body></html>`);
  await page.evaluate(image=>{window.fixtureImage=image;},'data:image/png;base64,'+screenshot.toString('base64'));
  await page.addScriptTag({content:result.outputFiles[0].text});await page.evaluate(scale=>window.expansionFixture.setScale(scale),scale);
  const original=await page.evaluate(()=>window.expansionFixture.snapshot());
  await page.evaluate(()=>window.expansionFixture.expand(true));const legacy=await page.evaluate(()=>window.expansionFixture.snapshot());assert.ok(legacy.overlaps.length>0,'fixture must reproduce original overlap');
  if(width===1280&&scale===.5)await page.screenshot({path:path.join(directory,'before-overlap.png'),fullPage:true});
  await page.evaluate(()=>{window.expansionFixture.reset();window.expansionFixture.expand();});const expanded=await page.evaluate(()=>window.expansionFixture.snapshot());
  assert.deepEqual(expanded.overlaps,[]);assert.deepEqual(expanded.membership,original.membership);assert.deepEqual(expanded.unrelated,original.unrelated);
  if(width===1280&&scale===.5)await page.screenshot({path:path.join(directory,'after-expansion.png'),fullPage:true});
  await page.evaluate(()=>window.expansionFixture.measure());const measured=await page.evaluate(()=>window.expansionFixture.snapshot());
  assert.deepEqual(measured.overlaps,[]);assert.deepEqual(measured.membership,original.membership);assert.equal(measured.outsideCaptured,false);
  await page.evaluate(()=>window.expansionFixture.undo());const undone=await page.evaluate(()=>window.expansionFixture.snapshot());assert.deepEqual(undone.board,original.board);
  await page.evaluate(()=>window.expansionFixture.redo());const redone=await page.evaluate(()=>window.expansionFixture.snapshot());assert.deepEqual(redone.board,measured.board);
  await page.screenshot({path:path.join(directory,`${width}-zoom-${scale}-measured.png`),fullPage:true});assert.deepEqual(errors,[]);
  reports.push({width,height,scale,legacyOverlaps:legacy.overlaps,expandedOverlaps:expanded.overlaps,measuredOverlaps:measured.overlaps,membership:measured.membership,undoRestored:true,redoRestored:true,errors,passed:true});await page.close();
 }
}finally{await browser.close();}
await writeFile(path.join(directory,'report.json'),JSON.stringify({limits:'Synthetic board DOM, production reflow/fold/history/connection functions and CSS. Not a live Obsidian vault. Mobile checks canvas coordinates, not a different responsive layout.',reports},null,2));
console.log(JSON.stringify(reports,null,2));
