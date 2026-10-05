import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalRelationMotion} from '../src/local-relations-motion';

class FakeAnimation {
 onfinish:(()=>void)|null=null;oncancel:(()=>void)|null=null;cancelled=0;
 cancel(){this.cancelled++;this.oncancel?.();}
 finish(){this.onfinish?.();}
}
class FakeDocument {
 activeElement:FakePill|null=null;reduced=false;
 defaultView={closed:false,matchMedia:(query:string)=>{assert.equal(query,'(prefers-reduced-motion: reduce)');return{matches:this.reduced};}};
}
class FakePill {
 dataset:{relationMotionId:string;relationMotionCenter?:string};isConnected=true;visible=true;reads=0;
 parentElement?:FakeAncestor;checkVisibility?:()=>boolean;
 calls:{frames:Keyframe[];options:KeyframeAnimationOptions;animation:FakeAnimation}[]=[];
 onAnimate?:()=>void;
 constructor(id:string,public box={left:10,top:20,width:100,height:24},center=false){this.dataset={relationMotionId:id,...(center?{relationMotionCenter:'true'}:{})};}
 contains(element:unknown){return element===this;}
 getClientRects(){return this.visible?[this.box]:[];}
 getBoundingClientRect(){this.reads++;return{...this.box};}
 animate(frames:Keyframe[],options:KeyframeAnimationOptions){const animation=new FakeAnimation();this.calls.push({frames,options,animation});this.onAnimate?.();return animation;}
 focus(){throw Error('Transitions must not focus');}
 scrollIntoView(){throw Error('Transitions must not scroll');}
}
class FakeAncestor {
 parentElement?:FakeAncestor;children:(FakeAncestor|FakePill)[]=[];
 constructor(readonly tagName:string,public open=false){}
 append(child:FakeAncestor|FakePill){this.children.push(child);child.parentElement=this;return child;}
 contains(element:unknown):boolean{return element===this||this.children.some(child=>child.contains(element));}
}
class FakeRoot {
 isConnected=true;visible=true;children:FakePill[]=[];scrollTop=70;scrollLeft=10;
 constructor(public ownerDocument=new FakeDocument()){}
 contains(element:unknown){return this.children.includes(element as FakePill);}
 querySelectorAll(selector:string){assert.equal(selector,'[data-relation-motion-id]');return this.children;}
 getClientRects(){return this.visible?[{}]:[];}
 asElement(){return this as unknown as HTMLElement;}
}
function fixture(){const root=new FakeRoot(),motion=new LocalRelationMotion(),old=new FakePill('same');root.children=[old];return{root,motion,old,capture:()=>motion.capture(root.asElement())};}

