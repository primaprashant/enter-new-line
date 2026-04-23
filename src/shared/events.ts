/** Cross-context pub/sub over `storage.onChanged`. */

import { storage } from './browser';
import { STORAGE_KEY, type StoredState } from './schema';
import { migrateState } from './migration';

export type StateListener = (next: StoredState, prev: StoredState | null) => void;

type StorageChange = { oldValue?: unknown; newValue?: unknown };

/** Subscribe to sync-state changes. Returns an unsubscribe function. */
export function onStateChange(listener: StateListener): () => void {
  const handler = (changes: Record<string, StorageChange>, area: string): void => {
    if (area !== 'sync') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    const next = migrateState(change.newValue);
    const prev = change.oldValue === undefined ? null : migrateState(change.oldValue);
    listener(next, prev);
  };
  storage.onChanged.addListener(handler);
  return () => {
    storage.onChanged.removeListener(handler);
  };
}
