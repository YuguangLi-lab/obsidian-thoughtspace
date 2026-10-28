import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
class TFile {constructor(public path:string){}}
const module={exports:{} as any};
new Function('require','module','exports',transformSync(readFileSync('src/media-study-workspace.ts','utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code)((id:string)=>id==='obsidian'?{TFile,ItemView:class{},setIcon(){}}:id==='./ui-tokens'?{themeSurface(){}}:id==='./workspace-density'?{applyWorkspaceDensity(){}}:{},module,module.exports);
const {MediaStudyWorkspace,MEDIA_STUDY_EMPTY}=module.exports;
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>resolve=yes);return{promise,resolve};}
function fixture(){
 const doc={defaultView:{innerWidth:1000}},left={parentElement:{}},right={parentElement:{}},listeners=new Set<()=>void>(),leaves:any[]=[],files=new Map<string,TFile>(),note=new TFile('Notes/Study.md'),board=new TFile('Boards/A.md');files.set(note.path,note);files.set(board.path,board);
 const workspace:any={activeLeaf:undefined,getActiveViewOfType(){return this.activeLeaf?.view;},on(_name:string,fn:()=>void){listeners.add(fn);return fn;},offref(fn:()=>void){listeners.delete(fn);},iterateAllLeaves(fn:(leaf:any)=>void){leaves.forEach(fn);},setActiveLeaf(leaf:any){this.activeLeaf=leaf;listeners.forEach(fn=>fn());},async revealLeaf(leaf:any){this.setActiveLeaf(leaf);},createLeafBySplit(){return makeLeaf(right);},getLeaf(){return makeLeaf(right);}};
 const element=(parent:unknown)=>({isConnected:true,ownerDocument:doc,closest:()=>parent});
 function makeLeaf(parent:unknown){const leaf:any={id:'leaf-'+leaves.length,parent,view:{containerEl:element(parent)},state:{type:'empty'},getViewState(){return this.state;},async setViewState(state:any){this.state=state;},async openFile(file:TFile){this.state={type:'markdown',state:{file:file.path}};},detach(){this.view.containerEl.isConnected=false;leaves.splice(leaves.indexOf(this),1);}};leaf.view.leaf=leaf;leaves.push(leaf);return leaf;}
 const leaf=makeLeaf(left),owner:any={leaf,contentEl:element(left),study:{enabled:true,id:'pair',mode:'notes',ratio:60,board:board.path},studyCurrent:()=>true,studyNote:()=>undefined,studyRecord(){},studyChanged(){}};leaf.view=owner;owner.containerEl=owner.contentEl;workspace.activeLeaf=leaf;
 const host={boardType:'thoughtspace-board',chooseBoard:async()=>board,validateBoard:async(_file:TFile)=>{},accent:()=>'',density:()=>''},manager=new MediaStudyWorkspace({workspace,vault:{getAbstractFileByPath:(path:string)=>files.get(path)}},host);
 return{workspace,leaves,owner,manager,note,board,host,makeLeaf,right,doc};
}
test('study modes preserve native leaves and reuse one companion group',async()=>{
 const f=fixture();await f.manager.show(f.owner,'notes');const notes=f.leaves[1];assert.equal(notes.state.type,MEDIA_STUDY_EMPTY);f.owner.studyNote=()=>f.note;await f.manager.sync(f.owner);assert.equal(notes.state.state.file,f.note.path);
 await f.manager.show(f.owner,'board');const board=f.leaves[2];assert.equal(board.parent,notes.parent);await f.manager.show(f.owner,'notes');assert.equal(f.leaves.length,3);assert.equal(f.owner.study.mode,'notes');assert.equal(f.workspace.activeLeaf,f.owner.leaf);assert.equal(f.leaves[1],notes);f.manager.dispose();assert.equal(f.leaves.length,3);
});
test('repurposed companion tabs are never overwritten',async()=>{
 const f=fixture();await f.manager.show(f.owner,'notes');const previous=f.leaves[1];previous.state={type:'markdown',state:{file:'User/Unrelated.md'}};await f.manager.show(f.owner,'notes');assert.equal(previous.state.state.file,'User/Unrelated.md');assert.equal(f.leaves.length,3);assert.equal(f.leaves[2].parent,previous.parent);f.manager.dispose();
});
for(const reason of ['source','navigation','release'])test(`late board validation after ${reason} cannot create or reveal a leaf`,async()=>{
 const f=fixture(),gate=deferred();let entered=false;f.host.validateBoard=async()=>{entered=true;await gate.promise;};const pending=f.manager.show(f.owner,'board');await new Promise(r=>setImmediate(r));assert.ok(entered);
 if(reason==='source')f.owner.study.id='different-source';if(reason==='navigation')f.workspace.setActiveLeaf(f.makeLeaf({}));if(reason==='release')f.manager.release(f.owner);const count=f.leaves.length;gate.resolve();await pending;assert.equal(f.leaves.length,count);assert.equal(f.owner.study.mode,'notes');f.manager.dispose();
});
test('rapid competing modes keep only the latest request and restored ids find existing leaves',async()=>{
 const f=fixture();await Promise.all([f.manager.show(f.owner,'board'),f.manager.show(f.owner,'notes')]);assert.equal(f.leaves.length,2);assert.equal(f.owner.study.mode,'notes');const notes=f.leaves[1];f.manager.release(f.owner);await f.manager.show(f.owner,'notes');assert.equal(f.leaves.length,2);assert.equal(f.owner.study.noteLeaf,notes.id);f.manager.dispose();
});
