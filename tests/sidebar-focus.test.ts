import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replaceSidebarContents} from '../src/sidebar-content';

test('refresh restores a note preview button within its own row, even with duplicate labels',()=>{
 const doc:{activeElement?:Control;defaultView?:unknown}={};
 class Control {
  dataset:Record<string,string>={};focused=0;
  constructor(readonly path:string,readonly label='预览笔记'){this.dataset.notePath=path;}
  getAttribute(key:string){return key==='aria-label'?this.label:null;}
  closest(selector:string){return selector.includes('[data-note-path]')?this:null;}
  focus(options:{preventScroll:boolean}){assert.equal(options.preventScroll,true);this.focused++;doc.activeElement=this;}
 }
 doc.defaultView={HTMLElement:Control};const old=new Control('Notes/A.md'),a=new Control('Notes/A.md'),b=new Control('Notes/B.md');doc.activeElement=old;
 const host={scrollTop:140,ownerDocument:doc,contains:(el:unknown)=>el===old,replaceChildren(){doc.activeElement=undefined;this.scrollTop=0;},querySelectorAll:()=>[b,a]};
 replaceSidebarContents(host as unknown as HTMLElement,{childNodes:[]} as unknown as HTMLElement,true);
 assert.equal(doc.activeElement,a);assert.equal(a.focused,1);assert.equal(b.focused,0);assert.equal(host.scrollTop,140);
});
