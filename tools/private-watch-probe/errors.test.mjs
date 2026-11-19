import test from 'node:test';import assert from 'node:assert/strict';import {classify}from'./errors.mjs';import {probe}from'./probe.mjs';import{diagnostics}from'./tail.mjs';
test('known codes map only to fixed categories, arbitrary values are suppressed',()=>{
 for(const [code,category]of[['28P01','AUTH_REJECTED'],['42501','PERMISSION'],['ENOTFOUND','DNS'],['ETIMEDOUT','TIMEOUT'],['ERR_TLS_CERT_ALTNAME_INVALID','TLS_CERT'],['SECRET','UNKNOWN']]){
 assert.equal(classify(Object.assign(Error('SECRET'),{code,detail:'SECRET',stack:'SECRET'})),category);
 }
 assert.equal(classify(new TypeError('SECRET')),'TYPE');assert.equal(classify(new ReferenceError('SECRET')),'REFERENCE');
 assert.equal(classify(new Proxy({},{get(){throw Error('SECRET');}})),'UNKNOWN');
});
test('constructor and authentication failures are distinct without raw output',async()=>{
 for(const stage of ['construct','connect']){
 const logs=[];
 await probe(()=>{if(stage==='construct')throw new ReferenceError('SECRET');return{on(){},async connect(){throw Object.assign(Error('SECRET'),{code:'28P01'});},async end(){}};},x=>logs.push(x));
 assert(logs.includes(stage==='construct'?'WATCH_PROBE_ERROR_CONSTRUCT_REFERENCE':'WATCH_PROBE_ERROR_CONNECT_AUTH_REJECTED'));
 assert(!logs.join().includes('SECRET'));
 }
});
test('tail filters unknown categories and raw error details',()=>{
 const d=diagnostics();d.ingest(JSON.stringify({logs:[{message:['WATCH_PROBE_ERROR_CONNECT_AUTH_REJECTED','WATCH_PROBE_MILESTONE_CONSTRUCTED','WATCH_PROBE_ERROR_CONNECT_SECRET','WATCH_PROBE_MILESTONE_SECRET']}]}));
 assert.equal(d.state.errorStage,'connect');assert.equal(d.state.errorCategory,'auth_rejected');assert.deepEqual(d.state.milestones,['CONSTRUCTED']);assert(!JSON.stringify(d.state).includes('SECRET'));
});

test('known exact library/provider messages categorize without reflecting data',()=>{
 for(const [message,category]of [
 ['Tenant or user not found','POOLER_ROUTING'],
 ['SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string','CREDENTIAL_FORMAT'],
 ['SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match','SASL_INTEGRITY'],
 ['startTls() is not supported on this connection.','TLS_UNSUPPORTED'],
 ['Connection terminated unexpectedly','CONNECTION_CLOSED']]){
 assert.equal(classify(Error(message)),category);
 assert.equal(classify(Error(message+' SECRET')),'UNKNOWN');
 }
});
test('new categories are decoded but arbitrary suffixes cannot escape',()=>{
 const d=diagnostics();d.ingest(JSON.stringify({logs:[{message:['WATCH_PROBE_ERROR_CONNECT_POOLER_ROUTING','WATCH_PROBE_ERROR_CONNECT_POOLER_ROUTING_SECRET']}]}));
 assert.equal(d.state.errorCategory,'pooler_routing');assert(!JSON.stringify(d.state).includes('SECRET'));
});
