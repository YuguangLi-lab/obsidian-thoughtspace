import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
const css=postcss.parse(readFileSync('src/workflow.css','utf8'));
function rule(selector:string){let found:postcss.Rule|undefined;css.walkRules(r=>{if(r.selector===selector)found=r;});assert.ok(found,selector);return found;}
const compact='.ts-writing[data-writing-mode][data-writing-short=true]';
function value(r:postcss.Rule,prop:string){let result='';r.walkDecls(prop,d=>{result=d.value;});return result;}
test('short height rules have no viewport/450px-width gate and remain scoped to owned writing',()=>{
 const header=rule(compact+' .ts-writing-header');assert.equal(header.parent,css);assert.equal(value(header,'grid-template-columns'),'44px minmax(0,1fr)');assert.equal(value(header,'padding'),'4px');assert.equal(rule(compact+' .ts-writing-composer-tools').parent,css);
});
test('short-pane primary actions retain mode44 and generate56x44 while native formatbar stays44',()=>{
 const generate=rule(compact+' .ts-writing-header-actions>.mod-cta');assert.equal(value(generate,'width'),'56px');assert.equal(value(generate,'min-height'),'44px');assert.equal(value(rule(compact+' .ts-writing-header-actions>.ts-writing-mode-menu'),'min-height'),'44px');assert.equal(value(rule('.ts-writing .ts-writing-manuscript>.ts-writing-formatbar'),'min-height'),'44px');
});
test('only duplicate assembly button is hidden; status text, directory and editor remain in layout',()=>{
 assert.equal(value(rule(compact+' .ts-writing-assembly>.ts-writing-button'),'display'),'none');
 const hidden:string[]=[];css.walkRules(r=>{if(r.selector.includes('data-writing-short'))r.walkDecls('display',d=>{if(d.value==='none')hidden.push(r.selector);});});
 assert.equal(hidden.some(s=>/(?:\.ts-writing-context|\.ts-writing-assembly\s*$|\.ts-writing-navigator|\.ts-writing-status|\.cm-|\.ts-inline-native|\.ts-writing-manuscript)/.test(s)),false);
 assert.equal(value(rule(compact+' .ts-writing-status'),'min-height'),'26px');
});
test('tight240px control still has a same-specificity short-pane44px override',()=>{
 let found=false;css.walkRules(r=>{if(r.selector.includes(compact+' .ts-writing-header-actions>.ts-writing-mode-menu')&&r.parent?.type==='atrule'&&(r.parent as postcss.AtRule).params==='ts-writing (max-width:240px)'){assert.equal(value(r,'width'),'44px');assert.equal(value(r,'min-width'),'44px');found=true;}});assert.equal(found,true);
});
