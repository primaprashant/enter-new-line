/** Runtime messages passed between content scripts and the background worker. */

import { runtime } from './browser';

export type StatKind = 'newline' | 'send';

export interface StatEventMessage {
  type: 'stat';
  kind: StatKind;
  /** Canonical host the event was observed on. */
  host: string;
}

export type ExtensionMessage = StatEventMessage;

/** Fire-and-forget stat emission for the content-script hot path. */
export function sendStat(kind: StatKind, host: string): void {
  const msg: StatEventMessage = { type: 'stat', kind, host };
  void runtime.sendMessage(msg).catch(() => {
    /* background may be asleep or not yet listening (Phase 4) */
  });
}
