import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardInputCommands,type BoardInputAction,type BoardInputCommandTarget} from '../src/board-input-commands';

function fixture(){
 const calls:BoardInputAction[]=[],allowed=new Set<BoardInputAction>(['newCard','newText','insertNote','selection','connect','fit','focus','reset','fold','expand','edit','undo','redo','newSection','duplicate','remove','childTopic','siblingTopic','parentTopic','find','tidy','read']);
 const target:BoardInputCommandTarget={editing:false,canRun:action=>allowed.has(action),run:action=>{calls.push(action);}};
 let current:BoardInputCommandTarget|undefined=target;
 return{target,calls,allowed,commands:boardInputCommands(()=>current),setTarget:(value:BoardInputCommandTarget|undefined)=>{current=value;}};
}
test('native registry exposes twenty-two independent commands without default shortcuts or global callbacks',()=>{
 const f=fixture();assert.equal(f.commands.length,22);assert.equal(new Set(f.commands.map(command=>command.id)).size,22);
 for(const command of f.commands){assert.ok(command.id.startsWith('board-input-'));assert.equal(command.hotkeys,undefined);assert.equal(command.callback,undefined);assert.ok(command.name.startsWith('白板：'));assert.equal(typeof command.checkCallback,'function');}
 assert.equal(f.commands.some(command=>command.id==='insert-existing-note'||command.id==='toggle-focus'),false);
});
test('availability checks are side-effect free and execution dispatches each action exactly once',()=>{
 const f=fixture();for(const command of f.commands)assert.equal(command.checkCallback?.(true),true);assert.deepEqual(f.calls,[]);
 for(const command of f.commands)assert.equal(command.checkCallback?.(false),true);
 assert.deepEqual(f.calls,['newCard','newText','insertNote','selection','connect','fit','focus','reset','fold','expand','edit','undo','redo','newSection','duplicate','remove','childTopic','siblingTopic','parentTopic','find','tidy','read']);
});
test('no active board or active text editing suppresses every command at check and execution time',()=>{
 const f=fixture();for(const mode of ['absent','editing']){
  f.target.editing=mode==='editing';f.setTarget(mode==='absent'?undefined:f.target);
  for(const command of f.commands){assert.equal(command.checkCallback?.(true),false);assert.equal(command.checkCallback?.(false),false);}
 }
 assert.deepEqual(f.calls,[]);
});
test('selection and read-only eligibility can disable mutations while preserving navigation',()=>{
 const f=fixture();f.allowed.clear();f.allowed.add('fit');f.allowed.add('focus');f.allowed.add('reset');
 for(const command of f.commands)command.checkCallback?.(false);
 assert.deepEqual(f.calls,['fit','focus','reset']);
});
test('execution rechecks the current board and editing state instead of trusting an earlier palette check',()=>{
 const f=fixture(),command=f.commands[0];assert.equal(command.checkCallback?.(true),true);
 f.setTarget(undefined);assert.equal(command.checkCallback?.(false),false);assert.deepEqual(f.calls,[]);
 f.setTarget(f.target);assert.equal(command.checkCallback?.(true),true);f.target.editing=true;assert.equal(command.checkCallback?.(false),false);assert.deepEqual(f.calls,[]);
 f.target.editing=false;f.allowed.delete('newCard');assert.equal(command.checkCallback?.(false),false);assert.deepEqual(f.calls,[]);
});
test('switching active boards dispatches only to the board resolved for that invocation',()=>{
 const f=fixture(),otherCalls:BoardInputAction[]=[],command=f.commands[0];assert.equal(command.checkCallback?.(true),true);
 f.setTarget({editing:false,canRun:()=>true,run:action=>{otherCalls.push(action);}});assert.equal(command.checkCallback?.(false),true);
 assert.deepEqual(f.calls,[]);assert.deepEqual(otherCalls,['newCard']);
});
test('native deletion commands follow explicit action eligibility at execution',()=>{
 const f=fixture(),command=f.commands.find(command=>command.id==='board-input-remove');
 assert.ok(command);assert.equal(command.checkCallback?.(true),true);assert.equal(command.checkCallback?.(false),true);assert.deepEqual(f.calls,['remove']);
 f.allowed.delete('remove');assert.equal(command.checkCallback?.(false),false);assert.deepEqual(f.calls,['remove']);
});
