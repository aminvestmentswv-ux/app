import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { propertySnapshot } from './catalog';
import { createInventoryStore } from './inventoryFeed';

const inventory = createInventoryStore(propertySnapshot);

export function useInventory() {
  const state = useSyncExternalStore(inventory.subscribe, inventory.getSnapshot, inventory.getSnapshot);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void inventory.refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void inventory.refresh();
    });
    return () => subscription.remove();
  }, []);
  return { ...state, refresh: inventory.refresh };
}
