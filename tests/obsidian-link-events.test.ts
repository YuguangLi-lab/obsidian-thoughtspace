import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync('src/main.ts','utf8');
const start=source.indexOf('    const openStageLink=(e:MouseEvent)=>{');
const end=source.indexOf("    this.registerDomEvent(this.stage,'click',openStageLink);",start);
assert.ok(start>=0&&end>start);
function fixture(options:{boundary?:string;prevented?:boolean;type?:string;path?:string;file?:string;pane?:string;pdf?:boolean;button?:number}={}){
 const calls:{open:unknown[][];sidebar:unknown[][];tab:unknown[][];prevent:number;stop:number}={open:[],sidebar:[],tab:[],prevent:0,stop:0};
 const type=options.type||'internal-link',path=options.path||'Target#Section';
 const link={classList:{contains:(value:string)=>value===type},textContent:'#research',getAttribute:(name:string)=>name==='data-href'?path:null,closest:(selector:string)=>selector==='[data-id]'?{getAttribute:()=> 'note'}:options.boundary&&selector.includes(options.boundary)?{}:null};
 const target={closest:(selector:string)=>selector==='a'?link:options.boundary&&selector.includes(options.boundary)?{}:null};
 const event={target,button:options.button??0,defaultPrevented:!!options.prevented,preventDefault(){this.defaultPrevented=true;calls.prevent++;},stopPropagation(){calls.stop++;}};
 const view={session:{board:{nodes:[{id:'note',file:options.file}]},file:{path:'Boards/work.thoughtspace'}},app:{metadataCache:{getFirstLinkpathDest:()=>options.pdf?{extension:'pdf',path:'Papers/Paper.pdf'}:null},workspace:{openLinkText:(...args:unknown[])=>calls.open.push(args)}},plugin:{openNoteInSidebar:(...args:unknown[])=>calls.sidebar.push(args)},selectTab:(...args:unknown[])=>calls.tab.push(args)};
 const run=new Function('Keymap','parseLinktext','act',transformSync(source.slice(start,end)+'return openStageLink;',{loader:'ts'}).code).call(view,{isModEvent:()=>options.pane||false},(value:string)=>{const i=value.indexOf('#');return{path:i<0?value:value.slice(0,i),subpath:i<0?'':value.slice(i)};},(fn:()=>unknown)=>fn());
 return{calls,event,run:()=>run(event)};
}
test('preview internal links retain source context and native pane modifiers',()=>{
 for(const pane of [undefined,'tab','split','window']){const f=fixture({file:'Notes/source.md',pane});f.run();assert.deepEqual(f.calls.open,[['Target#Section','Notes/source.md',pane||'tab']]);assert.equal(f.calls.prevent,1);}
});
test('board text links retain board-relative paths and PDF sidebar behavior',()=>{
 const a=fixture();a.run();assert.equal(a.calls.open[0][1],'Boards/work.thoughtspace');
 const b=fixture({pdf:true,path:'Paper.pdf#page=7'});b.run();assert.deepEqual(b.calls.sidebar,[[{extension:'pdf',path:'Papers/Paper.pdf'},'#page=7']]);assert.equal(b.calls.open.length,0);
 const c=fixture({pdf:true,pane:'tab',button:1});c.run();assert.equal(c.calls.sidebar.length,0);assert.equal(c.calls.open[0][2],'tab');
});
test('already handled preview links are not opened a second time by the board',()=>{
 const f=fixture({prevented:true});f.run();assert.equal(f.calls.open.length,0);assert.equal(f.calls.prevent,0);assert.equal(f.calls.stop,0);
});
for(const boundary of ['.ts-inline-editor','.cm-editor','.is-editing-title','.markdown-embed','.internal-embed'])test(`native ${boundary} owns its link clicks and source context`,()=>{
 const f=fixture({boundary});f.run();assert.equal(f.calls.open.length,0);assert.equal(f.calls.sidebar.length,0);assert.equal(f.calls.prevent,0);
});
test('native editor tag clicks are not redirected to the board library',()=>{const f=fixture({type:'tag',boundary:'.ts-inline-editor'});f.run();assert.equal(f.calls.tab.length,0);});
test('ordinary card tag clicks continue to filter the library',()=>{const f=fixture({type:'tag'});f.run();assert.deepEqual(f.calls.tab,[['library','']]);});
