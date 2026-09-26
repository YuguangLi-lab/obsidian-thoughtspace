import test from 'node:test';
import assert from 'node:assert/strict';
import {textFitsContent,textBlockPadding} from '../src/text-sizing';

test('ordinary text remains fixed for every legacy autoSize value unless height fitting is explicitly enabled',()=>{
 for(const autoSize of [undefined,false,true])for(const textAutoHeight of [undefined,false,true])assert.equal(textFitsContent({kind:'text',autoSize,textAutoHeight}),textAutoHeight===true,JSON.stringify({autoSize,textAutoHeight}));
});
test('topics preserve legacy automatic sizing and respect an explicit height-fit opt-out',()=>{
 for(const autoSize of [undefined,false,true])for(const textAutoHeight of [undefined,false,true])assert.equal(textFitsContent({kind:'text',topic:true,autoSize,textAutoHeight}),textAutoHeight===true||(textAutoHeight===undefined&&autoSize!==false),JSON.stringify({autoSize,textAutoHeight}));
});
test('non-text or missing nodes never participate in text fitting',()=>{
 assert.equal(textFitsContent(undefined),false);
 for(const kind of ['card','section','board','image','pdf'] as const)assert.equal(textFitsContent({kind,topic:true,textAutoHeight:true,autoSize:true}),false,kind);
});

test('compact text insets reserve a body line without changing font or normal spacing',()=>{
 for(const fontSize of [12,14,16,20])for(const borderWidth of [0,1,3]){
  const padding=textBlockPadding({fontSize,borderWidth},40);
  assert.ok(padding>=0&&padding<=14);assert.ok(fontSize*1.7+borderWidth*2+padding*2<=40+1e-8);
 }
 assert.equal(textBlockPadding({},100),14);assert.equal(textBlockPadding({fontSize:48},40),0);
});
