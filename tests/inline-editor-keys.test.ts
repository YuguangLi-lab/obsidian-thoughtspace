import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowsReadOnlyKey} from '../src/inline-editor-keys';
const key=(key:string,mods={})=>allowsReadOnlyKey({key,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,...mods});
test('pending writes allow copy and select-all on both desktop shortcut conventions',()=>{for(const mod of ['metaKey','ctrlKey'])for(const value of ['a','A','c','C'])assert.equal(key(value,{[mod]:true}),true);assert.equal(key('Insert',{ctrlKey:true}),true);});
test('pending writes allow keyboard selection and toolbar traversal',()=>{for(const value of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown','Tab'])for(const shiftKey of [false,true])assert.equal(key(value,{shiftKey}),true);});
test('pending writes keep mutating and alternative commands blocked',()=>{for(const value of ['v','x','z','y','b','i','Enter','Backspace','Delete','Escape'])for(const mods of [{},{ctrlKey:true},{metaKey:true}])assert.equal(key(value,mods),false,value);assert.equal(key('Insert',{shiftKey:true}),false);assert.equal(key('c',{metaKey:true,shiftKey:true}),false);assert.equal(key('a',{metaKey:true,altKey:true}),false);});