test('the same identity transitions from its old rectangle without touching scroll, focus or card data',()=>{
 const f=fixture(),card={id:'same',x:5,y:10,width:120,height:80},before=JSON.stringify(card),snapshot=f.capture();
 const next=new FakePill('same',{left:60,top:100,width:200,height:32},true);f.root.children=[next];f.motion.play(f.root.asElement(),snapshot);
 assert.deepEqual(next.calls[0].frames,[{transformOrigin:'0 0',transform:'translate(-50px, -80px) scale(0.5, 0.75)'},{transformOrigin:'0 0',transform:'none'}]);
 assert.equal(next.calls[0].options.duration,480);assert.equal(next.calls[0].options.fill,'none');assert.deepEqual([f.root.scrollLeft,f.root.scrollTop],[10,70]);assert.equal(f.root.ownerDocument.activeElement,null);assert.equal(JSON.stringify(card),before);
});
test('unchanged positions do not animate and new identities only fade in',()=>{const f=fixture(),snapshot=f.capture(),same=new FakePill('same'),added=new FakePill('new');f.root.children=[same,added];f.motion.play(f.root.asElement(),snapshot);assert.equal(same.calls.length,0);assert.deepEqual(added.calls[0].frames,[{opacity:0},{opacity:1}]);assert.equal(f.old.calls.length,0);});
for(const zoom of [.5,.8,1.6])test(`embedded board zoom ${zoom} preserves each animated node's screen origin`,()=>{
 const f=fixture();Object.assign(f.root,{offsetWidth:500,offsetHeight:300,getBoundingClientRect:()=>({width:500*zoom,height:300*zoom})});const snapshot=f.capture(),next=new FakePill('same',{left:210,top:120,width:100,height:24});f.root.children=[next];f.motion.play(f.root.asElement(),snapshot);
 const transform=String(next.calls[0].frames[0].transform),match=transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)!;
 assert.equal(next.box.left+Number(match[1])*zoom,f.old.box.left);assert.equal(next.box.top+Number(match[2])*zoom,f.old.box.top);assert.equal(next.calls[0].options.duration,480);
});
test('the clicked copy wins over a duplicate center when capturing the next center identity',()=>{const f=fixture(),center=new FakePill('same',{left:200,top:10,width:140,height:36},true);f.root.children=[center,f.old];f.root.ownerDocument.activeElement=f.old;const snapshot=f.capture();assert.equal(snapshot?.rects.get('same')?.left,10);});
test('without an active copy a duplicate center wins over ordinary neighboring copies',()=>{const f=fixture(),center=new FakePill('same',{left:200,top:10,width:140,height:36},true);f.root.children=[f.old,center];assert.equal(f.capture()?.rects.get('same')?.left,200);});
test('a rapid recapture reads the currently displayed rectangle before cancelling the previous transition',()=>{const f=fixture(),first=f.capture(),next=new FakePill('same',{left:90,top:80,width:110,height:28});f.root.children=[next];f.motion.play(f.root.asElement(),first);const animation=next.calls[0].animation;next.getBoundingClientRect=()=>{assert.equal(animation.cancelled,0);return{left:45,top:50,width:105,height:26};};const second=f.capture();assert.equal(second?.rects.get('same')?.left,45);assert.equal(animation.cancelled,1);});
test('stale play completion cannot consume or cancel a newer transition',()=>{const f=fixture(),old=f.capture(),latest=f.capture(),next=new FakePill('same',{left:90,top:80,width:110,height:28});f.root.children=[next];f.motion.play(f.root.asElement(),old);assert.equal(next.calls.length,0);f.motion.play(f.root.asElement(),latest);assert.equal(next.calls.length,1);f.motion.play(f.root.asElement(),old);assert.equal(next.calls[0].animation.cancelled,0);});
test('one snapshot can be played only once and cancel invalidates an unplayed capture',()=>{const f=fixture(),snapshot=f.capture();f.root.children=[new FakePill('new')];f.motion.play(f.root.asElement(),snapshot);f.motion.play(f.root.asElement(),snapshot);assert.equal(f.root.children[0].calls.length,1);const pending=f.capture();f.motion.cancel();f.motion.play(f.root.asElement(),pending);assert.equal(f.root.children[0].calls.length,1);});
test('cancel releases every live animation and does not retain finished animations',()=>{const f=fixture(),snapshot=f.capture(),a=new FakePill('a'),b=new FakePill('b');f.root.children=[a,b];f.motion.play(f.root.asElement(),snapshot);a.calls[0].animation.finish();f.motion.cancel();assert.equal(a.calls[0].animation.cancelled,0);assert.equal(b.calls[0].animation.cancelled,1);assert.equal(b.calls[0].animation.onfinish,null);f.motion.cancel();assert.equal(b.calls[0].animation.cancelled,1);});
for(const reason of ['reduced','detached','hidden','closed-window'] as const)test(`capture skips ${reason}`,()=>{const f=fixture();if(reason==='reduced')f.root.ownerDocument.reduced=true;if(reason==='detached')f.root.isConnected=false;if(reason==='hidden')f.root.visible=false;if(reason==='closed-window')f.root.ownerDocument.defaultView.closed=true;assert.equal(f.capture(),undefined);assert.equal(f.old.reads,0);});
for(const reason of ['reduced','detached','hidden','closed-window','new-document','new-root'] as const)test(`play degrades to a cut after ${reason}`,()=>{const f=fixture(),snapshot=f.capture(),next=new FakePill('new');f.root.children=[next];let root=f.root;if(reason==='reduced')f.root.ownerDocument.reduced=true;if(reason==='detached')f.root.isConnected=false;if(reason==='hidden')f.root.visible=false;if(reason==='closed-window')f.root.ownerDocument.defaultView.closed=true;if(reason==='new-document')f.root.ownerDocument=new FakeDocument();if(reason==='new-root'){root=new FakeRoot(f.root.ownerDocument);root.children=[next];}f.motion.play(root.asElement(),snapshot);assert.equal(next.calls.length,0);});
test('capture and play remain bounded at sixty identities and animations, prioritizing a late center',()=>{const f=fixture();f.root.children=Array.from({length:100},(_,i)=>new FakePill('old-'+i));const center=new FakePill('center',undefined,true);f.root.children.push(center);const snapshot=f.capture();assert.equal(snapshot?.rects.size,60);assert.ok(snapshot?.rects.has('center'));assert.equal(f.root.children.reduce((sum,pill)=>sum+pill.reads,0),60);f.root.children=Array.from({length:100},(_,i)=>new FakePill('new-'+i));f.motion.play(f.root.asElement(),snapshot);assert.equal(f.root.children.reduce((sum,pill)=>sum+pill.calls.length,0),60);});
test('invalid and nonvisible boxes cannot create nonfinite keyframes',()=>{const f=fixture(),snapshot=f.capture(),nan=new FakePill('nan',{left:NaN,top:0,width:10,height:10}),zero=new FakePill('zero',{left:0,top:0,width:0,height:10}),hidden=new FakePill('hidden'),detached=new FakePill('detached');hidden.visible=false;detached.isConnected=false;f.root.children=[nan,zero,hidden,detached];f.motion.play(f.root.asElement(),snapshot);assert.ok(f.root.children.every(pill=>!pill.calls.length));});
test('missing WAAPI and one throwing animation do not block the next valid pill',()=>{const f=fixture(),snapshot=f.capture(),missing=new FakePill('missing'),broken=new FakePill('broken'),valid=new FakePill('valid');Object.defineProperty(missing,'animate',{value:undefined});broken.animate=()=>{throw Error('closed animation host');};f.root.children=[missing,broken,valid];assert.doesNotThrow(()=>f.motion.play(f.root.asElement(),snapshot));assert.equal(valid.calls.length,1);});
test('DOM access failures safely cancel previous animations',()=>{const f=fixture(),snapshot=f.capture(),next=new FakePill('new');f.root.children=[next];f.motion.play(f.root.asElement(),snapshot);f.root.querySelectorAll=()=>{throw Error('detached document');};assert.equal(f.capture(),undefined);assert.equal(next.calls[0].animation.cancelled,1);});
test('a synchronous move during animate cancels the created effect and skips subsequent pills',()=>{const f=fixture(),snapshot=f.capture(),first=new FakePill('new'),last=new FakePill('last');f.root.children=[first,last];first.onAnimate=()=>{f.root.ownerDocument=new FakeDocument();};f.motion.play(f.root.asElement(),snapshot);assert.equal(first.calls[0].animation.cancelled,1);assert.equal(last.calls.length,0);});
test('completion runs exactly once after every current animation finishes',()=>{const f=fixture(),snapshot=f.capture(),a=new FakePill('a'),b=new FakePill('b');f.root.children=[a,b];let completions=0;f.motion.play(f.root.asElement(),snapshot,()=>completions++);assert.equal(completions,0);a.calls[0].animation.finish();assert.equal(completions,0);b.calls[0].animation.finish();assert.equal(completions,1);b.calls[0].animation.finish();f.motion.cancel();assert.equal(completions,1);});
for(const reason of ['unchanged','unsupported','reduced-before-capture','reduced-before-play'] as const)test(`instant ${reason} fallback completes without waiting for an animation`,()=>{const f=fixture();if(reason==='reduced-before-capture')f.root.ownerDocument.reduced=true;const snapshot=f.capture();if(reason==='unsupported'){f.root.children=[new FakePill('new')];Object.defineProperty(f.root.children[0],'animate',{value:undefined});}if(reason==='reduced-before-play')f.root.ownerDocument.reduced=true;let completions=0;f.motion.play(f.root.asElement(),snapshot,()=>completions++);assert.equal(completions,1);assert.ok(f.root.children.every(pill=>!pill.calls.length));});
for(const action of ['cancel','recapture','external-cancel'] as const)test(`${action} never calls the abandoned transition completion`,()=>{const f=fixture(),snapshot=f.capture(),next=new FakePill('new');f.root.children=[next];let completions=0;f.motion.play(f.root.asElement(),snapshot,()=>completions++);const animation=next.calls[0].animation;if(action==='cancel')f.motion.cancel();if(action==='recapture')f.capture();if(action==='external-cancel')animation.cancel();animation.finish();assert.equal(completions,0);});
test('a stale play and throwing completion cannot interfere with later navigation',()=>{const f=fixture(),stale=f.capture(),current=f.capture();let staleCalls=0;f.motion.play(f.root.asElement(),stale,()=>staleCalls++);assert.equal(staleCalls,0);assert.doesNotThrow(()=>f.motion.play(f.root.asElement(),current,()=>{throw Error('detached line layer');}));assert.doesNotThrow(()=>f.motion.capture(f.root.asElement()));});
test('a layout exception degrades to a cut and completes the current visual cleanup',()=>{const f=fixture(),snapshot=f.capture();f.root.querySelectorAll=()=>{throw Error('layout lost during transition');};let completions=0;assert.doesNotThrow(()=>f.motion.play(f.root.asElement(),snapshot,()=>completions++));assert.equal(completions,1);f.motion.cancel();assert.equal(completions,1);});
test('a late layout exception cancels started effects before completing the cut',()=>{const f=fixture(),snapshot=f.capture(),first=new FakePill('first'),broken=new FakePill('broken');f.root.children=[first,broken];broken.getBoundingClientRect=()=>{throw Error('second pill detached during layout');};let completions=0;f.motion.play(f.root.asElement(),snapshot,()=>completions++);assert.equal(first.calls[0].animation.cancelled,1);assert.equal(completions,1);first.calls[0].animation.finish();assert.equal(completions,1);});
test('native content visibility rejects a retained nonempty layout rectangle',()=>{const f=fixture();f.old.checkVisibility=()=>false;assert.equal(f.old.getClientRects().length,1);const snapshot=f.capture();assert.equal(snapshot?.rects.has('same'),false);assert.equal(f.old.reads,0);f.motion.play(f.root.asElement(),snapshot);assert.equal(f.old.calls.length,0);});
for(const native of [undefined,true])test(`closed details reject body pills despite nonempty rectangles and native visibility=${native}`,()=>{const f=fixture(),details=new FakeAncestor('DETAILS'),body=new FakeAncestor('DIV');details.append(new FakeAncestor('SUMMARY'));details.append(body);body.append(f.old);if(native!==undefined)f.old.checkVisibility=()=>native;const snapshot=f.capture();assert.equal(snapshot?.rects.size,0);assert.equal(f.old.reads,0);let completed=0;f.motion.play(f.root.asElement(),snapshot,()=>completed++);assert.equal(f.old.calls.length,0);assert.equal(completed,1);});
test('reopening details fades in its newly visible pill without using a ghost old position',()=>{const f=fixture(),details=new FakeAncestor('DETAILS');details.append(f.old);const snapshot=f.capture();details.open=true;f.old.box.left=250;f.motion.play(f.root.asElement(),snapshot);assert.deepEqual(f.old.calls[0].frames,[{opacity:0},{opacity:1}]);});
test('closing details after capture prevents animation of the now invisible pill',()=>{const f=fixture(),details=new FakeAncestor('DETAILS',true);details.append(f.old);const snapshot=f.capture();assert.ok(snapshot?.rects.has('same'));details.open=false;f.old.box.left=250;f.motion.play(f.root.asElement(),snapshot);assert.equal(f.old.calls.length,0);});
test('the first summary remains eligible inside closed details',()=>{const f=fixture(),details=new FakeAncestor('DETAILS'),summary=new FakeAncestor('SUMMARY'),label=new FakeAncestor('SPAN');details.append(summary);summary.append(label);label.append(f.old);assert.ok(f.capture()?.rects.has('same'));});
test('a later summary and an inner summary hidden by outer details stay ineligible',()=>{const f=fixture(),outer=new FakeAncestor('DETAILS'),first=new FakeAncestor('SUMMARY'),second=new FakeAncestor('SUMMARY');outer.append(first);outer.append(second);second.append(f.old);assert.equal(f.capture()?.rects.size,0);const inner=new FakeAncestor('DETAILS'),innerSummary=new FakeAncestor('SUMMARY');outer.append(inner);inner.append(innerSummary);innerSummary.append(f.old);assert.equal(f.capture()?.rects.size,0);});

