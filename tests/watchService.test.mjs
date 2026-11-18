import test from 'node:test';
import assert from 'node:assert/strict';
import { changeWatch } from '../backend/property-watch/service.ts';
const token = 'x'.repeat(43);
function fixture(overrides = {}) {
  const writes = [];
  const store = {
    authenticate: async () => ({id:'a', subscriptionId:'sa', verifiedAt:10, revokedAt:null, expiresAt:1000}),
    eligibleProperty: async () => true,
    putWatchIfActive: async (...args) => {writes.push(['watch', ...args]); return true;},
    removeWatch: async (...args) => writes.push(['unwatch', ...args]),
    revokeInstallationAndWatches: async (...args) => writes.push(['revoke', ...args]), ...overrides,
  };
  return { store, writes };
}
const request = { action:'watch', propertyId:'home', consentVersion:'price-drop-v1' };
test('verified installation only and explicit versioned consent', async () => {
  const {store,writes} = fixture();
  assert.deepEqual(await changeWatch(store, token, request, 100), {watching:true});
  assert.deepEqual(writes, [['watch','a','home',100]]);
  await assert.rejects(changeWatch(store,token,{...request,consentVersion:undefined},100), /Consent/);
});
test('client cannot pick another device or inject subscription identity', async () => {
  const {store,writes} = fixture();
  for (const key of ['installationId','subscriptionId','userId'])
    await assert.rejects(changeWatch(store,token,{...request,[key]:'victim'},100), /Invalid request/);
  assert.equal(writes.length,0);
});
test('missing, expired, unverified and revoked devices fail closed', async () => {
  for (const device of [null,{verifiedAt:0},{verifiedAt:10,expiresAt:50,revokedAt:null},{verifiedAt:10,expiresAt:1000,revokedAt:20}]) {
    const {store,writes} = fixture({authenticate:async()=>device});
    await assert.rejects(changeWatch(store,token,request,100), /Unauthorized/);
    assert.equal(writes.length,0);
  }
});
test('unwatch and global revoke target only authenticated installation', async () => {
  const {store,writes} = fixture();
  await changeWatch(store,token,{action:'unwatch',propertyId:'home'},100);
  await changeWatch(store,token,{action:'revoke-all'},100);
  assert.deepEqual(writes,[['unwatch','a','home'],['revoke','a',100]]);
});
test('unavailable properties and concurrent revocation never promise success', async () => {
  await assert.rejects(changeWatch(fixture({eligibleProperty:async()=>false}).store,token,request,100), /not available/);
  await assert.rejects(changeWatch(fixture({putWatchIfActive:async()=>false}).store,token,request,100), /off/);
});
