const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:900,height:620}});
    const css = fs.readFileSync(path.join(__dirname,'../../styles.css'),'utf8');
    const table = '<div class="ts-text-body markdown-rendered"><div class="ts-text-markdown"><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div></div>';
    const native = '<div class="ts-inline-editor"><div class="ts-inline-native"><div class="cm-scroller"><div class="cm-table-widget"><table><tr><td>A</td><td>B</td></tr></table></div></div></div></div>';
    await page.setContent(`<style>:root{--text-normal:#222;--text-muted:#666;--background-primary:#fff;--background-secondary:#eee;--background-modifier-border:#bbb;--interactive-accent:#087e64;--font-text:Arial;--font-interface:Arial;--ts-accent:#087e64;--ts-paper:#fff}body{margin:0}.ts-root{width:900px;height:620px}.ts-main{height:100%}.ts-world{width:900px!important;height:620px!important}.cm-scroller{scrollbar-gutter:stable}.cm-table-widget{margin-inline:-16px}</style><style>${css}</style><div class="ts-root"><div class="ts-main"><div class="ts-world">
      <div id="selected" class="ts-node ts-text is-table-card is-selected" style="left:70px;top:70px;width:260px;height:160px">${table}</div>
      <div id="editing" class="ts-node ts-text is-table-card is-inline-editing" style="left:390px;top:70px;width:260px;height:160px">${table}${native}</div>
      <div id="filled" class="ts-node ts-text is-table-card is-selected has-card-fill" style="--ts-card-fill:#e97aab;left:70px;top:300px;width:260px;height:160px">${table}</div>
      <div id="text" class="ts-node ts-text is-selected" style="left:390px;top:300px;width:260px;height:160px"><div class="ts-text-body">Regular text</div></div>
    </div></div></div>`);
    const rows = await page.evaluate(() => ['selected','editing','filled','text'].map(id => {
      const el = document.getElementById(id),style = getComputedStyle(el),cell = el.querySelector('td'),cellStyle = cell && getComputedStyle(cell);
      return {id,outline:style.outlineStyle,outlineWidth:style.outlineWidth,border:style.borderTopWidth,shadow:style.boxShadow,cellBorder:cellStyle?.borderTopWidth,cellBorderStyle:cellStyle?.borderTopStyle};
    }));
    console.log(JSON.stringify(rows,null,2));
    for (const row of rows.filter(row=>row.id!=='text')) {
      assert.ok(row.outline==='none'||row.outlineWidth==='0px',`${row.id}: table must not gain an outer selection/edit outline`);
      assert.equal(row.border,'0px',`${row.id}: table outer border`);
      assert.equal(row.shadow,'none',`${row.id}: table outer shadow`);
      assert.equal(row.cellBorder,'1px',`${row.id}: cell grid remains visible`);
      assert.equal(row.cellBorderStyle,'solid',`${row.id}: cell grid remains solid`);
    }
    const text = rows.find(row=>row.id==='text');
    assert.equal(text.outline,'solid','ordinary text keeps its selection outline');
    assert.notEqual(text.outlineWidth,'0px','ordinary text selection remains visible');
    const nativeStyle = await page.evaluate(() => ({
      margin:getComputedStyle(document.querySelector('#editing .cm-table-widget')).marginLeft,
      gutter:getComputedStyle(document.querySelector('#editing .cm-scroller')).scrollbarGutter
    }));
    assert.deepEqual(nativeStyle,{margin:'0px',gutter:'auto'},'native table uses the full unclipped editor width');
    console.log('PASS: borderless table surfaces preserve their grid and ordinary text selection');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
