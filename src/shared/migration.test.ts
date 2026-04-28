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

  it('drops legacy custom-site fields', () => {
    const out = migrateState({
      customSites: [{ host: 'grok.com', enabled: true, addedAt: 100 }],
      grantedCustomHosts: ['grok.com'],
    });
    expect('customSites' in out).toBe(false);
    expect('grantedCustomHosts' in out).toBe(false);
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
});
