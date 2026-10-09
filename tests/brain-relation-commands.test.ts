import test from 'node:test';
import assert from 'node:assert/strict';
import {brainRelationCommands,type BrainRelationCommandTarget} from '../src/brain-relation-commands';
import type {BrainRelationSide} from '../src/brain-board-create';

test('four independent native brain relation commands have no default hotkeys',()=>{
 const calls:BrainRelationSide[]=[],target:BrainRelationCommandTarget={editing:false,canRun:()=>true,run:side=>calls.push(side)},commands=brainRelationCommands(()=>target);
 assert.deepEqual(commands.map(command=>command.id),['brain-add-parent','brain-add-child','brain-add-left-associated','brain-add-right-associated']);
 for(const command of commands){assert.equal(command.hotkeys,undefined);assert.equal(command.callback,undefined);assert.equal(command.checkCallback?.(true),true);}
 assert.deepEqual(calls,[]);for(const command of commands)assert.equal(command.checkCallback?.(false),true);
 assert.deepEqual(calls,['top','bottom','left','right']);
});
test('execution resolves live active brain and never trusts a previous palette check',()=>{
 const calls:BrainRelationSide[]=[],target:BrainRelationCommandTarget={editing:false,canRun:()=>true,run:side=>calls.push(side)};
 let current:BrainRelationCommandTarget|undefined=target;const commands=brainRelationCommands(()=>current);
 for(const mode of ['absent','editing','ineligible'] as const){current=target;target.editing=false;target.canRun=()=>true;for(const command of commands)assert.equal(command.checkCallback?.(true),true);
  if(mode==='absent')current=undefined;if(mode==='editing')target.editing=true;if(mode==='ineligible')target.canRun=()=>false;
  for(const command of commands)assert.equal(command.checkCallback?.(false),false);
 }
 assert.deepEqual(calls,[]);
 const other:BrainRelationSide[]=[];current={editing:false,canRun:()=>true,run:side=>other.push(side)};commands[1].checkCallback?.(false);assert.deepEqual(other,['bottom']);assert.deepEqual(calls,[]);
});
test('native command enumeration and execution are distinguished for prompt focus guards',()=>{
 const checks:boolean[]=[],commands=brainRelationCommands(checking=>{checks.push(checking);return{editing:!checking,canRun:()=>true,run:()=>assert.fail('focused prompt must not execute')};});
 assert.equal(commands[0].checkCallback?.(true),true);assert.equal(commands[0].checkCallback?.(false),false);assert.deepEqual(checks,[true,false]);
});
