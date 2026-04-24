import { describe, expect, it } from 'vitest';

import { createInitialState, type StoredState } from './schema';
import { isReadyOn } from './siteStatus';

function state(overrides: Partial<StoredState> = {}): StoredState {
  return { ...createInitialState(), ...overrides };
}

describe('isReadyOn', () => {
  it('returns true for a default site that is enabled', () => {
    expect(isReadyOn('chatgpt.com', state())).toBe(true);
  });

  it('returns false for a default site the user has paused', () => {
    expect(isReadyOn('chatgpt.com', state({ disabledDefaults: ['chatgpt'] }))).toBe(false);
  });

  it('returns false for an unknown host', () => {
    expect(isReadyOn('unknown.example', state())).toBe(false);
  });

  it('requires a host permission for custom sites', () => {
    const s = state({
      customSites: [{ host: 'grok.com', enabled: true, addedAt: 1 }],
    });
    expect(isReadyOn('grok.com', s)).toBe(false);

    const granted = state({
      customSites: [{ host: 'grok.com', enabled: true, addedAt: 1 }],
      grantedCustomHosts: ['grok.com'],
    });
    expect(isReadyOn('grok.com', granted)).toBe(true);
  });

  it('returns false for a paused custom site even when permission is granted', () => {
    expect(
      isReadyOn(
        'grok.com',
        state({
          customSites: [{ host: 'grok.com', enabled: false, addedAt: 1 }],
          grantedCustomHosts: ['grok.com'],
        }),
      ),
    ).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(isReadyOn('', state())).toBe(false);
  });
});
