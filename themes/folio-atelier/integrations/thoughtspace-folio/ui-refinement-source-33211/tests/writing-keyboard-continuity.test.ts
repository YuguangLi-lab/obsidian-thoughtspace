import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {transformSync} from 'esbuild';

// Execute exact production methods. The frozen baseline uses its actual title
// callback when the new helper is absent, giving a real red feedback loop.
const sourcePath=process.env.WRITING_AUDIT_SOURCE||'src/writing-view.ts';
const source=readFileSync(sourcePath,'utf8'),file=ts.createSourceFile(sourcePath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const view=file.statements.find(s=>ts.isClassDeclaration(s)&&s.name?.text==='WritingView') as ts.ClassDeclaration;
function method(name:string){return view.members.find(m=>ts.isMethodDeclaration(m)&&m.name?.getText(file)===name) as ts.MethodDeclaration|undefined;}
function production(name:string){const node=method(name);assert.ok(node,'production method '+name);return new Function('Notice',transformSync('class View{'+node.getText(file)+'};return View.prototype.'+name,{loader:'ts'}).code)(class{});}
let select=method('selectOutline')?production('selectOutline'):undefined;
if(!select){
 let callback:ts.Expression|undefined;
 function visit(node:ts.Node){if(ts.isVariableDeclaration(node)&&node.name.getText(file)==='main'&&node.initializer&&ts.isCallExpression(node.initializer))callback=node.initializer.arguments[2];ts.forEachChild(node,visit);}
 visit(method('renderLists')!);assert.ok(callback,'baseline actual title callback');
 select=new Function(transformSync('return function(id,event){const actual='+callback.getText(file)+';return actual(event)}',{loader:'ts'}).code)();
}
const syncDock=production('syncDock'),action=production('action');
function fixture(key=JSON.stringify(['title','node'])){
 const body={},doc:any={body,activeElement:undefined};
 const button:any={dataset:{writingOutlineKey:key},isConnected:true,matches:(s:string)=>s===':focus-visible',focus(options:unknown){doc.activeElement=this;this.focusOptions=options}};
 const replacement:any={dataset:{writingOutlineKey:key},isConnected:true,focus(options:unknown){doc.activeElement=this;this.focusOptions=options}};
 const outline:any={isConnected:true,contains:(e:unknown)=>e===button,querySelectorAll:()=>[replacement]};
 const v:any={contentEl:{ownerDocument:doc},owner:{},file:{},mode:'outline',closed:false,outline,selected:undefined,renderCalls:0,renderLists(){this.renderCalls++;button.isConnected=false;doc.activeElement=body;this.afterRender?.()}};
 doc.activeElement=button;return{v,button,replacement,doc,body,event:{detail:0,currentTarget:button}};
}
function run(f:ReturnType<typeof fixture>){select!.call(f.v,'node',f.event);assert.equal(f.v.renderCalls,1);assert.equal(f.v.selected,'node');}
test('keyboard title activation restores the same logical launcher after its row is replaced',()=>{const f=fixture();run(f);assert.equal(f.doc.activeElement,f.replacement);assert.deepEqual(f.replacement.focusOptions,{preventScroll:true});});
test('keyboard child activation keeps the exact group and child key, including arbitrary ID text',()=>{
 const f=fixture(JSON.stringify(['child','group"[]','node\\:x'])),other={dataset:{writingOutlineKey:JSON.stringify(['child','other','node\\:x'])},focus(){throw Error('wrong group focused')}};
 f.v.outline.querySelectorAll=()=>[other,f.replacement];run(f);assert.equal(f.doc.activeElement,f.replacement);
});
test('pointer click never invents keyboard focus after replacing a title row',()=>{const f=fixture();f.event.detail=1;run(f);assert.equal(f.doc.activeElement,f.body);});
test('synthetic activation from an inactive launcher does not steal the user current focus',()=>{const f=fixture(),search={};f.doc.activeElement=search;f.v.renderLists=()=>{f.v.renderCalls++;f.button.isConnected=false};run(f);assert.equal(f.doc.activeElement,search);});
test('non focus-visible activation does not restore keyboard focus',()=>{const f=fixture();f.button.matches=()=>false;run(f);assert.equal(f.doc.activeElement,f.body);});
test('a user or handler moving focus during the synchronous rebuild wins',()=>{const f=fixture(),search={};f.v.afterRender=()=>f.doc.activeElement=search;run(f);assert.equal(f.doc.activeElement,search);});
for(const property of ['owner','file','mode','closed'] as const)test('a changed '+property+' context rejects stale restoration',()=>{const f=fixture();f.v.afterRender=()=>f.v[property]=property==='closed'?true:property==='mode'?'write':{};run(f);assert.equal(f.doc.activeElement,f.body);});
for(const property of ['owner','file'] as const)test('a missing '+property+' context does not restore focus',()=>{const f=fixture();f.v[property]=undefined;run(f);assert.equal(f.doc.activeElement,f.body);});
test('a disconnected outline cannot receive stale focus',()=>{const f=fixture();f.v.afterRender=()=>f.v.outline.isConnected=false;run(f);assert.equal(f.doc.activeElement,f.body);});
test('a retained launcher is not focused again',()=>{const f=fixture();f.v.afterRender=()=>f.button.isConnected=true;run(f);assert.equal(f.doc.activeElement,f.body);});
test('a disappeared logical key has no unrelated fallback',()=>{const f=fixture();f.replacement.dataset.writingOutlineKey='different';run(f);assert.equal(f.doc.activeElement,f.body);});
test('the action forwards the original native MouseEvent rather than fabricating keyboard activation',()=>{
 const button:any={createSpan(){return{}}},parent={createEl(){return button}},view:any={},event={detail:1,currentTarget:button};let actual:unknown;
 action.call(view,parent,'own action',(value:unknown)=>actual=value);button.onclick(event);assert.equal(actual,event);
});
function dockFixture(width:number,open=true,requested=true){
 const composer={inert:false},panels:any={'.ts-writing-source':{},'.ts-writing-reference':{}},toggle={setAttribute(){},toggleClass(){}},view:any={dockOpen:open,compactDockRequested:requested,dockWidth:320,resourceMode:'library',dockResize:{hidden:false},dock:{hidden:false,querySelector:(s:string)=>panels[s],querySelectorAll:()=>[]},contentEl:{clientWidth:width,style:{setProperty(){}},toggleClass(){},querySelector:(s:string)=>s==='.ts-writing-composer'?composer:toggle},fitTitle(){}};
 return{view,composer};
}
test('a compact visible drawer makes only the covered composer inert',()=>{const f=dockFixture(640);syncDock.call(f.view);assert.equal(f.composer.inert,true);assert.equal(f.view.dock.hidden,false);});
test('a compact drawer stays hidden and composer active at the natural default',()=>{const f=dockFixture(640,true,false);syncDock.call(f.view);assert.equal(f.composer.inert,false);assert.equal(f.view.dock.hidden,true);});
test('closing an open compact drawer restores composer interaction',()=>{const f=dockFixture(320);syncDock.call(f.view);assert.equal(f.composer.inert,true);f.view.dockOpen=false;syncDock.call(f.view);assert.equal(f.composer.inert,false);});
test('resizing an open drawer to the adjacent wide layout restores composer interaction',()=>{const f=dockFixture(640);syncDock.call(f.view);assert.equal(f.composer.inert,true);f.view.contentEl.clientWidth=1280;syncDock.call(f.view);assert.equal(f.composer.inert,false);});
test('resizing a wide open drawer into compact mode isolates its covered composer',()=>{const f=dockFixture(1280);syncDock.call(f.view);assert.equal(f.composer.inert,false);f.view.contentEl.clientWidth=640;syncDock.call(f.view);assert.equal(f.composer.inert,true);});
test('no missing or unrelated composer is made inert',()=>{const f=dockFixture(640);f.view.contentEl.querySelector=(s:string)=>s==='.ts-writing-composer'?null:{setAttribute(){},toggleClass(){}};syncDock.call(f.view);assert.equal(f.composer.inert,false);});
