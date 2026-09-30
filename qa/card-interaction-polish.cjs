// Run with the bundled Playwright runtime; only this isolated Chrome is opened.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const output = path.resolve(process.env.QA_OUTPUT || 'dist/card-interaction-polish');
const cssPath = path.resolve(process.env.QA_CSS || 'styles.css');
const styles = ['solid', 'band', 'paper', 'index', 'sticky'];
const states = ['', 'is-compact-fold', 'ts-node-summary', 'is-inline-editing', 'has-custom-border'];
const results = [];
const verify = (name, actual, expected) => {
  try { assert.deepEqual(actual, expected); results.push({name, passed: true}); }
  catch { results.push({name, passed: false, actual, expected}); }
};

(async () => {
  fs.mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1100}});
    await page.setContent('<!doctype html><html><body><div class="ts-root"><div class="ts-main"><div class="ts-world"></div></div></div></body></html>');
    await page.addStyleTag({content: fs.readFileSync(cssPath, 'utf8')});
    // Host theme variables only. Card paint and pseudo-elements use production CSS.
    await page.addStyleTag({content: `
      :root { --background-primary:#fff; --background-secondary:#f4f5f6;
        --background-modifier-border:#aab1b7; --text-normal:#222; --text-muted:#555;
        --text-faint:#737373; --font-interface:Arial; --font-text:Arial;
        --interactive-accent:#267769; --text-on-accent:#fff; --ts-tone:#267769; }
      body.theme-dark { --background-primary:#252525; --background-secondary:#303030;
        --background-modifier-border:#777; --text-normal:#eee; --text-muted:#ccc; --text-faint:#aaa; }
      body { margin:0; background:var(--background-secondary); }
      .ts-root { height:1100px; } .ts-main { height:1100px; width:1440px; }
    `});
    await page.evaluate(({styles, states}) => {
      const world = document.querySelector('.ts-world');
      styles.forEach((style, column) => states.forEach((state, row) => {
        const card = document.createElement('div');
        card.className = `ts-node ts-card is-locked ${state}`;
        card.dataset.probe = `${style}/${state || 'normal'}`;
        if (style !== 'solid') card.dataset.cardStyle = style;
        card.style.cssText = `position:absolute;left:${20 + column * 280}px;top:${30 + row * 200}px;width:250px;height:160px;`;
        const heading = document.createElement('div');
        heading.className = 'ts-node-header';
        heading.textContent = card.dataset.probe;
        card.append(heading);
        world.append(card);
      }));
    }, {styles, states});

    for (const theme of ['theme-light', 'theme-dark']) {
      await page.locator('body').evaluate((body, theme) => { body.className = theme; }, theme);
      const locked = await page.locator('[data-probe]').evaluateAll(nodes => nodes.map(node => {
        const label = getComputedStyle(node, '::after'), before = getComputedStyle(node, '::before');
        const decoration = before.content === '""' && before.borderTopWidth === '1px' ? before : label;
        return {name: node.dataset.probe, label: label.content, labelEvents: label.pointerEvents,
          decoration: decoration.content, border: decoration.borderTopWidth,
          decorationEvents: decoration.pointerEvents};
      }));
      for (const row of locked) {
        verify(`${theme}/${row.name}: lock remains visible`, row.label, '"\u9501\u5b9a"');
        verify(`${theme}/${row.name}: lock does not intercept input`, row.labelEvents, 'none');
        if (row.name.startsWith('paper/')) {
          verify(`${theme}/${row.name}: paper border remains painted`, row.decoration === '""' && row.border === '1px', true);
          verify(`${theme}/${row.name}: paper border does not intercept input`, row.decorationEvents, 'none');
        }
      }
      await page.screenshot({path: path.join(output, `${theme}.png`)});
    }

    await page.locator('[data-probe]').evaluateAll(nodes => nodes.forEach(node => node.classList.remove('is-locked')));
    const unlocked = await page.locator('[data-probe]').evaluateAll(nodes => nodes.map(node => ({name: node.dataset.probe, label: getComputedStyle(node, '::after').content})));
    for (const row of unlocked) verify(`${row.name}: unlocked cards do not retain a lock`, row.label.includes('\u9501\u5b9a'), false);
  } finally {
    await browser.close();
  }
  const report = {cssPath, passed: results.filter(row => row.passed).length, failed: results.filter(row => !row.passed).length, results};
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({passed: report.passed, failed: report.failed, output}));
  for (const row of results.filter(row => !row.passed)) console.error(JSON.stringify(row));
  if (report.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
