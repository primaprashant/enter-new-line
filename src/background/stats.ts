/** Debounced stats writer. Content scripts fire-and-forget; we batch into storage. */

import { runtime } from '@shared/browser';
import type { ExtensionMessage, StatKind } from '@shared/messages';
import { emptySiteStats } from '@shared/schema';
import { updateState } from '@shared/storage';

const FLUSH_DELAY_MS = 2000;

interface Delta {
  newlines: number;
  sends: number;
}

const pending = new Map<string, Delta>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function bump(host: string, kind: StatKind): void {
  const d = pending.get(host) ?? { newlines: 0, sends: 0 };
  if (kind === 'newline') d.newlines += 1;
  else d.sends += 1;
  pending.set(host, d);
}

function mergeBack(snapshot: Map<string, Delta>): void {
  for (const [host, delta] of snapshot) {
    const cur = pending.get(host) ?? { newlines: 0, sends: 0 };
    pending.set(host, {
      newlines: cur.newlines + delta.newlines,
      sends: cur.sends + delta.sends,
    });
  }
}

async function flush(): Promise<void> {
  flushTimer = null;
  if (pending.size === 0) return;

  const snapshot = new Map(pending);
  pending.clear();

  try {
    await updateState((state) => {
      const perHost = { ...state.stats.perHost };
      let totalNew = 0;
      let totalSend = 0;
      for (const [host, delta] of snapshot) {
        const cur = perHost[host] ?? emptySiteStats();
        perHost[host] = {
          newlines: cur.newlines + delta.newlines,
          sends: cur.sends + delta.sends,
        };
        totalNew += delta.newlines;
        totalSend += delta.sends;
      }
      return {
        ...state,
        stats: {
          global: {
            newlines: state.stats.global.newlines + totalNew,
            sends: state.stats.global.sends + totalSend,
          },
          perHost,
        },
      };
    });
  } catch (err) {
    console.warn('[EnterNewLine] stats flush failed; retaining counts:', err);
    mergeBack(snapshot);
    schedule();
  }
}

function schedule(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => void flush(), FLUSH_DELAY_MS);
}

function isStatMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  if (m['type'] !== 'stat') return false;
  if (m['kind'] !== 'newline' && m['kind'] !== 'send') return false;
  if (typeof m['host'] !== 'string' || m['host'].length === 0) return false;
  return true;
}

export function installStatsListener(): void {
  runtime.onMessage.addListener((message: unknown) => {
    if (!isStatMessage(message)) return;
    bump(message.host, message.kind);
    schedule();
  });
}
