export const QUERY = `SELECT current_user='property_watch_runtime' AS correct_role,
NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS restricted,
NOT has_table_privilege(current_user,'property_watch.settings','UPDATE') AS settings_locked,
NOT has_schema_privilege(current_user,'property_watch','CREATE') AS schema_locked,
NOT has_table_privilege(current_user,'auth.users','SELECT') AS auth_locked,
(SELECT delivery_enabled=false FROM property_watch.settings LIMIT 1) AS delivery_paused
FROM pg_roles WHERE rolname=current_user`;
const checks=['correct_role','restricted','settings_locked','schema_locked','auth_locked','delivery_paused'];
export async function probe(makeClient) {
 let client,stage='connect';
 try {
  client=makeClient(); client.on('error',()=>{});
  await client.connect();stage='query';
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout='5s'");
  const result=await client.query(QUERY);
  const ok=result.rows.length===1 && checks.every(k=>result.rows[0][k]===true);
  await client.query('ROLLBACK');
  return ok?'verified':'checks_failed';
 } catch { return stage==='connect'?'connection_failed':'query_failed'; }
 finally { if(client)try{await client.end();}catch{} }
}
export function cronFor(minute){
 const d=new Date(minute);return d.getUTCMinutes()+' '+d.getUTCHours()+' '+d.getUTCDate()+' '+(d.getUTCMonth()+1)+' *';
}
export function handler(makeClient,minute,emit=()=>{},clock=Date.now) {
 let started=false; // Reject same-isolate retries before any await; no persistent writes.

 return {
  fetch(){return new Response('Property watch is not enabled.',{status:503,headers:{'cache-control':'no-store'}});},
  async scheduled(event,env){
   emit('WATCH_PROBE_EVENT');const now=clock();
   const reason=!Number.isSafeInteger(minute)||minute<=0||minute%60000!==0?'UNARMED':
    !Number.isSafeInteger(event.scheduledTime)?'EVENT_INVALID':
    Math.floor(event.scheduledTime/60000)!==minute/60000?'EVENT_MISMATCH':
    event.cron!==cronFor(minute)?'CRON_MISMATCH':
    !Number.isSafeInteger(now)?'CLOCK_INVALID':
    now<minute?'CLOCK_EARLY':now>=minute+60000?'CLOCK_LATE':started?'DUPLICATE':null;
   const offset=value=>Number.isSafeInteger(value)&&Math.abs(value-minute)<=86400000?String(value-minute):'invalid';
   emit('WATCH_PROBE_TIMING:'+offset(event.scheduledTime)+':'+offset(now));
   if(reason){emit('WATCH_PROBE_SKIP_'+reason);emit('WATCH_PROBE_SKIPPED');return;}
   started=true;emit('WATCH_PROBE_STARTED');
   const result=await probe(()=>makeClient(env));
   emit('WATCH_PROBE_'+result.toUpperCase());
  }
 };
}
