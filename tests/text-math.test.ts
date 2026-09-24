import test from 'node:test';
import assert from 'node:assert/strict';
import {textMathParts} from '../src/text-math';
const formulas=(text:string)=>textMathParts(text).filter(part=>part.kind==='math');
test('inline and block LaTex are split without changing surrounding literal text or line breaks',()=>{
 const value='第一行 **字面量**\n面积 $a^2+b^2$\n$$\n\\frac{1}{2}\n$$\n最后一行\n',parts=textMathParts(value);
 assert.deepEqual(formulas(value),[{kind:'math',text:'$a^2+b^2$',source:'a^2+b^2',display:false},{kind:'math',text:'$$\n\\frac{1}{2}\n$$',source:'\n\\frac{1}{2}\n',display:true}]);assert.equal(parts.map(part=>part.text).join(''),value);
});
test('plain text, escaped dollars, currency and incomplete formulas remain literal',()=>{
 for(const value of ['普通文本\n换行','\\$x\\$','$5 and $10','$5.00','$ x $','$x\ny$','$$ incomplete','$$$x$$$','空 $$ $$'])assert.equal(formulas(value).length,0,value);
 assert.equal(formulas('正确 $x\\$y$ 公式').length,1);
});
test('inline code and backtick or tilde fences never render code examples as formulas',()=>{
 const value='`$x$` ``$y$ ` test``\n```latex\n$x$\n$$y$$\n```\n~~~\n$z$\n~~~\n真正的 $a$';assert.deepEqual(formulas(value).map(part=>part.source),['a']);
});
test('formula parser preserves inline timestamps, escaped backslashes and every character',()=>{
 const value='时间 [00:12](yingjian://video?id=123)\\\\$x$ 和 $y$';assert.deepEqual(formulas(value).map(part=>part.source),['x','y']);assert.equal(textMathParts(value).map(part=>part.text).join(''),value);
});

test('long currency lists remain literal and do not absorb a later real formula',()=>{
 const value=Array.from({length:2000},(_,i)=>`$${i+1}`).join(' ')+' formula $x^2$';assert.deepEqual(formulas(value).map(part=>part.source),['x^2']);assert.equal(textMathParts(value).map(part=>part.text).join(''),value);
});
