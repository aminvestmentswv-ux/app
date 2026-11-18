/** Disabled enrollment core. A subscription UUID or SDK token alone is not ownership proof. */
export const ENROLLMENT_ENABLED = false;
export type Challenge = {
  id: string; browserDigest: string; receiptDigest: string;
  subscriptionId: string; expiresAt: number; consumedAt: number | null;
};
export interface EnrollmentStore {
  // Must atomically consume once and create verified installation. Failed conditions
  // leave no installation. Store only token digest; raw bearer returned once.
  consumeAndEnroll(input: {challengeId: string; browserDigest: string; receiptDigest: string;
    installationDigest: string; now: number}): Promise<boolean>;
}
export async function digest(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}
export function opaqueToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function finishEnrollment(store: EnrollmentStore, input: unknown, now: number,
  enabled = ENROLLMENT_ENABLED): Promise<{token: string}> {
  if (!enabled) throw new Error('Enrollment unavailable');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid proof');
  const data = input as Record<string, unknown>;
  if (Object.keys(data).sort().join(',') !== 'browserSecret,challengeId,receiptSecret') throw new Error('Invalid proof');
  if (typeof data.challengeId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.challengeId)
    || typeof data.browserSecret !== 'string' || !/^[0-9a-f]{64}$/.test(data.browserSecret)
    || typeof data.receiptSecret !== 'string' || !/^[0-9a-f]{64}$/.test(data.receiptSecret)
    || !Number.isSafeInteger(now) || now<=0) throw new Error('Invalid proof');
  const token = opaqueToken();
  const accepted = await store.consumeAndEnroll({challengeId:data.challengeId,
    browserDigest:await digest(data.browserSecret),receiptDigest:await digest(data.receiptSecret),
    installationDigest:await digest(token),now});
  if (!accepted) throw new Error('Proof expired or invalid');
  return {token};
}
