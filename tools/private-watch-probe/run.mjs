import assert from 'node:assert/strict';
import WebSocket from 'ws';import {observeTail,waitForResult} from './transport.mjs';import {diagnostics} from './tail.mjs';
import {readFile,writeFile,unlink}from'node:fs/promises';import{execFileSync}from'node:child_process';
const name='am-property-watch-registry-staging',account='8129bba75a10f796d9879e727cd70680',id='accb7b47449744e3814c577e71a64d1e';
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
const base=root+'/workers/workers/'+id, script=root+'/workers/scripts/'+name;
const shell="// Private staging shell. No data, credentials, outbound calls, or enrollment.\nexport default {\n  async fetch() {\n    return new Response('Property watch is not enabled.', {\n      status: 503,\n      headers: {'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}\n    });\n  }\n};\n";
const privateWorker=x=>x?.name===name&&x?.subdomain?.enabled===false&&x?.subdomain?.previews_enabled===false&&Array.isArray(x?.references?.domains)&&x.references.domains.length===0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let stage='preflight',oldVersion,rollbackPayload,tail,ws,changed=false,scheduled=false,outcome='unverified',observer;const diagnostic=diagnostics();
async function api(url,method='GET',body){
 const r=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+process.env.CF_TOKEN,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 console.log(stage+' HTTP '+r.status);
 const d=await r.json();if(!r.ok||d.success===false){console.log('API error codes: '+(d.errors??[]).map(x=>Number.isInteger(x.code)?x.code:'unknown').join(','));throw Error('api');}
 return d.result??d;
}
async function verifyPrivacy(){assert(privateWorker(await api(base)));const sub=await api(script+'/subdomain');assert.equal(sub.enabled,false);assert.equal(sub.previews_enabled,false);}
async function verifyVersion(version,modules){
 const v=await api(base+'/versions/'+version+'?include=modules');
 assert.deepEqual(v.modules,modules);assert.equal((v.urls??[]).length,0);
 assert.deepEqual((v.bindings??[]).map(b=>({name:b.name,type:b.type})),[{name:'WATCH_DB_PASSWORD',type:'secret_text'}]);
 return v;
}
try{
 assert(process.env.CF_TOKEN);
 await verifyPrivacy();
 const sched=await api(script+'/schedules');assert(Array.isArray(sched.schedules)&&sched.schedules.length===0);
 const dep=await api(script+'/deployments');const active=dep.deployments[0];assert(active?.versions?.length===1&&active.versions[0].percentage===100);
 oldVersion=active.versions[0].version_id;assert.match(oldVersion,/^[0-9a-f-]{36}$/i);
 const old=await api(base+'/versions/'+oldVersion+'?include=modules');
 assert.equal(old.modules?.length,1);assert.equal(Buffer.from(old.modules[0].content_base64,'base64').toString(),shell);
 assert.deepEqual((old.bindings??[]).map(b=>({name:b.name,type:b.type})),[{name:'WATCH_DB_PASSWORD',type:'secret_text'}]);
 rollbackPayload={main_module:old.main_module,compatibility_date:old.compatibility_date,bindings:[{name:'WATCH_DB_PASSWORD',type:'inherit',version_id:oldVersion}],modules:old.modules};
 // Allow 20 minutes for Cron propagation; do not substitute recurring tests.
 const minute=Math.ceil((Date.now()+20*60000)/60000)*60000;
 execFileSync(process.execPath,['build.mjs',String(minute)],{stdio:'inherit',env:{PATH:process.env.PATH}});
 const code=await readFile('bundle.mjs','utf8');
 const modules=[{name:'worker.mjs',content_type:'application/javascript+module',content_base64:Buffer.from(code).toString('base64')}];
 const payload={main_module:'worker.mjs',compatibility_date:'2026-11-18',bindings:rollbackPayload.bindings,modules};
 await writeFile('.rollback.json',JSON.stringify(rollbackPayload));
 stage='deploy-readonly-probe';changed=true;
 const v=await api(base+'/versions?deploy=true','POST',payload);assert.match(v.id,/^[0-9a-f-]{36}$/i);
 await verifyVersion(v.id,modules);await verifyPrivacy();
 const date=new Date(minute),cron=date.getUTCMinutes()+' '+date.getUTCHours()+' '+date.getUTCDate()+' '+(date.getUTCMonth()+1)+' *';
 stage='arm-one-minute-readonly-probe';scheduled=true;await api(script+'/schedules','PUT',[{cron}]);
 console.log('Private probe scheduled UTC: '+date.toISOString());
 // Open a fresh short-lived observer close to the target, not 20 minutes earlier.
 // The absolute worker gate still prevents late or repeated database access.
 while(Date.now()<minute-45000)await sleep(Math.min(1000,minute-45000-Date.now()));
 stage='open-private-tail';tail=await api(script+'/tails','POST');assert.match(tail.id,/^[a-f0-9-]{32,36}$/i);await writeFile('.tail-id',tail.id);
 const u=new URL(tail.url);assert(u.protocol==='wss:'&&(u.hostname.endsWith('.cloudflare.com')||u.hostname==='tail.developers.workers.dev'));
 ws=new WebSocket(tail.url,'trace-v1');
 observer=observeTail(ws,raw=>{diagnostic.ingest(raw);outcome=diagnostic.state.result;});
 await observer.ready;
 outcome=await waitForResult(observer.state,()=>diagnostic.state.result,minute+90000);
 console.log('Tail transport category: '+(observer.state.reason??'connected'));
 console.log('Private database readiness result: '+outcome);console.log('Allowlisted tail diagnostics: '+JSON.stringify(diagnostic.state));
 if(outcome!=='verified')process.exitCode=1;
}catch{console.error('Stopped at '+stage+'; no credential or response body logged.');process.exitCode=1;}
finally{
 // Cleanup occurs on all ordinary failure paths, including uncertain API writes.
 if(scheduled)try{stage='remove-test-schedule';await api(script+'/schedules','PUT',[]);let empty=false;for(let i=0;i<15;i++){const s=await api(script+'/schedules');if(s.schedules.length===0){empty=true;break;}await sleep(2000);}assert(empty);console.log('Verified no schedules remain.');}catch{console.error('CLEANUP REQUIRED: schedule removal unverified.');process.exitCode=1;}
 if(changed&&rollbackPayload)try{stage='restore-disabled-shell';const v=await api(base+'/versions?deploy=true','POST',rollbackPayload);await verifyVersion(v.id,rollbackPayload.modules);await verifyPrivacy();console.log('Verified disabled shell restored: '+v.id);}catch{console.error('CLEANUP REQUIRED: disabled shell restoration unverified.');process.exitCode=1;}
 if(observer)observer.stop();else if(ws)ws.terminate();
 if(tail?.id)try{stage='close-private-tail';await api(script+'/tails/'+tail.id,'DELETE');}catch{console.error('CLEANUP REQUIRED: tail deletion unverified.');process.exitCode=1;}
}

// All cleanup awaited above. Do not let an orphan tail socket keep this job alive.
process.exit(process.exitCode??0);
