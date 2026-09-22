import {test} from 'node:test';
import assert from 'node:assert/strict';
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
