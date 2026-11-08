import { decodeSavedAgent, type BuyerAgentStorage } from './buyerAgentStore.ts';

export interface AgentFile {
  exists: boolean;
  size: number;
  text(): Promise<string>;
  write(value: string): Promise<void>;
  delete(): void;
}
type RecordValue = { version: 1; revision: number; value: string | null };
type Slot = { file: AgentFile; record: RecordValue | null; present: boolean };

function decode(raw: string): RecordValue {
  if (raw.length > 4096) throw new Error('Invalid saved agent');
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('Invalid saved agent');
  const record = data as Record<string, unknown>;
  if (record.version !== 1 || !Number.isSafeInteger(record.revision) || Number(record.revision) < 1 ||
      (record.value !== null && typeof record.value !== 'string')) throw new Error('Invalid saved agent');
  if (typeof record.value === 'string') decodeSavedAgent(record.value);
  return record as RecordValue;
}

// One app-level store serializes writes; do not create concurrent writers.
// Awaited writes are not a promise of fsync or survival of device power loss.
// Never overwrite the active slot. Expo overwrite-move deletes its destination
// before moving on both platforms, so it cannot provide a safe replacement here.
export function createBuyerAgentFileStorage(files: { slots(): [AgentFile, AgentFile] }): BuyerAgentStorage {
  const readSlots = async (): Promise<Slot[]> => {
    const slots: Slot[] = [];
    for (const file of files.slots()) {
      if (!file.exists) { slots.push({ file, record: null, present: false }); continue; }
      // Propagate I/O errors rather than overwriting data we could not read.
      const raw = file.size > 4096 ? '' : await file.text();
      let record: RecordValue | null = null;
      try { record = decode(raw); } catch { /* Incomplete/corrupt slot is not active. */ }
      slots.push({ file, record, present: true });
    }
    if (slots[0].record && slots[1].record && slots[0].record.revision === slots[1].record.revision &&
        slots[0].record.value !== slots[1].record.value) throw new Error('Conflicting saved agent records');
    return slots;
  };
  const activeIndex = (slots: Slot[]) => {
    if (!slots[0].record) return slots[1].record ? 1 : -1;
    if (!slots[1].record) return 0;
    return slots[0].record.revision >= slots[1].record.revision ? 0 : 1;
  };
  const commit = async (value: string | null, slots: Slot[]): Promise<number> => {
    const active = activeIndex(slots);
    const revision = active < 0 ? 1 : slots[active].record!.revision + 1;
    if (!Number.isSafeInteger(revision)) throw new Error('Saved agent revision limit');
    const index = active === 0 ? 1 : 0;
    const file = slots[index].file;
    const encoded = JSON.stringify({ version: 1, revision, value });
    let failed = false;
    try { await file.write(encoded); } catch { failed = true; }
    // Some I/O failures have an uncertain outcome. Exact read-back establishes
    // completion; a truncated write leaves the previous valid slot untouched.
    if (!file.exists || file.size > 4096 || await file.text() !== encoded) {
      throw new Error(failed ? 'Could not save agent' : 'Saved agent verification failed');
    }
    return index;
  };
  return {
    read: async () => {
      const slots = await readSlots();
      const active = activeIndex(slots);
      if (active < 0) {
        if (slots.some(slot => slot.present)) throw new Error('Invalid saved agent');
        return null;
      }
      return slots[active].record!.value;
    },
    write: async value => {
      decodeSavedAgent(value);
      await commit(value, await readSlots());
    },
    remove: async () => {
      const slots = await readSlots();
      const active = activeIndex(slots);
      if (active < 0) {
        let failed = false;
        for (const slot of slots) {
          try { if (slot.file.exists) slot.file.delete(); if (slot.file.exists) failed = true; } catch { failed = true; }
        }
        if (failed) throw new Error('Could not clear saved agent');
        return;
      }
      // Keep a verified tombstone until the contact-bearing slot is deleted.
      // Interrupted clearing cannot resurrect the older contact on restart.
      const tombstone = slots[active].record!.value === null ? active : await commit(null, slots);
      const other = slots[1 - tombstone].file;
      if (other.exists) other.delete();
      if (other.exists) throw new Error('Could not clear saved agent');
      const marker = slots[tombstone].file;
      if (marker.exists) marker.delete();
      if (marker.exists) throw new Error('Could not clear saved agent');
    },
  };
}
