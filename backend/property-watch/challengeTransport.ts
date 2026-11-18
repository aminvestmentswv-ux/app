import {digest,opaqueToken} from './enrollment.ts';
export const CHALLENGE_TRANSPORT_ENABLED=false;
export type ChallengeStore={
 reserve(subscription:string,browserDigest:string,receiptDigest:string):Promise<{id:string}|null>;
 cancel(id:string):Promise<void>;
};
export type VerificationTransport={deliverVerification(subscription:string,receiptSecret:string,challengeId:string):Promise<boolean>};
/** No real provider transport exists. The return never contains the receipt secret. */
export async function issueChallenge(store:ChallengeStore,transport:VerificationTransport,
 input:{subscriptionId:string;browserSecret:string;explicitConsent:boolean},allowed:()=>Promise<boolean>,enabled=CHALLENGE_TRANSPORT_ENABLED){
 if(!enabled)throw Error('Verification unavailable');
 if(!input.explicitConsent||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.subscriptionId)||!/^[0-9a-f]{64}$/.test(input.browserSecret))throw Error('Invalid verification request');
 if(!await allowed())throw Error('Please try again later');
 const receipt=opaqueToken();
 const row=await store.reserve(input.subscriptionId,await digest(input.browserSecret),await digest(receipt));
 if(!row)throw Error('Please try again later');
 let accepted=false;
 try{accepted=await transport.deliverVerification(input.subscriptionId,receipt,row.id);}catch{/* Never expose provider detail. */}
 if(!accepted){try{await store.cancel(row.id);}catch{/* Fail closed; expiry also prevents old proof use. */}throw Error('Verification could not be sent');}
 return {challengeId:row.id,pending:true};
}
