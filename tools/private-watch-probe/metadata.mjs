// GET-only visibility retry. Callers retain all exact content/privacy assertions.
export async function readVersion(api,url,{now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),budgetMs=10000,maxAttempts=5}={}){
 if(!Number.isSafeInteger(budgetMs)||budgetMs<1||!Number.isSafeInteger(maxAttempts)||maxAttempts<1)throw Error('invalid retry policy');
 const deadline=now()+budgetMs;
 for(let attempt=0;attempt<maxAttempts;attempt++){
  const remaining=deadline-now();if(remaining<=0)throw Error('metadata deadline');
  try{const result=await api(url,'GET',undefined,remaining);if(now()>=deadline)throw Error('metadata deadline');return result;}
  catch(error){if(error?.status!==404||attempt===maxAttempts-1||now()>=deadline)throw Error('metadata unavailable');}
  await sleep(Math.min(1000,Math.max(0,deadline-now())));
 }
 throw Error('metadata unavailable');
}
export function assertActiveDeployment(deployments,version){
 const active=deployments?.deployments?.[0];
 if(active?.versions?.length!==1||active.versions[0].version_id!==version||active.versions[0].percentage!==100)throw Error('active deployment mismatch');
}
