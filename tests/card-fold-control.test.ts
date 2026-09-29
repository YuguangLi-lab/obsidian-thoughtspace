import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCardQuickActions} from '../src/card-quick-actions';

class Control extends EventTarget {
  attrs:Record<string,string>={};disabled=false;
  setAttribute(name:string,value:string){this.attrs[name]=value;}
}
function control(locked:boolean,blocked:boolean,collapsed=false){
  const actions=new Control(),folding=new Control();
  mountCardQuickActions(actions as unknown as HTMLElement,{
    kind:'card',locked,readOnly:blocked,collapsed,autoFit:false,fold:()=>{},
    add:()=>folding as unknown as HTMLButtonElement
  });
  return folding;
}
test('locked cards cannot advertise folding as an enabled action',()=>{
  assert.equal(control(true,false).disabled,true);
  assert.equal(control(false,true).disabled,true);
  assert.equal(control(false,false).disabled,false);
});
test('fold action exposes its expanded state to assistive technology',()=>{
  assert.equal(control(false,false).attrs['aria-expanded'],'true');
  assert.equal(control(false,false,true).attrs['aria-expanded'],'false');
});
