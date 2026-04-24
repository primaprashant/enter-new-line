import { describe, expect, it } from 'vitest';

import { canonicalHost, hostMatches, isValidHost, resolveSite, siteStatsKey } from './matching';
import { createInitialState, type StoredState } from './schema';

function makeState(overrides: Partial<StoredState> = {}): StoredState {
  return { ...createInitialState(), ...overrides };
}

describe('canonicalHost', () => {
  it('lowercases and trims input', () => {
    expect(canonicalHost('  ChatGPT.COM  ')).toBe('chatgpt.com');
  });

  it('strips schemes, ports, paths, queries, fragments, userinfo, and trailing dots', () => {
    expect(canonicalHost('https://user:pw@chatgpt.com:443/foo?bar#baz')).toBe('chatgpt.com');
    expect(canonicalHost('chatgpt.com.')).toBe('chatgpt.com');
    expect(canonicalHost('.chatgpt.com')).toBe('chatgpt.com');
  });

  it('returns empty string for empty input', () => {
    expect(canonicalHost('')).toBe('');
    expect(canonicalHost('   ')).toBe('');
  });
});

describe('isValidHost', () => {
  it('accepts standard hostnames', () => {
    expect(isValidHost('chatgpt.com')).toBe(true);
    expect(isValidHost('mail.google.com')).toBe(true);
    expect(isValidHost('a-b.example.io')).toBe(true);
  });

  it('rejects single-label hosts and bare TLDs', () => {
    expect(isValidHost('localhost')).toBe(false);
    expect(isValidHost('com')).toBe(false);
  });

  it('rejects IPv4 and TLD-only-numeric inputs', () => {
    expect(isValidHost('127.0.0.1')).toBe(false);
  });

  it('rejects illegal label characters and edge dashes', () => {
    expect(isValidHost('-bad.com')).toBe(false);
    expect(isValidHost('bad-.com')).toBe(false);
    expect(isValidHost('under_score.com')).toBe(false);
    expect(isValidHost('Bad.Com')).toBe(false); // already-lowercased input expected
  });

  it('rejects empty or oversized hosts', () => {
    expect(isValidHost('')).toBe(false);
    expect(isValidHost('a'.repeat(254) + '.com')).toBe(false);
  });
});

describe('hostMatches', () => {
  it('treats equality as a match', () => {
    expect(hostMatches('chatgpt.com', 'chatgpt.com')).toBe(true);
  });

  it('treats subdomains as a match', () => {
    expect(hostMatches('foo.chatgpt.com', 'chatgpt.com')).toBe(true);
    expect(hostMatches('a.b.chatgpt.com', 'chatgpt.com')).toBe(true);
  });

  it('does not cross-match siblings', () => {
    expect(hostMatches('mail.google.com', 'gemini.google.com')).toBe(false);
    expect(hostMatches('google.com', 'gemini.google.com')).toBe(false);
  });

  it('does not match parent against child', () => {
    expect(hostMatches('google.com', 'mail.google.com')).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(hostMatches('', 'chatgpt.com')).toBe(false);
    expect(hostMatches('chatgpt.com', '')).toBe(false);
  });
});

describe('resolveSite', () => {
  it('returns a default site when the page host matches', () => {
    const site = resolveSite('chatgpt.com', makeState());
    expect(site).toEqual({
      kind: 'default',
      id: 'chatgpt',
      host: 'chatgpt.com',
      label: 'ChatGPT',
      enabled: true,
    });
  });

  it('reflects disabledDefaults in `enabled`', () => {
    const site = resolveSite('chatgpt.com', makeState({ disabledDefaults: ['chatgpt'] }));
    expect(site?.enabled).toBe(false);
  });

  it('returns a custom site when no default matches', () => {
    const state = makeState({
      customSites: [{ host: 'grok.com', enabled: true, addedAt: 1 }],
    });
    const site = resolveSite('chat.grok.com', state);
    expect(site).toEqual({
      kind: 'custom',
      host: 'grok.com',
      label: 'grok.com',
      enabled: true,
    });
  });

  it('prefers a longer custom-host match over a shorter one', () => {
    const state = makeState({
      customSites: [
        { host: 'example.com', enabled: true, addedAt: 1 },
        { host: 'sub.example.com', enabled: false, addedAt: 2 },
      ],
    });
    const site = resolveSite('foo.sub.example.com', state);
    expect(site?.host).toBe('sub.example.com');
    expect(site?.enabled).toBe(false);
  });

  it('lets defaults shadow same-host custom sites', () => {
    const state = makeState({
      customSites: [{ host: 'chatgpt.com', enabled: false, addedAt: 1 }],
    });
    const site = resolveSite('chatgpt.com', state);
    expect(site?.kind).toBe('default');
    expect(site?.enabled).toBe(true);
  });

  it('returns null on unknown hosts and empty input', () => {
    expect(resolveSite('unknown.example', makeState())).toBeNull();
    expect(resolveSite('', makeState())).toBeNull();
  });
});

describe('siteStatsKey', () => {
  it('uses the canonical site host', () => {
    const state = makeState();
    const site = resolveSite('chatgpt.com', state);
    expect(site).not.toBeNull();
    expect(siteStatsKey(site!)).toBe('chatgpt.com');
  });
});
