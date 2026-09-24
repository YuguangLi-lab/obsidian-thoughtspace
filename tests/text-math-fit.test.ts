import test from 'node:test';
import assert from 'node:assert/strict';
import {fitTextNode} from '../src/text-tools';
import {type Card} from '../src/model';
class Probe {
 nodeType=1;classList={contains:(value:string)=>value==='ts-source-trigger'&&this.marker==='source-badge'};style:Record<string,string>={};textContent='';children:Probe[]=[];removed=false;
 constructor(public marker=''){}
 appendChild(child:Probe){this.children.push(child);return child;}
 cloneNode(){return new Probe(this.marker);}
 getBoundingClientRect(){return{width:this.children.some(child=>child.marker==='native-math')?344:280,height:180};}
 remove(){this.removed=true;}
}
function fixture(status:string){
 const probes:Probe[]=[],body=new Probe(),document={createElement:()=>{const probe=new Probe();probes.push(probe);return probe;},createTextNode:(text:string)=>new Probe(text),body};
 const node:Card={id:'text',kind:'text',text:'$\\frac{1}{2}$',x:0,y:0,width:200,height:120,color:'green'},rendered={dataset:{mathStatus:status},childNodes:[new Probe('native-math'),new Probe('source-badge')]};
 return{node,host:{ownerDocument:document} as unknown as HTMLElement,rendered:rendered as unknown as HTMLElement,probes};
}
test('formula auto-fit measures cloned native math plus the final source badge, preserving the live preview',()=>{
 const original=globalThis.getComputedStyle;globalThis.getComputedStyle=(()=>({fontFamily:'Body Font',getPropertyValue:()=>''})) as unknown as typeof getComputedStyle;
 try{const f=fixture('ready');fitTextNode(f.node,f.host,f.rendered);assert.equal(f.node.width,344);assert.equal(f.node.height,180);assert.deepEqual(f.probes[0].children.map(child=>child.marker),['native-math','']);assert.deepEqual(f.probes[0].children[1].style,{display:'inline-block',boxSizing:'border-box',width:'20px',minWidth:'20px',maxWidth:'20px',height:'20px',marginLeft:'5px',verticalAlign:'-3px'});assert.equal(f.rendered.childNodes.length,2);assert.equal(f.probes[0].removed,true);assert.equal(f.probes[0].style.fontFamily,'Body Font');}
 finally{globalThis.getComputedStyle=original;}
});
test('pending or failed math cannot masquerade as a completed rendered measurement',()=>{
 const original=globalThis.getComputedStyle;globalThis.getComputedStyle=(()=>({fontFamily:'Body Font',getPropertyValue:()=>''})) as unknown as typeof getComputedStyle;
 try{for(const state of ['pending','error','none']){const f=fixture(state);fitTextNode(f.node,f.host,f.rendered);assert.equal(f.node.width,280);assert.equal(f.probes[0].textContent,f.node.text);assert.equal(f.probes[0].children.length,0);assert.equal(f.probes[0].removed,true);}}
 finally{globalThis.getComputedStyle=original;}
});

test('completed math measurement follows actual preview padding and typography outside the scoped whiteboard',()=>{
 const f=fixture('ready'),original=globalThis.getComputedStyle,actual={fontFamily:'Body Font',fontSize:'24px',fontWeight:'500',lineHeight:'40.8px',letterSpacing:'0.2px',paddingTop:'28px',paddingRight:'32px',paddingBottom:'28px',paddingLeft:'32px'};
 globalThis.getComputedStyle=((element:Element)=>element===f.rendered?actual:{fontFamily:'Body Font',getPropertyValue:()=>''}) as unknown as typeof getComputedStyle;
 try{fitTextNode(f.node,f.host,f.rendered);for(const[key,value]of Object.entries(actual))assert.equal(f.probes[0].style[key],value);assert.equal(f.probes[0].removed,true);}
 finally{globalThis.getComputedStyle=original;}
});
