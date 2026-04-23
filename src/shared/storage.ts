/** Typed wrapper over `browser.storage.sync` for the state blob. */

import { storage } from './browser';
import { STORAGE_KEY, type StoredState } from './schema';
import { migrateState } from './migration';

/** Fetch the current state, migrating the persisted blob on the fly. */
export async function getState(): Promise<StoredState> {
  const raw = await storage.sync.get(STORAGE_KEY);
  return migrateState(raw[STORAGE_KEY]);
}

/** Replace the full state blob. */
export async function setState(next: StoredState): Promise<void> {
  await storage.sync.set({ [STORAGE_KEY]: next });
}

/**
 * Read-modify-write convenience.
 *
 * Note: this is not transactional across concurrent writers.
 */
export async function updateState(
  mutate: (current: StoredState) => StoredState,
): Promise<StoredState> {
  const current = await getState();
  const next = mutate(current);
  await setState(next);
  return next;
}

/** Persist the migrated shape back to disk. */
export async function runMigrations(): Promise<StoredState> {
  const migrated = await getState();
  await setState(migrated);
  return migrated;
}
