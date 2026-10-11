import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
import {sha256} from '../src/portable-sha256';

const reference=(input:string|Uint8Array)=>createHash('sha256').update(input).digest('hex');

test('portable SHA-256 matches standard vectors and long multi-block input',()=>{
 const vectors=[
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq','248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
  ['a'.repeat(1000000),'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0']
 ];
 for(const [input,digest]of vectors){assert.equal(sha256(input),digest);assert.equal(sha256(input),reference(input));}
});

test('portable text hashes preserve Node UTF-8 identities including malformed surrogates',()=>{
 const inputs=['研究库/中文 来源.md','🎨😀🖊️','e\u0301 / é','\u0000\r\n\t','\ud800','\udfff','a\ud800b','\ud800\ud800\udc00','\udc00\ud800','\ufeff---\nthoughtspace: board\n---'];
 for(const input of inputs){assert.equal(sha256(input),reference(input),JSON.stringify(input));assert.equal(sha256(new TextEncoder().encode(input)),reference(input));}
});

test('all padding boundaries and binary byte values match Node without mutating input',()=>{
 const lengths=[...Array.from({length:258},(_,i)=>i),511,512,513,1023,1024,1025,4095,4096,4097,65535,65536,65537];
 for(const length of lengths){
  const bytes=Uint8Array.from({length},(_,i)=>(i*131+length*17)&255),before=bytes.slice();
  assert.equal(sha256(bytes),reference(bytes),`byte length ${length}`);assert.deepEqual(bytes,before);
 }
 const backing=Uint8Array.from({length:512},(_,i)=>i&255),view=backing.subarray(13,499);
 assert.equal(sha256(view),reference(view));assert.equal(sha256(view.slice()),reference(view));
});

test('every repository regression fixture source retains its previous Node digest',()=>{
 // Fixture data lives inline in the regression suites rather than in a separate
 // fixture directory. Hash the complete existing corpus in text and byte form.
 const directory=new URL('.',import.meta.url),files=readdirSync(directory).filter(file=>file.endsWith('.test.ts'));
 assert.ok(files.length>100,'existing regression fixture corpus must be present');
 for(const file of files){const bytes=readFileSync(new URL(file,directory));assert.equal(sha256(bytes),reference(bytes),file);const text=bytes.toString('utf8');assert.equal(sha256(text),reference(text),file);}
});
