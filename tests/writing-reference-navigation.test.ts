import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {WritingReferenceScroll} from '../src/writing-chrome';

function pane(clientHeight=400){
 return {scrollTop:0,clientHeight,isConnected:true};
}
const element=(node:ReturnType<typeof pane>)=>node as unknown as HTMLElement;

test('switching references restores each reading position only after its own render completes',()=>{
 const memory=new WritingReferenceScroll(),a=pane(),b=pane();
 memory.attach('a',element(a))();a.scrollTop=720;memory.detach();
 memory.attach('b',element(b))();b.scrollTop=150;memory.detach();
 const reopened=pane(),ready=memory.attach('a',element(reopened));
 assert.equal(reopened.scrollTop,0,'an empty body cannot hold its old scroll');
 ready();assert.equal(reopened.scrollTop,720);
 memory.detach();const reopenedB=pane();memory.attach('b',element(reopenedB))();
 assert.equal(reopenedB.scrollTop,150);
});

test('late renders and hidden panels do not overwrite the saved position',()=>{
 const memory=new WritingReferenceScroll(),a=pane();
 memory.attach('a',element(a))();a.scrollTop=900;memory.detach();
 const stale=pane(0),staleReady=memory.attach('a',element(stale));memory.detach();
 const current=pane(0);memory.attach('a',element(current))();
 stale.clientHeight=400;staleReady();assert.equal(stale.scrollTop,0);
 memory.capture();assert.equal(current.scrollTop,0,'restoration waits until the dock is visible');
 current.clientHeight=400;memory.restore();assert.equal(current.scrollTop,900);
 memory.clear();
 const otherBoard=pane();memory.attach('a',element(otherBoard))();assert.equal(otherBoard.scrollTop,0);
});

test('pinning updates the active reference control without re-reading the material',()=>{
 const source=readFileSync('src/writing-view.ts','utf8'),start=source.indexOf(' private syncReferencePin('),end=source.indexOf('\n async showReference',start);
 const icon={name:''},attributes=new Map<string,string>();
 const pin={dataset:{writingNode:'a'},title:'',setAttribute(key:string,value:string){attributes.set(key,value);},querySelector:()=>icon};
 const View=new Function('setIcon',transformSync('class View{'+source.slice(start,end)+'};return View',{loader:'ts'}).code)((el:typeof icon,name:string)=>{el.name=name;});
 const view=new View(),state={referenceId:'a',referenceIds:['b']};
 let updates=0;
 Object.assign(view,{reference:{querySelector:()=>pin,empty(){throw Error('must retain rendered reference');}},state:()=>state,update:(fn:(s:typeof state)=>void)=>fn(state),renderReferenceTabs:()=>updates++,showReference(){throw Error('must not read the note again');}});
 view.toggleReferencePin('a');assert.deepEqual(state.referenceIds,['b','a']);assert.equal(attributes.get('aria-pressed'),'true');assert.equal(pin.title,'取消固定');assert.equal(icon.name,'pin-off');
 view.toggleReferencePin('b');assert.deepEqual(state.referenceIds,['a']);assert.equal(attributes.get('aria-pressed'),'true');
 view.toggleReferencePin('a');assert.deepEqual(state.referenceIds,[]);assert.equal(attributes.get('aria-pressed'),'false');assert.equal(icon.name,'pin');assert.equal(updates,3);
});
