/** Disabled groundwork only. No persistence, UI subscription, network, or sender integration. */
export type WatchPrice = { id: string; status: string; price?: number };
export type DeviceWatch = { propertyId: string; subscriptionId: string; optedIn: boolean; startedAt: number };
export type PriceBaseline = { checkedAt: number; properties: WatchPrice[] };
export type PriceDrop = { propertyId: string; oldPrice: number; newPrice: number; observedAt: number };
export const PROPERTY_WATCH_DELIVERY_ENABLED = false;
const eligible = (p: WatchPrice) => (p.status === 'available' || p.status === 'coming-soon') && typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0;

/** Fresh baseline required. Missing/old snapshots seed silently; no historical replay. */
export function priceDrops(previous: PriceBaseline | null, current: PriceBaseline, maxGapMs = 3 * 60 * 60 * 1000): PriceDrop[] {
  if (!previous || !Number.isFinite(current.checkedAt) || !Number.isFinite(previous.checkedAt)
    || current.checkedAt <= previous.checkedAt || current.checkedAt - previous.checkedAt > maxGapMs) return [];
  const unique = (properties: WatchPrice[]) => new Set(properties.map(p => p.id)).size === properties.length;
  if (!unique(previous.properties) || !unique(current.properties)) throw new Error('Duplicate property IDs');
  const old = new Map(previous.properties.map(p => [p.id, p]));
  return current.properties.flatMap(p => {
    const before = old.get(p.id);
    return before && eligible(before) && eligible(p) && p.price! < before.price!
      ? [{ propertyId: p.id, oldPrice: before.price!, newPrice: p.price!, observedAt: current.checkedAt }] : [];
  });
}

/** Subscription-specific consent, never an audience segment or all subscribers. */
export function priceDropTargets(drop: PriceDrop, watches: DeviceWatch[], baselineAt: number, activeSubscriptionIds: ReadonlySet<string>): string[] {
  if (!Number.isFinite(baselineAt) || baselineAt >= drop.observedAt) return [];
  return [...new Set(watches.filter(w => w.propertyId === drop.propertyId && w.optedIn
    && w.subscriptionId.trim() !== '' && activeSubscriptionIds.has(w.subscriptionId)
    && Number.isFinite(w.startedAt) && w.startedAt <= baselineAt).map(w => w.subscriptionId))];
}

/** A watch on one installation cannot remove another installation's watch. */
export function stopWatching(watches: DeviceWatch[], propertyId: string, subscriptionId: string): DeviceWatch[] {
  return watches.filter(w => w.propertyId !== propertyId || w.subscriptionId !== subscriptionId);
}
