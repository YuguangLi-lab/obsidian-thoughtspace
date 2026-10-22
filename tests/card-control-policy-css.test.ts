import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import {reserveCardControlDocks,cardControlMetrics,type CardControlDockRequest} from '../src/card-control-layout';
import {foldControlObstacles} from '../src/fold-control-obstacles';

const css=postcss.parse(readFileSync('src/object-chrome.css','utf8'));
test('no-hover input cannot expose every full action dock outside the reservation policy',()=>{
 css.walkAtRules('media',media=>{
  if(media.params!=='(hover:none)')return;
  media.walkRules(rule=>assert.ok(!/ts-card-actions|ts-image-actions|ts-fold-actions/.test(rule.selector)));
 });
});
test('touch passive and overscan cards hide their full dock; focused full state and44 entries remain explicit',()=>{
 const rules=new Map<string,postcss.Rule>();css.walkRules(rule=>{rules.set(rule.selector,rule);});
 const passive=rules.get('.ts-root .ts-node[data-touch-controls=true]:not([data-control-display=full]) > .ts-card-actions')!;
 assert.ok(passive);for(const [property,value] of [['opacity','0'],['visibility','hidden'],['pointer-events','none']]){
  const declaration=passive.nodes.find(n=>n.type==='decl'&&n.prop===property) as postcss.Declaration;
  assert.equal(declaration.value,value);assert.equal(declaration.important,true);
 }
 const full=rules.get('.ts-root .ts-node[data-touch-controls=true][data-control-display=full] > .ts-card-actions')!;
 assert.ok(full.nodes.some(n=>n.type==='decl'&&n.prop==='visibility'&&n.value==='visible'));
 const entry=rules.get('.ts-root .ts-node[data-touch-controls=true][data-control-display=entry] > .ts-card-control-entry')!;
 for(const property of ['width','min-width','height','min-height'])assert.ok(entry.nodes.some(n=>n.type==='decl'&&n.prop===property&&n.value==='44px'));
});
test('fine-pointer hover and focus still reveal the original dock, without overriding disabled buttons',()=>{
 let reveal=false;css.walkRules(rule=>{
  if(rule.selector.includes('is-control-hover')&&rule.selector.endsWith('> .ts-card-actions'))reveal=true;
  if(rule.selector.includes('[data-touch-controls=true][data-control-display=full]'))assert.ok(rule.selector.endsWith('> .ts-card-actions'));
 });assert.equal(reveal,true);
});
test('N tablet default geometry reserves only non-overlapping entries, never full reading strips',()=>{
 const nodes=[{id:'idea',kind:'text',x:42,y:48,width:280,height:220},{id:'reading',kind:'card',x:354,y:48,width:300,height:300},{id:'next',kind:'text',x:686,y:48,width:280,height:220},{id:'long',kind:'card',x:42,y:300,width:280,height:220}] as const;
 const viewport={x:0,y:0,zoom:1},before=JSON.stringify({nodes,viewport}),footer={x:0,y:580,width:930,height:104};
 const requests:CardControlDockRequest[]=nodes.map(node=>({id:node.id,node,count:1,entry:true,priority:2,dimensions:{width:36,height:36,touchTargets:true,topReserve:60,screenGap:24,avoid:[footer,...foldControlObstacles(node,nodes,viewport)]}}));
 const boxes:typeof footer[]=[];
 for(const [id,placement] of reserveCardControlDocks(requests,viewport,930,684)){
  if(placement.suppressed)continue;
  const n=nodes.find(n=>n.id===id)!,size=cardControlMetrics(1,36,36,true),box={x:n.x+n.width-placement.right-size.width,y:n.y+placement.top,width:size.width,height:size.height};
  assert.ok(box.x>=12&&box.x+box.width<=918&&box.y>=60&&box.y+box.height<=672);
  for(const other of [...nodes,footer,...boxes])assert.ok(Math.min(box.x+box.width,other.x+other.width)<=Math.max(box.x,other.x)||Math.min(box.y+box.height,other.y+other.height)<=Math.max(box.y,other.y));
  boxes.push(box);
 }
 assert.equal(JSON.stringify({nodes,viewport}),before);
});
