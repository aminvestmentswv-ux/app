import { parseSnapshot, type PropertySnapshot } from './properties.ts';

// Published by the existing verified Pages workflow, never by a device.
export const INVENTORY_FEED_URL = 'https://app.aminvestmentswv.com/properties.json';
export { MAX_INVENTORY_AGE_MS } from './inventoryFreshness.ts';
import { inventoryIsCurrent } from './inventoryFreshness.ts';
const MAX_FEED_CHARACTERS = 5_000_000;

type Fetcher = typeof fetch;
export async function fetchPropertySnapshot(
  current: PropertySnapshot,
  { fetcher = fetch, now = Date.now(), timeoutMs = 12_000 }: { fetcher?: Fetcher; now?: number; timeoutMs?: number } = {},
): Promise<PropertySnapshot> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Inventory request timed out')); }, timeoutMs);
    });
    const request = async () => {
      const response = await fetcher(`${INVENTORY_FEED_URL}?check=${now}`, {
        signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok || !/^application\/json(?:;|$)/i.test(response.headers.get('Content-Type') ?? '')) {
        throw new Error('Inventory endpoint did not return JSON');
      }
      // React Native's networking implementation may follow redirects despite redirect:error.
      if (response.url && new URL(response.url).origin !== new URL(INVENTORY_FEED_URL).origin) {
        throw new Error('Inventory redirected to an unexpected destination');
      }
      const length = Number(response.headers.get('Content-Length'));
      if (length > MAX_FEED_CHARACTERS) throw new Error('Inventory response is too large');
      const body = await response.text();
      if (body.length > MAX_FEED_CHARACTERS) throw new Error('Inventory response is too large');
      const next = parseSnapshot(JSON.parse(body));
      if (!inventoryIsCurrent(next.checkedAt, now)) throw new Error('Published inventory is not current');
      if (Date.parse(next.checkedAt) < Date.parse(current.checkedAt)) throw new Error('Published inventory is older than the saved inventory');
      return next;
    };
    return await Promise.race([request(), timedOut]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
  }
}

export type InventoryState = { snapshot: PropertySnapshot; refreshing: boolean; feedback: string };
export function createInventoryStore(initial: PropertySnapshot, load = fetchPropertySnapshot) {
  let state: InventoryState = { snapshot: initial, refreshing: false, feedback: 'Showing the inventory saved with this app.' };
  const listeners = new Set<() => void>();
  let pending: Promise<void> | undefined;
  const publish = (next: InventoryState) => { state = next; listeners.forEach((listener) => listener()); };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh: () => {
      if (pending) return pending;
      // Start in a microtask so every caller sees the same in-flight promise.
      pending = Promise.resolve().then(async () => {
        publish({ ...state, refreshing: true, feedback: 'Checking for property updates…' });
        try {
          const snapshot = await load(state.snapshot);
          publish({ snapshot, refreshing: false, feedback: 'Loaded the latest published website inventory.' });
        } catch {
          publish({ ...state, refreshing: false, feedback: 'Could not get a current update. Showing saved inventory; availability may have changed.' });
        } finally { pending = undefined; }
      });
      return pending;
    },
  };
}
