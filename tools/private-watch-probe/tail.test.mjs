import test from 'node:test';import assert from 'node:assert/strict';import{diagnostics}from'./tail.mjs';
test('ignores arbitrary messages and secret-bearing errors',()=>{const d=diagnostics();d.ingest(JSON.stringify({exceptions:[{message:'SENSITIVE'}],logs:[{message:['SENSITIVE','WATCH_PROBE_VERIFIED SENSITIVE']}]}));assert.equal(d.state.result,'unverified');assert(!JSON.stringify(d.state).includes('SENSITIVE'));});
test('decodes Buffer tail and fixed markers',()=>{const d=diagnostics();d.ingest(Buffer.from(JSON.stringify({logs:[{message:['WATCH_PROBE_EVENT','WATCH_PROBE_STARTED','WATCH_PROBE_VERIFIED']}]})));assert.equal(d.state.result,'verified');assert.equal(d.state.events,1);assert.equal(d.state.started,1);});
test('malformed data redacts',()=>{const d=diagnostics();for(const x of['SECRET','null','{}'])d.ingest(x);assert.equal(d.state.result,'unverified');assert(!JSON.stringify(d.state).includes('SECRET'));});
test('failure category remains fixed',()=>{const d=diagnostics();d.ingest(JSON.stringify({logs:[{message:['WATCH_PROBE_CONNECTION_FAILED']}]}));assert.equal(d.state.result,'connection_failed');});

test('local trace socket parses binary payload, pongs and closes',{timeout:5000},async()=>{
 const {WebSocketServer,WebSocket}=await import('ws');
 const server=new WebSocketServer({host:'127.0.0.1',port:0,handleProtocols:()=> 'trace-v1'});
 await new Promise(r=>server.once('listening',r));
 const d=diagnostics();let peer;server.on('connection',s=>{peer=s;s.on('message',()=>s.send(Buffer.from(JSON.stringify({logs:[{message:['WATCH_PROBE_VERIFIED']}]}))));});
 const client=new WebSocket('ws://127.0.0.1:'+server.address().port,'trace-v1');
 try{
 await new Promise((r,j)=>{client.once('open',r);client.once('error',j);});
 const read=new Promise(r=>client.once('message',raw=>{d.ingest(raw);r();}));
 client.send(JSON.stringify({debug:false}));await read;assert.equal(d.state.result,'verified');
 const pong=new Promise(r=>client.once('pong',r));client.ping();await pong;
 }finally{client.terminate();if(peer)peer.terminate();await new Promise(r=>server.close(r));}
});

test('trace failures are categorical without exception text',()=>{const d=diagnostics();d.ingest(JSON.stringify({outcome:'exceededCpu',exceptions:[{message:'SECRET',stack:'SECRET'}]}));assert.equal(d.state.traceOutcome,'exceededCpu');assert.equal(d.state.exceptions,1);assert(!JSON.stringify(d.state).includes('SECRET'));});

test('timing diagnostics accept bounded numbers and fixed reasons only',()=>{
 const d=diagnostics();d.ingest(JSON.stringify({logs:[{message:['WATCH_PROBE_SKIP_EVENT_MISMATCH','WATCH_PROBE_TIMING:25:50']}]}));
 assert.equal(d.state.skipReason,'event_mismatch');assert.equal(d.state.eventOffset,25);assert.equal(d.state.clockOffset,50);
 d.ingest(JSON.stringify({logs:[{message:['WATCH_PROBE_SKIP_SECRET','WATCH_PROBE_TIMING:SECRET:50','WATCH_PROBE_TIMING:99999999:invalid']}]}));
 assert(!JSON.stringify(d.state).includes('SECRET'));assert.equal(d.state.eventOffset,null);assert.equal(d.state.clockOffset,null);
});
