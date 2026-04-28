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

  it('returns false for empty input', () => {
    expect(isReadyOn('', state())).toBe(false);
  });
});
