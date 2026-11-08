import { parseBuyerAgent, type BuyerAgent } from './buyerAgent.ts';

export interface BuyerAgentStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
}
export type BuyerAgentState = {
  agent: BuyerAgent | null; ready: boolean; saving: boolean; feedback: string;
};
export function decodeSavedAgent(raw: string): BuyerAgent {
  if (raw.length > 1024) throw new Error('Invalid saved agent');
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('Invalid saved agent');
  const record = data as Record<string, unknown>;
  if (record.version !== 1 || typeof record.name !== 'string' || typeof record.phone !== 'string') {
    throw new Error('Invalid saved agent');
  }
  return parseBuyerAgent(record.name, record.phone);
}
export function encodeSavedAgent(agent: BuyerAgent): string {
  const valid = parseBuyerAgent(agent.name, agent.phone);
  return JSON.stringify({ version: 1, name: valid.name, phone: valid.phone });
}
export function createBuyerAgentStore(storage: BuyerAgentStorage) {
  let state: BuyerAgentState = { agent: null, ready: false, saving: false, feedback: '' };
  let loading: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: BuyerAgentState) => { state = next; listeners.forEach((fn) => fn()); };
  const initialize = () => {
    if (!loading) loading = Promise.resolve().then(async () => {
      try {
        const raw = await storage.read();
        publish({ ...state, agent: raw === null ? null : decodeSavedAgent(raw), ready: true, feedback: '' });
      } catch {
        publish({ ...state, ready: true, feedback: 'Could not read your saved agent. Try saving it again, or clear the saved contact.' });
      }
    });
    return loading;
  };
  const update = async (agent: BuyerAgent | null): Promise<boolean> => {
    // Prevent a late read or double tap from overwriting a newer operation.
    if (!state.ready || state.saving) return false;
    let encoded: string | null;
    try { encoded = agent === null ? null : encodeSavedAgent(agent); }
    catch {
      publish({ ...state, feedback: 'Check the agent name and phone number.' });
      return false;
    }
    publish({ ...state, saving: true, feedback: '' });
    try {
      if (encoded === null) await storage.remove();
      else await storage.write(encoded);
      publish({ ...state, agent: encoded === null ? null : decodeSavedAgent(encoded), saving: false,
        feedback: encoded === null ? 'Saved agent cleared from this app.' : 'Agent saved on this device.' });
      return true;
    } catch {
      publish({ ...state, saving: false,
        feedback: encoded === null ? 'Could not clear the saved agent. Try again before leaving this device.' : 'Could not save your agent. Check device storage and try again.' });
      return false;
    }
  };
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    initialize,
    update,
  };
}
export type BuyerAgentController = BuyerAgentState & { update: (agent: BuyerAgent | null) => Promise<boolean> };
