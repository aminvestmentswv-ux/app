import test from 'node:test';import assert from 'node:assert/strict';
import {ReferenceLimiter} from '../backend/property-watch/limiter.ts';
import {issueChallenge} from '../backend/property-watch/challengeTransport.ts';
const input={subscriptionId:'00000000-0000-4000-8000-000000000001',browserSecret:'a'.repeat(64),explicitConsent:true};
test('atomic reference limiter caps concurrent attempts and expires',async()=>{
 const l=new ReferenceLimiter();const keys=['global','ip:a','browser:a','subscription:a'];
 const results=await Promise.all(Array.from({length:20},()=>l.consume(keys,100,900000,3)));
 assert.equal(results.filter(Boolean).length,3);assert.equal(await l.consume(keys,900101,900000,3),true);
});
test('transport stays disabled and no receipt leaks into response',async()=>{
 let delivered;const store={reserve:async()=>({id:'challenge'}),cancel:async()=>{}};
 const transport={deliverVerification:async(...args)=>{delivered=args;return true;}};
 await assert.rejects(issueChallenge(store,transport,input,async()=>true),/unavailable/);assert.equal(delivered,undefined);
 const result=await issueChallenge(store,transport,input,async()=>true,true);
 assert.deepEqual(result,{challengeId:'challenge',pending:true});assert.ok(!JSON.stringify(result).includes(delivered[1]));
});
test('rate limit and no consent never call transport; failure cancels challenge',async()=>{
 const never={reserve:()=>assert.fail(),cancel:()=>assert.fail()};
 await assert.rejects(issueChallenge(never,{},input,async()=>false,true),/later/);
 await assert.rejects(issueChallenge(never,{}, {...input,explicitConsent:false},async()=>true,true),/Invalid/);
 let cancelled;await assert.rejects(issueChallenge({reserve:async()=>({id:'c'}),cancel:async id=>{cancelled=id;}},{deliverVerification:async()=>{throw Error('private');}},input,async()=>true,true),/could not/);assert.equal(cancelled,'c');
});
