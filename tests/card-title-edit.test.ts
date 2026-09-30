import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCardTitle} from '../src/card-title-edit';
import {cardDisplayTitle,setCardTitle} from '../src/card-title-model';
import {emptyBoard,type Card} from '../src/model';

class Element extends EventTarget {
 children:Element[]=[];value='';readOnly=false;className='';type='';tabIndex=-1;title='';
 attributes=new Map<string,string>();classes=new Set<string>();
 classList={add:(name:string)=>this.classes.add(name),remove:(name:string)=>this.classes.delete(name)};
 onblur:(()=>void)|null=null;onkeydown?:((event:KeyboardEvent)=>void);onpointerdown?:unknown;onclick?:unknown;ondblclick?:unknown;
 private text='';
 constructor(readonly ownerDocument:Document,readonly tag='span'){super();}
 get textContent(){return this.text;}set textContent(value:string){this.text=value;this.children=[];}
 setAttribute(name:string,value:string){this.attributes.set(name,value);}
 append(child:Element){this.children.push(child);}
 replaceChildren(){this.children=[];this.text='';}
 focus(){this.ownerDocument.activeElement=this;}
 select(){}
}
class Document {
 activeElement:Element|null=null;
 createElement(tag:string){return new Element(this,tag);}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(alias?:string){
 const doc=new Document(),title=doc.createElement('span'),board=emptyBoard(),file={basename:'Original file'};
 const node:Card={id:'note',kind:'card',file:'Original file.md',title:alias,x:0,y:0,width:300,height:200,color:'blue'};board.nodes=[node];
 let previous=alias,finished=0,saveGate:Promise<void>|undefined;const saved:string[]=[];
 const dispose=bindCardTitle(title as unknown as HTMLElement,{
  getTitle:()=>cardDisplayTitle(node,file),started:()=>{previous=node.title;},canEdit:()=>{if(node.locked)throw Error('Locked');},
  save:async value=>{saved.push(value);setCardTitle(board,node.id,value,previous);await saveGate;},finished:()=>{finished++;}
 });
 const begin=()=>{title.dispatchEvent(new Event('dblclick',{cancelable:true}));const input=title.children.find(child=>child.tag==='input');assert.ok(input);return input;};
 const key=(input:Element,key:string,isComposing=false)=>input.onkeydown?.({key,isComposing,preventDefault(){},stopPropagation(){}} as KeyboardEvent);
 const blur=(input:Element)=>{doc.activeElement=null;input.onblur?.();};
 return{title,node,file,saved,begin,key,blur,dispose,finished:()=>finished,setSaveGate:(gate:Promise<void>)=>{saveGate=gate;}};
}

for(const action of ['blur','Enter'] as const)test(`opening an unaliased title then ${action} without editing must not pin its file name`,async()=>{
 const f=fixture(),input=f.begin();assert.equal(input.value,'Original file');
 if(action==='blur')f.blur(input);else f.key(input,'Enter');await tick();
 assert.deepEqual(f.saved,[],'viewing the title is not a board edit');assert.equal(f.node.title,undefined);
 f.file.basename='Renamed file';assert.equal(cardDisplayTitle(f.node,f.file),'Renamed file');assert.equal(f.finished(),1);f.dispose();
});

test('edited and cleared titles persist their exact draft through the model conflict guard',async()=>{
 const f=fixture();let input=f.begin();input.value='Local alias';f.key(input,'Enter');await tick();
 assert.deepEqual(f.saved,['Local alias']);assert.equal(f.node.title,'Local alias');
 input=f.begin();input.value='';f.blur(input);await tick();assert.deepEqual(f.saved,['Local alias','']);assert.equal(f.node.title,undefined);f.dispose();
});

test('cancelling a title never saves the draft',()=>{
 const f=fixture('Old alias'),input=f.begin();input.value='Discarded';f.key(input,'Escape');
 assert.deepEqual(f.saved,[]);assert.equal(f.node.title,'Old alias');assert.equal(f.title.textContent,'Old alias');f.dispose();
});

test('restoring the initial display text after typing is still a no-op',async()=>{
 const f=fixture(),input=f.begin();input.value='Temporary edit';input.value='Original file';f.blur(input);await tick();
 assert.deepEqual(f.saved,[]);assert.equal(f.node.title,undefined);f.dispose();
});

test('an unchanged alias exits without writing and displays a concurrent title update',async()=>{
 const f=fixture('Old alias'),input=f.begin();f.node.title='New alias from another view';f.blur(input);await tick();
 assert.deepEqual(f.saved,[]);assert.equal(f.node.title,'New alias from another view');assert.equal(f.title.textContent,'New alias from another view');f.dispose();
});

test('a changed stale title retains its draft and exposes the model conflict until cancelled',async()=>{
 const f=fixture('Old alias'),input=f.begin();input.value='My draft';f.node.title='Concurrent alias';f.key(input,'Enter');await tick();
 assert.equal(f.node.title,'Concurrent alias');assert.equal(input.value,'My draft');assert.equal(input.readOnly,false);assert.equal(input.attributes.get('aria-invalid'),'true');assert.equal(f.finished(),0);
 assert.ok(f.title.children.some(child=>child.attributes.get('role')==='alert'&&child.textContent.includes('其他操作')));
 f.key(input,'Escape');assert.equal(f.title.textContent,'Concurrent alias');assert.equal(f.finished(),1);f.dispose();
});

test('repeated Enter and blur share one pending title save and disposal prevents late completion UI',async()=>{
 const f=fixture();let resolve!:()=>void;f.setSaveGate(new Promise<void>(done=>{resolve=done;}));
 const input=f.begin();input.value='Saved alias';f.key(input,'Enter');f.blur(input);f.key(input,'Enter');
 assert.deepEqual(f.saved,['Saved alias']);assert.equal(input.readOnly,true);assert.equal(f.finished(),0);
 f.dispose();resolve();await tick();assert.equal(f.finished(),0);assert.equal(f.node.title,'Saved alias');assert.equal(input.onblur,null);
});

test('locking a card after title editing starts preserves the unsaved draft',async()=>{
 const f=fixture(),input=f.begin();input.value='My draft';f.node.locked=true;f.key(input,'Enter');await tick();
 assert.deepEqual(f.saved,[]);assert.equal(f.node.title,undefined);assert.equal(input.value,'My draft');assert.equal(input.readOnly,false);assert.equal(input.attributes.get('aria-invalid'),'true');f.dispose();
});
