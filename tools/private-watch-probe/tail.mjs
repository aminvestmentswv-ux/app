// Narrow decoder: only fixed probe markers and aggregate counters leave the process.
const allowed=new Set(['WATCH_PROBE_EVENT','WATCH_PROBE_SKIPPED','WATCH_PROBE_STARTED','WATCH_PROBE_VERIFIED','WATCH_PROBE_CHECKS_FAILED','WATCH_PROBE_CONNECTION_FAILED','WATCH_PROBE_QUERY_FAILED']);
export function diagnostics(){
 const state={messages:0,parsed:0,invalid:0,events:0,skipped:0,started:0,result:'unverified',traceOutcome:'unseen',exceptions:0};
 return {state,ingest(raw){
  state.messages++;
  try{const e=JSON.parse(typeof raw==='string'?raw:Buffer.from(raw).toString('utf8'));state.parsed++;if(['ok','exception','exceededCpu','exceededMemory','canceled','unknown'].includes(e?.outcome))state.traceOutcome=e.outcome;if(Array.isArray(e?.exceptions))state.exceptions+=e.exceptions.length;
   for(const log of e.logs??[])for(const m of log.message??[]){
    if(!allowed.has(m))continue;
    if(m==='WATCH_PROBE_EVENT')state.events++;
    else if(m==='WATCH_PROBE_SKIPPED')state.skipped++;
    else if(m==='WATCH_PROBE_STARTED')state.started++;
    else state.result=m.slice('WATCH_PROBE_'.length).toLowerCase();
   }
  }catch{state.invalid++;}
 }};
}
