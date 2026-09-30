const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {buildSync} = require('esbuild');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const output = path.resolve(process.env.QA_OUTPUT || 'dist/card-hover-fade');
const stylesheet = path.resolve(process.env.QA_CSS || 'styles.css');
const hover = buildSync({entryPoints: ['src/card-control-hover.ts'], bundle: true, write: false, format: 'iife', globalName: 'hoverControls'}).outputFiles[0].text;
const report = {scope: 'Chrome hit testing with production CSS and hover lifecycle; positioned neighboring-card fixture, not an Obsidian end-to-end test.', checks: []};
const check = (name, actual, expected) => {
  report.checks.push({name, actual, expected, passed: JSON.stringify(actual) === JSON.stringify(expected)});
};

(async () => {
  fs.mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const page = await browser.newPage({viewport: {width: 2100, height: 1200}});
    for (const zoom of [0.5, 1, 2]) {
      await page.setContent('<!doctype html><html><body><div class="ts-root"><div class="ts-main"><div class="ts-world"></div></div></div></body></html>');
      await page.addStyleTag({content: fs.readFileSync(stylesheet, 'utf8')});
      await page.addStyleTag({content: ':root{--background-primary:white;--background-secondary:#eee;--text-normal:#222;--text-muted:#555;--background-modifier-border:#999;--font-text:Arial;--font-interface:Arial;--ts-accent:#277869}body{margin:0}.ts-root,.ts-main{width:2100px;height:1200px;position:relative}'});
      await page.addScriptTag({content: hover});
      await page.evaluate(zoom => {
        const world = document.querySelector('.ts-world');
        world.style.cssText = `transform:scale(${zoom});transform-origin:0 0;`;
        window.probeCounts = {underlying: 0, action: 0};
        for (const [id, x] of [['underlying', 100], ['owner', 600]]) {
          const card = document.createElement('div');
          card.className = 'ts-node ts-card'; card.dataset.id = id;
          card.style.cssText = `position:absolute;left:${x}px;top:200px;width:300px;height:200px;--ts-control-scale:${1 / zoom};--ts-control-top:0px;--ts-control-right:500px;`;
          const content = document.createElement('div');
          content.textContent = id; card.append(content); world.append(card);
          if (id === 'underlying') {
            card.addEventListener('pointerdown', () => { window.probeCounts.underlying++; });
            continue;
          }
          const dock = document.createElement('div'); dock.className = 'ts-card-actions'; card.append(dock);
          for (const [index, label] of ['Edit', 'Read', 'Preview', 'Fit', 'Fold'].entries()) {
            const button = document.createElement('button');
            button.className = `ts-icon-button${index < 2 ? ' ts-card-action-primary' : ''}`;
            button.type = 'button'; button.dataset.action = label;
            button.textContent = label;
            button.addEventListener('click', () => { window.probeCounts.action++; });
            dock.append(button);
          }
          window.hoverDispose = hoverControls.mountCardControlHover(card);
        }
      }, zoom);
      const owner = page.locator('[data-id="owner"]'), body = await owner.boundingBox();
      assert.ok(body);
      const approach = async () => {
        await page.mouse.move(body.x + body.width / 2, body.y + body.height / 2);
        await page.waitForFunction(() => document.querySelector('[data-id="owner"]').classList.contains('is-control-hover'));
        await page.waitForTimeout(140);
      };
      await approach();
      const action = await owner.locator('[data-action="Read"]').boundingBox(); assert.ok(action);
      const point = {x: action.x + action.width / 2, y: action.y + action.height / 2};
      const overBody = await page.locator('[data-id="underlying"]').evaluate((node, point) => {
        const rect = node.getBoundingClientRect(); return point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
      }, point);
      check(`zoom ${zoom}: action overlaps the neighboring body`, overBody, true);
      await page.mouse.click(point.x, point.y);
      check(`zoom ${zoom}: deliberately approached action remains clickable`, await page.evaluate(() => probeCounts), {underlying: 0, action: 1});
      await page.locator('body').click({position: {x: 2000, y: 1100}});
      await approach();
      await page.mouse.move(2000, 1100);
      await page.waitForFunction(() => !document.querySelector('[data-id="owner"]').classList.contains('is-control-hover'));
      const fade = await page.evaluate(point => {
        const owner = document.querySelector('[data-id="owner"]'), dock = owner.querySelector('.ts-card-actions'), style = getComputedStyle(dock);
        return {hover: owner.matches(':hover'), pointerEvents: style.pointerEvents, visibility: style.visibility, opacity: style.opacity, hit: document.elementFromPoint(point.x, point.y)?.closest('.ts-node')?.dataset.id};
      }, point);
      check(`zoom ${zoom}: departed card is no longer hovered`, fade.hover, false);
      check(`zoom ${zoom}: fading dock cannot intercept input`, fade.pointerEvents, 'none');
      check(`zoom ${zoom}: fading dock does not cover neighbor hit target`, fade.hit, 'underlying');
      report.checks.push({name: `zoom ${zoom}: fade timing evidence`, passed: true, actual: fade});
      await page.mouse.click(point.x, point.y);
      check(`zoom ${zoom}: first click reaches the neighboring card`, await page.evaluate(() => probeCounts), {underlying: 1, action: 1});
      await page.evaluate(() => window.hoverDispose());
      for (const visibleState of ['is-selected', 'is-folded']) {
        const events = await owner.evaluate((node, state) => {
          node.classList.add(state); const events = getComputedStyle(node.querySelector('.ts-card-actions')).pointerEvents;
          node.classList.remove(state); return events;
        }, visibleState);
        check(`zoom ${zoom}: ${visibleState} dock stays interactive`, events, 'auto');
      }
      await owner.evaluate(node => node.classList.add('is-selected'));
      await owner.locator('[data-action="Read"]').focus();
      await owner.evaluate(node => node.classList.remove('is-selected'));
      check(`zoom ${zoom}: keyboard-focused dock stays interactive`, await owner.evaluate(node => getComputedStyle(node.querySelector('.ts-card-actions')).pointerEvents), 'auto');
    }
    const touch = await browser.newPage({viewport: {width: 800, height: 600}, hasTouch: true});
    await touch.setContent('<!doctype html><html><body><div class="ts-root"><div class="ts-main"><div class="ts-world"><div class="ts-node ts-card" style="left:100px;top:200px;width:300px;height:200px"><div class="ts-card-actions"><button class="ts-icon-button">Read</button></div></div></div></div></div></body></html>');
    await touch.addStyleTag({content: fs.readFileSync(stylesheet, 'utf8')});
    await touch.addStyleTag({content: 'body{margin:0}.ts-root,.ts-main{width:800px;height:600px;position:relative}'});
    await touch.evaluate(() => { window.taps = 0; document.querySelector('button').onclick = () => window.taps++; });
    check('touch fixture uses the non-hover controls', await touch.evaluate(() => matchMedia('(hover:none)').matches), true);
    check('non-hover dock stays interactive', await touch.locator('.ts-card-actions').evaluate(node => getComputedStyle(node).pointerEvents), 'auto');
    const target = await touch.locator('button').boundingBox(); assert.ok(target);
    await touch.touchscreen.tap(target.x + target.width / 2, target.y + target.height / 2);
    check('touch action responds on the first tap', await touch.evaluate(() => taps), 1);
    await touch.close();
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const failed = report.checks.filter(check => !check.passed);
  console.log(JSON.stringify({passed: report.checks.length - failed.length, failed: failed.length, output}));
  failed.forEach(check => console.error(JSON.stringify(check)));
  if (failed.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
