import {digest} from './enrollment.ts';
import type {Installation, Store} from './service.ts';
export interface QueryClient { query<T>(sql:string, parameters:unknown[]):Promise<{rows:T[]}>; }
/** Server-only parameterized DB adapter. No credentials or clients are constructed here. */
export function watchStore(db:QueryClient, eligible:(id:string)=>Promise<boolean>):Store {
 return {
  async authenticate(token:string):Promise<Installation|null>{
   const result=await db.query<Installation>(`select id, subscription_id::text as "subscriptionId",
    extract(epoch from verified_at)*1000 as "verifiedAt", extract(epoch from expires_at)*1000 as "expiresAt",
    extract(epoch from revoked_at)*1000 as "revokedAt" from property_watch.installations where token_digest=$1`,[await digest(token)]);
   const row=result.rows[0];
   if(!row)return null;
   return {...row,verifiedAt:Number(row.verifiedAt),expiresAt:Number(row.expiresAt),revokedAt:row.revokedAt===null?null:Number(row.revokedAt)};
  },
  eligibleProperty:eligible,
  async putWatchIfActive(id,property,_now){
   const r=await db.query<{accepted:boolean}>('select property_watch.set_watch($1::uuid,$2::text) as accepted',[id,property]);
   return r.rows[0]?.accepted===true;
  },
  async removeWatch(id,property){await db.query('delete from property_watch.watches where installation_id=$1::uuid and property_id=$2::text',[id,property]);},
  async revokeInstallationAndWatches(id,_now){await db.query('select property_watch.revoke_installation($1::uuid)',[id]);},
 };
}
/** Atomic limiter must be backed by one transaction, not a read-then-write pair. */
export interface LimiterStore { consume(keys:readonly string[],now:number,windowMs:number,max:number):Promise<boolean>; }
export async function allowEnrollment(limiter:LimiterStore, identities:{ip:string;browser:string;subscription:string},now:number){
 if(!Number.isSafeInteger(now)||now<=0||Object.values(identities).some(x=>!x||x.length>256))return false;
 const keys=await Promise.all(Object.entries(identities).map(async([kind,value])=>kind+':'+await digest(value)));
 // Global limit is also checked atomically; IP must come from trusted gateway, not request JSON.
 return limiter.consume(['global',...keys],now,15*60*1000,3);
}
