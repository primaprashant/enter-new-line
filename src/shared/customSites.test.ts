import { describe, expect, it } from 'vitest';

import { grantOrigins, isGranted, setNextPermissionDecision } from '../../tests/fakeBrowser';
import { addCustomSite, originsFor, removeCustomSite, setCustomSiteEnabled } from './customSites';
import { getState, setState } from './storage';

describe('originsFor', () => {
  it('returns both apex and wildcard origins', () => {
    expect(originsFor('grok.com')).toEqual(['*://grok.com/*', '*://*.grok.com/*']);
  });
});

describe('addCustomSite', () => {
  it('rejects invalid hosts without touching state or permissions', async () => {
    const result = await addCustomSite('not a host');
    expect(result).toEqual({ status: 'invalid' });
    const state = await getState();
    expect(state.customSites).toEqual([]);
    expect(isGranted('*://not a host/*')).toBe(false);
  });

  it('rejects duplicates', async () => {
    await setState({
      schemaVersion: 1,
      disabledDefaults: [],
      customSites: [{ host: 'grok.com', enabled: true, addedAt: 1 }],
      grantedCustomHosts: ['grok.com'],
      stats: { global: { newlines: 0, sends: 0 }, perHost: {} },
    });

    const result = await addCustomSite('grok.com');
    expect(result).toEqual({ status: 'duplicate', host: 'grok.com' });
  });

  it('returns "denied" when the user blocks the permission prompt', async () => {
    setNextPermissionDecision('deny');
    const result = await addCustomSite('grok.com');
    expect(result).toEqual({ status: 'denied', host: 'grok.com' });
    const state = await getState();
    expect(state.customSites).toEqual([]);
    expect(state.grantedCustomHosts).toEqual([]);
  });

  it('persists the site and grant after the user approves', async () => {
    const result = await addCustomSite('Grok.COM');
    expect(result).toEqual({ status: 'ok', host: 'grok.com' });

    expect(isGranted('*://grok.com/*')).toBe(true);
    expect(isGranted('*://*.grok.com/*')).toBe(true);

    const state = await getState();
    expect(state.customSites).toHaveLength(1);
    expect(state.customSites[0]?.host).toBe('grok.com');
    expect(state.customSites[0]?.enabled).toBe(true);
    expect(state.grantedCustomHosts).toEqual(['grok.com']);
  });
});

describe('removeCustomSite', () => {
  it('drops the site, the grant entry, and revokes permissions', async () => {
    grantOrigins('*://grok.com/*', '*://*.grok.com/*');
    await setState({
      schemaVersion: 1,
      disabledDefaults: [],
      customSites: [{ host: 'grok.com', enabled: true, addedAt: 1 }],
      grantedCustomHosts: ['grok.com'],
      stats: { global: { newlines: 0, sends: 0 }, perHost: {} },
    });

    await removeCustomSite('grok.com');
    const state = await getState();
    expect(state.customSites).toEqual([]);
    expect(state.grantedCustomHosts).toEqual([]);
    expect(isGranted('*://grok.com/*')).toBe(false);
  });

  it('is a no-op for empty input', async () => {
    await removeCustomSite('');
    expect((await getState()).customSites).toEqual([]);
  });
});

describe('setCustomSiteEnabled', () => {
  it('flips the enabled flag for the matching host only', async () => {
    await setState({
      schemaVersion: 1,
      disabledDefaults: [],
      customSites: [
        { host: 'grok.com', enabled: true, addedAt: 1 },
        { host: 'qwen.ai', enabled: true, addedAt: 2 },
      ],
      grantedCustomHosts: ['grok.com', 'qwen.ai'],
      stats: { global: { newlines: 0, sends: 0 }, perHost: {} },
    });
    await setCustomSiteEnabled('grok.com', false);
    const state = await getState();
    expect(state.customSites.find((c) => c.host === 'grok.com')?.enabled).toBe(false);
    expect(state.customSites.find((c) => c.host === 'qwen.ai')?.enabled).toBe(true);
  });
});
