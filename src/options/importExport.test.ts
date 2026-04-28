import { describe, expect, it, vi } from 'vitest';

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
    grantedCustomHosts: ['grok.com'],
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
  it('persists imported default-site settings and drops legacy custom-site fields', async () => {
    const result = await applyImport(importBlob());
    const state = await getState();

    expect(result).toEqual({ disabledDefaults: 1 });
    expect(state).toEqual({
      schemaVersion: 1,
      disabledDefaults: ['claude'],
      stats: { global: { newlines: 0, sends: 0 }, perHost: {} },
    });
  });

  it('keeps local stats and discards the imported counters', async () => {
    await setState({
      schemaVersion: 1,
      disabledDefaults: [],
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
});