for(const action of ['finish','cancel','recapture'] as const)test(`departing identity fades without keeping focusable duplicate content after ${action}`,()=>{
 const root=new FakeRoot(),motion=new LocalRelationMotion(true),old=new FakePill('old');let removed=0,hidden=false;
 const ghost=Object.assign(new FakePill('old'),{style:{},inert:false,removeAttribute(this:FakePill,name:string){if(name==='data-relation-motion-id')delete (this.dataset as {relationMotionId?:string}).relationMotionId;},querySelectorAll(){return[];},setAttribute(name:string,value:string){if(name==='aria-hidden'&&value==='true')hidden=true;},remove(this:FakePill){removed++;root.children=root.children.filter(value=>value!==this);}});
 Object.assign(old,{cloneNode(){return ghost;}});Object.assign(root,{offsetWidth:500,offsetHeight:300,getBoundingClientRect(){return{left:0,top:0,width:500,height:300};},appendChild(value:FakePill){root.children.push(value);}});
 root.children=[old];const snapshot=motion.capture(root.asElement());root.children=[];motion.play(root.asElement(),snapshot);
 assert.equal(ghost.calls.length,1);assert.deepEqual(ghost.calls[0].frames,[{opacity:1},{opacity:0}]);assert(ghost.inert&&hidden);assert.equal((ghost.style as any).pointerEvents,'none');assert(motion.active);
 if(action==='finish')ghost.calls[0].animation.finish();if(action==='cancel')motion.cancel();if(action==='recapture')motion.capture(root.asElement());
 assert.equal(removed,1);assert.equal(root.children.length,0);assert(!motion.active);
});
