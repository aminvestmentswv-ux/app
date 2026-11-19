// Narrow decoder: only fixed probe markers and aggregate counters leave the process.
const allowed=new Set(['WATCH_PROBE_EVENT','WATCH_PROBE_SKIPPED','WATCH_PROBE_STARTED','WATCH_PROBE_VERIFIED','WATCH_PROBE_CHECKS_FAILED','WATCH_PROBE_CONNECTION_FAILED','WATCH_PROBE_QUERY_FAILED']);
export function diagnostics(){
 const state={messages:0,parsed:0,invalid:0,events:0,skipped:0,started:0,result:'unverified',traceOutcome:'unseen',exceptions:0,skipReason:'unseen',eventOffset:null,clockOffset:null};
 return {state,ingest(raw){
  state.messages++;
  try{const e=JSON.parse(typeof raw==='string'?raw:Buffer.from(raw).toString('utf8'));state.parsed++;if(['ok','exception','exceededCpu','exceededMemory','canceled','unknown'].includes(e?.outcome))state.traceOutcome=e.outcome;if(Array.isArray(e?.exceptions))state.exceptions+=e.exceptions.length;
   for(const log of e.logs??[])for(const m of log.message??[]){
    if(typeof m!=='string')continue;
    const reason=/^WATCH_PROBE_SKIP_(UNARMED|EVENT_INVALID|EVENT_MISMATCH|CLOCK_INVALID|CLOCK_EARLY|CLOCK_LATE)$/.exec(m);
    if(reason){state.skipReason=reason[1].toLowerCase();continue;}
    const timing=/^WATCH_PROBE_TIMING:(invalid|-?\d{1,8}):(invalid|-?\d{1,8})$/.exec(m);
    if(timing){
     const safe=x=>x==='invalid'?null:Math.abs(Number(x))<=86400000?Number(x):null;
     state.eventOffset=safe(timing[1]);state.clockOffset=safe(timing[2]);continue;
    }
    if(!allowed.has(m))continue;
    if(m==='WATCH_PROBE_EVENT')state.events++;
    else if(m==='WATCH_PROBE_SKIPPED')state.skipped++;
    else if(m==='WATCH_PROBE_STARTED')state.started++;
    else state.result=m.slice('WATCH_PROBE_'.length).toLowerCase();
   }
  }catch{state.invalid++;}
 }};
}
