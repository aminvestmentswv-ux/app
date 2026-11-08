// Keep equivalent to scripts/refresh_schedule.py. No timestamps are rewritten.
export const MAX_INVENTORY_AGE_MS = 4 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const localClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function hourAt(value: number): number {
  return Number(localClock.formatToParts(value).find((part) => part.type === 'hour')?.value);
}
export function inventoryIsCurrent(checkedAt: string, now = Date.now()): boolean {
  const checked = Date.parse(checkedAt);
  const age = now - checked;
  if (!Number.isFinite(age) || age < -300_000) return false;
  if (age <= MAX_INVENTORY_AGE_MS) return true;
  // Scan real UTC hours, so DST folds/gaps and date rollovers remain unambiguous.
  const slot = Math.floor((now - 17 * 60_000) / HOUR) * HOUR + 17 * 60_000;
  let evening: number | undefined;
  let morning: number | undefined;
  for (let candidate = slot; candidate >= slot - 36 * HOUR; candidate -= HOUR) {
    const hour = hourAt(candidate);
    if (hour === 7 && morning === undefined) morning = candidate;
    if (hour === 21) { evening = candidate; break; }
  }
  if (evening === undefined || checked < evening - HOUR) return false;
  // Before today's first slot there is no morning candidate after evening.
  return morning === undefined || now < morning + HOUR;
}
