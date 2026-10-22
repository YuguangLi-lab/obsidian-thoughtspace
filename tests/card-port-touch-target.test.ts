import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {boardTouchTarget} from '../src/board-touch';
import {syncCardPortTabStops} from '../src/card-control-context';

// Execute the actual port and canvas entry points. Only the DOM/session host is
// substituted; the event's original target remains the incorrectly chosen port.
const source=readFileSync(process.env.BOARD_PORT_TOUCH_SOURCE||'src/main.ts','utf8');
function take(from:string,to:string){const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,from);return source.slice(a,b);}
const View=new Function('boardTouchTarget','act',transformSync('return class View{'+take('  private addPorts(','  private cancelConnection(')+take('  private pointerDown(','  private pointerMove(')+'}',{loader:'ts'}).code)(boardTouchTarget,(fn:()=>unknown)=>fn());
const bindSync=new Function('root','syncCardPortTabStops',transformSync(take('    const syncPorts=()=>{','    this.syncPortTabStops=syncPorts;')+'return syncPorts;',{loader:'ts'}).code);
function fixture(){
 const counts={connection:0,bodyConnection:0,capture:0,focus:0,prevented:0,stopped:0,resumed:0,updated:0,pointReads:0};
 const view=new View(),board={version:3,nodes:Array.from({length:80},(_,i)=>({id:'n'+i,kind:'text',text:'saved',x:i*190,y:180,width:160,height:100,color:'sand'})),edges:[],viewport:{x:0,y:0,zoom:.5}},doc:any={activeElement:null};
 const cards:any[]=[];let hit:any;
 doc.elementFromPoint=(x:number,y:number)=>{counts.pointReads++;assert.ok(Number.isFinite(x)&&Number.isFinite(y));return hit;};
 const root={ownerDocument:doc};
 for(const node of board.nodes){
  const card:any={id:node.id,ownerDocument:doc,ports:[],createEl(_tag:string,options:any){const port:any={tagName:'BUTTON',tabIndex:0,disabled:false,dataset:{side:options.attr['data-side']},contains:(target:any)=>target===port,closest:(selector:string)=>selector==='[data-id]'?card:selector.split(',').includes('button')?port:null};card.ports.push(port);return port;},contains:(target:any)=>target===card||target?.card===card||card.ports.includes(target),getAttribute:(name:string)=>name==='data-id'?node.id:null,querySelectorAll:()=>card.ports};
  cards.push(card);
 }
 Object.assign(view,{session:{board,blocked:false,refreshNativeEditing(){}},selected:new Set(),mode:'select',positions:new Map(cards.map(c=>[c.id,c])),stage:{focus(){counts.focus++;}},plugin:{settings:{}},resumeAutomaticGeometry(){counts.resumed++;},startLinkDrag(){counts.connection++;counts.capture++;view.mode='connect';view.syncPortTabStops();},connectNode(){counts.bodyConnection++;},renderBoard(){},updateSelection(){counts.updated++;view.syncPortTabStops();}});
 view.syncPortTabStops=bindSync.call(view,root,syncCardPortTabStops);for(const c of cards)view.addPorts(c,c.id);view.syncPortTabStops();
 const card=cards[10],port=card.ports[2];
 const body:any={card,closest(selector:string){if(selector==='[data-id]')return card;if(selector.split(',').includes('.ts-text-body'))return body;return null;}};
 hit=body;
 const event=(overrides:Record<string,unknown>={})=>({target:port,button:0,ctrlKey:false,isTrusted:true,pointerType:'touch',pointerId:2,clientX:358,clientY:279,detail:1,stopPropagation(){counts.stopped++;},preventDefault(){counts.prevented++;},...overrides});
 const eligible=()=>cards.flatMap(c=>c.ports.filter((p:any)=>p.tabIndex>=0).map(()=>c.id));
 return{view,board,counts,cards,card,port,body,event,eligible,setHit:(value:any)=>hit=value};
}

