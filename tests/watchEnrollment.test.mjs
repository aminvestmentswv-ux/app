import test from 'node:test';
import assert from 'node:assert/strict';
import {finishEnrollment,digest,opaqueToken,ENROLLMENT_ENABLED} from '../backend/property-watch/enrollment.ts';
const proof = {challengeId:'challenge1',browserSecret:'a'.repeat(64),receiptSecret:'b'.repeat(64)};
test('enrollment is disabled by default and cannot reach storage', async()=>{
  assert.equal(ENROLLMENT_ENABLED,false);
  await assert.rejects(finishEnrollment({consumeAndEnroll:()=>assert.fail()},proof,100), /unavailable/);
});
test('only bounded two-secret proof is accepted; caller cannot select subscription',async()=>{
  for(const input of [null,[],{...proof,subscriptionId:'victim'},{...proof,receiptSecret:'bad'},{...proof,browserSecret:''}])
    await assert.rejects(finishEnrollment({consumeAndEnroll:()=>assert.fail()},input,100,true), /Invalid proof/);
});
test('single-use consumption receives digests only and receipt replay fails',async()=>{
  let used=false; let saved;
  const store={consumeAndEnroll:async data=>{if(used)return false;used=true;saved=data;return true;}};
  const {token}=await finishEnrollment(store,proof,100,true);
  assert.match(token,/^[0-9a-f]{64}$/);
  assert.equal(saved.browserDigest,await digest(proof.browserSecret));
  assert.equal(saved.receiptDigest,await digest(proof.receiptSecret));
  assert.equal(saved.installationDigest,await digest(token));
  assert.ok(!JSON.stringify(saved).includes(proof.browserSecret));
  await assert.rejects(finishEnrollment(store,proof,101,true), /expired or invalid/);
});
test('expired or rejected proof does not return a bearer credential',async()=>{
  await assert.rejects(finishEnrollment({consumeAndEnroll:async()=>false},proof,100,true), /expired or invalid/);
  assert.notEqual(opaqueToken(),opaqueToken());
});
