import { describe, expect, it } from 'vitest';

import { migrateState } from './migration';
import { SCHEMA_VERSION, createInitialState } from './schema';

describe('migrateState', () => {
  it('returns a fresh state for non-objects', () => {
    expect(migrateState(undefined)).toEqual(createInitialState());
    expect(migrateState(null)).toEqual(createInitialState());
    expect(migrateState('nope')).toEqual(createInitialState());
    expect(migrateState([])).toEqual(createInitialState());
  });

  it('always reports the current schema version', () => {
    const out = migrateState({ schemaVersion: 0 });
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('dedupes disabledDefaults and drops unknown ids', () => {
    const out = migrateState({
      disabledDefaults: ['chatgpt', 'chatgpt', 'gone-from-defaults'],
    });
    expect(out.disabledDefaults).toEqual(['chatgpt']);
  });

  it('drops invalid customSites and dedupes by host', () => {
    const out = migrateState({
      customSites: [
        { host: 'grok.com', enabled: true, addedAt: 100 },
        { host: 'grok.com', enabled: false, addedAt: 200 }, // duplicate
        { host: 'not a host' },
        { host: 'localhost' }, // invalid (single label)
        'string',
        { enabled: true },
      ],
    });
    expect(out.customSites).toEqual([{ host: 'grok.com', enabled: true, addedAt: 100 }]);
  });

  it('canonicalizes and validates grantedCustomHosts', () => {
    const out = migrateState({
      grantedCustomHosts: ['Grok.COM', 'grok.com', 'localhost', 42],
    });
    expect(out.grantedCustomHosts).toEqual(['grok.com']);
  });

  it('preserves valid stats and resets bad ones to zero', () => {
    const out = migrateState({
      stats: {
        global: { newlines: 5, sends: -1 },
        perHost: {
          'CHATGPT.com': { newlines: 3, sends: 'bad' },
          '': { newlines: 1, sends: 1 },
        },
      },
    });
    expect(out.stats.global).toEqual({ newlines: 5, sends: 0 });
    expect(out.stats.perHost['chatgpt.com']).toEqual({ newlines: 3, sends: 0 });
    expect(out.stats.perHost['']).toBeUndefined();
  });

  it('defaults missing customSite.enabled to true', () => {
    const out = migrateState({
      customSites: [{ host: 'grok.com', addedAt: 1 }],
    });
    expect(out.customSites[0]?.enabled).toBe(true);
  });

  it('clamps non-finite or negative addedAt to 0', () => {
    const out = migrateState({
      customSites: [
        { host: 'a.com', addedAt: Number.NaN },
        { host: 'b.com', addedAt: -1 },
        { host: 'c.com', addedAt: 12345 },
      ],
    });
    expect(out.customSites.map((c) => [c.host, c.addedAt])).toEqual([
      ['a.com', 0],
      ['b.com', 0],
      ['c.com', 12345],
    ]);
  });
});
