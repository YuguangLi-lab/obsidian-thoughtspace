import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const directory=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(directory,'../..');
await mkdir(directory,{recursive:true});
const result=await build({entryPoints:[path.join(directory,'harness.ts')],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',external:['@electron/remote','electron','node:https'],plugins:[{name:'obsidian-test-icons',setup(build){build.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export function setIcon(el,name){el.dataset.icon=name;el.textContent=({play:'▶',pause:'Ⅱ',camera:'▣','bookmark-plus':'⚑','rotate-cw':'↻'})[name]||'○';}`,loader:'js'}));}}]});
const styles=await readFile(path.join(root,'styles.css'),'utf8');
const currentCss=await readFile(path.join(root,'src/online-board-player.css'),'utf8');
const chromeCss=await readFile(path.join(root,'src/object-chrome.css'),'utf8');
const previewCss=await readFile(path.join(root,'src/online-preview.css'),'utf8');
const base=`*{box-sizing:border-box}body{margin:0;padding:32px;background:#eef1f5;color:#24272b;font:14px Arial,sans-serif;--font-interface:Arial,sans-serif;--font-text:Arial,sans-serif;--font-monospace:monospace;--background-primary:#fff;--background-secondary:#f0f2f5;--background-modifier-border:#d7dbe1;--background-modifier-hover:#e3e7ed;--text-normal:#24272b;--text-muted:#646d7c;--text-faint:#8891a0;--text-accent:#23734f;--interactive-accent:#327757}.theme-dark{background:#13151a;--background-primary:#24272b;--background-secondary:#30353b;--background-modifier-border:#4c515a;--background-modifier-hover:#3e444c;--text-normal:#edf0f3;--text-muted:#bbc2cb;--text-faint:#949ca8;--text-accent:#82ceaf}button{cursor:pointer}h1{font-size:16px;line-height:24px;margin:0 0 18px}p.fixture-note{max-width:660px;font-size:12px;color:#687485}.theme-dark .fixture-note{color:#bdc4cd}.ts-root{position:relative}.ts-world{position:relative;transform:none}.ts-world>#card{position:relative;left:auto;top:auto;box-shadow:0 0 0 1px #b9c2ce!important}.test-video-frame{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;padding:12px;text-align:center;background:#314653;color:#f0f3f6;font-size:12px;overflow:hidden}.test-video-frame strong{font-size:14px}.ts-online-board-player__icon{align-items:center;justify-content:center;font:16px Arial,sans-serif}`;
const nativeBaseline='.theme-dark{color:var(--text-normal)}button{color:var(--text-normal)}.test-video-frame{container-type:size}@container(max-height:80px){.test-video-frame span{display:none}.test-video-frame strong{font-size:12px}}';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const reports=[];
try{
 for(const [width,height,theme]of [[640,460,'light'],[320,300,'light'],[200,220,'light'],[320,300,'dark']]){
  const page=await browser.newPage({viewport:{width:Math.max(760,width+80),height:Math.max(640,height+160)},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent(`<html><head><meta charset="utf-8"><style>${styles}\n${chromeCss}\n${previewCss}\n${currentCss}\n${base}\n${nativeBaseline}</style></head><body class="theme-${theme}"><h1>Online Board Capture · ${width} × ${height} · ${theme}</h1><p class="fixture-note">Engineering fixture: actual card/player UI and CSS; synthetic platform and icons. No real account or online video.</p><main class="ts-root"><div class="ts-world"><div id="card" class="ts-node ts-text" style="width:${width}px;height:${height}px"></div></div></main></body></html>`);
  await page.addScriptTag({content:result.outputFiles[0].text});
  const initial=await page.evaluate(()=>({loads:window.fixture.loads,timestampDisabled:document.querySelector('[aria-label="记下此刻"]').disabled,screenshotDisabled:document.querySelector('[aria-label="截取画面"]').disabled}));
  await page.getByRole('button',{name:'加载视频',exact:true}).click();
  await page.getByRole('button',{name:'记下此刻',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.saves.length===1&&document.querySelector('.ts-online-board-player__status').textContent.includes('已保存'));
  await page.getByRole('button',{name:'截取画面',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.saves.length===2);
  await page.screenshot({path:path.join(directory,`${width}x${height}-${theme}-synced.png`)});
  await page.evaluate(()=>{window.fixture.failSave=true;});
  await page.getByRole('button',{name:'截取画面',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.failures===1);
  const geometry=await page.evaluate(()=>{
   const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   const card=rect(document.querySelector('#card')),surface=rect(document.querySelector('.ts-online-board-player__surface')),footer=rect(document.querySelector('.ts-online-board-player__footer')),status=rect(document.querySelector('.ts-online-board-player__status'));
   const buttons=[...document.querySelectorAll('#card button')].filter(el=>el.getBoundingClientRect().height>0).map(el=>({label:el.getAttribute('aria-label'),...rect(el)}));
   return{card,surface,footer,status,buttons,outside:buttons.filter(r=>r.x<card.x-.5||r.right>card.right+.5||r.y<card.y-.5||r.bottom>card.bottom+.5),overlap:surface.bottom>footer.y+.5,statusOutside:status.bottom>card.bottom+.5,cardScrollWidth:document.querySelector('#card').scrollWidth,cardClientWidth:document.querySelector('#card').clientWidth};
  });
  await page.screenshot({path:path.join(directory,`${width}x${height}-${theme}-retry.png`)});
  await page.evaluate(()=>{window.fixture.failSave=false;});
  await page.getByRole('button',{name:'重试保存',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.saves.length===4&&!document.querySelector('[aria-label="记下此刻"]').disabled);
  const saves=await page.evaluate(()=>window.fixture.saves);
  reports.push({width,height,theme,initial,errors,geometry,saves,retrySameId:saves[2].id===saves[3].id,passed:initial.loads===0&&initial.timestampDisabled&&initial.screenshotDisabled&&errors.length===0&&geometry.outside.length===0&&!geometry.overlap&&!geometry.statusOutside&&geometry.surface.height>=40&&geometry.cardScrollWidth<=geometry.cardClientWidth+1&&saves[2].id===saves[3].id});
  await page.close();
 }
}finally{await browser.close();}
await writeFile(path.join(directory,'layout-report.json'),JSON.stringify({limits:'Synthetic Playwright browser fixture; real module, web-card integration and stylesheet. No Obsidian Electron guest, real video, authentication, or cross-origin capture validation.',reports},null,2));
console.log(JSON.stringify(reports.map(({width,height,theme,passed,geometry,errors})=>({width,height,theme,passed,outside:geometry.outside,overlap:geometry.overlap,statusOutside:geometry.statusOutside,errors})),null,2));
if(reports.some(report=>!report.passed))process.exitCode=1;
