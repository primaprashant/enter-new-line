import { describe, expect, it } from 'vitest';

import { syncStorage } from '../../tests/fakeBrowser';
import { STORAGE_KEY, type StoredState } from './schema';
import { getState, runMigrations, setState, updateState } from './storage';

describe('storage module', () => {
  it('returns an initial state when nothing is persisted', async () => {
    const state = await getState();
    expect(state.schemaVersion).toBe(1);
    expect(state.disabledDefaults).toEqual([]);
    expect(state.customSites).toEqual([]);
    expect(state.grantedCustomHosts).toEqual([]);
  });

  it('round-trips via setState + getState', async () => {
    const next: StoredState = {
      schemaVersion: 1,
      disabledDefaults: ['claude'],
      customSites: [{ host: 'grok.com', enabled: true, addedAt: 100 }],
      grantedCustomHosts: ['grok.com'],
      stats: { global: { newlines: 1, sends: 2 }, perHost: {} },
    };
    await setState(next);
    expect(await getState()).toEqual(next);
  });

  it('applies migration to whatever blob is in storage', async () => {
    syncStorage()[STORAGE_KEY] = {
      disabledDefaults: ['gone-from-defaults', 'chatgpt'],
      customSites: [{ host: 'grok.com', addedAt: 1 }, { host: 'localhost' }],
      stats: { global: { newlines: 'bad' } },
    };
    const state = await getState();
    expect(state.disabledDefaults).toEqual(['chatgpt']);
    expect(state.customSites).toEqual([{ host: 'grok.com', enabled: true, addedAt: 1 }]);
    expect(state.stats.global.newlines).toBe(0);
  });

  it('updateState exposes the current state and persists the result', async () => {
    await setState({
      schemaVersion: 1,
      disabledDefaults: [],
      customSites: [],
      grantedCustomHosts: [],
      stats: { global: { newlines: 0, sends: 0 }, perHost: {} },
    });
    const next = await updateState((s) => ({
      ...s,
      disabledDefaults: ['gemini'],
    }));
    expect(next.disabledDefaults).toEqual(['gemini']);
    expect((await getState()).disabledDefaults).toEqual(['gemini']);
  });

  it('runMigrations writes the normalized blob back to disk', async () => {
    syncStorage()[STORAGE_KEY] = {
      disabledDefaults: ['chatgpt', 'chatgpt'],
      grantedCustomHosts: ['Grok.COM', 'Grok.COM'],
    };
    const out = await runMigrations();
    expect(out.disabledDefaults).toEqual(['chatgpt']);
    expect(out.grantedCustomHosts).toEqual(['grok.com']);
    const persisted = syncStorage()[STORAGE_KEY] as StoredState;
    expect(persisted.disabledDefaults).toEqual(['chatgpt']);
    expect(persisted.grantedCustomHosts).toEqual(['grok.com']);
  });
});
