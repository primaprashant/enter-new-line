import { describe, expect, it, vi } from 'vitest';

import { fakeBrowser, grantOrigins, setNextPermissionDecision } from '../../tests/fakeBrowser';
import { applyImport, exportToFile, parseImportText } from './importExport';
import { type StoredState } from '@shared/schema';
import { getState, setState } from '@shared/storage';

function importBlob(): unknown {
  return {
    schemaVersion: 1,
    disabledDefaults: ['claude'],
    customSites: [
      { host: 'grok.com', enabled: true, addedAt: 100 },
      { host: 'qwen.ai', enabled: false, addedAt: 200 },
    ],
    grantedCustomHosts: [],
    stats: {
      global: { newlines: 999, sends: 999 },
      perHost: { 'grok.com': { newlines: 50, sends: 25 } },
    },
  };
}

describe('parseImportText', () => {
  it('returns parsed JSON for valid input', () => {
    expect(parseImportText('{"a":1}')).toEqual({ a: 1 });
  });

  it('throws a descriptive error on invalid JSON', () => {
    expect(() => parseImportText('not json')).toThrow('That file is not valid JSON.');
  });
});

describe('exportToFile', () => {
  it('triggers a download of the serialized state', () => {
    document.body.innerHTML = '';
    const clicks: HTMLAnchorElement[] = [];
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag) as HTMLElement;
      if (tag === 'a') {
        const anchor = el as HTMLAnchorElement;
        anchor.click = () => clicks.push(anchor);
      }
      return el as HTMLElement;
    });

    const state: StoredState = {
      schemaVersion: 1,
      disabledDefaults: [],
      customSites: [],
      grantedCustomHosts: [],
      stats: { global: { newlines: 0, sends: 0 }, perHost: {} },
    };
    exportToFile(state);

    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.download).toBe('enternewline-settings.json');
    expect(clicks[0]?.href.startsWith('blob:')).toBe(true);
    createSpy.mockRestore();
  });
});

describe('applyImport', () => {
  it('makes a single batched permission request for every imported custom host', async () => {
    const requestSpy = vi.spyOn(fakeBrowser.permissions, 'request');
    await applyImport(importBlob());

    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy.mock.calls[0]?.[0]?.origins).toEqual([
      '*://grok.com/*',
      '*://*.grok.com/*',
      '*://qwen.ai/*',
      '*://*.qwen.ai/*',
    ]);
  });

  it('persists imported sites and migrates the blob', async () => {
    await applyImport(importBlob());
    const state = await getState();
    expect(state.disabledDefaults).toEqual(['claude']);
    expect(state.customSites.map((c) => c.host)).toEqual(['grok.com', 'qwen.ai']);
    expect(state.customSites[0]?.enabled).toBe(true);
    expect(state.customSites[1]?.enabled).toBe(false);
  });

  it('keeps local stats and discards the imported counters', async () => {
    await setState({
      schemaVersion: 1,
      disabledDefaults: [],
      customSites: [],
      grantedCustomHosts: [],
      stats: {
        global: { newlines: 7, sends: 3 },
        perHost: { 'chatgpt.com': { newlines: 7, sends: 3 } },
      },
    });

    await applyImport(importBlob());
    const state = await getState();
    expect(state.stats.global).toEqual({ newlines: 7, sends: 3 });
    expect(state.stats.perHost['chatgpt.com']).toEqual({ newlines: 7, sends: 3 });
  });

  it('reports granted vs denied counts', async () => {
    setNextPermissionDecision('grant');
    const result = await applyImport(importBlob());
    expect(result).toEqual({ customSites: 2, grantedHosts: 2, deniedHosts: 0 });
  });

  it('marks every site as denied when the user blocks the prompt', async () => {
    setNextPermissionDecision('deny');
    const result = await applyImport(importBlob());
    expect(result).toEqual({ customSites: 2, grantedHosts: 0, deniedHosts: 2 });
    const state = await getState();
    expect(state.grantedCustomHosts).toEqual([]);
  });

  it('keeps already-granted hosts in grantedCustomHosts even if the prompt is declined', async () => {
    grantOrigins('*://grok.com/*', '*://*.grok.com/*');
    setNextPermissionDecision('deny');
    const result = await applyImport(importBlob());
    expect(result.grantedHosts).toBe(1);
    const state = await getState();
    expect(state.grantedCustomHosts).toEqual(['grok.com']);
  });
});
