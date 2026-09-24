import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
function fixture(){
 const source=readFileSync('src/main.ts','utf8'),take=(a:string,b:string)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 const code=take('  private requireOwner(', '  editText(')+take('  private point(', '  private mutate(');
 let seq=0;const View=new Function('uid','fitTextNode',transformSync('class View{'+code+'};return View',{loader:'ts'}).code)(()=>`new-${++seq}`,()=>{});
 const v=new View(),board={version:3,mode:'mindmap',viewport:{x:120,y:-40,zoom:2},nodes:[],edges:[]},owner={board,blocked:false,change:(op:any)=>op(board)},edits:any[]=[];
 Object.assign(v,{session:owner,blankClickOwner:owner,blankClicks:{consume:()=>true},stage:{getBoundingClientRect:()=>({left:100,top:50,width:900,height:700})},world:{},svg:{},mode:'select',plugin:{settings:{defaultTextSize:18}},updateSelection(){},startInlineEdit:async(id:string,selectAll:boolean)=>edits.push({id,selectAll})});
 const event=(patch:any={})=>({target:v.stage,button:0,clientX:420,clientY:330,preventDefault(){},stopPropagation(){},...patch});
 return{v,owner,board,edits,event};
}
test('double-click canvas backgrounds creates one blank text at transformed coordinates and enters editing',async()=>{
 for(const target of ['stage','world','svg']){const {v,board,edits,event}=fixture();await v.blankDoubleClick(event({target:v[target]}));assert.equal(board.nodes.length,1);const n:any=board.nodes[0];assert.deepEqual([n.kind,n.text,n.x,n.y,n.fontSize,n.topic],['text','',60,130,18,false]);assert.deepEqual(edits,[{id:n.id,selectAll:false}]);assert.equal(board.mode,'mindmap');assert.equal(board.edges.length,0);assert.deepEqual([...v.selected],[n.id]);assert.equal(v.blankTextCreating,false);}
});
test('node, edge, toolbar, editor and other overlay targets never count as blank canvas',async()=>{
 const {v,board,event}=fixture();for(const name of ['node','edge','toolbar','editor','tour','relation'])await v.blankDoubleClick(event({target:{name}}));assert.equal(board.nodes.length,0);
});
test('tools, modifiers, read-only boards and active gestures retain their own interactions',async()=>{
 for(const field of ['closed','blankTextCreating','inlineExit','space','sectionTool','gesture','marquee','rightMarquee','linkDrag']){const {v,board,event}=fixture();v[field]=true;await v.blankDoubleClick(event());assert.equal(board.nodes.length,0,field);}
 for(const key of ['ctrlKey','metaKey','shiftKey','altKey']){const {v,board,event}=fixture();await v.blankDoubleClick(event({[key]:true}));assert.equal(board.nodes.length,0,key);}
 for(const mode of ['button','connect','blocked','owner','unclean']){const {v,board,event,owner}=fixture();if(mode==='connect')v.mode='connect';if(mode==='blocked')owner.blocked=true;if(mode==='owner')v.blankClickOwner={};if(mode==='unclean')v.blankClicks.consume=()=>false;await v.blankDoubleClick(event({button:mode==='button'?2:0}));assert.equal(board.nodes.length,0,mode);}
});
test('existing draft conflict aborts creation and retains its editor',async()=>{
 const {v,board,event}=fixture(),editor={commit:async()=>false};v.inline=editor;await v.blankDoubleClick(event());assert.equal(board.nodes.length,0);assert.equal(v.inline,editor);assert.equal(v.blankTextCreating,false);
});
test('rapid repeated double-click cannot duplicate creation while a draft saves',async()=>{
 const {v,board,event}=fixture();let release!:(value:boolean)=>void;v.inline={commit:()=>new Promise<boolean>(r=>release=r)};const first=v.blankDoubleClick(event());await v.blankDoubleClick(event());release(true);await first;assert.equal(board.nodes.length,1);assert.equal(v.blankTextCreating,false);
});
test('board switching during draft save cannot add to the old or new board',async()=>{
 const {v,board,event}=fixture();let release!:(value:boolean)=>void;v.inline={commit:()=>new Promise<boolean>(r=>release=r)};const first=v.blankDoubleClick(event());const next={board:{nodes:[]}};v.session=next;release(true);await assert.rejects(first,/白板已切换/);assert.equal(board.nodes.length,0);assert.equal(next.board.nodes.length,0);assert.equal(v.blankTextCreating,false);
});
