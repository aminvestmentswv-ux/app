/** Recovery must never restore watches or silently opt a revoked installation in. */
export type RecoveryState={subscriptionId:string;revoked:boolean;watches:readonly string[]};
export function recoveryPlan(previous:RecoveryState,proof:{subscriptionId:string;freshOwnershipVerified:boolean;explicitConsent:boolean}){
 if(!proof.freshOwnershipVerified||!proof.explicitConsent||proof.subscriptionId!==previous.subscriptionId)
  return {allowed:false as const};
 return {allowed:true as const,clearWatches:true as const,invalidateOldBearer:true as const,
  requireFreshPerPropertyConsent:true as const};
}
