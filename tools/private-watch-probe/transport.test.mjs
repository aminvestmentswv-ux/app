import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {observeTail,waitForResult} from './transport.mjs';
function rig(){
 const ws=new EventEmitter();ws.readyState=1;ws.send=()=>{};ws.ping=()=>{};ws.terminate=()=>{ws.terminated=true;};
 let beat,opening,cleared=0,canceled=0;
 const timers={interval:fn=>(beat=fn,1),clear:()=>{cleared++;},timeout:fn=>(opening=fn,2),cancel:()=>{canceled++;}};
 const observer=observeTail(ws,()=>{},timers);
 return {ws,observer,beat:()=>beat(),expire:()=>opening(),cleared:()=>cleared,canceled:()=>canceled};
}
test('disconnect during opening rejects and terminates',async()=>{
 const r=rig();r.ws.emit('close',4000,Buffer.from('SECRET'));await assert.rejects(r.observer.ready,/unavailable/);
 assert.deepEqual(r.observer.state,{lost:true,reason:'closed'});assert(r.ws.terminated);
});
test('open timeout rejects and terminates',async()=>{
 const r=rig();r.expire();await assert.rejects(r.observer.ready);assert.equal(r.observer.state.reason,'open_timeout');assert(r.ws.terminated);
});
test('post-open disconnect exits wait promptly and permits awaited cleanup',async()=>{
 const r=rig();r.ws.emit('open');await r.observer.ready;let elapsed=0,cleaned=false,result;
 try{result=await waitForResult(r.observer.state,()=> 'unverified',100000,{clock:()=>elapsed,sleep:async()=>{elapsed+=1000;r.ws.emit('close');}});}
 finally{await Promise.resolve();r.observer.stop();cleaned=true;}
 assert.equal(result,'transport_failed');assert.equal(elapsed,1000);assert(cleaned);assert(r.cleared()>0);
});
test('missing heartbeat and socket errors fail closed without content',async()=>{
 for(const trigger of ['heartbeat','error']){
 const r=rig();r.ws.emit('open');await r.observer.ready;
 if(trigger==='heartbeat'){r.beat();r.beat();}else r.ws.emit('error',Error('SECRET'));
 assert(r.observer.state.lost);assert(!JSON.stringify(r.observer.state).includes('SECRET'));assert(r.ws.terminated);
 }
});
test('pong keeps transport and success exits wait',async()=>{
 const r=rig();r.ws.emit('open');await r.observer.ready;r.beat();r.ws.emit('pong');r.beat();assert(!r.observer.state.lost);
 assert.equal(await waitForResult(r.observer.state,()=> 'verified',100,{clock:()=>0,sleep:()=>{throw Error('must not wait');}}),'verified');r.observer.stop();
});
test('deadline preserves unverified rather than success',async()=>{
 const r=rig();r.ws.emit('open');await r.observer.ready;
 assert.equal(await waitForResult(r.observer.state,()=> 'unverified',100,{clock:()=>100}),'unverified');r.observer.stop();
});
test('real local WebSocket disconnect releases result wait and closes resources',{timeout:5000},async()=>{
 const {WebSocketServer,WebSocket}=await import('ws');
 const server=new WebSocketServer({host:'127.0.0.1',port:0,handleProtocols:()=> 'trace-v1'});
 await new Promise(r=>server.once('listening',r));let peer;
 server.on('connection',s=>{peer=s;s.on('message',()=>s.close(1000,'SECRET'));});
 const ws=new WebSocket('ws://127.0.0.1:'+server.address().port,'trace-v1');
 const observer=observeTail(ws,()=>{});
 try{
 await observer.ready;
 assert.equal(await waitForResult(observer.state,()=> 'unverified',Date.now()+4000,{sleep:()=>new Promise(r=>setTimeout(r,10))}),'transport_failed');
 assert.equal(observer.state.reason,'closed');assert(!JSON.stringify(observer.state).includes('SECRET'));
 }finally{observer.stop();peer?.terminate();await new Promise(r=>server.close(r));}
});