test('AAP outside-port body touch selects through the real body path and keeps only its four ports',()=>{
 const f=fixture(),before=structuredClone(f.board),event=f.event();assert.deepEqual(f.eligible(),[]);f.port.onpointerdown(event);
 assert.equal(event.target,f.port);assert.equal(event.clientY,279);assert.equal(f.view.mode,'select');assert.deepEqual([...f.view.selected],['n10']);assert.deepEqual(f.eligible(),Array(4).fill('n10'));assert.equal(f.view.gesture,undefined);assert.deepEqual(f.board,before);
 assert.deepEqual(f.counts,{connection:0,bodyConnection:0,capture:0,focus:0,prevented:0,stopped:1,resumed:1,updated:1,pointReads:1});
});
test('the same touch-generated click on the original port cannot start a second connection',()=>{
 const f=fixture();f.port.onpointerdown(f.event());f.port.onclick(f.event({clientY:288,detail:1}));assert.equal(f.view.mode,'select');assert.equal(f.counts.connection,0);assert.equal(f.counts.bodyConnection,0);assert.equal(f.counts.capture,0);assert.deepEqual(f.eligible(),Array(4).fill('n10'));
});
test('body rerouting preserves repeated/shift selection and clears selected-edge state without writes',()=>{
 const f=fixture(),before=structuredClone(f.board);f.view.selectedEdge='old';f.port.onpointerdown(f.event());f.port.onpointerdown(f.event());assert.equal(f.counts.updated,1);assert.equal(f.view.selectedEdge,undefined);f.port.onpointerdown(f.event({shiftKey:true}));assert.deepEqual([...f.view.selected],[]);assert.deepEqual(f.eligible(),[]);assert.deepEqual(f.board,before);assert.equal(f.counts.prevented,0);
});
for(const blocker of ['blocked','gesture','marquee','rightMarquee','linkDrag'] as const)test(`rerouted body touch retains original ${blocker} guard`,()=>{
 const f=fixture(),before=structuredClone(f.board);if(blocker==='blocked')f.view.session.blocked=true;else f.view[blocker]={id:99};f.port.onpointerdown(f.event());assert.deepEqual([...f.view.selected],[]);assert.equal(f.view.mode,'select');assert.equal(f.counts.connection,0);assert.equal(f.counts.capture,0);assert.deepEqual(f.board,before);
});
test('intentional connection mode still accepts the physical card body as its existing target',()=>{const f=fixture();f.view.mode='connect';f.port.onpointerdown(f.event());assert.equal(f.counts.bodyConnection,1);assert.equal(f.counts.connection,0);assert.equal(f.counts.capture,0);});
for(const pointerType of ['touch','mouse','pen'])test(`physical port press retains its original ${pointerType} connection route`,()=>{
 const f=fixture();f.setHit(f.port);f.port.onpointerdown(f.event({pointerType,clientY:304}));assert.equal(f.view.mode,'connect');assert.equal(f.counts.connection,1);assert.equal(f.counts.capture,1);assert.equal(f.counts.prevented,1);assert.equal(f.eligible().length,320);assert.equal(f.counts.resumed,0);
});
test('fine mouse and pen remain untouched even when a reading body lies under the coordinates',()=>{for(const pointerType of ['mouse','pen']){const f=fixture();f.port.onpointerdown(f.event({pointerType}));assert.equal(f.counts.pointReads,0);assert.equal(f.counts.connection,1);}});
test('keyboard activation on the original port remains available after rerouted touch',()=>{const f=fixture();f.port.onpointerdown(f.event());f.port.onclick(f.event({detail:0,pointerType:''}));assert.equal(f.counts.bodyConnection,1);});
test('rerouting never adopts another card or a nested interactive body target',()=>{for(const value of ['other','link']){const f=fixture();f.setHit(value==='other'?{...f.body,card:f.cards[11]}:{card:f.card,closest:(s:string)=>s.split(',').includes('a')?{}:null});f.port.onpointerdown(f.event());assert.equal(f.counts.connection,1);assert.deepEqual([...f.view.selected],[]);}});
test('normal stage body touch retains the default original event target',()=>{const f=fixture();f.view.pointerDown(f.event({target:f.body}));assert.deepEqual([...f.view.selected],['n10']);assert.equal(f.counts.pointReads,0);assert.equal(f.counts.prevented,0);assert.equal(f.counts.capture,0);});
