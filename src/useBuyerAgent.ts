import { useEffect, useState, useSyncExternalStore } from 'react';
import { buyerAgentStorage } from './buyerAgentStorage';
import { createBuyerAgentStore, type BuyerAgentController } from './buyerAgentStore';

export function useBuyerAgent(): BuyerAgentController {
  const [store] = useState(() => createBuyerAgentStore(buyerAgentStorage));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { void store.initialize(); }, [store]);
  return { ...state, update: store.update };
}
