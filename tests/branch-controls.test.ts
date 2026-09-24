import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import type {BranchControlsOptions} from '../src/branch-controls';

type Options={cls?:string;text?:string;attr?:Record<string,string>};
class Element {
 children:Element[]=[];attrs:Record<string,string>={};disabled=false;icon='';
 onpointerdown?:((event:Event)=>void)|null;ondblclick?:((event:Event)=>void)|null;onclick?:((event:Event)=>void)|null;
 constructor(public tag='div',public options:Options={}){this.attrs={...options.attr};}
 createEl(tag:string,options:Options={}){const child=new Element(tag,options);this.children.push(child);return child;}
 createDiv(options:Options){return this.createEl('div',options);}
 createSpan(options:Options){return this.createEl('span',options);}
 setAttribute(name:string,value:string){this.attrs[name]=value;}
 find(cls:string):Element|undefined{return this.children.find(child=>child.options.cls?.split(' ').includes(cls))||this.children.map(child=>child.find(cls)).find(Boolean);}
}
const module={exports:{} as typeof import('../src/branch-controls')};
const code=transformSync(readFileSync('src/branch-controls.ts','utf8'),{loader:'ts',format:'cjs'}).code;
new Function('require','module','exports',code)((name:string)=>{
 assert.equal(name,'obsidian');return{setIcon:(element:Element,icon:string)=>{element.icon=icon;}};
},module,module.exports);
const {renderBranchControls}=module.exports;
function fixture(overrides:Partial<BranchControlsOptions>={}){
 const host=new Element(),calls={toggle:0,menu:[] as HTMLElement[]};
 const options:BranchControlsOptions={count:3,candidates:0,folded:false,disabled:false,group:false,onToggle:()=>{calls.toggle++;},onMenu:anchor=>{calls.menu.push(anchor);},...overrides};
 const wrapper=renderBranchControls(host as unknown as HTMLElement,options) as unknown as Element|null;
 return{host,options,wrapper,calls,toggle:host.find('ts-branch-toggle'),menu:host.find('ts-branch-menu')};
}
function fire(element:Element,type:'onclick'|'onpointerdown'|'ondblclick'){
 let stopped=0;const event={stopPropagation(){stopped++;}} as unknown as Event;element[type]?.(event);return stopped;
}

test('regular parents expose the direct-child count, current state and adjacent menu',()=>{
 const f=fixture();
 assert.equal(f.wrapper?.attrs.role,'group');assert.equal(f.wrapper?.attrs['aria-disabled'],'false');
 assert.equal(f.toggle?.attrs['aria-expanded'],'true');assert.equal(f.toggle?.find('ts-branch-icon')?.icon,'minus');
 assert.equal(f.toggle?.find('ts-branch-count')?.options.text,'3');assert.equal(f.toggle?.find('ts-branch-label'),undefined);
 assert.equal(f.menu?.attrs['aria-haspopup'],'menu');assert.equal(f.menu?.find('ts-branch-icon')?.icon,'chevron-down');
 assert.equal(fire(f.toggle!,'onclick'),1);assert.equal(f.calls.toggle,1);
 assert.equal(fire(f.menu!,'onclick'),1);assert.deepEqual(f.calls.menu,[f.menu]);
});
test('folded group controls distinguish child nodes from group contents',()=>{
 const f=fixture({folded:true,group:true,count:12});
 assert.ok(f.wrapper?.options.cls?.split(' ').includes('ts-branch-controls-group'));
 assert.equal(f.toggle?.attrs['aria-expanded'],'false');assert.equal(f.toggle?.find('ts-branch-icon')?.icon,'plus');
 assert.equal(f.toggle?.attrs['aria-label'],'展开下一层 · 12 个子节点');
 assert.equal(f.toggle?.find('ts-branch-label')?.options.text,'子节点');assert.equal(f.toggle?.find('ts-branch-count')?.options.text,'12');
});
test('candidate relations offer one explicit conversion action without a misleading disclosure state',()=>{
 const f=fixture({count:0,candidates:2,group:true});
 assert.ok(f.toggle?.options.cls?.split(' ').includes('ts-branch-setup'));
 assert.equal(f.toggle?.attrs['aria-label'],'设为子节点并折叠 · 可撤销');assert.equal(f.toggle?.attrs['aria-expanded'],undefined);
 assert.equal(f.toggle?.find('ts-branch-icon')?.icon,'git-branch');assert.equal(f.toggle?.find('ts-branch-count')?.options.text,'2');
 assert.equal(f.menu,undefined);fire(f.toggle!,'onclick');assert.equal(f.calls.toggle,1);
});
test('nodes without children or candidates leave their host unchanged',()=>{
 const f=fixture({count:0,candidates:0});assert.equal(f.wrapper,null);assert.equal(f.host.children.length,0);
});
test('disabled controls expose native and ARIA state and reject direct callback dispatch',()=>{
 for(const setup of [false,true]){
  const f=fixture({disabled:true,...(setup?{count:0,candidates:2}:{})});
  assert.equal(f.wrapper?.attrs['aria-disabled'],'true');
  for(const button of [f.toggle,f.menu].filter((element):element is Element=>!!element)){
   assert.equal(button.disabled,true);assert.equal(button.attrs['aria-disabled'],'true');assert.equal(fire(button,'onclick'),1);
  }
  assert.equal(f.calls.toggle,0);assert.deepEqual(f.calls.menu,[]);
 }
 const f=fixture();f.toggle!.disabled=true;f.menu!.disabled=true;fire(f.toggle!,'onclick');fire(f.menu!,'onclick');
 assert.equal(f.calls.toggle,0);assert.deepEqual(f.calls.menu,[]);
});
test('pointer and double-click guards protect group drag and title rename',()=>{
 const f=fixture({group:true});
 for(const element of [f.wrapper!,f.toggle!,f.menu!])for(const type of ['onpointerdown','ondblclick'] as const)assert.equal(fire(element,type),1);
 assert.equal(f.calls.toggle,0);assert.deepEqual(f.calls.menu,[]);
});
