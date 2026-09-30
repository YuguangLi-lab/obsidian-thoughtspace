import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cardHeadingColors} from '../src/card-style-color';
import {colors} from '../src/model';

test('title band chooses legible ink for all named tones and custom colors',()=>{
 for(const fill of [...colors,'#ffffff','#000000','#12abEF','#808080'] as const){
  const {color,ink}=cardHeadingColors({color:'green',fillColor:fill});
  const [r,g,b]=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const l=.2126*r+.7152*g+.0722*b;
  assert.ok((ink==='#000000'?(l+.05)/.05:1.05/(l+.05))>=4.5,fill);
 }
 assert.equal(cardHeadingColors({color:'green',fillColor:'#ffffff'}).ink,'#000000');
 assert.equal(cardHeadingColors({color:'green',fillColor:'#000000'}).ink,'#ffffff');
 assert.deepEqual(cardHeadingColors({color:'green',fillColor:'none'}),cardHeadingColors({color:'green'}));
});
