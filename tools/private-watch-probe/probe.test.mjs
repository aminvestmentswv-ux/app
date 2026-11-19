import test from 'node:test';import assert from 'node:assert/strict';import {probe,handler,QUERY}from'./probe.mjs';
const good={correct_role:true,restricted:true,settings_locked:true,schema_locked:true,auth_locked:true,delivery_paused:true};
function fake(row=good,fail=''){const calls=[];return {calls,factory:()=>({on(){},async connect(){calls.push('connect');if(fail==='connect')throw Error('SECRET');},async query(q){calls.push(q);if(fail==='query')throw Error('SECRET');return{rows:row===null?[]:[row]};},async end(){calls.push('end');}})};}
test('read-only success and close',async()=>{const f=fake();assert.equal(await probe(f.factory),'verified');assert.deepEqual(f.calls,['connect','BEGIN READ ONLY',"SET LOCAL statement_timeout='5s'",QUERY,'ROLLBACK','end']);});
for(const k of Object.keys(good))test('fails closed '+k,async()=>assert.equal(await probe(fake({...good,[k]:false}).factory),'checks_failed'));
for(const failure of['connect','query'])test('sanitized '+failure,async()=>{const f=fake(good,failure);assert.equal(await probe(f.factory),failure==='connect'?'connection_failed':'query_failed');assert.equal(f.calls.at(-1),'end');});
test('missing row',async()=>assert.equal(await probe(fake(null).factory),'checks_failed'));
test('unarmed skips secrets',async()=>{await handler(()=>{throw Error('secret read');},0).scheduled({scheduledTime:60000},new Proxy({},{get(){throw Error('secret read');}}));});
test('exact minute and bounded clock',async()=>{let n=0;const logs=[];for(const [minute,eventTime,now]of[[120000,60000,120000],[120000,120000,119999],[120000,120000,180001],[120001,120001,120001]])await handler(()=>{n++;return fake().factory();},minute,x=>logs.push(x),()=>now).scheduled({scheduledTime:eventTime},{});assert.equal(n,0);await handler(()=>{n++;return fake().factory();},120000,x=>logs.push(x),()=>120000).scheduled({scheduledTime:120000},{});assert.equal(n,1);assert.deepEqual(logs.filter(x=>!x.startsWith('WATCH_PROBE_TIMING:')&&!x.startsWith('WATCH_PROBE_SKIP_')),['WATCH_PROBE_EVENT','WATCH_PROBE_SKIPPED','WATCH_PROBE_EVENT','WATCH_PROBE_SKIPPED','WATCH_PROBE_EVENT','WATCH_PROBE_SKIPPED','WATCH_PROBE_EVENT','WATCH_PROBE_SKIPPED','WATCH_PROBE_EVENT','WATCH_PROBE_STARTED','WATCH_PROBE_VERIFIED']);});
test('HTTP never accesses secret',async()=>{const h=handler(()=>{throw Error('secret read');},120000);for(const method of['GET','POST','OPTIONS','DELETE'])assert.equal(h.fetch(new Request('https://invalid.test',{method})).status,503);});

test('each guard emits precise reason without touching credentials',async()=>{
 for(const [minute,eventTime,now,reason] of [
 [0,0,0,'UNARMED'],[120000,'120000',120000,'EVENT_INVALID'],
 [120000,120001,120001,'EVENT_MISMATCH'],[120000,120000,NaN,'CLOCK_INVALID'],
 [120000,120000,119999,'CLOCK_EARLY'],[120000,120000,180001,'CLOCK_LATE']
 ]){
 const logs=[];await handler(()=>{throw Error('must not connect');},minute,x=>logs.push(x),()=>now).scheduled({scheduledTime:eventTime},new Proxy({},{get(){throw Error('must not read secret');}}));
 assert(logs.includes('WATCH_PROBE_SKIP_'+reason));assert(!logs.includes('WATCH_PROBE_STARTED'));
 }
});
test('guard boundaries unchanged, exact event required',async()=>{
 for(const now of [120000,180000]){
 const f=fake();await handler(f.factory,120000,()=>{},()=>now).scheduled({scheduledTime:120000},{});assert(f.calls.includes('connect'));
 }
});
