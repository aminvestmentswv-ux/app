export const QUERY = `SELECT current_user='property_watch_runtime' AS correct_role,
NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS restricted,
NOT has_table_privilege(current_user,'property_watch.settings','UPDATE') AS settings_locked,
NOT has_schema_privilege(current_user,'property_watch','CREATE') AS schema_locked,
NOT has_table_privilege(current_user,'auth.users','SELECT') AS auth_locked,
(SELECT delivery_enabled=false FROM property_watch.settings LIMIT 1) AS delivery_paused
FROM pg_roles WHERE rolname=current_user`;
const checks=['correct_role','restricted','settings_locked','schema_locked','auth_locked','delivery_paused'];
export async function probe(makeClient) {
 let client;
 try {
  client=makeClient(); client.on('error',()=>{});
  await client.connect();
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout='5s'");
  const result=await client.query(QUERY);
  const ok=result.rows.length===1 && checks.every(k=>result.rows[0][k]===true);
  await client.query('ROLLBACK');
  return ok?'verified':'failed';
 } catch { return 'failed'; }
 finally { if(client)try{await client.end();}catch{} }
}
export function handler(makeClient,minute,emit=()=>{},clock=Date.now) {
 return {
  fetch(){return new Response('Property watch is not enabled.',{status:503,headers:{'cache-control':'no-store'}});},
  async scheduled(event,env){
   const now=clock();
   if(!Number.isSafeInteger(minute)||minute<=0||minute%60000!==0||event.scheduledTime!==minute||now<minute||now>minute+60000)return;
   const result=await probe(()=>makeClient(env));
   emit('WATCH_PROBE_'+(result==='verified'?'VERIFIED':'FAILED'));
  }
 };
}
