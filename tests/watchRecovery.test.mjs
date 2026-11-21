import test from 'node:test';import assert from 'node:assert/strict';
import {recoveryPlan} from '../backend/property-watch/recovery.ts';
const old={subscriptionId:'a',revoked:true,watches:['home']};
test('recovery never resumes old watches and invalidates prior bearer',()=>{
 assert.deepEqual(recoveryPlan(old,{subscriptionId:'a',freshOwnershipVerified:true,explicitConsent:true}),
 {allowed:true,clearWatches:true,invalidateOldBearer:true,requireFreshPerPropertyConsent:true});
});
test('no takeover, stale proof or implicit reenrollment',()=>{
 for(const proof of [{subscriptionId:'b',freshOwnershipVerified:true,explicitConsent:true},{subscriptionId:'a',freshOwnershipVerified:false,explicitConsent:true},{subscriptionId:'a',freshOwnershipVerified:true,explicitConsent:false}])assert.deepEqual(recoveryPlan(old,proof),{allowed:false});
});
