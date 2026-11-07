import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { propertySnapshot } from './catalog';
import { createInventoryStore } from './inventoryFeed';

export function usePropertyInventory() {
  const [store] = useState(() => createInventoryStore(propertySnapshot));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    if (Platform.OS === 'web') return; // Keep the verified, bundled web publication behavior.
    void store.refresh();
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active') void store.refresh();
    });
    return () => listener.remove();
  }, [store]);
  return { ...state, refresh: store.refresh };
}
