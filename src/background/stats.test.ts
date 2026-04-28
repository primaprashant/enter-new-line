import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchMessage } from '../../tests/fakeBrowser';
import { getState } from '@shared/storage';
import type { StatEventMessage } from '@shared/messages';
import type * as StatsModuleType from './stats';

beforeEach(() => {
  // Each test gets its own copy of stats.ts so the module-level pending map
  // and flush timer start clean.
  vi.resetModules();
});

async function loadStats(): Promise<typeof StatsModuleType> {
  return import('./stats');
}

function statMessage(kind: 'newline' | 'send', host: string): StatEventMessage {
  return { type: 'stat', kind, host };
}

describe('installStatsListener', () => {
  it('ignores malformed messages', async () => {
    vi.useFakeTimers();
    const { installStatsListener } = await loadStats();
    installStatsListener();

    await dispatchMessage({ type: 'noop' });
    await dispatchMessage({ type: 'stat', host: 'chatgpt.com' }); // missing kind
    await dispatchMessage({ type: 'stat', kind: 'newline', host: '' });
    await dispatchMessage(null);

    await vi.advanceTimersByTimeAsync(5000);
    const state = await getState();
    expect(state.stats.global.newlines).toBe(0);
    expect(state.stats.global.sends).toBe(0);
    expect(state.stats.perHost).toEqual({});
  });

  it('batches multiple events for the same host into one storage write', async () => {
    vi.useFakeTimers();
    const { installStatsListener } = await loadStats();
    installStatsListener();

    await dispatchMessage(statMessage('newline', 'chatgpt.com'));
    await dispatchMessage(statMessage('newline', 'chatgpt.com'));
    await dispatchMessage(statMessage('send', 'chatgpt.com'));

    // Pending until 2s elapse.
    expect((await getState()).stats.global.newlines).toBe(0);

    await vi.advanceTimersByTimeAsync(2000);

    const state = await getState();
    expect(state.stats.global).toEqual({ newlines: 2, sends: 1 });
    expect(state.stats.perHost['chatgpt.com']).toEqual({ newlines: 2, sends: 1 });
  });

  it('keeps per-host buckets independent and accumulates in global', async () => {
    vi.useFakeTimers();
    const { installStatsListener } = await loadStats();
    installStatsListener();

    await dispatchMessage(statMessage('newline', 'chatgpt.com'));
    await dispatchMessage(statMessage('send', 'claude.ai'));
    await dispatchMessage(statMessage('newline', 'claude.ai'));

    await vi.advanceTimersByTimeAsync(2000);

    const state = await getState();
    expect(state.stats.global).toEqual({ newlines: 2, sends: 1 });
    expect(state.stats.perHost['chatgpt.com']).toEqual({ newlines: 1, sends: 0 });
    expect(state.stats.perHost['claude.ai']).toEqual({ newlines: 1, sends: 1 });
  });

  it('preserves counts already in storage when flushing', async () => {
    vi.useFakeTimers();
    const { installStatsListener } = await loadStats();
    installStatsListener();

    // Pre-seed.
    const { setState } = await import('@shared/storage');
    await setState({
      schemaVersion: 1,
      disabledDefaults: [],
      stats: {
        global: { newlines: 10, sends: 5 },
        perHost: { 'chatgpt.com': { newlines: 7, sends: 3 } },
      },
    });

    await dispatchMessage(statMessage('newline', 'chatgpt.com'));
    await vi.advanceTimersByTimeAsync(2000);

    const state = await getState();
    expect(state.stats.global).toEqual({ newlines: 11, sends: 5 });
    expect(state.stats.perHost['chatgpt.com']).toEqual({ newlines: 8, sends: 3 });
  });

  it('a single new event triggers exactly one scheduled flush', async () => {
    vi.useFakeTimers();
    const { installStatsListener } = await loadStats();
    installStatsListener();

    await dispatchMessage(statMessage('newline', 'chatgpt.com'));
    await dispatchMessage(statMessage('newline', 'chatgpt.com'));

    // Advance halfway — flush should not have fired yet.
    await vi.advanceTimersByTimeAsync(1000);
    expect((await getState()).stats.global.newlines).toBe(0);

    await vi.advanceTimersByTimeAsync(1000);
    expect((await getState()).stats.global.newlines).toBe(2);
  });
});
