// Independent always-run fallback after timeout/cancellation. No response bodies logged.
import assert from 'node:assert/strict';import{readFile,unlink}from'node:fs/promises';
const account='8129bba75a10f796d9879e727cd70680',name='am-property-watch-registry-staging',id='accb7b47449744e3814c577e71a64d1e';
const root='https://api.cloudflare.com/client/v4/accounts/'+account,base=root+'/workers/workers/'+id,script=root+'/workers/scripts/'+name;
async function api(url,method='GET',body){
 const r=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+process.env.CF_TOKEN,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 console.log('cleanup HTTP '+r.status);if(!r.ok)throw Error('api');const d=await r.json();assert.notEqual(d.success,false);return d.result??d;
}
try{
 let payload;try{payload=JSON.parse(await readFile('.rollback.json','utf8'));}catch(e){if(e.code==='ENOENT')process.exit(0);throw e;}
 await api(script+'/schedules','PUT',[]);let empty=false;for(let i=0;i<15;i++){if((await api(script+'/schedules')).schedules.length===0){empty=true;break;}await new Promise(r=>setTimeout(r,2000));}assert(empty);
 const v=await api(base+'/versions?deploy=true','POST',payload);
 const r=await api(base+'/versions/'+v.id+'?include=modules');
 assert.deepEqual(r.modules,payload.modules);
 assert.deepEqual((r.bindings??[]).map(b=>({name:b.name,type:b.type})),[{name:'WATCH_DB_PASSWORD',type:'secret_text'}]);
 const state=await api(base);assert.equal(state.name,name);assert.equal(state.subdomain.enabled,false);assert.equal(state.subdomain.previews_enabled,false);
 assert(Array.isArray(state.references?.domains)&&state.references.domains.length===0);
 let tailId;try{tailId=await readFile('.tail-id','utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 if(tailId){assert.match(tailId,/^[a-f0-9-]{32,36}$/i);const tails=await api(script+'/tails');assert(Array.isArray(tails));if(tails.some(t=>t.id===tailId))await api(script+'/tails/'+tailId,'DELETE');await unlink('.tail-id');}
 await unlink('.rollback.json');console.log('Cleanup verified: disabled shell, encrypted secret preserved, workers.dev/previews disabled, no custom domains or schedules. Zone routes unchanged by this workflow.');
}catch{console.error('Cleanup unverified; inspect staging metadata before any retry. No secret or response logged.');process.exitCode=1;}
