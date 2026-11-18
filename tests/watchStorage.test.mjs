import test from 'node:test';import assert from 'node:assert/strict';
import {watchStore,allowEnrollment} from '../backend/property-watch/storage.ts';
import {digest} from '../backend/property-watch/enrollment.ts';
test('storage never sends raw bearer and parameterizes all identity values',async()=>{
 const calls=[];const db={query:async(sql,args)=>{calls.push({sql,args});return {rows:[]};}};
 const store=watchStore(db,async()=>true);const token='a'.repeat(64);
 assert.equal(await store.authenticate(token),null);assert.deepEqual(calls[0].args,[await digest(token)]);assert.ok(!calls[0].sql.includes(token));
 await store.removeWatch('device',"bad';drop table test;--");
 assert.deepEqual(calls[1].args,['device',"bad';drop table test;--"]);assert.ok(!calls[1].sql.includes('drop table'));
 assert.equal(await store.putWatchIfActive('device','home',100),false);
});
test('store invokes atomic revoked-state-checked functions, not client clock',async()=>{
 const calls=[];const store=watchStore({query:async(sql,args)=>{calls.push({sql,args});return {rows:[{accepted:true}]};}},async()=>false);
 assert.equal(await store.putWatchIfActive('a','home',999999999999),true);
 assert.deepEqual(calls[0].args,['a','home']);
 await store.revokeInstallationAndWatches('a',100);assert.deepEqual(calls[1].args,['a']);
});
test('limiter uses digested dimensions and fail-closed atomic result',async()=>{
 let capture;const limiter={consume:async(...args)=>{capture=args;return false;}};
 assert.equal(await allowEnrollment(limiter,{ip:'192.0.2.1',browser:'browser',subscription:'sub'},100),false);
 assert.equal(capture[0].length,4);assert.equal(capture[0][0],'global');assert.ok(!JSON.stringify(capture).includes('192.0.2.1'));
 assert.equal(await allowEnrollment({consume:()=>assert.fail()},{ip:'',browser:'a',subscription:'b'},100),false);
});
test('limiter and enrollment adapters invoke server-clock atomic DB contracts',async()=>{
 const {limiterStore,enrollmentStore}=await import('../backend/property-watch/storage.ts');
 const calls=[];const db={query:async(sql,args)=>{calls.push({sql,args});return {rows:[{accepted:true}]};}};
 assert.equal(await limiterStore(db).consume(['global','ip:a','browser:a','subscription:a'],1,9999999,999999),true);
 assert.deepEqual(calls[0].args,[['global','ip:a','browser:a','subscription:a']]);
 assert.equal(await enrollmentStore(db).consumeAndEnroll({challengeId:'c',browserDigest:'a',receiptDigest:'b',installationDigest:'d',now:999999}),true);
 assert.deepEqual(calls[1].args,['c','a','b','d']);
});
