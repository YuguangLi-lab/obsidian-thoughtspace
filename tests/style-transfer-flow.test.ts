import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {readNodeStyle,applyNodeStyle} from '../src/board-experience';
import {emptyBoard,type Board} from '../src/model';
const source=readFileSync('src/main.ts','utf8');
const methods=source.slice(source.indexOf('  private copyObjectStyle('),source.indexOf('  private renderSelectionTools(){'));
const View=new Function('readNodeStyle','applyNodeStyle','fitTextNode','Notice',transformSync(`class View{${methods}};return View`,{loader:'ts'}).code)(readNodeStyle,applyNodeStyle,()=>{throw Error('Card styles must not resize text');},class{});
function fixture(){const v=new View(),history:Board[]=[],board:Board={...emptyBoard(),nodes:[{id:'a',kind:'card',file:'a.md',x:0,y:0,width:300,height:200,color:'blue',fontSize:24,transparent:true},{id:'b',kind:'card',file:'b.md',x:500,y:0,width:260,height:200,color:'rose'}]};const owner={board,blocked:false,change(fn:(b:Board)=>void){history.push(structuredClone(this.board));fn(this.board);}};Object.assign(v,{closed:false,session:owner,plugin:{refreshStyleClipboard(){}},renderSelectionTools(){},requireOwner(o:unknown){if(this.session!==o||owner.blocked||this.closed)throw Error('stale owner');}});return{v,owner,history};}
test('toolbar copy/paste is one undoable appearance operation and preserves card geometry/content',()=>{const{v,owner,history}=fixture(),before=structuredClone(owner.board);v.copyObjectStyle(new Set(['a']),owner);assert.equal(history.length,0);v.pasteObjectStyle(new Set(['b']),owner);assert.equal(history.length,1);assert.deepEqual(owner.board.nodes[1],{...before.nodes[1],color:'blue',fontSize:24,transparent:true});owner.board=history.pop()!;assert.deepEqual(owner.board,before);});
test('copied appearance remains a detached snapshot when source changes',()=>{const{v,owner}=fixture();v.copyObjectStyle(new Set(['a']),owner);owner.board.nodes[0].color='green';v.pasteObjectStyle(new Set(['b']),owner);assert.equal(owner.board.nodes[1].color,'blue');});
for(const context of ['no-style','empty','removed','locked','busy'])test(`paste ignores ${context} without adding history`,()=>{const{v,owner,history}=fixture();v.copyObjectStyle(new Set(['a']),owner);let ids=new Set(['b']);if(context==='no-style')delete v.plugin.copiedNodeStyle;if(context==='empty')ids.clear();if(context==='removed')ids=new Set(['missing']);if(context==='locked')owner.board.nodes[1].locked=true;if(context==='busy')v.inline={snapshot:()=>({busy:true})};v.pasteObjectStyle(ids,owner);assert.equal(history.length,0);});
for(const state of ['switched','closed','blocked'])test(`stale toolbar cannot copy or paste into ${state} view`,()=>{const{v,owner,history}=fixture();v.copyObjectStyle(new Set(['a']),owner);if(state==='switched')v.session={};if(state==='closed')v.closed=true;if(state==='blocked')owner.blocked=true;assert.throws(()=>v.copyObjectStyle(new Set(['b']),owner));assert.throws(()=>v.pasteObjectStyle(new Set(['b']),owner));assert.equal(history.length,0);});

test('copy refreshes paste availability in every already-open board without changing its selection',()=>{
 const refresh=source.slice(source.indexOf('  refreshStyleClipboard(){'),source.indexOf('  async savePreferences()',source.indexOf('  refreshStyleClipboard(){')));
 const Plugin=new Function('VIEW','BoardView',transformSync(`class ClipboardPlugin{${refresh}};return ClipboardPlugin`,{loader:'ts'}).code)('thoughtspace',View);
 const first=fixture(),second=fixture(),plugin=new Plugin(),updates:number[]=[];
 plugin.app={workspace:{getLeavesOfType(type:string){
  assert.equal(type,'thoughtspace');
  return [{view:first.v},{view:second.v},{view:{refreshStyleControls(){throw Error('Not a BoardView');}}}];
 }}};
 for(const [index,f] of [first,second].entries())Object.assign(f.v,{plugin,selected:new Set(['b']),pasteEnabled:false,refreshStyleControls(){updates.push(index);this.pasteEnabled=!!plugin.copiedNodeStyle;}});
 first.v.copyObjectStyle(new Set(['a']),first.owner);
 assert.deepEqual(updates,[0,1]);assert.equal(second.v.pasteEnabled,true);assert.deepEqual([...second.v.selected],['b']);assert.equal(second.history.length,0);
 second.v.pasteObjectStyle(new Set(['b']),second.owner);assert.equal(second.owner.board.nodes[1].color,'blue');assert.equal(second.history.length,1);
});
