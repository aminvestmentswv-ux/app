// Only fixed failure categories leave the transport. Never log URLs or close reasons.
export function observeTail(ws,onMessage,{interval=setInterval,clear=clearInterval,timeout=setTimeout,cancel=clearTimeout}={}){
 const state={lost:false,reason:null};let heartbeat,opening,pong=true,settled=false,resolveReady,rejectReady;
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
 const stopTimers=()=>{if(heartbeat!==undefined)clear(heartbeat);if(opening!==undefined)cancel(opening);};
 const fail=reason=>{
  if(state.lost)return;state.lost=true;state.reason=reason;stopTimers();
  if(!settled){settled=true;rejectReady(Error('tail unavailable'));}
  ws.terminate();
 };
 ws.on('error',()=>fail('error'));ws.on('close',()=>fail('closed'));
 ws.on('message',raw=>{if(!state.lost)onMessage(raw);});
 ws.on('pong',()=>{pong=true;});
 ws.once('open',()=>{
  if(state.lost)return;
  cancel(opening);
  try{ws.send(JSON.stringify({debug:false}));}catch{fail('handshake');return;}
  heartbeat=interval(()=>{
   if(!pong||ws.readyState!==1){fail('heartbeat');return;}
   pong=false;try{ws.ping();}catch{fail('heartbeat');}
  },30000);
  settled=true;resolveReady();
 });
 opening=timeout(()=>fail('open_timeout'),20000);
 return {state,ready,stop(){stopTimers();ws.terminate();}};
}
export async function waitForResult(state,result,deadline,{clock=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 while(clock()<deadline&&result()==='unverified'&&!state.lost)await sleep(1000);
 return state.lost?'transport_failed':result();
}
