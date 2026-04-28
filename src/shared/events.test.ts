import { describe, expect, it, vi } from 'vitest';

import { storage } from './browser';
import { onStateChange } from './events';
import { STORAGE_KEY, type StoredState } from './schema';

const SAMPLE: StoredState = {
  schemaVersion: 1,
  disabledDefaults: ['chatgpt'],
  stats: { global: { newlines: 0, sends: 0 }, perHost: {} },
};

describe('onStateChange', () => {
  it('delivers prev/next migrated snapshots when our key changes', async () => {
    const listener = vi.fn();
    onStateChange(listener);

    await storage.sync.set({ [STORAGE_KEY]: SAMPLE });

    expect(listener).toHaveBeenCalledTimes(1);
    const [next, prev] = listener.mock.calls[0]!;
    expect(next.disabledDefaults).toEqual(['chatgpt']);
    expect(prev).toBeNull(); // first write has no oldValue
  });

  it('passes both prev and next on subsequent writes', async () => {
    const listener = vi.fn();
    onStateChange(listener);

    await storage.sync.set({ [STORAGE_KEY]: SAMPLE });
    await storage.sync.set({
      [STORAGE_KEY]: { ...SAMPLE, disabledDefaults: ['chatgpt', 'claude'] },
    });

    expect(listener).toHaveBeenCalledTimes(2);
    const [next, prev] = listener.mock.calls[1]!;
    expect(prev?.disabledDefaults).toEqual(['chatgpt']);
    expect(next.disabledDefaults).toEqual(['chatgpt', 'claude']);
  });

  it('ignores changes to other keys and other areas', async () => {
    const listener = vi.fn();
    onStateChange(listener);

    await storage.sync.set({ unrelated: 1 });
    await storage.local.set({ [STORAGE_KEY]: SAMPLE });

    expect(listener).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function', async () => {
    const listener = vi.fn();
    const unsubscribe = onStateChange(listener);
    unsubscribe();
    await storage.sync.set({ [STORAGE_KEY]: SAMPLE });
    expect(listener).not.toHaveBeenCalled();
  });
});
