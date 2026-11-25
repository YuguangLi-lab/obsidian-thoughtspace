import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import {CALENDAR_SCOPE_PARAMS,isolateBoardStyles} from '../scripts/isolate-board-styles.mjs';

function inCalendarScope(rule:postcss.Rule):boolean {
 let current:postcss.AnyNode|postcss.Document|undefined=rule.parent;
 while(current){
  if(current.type==='atrule'&&(current as postcss.AtRule).name==='scope'&&(current as postcss.AtRule).params===CALENDAR_SCOPE_PARAMS)return true;
  current=current.parent;
 }
 return false;
}
function rulesInfo(css:string){
 const out:{selector:string;scoped:boolean}[]=[];
 postcss.parse(css).walkRules(r=>{out.push({selector:r.selector,scoped:inCalendarScope(r)});});
 return out;
}

test('calendar boundary wraps shared class selectors in @scope (:root) to (.ts-calendar-plugin)',()=>{
 assert.deepEqual(rulesInfo(isolateBoardStyles('.ts-ui-modal,.ts-task-row button {color:red}')),[
  {selector:'.ts-ui-modal,.ts-task-row button',scoped:true},
 ]);
});

test('nested selector lists remain intact instead of splitting on inner commas',()=>{
 const output=isolateBoardStyles('.theme-dark :is(.ts-root,.ts-ui-modal) :is(button,input):hover {color:red}');
 const info=rulesInfo(output);
 assert.equal(info.length,1);
 assert.equal(info[0].scoped,true);
 const ast=selectorParser().astSync(info[0].selector);
 assert.equal(ast.nodes.length,1);
});

test('pseudo-elements stay inside the calendar @scope without per-selector bloat',()=>{
 assert.deepEqual(rulesInfo(isolateBoardStyles('.ts-task-row::before,.ts-task-row:after{content:""}')),[
  {selector:'.ts-task-row::before,.ts-task-row:after',scoped:true},
 ]);
});

test('repeated production builds do not grow or nest duplicate @scope blocks',()=>{
 const once=isolateBoardStyles('/* source */ @media(max-width:600px){.ts-task-row{color:red!important}}');
 assert.equal(isolateBoardStyles(once),once);
});

test('animations and unrelated native rules are not rewritten',()=>{
 const css='@keyframes pulse{from{opacity:0}to{opacity:1}} .workspace-leaf{color:red}';
 assert.equal(isolateBoardStyles(css),css);
});

test('a mixed rule keeps native selectors outside @scope while isolating plugin selectors',()=>{
 const info=rulesInfo(isolateBoardStyles('.ts-task-row,button.native{color:red}'));
 assert.deepEqual(info,[
  {selector:'button.native',scoped:false},
  {selector:'.ts-task-row',scoped:true},
 ]);
});

test('an embedded calendar under the board root stays excluded while sealed surfaces stay unscoped',()=>{
 const css=isolateBoardStyles('.ts-root button{color:red}.ts-root .ts-card-preview button{color:red}.ts-writing button{color:blue}.ts-handwriting .ts-node{color:green}.ts-journal button{color:navy}');
 const info=rulesInfo(css);
 assert.deepEqual(info.map(item=>[item.selector,item.scoped]),[
  ['.ts-root button',true],
  ['.ts-root .ts-card-preview button',true],
  ['.ts-writing button',false],
  ['.ts-handwriting .ts-node',true],
  ['.ts-journal button',true],
 ]);
});

test('built styles isolate board rules with @scope, inline vector paper grain, and avoid legacy PNG bloat',()=>{
 const css=readFileSync('styles.css','utf8'),root=postcss.parse(css);
 assert.ok(Buffer.byteLength(css,'utf8')<1_000_000,`expected compact styles.css, got ${Buffer.byteLength(css,'utf8')} bytes`);
 assert.equal(css.includes(':not(:where(.ts-calendar-plugin, .ts-calendar-plugin *))'),false);
 let boardRules=0,sealedRules=0;
 root.walkRules(rule=>{
  if(rule.parent?.type==='atrule'&&/keyframes$/i.test(rule.parent.name))return;
  for(const selector of rule.selectors){
   if(selector.includes('.ts-root')&&selector.includes('.ts-')){
    boardRules++;
    assert.equal(inCalendarScope(rule),true,selector.slice(0,220));
   }
   if(/(?:^|[\s>+~,(])\.ts-writing(?![\w-])/.test(selector)&&!/(?:^|[\s>+~,(])\.ts-(?:root|journal|ui-modal|node|card-preview|world|stage|main)(?![\w-])/.test(selector)){
    sealedRules++;
    assert.equal(inCalendarScope(rule),false,selector.slice(0,220));
   }
  }
 });
 assert.ok(boardRules>100);
 assert.ok(sealedRules>20);
 let grainValue='';
 root.walkDecls('--ts-paper-grain-image',decl=>{grainValue=decl.value;});
 assert.match(grainValue,/^url\(["']?data:image\/svg\+xml,/);
 assert.match(grainValue,/feTurbulence/);
});
