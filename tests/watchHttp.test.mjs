import test from 'node:test';import assert from 'node:assert/strict';
import {handleWatch,WATCH_API_ENABLED} from '../backend/property-watch/http.ts';
const headers={Origin:'https://app.aminvestmentswv.com','Content-Type':'application/json',Authorization:'Bearer '+'a'.repeat(43)};
const req=(body='{}',more={})=>new Request('https://example.invalid/watch',{method:'POST',body,headers,...more});
const store={authenticate:async()=>null};
test('default handler fails closed',async()=>{assert.equal(WATCH_API_ENABLED,false);assert.equal((await handleWatch(req(),store)).status,503);});
test('rejects origin, unauthenticated, malformed, oversized and non-JSON requests',async()=>{
 for(const [r,status] of [[req('{}',{headers:{...headers,Origin:'https://evil.invalid'}}),403],[req('{}',{headers:{...headers,Authorization:''}}),401],[req('x'),400],[req('x'.repeat(4097)),413],[req('{}',{headers:{...headers,'Content-Type':'text/plain'}}),415]])
  assert.equal((await handleWatch(r,store,true)).status,status);
});
test('transport errors never echo secrets or internal errors',async()=>{
 const response=await handleWatch(req(),{authenticate:async()=>{throw Error('secret-credential');}},true);
 assert.equal(response.status,503);assert.ok(!(await response.text()).includes('secret-credential'));
 assert.equal(response.headers.get('Cache-Control'),'no-store');
});
