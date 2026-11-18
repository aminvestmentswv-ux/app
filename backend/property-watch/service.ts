/** Server-only domain layer. Production adapters and delivery remain disabled. */
export type Installation = { id: string; subscriptionId: string; verifiedAt: number; revokedAt: number | null; expiresAt: number };
export type Watch = { installationId: string; propertyId: string; startedAt: number };
export interface Store {
  // Authenticated identity is derived from a hashed bearer token, NEVER request IDs.
  authenticate(token: string): Promise<Installation | null>;
  eligibleProperty(id: string): Promise<boolean>;
  putWatchIfActive(installationId: string, propertyId: string, now: number): Promise<boolean>;
  removeWatch(installationId: string, propertyId: string): Promise<void>;
  revokeInstallationAndWatches(installationId: string, now: number): Promise<void>;
}
export class WatchError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export async function changeWatch(store: Store, token: string, input: unknown, now: number) {
  if (!Number.isSafeInteger(now) || now <= 0) throw new WatchError(503, 'Unavailable');
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) throw new WatchError(401, 'Unauthorized');
  const device = await store.authenticate(token);
  if (!device || !device.verifiedAt || device.verifiedAt > now || device.expiresAt <= now || device.revokedAt !== null)
    throw new WatchError(401, 'Unauthorized');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new WatchError(400, 'Invalid request');
  const data = input as Record<string, unknown>;
  // Reject unknown fields, especially forged installation/subscription identifiers.
  if (Object.keys(data).some(k => !['action', 'propertyId', 'consentVersion'].includes(k))) throw new WatchError(400, 'Invalid request');
  if (data.action === 'revoke-all') {
    await store.revokeInstallationAndWatches(device.id, now);
    return { watching: false };
  }
  if (typeof data.propertyId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.propertyId)) throw new WatchError(400, 'Invalid property');
  if (data.action === 'unwatch') {
    await store.removeWatch(device.id, data.propertyId);
    return { watching: false };
  }
  if (data.action !== 'watch' || data.consentVersion !== 'price-drop-v1') throw new WatchError(400, 'Consent required');
  if (!await store.eligibleProperty(data.propertyId)) throw new WatchError(409, 'Property is not available');
  // Adapter must atomically lock and recheck active verified installation. Concurrent
  // revoke wins; re-enabling generic push cannot restore deleted watches.
  if (!await store.putWatchIfActive(device.id, data.propertyId, now)) throw new WatchError(409, 'Notifications are off');
  return { watching: true };
}
