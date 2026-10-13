import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ConvenienceNavigationLease} from '../src/convenience-navigation';
test('navigation away and back permanently cancels callbacks and cleans once',()=>{let location='a',clean=0,invalid=0;const lease=new ConvenienceNavigationLease(()=>location==='a',()=>clean++);lease.watch(()=>invalid++);assert(lease.current());location='b';lease.observe();location='a';assert.equal(lease.current(),false);lease.stop();assert.equal(clean,1);assert.equal(invalid,1);});
test('only a declared transition can be rebound to the destination',()=>{let location='a';const lease=new ConvenienceNavigationLease(()=>location==='a');lease.bind(()=>location==='a'||location==='b');location='b';lease.observe();lease.bind(()=>location==='b');location='a';assert.equal(lease.current(),false);assert.throws(()=>lease.bind(()=>true));});
test('late watcher observes cancellation synchronously',()=>{const lease=new ConvenienceNavigationLease(()=>false);assert.equal(lease.current(),false);let seen=0;lease.watch(()=>seen++);assert.equal(seen,1);});
