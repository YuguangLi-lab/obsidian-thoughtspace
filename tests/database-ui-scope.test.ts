import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';

test('library presentation cannot target the settings page, board or host outside its dialog',()=>{
 const source=readFileSync('src/workflow.css','utf8');
 const block=source.match(/\/\* BEGIN library-only presentation[\s\S]*?\/\* END library-only presentation \*\//)?.[0];
 assert.ok(block,'Library presentation must retain an auditable ownership boundary');
 let rules=0;postcss.parse(block).walkRules(rule=>{rules++;for(const selector of rule.selectors)assert.match(selector,/^\.ts-database-modal\.ts-ui-modal(?:[\s.:\[]|$)/,selector);});
 assert.ok(rules>0);
 postcss.parse(block).walkDecls(decl=>assert.ok(!decl.prop.startsWith('--'),'Library presentation must consume the shared palette rather than replace it'));
});
