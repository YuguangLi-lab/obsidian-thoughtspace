import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecoveryItems,recoveryStorageLabel,type RecoveryCenterItem} from '../src/recovery-center';
import {rememberWritingRecovery,allWritingRecoveryEntries,discardWritingRecovery} from '../src/writing-draft-recovery';
test('recovery listing validates entries without reading, restoring, writing or deleting their data',()=>{
 let reads=0,opens=0;const item:RecoveryCenterItem={id:'one',kind:'synthetic',title:'draft',storage:'memory',description:'volatile',read:()=>{reads++;return 'draft';},open:()=>{opens++;}};
 assert.deepEqual(validateRecoveryItems([item,item]),[item]);assert.equal(reads,0);assert.equal(opens,0);assert.match(recoveryStorageLabel('memory'),/重启会丢失/);assert.match(recoveryStorageLabel('checkpoint'),/落盘/);assert.match(recoveryStorageLabel('unknown'),/不作恢复保证/);
});
test('volatile writing enumeration retains each source and cannot mutate or remove originals',()=>{
 const host={},a={},b={},one=rememberWritingRecovery(host,a,'A','first'),two=rememberWritingRecovery(host,b,'B','second');const entries=allWritingRecoveryEntries(host);assert.equal(entries.length,2);entries[0].entry.text='changed display copy';assert.equal(allWritingRecoveryEntries(host)[0].entry.text,'first');discardWritingRecovery(host,a,one.id);assert.deepEqual(allWritingRecoveryEntries(host).map(v=>v.entry.id),[two.id]);assert.equal(allWritingRecoveryEntries({}).length,0);
});
