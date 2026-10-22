import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import postcss from 'postcss';
const css=readFileSync('src/reading-workspace.css','utf8'),ast=postcss.parse(css),rules:postcss.Rule[]=[];ast.walkRules(r=>{rules.push(r);});
const declarations=(selector:string)=>{const r=rules.find(r=>r.selector===selector);assert(r,selector);return Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));};
test('only the compact plugin header is removed; authored heading typography and body sizes remain native',()=>{
 const hidden=rules.filter(r=>r.selector.includes('ts-reading-page-head')&&r.nodes.some(n=>n.type==='decl'&&n.prop==='display'&&n.value==='none'));assert.equal(hidden.length,1);assert.equal(hidden[0].selector,'.ts-reading-desk[data-reading-compact=true] .ts-reading-page-head');
 const targeted=rules.filter(r=>r.selector.includes('.ts-reading-prose')&&r.selector.includes('h1'));assert.equal(targeted.length,1);assert(targeted[0].selector.endsWith('[tabindex="-1"]:focus'));for(const n of targeted[0].nodes)if(n.type==='decl')assert(!['display','font','font-size','line-height','margin','padding','height','max-height','overflow'].includes(n.prop));assert.equal(declarations('.ts-reading-prose')['font-size'],'var(--ts-reading-size,16px)');
});
test('compact summary keeps a 44px real target while only its visible title line truncates',()=>{
 assert.equal(declarations('.ts-reading-desk .ts-reading-compact-controls>summary')['min-height'],'44px');assert.equal(declarations('.ts-reading-desk .ts-reading-compact-current')['text-overflow'],'ellipsis');
 const panel=declarations('.ts-reading-desk .ts-reading-compact-article');assert.equal(panel['overflow-wrap'],'anywhere');assert.equal(panel['max-height'],undefined);assert.equal(panel.overflow,undefined);assert.equal(panel['white-space'],undefined);
});
test('actual programmatic heading focus gets a scoped inward solid ring without relying on focus-visible or clipped outside paint',()=>{
 const selector='.ts-reading-desk .ts-reading-prose :is(h1,h2,h3,h4,h5,h6)[tabindex="-1"]:focus',r=declarations(selector);assert.equal(r.outline,'2px solid var(--ts-e-editorial,var(--interactive-accent))');assert.equal(r['outline-offset'],'-2px');assert.equal(r.animation,undefined);assert.equal(r.transition,undefined);
 assert.equal(declarations('.ts-reading-page')['scroll-padding-block'],'24px');
});
