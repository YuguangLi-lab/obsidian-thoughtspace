import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import {isolateBoardStyles} from '../scripts/isolate-board-styles.mjs';
const guard=':not(:where(.ts-calendar-plugin, .ts-calendar-plugin *))';
function selectors(css:string){const result:string[]=[];postcss.parse(css).walkRules(r=>{result.push(r.selector);});return result;}
test('calendar boundary protects every shared class selector, including modal roots',()=>{
 assert.deepEqual(selectors(isolateBoardStyles('.ts-ui-modal,.ts-task-row button {color:red}')),['.ts-ui-modal'+guard+',.ts-task-row button'+guard]);
});
test('nested selector lists remain intact instead of splitting on inner commas',()=>{
 const output=isolateBoardStyles('.theme-dark :is(.ts-root,.ts-ui-modal) :is(button,input):hover {color:red}');
 const ast=selectorParser().astSync(selectors(output)[0]);assert.equal(ast.nodes.length,1);assert.equal(ast.first.last?.toString(),guard);
});
test('pseudo-elements receive the exclusion on their originating element',()=>{
 assert.deepEqual(selectors(isolateBoardStyles('.ts-task-row::before,.ts-task-row:after{content:""}')),['.ts-task-row'+guard+'::before,.ts-task-row'+guard+':after']);
});
test('repeated production builds do not grow or duplicate the boundary',()=>{
 const once=isolateBoardStyles('/* source */ @media(max-width:600px){.ts-task-row{color:red!important}}');assert.equal(isolateBoardStyles(once),once);
});
test('animations and unrelated native rules are not rewritten',()=>{
 const css='@keyframes pulse{from{opacity:0}to{opacity:1}} .workspace-leaf{color:red}';assert.equal(isolateBoardStyles(css),css);
});
test('a mixed rule keeps native selectors independent of plugin exclusions',()=>{
 const list=selectorParser().astSync(selectors(isolateBoardStyles('.ts-task-row,button.native{color:red}'))[0]);assert.equal(list.nodes[1].toString(),'button.native');assert.equal(list.first.last?.toString(),guard);
});
test('an embedded calendar under the board root stays excluded while sealed surfaces drop the guard',()=>{
 const css=isolateBoardStyles('.ts-root button{color:red}.ts-root .ts-card-preview button{color:red}.ts-writing button{color:blue}.ts-handwriting .ts-node{color:green}.ts-journal button{color:navy}');
 const rules=selectors(css);
 assert.match(rules[0],/^\.ts-root button:not\(:where\(\.ts-calendar-plugin, \.ts-calendar-plugin \*\)\)$/);
 assert.match(rules[1],/\.ts-card-preview button:not\(:where\(\.ts-calendar-plugin/);
 assert.equal(rules[2].includes('ts-calendar-plugin'),false);
 assert.match(rules[3],/ts-handwriting \.ts-node:not\(:where\(\.ts-calendar-plugin/);
 assert.match(rules[4],/\.ts-journal button:not\(:where\(\.ts-calendar-plugin/);
});
test('built styles keep the embedded calendar out of board rules and the paper texture inline',()=>{
 const css=readFileSync('styles.css','utf8'),root=postcss.parse(css);
 let boardRules=0,sealedRules=0;
 root.walkRules(rule=>{
  if(rule.parent?.type==='atrule'&&/keyframes$/i.test(rule.parent.name))return;
  for(const selector of rule.selectors){
   if(selector.includes('.ts-root')&&selector.includes('.ts-')){boardRules++;assert.ok(selector.includes(guard),selector.slice(0,220));}
   if(/(?:^|[\s>+~,(])\.ts-writing(?![\w-])/.test(selector)&&!/(?:^|[\s>+~,(])\.ts-(?:root|journal|ui-modal|node|card-preview|world|stage|main)(?![\w-])/.test(selector)){sealedRules++;assert.equal(selector.includes('ts-calendar-plugin'),false,selector.slice(0,220));}
  }
 });
 assert.ok(boardRules>100);assert.ok(sealedRules>20);
 const uri=css.match(/--ts-paper-grain-image:\s*url\("([^"]+)"\)/)?.[1]??'';
 assert.ok(uri.startsWith('data:image/png;base64,'));
 assert.equal(createHash('sha256').update(Buffer.from(uri.slice('data:image/png;base64,'.length),'base64')).digest('hex'),'9623418e86d0750c78531574ae61b25cbb32ab413ff4c3eefb10f6745776414b');
});
